create table if not exists public.cv_builder_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  generated_cv text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cv_builder_profiles enable row level security;

grant select, insert, update, delete on table public.cv_builder_profiles to authenticated;

create policy "Users can view their own CV builder profile"
  on public.cv_builder_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own CV builder profile"
  on public.cv_builder_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own CV builder profile"
  on public.cv_builder_profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own CV builder profile"
  on public.cv_builder_profiles
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
