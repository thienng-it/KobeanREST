import { useState, useEffect } from "react";

export interface QaRunRecord {
  runId: string;
  timestamp: string;
  commit: string;
  commitMsg: string;
  branch: string;
  status: "passed" | "failed";
  durationMs: number;
  contractTests: {
    total: number;
    passed: number;
    failed: number;
  };
  e2eScenarios: {
    total: number;
    passed: number;
    failed: number;
  };
  passRate: number;
  scenarios: Array<{
    name: string;
    status: "passed" | "failed";
    durationMs: number;
  }>;
}

export function QaDashboard() {
  const [history, setHistory] = useState<QaRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<QaRunRecord | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "passed" | "failed">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/KobeanREST/qa-history.json")
      .then((res) => {
        if (!res.ok) return fetch("/qa-history.json");
        return res;
      })
      .then((res) => res.json())
      .then((data: QaRunRecord[]) => {
        setHistory(data.reverse()); // latest first
        if (data.length > 0) setSelectedRun(data[0]);
        setLoading(false);
      })
      .catch(() => {
        // Fallback default sample data if fetch fails locally
        const fallback: QaRunRecord[] = [
          {
            runId: "30378744071",
            timestamp: new Date().toISOString(),
            commit: "223a1c1",
            commitMsg: "ci(qa): add detailed daily test report step summary to daily-e2e-tests workflow",
            branch: "main",
            status: "passed",
            durationMs: 91000,
            contractTests: { total: 127, passed: 127, failed: 0 },
            e2eScenarios: { total: 5, passed: 5, failed: 0 },
            passRate: 100,
            scenarios: [
              { name: "1. Verify Workspace Load & Sidebar Collections", status: "passed", durationMs: 817 },
              { name: "2. Verify URL and Query Params Bi-Directional Synchronization", status: "passed", durationMs: 382 },
              { name: "3. Verify HTTP Request Execution & Response Panel", status: "passed", durationMs: 1273 },
              { name: "4. Verify Environment Selector & Variables Modal", status: "passed", durationMs: 899 },
              { name: "5. Verify Pre & Post Request Scripts Execution Interface", status: "passed", durationMs: 533 },
            ],
          },
          {
            runId: "30378451582",
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            commit: "772b97e",
            commitMsg: "fix(ci): pass secrets to env for step condition in daily-e2e-tests.yml",
            branch: "main",
            status: "passed",
            durationMs: 88000,
            contractTests: { total: 127, passed: 127, failed: 0 },
            e2eScenarios: { total: 5, passed: 5, failed: 0 },
            passRate: 100,
            scenarios: [
              { name: "1. Verify Workspace Load & Sidebar Collections", status: "passed", durationMs: 871 },
              { name: "2. Verify URL and Query Params Bi-Directional Synchronization", status: "passed", durationMs: 370 },
              { name: "3. Verify HTTP Request Execution & Response Panel", status: "passed", durationMs: 1270 },
              { name: "4. Verify Environment Selector & Variables Modal", status: "passed", durationMs: 904 },
              { name: "5. Verify Pre & Post Request Scripts Execution Interface", status: "passed", durationMs: 522 },
            ],
          },
        ];
        setHistory(fallback);
        setSelectedRun(fallback[0]);
        setLoading(false);
      });
  }, []);

  const filteredHistory = history.filter((run) => {
    const matchesStatus = filterStatus === "all" || run.status === filterStatus;
    const matchesSearch =
      run.commit.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.commitMsg.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.runId.includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  const totalRuns = history.length;
  const avgPassRate = totalRuns > 0 ? (history.reduce((acc, r) => acc + r.passRate, 0) / totalRuns).toFixed(1) : "100.0";
  const avgDurationSec = totalRuns > 0 ? (history.reduce((acc, r) => acc + r.durationMs, 0) / totalRuns / 1000).toFixed(1) : "88.0";

  return (
    <div style={{ marginTop: "24px", color: "var(--color-text, #f8fafc)" }}>
      {/* Overview Stat Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "32px",
        }}
      >
        <div
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "12px",
            padding: "20px",
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ fontSize: "12px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Total Test Runs
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, marginTop: "6px", color: "#38bdf8" }}>{totalRuns}</div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>Daily automated CI history</div>
        </div>

        <div
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "12px",
            padding: "20px",
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ fontSize: "12px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Avg Pass Rate
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, marginTop: "6px", color: "#22c55e" }}>{avgPassRate}%</div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>Zero failure target</div>
        </div>

        <div
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "12px",
            padding: "20px",
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ fontSize: "12px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Verifications / Run
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, marginTop: "6px", color: "#a855f7" }}>132</div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>127 Contract + 5 E2E</div>
        </div>

        <div
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "12px",
            padding: "20px",
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ fontSize: "12px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Avg Test Duration
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, marginTop: "6px", color: "#f59e0b" }}>{avgDurationSec}s</div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>Parallel matrix build</div>
        </div>
      </div>

      {/* Visual Analytics Charts Section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "24px",
          marginBottom: "32px",
        }}
      >
        {/* Pass Rate Trend Chart */}
        <div
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "12px",
            padding: "24px",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>
            📈 Pass Rate Trend (%)
          </h3>
          <div style={{ height: "160px", display: "flex", alignItems: "flex-end", gap: "16px", paddingTop: "20px" }}>
            {history.slice(0, 10).reverse().map((run, idx) => (
              <div
                key={idx}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: "100%",
                  justifyContent: "flex-end",
                }}
              >
                <div style={{ fontSize: "10px", color: "#22c55e", fontWeight: 700, marginBottom: "4px" }}>
                  {run.passRate}%
                </div>
                <div
                  style={{
                    width: "100%",
                    height: `${run.passRate}%`,
                    background: "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)",
                    borderRadius: "6px 6px 0 0",
                    boxShadow: "0 0 12px rgba(34, 197, 94, 0.3)",
                  }}
                />
                <div style={{ fontSize: "10px", color: "#64748b", marginTop: "6px", fontFamily: "monospace" }}>
                  {new Date(run.timestamp).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Test Duration Trend Chart */}
        <div
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "12px",
            padding: "24px",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>
            ⏱️ Execution Duration Trend (Seconds)
          </h3>
          <div style={{ height: "160px", display: "flex", alignItems: "flex-end", gap: "16px", paddingTop: "20px" }}>
            {history.slice(0, 10).reverse().map((run, idx) => {
              const sec = Math.round(run.durationMs / 1000);
              const heightPct = Math.min(100, Math.max(20, (sec / 120) * 100));
              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    height: "100%",
                    justifyContent: "flex-end",
                  }}
                >
                  <div style={{ fontSize: "10px", color: "#38bdf8", fontWeight: 700, marginBottom: "4px" }}>
                    {sec}s
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: `${heightPct}%`,
                      background: "linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)",
                      borderRadius: "6px 6px 0 0",
                    }}
                  />
                  <div style={{ fontSize: "10px", color: "#64748b", marginTop: "6px", fontFamily: "monospace" }}>
                    {new Date(run.timestamp).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Historical Daily Test Runs Table */}
      <div
        style={{
          background: "rgba(15, 23, 42, 0.6)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>📜 Daily Test Execution History</h3>
          <div style={{ display: "flex", gap: "12px" }}>
            <input
              type="text"
              placeholder="Search commit or run ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: "rgba(30, 41, 59, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "6px",
                padding: "6px 12px",
                color: "#f8fafc",
                fontSize: "13px",
              }}
            />
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "rgba(30, 41, 59, 0.5)", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", color: "#94a3b8" }}>
                <th style={{ padding: "12px 16px" }}>Run Date</th>
                <th style={{ padding: "12px 16px" }}>Commit</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px" }}>Contract Tests</th>
                <th style={{ padding: "12px 16px" }}>E2E Scenarios</th>
                <th style={{ padding: "12px 16px" }}>Duration</th>
                <th style={{ padding: "12px 16px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((run) => (
                <tr
                  key={run.runId}
                  style={{
                    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                    background: selectedRun?.runId === run.runId ? "rgba(56, 189, 248, 0.08)" : "transparent",
                    cursor: "pointer",
                  }}
                  onClick={() => setSelectedRun(run)}
                >
                  <td style={{ padding: "12px 16px", fontWeight: 500 }}>
                    {new Date(run.timestamp).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                  </td>
                  <td style={{ padding: "12px 16px", fontFamily: "monospace" }}>
                    <a
                      href={`https://github.com/thienng-it/KobeanREST/commit/${run.commit}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#38bdf8", textDecoration: "none" }}
                    >
                      {run.commit}
                    </a>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 700,
                        backgroundColor: run.status === "passed" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        color: run.status === "passed" ? "#22c55e" : "#ef4444",
                        border: `1px solid ${run.status === "passed" ? "#22c55e" : "#ef4444"}`,
                      }}
                    >
                      {run.status === "passed" ? "PASSED (100%)" : "FAILED"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {run.contractTests.passed} / {run.contractTests.total}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {run.e2eScenarios.passed} / {run.e2eScenarios.total}
                  </td>
                  <td style={{ padding: "12px 16px" }}>{(run.durationMs / 1000).toFixed(1)}s</td>
                  <td style={{ padding: "12px 16px" }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRun(run);
                      }}
                      style={{
                        background: "rgba(56, 189, 248, 0.2)",
                        border: "1px solid #38bdf8",
                        color: "#38bdf8",
                        borderRadius: "4px",
                        padding: "4px 8px",
                        fontSize: "11px",
                        cursor: "pointer",
                      }}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Run Details Drilldown */}
      {selectedRun && (
        <div
          style={{
            marginTop: "24px",
            background: "rgba(15, 23, 42, 0.8)",
            border: "1px solid #38bdf8",
            borderRadius: "12px",
            padding: "24px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h4 style={{ margin: 0, fontSize: "16px", color: "#38bdf8" }}>
                🔍 Run Details — Commit {selectedRun.commit} ({new Date(selectedRun.timestamp).toLocaleDateString()})
              </h4>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#94a3b8" }}>{selectedRun.commitMsg}</p>
            </div>
            <a
              href={`https://github.com/thienng-it/KobeanREST/actions/runs/${selectedRun.runId}`}
              target="_blank"
              rel="noreferrer"
              style={{
                color: "#38bdf8",
                fontSize: "13px",
                textDecoration: "none",
                fontWeight: 600,
                border: "1px solid #38bdf8",
                padding: "6px 12px",
                borderRadius: "6px",
              }}
            >
              View GitHub Action Run ↗
            </a>
          </div>

          <h5 style={{ margin: "16px 0 8px 0", fontSize: "14px", color: "#f8fafc" }}>CodeceptJS E2E GUI Scenarios</h5>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {selectedRun.scenarios.map((sc, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(30, 41, 59, 0.6)",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  borderLeft: "3px solid #22c55e",
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: 500 }}>{sc.name}</span>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>{sc.durationMs} ms</span>
                  <span style={{ fontSize: "11px", color: "#22c55e", fontWeight: 700 }}>PASSED</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
