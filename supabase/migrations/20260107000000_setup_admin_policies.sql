-- Promover john89010130@gmail.com a ADMIN_MASTER
with target as (
  select id from auth.users where lower(email) = 'john89010130@gmail.com'
)
insert into user_roles (user_id, role)
select id, 'ADMIN_MASTER' from target
on conflict (user_id) do update set role = excluded.role;

-- Garantir permissões completas
with target as (
  select id from auth.users where lower(email) = 'john89010130@gmail.com'
)
insert into permissions (user_id, can_tv, can_movies, allowed_categories)
select id, true, true, '{}'::text[] from target
on conflict (user_id) do update
set can_tv = excluded.can_tv,
    can_movies = excluded.can_movies,
    allowed_categories = excluded.allowed_categories;

-- Criar políticas RLS para user_roles
alter table user_roles enable row level security;

drop policy if exists select_own_role on user_roles;
create policy select_own_role on user_roles
  for select using (auth.uid() = user_id);

-- Criar políticas RLS para permissions
alter table permissions enable row level security;

drop policy if exists select_own_permissions on permissions;
create policy select_own_permissions on permissions
  for select using (auth.uid() = user_id);

-- Adicionar política para profiles também (se necessário)
alter table profiles enable row level security;

drop policy if exists select_own_profile on profiles;
create policy select_own_profile on profiles
  for select using (auth.uid() = id);

drop policy if exists update_own_profile on profiles;
create policy update_own_profile on profiles
  for update using (auth.uid() = id);
