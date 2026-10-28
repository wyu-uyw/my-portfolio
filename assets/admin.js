// ==================================================================
// 관리 페이지 — 편집 영역(plan-draft 07)을 섹션별로 편집한다.
// 저장은 모두 DB.admin.* 으로만 한다 (지금은 로컬 미리보기, 3단계에서 Supabase).
// 섹션마다 "어떤 칸이 있는지"를 아래 ENTITIES / SETTINGS_FORMS 에 적어 두면, 화면은 그 정의대로 그려진다.
// ==================================================================

// ---------- 작은 도구 ----------
const $ = (sel, root = document) => root.querySelector(sel);
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
const clone = (v) => JSON.parse(JSON.stringify(v));
const today = () => new Date().toISOString().slice(0, 10);
let uid = 0;
const nextId = () => "f" + ++uid;

function toast(msg, isError) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.toggle("err", !!isError);
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), isError ? 5000 : 2200);
}

// 주소에 쓰는 id: 영문 소문자·숫자·하이픈. 한글 제목이면 날짜+임의 문자로.
function makeSlug(title) {
  const s = String(title || "").toLowerCase().normalize("NFKD")
    .replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return s || `item-${today().replaceAll("-", "")}-${Math.random().toString(36).slice(2, 6)}`;
}

// ---------- 이미지: 올리기 전에 브라우저에서 줄인다 ----------
// 로컬 미리보기 모드는 브라우저 저장 공간(약 5MB)이 작아서 더 작게 줄인다.
const IMAGE = DB.admin.mode() === "local"
  ? { maxSide: 1600, maxBytes: 400 * 1024 }
  : { maxSide: 2000, maxBytes: 1024 * 1024 };

async function shrinkImage(file) {
  let bmp;
  try {
    bmp = await createImageBitmap(file);
  } catch (_) {
    throw new Error("이 사진 형식은 읽을 수 없어요. JPG나 PNG로 바꿔서 올려 주세요.");
  }
  const scale = Math.min(1, IMAGE.maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  for (let q = 0.86; q >= 0.5; q -= 0.08) {
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", q));
    if (blob.size <= IMAGE.maxBytes || q - 0.08 < 0.5) return blob;
  }
}
async function uploadImage(file, folder) {
  if (!file || !file.type.startsWith("image/")) throw new Error("이미지 파일만 올릴 수 있어요.");
  const blob = await shrinkImage(file);
  return DB.admin.storeImage(blob, `${folder}/${Date.now()}.jpg`);
}
// 파일 고르기 창을 열고 결과를 돌려준다
function pickFile(accept = "image/*") {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files[0] || null);
    input.click();
  });
}

// ---------- 편집 영역 정의 ----------
const TECHNIQUES = Object.entries(LABELS.technique);
const CATEGORY_OPTIONS = Object.entries(LABELS.category);
const CV_OPTIONS = Object.entries(LABELS.cv);
const PROCESS_STEPS = Object.keys(LABELS.process);

