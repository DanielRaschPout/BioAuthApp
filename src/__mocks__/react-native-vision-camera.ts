/**
 * Manual mock for react-native-vision-camera
 *
 * Stubs out the native camera hooks and the Camera component so Jest
 * doesn't try to load the real C++/Swift bridge (which would crash
 * immediately in a Node.js test environment).
 *
 * The hooks return sensible defaults — permission granted, a mock
 * front device — so component tests that render LivenessScreen
 * at least get past the permission/device gates.
 */

import React from 'react';
import { View } from 'react-native';

export const useCameraPermission = jest.fn(() => ({
  hasPermission: true,
  requestPermission: jest.fn(async () => true),
  canRequestPermission: true,
}));

export const useCameraDevice = jest.fn((position: string) => {
  if (position === 'front') {
    return { id: 'mock-front', position: 'front' };
  }
  return undefined;
});

/**
 * The real Camera is a native view — we replace it with a plain <View>
 * so React can render it in the test environment without errors.
 */
export const Camera = React.forwardRef((props: any, ref: any) =>
  React.createElement(View, { ...props, ref, testID: 'mock-camera' }),
);
