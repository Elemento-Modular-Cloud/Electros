/**
 * DateParser
 * ==========
 * A configurable string -> Date parser. Each instance is bound to a
 * `dateFormat`, and `.parse(str)` turns a matching string into a native
 * `Date` instance.
 *
 * ------------------------------------------------------------------
 * `dateFormat` SPECIFICATION
 * ------------------------------------------------------------------
 * `dateFormat` is a string and can be ONE of two kinds of value:
 *
 * 1) A RESERVED KEYWORD (exact match, case-sensitive):
 *
 *      "AUTO"      Try to auto-detect the format among all the ones
 *                  below (RFC2822, ISO8601, date-only, UNIX_S, UNIX_MS).
 *                  Useful when input shape may vary.
 *
 *      "UNIX_S"    Input is a UNIX timestamp in whole SECONDS since
 *                  epoch, e.g. "1751450400". May be negative.
 *
 *      "UNIX_MS"   Input is a UNIX timestamp in MILLISECONDS since
 *                  epoch, e.g. "1751450400000". May be negative.
 *
 * 2) A C-STYLE (strftime/strptime-inspired) PATTERN STRING made of
 *    literal characters plus the tokens below. Every token starts
 *    with `%`. Anything that isn't a token is matched literally
 *    (e.g. "-", ":", ",", "T", " ", "Z").
 *
 *      %Y   4-digit year                  2026
 *      %y   2-digit year (pivot: 00-68 -> 2000-2068, 69-99 -> 1969-1999)
 *      %m   2-digit month, 01-12
 *      %d   2-digit day of month, 01-31
 *      %H   2-digit hour, 00-23 (24h clock)
 *      %M   2-digit minute, 00-59
 *      %S   2-digit second, 00-60 (60 = leap second, clamped to 59)
 *      %f   fractional seconds / milliseconds, 1-3 digits (e.g. "123")
 *      %a   abbreviated weekday name, "Mon".."Sun" (value is validated
 *           to be a known name but does not affect the result date)
 *      %A   full weekday name, "Monday".."Sunday" (same as %a)
 *      %b   abbreviated month name, "Jan".."Dec"
 *      %B   full month name, "January".."December"
 *      %z   numeric UTC offset: "+0000", "-05:00", "+0530", or "Z"
 *      %Z   timezone name/offset: "GMT", "UTC", "Z", or a %z-style
 *           offset. "GMT"/"UTC"/"Z" (case-insensitive) are treated as
 *           a +00:00 offset.
 *      %%   a literal "%" character
 *
 *    Examples:
 *      "Thu, 02 Jul 2026 11:00:00 GMT"  ->  "%a, %d %b %Y %H:%M:%S %Z"
 *      "2026-06-25T00:00:00Z"           ->  "%Y-%m-%dT%H:%M:%S%Z"
 *      "2026-07-02"                     ->  "%Y-%m-%d"
 *      "07/02/2026 11:00 PM" (custom)   ->  "%m/%d/%Y %H:%M"
 *
 *    Rules for custom patterns:
 *      - A year token (%Y or %y) is required.
 *      - If %m/%b/%B is omitted, month defaults to January (1).
 *      - If %d is omitted, day defaults to 1.
 *      - Omitted %H/%M/%S/%f default to 0.
 *      - If neither %z nor %Z is present, the instance's
 *        `defaultTimeZone` option decides how the naive local
 *        components are interpreted (see constructor options).
 *
 * ------------------------------------------------------------------
 * CONSTRUCTOR OPTIONS
 * ------------------------------------------------------------------
 *   new DateParser(dateFormat, { defaultTimeZone })
 *
 *   dateFormat        see above.
 *   defaultTimeZone   "UTC" (default) or "local". Only used when the
 *                     matched pattern has no %z/%Z token: "UTC" treats
 *                     the parsed components as UTC, "local" treats them
 *                     as being in the JS runtime's local timezone.
 *
 * ------------------------------------------------------------------
 * USAGE
 * ------------------------------------------------------------------
 *   const rfc = new DateParser("%a, %d %b %Y %H:%M:%S %Z");
 *   rfc.parse("Thu, 02 Jul 2026 11:00:00 GMT"); // -> Date
 *
 *   const iso = new DateParser("%Y-%m-%dT%H:%M:%S%Z");
 *   iso.parse("2026-06-25T00:00:00Z");           // -> Date
 *
 *   const day = new DateParser("%Y-%m-%d");
 *   day.parse("2026-07-02");                      // -> Date (UTC midnight)
 *
 *   const ts = new DateParser("UNIX_S");
 *   ts.parse("1751450400");                       // -> Date
 *
 *   const auto = new DateParser("AUTO");
 *   auto.parse("2026-07-02");                     // -> Date
 */

const MONTHS_SHORT = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
];

