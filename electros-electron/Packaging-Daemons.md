# Packaging the Daemons

To build **Electros** locally with the Daemons embedded, you'll have to create this folder structure:
```
Electros
 |- electros-electron
     |- electros-daemons
         |- ${platform}
             |- ${arch}
                 |- DAEMONS EXECUTABLE
```

Where `${platform}` is one of:
- `linux`
- `mac`
- `win`

And `${arch}` is one of:
- `x64`
- `arm64`

The *daemons executable* name must be one of the following:

| Platform | Arch                        | Name                             |
|----------|-----------------------------|----------------------------------|
| Windows  | x86 / x64                   | `elemento_daemons_win_x64.exe`   |
| Windows  | arm64 / aarch64             | `elemento_daemons_win_arm64.exe` |
| Linux    | x86 / x64                   | `elemento_daemons_linux_x86`     |
| Linux    | arm64 / aarch64             | `elemento_daemons_linux_arm`     |
| macOS    | x86 / x64 / arm64 / aarch64 | `elemento_client_daemons.app`    |


> [!NOTE]
> Inside the `.app`, the executable inside of `elemento_client_daemons.app/Contents/MacOS/` must be called either
> `elemento_client_daemons` or `daemon_launcher`.
