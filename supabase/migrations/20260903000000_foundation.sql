begin;

create extension if not exists pgcrypto;

create type public.organization_role as enum ('owner', 'admin', 'member');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create or replace function public.is_organization_member(requested_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = requested_organization_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_organization_admin(requested_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = requested_organization_id and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

create or replace function public.is_organization_owner(requested_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = requested_organization_id and user_id = auth.uid() and role = 'owner'
  );
$$;

revoke all on function public.is_organization_member(uuid) from public;
revoke all on function public.is_organization_admin(uuid) from public;
revoke all on function public.is_organization_owner(uuid) from public;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.is_organization_admin(uuid) to authenticated;
grant execute on function public.is_organization_owner(uuid) to authenticated;

create or replace function public.create_organization(organization_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if char_length(trim(organization_name)) not between 1 and 200 then raise exception 'invalid organization name' using errcode = '22023'; end if;
  insert into public.organizations(name) values (trim(organization_name)) returning id into new_id;
  insert into public.organization_members(organization_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end;
$$;

revoke all on function public.create_organization(text) from public;
grant execute on function public.create_organization(text) to authenticated;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  website_url text check (website_url is null or char_length(website_url) <= 2048),
  industry text check (industry is null or char_length(industry) <= 100),
  description text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

-- PII is isolated here. Analysis tables and the analysis-safe view never reference contacts.
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text check (full_name is null or char_length(full_name) <= 200),
  department text check (department is null or char_length(department) <= 200),
  email text check (email is null or char_length(email) <= 320),
  phone text check (phone is null or char_length(phone) <= 50),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sales_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  occurred_on date not null,
  activity_type text not null check (char_length(activity_type) between 1 and 100),
  outcome text check (outcome is null or char_length(outcome) <= 100),
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 100),
  occurred_on date not null,
  title text not null check (char_length(title) between 1 and 300),
  source_url text check (source_url is null or char_length(source_url) <= 2048),
  summary text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sales_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'won', 'lost', 'paused')),
  title text not null check (char_length(title) between 1 and 300),
  expected_close_on date,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scoring_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  rule_type text not null check (char_length(rule_type) between 1 and 100),
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index companies_organization_id_idx on public.companies(organization_id);
create index contacts_organization_id_idx on public.contacts(organization_id);
create index contacts_company_id_idx on public.contacts(company_id);
create index sales_history_organization_company_idx on public.sales_history(organization_id, company_id);
create index events_organization_company_idx on public.events(organization_id, company_id);
create index sales_opportunities_organization_company_idx on public.sales_opportunities(organization_id, company_id);
create index scoring_rules_organization_id_idx on public.scoring_rules(organization_id);

create or replace function public.protect_last_organization_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    perform 1 from public.organization_members
    where organization_id = old.organization_id and role = 'owner' and user_id <> old.user_id
    limit 1;
    if not found then raise exception 'organization must retain at least one owner' using errcode = '23514'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger organization_members_protect_last_owner
before update of role or delete on public.organization_members
for each row execute function public.protect_last_organization_owner();

create or replace function public.enforce_company_organization_match()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.companies where id = new.company_id and organization_id = new.organization_id) then
    raise exception 'company does not belong to organization' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger contacts_company_organization before insert or update on public.contacts for each row execute function public.enforce_company_organization_match();
create trigger sales_history_company_organization before insert or update on public.sales_history for each row execute function public.enforce_company_organization_match();
create trigger events_company_organization before insert or update on public.events for each row execute function public.enforce_company_organization_match();
create trigger sales_opportunities_company_organization before insert or update on public.sales_opportunities for each row execute function public.enforce_company_organization_match();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.sales_history enable row level security;
alter table public.events enable row level security;
alter table public.sales_opportunities enable row level security;
alter table public.scoring_rules enable row level security;

create policy organizations_select_member on public.organizations for select to authenticated using (public.is_organization_member(id));
create policy organizations_update_admin on public.organizations for update to authenticated using (public.is_organization_admin(id)) with check (public.is_organization_admin(id));
create policy organization_members_select_member on public.organization_members for select to authenticated using (public.is_organization_member(organization_id));
create policy organization_members_insert_manager on public.organization_members for insert to authenticated with check (
  public.is_organization_owner(organization_id)
  or (public.is_organization_admin(organization_id) and role <> 'owner')
);
create policy organization_members_update_manager on public.organization_members for update to authenticated using (
  public.is_organization_owner(organization_id)
  or (public.is_organization_admin(organization_id) and role <> 'owner')
) with check (
  public.is_organization_owner(organization_id)
  or (public.is_organization_admin(organization_id) and role <> 'owner')
);
create policy organization_members_delete_manager on public.organization_members for delete to authenticated using (
  user_id <> auth.uid()
  and (
    public.is_organization_owner(organization_id)
    or (public.is_organization_admin(organization_id) and role <> 'owner')
  )
);

create policy companies_member_all on public.companies for all to authenticated using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
create policy contacts_member_all on public.contacts for all to authenticated using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
create policy sales_history_member_all on public.sales_history for all to authenticated using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
create policy events_member_all on public.events for all to authenticated using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
create policy sales_opportunities_member_all on public.sales_opportunities for all to authenticated using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
create policy scoring_rules_member_all on public.scoring_rules for all to authenticated using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));

-- Defense in depth: an allowlisted, PII-free projection for future analysis/AI services.
create view public.analysis_companies with (security_invoker = true) as
select id, organization_id, name, website_url, industry, description from public.companies;

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.organizations, public.organization_members, public.companies, public.contacts, public.sales_history, public.events, public.sales_opportunities, public.scoring_rules to authenticated;
grant select on public.analysis_companies to authenticated;

commit;
