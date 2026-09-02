-- The recorder extension is not a browser session — it has no cookies to send
-- — so it carries a bearer token instead. One per teacher, so the token says
-- whose lesson a recording is, rather than the server having to guess.
--
-- Minted by /api/ext/token in exchange for a real sign-in, and revoked by
-- replacing the row.
create table if not exists teacher_ext_tokens (
  teacher_id   uuid primary key references profiles(id) on delete cascade,
  token        text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

alter table teacher_ext_tokens enable row level security;

-- A teacher may see and rotate their own token. The extension itself never
-- reads this table as a user: /api/ext/* looks the token up with the service
-- role, because the caller has no session to check a policy against.
create policy ext_tokens_owner on teacher_ext_tokens
  for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
