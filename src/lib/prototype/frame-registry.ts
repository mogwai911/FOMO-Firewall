export const GLOBAL_NAV_ITEMS = ["Digest", "Sources", "Memory Cards"] as const;

export const REQUIRED_FRAME_IDS = [
  "Digest-Frame1",
  "Digest-Frame2",
  "Digest-Frame3",
  "Sources-Frame1",
  "Sources-Frame2",
  "Session-FrameS1",
  "Session-FrameS2",
  "Session-FrameS3",
  "Session-FrameS4",
  "Cards-FrameC1",
  "Cards-FrameC2",
  "Cards-FrameC3",
  "Cards-FrameC4",
  "Evidence-FrameE1",
  "Evidence-FrameE2"
] as const;

export const FRAME_STATE_KEYS = ["digest-empty", "triage-failed", "job-failed"] as const;

export type FrameSection = "app-shell" | "digest" | "sources" | "session" | "cards" | "evidence";

export type FrameTone = "neutral" | "ok" | "warn" | "error";

export interface FrameBlock {
  title: string;
  lines: string[];
  tone?: FrameTone;
}

export interface PrototypeFrame {
  id: (typeof REQUIRED_FRAME_IDS)[number] | "AppShell-FrameA1";
  section: FrameSection;
  summary: string;
  blocks: FrameBlock[];
}

export const FRAME_SECTION_ORDER: FrameSection[] = [
  "app-shell",
  "digest",
  "sources",
  "session",
  "cards",
  "evidence"
];

export const FRAME_SECTION_LABEL: Record<FrameSection, string> = {
  "app-shell": "App Shell",
  digest: "Digest",
  sources: "Sources",
  session: "Session",
  cards: "Memory Cards",
  evidence: "Evidence Pack"
};

