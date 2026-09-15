/**
 * src/core/camera/livenessChallenge.ts
 *
 * A directional head-turn challenge, loosely modeled on how Face ID
 * enrollment moves you through a sequence ("look straight, then turn your
 * head") — built on real face-detection output (Google ML Kit, via
 * `react-native-vision-camera-face-detector`), not a pixel heuristic.
 *
 * Why a sequence, and not just "is a face present": a single frame showing
 * a face proves very little — a printed photo shows a face too. Requiring
 * the SAME tracked face to move through a specific sequence of head angles,
 * continuously, without ever losing track of it, is what actually makes
 * this a liveness check: trivial for a person looking at their phone, much
 * harder to satisfy by holding up a static photo.
 *
 * This file is intentionally UI-free and React-free — it's a pure function
 * (current state + a face reading + a timestamp → next state), so it's easy
 * to reason about independent of the camera/UI plumbing in LivenessScreen.
 *
 * Caveat worth stating plainly: this is a basic directional challenge, not
 * a certified anti-spoofing system. It doesn't do depth sensing or texture
 * analysis (a video of a person turning their head, played back, could
 * still pass). A production liveness product combines several such signals
 * and validates them server-side.
 */

export type FaceReading = {
  /** Google ML Kit's per-face tracking ID — requires `trackingEnabled`. Stable across frames for the *same* physical face; a new value means detection picked up a different face (or the same one re-appearing after being lost). */
  trackingId: number | undefined;
  /** Head rotation around the vertical axis, in degrees. Sign convention isn't assumed — only relative direction (does it flip?) matters here. */
  yawAngle: number;
  leftEyeOpenProbability: number | undefined;
  rightEyeOpenProbability: number | undefined;
};

export type ChallengeStep =
  | 'center' // waiting for a centered, eyes-open, forward-facing look
  | 'turnOne' // waiting for the first head turn (either direction)
  | 'turnOther' // waiting for a turn in the OPPOSITE direction from turnOne
  | 'confirmed';

export type ChallengeState = {
  step: ChallengeStep;
  /** trackingId of the face we're currently following — losing it (beyond the grace period below) resets the challenge. */
  trackingId: number | undefined;
  /** Timestamp (ms) the current step's condition has been continuously true since, or null while it isn't currently true. */
  conditionHoldStartedAt: number | null;
  /** Sign of the first turn (+1/-1), recorded so `turnOther` can require the opposite direction. */
  firstTurnSign: 1 | -1 | null;
  /** Timestamp (ms) of the most recent frame that DID see our tracked face, or null before one ever has. Drives the grace period below — real-time on-device detection misses the occasional frame (motion blur, a blink, a slightly turned head) even with a face clearly present, so a single missed frame shouldn't nuke the user's progress. */
  lastFaceSeenAt: number | null;
};

export const INITIAL_CHALLENGE_STATE: ChallengeState = {
  step: 'center',
  trackingId: undefined,
  conditionHoldStartedAt: null,
  firstTurnSign: null,
  lastFaceSeenAt: null,
};

/** Degrees of yaw still considered "looking straight ahead". */
const CENTER_YAW_TOLERANCE = 10;
/** Degrees of yaw that counts as a deliberate head turn. */
const TURN_THRESHOLD = 18;
/** ML Kit eye-open probability (0-1) floor to count as "eyes open". */
const EYES_OPEN_THRESHOLD = 0.4;
/** How long a step's condition must hold continuously before advancing — long enough to filter out a single noisy frame, short enough to feel responsive. */
const HOLD_DURATION_MS = 450;
/**
 * How long we tolerate the face detector reporting *no* face before treating
 * the subject as actually gone and resetting the challenge. Without this,
 * a single dropped/missed frame — normal, expected behavior for a real-time
 * on-device detector, and more frequent than you'd think under load — would
 * reset all progress immediately, which reads as constant flicker between
 * "step 2" and "start over."
 */
const FACE_LOST_GRACE_MS = 600;

function isEyesOpen(face: FaceReading): boolean {
  const { leftEyeOpenProbability: l, rightEyeOpenProbability: r } = face;
  // Classification wasn't requested/available — don't block progress on data we don't have.
  if (l == null || r == null) return true;
  return l >= EYES_OPEN_THRESHOLD && r >= EYES_OPEN_THRESHOLD;
}

function stepCondition(step: ChallengeStep, face: FaceReading, firstTurnSign: 1 | -1 | null): boolean {
  switch (step) {
    case 'center':
      return Math.abs(face.yawAngle) <= CENTER_YAW_TOLERANCE && isEyesOpen(face);
    case 'turnOne':
      return Math.abs(face.yawAngle) >= TURN_THRESHOLD;
    case 'turnOther':
      return Math.abs(face.yawAngle) >= TURN_THRESHOLD && Math.sign(face.yawAngle) !== firstTurnSign;
    case 'confirmed':
      return true;
  }
}

/**
 * Advances (or resets) the challenge given the latest face reading.
 * Pass `face: undefined` when no face is currently detected in frame.
 */
export function advanceLivenessChallenge(
  state: ChallengeState,
  face: FaceReading | undefined,
  now: number,
): ChallengeState {
  if (state.step === 'confirmed') return state;

  if (!face) {
    // No face this frame. Only treat the subject as actually gone — and
    // reset — once we've gone without one for longer than the grace
    // period; a brief gap just pauses the current hold timer in place.
    const missingSince = state.lastFaceSeenAt;
    const goneTooLong = missingSince == null || now - missingSince > FACE_LOST_GRACE_MS;
    if (goneTooLong) {
      return { ...INITIAL_CHALLENGE_STATE };
    }
    return { ...state, conditionHoldStartedAt: null };
  }

  // The tracker picking up a *different* face mid-challenge means we can no
  // longer vouch this is the same continuous, live subject — start over.
  // This is what defeats "show a face, then swap to something else" and
  // the earlier "ceiling still passes" bug. Unlike a momentary detection
  // gap, this is an immediate reset: it's a real signal, not noise.
  const faceChanged = state.trackingId != null && face.trackingId !== state.trackingId;
  if (faceChanged) {
    return { ...INITIAL_CHALLENGE_STATE, trackingId: face.trackingId, lastFaceSeenAt: now };
  }

  const trackingId = state.trackingId ?? face.trackingId;
  const conditionMet = stepCondition(state.step, face, state.firstTurnSign);

  if (!conditionMet) {
    return { ...state, trackingId, conditionHoldStartedAt: null, lastFaceSeenAt: now };
  }

  const holdStartedAt = state.conditionHoldStartedAt ?? now;
  if (now - holdStartedAt < HOLD_DURATION_MS) {
    return { ...state, trackingId, conditionHoldStartedAt: holdStartedAt, lastFaceSeenAt: now };
  }

  // Condition satisfied for long enough — advance to the next step.
  switch (state.step) {
    case 'center':
      return { step: 'turnOne', trackingId, conditionHoldStartedAt: null, firstTurnSign: null, lastFaceSeenAt: now };
    case 'turnOne':
      return {
        step: 'turnOther',
        trackingId,
        conditionHoldStartedAt: null,
        firstTurnSign: Math.sign(face.yawAngle) as 1 | -1,
        lastFaceSeenAt: now,
      };
    case 'turnOther':
      return {
        step: 'confirmed',
        trackingId,
        conditionHoldStartedAt: null,
        firstTurnSign: state.firstTurnSign,
        lastFaceSeenAt: now,
      };
  }
}
