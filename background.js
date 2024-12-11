let siteActivityStatus = {};
let pomodoroTime = 30 * 60; // 30 minutes in seconds
let isPomodoroRunning = false;
let pomodoroCompleted = 0;
let strikes = 0;
let confirmationTimeout;
let pomodoroInterval;

function getCurrentDate() {
    return new Date().toLocaleDateString('en-CA'); // Formato YYYY-MM-DD
}

function initializeDailyData(siteName) {
    return {
        totalTime: 0,
        active: false,
        mediaPlaying: false,
        windowFocused: true,
        startTime: Date.now()
    };
}

function loadSiteData(siteName, callback) {
    const currentDate = getCurrentDate();
    chrome.storage.local.get([currentDate], (result) => {
        let dailyData = result[currentDate] || {};
        if (!dailyData[siteName]) {
            dailyData[siteName] = initializeDailyData(siteName);
        }
        siteActivityStatus[siteName] = dailyData[siteName];
        if (callback) callback();
    });
}

function saveSiteData(siteName) {
    const currentDate = getCurrentDate();
    chrome.storage.local.get([currentDate], (result) => {
        let dailyData = result[currentDate] || {};
        dailyData[siteName] = siteActivityStatus[siteName];
        chrome.storage.local.set({ [currentDate]: dailyData });
    });
}

function updateSiteStatus(siteName, isActive, isWindowFocused, hasMedia) {
    loadSiteData(siteName, () => {
        let status = siteActivityStatus[siteName];
        let now = Date.now();
        let shouldCount = isActive || hasMedia || (isWindowFocused && status.active);
        
        if (shouldCount && status.startTime) {
            status.totalTime += now - status.startTime;
        }
        
        status.active = isActive;
        status.mediaPlaying = hasMedia;
        status.windowFocused = isWindowFocused;
        status.startTime = shouldCount ? now : null;
        
        saveSiteData(siteName);
    });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        let url = new URL(tab.url);
        let siteName = url.hostname.replace('www.', '');
        
        loadSiteData(siteName, () => {
            chrome.tabs.sendMessage(tabId, {action: "checkStatus"}, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn("No se pudo conectar con el content script:", chrome.runtime.lastError.message);
                    return;
                }
                if (response) {
                    updateSiteStatus(siteName, response.isActive, response.isWindowFocused, response.hasMedia);
                }
            });
        });
    }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        // El navegador perdió el foco
        Object.keys(siteActivityStatus).forEach(siteName => {
            updateSiteStatus(siteName, false, false, siteActivityStatus[siteName].mediaPlaying);
        });
    } else {
        // El navegador ganó el foco, actualizamos el estado de la pestaña activa
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0] && tabs[0].url) {
                let url = new URL(tabs[0].url);
                let siteName = url.hostname.replace('www.', '');
                chrome.tabs.sendMessage(tabs[0].id, {action: "checkStatus"}, (response) => {
                    if (chrome.runtime.lastError) {
                        console.warn("No se pudo conectar con el content script:", chrome.runtime.lastError.message);
                        return;
                    }
                    if (response) {
                        updateSiteStatus(siteName, response.isActive, true, response.hasMedia);
                    }
                });
            }
        });
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "startPomodoro") {
        startPomodoro(message.duration);
    } else if (message.action === "pausePomodoro") {
        pausePomodoro();
    } else if (message.action === "cancelPomodoro") {
        cancelPomodoro();
    } else if (message.action === "togglePomodoro") {
        if (isPomodoroRunning) {
            pausePomodoro();
        } else {
            startPomodoro();
        }
    } else if (message.action === "getPomodoroStatus") {
        sendResponse({
            time: formatTime(pomodoroTime),
            completed: pomodoroCompleted,
            isRunning: isPomodoroRunning
        });
    } else if (message.action === "updateStatus") {
        let tab = sender.tab;
        if (tab && tab.url) {
            let url = new URL(tab.url);
            let siteName = url.hostname.replace('www.', '');
            updateSiteStatus(siteName, message.isActive, message.isWindowFocused, message.hasMedia);
        }
    } else if (message.action === "getStatus") {
        let siteName = message.siteName;
        loadSiteData(siteName, () => {
            if (siteActivityStatus[siteName]) {
                sendResponse({
                    status: siteActivityStatus[siteName].active || siteActivityStatus[siteName].mediaPlaying ? "activo" : "inactivo",
                    totalTime: siteActivityStatus[siteName].totalTime,
                    date: siteActivityStatus[siteName].date
                });
            } else {
                sendResponse({ status: "desconocido", totalTime: 0, date: getCurrentDate() });
            }
        });
        return true; // Indicates that the response is asynchronous
    } else if (message.action === "checkStatus") {
        sendResponse({
            isActive: siteActivityStatus[siteName].active,
            isWindowFocused: siteActivityStatus[siteName].windowFocused,
            hasMedia: siteActivityStatus[siteName].mediaPlaying
        });
        return true;
    } else if (message.action === "getStats") {
        getStats(message.timeRange).then(sendResponse);
        return true;
    } else if (message.action === "blockSite") {
        blockSite(message.site).then(sendResponse);
        return true;
    } else if (message.action === "unblockSite") {
        unblockSite(message.site).then(sendResponse);
        return true;
    } else if (message.action === "completePomodoro") {
        pomodoroCompleted++;
        savePomodoroCompleted();
        assignPoints();
        calculateAvatarProbability();
        sendResponse({ success: true });
    } else if (message.action === "refreshBlockedSites") {
        // Enviar mensaje a blocklist.js para actualizar la lista de sitios bloqueados
        chrome.runtime.sendMessage({action: "refreshBlockedSites"});
    } else if (message.action === 'updateBlockedSites') {
        const normalizedSite = message.site;
        chrome.storage.local.get(['blockedSites'], function(result) {
            let blockedSites = result.blockedSites || [];
            if (!blockedSites.includes(normalizedSite)) {
                blockedSites.push(normalizedSite);
                chrome.storage.local.set({ blockedSites: blockedSites });
            }
        });
    }
});

