const APP_VERSION = '1.0.3';
const CONFIG_STORAGE_KEY = 'pile-generator-config';

const defaultConfig = {
	grid: {
		columns: 7,
		rows: 7,
		xAxisLabels: ['1', '2', '3', '4', '5', '6', '7'],
		yAxisLabels: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
	},
	generation: {
		minObjects: 4,
		maxObjects: 8,
		maxEnemies: 2,
	},
	resources: [
		{ id: 'green', name: 'Grün', color: '#2ecc71', weight: 1 },
		{ id: 'orange', name: 'Orange', color: '#e67e22', weight: 1 },
		{ id: 'yellow', name: 'Gelb', color: '#f1c40f', weight: 1 },
		{ id: 'purple', name: 'Lila', color: '#9b59b6', weight: 1 },
		{ id: 'blue', name: 'Blau', color: '#3498db', weight: 1 },
	],
	enemies: [
		{ id: 'pirate', name: 'Pirat', icon: 'img/skull-solid-full.svg' },
		{ id: 'monster', name: 'Monster', icon: 'img/alien-solid-full.svg' },
	],
};

const config = structuredClone(defaultConfig);

const boardElement = document.querySelector('#board');
const resultsElement = document.querySelector('#results-list');
const objectCountElement = document.querySelector('#object-count');
const enemyLimitElement = document.querySelector('#enemy-limit');
const rollNumberElement = document.querySelector('#roll-number');
const rerollButton = document.querySelector('#reroll-button');
const settingsButton = document.querySelector('#settings-button');
const closeSettingsButton = document.querySelector('#close-settings-button');
const settingsView = document.querySelector('#settings-view');
const workspaceElement = document.querySelector('.workspace');
const introElement = document.querySelector('.intro');
const configEditor = document.querySelector('#config-editor');
const configMessage = document.querySelector('#config-message');
const applyConfigButton = document.querySelector('#apply-config-button');
const resetConfigButton = document.querySelector('#reset-config-button');
const configGridStat = document.querySelector('#config-grid-stat');
const configObjectStat = document.querySelector('#config-object-stat');
const configEnemyStat = document.querySelector('#config-enemy-stat');
const versionElement = document.querySelector('#app-version');
let rollNumber = 0;

versionElement.textContent = `v${APP_VERSION}`;

function formatConfig() {
	configEditor.value = JSON.stringify(config, null, 2);
}

function validateConfig(candidate) {
	const grid = candidate.grid;
	const generation = candidate.generation;
	if (!grid || !generation || !Array.isArray(candidate.resources) || !Array.isArray(candidate.enemies)) {
		throw new Error('grid, generation, resources und enemies werden benötigt.');
	}
	if (!Number.isInteger(grid.columns) || !Number.isInteger(grid.rows) || grid.columns < 1 || grid.rows < 1) {
		throw new Error('columns und rows müssen positive ganze Zahlen sein.');
	}
	if (!Array.isArray(grid.xAxisLabels) || !Array.isArray(grid.yAxisLabels) || grid.xAxisLabels.length !== grid.columns || grid.yAxisLabels.length !== grid.rows) {
		throw new Error('Die Achsenlabels müssen zur Rastergröße passen.');
	}
	if (!Number.isInteger(generation.minObjects) || !Number.isInteger(generation.maxObjects) || generation.minObjects < 0 || generation.maxObjects < generation.minObjects || generation.maxObjects > grid.columns * grid.rows) {
		throw new Error('minObjects und maxObjects müssen gültige Rastergrenzen bilden.');
	}
	if (!Number.isInteger(generation.maxEnemies) || generation.maxEnemies < 0) {
		throw new Error('maxEnemies muss eine positive ganze Zahl oder 0 sein.');
	}
	if (candidate.resources.length === 0 || candidate.enemies.length === 0) {
		throw new Error('Mindestens eine Ressource und ein Gegner werden benötigt.');
	}
	if (candidate.resources.some((resource) => !resource.name || !resource.color || !Number.isFinite(resource.weight) || resource.weight < 0)) {
		throw new Error('Ressourcen brauchen name, color und ein Gewicht ab 0.');
	}
	if (candidate.enemies.some((enemy) => !enemy.name || !enemy.icon)) {
		throw new Error('Gegner brauchen name und icon.');
	}
}

