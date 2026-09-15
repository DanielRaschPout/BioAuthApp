/**
 * LoginScreen.tsx — Primary authentication UI
 *
 * This screen is the "face" of the app. It wires the SecureAuth
 * service functions to React state, giving the user clear visual
 * feedback at every step of the enroll → authenticate flow.
 */

import { AuthenticationType } from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  authenticateAndRetrieveToken,
  clearToken,
  getHardwareCapabilities,
  HardwareCapabilities,
  isTokenEnrolled,
  registerToken,
} from '@/core/security/SecureAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Maps the numeric AuthenticationType enum to a human-readable label. */
function getBiometricLabel(capabilities: HardwareCapabilities | null): string {
  if (!capabilities?.hasHardware) return 'No Biometric Hardware';
  if (!capabilities.isEnrolled) return 'No Biometrics Enrolled';
  if (capabilities.supportedTypes.includes(AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID';
  }
  if (capabilities.supportedTypes.includes(AuthenticationType.FINGERPRINT)) {
    return 'Touch ID / Fingerprint';
  }
  return 'Biometrics';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  /**
   * useState — Why three separate state values?
   *
   * We track three distinct pieces of data that change independently:
   *   - `capabilities`: set once on mount, never changes again.
   *   - `enrolled`: changes after enroll/clear actions.
   *   - `status`: changes on every button tap (loading → success/error).
   *
   * Merging them into one object would force re-renders of the whole screen
   * whenever any single field changes. Keeping them separate lets React only
   * re-render the parts that actually need to update.
   */
  const [capabilities, setCapabilities] = useState<HardwareCapabilities | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  /**
   * useEffect with an empty dependency array [] runs exactly once, right
   * after the component first renders. This is the correct place to do
   * "startup" work — fetching data you need to display the initial UI.
   *
   * We avoid putting this logic directly in the function body because the
   * component function runs on every render; we only want this async work
   * to happen once.
   */
  useEffect(() => {
    async function bootstrap() {
      const [caps, alreadyEnrolled] = await Promise.all([
        getHardwareCapabilities(),
        isTokenEnrolled(),
      ]);
      setCapabilities(caps);
      setEnrolled(alreadyEnrolled);
    }
    bootstrap();
  }, []);

  // ── Action handlers ─────────────────────────────────────────────────────────

  async function handleEnroll() {
    setStatus({ kind: 'loading' });
    try {
      const token = await registerToken();
      setEnrolled(true);
      setStatus({
        kind: 'success',
        message: `Token enrolled!\n${token}`,
      });
    } catch (e) {
      setStatus({ kind: 'error', message: String(e) });
    }
  }

  async function handleAuthenticate() {
    setStatus({ kind: 'loading' });
    try {
      const token = await authenticateAndRetrieveToken();
      setStatus({
        kind: 'success',
        message: `Authentication successful!\n${token}`,
      });
    } catch (e) {
      setStatus({ kind: 'error', message: String(e) });
    }
  }

  async function handleClear() {
    await clearToken();
    setEnrolled(false);
    setStatus({ kind: 'idle' });
  }

  // ── Derived values ──────────────────────────────────────────────────────────

  const biometricLabel = getBiometricLabel(capabilities);
  const isLoading = status.kind === 'loading';
  const canAuthenticate = capabilities?.hasHardware && capabilities.isEnrolled;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    /**
     * Flexbox layout explanation:
     *
     * The root container uses `flex: 1` to fill the entire screen, then
     * `alignItems: 'center'` to center children horizontally (the cross axis
     * in a column flex container) and `justifyContent: 'space-between'` to
     * push the header, body, and footer to the top, middle, and bottom.
     *
     * This "three-zone" pattern (header / content / footer) is a standard
     * mobile layout: the header establishes identity, the content does the
     * work, and the footer holds destructive/secondary actions.
     */
    <View style={styles.container}>

      {/* ── Header zone ── */}
      <View style={styles.header}>
        <Text style={styles.shieldIcon}>🔐</Text>
        <Text style={styles.title}>BioAuthApp</Text>
        <Text style={styles.subtitle}>Hardware-Backed Biometric Authentication</Text>

        {/* Biometric capability badge */}
        <View style={[
          styles.badge,
          canAuthenticate ? styles.badgeAvailable : styles.badgeUnavailable,
        ]}>
          <Text style={styles.badgeText}>{biometricLabel}</Text>
        </View>
      </View>

      {/* ── Body zone ── */}
      <View style={styles.body}>

        {/* Status feedback card */}
        {status.kind !== 'idle' && (
          <View style={[
            styles.statusCard,
            status.kind === 'success' && styles.statusSuccess,
            status.kind === 'error' && styles.statusError,
            status.kind === 'loading' && styles.statusLoading,
          ]}>
            {status.kind === 'loading' ? (
              <ActivityIndicator color="#208AEF" />
            ) : (
              <Text style={styles.statusText}>{status.message}</Text>
            )}
          </View>
        )}

        {/* Enroll button */}
        <TouchableOpacity
          style={[styles.button, styles.buttonEnroll, isLoading && styles.buttonDisabled]}
          onPress={handleEnroll}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {enrolled ? '🔄  Re-enroll Token' : '🔑  Enroll Token'}
          </Text>
        </TouchableOpacity>

        {/* Authenticate button — only enabled if hardware and a token exist */}
        <TouchableOpacity
          style={[
            styles.button,
            styles.buttonAuth,
            (!enrolled || !canAuthenticate || isLoading) && styles.buttonDisabled,
          ]}
          onPress={handleAuthenticate}
          disabled={!enrolled || !canAuthenticate || isLoading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>🧬  Authenticate</Text>
        </TouchableOpacity>
      </View>

      {/* ── Footer zone ── */}
      <View style={styles.footer}>
        {enrolled && (
          <TouchableOpacity onPress={handleClear} activeOpacity={0.7}>
            <Text style={styles.clearText}>Clear stored token</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.footerNote}>
          Tokens are encrypted in the iOS Secure Enclave via expo-secure-store
        </Text>
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const BLUE = '#208AEF';
const SUCCESS = '#34C759';
const DANGER = '#FF3B30';

const styles = StyleSheet.create({
  /**
   * Why `flex: 1` on the container?
   * React Native's layout engine starts from the root view and divides space
   * among children. `flex: 1` tells this view to take *all* available space
   * from its parent (the screen). Without it, the View would collapse to the
   * height of its content and `justifyContent: 'space-between'` would have
   * no effect.
   */
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },

  // Header
  header: {
    alignItems: 'center',
    gap: 12,
  },
  shieldIcon: {
    fontSize: 56,
  },
  title: {
    fontSize: 32,
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
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeAvailable: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.4)',
  },
  badgeUnavailable: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.4)',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EBEBF5',
  },

  // Body
  body: {
    width: '100%',
    gap: 16,
  },
  statusCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 4,
    minHeight: 60,
    justifyContent: 'center',
  },
  statusSuccess: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  statusError: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  statusLoading: {
    backgroundColor: 'rgba(32, 138, 239, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(32, 138, 239, 0.3)',
  },
  statusText: {
    color: '#EBEBF5',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'ui-monospace',
  },

  // Buttons
  button: {
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  buttonEnroll: {
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  buttonAuth: {
    backgroundColor: BLUE,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Footer
  footer: {
    alignItems: 'center',
    gap: 12,
  },
  clearText: {
    color: DANGER,
    fontSize: 14,
    fontWeight: '500',
  },
  footerNote: {
    color: '#48484A',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
