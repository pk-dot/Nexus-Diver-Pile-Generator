const APP_VERSION = '1.1.0';
const CONFIG_STORAGE_KEY = 'pile-generator-config';
const BOARD_MASK_STORAGE_KEY = 'pile-generator-board-mask';
const ENEMY_RESOURCE_COUNT = 2;

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
const scanButton = document.querySelector('#scan-button');
const settingsButton = document.querySelector('#settings-button');
const closeSettingsButton = document.querySelector('#close-settings-button');
const closeScanButton = document.querySelector('#close-scan-button');
const settingsView = document.querySelector('#settings-view');
const scanView = document.querySelector('#scan-view');
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
const scanCanvas = document.querySelector('#scan-canvas');
const scanPreviewWrap = document.querySelector('.scan-preview-wrap');
const scanCropBox = document.querySelector('#scan-crop-box');
const scanCropTools = document.querySelector('#scan-crop-tools');
const cropImageButton = document.querySelector('#crop-image-button');
const cropXInput = document.querySelector('#crop-x');
const cropYInput = document.querySelector('#crop-y');
const cropSizeInput = document.querySelector('#crop-size');
const cropXValue = document.querySelector('#crop-x-value');
const cropYValue = document.querySelector('#crop-y-value');
const cropSizeValue = document.querySelector('#crop-size-value');
const scanGridElement = document.querySelector('#scan-grid');
const scanEmptyElement = document.querySelector('#scan-empty');
const scanStatusElement = document.querySelector('#scan-status');
const scanFileInput = document.querySelector('#scan-file-input');
const resetScanButton = document.querySelector('#reset-scan-button');
const applyScanButton = document.querySelector('#apply-scan-button');
const scanSensitivity = document.querySelector('#scan-sensitivity');
const scanSensitivityValue = document.querySelector('#scan-sensitivity-value');
let rollNumber = 0;
let blockedCells = new Set();
let pendingBlockedCells = new Set();
let sourceCanvas = null;
let hasSourceImage = false;
let isCropApplied = false;

scanCanvas.width = 0;
scanCanvas.height = 0;

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
	scanView.hidden = true;
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

function setScanOpen(isOpen) {
	scanView.hidden = !isOpen;
	settingsView.hidden = true;
	workspaceElement.hidden = isOpen;
	introElement.hidden = isOpen;
	scanButton.setAttribute('aria-expanded', String(isOpen));
	if (isOpen) scanStatusElement.textContent = 'Ohne Foto Felder direkt antippen oder ein Spielfeldfoto laden.';
}

function getCellLabel(row, column) {
	return `${config.grid.yAxisLabels[row]}${config.grid.xAxisLabels[column]}`;
}

function renderScanGrid() {
	scanGridElement.innerHTML = '';
	scanGridElement.style.setProperty('--scan-columns', config.grid.columns);
	scanGridElement.style.setProperty('--scan-rows', config.grid.rows);
	scanGridElement.hidden = hasSourceImage && !isCropApplied;
	scanEmptyElement.hidden = hasSourceImage;
	scanCropBox.hidden = !hasSourceImage || isCropApplied;
	scanCropTools.hidden = !hasSourceImage || isCropApplied;
	applyScanButton.disabled = false;
	scanPreviewWrap.classList.toggle('has-image', Boolean(scanCanvas.width));
	if (scanCanvas.width) scanPreviewWrap.style.aspectRatio = `${scanCanvas.width} / ${scanCanvas.height}`;

	for (let row = 0; row < config.grid.rows; row += 1) {
		for (let column = 0; column < config.grid.columns; column += 1) {
			const label = getCellLabel(row, column);
			const cell = document.createElement('button');
			cell.type = 'button';
			cell.className = `scan-cell${pendingBlockedCells.has(label) ? ' blocked' : ''}`;
			cell.dataset.label = label;
			cell.textContent = label;
			cell.setAttribute('aria-label', `${label}: ${pendingBlockedCells.has(label) ? 'gesperrt' : 'bespielbar'}`);
			cell.addEventListener('click', () => {
				if (pendingBlockedCells.has(label)) pendingBlockedCells.delete(label);
				else pendingBlockedCells.add(label);
				renderScanGrid();
			});
			scanGridElement.append(cell);
		}
	}
}

