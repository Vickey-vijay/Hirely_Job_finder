-- Channels and daily limits: instant alerts per channel, a per-user daily cap, Telegram, and an alert log
-- so the daily cap holds across restarts.

-- Per-channel switches. email_alerts (one switch for everything) becomes two: instant and morning summary.
alter table profiles add column if not exists email_instant boolean not null default true;
alter table profiles add column if not exists email_digest boolean not null default true;
update profiles set email_instant = email_alerts, email_digest = email_alerts;
alter table profiles drop column if exists email_alerts;

-- Most instant alerts a user receives per IST day (1 to 10). Each job counts once, whatever the channel.
alter table profiles add column if not exists max_alerts_per_day int not null default 5
  check (max_alerts_per_day between 1 and 10);

-- Telegram. chat_id is set when the user taps Connect Telegram and sends /start with the one-time token.
alter table profiles add column if not exists telegram_chat_id bigint;
alter table profiles add column if not exists telegram_alerts boolean not null default true;
alter table profiles add column if not exists telegram_connected_at timestamptz;

-- One-time Telegram link tokens. Only a hash is stored, and each token expires after 30 minutes.
create table telegram_links (
  token_hash text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index telegram_links_user_idx on telegram_links (user_id);

-- Every alert or resume we sent, per channel and IST day. Drives the daily cap and the Pro WhatsApp cap.
create table alert_log (
  user_id    uuid not null references users(id) on delete cascade,
  match_id   uuid not null references matches(id) on delete cascade,
  channel    text not null,                      -- email | telegram | whatsapp
  kind       text not null,                      -- instant | resume
  ist_day    text not null,                      -- YYYY-MM-DD in India time
  created_at timestamptz not null default now(),
  primary key (user_id, match_id, channel, kind)
);
create index alert_log_day_idx on alert_log (user_id, kind, ist_day);

-- Which matches already have a tailored resume delivered (Pro), and when.
alter table tailored_resumes add column if not exists delivered_at timestamptz;
