# Native delivery

The Expo project in apps/mobile targets iOS and Android. Use Node 24, npm ci and npm run prepare:assets before development. Run npm run dev:mobile and open on a compatible Expo development build/device. The WebView, native audio and file picker use native modules.

## Private assets

After preparing the web book, run node scripts/bundle-mobile-book.mjs. This copies the complete book into ignored native asset directories and emits a static require catalog. Never commit that catalog or the full book into the public source repository. A clean checkout starts empty and supports importing PDF/audio from Files.

## Build

`npm run build:mobile` exports both platform JavaScript bundles and assets. It verifies Metro resolution and Hermes packaging; it does not create signed installation files or prove native device behavior.

EAS configuration is supplied in apps/mobile/eas.json. From apps/mobile, connect the owner's Expo account/project and run `eas build --profile preview --platform android` for a preview APK, or a development/production iOS build with the owner's Apple signing account. Configure the real EAS project identity before publishing updates or stores. No signing keys, account credentials, EAS project or store submission is created by this initial implementation.

## Device acceptance before store release

Read/listen through chapter changes; switch rapidly between chapters; restore progress and manual PDF pages; import/remove local files; verify PDF rendering on supported iOS/Android versions; check interruptions, silent mode, headphones, lock-screen controls and background playback. VoiceOver/TalkBack and real-device typography/layout need verification. The current native sleep timer requires the app to remain open; no exact background alarm is promised.

Android/iOS exports have been generated locally. No emulator, signed APK/IPA, physical-device run or store review is represented as complete.

Before native signing or OTA release, resolve/review REQ-005 and docs/SECURITY-REVIEW.md. No signing or OTA behavior is certified by this initial export.
