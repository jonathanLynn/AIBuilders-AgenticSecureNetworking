#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scenario", default="branch-loss")
    args = parser.parse_args()
    topology = json.loads((ROOT / "data/meraki-topology.demo.json").read_text())
    policy = json.loads((ROOT / "data/secure-access.demo.json").read_text())
    scan = json.loads((ROOT / "data/scan-report.demo.json").read_text())
    trace = [
        {"agent": "Scout", "status": "complete", "evidence": ["meraki:MS-ACCESS-03", "meraki:MS-CORE-01"], "finding": "Loss is isolated downstream of the core toward MS-ACCESS-03.", "confidence": 0.82},
        {"agent": "Sentinel", "status": "complete", "evidence": [scan["scanId"]], "finding": "The support-export tool is unsafe and excluded.", "confidence": 0.99},
        {"agent": "Analyst", "status": "complete", "evidence": ["secure-access:SA-104", "secure-access:SA-221"], "finding": f"{len(policy['gaps'])} policy opportunities exist; none explains physical loss.", "confidence": 0.76},
        {"agent": "Lead", "status": "awaiting_human", "evidence": ["meraki:MS-ACCESS-03", scan["scanId"]], "finding": "Inspect the access-switch uplink and recent events.", "confidence": 0.84},
    ]
    report = {"scenario": args.scenario, "generatedAt": datetime.now(timezone.utc).isoformat(), "topologyNodes": len(topology["nodes"]), "decision": "human_approval_required", "trace": trace}
    output = Path.home() / "reports/workflow-report.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2))
    for index, item in enumerate(trace, 1):
        print(f"{index}. {item['agent']:<8} {item['status']:<16} {item['finding']}")
    print(f"\nStopped at the human approval gate. Report: {output}")


if __name__ == "__main__":
    main()
