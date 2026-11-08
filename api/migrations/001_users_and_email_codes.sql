-- Users: one row per person, reachable by Google and/or email.
create table users (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique,          -- always stored lowercase
  name              text not null,
  picture           text,
  google_sub        text unique,                   -- Google's stable account id, null for email-only users
  email_verified_at timestamptz,
  created_at        timestamptz not null default now(),
  last_login_at     timestamptz not null default now()
);

-- One-time email login codes. Only a keyed hash of the code is stored, never the code itself.
create table email_challenges (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  code_hash   text not null,
  expires_at  timestamptz not null,
  attempts    int  not null default 0,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index email_challenges_email_created_idx on email_challenges (email, created_at desc);
