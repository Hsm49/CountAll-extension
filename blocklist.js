document.addEventListener('DOMContentLoaded', function() {
    const blockForm = document.getElementById('blockForm');
    const siteInput = document.getElementById('siteInput');
    const blockedSitesContainer = document.getElementById('blockedSites');
    const blockAdultSitesCheckbox = document.getElementById('blockAdultSites');

    loadBlockedSites();
    loadBlockAdultSitesOption();

    blockForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const site = siteInput.value.trim();
        if (site) {
            addBlockedSite(site);
            siteInput.value = '';
        }
    });

    blockAdultSitesCheckbox.addEventListener('change', function() {
        const isChecked = blockAdultSitesCheckbox.checked;
        chrome.storage.local.set({ blockAdultSites: isChecked }, function() {
            if (isChecked) {
                addAdultSites();
            } else {
                removeAdultSites();
            }
        });
    });

    function loadBlockedSites() {
        const token = localStorage.getItem('token');
        fetch('http://localhost:4444/api/paginaWeb/verPaginasBloqueadas', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(data => {
            const blockedSites = data.paginas_bloqueadas.map(site => site.url_pagina);
            chrome.storage.local.set({ blockedSites }, function() {
                updateBlockedSitesList(blockedSites);
            });
        })
        .catch(error => console.error('Error fetching blocked sites:', error));
    }

    function loadBlockAdultSitesOption() {
        chrome.storage.local.get(['blockAdultSites'], function(result) {
            const isChecked = result.blockAdultSites || false;
            blockAdultSitesCheckbox.checked = isChecked;
            if (isChecked) {
                addAdultSites();
            }
        });
    }

    function normalizeUrl(url) {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.hostname.replace('www.', '');
        } catch (e) {
            return url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
        }
    }

    function addBlockedSite(site) {
        const token = localStorage.getItem('token');
        const normalizedSite = normalizeUrl(site);
        const siteData = {
            nombre_pagina: normalizedSite,
            descr_pagina: 'Bloqueado desde la extensión',
            url_pagina: site
        };

        fetch('http://localhost:4444/api/paginaWeb/bloquearPagina', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(siteData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.msg) {
                chrome.storage.local.get(['blockedSites'], function(result) {
                    let blockedSites = result.blockedSites || [];
                    if (!blockedSites.includes(normalizedSite)) {
                        blockedSites.push(normalizedSite);
                        chrome.storage.local.set({blockedSites: blockedSites}, function() {
                            updateBlockedSitesList(blockedSites);
                        });
                    }
                });
            } else {
                console.error('Error blocking site:', data.error);
            }
        })
        .catch(error => console.error('Error blocking site:', error));
    }

    function removeBlockedSite(site) {
        const token = localStorage.getItem('token');
        const normalizedSite = normalizeUrl(site);

        fetch(`http://localhost:4444/api/paginaWeb/desbloquearPagina/${normalizedSite}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.msg) {
                chrome.storage.local.get(['blockedSites'], function(result) {
                    let blockedSites = result.blockedSites || [];
                    blockedSites = blockedSites.filter(s => s !== normalizedSite);
                    chrome.storage.local.set({blockedSites: blockedSites}, function() {
                        updateBlockedSitesList(blockedSites);
                    });
                });
            } else {
                console.error('Error unblocking site:', data.error);
            }
        })
        .catch(error => console.error('Error unblocking site:', error));
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

    function addAdultSites() {
        fetch(chrome.runtime.getURL('blocked_sites.json'))
            .then(response => response.json())
            .then(adultSites => {
                adultSites.forEach(site => addBlockedSite(site));
            });
    }

    function removeAdultSites() {
        fetch(chrome.runtime.getURL('blocked_sites.json'))
            .then(response => response.json())
            .then(adultSites => {
                adultSites.forEach(site => removeBlockedSite(site));
            });
    }

    // Escuchar el mensaje para actualizar la lista de sitios bloqueados
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "refreshBlockedSites") {
            loadBlockedSites();
        }
    });
});