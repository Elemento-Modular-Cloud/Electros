# Electros

> [!NOTE]
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

## Synthetic mock daemons (UI development)

To run the UI without native client daemons, start the HTTP mock servers in [`synthetic-daemons/`](synthetic-daemons/) and launch Electros with `--no-daemons`. See [synthetic-daemons/README.md](synthetic-daemons/README.md) for ports, fixtures, and verification steps.

```bash
cd synthetic-daemons && npm install && npm start
# separate terminal:
cd electros-electron && npm start -- --no-daemons
```

## Command line switches
Electros has a set of custom command line switches other than the Electron switches:

- `--enable-devtools` enables the devtools for the application
- `--no-daemons` disables the execution of the embedded daemons (use with synthetic-daemons above)

> [!NOTE]
> On macOS, to add a CLI switch, you'll have to append them directly onto the executable:
> ```zsh 
> $ /Applications/Electros.app/Contents/MacOS/Electros  # add your CLI switches here
> ```

### Linux-specific switches
If you're experiencing performance issues on Linux, check what compositor you're using between *X11* and *Wayland*, if 
you're using *Wayland*, add the following switch to force Chromium to use the correct compositor and not fall back onto 
Xwayland:
```bash
$ /opt/Electros/electros --ozone-platform=wayland
```

## Protocol
A protocol `electros://` is registered and supports three formats defined below.
In all cases, parameters can be passed to the page, if supported, by inserting them into the URL as URL Query Parameters.
E.g. `electros://example/page?uuid=an-uuid&admin=true`

### Page Path Format
When a path to a page is provided, for example, `electros://iaas/virtual-machines`, that page will be opened.

### Dialog
To open a globally-registered dialog, you can open `electros://dialog/dialog-name` and that dialog will be opened.

### Special Handler
If a given page has a special handler defined, it can be used by providing a path like this:
```
electros://page/path{specialHandler}?parameter1=loremIpsum
```

For example, to open a VM's VNC, you can use `electros://iaas/virtual-machiens{openVnc}?vmUuid=cfd0d0b0-9538-4043-9e43-3352cf77b8b6`

What follows is a table of supported special features by page:

| Page Path               | Special Feature | Parameters |
|-------------------------|-----------------|------------|
| `iaas/virtual-machines` | `openVnc`       | `vmUuid`   |

