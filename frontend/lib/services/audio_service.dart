import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:just_audio/just_audio.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// Reference-audio handling:
/// - Per-ayah MP3s come from the Islamic Network CDN:
///   https://cdn.islamic.network/quran/audio/128/RECITER/GLOBAL_AYAH.mp3
/// - Files are downloaded once into the app documents folder and reused
///   offline afterwards. Nothing is uploaded anywhere.
class AudioService {
  final AudioPlayer player = AudioPlayer();
  List<String> _queue = [];
  List<String> _labels = [];
  void Function(String label)? onTrackLabel;
  void Function()? onQueueFinished;

  AudioService() {
    player.playerStateStream.listen((state) {
      if (state.processingState == ProcessingState.completed &&
          _queue.isNotEmpty) {
        _playNext();
      }
    });
  }

  static String remoteUrl(String reciter, int globalAyah) =>
      'https://cdn.islamic.network/quran/audio/128/$reciter/$globalAyah.mp3';

  Future<Directory> cacheDir(String reciter) async {
    final docs = await getApplicationDocumentsDirectory();
    final dir = Directory(p.join(docs.path, 'audio_cache', reciter));
    if (!await dir.exists()) await dir.create(recursive: true);
    return dir;
  }

  /// Returns the local file for an ayah, downloading it if needed.
  /// Throws when offline and not yet cached.
  Future<File> localFile(String reciter, int globalAyah) async {
    final dir = await cacheDir(reciter);
    final file = File(p.join(dir.path, '$globalAyah.mp3'));
    if (await file.exists() && await file.length() > 0) return file;
    final res = await http.get(Uri.parse(remoteUrl(reciter, globalAyah)));
    if (res.statusCode != 200) {
      throw HttpException(
        'Audio download failed (${res.statusCode}) for ayah $globalAyah',
      );
    }
    await file.writeAsBytes(res.bodyBytes);
    return file;
  }

  Future<bool> isCached(String reciter, int globalAyah) async {
    final dir = await cacheDir(reciter);
    final f = File(p.join(dir.path, '$globalAyah.mp3'));
    return await f.exists() && await f.length() > 0;
  }

  Future<void> downloadSurah(
    String reciter,
    List<int> globalAyahs,
    void Function(int done, int total) onProgress,
  ) async {
    var done = 0;
    for (final g in globalAyahs) {
      await localFile(reciter, g);
      done++;
      onProgress(done, globalAyahs.length);
    }
  }

  Future<int> cacheSizeBytes() async {
    final docs = await getApplicationDocumentsDirectory();
    final root = Directory(p.join(docs.path, 'audio_cache'));
    if (!await root.exists()) return 0;
    var total = 0;
    await for (final e in root.list(recursive: true)) {
      if (e is File) total += await e.length();
    }
    return total;
  }

  Future<void> clearCache() async {
    final docs = await getApplicationDocumentsDirectory();
    final root = Directory(p.join(docs.path, 'audio_cache'));
    if (await root.exists()) await root.delete(recursive: true);
  }

  Future<void> playFiles(
    List<File> files,
    List<String> labels, {
    double speed = 1.0,
  }) async {
    _queue = files.map((f) => f.path).toList();
    _labels = labels;
    await player.setSpeed(speed);
    await _playAt(0);
  }

  Future<void> _playAt(int index) async {
    if (index >= _queue.length) {
      onQueueFinished?.call();
      return;
    }
    _current = index;
    await player.setFilePath(_queue[index]);
    if (index < _labels.length) onTrackLabel?.call(_labels[index]);
    await player.play();
  }

  int _current = 0;
  void _playNext() {
    final next = _current + 1;
    if (next < _queue.length) {
      _playAt(next);
    } else {
      _queue = [];
      onQueueFinished?.call();
    }
  }

  Future<void> playSingle(String path, {double speed = 1.0}) async {
    _queue = [];
    await player.setSpeed(speed);
    await player.setFilePath(path);
    await player.play();
  }

  Future<void> stop() async {
    _queue = [];
    await player.stop();
  }

  Future<void> dispose() => player.dispose();
}
