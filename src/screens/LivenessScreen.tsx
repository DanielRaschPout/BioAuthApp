/**
 * LivenessScreen.tsx — Camera Liveness Check
 *
 * The third pillar of BioAuthApp's security demonstration. Unlike the
 * earlier Expo Go-era version of this screen (which could only run a
 * pixel-analysis heuristic on a single captured photo), this build runs on
 * `react-native-vision-camera` + `react-native-vision-camera-face-detector`
 * — a native frame processor wrapping Google ML Kit's on-device face
 * detector. That gets us REAL data per frame: is there a face, where is
 * it, are the eyes open, which way is the head turned. This screen turns
 * that stream of readings into a short directional challenge — modeled on
 * how Face ID enrollment asks you to move your head — via the pure state
 * machine in `src/core/camera/livenessChallenge.ts`.
 *
 * Architecture note: this screen lives in src/screens/ (pure UI + local
 * state) and is imported by its thin Expo Router file at
 * src/app/liveness.tsx. The actual challenge LOGIC — deciding whether a
 * face reading advances or resets the challenge — is deliberately kept out
 * of this file and in src/core/camera/, so it's testable independent of
 * the camera/UI plumbing here.
 */

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Camera, type Face } from 'react-native-vision-camera-face-detector';

import {
  advanceLivenessChallenge,
  type ChallengeState,
  INITIAL_CHALLENGE_STATE,
} from '@/core/camera/livenessChallenge';

// ─── Constants ────────────────────────────────────────────────────────────────

const BLUE = '#208AEF';
const SUCCESS = '#34C759';
const WARNING = '#FF453A';
const BRACKET_SIZE = 28;
const BRACKET_THICKNESS = 3;
const OVERLAY_COLOR = 'rgba(0,0,0,0.60)';

const STEP_COPY: Record<ChallengeState['step'], string> = {
  center: 'Look straight at the camera',
  turnOne: 'Slowly turn your head to either side',
  turnOther: 'Now turn back the other way',
  confirmed: 'Liveness confirmed',
};

const STEP_ORDER: ChallengeState['step'][] = ['center', 'turnOne', 'turnOther'];

/**
 * Capping the camera session to 15fps (module-level constant so the array
 * identity is stable across renders, rather than a fresh literal every
 * time). Left uncapped, the pipeline runs at the device's native rate
 * (often 30-60fps) and tries to run ML Kit inference on every single
 * frame — more than the challenge needs (it only requires readings roughly
 * every ~450ms, see HOLD_DURATION_MS in livenessChallenge.ts) and enough
 * to overload the pipeline, which is what was causing the lag and the
 * flickery "blinking" between detected/not-detected.
 */
const CAMERA_CONSTRAINTS = [{ fps: 60 }];

// ─── Component ────────────────────────────────────────────────────────────────

