/* Tilawah service worker — offline-first for the app shell + all bundled
   data (Quran text, word-by-word data, hadith pool), runtime cache for
   ayah + word audio (shared cache name with the app). */
const SHELL = 'tilawah-shell-v7';
const AUDIO = 'tilawah-audio-v1';
const SHELL_FILES = ["./", "./index.html", "./css/style.css", "./js/app.js", "./js/v4.js", "./js/engine.js", "./data/quran.parts.json", "./data/words.parts.json", "./data/hadith.parts.json", "./data/parts/quran-000.bin", "./data/parts/quran-001.bin", "./data/parts/quran-002.bin", "./data/parts/quran-003.bin", "./data/parts/quran-004.bin", "./data/parts/quran-005.bin", "./data/parts/quran-006.bin", "./data/parts/quran-007.bin", "./data/parts/quran-008.bin", "./data/parts/quran-009.bin", "./data/parts/quran-010.bin", "./data/parts/quran-011.bin", "./data/parts/quran-012.bin", "./data/parts/quran-013.bin", "./data/parts/quran-014.bin", "./data/parts/quran-015.bin", "./data/parts/quran-016.bin", "./data/parts/quran-017.bin", "./data/parts/quran-018.bin", "./data/parts/quran-019.bin", "./data/parts/quran-020.bin", "./data/parts/quran-021.bin", "./data/parts/quran-022.bin", "./data/parts/quran-023.bin", "./data/parts/quran-024.bin", "./data/parts/quran-025.bin", "./data/parts/quran-026.bin", "./data/parts/quran-027.bin", "./data/parts/quran-028.bin", "./data/parts/quran-029.bin", "./data/parts/quran-030.bin", "./data/parts/quran-031.bin", "./data/parts/quran-032.bin", "./data/parts/quran-033.bin", "./data/parts/quran-034.bin", "./data/parts/quran-035.bin", "./data/parts/quran-036.bin", "./data/parts/quran-037.bin", "./data/parts/quran-038.bin", "./data/parts/quran-039.bin", "./data/parts/quran-040.bin", "./data/parts/quran-041.bin", "./data/parts/quran-042.bin", "./data/parts/quran-043.bin", "./data/parts/quran-044.bin", "./data/parts/quran-045.bin", "./data/parts/quran-046.bin", "./data/parts/quran-047.bin", "./data/parts/quran-048.bin", "./data/parts/quran-049.bin", "./data/parts/quran-050.bin", "./data/parts/quran-051.bin", "./data/parts/quran-052.bin", "./data/parts/quran-053.bin", "./data/parts/quran-054.bin", "./data/parts/quran-055.bin", "./data/parts/quran-056.bin", "./data/parts/quran-057.bin", "./data/parts/quran-058.bin", "./data/parts/quran-059.bin", "./data/parts/quran-060.bin", "./data/parts/quran-061.bin", "./data/parts/quran-062.bin", "./data/parts/quran-063.bin", "./data/parts/quran-064.bin", "./data/parts/quran-065.bin", "./data/parts/quran-066.bin", "./data/parts/quran-067.bin", "./data/parts/quran-068.bin", "./data/parts/quran-069.bin", "./data/parts/quran-070.bin", "./data/parts/quran-071.bin", "./data/parts/quran-072.bin", "./data/parts/quran-073.bin", "./data/parts/quran-074.bin", "./data/parts/quran-075.bin", "./data/parts-words/words-000.bin", "./data/parts-words/words-001.bin", "./data/parts-words/words-002.bin", "./data/parts-words/words-003.bin", "./data/parts-words/words-004.bin", "./data/parts-words/words-005.bin", "./data/parts-words/words-006.bin", "./data/parts-words/words-007.bin", "./data/parts-words/words-008.bin", "./data/parts-words/words-009.bin", "./data/parts-words/words-010.bin", "./data/parts-words/words-011.bin", "./data/parts-words/words-012.bin", "./data/parts-words/words-013.bin", "./data/parts-words/words-014.bin", "./data/parts-words/words-015.bin", "./data/parts-words/words-016.bin", "./data/parts-words/words-017.bin", "./data/parts-words/words-018.bin", "./data/parts-words/words-019.bin", "./data/parts-words/words-020.bin", "./data/parts-words/words-021.bin", "./data/parts-words/words-022.bin", "./data/parts-words/words-023.bin", "./data/parts-words/words-024.bin", "./data/parts-words/words-025.bin", "./data/parts-words/words-026.bin", "./data/parts-words/words-027.bin", "./data/parts-words/words-028.bin", "./data/parts-words/words-029.bin", "./data/parts-words/words-030.bin", "./data/parts-words/words-031.bin", "./data/parts-words/words-032.bin", "./data/parts-words/words-033.bin", "./data/parts-words/words-034.bin", "./data/parts-words/words-035.bin", "./data/parts-words/words-036.bin", "./data/parts-hadith/hadith-000.bin", "./data/parts-hadith/hadith-001.bin", "./data/parts-hadith/hadith-002.bin", "./data/parts-hadith/hadith-003.bin", "./data/parts-hadith/hadith-004.bin", "./data/parts-hadith/hadith-005.bin", "./data/parts-hadith/hadith-006.bin", "./data/parts-hadith/hadith-007.bin", "./data/parts-hadith/hadith-008.bin", "./data/parts-hadith/hadith-009.bin", "./data/tajweed.parts.json", "./data/parts-tajweed/tajweed-000.bin", "./data/parts-tajweed/tajweed-001.bin", "./data/parts-tajweed/tajweed-002.bin", "./data/parts-tajweed/tajweed-003.bin", "./data/parts-tajweed/tajweed-004.bin", "./data/parts-tajweed/tajweed-005.bin", "./data/parts-tajweed/tajweed-006.bin", "./manifest.webmanifest", "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => ![SHELL, AUDIO].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.hostname === 'cdn.islamic.network' || url.hostname === 'audio.qurancdn.com' || url.hostname === 'everyayah.com') {
    // audio: cache-first, then network (populates the offline cache)
    e.respondWith(caches.open(AUDIO).then(async (cache) => {
      const hit = await cache.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  if (e.request.method === 'GET' && url.origin === location.origin) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(SHELL).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match('./index.html'))));
  }
});
