// Registers the Sift panel in DevTools. This is the only place the extension
// touches a Chrome API, and it holds no capture state — the panel document
// owns all state and exists only while open.
chrome.devtools.panels.create("Sift", "", "src/panel.html");
