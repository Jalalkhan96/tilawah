'use strict';
/* Tilawah web app — all state is local (localStorage / IndexedDB / Cache Storage). */
const $ = (id) => document.getElementById(id);
const AUDIO_CACHE = 'tilawah-audio-v1';
/* Reciters: every entry was verified against the Islamic Network CDN —
   the API returns a per-ayah audio URL and the file itself answers at the
   listed bitrate (editions exist only at specific bitrates; a wrong
   bitrate 403s, so the bitrate is part of the table, never assumed). */
const RECITERS = {
  'ar.alafasy': { name: 'Mishary Rashid Alafasy', br: 128 },
  'ar.husary': { name: 'Mahmoud Khalil Al-Husary', br: 128 },
  'ar.husarymujawwad': { name: 'Al-Husary — Mujawwad', br: 128 },
  'ar.minshawi': { name: 'Mohamed Siddiq El-Minshawi', br: 128 },
  'ar.mahermuaiqly': { name: 'Maher Al-Muaiqly', br: 128 },
  'ar.hudhaify': { name: 'Ali Al-Hudhaify', br: 128 },
  'ar.abdulbasitmurattal': { name: 'Abdul Basit — Murattal', br: 192 },
  'ar.saoodshuraym': { name: 'Saood Al-Shuraim', br: 64 },
  'ar.ahmedajamy': { name: 'Ahmed ibn Ali Al-Ajamy', br: 128 },
  'ar.shaatree': { name: 'Abu Bakr Al-Shatri', br: 128 },
  'ar.muhammadjibreel': { name: 'Muhammad Jibreel', br: 128 },
  'ar.muhammadayyoub': { name: 'Muhammad Ayyub', br: 128 },
  'ar.abdullahbasfar': { name: 'Abdullah Awad Al-Basfar', br: 192 },
  'ar.hanirifai': { name: 'Hani Ar-Rifai', br: 192 },
  'ar.ibrahimakhbar': { name: 'Ibrahim Al-Akhdar', br: 32 },
  'ar.parhizgar': { name: 'Shahriar Parhizgar', br: 48 },
};
/* Spoken translations (Quran Pen style): read aloud after each ayah. */
const TRANS_AUDIO = { 'en.walk': { name: 'English — Ibrahim Walk', br: 192 }, 'ur.khan': { name: 'Urdu — Shamshad Ali Khan', br: 64 } };
const audioUrl = (g) => `https://cdn.islamic.network/quran/audio/${(RECITERS[settings.reciter] || RECITERS['ar.alafasy']).br}/${settings.reciter}/${g}.mp3`;
const transAudioUrl = (g) => `https://cdn.islamic.network/quran/audio/${TRANS_AUDIO[settings.transAudio].br}/${settings.transAudio}/${g}.mp3`;
/* Translation text: field per ayah in the bundled data — e/a English, u Urdu, s Pashto. */
const transText = (ay) => { const t = settings.translation; if (typeof t === 'string' && t.startsWith('pk:')) return ''; return ay[t] || ay.e; };
const transIsRTL = () => { const t = settings.translation; if (t === 'u' || t === 's') return true; if (typeof t === 'string' && t.startsWith('pk:')) { const p = packOf(t.slice(3)); return !!(p && p.rtl); } return false; };
const wbwUrl = (s, a, w) => `https://audio.qurancdn.com/wbw/${String(s).padStart(3, '0')}_${String(a).padStart(3, '0')}_${String(w).padStart(3, '0')}.mp3`;

let Q = null;               // quran data (validated Tanzil text + Saheeh translation)
let WORDS = null;           // word-by-word dataset (lazy): { ayahs: { [g]: {m, s, w, b?} } }
let HAD = null;             // daily hadith pool (lazy): { hadiths: [...] }
let sel = { s: 0, a: 1 };   // selected surah index (0-based) + ayah number
let detailSi = 0;           // surah shown on the Surah detail page
let currentView = 'home';
let settings = Object.assign({ theme: 'light', fontSize: 34, reciter: 'ar.alafasy', showTrans: true, keepRecordings: false, speed: 1, translation: 'e', transAudio: '' }, load('tilawah.settings.v1', {}));
if (!RECITERS[settings.reciter]) settings.reciter = 'ar.alafasy';
$('reciterSel').innerHTML = Object.entries(RECITERS).map(([id, r]) => `<option value="${id}">${r.name}</option>`).join('');
let bookmarks = load('tilawah.bookmarks.v1', []);   // global ayah numbers
let history = load('tilawah.history.v1', []);       // session metadata
let lastPos = load('tilawah.lastPos.v1', { s: 0, a: 1 });

