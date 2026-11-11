import 'package:flutter/material.dart';

/// Madinah Mushaf-inspired themes: calm cream/green/gold (light),
/// warm sepia, and a restrained dark. No flashy gradients.
class AppThemes {
  static const green = Color(0xFF0B3D2E);
  static const gold = Color(0xFFC9A227);

  static ThemeData light() => _base(
    brightness: Brightness.light,
    bg: const Color(0xFFF3EFE3),
    card: const Color(0xFFFFFDF6),
    ink: const Color(0xFF1C2A22),
  );
  static ThemeData sepia() => _base(
    brightness: Brightness.light,
    bg: const Color(0xFFEFE3CB),
    card: const Color(0xFFF8EED8),
    ink: const Color(0xFF33291A),
  );
  static ThemeData dark() => _base(
    brightness: Brightness.dark,
    bg: const Color(0xFF0E1512),
    card: const Color(0xFF16211C),
    ink: const Color(0xFFE6EEE9),
  );

  static ThemeData _base({
    required Brightness brightness,
    required Color bg,
    required Color card,
    required Color ink,
  }) {
    final scheme =
        ColorScheme.fromSeed(seedColor: green, brightness: brightness).copyWith(
          primary: brightness == Brightness.dark
              ? const Color(0xFF7FC8A4)
              : green,
          surface: card,
        );
    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: bg,
      cardColor: card,
      textTheme: ThemeData(brightness: brightness).textTheme
          .apply(bodyColor: ink, displayColor: ink),
      appBarTheme: const AppBarTheme(
        backgroundColor: green,
        foregroundColor: Color(0xFFF5EFE0),
        elevation: 0,
      ),
      navigationBarTheme: const NavigationBarThemeData(
        indicatorColor: Color(0x33C9A227),
      ),
    );
  }

  /// Arabic text style — system Naskh fonts render Uthmani diacritics
  /// correctly; line height is generous and containers never clip marks.
  static TextStyle arabic(double size, Color color) =>
      TextStyle(fontFamily: 'serif', fontSize: size, height: 2.1, color: color);
}

const reciters = <String, String>{
  'ar.alafasy': 'Mishary Rashid Alafasy',
  'ar.husary': 'Mahmoud Khalil Al-Husary',
  'ar.minshawi': 'Mohamed Siddiq El-Minshawi',
  'ar.mahermuaiqly': 'Maher Al-Muaiqly',
  'ar.hudhaify': 'Ali Al-Hudhaify',
};
