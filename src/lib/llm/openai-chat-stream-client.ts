export type LlmStreamErrorCode =
  | "LLM_CONFIG_MISSING"
  | "LLM_REQUEST_FAILED"
  | "LLM_STREAM_PARSE_FAILED";

export class LlmStreamError extends Error {
  code: LlmStreamErrorCode;
  status?: number;

  constructor(code: LlmStreamErrorCode, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface OpenAIChatStreamMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamChatCompletionsInput {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: OpenAIChatStreamMessage[];
  signal?: AbortSignal;
}

interface OpenAIStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
    };
  }>;
}

function isMissing(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

export function buildChatEndpoint(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  if (normalized.endsWith("/chat/completions")) {
    return normalized;
  }
  return `${normalized}/chat/completions`;
}

function parseDataLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) {
    return null;
  }
  return trimmed.slice("data:".length).trim();
}

function readContentDelta(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const typed = payload as OpenAIStreamChunk;
  const content = typed.choices?.[0]?.delta?.content;
  if (typeof content === "string" && content.length > 0) {
    return content;
  }
  return null;
}

export async function* streamChatCompletions(
  input: StreamChatCompletionsInput,
  fetchImpl: typeof fetch = fetch
): AsyncGenerator<string> {
  if (isMissing(input.baseUrl) || isMissing(input.apiKey) || isMissing(input.model)) {
    throw new LlmStreamError("LLM_CONFIG_MISSING", "llm config missing");
  }

  const response = await fetchImpl(buildChatEndpoint(input.baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${input.apiKey}`
    },
    body: JSON.stringify({
      model: input.model,
      stream: true,
      messages: input.messages
    }),
    signal: input.signal
  });

  if (!response.ok) {
    throw new LlmStreamError(
      "LLM_REQUEST_FAILED",
      `llm request failed: ${response.status}`,
      response.status
    );
  }

  if (!response.body) {
    throw new LlmStreamError("LLM_STREAM_PARSE_FAILED", "llm stream body missing");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const processLine = async function* (line: string): AsyncGenerator<string> {
    const data = parseDataLine(line);
    if (!data) {
      return;
    }
    if (data === "[DONE]") {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      throw new LlmStreamError("LLM_STREAM_PARSE_FAILED", "invalid llm stream payload");
    }

    const delta = readContentDelta(parsed);
    if (delta) {
      yield delta;
    }
  };

  let doneFlag = false;
  while (!doneFlag) {
    const { value, done } = await reader.read();
    if (done) {
      doneFlag = true;
      buffer += decoder.decode();
    } else if (value) {
      buffer += decoder.decode(value, { stream: true });
    }

    let lineBreak = buffer.indexOf("\n");
    while (lineBreak !== -1) {
      const rawLine = buffer.slice(0, lineBreak).replace(/\r$/, "");
      buffer = buffer.slice(lineBreak + 1);

      const data = parseDataLine(rawLine);
      if (data === "[DONE]") {
        return;
      }

      for await (const delta of processLine(rawLine)) {
        yield delta;
      }

      lineBreak = buffer.indexOf("\n");
    }
  }

  const finalLine = buffer.trim();
  if (finalLine.length > 0) {
    if (parseDataLine(finalLine) === "[DONE]") {
      return;
    }

    for await (const delta of processLine(finalLine)) {
      yield delta;
    }
  }
}
