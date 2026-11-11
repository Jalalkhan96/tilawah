/*
 * Tilawah acoustic comparison engine (web edition)
 * --------------------------------------------------
 * Genuine local signal processing — no cloud, no speech-to-text.
 *
 * What it does (validated subset only):
 *  - Voice-activity detection, silence / clipping / level quality checks
 *  - Frame features: log-energy, spectral centroid, zero-crossing rate
 *  - Dynamic Time Warping (banded) between reference and user feature
 *    sequences, both per-sequence normalised so different voices /
 *    microphones can be compared by shape and timing, not identity
 *  - Duration-ratio, pause-ratio and per-word timing estimates derived
 *    from the DTW path (word boundaries on the reference are estimated
 *    from word character length — labelled as an estimate in the UI)
 *
 * What it does NOT do:
 *  - It does not judge tajweed rules or makhraj. It never claims a word
 *    is religiously "wrong". Low-quality or ambiguous audio returns
 *    "inconclusive" (gray) instead of a fabricated verdict.
 */
(function (global) {
  'use strict';

  var ENGINE_VERSION = 'tilawah-engine-web-1.0.0';

  // ---------- small FFT (radix-2, in-place) ----------
  function fft(re, im) {
    var n = re.length, j = 0, i, bit, len, half, k, ang, wre, wim, tre, tim, ure, uim;
    for (i = 1; i < n; i++) {
      bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        var tr = re[i]; re[i] = re[j]; re[j] = tr;
        var ti = im[i]; im[i] = im[j]; im[j] = ti;
      }
    }
    for (len = 2; len <= n; len <<= 1) {
      half = len >> 1; ang = -2 * Math.PI / len;
      var stepRe = Math.cos(ang), stepIm = Math.sin(ang);
      for (i = 0; i < n; i += len) {
        wre = 1; wim = 0;
        for (k = 0; k < half; k++) {
          ure = re[i + k]; uim = im[i + k];
          tre = re[i + k + half] * wre - im[i + k + half] * wim;
          tim = re[i + k + half] * wim + im[i + k + half] * wre;
          re[i + k] = ure + tre; im[i + k] = uim + tim;
          re[i + k + half] = ure - tre; im[i + k + half] = uim - tim;
          var nre = wre * stepRe - wim * stepIm; wim = wre * stepIm + wim * stepRe; wre = nre;
        }
      }
    }
  }

  // ---------- feature extraction ----------
  // samples: Float32Array mono, sampleRate: number
  // Returns frames: {t, energy(db-ish log), centroid(0..1), zcr(0..1), voiced}
  function extractFeatures(samples, sampleRate) {
    var FRAME = 1024, HOP = 512;
    var frames = [];
    var re = new Float64Array(FRAME), im = new Float64Array(FRAME);
    var win = new Float64Array(FRAME);
    for (var w = 0; w < FRAME; w++) win[w] = 0.5 - 0.5 * Math.cos(2 * Math.PI * w / (FRAME - 1)); // Hann
    var maxRms = 0;
    var raw = [];
    for (var start = 0; start + FRAME <= samples.length; start += HOP) {
      var sum = 0, zc = 0, prev = 0;
      for (var i = 0; i < FRAME; i++) {
        var v = samples[start + i];
        sum += v * v;
        if (i > 0 && ((v >= 0) !== (prev >= 0))) zc++;
        prev = v;
        re[i] = v * win[i]; im[i] = 0;
      }
      var rms = Math.sqrt(sum / FRAME);
      if (rms > maxRms) maxRms = rms;
      fft(re, im);
      var magSum = 0, freqSum = 0;
      for (var b = 1; b < FRAME / 2; b++) {
        var mag = Math.sqrt(re[b] * re[b] + im[b] * im[b]);
        magSum += mag; freqSum += mag * b;
      }
      var centroid = magSum > 1e-9 ? (freqSum / magSum) / (FRAME / 2) : 0;
      raw.push({ rms: rms, centroid: centroid, zcr: zc / FRAME });
    }
    // Voice activity: adaptive threshold relative to the loud frames
    var sorted = raw.map(function (f) { return f.rms; }).sort(function (a, b) { return a - b; });
    var p90 = sorted.length ? sorted[Math.floor(sorted.length * 0.9)] : 0;
    var vadThresh = Math.max(0.008, p90 * 0.18);
    for (var f = 0; f < raw.length; f++) {
      var fr = raw[f];
      frames.push({
        t: (f * HOP) / sampleRate,
        energy: Math.log10(fr.rms + 1e-6),
        centroid: fr.centroid,
        zcr: fr.zcr,
        rms: fr.rms,
        voiced: fr.rms >= vadThresh
      });
    }
    return { frames: frames, maxRms: maxRms, vadThresh: vadThresh };
  }

  function trimSilence(frames) {
    var first = -1, last = -1;
    for (var i = 0; i < frames.length; i++) if (frames[i].voiced) { if (first < 0) first = i; last = i; }
    if (first < 0) return [];
    // keep a small margin
    first = Math.max(0, first - 2); last = Math.min(frames.length - 1, last + 2);
    return frames.slice(first, last + 1);
  }

  function qualityReport(samples, sampleRate, features) {
    var clipped = 0, peak = 0, i;
    for (i = 0; i < samples.length; i++) {
      var a = Math.abs(samples[i]);
      if (a > peak) peak = a;
      if (a >= 0.999) clipped++;
    }
    var voiced = 0;
    for (i = 0; i < features.frames.length; i++) if (features.frames[i].voiced) voiced++;
    var total = Math.max(1, features.frames.length);
    return {
      durationSec: samples.length / sampleRate,
      peak: peak,
      clippingRatio: clipped / samples.length,
      voicedRatio: voiced / total,
      silenceRatio: 1 - voiced / total,
      tooShort: samples.length / sampleRate < 0.8,
      tooQuiet: peak < 0.03,
      tooClipped: clipped / samples.length > 0.01,
      mostlySilence: (voiced / total) < 0.15
    };
  }

  function znorm(values) {
    var mean = 0, i;
    for (i = 0; i < values.length; i++) mean += values[i];
    mean /= Math.max(1, values.length);
    var sd = 0;
    for (i = 0; i < values.length; i++) sd += (values[i] - mean) * (values[i] - mean);
    sd = Math.sqrt(sd / Math.max(1, values.length)) || 1;
    return values.map(function (v) { return (v - mean) / sd; });
  }

  function toVectors(frames) {
    var e = znorm(frames.map(function (f) { return f.energy; }));
    var c = znorm(frames.map(function (f) { return f.centroid; }));
    var z = znorm(frames.map(function (f) { return f.zcr; }));
    var v = frames.map(function (f) { return f.voiced ? 1 : 0; });
    var out = [];
    for (var i = 0; i < frames.length; i++) out.push([e[i], c[i] * 0.7, z[i] * 0.5, v[i] * 1.2]);
    return out;
  }

  function dist(a, b) {
    var s = 0;
    for (var i = 0; i < a.length; i++) { var d = a[i] - b[i]; s += d * d; }
    return Math.sqrt(s);
  }

  // Banded DTW. Returns {distance (avg per-step), path: [[refIdx, userIdx], ...]}
  function dtw(refVec, userVec) {
    var n = refVec.length, m = userVec.length;
    if (!n || !m) return { distance: Infinity, path: [] };
    var band = Math.max(Math.abs(n - m), Math.floor(Math.max(n, m) * 0.25));
    var INF = 1e18;
    var cost = new Float64Array(n * m).fill(INF);
    var i, j;
    for (i = 0; i < n; i++) {
      var j0 = Math.max(0, i - band), j1 = Math.min(m - 1, i + band);
      for (j = j0; j <= j1; j++) {
        var d = dist(refVec[i], userVec[j]);
        if (i === 0 && j === 0) { cost[0] = d; continue; }
        var best = INF;
        if (i > 0 && j >= Math.max(0, (i - 1) - band) && j <= Math.min(m - 1, (i - 1) + band)) best = Math.min(best, cost[(i - 1) * m + j]);
        if (j > 0) best = Math.min(best, cost[i * m + (j - 1)]);
        if (i > 0 && j > 0) best = Math.min(best, cost[(i - 1) * m + (j - 1)]);
        cost[i * m + j] = d + (best === INF ? 0 : best);
      }
    }
    // backtrack
    var path = [];
    i = n - 1; j = m - 1;
    while (i >= 0 && j >= 0) {
      path.push([i, j]);
      if (i === 0 && j === 0) break;
      var opts = [[i - 1, j, i > 0 ? cost[(i - 1) * m + j] : INF],
                  [i, j - 1, j > 0 ? cost[i * m + (j - 1)] : INF],
                  [i - 1, j - 1, (i > 0 && j > 0) ? cost[(i - 1) * m + (j - 1)] : INF]];
      opts.sort(function (a, b) { return a[2] - b[2]; });
      i = opts[0][0]; j = opts[0][1];
      if (i < 0) i = 0; if (j < 0) j = 0;
      if (path.length > n + m + 10) break;
    }
    path.reverse();
    var total = cost[(n - 1) * m + (m - 1)];
    return { distance: total / Math.max(1, path.length), path: path };
  }

  // Strip Arabic diacritics for length estimation only (never for display)
  function spokenLength(word) {
    var stripped = word.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '');
    return Math.max(1, stripped.length);
  }

  // words: [{text}] for the reference passage, in order.
  // refFrames/userFrames: trimmed frames with .t seconds.
  function wordTimings(words, refFrames, userFrames, path, refVecLen, refVec, userVec) {
    // local DTW cost per reference frame (min over path pairs for that frame)
    var localCost = new Array(refVecLen).fill(null);
    if (refVec && userVec) {
      path.forEach(function (p) {
        var c = dist(refVec[p[0]], userVec[p[1]]);
        if (localCost[p[0]] === null || c < localCost[p[0]]) localCost[p[0]] = c;
      });
      var lastC = 0;
      for (var lc = 0; lc < refVecLen; lc++) { if (localCost[lc] === null) localCost[lc] = lastC; else lastC = localCost[lc]; }
    }
    // reference word boundaries, proportional to spoken length
    var weights = words.map(function (w) { return spokenLength(w.text); });
    var totalW = weights.reduce(function (a, b) { return a + b; }, 0) || 1;
    var refDur = refFrames.length ? refFrames[refFrames.length - 1].t - refFrames[0].t : 0;
    var bounds = [], acc = 0;
    for (var i = 0; i < words.length; i++) {
      var start = acc / totalW * refDur, end = (acc + weights[i]) / totalW * refDur;
      bounds.push({ start: start, end: end }); acc += weights[i];
    }
    // map ref frame index -> user frame index via DTW path (median)
    var refToUser = new Array(refVecLen).fill(-1);
    var buckets = {};
    path.forEach(function (p) { (buckets[p[0]] = buckets[p[0]] || []).push(p[1]); });
    Object.keys(buckets).forEach(function (k) {
      var arr = buckets[k].sort(function (a, b) { return a - b; });
      refToUser[+k] = arr[Math.floor(arr.length / 2)];
    });
    var lastKnown = 0;
    for (var r = 0; r < refToUser.length; r++) {
      if (refToUser[r] < 0) refToUser[r] = lastKnown; else lastKnown = refToUser[r];
    }
    var hopSecRef = refFrames.length > 1 ? (refFrames[refFrames.length - 1].t - refFrames[0].t) / (refFrames.length - 1) : 0.032;
    var hopSecUser = userFrames.length > 1 ? (userFrames[userFrames.length - 1].t - userFrames[0].t) / (userFrames.length - 1) : 0.032;
    var out = [];
    for (var wIdx = 0; wIdx < words.length; wIdx++) {
      var b = bounds[wIdx];
      var refStartFrame = Math.min(refVecLen - 1, Math.max(0, Math.round(b.start / (hopSecRef || 0.032))));
      var refEndFrame = Math.min(refVecLen - 1, Math.max(refStartFrame, Math.round(b.end / (hopSecRef || 0.032)) - 1));
      var uStart = refToUser[refStartFrame], uEnd = refToUser[refEndFrame];
      var expected = b.end - b.start;
      var actual = Math.max(0, (uEnd - uStart + 1) * hopSecUser);
      // energy of the user segment: near-silence where reference speaks => possible omission
      var segVoiced = 0, segTotal = 0;
      for (var u = uStart; u <= uEnd && u < userFrames.length; u++) { segTotal++; if (userFrames[u].voiced) segVoiced++; }
      var segVoicedRatio = segTotal ? segVoiced / segTotal : 0;
      var ratio = expected > 0.05 ? actual / expected : 1;
      var segCostSum = 0, segCostN = 0;
      for (var cf = refStartFrame; cf <= refEndFrame; cf++) { if (localCost[cf] !== null && localCost[cf] !== undefined) { segCostSum += localCost[cf]; segCostN++; } }
      var meanCost = segCostN ? segCostSum / segCostN : 0;
      var status = 'ok', issue = null, conf = 0.55;
      if (segTotal >= 2 && segVoicedRatio < 0.35 && expected > 0.25) {
        status = 'error'; issue = 'Possible omitted or very quiet word — the reference has speech here, your recording is near-silent in this segment.'; conf = 0.72;
      } else if (ratio > 1.9) {
        status = 'warn'; issue = 'Much slower / longer than the reference here — possibly a prolonged vowel or a pause inside the word.'; conf = 0.6;
      } else if (ratio < 0.45 && expected > 0.25) {
        status = 'warn'; issue = 'Much faster / shorter than the reference here — check this word was fully pronounced.'; conf = 0.6;
      } else if (meanCost > 2.4 && expected > 0.25) {
        status = 'warn'; issue = 'The sound shape in this segment differs notably from the reference — listen back and compare this word.'; conf = 0.58;
      }
      out.push({ index: wIdx, text: words[wIdx].text, expectedSec: +expected.toFixed(2), actualSec: +actual.toFixed(2), ratio: +ratio.toFixed(2), meanCost: +meanCost.toFixed(2), status: status, issue: issue, confidence: conf });
    }
    return out;
  }

  // Main entry: refSamples/userSamples are Float32Array mono @ sampleRate (same rate)
  function analyze(refSamples, refRate, userSamples, userRate, words) {
    var refFeat = extractFeatures(refSamples, refRate);
    var userFeat = extractFeatures(userSamples, userRate);
    var quality = qualityReport(userSamples, userRate, userFeat);
    var base = { engineVersion: ENGINE_VERSION, quality: quality, words: [], status: 'inconclusive', score: null, confidence: 0, notes: [] };

    if (quality.tooShort) { base.notes.push('Recording is under 0.8 seconds — too short to analyse. Please record the full passage.'); return base; }
    if (quality.tooQuiet) { base.notes.push('Recording is very quiet (peak level below 3%). Move closer to the microphone and try again.'); return base; }
    if (quality.mostlySilence) { base.notes.push('Most of the recording is silence. Check the microphone and record again in a quieter place.'); return base; }
    if (quality.tooClipped) base.notes.push('Recording is clipping (too loud / distorted). Hold the phone a little further away.');

    var refTrim = trimSilence(refFeat.frames);
    var userTrim = trimSilence(userFeat.frames);
    if (refTrim.length < 8 || userTrim.length < 8) { base.notes.push('Not enough voiced audio to align reliably — result is inconclusive.'); return base; }

    var refVec = toVectors(refTrim), userVec = toVectors(userTrim);
    var res = dtw(refVec, userVec);
    var refDur = refTrim[refTrim.length - 1].t - refTrim[0].t;
    var userDur = userTrim[userTrim.length - 1].t - userTrim[0].t;
    var durationRatio = refDur > 0 ? userDur / refDur : 0;

    // Score: DTW distance mapped to 0..100 (heuristic calibration, documented)
    var score = Math.max(0, Math.min(100, Math.round(100 - (res.distance - 0.55) * 55)));
    if (durationRatio < 0.45 || durationRatio > 2.4) score = Math.min(score, 45);

    var wordResults = (words && words.length) ? wordTimings(words, refTrim, userTrim, res.path, refVec.length, refVec, userVec) : [];
    var errors = wordResults.filter(function (w) { return w.status === 'error'; }).length;
    var warns = wordResults.filter(function (w) { return w.status === 'warn'; }).length;

    var confidence = 0.5;
    if (quality.voicedRatio > 0.5) confidence += 0.15;
    if (!quality.tooClipped) confidence += 0.1;
    if (res.distance < 1.1) confidence += 0.15;
    if (durationRatio >= 0.6 && durationRatio <= 1.8) confidence += 0.1;
    confidence = Math.min(0.92, confidence);

    var status;
    if (res.distance > 2.3 || durationRatio < 0.35 || durationRatio > 3.0) {
      status = 'inconclusive';
      base.notes.push('Your recording could not be aligned to this passage (different passage, or too different in length). This is not a judgement on your recitation — please retry with the shown passage.');
      score = null;
    } else if (errors > 0 || score < 55) status = 'needs-work';
    else if (warns > 0 || score < 78) status = 'review';
    else status = 'good';

    base.status = status; base.score = score; base.confidence = +confidence.toFixed(2);
    base.dtwDistance = +res.distance.toFixed(3);
    base.durationRatio = +durationRatio.toFixed(2);
    base.refDurationSec = +refDur.toFixed(2); base.userDurationSec = +userDur.toFixed(2);
    base.words = wordResults;
    if (status === 'good') base.notes.push('Your recitation aligns closely with the reference in timing and sound shape. This checks alignment and timing only — it is not a tajweed judgement.');
    if (status === 'review') base.notes.push('Mostly aligned, with a few timing differences worth listening back to (yellow words).');
    if (status === 'needs-work') base.notes.push('Some segments differ enough from the reference to review (red / yellow words). Tap a word to hear the reference again.');
    return base;
  }

  var api = { analyze: analyze, extractFeatures: extractFeatures, qualityReport: qualityReport, dtw: dtw, trimSilence: trimSilence, ENGINE_VERSION: ENGINE_VERSION };
  global.TilawahEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
