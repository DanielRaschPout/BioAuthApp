# Expo Configuration & Rules

Read the exact versioned docs at <https://docs.expo.dev/versions/v57.0.0/> before writing any code.

# Project Overview: BioAuthApp

This is a secure React Native application built as a technical portfolio piece for an interview at Mobai. The primary objective is to demonstrate mobile security, hardware-backed authentication, and advanced camera processing (specifically, real-time facial liveness detection).

The developer is actively using this project to learn fundamental React Native concepts. **Agent Imperative:** Do not just generate code; explain the reasoning behind React Hook usage, Flexbox styling, native module integration, and architectural choices.

# Technical Stack & Environment

* **Framework:** Expo SDK 57 (Continuous Native Generation / Prebuild Workflow).
* **Language:** TypeScript (Strict).
* **Environment:** macOS host building natively via Xcode (`npx expo prebuild` and `npx expo run:ios`).
* **Core Dependencies:** `expo-secure-store`, `expo-local-authentication`, `react-native-vision-camera` (and associated ML frame processors).

# Agent Directives & Boundaries

* **Native Modules Allowed:** We are no longer restricted to Expo Go. You MUST use real native modules (e.g., `react-native-vision-camera`, `react-native-worklets-core`, or MLKit/Face detection plugins) to achieve true real-time facial liveness checks. Update `app.json` plugins as necessary and provide instructions on rebuilding the native app.
* **Architecture:** We are using Expo Prebuild (CNG). Do not modify files inside the `ios/` or `android/` folders directly; all native configuration must happen via Expo Config Plugins in `app.json`.
* **Architectural Strictness:** Maintain strict separation of concerns:
  * `src/core/`: Security, camera configuration, ML frame processors, and business logic.
  * `src/components/`: Reusable UI elements.
  * `src/screens/`: Full-page views.
* **Styling:** Use standard React Native Flexbox (`StyleSheet`).

# Current State & Immediate Tasks

1. **Authentication Service:** Implemented `src/core/security/SecureAuth.ts` using `expo-local-authentication` and `expo-secure-store`.
2. **Authentication UI:** Built a clean `LoginScreen` and a dedicated `SecureVaultScreen` dashboard.
3. **Liveness Check:** Implement a production-grade facial liveness check interface using `react-native-vision-camera` and ML face detection to verify physical presence.