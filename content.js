// Monitorea la actividad del usuario


let idleTimeout = null;
const idleTimeLimit = 1 * 5 * 1000; // 5 minutos

function resetIdleTimer() {
    if (idleTimeout) clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
        chrome.runtime.sendMessage({status: "inactive"});
    }, idleTimeLimit);
    chrome.runtime.sendMessage({status: "active"});
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "checkMedia") {
        let mediaPlaying = !!document.querySelector('video, audio'); // Verifica si hay medios
        sendResponse({ mediaPlaying: mediaPlaying });
        return true;  // Asegura que sendResponse es llamado correctamente
    }
});

// Detectar movimiento de mouse o teclado
window.addEventListener('mousemove', resetIdleTimer);
window.addEventListener('keydown', resetIdleTimer);

// Iniciar el temporizador de inactividad
resetIdleTimer();