function updateCropPreview() {
	if (!sourceCanvas || !hasSourceImage || isCropApplied) return;
	const cropSize = (Math.min(sourceCanvas.width, sourceCanvas.height) * Number(cropSizeInput.value)) / 100;
	const maxX = sourceCanvas.width - cropSize;
	const maxY = sourceCanvas.height - cropSize;
	const cropX = (maxX * Number(cropXInput.value)) / 100;
	const cropY = (maxY * Number(cropYInput.value)) / 100;
	cropXValue.textContent = cropXInput.value;
	cropYValue.textContent = cropYInput.value;
	cropSizeValue.textContent = cropSizeInput.value;
	scanCropBox.style.left = `${(cropX / sourceCanvas.width) * 100}%`;
	scanCropBox.style.top = `${(cropY / sourceCanvas.height) * 100}%`;
	scanCropBox.style.width = `${(cropSize / sourceCanvas.width) * 100}%`;
	scanCropBox.style.height = `${(cropSize / sourceCanvas.height) * 100}%`;
}

function cropAndAnalyze() {
	if (!sourceCanvas) return;
	const cropSize = (Math.min(sourceCanvas.width, sourceCanvas.height) * Number(cropSizeInput.value)) / 100;
	const cropX = ((sourceCanvas.width - cropSize) * Number(cropXInput.value)) / 100;
	const cropY = ((sourceCanvas.height - cropSize) * Number(cropYInput.value)) / 100;
	const outputSize = Math.min(1400, Math.max(700, Math.round(cropSize)));
	scanCanvas.width = outputSize;
	scanCanvas.height = outputSize;
	scanCanvas.getContext('2d', { willReadFrequently: true }).drawImage(sourceCanvas, cropX, cropY, cropSize, cropSize, 0, 0, outputSize, outputSize);
	isCropApplied = true;
	pendingBlockedCells = new Set();
	renderScanGrid();
	analyzeScanImage();
}

function setScanStatus(message, state = '') {
	scanStatusElement.textContent = message;
	scanStatusElement.className = `config-message${state ? ` ${state}` : ''}`;
}

function analyzeScanImage() {
	if (!scanCanvas.width || !scanCanvas.height) return;
	const context = scanCanvas.getContext('2d', { willReadFrequently: true });
	const imageData = context.getImageData(0, 0, scanCanvas.width, scanCanvas.height).data;
	const sampleStep = Math.max(4, Math.floor(Math.min(scanCanvas.width, scanCanvas.height) / 120));
	const sensitivity = Number(scanSensitivity.value) / 100;
	const blackRatioThreshold = 0.3 - sensitivity * 0.27;
	const darkRatioThreshold = 0.5 - sensitivity * 0.4;
	const brightnessFactor = 0.35 + sensitivity * 0.4;
	let globalBrightness = 0;
	let globalSamples = 0;

	for (let y = 0; y < scanCanvas.height; y += sampleStep) {
		for (let x = 0; x < scanCanvas.width; x += sampleStep) {
			const index = (y * scanCanvas.width + x) * 4;
			globalBrightness += imageData[index] * 0.299 + imageData[index + 1] * 0.587 + imageData[index + 2] * 0.114;
			globalSamples += 1;
		}
	}

	const averageBrightness = globalBrightness / globalSamples;
	const threshold = Math.max(34, averageBrightness * 0.58);
	pendingBlockedCells = new Set();

	for (let row = 0; row < config.grid.rows; row += 1) {
		for (let column = 0; column < config.grid.columns; column += 1) {
			const startX = Math.floor(((column + 0.2) * scanCanvas.width) / config.grid.columns);
			const endX = Math.floor(((column + 0.8) * scanCanvas.width) / config.grid.columns);
			const startY = Math.floor(((row + 0.2) * scanCanvas.height) / config.grid.rows);
			const endY = Math.floor(((row + 0.8) * scanCanvas.height) / config.grid.rows);
			let brightness = 0;
			let darkPixels = 0;
			let blackPixels = 0;
			let samples = 0;

			for (let y = startY; y < endY; y += sampleStep) {
				for (let x = startX; x < endX; x += sampleStep) {
					const index = (y * scanCanvas.width + x) * 4;
					const red = imageData[index];
					const green = imageData[index + 1];
					const blue = imageData[index + 2];
					const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
					brightness += luminance;
					if (luminance < 58) darkPixels += 1;
					if (Math.max(red, green, blue) < 70 && Math.max(red, green, blue) - Math.min(red, green, blue) < 30) blackPixels += 1;
					samples += 1;
				}
			}

			const cellBrightness = brightness / samples;
			const darkRatio = darkPixels / samples;
			const blackRatio = blackPixels / samples;
			if ((cellBrightness < threshold && cellBrightness < averageBrightness * brightnessFactor) || (darkRatio > darkRatioThreshold && cellBrightness < averageBrightness * 0.72) || blackRatio > blackRatioThreshold) {
				pendingBlockedCells.add(getCellLabel(row, column));
			}
		}
	}

	renderScanGrid();
	applyScanButton.disabled = false;
	setScanStatus(`${pendingBlockedCells.size} Felder als Wand erkannt bei ${scanSensitivity.value}% Empfindlichkeit. Bitte prüfen und bei Bedarf antippen.`, 'success');
}

