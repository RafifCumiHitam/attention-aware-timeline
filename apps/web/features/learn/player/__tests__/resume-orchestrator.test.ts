/**
 * Sprint 20.2 — VideoController + ResumeOrchestrator unit tests
 * Run: npx tsx features/learn/player/__tests__/resume-orchestrator.test.ts
 */

import type { VideoController } from "../video-controller";
import { ResumeOrchestrator, resumeCommandFromContext } from "../resume-orchestrator";
import type { InterventionContext } from "../../clickstream/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

class FakeController implements VideoController {
  readonly videoId: string;
  time = 0;
  rate = 1;
  ready = true;
  paused = true;
  seekCalls: number[] = [];
  playCalls = 0;
  pauseCalls = 0;

  constructor(videoId: string) {
    this.videoId = videoId;
  }

  isReady() {
    return this.ready;
  }
  getCurrentTime() {
    return this.time;
  }
  getDuration() {
    return 600;
  }
  getPlaybackRate() {
    return this.rate;
  }
  async seekTo(seconds: number) {
    this.seekCalls.push(seconds);
    this.time = seconds;
  }
  async play() {
    this.playCalls += 1;
    this.paused = false;
  }
  async pause() {
    this.pauseCalls += 1;
    this.paused = true;
  }
  async setPlaybackRate(rate: number) {
    this.rate = rate;
  }
}

async function main() {
  console.log("\n=== Sprint 20.2 resume orchestrator tests ===\n");

  const videoA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const videoB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const session = "ssssssss-ssss-4sss-8sss-ssssssssssss";

  const fake = new FakeController(videoA);
  const orch = new ResumeOrchestrator({
    sessionId: session,
    videoId: videoA,
    getController: () => fake,
  });

  // 1–3 pause / seek / play
  console.log("basic resume");
  const r1 = await orch.resume({
    sessionId: session,
    videoId: videoA,
    resumeTimestamp: 120,
    playAfterSeek: true,
  });
  assert(r1.ok === true, "resume ok");
  assert(fake.pauseCalls >= 1, "pause called");
  assert(fake.seekCalls[0] === 120, "seek to 120");
  assert(fake.playCalls >= 1, "play called");
  assert(fake.getCurrentTime() === 120, "current time 120");

  // 4 resume timestamp from context
  console.log("command from context");
  const ctx: InterventionContext = {
    sessionId: session,
    videoId: videoA,
    moduleId: null,
    experimentCondition: "EXPERIMENTAL",
    state: "REMEDIAL_ACTIVE",
    isRemedialActive: true,
    interventionZoneId: 12,
    resumeTimestamp: 120,
    interventionTimestamp: 120,
    cooldownUntilMs: null,
    lastAttention: 0.2,
  };
  const cmd = resumeCommandFromContext(ctx);
  assert(cmd != null && cmd.resumeTimestamp === 120, "ctx resume 120");

  // 5 wrong video ignored
  console.log("session safety");
  const rWrong = await orch.resume({
    sessionId: session,
    videoId: videoB,
    resumeTimestamp: 50,
  });
  assert(rWrong.ok === false && rWrong.reason === "wrong_video", "wrong video rejected");

  // 6 stale session
  const rStale = await orch.resume({
    sessionId: "other-session",
    videoId: videoA,
    resumeTimestamp: 50,
  });
  assert(rStale.ok === false && rStale.reason === "stale_session", "stale session rejected");

  // rebind invalidates
  orch.rebind(session, videoB);
  const rAfterRebind = await orch.resume({
    sessionId: session,
    videoId: videoA,
    resumeTimestamp: 10,
  });
  assert(
    rAfterRebind.ok === false && rAfterRebind.reason === "wrong_video",
    "after rebind old video rejected"
  );

  // 7 multiple resume requests serialize
  console.log("multiple resumes");
  orch.rebind(session, videoA);
  const fake2 = new FakeController(videoA);
  const orch2 = new ResumeOrchestrator({
    sessionId: session,
    videoId: videoA,
    getController: () => fake2,
  });
  const p1 = orch2.resume({ sessionId: session, videoId: videoA, resumeTimestamp: 10 });
  const p2 = orch2.resume({ sessionId: session, videoId: videoA, resumeTimestamp: 20 });
  const [a, b] = await Promise.all([p1, p2]);
  assert(a.ok && b.ok, "both resumes eventually ok");
  assert(fake2.seekCalls.includes(20), "latest seek 20 present");

  // rate control via contract
  await fake2.setPlaybackRate(0.8);
  assert(fake2.getPlaybackRate() === 0.8, "setPlaybackRate works");

  console.log("\nAll Sprint 20.2 tests passed.\n");
}

void main();
