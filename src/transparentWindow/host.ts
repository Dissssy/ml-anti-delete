// https://moonlight-mod.github.io/ext-dev/cookbook/#extension-entrypoints
import { BrowserWindowConstructorOptions } from "electron";

moonlightHost.events.on("window-options", (options: BrowserWindowConstructorOptions) => {
    options.transparent = true;
    options.frame = false; // required on windows, i think discord sets it already but idc shutup nerd lol
    options.backgroundColor = "#00000000";
});