export default function LivenessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  /** Responsive scan-frame guide — same sizing approach as before: a fraction of the smaller screen dimension rather than a flat constant, so it scales across devices. */
  const { width, height } = useWindowDimensions();
  const frameSize = Math.round(Math.min(width * 0.78, height * 0.42, 380));

  /**
   * useCameraPermission — vision-camera's permission hook is synchronous
   * (it reads a cached native status at mount, no async "not yet known"
   * state to wait out like expo-camera's), so there's no loading gate here
   * — just `hasPermission` / `canRequestPermission` to branch on directly.
   */
  const { hasPermission, requestPermission, canRequestPermission } = useCameraPermission();

  /** Confirms a usable front camera actually exists (e.g. guards against a Simulator with no camera hardware attached). */
  const device = useCameraDevice('front');

  const [challenge, setChallenge] = useState<ChallengeState>(INITIAL_CHALLENGE_STATE);
  /**
   * Derived, not its own `useState` — `challenge.trackingId` already reflects
   * "do we currently consider a face present" once the grace period in
   * `advanceLivenessChallenge` is accounted for, so a separate boolean would
   * just be redundant state to keep in sync (and another render trigger).
   */
  const faceInFrame = challenge.trackingId != null;

  /** Pulsing frame-border glow, running continuously while scanning — there's no manual "press to scan" step anymore, detection runs live. */
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (challenge.step === 'confirmed') return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [challenge.step, pulseAnim]);

  /**
   * `onFacesDetected` fires on every processed camera frame with the
   * current set of detected faces (already bridged to the JS thread by the
   * face-detector package — no manual worklet/runOnJS wiring needed here).
   * We reduce that down to one "primary" face (the largest bounding box,
   * in case something else briefly reads as a face-like region) and feed
   * it to the pure challenge state machine.
   */
  const handleFacesDetected = useCallback((faces: Face[]) => {
    const face = pickPrimaryFace(faces);
    setChallenge(prev =>
      advanceLivenessChallenge(
        prev,
        face
          ? {
              trackingId: face.trackingId,
              yawAngle: face.yawAngle,
              leftEyeOpenProbability: face.leftEyeOpenProbability,
              rightEyeOpenProbability: face.rightEyeOpenProbability,
            }
          : undefined,
        Date.now(),
      ),
    );
  }, []);

  const handleCameraError = useCallback((error: Error) => {
    console.error('[Liveness] camera error:', error);
  }, []);

  // ── Permission / device gates ───────────────────────────────────────────────

  if (!hasPermission) {
    return (
      <View style={styles.gateContainer}>
        <Text style={styles.gateIcon}>📷</Text>
        <Text style={styles.gateTitle}>Camera Access Required</Text>
        <Text style={styles.gateBody}>
          {canRequestPermission
            ? 'BioAuthApp needs front-camera access to perform the liveness check. Your video never leaves the device.'
            : 'Camera access was previously denied. Enable it for BioAuthApp in Settings to continue.'}
        </Text>
        <TouchableOpacity
          style={styles.grantButton}
          onPress={canRequestPermission ? requestPermission : () => Linking.openSettings()}
          activeOpacity={0.8}
        >
          <Text style={styles.grantButtonText}>
            {canRequestPermission ? 'Grant Camera Access' : 'Open Settings'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backLink}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.gateContainer}>
        <Text style={styles.gateIcon}>🚫</Text>
        <Text style={styles.gateTitle}>No Front Camera Found</Text>
        <Text style={styles.gateBody}>
          This device (or Simulator) doesn't expose a usable front-facing camera.
        </Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backLink}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Success overlay ─────────────────────────────────────────────────────────

  if (challenge.step === 'confirmed') {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successCard}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>Liveness Confirmed</Text>
          <Text style={styles.successBody}>
            Tracked the same face through a head-turn challenge — real ML Kit
            detection, not a static-photo check.
          </Text>
          <View style={styles.successMeta}>
            <MetaRow label="Method" value="Live Head-Turn Challenge" />
            <MetaRow label="Engine" value="ML Kit (on-device)" />
            <MetaRow label="Status" value="PASSED" highlight />
          </View>
          <TouchableOpacity style={styles.doneButton} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Camera view ─────────────────────────────────────────────────────────────

  const frameTint = faceInFrame ? BLUE : WARNING;
  const stepIndex = STEP_ORDER.indexOf(challenge.step);

  return (
    <View style={styles.cameraContainer}>
      {/* Layer 1 — Live front-facing camera feed with real-time ML Kit face detection */}
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        constraints={CAMERA_CONSTRAINTS}
        performanceMode="fast"
        runClassifications
        trackingEnabled
        cameraFacing="front"
        onFacesDetected={handleFacesDetected}
        onError={handleCameraError}
      />

      {/* Layer 2 — Vignette mask + scan frame guide, built as one flexbox tree so the frame lands at the true center regardless of header/footer content height (see the equivalent comment history in git — this replaced an earlier version built from absolute percentages that drifted out of alignment with the frame). */}
      <View style={styles.maskLayer} pointerEvents="none">
        <View style={styles.maskEdgeVertical} />
        <View style={[styles.maskRow, { height: frameSize }]}>
          <View style={styles.maskEdgeHorizontal} />

          <View style={[styles.frameWrapper, { width: frameSize, height: frameSize }]}>
            <Animated.View
              style={[styles.frameBorder, { borderColor: frameTint, shadowColor: frameTint, opacity: pulseAnim }]}
            />
            <CornerBracket position="topLeft" color={frameTint} />
            <CornerBracket position="topRight" color={frameTint} />
            <CornerBracket position="bottomLeft" color={frameTint} />
            <CornerBracket position="bottomRight" color={frameTint} />
          </View>

          <View style={styles.maskEdgeHorizontal} />
        </View>
        <View style={styles.maskEdgeVertical} />
      </View>

      {/* Layer 3 — UI chrome, pinned to the top/bottom edges independently of the mask+frame above */}
      <View style={[styles.header, { top: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backButton}>
          <Text style={styles.backButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Liveness Check</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={[styles.bottomChrome, { bottom: insets.bottom + 24 }]}>
        <View style={styles.stepDots}>
          {STEP_ORDER.map((step, i) => (
            <View
              key={step}
              style={[
                styles.stepDot,
                i < stepIndex && styles.stepDotDone,
                i === stepIndex && styles.stepDotActive,
              ]}
            />
          ))}
        </View>

        <View style={styles.instructionWrapper}>
          <Text style={styles.instructionText}>
            {faceInFrame ? STEP_COPY[challenge.step] : 'Position your face inside the frame'}
          </Text>
        </View>

        <Text style={styles.footerNote}>Front camera only · No data leaves your device</Text>
      </View>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Picks the largest detected face (by bounding-box area) as the subject to run the challenge against, so an incidental background face can't interfere. */
function pickPrimaryFace(faces: Face[]): Face | undefined {
  if (faces.length === 0) return undefined;
  return faces.reduce((largest, face) =>
    face.bounds.width * face.bounds.height > largest.bounds.width * largest.bounds.height ? face : largest,
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CornerBracket({
  position,
  color,
}: {
  position: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  color: string;
}) {
  const isTop = position.startsWith('top');
  const isLeft = position.endsWith('Left');

  const cornerStyle = {
    position: 'absolute' as const,
    top: isTop ? 0 : undefined,
    bottom: isTop ? undefined : 0,
    left: isLeft ? 0 : undefined,
    right: isLeft ? undefined : 0,
    width: BRACKET_SIZE,
    height: BRACKET_SIZE,
  };

  const hBar = {
    position: 'absolute' as const,
    top: isTop ? 0 : undefined,
    bottom: isTop ? undefined : 0,
    left: 0,
    right: 0,
    height: BRACKET_THICKNESS,
    backgroundColor: color,
    borderRadius: 2,
  };

  const vBar = {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    left: isLeft ? 0 : undefined,
    right: isLeft ? undefined : 0,
    width: BRACKET_THICKNESS,
    backgroundColor: color,
    borderRadius: 2,
  };

  return (
    <View style={cornerStyle}>
      <View style={hBar} />
      <View style={vBar} />
    </View>
  );
}

function MetaRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={metaStyles.row}>
      <Text style={metaStyles.label}>{label}</Text>
      <Text style={[metaStyles.value, highlight && metaStyles.valueHighlight]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  gateContainer: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  gateIcon: { fontSize: 52 },
  gateTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  gateBody: { fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 20 },
  grantButton: { marginTop: 8, backgroundColor: BLUE, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32 },
  grantButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  backLink: { color: '#8E8E93', fontSize: 14, marginTop: 4 },
  successContainer: { flex: 1, backgroundColor: '#0A0A0F', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  successCard: {
    width: '100%',
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.35)',
    padding: 28,
    alignItems: 'center',
    gap: 14,
  },
  successIcon: { fontSize: 56 },
  successTitle: { fontSize: 26, fontWeight: '700', color: SUCCESS, letterSpacing: -0.3 },
  successBody: { fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 20 },
  successMeta: { width: '100%', backgroundColor: '#0A0A0F', borderRadius: 12, padding: 14, gap: 10, marginTop: 4 },
  doneButton: { width: '100%', backgroundColor: SUCCESS, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  doneButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  maskLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'column' },
  maskEdgeVertical: { flex: 1, width: '100%', backgroundColor: OVERLAY_COLOR },
  maskRow: { flexDirection: 'row' },
  maskEdgeHorizontal: { flex: 1, height: '100%', backgroundColor: OVERLAY_COLOR },
  header: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomChrome: { position: 'absolute', left: 24, right: 24, alignItems: 'center', gap: 16 },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.3 },
  frameWrapper: { alignItems: 'center', justifyContent: 'center' },
  frameBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 6,
  },
  stepDots: { flexDirection: 'row', gap: 8 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  stepDotDone: { backgroundColor: SUCCESS },
  stepDotActive: { backgroundColor: BLUE, width: 20 },
  instructionWrapper: { alignItems: 'center', paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' },
  instructionText: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 22 },
  footerNote: { color: 'rgba(255,255,255,0.35)', fontSize: 11, textAlign: 'center' },
});

const metaStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, color: '#636366' },
  value: { fontSize: 13, fontWeight: '600', color: '#EBEBF5', fontFamily: 'ui-monospace' },
  valueHighlight: { color: SUCCESS },
});
