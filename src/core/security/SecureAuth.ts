/**
 * SecureAuth.ts — Core authentication service
 *
 * Architecture note: This file is pure business logic. It has zero imports
 * from React or React Native UI libraries. That separation means you can
 * unit-test it in isolation and swap the UI later without touching auth logic.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

// The key used to store/retrieve the token in the device's secure storage.
// Keeping it as a module-level constant prevents typos and makes it easy to
// change in one place.
const TOKEN_KEY = 'bio_auth_demo_token';

// Separate key for the user-defined secret stored via SecureVaultScreen.
// Using a distinct key means the vault and the token flow never collide —
// clearing one does not affect the other.
const VAULT_SECRET_KEY = 'bio_auth_vault_secret';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AuthenticationType = LocalAuthentication.AuthenticationType;

export interface HardwareCapabilities {
  /** True if the device has biometric hardware (FaceID sensor, fingerprint reader, etc.) */
  hasHardware: boolean;
  /** True if the user has actually enrolled a biometric credential */
  isEnrolled: boolean;
  /** The list of supported methods (FINGERPRINT=1, FACIAL_RECOGNITION=2, IRIS=3) */
  supportedTypes: AuthenticationType[];
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Queries the device's biometric hardware without triggering any prompt.
 *
 * We call this on screen mount so the UI can render the correct badge
 * ("Face ID available", "Touch ID available", or "No biometrics") before
 * the user taps anything — giving immediate, honest feedback.
 */
export async function getHardwareCapabilities(): Promise<HardwareCapabilities> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  // supportedAuthenticationTypesAsync returns an array of numeric enum values.
  const supportedTypes = hasHardware
    ? await LocalAuthentication.supportedAuthenticationTypesAsync()
    : [];

  return { hasHardware, isEnrolled, supportedTypes };
}

/**
 * Generates a mock token and persists it to the platform's hardware-backed
 * secure storage (iOS Keychain / Android Keystore) via expo-secure-store.
 *
 * Why SecureStore and not AsyncStorage?
 *   AsyncStorage writes to a plaintext file on disk.
 *   SecureStore encrypts the value using the device's Secure Enclave (iOS)
 *   or StrongBox/TEE (Android). This is the key security claim of this app.
 *
 * The token itself is a demo value — in a real app this would be a JWT or
 * session token received from your backend after server-side auth.
 */
export async function registerToken(): Promise<string> {
  const token = `DEMO.${Date.now()}.${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  return token;
}

/**
 * Challenges the user with a native biometric prompt, then — only on
 * success — reads the token from SecureStore.
 *
 * Why two steps instead of SecureStore's built-in `requireAuthentication`?
 *   The `requireAuthentication` flag on SecureStore silently fails on some
 *   Expo Go builds. Calling LocalAuthentication.authenticateAsync() first
 *   gives us a typed result object with an explicit error string, which we
 *   can surface to the user with a real message rather than a silent null.
 *
 * This function throws on failure so the caller (the screen) can catch the
 * error and display it — keeping error-handling logic out of this service.
 */
export async function authenticateAndRetrieveToken(): Promise<string> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to access your secure token',
    fallbackLabel: 'Use Passcode',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });

  if (!result.success) {
    // result.error is a string code like 'user_cancel' or 'lockout'
    throw new Error(result.error ?? 'Authentication failed');
  }

  const token = await SecureStore.getItemAsync(TOKEN_KEY);

  if (!token) {
    throw new Error('No token enrolled. Please enroll first.');
  }

  return token;
}

/**
 * Checks whether a token currently exists in secure storage, without
 * triggering any biometric prompt. Useful for showing the correct initial
 * UI state (enrolled vs. not enrolled) on app launch.
 */
export async function isTokenEnrolled(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  return token !== null;
}

/**
 * Deletes the stored token — equivalent to "sign out" or
 * "de-register this device". SecureStore.deleteItemAsync is a no-op if
 * the key doesn't exist, so it's safe to call unconditionally.
 */
export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ─── Vault Functions (custom user secret) ─────────────────────────────────────

/**
 * Saves a user-provided string to hardware-backed secure storage.
 *
 * Unlike registerToken(), the caller supplies the value — this is the
 * "Enroll Secret" action in SecureVaultScreen. We validate that the string
 * is non-empty here so screens don't need to repeat that check.
 */
export async function enrollCustomSecret(secret: string): Promise<void> {
  if (!secret.trim()) {
    throw new Error('Secret cannot be empty.');
  }
  await SecureStore.setItemAsync(VAULT_SECRET_KEY, secret.trim());
}

/**
 * Runs a biometric challenge then — only on success — reads the vault secret.
 *
 * Structurally identical to authenticateAndRetrieveToken() so you can compare
 * the two and see the pattern: authenticate first, read storage second.
 * Throwing on failure keeps error-handling logic in the screen, not here.
 */
export async function authenticateAndRetrieveSecret(): Promise<string> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to reveal your vault secret',
    fallbackLabel: 'Use Passcode',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });

  if (!result.success) {
    throw new Error(result.error ?? 'Authentication failed');
  }

  const secret = await SecureStore.getItemAsync(VAULT_SECRET_KEY);

  if (!secret) {
    throw new Error('No secret enrolled. Please enroll a secret first.');
  }

  return secret;
}

/**
 * Returns true if a custom secret currently exists in secure storage.
 * Safe to call without any biometric prompt — used to set initial UI state.
 */
export async function isSecretEnrolled(): Promise<boolean> {
  const secret = await SecureStore.getItemAsync(VAULT_SECRET_KEY);
  return secret !== null;
}

/**
 * Permanently removes the vault secret. Mirrors clearToken() in behaviour.
 * SecureStore.deleteItemAsync is a no-op if the key doesn't exist.
 */
export async function clearCustomSecret(): Promise<void> {
  await SecureStore.deleteItemAsync(VAULT_SECRET_KEY);
}