// 칸 종류: text, email, url, number, date, textarea, select, toggle, techniques, image, slug,
//          process(제작 과정 4단계), gallery(갤러리), postImages(본문 이미지), body(본문), links(SNS)
const ENTITIES = {
  collections: {
    label: "컬렉션", group: "Work", table: "collections",
    hint: "작품을 묶는 시리즈. 대표 컬렉션 1개는 Work 맨 위에 크게 나와요.",
    filter: () => true,
    ordered: true,
    newRow: () => ({ id: "", title: "", year: new Date().getFullYear(), concept: "", cover_image: null, is_featured: false, is_public: false }),
    thumb: (r) => r.cover_image,
    meta: (r) => `${r.year}`,
    badges: (r) => [r.is_featured && ["대표", true]],
    view: (r) => `collection.html?id=${encodeURIComponent(r.id)}`,
    fields: [
      { name: "title", label: "컬렉션명", type: "text", required: true },
      { name: "id", label: "주소용 이름", type: "slug", from: "title", hint: "주소에 쓰여요 (collection.html?id=…). 영문 소문자·숫자·하이픈. 처음 저장한 뒤에는 바꿀 수 없어요." },
      { name: "year", label: "연도", type: "number", required: true },
      { name: "concept", label: "컨셉 설명", type: "textarea", tall: true, hint: "2~3문단. 빈 줄로 문단을 나눠요. 첫 문장은 Work 목록 카드의 한 줄 설명이 돼요." },
      { name: "cover_image", label: "대표 이미지", type: "image", wide: true, folder: "collections" },
      { name: "is_featured", label: "대표 컬렉션 (Work 맨 위에 크게)", type: "toggle", hint: "켜면 다른 컬렉션의 대표 표시는 꺼져요." },
      { name: "is_public", label: "사이트에 공개", type: "toggle" },
    ],
  },

  works: {
    label: "작품", group: "Work", table: "works",
    hint: "컬렉션에 속한 작품. 제작 과정(손 작업) 사진이 작품 상세의 핵심이에요.",
    filter: (r) => r.type === "project",
    ordered: true,
    groupBy: (r, ctx) => ctx.collectionTitle(r.collection_id),
    newRow: () => ({
      id: "", type: "project", collection_id: null, title: "", year: new Date().getFullYear(), techniques: [],
      fiber: "", size: "", tools: "", description: "", cover_image: null,
      process_images: PROCESS_STEPS.map((step) => ({ step, src: null, caption: "" })),
      gallery_images: [], is_public: false,
    }),
    thumb: (r) => r.cover_image,
    meta: (r) => `${r.year} · ${r.techniques.map((t) => LABELS.technique[t]).join(", ") || "기법 없음"}`,
    view: (r) => `work-detail.html?id=${encodeURIComponent(r.id)}`,
    fields: [
      { name: "collection_id", label: "소속 컬렉션", type: "select", options: (ctx) => [["", "— 없음 —"], ...ctx.collections.map((c) => [c.id, `${c.title} (${c.year})`])] },
      { name: "title", label: "작품명", type: "text", required: true },
      { name: "id", label: "주소용 이름", type: "slug", from: "title", hint: "주소에 쓰여요 (work-detail.html?id=…). 처음 저장한 뒤에는 바꿀 수 없어요." },
      { name: "year", label: "연도", type: "number", required: true },
      { name: "techniques", label: "기법 (여러 개)", type: "techniques" },
      { row: [
        { name: "fiber", label: "섬유 조성", type: "text", placeholder: "예: 면 70%, 린넨 30%" },
        { name: "size", label: "크기", type: "text", placeholder: "예: 120 × 180 cm" },
      ] },
      { name: "tools", label: "사용 도구", type: "text", placeholder: "예: 4종광 핸드룸, 자수바늘" },
      { name: "description", label: "작업 설명", type: "textarea", tall: true, hint: "빈 줄로 문단을 나눠요. 첫 문단은 검색 결과 설명으로도 쓰여요." },
      { name: "cover_image", label: "대표 이미지", type: "image", wide: true, folder: "works" },
      { name: "process_images", label: "제작 과정 (필수 섹션)", type: "process", hint: "스케치 → 패턴 전개 → 샘플 → 손 작업. 직접 손으로 만드는 사진이 공예 역량을 보여줘요." },
      { name: "gallery_images", label: "완성 이미지 갤러리", type: "gallery", hint: "전체 컷과, 질감이 보이는 디테일 확대 컷('디테일' 표시)." },
      { name: "is_public", label: "사이트에 공개", type: "toggle" },
    ],
  },

  swatches: {
    label: "스와치", group: "Work", table: "works",
    hint: "원단 샘플·실험. Work의 Swatch 탭에 작은 정사각 그리드로 나와요.",
    filter: (r) => r.type === "swatch",
    ordered: true,
    newRow: () => ({
      id: "", type: "swatch", collection_id: null, title: "", year: new Date().getFullYear(), techniques: [],
      fiber: "", size: "", tools: "", description: "", cover_image: null,
      process_images: [], gallery_images: [], is_public: false,
    }),
    thumb: (r) => r.cover_image,
    meta: (r) => `${r.year} · ${r.techniques.map((t) => LABELS.technique[t]).join(", ") || "기법 없음"}`,
    view: () => "work.html?tab=swatch",
    fields: [
      { name: "title", label: "스와치 이름", type: "text", required: true },
      { name: "id", label: "주소용 이름", type: "slug", from: "title", prefix: "swatch-" },
      { name: "year", label: "연도", type: "number", required: true },
      { name: "techniques", label: "기법 (여러 개)", type: "techniques" },
      { row: [
        { name: "fiber", label: "섬유", type: "text" },
        { name: "size", label: "크기", type: "text", placeholder: "예: 20 × 20 cm" },
      ] },
      { name: "description", label: "실험 메모", type: "textarea", hint: "한두 줄. 크게 보기에서 함께 나와요." },
      { name: "cover_image", label: "사진 (정사각으로 보여요)", type: "image", folder: "swatches" },
      { name: "is_public", label: "사이트에 공개", type: "toggle" },
    ],
  },

  journal: {
    label: "글", group: "Journal", table: "journal_posts",
    hint: "작업 일지. 꾸준히 올라오는 글이 '활동 중인 작가'로 보이게 해요.",
    filter: () => true,
    sort: (a, b) => b.date.localeCompare(a.date),
    newRow: () => ({
      id: "", title: "", date: today(), category: "making", summary: "", body: "", images: [],
      related_work_id: null, related_collection_id: null, is_public: false,
    }),
    thumb: (r) => r.images[0]?.src,
    meta: (r) => `${r.date.replaceAll("-", ".")} · ${LABELS.category[r.category]}`,
    view: (r) => `journal-post.html?id=${encodeURIComponent(r.id)}`,
    fields: [
      { name: "title", label: "제목", type: "text", required: true },
      { name: "id", label: "주소용 이름", type: "slug", from: "title" },
      { row: [
        { name: "date", label: "날짜", type: "date", required: true },
        { name: "category", label: "카테고리", type: "select", options: () => CATEGORY_OPTIONS },
      ] },
      { name: "summary", label: "한 줄 요약", type: "text", hint: "목록과 검색 결과에 나와요." },
      { name: "body", label: "본문", type: "body", hint: "빈 줄로 문단을 나눠요. '이미지 넣기'를 누르면 커서 자리에 사진이 들어가요." },
      { name: "images", label: "본문 이미지", type: "postImages", hint: "첫 번째 이미지가 목록 썸네일이 돼요. 본문에서 쓰지 않은 이미지는 글 끝에 붙어요." },
      { row: [
        { name: "related_work_id", label: "관련 작품", type: "select", options: (ctx) => [["", "— 없음 —"], ...ctx.projects.map((w) => [w.id, w.title])] },
        { name: "related_collection_id", label: "관련 컬렉션", type: "select", options: (ctx) => [["", "— 없음 —"], ...ctx.collections.map((c) => [c.id, c.title])] },
      ] },
      { name: "is_public", label: "사이트에 공개", type: "toggle", hint: "다 쓰기 전에는 꺼 두세요." },
    ],
  },

  cv: {
    label: "CV 항목", group: "About", table: "cv_items",
    hint: "About의 CV. 섹션별로 최신순 정렬돼요. 웹에 보이는 CV이므로 전화번호는 넣지 않아요.",
    filter: () => true,
    ordered: true,
    numericId: true,
    groupBy: (r) => LABELS.cv[r.section],
    groupOrder: Object.values(LABELS.cv),
    newRow: () => ({ id: null, section: "exhibition", year: String(new Date().getFullYear()), title: "", venue: "", location: "", note: "", is_upcoming: false, link: null, is_public: true }),
    thumb: () => undefined,
    meta: (r) => [r.year, r.venue, r.location].filter(Boolean).join(" · "),
    badges: (r) => [r.note && [r.note], r.is_upcoming && ["upcoming", true]],
    view: () => "about.html#cv",
    fields: [
      { row: [
        { name: "section", label: "섹션", type: "select", options: () => CV_OPTIONS },
        { name: "year", label: "연도", type: "text", required: true, placeholder: "2026 또는 2025–2026" },
      ] },
      { name: "title", label: "제목", type: "text", required: true, placeholder: "예: 졸업 전시 「전시명」" },
      { row: [
        { name: "venue", label: "장소 · 기관", type: "text" },
        { name: "location", label: "지역", type: "text" },
      ] },
      { name: "note", label: "메모 배지", type: "text", placeholder: "개인전 / 단체전 / 워크숍 / 협업 / 외주", hint: "제목 옆 작은 배지로 나와요." },
      { name: "is_upcoming", label: "예정 (upcoming 표시)", type: "toggle" },
      { name: "link", label: "링크", type: "url", placeholder: "https://", hint: "Press 기사·인터뷰 주소 등" },
      { name: "is_public", label: "사이트에 공개", type: "toggle" },
    ],
  },
};

