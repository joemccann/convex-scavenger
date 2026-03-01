import { NextRequest, NextResponse } from "next/server";

import { buildMessageId, getAvailableCommands, runCommandFromMessage, type ChatPayload } from "@/lib/pi-shell";

export const runtime = "nodejs";

interface ChatRequestBody {
  message?: string;
}

export async function GET() {
  const commands = getAvailableCommands().map((command) => ({
    name: command.name,
    description: command.description,
    aliases: command.aliases,
  }));

  return NextResponse.json({
    ok: true,
    commands,
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: ChatRequestBody;

  try {
    payload = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json(
      {
        status: "error",
        command: "chat",
        tone: "error",
        title: "Invalid request",
        summary: "Request body must be JSON with a message string.",
      } as ChatPayload,
      { status: 400 },
    );
  }

  const message = typeof payload.message === "string" ? payload.message : "";

  if (!message.trim()) {
    return NextResponse.json(
      {
        status: "error",
        command: "chat",
        tone: "error",
        title: "Missing message",
        summary: "Include a non-empty message in the request body.",
      } as ChatPayload,
      { status: 400 },
    );
  }

  const response = await runCommandFromMessage(message);

  return NextResponse.json({
    id: buildMessageId(),
    ...response,
  } as ChatPayload & { id: string });
}
