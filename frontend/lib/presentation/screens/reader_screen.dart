import 'dart:io';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/app_theme.dart';
import '../providers.dart';

class ReaderScreen extends ConsumerStatefulWidget {
  const ReaderScreen({
    super.key,
    required this.surahIndex,
    required this.ayah,
    required this.onOpenPractice,
  });
  final int surahIndex;
  final int ayah;
  final void Function(int surahIndex, int from, int to) onOpenPractice;

  @override
  ConsumerState<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends ConsumerState<ReaderScreen> {
  late int _surahIndex;
  late int _ayah;
  String _status = 'Tap an ayah to select it, then Play.';
  bool _busy = false;
  bool _autoAdvance = true;
  int _repeat = 1;
  final List<TapGestureRecognizer> _recognizers = [];

  @override
  void initState() {
    super.initState();
    _surahIndex = widget.surahIndex;
    _ayah = widget.ayah;
  }

  @override
  void didUpdateWidget(ReaderScreen old) {
    super.didUpdateWidget(old);
    if (old.surahIndex != widget.surahIndex || old.ayah != widget.ayah) {
      _surahIndex = widget.surahIndex;
      _ayah = widget.ayah;
    }
  }

  @override
  void dispose() {
    for (final r in _recognizers) {
      r.dispose();
    }
    super.dispose();
  }

  Future<void> _select(int ayah) async {
    setState(() => _ayah = ayah);
    await ref.read(databaseProvider).setLastPosition(_surahIndex, ayah);
  }

  Future<void> _play() async {
    final data = await ref.read(quranFutureProvider.future);
    final settings = ref.read(settingsProvider);
    final audio = ref.read(audioServiceProvider);
    final surah = data.surahs[_surahIndex];
    setState(() {
      _busy = true;
      _status = 'Preparing audio (first play downloads & caches)…';
    });
    try {
      // Build the queue from the selected ayah to the end of the surah,
      // honouring repeat by duplicating the first pass of the selection.
      final files = <File>[];
      final labels = <String>[];
      final startIdx = _ayah - 1;
      final order = <int>[];
      for (var r = 0; r < _repeat; r++) {
        order.add(startIdx);
      }
      if (_autoAdvance) {
        for (var i = startIdx + 1; i < surah.ayahs.length; i++) {
          order.add(i);
        }
      }
      for (final i in order) {
        final a = surah.ayahs[i];
        files.add(await audio.localFile(settings.reciter, a.globalNumber));
        labels.add('${surah.englishName} ${a.numberInSurah}');
      }
      audio.onTrackLabel = (label) {
        if (mounted) setState(() => _status = 'Playing $label');
      };
      audio.onQueueFinished = () {
        if (mounted) setState(() => _status = 'Finished.');
      };
      await audio.playFiles(files, labels, speed: settings.speed);
      setState(() => _status = 'Playing…');
    } catch (e) {
      setState(
        () => _status = 'Audio unavailable — you may be offline and this ayah is not cached yet.',
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _downloadSurah() async {
    final data = await ref.read(quranFutureProvider.future);
    final settings = ref.read(settingsProvider);
    final audio = ref.read(audioServiceProvider);
    final surah = data.surahs[_surahIndex];
    setState(() => _status = 'Downloading surah audio for offline use…');
    try {
      await audio.downloadSurah(
        settings.reciter,
        surah.ayahs.map((a) => a.globalNumber).toList(),
        (done, total) {
          if (mounted) setState(() => _status = 'Downloading $done/$total…');
        },
      );
      setState(
        () => _status = 'Surah audio cached — it now works fully offline.',
      );
    } catch (e) {
      setState(
        () => _status = 'Download incomplete (connection?). Ayahs already fetched stay cached.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final quran = ref.watch(quranFutureProvider);
    final settings = ref.watch(settingsProvider);
    final bookmarks = ref.watch(bookmarksProvider);
    return quran.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Could not load Quran data: $e')),
      data: (data) {
        final surah = data.surahs[_surahIndex];
        final ayah = surah.ayahs[_ayah - 1];
        final bookmarked = bookmarks.contains(ayah.globalNumber);
        for (final r in _recognizers) {
          r.dispose();
        }
        _recognizers.clear();
        final spans = <InlineSpan>[];
        for (final a in surah.ayahs) {
          final rec = TapGestureRecognizer()
            ..onTap = () => _select(a.numberInSurah);
          _recognizers.add(rec);
          spans.add(
            TextSpan(
              text: '${a.text} ',
              recognizer: rec,
              style: TextStyle(
                backgroundColor: a.numberInSurah == _ayah
                    ? AppThemes.gold.withValues(alpha: 0.35)
                    : null,
              ),
            ),
          );
          spans.add(
            TextSpan(
              text: '﴿${a.numberInSurah}﴾ ',
              style: TextStyle(
                color: Theme.of(context).colorScheme.primary,
                fontSize: settings.arabicFontSize * 0.62,
              ),
            ),
          );
        }
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back),
                    tooltip: 'Previous surah',
                    onPressed: _surahIndex > 0
                        ? () => setState(() {
                            _surahIndex--;
                            _ayah = 1;
                            _select(1);
                          })
                        : null,
                  ),
                  Expanded(
                    child: Column(
                      children: [
                        Text(
                          surah.arabicName,
                          style: AppThemes.arabic(
                            26,
                            Theme.of(context).colorScheme.primary,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        Text(
                          'Surah ${surah.number} · ${surah.englishName} — ${surah.translation} · ${surah.revelation} · ${surah.ayahs.length} ayahs\nAyah $_ayah: Juz ${ayah.juz}, Page ${ayah.page}, Ruku ${ayah.ruku}, Hizb quarter ${ayah.hizbQuarter}',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.arrow_forward),
                    tooltip: 'Next surah',
                    onPressed: _surahIndex < 113
                        ? () => setState(() {
                            _surahIndex++;
                            _ayah = 1;
                            _select(1);
                          })
                        : null,
                  ),
                ],
              ),
            ),
            Expanded(
              child: Card(
                margin: const EdgeInsets.all(12),
                shape: RoundedRectangleBorder(
                  side: const BorderSide(color: AppThemes.gold, width: 1.5),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text.rich(
                        TextSpan(children: spans),
                        textDirection: TextDirection.rtl,
                        textAlign: TextAlign.justify,
                        style: AppThemes.arabic(
                          settings.arabicFontSize,
                          Theme.of(context).textTheme.bodyLarge!.color!,
                        ),
                      ),
                      if (settings.showTranslation) ...[
                        const Divider(height: 32),
                        Text(
                          '${surah.englishName} $_ayah — ${ayah.translation}',
                          style: Theme.of(context).textTheme.bodyLarge,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
            Card(
              margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(_status, style: Theme.of(context).textTheme.bodySmall),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      alignment: WrapAlignment.center,
                      children: [
                        FilledButton.icon(
                          onPressed: _busy ? null : _play,
                          icon: const Icon(Icons.play_arrow),
                          label: Text('Play from ayah $_ayah'),
                        ),
                        OutlinedButton.icon(
                          onPressed: () =>
                              ref.read(audioServiceProvider).stop(),
                          icon: const Icon(Icons.stop),
                          label: const Text('Stop'),
                        ),
                        OutlinedButton.icon(
                          onPressed: () => ref
                              .read(bookmarksProvider.notifier)
                              .toggle(ayah.globalNumber),
                          icon: Icon(
                            bookmarked ? Icons.bookmark : Icons.bookmark_border,
                          ),
                          label: Text(bookmarked ? 'Bookmarked' : 'Bookmark'),
                        ),
                        FilledButton.icon(
                          onPressed: () =>
                              widget.onOpenPractice(_surahIndex, _ayah, _ayah),
                          icon: const Icon(Icons.mic),
                          label: const Text('Practice this ayah'),
                        ),
                        OutlinedButton.icon(
                          onPressed: _busy ? null : _downloadSurah,
                          icon: const Icon(Icons.download),
                          label: const Text('Audio for offline'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 16,
                      alignment: WrapAlignment.center,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Switch(
                              value: _autoAdvance,
                              onChanged: (v) =>
                                  setState(() => _autoAdvance = v),
                            ),
                            const Text('Auto next ayah'),
                          ],
                        ),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text('Repeat selected: '),
                            DropdownButton<int>(
                              value: _repeat,
                              items: [1, 2, 3, 5]
                                  .map(
                                    (r) => DropdownMenuItem(
                                      value: r,
                                      child: Text('×$r'),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (v) =>
                                  setState(() => _repeat = v ?? 1),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
