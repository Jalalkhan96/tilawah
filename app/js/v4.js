'use strict';
/* ============================================================
   Tilawah v4 — platform expansion.
   New pages (Listen, Surah/Juz indexes, Word-by-Word, Reciters,
   Translations, Tafsir, Qaida & Tajweed, Bookmarks), a bigger
   verified reciter catalog, online translation packs, Tajweed
   colouring from proven annotations, player upgrades (seek,
   volume, sleep timer, queue, range repeat, hifz) and home
   extras (daily verse, continue listening, recently played).
   Everything here uses only sources verified before listing —
   anything that could not be verified is stated, not faked.
   ============================================================ */

/* ---------------- reciters: two verified per-ayah sources ---------------- */
/* Islamic Network CDN entries carry their probed bitrate; EveryAyah
   entries carry their directory (files are {SSS}{AAA}.mp3, verified
   with range requests across the whole Quran). */
Object.assign(RECITERS, {
  'ar.minshawimujawwad': { name: 'Mohamed Siddiq El-Minshawi — Mujawwad', ar: 'محمد صديق المنشاوي', style: 'Mujawwad', src: 'cdn', br: 64 },
  'eya.ghamdi': { name: 'Saad Al-Ghamdi', ar: 'سعد الغامدي', style: 'Murattal', src: 'eya', dir: 'Ghamadi_40kbps' },
  'eya.alijaber': { name: 'Ali Abdullah Jaber', ar: 'علي عبد الله جابر', style: 'Murattal', src: 'eya', dir: 'Ali_Jaber_64kbps' },
  'eya.budair': { name: 'Salah Al-Budair', ar: 'صلاح البدير', style: 'Murattal', src: 'eya', dir: 'Salah_Al_Budair_128kbps' },
  'eya.husarymuallim': { name: 'Mahmoud Khalil Al-Husary — Muallim (teaching)', ar: 'محمود خليل الحصري', style: 'Muallim', src: 'eya', dir: 'Husary_Muallim_128kbps' },
  'eya.basitmujawwad': { name: 'Abdul Basit Abdul Samad — Mujawwad', ar: 'عبد الباسط عبد الصمد', style: 'Mujawwad', src: 'eya', dir: 'Abdul_Basit_Mujawwad_128kbps' },
  'eya.azizalili': { name: 'Aziz Alili', ar: 'عزيز عليلي', style: 'Murattal', src: 'eya', dir: 'Aziz_Alili_128kbps' },
});
for (const r of Object.values(RECITERS)) { if (!r.src) r.src = 'cdn'; if (!r.style) r.style = 'Murattal'; }
if (RECITERS['ar.husarymujawwad']) RECITERS['ar.husarymujawwad'].style = 'Mujawwad';
const RECITER_AR = { 'ar.alafasy': 'مشاري راشد العفاسي', 'ar.husary': 'محمود خليل الحصري', 'ar.husarymujawwad': 'محمود خليل الحصري', 'ar.minshawi': 'محمد صديق المنشاوي', 'ar.mahermuaiqly': 'ماهر المعيقلي', 'ar.hudhaify': 'علي الحذيفي', 'ar.abdulbasitmurattal': 'عبد الباسط عبد الصمد', 'ar.saoodshuraym': 'سعود الشريم', 'ar.ahmedajamy': 'أحمد بن علي العجمي', 'ar.shaatree': 'أبو بكر الشاطري', 'ar.muhammadjibreel': 'محمد جبريل', 'ar.muhammadayyoub': 'محمد أيوب', 'ar.abdullahbasfar': 'عبد الله بصفر', 'ar.hanirifai': 'هاني الرفاعي', 'ar.ibrahimakhbar': 'إبراهيم الأخضر', 'ar.parhizgar': 'شهريار برهيزكار' };
for (const [id, r] of Object.entries(RECITERS)) if (!r.ar) r.ar = RECITER_AR[id] || '';

function urlForReciter(id, si, a, g) {
  const r = RECITERS[id] || RECITERS['ar.alafasy'];
  if (r.src === 'eya') return `https://everyayah.com/data/${r.dir}/${String(si + 1).padStart(3, '0')}${String(a).padStart(3, '0')}.mp3`;
  return `https://cdn.islamic.network/quran/audio/${r.br}/${id}/${g}.mp3`;
}
function audioUrlFor(si, a, g) { return urlForReciter(settings.reciter, si, a, g); }

function fillReciterSelect(el) {
  if (!el) return;
  el.innerHTML = Object.entries(RECITERS).map(([id, r]) => `<option value="${id}">${r.name}</option>`).join('');
}
fillReciterSelect($('reciterSel'));
fillReciterSelect($('lReciterSel'));
/* app.js validated the stored reciter before the v4 entries existed —
   restore a v4 reciter saved by this file. */
const savedReciterV4 = load('tilawah.reciter.v4', null);
if (savedReciterV4 && RECITERS[savedReciterV4]) settings.reciter = savedReciterV4;

/* ---------------- v4 settings defaults ---------------- */
if (settings.tajweed === undefined) settings.tajweed = false;
if (settings.hoverPlay === undefined) settings.hoverPlay = false;
if (settings.transSize === undefined) settings.transSize = 16;
if (settings.volume === undefined) settings.volume = 1;
save('tilawah.settings.v1', settings);

