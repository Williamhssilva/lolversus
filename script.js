// Constantes
const DDRAGON_BASE_URL = 'https://ddragon.leagueoflegends.com/cdn/';
const API_BASE_URL = 'https://developing-habitual-loaf.glitch.me/api/';
const DEFAULT_IMAGE_PATH = 'caminho/para/imagem/padrao.png';

// Estado global da aplicação
const appState = {
    currentVersion: '13.10.1',
    allChampions: [],
    selectedChampion: null,
    counters: []
};

// Funções de inicialização
async function initializeApplication() {
    try {
        await initializeDataDragon();
        appState.allChampions = await getChampions();
        displayChampions(appState.allChampions);
        setupSearch();
        initializeDragAndDrop();
        initializeModalListeners();
        initializeClearButton();
    } catch (error) {
        console.error('Erro na inicialização da aplicação:', error);
        showErrorMessage('Falha ao inicializar a aplicação. Por favor, recarregue a página.');
    }
}

async function initializeDataDragon() {
    try {
        const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        const versions = await response.json();
        appState.currentVersion = versions[0];
        console.log('Versão atual do Data Dragon:', appState.currentVersion);
    } catch (error) {
        console.error('Erro ao obter a versão do Data Dragon:', error);
        throw error;
    }
}

// Funções de busca de dados
async function getChampions() {
    try {
        const response = await fetch(`${DDRAGON_BASE_URL}${appState.currentVersion}/data/pt_BR/champion.json`);
        const data = await response.json();
        return Object.values(data.data);
    } catch (error) {
        console.error('Erro ao buscar campeões:', error);
        throw error;
    }
}

