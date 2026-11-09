begin;
select plan(10);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'candidate-owner@example.invalid', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('30000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'candidate-outsider@example.invalid', '', now(), '{}', '{}', now(), now(), '', '', '', '');

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
select public.create_organization('Candidate primary') as organization_id \gset candidate_
insert into public.companies (organization_id, name)
values (:'candidate_organization_id', 'Candidate company') returning id as company_id \gset candidate_
insert into public.event_candidates (
  organization_id, company_id, event_type, occurred_on, title, source_url
) values (
  :'candidate_organization_id', :'candidate_company_id', 'funding', '2026-01-02', 'Funding round', 'https://example.com/funding'
) returning id as candidate_id \gset candidate_

select is((select count(*) from public.event_candidates), 1::bigint, 'organization member can read its candidate');

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.event_candidates), 0::bigint, 'other organization cannot read candidate');
select throws_ok(format(
  'insert into public.event_candidates (organization_id, company_id, event_type, occurred_on, title, source_url) values (%L,%L,%L,%L,%L,%L)',
  :'candidate_organization_id', :'candidate_company_id', 'funding', '2026-01-03', 'IDOR', 'https://example.com/idor'
), '23514', 'company does not belong to organization', 'other organization cannot insert candidate');
select throws_ok(format('select public.accept_event_candidate(%L)', :'candidate_candidate_id'), null, 'candidate not found', 'other organization cannot accept candidate');

set local role anon;
select throws_ok($$ select id from public.event_candidates $$, '42501', null, 'anonymous user cannot read candidates');

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
select lives_ok(format('select public.accept_event_candidate(%L)', :'candidate_candidate_id'), 'pending candidate can be accepted');
select is((select count(*) from public.events where organization_id = :'candidate_organization_id' and title = 'Funding round'), 1::bigint, 'acceptance creates an event');
select is((select status from public.event_candidates where id = :'candidate_candidate_id'), 'accepted', 'acceptance updates candidate status');
select throws_ok(format('select public.accept_event_candidate(%L)', :'candidate_candidate_id'), null, 'candidate is not pending', 'accepted candidate cannot be accepted again');

insert into public.event_candidates (
  organization_id, company_id, event_type, occurred_on, title, source_url
) values (
  :'candidate_organization_id', :'candidate_company_id', 'announcement', null, 'Undated announcement', 'https://example.com/undated'
) returning id as undated_candidate_id \gset candidate_
select throws_ok(format('select public.accept_event_candidate(%L)', :'candidate_undated_candidate_id'), null, 'occurred_on is required', 'candidate without a date cannot be accepted');

select * from finish();
rollback;
