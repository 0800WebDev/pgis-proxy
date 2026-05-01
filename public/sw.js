importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

const SECRET_KEY = "k7Xm2#pQ9nLw4@Rz"; // must match index.js exactly

function xorDecode(encoded, key) {
    let b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const str = atob(b64);
    return str.split("").map((c, i) =>
        String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))
    ).join("");
}

async function handleRequest(event) {
    await scramjet.loadConfig();

    const url = new URL(event.request.url);

    // Intercept /scramjet/<encoded> routes and decode before routing
    const match = url.pathname.match(/^\/scramjet\/(.+)$/);
    if (match) {
        try {
            const decoded = xorDecode(match[1], SECRET_KEY);
            // Rewrite the request with the decoded real URL embedded
            const rewritten = new Request(
                url.origin + "/scramjet/" + encodeURIComponent(decoded),
                event.request
            );
            const rewrittenEvent = Object.create(event);
            Object.defineProperty(rewrittenEvent, "request", { value: rewritten });

            if (scramjet.route(rewrittenEvent)) {
                return scramjet.fetch(rewrittenEvent);
            }
        } catch (e) {
            console.warn("[sw] Failed to decode URL:", e);
        }
    }

    if (scramjet.route(event)) {
        return scramjet.fetch(event);
    }

    return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event));
});