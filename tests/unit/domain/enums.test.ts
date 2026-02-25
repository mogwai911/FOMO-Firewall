import { describe, expect, it } from "vitest";
import { EventType, Role } from "@/lib/domain/enums";

describe("domain enums", () => {
  it("contains required roles and events", () => {
    expect(Role.ENG).toBe("ENG");
    expect(EventType.COMPLETED).toBe("COMPLETED");
    expect(EventType.SCHEDULED).toBe("SCHEDULED");
    expect(EventType.IGNORED).toBe("IGNORED");
  });
});
