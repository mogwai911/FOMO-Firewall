import { beforeEach, describe, expect, it } from "vitest";
import { getMockState, mockActions } from "@/lib/mockStore";

describe("digest source binding with settings", () => {
  beforeEach(() => {
    mockActions.reset();
  });

  it("updates digest signal sources after adding rss source in settings", () => {
    const before = getMockState();
    expect(before.settings.rssSources).toHaveLength(0);

    const created = mockActions.addRssSource({
      url: "https://example.com/rss.xml",
      name: "Example Feed",
      tags: ["ai"]
    });
    expect(created.ok).toBe(true);

    const after = getMockState();
    expect(after.settings.rssSources).toHaveLength(1);
    expect(after.settings.rssSources[0]?.name).toBe("Example Feed");
    expect(after.signals.length).toBeGreaterThan(0);
    expect(after.signals.every((signal) => signal.source === "Example Feed")).toBe(true);
  });
});