async function getChampionDetails(championId) {
    if (!championId) {
        throw new Error('ID do campeão não fornecido');
    }
    try {
        const response = await fetch(`${DDRAGON_BASE_URL}${appState.currentVersion}/data/pt_BR/champion/${championId}.json`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.data[championId];
    } catch (error) {
        console.error(`Erro ao buscar detalhes do campeão ${championId}:`, error);
        throw error;
    }
}

async function getCountersForChampion(championName) {
    try {
        const response = await fetch(`${API_BASE_URL}counters/${encodeURIComponent(championName)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Counters recebidos:', data); // Log para debug
        return data.counters || [];
    } catch (error) {
        console.error('Erro ao obter counters:', error);
        return [];
    }
}

// Funções de exibição
function displayChampions(champions) {
    console.log('Campeões a serem exibidos:', champions); // Log para debug
    const championsListDiv = document.getElementById('champions-list');
    championsListDiv.innerHTML = '';
    if (champions.length === 0) {
        championsListDiv.innerHTML = '<p>Nenhum campeão encontrado.</p>';
        return;
    }
    champions.forEach(champion => {
        if (champion && champion.id && champion.name) {
            const championCard = createChampionCard(champion);
            championsListDiv.appendChild(championCard);
        } else {
            console.error('Campeão inválido:', champion);
        }
    });
}

function createChampionCard(champion) {
    const card = document.createElement('div');
    card.className = 'champion-card';
    card.dataset.championId = champion.id;

    const imageSrc = champion.image && champion.image.full
        ? `${DDRAGON_BASE_URL}${appState.currentVersion}/img/champion/${champion.image.full}`
        : DEFAULT_IMAGE_PATH;

    const counterInfo = appState.counters.find(c => c.counter.toLowerCase() === champion.name.toLowerCase());
    const winRate = counterInfo ? (1 - parseFloat(counterInfo.win_rate)).toFixed(4) * 100 : '';
    const winRateDisplay = winRate ? `<p>Taxa de vitória: ${winRate.toFixed(2)}%</p>` : '';

    card.innerHTML = `
        <img src="${imageSrc}" 
             alt="${champion.name}"
             onerror="this.onerror=null; this.src='${DEFAULT_IMAGE_PATH}';">
        <h3>${champion.name}</h3>
        ${winRateDisplay}
    `;
    card.draggable = true;
    card.addEventListener('dragstart', dragStart);
    card.addEventListener('click', () => onChampionClick(champion.id));
    return card;
}

function displayChampionInSlot(champion, slot) {
    const portraitDiv = slot.querySelector('.champion-portrait');
    
    portraitDiv.innerHTML = `<img src="${DDRAGON_BASE_URL}${appState.currentVersion}/img/champion/${champion.image.full}" alt="${champion.name}">`;
    
    slot.dataset.championId = champion.id;
    
    const clearButton = document.getElementById('clear-champion');
    clearButton.classList.remove('hidden');

    // Adiciona o nome do campeão fora do círculo
    let championNameOutside = slot.querySelector('.champion-name-outside');
    if (!championNameOutside) {
        championNameOutside = document.createElement('div');
        championNameOutside.className = 'champion-name-outside';
        slot.appendChild(championNameOutside);
    }
    championNameOutside.textContent = champion.name;
}

async function displayChampionDetails(champion) {
    const modalOverlay = document.getElementById('modal-overlay');
    const championDetails = document.getElementById('champion-details');
    
    championDetails.innerHTML = `
        <div id="champion-header">
            <img src="${DDRAGON_BASE_URL}${appState.currentVersion}/img/champion/${champion.image.full}" alt="${champion.name}">
            <h2>${champion.name}</h2>
            <h3>${champion.title}</h3>
        </div>
        <div id="champion-abilities">
            <div class="ability">
                <img src="${DDRAGON_BASE_URL}${appState.currentVersion}/img/passive/${champion.passive.image.full}" alt="${champion.passive.name}">
                <p>Passiva</p>
            </div>
            ${champion.spells.map((spell, index) => `
                <div class="ability">
                    <img src="${DDRAGON_BASE_URL}${appState.currentVersion}/img/spell/${spell.image.full}" alt="${spell.name}">
                    <p>${['Q', 'W', 'E', 'R'][index]}</p>
                </div>
            `).join('')}
        </div>
        <div id="champion-lore">
            <h3>História</h3>
            <p>${champion.lore}</p>
        </div>
    `;

    modalOverlay.classList.remove('hidden');
}

// Funções de interação
function setupSearch() {
    const searchInput = document.getElementById('champion-search');
    searchInput.addEventListener('input', function () {
        const searchTerm = this.value.toLowerCase();
        const filteredChampions = appState.allChampions.filter(champion =>
            champion.name.toLowerCase().includes(searchTerm)
        );
        displayChampions(filteredChampions);
    });
}

function initializeDragAndDrop() {
    const dropZone = document.getElementById('champion-drop');
    dropZone.addEventListener('dragover', dragOver);
    dropZone.addEventListener('dragleave', dragLeave);
    dropZone.addEventListener('drop', drop);
}

function dragStart(e) {
    const championCard = e.target.closest('.champion-card');
    if (championCard) {
        const championId = championCard.dataset.championId;
        if (championId) {
            e.dataTransfer.setData('text/plain', championId);
            console.log('ID do campeão arrastado:', championId); // Log para debug
        } else {
            console.error('ID do campeão não encontrado no elemento arrastado');
        }
    } else {
        console.error('Elemento .champion-card não encontrado');
    }
}

function dragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function dragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

async function drop(e) {
    e.preventDefault();
    const dropZone = e.currentTarget;
    dropZone.classList.remove('drag-over');

    const championId = e.dataTransfer.getData('text/plain');
    console.log('ID do campeão recebido no drop:', championId); // Log para debug

    if (!championId) {
        console.error('ID do campeão não encontrado');
        showErrorMessage('Erro ao arrastar o campeão. Por favor, tente novamente.');
        return;
    }

    try {
        const champion = await getChampionDetails(championId);
        if (champion) {
            appState.selectedChampion = champion;
            displayChampionInSlot(champion, dropZone);
            appState.counters = await getCountersForChampion(champion.name);
            console.log('Counters obtidos:', appState.counters);
            if (appState.counters.length > 0) {
                const counterChampions = appState.allChampions.filter(c => 
                    appState.counters.some(counter => counter.counter.toLowerCase() === c.name.toLowerCase())
                );
                console.log('Campeões counter filtrados:', counterChampions);
                displayChampions(counterChampions);
            } else {
                console.log('Nenhum counter encontrado, exibindo todos os campeões');
                displayChampions(appState.allChampions);
                showErrorMessage('Nenhum counter encontrado para este campeão.');
            }
        } else {
            throw new Error('Detalhes do campeão não encontrados');
        }
    } catch (error) {
        console.error('Erro ao obter detalhes do campeão:', error);
        dropZone.innerHTML = '<p>Erro ao carregar campeão</p>';
        showErrorMessage('Erro ao carregar o campeão. Por favor, tente novamente.');
    }
}

async function onChampionClick(championId) {
    try {
        const champion = await getChampionDetails(championId);
        if (champion) {
            await displayChampionDetails(champion);
        } else {
            throw new Error('Detalhes do campeão não encontrados');
        }
    } catch (error) {
        console.error('Erro ao obter detalhes do campeão:', error);
        showErrorMessage('Não foi possível carregar os detalhes do campeão. Tente novamente mais tarde.');
    }
}

function clearChampionSlot() {
    const slot = document.getElementById('champion-drop');
    slot.innerHTML = `
        <div class="champion-portrait">
            <p>Arraste um campeão aqui</p>
        </div>
    `;
    slot.dataset.championId = '';
    appState.selectedChampion = null;
    appState.counters = [];
    displayChampions(appState.allChampions);

    const clearButton = document.getElementById('clear-champion');
    clearButton.classList.add('hidden');

    // Remove o nome do campeão fora do círculo
    const championNameOutside = slot.querySelector('.champion-name-outside');
    if (championNameOutside) {
        championNameOutside.remove();
    }
}

function initializeClearButton() {
    const clearButton = document.getElementById('clear-champion');
    clearButton.addEventListener('click', clearChampionSlot);
}

function initializeModalListeners() {
    const modalOverlay = document.getElementById('modal-overlay');
    modalOverlay.addEventListener('click', function(event) {
        if (event.target === modalOverlay) {
            closeChampionDetails();
        }
    });
}

function closeChampionDetails() {
    const modalOverlay = document.getElementById('modal-overlay');
    modalOverlay.classList.add('hidden');
}

function showErrorMessage(message) {
    alert(message); // Simplificado para usar um alerta básico
}

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', initializeApplication);