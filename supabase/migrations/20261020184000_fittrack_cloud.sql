-- Initial FitTrack cloud schema; authorized user's data is isolated with RLS.
-- Execute no SQL Editor do seu projeto Supabase.
-- Cada usuário tem um snapshot do FitTrack; o controle de revisão previne sobrescrita silenciosa.
create table if not exists public.fittrack_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{"records":[],"drafts":{},"weights":{}}'::jsonb,
  revision bigint not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now(),
  constraint fittrack_payload_object check (jsonb_typeof(payload) = 'object')
);

alter table public.fittrack_state enable row level security;

drop policy if exists "fittrack_read_own" on public.fittrack_state;
create policy "fittrack_read_own"
  on public.fittrack_state for select to authenticated
  using ((select auth.uid()) = user_id);

-- A gravação ocorre exclusivamente pela função que valida usuário e revisão.
revoke all on public.fittrack_state from anon, authenticated;
grant select on public.fittrack_state to authenticated;

create or replace function public.save_fittrack_state(
  p_data jsonb,
  p_expected_revision bigint
)
returns table(saved boolean, revision bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_revision bigint;
begin
  if v_user is null then
    raise exception 'Autenticação necessária';
  end if;

  if p_data is null
     or jsonb_typeof(p_data) <> 'object'
     or jsonb_typeof(p_data->'records') <> 'array'
     or jsonb_typeof(p_data->'drafts') <> 'object'
     or jsonb_typeof(p_data->'weights') <> 'object' then
    raise exception 'Dados do FitTrack inválidos';
  end if;

  if octet_length(p_data::text) > 2097152 then
    raise exception 'Dados excedem 2 MB; exporte o histórico e contate o suporte';
  end if;

  if p_expected_revision = 0 then
    insert into public.fittrack_state (user_id, payload)
      values (v_user, p_data)
      on conflict (user_id) do nothing
      returning public.fittrack_state.revision into v_revision;
  elsif p_expected_revision > 0 then
    update public.fittrack_state
      set payload = p_data,
          revision = public.fittrack_state.revision + 1,
          updated_at = now()
      where user_id = v_user
        and public.fittrack_state.revision = p_expected_revision
      returning public.fittrack_state.revision into v_revision;
  else
    raise exception 'Revisão inválida';
  end if;

  return query select v_revision is not null, v_revision;
end;
$$;

revoke all on function public.save_fittrack_state(jsonb, bigint) from public, anon;
grant execute on function public.save_fittrack_state(jsonb, bigint) to authenticated;
