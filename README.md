# Pebble Debug

Debug Pebble apps running in the emulator, right inside Visual Studio Code.

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

## Caveats
- This is currently a work in progress. Please report any issues you encounter.
- As of current, it's only available on Linux based systems, and assumes your pebble toolchain is installed in the default location (`~/pebble-dev`).
  - Soon, it will also be available on macOS. Windows will not be supported as the Pebble SDK does not support it.
- It sometimes will not kill the emulator when you stop debugging. You may need to manually kill it, or the next time you try to debug, it will fail.
- It technically may work with multiple emulators running at the same time (integration testing? :D), but it's not recommended as this is not a tested use case.
