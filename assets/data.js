// ==================================================================
// 데이터 계층 — 페이지는 DB.* 함수로만 데이터를 읽고, 관리 페이지는 DB.admin.* 으로 쓴다.
// 테이블 구조·권한(RLS)은 supabase/schema.sql, 필드 이름도 테이블과 같다.
// 이미지(src, cover_image)는 Storage `portfolio` 버킷의 공개 URL. null이면 자리 표시 무늬.
// ==================================================================

// ---- Supabase 연결 설정 — 연결할 때 이 두 칸만 채운다 (README 14장) ----
// 비어 있으면 "로컬 미리보기 모드"(SAMPLE + 이 브라우저 저장)로 동작한다.
const SUPABASE = {
  url: "",          // 예: "https://abcdefgh.supabase.co"
  anonKey: "",      // 공개용 anon 키 (사이트에 들어가도 되는 키). service_role 키는 절대 넣지 말 것
  bucket: "portfolio",
};
const USE_SUPABASE = !!(SUPABASE.url && SUPABASE.anonKey);

const LABELS = {
  technique: { weave: "Weave", print: "Print", stitch: "Stitch", dye: "Dye", manipulation: "Manipulation" },
  techniqueKo: { weave: "직조", print: "프린트", stitch: "자수", dye: "염색", manipulation: "패브릭 매니퓰레이션" },
  category: { making: "Making", research: "Research", exhibition: "Exhibition", note: "Note" },
  cv: {
    education: "Education",
    exhibition: "Exhibitions",
    award: "Awards & Grants",
    residency: "Residencies & Activities",
    press: "Press",
    collection: "Collections",                 // 소장처 (작품을 소장한 기관·개인)
  },
  process: { sketch: "스케치", pattern: "패턴 전개", sample: "샘플", handwork: "손 작업" },
  inquiry: { collab: "협업", commission: "외주", exhibition: "전시", etc: "기타" },
};

// ---- 예시 데이터 (실제 내용으로 교체할 것) ----
const sampleSteps = (note) => ["sketch", "pattern", "sample", "handwork"].map((step) => ({
  step, src: null, caption: `예시: ${LABELS.process[step]} 단계 ${note}`,
}));

