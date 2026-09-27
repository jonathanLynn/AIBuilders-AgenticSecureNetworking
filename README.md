# Agent Foundry — native Python deployment

This branch deploys one complete Agent Foundry lab for one learner on a standard Linux virtual machine. It uses Python virtual environments for the web service, Cisco AI Defense MCP Scanner and learner workspace. It does not use Docker.

The browser guide, quizzes, demo scan report, Secure Access policy exercise, Meraki topology and supervised multi-agent workflow are the same as the container build.

## Architecture

- `/opt/agent-foundry/app` — immutable application and course content.
- `/opt/agent-foundry/venv` — shared, read-only Python runtime containing Flask, Waitress and MCP Scanner.
- `/srv/agent-foundry/learner` — the learner's private home, workspace, reports and Python virtual environment.
- `/etc/agent-foundry` — root-owned service configuration and access code.
- `/var/lib/agent-foundry` — web progress data, writable only by the service account.
- `agent-foundry.service` — hardened systemd unit running a four-thread Waitress service on port 8080.

Linux user permissions provide the Pi process boundary. The shared application and scanner runtime are administrator-owned and read-only. Isolation between candidates comes from placing each deployment on its own VM.

## Host requirements

- A systemd Linux distribution using `apt` or `dnf.
- Root access during installation.
- Python 3.11.4 or newer.
- Node.js 22.19 or newer and npm for Pi. The installer checks this requirement rather than replacing an existing Node installation.
- Recommended per VM: 2–4 vCPU, 4–8 GB RAM and 12 GB free disk. Size the VM for the selected model client and expected scan workload.

## Install the host

Clone this branch on the target host, then run:

```bash
sudo ./scripts/setup.sh
```

The first command:

1. Installs Python host prerequisites.
2. Copies the application to `/opt/agent-foundry/app`.
3. Creates `/opt/agent-foundry/venv`.
4. Installs Flask 3.1.3, Waitress 3.0.2 and Cisco AI Defense MCP Scanner 4.8.4.
5. Installs Pi 0.87.1 when a suitable Node/npm runtime is available.
6. Creates the `agentlab` Linux user and its private venv, workspace and reports directory.
7. Creates and starts the hardened systemd service.

Credentials are written to `/root/agent-foundry-credentials.txt` with mode `0600`. By default, the same access code is applied as the `agentlab` Linux password. Set `ENABLE_LOCAL_PASSWORD=0` if access is managed by an SSH key or an external identity system.

Open `http://HOST:8080` and sign in with your name and the VM's access code.

## Deploy for 40 learners

Create a clean VM image or automation template containing this repository, then run the installer once on each VM. Every VM generates its own access code and progress store.

Do not clone an already-running VM after installation unless your image pipeline deletes these machine-specific files before first boot:

```text
/etc/agent-foundry/agent-foundry.env
/root/agent-foundry-credentials.txt
/var/lib/agent-foundry/progress/
```

The preferred sequence is to clone a base operating-system image and run `scripts/setup.sh` independently through cloud-init, Ansible, Terraform provisioning or your VM platform's guest customisation. This guarantees unique credentials and clean progress on every machine.

## Learner terminal

If the host allows password-based SSH, the learner can connect with the VM's account:

```bash
ssh agentlab@HOST
source ~/.venv/bin/activate
/opt/agent-foundry/app/scripts/verify.sh
```

The installer does not edit `sshd_config`. For a public or remote event, prefer short-lived SSH certificates, individual public keys, or an identity-aware bastion. Avoid exposing port 8080 directly to the Internet; place TLS and your normal authentication proxy in front of it.

The installer does not edit `sshd_config`. Store each VM's credential file in the instructor's approved secret-sharing system and distribute it only to that VM's learner.

## Lab flow

