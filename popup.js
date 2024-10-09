document.addEventListener('DOMContentLoaded', function() {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        let url = new URL(tabs[0].url);
        let siteName = url.hostname;

        // Mostrar el tiempo pasado en el sitio actual
        chrome.storage.local.get([siteName], function(result) {
            if (result[siteName]) {
                let elapsedTime = result[siteName].totalTime + (Date.now() - result[siteName].startTime);
                document.getElementById('timeSpent').textContent = `Has pasado ${msToTime(elapsedTime)} en el sitio ${siteName}.`;
            } else {
                document.getElementById('timeSpent').textContent = 'No se ha podido obtener el tiempo transcurrido en este sitio web.';
            }
        });

        // Verificar si el sitio ya está en la lista negra
        chrome.storage.local.get(['blacklist'], function(result) {
            let blacklist = result.blacklist || [];
            if (blacklist.includes(siteName) || blacklist.some(domain => siteName.endsWith(`.${domain}`))) {
                document.getElementById('blacklistStatus').textContent = `Este sitio está actualmente bloqueado.`;
            }
        });

        // Botón para añadir a la lista negra
        document.getElementById('addBlacklist').addEventListener('click', function() {
            chrome.runtime.sendMessage({action: 'addToBlacklist', siteName: siteName}, function(response) {
                if (response.success) {
                    document.getElementById('blacklistStatus').textContent = `El sitio ${siteName} ha sido bloqueado.`;
                }
            });
        });

        // Botón para eliminar de la lista negra
        document.getElementById('removeBlacklist').addEventListener('click', function() {
            chrome.runtime.sendMessage({action: 'removeFromBlacklist', siteName: siteName}, function(response) {
                if (response.success) {
                    document.getElementById('blacklistStatus').textContent = `El sitio ${siteName} ha sido desbloqueado.`;
                }
            });
        });
    });
});


function msToTime(duration) {
    let seconds = Math.floor((duration / 1000) % 60),
        minutes = Math.floor((duration / (1000 * 60)) % 60),
        hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    return hours + ":" + minutes + ":" + seconds;
}

function updateTime() {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs.length === 0) return; // Verifica que haya una pestaña activa

        let url = new URL(tabs[0].url);
        let siteName = url.hostname;
        chrome.storage.local.get([siteName], function(result) {
            if (result[siteName]) {
                let elapsedTime = result[siteName].totalTime + (Date.now() - result[siteName].startTime);
                document.getElementById('timeSpent').textContent = `Has pasado ${msToTime(elapsedTime)} en el sitio ${siteName}.`;
            } else {
                document.getElementById('timeSpent').textContent = 'No se ha podido obtener el tiempo transcurrido en este sitio web.';
            }
        });
    });
}

// Actualiza el tiempo cada segundo solo si la pestaña está activa
setInterval(updateTime, 1000);

