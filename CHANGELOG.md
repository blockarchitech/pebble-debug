# Changelog

## Version 1.0.0

- Initial release.

## Version 1.1.0

- Added support for macOS
- Added the following options:
	- `pebbleDevPath`: The path to your pebble-dev directory.
	- `sdkCorePath`: The path to the core SDK files.
	- `usePathGDB`: Whether to use the GDB in your PATH.
	- `pebbleToolName`: The name of the Pebble tool in your path. Usually `pebble`.
	- `armCSToolsPath`: The path to the ARM CS Tools.
- Fixed a bug where `app_crashed` may not break on the correct line.
- Fixed a bug where the GDB console would not react to any input
- Fixed a bug where the emulator may crash if a breakpoint was set and unset when the emulator was still running (not paused)