import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Startup Protocol Extension
 * 
 * Loads project documentation into context as durable memory.
 * Note: SYSTEM.md is loaded automatically by pi (defines agent identity).
 * Note: AGENTS.md is loaded automatically by pi (defines project workflow).
 * This extension adds docs/* for additional project context.
 */
export default function (pi: ExtensionAPI) {
  const loadProjectDocs = (cwd: string) => {
    const files = [
      { path: "docs/prompt.md", label: "Spec" },
      { path: "docs/plans.md", label: "Plans" },
      { path: "docs/implement.md", label: "Runbook" },
      { path: "docs/status.md", label: "Status" },
    ];

    const loaded: string[] = [];
    const contents: string[] = [];

    for (const file of files) {
      const fullPath = path.join(cwd, file.path);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        contents.push(`\n\n--- ${file.label.toUpperCase()} (${file.path}) ---\n${content}`);
        loaded.push(file.label);
      }
    }

    return { loaded, content: contents.join("\n") };
  };

  // Inject docs into system prompt context
  pi.on("before_agent_start", async (event, ctx) => {
    const { loaded, content } = loadProjectDocs(ctx.cwd);
    
    if (content && loaded.length > 0) {
      const injectedPrompt = `
## PROJECT DOCUMENTATION (Auto-loaded)

${content}

---
END PROJECT DOCUMENTATION
---
`;
      
      return {
        systemPrompt: event.systemPrompt + "\n" + injectedPrompt,
      };
    }
  });

  // Notify on session start
  pi.on("session_start", async (_event, ctx) => {
    const { loaded } = loadProjectDocs(ctx.cwd);
    
    if (loaded.length > 0) {
      ctx.ui.notify(`Docs loaded: ${loaded.join(", ")}`, "info");
    }
  });
}
