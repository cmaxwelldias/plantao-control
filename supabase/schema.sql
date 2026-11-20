-- Plantão Control: one private JSON document per authenticated user.
-- This file is a reviewed schema blueprint. Apply it only after the Supabase project is provisioned.

create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_data_payload_must_be_object
    check (jsonb_typeof(payload) = 'object')
);

alter table public.user_data enable row level security;

revoke all on table public.user_data from anon, public;
grant select, insert, update, delete on table public.user_data to authenticated;

drop policy if exists "Users can read their own Plantao Control data" on public.user_data;
create policy "Users can read their own Plantao Control data"
  on public.user_data for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own Plantao Control data" on public.user_data;
create policy "Users can create their own Plantao Control data"
  on public.user_data for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own Plantao Control data" on public.user_data;
create policy "Users can update their own Plantao Control data"
  on public.user_data for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own Plantao Control data" on public.user_data;
create policy "Users can delete their own Plantao Control data"
  on public.user_data for delete to authenticated
  using ((select auth.uid()) = user_id);
