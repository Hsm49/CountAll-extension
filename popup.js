let updateInterval;
let previousPomodoroTime = null;

document.addEventListener('DOMContentLoaded', function() {
    const timeSpentElement = document.getElementById('timeSpent');
    const statusElement = document.getElementById('status');
    const dateElement = document.getElementById('date');
    const pomodoroButton = document.getElementById('pomodoroButton');
    const statsButton = document.getElementById('statsButton');
    const blocklistButton = document.getElementById('blocklistButton');
    const blockCurrentSiteButton = document.getElementById('blockCurrentSiteButton');
    const pomodoroForm = document.getElementById('pomodoroForm');
    const pomodoroCounter = document.querySelector('.timer');
    const startPauseButton = document.querySelector('.pause-btn');
    const cancelButton = document.querySelector('.cancel-btn');
    const pomodoroCompletedElement = document.getElementById('pomodoroCompleted');
    const sessionsSelect = document.getElementById('sessions');
    const backButton = document.querySelector('.back-btn');
    let isPomodoroRunning = false;
    let pomodoroTime;
    let strikes = 0;

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
        resetPomodoroUI(); // Asegúrate de que la UI del pomodoro esté reseteada al abrir la vista
    });

    backButton.addEventListener('click', function() {
        document.getElementById('pomodoroContainer').style.display = 'none';
        document.getElementById('mainContainer').style.display = 'block';
        resetPomodoroUI();
    });

    startPauseButton.addEventListener('click', function() {
        if (isPomodoroRunning) {
            pausePomodoro();
        } else {
            resumePomodoro();
        }
    });

    cancelButton.addEventListener('click', function() {
        if (confirm('¿Estás seguro de que deseas cancelar la sesión?')) {
            cancelPomodoro();
        }
    });

    pomodoroForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const sessions = parseInt(sessionsSelect.value, 10);
        pomodoroTime = sessions * 30 * 60;

        if (pomodoroTime > 0) {
            startPomodoro(pomodoroTime);
        } else {
            alert('Por favor, selecciona una duración válida.');
        }
    });

    function startPomodoro(duration) {
        chrome.runtime.sendMessage({ action: "startPomodoro", duration: duration });
        backButton.style.display = 'none'; // Ocultar el botón de "Volver" cuando se inicia una sesión de trabajo
    }

    function resumePomodoro() {
        chrome.runtime.sendMessage({ action: "startPomodoro" });
    }

    function pausePomodoro() {
        chrome.runtime.sendMessage({ action: "pausePomodoro" });
    }

    function cancelPomodoro() {
        chrome.runtime.sendMessage({ action: "cancelPomodoro" });
        backButton.style.display = 'block'; // Mostrar el botón de "Volver" cuando se cancela una sesión de trabajo
    }

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "pomodoroUpdated") {
            pomodoroCounter.textContent = message.time;
        } else if (message.action === "pomodoroCompleted") {
            pomodoroCompletedElement.textContent = message.completed;
            alert('¡Sesión completada!');
            resetPomodoroUI();
        } else if (message.action === "pomodoroStarted") {
            isPomodoroRunning = true;
            pomodoroForm.style.display = 'none';
            pomodoroCounter.style.display = 'block';
            startPauseButton.style.display = 'block';
            cancelButton.style.display = 'block';
            startPauseButton.textContent = 'PAUSAR';
        } else if (message.action === "pomodoroPaused") {
            isPomodoroRunning = false;
            startPauseButton.textContent = 'REANUDAR';
        } else if (message.action === "pomodoroCanceled") {
            resetPomodoroUI();
        }
    });

    function resetPomodoroUI() {
        pomodoroForm.style.display = 'block';
        pomodoroCounter.style.display = 'none';
        startPauseButton.style.display = 'none';
        cancelButton.style.display = 'none';
        startPauseButton.textContent = 'INICIAR';
        backButton.style.display = 'block'; // Mostrar el botón de "Volver" cuando se resetea la UI
    }

    function updatePomodoroUI() {
        chrome.runtime.sendMessage({ action: "getPomodoroStatus" }, (response) => {
            if (response) {
                if (response.time !== previousPomodoroTime) {
                    pomodoroCounter.textContent = response.time;
                    previousPomodoroTime = response.time;
                }
                pomodoroCompletedElement.textContent = response.completed;
                startPauseButton.textContent = response.isRunning ? 'PAUSAR' : 'REANUDAR';
                if (response.isRunning) {
                    pomodoroForm.style.display = 'none';
                    pomodoroCounter.style.display = 'block';
                    startPauseButton.style.display = 'block';
                    cancelButton.style.display = 'block';
                    backButton.style.display = 'none';
                    document.getElementById('mainContainer').style.display = 'none';
                    document.getElementById('pomodoroContainer').style.display = 'block';
                }
            }
        });
    }

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

    updatePopup();
    setInterval(updatePopup, 1000);
    setInterval(updatePomodoroUI, 1000);

    // Limpiar el intervalo cuando se cierra el popup
    window.addEventListener('unload', () => {
        if (updateInterval) {
            clearInterval(updateInterval);
        }
    });

    // Check and reset the session counter if the day has changed
    checkAndResetSessionCounter();
});

function checkAndResetSessionCounter() {
    const today = new Date().toLocaleDateString();
    chrome.storage.local.get(['pomodoroDate', 'pomodoroCompleted'], (result) => {
        if (result.pomodoroDate !== today) {
            chrome.storage.local.set({ pomodoroDate: today, pomodoroCompleted: 0 });
            document.getElementById('pomodoroCompleted').textContent = 0;
        } else {
            document.getElementById('pomodoroCompleted').textContent = result.pomodoroCompleted || 0;
        }
    });
}