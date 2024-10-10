// Objeto para almacenar el estado de actividad de cada sitio
let siteActivityStatus = {};

// Escuchar mensajes desde el content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.request === "getStatus") {
        let siteName = message.siteName;
        if (siteActivityStatus[siteName]) {
            sendResponse({ status: siteActivityStatus[siteName].active ? "activo" : "inactivo" });
        } else {
            sendResponse({ status: "desconocido" });
        }
    }
});


// Revisar si la pestaña está en segundo plano y si está reproduciendo medios
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        let url = new URL(tab.url);
        let siteName = url.hostname.replace('www.', ''); // Normaliza el nombre del sitio eliminando el 'www'
        
        // Check si hay actividad o medios reproduciéndose
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0] && tabs[0].id === tabId) {
                chrome.storage.local.get([siteName], function(result) {
                    if (result[siteName]) {
                        // Si hay medios reproduciéndose, seguimos contando el tiempo
                        if (siteActivityStatus[siteName].mediaPlaying || siteActivityStatus[siteName].active) {
                            let elapsedTime = Date.now() - result[siteName].startTime;
                            result[siteName].totalTime += elapsedTime;
                        }
                    } else {
                        result[siteName] = {
                            startTime: Date.now(),
                            totalTime: 0
                        };
                    }
                    result[siteName].startTime = Date.now();
                    let storeObj = {};
                    storeObj[siteName] = result[siteName];
                    chrome.storage.local.set(storeObj);
                });
            }
        });
    }
});

// Revisar si la pestaña está reproduciendo algún medio (audio/video)
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab && tab.url) {
            let url = new URL(tab.url);
            let siteName = url.hostname.replace('www.', '');

            // Inicializar el objeto siteActivityStatus si no existe
            if (!siteActivityStatus[siteName]) {
                siteActivityStatus[siteName] = { active: true, mediaPlaying: false };
            }

           // Enviar mensaje al content script para verificar medios
           chrome.tabs.sendMessage(activeInfo.tabId, { action: "checkMedia" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn("No se pudo conectar con el content script:", chrome.runtime.lastError.message);
                    return;
                }
                if (response && response.mediaPlaying) {
                    siteActivityStatus[siteName].mediaPlaying = true;
                } else {
                    siteActivityStatus[siteName].mediaPlaying = false;
                }
            });
        }
    });
});


chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    chrome.tabs.get(tabId, function(tab) {
        if (tab && tab.url) {  // Asegurarse de que la pestaña aún tenga una URL
            let url = new URL(tab.url);
            let siteName = url.hostname.replace('www.', ''); // Normaliza el nombre del sitio
            chrome.storage.local.get([siteName], function(result) {
                if (result[siteName]) {
                    let elapsedTime = Date.now() - result[siteName].startTime;
                    result[siteName].totalTime += elapsedTime;
                    let storeObj = {};
                    storeObj[siteName] = result[siteName];
                    chrome.storage.local.set(storeObj);
                }
            });
        }
    });
});
