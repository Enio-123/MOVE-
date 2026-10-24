-- Move+: esquema proposto para o backend (Supabase / PostgreSQL).
-- NÃO está ativo. É o ponto de partida para a comunidade online e a sincronização
-- entre aparelhos. Toda regra crítica (XP, identidade, permissões) fica no servidor.

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  bio text default '' check (char_length(bio) <= 160),
  avatar_path text,
  favorite_sports text[] default '{}',
  default_privacy text not null default 'private' check (default_privacy in ('private','followers','public')),
  created_at timestamptz default now()
);

create table activities (
  id uuid primary key,
  user_id uuid not null references profiles on delete cascade,
  sport text not null,
  source text not null check (source in ('gps','import','manual','health')),
  status text not null,
  title text not null,
  description text default '',
  privacy text not null check (privacy in ('private','followers','public')),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  local_date date not null,
  tz_offset int not null,
  elapsed_s int not null,
  moving_s int not null,
  distance_m real not null,
  splits jsonb not null default '[]',
  elevation_gain_m real,
  avg_hr int, max_hr int,
  external_id text,
  created_at timestamptz default now(),
  unique (user_id, external_id)
);

-- Pontos do percurso ficam separados e NUNCA são públicos por padrão.
create table tracks (
  activity_id uuid primary key references activities on delete cascade,
  points jsonb not null
);

create table follows (
  follower uuid references profiles on delete cascade,
  followee uuid references profiles on delete cascade,
  primary key (follower, followee)
);

create table blocks (
  blocker uuid references profiles on delete cascade,
  blocked uuid references profiles on delete cascade,
  primary key (blocker, blocked)
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references profiles,
  name text not null, description text, region text, sport text, level text, schedule text, rules text,
  created_at timestamptz default now()
);

create table group_members (
  group_id uuid references groups on delete cascade,
  user_id uuid references profiles on delete cascade,
  role text not null default 'member',
  primary key (group_id, user_id)
);

create table events (
  id uuid primary key default gen_random_uuid(),
  organizer uuid not null references profiles,
  group_id uuid references groups on delete set null,
  title text not null, sport text not null,
  starts_at timestamptz not null, duration_min int not null,
  meeting_name text not null, meeting_lat double precision, meeting_lng double precision,
  route jsonb, distance_km real, difficulty text, max_participants int,
  accessibility text default '', description text default ''
);

create table event_participants (
  event_id uuid references events on delete cascade,
  user_id uuid references profiles on delete cascade,
  going boolean default true,
  attended_confirmed_by_organizer boolean default false,
  primary key (event_id, user_id)
);

-- Livro-razão de XP: só o servidor escreve (função abaixo). A chave impede duplicidade.
create table xp_ledger (
  user_id uuid references profiles on delete cascade,
  key text not null,
  amount int not null check (amount between 0 and 500),
  label text not null,
  at timestamptz not null,
  primary key (user_id, key)
);

alter table profiles enable row level security;
alter table activities enable row level security;
alter table tracks enable row level security;
alter table follows enable row level security;
alter table blocks enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table events enable row level security;
alter table event_participants enable row level security;
alter table xp_ledger enable row level security;

create policy "perfil visível a usuários autenticados" on profiles for select using (auth.role() = 'authenticated');
create policy "dono edita o próprio perfil" on profiles for update using (auth.uid() = id);

-- Atividades: dono vê tudo; outros veem conforme a privacidade e bloqueios.
create policy "dono gerencia atividades" on activities for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "atividades públicas" on activities for select using (
  privacy = 'public' and not exists (select 1 from blocks b where b.blocker = activities.user_id and b.blocked = auth.uid())
);
create policy "atividades para seguidores" on activities for select using (
  privacy = 'followers' and exists (select 1 from follows f where f.follower = auth.uid() and f.followee = activities.user_id)
  and not exists (select 1 from blocks b where b.blocker = activities.user_id and b.blocked = auth.uid())
);

create policy "trajeto só do dono" on tracks for all using (
  exists (select 1 from activities a where a.id = tracks.activity_id and a.user_id = auth.uid())
);

create policy "xp: leitura do próprio" on xp_ledger for select using (auth.uid() = user_id);
-- Sem política de insert/update para clientes: XP só via função com security definer
-- que recalcula a partir das atividades (mesmas regras de src/domain/xp.ts).
