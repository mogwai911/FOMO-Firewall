import { ItemStatus } from "@/lib/domain/enums";

interface DeriveStatusInput {
  hasTriage: boolean;
  hasIndexCard: boolean;
  hasKnowledgeCard: boolean;
  eventTypes: string[];
}

export function deriveItemStatus(input: DeriveStatusInput): ItemStatus {
  if (input.hasKnowledgeCard || input.hasIndexCard) {
    return ItemStatus.CARD_CREATED;
  }

  if (input.eventTypes.includes("COMPLETED")) {
    return ItemStatus.COMPLETED;
  }

  if (input.eventTypes.includes("SCHEDULED") || input.eventTypes.includes("REMIND_7D")) {
    return ItemStatus.SCHEDULED;
  }

  if (input.eventTypes.includes("IGNORED")) {
    return ItemStatus.IGNORED;
  }

  if (input.hasTriage) {
    return ItemStatus.TRIAGED;
  }

  return ItemStatus.NEW;
}
