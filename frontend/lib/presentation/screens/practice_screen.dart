import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import '../../alignment_engine/engine.dart';
import '../../core/app_theme.dart';
import '../../domain/models.dart';
import '../../services/audio_decode.dart';
import '../providers.dart';

AnalysisResult _runEngine((Float32List, Float32List, List<String>) args) =>
    TilawahEngine.analyze(args.$1, 16000, args.$2, 16000, args.$3);

class PracticeScreen extends ConsumerStatefulWidget {
  const PracticeScreen({
    super.key,
    required this.surahIndex,
    required this.from,
    required this.to,
  });
  final int surahIndex, from, to;

  @override
  ConsumerState<PracticeScreen> createState() => _PracticeScreenState();
}

class _PracticeScreenState extends ConsumerState<PracticeScreen> {
  int _surahIndex = 0, _from = 1, _to = 1;
  final AudioRecorder _recorder = AudioRecorder();
  StreamSubscription<Amplitude>? _ampSub;
  bool _recording = false;
  int _elapsed = 0;
  Timer? _timer;
  final List<double> _amps = [];
  String? _userPath;
  String _status =
      'Choose a short passage, listen to the reference, then record yourself.';
  bool _analysing = false;
  AnalysisResult? _result;
  int? _selectedWord;
  bool _saved = false;

  @override
  void initState() {
    super.initState();
    _surahIndex = widget.surahIndex;
    _from = widget.from;
    _to = widget.to;
  }

  @override
  void didUpdateWidget(PracticeScreen old) {
    super.didUpdateWidget(old);
    if (old.surahIndex != widget.surahIndex ||
        old.from != widget.from ||
        old.to != widget.to) {
      setState(() {
        _surahIndex = widget.surahIndex;
        _from = widget.from;
        _to = widget.to;
        _result = null;
        _userPath = null;
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _ampSub?.cancel();
    _recorder.dispose();
    super.dispose();
  }

  List<Ayah> _passage(QuranData data) {
    final s = data.surahs[_surahIndex];
    return s.ayahs.sublist(_from - 1, _to);
  }

  List<(String word, int globalAyah)> _wordsWithAyah(QuranData data) {
    final out = <(String, int)>[];
    for (final a in _passage(data)) {
      for (final w in a.words) {
        out.add((w, a.globalNumber));
      }
    }
    return out;
  }

  Future<void> _playReference() async {
    final data = await ref.read(quranFutureProvider.future);
    final settings = ref.read(settingsProvider);
    final audio = ref.read(audioServiceProvider);
    setState(() => _status = 'Preparing reference audio…');
    try {
      final files = <File>[];
      final labels = <String>[];
      for (final a in _passage(data)) {
        files.add(await audio.localFile(settings.reciter, a.globalNumber));
        labels.add(
          '${data.surahs[_surahIndex].englishName} ${a.numberInSurah}',
        );
      }
      audio.onTrackLabel = (l) {
        if (mounted) setState(() => _status = 'Reference: $l');
      };
      audio.onQueueFinished = () {
        if (mounted) {
          setState(() => _status = 'Reference played. Now record yourself.');
        }
      };
      await audio.playFiles(files, labels, speed: settings.speed);
    } catch (e) {
      setState(
        () => _status = 'Reference audio unavailable — offline and not cached yet. Open the passage in the Reader once while online.',
      );
    }
  }

  Future<void> _toggleRecord() async {
    if (_recording) {
      final path = await _recorder.stop();
      _timer?.cancel();
      _ampSub?.cancel();
      setState(() {
        _recording = false;
        _userPath = path;
        _result = null;
        _saved = false;
        _status =
            'Recording stopped (${_elapsed}s). Play it back, or tap Analyse.';
      });
      return;
    }
    if (!await _recorder.hasPermission()) {
      setState(
        () => _status = 'Microphone permission was not granted. Allow it in system settings to record.',
      );
      return;
    }
    // Recording files are private app documents; reference audio NEVER
    // leaves the device and neither does your recording.
    final docs = await getApplicationDocumentsDirectory();
    final dir = Directory(p.join(docs.path, 'recordings'));
    if (!await dir.exists()) await dir.create(recursive: true);
    final path = p.join(
      dir.path,
      'rec_${DateTime.now().millisecondsSinceEpoch}.wav',
    );
    await _recorder.start(
      const RecordConfig(
        encoder: AudioEncoder.wav,
        sampleRate: 16000,
        numChannels: 1,
      ),
      path: path,
    );
    _amps.clear();
    _ampSub = _recorder
        .onAmplitudeChanged(const Duration(milliseconds: 120))
        .listen((amp) {
          if (mounted) {
            setState(() {
              _amps.add(amp.current);
              if (_amps.length > 40) _amps.removeAt(0);
            });
          }
        });
    setState(() {
      _recording = true;
      _elapsed = 0;
      _status = 'Recording… recite the passage, then tap Stop.';
    });
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _elapsed++);
    });
  }

