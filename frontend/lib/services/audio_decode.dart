import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/services.dart';

/// Decodes audio files to mono PCM @ 16 kHz (Float32 in [-1, 1]).
///
/// - WAV files are decoded in pure Dart (PCM16 / PCM32-float, mono or
///   stereo downmix) — this covers the app's own recordings (the `record`
///   package is configured for WAV @ 16 kHz).
/// - Compressed files (the reference MP3s) are decoded through a small
///   native platform channel implemented in MainActivity.kt using
///   Android's MediaExtractor/MediaCodec. On platforms without the
///   channel (iOS in this build), decoding throws and the practice flow
///   reports an honest "reference decode unavailable" state.
class AudioDecode {
  static const _channel = MethodChannel('tilawah/audio_decode');
  static const int targetRate = 16000;

  static Future<Float32List> decodeFileTo16kMono(String path) async {
    final bytes = await File(path).readAsBytes();
    if (_isWav(bytes)) {
      final (samples, rate) = decodeWav(bytes);
      return resample(samples, rate, targetRate);
    }
    // Compressed audio → native decode (Android MediaCodec)
    final result = await _channel.invokeMethod<Uint8List>('decodeToPcm16k', {
      'path': path,
    });
    if (result == null) {
      throw StateError('Native audio decode returned no data');
    }
    final data = ByteData.sublistView(result);
    final n = result.length ~/ 2;
    final out = Float32List(n);
    for (var i = 0; i < n; i++) {
      out[i] = data.getInt16(i * 2, Endian.little) / 32768.0;
    }
    return out; // native side already resampled to 16 kHz mono
  }

  static bool _isWav(Uint8List b) =>
      b.length > 12 &&
      b[0] == 0x52 &&
      b[1] == 0x49 &&
      b[2] == 0x46 &&
      b[3] == 0x46 && // RIFF
      b[8] == 0x57 &&
      b[9] == 0x41 &&
      b[10] == 0x56 &&
      b[11] == 0x45; // WAVE

  /// Minimal RIFF/WAV decoder: PCM16 and IEEE-float32, any channel count
  /// (downmixed to mono). Throws FormatException on anything else.
  static (Float32List, int) decodeWav(Uint8List bytes) {
    final data = ByteData.sublistView(bytes);
    var offset = 12;
    int? audioFormat, channels, sampleRate, bitsPerSample;
    Uint8List? pcm;
    while (offset + 8 <= bytes.length) {
      final chunkId = String.fromCharCodes(bytes.sublist(offset, offset + 4));
      final chunkSize = data.getUint32(offset + 4, Endian.little);
      final start = offset + 8;
      if (chunkId == 'fmt ') {
        audioFormat = data.getUint16(start, Endian.little);
        channels = data.getUint16(start + 2, Endian.little);
        sampleRate = data.getUint32(start + 4, Endian.little);
        bitsPerSample = data.getUint16(start + 14, Endian.little);
      } else if (chunkId == 'data') {
        pcm = bytes.sublist(start, start + chunkSize);
      }
      offset = start + chunkSize + (chunkSize.isOdd ? 1 : 0);
    }
    if (pcm == null ||
        audioFormat == null ||
        channels == null ||
        sampleRate == null ||
        bitsPerSample == null) {
      throw const FormatException('Invalid WAV file');
    }
    final pcmData = ByteData.sublistView(pcm);
    final bytesPerSample = bitsPerSample ~/ 8;
    final frameCount = pcm.length ~/ (bytesPerSample * channels);
    final out = Float32List(frameCount);
    for (var f = 0; f < frameCount; f++) {
      var sum = 0.0;
      for (var c = 0; c < channels; c++) {
        final idx = (f * channels + c) * bytesPerSample;
        if (audioFormat == 1 && bitsPerSample == 16) {
          sum += pcmData.getInt16(idx, Endian.little) / 32768.0;
        } else if (audioFormat == 3 && bitsPerSample == 32) {
          sum += pcmData.getFloat32(idx, Endian.little);
        } else {
          throw FormatException(
            'Unsupported WAV format: format=$audioFormat bits=$bitsPerSample',
          );
        }
      }
      out[f] = sum / channels;
    }
    return (out, sampleRate);
  }

  /// Linear-interpolation resampler (adequate for envelope/timing features).
  static Float32List resample(Float32List input, int fromRate, int toRate) {
    if (fromRate == toRate || input.isEmpty) return Float32List.fromList(input);
    final outLen = (input.length * toRate / fromRate).round();
    final out = Float32List(outLen);
    final ratio = (input.length - 1) / (outLen - 1).clamp(1, 1 << 62);
    for (var i = 0; i < outLen; i++) {
      final pos = i * ratio;
      final i0 = pos.floor();
      final i1 = (i0 + 1).clamp(0, input.length - 1);
      final frac = pos - i0;
      out[i] = input[i0] * (1 - frac) + input[i1] * frac;
    }
    return out;
  }

  static Float32List concat(List<Float32List> parts) {
    final total = parts.fold<int>(0, (n, p) => n + p.length);
    final out = Float32List(total);
    var off = 0;
    for (final part in parts) {
      out.setRange(off, off + part.length, part);
      off += part.length;
    }
    return out;
  }
}
