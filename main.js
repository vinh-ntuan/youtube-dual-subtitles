// ==UserScript==
// @name         YouTube Dual Subtitles
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Add dual subtitles to YouTube
// @author       Vinh Nguyen
// @match        https://www.youtube.com/watch*
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    // Change this to switch dual subtitle language
    const LANG = "en";

    // Returns url for YouTube Subtitle API: youtube.com/api/timedtext...
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
                timedTextUrl = new URL(entry.name);
                timedTextUrl.searchParams.set("fmt", "vtt"); // track elems require vtt format
                timedTextUrl.searchParams.delete("tlang"); // tlang links are for auto-translated subs
                break;
            }
        }

        if (!timedTextUrl) {
            throw new Error("No timedtext URL / requests with &pot= parameter found");
        }
        console.log("Timed text url: " + timedTextUrl);
        return timedTextUrl;
    }

    // Returns subtitle data in URI form + vtt format, to use in track element
    async function fetchSubtitleData(url) {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Couldn't fetch subtitle data");
        }

        const responseText = await response.text();
        return "data:text/vtt," + encodeURIComponent(responseText);
    }

    // Add track element to video given subtitle data
    function addSubtitle(subData){
        console.log("Adding subtitle to video");
        const video = document.querySelector("video");
        const track = document.createElement("track");
        track.src = subData;
        track.track.mode = "showing";
        video.appendChild(track);
    }

    function pause (milliseconds) {
        return new Promise((resolve) => setTimeout(resolve, milliseconds));
    }

    async function main(){
        try {
            let baseTimedTextUrl = await extractTimedTextUrl();
            let dualSubUrl = new URL(baseTimedTextUrl);
            dualSubUrl.searchParams.set("lang", LANG);

            let dualSubData = await fetchSubtitleData(dualSubUrl);
            addSubtitle(dualSubData);
        } catch(e) {
            console.error(e);
        }

    }

    document.addEventListener("yt-navigate-finish", () => {
        setTimeout(main, 5000)
    });
})();