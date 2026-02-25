import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

import HomePage from "@/app/page";
import AppIndexPage from "@/app/app/page";
import LegacyDigestPage from "@/app/digest/page";
import LegacyCardsPage from "@/app/cards/page";
import LegacySettingsPage from "@/app/settings/page";
import LegacySourcesPage from "@/app/sources/page";
import LegacySessionPage from "@/app/session/[sessionId]/page";

describe("legacy route redirects", () => {
  beforeEach(() => {
    redirectMock.mockReset();
  });

  it("redirects top-level home to /app/digest", () => {
    HomePage();
    expect(redirectMock).toHaveBeenCalledWith("/app/digest");
  });

  it("redirects /app to /app/digest", () => {
    AppIndexPage();
    expect(redirectMock).toHaveBeenCalledWith("/app/digest");
  });

  it("redirects legacy digest/cards/settings/sources routes", () => {
    LegacyDigestPage();
    expect(redirectMock).toHaveBeenCalledWith("/app/digest");

    LegacyCardsPage();
    expect(redirectMock).toHaveBeenCalledWith("/app/cards");

    LegacySettingsPage();
    expect(redirectMock).toHaveBeenCalledWith("/app/settings");

    LegacySourcesPage();
    expect(redirectMock).toHaveBeenCalledWith("/app/sources");
  });

  it("redirects legacy session detail to app session detail", async () => {
    await LegacySessionPage({
      params: Promise.resolve({ sessionId: "session-123" })
    });
    expect(redirectMock).toHaveBeenCalledWith("/app/session/session-123");
  });
});