// Funciones para bloquear sitios
function normalizeUrl(url) {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.hostname.replace('www.', '');
    } catch (e) {
        // Si la URL no es válida, intentamos limpiarla un poco
        return url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
    }
}

chrome.webNavigation.onBeforeNavigate.addListener(function(details) {
    if (details.frameId !== 0) return; // Solo procesar la navegación principal
    
    const hostname = normalizeUrl(details.url);
    
    chrome.storage.local.get(['blockedSites'], function(result) {
        const blockedSites = result.blockedSites || [];
        if (blockedSites.some(site => hostname.includes(normalizeUrl(site)))) {
            chrome.tabs.update(details.tabId, {url: chrome.runtime.getURL('blocked.html')});
        }
    });
});

async function blockSite(site) {
    const token = await getToken();
    const normalizedSite = normalizeUrl(site);
    const siteData = {
        nombre_pagina: normalizedSite,
        descr_pagina: 'Bloqueado desde la extensión',
        url_pagina: site
    };

    const response = await fetch('http://localhost:4444/api/paginaWeb/bloquearPagina', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(siteData)
    });

    const data = await response.json();
    if (data.msg) {
        const result = await chrome.storage.local.get(['blockedSites']);
        let blockedSites = result.blockedSites || [];
        if (!blockedSites.includes(normalizedSite)) {
            blockedSites.push(normalizedSite);
            await chrome.storage.local.set({blockedSites: blockedSites});
        }
        return {success: true};
    } else {
        console.error('Error blocking site:', data.error);
        return {success: false, error: data.error};
    }
}

