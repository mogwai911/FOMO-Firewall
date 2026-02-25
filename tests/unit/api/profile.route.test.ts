import { describe, expect, it, vi } from "vitest";
import {
  createProfileGetHandler,
  createProfilePostHandler
} from "@/app/api/profile/route";

describe("/api/profile", () => {
  it("returns ENG defaults when profile is missing", async () => {
    const findProfile = vi.fn().mockResolvedValue(null);
    const handler = createProfileGetHandler({ findProfile } as any);

    const res = await handler(new Request("http://localhost/api/profile"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      role: "ENG",
      timeBudgetMinutes: null,
      hypeWords: []
    });
    expect(findProfile).toHaveBeenCalledTimes(1);
  });

  it("upserts role and optional preferences for single-user profile", async () => {
    const findProfile = vi.fn().mockResolvedValue({
      id: "profile-1",
      role: "ENG",
      timeBudgetMinutes: null,
      hypeWords: null
    });
    const updateProfile = vi.fn().mockResolvedValue({
      id: "profile-1",
      role: "PM",
      timeBudgetMinutes: 45,
      hypeWords: '["ai","breaking"]'
    });
    const createProfile = vi.fn();

    const handler = createProfilePostHandler({
      findProfile,
      updateProfile,
      createProfile
    } as any);

    const req = new Request("http://localhost/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role: "PM",
        timeBudgetMinutes: 45,
        hypeWords: ["ai", "breaking"]
      })
    });

    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(updateProfile).toHaveBeenCalledWith("profile-1", {
      role: "PM",
      timeBudgetMinutes: 45,
      hypeWords: '["ai","breaking"]'
    });
    expect(createProfile).not.toHaveBeenCalled();
    expect(json).toEqual({
      role: "PM",
      timeBudgetMinutes: 45,
      hypeWords: ["ai", "breaking"]
    });
  });

  it("returns 400 for invalid payload", async () => {
    const handler = createProfilePostHandler({
      findProfile: vi.fn(),
      createProfile: vi.fn(),
      updateProfile: vi.fn()
    } as any);

    const req = new Request("http://localhost/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "INVALID" })
    });

    const res = await handler(req);
    expect(res.status).toBe(400);
  });
});
