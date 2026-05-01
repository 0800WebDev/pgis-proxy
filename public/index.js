"use strict";

// --- Codec Toggle (saved in localStorage) ---
const CODEC_KEY = "scramjet_codec_enabled";

function isCodecEnabled() {
    const val = localStorage.getItem(CODEC_KEY);
    return val === null ? true : val === "true"; // default on
}

function setCodecEnabled(val) {
    localStorage.setItem(CODEC_KEY, String(val));
}

function getCodec(enabled) {
    if (enabled) {
        return {
            encode: `(url) => {
                if (!url) return url;
                try {
                    const u = new URL(url);
                    u.hostname = u.hostname.replace(/\\./g, ",");
                    return u.toString();
                } catch(e) {
                    return url;
                }
            }`,
            decode: `(encoded) => {
                if (!encoded) return encoded;
                try {
                    const withDots = encoded.replace(/:\\/\\/([^/]+)/, (match, host) => {
                        return "://" + host.replace(/,/g, ".");
                    });
                    return withDots;
                } catch(e) {
                    return encoded;
                }
            }`,
        };
    } else {
        return {
            encode: `(url) => { return url; }`,
            decode: `(encoded) => { return encoded; }`,
        };
    }
}

let currentUrl = "";
let globalConnection;

const form = document.getElementById("sj-form");
const address = document.getElementById("sj-address");
const searchEngine = document.getElementById("sj-search-engine");
const error = document.getElementById("sj-error");
const errorCode = document.getElementById("sj-error-code");

const { ScramjetController } = $scramjetLoadController();
const scramjet = new ScramjetController({
    prefix: "/scramjet/",
    codec: getCodec(isCodecEnabled()),
    files: {
        wasm: "/scram/scramjet.wasm.wasm",
        all: "/scram/scramjet.all.js",
        sync: "/scram/scramjet.sync.js",
    },
});
scramjet.init();

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

// --- Inject toggle button into page ---
function injectToggleButton() {
    const existing = document.getElementById("codec-toggle-btn");
    if (existing) existing.remove();

    const enabled = isCodecEnabled();
    const btn = document.createElement("button");
    btn.id = "codec-toggle-btn";
    btn.textContent = enabled ? "URL Mask: ON" : "URL Mask: OFF";
    btn.title = "Toggle URL masking (requires page reload to take effect)";
    btn.style.cssText = `
        position: fixed;
        top: 12px;
        right: 12px;
        z-index: 9999999;
        background: ${enabled ? "rgba(0,180,80,0.85)" : "rgba(180,0,0,0.75)"};
        color: white;
        border: none;
        border-radius: 6px;
        padding: 6px 12px;
        font-size: 13px;
        cursor: pointer;
        backdrop-filter: blur(4px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: background 0.2s;
    `;
    btn.addEventListener("click", () => {
        const next = !isCodecEnabled();
        setCodecEnabled(next);
        btn.textContent = next ? " URL Mask: ON" : " URL Mask: OFF";
        btn.style.background = next ? "rgba(0,180,80,0.85)" : "rgba(180,0,0,0.75)";
        // Reload so ScramjetController re-initializes with new codec
        location.reload();
    });
    document.body.appendChild(btn);
}

injectToggleButton();

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        await registerSW();
    } catch (err) {
        error.textContent = "Failed to register service worker.";
        errorCode.textContent = err.toString();
        throw err;
    }

    const url = search(address.value, searchEngine.value);
    let wispUrl = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";

    if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
        await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
    }

    const frame = scramjet.createFrame();
    frame.frame.id = "sj-frame";
    document.body.appendChild(frame.frame);
    frame.go(url);

    document.body.insertAdjacentHTML("beforeend", `
        <div style="display: flex; gap: 10px; background: rgba(255,255,255,0.43); padding: 6px; align-items: center; border-radius: 8px; width: fit-content; position: fixed; bottom: 20px; left: 20px; z-index: 1000000;"> 
            <input id="sj-new-address" style="background: rgba(0,0,0,0.73); height: 30px !important; width: 250px; color: white; border-radius: 6px; border: none; padding: 0 8px !important; box-sizing: border-box;" placeholder="Search or enter a url." /> 
            <button style="width: 35px; border-radius: 6px; background: rgba(0,0,0,0.73); color: rgba(209,209,209,0.81); height: 30px; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; box-sizing: border-box;" id="reloadBtn">⟳</button> 
        </div>
    `);

    const newAddress = document.getElementById("sj-new-address");
    newAddress.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const newUrl = search(newAddress.value, searchEngine.value);
            frame.go(newUrl);
        }
    });

    const reloadBtn = document.getElementById("reloadBtn");
    reloadBtn.addEventListener("click", () => {
        frame.go(frame.url.href);
    });
});


async function loadShortcut(targetUrl) {
    const searchEngine = document.getElementById("sj-search-engine");
    const url = search(targetUrl, searchEngine.value);

    if (window.currentFrame) {
        window.currentFrame.go(url);
        return;
    }

    try {
        await registerSW();
    } catch (err) {
        const error = document.getElementById("sj-error");
        const errorCode = document.getElementById("sj-error-code");
        if (error) error.textContent = "Failed to register service worker.";
        if (errorCode) errorCode.textContent = err.toString();
        throw err;
    }

    const shortConnection = new BareMux.BareMuxConnection("/baremux/worker.js");
    let wispUrl = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";

    if ((await shortConnection.getTransport()) !== "/libcurl/index.mjs") {
        await shortConnection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
    }

    const frame = scramjet.createFrame();
    frame.frame.id = "sj-frame";
    document.body.appendChild(frame.frame);
    window.currentFrame = frame;
    frame.go(url);

    document.body.insertAdjacentHTML("beforeend", `
        <div style="display: flex; gap: 10px; background: rgba(255,255,255,0.43); padding: 6px; align-items: center; border-radius: 8px; width: fit-content; position: fixed; bottom: 20px; left: 20px; z-index: 1000000;"> 
            <input id="sj-new-address" style="background: rgba(0,0,0,0.73); height: 30px !important; width: 250px; color: white; border-radius: 6px; border: none; padding: 0 8px !important; box-sizing: border-box;" placeholder="Search or enter a url." /> 
            <button style="width: 35px; border-radius: 6px; background: rgba(0,0,0,0.73); color: rgba(209,209,209,0.81); height: 30px; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; box-sizing: border-box;" id="reloadBtn">⟳</button> 
        </div>
    `);

    const newAddress = document.getElementById("sj-new-address");
    newAddress.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const newUrl = search(newAddress.value, searchEngine.value);
            frame.go(newUrl);
        }
    });

    const reloadBtn = document.getElementById("reloadBtn");
    reloadBtn.addEventListener("click", () => {
        frame.go(frame.url.href);
    });

    function isProbablyMobile() {
        const hasTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
        const smallScreen = window.matchMedia("(max-width: 768px)").matches;
        const mobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        return (hasTouch && smallScreen) || mobileUA;
    }

    if (isProbablyMobile()) {
        alert("PGIS proxy may not work properly on mobile devices.");
    }
}