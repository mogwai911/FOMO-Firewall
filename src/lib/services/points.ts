export interface PointDeltaInput {
  eventType: string;
  itemId: string;
  dateKey: string;
  isHighNoise: boolean;
  createdKnowledgeCard: boolean;
  dedupeStore: Set<string>;
}

function addIfNewKey(store: Set<string>, key: string, delta: number): number {
  if (store.has(key)) {
    return 0;
  }
  store.add(key);
  return delta;
}

export function calcPointDelta(input: PointDeltaInput): number {
  if (
    (input.eventType === "SCHEDULED" || input.eventType === "IGNORED") &&
    input.isHighNoise
  ) {
    const key = `${input.itemId}:CALM_POINT:${input.dateKey}`;
    return addIfNewKey(input.dedupeStore, key, 1);
  }

  if (input.eventType === "COMPLETED" && input.createdKnowledgeCard) {
    const key = `${input.itemId}:GROWTH_POINT:${input.dateKey}`;
    return addIfNewKey(input.dedupeStore, key, 2);
  }

  return 0;
}
