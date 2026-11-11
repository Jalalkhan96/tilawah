import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/app_theme.dart';
import 'presentation/providers.dart';
import 'presentation/screens/home_screen.dart';
import 'presentation/screens/reader_screen.dart';
import 'presentation/screens/practice_screen.dart';
import 'presentation/screens/history_screen.dart';
import 'presentation/screens/settings_screen.dart';

/// Root: five destinations per the master prompt —
/// Home · Reader · Practice · History · Settings.
class TilawahApp extends ConsumerStatefulWidget {
  const TilawahApp({super.key});
  @override
  ConsumerState<TilawahApp> createState() => _TilawahAppState();
}

class _TilawahAppState extends ConsumerState<TilawahApp> {
  int _tab = 0;
  // Navigation arguments for Reader / Practice; a nonce forces rebuilds
  // when the same destination is opened with new arguments.
  int _readerSurah = 0, _readerAyah = 1, _readerNonce = 0;
  int _practiceSurah = 0,
      _practiceFrom = 1,
      _practiceTo = 1,
      _practiceNonce = 0;

  void _openReader(int surahIndex, int ayah) => setState(() {
    _readerSurah = surahIndex;
    _readerAyah = ayah;
    _readerNonce++;
    _tab = 1;
  });

  void _openPractice(int surahIndex, int from, int to) => setState(() {
    _practiceSurah = surahIndex;
    _practiceFrom = from;
    _practiceTo = to;
    _practiceNonce++;
    _tab = 2;
  });

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(settingsProvider);
    final theme = switch (settings.theme) {
      'dark' => AppThemes.dark(),
      'sepia' => AppThemes.sepia(),
      _ => AppThemes.light(),
    };
    final screens = [
      HomeScreen(onOpenReader: _openReader, onOpenPractice: _openPractice),
      ReaderScreen(
        key: ValueKey('reader-$_readerNonce'),
        surahIndex: _readerSurah,
        ayah: _readerAyah,
        onOpenPractice: _openPractice,
      ),
      PracticeScreen(
        key: ValueKey('practice-$_practiceNonce'),
        surahIndex: _practiceSurah,
        from: _practiceFrom,
        to: _practiceTo,
      ),
      const HistoryScreen(),
      const SettingsScreen(),
    ];
    return MaterialApp(
      title: 'Tilawah',
      debugShowCheckedModeBanner: false,
      theme: theme,
      home: Scaffold(
        appBar: AppBar(
          title: const Text('Tilawah — Quran Pronunciation Practice'),
        ),
        body: IndexedStack(index: _tab, children: screens),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _tab,
          onDestinationSelected: (i) => setState(() => _tab = i),
          destinations: const [
            NavigationDestination(icon: Icon(Icons.home), label: 'Home'),
            NavigationDestination(icon: Icon(Icons.menu_book), label: 'Read'),
            NavigationDestination(icon: Icon(Icons.mic), label: 'Practice'),
            NavigationDestination(icon: Icon(Icons.history), label: 'History'),
            NavigationDestination(
              icon: Icon(Icons.settings),
              label: 'Settings',
            ),
          ],
        ),
      ),
    );
  }
}
