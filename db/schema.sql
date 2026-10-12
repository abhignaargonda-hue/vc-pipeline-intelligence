-- VC Pipeline Intelligence: Neon Postgres schema (idempotent; run with `npm run migrate`)

-- 1. Vikram's pipeline table (seeded from seed/vc-list.csv)
create table if not exists vcs (
  vc_id text primary key,
  firm text not null,
  vc_group text,
  website text,
  partner_name text,
  partner_title text,
  partner_verified_on_firm_site text,
  team_page_url text,
  thesis_quote text,
  thesis_url text,
  stage_fit text,
  logistics_evidence text,
  logistics_source_url text,
  blog_or_feed text,
  aliases text,
  guard_terms text,
  research_notes text,
  -- Vikram's columns: the app never writes these
  last_contact_date date,
  status text,
  contact_history text,
  personal_notes text,
  -- The only 4 columns code writes (+ 2 system columns)
  last_signal_date date,
  signal_summary text,
  follow_up_score int not null default 0,
  recommended_action text,
  signal_sources jsonb not null default '[]',
  last_checked_at timestamptz
);

-- 2. Every run (cron, Run-now button, log-a-signal)
create table if not exists runs (
  id bigserial primary key,
  trigger text not null,                -- cron | manual | log | verify
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running', -- running | ok | error
  items_fetched int not null default 0,
  items_new int not null default 0,
  items_labelled int not null default 0,
  signals_counted int not null default 0,
  tavily_credits int not null default 0,
  gemini_input_tokens int not null default 0,
  gemini_output_tokens int not null default 0,
  cost_inr numeric(10,2) not null default 0,
  source_counts jsonb not null default '{}',
  errors jsonb not null default '[]',
  changes jsonb not null default '[]'
);

-- 3. Every item seen, labelled and scored (rejected ones too, with the reason)
create table if not exists signals (
  id bigserial primary key,
  run_id bigint references runs(id),
  vc_id text references vcs(vc_id),
  url text not null,
  title text,
  source text,
  published_at date,
  fetched_at timestamptz not null default now(),
  type text,
  relevance text,
  confirmed boolean,
  category_peer boolean not null default false,
  event_name text,
  event_start date,
  event_end date,
  summary text,
  manual boolean not null default false,
  accepted boolean not null default false,
  rejected_reason text
);
alter table signals add column if not exists event_key text;
alter table runs add column if not exists tavily_days int;
create unique index if not exists signals_url_vc on signals (url, coalesce(vc_id, ''));
create index if not exists signals_vc_pub on signals (vc_id, published_at);

-- 4. The ONLY write path for code columns
create or replace function app_update_vc_signal(
  p_vc_id text, p_last_signal_date date, p_signal_summary text,
  p_follow_up_score int, p_recommended_action text, p_signal_sources jsonb
) returns void language plpgsql as $$
begin
  perform set_config('app.writer', 'pipeline', true);
  update vcs set
    last_signal_date = p_last_signal_date,
    signal_summary = p_signal_summary,
    follow_up_score = p_follow_up_score,
    recommended_action = p_recommended_action,
    signal_sources = coalesce(p_signal_sources, '[]'::jsonb),
    last_checked_at = now()
  where vc_id = p_vc_id;
  perform set_config('app.writer', '', true);
end $$;

-- 5. Guard trigger
--  * Inside app_update_vc_signal(): anything other than the 4+2 code columns changing -> error
--    (so status, contact_history, personal_notes, last_contact_date can never be touched by the pipeline).
--  * Outside it (Vikram in the Neon console, or any other statement): the code columns cannot be changed by hand.
create or replace function vcs_guard() returns trigger language plpgsql as $$
declare
  code_cols text[] := array['last_signal_date','signal_summary','follow_up_score','recommended_action','signal_sources','last_checked_at'];
begin
  if coalesce(current_setting('app.writer', true), '') = 'pipeline' then
    if (to_jsonb(new) - code_cols) is distinct from (to_jsonb(old) - code_cols) then
      raise exception 'Pipeline may only write last_signal_date, signal_summary, follow_up_score, recommended_action';
    end if;
  else
    if (to_jsonb(new) - (array(select k from jsonb_object_keys(to_jsonb(new)) k where k <> all(code_cols))))
       is distinct from
       (to_jsonb(old) - (array(select k from jsonb_object_keys(to_jsonb(old)) k where k <> all(code_cols)))) then
      raise exception 'Code columns are written only through app_update_vc_signal()';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists vcs_guard_trg on vcs;
create trigger vcs_guard_trg before update on vcs for each row execute function vcs_guard();