function loadScanFile(file) {
	if (!file) return;
	const image = new Image();
	const imageUrl = URL.createObjectURL(file);
	image.onload = () => {
		const maxDimension = 1400;
		const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
		sourceCanvas = document.createElement('canvas');
		sourceCanvas.width = Math.round(image.naturalWidth * scale);
		sourceCanvas.height = Math.round(image.naturalHeight * scale);
		sourceCanvas.getContext('2d', { willReadFrequently: true }).drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);
		scanCanvas.width = sourceCanvas.width;
		scanCanvas.height = sourceCanvas.height;
		scanCanvas.getContext('2d', { willReadFrequently: true }).drawImage(sourceCanvas, 0, 0);
		hasSourceImage = true;
		isCropApplied = false;
		cropXInput.value = '50';
		cropYInput.value = '50';
		cropSizeInput.value = '100';
		renderScanGrid();
		updateCropPreview();
		URL.revokeObjectURL(imageUrl);
		setScanStatus('Ausschnitt einstellen und anschließend zuschneiden.', 'success');
	};
	image.onerror = () => {
		URL.revokeObjectURL(imageUrl);
		setScanStatus('Das Foto konnte nicht gelesen werden.', 'error');
	};
	image.src = imageUrl;
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

function rollEnemyResources(count = ENEMY_RESOURCE_COUNT) {
	return Array.from({ length: count }, () => chooseWeighted(config.resources));
}

function createResourceDot(resource, className) {
	const dot = document.createElement('span');
	dot.className = className;
	dot.style.backgroundColor = resource.color;
	dot.setAttribute('aria-hidden', 'true');
	return dot;
}

