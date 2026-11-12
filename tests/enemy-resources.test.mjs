// Tests für die Gegner-Ressourcen. Ausführen mit: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function createElement(tagName = 'div') {
	const element = {
		tagName: tagName.toUpperCase(),
		children: [],
		attributes: {},
		dataset: {},
		className: '',
		textContent: '',
		set innerHTML(html) {
			this.children = [];
			this.html = html;
		},
		get innerHTML() {
			return this.html ?? '';
		},
		value: '',
		hidden: false,
		disabled: false,
		width: 0,
		height: 0,
		style: { setProperty() {} },
		classList: { toggle() {}, add() {}, remove() {} },
		append(...nodes) {
			this.children.push(...nodes);
		},
		setAttribute(name, value) {
			this.attributes[name] = String(value);
		},
		addEventListener() {},
		focus() {},
		getContext: () => ({ drawImage() {}, getImageData: () => ({ data: [] }) }),
	};
	return element;
}

function loadApp({ resources, random = Math.random } = {}) {
	const storage = new Map();
	if (resources) {
		const config = JSON.parse(appSource.match(/const defaultConfig = ([\s\S]*?);\n\nconst config/)[1].replace(/(\w+):/g, '"$1":').replace(/'/g, '"').replace(/,(\s*[}\]])/g, '$1'));
		config.resources = resources;
		storage.set('pile-generator-config', JSON.stringify(config));
	}
	const elements = new Map();
	const context = {
		console,
		structuredClone,
		URL,
		Image: class {},
		Math: Object.create(Math, { random: { value: random } }),
		localStorage: {
			getItem: (key) => storage.get(key) ?? null,
			setItem: (key, value) => storage.set(key, value),
			removeItem: (key) => storage.delete(key),
		},
		document: {
			querySelector(selector) {
				if (!elements.has(selector)) elements.set(selector, createElement());
				return elements.get(selector);
			},
			createElement,
			createTextNode: (text) => ({ nodeType: 3, textContent: text }),
		},
	};
	vm.createContext(context);
	vm.runInContext(`${appSource}\n;globalThis.__app = { config, generateObjects, rollEnemyResources, describeObject, renderBoard, renderResults, ENEMY_RESOURCE_COUNT };`, context);
	return { ...context.__app, elements };
}

function findAll(element, predicate, found = []) {
	if (predicate(element)) found.push(element);
	for (const child of element.children ?? []) findAll(child, predicate, found);
	return found;
}

test('jeder Gegner bekommt genau zwei Ressourcen aus der Konfiguration', () => {
	const app = loadApp();
	const resourceIds = new Set(app.config.resources.map((resource) => resource.id));
	let enemies = 0;
	for (let run = 0; run < 2000; run += 1) {
		for (const object of app.generateObjects()) {
			if (object.type !== 'enemy') {
				assert.equal(object.resources, undefined, 'Ressourcenfelder haben keine Gegner-Ressourcen');
				continue;
			}
			enemies += 1;
			assert.equal(object.resources.length, 2);
			for (const resource of object.resources) assert.ok(resourceIds.has(resource.id));
		}
	}
	assert.ok(enemies > 0, 'In 2000 Würfen sollte mindestens ein Gegner vorkommen');
});

test('Gegnerlimit bleibt trotz Ressourcen bei maximal 2', () => {
	const app = loadApp();
	for (let run = 0; run < 2000; run += 1) {
		const enemies = app.generateObjects().filter((object) => object.type === 'enemy');
		assert.ok(enemies.length <= app.config.generation.maxEnemies);
	}
});

test('beide Ressourcen dürfen gleich sein (Doppelungen erlaubt)', () => {
	const app = loadApp({ random: () => 0 });
	const [first, second] = app.rollEnemyResources();
	assert.equal(first.id, second.id);
});

test('Doppelungen kommen auch zufällig vor, unterschiedliche ebenfalls', () => {
	const app = loadApp();
	let same = 0;
	let different = 0;
	for (let run = 0; run < 1000; run += 1) {
		const [first, second] = app.rollEnemyResources();
		if (first.id === second.id) same += 1;
		else different += 1;
	}
	assert.ok(same > 0 && different > 0);
});

test('Ressourcen-Gewichte werden beachtet', () => {
	const app = loadApp({
		resources: [
			{ id: 'green', name: 'Grün', color: '#2ecc71', weight: 1 },
			{ id: 'blue', name: 'Blau', color: '#3498db', weight: 0 },
		],
	});
	for (let run = 0; run < 500; run += 1) {
		for (const resource of app.rollEnemyResources()) assert.equal(resource.id, 'green');
	}
});

test('Spielfeld zeigt Icon und zwei farbige Punkte am Gegner', () => {
	const app = loadApp();
	const green = app.config.resources[0];
	const blue = app.config.resources[4];
	const enemy = { row: 0, column: 0, label: 'A1', type: 'enemy', item: app.config.enemies[0], resources: [green, blue] };
	app.renderBoard([enemy]);
	const board = app.elements.get('#board');
	const cell = findAll(board, (element) => element.className?.includes('occupied enemy'))[0];
	assert.ok(cell, 'Gegnerfeld wird gerendert');
	const dots = cell.children.filter((child) => child.className.startsWith('enemy-resource-dot'));
	assert.equal(dots.length, 2);
	assert.equal(dots[0].style.backgroundColor, green.color);
	assert.equal(dots[1].style.backgroundColor, blue.color);
	assert.equal(cell.attributes['aria-label'], 'A1: Pirat mit Grün + Blau');
});

test('Fundstück-Liste zeigt Namen und Punkte der Gegner-Ressourcen', () => {
	const app = loadApp();
	const yellow = app.config.resources[2];
	const enemy = { row: 0, column: 0, label: 'A1', type: 'enemy', item: app.config.enemies[1], resources: [yellow, yellow] };
	app.renderResults([enemy]);
	const list = app.elements.get('#results-list');
	const loot = findAll(list, (element) => element.className === 'result-enemy-resources')[0];
	assert.ok(loot, 'Ressourcenzeile wird gerendert');
	assert.equal(loot.attributes['aria-label'], 'Ressourcen: Gelb und Gelb');
	const entries = loot.children.filter((child) => child.className === 'result-resource');
	assert.equal(entries.length, 2);
	assert.deepEqual(entries.map((entry) => entry.children[1].textContent), ['Gelb', 'Gelb']);
});
