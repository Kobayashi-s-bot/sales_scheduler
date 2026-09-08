begin;
select plan(8);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'collector-owner@example.invalid', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'collector-outsider@example.invalid', '', now(), '{}', '{}', now(), now(), '', '', '', '');

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select public.create_organization('Collection organization') as organization_id \gset collection_
insert into public.companies (organization_id, name) values (:'collection_organization_id', 'Collection company') returning id as company_id \gset collection_
insert into public.public_sources (organization_id, company_id, source_url, source_type, refresh_interval_minutes)
values (:'collection_organization_id', :'collection_company_id', 'https://example.com/feed.xml', 'rss', 60) returning id as source_id \gset collection_

select lives_ok(format('insert into public.source_documents (organization_id, company_id, public_source_id, source_url, title, fetched_at, last_checked_at, next_check_at, content_hash) values (%L,%L,%L,%L,%L,now(),now(),now(),%L)', :'collection_organization_id', :'collection_company_id', :'collection_source_id', 'https://example.com/news/1', 'Public article', repeat('a', 64)), 'member can save a public document');
select is((select count(*) from public.source_documents), 1::bigint, 'member can read public documents');
select throws_ok(format('insert into public.public_sources (organization_id, company_id, source_url, source_type) values (%L,%L,%L,%L)', :'collection_organization_id', :'collection_company_id', 'https://example.com/feed.xml', 'rss'), '23505', null, 'duplicate source is rejected');
select throws_ok(format('insert into public.public_sources (organization_id, company_id, source_url, source_type) values (%L,%L,%L,%L)', :'collection_organization_id', :'collection_company_id', 'http://example.com/feed.xml', 'rss'), '23514', null, 'non-HTTPS source is rejected');
select lives_ok(format('update public.source_documents set content_hash = %L, last_checked_at = now() where source_url = %L', repeat('b', 64), 'https://example.com/news/1'), 'same URL content hash can be updated');

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select is_empty($$ select id from public.public_sources $$, 'other organization cannot read sources');
select is_empty($$ select id from public.source_documents $$, 'other organization cannot read documents');

set local role anon;
select throws_ok($$ select id from public.public_sources $$, '42501', 'permission denied for table public_sources', 'anonymous cannot read sources');

select * from finish();
rollback;
