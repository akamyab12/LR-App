# LR-App RLS Role Plan

## 1) Final role definitions

Canonical role enum values:

- `platform_admin`
- `company_admin`
- `exhibitor`

Recommended DB type:

```sql
create type public.app_role as enum (
  'platform_admin',
  'company_admin',
  'exhibitor'
);
```

Recommended `public.users` columns (minimum for this model):

- `id uuid primary key` (must match `auth.users.id`)
- `company_id uuid not null references public.companies(id)`
- `role public.app_role not null`

## 2) Access matrix (companies / users / leads)

| Table | Role | Read | Insert | Update | Delete |
|---|---|---|---|---|---|
| `public.companies` | `platform_admin` | any company | yes | yes | yes |
| `public.companies` | `company_admin` | own company | no | own company | no |
| `public.companies` | `exhibitor` | own company | no | no | no |
| `public.users` | `platform_admin` | any user | yes | yes | yes |
| `public.users` | `company_admin` | users in own company | yes (same company only) | users in own company (cannot elevate to `platform_admin`) | users in own company (except `platform_admin`) |
| `public.users` | `exhibitor` | self only | no | self only | no |
| `public.leads` | `platform_admin` | any lead | yes | yes | yes |
| `public.leads` | `company_admin` | own company leads | yes (own company only) | own company leads | own company leads |
| `public.leads` | `exhibitor` | own company leads | yes (own company only) | own company leads | no (recommended) |

Notes:

- “own company” means `table.company_id = current user company_id`.
- If you want stricter exhibitor writes (for example, only rows they created), add `created_by = auth.uid()` clauses on `UPDATE/DELETE`.

## 3) Exact Supabase RLS policy logic

## 3.1 Helper functions (shared in policies)

```sql
create schema if not exists app;

create or replace function app.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid()
$$;

create or replace function app.current_role()
returns public.app_role
language sql
stable
as $$
  select u.role
  from public.users u
  where u.id = auth.uid()
$$;

create or replace function app.current_company_id()
returns uuid
language sql
stable
as $$
  select u.company_id
  from public.users u
  where u.id = auth.uid()
$$;

create or replace function app.is_platform_admin()
returns boolean
language sql
stable
as $$
  select app.current_role() = 'platform_admin'::public.app_role
$$;

create or replace function app.is_company_admin()
returns boolean
language sql
stable
as $$
  select app.current_role() = 'company_admin'::public.app_role
$$;
```

## 3.2 `public.companies` policies

```sql
alter table public.companies enable row level security;

drop policy if exists companies_select on public.companies;
create policy companies_select
on public.companies
for select
to authenticated
using (
  app.is_platform_admin()
  or id = app.current_company_id()
);

drop policy if exists companies_insert on public.companies;
create policy companies_insert
on public.companies
for insert
to authenticated
with check (
  app.is_platform_admin()
);

drop policy if exists companies_update on public.companies;
create policy companies_update
on public.companies
for update
to authenticated
using (
  app.is_platform_admin()
  or (app.is_company_admin() and id = app.current_company_id())
)
with check (
  app.is_platform_admin()
  or (app.is_company_admin() and id = app.current_company_id())
);

drop policy if exists companies_delete on public.companies;
create policy companies_delete
on public.companies
for delete
to authenticated
using (
  app.is_platform_admin()
);
```

## 3.3 `public.users` policies

```sql
alter table public.users enable row level security;

drop policy if exists users_select on public.users;
create policy users_select
on public.users
for select
to authenticated
using (
  app.is_platform_admin()
  or (app.is_company_admin() and company_id = app.current_company_id())
  or id = app.current_user_id()
);

drop policy if exists users_insert on public.users;
create policy users_insert
on public.users
for insert
to authenticated
with check (
  app.is_platform_admin()
  or (
    app.is_company_admin()
    and company_id = app.current_company_id()
    and role in ('company_admin'::public.app_role, 'exhibitor'::public.app_role)
  )
);

drop policy if exists users_update on public.users;
create policy users_update
on public.users
for update
to authenticated
using (
  app.is_platform_admin()
  or (
    app.is_company_admin()
    and company_id = app.current_company_id()
    and role <> 'platform_admin'::public.app_role
  )
  or id = app.current_user_id()
)
with check (
  app.is_platform_admin()
  or (
    app.is_company_admin()
    and company_id = app.current_company_id()
    and role in ('company_admin'::public.app_role, 'exhibitor'::public.app_role)
  )
  or (
    id = app.current_user_id()
    and company_id = app.current_company_id()
  )
);

drop policy if exists users_delete on public.users;
create policy users_delete
on public.users
for delete
to authenticated
using (
  app.is_platform_admin()
  or (
    app.is_company_admin()
    and company_id = app.current_company_id()
    and role <> 'platform_admin'::public.app_role
  )
);
```

## 3.4 `public.leads` policies

```sql
alter table public.leads enable row level security;

drop policy if exists leads_select on public.leads;
create policy leads_select
on public.leads
for select
to authenticated
using (
  app.is_platform_admin()
  or company_id = app.current_company_id()
);

drop policy if exists leads_insert on public.leads;
create policy leads_insert
on public.leads
for insert
to authenticated
with check (
  app.is_platform_admin()
  or company_id = app.current_company_id()
);

drop policy if exists leads_update on public.leads;
create policy leads_update
on public.leads
for update
to authenticated
using (
  app.is_platform_admin()
  or company_id = app.current_company_id()
)
with check (
  app.is_platform_admin()
  or company_id = app.current_company_id()
);

drop policy if exists leads_delete on public.leads;
create policy leads_delete
on public.leads
for delete
to authenticated
using (
  app.is_platform_admin()
  or (
    app.is_company_admin()
    and company_id = app.current_company_id()
  )
);
```

## 4) Safe cross-company querying for `platform_admin`

Baseline:

- Keep normal app queries tenant-scoped with `.eq('company_id', activeCompanyId)`.
- Allow cross-company querying only when role is `platform_admin`.

SQL pattern for controlled cross-company reads:

```sql
create or replace function app.admin_list_leads(
  p_company_ids uuid[] default null,
  p_limit int default 100,
  p_offset int default 0
)
returns setof public.leads
language sql
security invoker
stable
as $$
  select l.*
  from public.leads l
  where app.is_platform_admin()
    and (p_company_ids is null or l.company_id = any (p_company_ids))
  order by l.created_at desc
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0)
$$;
```

Why this is safe:

- `security invoker` keeps caller RLS context.
- `app.is_platform_admin()` gates cross-company result sets.
- Company filters + capped pagination prevent unbounded scans in client calls.
