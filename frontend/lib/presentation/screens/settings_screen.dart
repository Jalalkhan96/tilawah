import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../../core/app_theme.dart';
import '../providers.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});
  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  int? _cacheBytes;
  bool _wipeBusy = false;

  @override
  void initState() {
    super.initState();
    ref.read(audioServiceProvider).cacheSizeBytes().then((v) {
      if (mounted) setState(() => _cacheBytes = v);
    });
  }

  String _mb(int? b) =>
      b == null ? '…' : '${(b / (1024 * 1024)).toStringAsFixed(1)} MB';

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(settingsProvider);
    final notifier = ref.read(settingsProvider.notifier);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Settings', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: settings.theme,
                  decoration: const InputDecoration(
                    labelText: 'Theme',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(
                      value: 'light',
                      child: Text('Light (Mushaf cream)'),
                    ),
                    DropdownMenuItem(value: 'sepia', child: Text('Sepia')),
                    DropdownMenuItem(value: 'dark', child: Text('Dark')),
                  ],
                  onChanged: (v) =>
                      notifier.update(settings.copyWith(theme: v)),
                ),
                const SizedBox(height: 16),
                Text('Arabic text size: ${settings.arabicFontSize.round()}'),
                Slider(
                  value: settings.arabicFontSize,
                  min: 20,
                  max: 48,
                  divisions: 14,
                  onChanged: (v) =>
                      notifier.update(settings.copyWith(arabicFontSize: v)),
                ),
                SwitchListTile(
                  title: const Text('Show translation (Saheeh International)'),
                  value: settings.showTranslation,
                  onChanged: (v) =>
                      notifier.update(settings.copyWith(showTranslation: v)),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: settings.reciter,
                  decoration: const InputDecoration(
                    labelText: 'Reciter (reference audio)',
                    border: OutlineInputBorder(),
                  ),
                  items: reciters.entries
                      .map(
                        (e) => DropdownMenuItem(
                          value: e.key,
                          child: Text(e.value),
                        ),
                      )
                      .toList(),
                  onChanged: (v) =>
                      notifier.update(settings.copyWith(reciter: v)),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<double>(
                  initialValue: settings.speed,
                  decoration: const InputDecoration(
                    labelText: 'Reference playback speed',
                    border: OutlineInputBorder(),
                  ),
                  items: [0.75, 1.0, 1.25, 1.5]
                      .map(
                        (s) => DropdownMenuItem(value: s, child: Text('$s×')),
                      )
                      .toList(),
                  onChanged: (v) =>
                      notifier.update(settings.copyWith(speed: v)),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Privacy & storage',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                SwitchListTile(
                  title: const Text('Keep my recordings with history'),
                  subtitle: const Text(
                    'Off = recording files are deleted right after analysis; the session summary stays.',
                  ),
                  value: settings.keepRecordings,
                  onChanged: (v) =>
                      notifier.update(settings.copyWith(keepRecordings: v)),
                ),
                Text(
                  'Cached recitation audio: ${_mb(_cacheBytes)} (plays offline once heard).',
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: [
                    OutlinedButton(
                      onPressed: () async {
                        await ref.read(audioServiceProvider).clearCache();
                        setState(() => _cacheBytes = 0);
                      },
                      child: const Text('Clear audio cache'),
                    ),
                    OutlinedButton(
                      onPressed: () async {
                        await ref.read(databaseProvider).clearRecordingPaths();
                        final docs = await getApplicationDocumentsDirectory();
                        final dir = Directory(p.join(docs.path, 'recordings'));
                        if (await dir.exists()) {
                          await dir.delete(recursive: true);
                        }
                        ref.read(sessionsRefreshProvider.notifier).state++;
                      },
                      child: const Text('Delete saved recordings'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: Theme.of(context).colorScheme.error,
                  ),
                  onPressed: _wipeBusy
                      ? null
                      : () async {
                          final messenger = ScaffoldMessenger.of(context);
                          setState(() => _wipeBusy = true);
                          await ref.read(databaseProvider).wipeAll();
                          await ref.read(audioServiceProvider).clearCache();
                          final docs = await getApplicationDocumentsDirectory();
                          final dir = Directory(
                            p.join(docs.path, 'recordings'),
                          );
                          if (await dir.exists()) {
                            await dir.delete(recursive: true);
                          }
                          ref.invalidate(settingsProvider);
                          ref.invalidate(bookmarksProvider);
                          ref.read(sessionsRefreshProvider.notifier).state++;
                          if (mounted) {
                            setState(() {
                              _wipeBusy = false;
                              _cacheBytes = 0;
                            });
                            messenger.showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'All local Tilawah data deleted.',
                                ),
                              ),
                            );
                          }
                        },
                  icon: const Icon(Icons.delete_forever),
                  label: const Text('Reset all settings & data'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'About the text & audio',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                const Text(
                  'Quranic text: quran-uthmani (Tanzil) from the AlQuran Cloud API, bundled with the app and validated ayat-by-ayah against the source (114 surahs, 6,236 ayahs). In this source the Basmala is part of ayah 1\'s text for most surahs (Surah 1: it is ayah 1; Surah 9: absent), so it is shown inside ayah 1 rather than as a separate line.\n\n'
                  'Reference audio: per-ayah MP3 from the Islamic Network CDN, cached on your device after first play.\n\n'
                  'Analysis: a genuine local acoustic-alignment (DTW) engine checks timing, pauses, overall sound shape and possible omitted/quiet segments. It does not judge tajweed and never uploads your recordings. Uncertain cases return "inconclusive" instead of an invented verdict.',
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
