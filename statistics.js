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
            displayStats(response, timeRange);
        });
    }

    function displayStats(stats, timeRange) {
        statsContainer.innerHTML = '';
        
        if (stats.length === 0) {
            statsContainer.innerHTML = '<p>No hay datos para mostrar en este período.</p>';
            return;
        }

        const headerElement = document.createElement('h2');
        headerElement.textContent = getHeaderText(timeRange);
        statsContainer.appendChild(headerElement);

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

    function getHeaderText(timeRange) {
        switch(timeRange) {
            case 'daily':
                return `Uso del día ${getCurrentDate()}`;
            case 'weekly':
                return 'Uso de los últimos 7 días';
            case 'monthly':
                return 'Uso de los últimos 30 días';
            case 'all':
            default:
                return 'Uso total';
        }
    }

    function getCurrentDate() {
        return new Date().toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
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