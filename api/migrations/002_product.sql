-- Hirely v1 product tables: profile, billing, job pipeline, matches, notifications.

alter table users add column if not exists is_admin boolean not null default false;

-- One profile per user: what they want and how to reach them.
create table profiles (
  user_id            uuid primary key references users(id) on delete cascade,
  phone              text,                       -- E.164 without "+", e.g. 919876543210
  whatsapp_opt_in    boolean not null default false,
  opt_in_at          timestamptz,                -- proof of consent (DPDP / WhatsApp policy)
  email_alerts       boolean not null default true,
  headline           text not null default '',
  domain             text not null default '',   -- e.g. "Software", "Sales", "Healthcare"
  roles              text[] not null default '{}',
  skills             text[] not null default '{}',
  locations          text[] not null default '{}',
  remote_ok          boolean not null default true,
  experience_years   numeric(4,1) not null default 0,
  resume_text        text not null default '',   -- extracted text only; the uploaded file is never stored
  resume_filename    text,
  resume_uploaded_at timestamptz,
  alerts_paused      boolean not null default false,
  got_job_at         timestamptz,
  wa_last_inbound_at timestamptz,                -- last time the user messaged us (24h free-form window)
  last_digest_at     timestamptz,                -- last alert slot we handled for this user
  onboarded_at       timestamptz,
  updated_at         timestamptz not null default now()
);
create index profiles_phone_idx on profiles (phone);

-- One row per purchase. A user can have history; at most one is "live" at a time.
create table subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users(id) on delete cascade,
  plan                 text not null,            -- starter | plus | pro
  provider             text not null,            -- razorpay_subscription | razorpay_pass | mock
  provider_ref         text unique,              -- Razorpay subscription id (sub_...) or order id (order_...)
  status               text not null,            -- created | active | halted | cancelled | expired | replaced
  cancel_at_period_end boolean not null default false,
  cancel_reason        text,
  current_period_start timestamptz,
  current_period_end   timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index subscriptions_user_idx on subscriptions (user_id, created_at desc);
create index subscriptions_live_idx on subscriptions (status, current_period_end);

create table payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,
  subscription_id     uuid references subscriptions(id) on delete set null,
  provider_payment_id text not null unique,
  amount_paise        int not null,
  status              text not null,             -- captured | failed | refunded
  created_at          timestamptz not null default now()
);

-- Every webhook event id we have processed, so a replay changes nothing.
create table webhook_events (
  id          text primary key,
  source      text not null,
  received_at timestamptz not null default now()
);

-- Where jobs come from. One row per company board or API query.
create table sources (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null,                  -- greenhouse | lever | ashby | smartrecruiters | recruitee | workable | adzuna | remotive | arbeitnow | jobicy | himalayas
  token          text not null,                  -- board token, or the search phrase for query sources
  company        text not null default '',
  enabled        boolean not null default true,
  interval_min   int not null default 20,
  last_polled_at timestamptz,
  last_ok_at     timestamptz,
  fail_count     int not null default 0,
  last_error     text,
  last_count     int not null default 0,
  created_at     timestamptz not null default now(),
  unique (kind, token)
);

create table jobs (
  id            uuid primary key default gen_random_uuid(),
  source_id     uuid not null references sources(id) on delete cascade,
  external_id   text not null,
  company       text not null,
  title         text not null,
  location      text not null default '',
  remote        boolean not null default false,
  in_india      boolean not null default false,
  url           text not null,
  description   text not null default '',        -- plain text, trimmed
  salary        text,
  posted_at     timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  active        boolean not null default true,
  unique (source_id, external_id)
);
create index jobs_first_seen_idx on jobs (first_seen_at desc);
create index jobs_active_idx on jobs (active, in_india, first_seen_at desc);

create table matches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  job_id      uuid not null references jobs(id) on delete cascade,
  score       int not null,                      -- 1..10
  reasons     text[] not null default '{}',
  why         text,                              -- one-line explanation (AI, optional)
  status      text not null default 'new',       -- new | applied | dismissed
  feedback    text,                              -- good | bad
  notified_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, job_id)
);
create index matches_user_idx on matches (user_id, created_at desc);
create index matches_pending_idx on matches (user_id, notified_at) where notified_at is null;

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  channel     text not null,                     -- whatsapp | email
  kind        text not null,                     -- digest | instant | system
  status      text not null,                     -- sent | failed
  error       text,
  provider_id text,
  job_count   int not null default 0,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, created_at desc);

create table tailored_resumes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  match_id   uuid not null unique references matches(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);
create index tailored_user_idx on tailored_resumes (user_id, created_at desc);