const WEEKDAYS_SHORT = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Definition of every supported %-token: the regex fragment it expands
// to, and the named capture group it feeds.
const TOKEN_DEFS = {
    Y: { pattern: "\\d{4}", group: "year" },
    y: { pattern: "\\d{2}", group: "year2" },
    m: { pattern: "\\d{2}", group: "month" },
    d: { pattern: "\\d{2}", group: "day" },
    H: { pattern: "\\d{2}", group: "hour" },
    M: { pattern: "\\d{2}", group: "minute" },
    S: { pattern: "\\d{2}", group: "second" },
    f: { pattern: "\\d{1,3}", group: "frac" },
    a: { pattern: "[A-Za-z]{3}", group: "weekday" },
    A: { pattern: "[A-Za-z]+", group: "weekday" },
    b: { pattern: "[A-Za-z]{3}", group: "monthName" },
    B: { pattern: "[A-Za-z]+", group: "monthName" },
    z: { pattern: "(?:[+-]\\d{2}:?\\d{2}|Z)", group: "offset" },
    Z: { pattern: "(?:[A-Za-z]+|[+-]\\d{2}:?\\d{2})", group: "offset" },
};

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function monthIndexFromName(name) {
    const key = name.slice(0, 3).toLowerCase();
    const idx = MONTHS_SHORT.indexOf(key);
    return idx; // -1 if not found
}

function isKnownWeekday(name) {
    return WEEKDAYS_SHORT.includes(name.slice(0, 3).toLowerCase());
}