/* ---------------- online translation packs (verified editions) ---------------- */
const TRANS_PACKS = [
  { id: 'ur.ahmedali', lang: 'Urdu', name: 'Ahmed Ali', rtl: true },
  { id: 'ur.jawadi', lang: 'Urdu', name: 'Syed Zeeshan Haider Jawadi', rtl: true },
  { id: 'fa.ansarian', lang: 'Persian', name: 'Hussain Ansarian', rtl: true },
  { id: 'fa.fooladvand', lang: 'Persian', name: 'Mohammad Mahdi Fooladvand', rtl: true },
  { id: 'ku.asan', lang: 'Kurdish', name: 'Burhan Muhammad-Amin', rtl: true },
  { id: 'tr.diyanet', lang: 'Turkish', name: 'Diyanet İşleri', rtl: false },
  { id: 'tr.yazir', lang: 'Turkish', name: 'Elmalılı Hamdi Yazır', rtl: false },
  { id: 'ru.kuliev', lang: 'Russian', name: 'Elmir Kuliev', rtl: false },
  { id: 'ru.osmanov', lang: 'Russian', name: 'Magomed-Nuri Osmanov', rtl: false },
  { id: 'zh.majian', lang: 'Chinese', name: 'Ma Jian', rtl: false },
  { id: 'ms.basmeih', lang: 'Malay', name: 'Abdullah Muhammad Basmeih', rtl: false },
  { id: 'id.indonesian', lang: 'Indonesian', name: 'Indonesian Ministry of Religious Affairs', rtl: false },
  { id: 'de.aburida', lang: 'German', name: 'Abu Rida Muhammad ibn Ahmad ibn Rassoul', rtl: false },
  { id: 'de.bubenheim', lang: 'German', name: 'A. S. F. Bubenheim & N. Elyas', rtl: false },
  { id: 'es.cortes', lang: 'Spanish', name: 'Julio Cortes', rtl: false },
  { id: 'fr.hamidullah', lang: 'French', name: 'Muhammad Hamidullah', rtl: false },
  { id: 'ml.abdulhameed', lang: 'Malayalam', name: 'Cheriyamundam Abdul Hameed & Kunhi Mohammed Parappoor', rtl: false },
  { id: 'ta.tamil', lang: 'Tamil', name: 'Jan Turst Foundation', rtl: false },
  { id: 'bn.bengali', lang: 'Bengali', name: 'Muhiuddin Khan', rtl: false },
  { id: 'bn.hoque', lang: 'Bengali', name: 'Zohurul Hoque', rtl: false },
  { id: 'uz.sodik', lang: 'Uzbek', name: 'Muhammad Sodik Muhammad Yusuf', rtl: false },
  { id: 'az.musayev', lang: 'Azerbaijani', name: 'Alikhan Musayev', rtl: false },
  { id: 'az.mammadaliyev', lang: 'Azerbaijani', name: 'Vasim Mammadaliyev & Ziya Bunyadov', rtl: false },
  { id: 'hi.farooq', lang: 'Hindi', name: 'Farooq Khan', rtl: false },
  { id: 'hi.hindi', lang: 'Hindi', name: 'Suhel Farooq Khan & Saifur Rahman Nadwi', rtl: false },
];
function packOf(id) { return TRANS_PACKS.find(p => p.id === id) || null; }
function isPackTrans() { return typeof settings.translation === 'string' && settings.translation.startsWith('pk:'); }
const PACK_CACHE = new Map();
(function injectPackOptions() {
  const grp = document.createElement('optgroup');
  grp.label = 'Online packs (load per ayah, then cached)';
  for (const p of TRANS_PACKS) {
    const o = document.createElement('option');
    o.value = 'pk:' + p.id;
    o.textContent = `${p.lang} — ${p.name} (online)`;
    grp.appendChild(o);
  }
  $('transLangSel').appendChild(grp);
})();

/* ---------------- settings application (wrap) ---------------- */
const _applySettings = applySettings;
applySettings = function () {
  _applySettings();
  save('tilawah.reciter.v4', settings.reciter);
  const tj = $('tajweedChk'); if (tj) tj.checked = !!settings.tajweed;
  const hp = $('hoverPlayChk'); if (hp) hp.checked = !!settings.hoverPlay;
  const tb = $('tajweedBtn'); if (tb) tb.textContent = 'Tajweed colours: ' + (settings.tajweed ? 'On' : 'Off');
  const lr = $('lReciterSel'); if (lr) lr.value = settings.reciter;
  const tf = $('transFontRange'); if (tf) { tf.value = settings.transSize; $('transFontVal').textContent = settings.transSize + 'px'; }
  document.documentElement.style.setProperty('--trans-size', settings.transSize + 'px');
  const v1 = $('volRange'), v2 = $('lVolRange');
  if (v1) v1.value = settings.volume;
  if (v2) v2.value = settings.volume;
  const ls = $('lSpeedSel'); if (ls) ls.value = String(settings.speed);
  try { audioEl.volume = settings.volume; } catch (e) {}
};
$('tajweedChk').addEventListener('change', e => setTajweed(e.target.checked));
$('hoverPlayChk').addEventListener('change', e => { settings.hoverPlay = e.target.checked; applySettings(); });

/* ---------------- navigation (wrap) + hash routing ---------------- */
const V4_VIEW_HOOKS = {
  listen: () => { renderListen(); },
  surahs: () => { renderSurahIndex(); },
  juz: () => { renderJuzIndex(); },
  wbw: () => { fillWbw(); renderWbwWords(); },
  reciters: () => { renderReciters(); },
  translations: () => { renderTranslations(); },
  tafsir: () => { fillTafsir(); },
  learn: () => { buildExamples(); },
  bookmarks: () => { renderBookmarksPage(); },
  hadith: () => { renderHadithLibrary(); },
  practice: () => { renderHifzList(); },
};
const _showView = showView;
showView = function (name) {
  _showView(name);
  const hook = V4_VIEW_HOOKS[name];
  if (hook) hook();
  try { history.replaceState(null, '', '#' + name); } catch (e) {}
};
(function initHashRoute() {
  const name = (location.hash || '').replace('#', '');
  if (!name || name === 'home' || !(name in V4_VIEW_HOOKS) && !['reader', 'surah', 'practice', 'history', 'settings'].includes(name)) return;
  const iv = setInterval(() => {
    if (typeof Q !== 'undefined' && Q) { clearInterval(iv); showView(name); }
  }, 300);
  setTimeout(() => clearInterval(iv), 12000);
})();

/* ---------------- tajweed ---------------- */
let TAJ = null;
const TAJWEED_RULES = {
  h: ['Hamzat al-Wasl', '#AAAAAA'], s: ['Silent letter', '#AAAAAA'], l: ['Lam Shamsiyyah', '#AAAAAA'],
  n: ['Madd — normal', '#537FFF'], p: ['Madd — permissible', '#4050FF'], m: ['Madd — necessary', '#000EBC'],
  o: ['Madd — obligatory', '#2144C1'], q: ['Qalqalah', '#DD0008'], f: ['Ikhfa', '#9400A8'],
  c: ['Ikhfa Shafawi', '#D500B7'], i: ['Iqlab', '#26BFFD'], a: ['Idgham with ghunnah', '#169777'],
  u: ['Idgham without ghunnah', '#169200'], w: ['Idgham Shafawi', '#58B800'],
  d: ['Idgham Mutajanisayn', '#A1A1A1'], b: ['Idgham Mutaqaribayn', '#A1A1A1'], g: ['Ghunnah', '#FF7E1E'],
};
async function ensureTajweed() {
  if (TAJ) return TAJ;
  TAJ = await loadParts('data/tajweed.parts.json', 'data/parts-tajweed/tajweed').catch(() => ({ ayahs: {} }));
  return TAJ;
}
const tajOffsetCache = new Map();
function tajTokenHtml(ay, token, tokenIdx) {
  if (!settings.tajweed || !TAJ || !TAJ.ayahs) return esc(token);
  const spans = TAJ.ayahs[ay.g];
  if (!spans) return esc(token);
  let offs = tajOffsetCache.get(ay.g);
  if (!offs) {
    offs = [];
    let pos = 0;
    for (const tk of ay.t.split(/\s+/).filter(Boolean)) { const ix = ay.t.indexOf(tk, pos); offs.push(ix); pos = ix + tk.length; }
    tajOffsetCache.set(ay.g, offs);
  }
  const start = offs[tokenIdx];
  if (start === undefined) return esc(token);
  const end = start + token.length;
  const rel = spans.filter(sp => sp[1] > start && sp[0] < end).sort((x, y) => x[0] - y[0]);
  if (!rel.length) return esc(token);
  let html = '', cur = start;
  for (const sp of rel) {
    const s0 = Math.max(sp[0], start), s1 = Math.min(sp[1], end);
    if (s0 > cur) html += esc(ay.t.slice(cur, s0));
    if (s1 > s0) { html += `<span class="tj tj-${sp[2]}">${esc(ay.t.slice(s0, s1))}</span>`; cur = s1; }
  }
  if (cur < end) html += esc(ay.t.slice(cur, end));
  return html || esc(token);
}
async function setTajweed(on) {
  settings.tajweed = !!on;
  if (on) await ensureTajweed();
  applySettings();
  if (currentView === 'reader') renderReader();
  const ls = $('learnStatus'); if (ls) ls.textContent = on ? 'Tajweed colours are ON in the Reader.' : 'Tajweed colours are off.';
}
$('tajweedBtn').addEventListener('click', () => setTajweed(!settings.tajweed));
$('learnTajweedBtn').addEventListener('click', () => setTajweed(!settings.tajweed));
if (settings.tajweed) ensureTajweed();

