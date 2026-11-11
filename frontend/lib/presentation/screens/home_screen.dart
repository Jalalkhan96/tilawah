import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/app_theme.dart';
import '../../domain/models.dart';
import '../providers.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({
    super.key,
    required this.onOpenReader,
    required this.onOpenPractice,
  });
  final void Function(int surahIndex, int ayah) onOpenReader;
  final void Function(int surahIndex, int from, int to) onOpenPractice;

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  String _query = '';
  (int, int)? _lastPos;

  @override
  void initState() {
    super.initState();
    ref.read(databaseProvider).lastPosition().then((v) {
      if (mounted) setState(() => _lastPos = v);
    });
  }

  @override
  Widget build(BuildContext context) {
    final quran = ref.watch(quranFutureProvider);
    final bookmarks = ref.watch(bookmarksProvider);
    final sessions = ref.watch(sessionsFutureProvider);
    return quran.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Could not load Quran data: $e')),
      data: (data) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                children: [
                  Text(
                    'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
                    style: AppThemes.arabic(
                      26,
                      Theme.of(context).colorScheme.primary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Read the verified Uthmani text, listen to authentic recitation, record yourself and compare — analysed entirely on your device. No account, no ads, no uploads.',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    children: [
                      FilledButton(
                        onPressed: () => widget.onOpenReader(
                          _lastPos?.$1 ?? 0,
                          _lastPos?.$2 ?? 1,
                        ),
                        child: const Text('Continue reading'),
                      ),
                      OutlinedButton(
                        onPressed: () => widget.onOpenPractice(
                          _lastPos?.$1 ?? 0,
                          _lastPos?.$2 ?? 1,
                          _lastPos?.$2 ?? 1,
                        ),
                        child: const Text('Resume practice'),
                      ),
                    ],
                  ),
                  if (_lastPos != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        'Last read: Surah ${data.surahs[_lastPos!.$1].englishName}, Ayah ${_lastPos!.$2}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          sessions.when(
            loading: () => const SizedBox.shrink(),
            error: (_, _) => const SizedBox.shrink(),
            data: (list) {
              final scored = list.where((s) => s.score != null).toList();
              final avg = scored.isEmpty
                  ? '—'
                  : (scored.fold<int>(0, (a, s) => a + s.score!) /
                            scored.length)
                        .round()
                        .toString();
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _stat(context, '${bookmarks.length}', 'Bookmarks'),
                      _stat(context, '${list.length}', 'Sessions'),
                      _stat(context, avg, 'Avg score'),
                      _stat(context, '114', 'Surahs'),
                      _stat(context, '6236', 'Ayahs'),
                    ],
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 12),
          TextField(
            decoration: const InputDecoration(
              labelText: 'Search surah name, or Arabic / English text',
              prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(),
            ),
            onChanged: (v) => setState(() => _query = v.trim()),
          ),
          if (_query.isNotEmpty) ..._searchResults(data),
          const SizedBox(height: 16),
          Text('Surahs', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          ...data.surahs.map(
            (s) => Card(
              child: ListTile(
                leading: CircleAvatar(child: Text('${s.number}')),
                title: Text('${s.englishName} · ${s.translation}'),
                subtitle: Text('${s.ayahs.length} ayahs · ${s.revelation}'),
                trailing: Text(
                  s.arabicName,
                  style: AppThemes.arabic(
                    19,
                    Theme.of(context).colorScheme.primary,
                  ),
                ),
                onTap: () => widget.onOpenReader(s.number - 1, 1),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Juz (Para) navigation',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: data.juzStarts().entries.map((e) {
              final s = data.surahs[e.value.$1];
              return ActionChip(
                label: Text('Juz ${e.key} · ${s.englishName} ${e.value.$2}'),
                onPressed: () => widget.onOpenReader(e.value.$1, e.value.$2),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          Text('Bookmarks', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          if (bookmarks.isEmpty)
            const Text(
              'No bookmarks yet. Open a surah, tap an ayah, then bookmark it.',
            )
          else
            ...bookmarks.map((g) {
              final s = data.surahOfGlobal(g);
              final a = data.ayahByGlobal(g);
              if (s == null || a == null) return const SizedBox.shrink();
              return Card(
                child: ListTile(
                  leading: const Icon(Icons.bookmark),
                  title: Text('${s.englishName} ${a.numberInSurah}'),
                  subtitle: Text(
                    a.text,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textDirection: TextDirection.rtl,
                  ),
                  trailing: IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () =>
                        ref.read(bookmarksProvider.notifier).toggle(g),
                  ),
                  onTap: () =>
                      widget.onOpenReader(s.number - 1, a.numberInSurah),
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _stat(BuildContext c, String v, String k) => Column(
    children: [
      Text(v, style: Theme.of(c).textTheme.titleLarge),
      Text(k, style: Theme.of(c).textTheme.bodySmall),
    ],
  );

  List<Widget> _searchResults(QuranData data) {
    final q = _query.toLowerCase();
    final widgets = <Widget>[];
    for (var si = 0; si < data.surahs.length && widgets.length < 21; si++) {
      final s = data.surahs[si];
      if (s.englishName.toLowerCase().contains(q) || '${s.number}' == q) {
        widgets.add(
          ListTile(
            title: Text('Surah ${s.number}: ${s.englishName}'),
            subtitle: Text(s.translation),
            onTap: () => widget.onOpenReader(si, 1),
          ),
        );
        continue;
      }
      for (final a in s.ayahs) {
        if (widgets.length >= 21) break;
        if (a.text.contains(_query) ||
            a.translation.toLowerCase().contains(q)) {
          widgets.add(
            ListTile(
              title: Text('${s.englishName} ${a.numberInSurah}'),
              subtitle: Text(
                a.translation,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              onTap: () => widget.onOpenReader(si, a.numberInSurah),
            ),
          );
        }
      }
    }
    if (widgets.isEmpty) {
      widgets.add(const ListTile(title: Text('No matches.')));
    }
    return widgets;
  }
}
