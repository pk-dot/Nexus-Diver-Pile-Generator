// Tests für die installierbare Web-App. Ausführen mit: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const exists = (path) => existsSync(new URL(path, root));

const appVersion = read('app.js').match(/const APP_VERSION = '([^']+)'/)[1];
const swSource = read('sw.js');
const manifest = JSON.parse(read('manifest.webmanifest'));

test('Cache-Version im Service Worker passt zur App-Version', () => {
	const cacheVersion = swSource.match(/const CACHE_VERSION = '([^']+)'/)[1];
	assert.equal(cacheVersion, appVersion, 'Bei neuer Version auch CACHE_VERSION in sw.js anheben');
});

test('alle vorab gecachten Dateien existieren', () => {
	const shell = [...swSource.match(/const APP_SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
	assert.ok(shell.length > 5);
	for (const path of shell.filter((entry) => entry !== './')) assert.ok(exists(path), `fehlt: ${path}`);
});

test('Manifest erfüllt die Installationskriterien', () => {
	assert.ok(manifest.name && manifest.short_name);
	assert.equal(manifest.display, 'standalone');
	assert.equal(manifest.start_url, './');
	const sizes = manifest.icons.map((icon) => icon.sizes);
	assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
	assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
	for (const icon of manifest.icons) assert.ok(exists(icon.src), `Icon fehlt: ${icon.src}`);
});

test('alle Seiten verlinken Manifest und Apple-Touch-Icon', () => {
	for (const page of ['index.html', 'changelog.html', 'roadmap.html']) {
		const html = read(page);
		assert.match(html, /<link rel="manifest" href="manifest.webmanifest"/, page);
		assert.match(html, /<link rel="apple-touch-icon" href="img\/app\/apple-touch-icon.png"/, page);
	}
});

test('build-dist.sh kopiert Manifest, Service Worker und App-Icons', () => {
	const script = read('build-dist.sh');
	assert.match(script, /manifest\.webmanifest/);
	assert.match(script, /sw\.js/);
	assert.match(script, /img\/app/);
});
