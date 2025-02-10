import { MI2DebugSession, RunCommand } from './mibase';
import { DebugSession, TerminatedEvent } from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { MI2 } from "./backend/mi2/mi2";
import { buildGdbCommands } from './commandHelper';
import { PebbleTool } from './pebbleToolHelper';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
	platform: string;
	elfPath: string;
	workDir: string;
}

export interface AttachRequestArguments extends DebugProtocol.AttachRequestArguments {
	platform: string;
	elfPath: string;
	workDir: string;
}

const SDK_VERSION = "4.3";
const HOMEDIR = os.homedir();
const OS_PLATFORM = os.platform();

function _getFirmwareSymbolFile(platform: string, sdk_version: string): string {
	if (OS_PLATFORM === "linux") {
		const fw_symbols = path.join(HOMEDIR, ".pebble-sdk", "SDKs", sdk_version, "sdk-core", "pebble", platform, "qemu", `${platform}_sdk_debug.elf`);
		if (!fs.existsSync(fw_symbols)) {
			throw new Error(`Firmware symbols not found at ${fw_symbols}. Is the SDK installed?`);
		}
		return fw_symbols;
	} else if (OS_PLATFORM === "darwin") {
		const fw_symbols = path.join(HOMEDIR, "Library", "Application Support", "Pebble SDK", "SDKs", sdk_version, "sdk-core", "pebble", platform, "qemu", `${platform}_sdk_debug.elf`);
		if (!fs.existsSync(fw_symbols)) {
			throw new Error(`Firmware symbols not found at ${fw_symbols}. Is the SDK installed?`);
		}
		return fw_symbols;
	} else {
		throw new Error(`Unsupported platform ${OS_PLATFORM}`);
	}
}
function _getGdbPath(): string {
	if (OS_PLATFORM === "linux") {
		const gdbPath = path.join(HOMEDIR, "pebble-dev", "pebble-sdk-4.6-rc2-linux64", "arm-cs-tools", "bin", "arm-none-eabi-gdb");
		if (!fs.existsSync(gdbPath)) {
			throw new Error(`Can't find Pebble gdb. Is the SDK installed?`);
		}
		return gdbPath;
	} else if (OS_PLATFORM === "darwin") {
		const gdbPath = path.join(HOMEDIR, "pebble-dev", "pebble-sdk-4.6-rc2-mac", "arm-cs-tools", "bin", "arm-none-eabi-gdb");
		if (!fs.existsSync(gdbPath)) {
			throw new Error(`Can't find Pebble gdb. Is the SDK installed?`);
		}
		return gdbPath;
	} else {
		throw new Error(`Unsupported platform ${OS_PLATFORM}`);
	}
}

function _getEmulatorPath(): string {
	// get pb-emulator.json
	if (OS_PLATFORM === "linux") {
		const emulatorPath = path.join("/tmp", "pb-emulator.json");
		return emulatorPath;
	} else if (OS_PLATFORM === "darwin") {
		throw new Error(`macOS support is not implemented yet.`);
	} else {
		throw new Error(`Unsupported platform ${OS_PLATFORM}`);
	}
}