const SAMPLE = {
  // 사이트 전체에서 한 벌만 있는 정보 (Supabase site_settings 1행)
  site_settings: {
    id: 1,
    name: "KIM HANEUL",                                   // 임시 가명
    site_title: "PORTFOLIO",                              // 메인 좌측 상단 사이트명 (미정)
    email: "haneul.kim@example.com",                      // 임시
    sns: [{ label: "Instagram", href: "https://instagram.com/" }],
    status: "협업 문의 가능",
    description: "텍스타일 작업 포트폴리오 — 컬렉션, 스와치, 작업 일지",
    main_role: "INTERACTION DESIGNER · FRONT-END",
    main_intro: "Seoul, KR — 새로운 프로젝트 문의 환영해요",
    about_photo: null,
    about_one_liner: "실과 격자로 기억을 짜는 텍스타일 디자이너",
    about_bio: "예시 약력입니다. 서울에서 태어나 활동하며, ○○대학교에서 섬유디자인을 전공하고 있습니다. 면·린넨·울·실크를 주로 다루며 직조와 자수, 천연 염색을 함께 씁니다.",
    about_statement: "예시 작가 노트입니다. 작업의 주제와 관심사를 씁니다.\n\n소재를 어떻게 대하는지, 손으로 만드는 과정에서 무엇을 발견하는지 씁니다.\n\n어려운 이론을 나열하기보다 내 작업을 처음 보는 사람이 이해할 수 있는 말로 씁니다.",
    cv_pdf: null,                                         // CV PDF 주소
    journal_lead: "만드는 과정, 리서치, 전시 이야기와 짧은 메모.",
  },

  // 문의 (관리 페이지 문의함 미리보기용 예시 — 사이트 문의 폼은 연결 전이라 저장하지 않음)
  inquiries: [
    { id: 1, name: "예시 방문자", email: "visitor@example.com", type: "collab", message: "예시 문의입니다. 협업 제안을 드리고 싶어요.", status: "new", created_at: "2026-10-20T10:00:00Z" },
    { id: 2, name: "예시 갤러리", email: "gallery@example.com", type: "exhibition", message: "예시 문의입니다. 전시 참여 관련 연락드려요.", status: "done", created_at: "2026-10-02T09:30:00Z" },
  ],

  collections: [
    {
      id: "grid-memory", title: "격자의 기억", year: 2026, cover_image: null,
      is_featured: true, sort_order: 1, is_public: true,
      concept: "졸업 전시 컬렉션(예시). 손으로 짠 격자 위에 남은 시간의 흔적을 기록한다.\n\n예시 문단입니다. 컬렉션이 시작된 질문과 다루고 싶었던 감각을 씁니다.\n\n예시 문단입니다. 소재와 기법을 고른 이유, 컬렉션 안 작품들의 관계를 씁니다.",
    },
    {
      id: "indigo-tide", title: "쪽빛 물결", year: 2025, cover_image: null,
      is_featured: false, sort_order: 2, is_public: true,
      concept: "쪽 염색과 실크스크린을 겹쳐 물결의 층위를 표현한 시리즈(예시).\n\n예시 문단입니다.",
    },
    {
      id: "thread-trace", title: "실의 궤적", year: 2024, cover_image: null,
      is_featured: false, sort_order: 3, is_public: true,
      concept: "한 가닥의 실이 지나간 길을 자수로 따라간 소품 연작(예시).\n\n예시 문단입니다.",
    },
  ],

  works: [
    // 컬렉션 작품 (type: project)
    {
      id: "grid-memory-01", collection_id: "grid-memory", type: "project", title: "격자의 기억 01", year: 2026,
      techniques: ["weave", "stitch"], fiber: "면 70%, 린넨 30%", size: "120 × 180 cm", tools: "4종광 핸드룸, 자수바늘",
      description: "예시 작업 설명입니다. 이 작품에서 시도한 것과 보이고 싶은 것을 씁니다.",
      cover_image: null, process_images: sampleSteps("기록"),
      gallery_images: [
        { src: null, caption: "전체 컷" },
        { src: null, caption: "질감 디테일", detail: true },
        { src: null, caption: "설치 전경" },
      ],
      show_on_main: true, main_order: 1, sort_order: 1, is_public: true,
    },
    {
      id: "grid-memory-02", collection_id: "grid-memory", type: "project", title: "격자의 기억 02", year: 2026,
      techniques: ["weave"], fiber: "울 100%", size: "60 × 90 cm", tools: "테이블룸",
      description: "예시 작업 설명입니다.",
      cover_image: null, process_images: sampleSteps("기록"),
      gallery_images: [{ src: null, caption: "전체 컷" }, { src: null, caption: "질감 디테일", detail: true }],
      show_on_main: true, main_order: 2, sort_order: 2, is_public: true,
    },
    {
      id: "indigo-tide-01", collection_id: "indigo-tide", type: "project", title: "쪽빛 물결 I", year: 2025,
      techniques: ["dye", "print"], fiber: "실크 100%", size: "90 × 90 cm", tools: "염색 통, 스크린 판",
      description: "예시 작업 설명입니다.",
      cover_image: null, process_images: sampleSteps("기록"),
      gallery_images: [{ src: null, caption: "전체 컷" }, { src: null, caption: "질감 디테일", detail: true }],
      show_on_main: true, main_order: 3, sort_order: 1, is_public: true,
    },
    {
      id: "indigo-tide-02", collection_id: "indigo-tide", type: "project", title: "쪽빛 물결 II", year: 2025,
      techniques: ["dye"], fiber: "실크 100%", size: "90 × 90 cm", tools: "염색 통",
      description: "예시 작업 설명입니다.",
      cover_image: null, process_images: sampleSteps("기록"),
      gallery_images: [{ src: null, caption: "전체 컷" }, { src: null, caption: "질감 디테일", detail: true }],
      sort_order: 2, is_public: true,
    },
    {
      id: "thread-trace-01", collection_id: "thread-trace", type: "project", title: "실의 궤적 01", year: 2024,
      techniques: ["stitch"], fiber: "린넨 100%", size: "30 × 30 cm", tools: "자수틀",
      description: "예시 작업 설명입니다.",
      cover_image: null, process_images: sampleSteps("기록"),
      gallery_images: [{ src: null, caption: "전체 컷" }, { src: null, caption: "질감 디테일", detail: true }],
      sort_order: 1, is_public: true,
    },
    // 스와치 (type: swatch, 컬렉션 없음)
    ...[
      ["twill-01", "능직 변화 01", 2025, ["weave"], "울 100%"],
      ["twill-02", "능직 변화 02", 2025, ["weave"], "울 100%"],
      ["shibori-01", "홀치기 염색 01", 2025, ["dye"], "면 100%"],
      ["screen-01", "스크린 프린트 01", 2024, ["print"], "린넨 100%"],
      ["satin-01", "새틴 스티치 밀도", 2024, ["stitch"], "린넨 100%"],
      ["dye-stitch-01", "염색 위 자수", 2024, ["dye", "stitch"], "면 100%"],
      ["smocking-01", "스모킹 주름 실험", 2024, ["manipulation"], "실크 오간자"],
    ].map(([id, title, year, techniques, fiber], i) => ({
      id: "swatch-" + id, collection_id: null, type: "swatch", title, year, techniques, fiber,
      size: "20 × 20 cm", tools: "", description: "예시: 실험 메모 한두 줄.",
      cover_image: null, process_images: [], gallery_images: [], sort_order: i + 1, is_public: true,
    })),
  ],

  journal_posts: [
    {
      id: "loom-setup", date: "2026-10-12", category: "making", is_public: true,
      title: "졸업 작품 경사 걸기",
      summary: "예시: 1,200올 경사를 거는 데 걸린 사흘의 기록.",
      // 본문 안의 [[image:0]] 줄은 images[0] 자리. 본문에 쓰지 않은 이미지는 글 끝에 붙는다.
      body: "예시 본문입니다. 작업 과정에서 있었던 일, 시행착오, 생각을 자유롭게 씁니다.\n\n[[image:0]]\n\n문단은 빈 줄로 나눕니다.",
      images: [{ src: null, caption: "예시 이미지 캡션" }],
      related_work_id: "grid-memory-01", related_collection_id: "grid-memory",
    },
    {
      id: "indigo-research", date: "2026-08-03", category: "research", is_public: true,
      title: "쪽 염색 온도 기록",
      summary: "예시: 발효 온도에 따른 색 변화 관찰.",
      body: "예시 본문입니다.", images: [],
      related_work_id: null, related_collection_id: "indigo-tide",
    },
    {
      id: "grad-show-note", date: "2026-06-20", category: "exhibition", is_public: true,
      title: "졸업 전시 준비 노트",
      summary: "예시: 전시 공간 답사와 설치 계획.",
      body: "예시 본문입니다.", images: [],
      related_work_id: null, related_collection_id: null,
    },
  ],

  // 웹에 노출되는 CV — 전화번호는 넣지 않는다
  cv_items: [
    { id: 1, section: "education", year: "2027", title: "섬유디자인 전공 학사 (졸업 예정)", venue: "○○대학교", location: "서울", note: "", is_upcoming: false, link: null, sort_order: 1, is_public: true },
    { id: 2, section: "exhibition", year: "2026", title: "졸업 전시 「전시명」", venue: "○○갤러리", location: "서울", note: "단체전", is_upcoming: true, link: null, sort_order: 1, is_public: true },
    { id: 3, section: "exhibition", year: "2025", title: "「전시명」", venue: "○○공간", location: "서울", note: "단체전", is_upcoming: false, link: null, sort_order: 1, is_public: true },
    { id: 4, section: "award", year: "2025", title: "○○ 텍스타일 공모전 입선", venue: "○○재단", location: "", note: "", is_upcoming: false, link: null, sort_order: 1, is_public: true },
    { id: 5, section: "residency", year: "2025", title: "천연 염색 워크숍 참여", venue: "○○공방", location: "전주", note: "워크숍", is_upcoming: false, link: null, sort_order: 1, is_public: true },
    { id: 6, section: "residency", year: "2024", title: "브랜드 패턴 디자인 외주", venue: "○○", location: "", note: "외주", is_upcoming: false, link: null, sort_order: 2, is_public: true },
    { id: 8, section: "collection", year: "2025", title: "「작품명」", venue: "○○미술관", location: "서울", note: "", is_upcoming: false, link: null, sort_order: 1, is_public: true },
    { id: 7, section: "press", year: "2026", title: "인터뷰 「기사 제목」", venue: "○○매거진", location: "", note: "", is_upcoming: false, link: "https://example.com", sort_order: 1, is_public: true },
  ],
};

