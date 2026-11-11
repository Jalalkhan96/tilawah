# Building the Flutter app (Android)

Project: `frontend/` (Flutter 3.47.5 / Dart 3.13.4 used for this delivery;
any recent stable Flutter 3.x with Dart 3 should work).

```bash
cd frontend
flutter pub get
flutter analyze     # delivered state: no issues found
flutter test        # delivered state: 7/7 passed
flutter build apk --release
# APK: build/app/outputs/flutter-apk/app-release.apk
flutter run         # on a connected device/emulator
```

## Platform notes

- **Android** — min/target SDK come from the Flutter template defaults.
  Permissions in `android/app/src/main/AndroidManifest.xml`: INTERNET
  (reference audio streaming/caching) and RECORD_AUDIO (asked at runtime,
  only on Record). Reference MP3 decoding for analysis uses a small native
  channel in `MainActivity.kt` (`tilawah/audio_decode`, MediaCodec →
  PCM 16 kHz mono).
- **iOS** — the project includes the iOS runner scaffold. The microphone usage string
  (`NSMicrophoneUsageDescription`) is already set in `ios/Runner/Info.plist`. The native MP3
  decode channel is Android-only in this build; on iOS the practice
  analysis reports an honest "reference decode unavailable" state rather
  than a fake score (decoder: implement the same channel with AVAudioFile,
  or bundle an ffmpeg-based decoder).
- **Data** — the verified Quran dataset is bundled at
  `assets/quran/quran.json` (identical file to the web edition). User data
  (bookmarks, sessions, settings) lives in SQLite (`tilawah.db`) — see
  `lib/data/app_database.dart` for the schema.

## Sandbox note (why no APK was attached to the 2026-10-23 delivery)

The delivered source was analysed and unit-tested inside the Muse build
sandbox, but `flutter build apk` could not complete there: Gradle's build
daemon talks to the Gradle client over a loopback (127.0.0.1) TCP socket,
and this sandbox's "other TCP" direct-network permission is set to Deny, so
the connection is reset before the build can start (verified with a
minimal Java socket test, independent of this project). The user can
enable it in Muse settings → Permissions → Direct network protocols →
`other_tcp` (Deny → Ask), after which the build can run in the sandbox.
Nothing about the project itself blocks the build — the commands above
are all that is needed on a regular machine.

## Release signing

The template signs release builds with the debug key so the APK installs
for testing. For Play Store distribution, create an upload keystore and a
`android/key.properties` per the official Flutter docs, and wire it in
`android/app/build.gradle.kts`.
