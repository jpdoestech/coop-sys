const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const ASSETS = __COOP_EMBEDDED_ASSETS__;
const args = Object.fromEntries(process.argv.slice(2).filter((arg) => arg.startsWith("--")).map((arg) => {
  const [key, ...value] = arg.slice(2).split("=");
  return [key, value.join("=") || "true"];
}));
const port = Number(args.port || 8787);
const dataDir = path.resolve(args["data-dir"] || path.join(path.dirname(process.execPath), "data"));
const databasePath = path.join(dataDir, "cooperative-records.db");
const configPath = path.join(dataDir, "server-config.json");
fs.mkdirSync(dataDir, { recursive: true });

function defaultConfig() {
  return {
    deploymentMode: "LAN_ONLY",
    autoSync: false,
    syncIntervalMinutes: 5,
    remoteUrl: "",
    replicationKey: crypto.randomBytes(32).toString("hex"),
  };
}

function readConfig() {
  if (!fs.existsSync(configPath)) fs.writeFileSync(configPath, JSON.stringify(defaultConfig(), null, 2));
  try { return { ...defaultConfig(), ...JSON.parse(fs.readFileSync(configPath, "utf8")) }; }
  catch { return defaultConfig(); }
}

const db = new DatabaseSync(databasePath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 10000;
  CREATE TABLE IF NOT EXISTS server_migrations (
    version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS app_storage (
    storage_key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    modified_at TEXT NOT NULL,
    modified_by TEXT
  );
  CREATE TABLE IF NOT EXISTS server_users (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    role TEXT NOT NULL,
    branch_ids TEXT NOT NULL DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 1,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    must_change_password INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS server_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES server_users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS server_sync_log (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    direction TEXT NOT NULL,
    records_processed INTEGER NOT NULL DEFAULT 0,
    message TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS server_users_email_idx ON server_users(email);
  CREATE INDEX IF NOT EXISTS server_sessions_expiry_idx ON server_sessions(expires_at);
`);

function now() { return new Date().toISOString(); }
function id() { return crypto.randomUUID(); }
function passwordHash(password, salt) { return crypto.scryptSync(password, Buffer.from(salt, "base64"), 64).toString("base64"); }
function seedAdmin() {
  const count = db.prepare("SELECT count(*) AS count FROM server_users").get().count;
  if (count) return;
  const salt = crypto.randomBytes(16).toString("base64");
  const timestamp = now();
  db.prepare(`INSERT INTO server_users
    (id, display_name, email, role, branch_ids, is_active, password_salt, password_hash, must_change_password, created_at, updated_at)
    VALUES (?, ?, ?, ?, '[]', 1, ?, ?, 1, ?, ?)`)
    .run("72000000-0000-4000-8000-000000000001", "System Administrator", "admin@example.test", "super_admin", salt, passwordHash("ChangeMe123!", salt), timestamp, timestamp);
}
seedAdmin();

const readStorage = db.prepare("SELECT storage_key, value, revision, modified_at FROM app_storage");
const getStorage = db.prepare("SELECT storage_key, value, revision, modified_at FROM app_storage WHERE storage_key = ?");
const saveStorage = db.prepare(`INSERT INTO app_storage(storage_key,value,revision,modified_at,modified_by)
  VALUES(?,?,1,?,?) ON CONFLICT(storage_key) DO UPDATE SET value=excluded.value,
  revision=app_storage.revision+1, modified_at=excluded.modified_at, modified_by=excluded.modified_by`);

function mergeById(current, incoming) {
  const records = new Map((Array.isArray(current) ? current : []).map((item) => [item.id, item]));
  for (const item of Array.isArray(incoming) ? incoming : []) {
    const existing = records.get(item.id);
    if (!existing || !existing.updated_at || !item.updated_at || item.updated_at >= existing.updated_at) records.set(item.id, item);
  }
  return Array.from(records.values());
}
function mergeStorageValue(key, currentValue, incomingValue) {
  if (!currentValue) return incomingValue;
  try {
    const current = JSON.parse(currentValue), incoming = JSON.parse(incomingValue);
    if (key === "coop_sys_members" || key === "coop_sys_employees") return JSON.stringify(mergeById(current, incoming));
    if (key === "coop_sys_organization_directory") return JSON.stringify({
      branches: mergeById(current.branches, incoming.branches), clients: mergeById(current.clients, incoming.clients),
      departments: mergeById(current.departments, incoming.departments), positions: mergeById(current.positions, incoming.positions),
    });
    if (key === "coop_sys_payment_ledger") return JSON.stringify({
      settings: mergeById(current.settings, incoming.settings), aliases: mergeById(current.aliases, incoming.aliases),
      batches: mergeById(current.batches, incoming.batches), payments: mergeById(current.payments, incoming.payments),
      settlements: mergeById(current.settlements, incoming.settlements), corrections: mergeById(current.corrections, incoming.corrections),
      refunds: mergeById(current.refunds, incoming.refunds), paymentTotal: incoming.paymentTotal || 0, refundTotal: incoming.refundTotal || 0,
    });
  } catch {}
  return incomingValue;
}

const writableRoles = {
  coop_sys_members: new Set(["super_admin", "general_manager", "hr_manager", "head_office_staff", "branch_admin"]),
  coop_sys_employees: new Set(["super_admin", "general_manager", "hr_manager", "head_office_staff", "branch_admin"]),
  coop_sys_organization_directory: new Set(["super_admin", "general_manager", "hr_manager"]),
  coop_sys_payment_ledger: new Set(["super_admin", "general_manager", "accounting_manager", "head_office_staff", "branch_admin"]),
};

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map((part) => part.trim().split("=")).filter((pair) => pair.length === 2));
}
function currentUser(req) {
  const token = parseCookies(req).coop_session;
  if (!token) return null;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return db.prepare(`SELECT u.* FROM server_sessions s JOIN server_users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>? AND u.is_active=1`).get(tokenHash, now()) || null;
}
function sessionFor(user) {
  return {
    profile: { userId: user.id, displayName: user.display_name, role: user.role, branchIds: JSON.parse(user.branch_ids || "[]") },
    email: user.email,
    mode: "offline",
    mustChangePassword: Boolean(user.must_change_password),
  };
}
function json(res, status, value, headers = {}) {
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": body.length, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers });
  res.end(body);
}
function body(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; if (raw.length > 25_000_000) reject(new Error("Request is too large.")); });
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error("Invalid JSON request.")); } });
    req.on("error", reject);
  });
}
function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) json(res, 401, { error: "Your server session has expired." });
  return user;
}
function safeUser(row) {
  return { id: row.id, display_name: row.display_name, email: row.email, role: row.role, branch_ids: JSON.parse(row.branch_ids || "[]"), is_active: Boolean(row.is_active), created_at: row.created_at, updated_at: row.updated_at };
}

async function runSync() {
  const config = readConfig();
  const startedAt = now();
  const logId = id();
  db.prepare("INSERT INTO server_sync_log(id,status,direction,started_at) VALUES(?, 'started', 'bidirectional', ?)").run(logId, startedAt);
  if (config.deploymentMode !== "HYBRID" || !config.remoteUrl) {
    const message = "Hybrid mode is not configured. Update data/server-config.json on the host.";
    db.prepare("UPDATE server_sync_log SET status='failed',message=?,completed_at=? WHERE id=?").run(message, now(), logId);
    throw new Error(message);
  }
  try {
    const local = readStorage.all();
    const response = await fetch(`${config.remoteUrl.replace(/\/$/, "")}/api/replication/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.replicationKey}` },
      body: JSON.stringify({ records: local }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Remote server returned ${response.status}.`);
    let processed = 0;
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const record of payload.records || []) {
        const localRecord = getStorage.get(record.storage_key);
        if (!localRecord || record.modified_at > localRecord.modified_at) {
          db.prepare(`INSERT INTO app_storage(storage_key,value,revision,modified_at,modified_by) VALUES(?,?,?,?,?)
            ON CONFLICT(storage_key) DO UPDATE SET value=excluded.value,revision=excluded.revision,modified_at=excluded.modified_at,modified_by='sync'`)
            .run(record.storage_key, record.value, record.revision || 1, record.modified_at, "sync");
          processed += 1;
        }
      }
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    db.prepare("UPDATE server_sync_log SET status='completed',records_processed=?,message=?,completed_at=? WHERE id=?")
      .run(processed, "Synchronization completed.", now(), logId);
    return { status: "completed", recordsProcessed: processed, completedAt: now() };
  } catch (error) {
    db.prepare("UPDATE server_sync_log SET status='failed',message=?,completed_at=? WHERE id=?").run(error.message, now(), logId);
    throw error;
  }
}

