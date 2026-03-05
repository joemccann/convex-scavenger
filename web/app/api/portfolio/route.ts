import { NextResponse } from "next/server";
import { ibSync } from "@tools/wrappers/ib-sync";
import { readDataFile } from "@tools/data-reader";
import { PortfolioData } from "@tools/schemas/ib-sync";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const result = await readDataFile("data/portfolio.json", PortfolioData);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read portfolio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(): Promise<Response> {
  try {
    const result = await ibSync({ sync: true, port: 4001 });

    if (!result.ok) {
      return NextResponse.json(
        { error: "Sync failed", stderr: result.stderr },
        { status: 502 },
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
