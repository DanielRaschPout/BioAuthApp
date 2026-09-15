/**
 * Manual mock for react-native-vision-camera-face-detector
 *
 * The real package re-exports a Camera component that wraps
 * react-native-vision-camera's Camera with ML Kit face detection
 * frame processing. In tests we just need a plain <View> and the
 * Face type to remain importable.
 */

import React from 'react';
import { View } from 'react-native';

/**
 * Camera component stub — renders a plain View and ignores all
 * face-detection-specific props (onFacesDetected, runClassifications, etc.).
 */
export const Camera = React.forwardRef((props: any, ref: any) =>
  React.createElement(View, { ...props, ref, testID: 'mock-face-camera' }),
);

/**
 * Re-export the Face type as an empty interface so TypeScript
 * imports don't break. Tests that need a specific Face shape
 * construct one inline.
 */
export type Face = {
  trackingId: number | undefined;
  yawAngle: number;
  leftEyeOpenProbability: number | undefined;
  rightEyeOpenProbability: number | undefined;
  bounds: { x: number; y: number; width: number; height: number };
};