1. **Boot the foundry** — activate the private venv, verify Pi and MCP Scanner, and identify the Linux permission boundary.
2. **Inspect the tools** — scan the intentionally unsafe MCP tool definition and explain the evidence.
3. **Read the policy** — analyse a Secure Access snapshot or use the instructor's authenticated, read-only gateway.
4. **Map the network** — use Meraki MCP discovery to construct a topology and locate a fault domain.
5. **Run the team** — pass structured evidence through Scout, Sentinel, Analyst and Lead, ending at human approval.

The unsafe fixture never performs a network request and uses the reserved `.invalid` domain.

## Run the scanner

From a learner account:

```bash
source ~/.venv/bin/activate
/opt/agent-foundry/app/scripts/run-scan.sh
python -m json.tool ~/reports/mcp-scan.json
```

The default scan uses offline YARA, prompt-defense and readiness analysers. Cisco AI Defense or LLM credentials remain optional and must be distributed through an instructor-controlled secret mechanism.

## Live Secure Access MCP

Keep the Secure Access OAuth key and secret on an instructor host. Install the community server into its own Python virtual environment:

```bash
sudo git clone https://github.com/CiscoDevNet/secure-access-mcp-community.git /opt/secure-access-mcp-community
sudo python3 -m venv /opt/secure-access-mcp-community/.venv
sudo /opt/secure-access-mcp-community/.venv/bin/pip install -r /opt/secure-access-mcp-community/requirements.txt

export SECURE_ACCESS_API_KEY='...'
export SECURE_ACCESS_API_SECRET='...'
export SECURE_ACCESS_MCP_TOKEN='a-long-random-client-token'
sudo -E /opt/agent-foundry/app/scripts/start-secure-access.sh
```

The wrapper binds to loopback, enables destructive-action confirmation and redacts PII. Publish it only through an authenticated TLS gateway. Learners should receive a short-lived gateway token, never the tenant OAuth secret.

## Live Meraki MCP with Pi

The hosted Meraki MCP endpoint is `https://mcp.meraki.com/mcp`. It is read-only, but the Dashboard API identity must also be read-only because an agent could try to call the API directly with an exposed key.

Pi intentionally keeps MCP outside its core. Learners can install the pinned `pi-code` extension after reviewing its source:

```bash
pi install npm:pi-code@1.0.77
cp /opt/agent-foundry/app/.mcp.json.example ~/workspace/.mcp.json
export MERAKI_DASHBOARD_API_KEY='read-only-lab-key'
cd ~/workspace && pi
# Approve the project, then run /mcp.
```

Across 40 VMs, use a dedicated lab organisation with individual read-only identities or an instructor gateway. Stagger live discovery so the cohort does not exhaust organisation-level API limits.

## Orchestration

Run the deterministic Python workflow first:

```bash
python /opt/agent-foundry/app/scripts/orchestrate.py --scenario branch-loss
```

After authenticating Pi to an approved model, run four real model turns:

```bash
python /opt/agent-foundry/app/scripts/orchestrate_pi.py
```

Both write handoffs under `~/reports` and stop at human approval.

## Operations

```bash
systemctl status agent-foundry
journalctl -u agent-foundry -f
curl -fsS http://127.0.0.1:8080/api/health
```

Run the application tests inside the shared venv:

```bash
cd /opt/agent-foundry/app
/opt/agent-foundry/venv/bin/python -m unittest discover -s tests -v
```

Upgrade by pulling this branch in the source checkout and rerunning `sudo ./scripts/setup.sh`. The installer replaces immutable application files, updates the shared venv and restarts the service. It preserves `/etc/agent-foundry`, `/var/lib/agent-foundry` and learner homes.

## Boundaries

- This is a workshop platform, not a production LMS.
- Linux accounts isolate learner files, but they share the host kernel and network.
- Live tenant access belongs behind instructor-managed MCP gateways.
- Scanner results support review; they do not prove that a tool is safe.
- Agents recommend production actions and the supplied workflow stops before execution.
