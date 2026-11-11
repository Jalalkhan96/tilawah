/// Tilawah acoustic comparison engine — Dart port of the web engine
/// (same algorithms, same thresholds, same honesty rules).
///
/// Genuine local signal processing: VAD, quality checks, frame features
/// (log-energy, spectral centroid, zero-crossing rate), banded DTW
/// alignment, duration ratios and per-word timing estimates.
///
/// It does NOT judge tajweed or makhraj, never uses speech-to-text as an
/// assessment shortcut, and returns "inconclusive" instead of fabricating
/// a verdict when the evidence is weak. See docs/LIMITATIONS.md.
library;

import 'dart:math' as math;
import 'dart:typed_data';

const String kEngineVersion = 'tilawah-engine-dart-1.0.0';

class Frame {
  final double t, energy, centroid, zcr, rms;
  final bool voiced;
  const Frame(
    this.t,
    this.energy,
    this.centroid,
    this.zcr,
    this.rms,
    this.voiced,
  );
}

class QualityReport {
  final double durationSec, peak, clippingRatio, voicedRatio, silenceRatio;
  final bool tooShort, tooQuiet, tooClipped, mostlySilence;
  const QualityReport({
    required this.durationSec,
    required this.peak,
    required this.clippingRatio,
    required this.voicedRatio,
    required this.silenceRatio,
    required this.tooShort,
    required this.tooQuiet,
    required this.tooClipped,
    required this.mostlySilence,
  });
}

class WordResult {
  final int index;
  final String text;
  final double expectedSec, actualSec, ratio, meanCost, confidence;
  final String status; // ok | warn | error
  final String? issue;
  const WordResult({
    required this.index,
    required this.text,
    required this.expectedSec,
    required this.actualSec,
    required this.ratio,
    required this.meanCost,
    required this.confidence,
    required this.status,
    required this.issue,
  });
}

class AnalysisResult {
  final String status; // good | review | needs-work | inconclusive
  final int? score;
  final double confidence;
  final QualityReport quality;
  final List<WordResult> words;
  final List<String> notes;
  final double? dtwDistance, durationRatio, refDurationSec, userDurationSec;
  const AnalysisResult({
    required this.status,
    required this.score,
    required this.confidence,
    required this.quality,
    required this.words,
    required this.notes,
    this.dtwDistance,
    this.durationRatio,
    this.refDurationSec,
    this.userDurationSec,
  });
}

class FeatureSet {
  final List<Frame> frames;
  final double maxRms;
  const FeatureSet(this.frames, this.maxRms);
}

class TilawahEngine {
  // ---- FFT (radix-2, in-place) ----
  static void _fft(Float64List re, Float64List im) {
    final n = re.length;
    var j = 0;
    for (var i = 1; i < n; i++) {
      var bit = n >> 1;
      while ((j & bit) != 0) {
        j ^= bit;
        bit >>= 1;
      }
      j ^= bit;
      if (i < j) {
        final tr = re[i];
        re[i] = re[j];
        re[j] = tr;
        final ti = im[i];
        im[i] = im[j];
        im[j] = ti;
      }
    }
    for (var len = 2; len <= n; len <<= 1) {
      final half = len >> 1;
      final ang = -2 * math.pi / len;
      final stepRe = math.cos(ang), stepIm = math.sin(ang);
      for (var i = 0; i < n; i += len) {
        var wre = 1.0, wim = 0.0;
        for (var k = 0; k < half; k++) {
          final ure = re[i + k], uim = im[i + k];
          final tre = re[i + k + half] * wre - im[i + k + half] * wim;
          final tim = re[i + k + half] * wim + im[i + k + half] * wre;
          re[i + k] = ure + tre;
          im[i + k] = uim + tim;
          re[i + k + half] = ure - tre;
          im[i + k + half] = uim - tim;
          final nre = wre * stepRe - wim * stepIm;
          wim = wre * stepIm + wim * stepRe;
          wre = nre;
        }
      }
    }
  }

