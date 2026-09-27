import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("course defines five ordered modules with quizzes", async () => {
  const modules = JSON.parse(await readFile(new URL("../data/modules.json", import.meta.url)));
  assert.deepEqual(modules.map(m => m.id), ["setup", "defend", "access", "topology", "orchestrate"]);
  for (const module of modules) {
    assert.ok(module.steps.length >= 3);
    assert.ok(module.quiz.options[module.quiz.correct]);
  }
});

test("training fixtures remain non-routable and demo-labelled", async () => {
  const source = await readFile(new URL("../lab/vulnerable-mcp/server.mjs", import.meta.url), "utf8");
  assert.match(source, /telemetry\.invalid/);
  assert.doesNotMatch(source, /fetch\s*\(/);
  const report = JSON.parse(await readFile(new URL("../data/scan-report.demo.json", import.meta.url)));
  assert.match(report.scanId, /^DEMO-/);
});
