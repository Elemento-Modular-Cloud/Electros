# Electros

## Command line switches
Electros has a set of custom command line switches other than the Electron switches:

- `--enable-devtools` enables the devtools for the application
- `--no-daemons` disables the execution of the embedded daemons

> [!note]
> On macOS, to add a CLI switch, you'll have to append them directly onto the executable:
> ```zsh 
> $ /Applications/Electron.app/Contents/MacOS/Electros  # add your CLI switches here
> ```

### Linux-specific switches
If you're experiencing performance issues on Linux, check what compositor you're using between *X11* and *Wayland*, if 
you're using *Wayland*, add the following switch to force Chromium to use the correct compositor and not fall back onto 
Xwayland:
```bash
$ /opt/Electros/electros --ozone-platform=wayland
```
