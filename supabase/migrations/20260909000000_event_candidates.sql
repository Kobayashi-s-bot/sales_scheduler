begin;

create table public.event_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  public_source_id uuid references public.public_sources(id) on delete set null,
  source_document_id uuid references public.source_documents(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 100),
  occurred_on date,
  title text not null check (char_length(title) between 1 and 300),
  summary text,
  source_url text not null check (source_url ~ '^https://' and char_length(source_url) <= 2048),
  published_at timestamptz,
  confidence numeric check (confidence is null or confidence between 0 and 1),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  accepted_event_id uuid references public.events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_candidates_dedup_key unique nulls not distinct
    (organization_id, company_id, event_type, occurred_on, title, source_url),
  constraint event_candidates_review_state check (
    (status <> 'pending' or (reviewed_at is null and accepted_event_id is null))
    and (status <> 'accepted' or occurred_on is not null)
  )
);

create index event_candidates_status_created_idx
  on public.event_candidates (organization_id, status, created_at desc);
create index event_candidates_company_idx
  on public.event_candidates (organization_id, company_id, status);

create trigger event_candidates_company_organization
  before insert or update on public.event_candidates
  for each row execute function public.enforce_company_organization_match();

alter table public.event_candidates enable row level security;
create policy event_candidates_select_member on public.event_candidates
  for select to authenticated using (public.is_organization_member(organization_id));
create policy event_candidates_insert_member on public.event_candidates
  for insert to authenticated with check (public.is_organization_member(organization_id));
create policy event_candidates_update_member on public.event_candidates
  for update to authenticated using (public.is_organization_member(organization_id))
  with check (public.is_organization_member(organization_id));
revoke all on public.event_candidates from anon;
grant select, insert, update on public.event_candidates to authenticated;

create or replace function public.accept_event_candidate(
  p_candidate_id uuid,
  p_event_type text default null,
  p_occurred_on date default null,
  p_title text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c public.event_candidates%rowtype;
  eid uuid;
  final_type text;
  final_date date;
  final_title text;
begin
  select * into c
  from public.event_candidates
  where id = p_candidate_id
  for update;
  if not found then raise exception 'candidate not found'; end if;
  if c.status <> 'pending' then raise exception 'candidate is not pending'; end if;

  final_type := coalesce(p_event_type, c.event_type);
  final_date := coalesce(p_occurred_on, c.occurred_on);
  final_title := coalesce(p_title, c.title);
  if final_date is null then raise exception 'occurred_on is required'; end if;

  insert into public.events (
    organization_id, company_id, event_type, occurred_on, title,
    source_document_id, source_url, summary, published_at, confidence
  ) values (
    c.organization_id, c.company_id, final_type, final_date, final_title,
    c.source_document_id, c.source_url, c.summary, c.published_at, c.confidence
  )
  -- 意図的な空更新で既存eventを再利用し、idを返す。
  on conflict (organization_id, company_id, event_type, occurred_on, title, source_url, source_document_id)
  do update set event_type = excluded.event_type
  returning id into eid;

  update public.event_candidates
  set status = 'accepted', occurred_on = final_date, event_type = final_type,
      title = final_title, reviewed_by = auth.uid(), reviewed_at = now(),
      accepted_event_id = eid, updated_at = now()
  where id = c.id;
  return eid;
end;
$$;
revoke all on function public.accept_event_candidate(uuid, text, date, text) from public;
revoke all on function public.accept_event_candidate(uuid, text, date, text) from anon;
grant execute on function public.accept_event_candidate(uuid, text, date, text) to authenticated;

commit;
