import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync, spawn } from "node:child_process";

/**
 * Startup Protocol Extension
 * 
 * Loads project documentation and core skills into context as durable memory.
 * Note: SYSTEM.md is loaded automatically by pi (defines agent identity).
 * Note: AGENTS.md is loaded automatically by pi (defines project workflow).
 * This extension adds docs/* and always-on skills for additional project context.
 * 
 * Also checks for pending X account scans based on last scan time.
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

  const loadAlwaysOnSkills = (cwd: string) => {
    // Skills that should be loaded on every session startup
    const alwaysOnSkills = [
      { path: ".pi/skills/context-engineering/SKILL.md", label: "Context Engineering" },
    ];

    const loaded: string[] = [];
    const contents: string[] = [];

    for (const skill of alwaysOnSkills) {
      const fullPath = path.join(cwd, skill.path);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        contents.push(`\n\n--- SKILL: ${skill.label.toUpperCase()} (${skill.path}) ---\n${content}`);
        loaded.push(skill.label);
      }
    }

    return { loaded, content: contents.join("\n") };
  };

  // Inject docs and always-on skills into system prompt context
  pi.on("before_agent_start", async (event, ctx) => {
    const docs = loadProjectDocs(ctx.cwd);
    const skills = loadAlwaysOnSkills(ctx.cwd);
    
    const allLoaded = [...docs.loaded, ...skills.loaded];
    const allContent = [docs.content, skills.content].filter(Boolean).join("\n");
    
    if (allContent && allLoaded.length > 0) {
      const injectedPrompt = `
## PROJECT DOCUMENTATION (Auto-loaded)

${docs.content}

---
END PROJECT DOCUMENTATION
---

## ALWAYS-ON SKILLS (Auto-loaded)

${skills.content}

---
END ALWAYS-ON SKILLS
---
`;
      
      return {
        systemPrompt: event.systemPrompt + "\n" + injectedPrompt,
      };
    }
  });

  // Run IB reconciliation asynchronously (non-blocking)
  const runIBReconciliation = (cwd: string, ui: any) => {
    const scriptPath = path.join(cwd, "scripts/ib_reconcile.py");
    
    if (!fs.existsSync(scriptPath)) {
      return;
    }
    
    // Spawn Python process in background
    const proc = spawn("python3", [scriptPath], {
      cwd,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    
    let output = "";
    let errorOutput = "";
    
    proc.stdout?.on("data", (data) => {
      output += data.toString();
    });
    
    proc.stderr?.on("data", (data) => {
      errorOutput += data.toString();
    });
    
    proc.on("close", (code) => {
      if (code === 0) {
        // Check if reconciliation found issues
        const reconcilePath = path.join(cwd, "data/reconciliation.json");
        if (fs.existsSync(reconcilePath)) {
          try {
            const report = JSON.parse(fs.readFileSync(reconcilePath, "utf-8"));
            if (report.needs_attention) {
              const newTrades = report.new_trades?.length || 0;
              const missingLocal = report.positions_missing_locally?.length || 0;
              const closed = report.positions_closed?.length || 0;
              
              const messages: string[] = [];
              if (newTrades > 0) messages.push(`${newTrades} new trades`);
              if (missingLocal > 0) messages.push(`${missingLocal} new positions`);
              if (closed > 0) messages.push(`${closed} closed positions`);
              
              ui.notify(`📊 IB Reconciliation: ${messages.join(", ")}`, "warning");
            } else {
              ui.notify("✓ IB trades in sync", "info");
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      } else if (errorOutput.includes("IB connection failed") || errorOutput.includes("Cannot connect")) {
        // IB not connected - silent fail, don't spam user
      } else if (errorOutput) {
        ui.notify(`IB reconcile error: ${errorOutput.slice(0, 100)}`, "error");
      }
    });
    
    // Unref so it doesn't keep the process alive
    proc.unref();
  };

  // Check and start Monitor Daemon service
  const checkMonitorDaemon = (cwd: string, ui: any): { running: boolean; error: string | null } => {
    const serviceName = "com.convex-scavenger.monitor-daemon";
    const plistPath = path.join(process.env.HOME || "", "Library/LaunchAgents", `${serviceName}.plist`);
    
    // Check if plist is installed
    if (!fs.existsSync(plistPath)) {
      return { running: false, error: "Service not installed. Run: ./scripts/setup_monitor_daemon.sh install" };
    }
    
    try {
      // Check if service is running via launchctl
      const result = execSync(`launchctl list | grep ${serviceName}`, { 
        encoding: "utf-8",
        timeout: 5000 
      }).trim();
      
      // launchctl list output: PID Status Label
      // If PID is "-" or "0", service is loaded but idle (normal for interval-based)
      // If we get a result, the service is loaded
      if (result.includes(serviceName)) {
        return { running: true, error: null };
      }
      
      return { running: false, error: null };
    } catch (e: any) {
      // grep returns exit code 1 if no match - service not loaded
      if (e.status === 1) {
        return { running: false, error: null };
      }
      return { running: false, error: e.message };
    }
  };
  
  const startMonitorDaemon = (cwd: string, ui: any): { success: boolean; error: string | null } => {
    const plistPath = path.join(process.env.HOME || "", "Library/LaunchAgents", "com.convex-scavenger.monitor-daemon.plist");
    const configPath = path.join(cwd, "config/com.convex-scavenger.monitor-daemon.plist");
    
    // If plist not in LaunchAgents, copy it
    if (!fs.existsSync(plistPath)) {
      if (!fs.existsSync(configPath)) {
        return { success: false, error: "Plist config not found. Daemon not set up." };
      }
      
      try {
        // Copy plist to LaunchAgents
        execSync(`cp "${configPath}" "${plistPath}"`, { timeout: 5000 });
      } catch (e: any) {
        return { success: false, error: `Failed to copy plist: ${e.message}` };
      }
    }
    
    try {
      // Load the service
      execSync(`launchctl load "${plistPath}"`, { 
        encoding: "utf-8",
        timeout: 5000 
      });
      return { success: true, error: null };
    } catch (e: any) {
      // Already loaded is not an error
      if (e.message?.includes("already loaded")) {
        return { success: true, error: null };
      }
      return { success: false, error: e.message };
    }
  };
  
  const ensureMonitorDaemonRunning = (cwd: string, ui: any) => {
    const status = checkMonitorDaemon(cwd, ui);
    
    if (status.running) {
      ui.notify("✓ Monitor daemon running", "info");
      return;
    }
    
    if (status.error?.includes("not installed")) {
      ui.notify(`⚠️ Monitor daemon: ${status.error}`, "warning");
      return;
    }
    
    // Try to start it
    ui.notify("Starting monitor daemon...", "info");
    const startResult = startMonitorDaemon(cwd, ui);
    
    if (startResult.success) {
      ui.notify("✓ Monitor daemon started", "info");
    } else {
      ui.notify(`❌ Monitor daemon failed: ${startResult.error}`, "error");
      // Flag for immediate debugging
      ui.notify("DEBUG NEEDED: Check ./scripts/setup_monitor_daemon.sh status", "error");
    }
  };

  // Run free trade analyzer and return summary
  const runFreeTradeAnalyzer = (cwd: string): string | null => {
    const scriptPath = path.join(cwd, "scripts/free_trade_analyzer.py");
    
    if (!fs.existsSync(scriptPath)) {
      return null;
    }
    
    try {
      const result = execSync(`python3 "${scriptPath}" --summary`, {
        cwd,
        encoding: "utf-8",
        timeout: 10000,
      }).trim();
      
      // If no opportunities, script returns "No free trade opportunities found."
      if (result.includes("No free trade opportunities")) {
        return null;
      }
      
      return result;
    } catch (e) {
      // Silently fail - don't spam user
      return null;
    }
  };

  // Check X account scan status
  const checkXScanStatus = (cwd: string): { account: string; needsScan: boolean; lastScan: string | null }[] => {
    const watchlistPath = path.join(cwd, "data/watchlist.json");
    const results: { account: string; needsScan: boolean; lastScan: string | null }[] = [];
    
    if (!fs.existsSync(watchlistPath)) {
      return results;
    }
    
    try {
      const watchlist = JSON.parse(fs.readFileSync(watchlistPath, "utf-8"));
      const subcategories = watchlist.subcategories || {};
      
      for (const [key, value] of Object.entries(subcategories)) {
        if (key.startsWith("@")) {
          const account = key.slice(1);
          const lastScan = (value as any).last_scan || null;
          
          // Check if scan is needed (more than 12 hours old or never scanned)
          let needsScan = !lastScan;
          
          if (lastScan) {
            const lastScanDate = new Date(lastScan);
            const now = new Date();
            const hoursSinceLastScan = (now.getTime() - lastScanDate.getTime()) / (1000 * 60 * 60);
            needsScan = hoursSinceLastScan > 12;
          }
          
          results.push({ account, needsScan, lastScan });
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
    
    return results;
  };

  // Notify on session start
  pi.on("session_start", async (_event, ctx) => {
    const docs = loadProjectDocs(ctx.cwd);
    const skills = loadAlwaysOnSkills(ctx.cwd);
    const xScans = checkXScanStatus(ctx.cwd);
    
    const allLoaded = [...docs.loaded, ...skills.loaded];
    
    if (allLoaded.length > 0) {
      ctx.ui.notify(`Loaded: ${allLoaded.join(", ")}`, "info");
    }
    
    // Check for pending X scans
    const pendingScans = xScans.filter(s => s.needsScan);
    if (pendingScans.length > 0) {
      const accounts = pendingScans.map(s => `@${s.account}`).join(", ");
      ctx.ui.notify(`⏰ X scan needed: ${accounts}`, "warning");
    }
    
    // Run IB reconciliation asynchronously (non-blocking)
    runIBReconciliation(ctx.cwd, ctx.ui);
    
    // Check and ensure Monitor Daemon is running
    // This handles fill monitoring and exit order placement
    ensureMonitorDaemonRunning(ctx.cwd, ctx.ui);
    
    // Check for free trade opportunities
    const freeTradeSummary = runFreeTradeAnalyzer(ctx.cwd);
    if (freeTradeSummary) {
      ctx.ui.notify(`💰 Free Trade: ${freeTradeSummary}`, "info");
    }
  });
}
