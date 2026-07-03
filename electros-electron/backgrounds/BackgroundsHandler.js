const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const os = require('node:os');
const BackgroundProvider = require('./BackgroundProvider');
const {ipcMain, dialog} = require("electron");
const {resolve} = require("path");
const buffer = require("node:buffer");


/**
 * @typedef {Object} Background
 *  @property {string} name
 *  @property {string} path
 *  @property {string} fileUrl
 *  @property {BackgroundImageData|undefined} metadata
 */


/**
 * Handler for local wallpapers
 *
 */
class BackgroundsHandler {
    static BackgroundDir = path.join(os.homedir(), '.elemento', 'backgrounds');

    static SupportedFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];


    /**
     * @summary Converts given image to WebP
     *
     * @description
     *
     *
     * @param {!Buffer} data Path to the image file
     * @param {!number} quality Quality of the outputted WebP, defaults to 80%
     * @param {object|string} exifData Data to embed
     * @returns {Promise<Buffer>} Buffer of new image in webp
     * @static
     */
    static ConvertImageToWebp({data, quality = 80, exifData = ""}) {
        return new Promise((resolve, reject) => {
            try {
                const bufPromise = sharp(data)
                    .webp({quality: quality})
                    .withExifMerge({
                        IFD0: { ImageDescription: (typeof exifData === 'string') ? exifData : Buffer.from(JSON.stringify(exifData)).toString('base64') }
                    })
                    .toBuffer()

                bufPromise.then(resolve).catch(reject);
            } catch (error) {
                console.error(error);
                reject(error);
            }
        });
    }

    /**
     *
     * @param {string} targetFile Path to file to import
     * @static
     */
    static ImportBackground() {
        BackgroundsHandler._CheckOrCreateBackgroundsFolder();

        return new Promise((resolve, reject) => {
            dialog.showOpenDialog({
                title: "Select Background Image",
                filters: [
                    {name: 'Images', extenions: this.SupportedFormats}
                ],
                properties: ['openFile']
            }).then(result => {
                if (result.canceled || result.filePaths.length === 0) { reject(); }

                const sourcePath = result.filePaths[0];
                fs.readFile(sourcePath, (err, data) => {
                    const filename = path.basename(sourcePath).replace(/[^\.]*$/, 'webp');
                    const destinationPath = path.join(this.BackgroundDir, filename)
                    this.ConvertImageToWebp({
                        data: data,
                        exifData: {  }
                    }).then(resultBuffer => {
                        fs.writeFile(destinationPath, resultBuffer, () => {
                            resolve({
                                name: filename,
                                path: destinationPath,
                                fileUrl: `file://${destinationPath}`,
                                metadata: {}
                            });
                        });
                    }).catch(reject);
                });
            }).catch(error => {
                console.error(error);
                reject(error);
            })
        });
    }

    /**
     *
     * @param {string} url Direct path of the Image; will be converted to Webp once downloaded
     * @param {string|undefined} filename A filename to store the image in; if undefined, a random string will be used
     * @param {object} metadata metadata
     * @return {Promise<Background>}
     * @static
     */
    static DownloadBackground(url, filename = "temptemptemp", metadata) {
        BackgroundsHandler._CheckOrCreateBackgroundsFolder();

        return new Promise((resolve, reject) => {
            try {
                fetch(url).then(res => {
                    return res.arrayBuffer()
                }).then(imgBuf => {
                    const buffer = Buffer.from(imgBuf);
                    const destPath = path.join(this.BackgroundDir, `${filename}.webp`);

                    this.ConvertImageToWebp({ data: buffer, exifData: metadata }).then(webpBuf => {
                        fs.writeFile(destPath, webpBuf, () => {
                            resolve({
                                name: filename,
                                path: destPath,
                                fileUrl: `file://${destPath}`,
                                metadata: metadata
                            });
                        });
                    }).catch(err => {
                        console.error(err);
                        reject(err);
                    });
                });
            } catch (error) {
                console.error(error);
                reject(error);
            }
        });
    }

    /**
     * @summary List all backgrounds
     *
     * @description
     * Reads the files inside `BackgroundsHandler.BackgroundDir` and returns a list of Background objects, prioritising
     * webp files.
     *
     * @returns {Background[]} List of Backgrounds
     * @static
     */
    static ListBackgrounds() {
        BackgroundsHandler._CheckOrCreateBackgroundsFolder();

        try {
            const files = fs.readdirSync(BackgroundsHandler.BackgroundDir);
            console.dir(BackgroundsHandler.BackgroundDir);

            /** @type {Map<string, Background>} */
            const backgrounds = new Map();

            files.forEach(image => {
                const ext = path.extname(image).toLowerCase().replace(/^\./, '');
                if (!BackgroundsHandler.SupportedFormats.includes(ext)) {
                    return;
                }

                const baseName = path.basename(image, ext);

                if (!backgrounds.has(baseName) || ext === '.webp') {
                    const fp = path.join(BackgroundsHandler.BackgroundDir, baseName);

                    backgrounds.set(baseName, {
                        name: image,
                        path: fp,
                        fileUrl: `file://${fp}`,
                    });
                }
            });

            return backgrounds.values().toArray();
        } catch (e) {
            console.error(e);
            return [];
        }
    }

    /**
     *
     * @param {BackgroundProvider} provider
     * @return {Promise<BackgroundImageData[]>} Sorted by date set of images
     * @constructor
     */
    static FetchProviderImages(provider) {
        return new Promise((resolve, reject) => {
            provider.fetchFeedData().then(feedData => {
                const sortedFeedData = feedData.sort((a, b) => {
                    if (a.pubDate > b.pubDate) { return -1; }
                    if (a.pubDate < b.pubDate) { return 1; }
                    return 0;
                })
                resolve(sortedFeedData);
            }).catch(error => {
                console.error(error);
                reject(error);
            });
        });
    }

    /**
     *
     * @static
     */
    static DeleteBackground(filename) {
        BackgroundsHandler._CheckOrCreateBackgroundsFolder();

        return new Promise((resolve, reject) => {
            try {
                fs.unlinkSync(filename);
                resolve();
            } catch (error) {
                console.error(error);
                reject(error);
            }
        })
    }

    static _CheckOrCreateBackgroundsFolder() {
        if (!fs.existsSync(BackgroundsHandler.BackgroundDir)) {
            fs.mkdirSync(BackgroundsHandler.BackgroundDir, { recursive: true });
        }
    }

    static GetProviders() {
        return BackgroundProvider.Providers.map(p => p.toFrontendJson());
    }

    /**
     * Creates folders; loads providers and
     */
    static init() {
        BackgroundProvider.initialize();
        this._CheckOrCreateBackgroundsFolder();

        ipcMain.handle('background-providers', () => {
            return this.GetProviders();
        });

        ipcMain.handle('background-provider-images', (evt, { mode, providerName }) => {
            return new Promise((resolve, reject) => {
                if (!mode) { mode = "latest"; }
                if (!["random", "latest", "entire-set"].includes(mode)) {
                    reject(new Error("Invalid mode; must be `random`; `latest`; `entire-set"));
                    return;
                }

                console.dir(BackgroundProvider.Providers);
                console.dir(providerName);
                /** @type {BackgroundProvider | undefined} */
                const provider = BackgroundProvider.Providers.find(p => p.name === providerName);
                if (!provider) {
                    reject(new Error("Invalid provider name"));
                    return;
                }

                this.FetchProviderImages(provider).then(images => {
                    switch (mode) {
                        case "entire-set":
                            resolve(images);
                            break;
                        case "latest":
                            resolve(images[0]);
                            break;
                        case "random":
                            const randomImage = images[Math.floor(Math.random() * images.length)];
                            resolve(randomImage);
                            break;
                    }
                }).catch(error => {
                    console.error(error);
                    reject(error);
                });
            });
        });

        ipcMain.handle('background-list', () => {
            return this.ListBackgrounds();
        });

        ipcMain.handle('background-import', () => {
            return this.ImportBackground();
        });

        ipcMain.handle('background-delete', (evt, img) => {
            return this.DeleteBackground(img);
        });

        ipcMain.handle('background-fetch', (event, { providerName, imgUrl }) => {
            let imgMeta = {};
            return new Promise(async (res, rej) => {
                const provider = BackgroundProvider.Providers.find(p => p.name === providerName);
                if (!provider) { rej(`Invalid provider ${providerName}`); }
                if (!imgUrl) {
                    const imgs = await this.FetchProviderImages(provider);
                    if (imgs.length === 0) { rej("No images returned"); }
                    const img = imgs[imgs.length - 1];
                    imgUrl = img.imgUrl;
                    imgMeta = img;
                }
                const imgDownload = await this.DownloadBackground(
                    imgUrl,
                    `${provider.name}-${Date.now()}`,
                    imgMeta
                );

                console.dir(imgDownload);

                res(imgDownload);
            });
        });
    }
}

module.exports = BackgroundsHandler;
