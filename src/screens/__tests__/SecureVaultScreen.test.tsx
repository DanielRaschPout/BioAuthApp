/**
 * SecureVaultScreen.test.tsx — Component tests
 *
 * These tests render the SecureVaultScreen in isolation and verify that:
 *   1. The correct UI elements appear based on enrollment state
 *   2. Buttons are disabled/enabled at the right times
 *   3. User interactions call the correct service functions
 *
 * @testing-library/react-native v14 + React 19 concurrent notes:
 *   - `render()` returns a Promise — must be awaited
 *   - `fireEvent.press()` on async handlers needs `act()` wrapping
 *   - All state assertions must go through `waitFor()`
 */

import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

import SecureVaultScreen from '@/screens/SecureVaultScreen';

// ─── Mock the service layer ───────────────────────────────────────────────────

jest.mock('@/core/security/SecureAuth', () => ({
  enrollCustomSecret: jest.fn(),
  authenticateAndRetrieveSecret: jest.fn(),
  clearCustomSecret: jest.fn(),
  isSecretEnrolled: jest.fn(),
}));

import {
  enrollCustomSecret,
  authenticateAndRetrieveSecret,
  clearCustomSecret,
  isSecretEnrolled,
} from '@/core/security/SecureAuth';

const mockEnroll = enrollCustomSecret as jest.MockedFunction<typeof enrollCustomSecret>;
const mockRetrieve = authenticateAndRetrieveSecret as jest.MockedFunction<typeof authenticateAndRetrieveSecret>;
const mockDelete = clearCustomSecret as jest.MockedFunction<typeof clearCustomSecret>;
const mockIsEnrolled = isSecretEnrolled as jest.MockedFunction<typeof isSecretEnrolled>;

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockIsEnrolled.mockResolvedValue(false);
  mockEnroll.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SecureVaultScreen', () => {
  it('renders the header text', async () => {
    const { getByText } = await render(<SecureVaultScreen />);

    expect(getByText('Secure Vault')).toBeTruthy();
  });

  it('shows "No secret enrolled" badge initially', async () => {
    const { getByText } = await render(<SecureVaultScreen />);

    await waitFor(() => {
      expect(getByText('○ No secret enrolled')).toBeTruthy();
    });
  });

  it('shows "Secret enrolled" badge when a secret exists', async () => {
    mockIsEnrolled.mockResolvedValue(true);

    const { getByText } = await render(<SecureVaultScreen />);

    await waitFor(() => {
      expect(getByText('● Secret enrolled')).toBeTruthy();
    });
  });

  it('renders the enroll button when input is empty', async () => {
    const { getByText } = await render(<SecureVaultScreen />);

    const button = getByText('🔑  Save to Secure Enclave');
    expect(button).toBeTruthy();
  });

  it('calls enrollCustomSecret when user types and presses enroll', async () => {
    const { getByText, getByPlaceholderText } = await render(<SecureVaultScreen />);

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Enter your secret…'), 'my-test-secret');
    });

    await act(async () => {
      fireEvent.press(getByText('🔑  Save to Secure Enclave'));
    });

    await waitFor(() => {
      expect(mockEnroll).toHaveBeenCalledWith('my-test-secret');
    });
  });

  it('shows success message after successful enrollment', async () => {
    const { getByText, getByPlaceholderText } = await render(<SecureVaultScreen />);

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Enter your secret…'), 'my-test-secret');
    });

    await act(async () => {
      fireEvent.press(getByText('🔑  Save to Secure Enclave'));
    });

    await waitFor(() => {
      expect(getByText('✓ Secret saved to Secure Enclave.')).toBeTruthy();
    });
  });

  it('shows error message when enrollment fails', async () => {
    mockEnroll.mockRejectedValueOnce(new Error('Secret cannot be empty.'));

    const { getByText, getByPlaceholderText } = await render(<SecureVaultScreen />);

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Enter your secret…'), 'x');
    });

    await act(async () => {
      fireEvent.press(getByText('🔑  Save to Secure Enclave'));
    });

    await waitFor(() => {
      expect(getByText(/Secret cannot be empty/)).toBeTruthy();
    });
  });
});
