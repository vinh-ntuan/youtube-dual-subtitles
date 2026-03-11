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
    const DEFAULT_LANG = "en";
    const FALLBACK_LANG = "en-asr"

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
                timedTextUrl.searchParams.delete("kind");
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
    // Expected language code: en, zh-CN, ...
    async function fetchSubtitleData(baseUrl, language, isAsr=false) {
        let subtitleUrl = new URL(baseUrl);
        subtitleUrl.searchParams.set("lang", language);
        if (isAsr) {
            subtitleUrl.searchParams.set("kind", "asr");
        }
        const response = await fetch(subtitleUrl);

        if (!response.ok) {
            throw new Error("Couldn't fetch subtitle data with language " + language);
        }

        console.log("Successfully fetched subtitle for language " + language);
        const responseText = await response.text();
        return "data:text/vtt," + encodeURIComponent(responseText);
    }

    // Fills the selector with available languages
    function populateLanguageSelector(selector){
        const captionTracks = document.querySelector("#movie_player")
            .getPlayerResponse()
            .captions
            .playerCaptionsTracklistRenderer
            .captionTracks;

        for (const track of captionTracks) {
            const isAsr = track.kind === "asr";
            const language = track.languageCode;

            const opt = document.createElement("option");
            opt.value = isAsr ? language + "-asr" : language;
            opt.textContent = isAsr
                ? language.toUpperCase() + " - Automatic Subtitle"
                : language.toUpperCase();

            selector.appendChild(opt);
        }
    }

    // Load the subtitle with the given language to the track element
    // languageCode may contains "-asr" to indicate auto-subtitles, e.g "en-asr"
    async function loadSubtitle(track, baseTimedTextUrl, languageCode){
        // handles codes containing asr, e.g "en-asr"
        let isAsr = languageCode.endsWith("-asr");
        let language = isAsr ? languageCode.slice(0,-4) : languageCode;

        let subtitleData = await fetchSubtitleData(baseTimedTextUrl, language, isAsr);
        console.log("Changing secondary subtitle to language " + language);
        track.src = subtitleData;
    }

    function pause (milliseconds) {
        return new Promise((resolve) => setTimeout(resolve, milliseconds));
    }

    async function main(){
        try {
            const video = document.querySelector("video");
            const track = document.createElement("track");
            track.className = "dual-subtitle-track"
            video.appendChild(track);

            const subtitleButton = document.querySelector(".ytp-subtitles-button");
            const languageSelect = document.createElement("select");
            languageSelect.className = "dual-subtitle-language-selector"
            populateLanguageSelector(languageSelect);
            subtitleButton.before(languageSelect);


            let baseTimedTextUrl = await extractTimedTextUrl();

            // Load subtitle with default language
            const availableLanguages = [...languageSelect.options].map(o => o.value);
            let initialSubLang;
            if (availableLanguages.includes(DEFAULT_LANG)){
                initialSubLang = DEFAULT_LANG;
            } else if (availableLanguages.includes(FALLBACK_LANG)){
                initialSubLang = FALLBACK_LANG;
            } else {
                initialSubLang = languageSelect.value;
            }
            languageSelect.value = initialSubLang;
            await loadSubtitle(track, baseTimedTextUrl, initialSubLang);
            console.log("Loaded initial sub with language " + initialSubLang);

            // Change language with select element
            languageSelect.addEventListener("change", () => {
                const languageCode = languageSelect.value;
                loadSubtitle(track, baseTimedTextUrl, languageCode);
            })

            // Toggle showing secondary subtitle with YouTube subtitle button
            // Watch for changes to ariaPressed, since pressing C or clicking can toggle the button
            const observer = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    if (m.attributeName === "aria-pressed") {
                        if (subtitleButton.ariaPressed === "true"){
                            track.track.mode = "showing";
                        } else {
                            track.track.mode = "hidden";
                        }
                    }
                }
            });

            observer.observe(subtitleButton, {
                attributes: true,
                attributeFilter: ["aria-pressed"]
            });
        } catch(e) {
            console.error(e);
        }
    }

    document.addEventListener("yt-navigate-finish", () => {
        setTimeout(main, 5000)
    });
})();