  static FeatureSet extractFeatures(Float32List samples, int sampleRate) {
    const frameSize = 1024, hop = 512;
    final win = Float64List(frameSize);
    for (var w = 0; w < frameSize; w++) {
      win[w] = 0.5 - 0.5 * math.cos(2 * math.pi * w / (frameSize - 1));
    }
    final rawRms = <double>[], rawCentroid = <double>[], rawZcr = <double>[];
    var maxRms = 0.0;
    final re = Float64List(frameSize), im = Float64List(frameSize);
    for (var start = 0; start + frameSize <= samples.length; start += hop) {
      var sum = 0.0;
      var zc = 0;
      var prev = 0.0;
      for (var i = 0; i < frameSize; i++) {
        final v = samples[start + i].toDouble();
        sum += v * v;
        if (i > 0 && ((v >= 0) != (prev >= 0))) zc++;
        prev = v;
        re[i] = v * win[i];
        im[i] = 0;
      }
      final rms = math.sqrt(sum / frameSize);
      if (rms > maxRms) maxRms = rms;
      _fft(re, im);
      var magSum = 0.0, freqSum = 0.0;
      for (var b = 1; b < frameSize / 2; b++) {
        final mag = math.sqrt(re[b] * re[b] + im[b] * im[b]);
        magSum += mag;
        freqSum += mag * b;
      }
      rawRms.add(rms);
      rawCentroid.add(magSum > 1e-9 ? (freqSum / magSum) / (frameSize / 2) : 0);
      rawZcr.add(zc / frameSize);
    }
    final sorted = [...rawRms]..sort();
    final p90 = sorted.isEmpty ? 0.0 : sorted[(sorted.length * 0.9).floor()];
    final vadThresh = math.max(0.008, p90 * 0.18);
    final frames = <Frame>[];
    for (var f = 0; f < rawRms.length; f++) {
      frames.add(
        Frame(
          f * hop / sampleRate,
          math.log(rawRms[f] + 1e-6) / math.ln10,
          rawCentroid[f],
          rawZcr[f],
          rawRms[f],
          rawRms[f] >= vadThresh,
        ),
      );
    }
    return FeatureSet(frames, maxRms);
  }

  static QualityReport qualityReport(
    Float32List samples,
    int sampleRate,
    FeatureSet feat,
  ) {
    var clipped = 0;
    var peak = 0.0;
    for (final s in samples) {
      final a = s.abs();
      if (a > peak) peak = a;
      if (a >= 0.999) clipped++;
    }
    final voiced = feat.frames.where((f) => f.voiced).length;
    final total = math.max(1, feat.frames.length);
    final dur = samples.length / sampleRate;
    return QualityReport(
      durationSec: dur,
      peak: peak,
      clippingRatio: samples.isEmpty ? 0 : clipped / samples.length,
      voicedRatio: voiced / total,
      silenceRatio: 1 - voiced / total,
      tooShort: dur < 0.8,
      tooQuiet: peak < 0.03,
      tooClipped: samples.isNotEmpty && clipped / samples.length > 0.01,
      mostlySilence: (voiced / total) < 0.15,
    );
  }

