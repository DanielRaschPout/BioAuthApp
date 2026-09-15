/**
 * Manual mock for expo-secure-store
 *
 * Uses an in-memory Map to simulate the device's hardware-backed keychain.
 * This lets our unit tests exercise real storage semantics (write → read →
 * delete lifecycle) without touching the iOS Keychain at all.
 *
 * Why a Map and not just jest.fn() stubs?
 *   Because SecureAuth.ts's logic depends on *state*: registerToken writes
 *   a value, then authenticateAndRetrieveToken reads it back. If we only
 *   stubbed the return values, we'd be testing our mocks, not our code.
 *   An in-memory Map lets the actual set/get/delete flow execute and tests
 *   can verify side effects naturally.
 *
 * The `__resetStore()` helper is called in `beforeEach` so each test
 * starts with a clean slate — test isolation is critical.
 */

const store = new Map<string, string>();

export const setItemAsync = jest.fn(
  async (key: string, value: string): Promise<void> => {
    store.set(key, value);
  },
);

export const getItemAsync = jest.fn(
  async (key: string): Promise<string | null> => {
    return store.get(key) ?? null;
  },
);

export const deleteItemAsync = jest.fn(
  async (key: string): Promise<void> => {
    store.delete(key);
  },
);

/** Test helper — wipe the in-memory store between tests. */
export function __resetStore(): void {
  store.clear();
  setItemAsync.mockClear();
  getItemAsync.mockClear();
  deleteItemAsync.mockClear();
}
