export interface EventLike {
  type: string;
  payload?: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasEvidence(payload: unknown): boolean {
  if (!isObject(payload)) {
    return false;
  }

  const artifact = payload.artifact_link;
  if (typeof artifact === "string" && artifact.trim().length > 0) {
    return true;
  }

  const reflection = payload.reflection_text;
  if (typeof reflection === "string" && reflection.length >= 50) {
    return true;
  }

  return payload.done_checklist === true;
}

export function hasCompletedEvidence(events: EventLike[]): boolean {
  return events.some((event) => event.type === "COMPLETED" && hasEvidence(event.payload));
}

export function canCreateKnowledgeCard(events: EventLike[]): boolean {
  return hasCompletedEvidence(events);
}
