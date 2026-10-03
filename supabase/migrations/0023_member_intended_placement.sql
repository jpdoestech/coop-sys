alter table public.members
  add column proposed_branch_id uuid references public.branches(id) on delete set null,
  add column proposed_client_id uuid references public.clients(id) on delete set null;

create index members_proposed_branch_idx
  on public.members (proposed_branch_id) where deleted_at is null;
create index members_proposed_client_idx
  on public.members (proposed_client_id) where deleted_at is null;

create or replace function public.validate_member_proposed_placement()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.proposed_client_id is not null and not exists (
    select 1 from public.clients
    where id = new.proposed_client_id
      and branch_id = new.proposed_branch_id
      and deleted_at is null
  ) then
    raise exception 'The selected client does not belong to the proposed branch.';
  end if;
  return new;
end;
$$;

create trigger members_validate_proposed_placement
before insert or update of proposed_branch_id, proposed_client_id on public.members
for each row execute function public.validate_member_proposed_placement();

-- Preserve current production placement for existing linked members.
update public.members m
set proposed_branch_id = ea.branch_id,
    proposed_client_id = ea.client_id,
    updated_at = now()
from public.employees e
join public.employment_assignments ea on ea.employee_id = e.id
where e.member_id = m.id
  and e.deleted_at is null
  and ea.end_date is null
  and ea.deleted_at is null;

create or replace function public.sync_member_active_placement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.end_date is null and new.deleted_at is null then
    update public.members m
    set proposed_branch_id = new.branch_id,
        proposed_client_id = new.client_id,
        updated_at = now()
    from public.employees e
    where e.id = new.employee_id and m.id = e.member_id;
  end if;
  return new;
end;
$$;

create trigger employment_assignments_sync_member_placement
after insert or update of branch_id, client_id, end_date, deleted_at on public.employment_assignments
for each row execute function public.sync_member_active_placement();

create or replace function public.current_user_can_access_member(target_member_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select scope_type from public.users where id = auth.uid()), 'self') = 'organization'
    or exists (
      select 1
      from public.members m
      where m.id = target_member_id
        and case coalesce((select scope_type from public.users where id = auth.uid()), 'self')
          when 'assigned_branches' then exists (
            select 1 from public.user_branch_access
            where user_id = auth.uid() and branch_id = m.proposed_branch_id
          )
          when 'assigned_clients' then exists (
            select 1 from public.user_client_access
            where user_id = auth.uid() and client_id = m.proposed_client_id
          )
          else false
        end
    )
    or exists (
      select 1 from public.employees e
      where e.member_id = target_member_id
        and e.deleted_at is null
        and public.current_user_can_access_employee(e.id)
    );
$$;
