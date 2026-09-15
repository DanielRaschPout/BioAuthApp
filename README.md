# BioAuthApp

A secure React Native application showcasing hardware-backed biometric authentication and real-time facial liveness checks. Built as a technical portfolio project.

## Core Features

* **Biometric Authentication:** Integrates FaceID/TouchID via `expo-local-authentication`.
* **Secure Storage:** Safely encrypts and stores authentication tokens using the device's Secure Enclave via `expo-secure-store`.
* **Real-time Liveness Check:** Implements a true production-grade physical presence verification using `react-native-vision-camera` and `react-native-vision-camera-face-detector`. It runs an on-device ML Kit frame processor to detect faces, track head movements (yaw angle), and present a dynamic head-turn challenge to prevent spoofing.

## Tech Stack & Architecture

* **Framework:** React Native (Expo SDK 57).
* **Workflow:** Continuous Native Generation (CNG) / Prebuild Workflow. Native configurations are managed via Config Plugins in `app.json`.
* **Language:** TypeScript (Strict).
* **Architecture:** Strict separation of concerns:
  * `src/core/`: Security, camera configuration, ML frame processors, and business logic.
  * `src/components/`: Reusable UI elements.
  * `src/screens/`: Full-page views (pure UI and local state).

## Getting Started (macOS / Xcode)

Since this app relies on native ML Kit modules for real-time camera frame processing, it **cannot** be run in the standard Expo Go app. It must be built natively.

### Prerequisites

* macOS with Xcode installed.
* Node.js installed.
* A physical iOS device is recommended for testing the camera and FaceID properly.

### Installation & Running

1. Clone the repository:

   ```bash
   git clone git@github.com:DanielRaschPout/BioAuthApp.git
   cd BioAuthApp
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Generate the native iOS project and run it:

   ```bash
   npx expo prebuild --clean
   npx expo run:ios
   ```

   *Note: Ensure your iOS device is connected and selected as the build target in Xcode, or use an iOS Simulator.*
