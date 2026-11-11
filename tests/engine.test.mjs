// Engine tests: synthetic signals, no external data.
// Run: node tests/engine.test.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const E = require('../app/js/engine.js');

let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log('  ok -', name); } else { fail++; console.log('  FAIL -', name); } }

const SR = 16000;
function tone(freq, sec, amp = 0.4, pauseAfter = 0) {
  const n = Math.floor(SR * sec), out = new Float32Array(n + Math.floor(SR * pauseAfter));
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin(2 * Math.PI * freq * i / SR) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 3 * i / SR));
  return out;
}
function concat(...parts) { const t = parts.reduce((a, p) => a + p.length, 0); const o = new Float32Array(t); let off = 0; for (const p of parts) { o.set(p, off); off += p.length; } return o; }
function silence(sec) { return new Float32Array(Math.floor(SR * sec)); }

// a "passage": three tones like three words
const ref = concat(tone(220, 0.5, 0.4, 0.1), tone(330, 0.5, 0.4, 0.1), tone(262, 0.6, 0.4));
const words = [{ text: 'بِسْمِ' }, { text: 'ٱللَّهِ' }, { text: 'ٱلرَّحِيمِ' }];

// 1. identical recording should align well
let r = E.analyze(ref, SR, ref.slice(), SR, words);
check('identical -> status good/review', r.status === 'good' || r.status === 'review');
check('identical -> high score', r.score !== null && r.score >= 70);
check('identical -> duration ratio ~1', Math.abs(r.durationRatio - 1) < 0.15);
check('identical -> 3 word results', r.words.length === 3);

// 2. silence should be inconclusive
r = E.analyze(ref, SR, silence(2), SR, words);
check('silence -> inconclusive', r.status === 'inconclusive');
check('silence -> no fabricated score/words verdict', r.score === null);

// 3. too short
r = E.analyze(ref, SR, tone(220, 0.3), SR, words);
check('too short -> inconclusive', r.status === 'inconclusive');

// 4. missing middle word (silence gap) should flag a segment
const missing = concat(tone(220, 0.5, 0.4, 0.1), silence(0.55), tone(262, 0.6, 0.4));
r = E.analyze(ref, SR, missing, SR, words);
check('omission -> not good', r.status !== 'good');
check('omission -> some word flagged warn/error', r.words.some(w => w.status !== 'ok'));

// 5. much slower recitation -> duration ratio reflects it, still aligns (not inconclusive by speed alone)
const slow = concat(tone(220, 1.0, 0.4, 0.15), tone(330, 1.0, 0.4, 0.15), tone(262, 1.1, 0.4));
r = E.analyze(ref, SR, slow, SR, words);
check('slow -> duration ratio > 1.5', r.durationRatio > 1.5);

// 6. DTW sanity: identical vectors distance small
const v = [[0, 0, 0, 1], [1, 0.5, 0, 1], [0.5, 1, 0, 0]];
check('dtw identical distance ~0', E.dtw(v, v).distance < 0.01);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