// 한 벌만 있는 정보 (site_settings) — 섹션별 폼
const SETTINGS_FORMS = {
  settings: {
    label: "사이트 설정", group: "공통",
    hint: "모든 페이지의 로고·푸터·연락처와 메인 작가 소개.",
    view: "index.html",
    fields: [
      { legend: "사이트 정보" },
      { row: [
        { name: "name", label: "이름", type: "text", required: true, hint: "로고 · 푸터 © · 탭 제목 · About · 메인" },
        { name: "site_title", label: "사이트명", type: "text", hint: "메인 좌측 상단" },
      ] },
      { name: "email", label: "이메일", type: "email", required: true, hint: "모든 푸터 · Contact · 메인" },
      { name: "sns", label: "SNS 링크", type: "links" },
      { name: "status", label: "현재 상태 한 줄", type: "text", placeholder: "예: 협업 문의 가능", hint: "Contact 페이지 위쪽" },
      { name: "description", label: "사이트 설명 (검색용)", type: "text", hint: "검색 결과·링크 공유 미리보기에 나와요." },
      { legend: "메인 작가 소개" },
      { name: "main_role", label: "역할 한 줄", type: "text", hint: "메인 하단 노랑 작은 글씨" },
      { name: "main_intro", label: "소개 문구", type: "text", hint: "메인 하단 이메일 아래" },
      { legend: "페이지 문구" },
      { name: "journal_lead", label: "Journal 소개 문구", type: "text" },
    ],
  },
  about: {
    label: "Bio · Statement", group: "About",
    hint: "About 페이지의 프로필과 작가 노트, CV PDF.",
    view: "about.html",
    fields: [
      { legend: "Bio" },
      { name: "about_photo", label: "프로필 사진", type: "image", folder: "about" },
      { name: "about_one_liner", label: "한 줄 소개", type: "text" },
      { name: "about_bio", label: "짧은 약력", type: "textarea", hint: "1문단. 활동 지역, 전공, 주로 다루는 소재와 기법." },
      { legend: "Statement" },
      { name: "about_statement", label: "작가 노트", type: "textarea", tall: true, hint: "2~3문단, 빈 줄로 구분. 어려운 이론 대신 처음 보는 사람도 이해할 말로." },
      { legend: "CV PDF" },
      { name: "cv_pdf", label: "CV PDF 주소", type: "url", placeholder: "예: assets/cv.pdf 또는 https://…",
        hint: DB.admin.mode() === "local"
          ? "파일 올리기는 Supabase 연결 후에 돼요. 지금은 저장소에 넣은 PDF 경로나 외부 주소를 적어 주세요. 비워 두면 '준비 중'."
          : "비워 두면 About의 버튼이 '준비 중'으로 보여요." },
    ],
  },
};

const NAV = [
  ["settings", "공통"],
  ["collections", "Work"], ["works", "Work"], ["swatches", "Work"],
  ["journal", "Journal"],
  ["about", "About"], ["cv", "About"],
  ["inquiries", "Contact"],
];
const sectionLabel = (key) => (ENTITIES[key] || SETTINGS_FORMS[key])?.label || (key === "inquiries" ? "문의함" : key);

// ---------- 상태 ----------
const state = { dirty: false, draft: null };
function setDirty(v) {
  state.dirty = v;
  const el = $("#dirty");
  if (el) el.textContent = v ? "저장하지 않은 변경이 있어요" : "";
}
addEventListener("beforeunload", (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ""; } });

async function context() {
  const [collections, works] = await Promise.all([DB.admin.list("collections"), DB.admin.list("works")]);
  collections.sort(byOrder);
  return {
    collections,
    projects: works.filter((w) => w.type === "project").sort(byOrder),
    collectionTitle: (id) => collections.find((c) => c.id === id)?.title || "컬렉션 없음",
  };
}

// ---------- 메뉴 ----------
async function renderNav(current) {
  const counts = {};
  for (const [key, def] of Object.entries(ENTITIES)) counts[key] = (await DB.admin.list(def.table)).filter(def.filter).length;
  const inq = await DB.admin.list("inquiries");
  counts.inquiries = inq.filter((i) => i.status !== "done").length;
  let lastGroup = "";
  $("#nav").innerHTML = NAV.map(([key, group]) => {
    const head = group !== lastGroup ? `<span class="grp">${group}</span>` : "";
    lastGroup = group;
    const count = counts[key] != null ? `<span class="count">${counts[key]}</span>` : "";
    return `${head}<a href="#${key}"${key === current ? ' aria-current="page"' : ""}>${esc(sectionLabel(key))}${count}</a>`;
  }).join("");
}