  static List<Frame> _trim(List<Frame> frames) {
    var first = -1, last = -1;
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].voiced) {
        if (first < 0) first = i;
        last = i;
      }
    }
    if (first < 0) return const [];
    first = math.max(0, first - 2);
    last = math.min(frames.length - 1, last + 2);
    return frames.sublist(first, last + 1);
  }

  static List<double> _znorm(List<double> v) {
    var mean = 0.0;
    for (final x in v) {
      mean += x;
    }
    mean /= math.max(1, v.length);
    var sd = 0.0;
    for (final x in v) {
      sd += (x - mean) * (x - mean);
    }
    sd = math.sqrt(sd / math.max(1, v.length));
    if (sd == 0) sd = 1;
    return v.map((x) => (x - mean) / sd).toList();
  }

  static List<List<double>> _vectors(List<Frame> frames) {
    final e = _znorm(frames.map((f) => f.energy).toList());
    final c = _znorm(frames.map((f) => f.centroid).toList());
    final z = _znorm(frames.map((f) => f.zcr).toList());
    return [
      for (var i = 0; i < frames.length; i++)
        [e[i], c[i] * 0.7, z[i] * 0.5, frames[i].voiced ? 1.2 : 0.0],
    ];
  }

  static double _dist(List<double> a, List<double> b) {
    var s = 0.0;
    for (var i = 0; i < a.length; i++) {
      final d = a[i] - b[i];
      s += d * d;
    }
    return math.sqrt(s);
  }

  /// Banded DTW. Returns (average distance, path of (refIdx, userIdx)).
  static (double, List<(int, int)>) dtw(
    List<List<double>> refVec,
    List<List<double>> userVec,
  ) {
    final n = refVec.length, m = userVec.length;
    if (n == 0 || m == 0) return (double.infinity, const []);
    final band = math.max((n - m).abs(), (math.max(n, m) * 0.25).floor());
    const inf = 1e18;
    final cost = Float64List(n * m)..fillRange(0, n * m, inf);
    for (var i = 0; i < n; i++) {
      final j0 = math.max(0, i - band), j1 = math.min(m - 1, i + band);
      for (var j = j0; j <= j1; j++) {
        final d = _dist(refVec[i], userVec[j]);
        if (i == 0 && j == 0) {
          cost[0] = d;
          continue;
        }
        var best = inf;
        if (i > 0) best = math.min(best, cost[(i - 1) * m + j]);
        if (j > 0) best = math.min(best, cost[i * m + (j - 1)]);
        if (i > 0 && j > 0) best = math.min(best, cost[(i - 1) * m + (j - 1)]);
        cost[i * m + j] = d + (best == inf ? 0 : best);
      }
    }
    final path = <(int, int)>[];
    var i = n - 1, j = m - 1;
    while (i >= 0 && j >= 0) {
      path.add((i, j));
      if (i == 0 && j == 0) break;
      final opts = <(int, int, double)>[
        (i - 1, j, i > 0 ? cost[(i - 1) * m + j] : inf),
        (i, j - 1, j > 0 ? cost[i * m + (j - 1)] : inf),
        (i - 1, j - 1, (i > 0 && j > 0) ? cost[(i - 1) * m + (j - 1)] : inf),
      ]..sort((a, b) => a.$3.compareTo(b.$3));
      i = math.max(0, opts[0].$1);
      j = math.max(0, opts[0].$2);
      if (path.length > n + m + 10) break;
    }
    final total = cost[(n - 1) * m + (m - 1)];
    return (total / math.max(1, path.length), path.reversed.toList());
  }

  static int _spokenLength(String word) {
    final stripped = word.replaceAll(RegExp(r'[ـً-ٰٟۖ-ۭ]'), '');
    return math.max(1, stripped.runes.length);
  }

  static List<WordResult> _wordTimings(
    List<String> words,
    List<Frame> refFrames,
    List<Frame> userFrames,
    List<(int, int)> path,
    List<List<double>> refVec,
    List<List<double>> userVec,
  ) {
    final refVecLen = refVec.length;
    final localCost = List<double?>.filled(refVecLen, null);
    for (final p in path) {
      final c = _dist(refVec[p.$1], userVec[p.$2]);
      if (localCost[p.$1] == null || c < localCost[p.$1]!) localCost[p.$1] = c;
    }
    var lastC = 0.0;
    for (var i = 0; i < refVecLen; i++) {
      if (localCost[i] == null) {
        localCost[i] = lastC;
      } else {
        lastC = localCost[i]!;
      }
    }
    final weights = words.map(_spokenLength).toList();
    final totalW = weights.fold<int>(0, (a, b) => a + b);
    final refDur = refFrames.isEmpty
        ? 0.0
        : refFrames.last.t - refFrames.first.t;
    final buckets = <int, List<int>>{};
    for (final p in path) {
      (buckets[p.$1] ??= []).add(p.$2);
    }
    final refToUser = List<int>.filled(refVecLen, -1);
    buckets.forEach((k, arr) {
      arr.sort();
      refToUser[k] = arr[arr.length ~/ 2];
    });
    var lastKnown = 0;
    for (var r = 0; r < refVecLen; r++) {
      if (refToUser[r] < 0) {
        refToUser[r] = lastKnown;
      } else {
        lastKnown = refToUser[r];
      }
    }
    final hopRef = refFrames.length > 1
        ? (refFrames.last.t - refFrames.first.t) / (refFrames.length - 1)
        : 0.032;
    final hopUser = userFrames.length > 1
        ? (userFrames.last.t - userFrames.first.t) / (userFrames.length - 1)
        : 0.032;
    final out = <WordResult>[];
    var acc = 0;
    for (var wi = 0; wi < words.length; wi++) {
      final start = acc / math.max(1, totalW) * refDur;
      final end = (acc + weights[wi]) / math.max(1, totalW) * refDur;
      acc += weights[wi];
      final expected = end - start;
      final refStartFrame = (start / (hopRef == 0 ? 0.032 : hopRef))
          .round()
          .clamp(0, refVecLen - 1);
      final refEndFrame = ((end / (hopRef == 0 ? 0.032 : hopRef)).round() - 1)
          .clamp(refStartFrame, refVecLen - 1);
      final uStart = refToUser[refStartFrame], uEnd = refToUser[refEndFrame];
      final actual = math.max(0, (uEnd - uStart + 1) * hopUser).toDouble();
      var segVoiced = 0, segTotal = 0;
      for (var u = uStart; u <= uEnd && u < userFrames.length; u++) {
        segTotal++;
        if (userFrames[u].voiced) segVoiced++;
      }
      final segRatio = segTotal == 0 ? 0.0 : segVoiced / segTotal;
      final ratio = expected > 0.05 ? actual / expected : 1.0;
      var costSum = 0.0, costN = 0;
      for (var cf = refStartFrame; cf <= refEndFrame; cf++) {
        costSum += localCost[cf] ?? 0;
        costN++;
      }
      final meanCost = costN == 0 ? 0.0 : costSum / costN;
      var status = 'ok';
      String? issue;
      var conf = 0.55;
      if (segTotal >= 2 && segRatio < 0.35 && expected > 0.25) {
        status = 'error';
        issue = 'Possible omitted or very quiet word — the reference has speech here, your recording is near-silent in this segment.';
        conf = 0.72;
      } else if (ratio > 1.9) {
        status = 'warn';
        issue = 'Much slower / longer than the reference here — possibly a prolonged vowel or a pause inside the word.';
        conf = 0.6;
      } else if (ratio < 0.45 && expected > 0.25) {
        status = 'warn';
        issue = 'Much faster / shorter than the reference here — check this word was fully pronounced.';
        conf = 0.6;
      } else if (meanCost > 2.4 && expected > 0.25) {
        status = 'warn';
        issue = 'The sound shape in this segment differs notably from the reference — listen back and compare this word.';
        conf = 0.58;
      }
      out.add(
        WordResult(
          index: wi,
          text: words[wi],
          expectedSec: double.parse(expected.toStringAsFixed(2)),
          actualSec: double.parse(actual.toStringAsFixed(2)),
          ratio: double.parse(ratio.toStringAsFixed(2)),
          meanCost: double.parse(meanCost.toStringAsFixed(2)),
          confidence: conf,
          status: status,
          issue: issue,
        ),
      );
    }
    return out;
  }

  /// Main entry. Samples are mono float in [-1, 1].
  static AnalysisResult analyze(
    Float32List refSamples,
    int refRate,
    Float32List userSamples,
    int userRate,
    List<String> words,
  ) {
    final refFeat = extractFeatures(refSamples, refRate);
    final userFeat = extractFeatures(userSamples, userRate);
    final quality = qualityReport(userSamples, userRate, userFeat);
    AnalysisResult inconclusive(String note) => AnalysisResult(
      status: 'inconclusive',
      score: null,
      confidence: 0,
      quality: quality,
      words: const [],
      notes: [note],
    );
    if (quality.tooShort) {
      return inconclusive(
        'Recording is under 0.8 seconds — too short to analyse. Please record the full passage.',
      );
    }
    if (quality.tooQuiet) {
      return inconclusive(
        'Recording is very quiet (peak level below 3%). Move closer to the microphone and try again.',
      );
    }
    if (quality.mostlySilence) {
      return inconclusive(
        'Most of the recording is silence. Check the microphone and record again in a quieter place.',
      );
    }
    final notes = <String>[];
    if (quality.tooClipped) {
      notes.add(
        'Recording is clipping (too loud / distorted). Hold the phone a little further away.',
      );
    }
    final refTrim = _trim(refFeat.frames);
    final userTrim = _trim(userFeat.frames);
    if (refTrim.length < 8 || userTrim.length < 8) {
      return inconclusive(
        'Not enough voiced audio to align reliably — result is inconclusive.',
      );
    }
    final refVec = _vectors(refTrim);
    final userVec = _vectors(userTrim);
    final (distance, path) = dtw(refVec, userVec);
    final refDur = refTrim.last.t - refTrim.first.t;
    final userDur = userTrim.last.t - userTrim.first.t;
    final durationRatio = refDur > 0 ? userDur / refDur : 0.0;
    var score = (100 - (distance - 0.55) * 55).round().clamp(0, 100);
    if (durationRatio < 0.45 || durationRatio > 2.4) {
      score = math.min(score, 45);
    }
    final wordResults = words.isEmpty
        ? <WordResult>[]
        : _wordTimings(words, refTrim, userTrim, path, refVec, userVec);
    final errors = wordResults.where((w) => w.status == 'error').length;
    final warns = wordResults.where((w) => w.status == 'warn').length;
    var confidence = 0.5;
    if (quality.voicedRatio > 0.5) confidence += 0.15;
    if (!quality.tooClipped) confidence += 0.1;
    if (distance < 1.1) confidence += 0.15;
    if (durationRatio >= 0.6 && durationRatio <= 1.8) confidence += 0.1;
    confidence = math.min(0.92, confidence);
    String status;
    int? finalScore = score;
    if (distance > 2.3 || durationRatio < 0.35 || durationRatio > 3.0) {
      status = 'inconclusive';
      finalScore = null;
      notes.add(
        'Your recording could not be aligned to this passage (different passage, or too different in length). This is not a judgement on your recitation — please retry with the shown passage.',
      );
    } else if (errors > 0 || score < 55) {
      status = 'needs-work';
      notes.add(
        'Some segments differ enough from the reference to review (red / yellow words). Tap a word to hear the reference again.',
      );
    } else if (warns > 0 || score < 78) {
      status = 'review';
      notes.add(
        'Mostly aligned, with a few timing differences worth listening back to (yellow words).',
      );
    } else {
      status = 'good';
      notes.add(
        'Your recitation aligns closely with the reference in timing and sound shape. This checks alignment and timing only — it is not a tajweed judgement.',
      );
    }
    return AnalysisResult(
      status: status,
      score: finalScore,
      confidence: double.parse(confidence.toStringAsFixed(2)),
      quality: quality,
      words: wordResults,
      notes: notes,
      dtwDistance: double.parse(distance.toStringAsFixed(3)),
      durationRatio: double.parse(durationRatio.toStringAsFixed(2)),
      refDurationSec: double.parse(refDur.toStringAsFixed(2)),
      userDurationSec: double.parse(userDur.toStringAsFixed(2)),
    );
  }
}
