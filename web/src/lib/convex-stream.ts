import { type StreamFn } from "@mariozechner/pi-agent-core";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ChatPayload } from "@/lib/pi-shell";

type Model = {
  api: string;
  provider: string;
  id: string;
};

type StopReason = "stop" | "length" | "tool-calls" | "error" | "aborted";

interface AssistantMessage {
  role: "assistant";
  content: Array<{
    type: "text";
    text: string;
    [key: string]: unknown;
  }>;
  api: string;
  provider: string;
  model: string;
  usage: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    totalTokens: number;
    cost: {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
      total: number;
    };
  };
  stopReason: StopReason;
  timestamp: number;
}

interface AssistantEvent {
  type: string;
  contentIndex?: number;
  partial?: AssistantMessage;
  delta?: string;
  content?: string;
  message?: AssistantMessage;
  reason?: StopReason;
  error?: AssistantMessage;
}

function createAssistantMessageEventStream() {
	const events: AssistantEvent[] = [];
	let finalResult: AssistantMessage | null = null;
	let resolveFinal: ((msg: AssistantMessage) => void) | null = null;
	const finalPromise = new Promise<AssistantMessage>((resolve) => {
		resolveFinal = resolve;
	});

	return {
		push(event: AssistantEvent) {
			events.push(event);
			if ((event.type === "done" && event.message) || (event.type === "error" && event.error)) {
				finalResult = (event.type === "done" ? event.message : event.error) as AssistantMessage;
				resolveFinal?.(finalResult);
			}
		},
		async *[Symbol.asyncIterator]() {
			for (const event of events) {
				yield event;
			}
		},
		result(): Promise<AssistantMessage> {
			if (finalResult) return Promise.resolve(finalResult);
			return finalPromise;
		},
	};
}

export interface RenderPayload {
  status: ChatPayload["status"] | "error";
  command: string;
  tone: ChatPayload["tone"] | "error";
  title: string;
  summary: string;
  details?: unknown;
  raw?: string;
  rawCommandOutput?: string;
}

const DEFAULT_RENDER_PAYLOAD: RenderPayload = {
  status: "ok",
  command: "chat",
  tone: "info",
  title: "Response",
  summary: "No response data was returned.",
};

function ensureText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return "";
}

function indentJson(value: unknown): string {
  if (value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

function formatDetails(payload: RenderPayload): string {
  const parts: string[] = [];
  const title = ensureText(payload.title);
  const summary = ensureText(payload.summary);
  const status = ensureText(payload.status);
  const command = ensureText(payload.command);

  if (status) {
    parts.push(`[${status.toUpperCase()}]`);
  }
  if (title) {
    parts.push(title);
  }
  if (command) {
    parts.push(`command: /${command}`);
  }
  if (summary) {
    parts.push(summary);
  }
  if (ensureText(payload.rawCommandOutput)) {
    parts.push(`raw-command-output:\n${ensureText(payload.rawCommandOutput)}`);
  }
  if (ensureText(payload.raw)) {
    parts.push(`raw:\n${ensureText(payload.raw)}`);
  }
  if (payload.details !== undefined) {
    parts.push(`details:\n${indentJson(payload.details)}`);
  }

  return parts.join("\n\n");
}

export function extractLatestUserMessage(messages: AgentMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "user" || message.role === "user-with-attachments") {
      if (typeof message.content === "string") {
        return ensureText(message.content);
      }

      if (Array.isArray(message.content)) {
        const textBlocks = message.content
          .filter((content) => typeof content === "object" && content !== null && "type" in content && content.type === "text")
          .map((content) => (content as { text?: string }).text ?? "")
          .filter((text) => text.length > 0)
          .join(" ")
          .trim();

        return textBlocks;
      }
    }
  }

  return "";
}

export function renderPayload(payload: RenderPayload | Error | string): string {
  if (payload instanceof Error) {
    return `Error: ${payload.message}`;
  }
  if (typeof payload === "string") {
    return payload.trim();
  }
  return formatDetails(payload).trim();
}

function buildAssistantMessage(model: Model, text: string, stopReason: AssistantMessage["stopReason"]): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0,
      },
    },
    stopReason,
    timestamp: Date.now(),
  };
}

function emitTextResponse(
  stream: ReturnType<typeof createAssistantMessageEventStream>,
  model: Model,
  text: string,
  stopReason: AssistantMessage["stopReason"],
) {
  const message = buildAssistantMessage(model, text, stopReason);
  const partialStart = buildAssistantMessage(model, "", stopReason);
  const partialDuring = buildAssistantMessage(model, text, stopReason);

  stream.push({
    type: "start",
    partial: partialStart,
  });
  stream.push({
    type: "text_start",
    contentIndex: 0,
    partial: { ...partialStart },
  });
  stream.push({
    type: "text_delta",
    contentIndex: 0,
    delta: text,
    partial: partialDuring,
  });
  stream.push({
    type: "text_end",
    contentIndex: 0,
    content: text,
    partial: message,
  });

  if (stopReason === "error" || stopReason === "aborted") {
    stream.push({ type: "error", reason: stopReason, error: message });
    return;
  }

  stream.push({
    type: "done",
    reason: "stop",
    message,
  });
}

function coercePayload(payload: unknown): RenderPayload {
  if (typeof payload === "string") {
    return {
      ...DEFAULT_RENDER_PAYLOAD,
      summary: payload,
      status: "error",
      title: "Unprocessable Response",
      tone: "error",
    };
  }

  if (payload && typeof payload === "object") {
    const candidate = payload as Partial<ChatPayload> & {
      command?: string;
      summary?: string;
      details?: unknown;
      raw?: string;
      rawCommandOutput?: string;
      title?: string;
      tone?: ChatPayload["tone"];
      status?: ChatPayload["status"];
    };

    return {
      ...DEFAULT_RENDER_PAYLOAD,
      status: candidate.status ?? "ok",
      command: candidate.command ?? "chat",
      tone: (candidate.tone ?? "info") as RenderPayload["tone"],
      title: candidate.title ?? "Response",
      summary: candidate.summary ?? "No summary available.",
      details: candidate.details,
      raw: ensureText(candidate.raw) ? candidate.raw : undefined,
      rawCommandOutput: ensureText(candidate.rawCommandOutput) ? candidate.rawCommandOutput : undefined,
    };
  }

  return {
    ...DEFAULT_RENDER_PAYLOAD,
    summary: "Unsupported command response payload.",
    status: "error",
    tone: "error",
    title: "Error",
  };
}

export const createConvexStreamFn = (httpFetch: typeof fetch = fetch): StreamFn => {
  return async (model, context, options) => {
    const stream = createAssistantMessageEventStream();
    const signal = options?.signal;
    const userInput = extractLatestUserMessage(context.messages);

    if (!userInput) {
      emitTextResponse(stream, model, "No user prompt found in context.", "error");
      return stream;
    }

    try {
      const response = await httpFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userInput }),
        signal,
      });

      const text = await response.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }

      let payload = coercePayload(parsed);
      if (!response.ok) {
        payload = {
          ...payload,
          status: "error",
          tone: "error",
          title: payload.title || "Request Failed",
          summary: response.statusText || payload.summary,
        };
      }

      const output = renderPayload(payload);
      emitTextResponse(stream, model, output, payload.status === "error" ? "error" : "stop");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Request failed.";
      emitTextResponse(stream, model, `Request failed: ${reason}`, "error");
    }

    return stream;
  };
};
