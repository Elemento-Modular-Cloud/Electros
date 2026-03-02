# Adding a Background Provider
Background providers can be added by altering the `BackgroundProvider.json` file.

## RSS Feeds/XML
To add an XML feed, start by adding this base structure to the JSON:
```json
{
    "url": "url-to-feed",
    "format": "application/xml",
    "itemLocation": "",
    "copyright": "",
    "itemStructure": {
    }
}
```

> [!note]
> Don't forget to add the *provider name* as the key of the object

Inside the `itemLocation`, write a slash-separated path of XML tags to reach the `item`, where the last element is the 
XML tag of the item itself. For example, with a feed formatted like:
```xml
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
    <channel>
        <title>Title</title>
        <language>en</language>
        <item>
            <title>Image</title>
            <pubDate>Mon, 11 Jan 2025</pubDate>
            <description>...</description>
            <creator>John Smith</creator>
            <creator>Mario Rossi</creator>
            <enclosure url="image.format" />
        </item>
    </channel>
</rss>
```
You'll have to write `rss/channel/item`. Now, you'll have to define the Item Strucutre; the supported attributes of an item are:
- `title`: Title of the image
- `pubDate`: Publication date
- `description`: Text description of the image
- `imgUrl`: Direct URL to the full-resolution image
- `thumbUrl`: Direct URL to the thumbnail image
- `copyright`: Copyright holder of the image, the tag will be iterated (if multiple, identical tags are present, all will be concatenated)

Following the previous example, your `itemStructure` object will be:
```json5
{
  "title": "title",
  "pubDate": "pubDate",
  "description": "description",
  "copyright": "creator", // These will be iterated!
  "imgUrl": "enclosure.url"
}
```

As you can see, you can access XML tag attributes using a dot.

> [!note]
> If your provider doesn't have all the attribute, exclude them from the `itemStructure`; the only required attribute is
> the `imgUrl`.

## JSON Feeds
JSON Feeds can be added by adding an entry to the file structured as follows:
```json
{
  "url": "url-to-feed",
  "format": "application/json",
  "itemStructure": {
  }
}
```

Now, you'll have to define the Item Strucutre; the supported attributes of an item are:
- `title`: Title of the image
- `pubDate`: Publication date
- `description`: Text description of the image
- `imgUrl`: Direct URL to the full-resolution image
- `thumbUrl`: Direct URL to the thumbnail image
- `copyright`: Copyright holder of the image, the tag will be iterated (if multiple, identical tags, are present, all will be concatenated)

Suppose a JSON feed strucutred as follows:
```json
[
  {
    "title": "title",
    "date": "monday",
    "copyright": "copyright",
    "image": "http://path-to-image.png"
  }
]
```

Following the example above, your `itemStructure` object will be:
```json5
{
  "title": "title",
  "pubDate": "date",
  "copyright": "creator",
  "imgUrl": "image"
}
```

## Notes on Thumbnails
If your provider does not provide thumbnail images, they will be automatically generated from the full-resolution image.

