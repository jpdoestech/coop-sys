create table public.attendance_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  blank_mode text not null default 'present' check(blank_mode in ('present','absent'))
);
alter table public.attendance_preferences enable row level security;
create policy "read own attendance preferences" on public.attendance_preferences for select to authenticated
  using(user_id=auth.uid() and public.current_user_has_permission('payroll.view') and exists(select 1 from public.users where id=auth.uid() and is_active));
create policy "create own attendance preferences" on public.attendance_preferences for insert to authenticated
  with check(user_id=auth.uid() and public.current_user_has_permission('payroll.view') and exists(select 1 from public.users where id=auth.uid() and is_active));
create policy "update own attendance preferences" on public.attendance_preferences for update to authenticated
  using(user_id=auth.uid() and public.current_user_has_permission('payroll.view') and exists(select 1 from public.users where id=auth.uid() and is_active))
  with check(user_id=auth.uid() and public.current_user_has_permission('payroll.view') and exists(select 1 from public.users where id=auth.uid() and is_active));
grant select,insert,update on public.attendance_preferences to authenticated;
