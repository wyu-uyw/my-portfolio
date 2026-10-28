// ==================================================================
// 데이터 계층 — 페이지는 DB.* 함수로만 데이터를 읽는다.
// 지금은 Supabase 연결 전이라 아래 SAMPLE(예시 데이터)을 돌려준다.
// 테이블 구조와 RLS는 supabase/schema.sql 참고. 필드 이름도 테이블과 같다.
// Supabase 연결 시 DB.* 함수 안쪽만 테이블 조회로 바꾸면 페이지 코드는 그대로 쓸 수 있다.
// 이미지(src, cover_image)는 Storage `portfolio` 버킷의 공개 URL 자리. null이면 자리 표시 무늬.
// ==================================================================

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
const steps = (note) => ["sketch", "pattern", "sample", "handwork"].map((step) => ({
  step, src: null, caption: `예시: ${LABELS.process[step]} 단계 ${note}`,
}));

const SAMPLE = {
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
      cover_image: null, process_images: steps("기록"),
      gallery_images: [
        { src: null, caption: "전체 컷" },
        { src: null, caption: "질감 디테일", detail: true },
        { src: null, caption: "설치 전경" },
      ],
      sort_order: 1, is_public: true,
    },
    {
      id: "grid-memory-02", collection_id: "grid-memory", type: "project", title: "격자의 기억 02", year: 2026,
      techniques: ["weave"], fiber: "울 100%", size: "60 × 90 cm", tools: "테이블룸",
      description: "예시 작업 설명입니다.",
      cover_image: null, process_images: steps("기록"),
      gallery_images: [{ src: null, caption: "전체 컷" }, { src: null, caption: "질감 디테일", detail: true }],
      sort_order: 2, is_public: true,
    },
    {
      id: "indigo-tide-01", collection_id: "indigo-tide", type: "project", title: "쪽빛 물결 I", year: 2025,
      techniques: ["dye", "print"], fiber: "실크 100%", size: "90 × 90 cm", tools: "염색 통, 스크린 판",
      description: "예시 작업 설명입니다.",
      cover_image: null, process_images: steps("기록"),
      gallery_images: [{ src: null, caption: "전체 컷" }, { src: null, caption: "질감 디테일", detail: true }],
      sort_order: 1, is_public: true,
    },
    {
      id: "indigo-tide-02", collection_id: "indigo-tide", type: "project", title: "쪽빛 물결 II", year: 2025,
      techniques: ["dye"], fiber: "실크 100%", size: "90 × 90 cm", tools: "염색 통",
      description: "예시 작업 설명입니다.",
      cover_image: null, process_images: steps("기록"),
      gallery_images: [{ src: null, caption: "전체 컷" }, { src: null, caption: "질감 디테일", detail: true }],
      sort_order: 2, is_public: true,
    },
    {
      id: "thread-trace-01", collection_id: "thread-trace", type: "project", title: "실의 궤적 01", year: 2024,
      techniques: ["stitch"], fiber: "린넨 100%", size: "30 × 30 cm", tools: "자수틀",
      description: "예시 작업 설명입니다.",
      cover_image: null, process_images: steps("기록"),
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
    { id: 1, section: "education", year: "2027", title: "섬유디자인 전공 학사 (졸업 예정)", venue: "○○대학교", location: "서울", note: "", is_upcoming: false, link: null, sort_order: 1 },
    { id: 2, section: "exhibition", year: "2026", title: "졸업 전시 「전시명」", venue: "○○갤러리", location: "서울", note: "단체전", is_upcoming: true, link: null, sort_order: 1 },
    { id: 3, section: "exhibition", year: "2025", title: "「전시명」", venue: "○○공간", location: "서울", note: "단체전", is_upcoming: false, link: null, sort_order: 1 },
    { id: 4, section: "award", year: "2025", title: "○○ 텍스타일 공모전 입선", venue: "○○재단", location: "", note: "", is_upcoming: false, link: null, sort_order: 1 },
    { id: 5, section: "residency", year: "2025", title: "천연 염색 워크숍 참여", venue: "○○공방", location: "전주", note: "워크숍", is_upcoming: false, link: null, sort_order: 1 },
    { id: 6, section: "residency", year: "2024", title: "브랜드 패턴 디자인 외주", venue: "○○", location: "", note: "외주", is_upcoming: false, link: null, sort_order: 2 },
    { id: 8, section: "collection", year: "2025", title: "「작품명」", venue: "○○미술관", location: "서울", note: "", is_upcoming: false, link: null, sort_order: 1 },
    { id: 7, section: "press", year: "2026", title: "인터뷰 「기사 제목」", venue: "○○매거진", location: "", note: "", is_upcoming: false, link: "https://example.com", sort_order: 1 },
  ],
};

// About의 Bio / Statement — 자주 바뀌지 않으므로 테이블 없이 여기서 관리
const ABOUT = {
  photo: null,
  oneLiner: "실과 격자로 기억을 짜는 텍스타일 디자이너",
  bio: "예시 약력입니다. 서울에서 태어나 활동하며, ○○대학교에서 섬유디자인을 전공하고 있습니다. 면·린넨·울·실크를 주로 다루며 직조와 자수, 천연 염색을 함께 씁니다.",
  statement: [
    "예시 작가 노트입니다. 작업의 주제와 관심사를 씁니다.",
    "소재를 어떻게 대하는지, 손으로 만드는 과정에서 무엇을 발견하는지 씁니다.",
    "어려운 이론을 나열하기보다 내 작업을 처음 보는 사람이 이해할 수 있는 말로 씁니다.",
  ],
};

const byOrder = (a, b) => a.sort_order - b.sort_order;

const DB = {
  async collections() {
    return SAMPLE.collections.filter((c) => c.is_public).sort(byOrder);
  },
  async collection(id) {
    return (await DB.collections()).find((c) => c.id === id) || null;
  },
  // type: "project" | "swatch" | undefined(전체)
  async works(type) {
    return SAMPLE.works.filter((w) => w.is_public && (!type || w.type === type)).sort(byOrder);
  },
  async work(id) {
    return (await DB.works()).find((w) => w.id === id) || null;
  },
  async worksInCollection(collectionId) {
    return (await DB.works("project")).filter((w) => w.collection_id === collectionId);
  },
  async posts() {
    return SAMPLE.journal_posts.filter((p) => p.is_public).sort((a, b) => b.date.localeCompare(a.date));
  },
  async post(id) {
    return (await DB.posts()).find((p) => p.id === id) || null;
  },
  // 최신순: 예정 → 연도 내림차순 → sort_order
  async cv() {
    return [...SAMPLE.cv_items].sort((a, b) =>
      (b.is_upcoming - a.is_upcoming) || b.year.localeCompare(a.year) || byOrder(a, b));
  },
  // inquiries insert. 연결 전에는 저장하지 못했음을 알려 메일 앱으로 대체한다.
  async submitInquiry(_inquiry) {
    return { ok: false, reason: "not-connected" };
  },
};
