# Electros

> [!note]
> If you're trying to run the app on macOS from the `.dmg` image, the daemons will not start. This is caused by the 
> read-only filesystem of the disk image. You will need to copy it to `/Applications` or any other filesystem that 
> is readable.

## Building
To build, three github action workflows are present:

### Build releases
Releases can be built only against `main` by tagging a commit with `vX.X.X`. The build will automatically start. To fully 
release it, mark it as latest manually.

### Build beta
todo))

### Nightly builds
Every evening at 17:00 (CEST) a build is automatically run against Develop, and will be tagged accordingly to the 
`package.json` version, for example, `v3.1.5-DDMMYY-HHMM-nightly`. You can also manually trigger a nightly build from 
the Github Actions Nightly workflow. It can only be run against `develop`.

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
