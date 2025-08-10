-- Session Settings persistence for EMG C3D Analyzer
-- Stores per-user, per-session UI/analysis settings (including thresholds)

create table if not exists public.session_settings (
  user_id uuid not null,
  session_id text not null,
  params jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, session_id)
);

-- Helpful GIN index for JSONB queries
create index if not exists session_settings_params_gin on public.session_settings using gin (params);

-- Enable RLS
alter table public.session_settings enable row level security;

-- RLS: Only allow the authenticated user to access their rows
create policy if not exists "session_settings_select_own"
  on public.session_settings
  for select
  using (auth.uid() = user_id);

create policy if not exists "session_settings_insert_own"
  on public.session_settings
  for insert
  with check (auth.uid() = user_id);

create policy if not exists "session_settings_update_own"
  on public.session_settings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy if not exists "session_settings_delete_own"
  on public.session_settings
  for delete
  using (auth.uid() = user_id);


