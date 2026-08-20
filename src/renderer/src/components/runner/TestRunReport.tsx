import { useState, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Download,
  Copy,
  FileText,
  Zap,
  ChevronDown,
  ChevronRight,
  Filter,
  CheckSquare,
} from "lucide-react";
import type { SavedRequest, ExecuteHttpResponse } from "../../types";
import { formatBytes } from "../../response-utils";
import { useI18n } from "../../services/i18n";

export interface RequestResultItem {
  request: {
    id: string;
    name: string;
    method: string;
    customMethod?: string;
    folderId?: string;
    url?: string;
    [key: string]: any;
  };
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  response?: {
    status: number;
    statusText?: string;
    headers?: any[];
    body?: string;
    bodyText?: string;
    sizeBytes?: number;
    durationMs?: number;
    [key: string]: any;
  };
  executedRequest?: import("../../types").ExecuteHttpRequest;
  error?: string;
  durationMs?: number;
  passedTests?: number;
  failedTests?: number;
  testResults?: Array<{ name: string; passed: boolean; error?: string }>;
}

export interface TestRunReportProps {
  scopeName?: string;
  scopeType?: "folder" | "collection";
  environmentName?: string | null;
  results: RequestResultItem[];
  totalDurationMs?: number;
  createdAt?: string | number;
  onViewDetailedLogs?: () => void;
}

