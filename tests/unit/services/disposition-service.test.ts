import { describe, expect, it, vi } from "vitest";
import {
  DispositionServiceError,
  isDispositionLabel,
  setSignalDisposition
} from "@/lib/services/disposition-service";

describe("disposition-service", () => {
  it("validates disposition labels", () => {
    expect(isDispositionLabel("FYI")).toBe(true);
    expect(isDispositionLabel("DO")).toBe(true);
    expect(isDispositionLabel("DROP")).toBe(true);
    expect(isDispositionLabel("OTHER")).toBe(false);
  });

  it("upserts disposition for a signal", async () => {
    const deps = {
      findSignal: vi.fn().mockResolvedValue({ id: "sig-1" }),
      findDisposition: vi.fn().mockResolvedValue(null),
      upsertDisposition: vi.fn().mockResolvedValue({
        id: "disp-1",
        signalId: "sig-1",
        label: "DO",
        isOverride: true,
        updatedAt: new Date("2026-02-20T00:00:00.000Z")
      }),
      recordEvent: vi.fn()
    };

    const out = await setSignalDisposition(
      {
        signalId: "sig-1",
        label: "DO"
      },
      deps as any
    );

    expect(deps.upsertDisposition).toHaveBeenCalledWith({
      signalId: "sig-1",
      label: "DO",
      isOverride: true
    });
    expect(deps.recordEvent).toHaveBeenCalledWith({
      type: "DISPOSITION_SET",
      signalId: "sig-1",
      payloadJson: {
        fromLabel: null,
        toLabel: "DO",
        isOverride: true
      }
    });
    expect(out.label).toBe("DO");
  });

  it("records override event when disposition changes", async () => {
    const deps = {
      findSignal: vi.fn().mockResolvedValue({ id: "sig-1" }),
      findDisposition: vi.fn().mockResolvedValue({
        label: "FYI"
      }),
      upsertDisposition: vi.fn().mockResolvedValue({
        id: "disp-1",
        signalId: "sig-1",
        label: "DO",
        isOverride: true,
        updatedAt: new Date("2026-02-20T00:00:00.000Z")
      }),
      recordEvent: vi.fn()
    };

    await setSignalDisposition(
      {
        signalId: "sig-1",
        label: "DO"
      },
      deps as any
    );

    expect(deps.recordEvent).toHaveBeenCalledWith({
      type: "DISPOSITION_CHANGED",
      signalId: "sig-1",
      payloadJson: {
        fromLabel: "FYI",
        toLabel: "DO",
        isOverride: true
      }
    });
  });

  it("throws SIGNAL_NOT_FOUND when signal does not exist", async () => {
    const deps = {
      findSignal: vi.fn().mockResolvedValue(null),
      findDisposition: vi.fn(),
      upsertDisposition: vi.fn(),
      recordEvent: vi.fn()
    };

    await expect(
      setSignalDisposition(
        {
          signalId: "missing",
          label: "FYI"
        },
        deps as any
      )
    ).rejects.toMatchObject({ code: "SIGNAL_NOT_FOUND" } as DispositionServiceError);
  });
});
