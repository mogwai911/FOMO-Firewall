import { describe, expect, it } from "vitest";
import { APP_NAME } from "@/lib/constants";

describe("constants", () => {
  it("exposes app name", () => {
    expect(APP_NAME).toBe("FOMO Firewall");
  });
});