async function unblockSite(site) {
    const token = await getToken();
    const normalizedSite = normalizeUrl(site);

    const response = await fetch(`http://localhost:4444/api/paginaWeb/desbloquearPagina/${normalizedSite}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await response.json();
    if (data.msg) {
        const result = await chrome.storage.local.get(['blockedSites']);
        let blockedSites = result.blockedSites || [];
        blockedSites = blockedSites.filter(s => s !== normalizedSite);
        await chrome.storage.local.set({blockedSites: blockedSites});
        return {success: true};
    } else {
        console.error('Error unblocking site:', data.error);
        return {success: false, error: data.error};
    }
}

async function getToken() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['token'], (result) => {
            resolve(result.token);
        });
    });
}

async function getStats(timeRange) {
    const allData = await getAllSiteData();
    const currentDate = new Date();
    let filteredData = {};

    switch(timeRange) {
        case 'daily':
            filteredData = allData[getCurrentDate()] || {};
            break;
        case 'weekly':
            filteredData = getDataForLastNDays(allData, 7);
            break;
        case 'monthly':
            filteredData = getDataForLastNDays(allData, 30);
            break;
        case 'all':
        default:
            filteredData = combineAllData(allData);
    }

    const stats = Object.entries(filteredData).map(([name, data]) => ({
        name,
        totalTime: data.totalTime || 0
    }));

    return stats.sort((a, b) => b.totalTime - a.totalTime);
}

function getDataForLastNDays(allData, n) {
    const result = {};
    const dates = Object.keys(allData).sort().reverse().slice(0, n);
    
    dates.forEach(date => {
        Object.entries(allData[date]).forEach(([site, data]) => {
            if (!result[site]) {
                result[site] = { totalTime: 0 };
            }
            result[site].totalTime += data.totalTime;
        });
    });

    return result;
}

function combineAllData(allData) {
    const result = {};
    
    Object.values(allData).forEach(dailyData => {
        Object.entries(dailyData).forEach(([site, data]) => {
            if (!result[site]) {
                result[site] = { totalTime: 0 };
            }
            result[site].totalTime += data.totalTime;
        });
    });

    return result;
}

function filterDataByDate(data, date) {
    const dateString = date.toISOString().split('T')[0];
    return Object.fromEntries(
        Object.entries(data).map(([site, siteData]) => [
            site,
            Array.isArray(siteData) ? siteData.filter(day => day.date === dateString) : siteData
        ])
    );
}

function filterDataByDateRange(data, startDate, endDate) {
    return Object.fromEntries(
        Object.entries(data).map(([site, siteData]) => [
            site,
            Array.isArray(siteData) ? siteData.filter(day => {
                const dayDate = new Date(day.date);
                return dayDate >= startDate && dayDate <= endDate;
            }) : siteData
        ])
    );
}

async function getAllSiteData() {
    return new Promise((resolve) => {
        chrome.storage.local.get(null, (result) => {
            // Filtramos para obtener solo las entradas con fechas (formato YYYY-MM-DD)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            const filteredResult = Object.fromEntries(
                Object.entries(result).filter(([key]) => dateRegex.test(key))
            );
            resolve(filteredResult);
        });
    });
}

// Actualizar el tiempo total cada segundo
setInterval(() => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0] && tabs[0].url) {
            let url = new URL(tabs[0].url);
            let siteName = url.hostname.replace('www.', '');
            loadSiteData(siteName, () => {
                let status = siteActivityStatus[siteName];
                if (status && (status.active || status.mediaPlaying || status.windowFocused) && status.startTime) {
                    let now = Date.now();
                    status.totalTime += now - status.startTime;
                    status.startTime = now;
                    saveSiteData(siteName);
                }
            });
        }
    });
}, 1000);

// Verificar cambio de día cada minuto
setInterval(() => {
    const currentDate = getCurrentDate();
    Object.keys(siteActivityStatus).forEach(siteName => {
        loadSiteData(siteName);
    });
}, 60000);

function startPomodoro(duration) {
    if (!isPomodoroRunning) {
        isPomodoroRunning = true;
        pomodoroTime = duration || pomodoroTime; // Use the provided duration or the current pomodoroTime
        pomodoroInterval = setInterval(updatePomodoro, 1000);
        chrome.storage.local.set({ pomodoroTime, isPomodoroRunning });
        chrome.runtime.sendMessage({ action: "pomodoroStarted" });
    }
}

function pausePomodoro() {
    if (isPomodoroRunning) {
        isPomodoroRunning = false;
        clearInterval(pomodoroInterval);
        chrome.storage.local.set({ isPomodoroRunning });
        chrome.runtime.sendMessage({ action: "pomodoroPaused" });
    }
}

function cancelPomodoro() {
    isPomodoroRunning = false;
    clearInterval(pomodoroInterval);
    resetPomodoro();
    chrome.storage.local.set({ pomodoroTime, isPomodoroRunning });
    chrome.runtime.sendMessage({ action: "pomodoroCanceled" });
}

function updatePomodoro() {
    if (pomodoroTime <= 0) {
        completePomodoro();
        return;
    }

    if (isPomodoroRunning) {
        pomodoroTime--;
        chrome.storage.local.set({ pomodoroTime });
        chrome.runtime.sendMessage({ action: "pomodoroUpdated", time: formatTime(pomodoroTime) });
    }
}

function completePomodoro() {
    isPomodoroRunning = false;
    clearInterval(pomodoroInterval);
    pomodoroCompleted++;
    savePomodoroCompleted();
    assignPoints();
    calculateAvatarProbability();
    chrome.runtime.sendMessage({ action: "pomodoroCompleted", completed: pomodoroCompleted });
    resetPomodoro();
}

function resetPomodoro() {
    pomodoroTime = 30 * 60; // Reset to 30 minutes
    pausePomodoro();
}

function showConfirmationMessage() {
    clearTimeout(confirmationTimeout);
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon.png',
        title: 'Confirmación de actividad',
        message: `¿Sigues allí? Confirmar (${strikes}/3)`,
        buttons: [{ title: 'Confirmar' }],
        requireInteraction: true
    }, (notificationId) => {
        chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
            if (notifId === notificationId && btnIdx === 0) {
                strikes = 0;
                chrome.notifications.clear(notificationId);
            }
        });

        confirmationTimeout = setTimeout(() => {
            chrome.notifications.clear(notificationId);
            pausePomodoro();
            alert('Pomodoro detenido por inactividad.');
        }, 15000);
    });
}

function savePomodoroCompleted() {
    chrome.storage.local.set({ pomodoroCompleted: pomodoroCompleted });
}

function loadPomodoroCompleted() {
    chrome.storage.local.get(['pomodoroCompleted'], (result) => {
        pomodoroCompleted = result.pomodoroCompleted || 0;
    });
}

function assignPoints() {
    const points = 5; // Asigna puntos por sesión completada
    chrome.storage.local.get(['totalPoints'], (result) => {
        const totalPoints = result.totalPoints || 0;
        chrome.storage.local.set({ totalPoints: totalPoints + points });
    });
}

function calculateAvatarProbability() {
    const probability = 0.1; // Probabilidad de obtener un avatar de rareza baja
    if (Math.random() < probability) {
        alert('¡Has obtenido un avatar de rareza baja!');
    }
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

// Load the pomodoroCompleted counter when the background script starts
loadPomodoroCompleted();