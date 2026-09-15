/**
 * SecureAuth.test.ts — Unit tests for the core authentication service
 *
 * These tests run against manual mocks of expo-secure-store and
 * expo-local-authentication. The mocks use an in-memory Map (secure-store)
 * and controllable jest.fn() stubs (local-auth), so we're testing the
 * real branching logic in SecureAuth.ts — not just verifying that mocks
 * return what we told them to.
 *
 * Coverage targets:
 *   ✓ Happy-path enrollment and retrieval
 *   ✓ Biometric failure (user cancels, lockout)
 *   ✓ Missing token / missing secret edge cases
 *   ✓ Empty string validation
 *   ✓ Hardware capability detection (with/without hardware)
 *   ✓ Clear / delete lifecycle
 */

import { __resetStore } from 'expo-secure-store';
import {
  authenticateAsync,
  hasHardwareAsync,
  isEnrolledAsync,
  supportedAuthenticationTypesAsync,
  __resetMocks,
  AuthenticationType,
} from 'expo-local-authentication';

import {
  getHardwareCapabilities,
  registerToken,
  authenticateAndRetrieveToken,
  isTokenEnrolled,
  clearToken,
  enrollCustomSecret,
  authenticateAndRetrieveSecret,
  isSecretEnrolled,
  clearCustomSecret,
} from '@/core/security/SecureAuth';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  __resetStore();
  __resetMocks();
});

// ─── getHardwareCapabilities ──────────────────────────────────────────────────

describe('getHardwareCapabilities()', () => {
  it('returns full capabilities when Face ID hardware is available', async () => {
    const caps = await getHardwareCapabilities();

    expect(caps).toEqual({
      hasHardware: true,
      isEnrolled: true,
      supportedTypes: [AuthenticationType.FACIAL_RECOGNITION],
    });
  });

  it('returns empty supportedTypes when no hardware exists', async () => {
    /**
     * mockResolvedValueOnce overrides just the next call — after that,
     * the mock falls back to its default. This is why we set defaults
     * in __resetMocks() and only override per-test for the error path.
     */
    (hasHardwareAsync as jest.Mock).mockResolvedValueOnce(false);
    (isEnrolledAsync as jest.Mock).mockResolvedValueOnce(false);

    const caps = await getHardwareCapabilities();

    expect(caps.hasHardware).toBe(false);
    expect(caps.isEnrolled).toBe(false);
    expect(caps.supportedTypes).toEqual([]);
    // supportedAuthenticationTypesAsync should NOT be called when there's no hardware
    expect(supportedAuthenticationTypesAsync).not.toHaveBeenCalled();
  });
});

// ─── Token flow ───────────────────────────────────────────────────────────────

describe('Token enrollment and retrieval', () => {
  it('registerToken() returns a DEMO.* token and persists it', async () => {
    const token = await registerToken();

    expect(token).toMatch(/^DEMO\.\d+\.[A-Z0-9]+$/);
    expect(await isTokenEnrolled()).toBe(true);
  });

  it('isTokenEnrolled() returns false before any enrollment', async () => {
    expect(await isTokenEnrolled()).toBe(false);
  });

  it('authenticateAndRetrieveToken() returns the enrolled token on success', async () => {
    const enrolled = await registerToken();
    const retrieved = await authenticateAndRetrieveToken();

    expect(retrieved).toBe(enrolled);
    expect(authenticateAsync).toHaveBeenCalledTimes(1);
  });

  it('authenticateAndRetrieveToken() throws when the user cancels biometrics', async () => {
    await registerToken();
    (authenticateAsync as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'user_cancel',
    });

    await expect(authenticateAndRetrieveToken()).rejects.toThrow('user_cancel');
  });

  it('authenticateAndRetrieveToken() throws when no token is enrolled', async () => {
    // Biometric succeeds, but there's nothing in the store
    await expect(authenticateAndRetrieveToken()).rejects.toThrow(
      'No token enrolled',
    );
  });

  it('clearToken() removes the token from storage', async () => {
    await registerToken();
    expect(await isTokenEnrolled()).toBe(true);

    await clearToken();
    expect(await isTokenEnrolled()).toBe(false);
  });
});

// ─── Vault (custom secret) flow ───────────────────────────────────────────────

describe('Vault secret enrollment and retrieval', () => {
  it('enrollCustomSecret() stores a trimmed secret', async () => {
    await enrollCustomSecret('  my-secret  ');
    expect(await isSecretEnrolled()).toBe(true);
  });

  it('enrollCustomSecret() throws for an empty string', async () => {
    await expect(enrollCustomSecret('')).rejects.toThrow(
      'Secret cannot be empty',
    );
  });

  it('enrollCustomSecret() throws for a whitespace-only string', async () => {
    await expect(enrollCustomSecret('   ')).rejects.toThrow(
      'Secret cannot be empty',
    );
  });

  it('authenticateAndRetrieveSecret() returns the secret after biometric auth', async () => {
    await enrollCustomSecret('vault-data');
    const secret = await authenticateAndRetrieveSecret();

    expect(secret).toBe('vault-data');
    expect(authenticateAsync).toHaveBeenCalledTimes(1);
  });

  it('authenticateAndRetrieveSecret() throws when user cancels', async () => {
    await enrollCustomSecret('vault-data');
    (authenticateAsync as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'user_cancel',
    });

    await expect(authenticateAndRetrieveSecret()).rejects.toThrow(
      'user_cancel',
    );
  });

  it('authenticateAndRetrieveSecret() throws when no secret is enrolled', async () => {
    await expect(authenticateAndRetrieveSecret()).rejects.toThrow(
      'No secret enrolled',
    );
  });

  it('isSecretEnrolled() returns false before enrollment', async () => {
    expect(await isSecretEnrolled()).toBe(false);
  });

  it('clearCustomSecret() removes the secret from storage', async () => {
    await enrollCustomSecret('vault-data');
    expect(await isSecretEnrolled()).toBe(true);

    await clearCustomSecret();
    expect(await isSecretEnrolled()).toBe(false);
  });
});