// ==================================================================
// 저장소 — 두 가지 모드. 맨 위 SUPABASE 설정이 비어 있으면 "로컬 미리보기", 채우면 "Supabase".
// 페이지와 관리 화면은 아래 DB.* 만 쓰므로 모드가 바뀌어도 코드는 그대로다.
// ==================================================================

// ---- 로컬 미리보기 저장소 (Supabase 연결 전) ----
//   처음엔 SAMPLE을 복사해 쓰고, 관리 페이지에서 고치면 이 브라우저의 localStorage에 저장된다.
//   같은 브라우저로 사이트를 열면 고친 내용이 보인다 (다른 사람·다른 기기에는 SAMPLE이 보임).
const Store = (() => {
  const KEY = "portfolio-local-db-v1";
  const clone = (v) => JSON.parse(JSON.stringify(v));
  let db = null;

  function load() {
    if (db) return db;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        db = JSON.parse(raw);
        // 예시 데이터에 새 표가 생겼으면 채워 넣는다
        for (const k of Object.keys(SAMPLE)) if (!(k in db)) db[k] = clone(SAMPLE[k]);
        return db;
      }
    } catch (_) {}
    db = clone(SAMPLE);
    return db;
  }
  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      throw new Error("브라우저 저장 공간이 가득 찼어요. 이미지 수를 줄이거나 JSON으로 내보낸 뒤 정리해 주세요.");
    }
  }
  return {
    table: (name) => load()[name],
    replace(name, rows) { load()[name] = rows; persist(); },
    settings: () => load().site_settings,
    saveSettings(obj) { load().site_settings = { ...load().site_settings, ...obj }; persist(); },
    reset() { try { localStorage.removeItem(KEY); } catch (_) {} db = null; },
    all: () => clone(load()),
  };
})();