// "GMT" / "UTC" / "Z" (any case) or a numeric offset like "+05:30" / "-0800".
function offsetToMinutes(raw) {
    if (/^(gmt|utc|z)$/i.test(raw)) return 0;
    const m = /^([+-])(\d{2}):?(\d{2})$/.exec(raw);
    if (!m) return null;
    const sign = m[1] === "-" ? -1 : 1;
    return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

class DateParser {
    /**
     * @param {string} dateFormat  See the format spec in the file header.
     * @param {{defaultTimeZone?: "UTC"|"local"}} [options]
     */
    constructor(dateFormat, options = {}) {
        if (typeof dateFormat !== "string" || dateFormat.length === 0) {
            throw new TypeError("dateFormat must be a non-empty string");
        }
        this.dateFormat = dateFormat;
        this.defaultTimeZone = options.defaultTimeZone === "local" ? "local" : "UTC";
        this._regexCache = new Map();
    }

    /**
     * Parse `input` according to this.dateFormat.
     * @param {string} input
     * @returns {Date}
     */
    parse(input) {
        if (typeof input !== "string") {
            throw new TypeError("parse() expects a string");
        }
        const value = input.trim();

        switch (this.dateFormat) {
            case "AUTO":
                return DateParser._autoParse(value, this.defaultTimeZone);
            case "UNIX_S":
                return DateParser._parseUnix(value, "s");
            case "UNIX_MS":
                return DateParser._parseUnix(value, "ms");
            default:
                return this._parseCustom(value, this.dateFormat);
        }
    }

    // ---- internals ---------------------------------------------------

    _compile(format) {
        let cached = this._regexCache.get(format);
        if (cached) return cached;

        const tokenRe = /%([A-Za-z%])/g;
        let out = "";
        let lastIndex = 0;
        const seen = Object.create(null);
        let m;

        while ((m = tokenRe.exec(format)) !== null) {
            out += escapeRegex(format.slice(lastIndex, m.index));
            const ch = m[1];

            if (ch === "%") {
                out += "%";
            } else {
                const def = TOKEN_DEFS[ch];
                if (!def) {
                    throw new Error(`Unsupported dateFormat token "%${ch}"`);
                }
                let group = def.group;
                // JS regex disallows duplicate named groups; disambiguate reuse.
                if (seen[group] !== undefined) {
                    seen[group] += 1;
                    group = `${group}${seen[group]}`;
                } else {
                    seen[group] = 0;
                }
                out += `(?<${group}>${def.pattern})`;
            }
            lastIndex = tokenRe.lastIndex;
        }
        out += escapeRegex(format.slice(lastIndex));

        const regex = new RegExp(`^${out}$`);
        this._regexCache.set(format, regex);
        return regex;
    }

    _parseCustom(input, format) {
        const regex = this._compile(format);
        const match = regex.exec(input);
        if (!match) {
            throw new Error(`Input "${input}" does not match dateFormat "${format}"`);
        }
        return DateParser._buildDate(match.groups || {}, this.defaultTimeZone, input);
    }

    // Combine every group# variant of a base name (e.g. "offset", "offset1")
    // back into a single first-match lookup, used when building the date.
    static _get(groups, base) {
        if (groups[base] !== undefined) return groups[base];
        for (let i = 1; i < 5; i += 1) {
            if (groups[base + i] !== undefined) return groups[base + i];
        }
        return undefined;
    }

    static _buildDate(groups, defaultTimeZone, originalInput) {
        const g = groups;

        // --- year (required) ---
        let year;
        const yFull = DateParser._get(g, "year");
        const y2 = DateParser._get(g, "year2");
        if (yFull !== undefined) {
            year = parseInt(yFull, 10);
        } else if (y2 !== undefined) {
            const yy = parseInt(y2, 10);
            year = yy <= 68 ? 2000 + yy : 1900 + yy;
        } else {
            throw new Error('dateFormat must include a year token ("%Y" or "%y")');
        }

        // --- month ---
        let month = 1;
        const mNum = DateParser._get(g, "month");
        const mName = DateParser._get(g, "monthName");
        if (mNum !== undefined) {
            month = parseInt(mNum, 10);
        } else if (mName !== undefined) {
            const idx = monthIndexFromName(mName);
            if (idx === -1) throw new Error(`Unrecognized month name "${mName}" in "${originalInput}"`);
            month = idx + 1;
        }
        if (month < 1 || month > 12) {
            throw new Error(`Month out of range in "${originalInput}"`);
        }

        // --- weekday name, if present, is only sanity-checked ---
        const weekday = DateParser._get(g, "weekday");
        if (weekday !== undefined && !isKnownWeekday(weekday)) {
            throw new Error(`Unrecognized weekday name "${weekday}" in "${originalInput}"`);
        }

        // --- day / time fields ---
        const day = DateParser._get(g, "day") !== undefined ? parseInt(DateParser._get(g, "day"), 10) : 1;
        const hour = DateParser._get(g, "hour") !== undefined ? parseInt(DateParser._get(g, "hour"), 10) : 0;
        const minute = DateParser._get(g, "minute") !== undefined ? parseInt(DateParser._get(g, "minute"), 10) : 0;
        let second = DateParser._get(g, "second") !== undefined ? parseInt(DateParser._get(g, "second"), 10) : 0;
        if (second === 60) second = 59; // clamp leap second

        let ms = 0;
        const frac = DateParser._get(g, "frac");
        if (frac !== undefined) {
            ms = parseInt(frac.padEnd(3, "0").slice(0, 3), 10);
        }

        if (day < 1 || day > 31) throw new Error(`Day out of range in "${originalInput}"`);
        if (hour > 23) throw new Error(`Hour out of range in "${originalInput}"`);
        if (minute > 59) throw new Error(`Minute out of range in "${originalInput}"`);
        if (second > 59) throw new Error(`Second out of range in "${originalInput}"`);

        // --- timezone ---
        let offsetMinutes = null;
        const tzRaw = DateParser._get(g, "offset");
        if (tzRaw !== undefined) {
            offsetMinutes = offsetToMinutes(tzRaw);
            if (offsetMinutes === null) {
                throw new Error(`Unrecognized timezone "${tzRaw}" in "${originalInput}"`);
            }
        } else if (defaultTimeZone === "UTC") {
            offsetMinutes = 0;
        }

        let result;
        if (offsetMinutes === null) {
            // Interpret components as local time.
            result = new Date(year, month - 1, day, hour, minute, second, ms);
        } else {
            const utcMillis = Date.UTC(year, month - 1, day, hour, minute, second, ms) - offsetMinutes * 60000;
            result = new Date(utcMillis);
        }

        if (Number.isNaN(result.getTime())) {
            throw new Error(`Input "${originalInput}" produced an invalid Date`);
        }
        return result;
    }

    static _parseUnix(input, unit) {
        if (!/^-?\d+$/.test(input)) {
            throw new Error(`Input "${input}" is not a valid integer UNIX timestamp`);
        }
        const num = parseInt(input, 10);
        const ms = unit === "s" ? num * 1000 : num;
        const result = new Date(ms);
        if (Number.isNaN(result.getTime())) {
            throw new Error(`Input "${input}" produced an invalid Date`);
        }
        return result;
    }

    static _autoParse(input, defaultTimeZone) {
        const candidates = [
            "%a, %d %b %Y %H:%M:%S %Z", // Thu, 02 Jul 2026 11:00:00 GMT
            "%Y-%m-%dT%H:%M:%S%Z",      // 2026-06-25T00:00:00Z
            "%Y-%m-%dT%H:%M:%S.%f%Z",   // 2026-06-25T00:00:00.123Z
            "%Y-%m-%d",                 // 2026-07-02
        ];
        for (const fmt of candidates) {
            try {
                const parser = new DateParser(fmt, { defaultTimeZone });
                return parser.parse(input);
            } catch (_) {
                // try next candidate
            }
        }
        if (/^-?\d{10}$/.test(input)) return DateParser._parseUnix(input, "s");
        if (/^-?\d{13}$/.test(input)) return DateParser._parseUnix(input, "ms");
        if (/^-?\d+$/.test(input)) return DateParser._parseUnix(input, "ms");

        throw new Error(`AUTO could not detect a matching format for "${input}"`);
    }
}

module.exports = DateParser;
module.exports.DateParser = DateParser;