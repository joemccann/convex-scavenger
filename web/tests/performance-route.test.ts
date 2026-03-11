import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockStat = vi.fn();
const mockSpawn = vi.fn();

vi.mock("fs/promises", () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  stat: mockStat,
}));

vi.mock("child_process", () => ({
  spawn: mockSpawn,
}));

function makeProc({ stdout = "", stderr = "", code = 0 }: { stdout?: string; stderr?: string; code?: number }) {
  return {
    stdout: {
      on: (event: string, cb: (chunk: Buffer) => void) => {
        if (event === "data" && stdout) cb(Buffer.from(stdout));
      },
    },
    stderr: {
      on: (event: string, cb: (chunk: Buffer) => void) => {
        if (event === "data" && stderr) cb(Buffer.from(stderr));
      },
    },
    on: (event: string, cb: (arg?: unknown) => void) => {
      if (event === "close") cb(code);
    },
  };
}

describe("/api/performance route", () => {
  beforeEach(() => {
    vi.resetModules();
    mockReadFile.mockReset();
    mockWriteFile.mockReset();
    mockStat.mockReset();
    mockSpawn.mockReset();
    mockWriteFile.mockResolvedValue(undefined);
  });

  it("GET returns cached performance data when the cache exists", async () => {
    mockStat.mockResolvedValue({ mtimeMs: Date.now() });
    mockReadFile.mockResolvedValue(JSON.stringify({
      as_of: "2026-03-10",
      summary: { sharpe_ratio: 1.2 },
      series: [],
    }));

    const { GET } = await import("../app/api/performance/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.as_of).toBe("2026-03-10");
    expect(body.summary.sharpe_ratio).toBe(1.2);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it("GET refreshes inline when cached performance lags the current portfolio snapshot", async () => {
    mockStat.mockResolvedValue({ mtimeMs: Date.now() });
    mockReadFile.mockImplementation(async (path: string) => {
      if (path.includes("performance.json")) {
        return JSON.stringify({
          as_of: "2026-03-10",
          last_sync: "2026-03-10T18:55:00Z",
          summary: { ending_equity: 1_063_031.86 },
          series: [],
        });
      }
      if (path.includes("portfolio.json")) {
        return JSON.stringify({
          last_sync: "2026-03-11T13:37:14Z",
          account_summary: { net_liquidation: 1_313_112.03 },
        });
      }
      throw new Error(`unexpected read: ${path}`);
    });
    mockSpawn.mockReturnValue(makeProc({
      stdout: JSON.stringify({
        as_of: "2026-03-11",
        last_sync: "2026-03-11T13:37:14Z",
        summary: { ending_equity: 1_313_112.03 },
        series: [],
      }),
      code: 0,
    }));

    const { GET } = await import("../app/api/performance/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.as_of).toBe("2026-03-11");
    expect(body.summary.ending_equity).toBe(1_313_112.03);
    expect(mockSpawn).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });

  it("POST runs the Python sync and persists the generated JSON", async () => {
    const payload = {
      as_of: "2026-03-10",
      last_sync: "2026-03-10T18:55:00Z",
      summary: { sharpe_ratio: 1.84 },
      series: [{ date: "2026-01-02", equity: 1000000 }],
    };
    mockSpawn.mockReturnValue(makeProc({
      stdout: `warming up\n${JSON.stringify(payload)}`,
      code: 0,
    }));

    const { POST } = await import("../app/api/performance/route");
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.summary.sharpe_ratio).toBe(1.84);
    expect(mockSpawn).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });
});