function describeObject(object) {
	if (object.type !== 'enemy' || !object.resources?.length) return object.item.name;
	return `${object.item.name} mit ${object.resources.map((resource) => resource.name).join(' + ')}`;
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
	const availableCoordinates = createCoordinates().filter((coordinate) => !blockedCells.has(coordinate.label));
	const objectAmount = Math.min(amount, availableCoordinates.length);
	const objects = [];
	let enemyCount = 0;

	for (let index = 0; index < objectAmount; index += 1) {
		const coordinateIndex = Math.floor(Math.random() * availableCoordinates.length);
		const coordinate = availableCoordinates.splice(coordinateIndex, 1)[0];
		const wantsEnemy = Math.random() < 0.28;
		const type = wantsEnemy && enemyCount < config.generation.maxEnemies ? 'enemy' : 'resource';
		const item = type === 'enemy' ? chooseRandom(config.enemies) : chooseWeighted(config.resources);

		if (type === 'enemy') {
			enemyCount += 1;
			objects.push({ ...coordinate, type, item, resources: rollEnemyResources() });
		} else {
			objects.push({ ...coordinate, type, item });
		}
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
			const isBlocked = blockedCells.has(label);
			const cell = document.createElement('div');
			cell.className = `cell${isBlocked ? ' blocked' : ''}${object ? ` occupied ${object.type}` : ''}`;
			cell.style.animationDelay = `${(row * config.grid.columns + column) * 12}ms`;
			const cellDescription = object ? `${label}: ${describeObject(object)}` : isBlocked ? `${label}: gesperrt` : `${label}: frei`;
			cell.setAttribute('aria-label', cellDescription);
			cell.title = cellDescription;

			if (object) {
				if (object.type === 'enemy') {
					cell.append(createEnemyIcon(object.item, 'enemy-marker'));
					object.resources.forEach((resource, resourceIndex) => {
						cell.append(createResourceDot(resource, `enemy-resource-dot enemy-resource-dot-${resourceIndex + 1}`));
					});
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
		copy.className = 'result-copy';
		const name = document.createElement('div');
		name.className = 'result-name';
		name.textContent = object.item.name;
		const type = document.createElement('div');
		type.className = 'result-type';
		type.textContent = object.type === 'enemy' ? 'GEGNER' : 'RESSOURCE';
		copy.append(name, type);

		if (object.type === 'enemy') {
			const loot = document.createElement('div');
			loot.className = 'result-enemy-resources';
			loot.setAttribute('aria-label', `Ressourcen: ${object.resources.map((resource) => resource.name).join(' und ')}`);
			object.resources.forEach((resource, resourceIndex) => {
				if (resourceIndex > 0) {
					const separator = document.createElement('span');
					separator.className = 'result-resource-separator';
					separator.textContent = '+';
					separator.setAttribute('aria-hidden', 'true');
					loot.append(separator);
				}
				const entry = document.createElement('span');
				entry.className = 'result-resource';
				entry.setAttribute('aria-hidden', 'true');
				entry.append(createResourceDot(resource, 'result-resource-dot'), document.createTextNode(resource.name));
				loot.append(entry);
			});
			copy.append(loot);
		}
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
scanButton.addEventListener('click', () => setScanOpen(scanView.hidden));
closeScanButton.addEventListener('click', () => setScanOpen(false));
scanFileInput.addEventListener('change', (event) => loadScanFile(event.target.files[0]));
for (const input of [cropXInput, cropYInput, cropSizeInput]) input.addEventListener('input', updateCropPreview);
cropImageButton.addEventListener('click', cropAndAnalyze);
scanSensitivity.addEventListener('input', () => {
	scanSensitivityValue.value = scanSensitivity.value;
	scanSensitivityValue.textContent = scanSensitivity.value;
	if (scanCanvas.width) analyzeScanImage();
});
scanSensitivity.addEventListener('change', () => {
	if (scanCanvas.width) analyzeScanImage();
});
resetScanButton.addEventListener('click', () => {
	pendingBlockedCells = new Set();
	renderScanGrid();
	setScanStatus('Alle Felder sind wieder als bespielbar markiert.', 'success');
});
applyScanButton.addEventListener('click', () => {
	blockedCells = new Set(pendingBlockedCells);
	localStorage.setItem(BOARD_MASK_STORAGE_KEY, JSON.stringify([...blockedCells]));
	generateAndRender();
	setScanOpen(false);
});
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

try {
	const savedBoardMask = localStorage.getItem(BOARD_MASK_STORAGE_KEY);
	if (savedBoardMask) blockedCells = new Set(JSON.parse(savedBoardMask));
} catch {
	localStorage.removeItem(BOARD_MASK_STORAGE_KEY);
}

localStorage.removeItem('pile-generator-board-image');

updateConfigStats();
renderScanGrid();
generateAndRender();
