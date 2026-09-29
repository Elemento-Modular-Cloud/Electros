// Run: npx electron test/updater-versions.mjs
import {app} from "electron";
import assert from "assert";
import {Updater} from "../common/Updater.js";

const newer = (a, b) => Updater._Newer(Updater._Key(a), Updater._Key(b));

assert(newer("v3.3.0-a10-beta", "v3.3.0-a9-beta"));
assert(newer("v3.3.0-rc-beta", "v3.3.0-a9-beta"));
assert(newer("v3.3.0-rc2-beta", "v3.3.0-rc1-beta"));
assert(newer("v3.3.0", "v3.3.0-rc-beta"));
assert(newer("v3.3.1-a1-beta", "v3.3.0"));
assert(!newer("v3.3.0", "v3.3.0"));
assert(!newer("v3.2.9", "v3.3.0-rc"));
assert.equal(Updater._Key("v3.3.0-290926-1700-nightly"), null);

console.log("updater versions ok");
app.quit();
