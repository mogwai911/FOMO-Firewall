import { describe, expect, it } from "vitest";
import {
  canCreateKnowledgeCard,
  hasCompletedEvidence
} from "@/lib/services/knowledge-gate";

describe("knowledge gate", () => {
  it("blocks when there is no completed event", () => {
    const events = [{ type: "SCHEDULED", payload: {} }];
    expect(hasCompletedEvidence(events)).toBe(false);
    expect(canCreateKnowledgeCard(events)).toBe(false);
  });

  it("blocks when completed event has no evidence", () => {
    const events = [{ type: "COMPLETED", payload: {} }];
    expect(hasCompletedEvidence(events)).toBe(false);
    expect(canCreateKnowledgeCard(events)).toBe(false);
  });

  it("allows creation when artifact link exists", () => {
    const events = [{ type: "COMPLETED", payload: { artifact_link: "https://example.com/note" } }];
    expect(hasCompletedEvidence(events)).toBe(true);
    expect(canCreateKnowledgeCard(events)).toBe(true);
  });

  it("allows creation when reflection text length is at least 50", () => {
    const events = [{
      type: "COMPLETED",
      payload: {
        reflection_text: "01234567890123456789012345678901234567890123456789"
      }
    }];
    expect(hasCompletedEvidence(events)).toBe(true);
    expect(canCreateKnowledgeCard(events)).toBe(true);
  });

  it("allows creation when done checklist is true", () => {
    const events = [{ type: "COMPLETED", payload: { done_checklist: true } }];
    expect(hasCompletedEvidence(events)).toBe(true);
    expect(canCreateKnowledgeCard(events)).toBe(true);
  });
});
