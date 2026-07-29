// State Management
let currentState = {
    activeTab: 'dashboard',
    searchQuery: '',
    selectedPosition: 'ALL',
    selectedClub: 'ALL',
    selectedNationality: 'ALL',
    minOverall: 70,
    currentPage: 1,
    totalPages: 1,
    activeComparisonSlot: 0,
    comparePlayers: [null, null, null], // Max 3 players
    activeK: 4
};

// Chart instances
let radarChartInstance = null;
let compareRadarChartInstance = null;
let scatterChartInstance = null;

// Color schemes for clusters and players
const clusterColors = [
    '#ff1744', // Red Accent
    '#00e5ff', // Cyan
    '#00e676', // Emerald Green
    '#ffd700', // Gold
    '#d500f9', // Neon Purple
    '#ff6d00'  // Electric Orange
];

const compareColors = [
    { border: '#00e5ff', bg: 'rgba(0, 229, 255, 0.15)' }, // Player 1 (Cyan)
    { border: '#00e676', bg: 'rgba(0, 230, 118, 0.15)' }, // Player 2 (Emerald)
    { border: '#ffd700', bg: 'rgba(255, 215, 0, 0.15)' }  // Player 3 (Gold)
];

// Run on page load
document.addEventListener("DOMContentLoaded", () => {
    loadFilters();
    loadPlayers();
});

// Tab Navigation
function switchTab(tabId) {
    currentState.activeTab = tabId;
    
    // Update navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    if (tabId === 'dashboard') document.getElementById('btn-dashboard').classList.add('active');
    if (tabId === 'comparison') document.getElementById('btn-comparison').classList.add('active');
    if (tabId === 'clustering') document.getElementById('btn-clustering').classList.add('active');
    
    // Update tab content panes
    document.querySelectorAll('.tab-content').forEach(pane => pane.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    // Load clustering data when entering clustering lab
    if (tabId === 'clustering' && !scatterChartInstance) {
        runClustering();
    }
}

// Load Dropdown Filters on Startup
async function loadFilters() {
    try {
        const response = await fetch('/api/filters');
        const data = await response.json();
        
        const posSelect = document.getElementById('filter-position');
        const clubSelect = document.getElementById('filter-club');
        const natSelect = document.getElementById('filter-nationality');
        
        // Load positions
        data.positions.forEach(pos => {
            const opt = document.createElement('option');
            opt.value = pos;
            opt.textContent = pos;
            posSelect.appendChild(opt);
        });
        
        // Load clubs
        data.clubs.forEach(club => {
            const opt = document.createElement('option');
            opt.value = club;
            opt.textContent = club;
            clubSelect.appendChild(opt);
        });
        
        // Load nationalities
        data.nationalities.forEach(nat => {
            const opt = document.createElement('option');
            opt.value = nat;
            opt.textContent = nat;
            natSelect.appendChild(opt);
        });
    } catch (e) {
        console.error("Error loading filter dropdowns:", e);
    }
}

// Load Players Grid (Dashboard Tab)
let searchTimeout;
function triggerSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentState.currentPage = 1;
        loadPlayers();
    }, 300);
}

function updateOverallLabel(val) {
    document.getElementById('overall-val').textContent = val;
    currentState.minOverall = parseInt(val);
    triggerSearch();
}

