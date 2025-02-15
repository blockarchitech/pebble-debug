# Pebble Debug

Debug Pebble apps running in the emulator using gdb, right inside Visual Studio Code.

View a video demo of this extension: <br />
[![Pebble Debug Demo](https://img.youtube.com/vi/1l7fUHSPt6k/0.jpg)](https://youtu.be/1l7fUHSPt6k)

## Configuration

Add a configuration to your launch.json file, like so:

```json
{
    "name": "Debug Aplite",
    "type": "pebble",
    "request": "launch", // See "Configurations" below.
    "platform": "aplite", // or "basalt", "chalk", "diorite", "emery"
    "elfPath": "${workspaceRoot}/build/aplite/app.elf", // Path to the .elf file of your app.
    "workDir": "${workspaceRoot}", // Path to the root of your project.
}
```
VS Code IntelliSense will also help you fill in the configuration. Simply create a new `.vscode/launch.json` file and click the "ADD CONFIGURATION" button.


### Possible Configurations

- `"request": "launch"`: Launch the app in the emulator.
  - This will start a _new_ emulator, and it will fail if one is already running with your requested `platform`.
  - It will also build your app before launching it.
- `"request": "attach"`: Attach to an already running emulator.
  - This will _not_ build your app before launching it.
  - You must have an emulator running with your requested `platform`.
  - It will fail if you do not have an emulator running with your requested `platform`.
- `"platform": "aplite"`: The platform to run the app on.
  - Possible values are `"aplite"`, `"basalt"`, `"chalk"`, `"diorite"`, `"emery"`.
- `"elfPath": "${workspaceRoot}/build/aplite/app.elf"`: The path to the .elf file of your app.
  - This is **platform-specific**. You must provide the correct .elf file for the platform you are targeting.
- `"workDir": "${workspaceRoot}"`: The path to the root of your project. 
  - Generally, this is `${workspaceRoot}`.
- `"pebbleDevPath": "~/pebble-dev"`: The path to your pebble-dev directory.
  - This is where the pebble toolchain is installed.
  - This is optional, and defaults to `~/pebble-dev`.
- `sdkCorePath`: The path to the core SDK files.
  - This is optional, and defaults to `~/.pebble-sdk/SDKs/current/sdk-core`.
- `usePathGDB`: Whether to use the GDB in your PATH.
  - This is optional, and defaults to `false`.
  - If you have GDB in your PATH, you can set this to `true` to use it.
  - It must be `arm-none-eabi-gdb` to maintain compatibility with the Pebble SDK.
- `pebbleToolName`: The name of the Pebble tool in your path. Usually `pebble`.
  - This is optional, and defaults to `pebble`.
  - If you use something like [rebbletool](https://github.com/richinfante/rebbletool), you can set this to `rebble`.
- `armCSToolsPath`: The path to the ARM CS Tools.
  - This is optional, and the extension will try to find it automagically.
  - If you have it installed in a non-standard location, you can set this to the correct path.
  - `arm-none-eabi-readelf`, `arm-none-eabi-objdump` and `arm-none-eabi-gdb` must be in this directory.
  - GDB from this path is ignored and not required if `usePathGDB` is set to `true`.


## Caveats
- This is currently a work in progress. Please report any issues you encounter.
- It sometimes will not kill the emulator when you stop debugging. You may need to manually kill it, or the next time you try to debug, it will fail.
- It technically may work with multiple emulators running at the same time (integration testing? :D), but it's not recommended as this is not a tested use case.
- **I have no idea if this works on Apple Silicon Macs.** It should work, but if you encounter any issues, please open a new issue and I'll look into them. Unfortunately, I don't have an Apple Silicon Mac to test on, but I can assist in debugging any issues you encounter.
- **You currently have to manually pause the debugger, set/remove breakpoints, and continue the debugger.** This is a limitation of the current implementation, and will be fixed in the future.
  - It's mainly because the upstream version of this plugin (code-debug) used a promise-based API instead of the async/await API, and adding the auto reload functionality breaks some things downstream. I'm working on changing this to use the async/await API, and then I can add the auto reload functionality. For now, however, you're not losing much functionality, as GDB requires you to manually pause the debugger to set/remove breakpoints anyway.
  - You can also set your breakpoints, and then stop + reload, and that will also work, if that's easier for you.

