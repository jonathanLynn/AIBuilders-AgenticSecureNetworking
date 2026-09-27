import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const reports = join(root, "reports");
await mkdir(reports, { recursive: true });

function runAgent(role, task, evidence) {
  return new Promise((resolve, reject) => {
    const prompt = `You are the ${role} agent in a supervised network investigation.\n${task}\nUse only the supplied evidence. Never claim a production change was made. End with a compact JSON object containing finding, evidence_ids, confidence, and next_gate.\n\nEvidence:\n${evidence}`;
    const child = spawn("pi", ["--print", prompt], { cwd: root, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", chunk => stdout += chunk);
    child.stderr.on("data", chunk => stderr += chunk);
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(stdout.trim()) : reject(new Error(`${role} failed (${code}): ${stderr.trim()}`)));
  });
}

const topology = await readFile(join(root, "data/meraki-topology.demo.json"), "utf8");
const scan = await readFile(join(root, "data/scan-report.demo.json"), "utf8");
const policy = await readFile(join(root, "data/secure-access.demo.json"), "utf8");

const scout = await runAgent("Scout", "Find the smallest supported fault domain in the topology.", topology);
await writeFile(join(reports, "01-scout.txt"), scout);
const sentinel = await runAgent("Sentinel", "Decide which tools may be used in this workflow and why.", scan);
await writeFile(join(reports, "02-sentinel.txt"), sentinel);
const analyst = await runAgent("Analyst", "Correlate the network finding with policy evidence. Separate correlation from causation.", `${policy}\n\nScout handoff:\n${scout}`);
await writeFile(join(reports, "03-analyst.txt"), analyst);
const lead = await runAgent("Lead", "Create a concise action brief. Stop at human approval and include no execution steps that change production.", `Scout:\n${scout}\n\nSentinel:\n${sentinel}\n\nAnalyst:\n${analyst}`);
await writeFile(join(reports, "04-lead.txt"), lead);

console.log(lead);
console.log("\nAgent handoffs written to reports/01-scout.txt through reports/04-lead.txt");
