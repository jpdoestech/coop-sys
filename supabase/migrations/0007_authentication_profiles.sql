create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  default_role_id uuid;
begin
  insert into public.users (id, email, display_name, is_active)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
    true
  )
  on conflict (id) do update set email = excluded.email, updated_at = now();

  select id into default_role_id from public.roles where code = 'branch_user';
  if default_role_id is not null then
    insert into public.user_roles (user_id, role_id) values (new.id, default_role_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute procedure public.handle_new_auth_user();

insert into public.users (id, email, display_name, is_active)
select id, email, coalesce(nullif(raw_user_meta_data ->> 'display_name', ''), split_part(email, '@', 1)), true
from auth.users
where email is not null
on conflict (id) do update set email = excluded.email, updated_at = now();
