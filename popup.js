let updateInterval;

document.addEventListener('DOMContentLoaded', function() {
    const timeSpentElement = document.getElementById('timeSpent');
    const statusElement = document.getElementById('status');
    const dateElement = document.getElementById('date');
    const pomodoroButton = document.getElementById('pomodoroButton');
    const backButton = document.getElementById('backButton');
    const startPauseButton = document.getElementById('startPauseButton');
    const pomodoroCounter = document.getElementById('pomodoroCounter');
    const pomodoroCompletedElement = document.getElementById('pomodoroCompleted');
    const statsButton = document.getElementById('statsButton');
    const blocklistButton = document.getElementById('blocklistButton');
    const blockCurrentSiteButton = document.getElementById('blockCurrentSiteButton');


    if (!timeSpentElement || !statusElement || !dateElement) {
        console.error('Elementos no encontrados en el DOM');
        return;
    }

    statsButton.addEventListener('click', () => {
        chrome.tabs.create({url: 'statistics.html'});
    });

    blocklistButton.addEventListener('click', () => {
        chrome.tabs.create({url: 'blocklist.html'});
    });

    blockCurrentSiteButton.addEventListener('click', () => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0] && tabs[0].url) {
                chrome.runtime.sendMessage({action: "blockSite", site: tabs[0].url}, (response) => {
                    if (response.success) {
                        alert('Sitio bloqueado exitosamente');
                        window.close();
                    }
                });
            }
        });
    });

    pomodoroButton.addEventListener('click', () => {
        document.getElementById('mainContainer').style.display = 'none';
        document.getElementById('pomodoroContainer').style.display = 'block';
        updatePomodoroUI();
    });

    backButton.addEventListener('click', () => {
        document.getElementById('pomodoroContainer').style.display = 'none';
        document.getElementById('mainContainer').style.display = 'block';
    });

    startPauseButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "togglePomodoro" });
    });

    function updatePomodoroUI() {
        chrome.runtime.sendMessage({ action: "getPomodoroStatus" }, (response) => {
            if (response) {
                pomodoroCounter.textContent = response.time;
                pomodoroCompletedElement.textContent = response.completed;
                startPauseButton.textContent = response.isRunning ? 'PAUSAR' : 'INICIAR';
            }
        });
    }

    updatePopup();
    setInterval(updatePopup, 1000);
    setInterval(updatePomodoroUI, 1000);
});

function updatePopup() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
            console.error('No se encontraron pestañas activas');
            updateUI('Estado: desconocido', 'Tiempo: desconocido', 'Fecha: desconocida');
            return;
        }
        let url = new URL(tabs[0].url);
        let siteName = url.hostname.replace('www.', '');

        if (siteName === chrome.runtime.id) {
            updateUI('¡A seguir trabajando!', '¡Estás en un sitio bloqueado!', 'Fecha: ' + getCurrentDate());
            blockCurrentSiteButton.style.display = 'none';
            return;
        }

        chrome.runtime.sendMessage({action: "getStatus", siteName: siteName}, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error al enviar mensaje:', chrome.runtime.lastError.message);
                updateUI('Estado: desconocido', 'Tiempo: desconocido', 'Fecha: desconocida');                
                return;
            }

            if (response) {
                updateUI(
                    `Estado: ${response.status}`,
                    `Has pasado ${msToTime(response.totalTime)} en el sitio ${siteName}.`,
                    `Fecha: ${getCurrentDate()}`
                );
            } else {
                updateUI('Estado: desconocido', 'Tiempo: desconocido', 'Fecha: desconocida');
            }
        });
    });
}

function getCurrentDate() {
    return new Date().toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

function updateUI(status, time, date) {
    const statusElement = document.getElementById('status');
    const timeSpentElement = document.getElementById('timeSpent');
    const dateElement = document.getElementById('date');
    if (statusElement && timeSpentElement && dateElement) {
        statusElement.textContent = status;
        timeSpentElement.textContent = time;
        dateElement.textContent = date;
    }
}

function msToTime(duration) {
    let seconds = Math.floor((duration / 1000) % 60),
        minutes = Math.floor((duration / (1000 * 60)) % 60),
        hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Limpiar el intervalo cuando se cierra el popup
window.addEventListener('unload', () => {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
});