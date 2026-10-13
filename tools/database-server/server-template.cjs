const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const ASSETS = __COOP_EMBEDDED_ASSETS__;
const maintenance = __COOP_MAINTENANCE__;
const reports = __COOP_REPORTS__;
const payroll = __COOP_PAYROLL__;
const attendance = __COOP_ATTENDANCE__;
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
  CREATE TABLE IF NOT EXISTS access_roles (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    permissions TEXT NOT NULL DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 1,
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS server_sync_log (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    direction TEXT NOT NULL,
    records_processed INTEGER NOT NULL DEFAULT 0,
    records_sent INTEGER NOT NULL DEFAULT 0,
    records_received INTEGER NOT NULL DEFAULT 0,
    conflicts_detected INTEGER NOT NULL DEFAULT 0,
    message TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS server_sync_conflicts (
    id TEXT PRIMARY KEY,
    sync_log_id TEXT,
    storage_key TEXT NOT NULL,
    record_key TEXT NOT NULL,
    current_updated_at TEXT,
    incoming_updated_at TEXT,
    resolution TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS server_users_email_idx ON server_users(email);
  CREATE INDEX IF NOT EXISTS server_sessions_expiry_idx ON server_sessions(expires_at);
  CREATE INDEX IF NOT EXISTS server_sync_log_started_idx ON server_sync_log(started_at DESC);
  CREATE INDEX IF NOT EXISTS server_sync_conflicts_created_idx ON server_sync_conflicts(created_at DESC);
`);

function ensureColumn(table, name, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((column) => column.name === name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}
ensureColumn("server_users", "role_ids", "TEXT NOT NULL DEFAULT '[]'");
ensureColumn("server_users", "client_ids", "TEXT NOT NULL DEFAULT '[]'");
ensureColumn("server_users", "direct_grants", "TEXT NOT NULL DEFAULT '[]'");
ensureColumn("server_users", "direct_denies", "TEXT NOT NULL DEFAULT '[]'");
ensureColumn("server_users", "scope_type", "TEXT NOT NULL DEFAULT 'organization'");
ensureColumn("server_users", "resource_assignments", "TEXT NOT NULL DEFAULT '[]'");
ensureColumn("server_users", "linked_employee_id", "TEXT");
ensureColumn("server_users", "manager_user_id", "TEXT");
ensureColumn("server_sync_log", "records_sent", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("server_sync_log", "records_received", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("server_sync_log", "conflicts_detected", "INTEGER NOT NULL DEFAULT 0");
db.prepare("UPDATE server_users SET scope_type='assigned_branches' WHERE role IN ('branch_admin','branch_user') AND branch_ids <> '[]' AND scope_type='organization'").run();

const permissionModules = {
  dashboard: ["view"], members: ["view","create","update","delete","import","export","approve","manage"],
  "members.sensitive": ["view","update"], employees: ["view","create","update","delete","import","export","approve","manage"],
  "employees.sensitive": ["view","update"], payments: ["view","create","update","delete","import","export","approve","manage"],
  "payments.settings": ["view","manage"], organization: ["view","create","update","delete","manage"],
  documents: ["view","create","update","delete","export","manage"], reports: ["view","export"], sync: ["view","manage"], payroll: ["view","manage","approve"],
  audit: ["view","export"], settings: ["view","manage"], users: ["view","create","update","delete","manage"], roles: ["view","create","update","delete","manage"],
};
const allPermissions = Object.entries(permissionModules).flatMap(([module, actions]) => actions.map((action) => `${module}.${action}`));
const permissionsFor = (...modules) => modules.flatMap((module) => (permissionModules[module] || []).map((action) => `${module}.${action}`));
const defaultRolePolicies = [
  ["super_admin","Super Admin",allPermissions,true],
  ["general_manager","General Manager",permissionsFor("dashboard","members","employees","payments","organization","documents","reports","audit"),false],
  ["hr_manager","HR Manager",permissionsFor("dashboard","members","employees","organization","documents","reports","audit"),false],
  ["accounting_manager","Accounting Manager",[...permissionsFor("dashboard","reports"),"members.view","employees.view","payments.view","payments.create","payments.update","payments.import","payments.export","payments.manage","documents.view"],false],
  ["head_office_staff","Head Office Staff",permissionsFor("dashboard","members","employees","payments","documents","reports"),false],
  ["branch_admin","Branch Admin",permissionsFor("dashboard","members","employees","payments","documents","reports"),false],
  ["branch_user","Branch User",["dashboard.view","members.view","employees.view","payments.view","documents.view"],false],
];

function seedRoles() {
  const timestamp = now();
  const insert = db.prepare(`INSERT OR IGNORE INTO access_roles(id,code,name,description,permissions,is_active,is_system,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?,?)`);
  defaultRolePolicies.forEach(([code, name, permissions, system], index) => insert.run(`70000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, code, name, `${name} default access policy.`, JSON.stringify(permissions), system ? 1 : 0, timestamp, timestamp));
}

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
seedRoles();
seedAdmin();
db.prepare("UPDATE server_users SET role_ids=? WHERE role='super_admin' AND (role_ids='[]' OR role_ids IS NULL)").run(JSON.stringify(["70000000-0000-4000-8000-000000000001"]));
for (const existingUser of db.prepare("SELECT id,role,role_ids FROM server_users").all()) {
  if (parseArray(existingUser.role_ids).length) continue;
  const matchingRole = db.prepare("SELECT id FROM access_roles WHERE code=?").get(existingUser.role);
  if (matchingRole) db.prepare("UPDATE server_users SET role_ids=? WHERE id=?").run(JSON.stringify([matchingRole.id]), existingUser.id);
}

const readStorage = db.prepare("SELECT storage_key, value, revision, modified_at FROM app_storage");
const getStorage = db.prepare("SELECT storage_key, value, revision, modified_at FROM app_storage WHERE storage_key = ?");
const saveStorage = db.prepare(`INSERT INTO app_storage(storage_key,value,revision,modified_at,modified_by)
  VALUES(?,?,1,?,?) ON CONFLICT(storage_key) DO UPDATE SET value=excluded.value,
  revision=app_storage.revision+1, modified_at=excluded.modified_at, modified_by=excluded.modified_by`);

