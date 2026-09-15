/**
 * src/app/liveness.tsx — Route: "/liveness"
 *
 * In Expo Router, this file maps to the "/liveness" route, which is pushed
 * onto the stack when the user navigates from LoginScreen after a successful
 * authentication. Its only job is to render the full-page screen component,
 * keeping the routing layer thin and the screen logic self-contained.
 */

import LivenessScreen from '@/screens/LivenessScreen';

export default LivenessScreen;
