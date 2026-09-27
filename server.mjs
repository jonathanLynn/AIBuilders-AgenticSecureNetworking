import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicRoot = join(root, "public");
const port = Number(process.env.PORT || 8080);
const mode = process.env.LAB_MODE || "demo";
const accessCode = process.env.LAB_ACCESS_CODE || "agent-team-2026";
const sessions = new Map();
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json; charset=utf-8" };

const json = (res, status, value) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
};

async function body(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 32_768) throw new Error("Request too large");
  }
  return raw ? JSON.parse(raw) : {};
}

function currentUser(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  return token && sessions.get(token);
}

async function readData(name) {
  return JSON.parse(await readFile(join(root, "data", name), "utf8"));
}

async function api(req, res, pathname) {
  if (pathname === "/api/health") {
    return json(res, 200, { status: "ready", mode, services: { guide: true, pi: commandExists("pi"), scanner: commandExists("mcp-scanner") } });
  }
  if (pathname === "/api/login" && req.method === "POST") {
    const input = await body(req);
    if (!input.name?.trim() || input.code !== accessCode) return json(res, 401, { error: "Check your name and access code." });
    const token = randomUUID();
    const name = input.name.trim().slice(0, 80);
    const user = { id: createHash("sha256").update(name.toLowerCase()).digest("hex").slice(0, 20), name };
    sessions.set(token, user);
    return json(res, 200, { token, user, mode });
  }
  const user = currentUser(req);
  if (!user) return json(res, 401, { error: "Sign in to continue." });
  if (pathname === "/api/modules") return json(res, 200, await readData("modules.json"));
  if (pathname === "/api/scan-report") return json(res, 200, await readData("scan-report.demo.json"));
  if (pathname === "/api/secure-access") return json(res, 200, await readData("secure-access.demo.json"));
  if (pathname === "/api/topology") return json(res, 200, await readData("meraki-topology.demo.json"));
  if (pathname === "/api/progress" && req.method === "GET") {
    const path = join(root, "data", "progress", `${user.id}.json`);
    return json(res, 200, existsSync(path) ? JSON.parse(await readFile(path, "utf8")) : { completed: [], answers: {} });
  }
  if (pathname === "/api/progress" && req.method === "PUT") {
    const progress = await body(req);
    await mkdir(join(root, "data", "progress"), { recursive: true });
    await writeFile(join(root, "data", "progress", `${user.id}.json`), JSON.stringify(progress, null, 2));
    return json(res, 200, { saved: true });
  }
  return json(res, 404, { error: "Not found" });
}

function commandExists(command) {
  const paths = (process.env.PATH || "").split(":");
  return paths.some((p) => existsSync(join(p, command)));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) return await api(req, res, url.pathname);
    const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const path = normalize(join(publicRoot, requested));
    if (!path.startsWith(publicRoot)) return json(res, 403, { error: "Forbidden" });
    const data = await readFile(path);
    res.writeHead(200, { "content-type": mime[extname(path)] || "application/octet-stream", "x-content-type-options": "nosniff" });
    res.end(data);
  } catch (error) {
    if (error.code === "ENOENT") return json(res, 404, { error: "Not found" });
    console.error(error);
    return json(res, 500, { error: "Lab service error" });
  }
});

server.listen(port, "0.0.0.0", () => console.log(`Agentic Team Lab ready on http://0.0.0.0:${port} (${mode})`));
