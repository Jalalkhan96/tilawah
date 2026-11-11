import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as p;

import '../domain/models.dart';

/// Loads the bundled, verified Quran dataset (assets/quran/quran.json).
/// The bundled file was validated offline against the source — see
/// docs/VALIDATION_REPORT.md in the project root.
class QuranRepository {
  QuranData? _cache;
  Future<QuranData> load() async {
    if (_cache != null) return _cache!;
    final raw = await rootBundle.loadString('assets/quran/quran.json');
    final json = jsonDecode(raw) as Map<String, dynamic>;
    final surahs = (json['surahs'] as List)
        .map((s) => Surah.fromJson(s as Map<String, dynamic>))
        .toList();
    final meta = (json['meta'] as Map<String, dynamic>?) ?? {};
    _cache = QuranData(
      surahs,
      (meta['source'] as String?) ?? 'AlQuran Cloud quran-uthmani',
    );
    return _cache!;
  }
}

/// SQLite store for USER data only (canonical Quran text lives in the
/// bundled asset and is never duplicated into user tables).
///
/// Schema (version 1):
///   bookmarks(global_number INTEGER PRIMARY KEY)
///   practice_sessions(id, date_iso, surah_name, from_ayah, to_ayah,
///                     status, score, recording_path)
///   settings(key TEXT PRIMARY KEY, value TEXT)
///   last_position(surah_index, ayah_number) — single row id=1
class AppDatabase {
  Database? _db;
  Future<Database> get db async {
    if (_db != null) return _db!;
    final dir = await getDatabasesPath();
    _db = await openDatabase(
      p.join(dir, 'tilawah.db'),
      version: 1,
      onCreate: (db, version) async {
        await db.execute(
          'CREATE TABLE bookmarks(global_number INTEGER PRIMARY KEY)',
        );
        await db.execute('''CREATE TABLE practice_sessions(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date_iso TEXT NOT NULL, surah_name TEXT NOT NULL,
          from_ayah INTEGER NOT NULL, to_ayah INTEGER NOT NULL,
          status TEXT NOT NULL, score INTEGER, recording_path TEXT)''');
        await db.execute(
          'CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT NOT NULL)',
        );
        await db.execute(
          'CREATE TABLE last_position(id INTEGER PRIMARY KEY CHECK(id=1), surah_index INTEGER NOT NULL, ayah_number INTEGER NOT NULL)',
        );
      },
    );
    return _db!;
  }

  // bookmarks
  Future<List<int>> bookmarks() async {
    final rows = await (await db).query('bookmarks', orderBy: 'global_number');
    return rows.map((r) => r['global_number'] as int).toList();
  }

  Future<void> toggleBookmark(int g, bool add) async {
    final d = await db;
    if (add) {
      await d.insert('bookmarks', {
        'global_number': g,
      }, conflictAlgorithm: ConflictAlgorithm.ignore);
    } else {
      await d.delete('bookmarks', where: 'global_number = ?', whereArgs: [g]);
    }
  }

  // sessions
  Future<int> addSession(PracticeSession s) async =>
      (await db).insert('practice_sessions', s.toMap());
  Future<List<PracticeSession>> sessions() async {
    final rows = await (await db).query(
      'practice_sessions',
      orderBy: 'id DESC',
    );
    return rows.map(PracticeSession.fromMap).toList();
  }

  Future<void> deleteSession(int id) async =>
      (await db).delete('practice_sessions', where: 'id = ?', whereArgs: [id]);
  Future<void> clearSessions() async => (await db).delete('practice_sessions');
  Future<void> clearRecordingPaths() async =>
      (await db).update('practice_sessions', {'recording_path': null});

  // settings
  Future<String?> getSetting(String key) async {
    final rows = await (await db).query(
      'settings',
      where: 'key = ?',
      whereArgs: [key],
    );
    return rows.isEmpty ? null : rows.first['value'] as String;
  }

  Future<void> setSetting(String key, String value) async => (await db).insert(
    'settings',
    {'key': key, 'value': value},
    conflictAlgorithm: ConflictAlgorithm.replace,
  );

  // last position
  Future<(int, int)?> lastPosition() async {
    final rows = await (await db).query('last_position', where: 'id = 1');
    if (rows.isEmpty) return null;
    return (rows.first['surah_index'] as int, rows.first['ayah_number'] as int);
  }

  Future<void> setLastPosition(int surahIndex, int ayahNumber) async =>
      (await db).insert('last_position', {
        'id': 1,
        'surah_index': surahIndex,
        'ayah_number': ayahNumber,
      }, conflictAlgorithm: ConflictAlgorithm.replace);

  Future<void> wipeAll() async {
    final d = await db;
    await d.delete('bookmarks');
    await d.delete('practice_sessions');
    await d.delete('settings');
    await d.delete('last_position');
  }
}
