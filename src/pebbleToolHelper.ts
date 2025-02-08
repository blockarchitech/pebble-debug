// Helper for the Pebble Tool

import * as fs from 'fs';
import * as path from 'path';
import * as subprocess from 'child_process';

type Platform = 'aplite' | 'basalt' | 'chalk' | 'diorite' | 'emery';
// example usage:
// const pebbleTool = PebbleTool.getInstance();
// pebbleTool.buildProject(cwd);
class PebbleTool {
	private static _instance: PebbleTool;
	private _pebbleDevPath: string;
	private _pebbleSDKPath: string;
	private _pebbleToolPath: string;
	private _armCSToolsPath: string;

	private constructor() {
		this._pebbleDevPath = path.join(process.env.HOME, 'pebble-dev');
		this._pebbleSDKPath = path.join(this._pebbleDevPath, 'pebble-sdk-4.6-rc2-linux64'); // pebble toolchain + ARM tools. the SDK core is actually in ~/.pebble-sdk
		this._pebbleToolPath = path.join(this._pebbleSDKPath, 'bin'); // pebble
		this._armCSToolsPath = path.join(this._pebbleSDKPath, 'arm-cs-tools', 'bin'); // arm-none-eabi-xxx tools 
	}

	public static getInstance(): PebbleTool {
		if (!PebbleTool._instance) {
			PebbleTool._instance = new PebbleTool();
		}
		return PebbleTool._instance;
	}

	public getARMCSTool(tool: string): string {
		const toolPath = path.join(this._armCSToolsPath, tool);
		if (!fs.existsSync(toolPath)) {
			throw new Error(`Can't find ${tool}. Is the SDK installed?`);
		}
		return toolPath;
	}

	public spawnEmulator(cwd: string, platform: Platform) {
		this.buildProject(cwd);
		const pebbleInstall = subprocess.spawnSync('pebble', ['install', '--emulator', platform], { cwd });
		if (pebbleInstall.status !== 0) {
			throw new PebbleToolError(`Emulator failed to start with exit code ${pebbleInstall.status}`);
		}

		return;
	}

	public killEmulator(platform: Platform) {
		const emulators = JSON.parse(fs.readFileSync("/tmp/pb-emulator.json", "utf8"));
		if (!emulators[platform]) {
			throw new Error(`No emulator running for platform ${platform}`);
		}

		const emulator = emulators[platform];
		const qemu = emulator[Object.keys(emulator)[0]].qemu;
		const pid = qemu.pid;
		process.kill(pid);
	}

	public buildProject(cwd: string) {
		const pebbleBuild = subprocess.spawnSync('pebble', ['build'], { cwd });
		if (pebbleBuild.status !== 0) {
			throw new PebbleToolError(`Build failed with exit code ${pebbleBuild.status}: ${pebbleBuild.stderr.toString()}`);
		}

	}



	
}

// custom error...
class PebbleToolError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PebbleToolError';
	}
}

export { PebbleTool };