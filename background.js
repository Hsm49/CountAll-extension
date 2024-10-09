// Diccionario para almacenar pestañas activas
let activeTabs = {}; 

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        let url = new URL(tab.url);
        let siteName = url.hostname;
        activeTabs[tabId] = siteName; // Guardar la pestaña activa
        
        chrome.storage.local.get([siteName], function(result) {
            if (result[siteName]) {
                let elapsedTime = Date.now() - result[siteName].startTime;
                result[siteName].totalTime += elapsedTime;
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

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    let siteName = activeTabs[tabId]; // Usar el sitio almacenado en activeTabs
    if (siteName) {
        chrome.storage.local.get([siteName], function(result) {
            if (result[siteName]) {
                let elapsedTime = Date.now() - result[siteName].startTime;
                result[siteName].totalTime += elapsedTime;
                let storeObj = {};
                storeObj[siteName] = result[siteName];
                chrome.storage.local.set(storeObj);
            }
        });
        delete activeTabs[tabId]; // Eliminar la pestaña de activeTabs
    }
});

// Gestionar lista negra y bloquear sitios
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
      let url = new URL(details.url);
      let siteName = url.hostname;

      return new Promise((resolve) => {
          chrome.storage.local.get(['blacklist'], function(result) {
              let blacklist = result.blacklist || [];

              // Compara el dominio principal y los subdominios
              let isBlocked = blacklist.some(blockedSite => {
                  return siteName === blockedSite || siteName.endsWith(`.${blockedSite}`);
              });

              if (isBlocked) {
                  // Redirige a la página de bloqueo si el sitio está en la lista negra
                  resolve({redirectUrl: chrome.runtime.getURL("blocked.html")});
              } else {
                  resolve({cancel: false});
              }
          });
      });
  },
  {urls: ["<all_urls>"]},  // Escuchar todas las URLs
  ["blocking"]              // Bloquear la solicitud si está en la lista negra
);



// Permitir que el usuario gestione la lista negra
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'addToBlacklist') {
        chrome.storage.local.get(['blacklist'], function(result) {
            let blacklist = result.blacklist || [];
            if (!blacklist.includes(message.siteName)) {
                blacklist.push(message.siteName);
                chrome.storage.local.set({blacklist: blacklist}, function() {
                    sendResponse({success: true});
                });
            } else {
                sendResponse({success: false}); // Si ya está en la lista
            }
        });
    } else if (message.action === 'removeFromBlacklist') {
        chrome.storage.local.get(['blacklist'], function(result) {
            let blacklist = result.blacklist || [];
            let index = blacklist.indexOf(message.siteName);
            if (index !== -1) {
                blacklist.splice(index, 1);
                chrome.storage.local.set({blacklist: blacklist}, function() {
                    sendResponse({success: true});
                });
            } else {
                sendResponse({success: false}); // Si no está en la lista
            }
        });
    }
    return true; // Indica que la respuesta es asíncrona
});

