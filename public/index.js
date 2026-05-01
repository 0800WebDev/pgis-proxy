"use strict";

const SECRET_KEY = "k7Xm2#pQ9nLw4@Rz"; // change this to something secret

function xorEncode(str, key) {
    return btoa(
        str.split("").map((c, i) =>
            String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))
        ).join("")
    ).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function xorDecode(encoded, key) {
    // Restore base64 padding
    let b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const str = atob(b64);
    return str.split("").map((c, i) =>
        String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))
    ).join("");
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
    files: {
        wasm: "/scram/scramjet.wasm.wasm",
        all: "/scram/scramjet.all.js",
        sync: "/scram/scramjet.sync.js",
    },
});
scramjet.init();

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        await registerSW();
    } catch (err) {
        error.textContent = "Failed to register service worker.";
        errorCode.textContent = err.toString();
        throw err;
    }

    const rawUrl = search(address.value, searchEngine.value);
    const encodedUrl = xorEncode(rawUrl, SECRET_KEY);
    const proxyUrl = `/scramjet/${encodedUrl}`;

    let wispUrl = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";

    if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
        await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
    }

    const frame = scramjet.createFrame();
    frame.frame.id = "sj-frame";
    document.body.appendChild(frame.frame);
    frame.go(proxyUrl);

    document.body.insertAdjacentHTML("beforeend", `
        <div style="display: flex; gap: 10px; background: rgba(255,255,255,0.43); padding: 6px; align-items: center; border-radius: 8px; width: fit-content; position: fixed; bottom: 20px; left: 20px; z-index: 1000000;"> 
            <input id="sj-new-address" style="background: rgba(0,0,0,0.73); height: 30px !important; width: 250px; color: white; border-radius: 6px; border: none; padding: 0 8px !important; box-sizing: border-box;" placeholder="Search or enter a url." /> 
            <button style="width: 35px; border-radius: 6px; background: rgba(0,0,0,0.73); color: rgba(209,209,209,0.81); height: 30px; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; box-sizing: border-box;" id="reloadBtn">⟳</button> 
        </div>
    `);

    const newAddress = document.getElementById("sj-new-address");
    newAddress.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const newRawUrl = search(newAddress.value, searchEngine.value);
            const newEncoded = xorEncode(newRawUrl, SECRET_KEY);
            frame.go(`/scramjet/${newEncoded}`);
        }
    });

    const reloadBtn = document.getElementById("reloadBtn");
    reloadBtn.addEventListener("click", () => {
        frame.go(frame.url.href);
    });
});


async function loadShortcut(targetUrl) {
    const searchEngine = document.getElementById("sj-search-engine");
    const rawUrl = search(targetUrl, searchEngine.value);
    const encodedUrl = xorEncode(rawUrl, SECRET_KEY);
    const proxyUrl = `/scramjet/${encodedUrl}`;

    if (window.currentFrame) {
        window.currentFrame.go(proxyUrl);
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
    frame.go(proxyUrl);

    document.body.insertAdjacentHTML("beforeend", `
        <div style="display: flex; gap: 10px; background: rgba(255,255,255,0.43); padding: 6px; align-items: center; border-radius: 8px; width: fit-content; position: fixed; bottom: 20px; left: 20px; z-index: 1000000;"> 
            <input id="sj-new-address" style="background: rgba(0,0,0,0.73); height: 30px !important; width: 250px; color: white; border-radius: 6px; border: none; padding: 0 8px !important; box-sizing: border-box;" placeholder="Search or enter a url." /> 
            <button style="width: 35px; border-radius: 6px; background: rgba(0,0,0,0.73); color: rgba(209,209,209,0.81); height: 30px; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; box-sizing: border-box;" id="reloadBtn">⟳</button> 
        </div>
    `);

    const newAddress = document.getElementById("sj-new-address");
    newAddress.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const newRawUrl = search(newAddress.value, searchEngine.value);
            const newEncoded = xorEncode(newRawUrl, SECRET_KEY);
            frame.go(`/scramjet/${newEncoded}`);
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