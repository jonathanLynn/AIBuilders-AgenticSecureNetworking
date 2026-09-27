# Agent Foundry

Agent Foundry is a container-ready, five-module lab for up to 40 learners. Candidates use the [Pi agent harness](https://github.com/earendil-works/pi), scan an intentionally unsafe MCP tool with Cisco AI Defense MCP Scanner, analyse a Secure Access policy snapshot, map a Meraki topology, and run a small evidence-driven multi-agent workflow.

The package runs completely in demo mode without private credentials. Live Secure Access and Meraki exercises are instructor-controlled upgrades to the same flow.

## What is included

- A responsive web guide with sign-in, server-side progress, interactive reports, topology, quizzes and module gates.
- A deliberately vulnerable, inert MCP training fixture. Its exfiltration endpoint is the reserved `.invalid` domain and the fixture makes no network request.
- Cisco AI Defense MCP Scanner 4.7.5 with offline YARA, prompt-defense and readiness scanning.
- Pi 0.87.1 installed from `@earendil-works/pi-coding-agent`, with the pinned `pi-code` 1.0.77 extension for MCP and subagent support.
- A deterministic four-agent orchestration exercise with evidence IDs and a human approval gate.
- Docker deployment for one seat and a cohort provisioner for 1–40 isolated seats.

## Quick start

Docker is the recommended trust boundary because Pi runs with the permissions of the process that launches it.

```bash
cp .env.example .env
# Change LAB_ACCESS_CODE in .env
./scripts/setup.sh docker
docker compose up -d
```

Open `http://HOST:8080`, enter a name, and use the access code from `.env`. To inspect the lab terminal:

```bash
docker compose exec lab bash
./scripts/verify.sh
```

For a native Linux install with Node.js 22.19+ and `uv` already present:

```bash
./scripts/setup.sh native
npm start
```

## Provision 40 isolated seats

Build the image once, then create a container, writable home, workspace, progress store and reports volume for each learner:

```bash
./scripts/setup.sh docker
./scripts/provision-cohort.sh 40
```

The script writes `users.csv` with URLs and random access codes, mode `0600`. Ports default to `9001–9040`; set `BASE_PORT` to move the range. Each seat is capped at 1.5 CPU, 2 GB RAM and 256 processes, so a full cohort should have roughly 64 vCPU, 96 GB RAM and 120 GB free disk if everyone may run Pi concurrently. Reduce limits only after a rehearsal with the intended model and exercises.

Learners enter their container with:

```bash
docker exec -it agent-foundry-01 bash
```

Place TLS and your identity-aware proxy in front of the port range for a remote event. The built-in access code is a cohort admission control, not an Internet-facing identity system.

## Lab flow

1. **Boot the foundry** — run readiness checks and learn the container trust boundary.
2. **Inspect the tools** — scan a suspicious MCP tool definition and interpret the report.
3. **Read the policy** — analyse Secure Access policies in demo or live, read-only mode.
4. **Map the network** — discover Meraki capabilities and build a topology.
5. **Run the team** — pass structured evidence across Scout, Sentinel, Analyst and Lead agents, stopping at human review.

The default access code is `agent-team-2026` for local evaluation. Change it before a cohort.

## Live Secure Access

Use the community server on an instructor-controlled host. Do not copy the Secure Access OAuth client secret into learner containers.

```bash
git clone https://github.com/CiscoDevNet/secure-access-mcp-community.git /opt/secure-access-mcp-community
cd /opt/secure-access-mcp-community
uv venv --python 3.11
uv pip install -r requirements.txt

export SECURE_ACCESS_API_KEY='...'
export SECURE_ACCESS_API_SECRET='...'
export SECURE_ACCESS_MCP_TOKEN='a-long-random-client-token'
cd /path/to/agent-foundry
./scripts/start-secure-access.sh
```

The wrapper binds to loopback, enables destructive-action confirmation, and redacts PII. Publish it to learner agents only through an authenticated TLS gateway. Prefer API scopes limited to policy and reports. The exercise produces recommendations; it does not apply them.

## Live Meraki

Cisco's hosted MCP endpoint is `https://mcp.meraki.com/mcp` and exposes two workflow tools: `semantic_search` and `execute_api`. Pi intentionally does not ship MCP integration in its core; this image adds the third-party `pi-code` extension, pinned to 1.0.77, which loads Claude-compatible MCP configuration after the candidate approves project trust. Review extension source before changing the pin.

Copy the supplied example, set the environment variables in the learner container, and keep the API key tied to a read-only Meraki Dashboard user:

```bash
cp .mcp.json.example .mcp.json
export MERAKI_DASHBOARD_API_KEY='read-only-lab-key'
pi
# Approve this lab project when Pi asks, then run /mcp.
```

For a 40-person class, do not distribute one production key. Use a lab organisation with read-only users or broker the requests through an instructor gateway. Meraki applies rate limits per organisation, so stagger the live exercise and cache inventory where your terms and data policy permit.

## Scanner modes

The repeatable learner exercise is offline:

```bash
./scripts/run-scan.sh
```

It scans `lab/vulnerable-mcp/tools.json` and writes `reports/mcp-scan.json`. The browser includes a stable demo report so the quiz still works before tools are installed. An instructor may add the Cisco API or an approved LLM analyser by setting the relevant environment variables from `.env.example`; never put those keys in the browser bundle.

## Operations

Run the local checks with:

```bash
npm test
node --check server.mjs
node scripts/orchestrate.mjs --scenario branch-loss
```

After configuring a Pi model, run the same workflow with four real model turns:

```bash
node scripts/orchestrate-pi.mjs
```

The live runner writes one handoff per agent under `reports/` and still instructs the Lead to stop at human approval.

Progress lives in a per-seat Docker volume. The app stores no private tenant credentials and serves demo JSON only. Back up the volumes if completion records matter; for formal assessment, send progress events to your LMS or identity-backed datastore rather than relying on this lightweight store.

## Design boundaries

- The package is a working workshop foundation, not a production LMS.
- Live tenant access stays behind instructor-managed MCP gateways.
- Meraki uses read-only Dashboard identities.
- Agents can recommend production changes but the supplied workflow stops at human approval.
- Scanner results are evidence for review, not a guarantee that a tool is safe.