class PebbleDebugSession extends MI2DebugSession {
	protected override initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
		response.body.supportsGotoTargetsRequest = true;
		response.body.supportsHitConditionalBreakpoints = true;
		response.body.supportsConfigurationDoneRequest = true;
		response.body.supportsConditionalBreakpoints = true;
		response.body.supportsFunctionBreakpoints = true;
		response.body.supportsEvaluateForHovers = true;
		response.body.supportsSetVariable = true;
		response.body.supportsStepBack = true;
		response.body.supportsLogPoints = true;
		this.sendResponse(response);
	}

	protected override launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): void {
		const pebbleTool = PebbleTool.getInstance();
		pebbleTool.spawnEmulator(args.workDir, args.platform as any);
		const dbgCommand = _getGdbPath();
		if (!this.checkCommand(dbgCommand)) {
			this.sendErrorResponse(response, 104, `Configured debugger ${dbgCommand} not found.`);
			return;
		}

		const emulators = JSON.parse(fs.readFileSync(_getEmulatorPath(), "utf8"));
		if (!emulators[args.platform]) {
			this.sendErrorResponse(response, 104, `Emulator with platform ${args.platform} not found.`);
			return;
		}
		const emulator = emulators[args.platform][SDK_VERSION];
		if (!emulator) {
			this.sendErrorResponse(response, 104, `Emulator with platform ${args.platform} does not support SDK version ${SDK_VERSION}.`);
			return;
		}
		const gdbPort = emulator.qemu.gdb;
		if (!gdbPort) {
			this.sendErrorResponse(response, 104, `Emulator with platform ${args.platform} does not have a GDB server.`);
			return;
		}
		const fw_elf = _getFirmwareSymbolFile(args.platform, SDK_VERSION);

		const gdbCommands = buildGdbCommands(args.elfPath, fw_elf, args.platform);

		this.miDebugger = new MI2(dbgCommand, [
			"--interpreter=mi2"
		], [], []);
		this.initDebugger();
		this.quit = false;
		this.platform = args.platform;
		this.attached = false;
		this.initialRunCommand = RunCommand.NONE;
		this.isSSH = false;
		this.setValuesFormattingMode("disabled");
		this.miDebugger.frameFilters = false;
		this.miDebugger.printCalls = true;
		this.miDebugger.debugOutput = true;
		this.miDebugger.prettyPrint = true;
		this.stopAtEntry = false;
		this.miDebugger.registerLimit = "";

		this.miDebugger.connect(path.join(args.workDir, "build"), fw_elf, `:${gdbPort}`, gdbCommands).then(() => {
			this.sendResponse(response);
		}, err => {
			this.sendErrorResponse(response, 102, `Failed to launch: ${err.toString()}`);
		});
	}

	protected override quitEvent(): void {
		this.quit = true;
		this.sendEvent(new TerminatedEvent());

		if (this.serverPath)
			fs.unlink(this.serverPath, (err) => {
				// eslint-disable-next-line no-console
				console.error("Failed to unlink debug server");
			});

		const pebbleTool = PebbleTool.getInstance();
		pebbleTool.killEmulator(this.platform as any);
	}

	protected override attachRequest(response: DebugProtocol.AttachResponse, args: AttachRequestArguments): void {
		const dbgCommand = _getGdbPath();
		if (!this.checkCommand(dbgCommand)) {
			this.sendErrorResponse(response, 104, `Configured debugger ${dbgCommand} not found.`);
			return;
		}

		const emulators = JSON.parse(fs.readFileSync(_getEmulatorPath(), "utf8"));
		if (!emulators[args.platform]) {
			this.sendErrorResponse(response, 104, `Emulator with platform ${args.platform} not found.`);
			return;
		}


		const emulator = emulators[args.platform][SDK_VERSION];
		if (!emulator) {
			this.sendErrorResponse(response, 104, `Emulator with platform ${args.platform} does not support SDK version ${SDK_VERSION}.`);
			return;
		}
		const gdbPort = emulator.qemu.gdb;
		if (!gdbPort) {
			this.sendErrorResponse(response, 104, `Emulator with platform ${args.platform} does not have a GDB server.`);
			return;
		}
		// check if emulator.qemu.pid exists, and is currently running
		const pid = emulator.qemu.pid;
		let pidExists = false;
		try {
			pidExists = fs.existsSync(`/proc/${pid}`);
		} catch (e) {
			// ignore
		}
		if (!pidExists) {
			this.sendErrorResponse(response, 104, `Emulator with platform ${args.platform} is not running.`);
			return;
		}

		const fw_elf = _getFirmwareSymbolFile(args.platform, SDK_VERSION);
		const gdbCommands = buildGdbCommands(args.elfPath, fw_elf, args.platform);

		this.miDebugger = new MI2(dbgCommand, ["--interpreter=mi2"], [], []);
		this.initDebugger();
		this.quit = false;
		this.attached = false;
		this.initialRunCommand = RunCommand.NONE;
		this.isSSH = false;
		this.platform = args.platform;
		this.setValuesFormattingMode("disabled");
		this.miDebugger.frameFilters = false;
		this.miDebugger.printCalls = false;
		this.miDebugger.debugOutput = false;
		this.miDebugger.prettyPrint = true;
		this.stopAtEntry = false;
		this.miDebugger.registerLimit = "";

		this.miDebugger.connect(path.join(args.workDir, "build"), fw_elf, `:${gdbPort}`, gdbCommands).then(() => {
			this.sendResponse(response);
		}, err => {
			this.sendErrorResponse(response, 102, `Failed to launch: ${err.toString()}`);
		});
	}
}

DebugSession.run(PebbleDebugSession);