function load(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function surah() { return Q.surahs[sel.s]; }
function ayahOf(sIdx, n) { return Q.surahs[sIdx].ayahs[n - 1]; }
function fmtTime(sec) { sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ---------------- navigation ---------------- */
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
function scrollActiveTabIntoCentre() {
  const tab = document.querySelector('.tab.active');
  const bar = tab && tab.parentElement;
  if (!tab || !bar) return;
  // Centre the selected tab inside the nav bar itself. Tabs up to the middle
  // of the bar need no movement (target clamps to the current scroll), tabs
  // past the middle scroll the bar so the selected pill sits in the centre.
  // Manual scrollLeft on the bar only — the page itself never jumps sideways.
  const target = tab.offsetLeft - (bar.clientWidth - tab.clientWidth) / 2;
  const max = Math.max(0, bar.scrollWidth - bar.clientWidth);
  const left = Math.max(0, Math.min(target, max));
  if (Math.abs(bar.scrollLeft - left) < 2) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  bar.scrollTo({ left, behavior: reduce ? 'auto' : 'smooth' });
}
function showView(name) {
  currentView = name;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  scrollActiveTabIntoCentre();
  if (name === 'home') renderHome();
  if (name === 'history') renderHistory();
  if (name === 'surah') renderSurahDetail();
  if (name === 'hadith') renderHadith();
  window.scrollTo({ top: 0 });
}

/* ---------------- data loading (byte parts) ---------------- */
/* Data files ship as byte parts (…-NNN.bin) listed in a *.parts.json
   manifest, so no host or upload limit ever sees one huge file. Bytes are
   joined before decoding, so a multi-byte Arabic character split across
   two parts is still safe. */
async function loadParts(manifestUrl, basePrefix) {
  const man = await (await fetch(manifestUrl)).json();
  const chunks = [];
  let total = 0;
  for (let i = 0; i < man.parts; i++) {
    const buf = await (await fetch(`${basePrefix}-${String(i).padStart(3, '0')}.bin`)).arrayBuffer();
    chunks.push(new Uint8Array(buf));
    total += buf.byteLength;
  }
  if (total !== man.bytes) throw new Error('Data size mismatch: ' + manifestUrl);
  const joined = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { joined.set(c, off); off += c.length; }
  return JSON.parse(new TextDecoder('utf-8').decode(joined));
}
async function ensureWords() {
  if (WORDS) return WORDS;
  WORDS = await loadParts('data/words.parts.json', 'data/parts-words/words').catch(() => ({ ayahs: {} }));
  return WORDS;
}
async function ensureHadith() {
  if (HAD) return HAD;
  HAD = await loadParts('data/hadith.parts.json', 'data/parts-hadith/hadith').catch(() => null);
  return HAD;
}
function wordEntry(g) { return (WORDS && WORDS.ayahs && WORDS.ayahs[g]) || null; }

/* ---------------- boot ---------------- */
(async function boot() {
  try {
    Q = await loadParts('data/quran.parts.json', 'data/parts/quran');
  } catch (e) {
    document.body.innerHTML = '<p style="padding:20px">Could not load the Quran data files. If you opened this page as a local file, please serve the folder with a small local server instead — see README.</p>';
    return;
  }
  sel = { ...lastPos };
  detailSi = sel.s;
  applySettings();
  buildPracticeSelectors();
  renderReader();
  renderHome();
  $('engineVer').textContent = window.TilawahEngine ? TilawahEngine.ENGINE_VERSION : 'engine missing';
  updateOfflineBadge(); updateStorageInfo();
  ensureWords();              // background: makes word tap/hold instant
  ensureHadith().then(renderDailyPreview);
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();

/* ---------------- settings ---------------- */
function applySettings() {
  document.body.dataset.theme = settings.theme;
  document.documentElement.style.setProperty('--arabic-size', settings.fontSize + 'px');
  $('themeSel').value = settings.theme; $('fontSizeRange').value = settings.fontSize;
  $('fontSizeVal').textContent = settings.fontSize + 'px';
  $('reciterSel').value = settings.reciter; $('showTransChk').checked = settings.showTrans;
  $('transLangSel').value = settings.translation; $('transAudioSel').value = settings.transAudio;
  $('keepRecordingsChk').checked = settings.keepRecordings; $('speedSel').value = String(settings.speed);
  $('reciterName').textContent = $('reciterSel').selectedOptions[0].textContent;
  save('tilawah.settings.v1', settings);
}
$('themeSel').addEventListener('change', e => { settings.theme = e.target.value; applySettings(); });
$('fontSizeRange').addEventListener('input', e => { settings.fontSize = +e.target.value; applySettings(); });
$('reciterSel').addEventListener('change', e => { settings.reciter = e.target.value; applySettings(); stopAudio(); });
$('showTransChk').addEventListener('change', e => { settings.showTrans = e.target.checked; applySettings(); renderTranslation(); });
$('transLangSel').addEventListener('change', e => { settings.translation = e.target.value; applySettings(); renderTranslation(); if (currentView === 'surah') renderSurahDetail(); if (currentView === 'practice') renderPassage(); });
$('transAudioSel').addEventListener('change', e => { settings.transAudio = e.target.value; applySettings(); });
$('keepRecordingsChk').addEventListener('change', e => { settings.keepRecordings = e.target.checked; applySettings(); });
$('speedSel').addEventListener('change', e => { settings.speed = +e.target.value; applySettings(); audioEl.playbackRate = settings.speed; });
$('resetBtn').addEventListener('click', async () => {
  if (!confirm('Reset all Tilawah settings, bookmarks, history and saved recordings on this device?')) return;
  localStorage.removeItem('tilawah.settings.v1'); localStorage.removeItem('tilawah.bookmarks.v1');
  localStorage.removeItem('tilawah.history.v1'); localStorage.removeItem('tilawah.lastPos.v1');
  localStorage.removeItem('tilawah.listen.v1'); localStorage.removeItem('tilawah.lastListen.v1');
  localStorage.removeItem('tilawah.hifz.v1'); localStorage.removeItem('tilawah.reciter.v4');
  await idbClear().catch(() => {}); location.reload();
});
$('clearCacheBtn').addEventListener('click', async () => { await caches.delete(AUDIO_CACHE); $('storageInfo').textContent = 'Audio cache cleared.'; });

async function updateStorageInfo() {
  if (navigator.storage && navigator.storage.estimate) {
    const est = await navigator.storage.estimate();
    $('storageInfo').textContent = `Storage used by this app on this device: ${((est.usage || 0) / 1048576).toFixed(1)} MB of ${((est.quota || 0) / 1073741824).toFixed(1)} GB available.`;
  }
}

/* ---------------- home ---------------- */
function renderHome() {
  if (!Q) return;
  const lp = Q.surahs[lastPos.s];
  $('lastPositionText').textContent = lp ? `Last read: Surah ${lp.number} ${lp.en}, Ayah ${lastPos.a}` : '';
  const scored = history.filter(h => typeof h.score === 'number');
  const avg = scored.length ? Math.round(scored.reduce((a, h) => a + h.score, 0) / scored.length) : '—';
  $('homeStats').innerHTML = [
    ['Bookmarks', bookmarks.length], ['Practice sessions', history.length],
    ['Average alignment score', avg], ['Surahs', 114], ['Ayahs', 6236]
  ].map(([k, v]) => `<div class="stat"><b>${v}</b>${k}</div>`).join('');

  const sort = $('homeSurahSort').value;
  let list = Q.surahs.slice();
  if (sort === 'name') list.sort((a, b) => a.en.localeCompare(b.en));
  $('surahList').innerHTML = list.map(s =>
    `<button class="surah-item" data-s="${s.number - 1}"><span><b>${s.number}.</b> ${esc(s.en)} <span class="muted small">${esc(s.tr)} · ${s.ayahs.length} ayahs · ${s.rev}</span></span><span class="ar">${esc(s.name)}</span></button>`).join('');
  $('surahList').querySelectorAll('.surah-item').forEach(b => b.addEventListener('click', () => openSurahDetail(+b.dataset.s)));

  // Juz ranges, computed from the verified per-ayah juz metadata — nothing hard-coded
  const juzMap = {};
  Q.surahs.forEach((s, si) => s.ayahs.forEach(a => {
    if (!juzMap[a.j]) juzMap[a.j] = { first: { si, n: a.n, en: s.en }, count: 0 };
    juzMap[a.j].count++;
    juzMap[a.j].last = { si, n: a.n, en: s.en };
  }));
  $('juzList').innerHTML = Object.keys(juzMap).sort((a, b) => a - b).map(j => {
    const r = juzMap[j];
    return `<div class="juz-row"><div><b>Para ${j}</b> <span class="muted small">· ${r.count} ayahs · starts at ${esc(r.first.en)} ${r.first.n}</span></div>
      <span class="row"><button class="btn btn-small" data-jread="${j}">Read</button><button class="btn btn-small btn-primary" data-jplay="${j}">▶ Play Para</button></span></div>`;
  }).join('');
  $('juzList').querySelectorAll('[data-jread]').forEach(b => b.addEventListener('click', () => { const r = juzMap[b.dataset.jread]; openReader(r.first.si, r.first.n); }));
  $('juzList').querySelectorAll('[data-jplay]').forEach(b => b.addEventListener('click', () => playJuz(+b.dataset.jplay)));

  $('bookmarkList').innerHTML = bookmarks.length ? bookmarks.map(g => {
    const ref = findByGlobal(g);
    return `<div class="list-item"><span>🔖 <b>${esc(ref.s.en)} ${ref.a.n}</b> — <span class="muted">${esc(ref.a.t.slice(0, 60))}…</span></span><span><button class="btn btn-small" data-open="${g}">Open</button> <button class="btn btn-small" data-del="${g}">Remove</button></span></div>`;
  }).join('') : '<p class="muted">No bookmarks yet. Open a surah, tap an ayah, then “Bookmark ayah”.</p>';
  $('bookmarkList').querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => { const r = findByGlobal(+b.dataset.open); openReader(r.si, r.a.n); }));
  $('bookmarkList').querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { bookmarks = bookmarks.filter(x => x !== +b.dataset.del); save('tilawah.bookmarks.v1', bookmarks); renderHome(); }));
}
$('homeSurahSort').addEventListener('change', renderHome);
$('continueBtn').addEventListener('click', () => openReader(lastPos.s, lastPos.a));
$('resumePracticeBtn').addEventListener('click', () => { setPractice(lastPos.s, lastPos.a, lastPos.a); showView('practice'); });
$('heroHadithBtn').addEventListener('click', () => showView('hadith'));

function findByGlobal(g) {
  for (let si = 0; si < Q.surahs.length; si++) { const a = Q.surahs[si].ayahs.find(x => x.g === g); if (a) return { si, s: Q.surahs[si], a }; }
  return null;
}
function juzAyahs(j) {
  const list = [];
  Q.surahs.forEach((s, si) => s.ayahs.forEach(a => { if (a.j === j) list.push({ si, a: a.n }); }));
  return list;
}