function updateConfigStats() {
	configGridStat.textContent = `${config.grid.columns} × ${config.grid.rows}`;
	configObjectStat.textContent = `${config.generation.minObjects}–${config.generation.maxObjects}`;
	configEnemyStat.textContent = config.generation.maxEnemies;
}

function setSettingsOpen(isOpen) {
	settingsView.hidden = !isOpen;
	workspaceElement.hidden = isOpen;
	introElement.hidden = isOpen;
	settingsButton.setAttribute('aria-expanded', String(isOpen));
	settingsButton.classList.toggle('active', isOpen);
	if (isOpen) {
		formatConfig();
		configMessage.textContent = '';
		configEditor.focus();
	}
}

function randomInteger(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chooseWeighted(items) {
	const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
	let threshold = Math.random() * totalWeight;

	for (const item of items) {
		threshold -= item.weight;
		if (threshold <= 0) return item;
	}

	return items[items.length - 1];
}

function chooseRandom(items) {
	return items[Math.floor(Math.random() * items.length)];
}

function createEnemyIcon(enemy, className) {
	const icon = document.createElement('img');
	const source = enemy.id === 'pirate' ? 'img/skull-solid-full.svg' : 'img/alien-solid-full.svg';
	icon.className = className;
	icon.src = source;
	icon.alt = '';
	icon.setAttribute('aria-hidden', 'true');
	return icon;
}

function createCoordinates() {
	const coordinates = [];
	for (let row = 0; row < config.grid.rows; row += 1) {
		for (let column = 0; column < config.grid.columns; column += 1) {
			coordinates.push({ row, column, label: `${config.grid.yAxisLabels[row]}${config.grid.xAxisLabels[column]}` });
		}
	}
	return coordinates;
}

function generateObjects() {
	const amount = randomInteger(config.generation.minObjects, config.generation.maxObjects);
	const availableCoordinates = createCoordinates();
	const objects = [];
	let enemyCount = 0;

	for (let index = 0; index < amount; index += 1) {
		const coordinateIndex = Math.floor(Math.random() * availableCoordinates.length);
		const coordinate = availableCoordinates.splice(coordinateIndex, 1)[0];
		const wantsEnemy = Math.random() < 0.28;
		const type = wantsEnemy && enemyCount < config.generation.maxEnemies ? 'enemy' : 'resource';
		const item = type === 'enemy' ? chooseRandom(config.enemies) : chooseWeighted(config.resources);

		if (type === 'enemy') enemyCount += 1;
		objects.push({ ...coordinate, type, item });
	}

	return objects;
}

function renderBoard(objects) {
	const occupied = new Map(objects.map((object) => [object.label, object]));
	boardElement.innerHTML = '';
	boardElement.style.setProperty('--grid-columns', config.grid.columns);
	boardElement.style.setProperty('--grid-rows', config.grid.rows);
	boardElement.append(createAxisLabel(''));

	config.grid.xAxisLabels.forEach((label) => boardElement.append(createAxisLabel(label)));

	config.grid.yAxisLabels.forEach((rowLabel, row) => {
		boardElement.append(createAxisLabel(rowLabel));
		config.grid.xAxisLabels.forEach((columnLabel, column) => {
			const label = `${rowLabel}${columnLabel}`;
			const object = occupied.get(label);
			const cell = document.createElement('div');
			cell.className = `cell${object ? ` occupied ${object.type}` : ''}`;
			cell.style.animationDelay = `${(row * config.grid.columns + column) * 12}ms`;
			cell.setAttribute('aria-label', object ? `${label}: ${object.item.name}` : `${label}: frei`);
			cell.title = object ? `${label}: ${object.item.name}` : `${label}: frei`;

			if (object) {
				if (object.type === 'enemy') {
					cell.append(createEnemyIcon(object.item, 'enemy-marker'));
				} else {
					const marker = document.createElement('span');
					marker.className = 'cell-marker';
					marker.style.backgroundColor = object.item.color;
					cell.append(marker);
				}
			}
			boardElement.append(cell);
		});
	});
}

function createAxisLabel(text) {
	const label = document.createElement('span');
	label.className = 'axis-label';
	label.textContent = text;
	label.setAttribute('aria-hidden', 'true');
	return label;
}

function renderResults(objects) {
	resultsElement.innerHTML = '';
	if (objects.length === 0) {
		resultsElement.innerHTML = '<p class="empty-results">Noch keine Ziehung vorhanden.</p>';
		return;
	}

	objects.forEach((object, index) => {
		const result = document.createElement('div');
		result.className = 'result-item';
		result.style.animationDelay = `${index * 55}ms`;

		const main = document.createElement('div');
		main.className = 'result-main';
		const icon = document.createElement('span');
		icon.className = object.type === 'enemy' ? 'result-icon enemy-result-icon' : 'result-icon';
		icon.style.backgroundColor = object.type === 'enemy' ? 'var(--danger)' : object.item.color;
		if (object.type === 'enemy') {
			icon.append(createEnemyIcon(object.item, 'result-enemy-marker'));
		} else {
			icon.textContent = '•';
		}

		const copy = document.createElement('div');
		copy.innerHTML = `<div class="result-name">${object.item.name}</div><div class="result-type">${object.type === 'enemy' ? 'GEGNER' : 'RESSOURCE'}</div>`;
		main.append(icon, copy);

		const coordinate = document.createElement('span');
		coordinate.className = 'result-coordinate';
		coordinate.textContent = object.label;
		result.append(main, coordinate);
		resultsElement.append(result);
	});
}

function generateAndRender() {
	const objects = generateObjects();
	const enemyCount = objects.filter((object) => object.type === 'enemy').length;
	rollNumber += 1;
	rollNumberElement.textContent = `#${String(rollNumber).padStart(3, '0')}`;
	objectCountElement.textContent = objects.length;
	enemyLimitElement.textContent = `${enemyCount} / ${config.generation.maxEnemies} Gegner`;
	renderBoard(objects);
	renderResults(objects);
}

rerollButton.addEventListener('click', generateAndRender);
settingsButton.addEventListener('click', () => setSettingsOpen(settingsView.hidden));
closeSettingsButton.addEventListener('click', () => setSettingsOpen(false));
resetConfigButton.addEventListener('click', () => {
	Object.assign(config, structuredClone(defaultConfig));
	localStorage.removeItem(CONFIG_STORAGE_KEY);
	formatConfig();
	configMessage.textContent = 'Standardkonfiguration geladen.';
	configMessage.className = 'config-message success';
	updateConfigStats();
	generateAndRender();
});
applyConfigButton.addEventListener('click', () => {
	try {
		const candidate = JSON.parse(configEditor.value);
		validateConfig(candidate);
		Object.assign(config, candidate);
		localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
		configMessage.textContent = 'Konfiguration übernommen und lokal gespeichert.';
		configMessage.className = 'config-message success';
		updateConfigStats();
		generateAndRender();
	} catch (error) {
		configMessage.textContent = `Fehler: ${error.message}`;
		configMessage.className = 'config-message error';
	}
});

try {
	const savedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
	if (savedConfig) {
		const parsedConfig = JSON.parse(savedConfig);
		validateConfig(parsedConfig);
		Object.assign(config, parsedConfig);
	}
} catch {
	localStorage.removeItem(CONFIG_STORAGE_KEY);
}

updateConfigStats();
generateAndRender();