async function loadPlayers() {
    const grid = document.getElementById('players-grid');
    grid.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';
    
    currentState.searchQuery = document.getElementById('search-input').value;
    currentState.selectedPosition = document.getElementById('filter-position').value;
    currentState.selectedClub = document.getElementById('filter-club').value;
    currentState.selectedNationality = document.getElementById('filter-nationality').value;
    
    const params = new URLSearchParams({
        search: currentState.searchQuery,
        position: currentState.selectedPosition,
        club: currentState.selectedClub,
        nationality: currentState.selectedNationality,
        min_overall: currentState.minOverall,
        page: currentState.currentPage,
        per_page: 12
    });
    
    try {
        const response = await fetch(`/api/players?${params.toString()}`);
        const data = await response.json();
        
        grid.innerHTML = '';
        
        if (data.players.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); margin-top: 2rem;">No players found matching your criteria.</p>';
            document.getElementById('pagination-prev').disabled = true;
            document.getElementById('pagination-next').disabled = true;
            document.getElementById('pagination-info').textContent = 'Page 0 of 0';
            return;
        }
        
        data.players.forEach(p => {
            let rarity = 'bronze-rarity';
            let overallColor = 'bronze';
            if (p.overall >= 80) {
                rarity = 'gold-rarity';
                overallColor = 'gold';
            } else if (p.overall >= 70) {
                rarity = 'silver-rarity';
                overallColor = 'silver';
            }
            
            const card = document.createElement('div');
            card.className = `player-card ${rarity}`;
            card.innerHTML = `
                <div class="card-top">
                    <span class="card-badge">${p.player_positions.split(',')[0]}</span>
                    <div class="overall-badge ${overallColor}">
                        <span>${p.overall}</span>
                        <span class="overall-label">OVR</span>
                    </div>
                </div>
                <div class="card-middle">
                    <h3 class="player-name">${p.short_name}</h3>
                    <div class="player-club-nation">
                        <span>${p.club}</span>
                        <span class="dot-separator"></span>
                        <span>${p.nationality}</span>
                    </div>
                </div>
                <div class="card-stats">
                    <div class="stat-item">
                        <span class="stat-val">${p.pace || p.gk_diving}</span>
                        <span class="stat-name">${p.pace ? 'PAC' : 'DIV'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-val">${p.shooting || p.gk_handling}</span>
                        <span class="stat-name">${p.shooting ? 'SHO' : 'HAN'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-val">${p.passing || p.gk_kicking}</span>
                        <span class="stat-name">${p.passing ? 'PAS' : 'KIC'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-val">${p.dribbling || p.gk_reflexes}</span>
                        <span class="stat-name">${p.dribbling ? 'DRI' : 'REF'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-val">${p.defending || p.gk_speed}</span>
                        <span class="stat-name">${p.defending ? 'DEF' : 'SPD'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-val">${p.physic || p.gk_positioning}</span>
                        <span class="stat-name">${p.physic ? 'PHY' : 'POS'}</span>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="card-btn" onclick="openPlayerDetails('${p.id}'); event.stopPropagation();">
                        <i class="fa-solid fa-circle-info"></i> Details
                    </button>
                    <button class="card-btn" onclick="addPlayerToCompareDirectly('${p.id}'); event.stopPropagation();">
                        <i class="fa-solid fa-code-compare"></i> Compare
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });
        
        // Update pagination
        currentState.totalPages = data.total_pages;
        document.getElementById('pagination-prev').disabled = currentState.currentPage === 1;
        document.getElementById('pagination-next').disabled = currentState.currentPage === data.total_pages;
        document.getElementById('pagination-info').textContent = `Page ${currentState.currentPage} of ${data.total_pages}`;
        
    } catch (e) {
        console.error("Error loading players:", e);
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-danger); margin-top: 2rem;">Error communicating with backend API.</p>';
    }
}

function changePage(direction) {
    currentState.currentPage += direction;
    loadPlayers();
    document.querySelector('main').scrollIntoView({ behavior: 'smooth' });
}

// Player Details Modal (Radar Chart)
async function openPlayerDetails(playerId) {
    const modal = document.getElementById('detail-modal');
    modal.classList.add('active');
    
    const content = document.getElementById('modal-grid-content');
    content.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 4rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2.5rem; color: var(--color-cyan);"></i></div>';
    
    try {
        const response = await fetch(`/api/players/${playerId}`);
        const player = await response.json();
        
        let rarityClass = 'bronze';
        if (player.overall >= 80) rarityClass = 'gold';
        else if (player.overall >= 70) rarityClass = 'silver';
        
        // Convert traits string into tags
        let traitsHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No special traits listed</p>';
        if (player.player_traits) {
            const traits = player.player_traits.split(',').map(t => t.trim());
            traitsHTML = traits.map(t => `<span class="trait-tag">${t}</span>`).join('');
        }
        
        content.innerHTML = `
            <div class="modal-profile-card ${rarityClass}">
                <div class="detail-overall ${rarityClass}">${player.overall}</div>
                <h2 class="detail-name">${player.short_name}</h2>
                <p style="color: var(--text-secondary); font-weight: 700; margin-bottom: 1rem; text-transform: uppercase;">${player.player_positions}</p>
                
                <div style="width: 100%; text-align: left; display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem;">
                    <div class="detail-bio-item"><strong>Club:</strong> <span>${player.club}</span></div>
                    <div class="detail-bio-item"><strong>Nationality:</strong> <span>${player.nationality}</span></div>
                    <div class="detail-bio-item"><strong>Age:</strong> <span>${player.age} years old</span></div>
                    <div class="detail-bio-item"><strong>Height / Weight:</strong> <span>${player.height_cm} cm / ${player.weight_kg} kg</span></div>
                    <div class="detail-bio-item"><strong>Foot:</strong> <span>${player.preferred_foot}</span></div>
                    <div class="detail-bio-item"><strong>Value:</strong> <span class="text-cyan">€${(player.value_eur/1e6).toFixed(1)}M</span></div>
                    <div class="detail-bio-item"><strong>Wage:</strong> <span class="text-emerald">€${(player.wage_eur/1e3).toFixed(1)}K / wk</span></div>
                </div>
                
                <div class="detail-traits-box">
                    <h4>Player Traits</h4>
                    <div style="margin-top: 0.5rem;">${traitsHTML}</div>
                </div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                <div class="detail-tabs-nav">
                    <button class="detail-tab-btn active" id="modal-tab-radar" onclick="switchModalTab('radar')">Attributes Radar</button>
                    <button class="detail-tab-btn" id="modal-tab-stats" onclick="switchModalTab('stats')">Skill Breakdown</button>
                    <button class="detail-tab-btn" id="modal-tab-similar" onclick="switchModalTab('similar')">Similar Players</button>
                </div>
                
                <!-- Tab Pane 1: Radar Chart -->
                <div class="detail-tab-pane active" id="modal-pane-radar">
                    <div class="radar-chart-container">
                        <canvas id="player-radar-chart"></canvas>
                    </div>
                </div>
                
                <!-- Tab Pane 2: Stats bars -->
                <div class="detail-tab-pane" id="modal-pane-stats">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; max-height: 400px; overflow-y: auto; padding-right: 0.5rem;">
                        <div class="stat-bar-group">
                            <h4 style="font-family: var(--font-heading); font-size: 0.9rem; text-transform: uppercase; color: var(--color-cyan);">Outfield Capabilities</h4>
                            ${createStatBarHTML('Pace', player.pace)}
                            ${createStatBarHTML('Shooting', player.shooting)}
                            ${createStatBarHTML('Passing', player.passing)}
                            ${createStatBarHTML('Dribbling', player.dribbling)}
                            ${createStatBarHTML('Defending', player.defending)}
                            ${createStatBarHTML('Physicality', player.physic)}
                        </div>
                        <div class="stat-bar-group">
                            <h4 style="font-family: var(--font-heading); font-size: 0.9rem; text-transform: uppercase; color: var(--color-gold);">Goalkeeping Capabilities</h4>
                            ${createStatBarHTML('GK Diving', player.gk_diving)}
                            ${createStatBarHTML('GK Handling', player.gk_handling)}
                            ${createStatBarHTML('GK Kicking', player.gk_kicking)}
                            ${createStatBarHTML('GK Reflexes', player.gk_reflexes)}
                            ${createStatBarHTML('GK Speed', player.gk_speed)}
                            ${createStatBarHTML('GK Positioning', player.gk_positioning)}
                        </div>
                    </div>
                </div>
                
                <!-- Tab Pane 3: Similar Players -->
                <div class="detail-tab-pane" id="modal-pane-similar">
                    <div class="similar-grid">
                        ${player.similar_players.map(p => `
                            <div class="similar-item" onclick="openPlayerDetails('${p.id}')">
                                <div>
                                    <h4 style="font-weight: 700;">${p.short_name}</h4>
                                    <span style="font-size: 0.8rem; color: var(--text-secondary);">${p.club} • ${p.player_positions.split(',')[0]}</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <span class="card-badge" style="background: rgba(0,229,255,0.08); border-color: rgba(0,229,255,0.25); color: var(--color-cyan);">${p.overall} OVR</span>
                                    <span style="font-size: 0.8rem; color: var(--text-muted);">Match: ${Math.round((1 - (p.distance / 15)) * 100)}%</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        // Calculate the aggregate categories for radar chart
        const s = player.radar_stats;
        
        const avg = arr => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
        
        const categories = {
            'Attacking': avg(Object.values(s.attacking)),
            'Skill': avg(Object.values(s.skill)),
            'Movement': avg(Object.values(s.movement)),
            'Power': avg(Object.values(s.power)),
            'Mentality': avg(Object.values(s.mentality)),
            'Defending': avg(Object.values(s.defending)),
            'Goalkeeping': avg(Object.values(s.goalkeeping))
        };
        
        // Initialize Radar Chart
        setTimeout(() => {
            const ctx = document.getElementById('player-radar-chart').getContext('2d');
            if (radarChartInstance) {
                radarChartInstance.destroy();
            }
            radarChartInstance = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: Object.keys(categories),
                    datasets: [{
                        label: player.short_name,
                        data: Object.values(categories),
                        backgroundColor: 'rgba(0, 229, 255, 0.2)',
                        borderColor: '#00e5ff',
                        borderWidth: 2,
                        pointBackgroundColor: '#00e5ff',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: '#00e5ff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        r: {
                            angleLines: { color: 'rgba(255, 255, 255, 0.08)' },
                            grid: { color: 'rgba(255, 255, 255, 0.08)' },
                            pointLabels: { color: '#9ca3af', font: { family: 'Outfit', size: 11, weight: 'bold' } },
                            ticks: { display: false },
                            min: 0,
                            max: 100
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }, 100);
        
    } catch (e) {
        console.error("Error loading player details:", e);
        content.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-danger); padding: 4rem;">Failed to retrieve player attributes.</p>';
    }
}

function createStatBarHTML(label, val) {
    return `
        <div class="stat-bar-item">
            <div class="stat-bar-header">
                <span class="stat-bar-label">${label}</span>
                <span class="stat-bar-val">${val}</span>
            </div>
            <div class="stat-bar-container">
                <div class="stat-bar-fill" style="width: ${val}%"></div>
            </div>
        </div>
    `;
}

function switchModalTab(tab) {
    document.querySelectorAll('.detail-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`modal-tab-${tab}`).classList.add('active');
    
    document.querySelectorAll('.detail-tab-pane').forEach(pane => pane.classList.remove('active'));
    document.getElementById(`modal-pane-${tab}`).classList.add('active');
}

function closeModal() {
    document.getElementById('detail-modal').classList.remove('active');
}

// Comparison Arena Logic
function openCompareSearch(slotIdx) {
    currentState.activeComparisonSlot = slotIdx;
    document.getElementById('compare-search-modal').style.display = 'flex';
    document.getElementById('compare-search-input').value = '';
    document.getElementById('compare-search-results').innerHTML = '<p style="color: var(--text-muted); text-align: center; margin-top: 2rem;">Start typing to search...</p>';
    document.getElementById('compare-search-input').focus();
}

function closeCompareSearch() {
    document.getElementById('compare-search-modal').style.display = 'none';
}

async function searchComparisonPlayers(query) {
    const resultsDiv = document.getElementById('compare-search-results');
    if (!query || query.trim().length < 2) {
        resultsDiv.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin-top: 2rem;">Type at least 2 characters...</p>';
        return;
    }
    
    try {
        const response = await fetch(`/api/players?search=${encodeURIComponent(query)}&per_page=5`);
        const data = await response.json();
        
        resultsDiv.innerHTML = '';
        if (data.players.length === 0) {
            resultsDiv.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin-top: 2rem;">No matching players found.</p>';
            return;
        }
        
        data.players.forEach(p => {
            const item = document.createElement('div');
            item.className = 'compare-search-item';
            item.innerHTML = `
                <div>
                    <h4 style="font-weight: 700;">${p.short_name}</h4>
                    <span style="font-size: 0.8rem; color: var(--text-secondary);">${p.club} • ${p.player_positions.split(',')[0]}</span>
                </div>
                <span class="card-badge" style="background: rgba(0,229,255,0.08); border-color: rgba(0,229,255,0.25); color: var(--color-cyan);">${p.overall} OVR</span>
            `;
            item.onclick = () => selectComparePlayer(p.id);
            resultsDiv.appendChild(item);
        });
    } catch (e) {
        console.error(e);
    }
}

async function selectComparePlayer(playerId) {
    closeCompareSearch();
    
    try {
        const response = await fetch(`/api/players/${playerId}`);
        const player = await response.json();
        
        currentState.comparePlayers[currentState.activeComparisonSlot] = player;
        renderCompareSlots();
        updateComparisonDetails();
    } catch (e) {
        console.error(e);
    }
}

function addPlayerToCompareDirectly(playerId) {
    // Find first empty slot, or overwrite slot 0
    let emptySlot = currentState.comparePlayers.findIndex(p => p === null);
    if (emptySlot === -1) emptySlot = 0;
    
    currentState.activeComparisonSlot = emptySlot;
    selectComparePlayer(playerId);
    
    // Switch to comparison tab
    switchTab('comparison');
}

function renderCompareSlots() {
    for (let i = 0; i < 3; i++) {
        const slot = document.getElementById(`compare-slot-${i}`);
        const p = currentState.comparePlayers[i];
        
        if (p) {
            let rarity = 'bronze';
            if (p.overall >= 80) rarity = 'gold';
            else if (p.overall >= 70) rarity = 'silver';
            
            slot.className = `compare-slot player-card ${rarity}-rarity`;
            slot.style.borderStyle = 'solid';
            slot.innerHTML = `
                <button class="modal-close" style="position: absolute; top: 0.5rem; right: 0.5rem; width: 26px; height: 26px; font-size: 0.75rem;" onclick="removeComparePlayer(${i}); event.stopPropagation();">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <div class="card-top" style="width:100%">
                    <span class="card-badge">${p.player_positions.split(',')[0]}</span>
                    <span class="card-badge" style="font-weight:800; color:var(--color-${rarity})">${p.overall}</span>
                </div>
                <h3 style="margin-top: 1rem; font-size: 1.25rem;">${p.short_name}</h3>
                <p style="color: var(--text-secondary);">${p.club}</p>
                <div style="display:flex; gap:0.5rem; margin-top:1.5rem; width:100%">
                    <button class="card-btn" style="padding: 0.4rem; font-size: 0.75rem;" onclick="openPlayerDetails('${p.id}'); event.stopPropagation();">Details</button>
                    <button class="card-btn" style="padding: 0.4rem; font-size: 0.75rem;" onclick="openCompareSearch(${i}); event.stopPropagation();">Change</button>
                </div>
            `;
        } else {
            slot.className = 'compare-slot';
            slot.style.borderStyle = 'dashed';
            slot.innerHTML = `
                <i class="fa-solid fa-user-plus"></i>
                <h3>Add Player ${i+1}</h3>
                <p>Click to search and select</p>
            `;
        }
    }
}

function removeComparePlayer(idx) {
    currentState.comparePlayers[idx] = null;
    renderCompareSlots();
    updateComparisonDetails();
}

function updateComparisonDetails() {
    const resultsContainer = document.getElementById('comparison-results');
    
    // Check if we have at least 1 player selected to compare
    const activeCompareList = currentState.comparePlayers.filter(p => p !== null);
    
    if (activeCompareList.length < 2) {
        resultsContainer.style.display = 'none';
        return;
    }
    
    resultsContainer.style.display = 'block';
    
    // Draw radar chart comparisons
    const avg = arr => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    
    const datasets = activeCompareList.map((p, idx) => {
        const s = p.radar_stats;
        const categories = {
            'Attacking': avg(Object.values(s.attacking)),
            'Skill': avg(Object.values(s.skill)),
            'Movement': avg(Object.values(s.movement)),
            'Power': avg(Object.values(s.power)),
            'Mentality': avg(Object.values(s.mentality)),
            'Defending': avg(Object.values(s.defending)),
            'Goalkeeping': avg(Object.values(s.goalkeeping))
        };
        
        const colors = compareColors[idx];
        return {
            label: p.short_name,
            data: Object.values(categories),
            backgroundColor: colors.bg,
            borderColor: colors.border,
            borderWidth: 2.5,
            pointBackgroundColor: colors.border,
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: colors.border
        };
    });
    
    setTimeout(() => {
        const ctx = document.getElementById('comparison-radar-chart').getContext('2d');
        if (compareRadarChartInstance) {
            compareRadarChartInstance.destroy();
        }
        
        compareRadarChartInstance = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Attacking', 'Skill', 'Movement', 'Power', 'Mentality', 'Defending', 'Goalkeeping'],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: { color: 'rgba(255, 255, 255, 0.08)' },
                        grid: { color: 'rgba(255, 255, 255, 0.08)' },
                        pointLabels: { color: '#9ca3af', font: { family: 'Outfit', size: 11, weight: 'bold' } },
                        ticks: { display: false },
                        min: 0,
                        max: 100
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#f3f4f6', font: { family: 'Outfit', size: 12, weight: 'bold' } }
                    }
                }
            }
        });
    }, 100);
    
    // Build stats table
    const headersTr = document.getElementById('comparison-headers');
    headersTr.innerHTML = '<th style="text-align: left;">Player Stat</th>';
    
    activeCompareList.forEach(p => {
        headersTr.innerHTML += `<th>${p.short_name}</th>`;
    });
    
    // Add spacer th if we have less than 3 players
    for (let k = activeCompareList.length; k < 3; k++) {
        headersTr.innerHTML += '<th>-</th>';
    }
    
    const tbody = document.getElementById('comparison-tbody');
    tbody.innerHTML = '';
    
    // Standard rows to compare
    const tableStats = [
        { label: 'Overall Rating', key: 'overall' },
        { label: 'Potential Rating', key: 'potential' },
        { label: 'Market Value (M)', key: 'value_eur', format: val => `€${(val/1e6).toFixed(1)}M` },
        { label: 'Weekly Wage (K)', key: 'wage_eur', format: val => `€${(val/1e3).toFixed(1)}K` },
        { label: 'Age', key: 'age' },
        { label: 'Height (cm)', key: 'height_cm' },
        { label: 'Weight (kg)', key: 'weight_kg' },
        { label: 'Pace', key: 'pace' },
        { label: 'Shooting', key: 'shooting' },
        { label: 'Passing', key: 'passing' },
        { label: 'Dribbling', key: 'dribbling' },
        { label: 'Defending', key: 'defending' },
        { label: 'Physicality', key: 'physic' }
    ];
    
    tableStats.forEach(stat => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="stat-label-td">${stat.label}</td>`;
        
        // Find max value in active list to highlight winner
        let maxVal = -1;
        let maxIdx = -1;
        
        activeCompareList.forEach((p, idx) => {
            const rawVal = p[stat.key];
            if (rawVal > maxVal) {
                maxVal = rawVal;
                maxIdx = idx;
            }
        });
        
        activeCompareList.forEach((p, idx) => {
            const rawVal = p[stat.key];
            const formatted = stat.format ? stat.format(rawVal) : rawVal;
            const highlightClass = (idx === maxIdx && activeCompareList.length > 1) ? 'class="highlight-winner"' : '';
            tr.innerHTML += `<td ${highlightClass}>${formatted}</td>`;
        });
        
        // Add spacer columns
        for (let k = activeCompareList.length; k < 3; k++) {
            tr.innerHTML += '<td>-</td>';
        }
        
        tbody.appendChild(tr);
    });
}

// Clustering Laboratory Logic
async function runClustering() {
    const k = document.getElementById('cluster-k-select').value;
    currentState.activeK = parseInt(k);
    
    const loadingDiv = document.getElementById('clustering-loading');
    loadingDiv.style.display = 'flex';
    
    try {
        const response = await fetch(`/api/clustering?k=${currentState.activeK}`);
        const data = await response.json();
        
        loadingDiv.style.display = 'none';
        
        // Populate profiles panel
        const profilesContainer = document.getElementById('cluster-cards');
        profilesContainer.innerHTML = '';
        
        data.summaries.forEach((summary, idx) => {
            const card = document.createElement('div');
            card.className = 'cluster-summary-card';
            card.style.borderLeftColor = clusterColors[idx];
            card.innerHTML = `
                <h4 style="color: ${clusterColors[idx]}">Cluster ${idx + 1}</h4>
                <p><strong>Players Count:</strong> ${summary.size}</p>
                <p><strong>Avg Overall:</strong> ${summary.avg_overall}</p>
                <p><strong>Avg Value:</strong> €${summary.avg_value}M</p>
                <p><strong>Avg Age:</strong> ${summary.avg_age} yrs</p>
                <p><strong>Core Positions:</strong> ${summary.top_positions}</p>
                <p><strong>Star Players:</strong> ${summary.top_players}</p>
            `;
            profilesContainer.appendChild(card);
        });
        
        // Render scatter plot using Chart.js
        renderScatterPlot(data.points);
    } catch (e) {
        console.error(e);
        loadingDiv.style.display = 'none';
    }
}

function renderScatterPlot(points) {
    const ctx = document.getElementById('clustering-scatter-chart').getContext('2d');
    if (scatterChartInstance) {
        scatterChartInstance.destroy();
    }
    
    // Group datasets by cluster
    const datasets = [];
    for (let c = 0; c < currentState.activeK; c++) {
        datasets.push({
            label: `Cluster ${c + 1}`,
            data: [],
            backgroundColor: clusterColors[c],
            pointRadius: 4.5,
            pointHoverRadius: 7,
            borderWidth: 0
        });
    }
    
    points.forEach(pt => {
        datasets[pt.cluster].data.push({
            x: pt.x,
            y: pt.y,
            id: pt.id,
            name: pt.name,
            club: pt.club,
            overall: pt.overall,
            position: pt.position
        });
    });
    
    scatterChartInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.04)' },
                    title: { display: true, text: 'Principal Component 1 (PCA 1)', color: '#9ca3af', font: { family: 'Outfit', weight: 'bold' } },
                    ticks: { color: '#6b7280' }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.04)' },
                    title: { display: true, text: 'Principal Component 2 (PCA 2)', color: '#9ca3af', font: { family: 'Outfit', weight: 'bold' } },
                    ticks: { color: '#6b7280' }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#f3f4f6', font: { family: 'Outfit', size: 11, weight: 'bold' } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const p = context.raw;
                            return [
                                `Name: ${p.name}`,
                                `Overall: ${p.overall} OVR`,
                                `Position: ${p.position.split(',')[0]}`,
                                `Club: ${p.club}`
                            ];
                        }
                    }
                }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const datasetIdx = elements[0].datasetIndex;
                    const index = elements[0].index;
                    const player = scatterChartInstance.data.datasets[datasetIdx].data[index];
                    openPlayerDetails(player.id);
                }
            }
        }
    });
}
