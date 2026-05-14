-- Row Level Security: cada usuario solo ve/edita sus propios datos.
-- Sin policies "service_role" porque el cliente accede directo (no hay backend custodial).

alter table public.user_profiles      enable row level security;
alter table public.wapu_credentials   enable row level security;
alter table public.nwc_connections    enable row level security;
alter table public.contacts_cache     enable row level security;
alter table public.scheduled_payments enable row level security;
alter table public.payment_runs       enable row level security;

create policy "own profile" on public.user_profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "own wapu credentials" on public.wapu_credentials
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own nwc connections" on public.nwc_connections
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own contacts cache" on public.contacts_cache
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own scheduled payments" on public.scheduled_payments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own payment runs" on public.payment_runs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
