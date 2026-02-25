"use client";

import { useEffect } from "react";

export function shouldRunScheduleTick(
  doc: Pick<Document, "visibilityState"> | null | undefined
): boolean {
  if (!doc) {
    return true;
  }
  return doc.visibilityState !== "hidden";
}

export async function runScheduleTickRequest(
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  try {
    const response = await fetchImpl("/api/jobs/schedule_tick", {
      method: "POST"
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function SchedulerHeartbeat({ intervalMs = 60_000 }: { intervalMs?: number }) {
  useEffect(() => {
    let inFlight = false;
    const timer = window.setInterval(() => {
      if (inFlight || !shouldRunScheduleTick(document)) {
        return;
      }
      inFlight = true;
      void runScheduleTickRequest().finally(() => {
        inFlight = false;
      });
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [intervalMs]);

  return null;
}
