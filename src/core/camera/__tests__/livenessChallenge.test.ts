/**
 * livenessChallenge.test.ts — Unit tests for the liveness state machine
 *
 * This file tests advanceLivenessChallenge() as a pure function:
 *   (currentState, faceReading, timestamp) → nextState
 *
 * Because the function is pure (no side effects, no React, no camera),
 * these tests are fast, deterministic, and don't require any mocks.
 * We construct FaceReading objects inline and control `now` timestamps
 * manually to simulate time passing.
 */

import {
  advanceLivenessChallenge,
  INITIAL_CHALLENGE_STATE,
  type ChallengeState,
  type FaceReading,
} from '@/core/camera/livenessChallenge';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** A face looking straight ahead, eyes open — passes the 'center' step. */
function centeredFace(trackingId = 1): FaceReading {
  return {
    trackingId,
    yawAngle: 0,
    leftEyeOpenProbability: 0.95,
    rightEyeOpenProbability: 0.95,
  };
}

/** A face turned significantly to the right (positive yaw). */
function turnedRight(trackingId = 1): FaceReading {
  return {
    trackingId,
    yawAngle: 25,
    leftEyeOpenProbability: 0.9,
    rightEyeOpenProbability: 0.9,
  };
}

/** A face turned significantly to the left (negative yaw). */
function turnedLeft(trackingId = 1): FaceReading {
  return {
    trackingId,
    yawAngle: -25,
    leftEyeOpenProbability: 0.9,
    rightEyeOpenProbability: 0.9,
  };
}

/**
 * Simulates feeding the same face reading into the state machine
 * for `durationMs` with the given `intervalMs` between frames.
 * Returns the final state.
 */
function holdFace(
  initialState: ChallengeState,
  face: FaceReading,
  startTime: number,
  durationMs: number,
  intervalMs = 100,
): ChallengeState {
  let state = initialState;
  let t = startTime;
  const endTime = startTime + durationMs;
  while (t <= endTime) {
    state = advanceLivenessChallenge(state, face, t);
    t += intervalMs;
  }
  return state;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('advanceLivenessChallenge()', () => {
  const T0 = 1000; // arbitrary start timestamp

  it('starts at the center step', () => {
    expect(INITIAL_CHALLENGE_STATE.step).toBe('center');
    expect(INITIAL_CHALLENGE_STATE.trackingId).toBeUndefined();
  });

  // ── Center step ─────────────────────────────────────────────────────────

  it('advances from center → turnOne after holding a centered face', () => {
    const state = holdFace(INITIAL_CHALLENGE_STATE, centeredFace(), T0, 500);
    expect(state.step).toBe('turnOne');
  });

  it('does NOT advance center if the face is off-center', () => {
    const state = holdFace(INITIAL_CHALLENGE_STATE, turnedRight(), T0, 1000);
    expect(state.step).toBe('center');
  });

  it('does NOT advance center if eyes are closed', () => {
    const closedEyes: FaceReading = {
      ...centeredFace(),
      leftEyeOpenProbability: 0.1,
      rightEyeOpenProbability: 0.1,
    };
    const state = holdFace(INITIAL_CHALLENGE_STATE, closedEyes, T0, 1000);
    expect(state.step).toBe('center');
  });

  it('does not advance center before the hold duration elapses', () => {
    // Only hold for 200ms — less than the 450ms requirement
    const state = holdFace(INITIAL_CHALLENGE_STATE, centeredFace(), T0, 200);
    expect(state.step).toBe('center');
  });

  // ── Turn steps ──────────────────────────────────────────────────────────

  it('advances turnOne → turnOther when a right turn is held', () => {
    // First get past center
    let state = holdFace(INITIAL_CHALLENGE_STATE, centeredFace(), T0, 500);
    expect(state.step).toBe('turnOne');

    // Now turn right
    state = holdFace(state, turnedRight(), T0 + 600, 500);
    expect(state.step).toBe('turnOther');
    expect(state.firstTurnSign).toBe(1); // positive = right
  });

  it('advances turnOther → confirmed when the opposite turn is held', () => {
    // center → turnOne
    let state = holdFace(INITIAL_CHALLENGE_STATE, centeredFace(), T0, 500);
    // turnOne → turnOther (turn right first)
    state = holdFace(state, turnedRight(), T0 + 600, 500);
    expect(state.step).toBe('turnOther');
    // turnOther → confirmed (now turn left — opposite direction)
    state = holdFace(state, turnedLeft(), T0 + 1200, 500);
    expect(state.step).toBe('confirmed');
  });

  it('does NOT advance turnOther when turning the same direction', () => {
    // center → turnOne → turnOther (turned right)
    let state = holdFace(INITIAL_CHALLENGE_STATE, centeredFace(), T0, 500);
    state = holdFace(state, turnedRight(), T0 + 600, 500);
    expect(state.firstTurnSign).toBe(1);

    // Try turning right AGAIN — same direction, should not advance
    state = holdFace(state, turnedRight(), T0 + 1200, 1000);
    expect(state.step).toBe('turnOther'); // stuck
  });

  // ── Face tracking ───────────────────────────────────────────────────────

  it('resets immediately when a different face appears mid-challenge', () => {
    // Build up to turnOne with trackingId=1
    let state = holdFace(INITIAL_CHALLENGE_STATE, centeredFace(1), T0, 500);
    expect(state.step).toBe('turnOne');

    // A different person (trackingId=99) appears
    state = advanceLivenessChallenge(state, centeredFace(99), T0 + 600);
    expect(state.step).toBe('center'); // reset
    expect(state.trackingId).toBe(99); // now tracking the new face
  });

  it('resets to initial state when face is lost beyond the grace period', () => {
    let state = holdFace(INITIAL_CHALLENGE_STATE, centeredFace(), T0, 500);
    expect(state.step).toBe('turnOne');

    // No face detected for 700ms (beyond the 600ms grace period)
    state = advanceLivenessChallenge(state, undefined, T0 + 600);
    // Still within grace at +600
    state = advanceLivenessChallenge(state, undefined, T0 + 1300);
    // Now beyond grace
    expect(state.step).toBe('center');
    expect(state.trackingId).toBeUndefined();
  });

  it('preserves state when face is briefly lost within the grace period', () => {
    let state = holdFace(INITIAL_CHALLENGE_STATE, centeredFace(), T0, 500);
    expect(state.step).toBe('turnOne');

    // Face lost for just 200ms (within the 600ms grace period)
    state = advanceLivenessChallenge(state, undefined, T0 + 600);
    expect(state.step).toBe('turnOne'); // still here!
    expect(state.trackingId).toBe(1); // still tracking

    // Face comes back — should continue from turnOne, not restart
    state = holdFace(state, turnedRight(), T0 + 700, 500);
    expect(state.step).toBe('turnOther'); // successfully advanced
  });

  // ── Terminal state ──────────────────────────────────────────────────────

  it('confirmed state is terminal — further calls are no-ops', () => {
    // Run the full challenge
    let state = holdFace(INITIAL_CHALLENGE_STATE, centeredFace(), T0, 500);
    state = holdFace(state, turnedRight(), T0 + 600, 500);
    state = holdFace(state, turnedLeft(), T0 + 1200, 500);
    expect(state.step).toBe('confirmed');

    // Try to feed more data — should be ignored
    const frozen = advanceLivenessChallenge(state, centeredFace(), T0 + 5000);
    expect(frozen).toBe(state); // exact same reference — no mutation
  });
});
