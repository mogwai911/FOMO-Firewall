import { ingestSignalsFromEnabledSources } from "@/lib/services/signal-ingest";

interface RssFetchRouteDeps {
  runIngestion: typeof ingestSignalsFromEnabledSources;
}

export function createRssFetchPostHandler(
  deps: RssFetchRouteDeps = {
    runIngestion: ingestSignalsFromEnabledSources
  }
) {
  return async function POST(): Promise<Response> {
    try {
      const summary = await deps.runIngestion();
      return Response.json({
        ok: true,
        summary
      });
    } catch {
      return Response.json({ error: "RSS_FETCH_FAILED" }, { status: 500 });
    }
  };
}

export const POST = createRssFetchPostHandler();