  Future<void> _analyse() async {
    if (_userPath == null) return;
    final data = await ref.read(quranFutureProvider.future);
    final settings = ref.read(settingsProvider);
    final audio = ref.read(audioServiceProvider);
    setState(() {
      _analysing = true;
      _status = 'Preparing audio…';
    });
    try {
      // 1) Reference samples: download (or reuse cache), decode natively.
      final refParts = <Float32List>[];
      for (final a in _passage(data)) {
        final f = await audio.localFile(settings.reciter, a.globalNumber);
        refParts.add(await AudioDecode.decodeFileTo16kMono(f.path));
      }
      final refSamples = AudioDecode.concat(refParts);
      // 2) User samples: pure-Dart WAV decode.
      setState(
        () => _status =
            'Analysing locally — comparing alignment, timing and pauses…',
      );
      final userSamples = await AudioDecode.decodeFileTo16kMono(_userPath!);
      final words = _wordsWithAyah(data).map((e) => e.$1).toList();
      // 3) Engine runs in a background isolate; recordings never upload.
      final result = await compute(_runEngine, (
        refSamples,
        userSamples,
        words,
      ));
      setState(() {
        _result = result;
        _status = _statusText(result.status);
      });
      // 4) Persist the session (and the file, if the user opted in).
      String? keptPath = _userPath;
      if (!settings.keepRecordings) {
        await File(_userPath!).delete().catchError((_) => File(_userPath!));
        keptPath = null;
      }
      await ref
          .read(databaseProvider)
          .addSession(
            PracticeSession(
              dateIso: DateTime.now().toIso8601String(),
              surahName: data.surahs[_surahIndex].englishName,
              fromAyah: _from,
              toAyah: _to,
              status: result.status,
              score: result.score,
              recordingPath: keptPath,
            ),
          );
      ref.read(sessionsRefreshProvider.notifier).state++;
      setState(() => _saved = true);
    } on PlatformException catch (_) {
      setState(
        () => _status = 'Reference audio could not be decoded on this device, so no score was produced. (Analysis needs the Android native decoder in this build.)',
      );
    } catch (e) {
      setState(
        () => _status =
            'Analysis could not run: $e. No score was invented — please retry.',
      );
    } finally {
      if (mounted) setState(() => _analysing = false);
    }
  }

  String _statusText(String s) => switch (s) {
    'good' => 'Strong alignment with the reference.',
    'review' => 'Mostly aligned — a few segments to review.',
    'needs-work' =>
      'Some segments differ from the reference — listen back per word below.',
    _ =>
      'Inconclusive — no verdict rather than a wrong one. See the note below.',
  };

  Color _chipColor(String s) => switch (s) {
    'ok' => const Color(0xFF2E7D32),
    'warn' => const Color(0xFFF9A825),
    'error' => const Color(0xFFC62828),
    _ => Colors.grey,
  };

