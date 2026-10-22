create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('suggestion', 'issue')),
  subject text not null check (char_length(subject) between 1 and 120),
  message text not null check (char_length(message) between 1 and 3000),
  contact_email text not null default '' check (char_length(contact_email) <= 254),
  user_subject_hash text not null check (char_length(user_subject_hash) = 64),
  created_at timestamptz not null default now()
);

create index if not exists support_requests_created_at_idx
  on public.support_requests (created_at desc);

create table if not exists public.shared_workspaces (
  id uuid primary key,
  access_token_hash text not null check (char_length(access_token_hash) = 64),
  creator_subject_hash text not null check (char_length(creator_subject_hash) = 64),
  created_at timestamptz not null default now()
);

create table if not exists public.shared_notes (
  workspace_id uuid not null references public.shared_workspaces (id) on delete cascade,
  node_key text not null check (char_length(node_key) between 1 and 500),
  title text not null check (char_length(title) between 1 and 160),
  content_html text not null check (octet_length(content_html) <= 50000),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, node_key)
);

create index if not exists shared_notes_updated_at_idx
  on public.shared_notes (workspace_id, updated_at desc);

alter table public.support_requests enable row level security;
alter table public.shared_workspaces enable row level security;
alter table public.shared_notes enable row level security;

revoke all on table public.support_requests from anon, authenticated;
revoke all on table public.shared_workspaces from anon, authenticated;
revoke all on table public.shared_notes from anon, authenticated;
grant all on table public.support_requests to service_role;
grant all on table public.shared_workspaces to service_role;
grant all on table public.shared_notes to service_role;
