pragma foreign_keys = on;

create table religion_affiliations (
  id text primary key,
  code text not null unique,
  name text not null unique,
  category text not null default 'religion' check (category in ('religion','social','none','other')),
  is_active integer not null default 1,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

alter table members add column religion_affiliation_id text references religion_affiliations(id) on delete set null;
alter table employees add column religion_affiliation_id text references religion_affiliations(id) on delete set null;

create table beneficiaries (
  id text primary key,
  member_id text references members(id) on delete cascade,
  employee_id text references employees(id) on delete cascade,
  full_name text not null,
  relationship text not null,
  date_of_birth text,
  contact_number text,
  is_active integer not null default 1,
  deactivated_at text,
  deactivation_reason text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  deleted_at text,
  sync_status text not null default 'synced' check (sync_status in ('synced','pending_create','pending_update','pending_delete','conflict')),
  check ((member_id is not null) + (employee_id is not null) = 1),
  check (is_active = 1 or (deactivated_at is not null and length(trim(deactivation_reason)) > 0))
);

create index beneficiaries_member_idx on beneficiaries(member_id, deleted_at);
create index beneficiaries_employee_idx on beneficiaries(employee_id, deleted_at);

create trigger beneficiaries_active_limit_insert
before insert on beneficiaries
when new.is_active = 1 and new.deleted_at is null
begin
  select case when (
    select count(*) from beneficiaries existing
    where existing.deleted_at is null and existing.is_active = 1
      and ((new.member_id is not null and existing.member_id = new.member_id)
        or (new.employee_id is not null and existing.employee_id = new.employee_id))
  ) >= 3 then raise(abort, 'A person can have at most three active beneficiaries.') end;
end;

create trigger beneficiaries_active_limit_update
before update on beneficiaries
when new.is_active = 1 and new.deleted_at is null
begin
  select case when (
    select count(*) from beneficiaries existing
    where existing.id <> new.id and existing.deleted_at is null and existing.is_active = 1
      and ((new.member_id is not null and existing.member_id = new.member_id)
        or (new.employee_id is not null and existing.employee_id = new.employee_id))
  ) >= 3 then raise(abort, 'A person can have at most three active beneficiaries.') end;
end;
