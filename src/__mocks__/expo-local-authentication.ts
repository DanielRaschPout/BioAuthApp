/**
 * Manual mock for expo-local-authentication
 *
 * Every export is a jest.fn() with a sensible default return value that
 * simulates a device WITH biometric hardware and an enrolled user.
 * Individual tests override these defaults via `.mockResolvedValueOnce()`
 * to test error paths (no hardware, user cancels, etc.).
 *
 * Why default to "everything works"?
 *   Because the happy path is the most common test setup, and Jest's
 *   `mockResolvedValueOnce` only overrides for *one* call, automatically
 *   falling back to the default afterward. This keeps test code minimal.
 */

/**
 * Mirror the real enum so tests that import `AuthenticationType` from
 * the mock get the correct numeric values (FINGERPRINT=1, FACIAL=2, IRIS=3).
 */
export enum AuthenticationType {
  FINGERPRINT = 1,
  FACIAL_RECOGNITION = 2,
  IRIS = 3,
}

export const hasHardwareAsync = jest.fn(async () => true);

export const isEnrolledAsync = jest.fn(async () => true);

export const supportedAuthenticationTypesAsync = jest.fn(async () => [
  AuthenticationType.FACIAL_RECOGNITION,
]);

export const authenticateAsync = jest.fn(async () => ({
  success: true as const,
}));

/** Test helper — reset all stubs to their happy-path defaults. */
export function __resetMocks(): void {
  hasHardwareAsync.mockReset().mockResolvedValue(true);
  isEnrolledAsync.mockReset().mockResolvedValue(true);
  supportedAuthenticationTypesAsync
    .mockReset()
    .mockResolvedValue([AuthenticationType.FACIAL_RECOGNITION]);
  authenticateAsync.mockReset().mockResolvedValue({ success: true as const });
}
