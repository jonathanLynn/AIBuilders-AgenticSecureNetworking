import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const topology = JSON.parse(await readFile(join(root, "data/meraki-topology.demo.json"), "utf8"));
const policy = JSON.parse(await readFile(join(root, "data/secure-access.demo.json"), "utf8"));
const scan = JSON.parse(await readFile(join(root, "data/scan-report.demo.json"), "utf8"));
const scenario = process.argv.includes("--scenario") ? process.argv[process.argv.indexOf("--scenario") + 1] : "branch-loss";

const trace = [
  { agent: "Scout", status: "complete", evidence: ["meraki:MS-ACCESS-03", "meraki:MS-CORE-01"], finding: "Loss is isolated downstream of the core toward access switch MS-ACCESS-03.", confidence: 0.82 },
  { agent: "Sentinel", status: "complete", evidence: [scan.scanId], finding: "The support-export tool is unsafe and excluded from the workflow.", confidence: 0.99 },
  { agent: "Analyst", status: "complete", evidence: ["secure-access:SA-104", "secure-access:SA-221"], finding: `${policy.gaps.length} policy opportunities exist; none explains physical uplink loss.`, confidence: 0.76 },
  { agent: "Lead", status: "awaiting_human", evidence: ["meraki:MS-ACCESS-03", scan.scanId, "secure-access:SA-104"], finding: "Inspect the MS-ACCESS-03 uplink and recent switch events. Keep policy changes out of this incident action.", confidence: 0.84 }
];

const report = { scenario, generatedAt: new Date().toISOString(), topologyNodes: topology.nodes.length, decision: "human_approval_required", trace };
await mkdir(join(root, "reports"), { recursive: true });
await writeFile(join(root, "reports/workflow-report.json"), JSON.stringify(report, null, 2));
console.log(trace.map((x, i) => `${i + 1}. ${x.agent.padEnd(8)} ${x.status.padEnd(16)} ${x.finding}`).join("\n"));
console.log("\nStopped at the human approval gate. Report: reports/workflow-report.json");