/* ---------------- playback hooks: log, resume point, queue panel ---------------- */
let LISTEN_LOG = load('tilawah.listen.v1', []);
function recordListen(label, si, a) {
  LISTEN_LOG.unshift({ t: Date.now(), label, si, a, reciter: settings.reciter });
  LISTEN_LOG = LISTEN_LOG.slice(0, 50);
  save('tilawah.listen.v1', LISTEN_LOG);
}
function saveLastListen(label, list, qi) {
  save('tilawah.lastListen.v1', { label, list, qi, reciter: settings.reciter, t: Date.now() });
}
const _playQueue = playQueue;
playQueue = function (list, label, opts) {
  if (!v4Restarting) { v4Repeat.left = 0; v4Repeat.list = null; }
  _playQueue(list, label, opts);
  if (list && list.length) { recordListen(label, list[0].si, list[0].a); saveLastListen(label, list, 0); }
  renderQueuePanel();
};
const _playAyahMode = playAyahMode;
playAyahMode = function () { _playAyahMode(); recordListen('Ayah', sel.s, sel.a); };
const _startWbw = startWbw;
startWbw = function (si, a, fromWord) { const ok = _startWbw(si, a, fromWord); if (ok) recordListen('Word by word', si, a); return ok; };
const _stopAudio = stopAudio;
stopAudio = function () { _stopAudio(); v4Repeat.left = 0; v4Repeat.list = null; renderQueuePanel(); };

let v4Restarting = false;
const v4Repeat = { left: 0, list: null, label: '', ref: false };
audioEl.addEventListener('ended', () => {
  if (PB.mode === 'preview') { PB.mode = 'idle'; setModeChip(''); setStatus('Preview finished.'); return; }
  if (PB.mode === 'queue') { saveLastListen(PB.label, PB.queue, PB.qi); renderQueuePanel(); return; }
  if (PB.mode === 'idle' && v4Repeat.list && v4Repeat.left > 0 && PB.queue.length === v4Repeat.list.length) {
    const list = v4Repeat.list, label = v4Repeat.label, ref = v4Repeat.ref;
    v4Repeat.left--;
    v4Restarting = true;
    playQueue(list, label, ref ? { ref: true } : undefined);
    v4Restarting = false;
    v4Repeat.list = list; v4Repeat.label = label; v4Repeat.ref = ref;
    setStatus(`${label}: ${v4Repeat.left} repetition(s) left.`);
  }
});
audioEl.addEventListener('error', () => {
  if (PB.mode !== 'idle' && settings.reciter && (RECITERS[settings.reciter] || {}).src === 'eya')
    setStatus('This reciter\u2019s audio (EveryAyah) failed to load — check your connection; the file may not be cached yet.');
});

function renderQueuePanel() {
  const box = $('queueList');
  if (!box) return;
  if (!PB.queue || !PB.queue.length) {
    box.innerHTML = '<p class="muted">The queue is empty. Play a Surah, a Para or a range and it appears here — tap any item to jump to it.</p>';
    return;
  }
  box.innerHTML = PB.queue.map((q, i) => `<button class="queue-item${PB.mode === 'queue' && i === PB.qi ? ' active' : ''}" data-qi="${i}"><span>${i + 1}. ${esc(Q.surahs[q.si].en)} — Ayah ${q.a}</span><span class="muted small">${PB.mode === 'queue' && i === PB.qi ? '▶ playing' : ''}</span></button>`).join('');
  box.querySelectorAll('[data-qi]').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.qi;
    if (!PB.queue[i]) return;
    PB.qi = i; PB.cur = { ...PB.queue[i] }; PB.mode = 'queue';
    sel = { s: PB.cur.si, a: PB.cur.a }; lastPos = { ...sel }; save('tilawah.lastPos.v1', lastPos);
    if (currentView === 'reader') renderReader();
    playCurrentAyahSrc(); startPlaybackUI();
    saveLastListen(PB.label, PB.queue, PB.qi);
    renderQueuePanel();
  }));
}

/* transport: prev / next work for queues and for single-ayah mode */
function queueStep(d) {
  if (PB.mode === 'queue' && PB.queue.length) {
    const ni = PB.qi + d;
    if (ni < 0 || ni >= PB.queue.length) return;
    PB.qi = ni; PB.cur = { ...PB.queue[ni] };
    sel = { s: PB.cur.si, a: PB.cur.a }; lastPos = { ...sel }; save('tilawah.lastPos.v1', lastPos);
    if (currentView === 'reader') renderReader();
    playCurrentAyahSrc(); startPlaybackUI();
    saveLastListen(PB.label, PB.queue, PB.qi);
    renderQueuePanel();
    return;
  }
  const na = sel.a + d;
  if (na >= 1 && na <= surah().ayahs.length) { selectAyah(sel.s, na, false); renderReader(); playAyahMode(); }
}
$('prevAyahBtn').addEventListener('click', () => queueStep(-1));
$('nextAyahBtn').addEventListener('click', () => queueStep(1));
$('lPrevBtn').addEventListener('click', () => queueStep(-1));
$('lNextBtn').addEventListener('click', () => queueStep(1));
$('lStopBtn').addEventListener('click', () => { stopAudio(); $('lStatus').textContent = 'Stopped.'; });
$('lPlayPauseBtn').addEventListener('click', () => {
  if (PB.mode !== 'idle' && PB.cur) {
    if (audioEl.paused) { audioEl.play().catch(() => {}); startPlaybackUI(); } else audioEl.pause();
  } else playAyahMode();
});

