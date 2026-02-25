import { describe, expect, it } from "vitest";
import {
  FRAME_STATE_KEYS,
  GLOBAL_NAV_ITEMS,
  PROTOTYPE_FRAMES,
  REQUIRED_FRAME_IDS
} from "@/lib/prototype/frame-registry";

describe("prototype frame registry", () => {
  it("keeps top-level navigation locked to 3 entries", () => {
    expect(GLOBAL_NAV_ITEMS).toEqual(["Digest", "Sources", "Memory Cards"]);
  });

  it("covers every required wireframe id", () => {
    const frameIds = PROTOTYPE_FRAMES.map((frame) => frame.id);

    expect(new Set(frameIds).size).toBe(PROTOTYPE_FRAMES.length);
    expect(frameIds).toEqual(expect.arrayContaining(REQUIRED_FRAME_IDS));
  });

  it("tracks mandatory system states", () => {
    expect(FRAME_STATE_KEYS).toEqual(
      expect.arrayContaining(["digest-empty", "triage-failed", "job-failed"])
    );
  });
});