async function api(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, { status: "ok", database: path.basename(databasePath), journalMode: db.prepare("PRAGMA journal_mode").get().journal_mode, deploymentMode: readConfig().deploymentMode });
  }
  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const input = await body(req);
    const user = db.prepare("SELECT * FROM server_users WHERE email=? COLLATE NOCASE AND is_active=1").get(String(input.email || "").trim());
    if (!user || !crypto.timingSafeEqual(Buffer.from(user.password_hash, "base64"), Buffer.from(passwordHash(String(input.password || ""), user.password_salt), "base64")))
      return json(res, 401, { error: "Email or password is incorrect." });
    const token = crypto.randomBytes(32).toString("base64url");
    const expires = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    db.prepare("DELETE FROM server_sessions WHERE expires_at<=?").run(now());
    db.prepare("INSERT INTO server_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)")
      .run(crypto.createHash("sha256").update(token).digest("hex"), user.id, expires, now());
    return json(res, 200, { session: sessionFor(user) }, { "Set-Cookie": `coop_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200` });
  }
  if (req.method === "GET" && url.pathname === "/api/auth/session") {
    const user = currentUser(req);
    return json(res, 200, { session: user ? sessionFor(user) : null });
  }
  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const token = parseCookies(req).coop_session;
    if (token) db.prepare("DELETE FROM server_sessions WHERE token_hash=?").run(crypto.createHash("sha256").update(token).digest("hex"));
    return json(res, 200, { ok: true }, { "Set-Cookie": "coop_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" });
  }
  if (req.method === "POST" && url.pathname === "/api/auth/change-password") {
    const user = requireUser(req, res); if (!user) return;
    const input = await body(req); const password = String(input.password || "");
    if (password.length < 12) return json(res, 400, { error: "Password must contain at least 12 characters." });
    const salt = crypto.randomBytes(16).toString("base64");
    db.prepare("UPDATE server_users SET password_salt=?,password_hash=?,must_change_password=0,updated_at=? WHERE id=?")
      .run(salt, passwordHash(password, salt), now(), user.id);
    return json(res, 200, { session: sessionFor(db.prepare("SELECT * FROM server_users WHERE id=?").get(user.id)) });
  }

  if (url.pathname === "/api/replication/exchange" && req.method === "POST") {
    const config = readConfig();
    if (req.headers.authorization !== `Bearer ${config.replicationKey}`) return json(res, 401, { error: "Invalid replication key." });
    const input = await body(req);
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const record of input.records || []) {
        const existing = getStorage.get(record.storage_key);
        if (!existing || record.modified_at > existing.modified_at) {
          db.prepare(`INSERT INTO app_storage(storage_key,value,revision,modified_at,modified_by) VALUES(?,?,?,?,?)
            ON CONFLICT(storage_key) DO UPDATE SET value=excluded.value,revision=excluded.revision,modified_at=excluded.modified_at,modified_by='sync'`)
            .run(record.storage_key, record.value, record.revision || 1, record.modified_at, "sync");
        }
      }
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    return json(res, 200, { records: readStorage.all() });
  }

  const user = requireUser(req, res); if (!user) return;
  if (req.method === "GET" && url.pathname === "/api/storage") {
    return json(res, 200, Object.fromEntries(readStorage.all().map((row) => [row.storage_key, row.value])));
  }
  if (req.method === "PUT" && url.pathname.startsWith("/api/storage/")) {
    const key = decodeURIComponent(url.pathname.slice("/api/storage/".length));
    if (!writableRoles[key] || !writableRoles[key].has(user.role)) return json(res, 403, { error: "Your role does not permit this change." });
    const input = await body(req);
    if (typeof input.value !== "string") return json(res, 400, { error: "Storage value must be a string." });
    const existing = getStorage.get(key);
    const merged = mergeStorageValue(key, existing && existing.value, input.value);
    saveStorage.run(key, merged, now(), user.id);
    const saved = getStorage.get(key);
    return json(res, 200, { ok: true, revision: saved.revision, value: saved.value });
  }
  if (req.method === "GET" && url.pathname === "/api/users") {
    if (user.role !== "super_admin") return json(res, 403, { error: "Only Super Admin can manage users." });
    const search = `%${String(url.searchParams.get("search") || "").toLowerCase()}%`;
    const status = url.searchParams.get("status") || "all";
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 25)));
    const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
    const filter = status === "active" ? "AND is_active=1" : status === "inactive" ? "AND is_active=0" : "";
    const total = db.prepare(`SELECT count(*) AS count FROM server_users WHERE lower(display_name||' '||email) LIKE ? ${filter}`).get(search).count;
    const rows = db.prepare(`SELECT * FROM server_users WHERE lower(display_name||' '||email) LIKE ? ${filter} ORDER BY display_name LIMIT ? OFFSET ?`).all(search, limit, offset);
    return json(res, 200, { items: rows.map(safeUser), total });
  }
  if (req.method === "POST" && url.pathname === "/api/users") {
    if (user.role !== "super_admin") return json(res, 403, { error: "Only Super Admin can manage users." });
    const input = await body(req);
    if (!input.temporary_password || String(input.temporary_password).length < 12) return json(res, 400, { error: "A temporary password of at least 12 characters is required." });
    const timestamp = now(), userId = id(), salt = crypto.randomBytes(16).toString("base64");
    try {
      db.prepare(`INSERT INTO server_users(id,display_name,email,role,branch_ids,is_active,password_salt,password_hash,must_change_password,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,1,?,?)`).run(userId, input.display_name, input.email, input.role, JSON.stringify(input.branch_ids || []), input.is_active ? 1 : 0, salt, passwordHash(input.temporary_password, salt), timestamp, timestamp);
    } catch (error) { return json(res, 400, { error: String(error.message).includes("UNIQUE") ? "Email address already belongs to a system user." : error.message }); }
    return json(res, 201, safeUser(db.prepare("SELECT * FROM server_users WHERE id=?").get(userId)));
  }
  if (req.method === "PUT" && url.pathname.startsWith("/api/users/")) {
    if (user.role !== "super_admin") return json(res, 403, { error: "Only Super Admin can manage users." });
    const userId = decodeURIComponent(url.pathname.slice("/api/users/".length)); const input = await body(req);
    const existing = db.prepare("SELECT * FROM server_users WHERE id=?").get(userId);
    if (!existing) return json(res, 404, { error: "System user was not found." });
    let salt = existing.password_salt, hash = existing.password_hash, mustChange = existing.must_change_password;
    if (input.temporary_password) { if (String(input.temporary_password).length < 12) return json(res, 400, { error: "A temporary password must contain at least 12 characters." }); salt = crypto.randomBytes(16).toString("base64"); hash = passwordHash(input.temporary_password, salt); mustChange = 1; }
    db.prepare(`UPDATE server_users SET display_name=?,email=?,role=?,branch_ids=?,is_active=?,password_salt=?,password_hash=?,must_change_password=?,updated_at=? WHERE id=?`)
      .run(input.display_name, input.email, input.role, JSON.stringify(input.branch_ids || []), input.is_active ? 1 : 0, salt, hash, mustChange, now(), userId);
    return json(res, 200, safeUser(db.prepare("SELECT * FROM server_users WHERE id=?").get(userId)));
  }
  if (req.method === "GET" && url.pathname === "/api/sync/status") {
    const config = readConfig(); const latest = db.prepare("SELECT * FROM server_sync_log ORDER BY started_at DESC LIMIT 1").get() || null;
    return json(res, 200, { deploymentMode: config.deploymentMode, autoSync: Boolean(config.autoSync), syncIntervalMinutes: config.syncIntervalMinutes, remoteUrl: config.remoteUrl, replicationKey: config.replicationKey, configured: Boolean(config.remoteUrl), latest });
  }
  if (req.method === "PUT" && url.pathname === "/api/sync/config") {
    if (user.role !== "super_admin") return json(res, 403, { error: "Only Super Admin can configure synchronization." });
    const input = await body(req); const existing = readConfig();
    const deploymentMode = input.deploymentMode === "HYBRID" ? "HYBRID" : "LAN_ONLY";
    const syncIntervalMinutes = Math.min(1440, Math.max(1, Number(input.syncIntervalMinutes || 5)));
    const remoteUrl = String(input.remoteUrl || "").trim().replace(/\/$/, "");
    if (deploymentMode === "HYBRID" && remoteUrl && !/^https?:\/\//i.test(remoteUrl)) return json(res, 400, { error: "Remote server URL must start with http:// or https://." });
    const next = { ...existing, deploymentMode, autoSync: deploymentMode === "HYBRID" && Boolean(input.autoSync), syncIntervalMinutes, remoteUrl, replicationKey: String(input.replicationKey || existing.replicationKey) };
    fs.writeFileSync(configPath, JSON.stringify(next, null, 2));
    return json(res, 200, { deploymentMode: next.deploymentMode, autoSync: next.autoSync, syncIntervalMinutes: next.syncIntervalMinutes, remoteUrl: next.remoteUrl, replicationKey: next.replicationKey, configured: Boolean(next.remoteUrl) });
  }
  if (req.method === "POST" && url.pathname === "/api/sync/run") {
    if (user.role !== "super_admin") return json(res, 403, { error: "Only Super Admin can synchronize the server." });
    try { return json(res, 200, await runSync()); } catch (error) { return json(res, 400, { error: error.message }); }
  }
  return json(res, 404, { error: "API endpoint was not found." });
}