export const PROTOTYPE_FRAMES: PrototypeFrame[] = [
  {
    id: "AppShell-FrameA1",
    section: "app-shell",
    summary: "Global layout with fixed 3-item nav and shared toast slot.",
    blocks: [
      {
        title: "Left navigation",
        lines: ["Digest", "Sources", "Memory Cards"]
      },
      {
        title: "Top utility rail",
        lines: ["Prototype mode badge", "Async job counter", "Toast placeholder"]
      },
      {
        title: "Rule locks",
        lines: [
          "Signal detail is drawer/expand state, not a dedicated route",
          "Evidence Pack is secondary entry from Session or Card Detail"
        ]
      }
    ]
  },
  {
    id: "Digest-Frame1",
    section: "digest",
    summary: "Collapsed list with mixed triage states and one-click FYI/DO/DROP.",
    blocks: [
      {
        title: "Header + filters",
        lines: ["Today handling", "Tabs: Pending / Processed", "Optional sort: recommendation first"]
      },
      {
        title: "Signal card A (triage pending)",
        lines: ["Badge: generating recommendation...", "Actions: FYI | DO | DROP", "Open original link"]
      },
      {
        title: "Signal card B (triage ready)",
        lines: [
          "Recommendation: DO",
          "User choice: unset",
          "Actions: FYI | DO | DROP",
          "Open detail drawer"
        ],
        tone: "ok"
      },
      {
        title: "Mandatory states",
        lines: [
          "digest-empty: Today has no fresh signals",
          "triage-failed: recommendation failed, manual FYI/DO/DROP still enabled"
        ],
        tone: "warn"
      }
    ]
  },
  {
    id: "Digest-Frame2",
    section: "digest",
    summary: "Expanded detail drawer keeps disposition actions visible for override.",
    blocks: [
      {
        title: "Drawer: headline",
        lines: ["One-line recommendation conclusion"]
      },
      {
        title: "Drawer: reasons <= 3",
        lines: [
          "Source quality and originality",
          "Verifiability and concrete data",
          "Information density"
        ]
      },
      {
        title: "Drawer: snippets <= 2",
        lines: ["Quoted excerpt 1", "Quoted excerpt 2", "Each snippet labels data origin"]
      },
      {
        title: "Drawer: next action hint",
        lines: ["DO -> enter learning session", "FYI -> keep lightweight", "DROP -> clear noise"]
      },
      {
        title: "Always-visible action row",
        lines: ["FYI", "DO", "DROP (supports override)"]
      }
    ]
  },
  {
    id: "Digest-Frame3",
    section: "digest",
    summary: "User-selected DO shows clear state and session CTA without forced redirect.",
    blocks: [
      {
        title: "Selection feedback",
        lines: ["Recommendation: DO", "You selected: DO", "EventLog persisted"]
      },
      {
        title: "CTA gate",
        lines: ["Enter learning session", "Continue session (if paused session exists)"]
      },
      {
        title: "Exit linkage",
        lines: ["After session exit, this card keeps Continue session entry"]
      }
    ]
  },
  {
    id: "Sources-Frame1",
    section: "sources",
    summary: "Source manager empty state with add form and RSS URL validation.",
    blocks: [
      {
        title: "Add source form",
        lines: ["RSS URL (required)", "Display name (optional)", "Tags (optional)", "Add button"]
      },
      {
        title: "Empty state",
        lines: ["No source yet", "Hint: add RSS to start building digest"],
        tone: "warn"
      },
      {
        title: "Validation",
        lines: ["URL required", "Parse failure hint: please check the feed link"]
      }
    ]
  },
  {
    id: "Sources-Frame2",
    section: "sources",
    summary: "List state supports enable/disable/delete and shows successful add result.",
    blocks: [
      {
        title: "List item 1",
        lines: ["Name + URL", "Toggle: enabled", "Delete action"]
      },
      {
        title: "List item 2",
        lines: ["Name + URL", "Toggle: disabled", "Delete action"]
      },
      {
        title: "Feedback",
        lines: ["Toast: source added", "New source appears immediately"],
        tone: "ok"
      }
    ]
  },
  {
    id: "Session-FrameS1",
    section: "session",
    summary: "Session entry shows signal context, question cards, and async generation panel.",
    blocks: [
      {
        title: "Header",
        lines: ["Signal title", "Source + time", "Open original", "Back to digest"]
      },
      {
        title: "Question cards",
        lines: ["3-5 suggested prompts", "Click card sends user message", "Fallback: user types directly"]
      },
      {
        title: "Chat area",
        lines: ["Welcome placeholder", "Composer + send", "Auto-save hint"]
      },
      {
        title: "Generation panel",
        lines: [
          "Generate flashcards (background)",
          "Generate evidence pack (background)",
          "Job badge placeholders: idle/queued/running/done/failed"
        ]
      }
    ]
  },
  {
    id: "Session-FrameS2",
    section: "session",
    summary: "Conversation in progress with at least two user/assistant rounds.",
    blocks: [
      {
        title: "Thread",
        lines: [
          "Round 1: user question -> assistant answer",
          "Round 2: follow-up -> assistant clarification",
          "Messages persist on each send"
        ]
      },
      {
        title: "Composer",
        lines: ["Input box", "Send button", "Typing indicator when assistant is responding"]
      },
      {
        title: "Generation panel remains actionable",
        lines: ["Flashcard and evidence actions remain visible while chatting"]
      }
    ]
  },
  {
    id: "Session-FrameS3",
    section: "session",
    summary: "Async generation runs in background while chat remains available.",
    blocks: [
      {
        title: "Flashcard job",
        lines: ["Status: queued -> running", "CTA remains non-blocking", "Toast on done"],
        tone: "ok"
      },
      {
        title: "Chat continuity",
        lines: ["User can keep sending messages", "No blocking modal", "Session stays active"]
      },
      {
        title: "Failure state",
        lines: ["job-failed: failed badge + retry action"],
        tone: "error"
      }
    ]
  },
  {
    id: "Session-FrameS4",
    section: "session",
    summary: "Exit flow pauses session and returns to Digest with recoverable context.",
    blocks: [
      {
        title: "Exit action",
        lines: ["Click Back to digest", "Session status changes active -> paused"]
      },
      {
        title: "Persistence",
        lines: ["Auto-save is default", "No completed status in MVP"]
      },
      {
        title: "Return feedback",
        lines: ["Toast: session saved, continue anytime", "Digest card shows Continue session"]
      }
    ]
  },
  {
    id: "Cards-FrameC1",
    section: "cards",
    summary: "Review mode entry with card front and swipe-like controls.",
    blocks: [
      {
        title: "Card front",
        lines: ["Question or key point title", "Source chip", "Linked signal reference"]
      },
      {
        title: "Review controls",
        lines: ["Flip", "Next", "Mark familiar", "Star (optional)"]
      }
    ]
  },
  {
    id: "Cards-FrameC2",
    section: "cards",
    summary: "Flipped card reveals concise answer while keeping review controls.",
    blocks: [
      {
        title: "Card back",
        lines: ["Answer in <= 2 sentences", "Consistency with source context"]
      },
      {
        title: "Review controls",
        lines: ["Flip back", "Next", "Mark familiar"]
      }
    ]
  },
  {
    id: "Cards-FrameC3",
    section: "cards",
    summary: "Library tab exposes search and list of generated cards.",
    blocks: [
      {
        title: "Search",
        lines: ["Keyword input", "Optional filter: source or tag"]
      },
      {
        title: "Result list",
        lines: ["Question summary", "Source", "Tap item to open detail"]
      },
      {
        title: "No results",
        lines: ["No card matched keyword"],
        tone: "warn"
      }
    ]
  },
  {
    id: "Cards-FrameC4",
    section: "cards",
    summary: "Card detail includes backlinks to Session and Evidence Pack.",
    blocks: [
      {
        title: "Card detail body",
        lines: ["Full Q/A", "Source context", "Timestamp"]
      },
      {
        title: "Backlinks",
        lines: ["Back to session", "View evidence pack (or show generating hint)"]
      }
    ]
  },
  {
    id: "Evidence-FrameE1",
    section: "evidence",
    summary: "Evidence default view keeps summary-first presentation.",
    blocks: [
      {
        title: "Summary",
        lines: ["Readable synthesis paragraph", "Light hint: full conversation is collapsible"]
      },
      {
        title: "Key quotes",
        lines: ["1-3 quoted snippets", "Each quote marks RSS or conversation source"]
      },
      {
        title: "Links",
        lines: ["1-5 supporting links"]
      },
      {
        title: "Collapsed conversation",
        lines: ["Expand full conversation"],
        tone: "warn"
      }
    ]
  },
  {
    id: "Evidence-FrameE2",
    section: "evidence",
    summary: "Expanded conversation exposes transcript slices and return path.",
    blocks: [
      {
        title: "Expanded transcript",
        lines: ["Session message snippets", "Load more (optional)"]
      },
      {
        title: "Exit path",
        lines: ["Continue in session button"]
      }
    ]
  }
];
