-- Schema inicial. Cifrado client-side: la app cifra antes de mandar,
-- el servidor solo guarda blobs base64 + el método usado (pbkdf2-aes-gcm | nip44).

create extension if not exists "pgcrypto";

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  salt text not null,
  nostr_pubkey text,
  prefers_nostr_auth boolean not null default false,
  created_at timestamptz not null default now()
);

create type public.encryption_method as enum ('pbkdf2-aes-gcm', 'nip44');

create table public.wapu_credentials (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  encrypted_api_token text not null,
  encryption_method public.encryption_method not null,
  updated_at timestamptz not null default now()
);

create table public.nwc_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  label text not null,
  encrypted_connection_string text not null,
  encryption_method public.encryption_method not null,
  created_at timestamptz not null default now()
);
create index nwc_connections_user_idx on public.nwc_connections(user_id);

create table public.contacts_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  wapu_contact_id text not null,
  alias text not null,
  receiver_name text,
  kind text,
  is_favourite boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, wapu_contact_id)
);
create index contacts_cache_user_idx on public.contacts_cache(user_id);

create type public.payment_frequency as enum ('monthly', 'weekly', 'custom');

create table public.scheduled_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  contact_alias text not null,
  receiver_name text,
  amount_ars numeric(14,2) not null check (amount_ars > 0),
  frequency public.payment_frequency not null,
  day_of_month smallint check (day_of_month between 1 and 31),
  weekday smallint check (weekday between 0 and 6),
  next_run date,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  check (
    (frequency = 'monthly' and day_of_month is not null) or
    (frequency = 'weekly' and weekday is not null) or
    (frequency = 'custom')
  )
);
create index scheduled_payments_user_idx on public.scheduled_payments(user_id);
create index scheduled_payments_next_run_idx on public.scheduled_payments(next_run) where paused = false;

create type public.payment_status as enum (
  'pending', 'tentative_created', 'funding_issued',
  'invoice_paid', 'confirmed', 'failed', 'timeout'
);

create table public.payment_runs (
  id uuid primary key default gen_random_uuid(),
  scheduled_payment_id uuid not null references public.scheduled_payments(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  status public.payment_status not null default 'pending',
  tentative_uuid text,
  wapu_tx_id text,
  invoice_bolt11 text,
  sats_paid_estimate bigint,
  ars_amount numeric(14,2) not null,
  started_at timestamptz not null default now(),
  confirmed_at timestamptz,
  error_message text,
  raw_wapu_response jsonb
);
create index payment_runs_user_idx on public.payment_runs(user_id);
create index payment_runs_scheduled_idx on public.payment_runs(scheduled_payment_id);
create index payment_runs_status_idx on public.payment_runs(status);
