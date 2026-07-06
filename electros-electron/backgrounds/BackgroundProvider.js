const path = require("path");
const fs = require("fs");
const {XMLParser} = require("fast-xml-parser");
const {DateParser} = require("./DateParser");


/**
 * @typedef {Object} BackgroundImageData
 *  @summary Object containing feed-provided image data
 *  @property {?string} title Title of the image
 *  @property {!string} imgUrl URL to the Full-Resolution image
 *  @property {?string} thumbUrl URL to the Thumbnail Image
 *  @property {?string} description Description of the image
 *  @property {?Array<string>} copyright List of copyright holders
 *  @property {?date} pubDate Publication date, as a Date instance if available
 */

/**
 * @typedef {Object} BackgroundProviderItemStructure
 *  @property {?string} title Title of the image
 *  @property {!string} imgUrl URL to the Full-Resolution image
 *  @property {?string} thumbUrl URL to the Thumbnail Image
 *  @property {?string} description Description of the image
 *  @property {?Array<string>} copyright List of copyright holders
 *  @property {?string} pubDate Publication date, in any format
 */

/**
 * @typedef {Object} BackgroundProviderData
 *  @property {BackgroundProviderFeedData} feed
 *  @property {string} name
 *  @property {string} icon
 *  @property {string} dateFormat
 */

/**
 * @typedef {Object} BackgroundProviderFeedData
 *  @property {!string} url
 *  @property {!"application/json"|"application/xml"} format
 *  @property {?string} itemLocation
 *  @property {Object} BackgroundProviderItemStructure
 *  @property {?string} copyright
 */


class BackgroundProvider {
    static ProvidersFile = path.resolve(path.join('configs','BackgroundProviders.json'));
    static Providers = [];

    /** @type {!string} **/
    name;

    /** @type {!string} **/
    uiName;

    /** @type {!string} **/
    icon;

    /** @type {!string} */
    feedUrl;

    /** @type {!"application/xml"|"application/json"} */
    format;

    /** @type {!BackgroundProviderItemStructure} */
    itemStructure;

    /** @type {?string} */
    itemLocation;

    /** @type {?string} **/
    copyright;

    /** @type {DateParser} */
    dateParser;

    constructor(name, uiName, icon, dateFormat, {
        url,
        format,
        itemStructure,
        itemLocation = null,
        copyright = null,
    }) {
        this.name = name;
        this.uiName = uiName;
        this.icon = icon;
        this.feedUrl = url;
        this.format = format;
        this.itemStructure = itemStructure;
        this.itemLocation = itemLocation;
        this.copyright = copyright;
        this.dateParser = new DateParser(dateFormat);
    }

    /**
     *
     * @return {Promise<Array<BackgroundImageData>>}
     */
    fetchFeedData() {
        return new Promise(async(resolve, reject) => {
            const req = await fetch(this.feedUrl);

            if (!req.ok) {
                reject(new Error(await req.text()))
            }

            try {
                switch (this.format) {
                    case "application/json":
                        resolve(this._parseJsonFeed(await req.json()));
                        break;
                    case "application/xml":
                        resolve(this._parseXmlFeed(await req.text()));
                        break;
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    _parseJsonFeed(feedData) {
        if (!Array.isArray(feedData)) {
            throw new Error(`Invalid JSON feed data for provider ${this.name}: expected array`);
        }

        /** @type {Array<BackgroundImageData>} */
        const images = [];

        feedData.forEach(item => {
            images.push(this._mapJson(item));
        });

        return images;
    }

    /**
     *
     * @param {Object} feedObject
     * @return {BackgroundImageData}
     * @private
     */
    _mapJson(feedObject) {
        return {
            title: feedObject[this.itemStructure.title],
            description: feedObject[this.itemStructure.description],
            imgUrl: feedObject[this.itemStructure.imgUrl],
            thumbUrl: feedObject[this.itemStructure.thumbUrl],
            copyright: feedObject[this.itemStructure.copyright],
            pubDate: this.dateParser.parse(feedObject[this.itemStructure.pubDate])
        };
    }

    _parseXmlFeed(feedData) {
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "attr_",
            processEntities: {
                maxEntityCount: 10_000
            }
        });

        /** @type {Object} */
        const feedXml = parser.parse(feedData);

        const images = [];

        let items = feedXml;
        const itemLocationKeys = this.itemLocation.split('/');
        itemLocationKeys.forEach((key) => {
            items = items[key];
        });

        items.forEach((item) => {
            images.push(this._mapXml(item));
        });

        return images;
    }

    /**
     *
     * @param {Object} feedObject
     * @returns {BackgroundImageData}
     * @private
     */
    _mapXml(feedObject) {
        let imgUrl = this._handleXmlKey(feedObject, this.itemStructure.imgUrl);

        if (this.name === "wikimedia") {
            imgUrl = imgUrl.replace('/thumb', '').replace(/[^/]*$/, '').replace(/\/$/, '');
        }

        return {
            title: this._handleXmlKey(feedObject, this.itemStructure.title),
            description: this._handleXmlKey(feedObject, this.itemStructure.description),
            imgUrl: imgUrl,
            thumbUrl: this._handleXmlKey(feedObject, this.itemStructure.thumbUrl),
            pubDate: this.dateParser.parse(this._handleXmlKey(feedObject, this.itemStructure.pubDate)),
            copyright: this._handleXmlKey(feedObject, this.itemStructure.copyright)
        };
    }

    _handleXmlKey(feedObject, key) {
        if (key === null || key === undefined) { return undefined; }
        let attr = (key.includes(".")) ? `attr_${key.split('.')[1]}` : null;
        let path = key.split('.')[0].split('/');
        let item = feedObject;

        path.forEach(key => {
            if (key.includes("[") && key.includes("]")) {
                const actualKey = key.split('[')[0];
                const index = key.split('[')[1].split(']')[0];
                item = item[actualKey][index];
            } else {
                item = item[key];
            }

            if (item["attr_type"] !== undefined) {
                if (item["attr_type"] === "html") {
                    const parser = new XMLParser({
                        ignoreAttributes: false,
                        attributeNamePrefix: "attr_"
                    });
                    item = parser.parse(item["#text"]);
                }
            }
        });

        return (attr !== null) ? item[attr] : item;
    }

    toFrontendJson() {
        return {
            name: this.uiName,
            icon: this.icon,
            reference: this.name
        };
    }

    static initialize() {
        try {
            /** @type {Record<!string, !BackgroundProviderData>} */
            const data = JSON.parse(fs.readFileSync(BackgroundProvider.ProvidersFile, 'utf-8'));

            Object.entries(data).forEach(([providerName, config]) => {
                BackgroundProvider.Providers.push(
                    new BackgroundProvider(providerName, config.name, config.icon, config.dateFormat, config.feed),
                );
            });
        } catch (e) {
            console.error("Unable to load Background Providers:\n", e);
        }
    }
}

module.exports = BackgroundProvider;
