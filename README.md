# BioAuthApp

A secure React Native application showcasing hardware-backed biometric authentication and camera liveness checks. Built as a technical portfolio project.

## Core Features

* **Biometric Authentication:** Integrates FaceID/TouchID via `expo-local-authentication`.
* **Secure Storage:** Safely encrypts and stores authentication tokens using the device's Secure Enclave via `expo-secure-store`.
* **Liveness Camera:** Front-facing camera integration using `expo-camera` to simulate physical presence verification.

## Tech Stack

* React Native (Expo SDK 57)
* TypeScript
* Expo Managed Workflow

## Getting Started (Windows / Expo Go)

### Prerequisites

* Node.js installed on your Windows machine.
* The **Expo Go** app installed on your physical iOS or Android device.

### Installation

1. Clone the repository:

   ```bash
   git clone git@github.com:DanielRaschPout/BioAuthApp.git
   cd BioAuthApp
