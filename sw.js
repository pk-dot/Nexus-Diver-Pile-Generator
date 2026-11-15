// Service Worker – macht den Pile Generator installierbar und offline nutzbar.
// CACHE_VERSION muss zu APP_VERSION in app.js passen (wird per Test geprüft).
const CACHE_VERSION = '1.4.1';
const CACHE_NAME = `pile-generator-${CACHE_VERSION}`;
const FONT_CACHE = 'pile-generator-fonts';

const APP_SHELL = [
	'./',
	'index.html',
	'app.js',
	'styles.css',
	'changelog.html',
	'roadmap.html',
	'manifest.webmanifest',
	'img/alien-solid-full.svg',
	'img/skull-solid-full.svg',
	'img/gear-solid-full.svg',
	'img/location-pin-lock-solid-full.svg',
	'img/app/icon-192.png',
	'img/app/icon-512.png',
	'img/app/apple-touch-icon.png',
	'img/app/favicon-32.png',
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((key) => key.startsWith('pile-generator-') && key !== CACHE_NAME && key !== FONT_CACHE).map((key) => caches.delete(key))))
			.then(() => self.clients.claim()),
	);
});

// Eigene Dateien: erst Netzwerk (Updates kommen sofort an), offline aus dem Cache.
async function networkFirst(request) {
	const cache = await caches.open(CACHE_NAME);
	try {
		const response = await fetch(request);
		if (response.ok) cache.put(request, response.clone());
		return response;
	} catch {
		const cached = await cache.match(request, { ignoreSearch: true });
		if (cached) return cached;
		if (request.mode === 'navigate') return cache.match('index.html');
		throw new Error(`Offline und nicht im Cache: ${request.url}`);
	}
}

// Google Fonts: aus dem Cache, im Hintergrund aktualisieren.
async function staleWhileRevalidate(request) {
	const cache = await caches.open(FONT_CACHE);
	const cached = await cache.match(request);
	const network = fetch(request)
		.then((response) => {
			if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
			return response;
		})
		.catch(() => cached);
	return cached || network;
}

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);

	if (url.origin === self.location.origin) {
		event.respondWith(networkFirst(request));
	} else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
		event.respondWith(staleWhileRevalidate(request));
	}
});