/* seek, volume, speed, sleep timer */
/* v5: paint the gold fill (--p) of every styled range slider */
function paintRange(el) {
  if (!el || el.type !== 'range') return;
  const min = +el.min || 0, max = +el.max || 100, v = +el.value || 0;
  el.style.setProperty('--p', (max > min ? ((v - min) / (max - min)) * 100 : 0) + '%');
}
document.addEventListener('input', e => { if (e.target) paintRange(e.target); }, true);
function wireSeek(el) {
  if (!el) return;
  el.addEventListener('input', () => { paintRange(el); if (audioEl.duration) audioEl.currentTime = (el.value / 1000) * audioEl.duration; });
}
wireSeek($('seekRange')); wireSeek($('lSeekRange'));
function syncSeekUI() {
  const dur = audioEl.duration || 0, cur = audioEl.currentTime || 0;
  const frac = dur ? Math.round((cur / dur) * 1000) : 0;
  for (const id of ['seekRange', 'lSeekRange']) { const el = $(id); if (el && document.activeElement !== el) el.value = frac; if (el) paintRange(el); }
  const label = fmtTime(cur) + ' / ' + fmtTime(dur);
  if ($('timeLabel')) $('timeLabel').textContent = label;
  if ($('lTimeLabel')) $('lTimeLabel').textContent = label;
}
audioEl.addEventListener('timeupdate', syncSeekUI);
audioEl.addEventListener('loadedmetadata', syncSeekUI);
function wireVolume(el) {
  if (!el) return;
  el.addEventListener('input', () => {
    settings.volume = +el.value;
    audioEl.volume = settings.volume;
    if ($('volRange')) { $('volRange').value = settings.volume; paintRange($('volRange')); }
    if ($('lVolRange')) { $('lVolRange').value = settings.volume; paintRange($('lVolRange')); }
    save('tilawah.settings.v1', settings);
  });
}
wireVolume($('volRange')); wireVolume($('lVolRange'));
document.querySelectorAll('input[type="range"]').forEach(paintRange);
// Liquid-glass drag state (slider concept: Maxuiux) — while a slider is being
// dragged its pill thumb turns to glass (see the v5.2 block in style.css).
document.addEventListener('pointerdown', e => {
  const t = e.target;
  if (t && t.matches && t.matches('input[type="range"]')) t.classList.add('glassing');
});
const clearGlass = () => document.querySelectorAll('input[type="range"].glassing').forEach(el => el.classList.remove('glassing'));
document.addEventListener('pointerup', clearGlass);
document.addEventListener('pointercancel', clearGlass);
$('lSpeedSel').addEventListener('change', e => { settings.speed = +e.target.value; applySettings(); audioEl.playbackRate = settings.speed; });
let sleepTimerId = null;
function setSleep(min, fromEl) {
  clearTimeout(sleepTimerId);
  for (const id of ['sleepSel', 'lSleepSel']) { const el = $(id); if (el && el !== fromEl) el.value = String(min); }
  if (min > 0) {
    sleepTimerId = setTimeout(() => {
      stopAudio();
      setStatus('Sleep timer stopped playback.');
      const ls = $('lStatus'); if (ls) ls.textContent = 'Sleep timer stopped playback.';
    }, min * 60000);
  }
}
$('sleepSel').addEventListener('change', e => setSleep(+e.target.value, e.target));
$('lSleepSel').addEventListener('change', e => setSleep(+e.target.value, e.target));

/* periodic UI sync: listen labels + word-by-word page highlight */
setInterval(() => {
  if (typeof Q === 'undefined' || !Q) return;
  const np = $('lNowPlaying');
  if (np) np.textContent = PB.cur ? `${PB.label || 'Playing'} — ${Q.surahs[PB.cur.si].en} ${PB.cur.a} · ${(RECITERS[settings.reciter] || {}).name || ''}` : 'Nothing playing.';
  if (currentView === 'wbw' && PB.mode === 'wbw' && PB.wbw) {
    document.querySelectorAll('#wbwWords .wbw-word').forEach((el, i) => el.classList.toggle('speaking', i === PB.wbw.idx));
  }
}, 600);

/* hover-to-play a word (opt-in, desktop) */
let hoverKey = '';
$('ayahFlow').addEventListener('mouseover', e => {
  if (!settings.hoverPlay) return;
  const w = e.target.closest('.qword');
  if (!w) return;
  const ayahEl = w.closest('.ayah');
  if (!ayahEl) return;
  const a = +ayahEl.dataset.n;
  const key = a + '|' + w.dataset.t;
  if (key === hoverKey) return;
  hoverKey = key;
  const entry = wordEntry(ayahOf(sel.s, a).g);
  if (entry) playSingleWord(sel.s, a, playableIndexForToken(entry, +w.dataset.t));
});
$('readerTafsirBtn').addEventListener('click', () => openTafsir(sel.s, sel.a));

