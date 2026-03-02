import path from "path";
import fs from "fs";
import sharp from "sharp";
import os from "node:os";


/**
 * @typedef {Object} Background
 *  @property {string} name
 *  @property {string} path
 *  @property {string} fileUrl
 */


/**
 * @static Handler for local wallpapers
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
     * @param {!string} sourcePath Path to the image file
     * @param {!number} quality Quality of the outputted WebP, defaults to 80%
     * @returns {?string} Path to the converted WebP image. Null when an error occurs
     * @static
     */
    static async ConvertImageToWebp({sourcePath, quality = 80}) {
        try {
            const extension = path.extname(sourcePath).toLowerCase();
            if (extension === '.webp') {
                return sourcePath;
            }

            const dir = path.dirname(sourcePath);
            const baseName = path.basename(sourcePath, extension);
            const webpPath = path.join(dir, `${baseName}.webp`);

            if (fs.existsSync(webpPath)) {
                return webpPath;
            }

            await sharp(sourcePath)
              .webp({quality: quality})
              .toFile(webpPath);

            return webpPath;
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    /**
     *
     * @static
     */
    static ImportBackground() {
        BackgroundsHandler._CheckOrCreateBackgroundsFolder();

    }

    /**
     *
     * @static
     */
    static DownloadBackground() {
        BackgroundsHandler._CheckOrCreateBackgroundsFolder();

    }

    /**
     * @summary List all backgrounds
     *
     * @description
     * Reads the files inside `BackgroundsHandler.BackgroundDir` and returns a list of Background objects, prioritising
     * webp files.
     *
     * @returns {Array<Background>} List of Backgrounds
     * @static
     */
    static ListBackgrounds() {
        BackgroundsHandler._CheckOrCreateBackgroundsFolder();

        try {
            const files = fs.readdirSync(BackgroundsHandler.BackgroundDir);

            /** @type {Map<string, Background>} */
            const backgrounds = new Map();

            files.forEach(image => {
                const ext = path.extname(image).toLowerCase();
                if (!BackgroundsHandler.SupportedFormats.includes(ext)) { return; }

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

            return Array.from(backgrounds.values());
        } catch (e) {
            console.error(e);
            return [];
        }
    }

    /**
     *
     * @static
     */
    static GetBackgroundData() {
        BackgroundsHandler._CheckOrCreateBackgroundsFolder();

    }

    /**
     *
     * @static
     */
    static DeleteBackground() {
        BackgroundsHandler._CheckOrCreateBackgroundsFolder();

    }

    static _CheckOrCreateBackgroundsFolder() {
        if (!fs.existsSync(BackgroundsHandler.BackgroundDir)) {
            fs.mkdirSync(BackgroundsHandler.BackgroundDir, { recursive: true });
        }
    }
}
