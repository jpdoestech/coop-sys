-- One resolution per approval batch; reserve numbers across users and scopes.
create table public.bod_approval_counter (
  singleton boolean primary key default true check (singleton),
  last_number integer not null default 0 check (last_number between 0 and 999999)
);
alter table public.bod_approval_counter enable row level security;
insert into public.bod_approval_counter(singleton, last_number)
select true, coalesce(max(acceptance_resolution_number::integer), 0)
from public.members where acceptance_resolution_number ~ '^[0-9]{6}$';

create or replace function public.next_bod_resolution_number()
returns text language plpgsql security definer set search_path = public as $$
declare highest integer;
begin
  if auth.uid() is null or not public.current_user_has_permission('members.approve') then
    raise exception 'Your effective access does not permit membership approval.';
  end if;
  select greatest(c.last_number, coalesce((select max(acceptance_resolution_number::integer)
    from public.members where acceptance_resolution_number ~ '^[0-9]{6}$'), 0))
  into highest from public.bod_approval_counter c where singleton;
  if highest >= 999999 then raise exception 'The six-digit BOD resolution sequence is exhausted.'; end if;
  return lpad((highest + 1)::text, 6, '0');
end;
$$;

create or replace function public.approve_members(p_member_ids uuid[], p_approval_date date)
returns text language plpgsql security definer set search_path = public as $$
declare highest integer; resolution text; selected_count integer;
begin
  if auth.uid() is null or not public.current_user_has_permission('members.approve') then
    raise exception 'Your effective access does not permit membership approval.';
  end if;
  if p_approval_date is null or coalesce(cardinality(p_member_ids),0) = 0
    or cardinality(p_member_ids) > 5000 then raise exception 'Select pending members and a valid approval date (maximum 5,000 per batch).'; end if;
  select last_number into highest from public.bod_approval_counter where singleton for update;
  perform 1 from public.members where id = any(p_member_ids) for update;
  select count(*) into selected_count from public.members
    where id = any(p_member_ids) and deleted_at is null and bod_approval_status = 'pending'
      and public.current_user_can_access_member(id);
  if selected_count <> cardinality(p_member_ids) then
    raise exception 'Only pending membership applications within your scope can be approved.';
  end if;
  select greatest(highest, coalesce(max(acceptance_resolution_number::integer),0)) into highest
    from public.members where acceptance_resolution_number ~ '^[0-9]{6}$';
  if highest >= 999999 then raise exception 'The six-digit BOD resolution sequence is exhausted.'; end if;
  resolution := lpad((highest + 1)::text,6,'0');
  update public.bod_approval_counter set last_number = highest + 1 where singleton;
  update public.members set bod_approval_status = 'approved', acceptance_date = p_approval_date,
    acceptance_resolution_number = resolution, membership_status_id = '31000000-0000-4000-8000-000000000001',
    updated_at = now(), sync_status = 'synced' where id = any(p_member_ids);
  update public.employees set employment_status_id = '33000000-0000-4000-8000-000000000001',
    date_separated = null, updated_at = now(), sync_status = 'synced'
    where member_id = any(p_member_ids) and deleted_at is null;
  return resolution;
end;
$$;
revoke all on public.bod_approval_counter from anon, authenticated;
revoke all on function public.next_bod_resolution_number() from public;
revoke all on function public.approve_members(uuid[],date) from public;
grant execute on function public.next_bod_resolution_number() to authenticated;
grant execute on function public.approve_members(uuid[],date) to authenticated;
