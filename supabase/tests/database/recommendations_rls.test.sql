begin;
select plan(10);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'timing-owner@example.invalid', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'timing-outsider@example.invalid', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'timing-member@example.invalid', '', now(), '{}', '{}', now(), now(), '', '', '', '');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select public.create_organization('Timing organization') as organization_id \gset timing_
insert into public.companies (organization_id, name) values (:'timing_organization_id', 'Timing company') returning id as company_id \gset timing_
insert into public.events (organization_id, company_id, event_type, occurred_on, title)
values (:'timing_organization_id', :'timing_company_id', 'funding', '2026-09-01', 'Funding event') returning id as event_id \gset timing_
insert into public.scoring_rules (organization_id, name, rule_type, configuration)
values (:'timing_organization_id', 'Funding follow-up', 'event_timing', '{"eventType":"funding","offsetDays":14}') returning id as rule_id \gset timing_
insert into public.organization_members (organization_id, user_id, role)
values (:'timing_organization_id', '10000000-0000-4000-8000-000000000003', 'member');

select lives_ok(format('insert into public.sales_recommendations (organization_id, company_id, source_event_id, scoring_rule_id, recommended_on, reason) values (%L,%L,%L,%L,%L,%L)', :'timing_organization_id', :'timing_company_id', :'timing_event_id', :'timing_rule_id', '2026-09-15', 'Funding follow-up'), 'organization member can save recommendation');
select is((select count(*) from public.sales_recommendations), 1::bigint, 'organization member can read recommendation');
select throws_ok(format('insert into public.events (organization_id, company_id, event_type, occurred_on, title) values (%L,%L,%L,%L,%L)', :'timing_organization_id', :'timing_company_id', 'funding', '2026-09-01', 'Funding event'), '23505', null, 'duplicate event is rejected');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is_empty($$ select id from public.sales_recommendations $$, 'other organization cannot read recommendations');
select results_eq(format('delete from public.sales_recommendations where organization_id = %L returning id::text', :'timing_organization_id'), array[]::text[], 'other organization cannot delete recommendations');

set local role anon;
select throws_ok($$ select id from public.sales_recommendations $$, '42501', 'permission denied for table sales_recommendations', 'anonymous cannot read recommendations');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select results_eq(format('update public.scoring_rules set configuration = %L where id = %L returning id::text', '{"eventType":"funding","offsetDays":1}', :'timing_rule_id'), array[]::text[], 'member cannot change timing rules');

reset role;
select throws_ok(format('insert into public.scoring_rules (organization_id, name, rule_type, configuration) values (%L,%L,%L,%L)', :'timing_organization_id', 'Invalid timing rule', 'event_timing', '{"eventType":"funding","offsetDays":1.5}'), '23514', null, 'database rejects non-integer timing rule configuration');
select throws_ok(format('insert into public.sales_recommendations (organization_id, company_id, source_event_id, scoring_rule_id, recommended_on, reason) values (%L,%L,%L,%L,%L,%L)', :'timing_organization_id', :'timing_company_id', gen_random_uuid(), :'timing_rule_id', '2026-09-16', 'Invalid event'), '23514', null, 'unknown source event is rejected');
select is((select count(*) from public.sales_recommendations), 1::bigint, 'rejected writes leave original recommendation intact');

select * from finish();
rollback;
