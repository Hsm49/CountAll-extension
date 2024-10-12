document.addEventListener('DOMContentLoaded', function() {
    const blockForm = document.getElementById('blockForm');
    const siteInput = document.getElementById('siteInput');
    const blockedSitesContainer = document.getElementById('blockedSites');

    loadBlockedSites();

    blockForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const site = siteInput.value.trim();
        if (site) {
            addBlockedSite(site);
            siteInput.value = '';
        }
    });

    function loadBlockedSites() {
        chrome.storage.local.get(['blockedSites'], function(result) {
            const blockedSites = result.blockedSites || [];
            updateBlockedSitesList(blockedSites);
        });
    }

    function normalizeUrl(url) {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.hostname.replace('www.', '');
        } catch (e) {
            // Si la URL no es válida, intentamos limpiarla un poco
            return url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
        }
    }

    function addBlockedSite(site) {
        const normalizedSite = normalizeUrl(site);
        chrome.storage.local.get(['blockedSites'], function(result) {
            let blockedSites = result.blockedSites || [];
            if (!blockedSites.includes(normalizedSite)) {
                blockedSites.push(normalizedSite);
                chrome.storage.local.set({blockedSites: blockedSites}, function() {
                    updateBlockedSitesList(blockedSites);
                });
            }
        });
    }

    function removeBlockedSite(site) {
        chrome.storage.local.get(['blockedSites'], function(result) {
            let blockedSites = result.blockedSites || [];
            blockedSites = blockedSites.filter(s => s !== site);
            chrome.storage.local.set({blockedSites: blockedSites}, function() {
                updateBlockedSitesList(blockedSites);
            });
        });
    }

    function updateBlockedSitesList(sites) {
        blockedSitesContainer.innerHTML = '';
        sites.forEach(site => {
            const siteElement = document.createElement('div');
            siteElement.className = 'site-item';
            siteElement.textContent = site;
            const removeButton = document.createElement('button');
            removeButton.textContent = 'Desbloquear';
            removeButton.onclick = () => removeBlockedSite(site);
            siteElement.appendChild(removeButton);
            blockedSitesContainer.appendChild(siteElement);
        });
    }
});