/// Domain models for Tilawah. Canonical Quran data is kept strictly
/// separate from user-generated data (bookmarks, sessions, settings).
library;

class Ayah {
  final int numberInSurah; // n
  final int globalNumber; // g (1..6236)
  final String text; // t — Uthmani text, exactly as distributed
  final String translation; // e — Saheeh International
  final int juz, page, ruku, hizbQuarter;
  final int wordCount;
  const Ayah({
    required this.numberInSurah,
    required this.globalNumber,
    required this.text,
    required this.translation,
    required this.juz,
    required this.page,
    required this.ruku,
    required this.hizbQuarter,
    required this.wordCount,
  });
  factory Ayah.fromJson(Map<String, dynamic> j) => Ayah(
    numberInSurah: j['n'] as int,
    globalNumber: j['g'] as int,
    text: j['t'] as String,
    translation: (j['e'] as String?) ?? '',
    juz: j['j'] as int,
    page: j['p'] as int,
    ruku: j['r'] as int,
    hizbQuarter: j['h'] as int,
    wordCount: j['w'] as int,
  );
  List<String> get words =>
      text.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
}

class Surah {
  final int number;
  final String arabicName; // e.g. سُورَةُ ٱلْفَاتِحَةِ
  final String englishName;
  final String translation;
  final String revelation; // Meccan / Medinan
  final List<Ayah> ayahs;
  const Surah({
    required this.number,
    required this.arabicName,
    required this.englishName,
    required this.translation,
    required this.revelation,
    required this.ayahs,
  });
  factory Surah.fromJson(Map<String, dynamic> j) => Surah(
    number: j['number'] as int,
    arabicName: j['name'] as String,
    englishName: j['en'] as String,
    translation: j['tr'] as String,
    revelation: j['rev'] as String,
    ayahs: (j['ayahs'] as List)
        .map((a) => Ayah.fromJson(a as Map<String, dynamic>))
        .toList(),
  );
}

class QuranData {
  final List<Surah> surahs;
  final String sourceNote;
  const QuranData(this.surahs, this.sourceNote);
  int get totalAyahs => surahs.fold(0, (n, s) => n + s.ayahs.length);
  Ayah? ayahByGlobal(int g) {
    for (final s in surahs) {
      for (final a in s.ayahs) {
        if (a.globalNumber == g) return a;
      }
    }
    return null;
  }

  Surah? surahOfGlobal(int g) {
    for (final s in surahs) {
      if (s.ayahs.any((a) => a.globalNumber == g)) return s;
    }
    return null;
  }

  /// First ayah of each Juz, derived from the bundled per-ayah metadata.
  Map<int, (int surahIndex, int ayahNumber)> juzStarts() {
    final out = <int, (int, int)>{};
    for (var si = 0; si < surahs.length; si++) {
      for (final a in surahs[si].ayahs) {
        out.putIfAbsent(a.juz, () => (si, a.numberInSurah));
      }
    }
    return out;
  }
}

class AppSettings {
  final String theme; // light | sepia | dark
  final double arabicFontSize;
  final String reciter; // e.g. ar.alafasy
  final bool showTranslation;
  final bool keepRecordings;
  final double speed;
  const AppSettings({
    this.theme = 'light',
    this.arabicFontSize = 30,
    this.reciter = 'ar.alafasy',
    this.showTranslation = true,
    this.keepRecordings = false,
    this.speed = 1.0,
  });
  AppSettings copyWith({
    String? theme,
    double? arabicFontSize,
    String? reciter,
    bool? showTranslation,
    bool? keepRecordings,
    double? speed,
  }) => AppSettings(
    theme: theme ?? this.theme,
    arabicFontSize: arabicFontSize ?? this.arabicFontSize,
    reciter: reciter ?? this.reciter,
    showTranslation: showTranslation ?? this.showTranslation,
    keepRecordings: keepRecordings ?? this.keepRecordings,
    speed: speed ?? this.speed,
  );
}

class PracticeSession {
  final int? id;
  final String dateIso;
  final String surahName;
  final int fromAyah, toAyah;
  final String status;
  final int? score;
  final String? recordingPath;
  const PracticeSession({
    this.id,
    required this.dateIso,
    required this.surahName,
    required this.fromAyah,
    required this.toAyah,
    required this.status,
    required this.score,
    this.recordingPath,
  });
  Map<String, Object?> toMap() => {
    'date_iso': dateIso,
    'surah_name': surahName,
    'from_ayah': fromAyah,
    'to_ayah': toAyah,
    'status': status,
    'score': score,
    'recording_path': recordingPath,
  };
  factory PracticeSession.fromMap(Map<String, Object?> m) => PracticeSession(
    id: m['id'] as int?,
    dateIso: m['date_iso'] as String,
    surahName: m['surah_name'] as String,
    fromAyah: m['from_ayah'] as int,
    toAyah: m['to_ayah'] as int,
    status: m['status'] as String,
    score: m['score'] as int?,
    recordingPath: m['recording_path'] as String?,
  );
}
