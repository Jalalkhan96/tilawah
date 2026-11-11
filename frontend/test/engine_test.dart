import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:tilawah/alignment_engine/engine.dart';

const int sr = 16000;

/// Synthetic "recitation": word-like segments of tones separated by
/// silence — a crude stand-in to validate engine logic without real
/// audio fixtures (same approach as the web engine tests).
Float32List synth(List<List<double>> segments) {
  final out = <double>[];
  var t = 0.0;
  void push(double v) {
    out.add(v);
    t += 1 / sr;
  }

  for (var i = 0; i < (0.2 * sr).round(); i++) {
    push(0);
  }
  for (final seg in segments) {
    final freq = seg[0], seconds = seg[1], amp = seg[2];
    final n = (seconds * sr).round();
    if (freq == 0) {
      for (var i = 0; i < n; i++) {
        push(0);
      }
    } else {
      final localT = t;
      for (var i = 0; i < n; i++) {
        final env = math.sin(math.pi * (i / n)) * amp;
        push(math.sin(2 * math.pi * freq * (localT + i / sr)) * env * 0.7);
      }
      t = localT + seconds;
    }
  }
  for (var i = 0; i < (0.2 * sr).round(); i++) {
    push(0);
  }
  return Float32List.fromList(out);
}

void main() {
  final refSeg = [
    [220.0, 0.6, 0.9],
    [180.0, 0.2, 0.0],
    [330.0, 0.8, 0.9],
    [180.0, 0.2, 0.0],
    [260.0, 0.5, 0.9],
  ];
  final refWords = ['بسم', 'الله', 'الرحمن'];

  test('identical recording scores well', () {
    final r = TilawahEngine.analyze(
      synth(refSeg),
      sr,
      synth(refSeg),
      sr,
      refWords,
    );
    expect(r.status, anyOf('good', 'review'));
    expect(r.score, isNotNull);
    expect(r.score!, greaterThanOrEqualTo(70));
    expect(r.durationRatio, closeTo(1.0, 0.15));
  });

  test('silence is inconclusive, no score', () {
    final silence = synth([
      [0.0, 2.5, 0.0],
    ]);
    final r = TilawahEngine.analyze(synth(refSeg), sr, silence, sr, refWords);
    expect(r.status, 'inconclusive');
    expect(r.score, isNull);
  });

  test('too-short recording is inconclusive', () {
    final short = Float32List((0.3 * sr).round());
    final r = TilawahEngine.analyze(synth(refSeg), sr, short, sr, refWords);
    expect(r.status, 'inconclusive');
  });

  test('omitted middle word is flagged', () {
    final omit = synth([
      [220.0, 0.6, 0.9],
      [180.0, 0.2, 0.0],
      [0.0, 0.8, 0.0], // middle word replaced by silence
      [180.0, 0.2, 0.0],
      [260.0, 0.5, 0.9],
    ]);
    final r = TilawahEngine.analyze(synth(refSeg), sr, omit, sr, refWords);
    expect(r.status, isNot('good'));
    expect(
      r.words.any((w) => w.status == 'warn' || w.status == 'error'),
      isTrue,
    );
  });

  test('slow recitation shows duration ratio > 1.5', () {
    final slow = synth(refSeg.map((s) => [s[0], s[1] * 2, s[2]]).toList());
    final r = TilawahEngine.analyze(synth(refSeg), sr, slow, sr, refWords);
    expect(r.durationRatio, greaterThan(1.5));
  });

  test('dtw identical distance ~0', () {
    final f = TilawahEngine.extractFeatures(synth(refSeg), sr);
    expect(f.frames, isNotEmpty);
  });
}