// ---- Supabase 연결 (설정이 있을 때만 라이브러리를 불러온다) ----
const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
let sbClient = null;
async function sb() {
  if (sbClient) return sbClient;
  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SUPABASE_JS;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Supabase 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해 주세요."));
      document.head.append(s);
    });
  }
  sbClient = window.supabase.createClient(SUPABASE.url, SUPABASE.anonKey);
  return sbClient;
}
// 에러를 사람이 읽을 문장으로
function sbCheck({ data, error }) {
  if (error) {
    const msg = /row-level security|permission|JWT/i.test(error.message)
      ? "권한이 없어요. 관리자 계정으로 로그인했는지 확인해 주세요."
      : `저장소 오류: ${error.message}`;
    throw new Error(msg);
  }
  return data;
}
async function sbSelect(table, build = (q) => q) {
  try {
    return sbCheck(await build((await sb()).from(table).select("*")));
  } catch (e) {
    console.warn(e);
    return [];               // 사이트는 빈 목록으로라도 그린다
  }
}

const SETTINGS_CACHE = "portfolio-settings-cache";
const MODE = USE_SUPABASE ? "supabase" : "local";

const byOrder = (a, b) => a.sort_order - b.sort_order;

// 공개 데이터 읽기 — 모드별 원본 표
const source = {
  async table(name, build) {
    return MODE === "local" ? [...Store.table(name)] : await sbSelect(name, build);
  },
};

