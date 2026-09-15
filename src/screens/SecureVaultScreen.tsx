/**
 * SecureVaultScreen.tsx — Secure Storage Dashboard
 *
 * This screen lets the user interact directly with the iOS Secure Enclave
 * via expo-secure-store. It demonstrates three core storage operations:
 *   1. Enroll  — write a custom secret into SecureStore
 *   2. Retrieve — biometric-gate the read operation
 *   3. Delete  — wipe the secret from SecureStore
 *
 * Architecture note: All SecureStore and biometric calls live in SecureAuth.ts.
 * This file contains only React state, event handlers, and JSX — no direct
 * calls to expo-secure-store or expo-local-authentication.
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  authenticateAndRetrieveSecret,
  clearCustomSecret,
  enrollCustomSecret,
  isSecretEnrolled,
} from '@/core/security/SecureAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A discriminated union models all possible feedback states.
 *
 * Why a union instead of separate `isLoading`, `errorMessage`, `successMessage`
 * booleans? Because those three booleans can form impossible combinations
 * (e.g. `isLoading=true` AND `errorMessage="..."` simultaneously). A union
 * makes illegal states unrepresentable — the TypeScript compiler enforces
 * that you can only be in one state at a time.
 */
type Status =
  | { kind: 'idle' }
  | { kind: 'loading'; action: 'enroll' | 'retrieve' | 'delete' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

// ─── Component ────────────────────────────────────────────────────────────────

export default function SecureVaultScreen() {
  /**
   * STATE BREAKDOWN — why these four, and only these four?
   *
   * secretInput     — Purely UI-local. The string the user is currently typing.
   *                   Lives here (not in SecureAuth) because it only matters
   *                   while the user is composing; it is never persisted.
   *
   * isEnrolled      — Reflects the real state of SecureStore. Changes after
   *                   enroll and delete actions. Drives button enable/disable
   *                   logic so the UI stays in sync with storage.
   *
   * retrievedSecret — The secret text, revealed only after a successful
   *                   biometric challenge. Kept separate from `status` because
   *                   it should persist on-screen after the status resets,
   *                   and it is hidden again when the user re-enrolls or deletes.
   *
   * status          — Transient feedback for the most recent action. Using the
   *                   Status union (above) instead of booleans prevents the UI
   *                   from accidentally showing conflicting indicators.
   */
  const [secretInput, setSecretInput] = useState('');
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [retrievedSecret, setRetrievedSecret] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  /**
   * useEffect with [] runs once after the first render.
   * We use it to check SecureStore on mount so the buttons render in the
   * correct enabled/disabled state immediately — no "flash of wrong state".
   */
  useEffect(() => {
    isSecretEnrolled().then(setIsEnrolled);
  }, []);

  // ── Action handlers ─────────────────────────────────────────────────────────

  async function handleEnroll() {
    setStatus({ kind: 'loading', action: 'enroll' });
    setRetrievedSecret(null);
    try {
      await enrollCustomSecret(secretInput);
      setIsEnrolled(true);
      setSecretInput('');
      setStatus({ kind: 'success', message: '✓ Secret saved to Secure Enclave.' });
    } catch (e) {
      setStatus({ kind: 'error', message: String(e) });
    }
  }

  async function handleRetrieve() {
    setStatus({ kind: 'loading', action: 'retrieve' });
    setRetrievedSecret(null);
    try {
      const secret = await authenticateAndRetrieveSecret();
      setRetrievedSecret(secret);
      setStatus({ kind: 'success', message: '✓ Biometric check passed. Secret revealed below.' });
    } catch (e) {
      setStatus({ kind: 'error', message: String(e) });
    }
  }

  async function handleDelete() {
    setStatus({ kind: 'loading', action: 'delete' });
    setRetrievedSecret(null);
    try {
      await clearCustomSecret();
      setIsEnrolled(false);
      setStatus({ kind: 'success', message: '✓ Secret deleted from Secure Enclave.' });
    } catch (e) {
      setStatus({ kind: 'error', message: String(e) });
    }
  }

  // ── Derived values ──────────────────────────────────────────────────────────

  const isLoading = status.kind === 'loading';
  const loadingAction = status.kind === 'loading' ? status.action : null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.title}>Secure Vault</Text>
          <Text style={styles.subtitle}>
            Read and write to the iOS Secure Enclave{'\n'}via expo-secure-store
          </Text>

          <View style={[styles.badge, isEnrolled ? styles.badgeActive : styles.badgeEmpty]}>
            <Text style={styles.badgeText}>
              {isEnrolled ? '● Secret enrolled' : '○ No secret enrolled'}
            </Text>
          </View>
        </View>

        {/* ── Global feedback card ── */}
        {status.kind !== 'idle' && (
          <View style={[
            styles.statusCard,
            status.kind === 'success' && styles.statusSuccess,
            status.kind === 'error'   && styles.statusError,
            status.kind === 'loading' && styles.statusLoading,
          ]}>
            {status.kind === 'loading' ? (
              <ActivityIndicator color={BLUE} />
            ) : (
              <Text style={styles.statusText}>{status.message}</Text>
            )}
          </View>
        )}

        {/* ── Revealed secret card ── */}
        {retrievedSecret !== null && (
          <View style={styles.revealCard}>
            <Text style={styles.revealLabel}>DECRYPTED SECRET</Text>
            <Text style={styles.revealValue} selectable>{retrievedSecret}</Text>
          </View>
        )}

        {/* Section 1 — Enroll Secret */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1 · Enroll Secret</Text>
          <Text style={styles.sectionDescription}>
            Type any string. It will be encrypted and stored in the device
            hardware-backed keychain — never written to disk in plaintext.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Enter your secret…"
            placeholderTextColor="#48484A"
            value={secretInput}
            onChangeText={setSecretInput}
            secureTextEntry={false}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            editable={!isLoading}
          />

          <TouchableOpacity
            style={[
              styles.button,
              styles.buttonEnroll,
              (isLoading || !secretInput.trim()) && styles.buttonDisabled,
            ]}
            onPress={handleEnroll}
            disabled={isLoading || !secretInput.trim()}
            activeOpacity={0.8}
          >
            {loadingAction === 'enroll' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                {isEnrolled ? '🔄  Re-enroll Secret' : '🔑  Save to Secure Enclave'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Section 2 — Retrieve Secret */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2 · Retrieve Secret</Text>
          <Text style={styles.sectionDescription}>
            Triggers a Face ID / Touch ID prompt. Only on success does the app
            read from SecureStore — the biometric check is the gate.
          </Text>

          <TouchableOpacity
            style={[
              styles.button,
              styles.buttonRetrieve,
              (!isEnrolled || isLoading) && styles.buttonDisabled,
            ]}
            onPress={handleRetrieve}
            disabled={!isEnrolled || isLoading}
            activeOpacity={0.8}
          >
            {loadingAction === 'retrieve' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>🧬  Authenticate & Reveal</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Section 3 — Delete Secret */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3 · Delete Secret</Text>
          <Text style={styles.sectionDescription}>
            Permanently removes the secret from SecureStore. This is
            irreversible — the encrypted data is gone.
          </Text>

          <TouchableOpacity
            style={[
              styles.button,
              styles.buttonDelete,
              (!isEnrolled || isLoading) && styles.buttonDisabled,
            ]}
            onPress={handleDelete}
            disabled={!isEnrolled || isLoading}
            activeOpacity={0.8}
          >
            {loadingAction === 'delete' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>🗑  Delete from Secure Enclave</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Footer ── */}
        <Text style={styles.footerNote}>
          expo-secure-store uses iOS Keychain (Secure Enclave) on iOS{'\n'}
          and Android Keystore on Android
        </Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const BLUE    = '#208AEF';
const SURFACE = '#1C1C1E';

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  scrollContent: {
    paddingTop: 64,
    paddingBottom: 48,
    paddingHorizontal: 24,
    gap: 20,
  },

  // Header
  header: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  lockIcon: {
    fontSize: 52,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
  badge: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeActive: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    borderColor: 'rgba(52, 199, 89, 0.4)',
  },
  badgeEmpty: {
    backgroundColor: 'rgba(142, 142, 147, 0.1)',
    borderColor: 'rgba(142, 142, 147, 0.3)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EBEBF5',
  },

  // Status / reveal cards
  statusCard: {
    borderRadius: 14,
    padding: 16,
    minHeight: 52,
    justifyContent: 'center',
    borderWidth: 1,
  },
  statusSuccess: {
    backgroundColor: 'rgba(52, 199, 89, 0.10)',
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  statusError: {
    backgroundColor: 'rgba(255, 59, 48, 0.10)',
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  statusLoading: {
    backgroundColor: 'rgba(32, 138, 239, 0.10)',
    borderColor: 'rgba(32, 138, 239, 0.3)',
  },
  statusText: {
    color: '#EBEBF5',
    fontSize: 13,
    lineHeight: 18,
  },
  revealCard: {
    backgroundColor: 'rgba(32, 138, 239, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(32, 138, 239, 0.35)',
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  revealLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: BLUE,
  },
  revealValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'ui-monospace',
  },

  // Sections
  section: {
    backgroundColor: SURFACE,
    borderRadius: 18,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 19,
  },

  // Input
  input: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },

  // Buttons
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonEnroll: {
    backgroundColor: '#2C2C2E',
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  buttonRetrieve: {
    backgroundColor: BLUE,
  },
  buttonDelete: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.4)',
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Footer
  footerNote: {
    color: '#48484A',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 4,
  },
});
