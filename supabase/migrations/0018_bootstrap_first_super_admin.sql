-- A fresh project needs one administrator before access can be managed in-app.
-- This only acts when no Super Admin is assigned and chooses the oldest Auth user.
do $$
declare
  bootstrap_user_id uuid;
  super_admin_role_id uuid;
begin
  select id into super_admin_role_id
  from public.roles
  where code = 'super_admin';

  if super_admin_role_id is null or exists (
    select 1
    from public.user_roles ur
    where ur.role_id = super_admin_role_id
  ) then
    return;
  end if;

  select id into bootstrap_user_id
  from auth.users
  order by created_at, id
  limit 1;

  if bootstrap_user_id is null then
    return;
  end if;

  delete from public.user_roles
  where user_id = bootstrap_user_id;

  insert into public.user_roles (user_id, role_id)
  values (bootstrap_user_id, super_admin_role_id)
  on conflict do nothing;

  update public.users
  set scope_type = 'organization', updated_at = now()
  where id = bootstrap_user_id;
end;
$$;
