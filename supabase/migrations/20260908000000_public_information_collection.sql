begin;

create table public.public_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  source_url text not null check (source_url ~ '^https://' and char_length(source_url) <= 2048),
  source_type text not null check (source_type in ('rss', 'html')),
  refresh_interval_minutes integer not null default 1440 check (refresh_interval_minutes between 5 and 43200),
  last_checked_at timestamptz,
  next_check_at timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_error text check (last_error is null or char_length(last_error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, company_id, source_url)
);

create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  public_source_id uuid not null references public.public_sources(id) on delete cascade,
  source_url text not null check (source_url ~ '^https://' and char_length(source_url) <= 2048),
  title text not null check (char_length(title) between 1 and 500),
  published_at timestamptz,
  fetched_at timestamptz not null,
  last_checked_at timestamptz not null,
  next_check_at timestamptz not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, company_id, source_url)
);

alter table public.events
  add column source_document_id uuid references public.source_documents(id) on delete set null,
  add column published_at timestamptz,
  add column confidence numeric check (confidence is null or confidence between 0 and 1);

alter table public.events drop constraint events_deduplication_key;
alter table public.events add constraint events_deduplication_key unique nulls not distinct
  (organization_id, company_id, event_type, occurred_on, title, source_url, source_document_id);

create index public_sources_due_idx on public.public_sources(organization_id, next_check_at);
create index source_documents_due_idx on public.source_documents(organization_id, next_check_at);

create trigger public_sources_company_organization before insert or update on public.public_sources for each row execute function public.enforce_company_organization_match();
create trigger source_documents_company_organization before insert or update on public.source_documents for each row execute function public.enforce_company_organization_match();

create or replace function public.enforce_collection_source_match()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.public_sources where id = new.public_source_id and organization_id = new.organization_id and company_id = new.company_id) then
    raise exception 'public source does not belong to company and organization' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger source_documents_source_match before insert or update on public.source_documents for each row execute function public.enforce_collection_source_match();

alter table public.public_sources enable row level security;
alter table public.source_documents enable row level security;
create policy public_sources_member_all on public.public_sources for all to authenticated using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
create policy source_documents_member_all on public.source_documents for all to authenticated using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
revoke all on public.public_sources, public.source_documents from anon;
grant select, insert, update, delete on public.public_sources, public.source_documents to authenticated;

commit;
