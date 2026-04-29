let currentUrl = "";
let globalConnection; 

"use strict"; /** * @type {HTMLFormElement} */
const form = document.getElementById("sj-form"); /** * @type {HTMLInputElement} */
const address = document.getElementById("sj-address"); /** * @type {HTMLInputElement} */
const searchEngine = document.getElementById("sj-search-engine"); /** * @type {HTMLParagraphElement} */
const error = document.getElementById("sj-error"); /** * @type {HTMLPreElement} */
const errorCode = document.getElementById("sj-error-code");
const {
    ScramjetController
} = $scramjetLoadController();
const scramjet = new ScramjetController({
    files: {
        wasm: "/scram/scramjet.wasm.wasm",
        all: "/scram/scramjet.all.js",
        sync: "/scram/scramjet.sync.js",
    },
});
scramjet.init();
connection = new BareMux.BareMuxConnection("/baremux/worker.js");
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
        await connection.setTransport("/libcurl/index.mjs", [{
            websocket: wispUrl
        }, ]);
    }
    const frame = scramjet.createFrame();
    frame.frame.id = "sj-frame";
    document.body.appendChild(frame.frame);
    frame.go(url);



	document.body.insertAdjacentHTML("beforeend", `
		<div style="display: flex; gap: 10px; background:rgba(255, 255, 255, 0.43); height: 10px;">
  <input id="sj-new-address" style="z-index:999999; background:rgba(0, 0, 0, 0.73); height: 10px; width: 155px;" placeholder="Search or enter a url." />
  <button style="z-index: 9999; width: 35px; border-radius: 8px; background:rgba(0, 0, 0, 0.73); color: rgba(209, 209, 209, 0.81); " id="reloadBtn">⟳</button>
  </div>
`);

const newAddress = document.getElementById("sj-new-address");

newAddress.addEventListener("keydown", (e) => {
	if (e.key === "Enter") {
		const url = search(newAddress.value, searchEngine.value);
		frame.go(url);
	}
});



reloadBtn.addEventListener("click", () => {
	frame.go(frame.url.href);
});


});






async function loadShortcut(targetUrl) {
    const searchEngine = document.getElementById("sj-search-engine");
    
    // 1. Krypter/behandle nettadressen først
    const url = search(targetUrl, searchEngine.value);

    // 2. Sjekk om rammen allerede er laget
    if (window.currentFrame) {
        window.currentFrame.go(url);
        return;
    }

    // 3. Hvis rammen IKKE finnes, må vi starte proxyen først
    try {
        await registerSW();
    } catch (err) {
        const error = document.getElementById("sj-error");
        const errorCode = document.getElementById("sj-error-code");
        error.textContent = "Failed to register service worker.";
        errorCode.textContent = err.toString();
        throw err;
    }

    let wispUrl = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";
    
    // Her bruker vi den fiksede globale variabelen!
    if ((await globalConnection.getTransport()) !== "/libcurl/index.mjs") {
        await globalConnection.setTransport("/libcurl/index.mjs", [{
            websocket: wispUrl
        }]);
    }

    // 4. Lag rammen og send brukeren til snarveien
    const frame = scramjet.createFrame();
    frame.frame.id = "sj-frame";
    document.body.appendChild(frame.frame);
    
    // Lagre rammen globalt så knappen husker den til neste gang
    window.currentFrame = frame; 
    
    frame.go(url);
}