// ---------- 목록 ----------
async function renderList(key) {
  const def = ENTITIES[key];
  const ctx = await context();
  let rows = (await DB.admin.list(def.table)).filter(def.filter);
  rows.sort(def.sort || byOrder);

  // 묶음(컬렉션별, CV 섹션별)
  const groups = new Map();
  for (const r of rows) {
    const g = def.groupBy ? def.groupBy(r, ctx) : "";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(r);
  }
  let order = [...groups.keys()];
  if (def.groupOrder) order = def.groupOrder.filter((g) => groups.has(g));

  const rowHtml = (r, i, list) => {
    const badges = (def.badges ? def.badges(r) : []).filter(Boolean)
      .map(([t, hot]) => `<span class="badge-sm${hot ? " hot" : ""}">${esc(t)}</span>`).join("");
    const thumb = def.thumb(r);
    return `<li class="ad-row">
      ${thumb !== undefined ? (thumb ? `<img class="thumb" src="${esc(thumb)}" alt="">` : `<span class="thumb" aria-hidden="true"></span>`) : ""}
      <div class="info">
        <a href="#${key}/edit/${encodeURIComponent(r.id)}">${esc(r.title || "(제목 없음)")}</a>${r.is_public === false ? '<span class="badge-sm">비공개</span>' : ""}${badges}
        <div class="meta">${esc(def.meta(r))}</div>
      </div>
      ${def.ordered ? `<div class="order">
        <button class="icon-btn" type="button" data-move="-1" data-id="${esc(r.id)}" aria-label="위로" ${i === 0 ? "disabled" : ""}>↑</button>
        <button class="icon-btn" type="button" data-move="1" data-id="${esc(r.id)}" aria-label="아래로" ${i === list.length - 1 ? "disabled" : ""}>↓</button>
      </div>` : ""}
    </li>`;
  };

  $("#main").innerHTML = `
    <div class="ad-head">
      <h1>${esc(def.label)}</h1>
      <span class="spacer"></span>
      <a class="ad-btn" href="#${key}/new">새로 만들기</a>
    </div>
    <p class="ad-sub">${esc(def.hint)}</p>
    ${rows.length ? order.map((g) => `
      ${g ? `<h2 class="ad-group">${esc(g)}</h2>` : ""}
      <ul class="ad-list">${groups.get(g).map((r, i, list) => rowHtml(r, i, list)).join("")}</ul>`).join("")
    : `<p class="ad-empty">아직 없어요. '새로 만들기'로 시작하세요.</p>`}`;

  // 순서 바꾸기: 같은 묶음 안에서 이웃과 자리 바꿈
  $("#main").querySelectorAll("[data-move]").forEach((b) => b.addEventListener("click", async () => {
    const row = rows.find((r) => String(r.id) === b.dataset.id);
    const g = def.groupBy ? def.groupBy(row, ctx) : "";
    const list = groups.get(g);
    list.forEach((r, i) => (r.sort_order = i + 1));
    const i = list.indexOf(row), j = i + Number(b.dataset.move);
    [list[i].sort_order, list[j].sort_order] = [list[j].sort_order, list[i].sort_order];
    await DB.admin.saveMany(def.table, list);
    renderList(key);
  }));
}