  @override
  Widget build(BuildContext context) {
    final quran = ref.watch(quranFutureProvider);
    final settings = ref.watch(settingsProvider);
    return quran.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Could not load Quran data: $e')),
      data: (data) {
        final surah = data.surahs[_surahIndex];
        final passage = _passage(data);
        final passageText = passage
            .map((a) => '${a.text} ﴿${a.numberInSurah}﴾')
            .join(' ');
        final durationHint = passage.length > 3
            ? const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text(
                  'Tip: short passages (1–3 ayahs) give the most reliable analysis. Word timings are estimates, and the engine checks alignment/timing — not tajweed.',
                  style: TextStyle(fontStyle: FontStyle.italic),
                ),
              )
            : const SizedBox.shrink();
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<int>(
                    initialValue: _surahIndex,
                    decoration: const InputDecoration(
                      labelText: 'Surah',
                      border: OutlineInputBorder(),
                    ),
                    items: data.surahs
                        .map(
                          (s) => DropdownMenuItem(
                            value: s.number - 1,
                            child: Text('${s.number}. ${s.englishName}'),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => setState(() {
                      _surahIndex = v!;
                      _from = 1;
                      _to = 1;
                      _result = null;
                    }),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<int>(
                    initialValue: _from,
                    decoration: const InputDecoration(
                      labelText: 'From ayah',
                      border: OutlineInputBorder(),
                    ),
                    items: surah.ayahs
                        .map(
                          (a) => DropdownMenuItem(
                            value: a.numberInSurah,
                            child: Text('${a.numberInSurah}'),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => setState(() {
                      _from = v!;
                      if (_to < _from) _to = _from;
                      _result = null;
                    }),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: DropdownButtonFormField<int>(
                    initialValue: _to,
                    decoration: const InputDecoration(
                      labelText: 'To ayah',
                      border: OutlineInputBorder(),
                    ),
                    items: surah.ayahs
                        .where((a) => a.numberInSurah >= _from)
                        .map(
                          (a) => DropdownMenuItem(
                            value: a.numberInSurah,
                            child: Text('${a.numberInSurah}'),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => setState(() {
                      _to = v!;
                      _result = null;
                    }),
                  ),
                ),
              ],
            ),
            durationHint,
            const SizedBox(height: 12),
            Card(
              shape: RoundedRectangleBorder(
                side: const BorderSide(color: AppThemes.gold, width: 1.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Text(
                  passageText,
                  textDirection: TextDirection.rtl,
                  textAlign: TextAlign.center,
                  style: AppThemes.arabic(
                    settings.arabicFontSize,
                    Theme.of(context).textTheme.bodyLarge!.color!,
                  ),
                ),
              ),
            ),
            if (settings.showTranslation)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  passage.map((a) => a.translation).join(' '),
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
            const SizedBox(height: 12),
            Text(_status),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.icon(
                  onPressed: _playReference,
                  icon: const Icon(Icons.play_arrow),
                  label: const Text('Play reference'),
                ),
                FilledButton.icon(
                  onPressed: _recording ? _toggleRecord : _toggleRecord,
                  icon: Icon(_recording ? Icons.stop : Icons.mic),
                  label: Text(_recording ? 'Stop (${_elapsed}s)' : 'Record'),
                ),
                OutlinedButton.icon(
                  onPressed: _userPath != null
                      ? () => ref
                            .read(audioServiceProvider)
                            .playSingle(_userPath!)
                      : null,
                  icon: const Icon(Icons.play_circle_outline),
                  label: const Text('Play my recording'),
                ),
                FilledButton.icon(
                  onPressed: (_userPath != null && !_analysing)
                      ? _analyse
                      : null,
                  icon: const Icon(Icons.analytics),
                  label: Text(_analysing ? 'Analysing…' : 'Analyse'),
                ),
              ],
            ),
            if (_recording || _amps.isNotEmpty) ...[
              const SizedBox(height: 12),
              SizedBox(
                height: 48,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: _amps.map((db) {
                    final level = ((db + 50) / 50).clamp(0.05, 1.0);
                    return Expanded(
                      child: Container(
                        margin: const EdgeInsets.symmetric(horizontal: 1),
                        height: 48 * level,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    );
                  }).toList(),
                ),
              ),
            ],
            if (_result != null) _resultsCard(data, _result!),
            if (_saved)
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text('Session saved to History (on this device only).'),
              ),
          ],
        );
      },
    );
  }

  Widget _resultsCard(QuranData data, AnalysisResult r) {
    final words = _wordsWithAyah(data);
    final scoreText = r.score == null
        ? 'No score — inconclusive'
        : 'Alignment score ${r.score}/100';
    WordResult? selected;
    if (_selectedWord != null && _selectedWord! < r.words.length) {
      selected = r.words[_selectedWord!];
    }
    return Card(
      margin: const EdgeInsets.only(top: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(scoreText, style: Theme.of(context).textTheme.titleLarge),
            Text(
              'Confidence ${(r.confidence * 100).round()}% · Your ${r.userDurationSec ?? '—'}s vs reference ${r.refDurationSec ?? '—'}s · Duration ratio ${r.durationRatio ?? '—'}',
            ),
            Text(
              'Recording quality — peak ${(r.quality.peak * 100).round()}%, voiced ${(r.quality.voicedRatio * 100).round()}%, clipping ${(r.quality.clippingRatio * 100).round()}%',
            ),
            for (final n in r.notes) Text('• $n'),
            const SizedBox(height: 6),
            const Text(
              'This analyses alignment, timing and possible omitted/quiet segments only. It does not judge tajweed or makhraj and is not a substitute for a qualified teacher.',
            ),
            const SizedBox(height: 12),
            const Text(
              'Tap a word to see details and hear its ayah reference:',
            ),
            const SizedBox(height: 8),
            Directionality(
              textDirection: TextDirection.rtl,
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (var i = 0; i < r.words.length && i < words.length; i++)
                    GestureDetector(
                      onTap: () => setState(() => _selectedWord = i),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: _chipColor(r.words[i].status)
                              .withValues(alpha: 0.25),
                          border: Border.all(
                            color: _chipColor(r.words[i].status),
                            width: _selectedWord == i ? 2.5 : 1,
                          ),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          words[i].$1,
                          style: AppThemes.arabic(
                            20,
                            Theme.of(context).textTheme.bodyLarge!.color!,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            if (selected != null) ...[
              const SizedBox(height: 12),
              Text(
                'Word: ${selected.text}',
                style: AppThemes.arabic(
                  24,
                  Theme.of(context).textTheme.bodyLarge!.color!,
                ),
                textDirection: TextDirection.rtl,
              ),
              Text(
                'Status: ${selected.status} · Expected ${selected.expectedSec}s · You ${selected.actualSec}s · Ratio ${selected.ratio} · Confidence ${(selected.confidence * 100).round()}%',
              ),
              Text(
                selected.issue ??
                    'Within expected timing and sound shape of the reference.',
              ),
              const SizedBox(height: 6),
              OutlinedButton.icon(
                onPressed: () async {
                  final settings = ref.read(settingsProvider);
                  final g = words[selected!.index].$2;
                  final f = await ref
                      .read(audioServiceProvider)
                      .localFile(settings.reciter, g);
                  await ref
                      .read(audioServiceProvider)
                      .playSingle(f.path, speed: settings.speed);
                },
                icon: const Icon(Icons.play_arrow),
                label: const Text('Play this ayah\'s reference'),
              ),
            ],
            Text(
              'Engine $kEngineVersion',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}
