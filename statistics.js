document.addEventListener('DOMContentLoaded', function() {
    const timeRangeSelect = document.getElementById('timeRange');
    const statsContainer = document.getElementById('statsContainer');

    timeRangeSelect.addEventListener('change', updateStats);

    function updateStats() {
        const timeRange = timeRangeSelect.value;
        chrome.runtime.sendMessage({action: "getStats", timeRange: timeRange}, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error al obtener estadísticas:', chrome.runtime.lastError.message);
                return;
            }
            // Ordenar los sitios por tiempo de uso (de mayor a menor)
            response.sort((a, b) => b.totalTime - a.totalTime);
            displayStats(response);
        });
    }

    function displayStats(stats) {
        statsContainer.innerHTML = '';
        stats.forEach(site => {
            const siteElement = document.createElement('div');
            siteElement.className = 'site-stat';
            siteElement.innerHTML = `
                ${site.name}: ${msToTime(site.totalTime)}
                <button class="blockToggle" data-site="${site.name}">
                    ${site.isBlocked ? 'Desbloquear' : 'Bloquear'}
                </button>
            `;
            statsContainer.appendChild(siteElement);
        });

        // Añadir event listeners a los botones
        document.querySelectorAll('.blockToggle').forEach(button => {
            button.addEventListener('click', toggleBlockStatus);
        });
    }

    function toggleBlockStatus(event) {
        const site = event.target.dataset.site;
        const action = event.target.textContent === 'Bloquear' ? 'blockSite' : 'unblockSite';
        
        chrome.runtime.sendMessage({action: action, site: site}, (response) => {
            if (response.success) {
                event.target.textContent = action === 'blockSite' ? 'Desbloquear' : 'Bloquear';
            }
        });
    }

    function msToTime(duration) {
        let seconds = Math.floor((duration / 1000) % 60),
            minutes = Math.floor((duration / (1000 * 60)) % 60),
            hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Cargar estadísticas iniciales
    updateStats();
});