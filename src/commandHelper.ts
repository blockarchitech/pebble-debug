import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { AttachRequestArguments, LaunchRequestArguments } from './pebble';
import { PebbleTool } from './pebbleToolHelper';



function buildGdbCommands(appElfPath: string, fwElfPath: string, platform: string, args: LaunchRequestArguments | AttachRequestArguments): string[] {
    const tool = new PebbleTool(args);
    function findAppSectionOffsets(appElfPath: string) {
        const toolpath = tool.getARMCSTool('arm-none-eabi-objdump');
        const elfSections = execSync(`${toolpath} --headers --wide ${appElfPath}`)
            .toString()
            .split('\n')
            .slice(5);
        const offsets: { [key: string]: number } = {};
        for (const sectionString of elfSections) {
            const [index, name, size, vma, lma, file_offset, align, ...flags] = sectionString.split(/\s+/).filter(Boolean);
            flags.forEach((flag, i) => {
                flags[i] = flag.replace(/,/g, '');
            });
            if (flags.includes('ALLOC')) {
                offsets[name] = parseInt(vma, 16);
            }
        }
        return offsets;
    }

    function getSymbolCommand(elf: string, baseAddrExpr: string) {
        const offsets = findAppSectionOffsets(elf);
        const command = ['add-symbol-file', `"${elf}"`, `${baseAddrExpr}+0x${offsets['.text'].toString(16)}`];
        for (const [section, offset] of Object.entries(offsets)) {
            if (section !== '.text') {
                let offsetHex = offset.toString(16);
                offsetHex = '0x' + offsetHex;
                command.push(`-s ${section} ${baseAddrExpr}+${offsetHex}`);
            }
        }
        return command.join(' ');
    }

    function findLegacyAppLoadOffset(fwElfPath: string, kind: string): number {
        const toolpath = tool.getARMCSTool('arm-none-eabi-readelf');
        const elfSections = execSync(`${toolpath} -W -s ${fwElfPath}`)
            .toString()
            .split('\n');
        for (const line of elfSections) {
            if (line.includes(`__${kind}_flash_load_start__`)) {
                return parseInt(line.split(/\s+/)[1], 16);
            }
        }
        throw new Error(`Couldn't find the ${kind} address offset.`);
    }

    if (platform === 'aplite') { // 3.x firmware
        const appLoadOffset = findLegacyAppLoadOffset(fwElfPath, 'app');
        const workerLoadOffset = findLegacyAppLoadOffset(fwElfPath, 'worker');
        const appLoadAddress = `*(void**)(${appLoadOffset})`;
        const workerLoadAddress = `*(void**)(${workerLoadOffset})`;
        return [
            "set charset US-ASCII",
            "set confirm off",
            getSymbolCommand(appElfPath, appLoadAddress),
            "set confirm on",
            "break app_crashed",
        ];
    } else if (platform === 'chalk' || platform === 'diorite' || platform === 'emery' || platform === 'basalt') { // 4.x firmware
        const appLoadAddress = '*(void**)&g_app_load_address';
        const workerLoadAddress = '*(void**)&g_worker_load_address';
        return [
            "set charset US-ASCII",
            "set confirm off",
            getSymbolCommand(appElfPath, appLoadAddress),
            "set confirm on",
            "break app_crashed",
        ];
    } else {
        throw new Error(`Unsupported platform: ${platform}`);
    }
}

export { buildGdbCommands };