/* ---------------- Listen page ---------------- */
function fillListenSelectors() {
  const ss = $('lSurahSel');
  if (!ss.options.length) {
    ss.innerHTML = Q.surahs.map(s => `<option value="${s.number - 1}">${s.number}. ${esc(s.en)}</option>`).join('');
    ss.value = sel.s;
    $('lJuzSel').innerHTML = Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}">Para ${i + 1}</option>`).join('');
  }
  fillListenRange(+ss.value);
}
function fillListenRange(si) {
  const n = Q.surahs[si].ayahs.length;
  const opts = Array.from({ length: n }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  $('lFrom').innerHTML = opts; $('lTo').innerHTML = opts;
  $('lFrom').value = 1; $('lTo').value = n;
}
$('lSurahSel').addEventListener('change', e => fillListenRange(+e.target.value));
$('lReciterSel').addEventListener('change', e => { settings.reciter = e.target.value; applySettings(); stopAudio(); $('lStatus').textContent = 'Reciter: ' + RECITERS[settings.reciter].name; });
$('lPlayRangeBtn').addEventListener('click', () => {
  const si = +$('lSurahSel').value;
  let from = +$('lFrom').value, to = +$('lTo').value;
  if (to < from) [from, to] = [to, from];
  const list = Q.surahs[si].ayahs.slice(from - 1, to).map(x => ({ si, a: x.n }));
  const label = `${Q.surahs[si].en} ${from}–${to}`;
  const reps = +$('lRangeRepeat').value;
  playQueue(list, label);
  v4Repeat.left = reps; v4Repeat.list = list; v4Repeat.label = label; v4Repeat.ref = false;
  $('lStatus').textContent = `Playing ${label}${reps ? ` — will repeat ${reps + 1}× in total` : ''}.`;
});
$('lPlayJuzBtn').addEventListener('click', () => {
  const j = +$('lJuzSel').value;
  playQueue(juzAyahs(j), `Para ${j}`);
  $('lStatus').textContent = `Playing Para ${j} — the full verse sequence across Surah boundaries.`;
});
function renderListen() {
  if (!Q) return;
  fillListenSelectors();
  $('lReciterSel').value = settings.reciter;
  renderQueuePanel();
  $('listenHistory').innerHTML = LISTEN_LOG.length ? LISTEN_LOG.slice(0, 15).map((h, i) => {
    const s = Q.surahs[h.si];
    return `<div class="list-item"><span>${new Date(h.t).toLocaleString()} — <b>${esc(h.label)}</b> · ${s ? esc(s.en) : ''} ${h.a} · ${esc((RECITERS[h.reciter] || {}).name || '')}</span><button class="btn btn-small" data-lh="${i}">Open</button></div>`;
  }).join('') : '<p class="muted">Nothing played yet.</p>';
  $('listenHistory').querySelectorAll('[data-lh]').forEach(b => b.addEventListener('click', () => { const h = LISTEN_LOG[+b.dataset.lh]; if (h) openReader(h.si, h.a); }));
}

/* ---------------- Surah index ---------------- */
function renderSurahIndex() {
  if (!Q) return;
  const q = ($('surahSearch').value || '').toLowerCase();
  const sort = $('surahSortSel').value;
  let list = Q.surahs.map((s, si) => ({ s, si }));
  if (q) list = list.filter(({ s }) => s.en.toLowerCase().includes(q) || s.tr.toLowerCase().includes(q) || String(s.number) === q || s.name.includes(q));
  if (sort === 'name') list.sort((a, b) => a.s.en.localeCompare(b.s.en));
  if (sort === 'ayahs-desc') list.sort((a, b) => b.s.ayahs.length - a.s.ayahs.length);
  if (sort === 'ayahs-asc') list.sort((a, b) => a.s.ayahs.length - b.s.ayahs.length);
  $('surahIndexList').innerHTML = list.map(({ s, si }) => `
    <div class="detail-ayah" data-si="${si}">
      <span class="ayah-badge">${s.number}</span>
      <span class="detail-ayah-main">
        <span><b>${esc(s.en)}</b> <span class="muted small">${esc(s.tr)} · ${esc(s.rev)} · ${s.ayahs.length} ayahs</span></span>
      </span>
      <span class="arabic" style="font-size:23px;color:var(--green)">${esc(s.name)}</span>
      <span class="detail-ayah-btns">
        ${lastPos.s === si ? `<button class="btn btn-small" data-act="continue">Continue · ayah ${lastPos.a}</button>` : ''}
        <button class="btn btn-small" data-act="read">Read</button>
        <button class="btn btn-small btn-primary" data-act="play">▶ Play</button>
        <button class="btn btn-small" data-act="detail">Detail</button>
      </span>
    </div>`).join('') || '<p class="muted">No surah matches that search.</p>';
}
$('surahSearch').addEventListener('input', renderSurahIndex);
$('surahSortSel').addEventListener('change', renderSurahIndex);
$('surahIndexList').addEventListener('click', e => {
  const row = e.target.closest('[data-si]');
  if (!row) return;
  const si = +row.dataset.si;
  const act = (e.target.closest('[data-act]') || {}).dataset?.act;
  if (act === 'play') playSurahFrom(si, 1);
  else if (act === 'detail') openSurahDetail(si);
  else if (act === 'continue') openReader(si, lastPos.a);
  else openReader(si, 1);
});

/* ---------------- Juz index ---------------- */
const JUZ_NAMES = ['الم', 'سيقول', 'تلك الرسل', 'لن تنالوا', 'والمحصنات', 'لا يحب الله', 'وإذا سمعوا', 'ولو أننا', 'قال الملأ', 'واعلموا', 'يعتذرون', 'وما من دابة', 'وما أبرئ', 'ربما', 'سبحان الذي', 'قال ألم', 'اقترب للناس', 'قد أفلح', 'وقال الذين', 'أمن خلق', 'اتل ما أوحي', 'ومن يقنت', 'وما لي', 'فمن أظلم', 'إليه يرد', 'حم', 'قال فما خطبكم', 'قد سمع الله', 'تبارك الذي', 'عم'];
function juzMapGlobal() {
  const map = {};
  Q.surahs.forEach((s, si) => s.ayahs.forEach(a => {
    if (!map[a.j]) map[a.j] = { first: { si, n: a.n, en: s.en }, count: 0 };
    map[a.j].count++;
    map[a.j].last = { si, n: a.n, en: s.en };
  }));
  return map;
}
function renderJuzIndex() {
  if (!Q) return;
  const map = juzMapGlobal();
  const curJuz = ayahOf(lastPos.s, lastPos.a)?.j;
  $('juzIndexList').innerHTML = Object.keys(map).sort((a, b) => a - b).map(j => {
    const r = map[j];
    return `<div class="juz-row"><div><b>Para ${j}</b> <span class="arabic" style="font-size:19px">${JUZ_NAMES[j - 1] || ''}</span> <span class="muted small">· ${r.count} ayahs · ${esc(r.first.en)} ${r.first.n} → ${esc(r.last.en)} ${r.last.n}</span></div>
      <span class="row"><button class="btn btn-small" data-jact="read" data-j="${j}">Read</button>${+j === curJuz ? `<button class="btn btn-small" data-jact="resume" data-j="${j}">Resume</button>` : ''}<button class="btn btn-small btn-primary" data-jact="play" data-j="${j}">▶ Play Para</button></span></div>`;
  }).join('');
}
$('juzIndexList').addEventListener('click', e => {
  const b = e.target.closest('[data-jact]');
  if (!b) return;
  const j = +b.dataset.j;
  const map = juzMapGlobal();
  if (b.dataset.jact === 'read') openReader(map[j].first.si, map[j].first.n);
  if (b.dataset.jact === 'resume') openReader(lastPos.s, lastPos.a);
  if (b.dataset.jact === 'play') playJuz(j);
});

/* ---------------- Word-by-Word page ---------------- */
function fillWbw() {
  if (!Q) return;
  const ss = $('wSurahSel');
  if (!ss.options.length) {
    ss.innerHTML = Q.surahs.map(s => `<option value="${s.number - 1}">${s.number}. ${esc(s.en)}</option>`).join('');
    ss.value = sel.s;
  }
  fillWbwAyahs(+ss.value);
}
function fillWbwAyahs(si) {
  const n = Q.surahs[si].ayahs.length;
  $('wAyahSel').innerHTML = Array.from({ length: n }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  if (+$('wSurahSel').value === sel.s) $('wAyahSel').value = sel.a;
}
$('wSurahSel').addEventListener('change', e => { fillWbwAyahs(+e.target.value); renderWbwWords(); });
$('wAyahSel').addEventListener('change', renderWbwWords);
async function renderWbwWords() {
  if (!Q) return;
  const si = +$('wSurahSel').value, a = +$('wAyahSel').value;
  await ensureWords();
  const ay = ayahOf(si, a);
  const entry = wordEntry(ay.g);
  if (!entry) {
    $('wbwWords').innerHTML = '';
    $('wbwStatus').textContent = 'Word-by-word data is not available for this ayah (one of 3 of 6,236 where verified segmentation could not be matched) — whole-ayah playback is used instead. Nothing is faked.';
    return;
  }
  $('wbwStatus').textContent = `${Q.surahs[si].en} ${a} — ${entry.m.length} words. Tap a word to hear exactly that word; “Play word by word” plays them all in sequence with highlighting.`;
  $('wbwWords').innerHTML = entry.m.map((m, wi) => {
    const meta = entry.w[wi] || ['', ''];
    return `<button class="wbw-word" data-wi="${wi}"><span class="w-ar">${esc(wordTextOf(si, a, entry, wi))}</span><span class="w-tr">${esc(meta[0] || '')}</span><span class="w-en">${esc(meta[1] || '')}</span></button>`;
  }).join('');
}
$('wbwWords').addEventListener('click', e => {
  const b = e.target.closest('[data-wi]');
  if (!b) return;
  playSingleWord(+$('wSurahSel').value, +$('wAyahSel').value, +b.dataset.wi);
  document.querySelectorAll('#wbwWords .wbw-word').forEach(el => el.classList.remove('speaking'));
  b.classList.add('speaking');
});
$('wPlayWbwBtn').addEventListener('click', async () => { await ensureWords(); if (!startWbw(+$('wSurahSel').value, +$('wAyahSel').value, 0)) $('wbwStatus').textContent = 'Word-by-word is unavailable for this ayah — use “Play whole ayah”.'; });
$('wPlayAyahBtn').addEventListener('click', () => { sel = { s: +$('wSurahSel').value, a: +$('wAyahSel').value }; lastPos = { ...sel }; save('tilawah.lastPos.v1', lastPos); playAyahMode(); });

/* ---------------- Reciters page ---------------- */
function renderReciters() {
  const q = ($('reciterSearch').value || '').toLowerCase();
  const entries = Object.entries(RECITERS).filter(([id, r]) => !q || r.name.toLowerCase().includes(q) || (r.ar || '').includes(q) || (r.style || '').toLowerCase().includes(q));
  $('reciterStatus').textContent = `${entries.length} of ${Object.keys(RECITERS).length} verified reciters shown. Current: ${RECITERS[settings.reciter].name}.`;
  $('reciterGrid').innerHTML = entries.map(([id, r]) => `
    <div class="reciter-card${id === settings.reciter ? ' active' : ''}">
      <span class="rname">${esc(r.name)}</span>
      <span class="rar" dir="rtl">${esc(r.ar || '')}</span>
      <span class="muted small">${esc(r.style || 'Murattal')} · ${r.src === 'eya' ? 'EveryAyah' : 'Islamic Network CDN'} · Complete Quran, per-ayah audio (verified)</span>
      <span class="row wrap">
        <button class="btn btn-small ${id === settings.reciter ? '' : 'btn-primary'}" data-ract="select" data-id="${id}">${id === settings.reciter ? '✓ Selected' : 'Select'}</button>
        <button class="btn btn-small" data-ract="preview" data-id="${id}">▶ Preview (1:1)</button>
      </span>
    </div>`).join('') || '<p class="muted">No reciter matches that search.</p>';
}
$('reciterSearch').addEventListener('input', renderReciters);
$('reciterGrid').addEventListener('click', e => {
  const b = e.target.closest('[data-ract]');
  if (!b) return;
  const id = b.dataset.id;
  if (b.dataset.ract === 'select') {
    settings.reciter = id;
    applySettings();
    stopAudio();
    renderReciters();
    $('reciterStatus').textContent = 'Reciter set to ' + RECITERS[id].name + ' — every play control now uses this voice.';
  } else if (b.dataset.ract === 'preview') {
    stopAudio();
    PB.mode = 'preview'; PB.cur = { si: 0, a: 1 };
    audioEl.src = urlForReciter(id, 0, 1, 1);
    audioEl.playbackRate = settings.speed;
    audioEl.play().catch(() => { $('reciterStatus').textContent = 'Preview could not load — check your connection.'; PB.mode = 'idle'; });
    setModeChip('Preview');
    $('reciterStatus').textContent = `Previewing ${RECITERS[id].name} — Al-Fatihah, ayah 1.`;
  }
});

/* ---------------- Translations page ---------------- */
const BUNDLED_TRANS = [
  ['e', 'English', 'Saheeh International'],
  ['a', 'English', 'Muhammad Asad'],
  ['u', 'Urdu', 'Fateh Muhammad Jalandhry'],
  ['s', 'Pashto', 'Abdul Wali Khan'],
];
function renderTranslations() {
  $('bundledTransList').innerHTML = BUNDLED_TRANS.map(([id, lang, name]) => `
    <div class="list-item"><span><b>${lang}</b> — ${esc(name)} <span class="muted small">· bundled, works offline</span></span>
    <button class="btn btn-small ${settings.translation === id ? '' : 'btn-primary'}" data-tr="${id}">${settings.translation === id ? '✓ In use' : 'Use'}</button></div>`).join('');
  $('packList').innerHTML = TRANS_PACKS.map(p => { const val = 'pk:' + p.id; return `
    <div class="list-item"><span><b>${p.lang}</b> — ${esc(p.name)} <span class="muted small">· online pack · AlQuran Cloud edition ${p.id}</span></span>
    <button class="btn btn-small ${settings.translation === val ? '' : 'btn-primary'}" data-tr="${val}">${settings.translation === val ? '✓ In use' : 'Use'}</button></div>`; }).join('');
  document.querySelectorAll('#view-translations [data-tr]').forEach(b => b.addEventListener('click', () => {
    settings.translation = b.dataset.tr;
    applySettings();
    renderTranslation();
    if (currentView === 'surah') renderSurahDetail();
    renderTranslations();
  }));
}
$('transFontRange').addEventListener('input', e => {
  settings.transSize = +e.target.value;
  document.documentElement.style.setProperty('--trans-size', settings.transSize + 'px');
  $('transFontVal').textContent = settings.transSize + 'px';
  save('tilawah.settings.v1', settings);
});

/* ---------------- Tafsir page ---------------- */
const TAFSIRS = [
  { id: 169, name: 'Ibn Kathir (Abridged)', lang: 'English' },
  { id: 160, name: 'Ibn Kathir', lang: 'Urdu' },
  { id: 157, name: 'Fi Zilal al-Quran', lang: 'Urdu' },
  { id: 818, name: 'Tazkirul Quran', lang: 'Urdu' },
  { id: 159, name: 'Bayan ul Quran', lang: 'Urdu' },
  { id: 14, name: 'Ibn Kathir', lang: 'Arabic' },
  { id: 16, name: 'Al-Muyassar', lang: 'Arabic' },
];
const TAFSIR_CACHE = new Map();
function sanitizeHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  d.querySelectorAll('script,style,iframe,object,embed,link,form').forEach(n => n.remove());
  d.querySelectorAll('*').forEach(n => {
    [...n.attributes].forEach(at => { if (at.name !== 'href') n.removeAttribute(at.name); });
    if (n.tagName === 'A') { n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener'); }
  });
  return d.innerHTML;
}
function fillTafsir() {
  if (!Q) return;
  const ts = $('tfTafsirSel');
  if (!ts.options.length) {
    ts.innerHTML = TAFSIRS.map(t => `<option value="${t.id}">${t.name} (${t.lang})</option>`).join('');
    $('tfSurahSel').innerHTML = Q.surahs.map(s => `<option value="${s.number - 1}">${s.number}. ${esc(s.en)}</option>`).join('');
    $('tfSurahSel').value = sel.s;
    fillTafsirAyahs(sel.s);
    $('tfAyahSel').value = sel.a;
  }
}
function fillTafsirAyahs(si) {
  const n = Q.surahs[si].ayahs.length;
  $('tfAyahSel').innerHTML = Array.from({ length: n }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
}
$('tfSurahSel').addEventListener('change', e => fillTafsirAyahs(+e.target.value));
function openTafsir(si, a) {
  showView('tafsir');
  $('tfSurahSel').value = si;
  fillTafsirAyahs(si);
  $('tfAyahSel').value = a;
  fetchTafsir();
}
$('tfGetBtn').addEventListener('click', fetchTafsir);
async function fetchTafsir() {
  const id = +$('tfTafsirSel').value, si = +$('tfSurahSel').value, a = +$('tfAyahSel').value;
  const t = TAFSIRS.find(x => x.id === id);
  const key = `${id}|${si + 1}:${a}`;
  if (TAFSIR_CACHE.has(key)) { $('tfContent').innerHTML = TAFSIR_CACHE.get(key); $('tfStatus').textContent = `Source: ${t.name} (${t.lang}) — Quran.com API, for ${Q.surahs[si].en} ${a}.`; return; }
  $('tfStatus').textContent = 'Loading tafsir…';
  $('tfContent').innerHTML = '';
  try {
    const r = await fetch(`https://api.quran.com/api/v4/tafsirs/${id}/by_ayah/${si + 1}:${a}`);
    const j = await r.json();
    const text = j && j.tafsir && j.tafsir.text;
    if (!text) { $('tfStatus').textContent = 'No tafsir text was returned for this ayah in this source.'; return; }
    const html = sanitizeHtml(text);
    TAFSIR_CACHE.set(key, html);
    $('tfContent').innerHTML = html;
    $('tfStatus').textContent = `Source: ${t.name} (${t.lang}) — Quran.com API, for ${Q.surahs[si].en} ${a}. Shown exactly as published by the source.`;
  } catch (e) {
    $('tfStatus').textContent = 'Tafsir needs an internet connection (it is fetched live from the Quran.com API and is not bundled).';
  }
}

/* ---------------- Learn page: legend, qaida, examples ---------------- */
$('legendGrid').innerHTML = Object.entries(TAJWEED_RULES).map(([code, [name, color]]) =>
  `<div class="legend-item"><span class="legend-dot" style="background:${color}"></span>${name}</div>`).join('');
const QAIDA_LETTERS = [
  ['ا', 'Alif', 'a'], ['ب', 'Baa', 'b'], ['ت', 'Taa', 't'], ['ث', 'Thaa', 'th'], ['ج', 'Jeem', 'j'],
  ['ح', 'Haa', 'ḥ'], ['خ', 'Khaa', 'kh'], ['د', 'Dal', 'd'], ['ذ', 'Dhal', 'dh'], ['ر', 'Raa', 'r'],
  ['ز', 'Zay', 'z'], ['س', 'Seen', 's'], ['ش', 'Sheen', 'sh'], ['ص', 'Sad', 'ṣ'], ['ض', 'Dad', 'ḍ'],
  ['ط', 'Taa', 'ṭ'], ['ظ', 'Dhaa', 'ẓ'], ['ع', 'Ain', 'ʿ'], ['غ', 'Ghayn', 'gh'], ['ف', 'Faa', 'f'],
  ['ق', 'Qaf', 'q'], ['ك', 'Kaf', 'k'], ['ل', 'Lam', 'l'], ['م', 'Meem', 'm'], ['ن', 'Noon', 'n'],
  ['ه', 'Haa', 'h'], ['و', 'Waw', 'w'], ['ي', 'Yaa', 'y'],
];
$('qaidaGrid').innerHTML = QAIDA_LETTERS.map(([ch, name, tr]) =>
  `<div class="qaida-cell"><span class="qaida-letter arabic">${ch}</span><span><b>${name}</b> · ${tr}</span><span class="qaida-forms arabic" dir="rtl">${ch} · ـ${ch} · ${ch}ـ · ـ${ch}ـ</span></div>`).join('');
let examplesBuilt = false;
async function buildExamples() {
  if (examplesBuilt || !Q) return;
  await ensureWords();
  const entry = wordEntry(1);
  if (!entry) return;
  examplesBuilt = true;
  $('exampleWords').innerHTML = entry.m.map((m, wi) => {
    const meta = entry.w[wi] || ['', ''];
    return `<button class="btn" data-ex="${wi}"><span class="arabic" style="font-size:22px">${esc(wordTextOf(0, 1, entry, wi))}</span> <span class="muted small">${esc(meta[0] || '')} — ${esc(meta[1] || '')}</span></button>`;
  }).join('');
  $('exampleWords').querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => {
    openReader(0, 1);
    playSingleWord(0, 1, +b.dataset.ex);
  }));
}

/* ---------------- Bookmarks page ---------------- */
function renderBookmarksPage() {
  if (!Q) return;
  $('bookmarkPageList').innerHTML = bookmarks.length ? bookmarks.map(g => {
    const ref = findByGlobal(g);
    if (!ref) return '';
    return `<div class="list-item"><span><b>${esc(ref.s.en)} ${ref.a.n}</b> — <span class="arabic" style="font-size:19px">${esc(ref.a.t.slice(0, 60))}…</span><br><span class="muted small">${esc(transText(ref.a).slice(0, 110))}</span></span>
      <span><button class="btn btn-small" data-bm="open" data-g="${g}">Open</button> <button class="btn btn-small btn-primary" data-bm="play" data-g="${g}">▶ Play</button> <button class="btn btn-small" data-bm="del" data-g="${g}">Remove</button></span></div>`;
  }).join('') : '<p class="muted">No bookmarks yet. Open a surah, select an ayah, then “Bookmark ayah”.</p>';
}
$('bookmarkPageList').addEventListener('click', e => {
  const b = e.target.closest('[data-bm]');
  if (!b) return;
  const g = +b.dataset.g;
  const ref = findByGlobal(g);
  if (b.dataset.bm === 'del') { bookmarks = bookmarks.filter(x => x !== g); save('tilawah.bookmarks.v1', bookmarks); renderBookmarksPage(); renderHome(); }
  if (b.dataset.bm === 'open' && ref) openReader(ref.si, ref.a.n);
  if (b.dataset.bm === 'play' && ref) { sel = { s: ref.si, a: ref.a.n }; playAyahMode(); }
});

/* ---------------- Home extras (wrap renderHome) ---------------- */
const _renderHome = renderHome;
renderHome = function () { _renderHome(); renderHomeExtras(); };
function renderHomeExtras() {
  if (!Q) return;
  const g = (Math.floor(Date.now() / 86400000) % 6236) + 1;
  const ref = findByGlobal(g);
  if (ref) {
    $('dailyVerse').innerHTML = `
      <p class="arabic" dir="rtl" lang="ar" style="font-size:calc(var(--arabic-size) * .8);line-height:2.1">${esc(ref.a.t)}</p>
      <p>${esc(transText(ref.a) || ref.a.e)}</p>
      <p class="muted small">${esc(ref.s.en)} — Ayah ${ref.a.n} (Surah ${ref.s.number})</p>
      <div class="row wrap"><button class="btn btn-small" data-dv="read">Read in context</button><button class="btn btn-small btn-primary" data-dv="play">▶ Play this ayah</button></div>`;
  }
  const ll = load('tilawah.lastListen.v1', null);
  if (ll && ll.list && ll.list.length) {
    const qi = Math.min(ll.qi || 0, ll.list.length - 1);
    const pos = ll.list[qi];
    $('continueListening').innerHTML = `
      <p><b>${esc(ll.label)}</b> — position ${qi + 1} of ${ll.list.length} · ${esc(Q.surahs[pos.si].en)} ${pos.a} · ${esc((RECITERS[ll.reciter] || {}).name || '')}<br>
      <span class="muted small">${new Date(ll.t).toLocaleString()}</span></p>
      <div class="row wrap"><button class="btn btn-small btn-primary" data-cl="resume">▶ Resume listening</button></div>`;
  }
  const rl = $('recentList');
  if (rl) {
    rl.innerHTML = LISTEN_LOG.length ? LISTEN_LOG.slice(0, 5).map((h, i) =>
      `<div class="list-item"><span><b>${esc(h.label)}</b> · ${Q.surahs[h.si] ? esc(Q.surahs[h.si].en) : ''} ${h.a} <span class="muted small">${new Date(h.t).toLocaleString()}</span></span><button class="btn btn-small" data-recent="${i}">Open</button></div>`).join('')
      : '<p class="muted">Nothing played yet.</p>';
    rl.querySelectorAll('[data-recent]').forEach(b => b.addEventListener('click', () => { const h = LISTEN_LOG[+b.dataset.recent]; if (h) openReader(h.si, h.a); }));
  }
}
$('dailyVerse').addEventListener('click', e => {
  const b = e.target.closest('[data-dv]');
  if (!b) return;
  const g = (Math.floor(Date.now() / 86400000) % 6236) + 1;
  const ref = findByGlobal(g);
  if (!ref) return;
  if (b.dataset.dv === 'read') openReader(ref.si, ref.a.n);
  if (b.dataset.dv === 'play') { sel = { s: ref.si, a: ref.a.n }; lastPos = { ...sel }; save('tilawah.lastPos.v1', lastPos); playAyahMode(); }
});
$('continueListening').addEventListener('click', e => {
  const b = e.target.closest('[data-cl]');
  if (!b) return;
  const ll = load('tilawah.lastListen.v1', null);
  if (!ll || !ll.list || !ll.list.length) return;
  if (ll.reciter && RECITERS[ll.reciter] && ll.reciter !== settings.reciter) { settings.reciter = ll.reciter; applySettings(); }
  playQueue(ll.list.slice(Math.min(ll.qi || 0, ll.list.length - 1)), ll.label);
});

/* ---------------- Hadith library ---------------- */
let hadithLibTimer = null;
$('hadithSearch').addEventListener('input', () => { clearTimeout(hadithLibTimer); hadithLibTimer = setTimeout(renderHadithLibrary, 200); });
$('hadithFilter').addEventListener('change', renderHadithLibrary);
async function renderHadithLibrary() {
  const box = $('hadithLibrary');
  if (!box) return;
  const had = await ensureHadith();
  if (!had) { box.innerHTML = '<p class="muted">The hadith pool loads the first time you are online; after that it works offline.</p>'; return; }
  const q = ($('hadithSearch').value || '').trim().toLowerCase();
  const f = $('hadithFilter').value;
  const hits = [];
  had.hadiths.forEach((h, idx) => {
    if (f && h.book !== f) return;
    if (q && !(h.en.toLowerCase().includes(q) || (h.ur && h.ur.includes(q)) || String(h.number) === q)) return;
    hits.push({ h, idx });
  });
  box.innerHTML = hits.slice(0, 20).map(({ h, idx }) => `
    <div class="list-item"><span><b>${esc(h.book)} ${h.number}</b> — <span class="muted">${esc(h.en.slice(0, 110))}…</span></span>
    <button class="btn btn-small" data-hlib="${idx}">Open</button></div>`).join('')
    + (hits.length > 20 ? `<p class="muted small">Showing 20 of ${hits.length} matches — refine the search to see more.</p>` : '')
    || '<p class="muted">No matches in the 365-day pool.</p>';
  if (!hits.length) box.innerHTML = '<p class="muted">No matches in the 365-day pool.</p>';
  box.querySelectorAll('[data-hlib]').forEach(b => b.addEventListener('click', () => {
    hadithOffset = +b.dataset.hlib - hadithIndex(0);
    renderHadith();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
}

/* ---------------- Hifz (memorization) ---------------- */
$('hifzHideChk').addEventListener('change', e => {
  $('passageText').classList.toggle('hifz-hidden', e.target.checked);
  $('passageText').classList.remove('peek');
});
$('passageText').addEventListener('click', () => {
  if ($('passageText').classList.contains('hifz-hidden')) $('passageText').classList.toggle('peek');
});
$('hifzPlayBtn').addEventListener('click', () => {
  const p = passage();
  const list = p.ayahs.map(x => ({ si: p.si, a: x.n }));
  const reps = +$('hifzRepeatSel').value;
  playQueue(list, 'Hifz', { ref: true });
  v4Repeat.left = reps - 1; v4Repeat.list = list; v4Repeat.label = 'Hifz'; v4Repeat.ref = true;
  $('hifzStatus').textContent = `Playing ${Q.surahs[p.si].en} ${p.from}–${p.to} — ${reps} repetition(s) in total.`;
});
$('hifzDoneBtn').addEventListener('click', () => {
  const p = passage();
  const items = load('tilawah.hifz.v1', []);
  items.unshift({ s: p.si, from: p.from, to: p.to, t: Date.now() });
  save('tilawah.hifz.v1', items.slice(0, 100));
  $('hifzStatus').textContent = `Marked as memorized: ${Q.surahs[p.si].en} ${p.from}–${p.to}.`;
  renderHifzList();
});
function renderHifzList() {
  const box = $('hifzList');
  if (!box || !Q) return;
  const items = load('tilawah.hifz.v1', []);
  box.innerHTML = items.length ? items.map((h, i) =>
    `<div class="list-item"><span>✓ <b>${esc(Q.surahs[h.s].en)} ${h.from}–${h.to}</b> <span class="muted small">${new Date(h.t).toLocaleDateString()}</span></span>
     <span><button class="btn btn-small" data-hifz="resume" data-i="${i}">Resume</button> <button class="btn btn-small" data-hifz="del" data-i="${i}">Remove</button></span></div>`).join('')
    : '<p class="muted small">No passages marked as memorized yet.</p>';
}
$('hifzList').addEventListener('click', e => {
  const b = e.target.closest('[data-hifz]');
  if (!b) return;
  const items = load('tilawah.hifz.v1', []);
  const h = items[+b.dataset.i];
  if (!h) return;
  if (b.dataset.hifz === 'resume') { setPractice(h.s, h.from, h.to); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  if (b.dataset.hifz === 'del') { items.splice(+b.dataset.i, 1); save('tilawah.hifz.v1', items); renderHifzList(); }
});
