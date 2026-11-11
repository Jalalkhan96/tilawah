# Privacy & security

- **No accounts, no backend.** The installed web app has no server component
  of ours; all practice data stays on the user's device.
- **No analytics, ads, or trackers.** No third-party scripts are loaded except
  an optional Google Fonts stylesheet (the app works without it — Arabic
  falls back to system Naskh fonts).
- **Recordings never leave the device.** Analysis runs entirely in the browser
  (Web Audio + the bundled DTW engine). Recordings are kept only if the user
  enables "Keep recordings" in Settings, are stored in IndexedDB on the
  device, and can be deleted per-session or all at once from History.
- **Local storage inventory:**
  - localStorage: settings, bookmarks, last reading position, session
    metadata (date, passage, status, score).
  - IndexedDB (`tilawah`): saved recording blobs (opt-in only).
  - Cache Storage: app shell + Quran data (`tilawah-shell-v1`) and played /
    downloaded recitation audio (`tilawah-audio-v1`).
- **Microphone** permission is requested only when the user presses Record,
  and the stream is stopped as soon as recording stops.
- **Network requests** made by the app: the app's own static files, Quran
  audio from `cdn.islamic.network` (per-ayah MP3), and optionally Google
  Fonts. Nothing else. There is no cloud speech recognition.
- **Reset:** Settings → "Reset all settings & data" wipes local Tilawah data
  on the device.