let searchTimer = null;
$('searchInput').addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => doSearch(e.target.value.trim()), 200);
});
function doSearch(q) {
  const box = $('searchResults'); if (!q) { box.innerHTML = ''; return; }
  const hits = [];
  const ql = q.toLowerCase();
  Q.surahs.forEach((s, si) => { if (s.en.toLowerCase().includes(ql) || String(s.number) === q) hits.push({ type: 'surah', si, s }); });
  for (let si = 0; si < Q.surahs.length && hits.length < 25; si++) {
    for (const a of Q.surahs[si].ayahs) {
      if (hits.length >= 25) break;
      if (a.t.includes(q) || [a.e, a.a, a.u, a.s].some(t => t && t.toLowerCase().includes(ql))) hits.push({ type: 'ayah', si, s: Q.surahs[si], a });
    }
  }
  box.innerHTML = hits.map((h, i) => h.type === 'surah'
    ? `<div class="search-hit" data-i="${i}"><b>Surah ${h.s.number}: ${esc(h.s.en)}</b> <span class="muted">${esc(h.s.tr)}</span></div>`
    : `<div class="search-hit" data-i="${i}"><b>${esc(h.s.en)} ${h.a.n}</b> · <span class="ar">${esc(h.a.t.slice(0, 70))}…</span><br><span class="muted">${esc(transText(h.a).slice(0, 90))}…</span></div>`).join('') || '<p class="muted">No matches.</p>';
  box.querySelectorAll('.search-hit').forEach((el, i) => el.addEventListener('click', () => { const h = hits[i]; openReader(h.si, h.type === 'ayah' ? h.a.n : 1); }));
}

