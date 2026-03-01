import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { join } from "node:path";

const chatUiSource = readFileSync(join(process.cwd(), "src", "app", "chat-ui.tsx"), "utf8");

describe("chat-ui layout contract", () => {
  it("uses a valid header row padding class", () => {
    expect(chatUiSource).not.toContain('<div class="flex items-center gap-2 px-4 py-">');
    expect(chatUiSource).toContain('<div class="flex items-center gap-2 px-4 py-2">');
  });

  it("wraps the ChatPanel in a flex fill container", () => {
    expect(chatUiSource).toMatch(/<div class="flex-1 min-h-0">\s*\$\{chatPanel\}\s*<\/div>/);
  });

  it("keeps exactly one chat panel injection point", () => {
    const chatPanelSlots = chatUiSource.match(/\$\{chatPanel\}/g) ?? [];
    expect(chatPanelSlots).toHaveLength(1);
  });
});