function comparable(value) {
  return JSON.stringify(value, (key, item) => key === "sync_status" ? undefined : item);
}
function recordTimestamp(record, fallback) {
  return String(record && (record.updated_at || record.updatedAt || record.created_at || record.createdAt) || fallback || "");
}
function mergeById(current, incoming, context) {
  const records = new Map((Array.isArray(current) ? current : []).map((item) => [item.id, item]));
  for (const item of Array.isArray(incoming) ? incoming : []) {
    const existing = records.get(item.id);
    if (!existing) { records.set(item.id, item); continue; }
    if (comparable(existing) === comparable(item)) {
      records.set(item.id, { ...existing, ...item, sync_status: existing.sync_status || item.sync_status });
      continue;
    }
    const currentUpdatedAt = recordTimestamp(existing, context.currentModifiedAt);
    const incomingUpdatedAt = recordTimestamp(item, context.incomingModifiedAt);
    const incomingWins = incomingUpdatedAt > currentUpdatedAt || (incomingUpdatedAt === currentUpdatedAt && comparable(item) > comparable(existing));
    records.set(item.id, incomingWins ? item : existing);
    context.conflicts.push({ recordKey: `${context.collection}:${item.id}`, currentUpdatedAt, incomingUpdatedAt, resolution: incomingWins ? "incoming_wins" : "current_wins" });
  }
  return Array.from(records.values());
}
function validateChangedRefunds(current, ledger) {
  for (const refund of ledger.refunds || []) {
    const previous = (current.refunds || []).find((item) => item.id === refund.id);
    if (refund.deleted_at || previous && comparable(previous) === comparable(refund)) continue;
    const settings = (ledger.settings || []).filter((item) => item.effective_from <= refund.refund_date && (!item.effective_to || item.effective_to >= refund.refund_date)).sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
    const paid = (ledger.payments || []).filter((item) => !item.deleted_at && item.employee_id === refund.employee_id && item.payment_date <= refund.refund_date).reduce((sum, item) => sum + item.amount_centavos, 0);
    const otherRefunds = (ledger.refunds || []).filter((item) => !item.deleted_at && item.employee_id === refund.employee_id && item.id !== refund.id).reduce((sum, item) => sum + item.amount_centavos, 0);
    if (!settings || !Number.isSafeInteger(refund.amount_centavos) || refund.amount_centavos <= 0 || refund.amount_centavos > Math.max(0, paid - otherRefunds - settings.membership_fee_centavos - settings.capital_share_target_centavos) || (ledger.settlements || []).some((item) => !item.deleted_at && item.employee_id === refund.employee_id)) {
      const error = new Error("Refund cannot exceed the remaining overpayment under Payment Settings.");
      error.refundValidation = true;
      throw error;
    }
  }
}
function mergeStorageValueDetailed(key, currentValue, incomingValue, currentModifiedAt = "", incomingModifiedAt = "") {
  if (key === "coop_sys_attendance") {
    const current = JSON.parse(currentValue || "[]"), incoming = JSON.parse(incomingValue);
    const immutable = (r) => JSON.stringify(Object.fromEntries(Object.entries(r).filter(([field]) => !["updated_at","review_status","reviewed_by","reviewed_at","deleted_at"].includes(field))));
    for (const row of incoming) {
      const previous = current.find((r) => r.id === row.id);
      if (previous && (immutable(previous) !== immutable(row) || previous.deleted_at && !row.deleted_at || previous.review_status === "approved" && (row.review_status !== "approved" || row.deleted_at || previous.reviewed_by !== row.reviewed_by || previous.reviewed_at !== row.reviewed_at))) throw new Error("Attendance history cannot be overwritten. Correct a draft using a new revision.");
    }
    const conflicts = [];
    const merged = mergeById(current, incoming, { collection: key, conflicts, currentModifiedAt, incomingModifiedAt });
    attendance.validateAttendanceRecords(merged);
    return { value: JSON.stringify(merged), conflicts };
  }
  if (key === "coop_sys_payroll_setup") {
    const current = JSON.parse(currentValue || "[]"), incoming = JSON.parse(incomingValue);
    for (const item of incoming) {
      const previous = current.find((r) => r.id === item.id);
      if (previous && JSON.stringify(previous.data) !== JSON.stringify(item.data)) throw new Error("Payroll terms cannot be overwritten. Create an effective-dated version.");
      if (previous && (previous.kind !== item.kind || previous.created_by !== item.created_by || previous.created_at !== item.created_at || previous.deleted_at && !item.deleted_at)) throw new Error("Payroll history cannot be replaced or restored.");
    }
    const conflicts = [];
    const merged = mergeById(current, incoming, { collection: key, conflicts, currentModifiedAt, incomingModifiedAt });
    payroll.validatePayrollRecords(merged);
    return { value: JSON.stringify(merged), conflicts };
  }
  if (!currentValue) {
    if (key === "coop_sys_payment_ledger") validateChangedRefunds({}, JSON.parse(incomingValue));
    return { value: incomingValue, conflicts: [] };
  }
  const conflicts = [];
  const merge = (current, incoming, collection) => mergeById(current, incoming, { collection, conflicts, currentModifiedAt, incomingModifiedAt });
  try {
    const current = JSON.parse(currentValue), incoming = JSON.parse(incomingValue);
    if (key === "coop_sys_members" || key === "coop_sys_employees") return { value: JSON.stringify(merge(current, incoming, key)), conflicts };
    if (key === "coop_sys_organization_directory") return { value: JSON.stringify({
      branches: merge(current.branches, incoming.branches, "branches"), clients: merge(current.clients, incoming.clients, "clients"),
      departments: merge(current.departments, incoming.departments, "departments"), positions: merge(current.positions, incoming.positions, "positions"),
    }), conflicts };
    if (key === "coop_sys_payment_ledger") {
      const merged = {
        settings: merge(current.settings, incoming.settings, "settings"), aliases: merge(current.aliases, incoming.aliases, "aliases"),
        batches: merge(current.batches, incoming.batches, "batches"), payments: merge(current.payments, incoming.payments, "payments"),
        settlements: merge(current.settlements, incoming.settlements, "settlements"), corrections: merge(current.corrections, incoming.corrections, "corrections"),
        refunds: merge(current.refunds, incoming.refunds, "refunds"), paymentTotal: 0, refundTotal: 0,
      };
      merged.paymentTotal = merged.payments.length; merged.refundTotal = merged.refunds.length;
      validateChangedRefunds(current, merged);
      return { value: JSON.stringify(merged), conflicts };
    }
  } catch (error) { if (error.refundValidation) throw error; }
  const incomingWins = incomingModifiedAt >= currentModifiedAt;
  if (currentValue !== incomingValue) conflicts.push({ recordKey: key, currentUpdatedAt: currentModifiedAt, incomingUpdatedAt: incomingModifiedAt, resolution: incomingWins ? "incoming_wins" : "current_wins" });
  return { value: incomingWins ? incomingValue : currentValue, conflicts };
}
function mergeStorageValue(key, currentValue, incomingValue) { return mergeStorageValueDetailed(key, currentValue, incomingValue).value; }
function markStorageSynced(rawValue) {
  try {
    const visit = (value) => Array.isArray(value) ? value.map(visit) : value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === "sync_status" ? "synced" : visit(item)])) : value;
    return JSON.stringify(visit(JSON.parse(rawValue)));
  } catch { return rawValue; }
}
function countSyncStates() {
  const counts = { pending: 0, conflicts: 0, synced: 0 };
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    if (typeof value.sync_status === "string") {
      if (value.sync_status === "conflict") counts.conflicts += 1;
      else if (value.sync_status.startsWith("pending_")) counts.pending += 1;
      else if (value.sync_status === "synced") counts.synced += 1;
    }
    Object.values(value).forEach(visit);
  };
  for (const row of readStorage.all()) { try { visit(JSON.parse(row.value)); } catch {} }
  return counts;
}
function persistConflicts(syncLogId, storageKey, conflicts) {
  const insert = db.prepare("INSERT INTO server_sync_conflicts(id,sync_log_id,storage_key,record_key,current_updated_at,incoming_updated_at,resolution,created_at) VALUES(?,?,?,?,?,?,?,?)");
  for (const conflict of conflicts) insert.run(id(), syncLogId || null, storageKey, conflict.recordKey, conflict.currentUpdatedAt || null, conflict.incomingUpdatedAt || null, conflict.resolution, now());
}

