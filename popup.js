document.addEventListener('DOMContentLoaded', function() {
    const timeSpentElement = document.getElementById('timeSpent');
    const statusElement = document.getElementById('status');

    if (!timeSpentElement) {
        console.error('Elemento #timeSpent no encontrado en el DOM');
        return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
            console.error('No se encontraron pestañas activas');
            return;
        }
        let url = new URL(tabs[0].url);
        let siteName = url.hostname;

        chrome.storage.local.get([siteName], function(result) {
            if (result[siteName]) {
                let elapsedTime = result[siteName].totalTime + (Date.now() - result[siteName].startTime);
                timeSpentElement.textContent = `Has pasado ${msToTime(elapsedTime)} en el sitio ${siteName}.`;
            } else {
                timeSpentElement.textContent = 'No se ha podido obtener el tiempo transcurrido en este sitio web.';
            }

            // Enviar mensaje para obtener estado
            chrome.runtime.sendMessage({request: "getStatus", siteName: siteName}, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Error al enviar mensaje:', chrome.runtime.lastError.message);
                    statusElement.textContent = 'Estado: desconocido';
                    return;
                }

                if (response && response.status) {
                    statusElement.textContent = `Estado: ${response.status}`;
                } else {
                    statusElement.textContent = 'Estado: desconocido';
                }
            });
        });
    });
});



function msToTime(duration) {
    let seconds = Math.floor((duration / 1000) % 60),
        minutes = Math.floor((duration / (1000 * 60)) % 60),
        hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function updateTime() {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        let url = new URL(tabs[0].url);
        let siteName = url.hostname.replace('www.', ''); // Normaliza el nombre del sitio
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

// Actualiza el tiempo cada segundo
setInterval(updateTime, 1000);