const DB = {
  mode: MODE,

  // ---------- 사이트가 읽는 공개 데이터 ----------
  async settings() {
    if (MODE === "local") return { ...Store.settings() };
    const rows = await sbSelect("site_settings", (q) => q.eq("id", 1));
    const s = rows[0] || {};
    try { localStorage.setItem(SETTINGS_CACHE, JSON.stringify(s)); } catch (_) {}
    return s;
  },
  // 첫 화면을 기다리지 않고 그릴 때 쓰는 설정 — 로컬은 그대로, 연결 후엔 마지막으로 받은 값(없으면 빈 값)
  cachedSettings() {
    if (MODE === "local") return { ...Store.settings() };
    try { return JSON.parse(localStorage.getItem(SETTINGS_CACHE)) || {}; } catch (_) { return {}; }
  },
  async collections() {
    return (await source.table("collections", (q) => q.order("sort_order"))).filter((c) => c.is_public).sort(byOrder);
  },
  async collection(id) {
    return (await DB.collections()).find((c) => c.id === id) || null;
  },
  // type: "project" | "swatch" | undefined(전체)
  async works(type) {
    const rows = await source.table("works", (q) => (type ? q.eq("type", type) : q).order("sort_order"));
    return rows.filter((w) => w.is_public && (!type || w.type === type)).sort(byOrder);
  },
  async work(id) {
    return (await DB.works()).find((w) => w.id === id) || null;
  },
  // 메인에 천으로 걸 작품: 공개 + 메인에 걸기, 메인 순서대로. 하나도 없으면 대표 컬렉션 작품으로 대신 (스와치도 걸 수 있음)
  async mainWorks(limit = 3) {
    const works = await DB.works();
    const picked = works.filter((w) => w.show_on_main)
      .sort((a, b) => (a.main_order ?? 1e9) - (b.main_order ?? 1e9) || byOrder(a, b));
    if (picked.length) return picked.slice(0, limit);
    const featured = new Set((await DB.collections()).filter((c) => c.is_featured).map((c) => c.id));
    return works.filter((w) => featured.has(w.collection_id)).slice(0, limit);
  },
  async worksInCollection(collectionId) {
    return (await DB.works("project")).filter((w) => w.collection_id === collectionId);
  },
  async posts() {
    const rows = await source.table("journal_posts", (q) => q.order("date", { ascending: false }));
    return rows.filter((p) => p.is_public).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  },
  async post(id) {
    return (await DB.posts()).find((p) => p.id === id) || null;
  },
  // 최신순: 예정 → 연도 내림차순 → sort_order
  async cv() {
    return (await source.table("cv_items")).filter((c) => c.is_public !== false).sort((a, b) =>
      (b.is_upcoming - a.is_upcoming) || String(b.year).localeCompare(String(a.year)) || byOrder(a, b));
  },
  // 문의 저장. 연결 후엔 inquiries에 insert(방문자는 쓰기만 가능).
  // 연결 전에는 방문자 브라우저에만 남으면 문의가 사라지므로 저장하지 않고 메일 앱으로 대체한다.
  async submitInquiry(inquiry) {
    if (MODE === "local") return { ok: false, reason: "not-connected" };
    try {
      const { name, email, type, message } = inquiry;
      sbCheck(await (await sb()).from("inquiries").insert({ name, email, type, message }));
      return { ok: true };
    } catch (e) {
      console.warn(e);
      return { ok: false, reason: "error" };
    }
  },

  // ---------- 로그인 (관리 페이지) — Supabase Auth 이메일 + 비밀번호 ----------
  auth: {
    available: () => MODE === "supabase",
    async session() {
      if (MODE === "local") return null;
      const { data } = await (await sb()).auth.getSession();
      return data.session;
    },
    async signIn(email, password) {
      const { error } = await (await sb()).auth.signInWithPassword({ email, password });
      if (error) throw new Error(/invalid/i.test(error.message) ? "이메일 또는 비밀번호가 맞지 않아요." : error.message);
    },
    async signOut() {
      if (MODE === "supabase") await (await sb()).auth.signOut();
    },
    // 로그인한 계정이 관리자(admin_users)인지 — 서버 함수 is_admin()으로 확인
    async isAdmin() {
      if (MODE === "local") return true;
      const { data, error } = await (await sb()).rpc("is_admin");
      return !error && data === true;
    },
  },

  // ---------- 관리 페이지 전용 (비공개 행 포함, 쓰기) ----------
  admin: {
    mode: () => MODE,
    async list(table) {
      if (MODE === "local") return [...Store.table(table)];
      return sbCheck(await (await sb()).from(table).select("*"));
    },
    // 저장한 행을 돌려준다 (연결 후 숫자 id 표는 서버가 id를 매긴다)
    async save(table, row) {
      if (MODE === "local") {
        const rows = [...Store.table(table)];
        const i = rows.findIndex((r) => r.id === row.id);
        if (i >= 0) rows[i] = row; else rows.push(row);
        Store.replace(table, rows);
        return row;
      }
      const data = { ...row };
      if (data.id == null) delete data.id;
      return sbCheck(await (await sb()).from(table).upsert(data).select().single());
    },
    async saveMany(table, rows) {
      if (!rows.length) return;
      if (MODE === "local") {
        const all = [...Store.table(table)];
        for (const row of rows) {
          const i = all.findIndex((r) => r.id === row.id);
          if (i >= 0) all[i] = row; else all.push(row);
        }
        Store.replace(table, all);
        return;
      }
      sbCheck(await (await sb()).from(table).upsert(rows));
    },
    async remove(table, id) {
      if (MODE === "local") return Store.replace(table, Store.table(table).filter((r) => r.id !== id));
      sbCheck(await (await sb()).from(table).delete().eq("id", id));
    },
    async settings() {
      if (MODE === "local") return { ...Store.settings() };
      const rows = sbCheck(await (await sb()).from("site_settings").select("*").eq("id", 1));
      return rows[0] || { id: 1 };
    },
    async saveSettings(obj) {
      if (MODE === "local") return Store.saveSettings(obj);
      sbCheck(await (await sb()).from("site_settings").upsert({ ...obj, id: 1, updated_at: new Date().toISOString() }));
      try { localStorage.removeItem(SETTINGS_CACHE); } catch (_) {}
    },
    // 이미지 저장 → 사이트에서 쓸 주소를 돌려준다.
    // 로컬: 줄인 이미지를 data URL로 그대로 보관 / 연결 후: Storage `portfolio` 버킷에 올리고 공개 URL
    async storeImage(blob, path) {
      if (MODE === "local") {
        return await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = () => reject(r.error);
          r.readAsDataURL(blob);
        });
      }
      const client = await sb();
      sbCheck(await client.storage.from(SUPABASE.bucket).upload(path, blob, { contentType: blob.type, upsert: false }));
      return client.storage.from(SUPABASE.bucket).getPublicUrl(path).data.publicUrl;
    },
    // 전체 백업 (모든 표)
    async exportJSON() {
      if (MODE === "local") return JSON.stringify(Store.all(), null, 2);
      const out = {};
      for (const t of DATA_TABLES) out[t] = await DB.admin.list(t);
      out.site_settings = await DB.admin.settings();
      return JSON.stringify(out, null, 2);
    },
    // 로컬 미리보기에서 내보낸 JSON을 Supabase로 옮긴다.
    // data URL 이미지는 Storage에 올려 주소로 바꾸고, 숫자 id 표(CV·문의)는 서버가 새 id를 매긴다.
    async importJSON(json, onProgress = () => {}) {
      if (MODE === "local") throw new Error("가져오기는 Supabase 연결 후에 써요.");
      const data = typeof json === "string" ? JSON.parse(json) : json;
      let n = 0;
      const upload = async (value, folder) => {
        if (typeof value === "string" && value.startsWith("data:image")) {
          const blob = await (await fetch(value)).blob();
          onProgress(`이미지 올리는 중… (${++n})`);
          return DB.admin.storeImage(blob, `${folder}/import-${Date.now()}-${n}.jpg`);
        }
        if (Array.isArray(value)) return Promise.all(value.map((v) => upload(v, folder)));
        if (value && typeof value === "object") {
          const o = {};
          for (const [k, v] of Object.entries(value)) o[k] = await upload(v, folder);
          return o;
        }
        return value;
      };
      if (data.site_settings) {
        onProgress("사이트 설정…");
        await DB.admin.saveSettings(await upload(data.site_settings, "about"));
      }
      // 참조 순서대로: 컬렉션 → 작품 → 글 → CV → 문의
      for (const table of DATA_TABLES) {
        if (!Array.isArray(data[table])) continue;
        onProgress(`${table}…`);
        let rows = await upload(data[table], table);
        if (table === "cv_items" || table === "inquiries") rows = rows.map(({ id, ...rest }) => rest);
        if (table === "cv_items" || table === "inquiries") sbCheck(await (await sb()).from(table).insert(rows));
        else await DB.admin.saveMany(table, rows);
      }
      onProgress("끝");
    },
    reset() {
      if (MODE === "local") Store.reset();
    },
  },
};
const DATA_TABLES = ["collections", "works", "journal_posts", "cv_items", "inquiries"];
