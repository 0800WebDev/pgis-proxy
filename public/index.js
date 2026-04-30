"use strict";

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
        <div style="display: flex; gap: 10px; background:rgba(255,255,255,0.43); padding: 6px; height: 36px;">
            <input id="sj-new-address" style="z-index:999999; background:rgba(0,0,0,0.73); height: 30px; width: 250px; color: white; border-radius: 6px; border: none; padding: 0 8px;" placeholder="Search or enter a url." />
            <button style="z-index:9999; width: 35px; border-radius: 8px; background:rgba(0,0,0,0.73); color: rgba(209,209,209,0.81); height: 36px;" id="reloadBtn">⟳</button>
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
        <div style="display: flex; gap: 10px; background:rgba(255,255,255,0.43); padding: 6px; height: 36px;">
            <input id="sj-new-address" style="z-index:999999; background:rgba(0,0,0,0.73); height: 30px; width: 250px; color: white; border-radius: 6px; border: none; padding: 0 8px;" placeholder="Search or enter a url." />
            <button style="z-index:9999; width: 35px; border-radius: 8px; background:rgba(0,0,0,0.73); color: rgba(209,209,209,0.81); height: 36px;" id="reloadBtn">⟳</button>
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