begin;
select plan(16);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.invalid', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.invalid', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member@example.invalid', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider@example.invalid', '', now(), '{}', '{}', now(), now(), '', '', '', '');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select lives_ok($$ select public.create_organization('Primary organization') $$, 'authenticated user can create an organization');
select id as organization_id from public.organizations where name = 'Primary organization' \gset primary_
insert into public.organization_members (organization_id, user_id, role) values
  (:'primary_organization_id', '00000000-0000-4000-8000-000000000002', 'admin'),
  (:'primary_organization_id', '00000000-0000-4000-8000-000000000003', 'member');
insert into public.companies (organization_id, name) values (:'primary_organization_id', 'Visible company');
select is((select count(*) from public.companies where organization_id = :'primary_organization_id'), 1::bigint, 'member of organization can access company');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select is_empty($$ select id from public.companies $$, 'other organization user cannot read company');
select throws_ok(format('insert into public.companies (organization_id, name) values (%L, %L)', :'primary_organization_id', 'IDOR company'), '42501', null, 'other organization user cannot insert company');

reset role;
insert into public.organizations (name) values ('Other organization') returning id as organization_id \gset other_
insert into public.organization_members (organization_id, user_id, role) values (:'other_organization_id', '00000000-0000-4000-8000-000000000004', 'owner');
insert into public.companies (organization_id, name) values (:'other_organization_id', 'Other company');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is_empty($$ select id from public.companies $$, 'anonymous user cannot read companies');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select throws_ok(format('insert into public.organization_members (organization_id, user_id, role) values (%L, %L, %L)', :'primary_organization_id', '00000000-0000-4000-8000-000000000004', 'owner'), '42501', null, 'admin cannot grant owner');
select throws_ok(format('update public.organization_members set role = %L where organization_id = %L and user_id = %L', 'owner', :'primary_organization_id', '00000000-0000-4000-8000-000000000003'), '42501', null, 'admin cannot promote member to owner');
select results_eq(format('update public.organization_members set role = %L where organization_id = %L and user_id = %L returning role::text', 'member', :'primary_organization_id', '00000000-0000-4000-8000-000000000001'), array[]::text[], 'admin cannot demote owner');
select results_eq(format('delete from public.organization_members where organization_id = %L and user_id = %L returning user_id::text', :'primary_organization_id', '00000000-0000-4000-8000-000000000001'), array[]::text[], 'admin cannot delete owner');
select lives_ok(format('update public.organization_members set role = %L where organization_id = %L and user_id = %L', 'admin', :'primary_organization_id', '00000000-0000-4000-8000-000000000003'), 'admin can update a non-owner');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select lives_ok(format('insert into public.organization_members (organization_id, user_id, role) values (%L, %L, %L)', :'primary_organization_id', '00000000-0000-4000-8000-000000000004', 'owner'), 'owner can grant owner');
select lives_ok(format('delete from public.organization_members where organization_id = %L and user_id = %L', :'primary_organization_id', '00000000-0000-4000-8000-000000000004'), 'owner can remove another owner');
select throws_ok(format('update public.organization_members set role = %L where organization_id = %L and user_id = %L', 'admin', :'primary_organization_id', '00000000-0000-4000-8000-000000000001'), '23514', 'organization must retain at least one owner', 'last owner cannot be demoted');

reset role;
select results_eq(format('select role::text from public.organization_members where organization_id = %L and user_id = %L', :'primary_organization_id', '00000000-0000-4000-8000-000000000001'), array['owner'], 'failed owner changes leave owner intact');
select is((select count(*) from public.organization_members where organization_id = :'primary_organization_id' and role = 'owner'), 1::bigint, 'organization retains exactly one owner');
select is((select count(*) from public.companies where organization_id = :'primary_organization_id'), 1::bigint, 'rejected IDOR insert created no row');

select * from finish();
rollback;
