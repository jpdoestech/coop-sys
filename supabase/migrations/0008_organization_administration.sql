alter table public.departments enable row level security;
alter table public.positions enable row level security;

create policy "authenticated users read departments"
  on public.departments for select to authenticated using (true);
create policy "authenticated users read positions"
  on public.positions for select to authenticated using (true);

create policy "organization managers maintain branches"
  on public.branches for all to authenticated
  using (public.current_user_has_role(array['super_admin','general_manager','hr_manager']))
  with check (public.current_user_has_role(array['super_admin','general_manager','hr_manager']));
create policy "organization managers maintain clients"
  on public.clients for all to authenticated
  using (public.current_user_has_role(array['super_admin','general_manager','hr_manager']))
  with check (public.current_user_has_role(array['super_admin','general_manager','hr_manager']));
create policy "organization managers maintain departments"
  on public.departments for all to authenticated
  using (public.current_user_has_role(array['super_admin','general_manager','hr_manager']))
  with check (public.current_user_has_role(array['super_admin','general_manager','hr_manager']));
create policy "organization managers maintain positions"
  on public.positions for all to authenticated
  using (public.current_user_has_role(array['super_admin','general_manager','hr_manager']))
  with check (public.current_user_has_role(array['super_admin','general_manager','hr_manager']));