const storageModules = { coop_sys_members: "members", coop_sys_employees: "employees", coop_sys_organization_directory: "organization", coop_sys_payment_ledger: "payments", coop_sys_payroll_setup: "payroll", coop_sys_attendance: "payroll" };
function parseArray(value) { try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function rolesForUser(user) {
  const roleIds = parseArray(user.role_ids);
  const placeholders = roleIds.map(() => "?").join(",");
  const byIds = placeholders ? db.prepare(`SELECT * FROM access_roles WHERE is_active=1 AND id IN (${placeholders})`).all(...roleIds) : [];
  return byIds.length ? byIds : db.prepare("SELECT * FROM access_roles WHERE is_active=1 AND code=?").all(user.role);
}
function permissionsForUser(user) {
  if (user.role === "super_admin") return new Set(allPermissions);
  const denied = new Set(parseArray(user.direct_denies));
  const permissions = new Set([...rolesForUser(user).flatMap((role) => parseArray(role.permissions)), ...parseArray(user.direct_grants)]);
  denied.forEach((permission) => permissions.delete(permission));
  return permissions;
}
function hasPermission(user, permission) { return user.role === "super_admin" || permissionsForUser(user).has(permission); }
function canWriteStorage(user, key) {
  if (key === "coop_sys_attendance") return user.scope_type === "organization" && hasPermission(user, "payroll.view") && (hasPermission(user, "payroll.manage") || hasPermission(user, "payroll.approve"));
  if (key === "coop_sys_payroll_setup") return user.scope_type === "organization" && hasPermission(user, "payroll.view") && hasPermission(user, "payroll.manage");
  const module = storageModules[key]; if (!module) return false;
  return ["create","update","delete","import","manage"].some((action) => hasPermission(user, `${module}.${action}`));
}
function validateAccessInput(actor, input) {
  const roleIds = Array.isArray(input.role_ids) ? input.role_ids : [];
  if (!roleIds.length) return "Assign at least one role.";
  const roles = roleIds.map((roleId) => db.prepare("SELECT * FROM access_roles WHERE id=? AND is_active=1").get(roleId));
  if (roles.some((role) => !role)) return "One or more assigned roles are unavailable.";
  if (actor.role !== "super_admin" && roles.some((role) => role.code === "super_admin")) return "Only Super Admin can assign unrestricted access.";
  const actorPermissions = permissionsForUser(actor);
  const requested = [...roles.flatMap((role) => parseArray(role.permissions)), ...(input.direct_grants || [])];
  if (actor.role !== "super_admin" && requested.some((permission) => !actorPermissions.has(permission))) return "You cannot grant access that you do not hold.";
  if ((input.direct_grants || []).some((permission) => !allPermissions.includes(permission)) || (input.direct_denies || []).some((permission) => !allPermissions.includes(permission))) return "One or more permission overrides are invalid.";
  if ((input.direct_grants || []).some((permission) => (input.direct_denies || []).includes(permission))) return "A permission cannot be both granted and denied.";
  if (input.scope_type === "assigned_branches" && !(input.branch_ids || []).length) return "Assign at least one branch.";
  if (input.scope_type === "assigned_clients" && !(input.client_ids || []).length) return "Assign at least one client.";
  if (input.scope_type === "self" && !input.linked_employee_id) return "Link an employee for self-only access.";
  return null;
}

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
  const assignedRoles = rolesForUser(user);
  return {
    profile: { userId: user.id, displayName: user.display_name, role: assignedRoles[0]?.code || user.role, roleIds: assignedRoles.map((role) => role.id), roleLabels: assignedRoles.map((role) => role.name), branchIds: parseArray(user.branch_ids), clientIds: parseArray(user.client_ids), scopeType: user.scope_type, linkedEmployeeId: user.linked_employee_id, managerUserId: user.manager_user_id, directGrants: parseArray(user.direct_grants), directDenies: parseArray(user.direct_denies), effectivePermissions: [...permissionsForUser(user)] },
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
  return { id: row.id, display_name: row.display_name, email: row.email, role: row.role, role_ids: parseArray(row.role_ids), branch_ids: parseArray(row.branch_ids), client_ids: parseArray(row.client_ids), direct_grants: parseArray(row.direct_grants), direct_denies: parseArray(row.direct_denies), scope_type: row.scope_type || "organization", resource_assignments: parseArray(row.resource_assignments), linked_employee_id: row.linked_employee_id || null, manager_user_id: row.manager_user_id || null, is_active: Boolean(row.is_active), created_at: row.created_at, updated_at: row.updated_at };
}
function safeRole(row) { return { ...row, permissions: parseArray(row.permissions), is_active: Boolean(row.is_active), is_system: Boolean(row.is_system) }; }
function recordInScope(record, user) {
  if (user.scope_type === "organization") return true;
  if (user.scope_type === "self") return record.id === user.linked_employee_id;
  const assignment = record.active_assignment;
  if (!assignment) return false;
  if (user.scope_type === "assigned_clients") return Boolean(assignment.client_id && parseArray(user.client_ids).includes(assignment.client_id));
  return Boolean(assignment.branch_id && parseArray(user.branch_ids).includes(assignment.branch_id));
}
function redactIdentifiers(record) {
  return { ...record, sss_number: null, pagibig_number: null, philhealth_number: null, tax_identification_number: null };
}
function nextBodNumber(members) {
  const previous = Number(getStorage.get("coop_sys_bod_approval_sequence")?.value) || 0;
  const highest = members.reduce((value, member) => Math.max(value, /^\d{6}$/.test(member.acceptance_resolution_number || "") ? Number(member.acceptance_resolution_number) : 0), previous);
  if (highest >= 999999) throw new Error("The six-digit BOD resolution sequence is exhausted.");
  return String(highest + 1).padStart(6, "0");
}
function filteredStorageValue(user, key, rawValue) {
  if (["coop_sys_payroll_setup","coop_sys_attendance"].includes(key) && (user.scope_type !== "organization" || !hasPermission(user, "payroll.view"))) return undefined;
  const module = storageModules[key];
  if (module && !hasPermission(user, `${module}.view`)) return undefined;
  try {
    const value = JSON.parse(rawValue);
    const employeeRaw = key === "coop_sys_employees" ? rawValue : getStorage.get("coop_sys_employees")?.value;
    const employees = employeeRaw ? JSON.parse(employeeRaw) : [];
    const visibleEmployees = employees.filter((employee) => recordInScope(employee, user));
    const visibleEmployeeIds = new Set(visibleEmployees.map((employee) => employee.id));
    const visibleMemberIds = new Set(visibleEmployees.map((employee) => employee.member_id).filter(Boolean));
    if (key === "coop_sys_employees") return JSON.stringify(visibleEmployees.map((record) => hasPermission(user, "employees.sensitive.view") ? record : redactIdentifiers(record)));
    if (key === "coop_sys_members") {
      const linkedMemberIds = new Set(employees.filter((employee) => !employee.deleted_at).map((employee) => employee.member_id));
      const records = user.scope_type === "organization" ? value : value.filter((member) => {
        if (linkedMemberIds.has(member.id)) return visibleMemberIds.has(member.id);
        if (user.scope_type === "assigned_clients") return Boolean(member.proposed_client_id && parseArray(user.client_ids).includes(member.proposed_client_id));
        if (user.scope_type === "self") return false;
        return Boolean(member.proposed_branch_id && parseArray(user.branch_ids).includes(member.proposed_branch_id));
      });
      return JSON.stringify(records.map((record) => hasPermission(user, "members.sensitive.view") ? record : redactIdentifiers(record)));
    }
    if (key === "coop_sys_organization_directory") {
      const branchIds = new Set(parseArray(user.branch_ids)); const clientIds = new Set(parseArray(user.client_ids));
      if (user.scope_type === "organization") return rawValue;
      const scopedClients = (value.clients || []).filter((client) => user.scope_type === "assigned_clients" ? clientIds.has(client.id) : branchIds.has(client.branchId));
      scopedClients.forEach((client) => branchIds.add(client.branchId));
      return JSON.stringify({ ...value, branches: (value.branches || []).filter((branch) => branchIds.has(branch.id)), clients: scopedClients });
    }
    if (key === "coop_sys_payment_ledger") {
      const payments = (value.payments || []).filter((payment) => visibleEmployeeIds.has(payment.employee_id));
      const paymentIds = new Set(payments.map((payment) => payment.id)); const batchIds = new Set(payments.map((payment) => payment.batch_id));
      return JSON.stringify({ ...value, aliases: (value.aliases || []).filter((item) => visibleEmployeeIds.has(item.employee_id)), batches: (value.batches || []).filter((item) => batchIds.has(item.id)), payments, settlements: (value.settlements || []).filter((item) => visibleEmployeeIds.has(item.employee_id)), corrections: (value.corrections || []).filter((item) => paymentIds.has(item.payment_id)), refunds: (value.refunds || []).filter((item) => visibleEmployeeIds.has(item.employee_id)) });
    }
  } catch {}
  return rawValue;
}

let syncing = false;
async function runSync() {
  if (syncing) throw new Error("Synchronization is already running.");
  syncing = true;
  const config = readConfig();
  const startedAt = now();
  const logId = id();
  db.prepare("INSERT INTO server_sync_log(id,status,direction,started_at) VALUES(?, 'started', 'bidirectional', ?)").run(logId, startedAt);
  if (config.deploymentMode !== "HYBRID" || !config.remoteUrl) {
    const message = "Hybrid mode is not configured. Update data/server-config.json on the host.";
    db.prepare("UPDATE server_sync_log SET status='failed',message=?,completed_at=? WHERE id=?").run(message, now(), logId);
    syncing = false;
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
    let received = 0; const conflicts = [];
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const record of payload.records || []) {
        const localRecord = getStorage.get(record.storage_key);
        const merged = mergeStorageValueDetailed(record.storage_key, localRecord && localRecord.value, record.value, localRecord && localRecord.modified_at, record.modified_at);
        const synchronizedValue = markStorageSynced(merged.value);
        conflicts.push(...merged.conflicts.map((conflict) => ({ ...conflict, storageKey: record.storage_key })));
        if (!localRecord || synchronizedValue !== localRecord.value || record.modified_at > localRecord.modified_at) {
          db.prepare(`INSERT INTO app_storage(storage_key,value,revision,modified_at,modified_by) VALUES(?,?,?,?,?)
            ON CONFLICT(storage_key) DO UPDATE SET value=excluded.value,revision=excluded.revision,modified_at=excluded.modified_at,modified_by='sync'`)
            .run(record.storage_key, synchronizedValue, Math.max(Number(record.revision || 1), Number(localRecord && localRecord.revision || 0)), [record.modified_at, localRecord && localRecord.modified_at].filter(Boolean).sort().pop() || now(), "sync");
          received += 1;
        }
      }
      for (const item of conflicts) persistConflicts(logId, item.storageKey, [item]);
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    const completedAt = now();
    db.prepare("UPDATE server_sync_log SET status='completed',records_processed=?,records_sent=?,records_received=?,conflicts_detected=?,message=?,completed_at=? WHERE id=?")
      .run(local.length + received, local.length, received, conflicts.length, "Synchronization completed.", completedAt, logId);
    return { status: "completed", recordsProcessed: local.length + received, recordsSent: local.length, recordsReceived: received, conflictsDetected: conflicts.length, completedAt };
  } catch (error) {
    db.prepare("UPDATE server_sync_log SET status='failed',message=?,completed_at=? WHERE id=?").run(error.message, now(), logId);
    throw error;
  } finally { syncing = false; }
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
        const merged = mergeStorageValueDetailed(record.storage_key, existing && existing.value, record.value, existing && existing.modified_at, record.modified_at);
        const synchronizedValue = markStorageSynced(merged.value);
        if (!existing || synchronizedValue !== existing.value || record.modified_at > existing.modified_at) {
          db.prepare(`INSERT INTO app_storage(storage_key,value,revision,modified_at,modified_by) VALUES(?,?,?,?,?)
            ON CONFLICT(storage_key) DO UPDATE SET value=excluded.value,revision=excluded.revision,modified_at=excluded.modified_at,modified_by='sync'`)
            .run(record.storage_key, synchronizedValue, Math.max(Number(record.revision || 1), Number(existing && existing.revision || 0)), [record.modified_at, existing && existing.modified_at].filter(Boolean).sort().pop() || now(), "sync");
        }
        persistConflicts(null, record.storage_key, merged.conflicts);
      }
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    return json(res, 200, { records: readStorage.all() });
  }

  const user = requireUser(req, res); if (!user) return;
  if (url.pathname === "/api/maintenance/people") {
    if (user.role !== "super_admin") return json(res, 403, { error: "Only Super Admin can manage data cleanup." });
    const snapshot = {
      employees: JSON.parse(getStorage.get("coop_sys_employees")?.value || "[]"),
      members: JSON.parse(getStorage.get("coop_sys_members")?.value || "[]"),
      ledger: JSON.parse(getStorage.get("coop_sys_payment_ledger")?.value || "{}"),
    };
    if (req.method === "GET") {
      const kind = url.searchParams.get("kind");
      if (!["employee", "member"].includes(kind)) return json(res, 400, { error: "Invalid record type." });
      return json(res, 200, maintenance.listCleanupRecords(snapshot, { kind, search: url.searchParams.get("search"), state: url.searchParams.get("state"), unassigned: url.searchParams.get("unassigned") === "true", offset: Number(url.searchParams.get("offset")), limit: Number(url.searchParams.get("limit")) }));
    }
    if (req.method === "POST") {
      const input = await body(req);
      if (syncing) return json(res, 409, { error: "Wait for synchronization to complete before cleaning data." });
      if (input.action !== "soft" && readConfig().remoteUrl) return json(res, 409, { error: "Disconnect replication before permanent deletion. Otherwise another replica can restore deleted data. Archive records if synchronization must remain enabled." });
      let cleaned;
      try { cleaned = maintenance.applyCleanup(snapshot, input, now()); }
      catch (error) { return json(res, 400, { error: error.message }); }
      db.exec("BEGIN IMMEDIATE");
      try {
        const timestamp = now();
        saveStorage.run("coop_sys_employees", JSON.stringify(cleaned.snapshot.employees), timestamp, user.id);
        saveStorage.run("coop_sys_members", JSON.stringify(cleaned.snapshot.members), timestamp, user.id);
        saveStorage.run("coop_sys_payment_ledger", JSON.stringify(cleaned.snapshot.ledger), timestamp, user.id);
        if (input.action !== "soft") {
          const unlinkUser = db.prepare("UPDATE server_users SET linked_employee_id=NULL,updated_at=? WHERE linked_employee_id=?");
          cleaned.employeeIds.forEach((employeeId) => unlinkUser.run(timestamp, employeeId));
        }
        db.prepare("INSERT INTO server_sync_log(id,status,direction,records_processed,message,started_at,completed_at) VALUES(?,?,?,?,?,?,?)")
          .run(id(), "completed", "maintenance", cleaned.result.employees + cleaned.result.members, JSON.stringify({ action: input.action, actor: user.id, ...cleaned.result }), timestamp, timestamp);
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
      return json(res, 200, cleaned.result);
    }
  }
  if (req.method === "GET" && url.pathname === "/api/storage") {
    return json(res, 200, Object.fromEntries(readStorage.all().map((row) => [row.storage_key, filteredStorageValue(user, row.storage_key, row.value)]).filter((entry) => entry[1] !== undefined)));
  }
  if (url.pathname === "/api/members/approval-number" || url.pathname === "/api/members/approve") {
    if (!hasPermission(user, "members.approve")) return json(res, 403, { error: "Your effective access does not permit membership approval." });
    if (req.method === "GET" && url.pathname.endsWith("approval-number")) {
      try { return json(res, 200, { number: nextBodNumber(JSON.parse(getStorage.get("coop_sys_members")?.value || "[]")) }); }
      catch (error) { return json(res, 400, { error: error.message }); }
    }
    if (req.method !== "POST" || !url.pathname.endsWith("approve")) return json(res, 405, { error: "Method not allowed." });
    const input = await body(req);
    const ids = Array.isArray(input.ids) && input.ids.every((value) => typeof value === "string") ? new Set(input.ids) : new Set();
    const date = input.approvalDate;
    if (!ids.size || ids.size !== input.ids.length || ids.size > 5000 || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) return json(res, 400, { error: "Select pending members and a valid approval date (maximum 5,000 per batch)." });
    db.exec("BEGIN IMMEDIATE");
    try {
      const members = JSON.parse(getStorage.get("coop_sys_members")?.value || "[]");
      const visible = JSON.parse(filteredStorageValue(user, "coop_sys_members", JSON.stringify(members)) || "[]");
      if (visible.filter((member) => ids.has(member.id) && !member.deleted_at && member.bod_approval_status === "pending").length !== ids.size) throw new Error("Only pending membership applications within your scope can be approved.");
      const number = nextBodNumber(members), timestamp = now();
      const approved = members.map((member) => ids.has(member.id) ? { ...member, bod_approval_status: "approved", acceptance_date: date, acceptance_resolution_number: number, membership_status_id: "31000000-0000-4000-8000-000000000001", updated_at: timestamp, sync_status: member.sync_status === "pending_create" ? "pending_create" : "pending_update" } : member);
      const employees = JSON.parse(getStorage.get("coop_sys_employees")?.value || "[]");
      const updated = employees.map((employee) => ids.has(employee.member_id) && !employee.deleted_at ? { ...employee, employment_status_id: "33000000-0000-4000-8000-000000000001", date_separated: null, updated_at: timestamp, sync_status: employee.sync_status === "pending_create" ? "pending_create" : "pending_update" } : employee);
      saveStorage.run("coop_sys_members", JSON.stringify(approved), timestamp, user.id);
      saveStorage.run("coop_sys_employees", JSON.stringify(updated), timestamp, user.id);
      saveStorage.run("coop_sys_bod_approval_sequence", number, timestamp, user.id);
      db.exec("COMMIT");
      return json(res, 200, { number });
    } catch (error) { db.exec("ROLLBACK"); return json(res, 400, { error: error.message }); }
  }
  if (req.method === "GET" && url.pathname === "/api/reports") {
    const input = Object.fromEntries(url.searchParams);
    const module = input.kind === "members" || input.kind === "amounts" ? "members" : "employees";
    if (!hasPermission(user, "reports.view") || !hasPermission(user, `${module}.view`)) return json(res, 403, { error: "Your effective access does not permit this report." });
    if (input.exporting === "true" && (!hasPermission(user, "reports.export") || !hasPermission(user, `${module}.export`))) return json(res, 403, { error: "Your effective access does not permit this export." });
    if (input.kind === "amounts" && (!hasPermission(user, "payments.view") || !hasPermission(user, "employees.view") || input.exporting === "true" && !hasPermission(user, "payments.export"))) return json(res, 403, { error: "Your effective access does not permit payment reports." });
    try {
      return json(res, 200, reports.sqliteReportPage(db, { ...input, attentionOnly: input.attentionOnly === "true" }, { scopeType: user.scope_type || "self", branchIds: parseArray(user.branch_ids), clientIds: parseArray(user.client_ids), linkedEmployeeId: user.linked_employee_id }));
    } catch (error) { return json(res, 400, { error: error.message }); }
  }
  if (req.method === "PUT" && url.pathname.startsWith("/api/storage/")) {
    const key = decodeURIComponent(url.pathname.slice("/api/storage/".length));
    if (!canWriteStorage(user, key)) return json(res, 403, { error: "Your effective access does not permit this change." });
    const input = await body(req);
    if (typeof input.value !== "string") return json(res, 400, { error: "Storage value must be a string." });
    if (key === "coop_sys_attendance") {
      try {
        const incoming = JSON.parse(input.value), before = JSON.parse(getStorage.get(key)?.value || "[]");
        const setup = JSON.parse(getStorage.get("coop_sys_payroll_setup")?.value || "[]");
        const employees = JSON.parse(getStorage.get("coop_sys_employees")?.value || "[]");
        for (const row of incoming) {
          const previous = before.find((r) => r.id === row.id);
          if (previous && comparable(previous) === comparable(row)) continue;
          if (!previous && (row.created_by !== user.id || row.deleted_at || row.review_status !== "draft" || row.reviewed_by || row.reviewed_at)) throw new Error("New attendance must be a current-user draft.");
          if (row.review_status === "approved" && previous?.review_status !== "approved") {
            if (!hasPermission(user, "payroll.approve") || row.reviewed_by !== user.id || !row.reviewed_at) throw new Error("Payroll approval permission is required.");
          } else if (!hasPermission(user, "payroll.manage")) throw new Error("Payroll management permission is required.");
          if (row.deleted_at) {
            if (!incoming.some((replacement) => !replacement.deleted_at && replacement.supersedes_id === row.id && replacement.employee_id === row.employee_id && replacement.work_date === row.work_date)) throw new Error("Draft corrections require a replacement revision.");
            continue;
          }
          const employee = employees.find((e) => e.id === row.employee_id && !e.deleted_at);
          if (!employee || employee.date_hired && row.work_date < employee.date_hired || employee.date_separated && row.work_date > employee.date_separated) throw new Error("Attendance date is outside the employment period.");
          const resolved = payroll.resolvePayrollWorkDate(setup, row.employee_id, row.work_date);
          if (!resolved.terms || resolved.terms.id !== row.terms_id || JSON.stringify(resolved.terms.data) !== JSON.stringify(row.terms_snapshot)) throw new Error("Pay terms changed or the snapshot is invalid. Reload this work date.");
          if (row.status === "rest_day" && !resolved.restDay) throw new Error("A rest-day override is required.");
          if (row.supersedes_id && !before.some((r) => r.id === row.supersedes_id && !r.deleted_at && r.review_status === "draft" && r.employee_id === row.employee_id && r.work_date === row.work_date)) throw new Error("Only a current draft can be corrected.");
        }
      } catch (error) { return json(res, 400, { error: error.message }); }
    }
    if (key === "coop_sys_payroll_setup") {
      try {
        const incoming = JSON.parse(input.value), before = JSON.parse(getStorage.get(key)?.value || "[]");
        const directory = JSON.parse(getStorage.get("coop_sys_organization_directory")?.value || "{}");
        const employees = JSON.parse(getStorage.get("coop_sys_employees")?.value || "[]");
        for (const record of incoming) {
          const previous = before.find((r) => r.id === record.id);
          if (previous && record.deleted_at && !previous.deleted_at && JSON.parse(getStorage.get("coop_sys_attendance")?.value || "[]").some((r) => r.review_status === "approved" && (r.terms_id === record.id || r.terms_snapshot?.worksite_id === record.id))) throw new Error("Approved attendance references this setup record.");
          if (previous) continue;
          if (record.deleted_at) throw new Error("New payroll setup records cannot be archived.");
          if (record.created_by !== user.id) throw new Error("Payroll creator must match the current user.");
          if (record.data.employee_id && !employees.some((e) => e.id === record.data.employee_id && !e.deleted_at)) throw new Error("Employee is unavailable.");
          if (record.kind === "deduction" && record.data.deduction_type === "cooperative" && !employees.some((e) => e.id === record.data.employee_id && e.member_id && !e.deleted_at)) throw new Error("Cooperative deductions require a linked member.");
          if (record.kind === "worksite" && (!(directory.branches || []).some((b) => b.id === record.data.branch_id && b.isActive) || record.data.client_id && !(directory.clients || []).some((c) => c.id === record.data.client_id && c.branchId === record.data.branch_id && c.isActive))) throw new Error("Invalid worksite branch/client.");
        }
        payroll.validatePayrollRecords(incoming);
      } catch (error) { return json(res, 400, { error: error.message }); }
    }
    const existing = getStorage.get(key);
    const timestamp = now();
    const merged = mergeStorageValueDetailed(key, existing && existing.value, input.value, existing && existing.modified_at, timestamp).value;
    if (key === "coop_sys_organization_directory") {
      const before = existing ? JSON.parse(existing.value) : {};
      const after = JSON.parse(merged);
      for (const section of ["branches", "clients", "departments", "positions"]) {
        const current = new Map((before[section] || []).map((record) => [record.id, record]));
        for (const record of after[section] || []) {
          const previous = current.get(record.id);
          const comparable = (value) => JSON.stringify(value, Object.keys(value).sort());
          if (previous && comparable(previous) === comparable(record)) continue;
          if (!hasPermission(user, previous ? "organization.update" : "organization.create")) return json(res, 403, { error: "Your effective access does not permit this organization change." });
        }
      }
    }
    saveStorage.run(key, merged, timestamp, user.id);
    const saved = getStorage.get(key);
    return json(res, 200, { ok: true, revision: saved.revision, value: filteredStorageValue(user, key, saved.value) });
  }
  if (req.method === "GET" && url.pathname === "/api/access/roles") {
    if (!hasPermission(user, "roles.view") && !hasPermission(user, "users.view")) return json(res, 403, { error: "Your effective access does not permit viewing roles." });
    return json(res, 200, db.prepare("SELECT * FROM access_roles ORDER BY name").all().map(safeRole));
  }
  if (req.method === "POST" && url.pathname === "/api/access/roles") {
    if (!hasPermission(user, "roles.create")) return json(res, 403, { error: "Your effective access does not permit creating roles." });
    const input = await body(req); const code = String(input.code || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!code || !String(input.name || "").trim()) return json(res, 400, { error: "Role name and code are required." });
    if (user.role !== "super_admin" && (input.permissions || []).some((permission) => !permissionsForUser(user).has(permission))) return json(res, 403, { error: "You cannot grant access that you do not hold." });
    const timestamp = now(), roleId = id();
    try { db.prepare("INSERT INTO access_roles(id,code,name,description,permissions,is_active,is_system,created_at,updated_at) VALUES(?,?,?,?,?,?,0,?,?)").run(roleId, code, String(input.name).trim(), String(input.description || "").trim(), JSON.stringify((input.permissions || []).filter((permission) => allPermissions.includes(permission))), input.is_active ? 1 : 0, timestamp, timestamp); }
    catch (error) { return json(res, 400, { error: String(error.message).includes("UNIQUE") ? "Role code already exists." : error.message }); }
    return json(res, 201, safeRole(db.prepare("SELECT * FROM access_roles WHERE id=?").get(roleId)));
  }
  if (req.method === "PUT" && url.pathname.startsWith("/api/access/roles/")) {
    if (!hasPermission(user, "roles.update")) return json(res, 403, { error: "Your effective access does not permit updating roles." });
    const roleId = decodeURIComponent(url.pathname.slice("/api/access/roles/".length)); const input = await body(req);
    const existing = db.prepare("SELECT * FROM access_roles WHERE id=?").get(roleId);
    if (!existing) return json(res, 404, { error: "Role was not found." });
    if (existing.is_system) return json(res, 400, { error: "The Super Admin policy is immutable." });
    if (user.role !== "super_admin" && (input.permissions || []).some((permission) => !permissionsForUser(user).has(permission))) return json(res, 403, { error: "You cannot grant access that you do not hold." });
    db.prepare("UPDATE access_roles SET name=?,description=?,permissions=?,is_active=?,updated_at=? WHERE id=?").run(String(input.name || "").trim(), String(input.description || "").trim(), JSON.stringify((input.permissions || []).filter((permission) => allPermissions.includes(permission))), input.is_active ? 1 : 0, now(), roleId);
    return json(res, 200, safeRole(db.prepare("SELECT * FROM access_roles WHERE id=?").get(roleId)));
  }
  if (req.method === "DELETE" && url.pathname.startsWith("/api/access/roles/")) {
    if (!hasPermission(user, "roles.delete")) return json(res, 403, { error: "Your effective access does not permit deleting roles." });
    const roleId = decodeURIComponent(url.pathname.slice("/api/access/roles/".length)); const role = db.prepare("SELECT * FROM access_roles WHERE id=?").get(roleId);
    if (!role) return json(res, 204, {});
    if (role.is_system) return json(res, 400, { error: "System roles cannot be deleted." });
    const assigned = db.prepare("SELECT role_ids FROM server_users").all().some((row) => parseArray(row.role_ids).includes(roleId));
    if (assigned) return json(res, 400, { error: "Reassign users before deleting this role." });
    db.prepare("DELETE FROM access_roles WHERE id=?").run(roleId); return json(res, 200, { ok: true });
  }
  if (req.method === "GET" && url.pathname === "/api/users") {
    if (!hasPermission(user, "users.view")) return json(res, 403, { error: "Your effective access does not permit viewing users." });
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
    if (!hasPermission(user, "users.create")) return json(res, 403, { error: "Your effective access does not permit creating users." });
    const input = await body(req);
    const accessError = validateAccessInput(user, input); if (accessError) return json(res, 400, { error: accessError });
    if (!input.temporary_password || String(input.temporary_password).length < 12) return json(res, 400, { error: "A temporary password of at least 12 characters is required." });
    const timestamp = now(), userId = id(), salt = crypto.randomBytes(16).toString("base64");
    try {
      db.prepare(`INSERT INTO server_users(id,display_name,email,role,role_ids,branch_ids,client_ids,direct_grants,direct_denies,scope_type,resource_assignments,linked_employee_id,manager_user_id,is_active,password_salt,password_hash,must_change_password,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`).run(userId, input.display_name, input.email, input.role, JSON.stringify(input.role_ids || []), JSON.stringify(input.branch_ids || []), JSON.stringify(input.client_ids || []), JSON.stringify(input.direct_grants || []), JSON.stringify(input.direct_denies || []), input.scope_type || "organization", JSON.stringify(input.resource_assignments || []), input.linked_employee_id || null, input.manager_user_id || null, input.is_active ? 1 : 0, salt, passwordHash(input.temporary_password, salt), timestamp, timestamp);
    } catch (error) { return json(res, 400, { error: String(error.message).includes("UNIQUE") ? "Email address already belongs to a system user." : error.message }); }
    return json(res, 201, safeUser(db.prepare("SELECT * FROM server_users WHERE id=?").get(userId)));
  }
  if (req.method === "PUT" && url.pathname.startsWith("/api/users/")) {
    if (!hasPermission(user, "users.update")) return json(res, 403, { error: "Your effective access does not permit updating users." });
    const userId = decodeURIComponent(url.pathname.slice("/api/users/".length)); const input = await body(req);
    const existing = db.prepare("SELECT * FROM server_users WHERE id=?").get(userId);
    if (!existing) return json(res, 404, { error: "System user was not found." });
    const accessError = validateAccessInput(user, input); if (accessError) return json(res, 400, { error: accessError });
    if (existing.role === "super_admin" && !(input.role_ids || []).includes("70000000-0000-4000-8000-000000000001")) return json(res, 400, { error: "The built-in Super Admin role cannot be removed." });
    let salt = existing.password_salt, hash = existing.password_hash, mustChange = existing.must_change_password;
    if (input.temporary_password) { if (String(input.temporary_password).length < 12) return json(res, 400, { error: "A temporary password must contain at least 12 characters." }); salt = crypto.randomBytes(16).toString("base64"); hash = passwordHash(input.temporary_password, salt); mustChange = 1; }
    db.prepare(`UPDATE server_users SET display_name=?,email=?,role=?,role_ids=?,branch_ids=?,client_ids=?,direct_grants=?,direct_denies=?,scope_type=?,resource_assignments=?,linked_employee_id=?,manager_user_id=?,is_active=?,password_salt=?,password_hash=?,must_change_password=?,updated_at=? WHERE id=?`)
      .run(input.display_name, input.email, input.role, JSON.stringify(input.role_ids || []), JSON.stringify(input.branch_ids || []), JSON.stringify(input.client_ids || []), JSON.stringify(input.direct_grants || []), JSON.stringify(input.direct_denies || []), input.scope_type || "organization", JSON.stringify(input.resource_assignments || []), input.linked_employee_id || null, input.manager_user_id || null, input.is_active ? 1 : 0, salt, hash, mustChange, now(), userId);
    return json(res, 200, safeUser(db.prepare("SELECT * FROM server_users WHERE id=?").get(userId)));
  }
  if (req.method === "GET" && url.pathname === "/api/sync/status") {
    if (!hasPermission(user, "sync.view")) return json(res, 403, { error: "Your effective access does not permit viewing synchronization." });
    const config = readConfig(); const history = db.prepare("SELECT * FROM server_sync_log ORDER BY started_at DESC LIMIT 20").all();
    const recentConflicts = db.prepare("SELECT * FROM server_sync_conflicts ORDER BY created_at DESC LIMIT 20").all();
    const storageGroups = readStorage.all().map((row) => ({ storageKey: row.storage_key, revision: row.revision, modifiedAt: row.modified_at }));
    return json(res, 200, { deploymentMode: config.deploymentMode, autoSync: Boolean(config.autoSync), syncIntervalMinutes: config.syncIntervalMinutes, remoteUrl: config.remoteUrl, replicationKey: config.replicationKey, configured: Boolean(config.remoteUrl), running: syncing, counts: countSyncStates(), storageGroups, latest: history[0] || null, history, recentConflicts });
  }
  if (req.method === "PUT" && url.pathname === "/api/sync/config") {
    if (!hasPermission(user, "sync.manage")) return json(res, 403, { error: "Your effective access does not permit managing synchronization." });
    const input = await body(req); const existing = readConfig();
    const deploymentMode = input.deploymentMode === "HYBRID" ? "HYBRID" : "LAN_ONLY";
    const syncIntervalMinutes = Math.min(1440, Math.max(1, Number(input.syncIntervalMinutes || 5)));
    const remoteUrl = String(input.remoteUrl || "").trim().replace(/\/$/, "");
    if (deploymentMode === "HYBRID" && remoteUrl && !/^https?:\/\//i.test(remoteUrl)) return json(res, 400, { error: "Remote server URL must start with http:// or https://." });
    const next = { ...existing, deploymentMode, autoSync: deploymentMode === "HYBRID" && Boolean(input.autoSync), syncIntervalMinutes, remoteUrl, replicationKey: String(input.replicationKey || existing.replicationKey) };
    fs.writeFileSync(configPath, JSON.stringify(next, null, 2));
    const history = db.prepare("SELECT * FROM server_sync_log ORDER BY started_at DESC LIMIT 20").all();
    return json(res, 200, { deploymentMode: next.deploymentMode, autoSync: next.autoSync, syncIntervalMinutes: next.syncIntervalMinutes, remoteUrl: next.remoteUrl, replicationKey: next.replicationKey, configured: Boolean(next.remoteUrl), running: syncing, counts: countSyncStates(), storageGroups: readStorage.all().map((row) => ({ storageKey: row.storage_key, revision: row.revision, modifiedAt: row.modified_at })), latest: history[0] || null, history, recentConflicts: db.prepare("SELECT * FROM server_sync_conflicts ORDER BY created_at DESC LIMIT 20").all() });
  }
  if (req.method === "POST" && url.pathname === "/api/sync/run") {
    if (!hasPermission(user, "sync.manage")) return json(res, 403, { error: "Your effective access does not permit running synchronization." });
    try { return json(res, 200, await runSync()); } catch (error) { return json(res, 400, { error: error.message }); }
  }
  if (req.method === "POST" && url.pathname === "/api/sync/test") {
    if (!hasPermission(user, "sync.manage")) return json(res, 403, { error: "Your effective access does not permit testing synchronization." });
    const input = await body(req); const config = readConfig();
    const remoteUrl = String(input.remoteUrl || config.remoteUrl || "").trim().replace(/\/$/, "");
    const replicationKey = String(input.replicationKey || config.replicationKey || "");
    if (!remoteUrl) return json(res, 400, { error: "Enter a remote server URL first." });
    if (!/^https?:\/\//i.test(remoteUrl)) return json(res, 400, { error: "Remote server URL must start with http:// or https://." });
    try {
      const healthResponse = await fetch(`${remoteUrl}/api/health`, { signal: AbortSignal.timeout(10000) });
      const health = await healthResponse.json(); if (!healthResponse.ok) throw new Error(health.error || `Remote server returned ${healthResponse.status}.`);
      const authResponse = await fetch(`${remoteUrl}/api/replication/exchange`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${replicationKey}` }, body: JSON.stringify({ records: [] }), signal: AbortSignal.timeout(10000) });
      const authResult = await authResponse.json(); if (!authResponse.ok) throw new Error(authResult.error || `Replication authentication returned ${authResponse.status}.`);
      return json(res, 200, { ok: true, database: health.database || "Remote database", deploymentMode: health.deploymentMode || "Unknown" });
    } catch (error) { return json(res, 400, { error: `Remote host could not be reached: ${error.message}` }); }
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

let lastAutomaticSync = 0;
setInterval(async () => {
  const config = readConfig();
  const interval = Math.max(1, Number(config.syncIntervalMinutes || 5)) * 60_000;
  if (!config.autoSync || config.deploymentMode !== "HYBRID" || syncing || Date.now() - lastAutomaticSync < interval) return;
  lastAutomaticSync = Date.now(); try { await runSync(); } catch {}
}, 60_000);

function shutdown() { try { server.close(); } finally { db.close(); process.exit(0); } }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