function mime(file) {
  const ext = path.extname(file).toLowerCase();
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2" })[ext] || "application/octet-stream";
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const key = Object.prototype.hasOwnProperty.call(ASSETS, requested) ? requested : "index.html";
    const content = Buffer.from(ASSETS[key], "base64");
    res.writeHead(200, { "Content-Type": mime(key), "Content-Length": content.length, "Cache-Control": key.startsWith("assets/") ? "public, max-age=31536000, immutable" : "no-cache", "X-Content-Type-Options": "nosniff" });
    res.end(content);
  } catch (error) {
    json(res, 500, { error: error.message || "Unexpected server error." });
  }
});

function findLanAddress() {
  const virtualAdapter = /(virtual|hyper-v|vethernet|vmware|virtualbox|docker|wsl|vpn|\btap\b|tunnel|bluetooth)/i;
  const candidates = Object.entries(os.networkInterfaces()).flatMap(([name, addresses]) =>
    (addresses || [])
      .filter((item) => item && item.family === "IPv4" && !item.internal)
      .map((item) => ({ name, address: item.address })),
  );
  const score = ({ name, address }) => {
    let value = virtualAdapter.test(name) ? -500 : 0;
    if (address.startsWith("192.168.")) value += 30;
    else if (address.startsWith("10.")) value += 20;
    else if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) value += 10;
    return value;
  };
  return candidates.sort((left, right) => score(right) - score(left))[0]?.address || "127.0.0.1";
}

server.listen(port, "0.0.0.0", () => {
  const address = findLanAddress();
  if (process.send) process.send({ type: "ready", port, databasePath, publicUrl: `http://${address}:${port}/` });
  console.log(`READY|${port}|${databasePath}|http://${address}:${port}/`);
});

let syncing = false;
let lastAutomaticSync = 0;
setInterval(async () => {
  const config = readConfig();
  const interval = Math.max(1, Number(config.syncIntervalMinutes || 5)) * 60_000;
  if (!config.autoSync || config.deploymentMode !== "HYBRID" || syncing || Date.now() - lastAutomaticSync < interval) return;
  syncing = true; lastAutomaticSync = Date.now(); try { await runSync(); } catch {} finally { syncing = false; }
}, 60_000);

function shutdown() { try { server.close(); } finally { db.close(); process.exit(0); } }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
