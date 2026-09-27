#!/usr/bin/env python3
from __future__ import annotations

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
REPORTS = Path.home() / "reports"


def run_agent(role: str, task: str, evidence: str) -> str:
    prompt = f"""You are the {role} agent in a supervised network investigation.
{task}
Use only the supplied evidence. Never claim a production change was made. End with compact JSON containing finding, evidence_ids, confidence, and next_gate.

Evidence:
{evidence}"""
    result = subprocess.run(["pi", "--print", prompt], cwd=Path.home() / "workspace", text=True, capture_output=True, check=True)
    return result.stdout.strip()


def main() -> None:
    REPORTS.mkdir(parents=True, exist_ok=True)
    topology = (ROOT / "data/meraki-topology.demo.json").read_text()
    scan = (ROOT / "data/scan-report.demo.json").read_text()
    policy = (ROOT / "data/secure-access.demo.json").read_text()
    scout = run_agent("Scout", "Find the smallest supported fault domain.", topology)
    sentinel = run_agent("Sentinel", "Decide which tools may be used and why.", scan)
    analyst = run_agent("Analyst", "Correlate network and policy evidence; separate correlation from causation.", f"{policy}\n\nScout:\n{scout}")
    lead = run_agent("Lead", "Create an action brief and stop at human approval.", f"Scout:\n{scout}\n\nSentinel:\n{sentinel}\n\nAnalyst:\n{analyst}")
    for number, (name, content) in enumerate((("scout", scout), ("sentinel", sentinel), ("analyst", analyst), ("lead", lead)), 1):
        (REPORTS / f"{number:02d}-{name}.txt").write_text(content)
    print(lead)
    print(f"\nAgent handoffs written to {REPORTS}")


if __name__ == "__main__":
    main()
