import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");

test("TestRunReport component exists and exposes comprehensive KPI metrics and export functionality", () => {
  const reportCode = read("src/renderer/src/components/runner/TestRunReport.tsx");

  // Verify KPI & metric computations
  assert.match(reportCode, /export function TestRunReport/);
  assert.match(reportCode, /testPassRate/);
  assert.match(reportCode, /avgDuration/);
  assert.match(reportCode, /totalBytes/);
  assert.match(reportCode, /status2xx/);
  assert.match(reportCode, /failedItems/);

  // Verify export capabilities
  assert.match(reportCode, /handleCopyMarkdown/);
  assert.match(reportCode, /handleExportHtml/);
  assert.match(reportCode, /handleExportJson/);
  assert.match(reportCode, /Copy Markdown/);
  assert.match(reportCode, /runner\.exportHtml/);
  assert.match(reportCode, /Response Time Distribution/);
});

test("CollectionRunner integrates TestRunReport with viewMode toggle", () => {
  const runnerCode = read("src/renderer/src/components/CollectionRunner.tsx");

  assert.match(runnerCode, /import { TestRunReport } from "\.\/runner\/TestRunReport"/);
  assert.match(runnerCode, /const \[viewMode, setViewMode\] = useState/);
  assert.match(runnerCode, /setViewMode\("report"\)/);
  assert.match(runnerCode, /<TestRunReport/);
  assert.match(runnerCode, /Summary Report/);
  assert.match(runnerCode, /Request Logs/);
});

test("RunnerHistoryView supports TestRunReport for historical runs", () => {
  const historyCode = read("src/renderer/src/components/runner/RunnerHistoryView.tsx");

  assert.match(historyCode, /import { TestRunReport/);
  assert.match(historyCode, /<TestRunReport/);
  assert.match(historyCode, /viewMode === "report"/);
});
