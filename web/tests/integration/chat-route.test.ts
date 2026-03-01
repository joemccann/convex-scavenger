import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import * as piShell from "@/lib/pi-shell";
import { GET, POST } from "@/app/api/chat/route";

describe("/api/chat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns command metadata from GET", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
      }),
    );
    expect(payload.commands).toContainEqual(
      expect.objectContaining({
        name: "scan",
      }),
    );
  });

  it("enforces JSON body on POST", async () => {
    const request = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: "not-json",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.status).toBe("error");
    expect(payload.title).toBe("Invalid request");
  });

  it("returns handler payload and id for valid chat messages", async () => {
    vi.spyOn(piShell, "runCommandFromMessage").mockResolvedValue({
      status: "ok",
      command: "help",
      tone: "info",
      title: "Help",
      summary: "Available commands:\n/scan",
    });

    const request = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "/help" }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      id: expect.any(String),
      status: "ok",
      command: "help",
      title: "Help",
    });
  });

  it("rejects missing POST message text", async () => {
    const request = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "   " }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.title).toBe("Missing message");
  });

  it("rejects non-string message payloads", async () => {
    const request = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: 12 }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.title).toBe("Missing message");
  });
});
