import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

function buildGdbCommands(appElfPath: string, fwElfPath: string, gdbPort: number, platform: string, sdkVersion: string, binaryPath: string): string[] {
    interface ElfSection {
        index: string;
        name: string;
        size: string;
        vma: string;
        lma: string;
        file_offset: string;
        align: string;
        flags: string;
    }

    function findAppSectionOffsets(appElfPath: string): { [key: string]: number } {
        const SectionRow = ['index', 'name', 'size', 'vma', 'lma', 'file_offset', 'align', 'flags'];
        const info = execSync(`~/pebble-dev/pebble-sdk-4.6-rc2-linux64/arm-cs-tools/bin/arm-none-eabi-objdump --headers --wide ${appElfPath}`)
            .toString()
            .split('\n')
            .slice(5)
            .filter(line => line.trim().length > 0);
        const sections: ElfSection[] = info.map(line => 
            line.trim().split(/\s+/).reduce((acc, val, idx) => ({ ...acc, [SectionRow[idx]]: val }), {}) as ElfSection);
        const offsets: { [key: string]: number } = sections
            .filter(section => section.flags?.includes('ALLOC') || ['.text', '.data', '.bss'].includes(section.name))
            .reduce((acc, section) => ({ ...acc, [section.name]: parseInt(section.vma, 16) }), {});
        return offsets;
    }

    function getSymbolCommand(elf: string, baseAddrExpr: string): string {
        const offsets = findAppSectionOffsets(elf);
        const command = [`add-symbol-file "${elf}" ${baseAddrExpr}+${offsets['.text'].toString(16)}`];
        Object.entries(offsets).forEach(([section, offset]) => {
            if (section !== '.text') {
                command.push(`-s ${section} ${baseAddrExpr}+${offset.toString(16)}`);
            }
        });
        return command.join(' ');
    }

    function findLegacyAppLoadOffset(fwElfPath: string, kind: string): number {
        const elfSections = execSync(`~/pebble-dev/pebble-sdk-4.6-rc2-linux64/arm-cs-tools/bin/arm-none-eabi-readelf -W -s ${fwElfPath}`)
            .toString()
            .split('\n');
        for (const line of elfSections) {
            if (line.includes(`__${kind}_flash_load_start__`)) {
                return parseInt(line.split(/\s+/)[1], 16);
            }
        }
        throw new Error(`Couldn't find the ${kind} address offset.`);
    }

    if (platform === 'aplite' || platform === 'basalt') { // 3.x firmware
        const appLoadOffset = findLegacyAppLoadOffset(fwElfPath, 'app');
        const workerLoadOffset = findLegacyAppLoadOffset(fwElfPath, 'worker');
        const appLoadAddress = `*(void**)(${appLoadOffset})`;
        const workerLoadAddress = `*(void**)(${workerLoadOffset})`;
        return [
            "set charset US-ASCII",
            // `target remote :${gdbPort}`,
            // "file " + binaryPath,
            "set confirm off",
            getSymbolCommand(appElfPath, appLoadAddress),
            // getSymbolCommand(fwElfPath, workerLoadAddress),
            "set confirm on",
            "break app_crashed",
            'echo \nPress ctrl-D or type \'quit\' to exit.\n',
            'echo Try `pebble gdb --help` for a short cheat sheet.\n'
        ];
    } else if (platform === 'chalk' || platform === 'diorite' || platform === 'emery') { // 4.x firmware
        const appLoadAddress = '*(void**)&g_app_load_address';
        const workerLoadAddress = '*(void**)&g_worker_load_address';
        return [
            "set charset US-ASCII",
            // `target remote :${gdbPort}`,
            // "file " + binaryPath,
            "set confirm off",
            getSymbolCommand(appElfPath, appLoadAddress),
            // getSymbolCommand(fwElfPath, workerLoadAddress),
            "set confirm on",
            "break app_crashed",
            'echo \nPress ctrl-D or type \'quit\' to exit.\n',
            'echo Try `pebble gdb --help` for a short cheat sheet.\n'
        ];
    } else {
        throw new Error(`Unsupported platform: ${platform}`);
    }
}

export { buildGdbCommands };