/* ---------------- reader ---------------- */
function openReader(si, n) { sel = { s: si, a: n }; lastPos = { ...sel }; save('tilawah.lastPos.v1', lastPos); renderReader(); showView('reader'); }
function selectAyah(si, n, scroll) {
  sel = { s: si, a: n }; lastPos = { ...sel }; save('tilawah.lastPos.v1', lastPos);
  if (si === sel.s) renderReader();
  if (scroll) { const el = $('ayahFlow').querySelector(`.ayah[data-n="${n}"]`); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
}
function renderReader() {
  const s = surah();
  $('surahTitle').textContent = s.name;
  const a = ayahOf(sel.s, sel.a);
  $('surahMeta').textContent = `Surah ${s.number} · ${s.en} — ${s.tr} · ${s.rev} · ${s.ayahs.length} ayahs` + (a ? ` · Selected ayah ${a.n}: Juz ${a.j}, Page ${a.p}, Ruku ${a.r}, Hizb quarter ${a.h}` : '');
  $('gotoAyah').max = s.ayahs.length; $('gotoAyah').value = sel.a;
  // The Uthmani source text already contains the Basmala inside ayah 1 (except Surah 9;
  // Surah 1 ayah 1 IS the Basmala) — text is shown exactly as distributed, no header duplicate.
  $('basmala').hidden = true;
  $('ayahFlow').innerHTML = s.ayahs.map(x => {
    const words = x.t.split(/\s+/).filter(Boolean).map((t, i) => `<span class="qword" data-t="${i}">${tajTokenHtml(x, t, i)}</span>`).join(' ');
    return `<span class="ayah${x.n === sel.a ? ' selected' : ''}" data-n="${x.n}">${words} <span class="marker" data-marker="${x.n}" title="Ayah ${x.n} details">﴿${x.n}﴾</span></span>`;
  }).join(' ');
  const selEl = $('ayahFlow').querySelector('.ayah.selected');
  if (selEl) selEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (PB.cur && PB.cur.si === sel.s) markPlayingAyah();
  renderTranslation(); updatePlayerLabel();
}
function renderTranslation() {
  const a = ayahOf(sel.s, sel.a);
  if (!settings.showTrans || !a) { $('translationBox').textContent = ''; return; }
  $('translationBox').dir = transIsRTL() ? 'rtl' : 'ltr';
  if (isPackTrans()) {
    const packId = settings.translation.slice(3);
    const key = packId + '|' + a.g;
    if (PACK_CACHE.has(key)) { $('translationBox').textContent = `${surah().en} ${a.n} — ${PACK_CACHE.get(key)}`; return; }
    $('translationBox').textContent = 'Loading online translation…';
    fetch(`https://api.alquran.cloud/v1/ayah/${a.g}/${packId}`)
      .then(r => r.json())
      .then(j => {
        const txt = j && j.data && j.data.text;
        if (txt) {
          PACK_CACHE.set(key, txt);
          const cur = ayahOf(sel.s, sel.a);
          if (settings.showTrans && isPackTrans() && cur && (settings.translation.slice(3) + '|' + cur.g) === key) $('translationBox').textContent = `${surah().en} ${cur.n} — ${txt}`;
        } else $('translationBox').textContent = 'The online translation could not be loaded for this ayah.';
      })
      .catch(() => { $('translationBox').textContent = 'Online translations need an internet connection — the four bundled translations work offline.'; });
    return;
  }
  $('translationBox').textContent = `${surah().en} ${a.n} — ${transText(a)}`;
}
$('gotoBtn').addEventListener('click', () => { const n = Math.min(Math.max(1, +$('gotoAyah').value || 1), surah().ayahs.length); selectAyah(sel.s, n, true); renderReader(); });
$('prevSurahBtn').addEventListener('click', () => { if (sel.s > 0) openReader(sel.s - 1, 1); });
$('nextSurahBtn').addEventListener('click', () => { if (sel.s < 113) openReader(sel.s + 1, 1); });
$('readerSurahDetailBtn').addEventListener('click', () => openSurahDetail(sel.s));
$('bookmarkBtn').addEventListener('click', () => {
  const g = ayahOf(sel.s, sel.a).g;
  if (!bookmarks.includes(g)) { bookmarks.push(g); save('tilawah.bookmarks.v1', bookmarks); $('playerStatus').textContent = 'Bookmarked — find it on Home.'; }
  else $('playerStatus').textContent = 'Already bookmarked.';
});
$('practiceBtn').addEventListener('click', () => { setPractice(sel.s, sel.a, sel.a); showView('practice'); });
$('ayahDetailBtn').addEventListener('click', () => openAyahSheet(sel.s, sel.a));
$('downloadAudioBtn').addEventListener('click', () => downloadSurahAudio(sel.s, $('downloadAudioStatus')));

async function downloadSurahAudio(si, statusEl) {
  const s = Q.surahs[si]; const cache = await caches.open(AUDIO_CACHE); let done = 0;
  statusEl.textContent = `Downloading 0/${s.ayahs.length}…`;
  for (const a of s.ayahs) {
    const u = audioUrlFor(si, a.n, a.g); try { const r = await fetch(u); if (r.ok) await cache.put(u, r.clone()); } catch (e) {}
    done++; statusEl.textContent = `Downloading ${done}/${s.ayahs.length}…`;
  }
  statusEl.textContent = `Surah ${s.en} audio cached for offline use (${done}/${s.ayahs.length}).`;
}

/* ---- word interactions in the reader: tap = hear the word,
        press & hold = word detail sheet, marker tap = ayah details ---- */
let holdTimer = null, holdFiredAt = 0;
$('ayahFlow').addEventListener('contextmenu', e => e.preventDefault());
$('ayahFlow').addEventListener('pointerdown', e => {
  const w = e.target.closest('.qword');
  if (!w) return;
  const ayahEl = w.closest('.ayah');
  const si = sel.s, a = +ayahEl.dataset.n, tokenIdx = +w.dataset.t;
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => {
    holdFiredAt = Date.now();
    const entry = wordEntry(ayahOf(si, a).g);
    const wi = entry ? playableIndexForToken(entry, tokenIdx) : -1;
    openWordSheet(si, a, wi, tokenIdx);
  }, 550);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => $('ayahFlow').addEventListener(ev, () => clearTimeout(holdTimer)));
$('ayahFlow').addEventListener('click', e => {
  if (Date.now() - holdFiredAt < 700) return;   // the hold already opened the sheet
  const marker = e.target.closest('.marker');
  if (marker) { openAyahSheet(sel.s, +marker.dataset.marker); return; }
  const w = e.target.closest('.qword');
  const ayahEl = e.target.closest('.ayah');
  if (!ayahEl) return;
  const a = +ayahEl.dataset.n;
  if (a !== sel.a) selectAyah(sel.s, a, false), renderReader();
  if (w) {
    const entry = wordEntry(ayahOf(sel.s, a).g);
    if (entry) playSingleWord(sel.s, a, playableIndexForToken(entry, +w.dataset.t));
    else { $('playerStatus').textContent = 'Word-by-word data is not available for this ayah — playing the whole ayah.'; playAyahMode(); }
  }
});
function playableIndexForToken(entry, tokenIdx) {
  let wi = 0;
  for (let j = 0; j < entry.m.length; j++) { if (entry.m[j] <= tokenIdx) wi = j; else break; }
  return wi;
}
function tokenRangeForWord(entry, wi, tokenCount) {
  const start = entry.m[wi];
  const end = (wi + 1 < entry.m.length ? entry.m[wi + 1] : tokenCount) - 1;
  return [start, Math.max(start, end)];
}

/* ================= playback engine =================
   One audio element, one state machine. Modes:
   - 'ayah' : single ayah with repeat + optional auto-advance (reader default)
   - 'queue': a list of ayahs (whole surah / whole juz / practice reference)
   - 'wbw'  : word-by-word clips of one ayah, played in sequence
   - 'word' : a single word clip (tap a word)
   Highlighting always follows the audio: the playing ayah gets .playing;
   the spoken word gets .speaking — via Alafasy word timings when the
   selected reciter is Alafasy, exactly in word modes. */
const audioEl = $('audioEl');
const PB = { mode: 'idle', queue: [], qi: 0, label: '', ref: false, repeatLeft: 1, wbw: null, cur: null, segWord: -1, trans: false };
let rafId = 0;

function updatePlayerLabel() {
  const a = ayahOf(sel.s, sel.a);
  $('nowPlaying').textContent = a ? `${surah().en} — Ayah ${a.n} of ${surah().ayahs.length}` : 'No ayah selected';
}
function setModeChip(text) { const c = $('modeChip'); c.hidden = !text; c.textContent = text || ''; }
function markPlayingAyah() {
  document.querySelectorAll('#ayahFlow .ayah.playing').forEach(el => el.classList.remove('playing'));
  if (!PB.cur) return;
  const el = $('ayahFlow').querySelector(`.ayah[data-n="${PB.cur.a}"]`);
  if (el) el.classList.add('playing');
}
function clearWordHighlights() { document.querySelectorAll('#ayahFlow .qword.speaking').forEach(el => el.classList.remove('speaking')); }
function highlightWord(si, a, entry, wi, scroll) {
  clearWordHighlights();
  if (sel.s !== si) return;
  const ayahEl = $('ayahFlow').querySelector(`.ayah[data-n="${a}"]`);
  if (!ayahEl) return;
  const tokenCount = ayahOf(si, a).t.split(/\s+/).filter(Boolean).length;
  const [t0, t1] = tokenRangeForWord(entry, wi, tokenCount);
  let first = null;
  ayahEl.querySelectorAll('.qword').forEach(el => {
    const t = +el.dataset.t;
    if (t >= t0 && t <= t1) { el.classList.add('speaking'); if (!first) first = el; }
  });
  if (scroll && first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function clearPlaybackMarks() {
  clearWordHighlights();
  document.querySelectorAll('#ayahFlow .ayah.playing').forEach(el => el.classList.remove('playing'));
}
function stopAudio() {
  cancelAnimationFrame(rafId);
  audioEl.pause();
  PB.mode = 'idle'; PB.queue = []; PB.qi = 0; PB.wbw = null; PB.cur = null; PB.segWord = -1; PB.ref = false; PB.trans = false;
  setModeChip('');
  clearPlaybackMarks();
  $('audioProgress').value = 0;
  updatePlayerLabel();
}
function startPlaybackUI() {
  updatePlayerLabel();
  markPlayingAyah();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(progressLoop);
}
function progressLoop() {
  if (audioEl.paused || PB.mode === 'idle') return;
  if ((PB.mode === 'ayah' || PB.mode === 'queue') && audioEl.duration) {
    $('audioProgress').value = audioEl.currentTime / audioEl.duration;
    maybeSegmentHighlight();
  }
  rafId = requestAnimationFrame(progressLoop);
}
/* Word-level highlight from the reference recording's word timings.
   Timings are verified for Mishary Alafasy only, and describe the ayah
   body (the merged Basmala prefix of ayah 1 has no timings) — in those
   cases, and for other reciters, the whole ayah stays highlighted and
   the status line says so. Nothing is faked. */
function maybeSegmentHighlight() {
  if (!PB.cur || PB.trans) return;
  const { si, a } = PB.cur;
  if (settings.reciter !== 'ar.alafasy') return;
  const entry = wordEntry(ayahOf(si, a).g);
  if (!entry || !entry.s || entry.b) return;
  const ms = audioEl.currentTime * 1000;
  let wi = -1;
  for (let j = 0; j < entry.s.length; j++) { if (ms >= entry.s[j][0]) wi = j; else break; }
  if (wi >= 0 && wi !== PB.segWord) { PB.segWord = wi; highlightWord(si, a, entry, wi, true); }
}
function segHighlightPossible(si, a) {
  const entry = wordEntry(ayahOf(si, a).g);
  return settings.reciter === 'ar.alafasy' && !!entry && !!entry.s && !entry.b;
}

function playCurrentAyahSrc() {
  const a = ayahOf(PB.cur.si, PB.cur.a);
  audioEl.src = audioUrlFor(PB.cur.si, PB.cur.a, a.g);
  audioEl.playbackRate = settings.speed;
  audioEl.play().catch(() => setStatus('Could not play audio — check your connection (audio caches after the first successful play).'));
  PB.segWord = -1;
}
function setStatus(t) {
  if (PB.ref) $('refStatus').textContent = t; else $('playerStatus').textContent = t;
}
function playAyahMode() {
  stopAudioSoft();
  PB.mode = 'ayah'; PB.cur = { si: sel.s, a: sel.a }; PB.repeatLeft = +$('repeatSel').value;
  setModeChip('Ayah');
  playCurrentAyahSrc(); startPlaybackUI();
  setStatus(segHighlightPossible(sel.s, sel.a) ? 'Playing — words light up as they are spoken.' : 'Playing.');
}
function playQueue(list, label, opts) {
  opts = opts || {};
  stopAudioSoft();
  PB.mode = 'queue'; PB.queue = list.slice(); PB.qi = 0; PB.label = label; PB.ref = !!opts.ref;
  PB.cur = { ...list[0] };
  sel = { s: PB.cur.si, a: PB.cur.a }; lastPos = { ...sel }; save('tilawah.lastPos.v1', lastPos);
  setModeChip(label);
  if (currentView === 'reader') renderReader();
  playCurrentAyahSrc(); startPlaybackUI();
  setStatus(`${label}: ayah 1 of ${list.length} — ${Q.surahs[PB.cur.si].en} ${PB.cur.a}. The text follows the audio.`);
  if (opts.ref) $('refStatus').textContent = 'Reference playing…';
}
function playSurahFrom(si, fromAyah) {
  const list = Q.surahs[si].ayahs.filter(x => x.n >= fromAyah).map(x => ({ si, a: x.n }));
  if (currentView !== 'reader') showView('reader');
  playQueue(list, `Surah ${Q.surahs[si].en}`);
}
function playJuz(j) {
  const list = juzAyahs(j);
  if (!list.length) return;
  if (currentView !== 'reader') showView('reader');
  playQueue(list, `Para ${j}`);
}
function wbwFileFor(si, a, entry, wi) {
  // File positions exclude the merged Basmala prefix; its words use Surah 1 Ayah 1's files.
  if (entry.b && wi < entry.b) return wbwUrl(1, 1, wi + 1);
  return wbwUrl(si + 1, a, wi - (entry.b || 0) + 1);
}
function playWordFile() {
  const { si, a, entry, idx } = PB.wbw;
  audioEl.src = wbwFileFor(si, a, entry, idx);
  audioEl.playbackRate = settings.speed;
  audioEl.play().catch(() => { setStatus('Could not play the word audio — check your connection.'); PB.mode = 'idle'; });
  $('audioProgress').value = idx / entry.m.length;
  PB.cur = { si, a };
  markPlayingAyah();
  highlightWord(si, a, entry, idx, true);
}
function startWbw(si, a, fromWord) {
  const ay = ayahOf(si, a);
  if (!ay) return false;
  const entry = wordEntry(ay.g);
  if (!entry) { setStatus('Word-by-word is not available for this ayah — it uses whole-ayah playback instead. Nothing is faked.'); return false; }
  stopAudioSoft();
  sel = { s: si, a }; lastPos = { ...sel }; save('tilawah.lastPos.v1', lastPos);
  if (currentView === 'reader') renderReader();
  PB.mode = 'wbw'; PB.wbw = { si, a, entry, idx: fromWord || 0 };
  setModeChip('Word by word');
  playWordFile(); startPlaybackUI();
  setStatus(`Word by word — ${Q.surahs[si].en} ${a}: each word is played and highlighted in turn.`);
  return true;
}
function playSingleWord(si, a, wi) {
  const ay = ayahOf(si, a);
  if (!ay) return;
  const entry = wordEntry(ay.g);
  if (!entry || wi < 0) return;
  stopAudioSoft();
  PB.mode = 'word'; PB.wbw = { si, a, entry, idx: wi };
  setModeChip('Word');
  playWordFile(); startPlaybackUI();
  const meta = entry.w[wi];
  setStatus(`Word: ${meta ? meta[0] + ' — ' + meta[1] : ''} (press & hold the word for full details)`);
}
function stopAudioSoft() {
  // Like stopAudio but keeps the player's own status/label (callers set fresh ones).
  cancelAnimationFrame(rafId);
  audioEl.pause();
  PB.mode = 'idle'; PB.queue = []; PB.qi = 0; PB.wbw = null; PB.cur = null; PB.segWord = -1; PB.ref = false; PB.trans = false;
  clearPlaybackMarks();
}
function maybePlayTranslation() {
  // Quran Pen style: after the Arabic ayah, read its spoken translation once,
  // then let the normal advance/repeat/finish logic run on the next 'ended'.
  if (!settings.transAudio || PB.ref || PB.trans) return false;
  const cur = PB.mode === 'ayah' ? { si: sel.s, a: sel.a } : PB.cur;
  if (!cur) return false;
  PB.trans = true;
  clearWordHighlights(); PB.segWord = -1;
  audioEl.src = transAudioUrl(ayahOf(cur.si, cur.a).g);
  audioEl.playbackRate = settings.speed;
  audioEl.play().catch(() => { PB.trans = false; audioEl.dispatchEvent(new Event('ended')); });
  setStatus(`Spoken translation (${TRANS_AUDIO[settings.transAudio].name}): ${Q.surahs[cur.si].en} ${cur.a}.`);
  startPlaybackUI();
  return true;
}
audioEl.addEventListener('ended', () => {
  if (PB.mode === 'word') {
    clearWordHighlights(); setModeChip(''); PB.mode = 'idle'; PB.wbw = null;
    setStatus('Word played. Tap another word, or press Play for the ayah.');
    return;
  }
  if (PB.mode === 'wbw') {
    const w = PB.wbw;
    if (w.idx + 1 < w.entry.m.length) { w.idx++; playWordFile(); return; }
    clearWordHighlights(); setModeChip(''); PB.mode = 'idle'; PB.wbw = null;
    setStatus('Word-by-word finished.');
    return;
  }
  if (PB.mode === 'ayah') {
    if (PB.trans) PB.trans = false;
    else if (maybePlayTranslation()) return;
    if (PB.repeatLeft > 1) { PB.repeatLeft--; playCurrentAyahSrc(); startPlaybackUI(); return; }
    if ($('autoAdvanceChk').checked && sel.a < surah().ayahs.length) {
      sel = { s: sel.s, a: sel.a + 1 }; lastPos = { ...sel }; save('tilawah.lastPos.v1', lastPos);
      PB.cur = { ...sel }; PB.repeatLeft = +$('repeatSel').value;
      renderReader(); playCurrentAyahSrc(); startPlaybackUI();
      setStatus(segHighlightPossible(sel.s, sel.a) ? 'Playing — words light up as they are spoken.' : 'Playing.');
      return;
    }
    PB.mode = 'idle'; setModeChip(''); setStatus('Finished.');
    return;
  }
  if (PB.mode === 'queue') {
    if (PB.trans) PB.trans = false;
    else if (maybePlayTranslation()) return;
    if (PB.qi + 1 < PB.queue.length) {
      PB.qi++;
      PB.cur = { ...PB.queue[PB.qi] };
      sel = { s: PB.cur.si, a: PB.cur.a }; lastPos = { ...sel }; save('tilawah.lastPos.v1', lastPos);
      if (currentView === 'reader') renderReader();
      playCurrentAyahSrc(); startPlaybackUI();
      setStatus(`${PB.label}: ayah ${PB.qi + 1} of ${PB.queue.length} — ${Q.surahs[PB.cur.si].en} ${PB.cur.a}.`);
      return;
    }
    const wasRef = PB.ref, label = PB.label;
    PB.mode = 'idle'; PB.ref = false; setModeChip(''); clearPlaybackMarks();
    if (wasRef) $('refStatus').textContent = 'Reference finished.';
    else $('playerStatus').textContent = `${label} finished.`;
  }
});
audioEl.addEventListener('error', () => {
  if (PB.mode !== 'idle') setStatus('Audio failed to load — you may be offline and this audio is not cached yet.');
});
$('playBtn').addEventListener('click', playAyahMode);
$('playSurahBtn').addEventListener('click', () => playSurahFrom(sel.s, sel.a));
$('wbwBtn').addEventListener('click', async () => { await ensureWords(); if (!startWbw(sel.s, sel.a, 0)) playAyahMode(); });
$('pauseBtn').addEventListener('click', () => { if (audioEl.paused) { audioEl.play().catch(() => {}); startPlaybackUI(); } else audioEl.pause(); });
$('stopBtn').addEventListener('click', () => { stopAudio(); $('playerStatus').textContent = 'Stopped.'; });

/* ---------------- detail sheets (word / ayah) ---------------- */
function showSheet(html) { $('sheetContent').innerHTML = html; $('sheetBackdrop').hidden = false; $('wordSheet').hidden = false; }
function hideSheet() { $('sheetBackdrop').hidden = true; $('wordSheet').hidden = true; }
$('sheetBackdrop').addEventListener('click', hideSheet);

function wordTextOf(si, a, entry, wi) {
  const tokens = ayahOf(si, a).t.split(/\s+/).filter(Boolean);
  const [t0, t1] = tokenRangeForWord(entry, wi, tokens.length);
  return tokens.slice(t0, t1 + 1).join(' ');
}
function openWordSheet(si, a, wi, tokenIdx) {
  const ay = ayahOf(si, a);
  const entry = wordEntry(ay.g);
  const tokens = ay.t.split(/\s+/).filter(Boolean);
  let head, meta;
  if (entry && wi >= 0) {
    head = wordTextOf(si, a, entry, wi);
    const m = entry.w[wi] || ['', ''];
    meta = `<p class="sheet-translit">${esc(m[0] || '')}</p><p class="sheet-trans">${esc(m[1] || '')}</p>`;
  } else {
    head = tokens[tokenIdx] || '';
    meta = '<p class="muted small">Word-by-word data is not available for this ayah, so no meaning can be shown without guessing. Whole-ayah audio still works.</p>';
  }
  showSheet(`
    <p class="muted small">${esc(Q.surahs[si].en)} · Ayah ${a}${entry && wi >= 0 ? ` · Word ${wi + 1} of ${entry.m.length}` : ''}</p>
    <p class="sheet-word arabic" dir="rtl" lang="ar">${esc(head)}</p>
    ${meta}
    <div class="row wrap">
      ${entry && wi >= 0 ? `<button class="btn btn-primary" id="shPlayWord">▶ Play this word</button>
      <button class="btn" id="shWbw">Word by word from here</button>` : ''}
      <button class="btn" id="shPlayAyah">▶ Play ayah</button>
      <button class="btn" id="shAyah">Ayah details</button>
      <button class="btn" id="shClose">Close</button>
    </div>`);
  if (entry && wi >= 0) {
    $('shPlayWord').addEventListener('click', () => { hideSheet(); playSingleWord(si, a, wi); });
    $('shWbw').addEventListener('click', () => { hideSheet(); if (currentView !== 'reader') showView('reader'); startWbw(si, a, wi); });
  }
  $('shPlayAyah').addEventListener('click', () => { hideSheet(); sel = { s: si, a }; if (currentView !== 'reader') openReader(si, a); else { renderReader(); } playAyahMode(); });
  $('shAyah').addEventListener('click', () => openAyahSheet(si, a));
  $('shClose').addEventListener('click', hideSheet);
}
function openAyahSheet(si, a) {
  const ay = ayahOf(si, a);
  const s = Q.surahs[si];
  const entry = wordEntry(ay.g);
  const tokens = ay.t.split(/\s+/).filter(Boolean);
  const wordsHtml = entry ? `<div class="sheet-words" dir="rtl" lang="ar">${entry.m.map((m, wi) => `<button class="wchip-btn arabic" data-wi="${wi}">${esc(wordTextOf(si, a, entry, wi))}</button>`).join('')}</div>
    <p class="muted small">Tap a word to hear it · each word's transliteration &amp; meaning are in the reader (press &amp; hold a word there) and below the practice result.</p>`
    : '<p class="muted small">Word-by-word data is not available for this ayah (one of 3 ayahs out of 6,236 where the verified segmentation could not be matched) — it honestly falls back to whole-ayah playback.</p>';
  showSheet(`
    <p class="muted small">Surah ${s.number} · ${esc(s.en)} — ${esc(s.tr)} · ${esc(s.rev)}</p>
    <h3 class="sheet-ayah-title">Ayah ${a}</h3>
    <p class="sheet-ayah-ar arabic" dir="rtl" lang="ar">${esc(ay.t)}</p>
    <p class="sheet-trans" dir="${transIsRTL() ? 'rtl' : 'ltr'}">${esc(transText(ay))}</p>
    <div class="chip-grid">
      <span class="chip">Juz (Para) <b>${ay.j}</b></span><span class="chip">Mushaf page <b>${ay.p}</b></span>
      <span class="chip">Ruku <b>${ay.r}</b></span><span class="chip">Hizb quarter <b>${ay.h}</b></span>
      <span class="chip">Words <b>${tokens.length}</b></span><span class="chip">Global ayah <b>${ay.g}</b> of 6,236</span>
    </div>
    ${wordsHtml}
    <div class="row wrap" style="margin-top:12px">
      <button class="btn btn-primary" id="shPlayAyah2">▶ Play ayah</button>
      ${entry ? '<button class="btn" id="shWbw2">Word by word</button>' : ''}
      <button class="btn" id="shTafsir">Tafsir</button>
      <button class="btn" id="shRead">Open in reader</button>
      <button class="btn" id="shPractice">Practice this ayah</button>
      <button class="btn" id="shClose2">Close</button>
    </div>`);
  $('sheetContent').querySelectorAll('[data-wi]').forEach(b => b.addEventListener('click', () => { hideSheet(); playSingleWord(si, a, +b.dataset.wi); }));
  $('shPlayAyah2').addEventListener('click', () => { hideSheet(); sel = { s: si, a }; if (currentView !== 'reader') openReader(si, a); else renderReader(); playAyahMode(); });
  const wb = $('shWbw2'); if (wb) wb.addEventListener('click', () => { hideSheet(); if (currentView !== 'reader') openReader(si, a); startWbw(si, a, 0); });
  $('shTafsir').addEventListener('click', () => { hideSheet(); openTafsir(si, a); });
  $('shRead').addEventListener('click', () => { hideSheet(); openReader(si, a); });
  $('shPractice').addEventListener('click', () => { hideSheet(); setPractice(si, a, a); showView('practice'); });
  $('shClose2').addEventListener('click', hideSheet);
}

/* ---------------- surah detail page ---------------- */
function openSurahDetail(si) { detailSi = si; showView('surah'); }
function renderSurahDetail() {
  if (!Q) return;
  const s = Q.surahs[detailSi];
  $('detailMedallion').textContent = s.number;
  $('detailNameAr').textContent = s.name;
  $('detailNameEn').textContent = `Surah ${s.number} · ${s.en}`;
  $('detailMeaning').textContent = s.tr;
  const juzs = [...new Set(s.ayahs.map(x => x.j))];
  const rukus = new Set(s.ayahs.map(x => x.r)).size;
  $('detailMeta').innerHTML = [
    ['Revelation', s.rev], ['Ayahs', s.ayahs.length],
    ['Para (Juz)', juzs.length > 1 ? `${juzs[0]}–${juzs[juzs.length - 1]}` : juzs[0]],
    ['Starts on page', s.ayahs[0].p], ['Rukus', rukus],
    ['Global ayahs', `${s.ayahs[0].g}–${s.ayahs[s.ayahs.length - 1].g}`]
  ].map(([k, v]) => `<span class="chip">${k} <b>${v}</b></span>`).join('');
  $('detailStatus').textContent = '';
  $('detailAyahList').innerHTML = s.ayahs.map(x => `
    <div class="detail-ayah" data-n="${x.n}">
      <span class="ayah-badge">${x.n}</span>
      <span class="detail-ayah-main">
        <span class="detail-ayah-ar arabic" dir="rtl" lang="ar">${esc(x.t.slice(0, 110))}${x.t.length > 110 ? '…' : ''}</span>
        <span class="muted small" dir="${transIsRTL() ? 'rtl' : 'ltr'}">${esc(transText(x).slice(0, 120))}${transText(x).length > 120 ? '…' : ''}${!transText(x) ? 'Online translation pack selected — translations load in the Reader.' : ''}</span>
        <span class="muted small">Juz ${x.j} · Page ${x.p} · Ruku ${x.r}</span>
      </span>
      <span class="detail-ayah-btns">
        <button class="btn btn-small btn-primary" data-act="play" title="Play this ayah">▶</button>
        <button class="btn btn-small" data-act="wbw" title="Word by word">Words</button>
        <button class="btn btn-small" data-act="info" title="Ayah details">Details</button>
      </span>
    </div>`).join('');
}
$('detailAyahList').addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  const row = e.target.closest('.detail-ayah');
  if (!row) return;
  const a = +row.dataset.n;
  if (!btn) { openReader(detailSi, a); return; }
  if (btn.dataset.act === 'play') { sel = { s: detailSi, a }; lastPos = { ...sel }; save('tilawah.lastPos.v1', lastPos); playAyahMode(); $('detailStatus').textContent = `Playing ${Q.surahs[detailSi].en} ${a} — open the Read page to watch the highlighting.`; }
  if (btn.dataset.act === 'wbw') { ensureWords().then(() => { if (!startWbw(detailSi, a, 0)) { sel = { s: detailSi, a }; playAyahMode(); } showView('reader'); }); }
  if (btn.dataset.act === 'info') openAyahSheet(detailSi, a);
});
$('detailPrevBtn').addEventListener('click', () => { if (detailSi > 0) { detailSi--; renderSurahDetail(); window.scrollTo({ top: 0 }); } });
$('detailNextBtn').addEventListener('click', () => { if (detailSi < 113) { detailSi++; renderSurahDetail(); window.scrollTo({ top: 0 }); } });
$('detailReadBtn').addEventListener('click', () => openReader(detailSi, 1));
$('detailPlayBtn').addEventListener('click', () => { showView('reader'); playSurahFrom(detailSi, 1); });
$('detailWbwBtn').addEventListener('click', async () => { await ensureWords(); showView('reader'); if (!startWbw(detailSi, 1, 0)) playSurahFrom(detailSi, 1); });
$('detailPracticeBtn').addEventListener('click', () => { setPractice(detailSi, 1, Math.min(3, Q.surahs[detailSi].ayahs.length)); showView('practice'); });
$('detailDownloadBtn').addEventListener('click', () => downloadSurahAudio(detailSi, $('detailStatus')));

/* ---------------- daily hadith ---------------- */
let hadithOffset = 0;
function hadithIndex(offset) {
  const days = Math.floor(Date.now() / 86400000) + offset;
  return ((days % 365) + 365) % 365;
}
async function renderDailyPreview() {
  const had = await ensureHadith();
  if (!had) { $('dailyPreview').innerHTML = '<p class="muted">Hadith data could not be loaded (it loads on first use when online, then works offline).</p>'; return; }
  const h = had.hadiths[hadithIndex(0)];
  $('dailyPreview').innerHTML = `<p class="hadith-text">${esc(h.en.slice(0, 220))}${h.en.length > 220 ? '…' : ''}</p>
    <p class="muted small">${esc(h.book)} · Hadith ${h.number}${h.section ? ' · ' + esc(h.section) : ''}</p>
    <button class="btn btn-small btn-primary" id="dailyOpenBtn">Read today's full hadith (Arabic + English)</button>`;
  $('dailyOpenBtn').addEventListener('click', () => { hadithOffset = 0; showView('hadith'); });
}
async function renderHadith() {
  const date = new Date(Date.now() + hadithOffset * 86400000);
  $('hadithDate').textContent = date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + (hadithOffset === 0 ? ' · Today' : '');
  const had = await ensureHadith();
  if (!had) { $('hadithCard').innerHTML = '<p class="muted">Hadith data could not be loaded. Connect to the internet once so it can download, after that it works offline.</p>'; return; }
  const h = had.hadiths[hadithIndex(hadithOffset)];
  $('hadithCard').innerHTML = `
    <div class="chip-grid">
      <span class="chip">Collection <b>${esc(h.book)}</b></span>
      <span class="chip">Hadith <b>${h.number}</b></span>
      ${h.section ? `<span class="chip">Book <b>${esc(h.section)}</b></span>` : ''}
    </div>
    <p class="hadith-text" style="margin-top:14px">${esc(h.en)}</p>
    ${h.ur ? `<details class="hadith-ar-box"><summary>Urdu translation (as published, with the chain of narration)</summary><p dir="rtl" lang="ur" style="font-size:17px;line-height:2">${esc(h.ur)}</p></details>` : ''}
    <details class="hadith-ar-box">
      <summary>Read the Arabic text (as published, with the chain of narration)</summary>
      <p class="arabic" dir="rtl" lang="ar">${esc(h.ar)}</p>
    </details>
    ${h.grades && h.grades.length ? `<p class="muted small">Grading: ${h.grades.map(g => esc((g.name ? g.name + ': ' : '') + (g.grade || ''))).join(' · ')}</p>` : ''}
    <p class="muted small">Source: ${esc(h.book)} ${h.number} — copied exactly from the published edition; nothing paraphrased or generated.</p>`;
}
$('hadithPrevBtn').addEventListener('click', () => { hadithOffset--; renderHadith(); });
$('hadithNextBtn').addEventListener('click', () => { hadithOffset++; renderHadith(); });
$('hadithTodayBtn').addEventListener('click', () => { hadithOffset = 0; renderHadith(); });
$('hadithRandomBtn').addEventListener('click', () => { hadithOffset = Math.floor(Math.random() * 365) - hadithIndex(0); renderHadith(); });

/* ---------------- practice ---------------- */
function buildPracticeSelectors() {
  $('pSurah').innerHTML = Q.surahs.map(s => `<option value="${s.number - 1}">${s.number}. ${esc(s.en)}</option>`).join('');
  $('pSurah').value = sel.s;
  fillAyahSelects(sel.s); setPractice(sel.s, sel.a, sel.a);
}
function fillAyahSelects(si) {
  const n = Q.surahs[si].ayahs.length;
  const opts = Array.from({ length: n }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  $('pFrom').innerHTML = opts; $('pTo').innerHTML = opts;
}
function setPractice(si, from, to) {
  $('pSurah').value = si; fillAyahSelects(si);
  $('pFrom').value = from; $('pTo').value = to;
  renderPassage(); resetResult();
}
function passage() {
  const si = +$('pSurah').value;
  let from = +$('pFrom').value, to = +$('pTo').value;
  if (to < from) [from, to] = [to, from];
  const ayahs = Q.surahs[si].ayahs.slice(from - 1, to);
  const words = [];
  ayahs.forEach(x => x.t.split(/\s+/).filter(Boolean).forEach(t => words.push({ text: t })));
  return { si, from, to, ayahs, words };
}
function renderPassage() {
  const p = passage();
  $('passageText').textContent = p.ayahs.map(x => `${x.t} ﴿${x.n}﴾`).join(' ');
  $('passageTranslation').textContent = isPackTrans() ? 'An online translation pack is selected — per-ayah translation text is shown in the Reader (fetched online, then cached).' : p.ayahs.map(x => transText(x)).join(' ');
  $('passageTranslation').dir = transIsRTL() ? 'rtl' : 'ltr';
  $('refStatus').textContent = `Reference: ${Q.surahs[p.si].en} ${p.from}–${p.to} (${p.words.length} words). Reciter: ${$('reciterSel').selectedOptions[0].textContent}`;
}
$('pSurah').addEventListener('change', () => { fillAyahSelects(+$('pSurah').value); $('pFrom').value = 1; $('pTo').value = 1; renderPassage(); resetResult(); });
$('pFrom').addEventListener('change', () => { renderPassage(); resetResult(); });
$('pTo').addEventListener('change', () => { renderPassage(); resetResult(); });
$('refPlayBtn').addEventListener('click', () => { const p = passage(); playQueue(p.ayahs.map(x => ({ si: p.si, a: x.n })), 'Reference', { ref: true }); });
$('refStopBtn').addEventListener('click', () => { stopAudio(); $('refStatus').textContent = 'Reference stopped.'; });

/* recording */
let mediaRecorder = null, mediaStream = null, recChunks = [], recBlob = null, recUrl = null;
let userAudio = null, recStart = 0, recTimerInt = null, analyser = null, waveAnim = 0;
$('recordBtn').addEventListener('click', async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $('recordStatus').textContent = 'Microphone is not available in this browser/context (HTTPS or localhost is required).'; return; }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) { $('recordStatus').textContent = 'Microphone permission was denied. Allow microphone access for this site, then try again.'; return; }
  recChunks = []; recBlob = null;
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
  mediaRecorder = new MediaRecorder(mediaStream, mime ? { mimeType: mime } : undefined);
  mediaRecorder.addEventListener('dataavailable', e => { if (e.data.size) recChunks.push(e.data); });
  mediaRecorder.addEventListener('stop', onRecStop);
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC(); analyser = ctx.createAnalyser(); analyser.fftSize = 256;
    ctx.createMediaStreamSource(mediaStream).connect(analyser);
    drawWave();
  } catch (e) { analyser = null; }
  mediaRecorder.start();
  recStart = Date.now();
  recTimerInt = setInterval(() => { $('recordTimer').textContent = fmtTime((Date.now() - recStart) / 1000); }, 250);
  $('recordBtn').disabled = true; $('stopRecordBtn').disabled = false;
  $('recordStatus').textContent = 'Recording… recite the passage shown above.';
});
$('stopRecordBtn').addEventListener('click', () => { if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); });
function onRecStop() {
  clearInterval(recTimerInt); cancelAnimationFrame(waveAnim);
  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
  recBlob = new Blob(recChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
  if (recUrl) URL.revokeObjectURL(recUrl);
  recUrl = URL.createObjectURL(recBlob);
  $('recordBtn').disabled = false; $('stopRecordBtn').disabled = true;
  $('playUserBtn').disabled = false; $('deleteUserBtn').disabled = false; $('analyzeBtn').disabled = false;
  $('recordStatus').textContent = `Recorded ${fmtTime((Date.now() - recStart) / 1000)}. Play it back, or press Analyse.`;
  const ctx = $('waveCanvas').getContext('2d'); ctx.clearRect(0, 0, 640, 90);
}
function drawWave() {
  const c = $('waveCanvas'), ctx = c.getContext('2d');
  const data = new Uint8Array(analyser.frequencyBinCount);
  (function frame() {
    waveAnim = requestAnimationFrame(frame);
    analyser.getByteTimeDomainData(data);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--card') || '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#0b6b4a'; ctx.lineWidth = 2; ctx.beginPath();
    const step = Math.ceil(data.length / c.width);
    for (let x = 0; x < c.width; x++) { const v = data[x * step] / 128 - 1; const y = 45 + v * 40; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
  })();
}
$('playUserBtn').addEventListener('click', () => { if (!recUrl) return; if (userAudio) userAudio.pause(); userAudio = new Audio(recUrl); userAudio.play().catch(() => {}); });
$('deleteUserBtn').addEventListener('click', () => {
  recBlob = null; if (recUrl) URL.revokeObjectURL(recUrl); recUrl = null;
  $('playUserBtn').disabled = true; $('deleteUserBtn').disabled = true; $('analyzeBtn').disabled = true;
  $('recordTimer').textContent = '0:00'; $('recordStatus').textContent = 'Recording deleted.';
});

/* analysis — reference audio is decoded from the same CDN files the
   player uses; both sides are resampled to 16 kHz for the engine. */
const decodeCtx = () => new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 1, 16000);
async function decodeBlobToPcm(blob) {
  const buf = await blob.arrayBuffer();
  const audio = await decodeCtx().decodeAudioData(buf);
  return { samples: audio.getChannelData(0), rate: audio.sampleRate };
}
const refCache = new Map();
async function fetchRefPcm(g, si, a) {
  const key = settings.reciter + '|' + g;
  if (refCache.has(key)) return refCache.get(key);
  const r = await fetch(audioUrlFor(si, a, g));
  if (!r.ok) throw new Error('reference fetch failed');
  const pcm = await decodeBlobToPcm(await r.blob());
  refCache.set(key, pcm);
  return pcm;
}
let lastResult = null;
$('analyzeBtn').addEventListener('click', async () => {
  if (!recBlob || !window.TilawahEngine) return;
  const p = passage();
  $('analyzeStatus').textContent = 'Analysing on this device… (first use downloads the reference audio)';
  try {
    const parts = [];
    let total = 0; const gap = new Float32Array(2400); // 0.15 s between ayahs
    for (const x of p.ayahs) { const pcm = await fetchRefPcm(x.g, p.si, x.n); parts.push(pcm.samples, gap); total += pcm.samples.length + gap.length; }
    const refSamples = new Float32Array(total);
    let off = 0; for (const s of parts) { refSamples.set(s, off); off += s.length; }
    const user = await decodeBlobToPcm(recBlob);
    lastResult = window.TilawahEngine.analyze(refSamples, 16000, user.samples, user.rate, p.words);
    renderResult(lastResult, p);
    $('analyzeStatus').textContent = 'Analysis complete — computed locally, nothing was uploaded.';
  } catch (e) {
    $('analyzeStatus').textContent = 'Analysis needs the reference audio once (internet), after which it is cached. Connect and try again.';
  }
});
function statusLabel(st) { return { good: '✅ Aligned well', review: '🟡 Mostly aligned — review the yellow words', 'needs-work': '🟠 Needs work — review highlighted words', inconclusive: '⚪ Inconclusive — no score claimed' }[st] || st; }
function renderResult(res, p) {
  $('resultBox').hidden = false;
  $('resultSummary').innerHTML = `<span class="pill big">${statusLabel(res.status)}</span>` +
    (res.score !== null ? `<span class="pill">Alignment score (heuristic): <b>${res.score}/100</b></span>` : '') +
    `<span class="pill">Confidence: ${Math.round(res.confidence * 100)}%</span>`;
  const notes = (res.notes || []).map(n => `<p class="muted small" style="margin:2px 0">• ${esc(n)}</p>`).join('');
  $('metricsBox').innerHTML = `
    <div class="metric"><b>${res.refDurationSec ?? '—'}s</b>Reference length</div>
    <div class="metric"><b>${res.userDurationSec ?? '—'}s</b>Your length</div>
    <div class="metric"><b>${res.durationRatio ?? '—'}×</b>Duration ratio</div>
    <div class="metric"><b>${res.dtwDistance ?? '—'}</b>Alignment distance</div>` + notes;
  const cls = { ok: 'fb-ok', warn: 'fb-warn', error: 'fb-error' };
  $('wordFeedback').innerHTML = (res.words || []).map((w, i) =>
    `<span class="wf ${cls[w.status] || 'fb-na'}" data-wi="${i}" title="${w.issue ? esc(w.issue) : 'Aligned'}">${esc(w.text)}</span>`).join(' ') ||
    '<span class="muted">No word-level detail for this result.</span>';
  $('wordDetail').textContent = 'Tap a word above for its detail.';
  $('wordFeedback').querySelectorAll('.wf').forEach(el => el.addEventListener('click', () => {
    const w = res.words[+el.dataset.wi];
    $('wordDetail').innerHTML = `<b>${esc(w.text)}</b> — expected ≈ ${w.expectedSec}s, yours ≈ ${w.actualSec}s (ratio ${w.ratio}×). ` +
      (w.issue ? esc(w.issue) : 'This segment aligned with the reference.') + ' <button class="btn btn-small" id="wdPlay">▶ Hear reference word region</button>';
    const b = $('wdPlay'); if (b) b.addEventListener('click', () => playQueue([{ si: p.si, a: p.from }], 'Reference', { ref: true }));
  }));
}
function resetResult() { lastResult = null; $('resultBox').hidden = true; $('analyzeStatus').textContent = ''; $('saveStatus').textContent = ''; }
$('againBtn').addEventListener('click', () => { resetResult(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
$('saveSessionBtn').addEventListener('click', async () => {
  if (!lastResult) return;
  const p = passage();
  const entry = { t: Date.now(), s: p.si, from: p.from, to: p.to, status: lastResult.status, score: lastResult.score, confidence: lastResult.confidence, words: p.words.length, reciter: settings.reciter };
  if (settings.keepRecordings && recBlob) { try { entry.recId = await idbPut(recBlob); } catch (e) {} }
  history.unshift(entry); history = history.slice(0, 200); save('tilawah.history.v1', history);
  $('saveStatus').textContent = 'Session saved on this device.';
  renderHome();
});

/* ---------------- history + IndexedDB ---------------- */
function idbOpen() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open('tilawah-db', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('recordings', { autoIncrement: true });
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
  });
}
async function idbPut(blob) { const db = await idbOpen(); return new Promise((res, rej) => { const tx = db.transaction('recordings', 'readwrite'); const rq = tx.objectStore('recordings').add(blob); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); }); }
async function idbGet(id) { const db = await idbOpen(); return new Promise((res, rej) => { const rq = db.transaction('recordings').objectStore('recordings').get(id); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); }); }
async function idbClear() { const db = await idbOpen(); return new Promise((res, rej) => { const tx = db.transaction('recordings', 'readwrite'); tx.objectStore('recordings').clear(); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
function renderHistory() {
  $('historyList').innerHTML = history.length ? history.map((h, i) => {
    const s = Q.surahs[h.s];
    return `<div class="list-item"><span>${new Date(h.t).toLocaleString()} — <b>${s ? esc(s.en) : ''} ${h.from}–${h.to}</b> · ${statusLabel(h.status)}${h.score !== null && h.score !== undefined ? ` · ${h.score}/100` : ''}</span>
    <span>${h.recId ? `<button class="btn btn-small" data-listen="${i}">▶ My recording</button>` : ''} <button class="btn btn-small" data-openh="${i}">Open passage</button></span></div>`;
  }).join('') : '<p class="muted">No saved sessions yet.</p>';
  $('historyList').querySelectorAll('[data-openh]').forEach(b => b.addEventListener('click', () => { const h = history[+b.dataset.openh]; setPractice(h.s, h.from, h.to); showView('practice'); }));
  $('historyList').querySelectorAll('[data-listen]').forEach(b => b.addEventListener('click', async () => {
    const h = history[+b.dataset.listen];
    const blob = await idbGet(h.recId).catch(() => null);
    if (blob) new Audio(URL.createObjectURL(blob)).play().catch(() => {});
  }));
}
$('clearHistoryBtn').addEventListener('click', () => { if (confirm('Clear all practice history on this device?')) { history = []; save('tilawah.history.v1', history); renderHistory(); renderHome(); } });
$('deleteRecordingsBtn').addEventListener('click', async () => { if (confirm('Delete all saved recordings on this device?')) { await idbClear().catch(() => {}); history.forEach(h => delete h.recId); save('tilawah.history.v1', history); renderHistory(); } });

/* ---------------- connectivity + install ---------------- */
function updateOfflineBadge() { const b = $('offlineBadge'); b.textContent = navigator.onLine ? '● Online' : '● Offline'; b.classList.toggle('off', !navigator.onLine); }
window.addEventListener('online', updateOfflineBadge);
window.addEventListener('offline', updateOfflineBadge);
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; $('installBtn').hidden = false; });
$('installBtn').addEventListener('click', async () => { if (deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; $('installBtn').hidden = true; } });
