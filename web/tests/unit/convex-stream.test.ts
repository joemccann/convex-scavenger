import { describe, expect, it, vi } from "vitest";
import { createConvexStreamFn, extractLatestUserMessage, renderPayload } from "@/lib/convex-stream";

interface MessageFixture {
	role: "user";
	content: string | Array<{ type: string; text?: string }>;
	timestamp: number;
}

async function collectStreamEvents(stream: AsyncIterable<unknown> | Promise<AsyncIterable<unknown>>): Promise<unknown[]> {
	const events: unknown[] = [];
	const resolved = await Promise.resolve(stream);
	for await (const event of resolved) {
		events.push(event);
	}
	return events;
}

describe("convex-stream", () => {
	it("extracts the latest user message from mixed message history", () => {
		const messages: MessageFixture[] = [
			{
				role: "user",
				content: [{ type: "text", text: "first" }],
				timestamp: 1,
			},
			{
				role: "user",
				content: [{ type: "text", text: "latest" }, { type: "text", text: "kept" }],
				timestamp: 2,
			},
		];

		expect(extractLatestUserMessage(messages as never[])).toBe("latest kept");
	});

	it("returns empty text when no user message exists", () => {
		expect(
			extractLatestUserMessage([
				{
					role: "assistant",
					content: "not from user",
					timestamp: 1,
				} as never,
			]),
		).toBe("");
	});

	it("renders error, string, and object payloads", () => {
		expect(renderPayload(new Error("boom"))).toBe("Error: boom");
		expect(renderPayload("simple response")).toBe("simple response");
		expect(
			renderPayload({
				status: "ok",
				command: "help",
				tone: "info",
				title: "Hello",
				summary: "Ready",
			}),
		).toContain("Hello");
	});

	it("streams successful command output from /api/chat", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: true,
			statusText: "OK",
			text: async () =>
				JSON.stringify({
					status: "ok",
					command: "scan",
					tone: "info",
					title: "Scan complete",
					summary: "Scanned 2 tickers.",
					details: { count: 2 },
				}),
		}));

	const stream = createConvexStreamFn(fetchMock as never)(
		{
			api: "anthropic",
			provider: "anthropic",
				id: "claude",
			} as never,
			{
				messages: [
					{
						role: "user",
						content: "/scan",
						timestamp: Date.now(),
					},
				],
			} as never,
			{ signal: undefined } as never,
		);

		const events = await collectStreamEvents(stream);
		const summary = (events.find((event) => event && typeof event === "object" && "type" in event && event.type === "done") as any)?.message?.content?.[0]?.text;
		expect(events).toHaveLength(5);
		expect((events[0] as any).type).toBe("start");
		expect((events.at(-1) as any).type).toBe("done");
		expect(summary).toContain("Scan complete");
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/chat",
			expect.objectContaining({
				method: "POST",
				headers: { "Content-Type": "application/json" },
			}),
		);
	});

  it("streams error payload for missing user input", async () => {
		const fetchMock = vi.fn();
		const stream = createConvexStreamFn(fetchMock as never)({} as never, { messages: [] } as never, {} as never);
		const events = await collectStreamEvents(stream);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(events).toHaveLength(5);
		expect((events.at(-1) as any).type).toBe("error");
		expect((events.at(-1) as any).error?.content?.[0]?.text).toContain("No user prompt found");
  });

	it("propagates server error status as user-facing error", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: false,
			statusText: "Internal Server Error",
			text: async () =>
				JSON.stringify({
					status: "ok",
					command: "help",
					tone: "info",
					title: "Help",
					summary: "Should be replaced.",
				}),
		}));

		const stream = createConvexStreamFn(fetchMock as never)(
			{
				api: "anthropic",
				provider: "anthropic",
				id: "claude",
			} as never,
			{
				messages: [
					{
						role: "user",
						content: "/help",
						timestamp: Date.now(),
					},
				],
			} as never,
			{ signal: undefined } as never,
		);

		const events = await collectStreamEvents(stream);
		const done = events.find((event) => (event as { type?: string })?.type === "error") as
			| { error?: { content?: Array<{ text?: string }> } }
			| undefined;
		const payloadText = done?.error?.content?.[0]?.text;
		expect(payloadText).toContain("Internal Server Error");
		expect(done?.error).toBeTruthy();
	});

	it("uses unsupported payload fallback when response text is a number", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: true,
			statusText: "OK",
			text: async () => "7",
		}));

		const stream = createConvexStreamFn(fetchMock as never)(
			{
				api: "anthropic",
				provider: "anthropic",
				id: "claude",
			} as never,
			{
				messages: [
					{
						role: "user",
						content: "/help",
						timestamp: Date.now(),
					},
				],
			} as never,
			{ signal: undefined } as never,
		);

		const events = await collectStreamEvents(stream);
		const summary =
			(
				events.find((event) => (event as { type?: string })?.type === "error") as {
					error?: { content?: Array<{ text?: string }> };
				}
			)?.error?.content?.[0]?.text ?? "";
		expect(summary).toContain("Unsupported command response payload.");
	});

	it("falls back to non-string text fields for malformed object payload", async () => {
	const fetchMock = vi.fn(async () => ({
		ok: true,
		statusText: "OK",
		text: async () =>
			JSON.stringify({
				status: "error",
				command: {},
				tone: "error",
				title: [],
				raw: {},
				rawCommandOutput: 7,
			}),
	}));

		const stream = createConvexStreamFn(fetchMock as never)(
			{
				api: "anthropic",
				provider: "anthropic",
				id: "claude",
			} as never,
			{
				messages: [
					{
						role: "user",
						content: "/help",
						timestamp: Date.now(),
					},
				],
			} as never,
			{ signal: undefined } as never,
		);

		const events = await collectStreamEvents(stream);
		const summary =
			(
				events.find((event) => (event as { type?: string })?.type === "error") as {
					error?: { content?: Array<{ text?: string }> };
				}
			)?.error?.content?.[0]?.text ?? "";
		expect(summary).toContain("[ERROR]");
		expect(summary).toContain("No summary available.");
	});

	it("returns transport error when fetch throws", async () => {
		const fetchMock = vi.fn(async () => {
			throw new Error("network failure");
		});

		const stream = createConvexStreamFn(fetchMock as never)(
			{
				api: "anthropic",
				provider: "anthropic",
				id: "claude",
			} as never,
			{
				messages: [
					{
						role: "user",
						content: "/help",
						timestamp: Date.now(),
					},
				],
			} as never,
			{ signal: undefined } as never,
		);

		const events = await collectStreamEvents(stream);
		expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ type: "error" })]));
		const finalText =
			(events.find((event) => (event as { type?: string })?.type === "error") as {
				error?: { content?: Array<{ text?: string }> };
			})?.error?.content?.[0]?.text ?? "";
		expect(finalText).toContain("Request failed: network failure");
	});

	it("streams error response text when /api/chat returns malformed payload", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: true,
			statusText: "OK",
			text: async () => "malformed output",
		}));

		const stream = createConvexStreamFn(fetchMock as never)({} as never, {
			messages: [{ role: "user", content: "scan", timestamp: 1 }],
		} as never, {} as never);

		const events = await collectStreamEvents(stream);
		const finalText = (events.at(-1) as any)?.error?.content?.[0]?.text || "";
		expect((events[0] as any).type).toBe("start");
		expect((events.at(-1) as any).type).toBe("error");
		expect(finalText).toContain("Unprocessable Response");
	});

	it("includes raw fields in formatted response", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: true,
			statusText: "OK",
			text: async () =>
				JSON.stringify({
					status: "ok",
					command: "help",
					tone: "info",
					title: "Help",
					summary: "Ready",
					raw: "summary metadata",
					rawCommandOutput: "raw output",
				}),
		}));

		const stream = createConvexStreamFn(fetchMock as never)(
			{
				api: "anthropic",
				provider: "anthropic",
				id: "claude",
			} as never,
			{
				messages: [
					{
						role: "user",
						content: "/help",
						timestamp: Date.now(),
					},
				],
			} as never,
			{ signal: undefined } as never,
		);

		const events = await collectStreamEvents(stream);
		const summary =
			(
				events.find((event) => (event as { type?: string })?.type === "done") as {
					message?: { content?: Array<{ text?: string }> };
				}
			)?.message?.content?.[0]?.text ?? "";

		expect(summary).toContain("raw-command-output:\nraw output");
		expect(summary).toContain("raw:\nsummary metadata");
	});
});