export function TestRunReport({
  scopeName = "Collection Run",
  scopeType = "collection",
  environmentName,
  results,
  totalDurationMs,
  createdAt = Date.now(),
  onViewDetailedLogs,
}: TestRunReportProps) {
  const { t } = useI18n();
  const [selectedFilter, setSelectedFilter] = useState<"all" | "passed" | "failed" | "with-tests">("all");
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

  // Compute metrics
  const metrics = useMemo(() => {
    const totalRequests = results.length;
    const passedRequests = results.filter((r) => r.status === "passed").length;
    const failedRequests = results.filter((r) => r.status === "failed").length;
    const skippedRequests = results.filter((r) => r.status === "skipped").length;

    let totalPassedTests = 0;
    let totalFailedTests = 0;
    const allTestResults: Array<{
      requestName: string;
      method: string;
      testName: string;
      passed: boolean;
      error?: string;
    }> = [];

    let status2xx = 0;
    let status3xx = 0;
    let status4xx = 0;
    let status5xx = 0;
    let statusOther = 0;

    let totalBytes = 0;
    const durations: number[] = [];

    for (const r of results) {
      if (r.passedTests) totalPassedTests += r.passedTests;
      if (r.failedTests) totalFailedTests += r.failedTests;
      if (r.durationMs !== undefined) durations.push(r.durationMs);
      if (r.response?.sizeBytes) totalBytes += r.response.sizeBytes;

      if (r.response?.status) {
        const s = r.response.status;
        if (s >= 200 && s < 300) status2xx++;
        else if (s >= 300 && s < 400) status3xx++;
        else if (s >= 400 && s < 500) status4xx++;
        else if (s >= 500 && s < 600) status5xx++;
        else statusOther++;
      } else if (r.status === "failed") {
        status5xx++;
      }

      if (r.testResults) {
        for (const t of r.testResults) {
          allTestResults.push({
            requestName: r.request.name,
            method: r.request.method,
            testName: t.name,
            passed: t.passed,
            error: t.error,
          });
        }
      }
    }

    const totalTests = totalPassedTests + totalFailedTests;
    const testPassRate =
      totalTests > 0
        ? ((totalPassedTests / totalTests) * 100).toFixed(1)
        : totalRequests > 0
        ? ((passedRequests / totalRequests) * 100).toFixed(1)
        : "100";

    const avgDuration =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
    const computedTotalDuration =
      totalDurationMs ||
      (durations.length > 0 ? durations.reduce((a, b) => a + b, 0) : 0);

    const isAllPassed = failedRequests === 0 && totalFailedTests === 0;

    return {
      totalRequests,
      passedRequests,
      failedRequests,
      skippedRequests,
      totalPassedTests,
      totalFailedTests,
      totalTests,
      testPassRate,
      allTestResults,
      status2xx,
      status3xx,
      status4xx,
      status5xx,
      statusOther,
      totalBytes,
      avgDuration,
      minDuration,
      maxDuration,
      computedTotalDuration,
      isAllPassed,
    };
  }, [results, totalDurationMs]);

  // Filtered requests list
  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      if (selectedFilter === "passed") return r.status === "passed";
      if (selectedFilter === "failed") return r.status === "failed";
      if (selectedFilter === "with-tests") return Boolean(r.testResults && r.testResults.length > 0);
      return true;
    });
  }, [results, selectedFilter]);

  // Failed items
  const failedItems = useMemo(() => {
    return results.filter(
      (r) => r.status === "failed" || (r.failedTests && r.failedTests > 0) || r.error
    );
  }, [results]);

  // Copy Markdown summary report to clipboard
  const handleCopyMarkdown = () => {
    const dateStr = new Date(createdAt).toLocaleString();
    let md = "# KobeanREST Test Run Report\n\n";
    md += `**Scope:** ${scopeName} (${scopeType})  \n`;
    md += `**Date:** ${dateStr}  \n`;
    if (environmentName) md += `**Environment:** ${environmentName}  \n`;
    md += `**Status:** ${metrics.isAllPassed ? "✅ ALL PASSED" : `❌ ${metrics.failedRequests} FAILED`} (${metrics.testPassRate}% Pass Rate)  \n`;
    md += `**Duration:** ${(metrics.computedTotalDuration / 1000).toFixed(2)}s (Avg: ${metrics.avgDuration}ms)  \n\n`;

    md += "## Summary Metrics\n\n";
    md += "| Metric | Count |\n|---|---|\n";
    md += `| Total Requests | ${metrics.totalRequests} |\n`;
    md += `| Passed Requests | ${metrics.passedRequests} |\n`;
    md += `| Failed Requests | ${metrics.failedRequests} |\n`;
    md += `| Total Assertions | ${metrics.totalTests} (${metrics.totalPassedTests} passed, ${metrics.totalFailedTests} failed) |\n`;
    md += `| Total Data | ${formatBytes(metrics.totalBytes)} |\n\n`;

    md += "## Executed Requests\n\n";
    md += "| Method | Request Name | Status | Time | Tests |\n|---|---|---|---|---|\n";
    for (const r of results) {
      const statusText = r.response ? `${r.response.status}` : (r.error ? "Error" : r.status);
      const testSummary = r.testResults && r.testResults.length > 0
        ? `${r.passedTests || 0}/${r.testResults.length} passed`
        : "-";
      md += `| \`${r.request.method}\` | ${r.request.name} | ${statusText} | ${r.durationMs || 0}ms | ${testSummary} |\n`;
    }

    if (failedItems.length > 0) {
      md += "\n## Failed Assertions & Errors\n\n";
      for (const item of failedItems) {
        md += `### ❌ ${item.request.method} ${item.request.name}\n`;
        if (item.error) {
          md += `- **Error:** ${item.error}\n`;
        }
        if (item.testResults) {
          for (const t of item.testResults) {
            if (!t.passed) {
              md += `- **Failed Test:** ${t.name}${t.error ? ` (${t.error})` : ""}\n`;
            }
          }
        }
      }
    }

    md += "\n---\n*Report generated by KobeanREST desktop client*";

    navigator.clipboard.writeText(md);
    window.dispatchEvent(
      new CustomEvent("app-toast", {
        detail: { message: "Test run report copied to clipboard as Markdown!", tone: "success" },
      })
    );
  };

  // Export standalone styled HTML Report
  const handleExportHtml = () => {
    const dateStr = new Date(createdAt).toLocaleString();
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KobeanREST Test Report - ${scopeName}</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: rgba(30, 41, 59, 0.7);
      --border: rgba(255, 255, 255, 0.1);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --success: #10b981;
      --error: #ef4444;
      --warning: #f59e0b;
      --accent: #3b82f6;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 32px 24px;
      line-height: 1.5;
    }
    .container { max-width: 1040px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    h1 { margin: 0 0 4px 0; font-size: 24px; font-weight: 700; }
    .meta { color: var(--text-muted); font-size: 13px; }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 13px;
      background: ${metrics.isAllPassed ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)"};
      color: ${metrics.isAllPassed ? "var(--success)" : "var(--error)"};
      border: 1px solid ${metrics.isAllPassed ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"};
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .metric-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      backdrop-filter: blur(12px);
    }
    .metric-title { font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px; }
    .metric-val { font-size: 24px; font-weight: 800; }
    .metric-sub { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
    .table-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 24px;
    }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    th { padding: 12px 16px; background: rgba(0, 0, 0, 0.2); color: var(--text-muted); font-size: 11px; text-transform: uppercase; }
    td { padding: 12px 16px; border-top: 1px solid var(--border); }
    .method-pill {
      font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: inline-block;
      background: rgba(255, 255, 255, 0.1); color: #fff;
    }
    .status-pill { font-weight: 700; }
    .status-pill.pass { color: var(--success); }
    .status-pill.fail { color: var(--error); }
    .error-box {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.25);
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 24px;
    }
    .footer { text-align: center; color: var(--text-muted); font-size: 12px; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>Test Run Report: ${scopeName}</h1>
        <div class="meta">Scope: ${scopeType} | Date: ${dateStr} ${environmentName ? `| Environment: ${environmentName}` : ""}</div>
      </div>
      <div class="status-badge">
        ${metrics.isAllPassed ? "✓ ALL TESTS PASSED" : `✗ ${metrics.failedRequests} REQUESTS FAILED`} (${metrics.testPassRate}%)
      </div>
    </div>

    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-title">Assertions & Tests</div>
        <div class="metric-val" style="color: ${metrics.totalFailedTests === 0 ? "var(--success)" : "var(--error)"}">
          ${metrics.totalPassedTests} / ${metrics.totalTests}
        </div>
        <div class="metric-sub">${metrics.testPassRate}% Pass Rate (${metrics.totalFailedTests} failed)</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">{t('runner.requestsExecuted')}</div>
        <div class="metric-val">${metrics.passedRequests} / ${metrics.totalRequests}</div>
        <div class="metric-sub">2xx: ${metrics.status2xx} | 4xx: ${metrics.status4xx} | 5xx: ${metrics.status5xx}</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">Performance / Latency</div>
        <div class="metric-val">${(metrics.computedTotalDuration / 1000).toFixed(2)}s</div>
        <div class="metric-sub">Avg: ${metrics.avgDuration}ms (Min: ${metrics.minDuration}ms, Max: ${metrics.maxDuration}ms)</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">Data Transferred</div>
        <div class="metric-val">${formatBytes(metrics.totalBytes)}</div>
        <div class="metric-sub">${metrics.totalRequests} response payloads</div>
      </div>
    </div>

    ${
      failedItems.length > 0
        ? `<div class="error-box">
            <h3 style="margin: 0 0 8px 0; color: var(--error); font-size: 14px;">⚠️ Failures Detected</h3>
            ${failedItems
              .map(
                (f) => `
              <div style="margin-top: 6px; font-size: 12px;">
                <strong>${f.request.method} ${f.request.name}:</strong> ${f.error || f.testResults?.filter((t) => !t.passed).map((t) => t.name).join(", ")}
              </div>`
              )
              .join("")}
          </div>`
        : ""
    }

    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Request</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Tests</th>
          </tr>
        </thead>
        <tbody>
          ${results
            .map(
              (r) => `
            <tr>
              <td><span class="method-pill">${r.request.method}</span></td>
              <td><strong>${r.request.name}</strong></td>
              <td><span class="status-pill ${r.status === "passed" ? "pass" : "fail"}">${r.response ? `${r.response.status} ${r.response.statusText}` : (r.error ? "Error" : r.status)}</span></td>
              <td>${r.durationMs || 0}ms</td>
              <td>${r.testResults && r.testResults.length > 0 ? `${r.passedTests || 0}/${r.testResults.length} passed` : "-"}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>

    <div class="footer">
      Generated with ❤️ by KobeanREST | Local-first API Client
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const filename = `kobeanrest-report-${scopeName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}.html`;
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    window.dispatchEvent(
      new CustomEvent("app-toast", {
        detail: { message: `HTML test report saved to Downloads folder (${filename})`, tone: "success" },
      })
    );
  };

  // Export JSON Report
  const handleExportJson = () => {
    const data = {
      reportTitle: `Test Run Report: ${scopeName}`,
      scopeName,
      scopeType,
      environmentName,
      createdAt: new Date(createdAt).toISOString(),
      summary: metrics,
      results: results.map((r) => ({
        requestId: r.request.id,
        name: r.request.name,
        method: r.request.method,
        status: r.status,
        statusCode: r.response?.status,
        statusText: r.response?.statusText,
        durationMs: r.durationMs,
        sizeBytes: r.response?.sizeBytes,
        testResults: r.testResults,
        error: r.error,
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const filename = `kobeanrest-results-${scopeName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}.json`;
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    window.dispatchEvent(
      new CustomEvent("app-toast", {
        detail: { message: `JSON test results saved to Downloads folder (${filename})`, tone: "success" },
      })
    );
  };

  return (
    <div className="test-run-report-container" style={{ padding: "20px", overflowY: "auto", height: "100%", boxSizing: "border-box" }}>
      {/* Top Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 20px",
          borderRadius: "10px",
          background: metrics.isAllPassed
            ? "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.04) 100%)"
            : "linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.04) 100%)",
          border: `1px solid ${
            metrics.isAllPassed
              ? "rgba(16, 185, 129, 0.28)"
              : "rgba(239, 68, 68, 0.28)"
          }`,
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {metrics.isAllPassed ? (
            <CheckCircle2 size={28} style={{ color: "var(--color-status-success, #10b981)" }} />
          ) : (
            <XCircle size={28} style={{ color: "var(--color-status-error, #ef4444)" }} />
          )}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--color-text)" }}>
                {metrics.isAllPassed ? "All Tests Passed" : `${metrics.failedRequests} Request Failures Detected`}
              </h3>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "12px",
                  background: metrics.isAllPassed ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                  color: metrics.isAllPassed ? "var(--color-status-success, #10b981)" : "var(--color-status-error, #ef4444)",
                }}
              >
                {metrics.testPassRate}% Pass Rate
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "2px" }}>
              {scopeName} ({scopeType}) — {new Date(createdAt).toLocaleTimeString()} {environmentName ? ` — Env: ${environmentName}` : ""}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            className="ghost-button"
            onClick={handleCopyMarkdown}
            title={t('runner.copyMarkdownTooltip')}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              padding: "6px 10px",
              borderRadius: "6px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            <Copy size={13} />
            <span>{t('runner.copyMarkdown')}</span>
          </button>

          <button
            type="button"
            className="ghost-button"
            onClick={handleExportHtml}
            title={t('runner.exportHtmlTooltip')}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              padding: "6px 10px",
              borderRadius: "6px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            <Download size={13} />
            <span>{t('runner.exportHtml')}</span>
          </button>

          <button
            type="button"
            className="ghost-button"
            onClick={handleExportJson}
            title={t('runner.exportJsonTooltip')}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              padding: "6px 10px",
              borderRadius: "6px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            <FileText size={13} />
            <span>{t('runner.exportJson')}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        {/* Card 1: Assertions */}
        <div
          style={{
            background: "var(--color-surface-muted)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "14px 16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
              Test Assertions
            </span>
            <CheckSquare size={14} style={{ color: "var(--color-text-muted)" }} />
          </div>
          <div style={{ fontSize: "22px", fontWeight: 800, marginTop: "6px", color: metrics.totalFailedTests === 0 ? "var(--color-status-success, #10b981)" : "var(--color-status-error, #ef4444)" }}>
            {metrics.totalPassedTests} / {metrics.totalTests}
          </div>
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px" }}>
            {metrics.totalFailedTests === 0 ? "All assertions passed" : `${metrics.totalFailedTests} assertion(s) failed`}
          </div>
        </div>

        {/* Card 2: Requests Breakdown */}
        <div
          style={{
            background: "var(--color-surface-muted)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "14px 16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
              Requests Executed
            </span>
            <Zap size={14} style={{ color: "var(--color-text-muted)" }} />
          </div>
          <div style={{ fontSize: "22px", fontWeight: 800, marginTop: "6px", color: "var(--color-text)" }}>
            {metrics.passedRequests} / {metrics.totalRequests}
          </div>
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px", display: "flex", gap: "6px" }}>
            <span style={{ color: "var(--color-status-success, #10b981)" }}>2xx: {metrics.status2xx}</span>
            {metrics.status4xx > 0 && <span style={{ color: "var(--color-status-warning, #f59e0b)" }}>4xx: {metrics.status4xx}</span>}
            {metrics.status5xx > 0 && <span style={{ color: "var(--color-status-error, #ef4444)" }}>5xx: {metrics.status5xx}</span>}
          </div>
        </div>

        {/* Card 3: Performance & Latency */}
        <div
          style={{
            background: "var(--color-surface-muted)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "14px 16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
              Total Duration
            </span>
            <Clock size={14} style={{ color: "var(--color-text-muted)" }} />
          </div>
          <div style={{ fontSize: "22px", fontWeight: 800, marginTop: "6px", color: "var(--color-text)" }}>
            {(metrics.computedTotalDuration / 1000).toFixed(2)}s
          </div>
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px" }}>
            Avg: {metrics.avgDuration}ms | Min: {metrics.minDuration}ms | Max: {metrics.maxDuration}ms
          </div>
        </div>

        {/* Card 4: Payload Size */}
        <div
          style={{
            background: "var(--color-surface-muted)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "14px 16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
              Total Data
            </span>
            <Download size={14} style={{ color: "var(--color-text-muted)" }} />
          </div>
          <div style={{ fontSize: "22px", fontWeight: 800, marginTop: "6px", color: "var(--color-text)" }}>
            {formatBytes(metrics.totalBytes)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px" }}>
            {t('runner.across')} {metrics.totalRequests} {t('runner.responsePayloads')}
          </div>
        </div>
      </div>

      {/* Latency Timeline Sparkline */}
      {metrics.totalRequests > 0 && (
        <div
          style={{
            background: "var(--color-surface-muted)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>
              Response Time Distribution
            </span>
            <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
              Max: {metrics.maxDuration}ms
            </span>
          </div>

          <div style={{ display: "flex", gap: "3px", alignItems: "flex-end", height: "36px", paddingTop: "4px" }}>
            {results
              .filter((r) => r.status !== "skipped")
              .map((res, idx) => {
                const duration = res.durationMs || 0;
                const heightPct = metrics.maxDuration > 0
                  ? Math.max(12, Math.min(100, (duration / metrics.maxDuration) * 100))
                  : 20;

                const barColor =
                  res.status === "failed"
                    ? "var(--color-status-error, #ef4444)"
                    : duration < 250
                    ? "var(--color-status-success, #10b981)"
                    : duration < 1000
                    ? "var(--color-status-warning, #f59e0b)"
                    : "var(--color-status-error, #ef4444)";

                return (
                  <div
                    key={idx}
                    onClick={() => setExpandedRequestId(expandedRequestId === res.request.id ? null : res.request.id)}
                    style={{
                      flex: 1,
                      height: `${heightPct}%`,
                      background: barColor,
                      borderRadius: "2px",
                      opacity: 0.85,
                      cursor: "pointer",
                      transition: "all 120ms ease",
                    }}
                    title={`${res.request.method} ${res.request.name}: ${duration}ms (${res.response ? `${res.response.status}` : res.status})`}
                  />
                );
              })}
          </div>
        </div>
      )}

      {/* Failures Spotlight (if any) */}
      {failedItems.length > 0 && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.06)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            borderRadius: "8px",
            padding: "14px 16px",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--color-status-error, #ef4444)", fontWeight: 700, fontSize: "13px", marginBottom: "10px" }}>
            <AlertTriangle size={16} />
            <span>Detected {failedItems.length} Failed Request(s) / Assertions</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {failedItems.map((item) => (
              <div
                key={item.request.id}
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "6px",
                  padding: "10px 12px",
                  fontSize: "12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span className="method" style={{ minWidth: "34px", height: "16px", fontSize: "8px", padding: "0 3px", borderRadius: "3px" }}>
                      {item.request.method}
                    </span>
                    <strong style={{ color: "var(--color-text)" }}>{item.request.name}</strong>
                  </div>
                  {item.response && (
                    <span style={{ fontWeight: 700, color: "var(--color-status-error, #ef4444)" }}>
                      HTTP {item.response.status}
                    </span>
                  )}
                </div>

                {item.error && (
                  <div style={{ color: "var(--color-status-error, #ef4444)", marginTop: "6px", fontSize: "11px" }}>
                    Error: {item.error}
                  </div>
                )}

                {item.testResults?.filter((t) => !t.passed).map((t, idx) => (
                  <div key={idx} style={{ marginTop: "6px", color: "var(--color-status-error, #ef4444)", fontSize: "11px", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                    <XCircle size={13} style={{ flexShrink: 0, marginTop: "1px" }} />
                    <div>
                      <span><strong>Assertion failed:</strong> {t.name}</span>
                      {t.error && <div style={{ color: "var(--color-text-muted)", fontSize: "10px", marginTop: "2px" }}>{t.error}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Executed Requests Table */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <Filter size={13} style={{ color: "var(--color-text-muted)" }} />
          {(["all", "passed", "failed", "with-tests"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setSelectedFilter(filter)}
              style={{
                all: "unset",
                padding: "3px 8px",
                fontSize: "11px",
                fontWeight: 600,
                borderRadius: "4px",
                cursor: "pointer",
                background: selectedFilter === filter ? "var(--color-text-active)" : "var(--color-surface-muted)",
                color: selectedFilter === filter ? "#fff" : "var(--color-text-muted)",
                transition: "all 120ms ease",
              }}
            >
              {filter === "all" ? `All (${metrics.totalRequests})` : filter === "passed" ? `Passed (${metrics.passedRequests})` : filter === "failed" ? `Failed (${metrics.failedRequests})` : "With Tests"}
            </button>
          ))}
        </div>

        {onViewDetailedLogs && (
          <button
            type="button"
            className="ghost-button"
            onClick={onViewDetailedLogs}
            style={{
              fontSize: "11px",
              padding: "4px 8px",
              color: "var(--color-primary, #0066cc)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span>Detailed Logs</span>
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      {/* Results List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {filteredResults.map((result) => {
          const isExpanded = expandedRequestId === result.request.id;
          const isPassed = result.status === "passed";

          return (
            <div
              key={result.request.id}
              style={{
                background: "var(--color-surface-muted)",
                border: "1px solid var(--color-border)",
                borderRadius: "6px",
                overflow: "hidden",
                transition: "all 120ms ease",
              }}
            >
              <div
                onClick={() => setExpandedRequestId(isExpanded ? null : result.request.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  {isPassed ? (
                    <CheckCircle2 size={15} style={{ color: "var(--color-status-success, #10b981)", flexShrink: 0 }} />
                  ) : (
                    <XCircle size={15} style={{ color: "var(--color-status-error, #ef4444)", flexShrink: 0 }} />
                  )}

                  <span
                    className="method"
                    style={{
                      minWidth: "34px",
                      height: "16px",
                      fontSize: "8px",
                      padding: "0 3px",
                      borderRadius: "3px",
                      flexShrink: 0,
                    }}
                  >
                    {result.request.method}
                  </span>

                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {result.request.name}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0, fontSize: "11px" }}>
                  {result.response && (
                    <span
                      style={{
                        fontWeight: 700,
                        color: result.response.status < 400
                          ? "var(--color-status-success, #10b981)"
                          : "var(--color-status-error, #ef4444)",
                      }}
                    >
                      {result.response.status}
                    </span>
                  )}

                  {result.durationMs !== undefined && (
                    <span style={{ color: "var(--color-text-muted)" }}>
                      {result.durationMs}ms
                    </span>
                  )}

                  {result.testResults && result.testResults.length > 0 && (
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: "10px",
                        fontSize: "10px",
                        fontWeight: 700,
                        background: result.failedTests === 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        color: result.failedTests === 0 ? "var(--color-status-success, #10b981)" : "var(--color-status-error, #ef4444)",
                      }}
                    >
                      {result.passedTests || 0}/{result.testResults.length} tests
                    </span>
                  )}

                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </div>

              {/* Drawer details */}
              {isExpanded && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderTop: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                    fontSize: "12px",
                  }}
                >
                  {result.error && (
                    <div style={{ color: "var(--color-status-error, #ef4444)", marginBottom: "8px" }}>
                      <strong>Error:</strong> {result.error}
                    </div>
                  )}

                  {result.testResults && result.testResults.length > 0 && (
                    <div style={{ marginBottom: "10px" }}>
                      <div style={{ fontWeight: 700, marginBottom: "4px", color: "var(--color-text)" }}>Test Assertions:</div>
                      {result.testResults.map((t, idx) => (
                        <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginTop: "3px" }}>
                          {t.passed ? (
                            <CheckCircle2 size={13} style={{ color: "var(--color-status-success, #10b981)", flexShrink: 0, marginTop: "2px" }} />
                          ) : (
                            <XCircle size={13} style={{ color: "var(--color-status-error, #ef4444)", flexShrink: 0, marginTop: "2px" }} />
                          )}
                          <div>
                            <span style={{ color: t.passed ? "var(--color-status-success, #10b981)" : "var(--color-status-error, #ef4444)" }}>
                              {t.name}
                            </span>
                            {t.error && (
                              <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
                                {t.error}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.response && (
                    <div style={{ display: "flex", gap: "16px", color: "var(--color-text-muted)", fontSize: "11px", paddingTop: "6px", borderTop: "1px solid var(--color-border)" }}>
                      <span>Status: <strong style={{ color: "var(--color-text)" }}>{result.response.status} {result.response.statusText}</strong></span>
                      <span>Duration: <strong style={{ color: "var(--color-text)" }}>{result.durationMs}ms</strong></span>
                      <span>Size: <strong style={{ color: "var(--color-text)" }}>{formatBytes(result.response.sizeBytes || 0)}</strong></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