// ---------- 폼: 칸 그리기 ----------
function fieldHtml(f, value, ctx, isNew) {
  const id = nextId();
  const req = f.required ? '<span class="req">*</span>' : "";
  const hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : "";
  const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : "";
  const wrap = (inner, lbl = `<label for="${id}">${esc(f.label)}${req}</label>`) =>
    `<div class="f" data-field="${f.name}" data-type="${f.type}">${lbl}${inner}${hint}</div>`;

  switch (f.type) {
    case "text": case "email": case "url": case "number": case "date":
      return wrap(`<input id="${id}" type="${f.type}" value="${esc(value ?? "")}"${ph}${f.required ? " required" : ""}>`);
    case "slug":
      return wrap(`<input id="${id}" type="text" value="${esc(value ?? "")}" ${isNew ? 'placeholder="제목에서 자동으로 만들어져요"' : "readonly"} pattern="[a-z0-9-]+">`);
    case "textarea":
      return wrap(`<textarea id="${id}" class="${f.tall ? "tall" : ""}"${ph}>${esc(value ?? "")}</textarea>`);
    case "select": {
      const opts = f.options(ctx);
      return wrap(`<select id="${id}">${opts.map(([v, t]) => `<option value="${esc(v)}"${String(value ?? "") === String(v) ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>`);
    }
    case "toggle":
      return `<div class="f" data-field="${f.name}" data-type="toggle">
        <label class="toggle"><input type="checkbox"${value ? " checked" : ""}><span class="knob"></span>${esc(f.label)}</label>${hint}</div>`;
    case "techniques":
      return wrap(`<div class="chips" role="group" aria-label="${esc(f.label)}">${TECHNIQUES.map(([k, t]) =>
        `<button class="chip" type="button" data-tech="${k}" aria-pressed="${(value || []).includes(k)}">${t}</button>`).join("")}</div>`,
        `<span class="lbl">${esc(f.label)}</span>`);
    case "image":
      return wrap(`<div class="img-field">${imageBox(value, f.wide)}
        <div class="img-actions">
          <button class="ad-btn small ghost" type="button" data-img-pick>사진 고르기</button>
          <button class="ad-btn small danger" type="button" data-img-clear ${value ? "" : "hidden"}>지우기</button>
        </div></div>`, `<span class="lbl">${esc(f.label)}</span>`);
    case "process":
      return wrap(`<div class="items">${(value || []).map((p, i) => `
        <div class="item" data-i="${i}">
          ${imageBox(p.src, false, LABELS.process[p.step] || p.step)}
          <div class="fields">
            <span class="tag-no">0${i + 1} · ${esc(LABELS.process[p.step] || p.step)}</span>
            <textarea data-k="caption" placeholder="이 단계 설명">${esc(p.caption || "")}</textarea>
          </div>
          <div class="ctrl"><button class="icon-btn" type="button" data-img-clear-i="${i}" aria-label="사진 지우기" ${p.src ? "" : "disabled"}>✕</button></div>
        </div>`).join("")}</div>`, `<span class="lbl">${esc(f.label)}</span>`);
    case "gallery": case "postImages":
      return wrap(`<div class="items">${(value || []).map((g, i, list) => `
        <div class="item" data-i="${i}">
          ${imageBox(g.src)}
          <div class="fields">
            ${f.type === "postImages" ? `<span class="tag-no">이미지 ${i} · 본문에 <code>[[image:${i}]]</code></span>` : ""}
            <input type="text" data-k="caption" value="${esc(g.caption || "")}" placeholder="캡션">
            ${f.type === "gallery" ? `<label class="toggle"><input type="checkbox" data-k="detail"${g.detail ? " checked" : ""}><span class="knob"></span>디테일 확대 컷</label>` : ""}
          </div>
          <div class="ctrl">
            <button class="icon-btn" type="button" data-item-move="-1" data-i="${i}" aria-label="위로" ${i === 0 ? "disabled" : ""}>↑</button>
            <button class="icon-btn" type="button" data-item-move="1" data-i="${i}" aria-label="아래로" ${i === list.length - 1 ? "disabled" : ""}>↓</button>
            <button class="icon-btn" type="button" data-item-del="${i}" aria-label="빼기">✕</button>
          </div>
        </div>`).join("")}
        <div><button class="ad-btn small ghost" type="button" data-item-add>+ 사진 추가</button></div></div>`,
        `<span class="lbl">${esc(f.label)}</span>`);
    case "body":
      return wrap(`<div class="body-tools"><button class="ad-btn small ghost" type="button" data-body-img>이미지 넣기</button></div>
        <textarea id="${id}" class="tall">${esc(value ?? "")}</textarea>`);
    case "links":
      return wrap(`<div class="items links">${(value || []).map((l, i) => `
        <div class="item" data-i="${i}">
          <div class="fields row2">
            <input type="text" data-k="label" value="${esc(l.label)}" placeholder="이름 (예: Instagram)">
            <input type="url" data-k="href" value="${esc(l.href)}" placeholder="https://">
          </div>
          <div class="ctrl"><button class="icon-btn" type="button" data-item-del="${i}" aria-label="빼기">✕</button></div>
        </div>`).join("")}
        <div><button class="ad-btn small ghost" type="button" data-link-add>+ 링크 추가</button></div></div>`,
        `<span class="lbl">${esc(f.label)}</span>`);
  }
  return "";
}
function imageBox(src, wide, label = "사진 놓기\n또는 누르기") {
  return `<div class="img-box${wide ? " wide" : ""}" data-img-drop tabindex="0" role="button" aria-label="사진 올리기">
    ${src ? `<img src="${esc(src)}" alt="">` : `<span style="white-space:pre-line">${esc(label)}</span>`}</div>`;
}

function formHtml(fields, data, ctx, isNew) {
  let html = "", open = false;
  for (const f of fields) {
    if (f.legend) {
      if (open) html += "</fieldset>";
      html += `<fieldset class="ad-fieldset"><legend>${esc(f.legend)}</legend>`;
      open = true;
    } else if (f.row) {
      html += `<div class="row2">${f.row.map((x) => fieldHtml(x, data[x.name], ctx, isNew)).join("")}</div>`;
    } else {
      html += fieldHtml(f, data[f.name], ctx, isNew);
    }
  }
  if (open) html += "</fieldset>";
  return html;
}
const flatFields = (fields) => fields.flatMap((f) => (f.row ? f.row : f.legend ? [] : [f]));

// ---------- 폼: 입력을 draft에 반영 ----------
function bindForm(form, fields, draft, rerender) {
  const byName = Object.fromEntries(flatFields(fields).map((f) => [f.name, f]));
  const touch = () => setDirty(true);

  form.querySelectorAll(".f[data-field]").forEach((box) => {
    const f = byName[box.dataset.field];
    const name = f.name;
    switch (f.type) {
      case "text": case "email": case "url": case "date": case "textarea": case "body": case "select": {
        const el = box.querySelector("input, textarea, select");
        el.addEventListener("input", () => {
          draft[name] = el.value;
          touch();
          // 제목을 쓰면 새 항목의 주소용 이름을 따라 만든다
          for (const s of flatFields(fields).filter((x) => x.type === "slug" && x.from === name)) {
            const slugEl = form.querySelector(`.f[data-field="${s.name}"] input`);
            if (slugEl && !slugEl.readOnly && !slugEl.dataset.manual) {
              draft[s.name] = slugEl.value = (s.prefix || "") + makeSlug(el.value);
            }
          }
        });
        break;
      }
      case "number": {
        const el = box.querySelector("input");
        el.addEventListener("input", () => { draft[name] = el.value === "" ? null : Number(el.value); touch(); });
        break;
      }
      case "slug": {
        const el = box.querySelector("input");
        el.addEventListener("input", () => { el.dataset.manual = "1"; draft[name] = el.value.trim(); touch(); });
        break;
      }
      case "toggle": {
        const el = box.querySelector("input");
        el.addEventListener("change", () => { draft[name] = el.checked; touch(); });
        break;
      }
      case "techniques":
        box.querySelectorAll("[data-tech]").forEach((b) => b.addEventListener("click", () => {
          const set = new Set(draft[name] || []);
          set.has(b.dataset.tech) ? set.delete(b.dataset.tech) : set.add(b.dataset.tech);
          draft[name] = TECHNIQUES.map(([k]) => k).filter((k) => set.has(k));
          b.setAttribute("aria-pressed", String(set.has(b.dataset.tech)));
          touch();
        }));
        break;
      case "image":
        bindImageBox(box.querySelector("[data-img-drop]"), f.folder, (src) => { draft[name] = src; touch(); rerender(); });
        box.querySelector("[data-img-pick]").addEventListener("click", async () => {
          const file = await pickFile();
          if (file) handleUpload(box.querySelector("[data-img-drop]"), file, f.folder, (src) => { draft[name] = src; touch(); rerender(); });
        });
        box.querySelector("[data-img-clear]").addEventListener("click", () => { draft[name] = null; touch(); rerender(); });
        break;
      case "process": case "gallery": case "postImages": case "links": {
        box.querySelectorAll(".item").forEach((item) => {
          const i = Number(item.dataset.i);
          item.querySelectorAll("[data-k]").forEach((el) => el.addEventListener(el.type === "checkbox" ? "change" : "input", () => {
            draft[name][i][el.dataset.k] = el.type === "checkbox" ? el.checked : el.value;
            touch();
          }));
          const drop = item.querySelector("[data-img-drop]");
          if (drop) bindImageBox(drop, f.folder || "works", (src) => { draft[name][i].src = src; touch(); rerender(); });
        });
        box.querySelectorAll("[data-img-clear-i]").forEach((b) => b.addEventListener("click", () => {
          draft[name][Number(b.dataset.imgClearI)].src = null; touch(); rerender();
        }));
        box.querySelectorAll("[data-item-del]").forEach((b) => b.addEventListener("click", () => {
          const i = Number(b.dataset.itemDel);
          draft[name].splice(i, 1);
          // 본문 이미지: 지운 번호의 [[image:n]] 줄은 빼고, 뒤 번호는 하나씩 당긴다
          if (f.type === "postImages") remapBodyImages(draft, (n) => (n === i ? null : n > i ? n - 1 : n));
          touch(); rerender();
        }));
        box.querySelectorAll("[data-item-move]").forEach((b) => b.addEventListener("click", () => {
          const i = Number(b.dataset.i), j = i + Number(b.dataset.itemMove);
          [draft[name][i], draft[name][j]] = [draft[name][j], draft[name][i]];
          if (f.type === "postImages") remapBodyImages(draft, (n) => (n === i ? j : n === j ? i : n));
          touch(); rerender();
        }));
        box.querySelector("[data-item-add]")?.addEventListener("click", async () => {
          const file = await pickFile();
          if (!file) return;
          try {
            const src = await uploadImage(file, f.type === "postImages" ? "journal" : "works");
            draft[name] = [...(draft[name] || []), f.type === "gallery" ? { src, caption: "", detail: false } : { src, caption: "" }];
            touch(); rerender();
          } catch (e) { toast(e.message, true); }
        });
        box.querySelector("[data-link-add]")?.addEventListener("click", () => {
          draft[name] = [...(draft[name] || []), { label: "", href: "" }]; touch(); rerender();
        });
        break;
      }
    }
  });

  // 본문: 커서 자리에 [[image:n]] 넣기 (사진을 올려 본문 이미지 목록 끝에 추가)
  form.querySelectorAll("[data-body-img]").forEach((b) => b.addEventListener("click", async () => {
    const ta = b.closest(".f").querySelector("textarea");
    const file = await pickFile();
    if (!file) return;
    try {
      const src = await uploadImage(file, "journal");
      draft.images = [...(draft.images || []), { src, caption: "" }];
      const n = draft.images.length - 1;
      const at = ta.selectionStart ?? ta.value.length;
      const before = ta.value.slice(0, at).replace(/\s*$/, ""), after = ta.value.slice(at).replace(/^\s*/, "");
      draft.body = `${before}${before ? "\n\n" : ""}[[image:${n}]]${after ? "\n\n" : ""}${after}`;
      touch(); rerender();
    } catch (e) { toast(e.message, true); }
  }));
}

// 본문 속 [[image:n]] 번호를 바꾼다 (map이 null을 돌려주면 그 줄을 지움)
function remapBodyImages(draft, map) {
  draft.body = String(draft.body || "")
    .replace(/\[\[image:(\d+)\]\]/g, (m, n) => {
      const to = map(Number(n));
      return to == null ? "" : `[[image:${to}]]`;
    })
    .replace(/\n{3,}/g, "\n\n").trim();
}

function bindImageBox(box, folder, onDone) {
  box.addEventListener("click", async () => {
    const file = await pickFile();
    if (file) handleUpload(box, file, folder, onDone);
  });
  box.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); box.click(); } });
  box.addEventListener("dragover", (e) => { e.preventDefault(); box.classList.add("drag"); });
  box.addEventListener("dragleave", () => box.classList.remove("drag"));
  box.addEventListener("drop", (e) => {
    e.preventDefault();
    box.classList.remove("drag");
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(box, file, folder, onDone);
  });
}
async function handleUpload(box, file, folder, onDone) {
  box.classList.add("busy");
  try {
    onDone(await uploadImage(file, folder));
  } catch (e) {
    toast(e.message, true);
  } finally {
    box.classList.remove("busy");
  }
}

// ---------- 편집 화면 (목록형 섹션) ----------
async function renderEdit(key, id) {
  const def = ENTITIES[key];
  const ctx = await context();
  const all = await DB.admin.list(def.table);
  const isNew = id == null;
  const found = isNew ? null : all.find((r) => String(r.id) === String(id));
  if (!isNew && !found) { location.hash = key; return; }
  state.draft = isNew ? def.newRow() : clone(found);
  setDirty(false);

  const draw = () => {
    const scrollY = window.scrollY;
    $("#main").innerHTML = `
      <div class="ad-head">
        <a class="ad-btn small ghost" href="#${key}">← ${esc(def.label)} 목록</a>
        <span class="spacer"></span>
        ${!isNew && def.view ? `<a class="ad-btn small ghost" href="${def.view(state.draft)}" target="_blank" rel="noopener">사이트에서 보기 ↗</a>` : ""}
      </div>
      <div class="ad-head"><h1>${isNew ? `새 ${esc(def.label)}` : esc(state.draft.title || def.label)}</h1></div>
      <form class="ad-form" id="form" novalidate>
        ${formHtml(def.fields, state.draft, ctx, isNew)}
        <div class="ad-actions">
          <button class="ad-btn" type="submit">저장</button>
          ${isNew ? "" : '<button class="ad-btn danger" type="button" id="delete">삭제</button>'}
          <span class="dirty" id="dirty">${state.dirty ? "저장하지 않은 변경이 있어요" : ""}</span>
        </div>
      </form>`;
    const form = $("#form");
    bindForm(form, def.fields, state.draft, draw);
    form.addEventListener("submit", (e) => { e.preventDefault(); save(); });
    $("#delete")?.addEventListener("click", remove);
    window.scrollTo(0, scrollY);
  };

  async function save() {
    const row = state.draft;
    const missing = flatFields(def.fields).find((f) => f.required && (row[f.name] === "" || row[f.name] == null));
    if (missing) return toast(`'${missing.label}'을(를) 채워 주세요.`, true);

    if (def.numericId) {
      // 로컬은 여기서 번호를 매기고, 연결 후엔 서버(identity)가 매긴다
      if (row.id == null && DB.admin.mode() === "local") row.id = Math.max(0, ...all.map((r) => Number(r.id) || 0)) + 1;
    } else {
      if (isNew && !row.id) row.id = makeSlug(row.title);
      if (!/^[a-z0-9-]+$/.test(row.id)) return toast("주소용 이름은 영문 소문자·숫자·하이픈만 쓸 수 있어요.", true);
      if (isNew && all.some((r) => r.id === row.id)) return toast("같은 주소용 이름이 이미 있어요. 바꿔 주세요.", true);
    }
    for (const k of ["collection_id", "related_work_id", "related_collection_id", "link"]) if (row[k] === "") row[k] = null;
    if (def.ordered && row.sort_order == null) {
      row.sort_order = Math.max(0, ...all.filter(def.filter).map((r) => r.sort_order || 0)) + 1;
    }

    try {
      // 대표 컬렉션은 하나만
      if (def.table === "collections" && row.is_featured) {
        const others = all.filter((c) => c.id !== row.id && c.is_featured).map((c) => ({ ...c, is_featured: false }));
        if (others.length) await DB.admin.saveMany("collections", others);
      }
      const saved = await DB.admin.save(def.table, row);
      state.draft = saved;
      setDirty(false);
      toast("저장했어요");
      location.hash = `${key}/edit/${encodeURIComponent(saved.id)}`;
      if (!isNew) { renderNav(key); draw(); }
    } catch (e) {
      toast(e.message, true);
    }
  }

  async function remove() {
    if (!confirm(`'${state.draft.title || "이 항목"}'을(를) 삭제할까요? 되돌릴 수 없어요.`)) return;
    try {
      await DB.admin.remove(def.table, state.draft.id);
      // 이 항목을 가리키던 연결은 비운다
      if (def.table === "collections") {
        const works = (await DB.admin.list("works")).filter((w) => w.collection_id === state.draft.id).map((w) => ({ ...w, collection_id: null }));
        await DB.admin.saveMany("works", works);
        const posts = (await DB.admin.list("journal_posts")).filter((p) => p.related_collection_id === state.draft.id).map((p) => ({ ...p, related_collection_id: null }));
        await DB.admin.saveMany("journal_posts", posts);
      }
      if (def.table === "works") {
        const posts = (await DB.admin.list("journal_posts")).filter((p) => p.related_work_id === state.draft.id).map((p) => ({ ...p, related_work_id: null }));
        await DB.admin.saveMany("journal_posts", posts);
      }
      setDirty(false);
      toast("삭제했어요");
      location.hash = key;
    } catch (e) {
      toast(e.message, true);
    }
  }

  draw();
}

// ---------- 설정 화면 (site_settings 한 벌) ----------
async function renderSettings(key) {
  const def = SETTINGS_FORMS[key];
  const all = await DB.admin.settings();
  const names = flatFields(def.fields).map((f) => f.name);
  state.draft = clone(Object.fromEntries(names.map((n) => [n, all[n] ?? (n === "sns" ? [] : "")])));
  setDirty(false);

  const draw = () => {
    const scrollY = window.scrollY;
    $("#main").innerHTML = `
      <div class="ad-head">
        <h1>${esc(def.label)}</h1>
        <span class="spacer"></span>
        <a class="ad-btn small ghost" href="${def.view}" target="_blank" rel="noopener">사이트에서 보기 ↗</a>
      </div>
      <p class="ad-sub">${esc(def.hint)}</p>
      <form class="ad-form" id="form" novalidate>
        ${formHtml(def.fields, state.draft, {}, false)}
        <div class="ad-actions">
          <button class="ad-btn" type="submit">저장</button>
          <span class="dirty" id="dirty">${state.dirty ? "저장하지 않은 변경이 있어요" : ""}</span>
        </div>
      </form>`;
    const form = $("#form");
    bindForm(form, def.fields, state.draft, draw);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const missing = flatFields(def.fields).find((f) => f.required && !state.draft[f.name]);
      if (missing) return toast(`'${missing.label}'을(를) 채워 주세요.`, true);
      const data = clone(state.draft);
      if (data.sns) data.sns = data.sns.filter((l) => l.label && l.href);
      for (const k of ["about_photo", "cv_pdf"]) if (k in data && !data[k]) data[k] = null;
      try {
        await DB.admin.saveSettings(data);
        setDirty(false);
        toast("저장했어요");
        draw();
      } catch (err) {
        toast(err.message, true);
      }
    });
    window.scrollTo(0, scrollY);
  };
  draw();
}

// ---------- 문의함 ----------
async function renderInquiries() {
  const rows = (await DB.admin.list("inquiries")).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const fmt = (iso) => new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
  $("#main").innerHTML = `
    <div class="ad-head"><h1>문의함</h1></div>
    <p class="ad-sub">Contact 문의 폼으로 들어온 문의. ${DB.admin.mode() === "local"
      ? "지금은 저장 연결 전이라 사이트 문의는 메일 앱으로 가고, 여기에는 예시만 보여요."
      : ""}</p>
    ${rows.length ? rows.map((q) => `
      <article class="inq${q.status === "done" ? " done" : ""}">
        <header>
          <b>${esc(q.name)}</b>
          <a href="mailto:${esc(q.email)}">${esc(q.email)}</a>
          <span class="badge-sm${q.status === "done" ? "" : " hot"}">${q.status === "done" ? "처리 완료" : "새 문의"}</span>
          <span class="badge-sm">${esc(LABELS.inquiry[q.type] || q.type)}</span>
          <span class="when">${fmt(q.created_at)}</span>
        </header>
        <p>${esc(q.message)}</p>
        <div class="acts">
          <a class="ad-btn small ghost" href="mailto:${esc(q.email)}?subject=${encodeURIComponent("Re: " + (LABELS.inquiry[q.type] || "") + " 문의")}">메일로 답장</a>
          <button class="ad-btn small ghost" type="button" data-toggle="${q.id}">${q.status === "done" ? "새 문의로 되돌리기" : "처리 완료로 표시"}</button>
          <button class="ad-btn small danger" type="button" data-del="${q.id}">삭제</button>
        </div>
      </article>`).join("") : `<p class="ad-empty">받은 문의가 없어요.</p>`}`;

  $("#main").querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", async () => {
    const q = rows.find((r) => String(r.id) === b.dataset.toggle);
    await DB.admin.save("inquiries", { ...q, status: q.status === "done" ? "new" : "done" });
    route();
  }));
  $("#main").querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
    if (!confirm("이 문의를 삭제할까요?")) return;
    await DB.admin.remove("inquiries", rows.find((r) => String(r.id) === b.dataset.del).id);
    route();
  }));
}

// ---------- 라우팅: #섹션, #섹션/new, #섹션/edit/id ----------
let currentHash = null;
let entered = false;
async function route() {
  if (!entered) return;
  const hash = location.hash.slice(1) || "settings";
  if (state.dirty && hash !== currentHash && !confirm("저장하지 않은 변경이 있어요. 나갈까요?")) {
    history.replaceState(null, "", "#" + currentHash);
    return;
  }
  currentHash = hash;
  const [key, action, id] = hash.split("/");
  setDirty(false);
  await renderNav(key);
  if (SETTINGS_FORMS[key]) await renderSettings(key);
  else if (key === "inquiries") await renderInquiries();
  else if (ENTITIES[key]) {
    if (action === "new") await renderEdit(key, null);
    else if (action === "edit") await renderEdit(key, decodeURIComponent(id));
    else await renderList(key);
  } else {
    location.hash = "settings";
    return;
  }
  document.title = `${sectionLabel(key)} — 관리`;
  $("#main").focus({ preventScroll: true });
}
addEventListener("hashchange", route);

// ---------- 상단 도구 ----------
$("#export").addEventListener("click", async () => {
  try {
    const blob = new Blob([await DB.admin.exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `portfolio-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } catch (e) {
    toast(e.message, true);
  }
});
$("#reset").addEventListener("click", () => {
  if (!confirm("이 브라우저에 저장한 내용을 모두 지우고 예시 데이터로 되돌릴까요? 먼저 JSON 내보내기로 백업하는 걸 권해요.")) return;
  DB.admin.reset();
  setDirty(false);
  toast("예시 데이터로 되돌렸어요");
  route();
});
// 로컬 미리보기에서 내보낸 JSON을 Supabase로 옮기기 (연결 후)
$("#import").addEventListener("click", async () => {
  const file = await pickFile(".json,application/json");
  if (!file) return;
  if (!confirm("이 JSON의 내용을 Supabase에 저장할까요? 같은 주소용 이름의 항목은 덮어써요. CV 항목과 문의는 새로 추가돼요.")) return;
  try {
    await DB.admin.importJSON(await file.text(), (msg) => toast(msg));
    toast("가져오기를 마쳤어요");
    route();
  } catch (e) {
    toast(e.message, true);
  }
});
$("#logout").addEventListener("click", async () => {
  if (state.dirty && !confirm("저장하지 않은 변경이 있어요. 로그아웃할까요?")) return;
  setDirty(false);
  await DB.auth.signOut();
  location.reload();
});

// + 격자를 화면 중앙 기준으로 (사이트와 같은 배경)
const alignGrid = () => {
  document.documentElement.style.setProperty("--grid-ox", Math.round(innerWidth / 2) - 12 + "px");
  document.documentElement.style.setProperty("--grid-oy", Math.round(innerHeight / 2) - 12 + "px");
};
alignGrid();
addEventListener("resize", alignGrid);

// ---------- 입장: 로그인한 관리자만 편집 화면으로 ----------
// 화면을 숨기는 것은 편의일 뿐이고, 실제 보호는 Supabase RLS(관리자만 쓰기)가 한다.
function enterApp() {
  entered = true;
  const local = DB.admin.mode() === "local";
  $("#gate").hidden = true;
  $("#app").hidden = false;
  $("#tools").hidden = false;
  $("#banner").hidden = !local;
  $("#reset").hidden = !local;
  $("#import").hidden = local;
  $("#logout").hidden = local;
  route();
}

async function boot() {
  const msg = $("#login-msg");
  if (DB.admin.mode() === "local") {
    $("#gate-note").innerHTML = "<b>Supabase 연결 전</b>이라 로그인은 아직 동작하지 않아요. 연결하면 관리자 이메일과 비밀번호를 넣어야 들어올 수 있어요. 지금은 이 브라우저에만 저장되는 미리보기로 들어갈 수 있어요.";
    $("#login").querySelectorAll("input, #login-btn").forEach((el) => (el.disabled = true));
    $("#local-enter").hidden = false;
    $("#local-enter").addEventListener("click", enterApp);
    return;
  }

  $("#gate-note").textContent = "관리자 계정으로 로그인하세요.";
  $("#login-btn").disabled = true;
  try {
    if ((await DB.auth.session()) && (await DB.auth.isAdmin())) return enterApp();
  } catch (e) {
    msg.textContent = e.message;
  }
  $("#login-btn").disabled = false;
  $("#login-email").focus();

  $("#login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#login-email").value.trim(), password = $("#login-pw").value;
    if (!email || !password) { msg.textContent = "이메일과 비밀번호를 입력해 주세요."; return; }
    $("#login-btn").disabled = true;
    msg.textContent = "확인 중…";
    try {
      await DB.auth.signIn(email, password);
      if (!(await DB.auth.isAdmin())) {
        await DB.auth.signOut();
        throw new Error("관리자로 등록된 계정이 아니에요.");
      }
      $("#login-pw").value = "";
      msg.textContent = "";
      enterApp();
    } catch (err) {
      msg.textContent = err.message;
      $("#login-btn").disabled = false;
    }
  });
}
boot();
