begin;

alter table public.events alter column occurred_on drop not null;

alter table public.events
  add constraint events_deduplication_key
  unique nulls not distinct (organization_id, company_id, event_type, occurred_on, title, source_url);

alter table public.scoring_rules add constraint scoring_rules_event_timing_configuration check (
  rule_type <> 'event_timing'
  or (
    jsonb_typeof(configuration -> 'eventType') = 'string'
    and jsonb_typeof(configuration -> 'offsetDays') = 'number'
    and (configuration ->> 'offsetDays')::numeric between 0 and 3650
    and (configuration ->> 'offsetDays')::numeric = trunc((configuration ->> 'offsetDays')::numeric)
    and (
      not configuration ? 'cooldownDays'
      or (
        jsonb_typeof(configuration -> 'cooldownDays') = 'number'
        and (configuration ->> 'cooldownDays')::numeric between 0 and 3650
        and (configuration ->> 'cooldownDays')::numeric = trunc((configuration ->> 'cooldownDays')::numeric)
      )
    )
  )
);

drop policy scoring_rules_member_all on public.scoring_rules;
create policy scoring_rules_select_member on public.scoring_rules
for select to authenticated using (public.is_organization_member(organization_id));
create policy scoring_rules_insert_admin on public.scoring_rules
for insert to authenticated with check (public.is_organization_admin(organization_id));
create policy scoring_rules_update_admin on public.scoring_rules
for update to authenticated
using (public.is_organization_admin(organization_id))
with check (public.is_organization_admin(organization_id));
create policy scoring_rules_delete_admin on public.scoring_rules
for delete to authenticated using (public.is_organization_admin(organization_id));

create table public.sales_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  source_event_id uuid not null references public.events(id) on delete cascade,
  scoring_rule_id uuid not null references public.scoring_rules(id) on delete cascade,
  recommended_on date not null,
  reason text not null check (char_length(reason) between 1 and 1000),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'completed', 'dismissed')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, company_id, source_event_id, scoring_rule_id)
);

create index sales_recommendations_organization_date_idx
  on public.sales_recommendations(organization_id, recommended_on);
create index sales_recommendations_company_date_idx
  on public.sales_recommendations(company_id, recommended_on);

create trigger sales_recommendations_company_organization
before insert or update on public.sales_recommendations
for each row execute function public.enforce_company_organization_match();

create or replace function public.enforce_recommendation_sources_match()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.events
    where id = new.source_event_id
      and company_id = new.company_id
      and organization_id = new.organization_id
  ) then
    raise exception 'event does not belong to company and organization' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.scoring_rules
    where id = new.scoring_rule_id
      and organization_id = new.organization_id
      and rule_type = 'event_timing'
  ) then
    raise exception 'rule does not belong to organization or is not an event timing rule' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger sales_recommendations_sources_match
before insert or update on public.sales_recommendations
for each row execute function public.enforce_recommendation_sources_match();

alter table public.sales_recommendations enable row level security;
create policy sales_recommendations_member_all on public.sales_recommendations
for all to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

revoke all on public.sales_recommendations from anon;
grant select, insert, update, delete on public.sales_recommendations to authenticated;

commit;
