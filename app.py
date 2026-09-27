from __future__ import annotations

import hmac
import json
import os
import secrets
import shutil
from pathlib import Path
from threading import Lock

from flask import Flask, jsonify, request, send_from_directory


ROOT = Path(__file__).resolve().parent
DATA_ROOT = Path(os.environ.get("LAB_DATA_DIR", ROOT / "data"))
CONTENT_ROOT = ROOT / "data"
PROGRESS_ROOT = DATA_ROOT / "progress"
MODE = os.environ.get("LAB_MODE", "demo")
FALLBACK_CODE = os.environ.get("LAB_ACCESS_CODE", "agent-team-2026")

app = Flask(__name__, static_folder="public", static_url_path="")
app.config.update(MAX_CONTENT_LENGTH=32_768, JSON_SORT_KEYS=False)
sessions: dict[str, dict[str, str]] = {}
session_lock = Lock()


def read_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def authenticate(identity: str, code: str) -> dict[str, str] | None:
    identity = identity.strip()[:80]
    if identity and hmac.compare_digest(code, FALLBACK_CODE):
        return {"id": "learner", "name": identity}
    return None


def current_user() -> dict[str, str] | None:
    token = request.headers.get("Authorization", "").removeprefix("Bearer ")
    with session_lock:
        return sessions.get(token)


@app.after_request
def security_headers(response):
    response.headers["Cache-Control"] = "no-store" if request.path.startswith("/api/") else "no-cache"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; style-src 'self' https://fonts.googleapis.com; "
        "font-src https://fonts.gstatic.com; script-src 'self'; img-src 'self' data:"
    )
    return response


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/api/health")
def health():
    return jsonify(
        status="ready",
        mode=MODE,
        services={"guide": True, "pi": bool(shutil.which("pi")), "scanner": bool(shutil.which("mcp-scanner"))},
    )


@app.post("/api/login")
def login():
    payload = request.get_json(silent=True) or {}
    user = authenticate(str(payload.get("name", "")), str(payload.get("code", "")))
    if not user:
        return jsonify(error="Check your name and access code."), 401
    token = secrets.token_urlsafe(32)
    with session_lock:
        sessions[token] = user
    return jsonify(token=token, user=user, mode=MODE)


@app.get("/api/modules")
def modules():
    if not current_user():
        return jsonify(error="Sign in to continue."), 401
    return jsonify(read_json(CONTENT_ROOT / "modules.json"))


@app.get("/api/scan-report")
def scan_report():
    if not current_user():
        return jsonify(error="Sign in to continue."), 401
    return jsonify(read_json(CONTENT_ROOT / "scan-report.demo.json"))


@app.get("/api/secure-access")
def secure_access():
    if not current_user():
        return jsonify(error="Sign in to continue."), 401
    return jsonify(read_json(CONTENT_ROOT / "secure-access.demo.json"))


@app.get("/api/topology")
def topology():
    if not current_user():
        return jsonify(error="Sign in to continue."), 401
    return jsonify(read_json(CONTENT_ROOT / "meraki-topology.demo.json"))


@app.route("/api/progress", methods=["GET", "PUT"])
def progress():
    user = current_user()
    if not user:
        return jsonify(error="Sign in to continue."), 401
    path = PROGRESS_ROOT / f"{user['id']}.json"
    if request.method == "GET":
        return jsonify(read_json(path) if path.exists() else {"completed": [], "answers": {}})

    payload = request.get_json(silent=True) or {}
    if not isinstance(payload.get("completed", []), list) or not isinstance(payload.get("answers", {}), dict):
        return jsonify(error="Invalid progress document."), 400
    PROGRESS_ROOT.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    temporary.replace(path)
    return jsonify(saved=True)


@app.errorhandler(413)
def too_large(_error):
    return jsonify(error="Request too large."), 413


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "8080")))
