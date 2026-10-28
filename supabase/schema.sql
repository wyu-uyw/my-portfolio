-- ==================================================================
-- my-portfolio Supabase 스키마 (사이트 지도 v2)
-- Supabase 대시보드 → SQL Editor에 붙여 넣고 한 번 실행한다.
-- 다시 실행해도 안전하도록 if not exists / drop policy if exists 를 쓴다.
-- stitches(메인 자수 방명록) 테이블은 이 파일에서 다루지 않는다 (기존 유지).
-- ==================================================================

-- ---------- 테이블 ----------

create table if not exists public.collections (
  id           text primary key,                 -- 주소에 쓰는 id (예: grid-memory)
  title        text not null,
  year         int  not null,
  concept      text not null default '',         -- 2~3문단, 빈 줄로 문단 구분
  cover_image  text,                             -- Storage 공개 URL
  is_featured  boolean not null default false,   -- 목록 맨 위에 크게 고정
  sort_order   int  not null default 0,
  is_public    boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.works (
  id              text primary key,
  collection_id   text references public.collections(id) on delete set null,  -- 스와치는 null
  type            text not null check (type in ('project', 'swatch')),
  title           text not null,
  year            int  not null,
  techniques      text[] not null default '{}'
                  check (techniques <@ array['weave','print','stitch','dye','manipulation']::text[]),
  fiber           text not null default '',
  size            text not null default '',
  tools           text not null default '',
  description     text not null default '',
  cover_image     text,
  process_images  jsonb not null default '[]',   -- [{ "step": "sketch|pattern|sample|handwork", "src": "...", "caption": "..." }]
  gallery_images  jsonb not null default '[]',   -- [{ "src": "...", "caption": "...", "detail": true }]
  sort_order      int  not null default 0,
  is_public       boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists works_collection_idx on public.works (collection_id);

create table if not exists public.journal_posts (
  id                     text primary key,
  title                  text not null,
  date                   date not null,
  category               text not null check (category in ('making', 'research', 'exhibition', 'note')),
  summary                text not null default '',
  body                   text not null default '',   -- 빈 줄로 문단 구분, [[image:0]] 줄은 images[0] 자리
  images                 jsonb not null default '[]',-- [{ "src": "...", "caption": "..." }]
  related_work_id        text references public.works(id) on delete set null,
  related_collection_id  text references public.collections(id) on delete set null,
  is_public              boolean not null default false,
  created_at             timestamptz not null default now()
);

-- 웹 노출 CV. 전화번호 같은 개인 연락처는 넣지 않는다.
create table if not exists public.cv_items (
  id           bigint generated always as identity primary key,
  section      text not null check (section in ('education', 'exhibition', 'award', 'residency', 'press', 'collection')),
  year         text not null,                    -- '2026' 또는 '2025–2026'
  title        text not null,
  venue        text not null default '',
  location     text not null default '',
  note         text not null default '',         -- 개인전/단체전, 워크숍, 협업, 외주 등
  is_upcoming  boolean not null default false,   -- 예정 전시 [upcoming]
  link         text,                             -- Press 기사·인터뷰 링크
  sort_order   int  not null default 0,
  is_public    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.inquiries (
  id          bigint generated always as identity primary key,
  name        text not null check (char_length(name) between 1 and 100),
  email       text not null check (char_length(email) between 3 and 200),
  type        text not null check (type in ('collab', 'commission', 'exhibition', 'etc')),
  message     text not null check (char_length(message) between 1 and 5000),
  created_at  timestamptz not null default now()
);

-- 이미 예전 버전으로 테이블을 만들었다면 값 검사 규칙만 새로 바꾼다 (manipulation 기법, 소장처 CV 섹션)
alter table public.works drop constraint if exists works_techniques_check;
alter table public.works add constraint works_techniques_check
  check (techniques <@ array['weave','print','stitch','dye','manipulation']::text[]);
alter table public.cv_items drop constraint if exists cv_items_section_check;
alter table public.cv_items add constraint cv_items_section_check
  check (section in ('education', 'exhibition', 'award', 'residency', 'press', 'collection'));

-- ---------- RLS ----------
-- 공개 테이블: anon은 is_public = true 인 행만 읽기. 쓰기 정책은 두지 않는다(=대시보드에서만 수정).

alter table public.collections   enable row level security;
alter table public.works         enable row level security;
alter table public.journal_posts enable row level security;
alter table public.cv_items      enable row level security;
alter table public.inquiries     enable row level security;

drop policy if exists "public read collections" on public.collections;
create policy "public read collections" on public.collections
  for select to anon, authenticated using (is_public = true);

drop policy if exists "public read works" on public.works;
create policy "public read works" on public.works
  for select to anon, authenticated using (is_public = true);

drop policy if exists "public read journal_posts" on public.journal_posts;
create policy "public read journal_posts" on public.journal_posts
  for select to anon, authenticated using (is_public = true);

drop policy if exists "public read cv_items" on public.cv_items;
create policy "public read cv_items" on public.cv_items
  for select to anon, authenticated using (is_public = true);

-- 문의: anon은 insert만. select 정책이 없으므로 읽기 불가 (대시보드에서 본인만 확인).
drop policy if exists "anon insert inquiries" on public.inquiries;
create policy "anon insert inquiries" on public.inquiries
  for insert to anon, authenticated with check (true);

-- ---------- Storage ----------
-- 이미지 버킷 `portfolio` (공개 읽기). 업로드는 대시보드에서만 하므로 쓰기 정책은 두지 않는다.
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do update set public = true;

drop policy if exists "public read portfolio images" on storage.objects;
create policy "public read portfolio images" on storage.objects
  for select to anon, authenticated using (bucket_id = 'portfolio');
