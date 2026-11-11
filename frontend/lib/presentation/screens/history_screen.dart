import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';

class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  String _fmt(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return iso;
    String two(int n) => n.toString().padLeft(2, '0');
    return '${d.year}-${two(d.month)}-${two(d.day)} ${two(d.hour)}:${two(d.minute)}';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessions = ref.watch(sessionsFutureProvider);
    return sessions.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('History unavailable: $e')),
      data: (list) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Practice history',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              if (list.isNotEmpty)
                TextButton(
                  onPressed: () async {
                    await ref.read(databaseProvider).clearSessions();
                    ref.read(sessionsRefreshProvider.notifier).state++;
                  },
                  child: const Text('Clear all'),
                ),
            ],
          ),
          const Text(
            'Stored only on this device. An alignment score measures timing and sound-shape similarity to the reference — not tajweed.',
          ),
          const SizedBox(height: 12),
          if (list.isEmpty)
            const Text(
              'No sessions yet. Practise a passage and analyse it — the result will be saved here.',
            ),
          ...list.map(
            (s) => Card(
              child: ListTile(
                leading: const Icon(Icons.history),
                title: Text(
                  '${s.surahName} ${s.fromAyah}${s.toAyah > s.fromAyah ? '–${s.toAyah}' : ''} · ${s.status}',
                ),
                subtitle: Text(
                  '${_fmt(s.dateIso)} · Score: ${s.score?.toString() ?? 'inconclusive'}',
                ),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (s.recordingPath != null)
                      IconButton(
                        icon: const Icon(Icons.play_arrow),
                        tooltip: 'Play recording',
                        onPressed: () => ref
                            .read(audioServiceProvider)
                            .playSingle(s.recordingPath!),
                      ),
                    IconButton(
                      icon: const Icon(Icons.delete_outline),
                      tooltip: 'Delete session',
                      onPressed: () async {
                        if (s.recordingPath != null) {
                          final f = File(s.recordingPath!);
                          if (await f.exists()) await f.delete();
                        }
                        await ref.read(databaseProvider).deleteSession(s.id!);
                        ref.read(sessionsRefreshProvider.notifier).state++;
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
