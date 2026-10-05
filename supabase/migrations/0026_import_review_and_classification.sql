begin;

alter table public.employees
  add column pending_department_name text,
  add column pending_position_name text,
  add column religion_affiliation text,
  add column import_attention jsonb;

alter table public.members
  add column department_id uuid references public.departments(id) on delete set null,
  add column position_id uuid references public.positions(id) on delete set null,
  add column pending_department_name text,
  add column pending_position_name text,
  add column import_attention jsonb;

update public.members m set department_id = e.department_id, position_id = e.position_id
from public.employees e where e.member_id = m.id and e.deleted_at is null;

create index employees_import_attention_idx on public.employees(id)
where import_attention is not null or pending_department_name is not null or pending_position_name is not null;
create index members_import_attention_idx on public.members(id)
where import_attention is not null or pending_department_name is not null or pending_position_name is not null;

create or replace function public.sync_person_classification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'employees' then
    update public.members m
    set department_id = new.department_id, position_id = new.position_id,
        pending_department_name = new.pending_department_name,
        pending_position_name = new.pending_position_name, updated_at = now()
    where m.id = new.member_id
      and (m.department_id, m.position_id, m.pending_department_name, m.pending_position_name)
        is distinct from (new.department_id, new.position_id, new.pending_department_name, new.pending_position_name);
  else
    if pg_trigger_depth() = 1 and auth.uid() is not null
      and not public.current_user_has_permission('employees.update')
      and exists (select 1 from public.employees e where e.member_id = new.id and e.deleted_at is null
        and (e.department_id, e.position_id, e.pending_department_name, e.pending_position_name)
          is distinct from (new.department_id, new.position_id, new.pending_department_name, new.pending_position_name)) then
      raise exception 'Employee update permission is required to change linked employment details.';
    end if;
    update public.employees e
    set department_id = new.department_id, position_id = new.position_id,
        pending_department_name = new.pending_department_name,
        pending_position_name = new.pending_position_name, updated_at = now()
    where e.member_id = new.id and e.deleted_at is null
      and (e.department_id, e.position_id, e.pending_department_name, e.pending_position_name)
        is distinct from (new.department_id, new.position_id, new.pending_department_name, new.pending_position_name);
  end if;
  return new;
end;
$$;

create trigger employees_sync_classification after insert or update of member_id, department_id, position_id, pending_department_name, pending_position_name
on public.employees for each row execute function public.sync_person_classification();
create trigger members_sync_classification after update of department_id, position_id, pending_department_name, pending_position_name
on public.members for each row execute function public.sync_person_classification();
revoke all on function public.sync_person_classification() from public;

drop policy "permission managers maintain departments" on public.departments;
drop policy "permission managers maintain positions" on public.positions;
create policy "department creators" on public.departments for insert to authenticated with check (public.current_user_has_permission('organization.create'));
create policy "department editors" on public.departments for update to authenticated using (public.current_user_has_permission('organization.update')) with check (public.current_user_has_permission('organization.update'));
create policy "department deleters" on public.departments for delete to authenticated using (public.current_user_has_permission('organization.delete'));
create policy "position creators" on public.positions for insert to authenticated with check (public.current_user_has_permission('organization.create'));
create policy "position editors" on public.positions for update to authenticated using (public.current_user_has_permission('organization.update')) with check (public.current_user_has_permission('organization.update'));
create policy "position deleters" on public.positions for delete to authenticated using (public.current_user_has_permission('organization.delete'));

commit;
