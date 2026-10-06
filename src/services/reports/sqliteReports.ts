import type { ReportPage, ReportQuery } from "../repositories/ReportRepository";

type SqliteDatabase = { prepare(sql: string): { all(...params: (string | number)[]): unknown[]; get(...params: (string | number)[]): unknown } };
type Scope = { scopeType: string; branchIds: string[]; clientIds: string[]; linkedEmployeeId?: string | null };

// Embedded into the EXE bundle; no runtime imports or browser APIs here.
export function sqliteReportPage(db: SqliteDatabase, query: ReportQuery, scope: Scope): ReportPage {
  if (!["members", "employees", "deployment"].includes(query.kind)) throw new Error("Unknown report.");
  const sortKeys = ["number", "name", "branch", "client", "department", "position", "statusId", "typeId", "date", "approval", "attention", "employees", "active", "direct", "clientDeployed"];
  const sort = query.sort || (query.kind === "deployment" ? "branch" : "name");
  if (!sortKeys.includes(sort)) throw new Error("Unknown sort column.");
  for (const date of [query.dateFrom, query.dateTo]) if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error("Enter a valid report date.");
  if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) throw new Error("The end date must not precede the start date.");
  const member = query.kind === "members", kind = member ? "members" : "employees";
  const placement = member ? "coalesce(linked.placement,json_extract(p.value,'$.active_assignment'))" : "json_extract(p.value,'$.active_assignment')";
  const branch = member ? "case when linked.employee_id is not null then coalesce(json_extract(linked.placement,'$.branch_id'),'') else coalesce(json_extract(p.value,'$.proposed_branch_id'),'') end" : `coalesce(json_extract(${placement},'$.branch_id'),'')`;
  const client = member ? "coalesce(json_extract(linked.placement,'$.client_id'),case when linked.employee_id is null then json_extract(p.value,'$.proposed_client_id') end,'')" : `coalesce(json_extract(${placement},'$.client_id'),'')`;
  const cte = `with
    people as (select value from json_each(coalesce((select value from app_storage where storage_key='coop_sys_${kind}'),'[]'))),
    employees_source as (select value from json_each(coalesce((select value from app_storage where storage_key='coop_sys_employees'),'[]')) where json_extract(value,'$.deleted_at') is null),
    linked as (select json_extract(value,'$.id') as employee_id,json_extract(value,'$.member_id') as member_id,json_extract(value,'$.active_assignment') as placement from employees_source),
    branches as (select value from json_each(coalesce((select json_extract(value,'$.branches') from app_storage where storage_key='coop_sys_organization_directory'),'[]'))),
    clients as (select value from json_each(coalesce((select json_extract(value,'$.clients') from app_storage where storage_key='coop_sys_organization_directory'),'[]'))),
    departments as (select value from json_each(coalesce((select json_extract(value,'$.departments') from app_storage where storage_key='coop_sys_organization_directory'),'[]'))),
    positions as (select value from json_each(coalesce((select json_extract(value,'$.positions') from app_storage where storage_key='coop_sys_organization_directory'),'[]'))),
    source as (select
      json_extract(p.value,'$.id') as id, coalesce(json_extract(p.value,'$.${member ? "membership_number" : "employee_number"}'),'') as number,
      coalesce(json_extract(p.value,'$.last_name'),'')||', '||coalesce(json_extract(p.value,'$.first_name'),'')||case when coalesce(json_extract(p.value,'$.middle_name'),'')<>'' then ' '||json_extract(p.value,'$.middle_name') else '' end||case when coalesce(json_extract(p.value,'$.suffix'),'')<>'' then ' '||json_extract(p.value,'$.suffix') else '' end as name,
      ${branch} as branchId, ${client} as clientId, coalesce(json_extract(b.value,'$.label'),'No placement') as branch, coalesce(json_extract(c.value,'$.label'),'Direct employee') as client,
      coalesce(json_extract(p.value,'$.department_id'),'') as departmentId,
      coalesce(nullif(json_extract(p.value,'$.pending_department_name'),''),json_extract(d.value,'$.label'),'Not set') as department,
      coalesce(nullif(json_extract(p.value,'$.pending_position_name'),''),json_extract(pos.value,'$.label'),'Not set') as position,
      coalesce(json_extract(p.value,'$.${member ? "membership_status_id" : "employment_status_id"}'),'') as statusId,
      coalesce(json_extract(p.value,'$.${member ? "membership_type_id" : "employment_type_id"}'),'') as typeId,
      coalesce(json_extract(p.value,'$.${member ? "membership_date" : "date_hired"}'),'') as date,
      ${member ? "coalesce(json_extract(p.value,'$.bod_approval_status'),'pending')" : "''"} as approval,
      (coalesce(json_extract(p.value,'$.import_attention'),'{}')<>'{}' or coalesce(json_extract(p.value,'$.pending_department_name'),'')<>'' or coalesce(json_extract(p.value,'$.pending_position_name'),'')<>'') as attention,
      ${member ? "linked.employee_id" : "json_extract(p.value,'$.id')"} as employeeId,
      1 as employees, coalesce((json_extract(p.value,'$.${member ? "membership_status_id" : "employment_status_id"}')='${member ? "31" : "33"}000000-0000-4000-8000-000000000001'),0) as active,
      (${client}='') as direct, (${client}<>'') as clientDeployed
      from people p ${member ? "left join linked on linked.member_id=json_extract(p.value,'$.id')" : ""}
      left join branches b on json_extract(b.value,'$.id')=${branch}
      left join clients c on json_extract(c.value,'$.id')=${client}
      left join departments d on json_extract(d.value,'$.id')=json_extract(p.value,'$.department_id')
      left join positions pos on json_extract(pos.value,'$.id')=json_extract(p.value,'$.position_id')
      where json_extract(p.value,'$.deleted_at') is null
    )`;
  const predicates: string[] = [], params: (string | number)[] = [];
  if (scope.scopeType === "self") { predicates.push("employeeId=?"); params.push(scope.linkedEmployeeId || ""); }
  else if (scope.scopeType !== "organization") {
    const ids = scope.scopeType === "assigned_clients" ? scope.clientIds : scope.branchIds;
    predicates.push(`${scope.scopeType === "assigned_clients" ? "clientId" : "branchId"} in (select value from json_each(?))`); params.push(JSON.stringify(ids));
  }
  if (query.search?.trim()) { predicates.push("instr(lower(number||' '||name||' '||branch||' '||client||' '||department||' '||position),lower(?))>0"); params.push(query.search.trim().slice(0, 200)); }
  for (const key of ["branchId", "clientId", "statusId", "typeId", "departmentId", "approval"] as const) if (query[key]) { predicates.push(`${key}=?`); params.push(query[key]!); }
  if (query.attentionOnly) predicates.push("attention=1");
  if (query.dateFrom) { predicates.push("date>=?"); params.push(query.dateFrom); }
  if (query.dateTo) { predicates.push("date<>'' and date<=?"); params.push(query.dateTo); }
  const filtered = `${cte}, filtered as (select * from source ${predicates.length ? `where ${predicates.join(" and ")}` : ""})`;
  const grouped = query.kind === "deployment" ? "select branchId||':'||clientId as id,'' as number,'' as name,branchId,clientId,branch,client,'' as department,'' as position,'' as statusId,'' as typeId,'' as date,'' as approval,max(attention) as attention,sum(employees) as employees,sum(active) as active,sum(direct) as direct,sum(clientDeployed) as clientDeployed from filtered group by branchId,clientId,branch,client" : "select id,number,name,branchId,clientId,branch,client,department,position,statusId,typeId,date,approval,attention,employees,active,direct,clientDeployed from filtered";
  const output = `${filtered}, output as (${grouped})`;
  const stats = db.prepare(`${output} select (select count(*) from output) as total,count(*) as records,coalesce(sum(active),0) as active,sum(approval='pending') as pending,coalesce(sum(attention),0) as attention from filtered`).get(...params) as Omit<ReportPage, "items">;
  const direction = query.direction === "desc" ? "desc" : "asc";
  const limit = Number.isFinite(Number(query.limit)) ? Math.min(500, Math.max(1, Math.trunc(Number(query.limit || 25)))) : 25;
  const offset = Number.isFinite(Number(query.offset)) ? Math.max(0, Math.trunc(Number(query.offset || 0))) : 0;
  const labels = sort === "statusId"
    ? member ? ["Active", "Inactive", "Terminated", "Resigned"] : ["Active", "On Leave", "Separated", "Inactive", "Retired", "Resigned", "Terminated"]
    : sort === "typeId" ? member ? ["Regular", "Associate", "Labor"] : ["Regular", "Probationary", "Contractual", "Part-time", "Temporary", "Other"] : [];
  const prefix = sort === "statusId" ? member ? "31" : "33" : member ? "30" : "32";
  const order = labels.length ? `case "${sort}" ${labels.map((label, index) => `when '${prefix}000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}' then '${label}'`).join(" ")} else 'Not set' end` : `"${sort}"`;
  const rows = db.prepare(`${output} select * from output order by ${order} collate nocase ${direction},id asc limit ? offset ?`).all(...params, limit, offset) as ReportPage["items"];
  return { ...stats, pending: stats.pending || 0, items: rows.map((row) => ({ ...row, attention: Boolean(row.attention) })) };
}
