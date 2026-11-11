import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/app_database.dart';
import '../domain/models.dart';
import '../services/audio_service.dart';

final quranRepositoryProvider = Provider((ref) => QuranRepository());
final databaseProvider = Provider((ref) => AppDatabase());
final audioServiceProvider = Provider((ref) => AudioService());

final quranFutureProvider = FutureProvider<QuranData>(
  (ref) => ref.watch(quranRepositoryProvider).load(),
);

/// Settings state — persisted in SQLite (settings table, JSON value).
class SettingsNotifier extends StateNotifier<AppSettings> {
  SettingsNotifier(this._db) : super(const AppSettings()) {
    _restore();
  }
  final AppDatabase _db;

  Future<void> _restore() async {
    final raw = await _db.getSetting('app_settings');
    if (raw == null) return;
    final j = jsonDecode(raw) as Map<String, dynamic>;
    state = AppSettings(
      theme: j['theme'] as String? ?? 'light',
      arabicFontSize: (j['arabicFontSize'] as num?)?.toDouble() ?? 30,
      reciter: j['reciter'] as String? ?? 'ar.alafasy',
      showTranslation: j['showTranslation'] as bool? ?? true,
      keepRecordings: j['keepRecordings'] as bool? ?? false,
      speed: (j['speed'] as num?)?.toDouble() ?? 1.0,
    );
  }

  Future<void> update(AppSettings s) async {
    state = s;
    await _db.setSetting(
      'app_settings',
      jsonEncode({
        'theme': s.theme,
        'arabicFontSize': s.arabicFontSize,
        'reciter': s.reciter,
        'showTranslation': s.showTranslation,
        'keepRecordings': s.keepRecordings,
        'speed': s.speed,
      }),
    );
  }
}

final settingsProvider = StateNotifierProvider<SettingsNotifier, AppSettings>(
  (ref) => SettingsNotifier(ref.watch(databaseProvider)),
);

class BookmarksNotifier extends StateNotifier<List<int>> {
  BookmarksNotifier(this._db) : super([]) {
    _restore();
  }
  final AppDatabase _db;

  Future<void> _restore() async => state = await _db.bookmarks();

  Future<void> toggle(int g) async {
    await _db.toggleBookmark(g, !state.contains(g));
    state = await _db.bookmarks();
  }
}

final bookmarksProvider = StateNotifierProvider<BookmarksNotifier, List<int>>(
  (ref) => BookmarksNotifier(ref.watch(databaseProvider)),
);

/// Bumped whenever sessions change so History / Home stats refresh.
final sessionsRefreshProvider = StateProvider<int>((ref) => 0);

final sessionsFutureProvider = FutureProvider<List<PracticeSession>>((ref) {
  ref.watch(sessionsRefreshProvider);
  return ref.watch(databaseProvider).sessions();
});
