let lastActivityTime = Date.now();
let isActive = true;
let isWindowFocused = true;
const IDLE_TIMEOUT = 5 * 1000; // 5 segundos

function resetActivityTimer() {
    lastActivityTime = Date.now();
    if (!isActive) {
        isActive = true;
        sendActivityStatus();
    }
}

function checkIdleStatus() {
    if (Date.now() - lastActivityTime > IDLE_TIMEOUT) {
        if (isActive) {
            isActive = false;
            sendActivityStatus();
        }
    } else if (!isActive) {
        isActive = true;
        sendActivityStatus();
    }
}

function sendActivityStatus() {
    try {
        chrome.runtime.sendMessage({
            action: "updateStatus",
            isActive: isActive,
            isWindowFocused: isWindowFocused,
            hasMedia: checkForMedia()
        });
    } catch (error) {
        console.error("Error sending message:", error);
    }
}

function checkForMedia() {
    const videoElements = document.getElementsByTagName('video');
    const audioElements = document.getElementsByTagName('audio');
    
    for (let video of videoElements) {
        if (!video.paused) return true;
    }
    
    for (let audio of audioElements) {
        if (!audio.paused) return true;
    }
    
    return false;
}

// Event listeners
['mousemove', 'keydown', 'scroll', 'click'].forEach(eventType => {
    document.addEventListener(eventType, resetActivityTimer);
});

// Window focus listeners
window.addEventListener('focus', () => {
    isWindowFocused = true;
    sendActivityStatus();
});

window.addEventListener('blur', () => {
    isWindowFocused = false;
    sendActivityStatus();
});

// Check idle status and send updates every second
setInterval(() => {
    checkIdleStatus();
    sendActivityStatus();
}, 1000);

// Initial status send
sendActivityStatus();

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "checkStatus") {
        sendResponse({
            isActive: isActive,
            isWindowFocused: isWindowFocused,
            hasMedia: checkForMedia()
        });
    }
    return true;
});