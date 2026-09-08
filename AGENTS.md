# Expo Configuration & Rules

Read the exact versioned docs at <https://docs.expo.dev/versions/v57.0.0/> before writing any code.

# Project Overview: BioAuthApp

This is a secure React Native application built as a technical portfolio piece for an interview at Mobai. The primary objective is to demonstrate mobile security, hardware-backed authentication, and camera processing.

The developer is actively using this project to learn fundamental React Native concepts. **Agent Imperative:** Do not just generate code; explain the reasoning behind React Hook usage, Flexbox styling, and architectural choices.

# Technical Stack & Environment

* **Framework:** Expo SDK 57 (Managed Workflow).
* **Language:** TypeScript (Strict).
* **Environment:** Windows host testing on a physical iOS device via Expo Go.
* **Core Dependencies:** `expo-secure-store`, `expo-local-authentication`, `expo-camera`.

# Agent Directives & Boundaries

* **No Bare Native Modules:** Because the host machine is Windows, bare native iOS modules (e.g., `react-native-keychain`, `react-native-vision-camera`) will crash the Expo Go app. ONLY use Expo SDK modules.
* **Do Not Prebuild/Eject:** Maintain the managed Expo workflow. Do not attempt to run `pod install` or generate native `ios/` or `android/` folders.
* **Architectural Strictness:** Maintain strict separation of concerns:
  * `src/core/`: Security and business logic.
  * `src/components/`: Reusable UI elements.
  * `src/screens/`: Full-page views.
* **Styling:** Use standard React Native Flexbox (`StyleSheet`).

# Current State & Immediate Tasks

1. **Authentication Service:** Implement `src/core/security/SecureAuth.ts` using `expo-local-authentication` and `expo-secure-store`.
2. **Authentication UI:** Build a clean `LoginScreen` to interface with the biometric token functions.
