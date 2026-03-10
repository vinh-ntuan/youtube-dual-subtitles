// ==UserScript==
// @name         YouTube Dual Real Subtitles
// @namespace    yt.dualsub.real
// @version      1.0
// @description  Show two real YouTube subtitle tracks (EN + RU)
// @match        https://www.youtube.com/watch*
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    const LANG1 = "en";
    const LANG2 = "ru";

    // TODO: use yt-navigate-finish to know when pages finished loading

    // Returns url for Youtube Subtitle API: youtube.com/api/timedtext...
    // including PO Token, without which fetching subtitle returns empty string. Should look something like
    // pot=<PO_TOKEN>&fmt=json3&xorb=2&xobt=3&xovt=3&cbr=Firefox&cplatform=DESKTOP
    // See https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide for more info
    async function extractTimedTextUrl() {
        const subtitleButtonSelector = ".ytp-subtitles-button";
        const subtitleButton = document.querySelector(subtitleButtonSelector);
        if (!subtitleButton) {
            throw new Error("Subtitle button not found");
        }

        // const initialEntryCount = performance.getEntriesByType("resource").length;
        // Toggle button twice to trigger timedtext request
        subtitleButton.click();
        subtitleButton.click();

        await pause(1000);

        let timedTextUrl = null;

        // Look for HTTP requests in performances entries
        const entries = performance.getEntriesByType("resource");
        for (const entry of entries) {
            const isTimedText = entry.name.includes("timedtext");
            const hasPot = entry.name.includes("&pot=");

            if (isTimedText && hasPot) {
                console.log("Found matching timedtext request with &pot= parameter!");
                timedTextUrl = entry.name;
                break;
            }
        }

        if (!timedTextUrl) {
            throw new Error("No timedtext URL / requests with &pot= parameter found");
        }

        return timedTextUrl;
    }
    function pause (milliseconds) {
        return new Promise((resolve) => setTimeout(resolve, milliseconds));
    }
})();