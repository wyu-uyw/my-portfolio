// ==================================================================
// 데이터 계층 — 페이지는 DB.* 함수로만 데이터를 읽는다.
// 지금은 Supabase 연결 전이라 아래 SAMPLE(예시 데이터)을 돌려준다.
// Supabase 연결 시 DB.* 함수 안쪽만 테이블 조회로 바꾸면 페이지 코드는 그대로 쓸 수 있다.
//   works          → SAMPLE.works
//   journal_posts  → SAMPLE.journal_posts
//   history        → SAMPLE.history
//   inquiries      → DB.submitInquiry (insert만)
// 이미지(src)는 Supabase Storage 공개 URL이 들어갈 자리. null이면 자리 표시 무늬로 보인다.
// ==================================================================

const LABELS = {
  section: { projects: "Projects", swatch: "Swatch" },
  technique: { weave: "Weave", print: "Print", stitch: "Stitch", dye: "Dye" },
  category: { making: "Making", research: "Research", exhibition: "Exhibition", note: "Note" },
  history: { education: "학력", exhibition: "전시", award: "수상", activity: "경력 / 활동" },
  inquiry: { collab: "협업", commission: "외주", etc: "기타" },
};

// ---- 예시 데이터 (실제 내용으로 교체할 것) ----
const SAMPLE = {
  works: [
    {
      id: "grid-memory", sort: 1, published: true,
      title: "격자의 기억", year: 2026, section: "projects", techniques: ["weave", "stitch"],
      summary: "졸업 전시 출품작. 손으로 짠 격자 위에 남은 흔적을 기록한다.",
      concept: "예시 텍스트입니다. 작업의 출발점이 된 질문, 다루고 싶었던 감각, 소재와 기법을 고른 이유를 이 자리에 씁니다.",
      materials: { fiber: "면 70%, 린넨 30%", technique: "평직, 크로스 스티치", size: "120 × 180 cm", tools: "4종광 핸드룸, 자수바늘" },
      cover: null,
      process: [
        { step: "스케치", image: null, text: "예시: 첫 아이디어 스케치와 레퍼런스 정리." },
        { step: "패턴 전개", image: null, text: "예시: 조직도와 리피트 설계." },
        { step: "샘플", image: null, text: "예시: 실 굵기와 밀도별 샘플 테스트." },
        { step: "완성", image: null, text: "예시: 최종 제직과 마감." },
      ],
      gallery: [
        { src: null, caption: "전체 컷" },
        { src: null, caption: "디테일 확대", detail: true },
        { src: null, caption: "설치 전경" },
      ],
    },
    {
      id: "indigo-tide", sort: 2, published: true,
      title: "쪽빛 물결", year: 2025, section: "projects", techniques: ["dye", "print"],
      summary: "쪽 염색과 실크스크린을 겹쳐 물결의 층위를 표현한 연작.",
      concept: "예시 텍스트입니다. 컨셉 설명이 들어갈 자리입니다.",
      materials: { fiber: "실크 100%", technique: "쪽 염색, 실크스크린", size: "90 × 90 cm × 3", tools: "염색 통, 스크린 판" },
      cover: null,
      process: [
        { step: "스케치", image: null, text: "예시 설명." },
        { step: "패턴 전개", image: null, text: "예시 설명." },
        { step: "샘플", image: null, text: "예시 설명." },
        { step: "완성", image: null, text: "예시 설명." },
      ],
      gallery: [{ src: null, caption: "전체 컷" }, { src: null, caption: "디테일 확대", detail: true }],
    },
    {
      id: "swatch-twill-01", sort: 3, published: true,
      title: "능직 스와치 01", year: 2025, section: "swatch", techniques: ["weave"],
      summary: "능직 변화 조직 실험.",
      concept: "예시 텍스트입니다.",
      materials: { fiber: "울 100%", technique: "2/2 능직 변화", size: "20 × 20 cm", tools: "테이블룸" },
      cover: null, process: [], gallery: [{ src: null, caption: "디테일 확대", detail: true }],
    },
    {
      id: "swatch-stitch-02", sort: 4, published: true,
      title: "자수 스와치 02", year: 2024, section: "swatch", techniques: ["stitch", "dye"],
      summary: "부분 염색 위 자수 밀도 실험.",
      concept: "예시 텍스트입니다.",
      materials: { fiber: "린넨 100%", technique: "홀치기 염색, 새틴 스티치", size: "15 × 15 cm", tools: "자수틀" },
      cover: null, process: [], gallery: [{ src: null, caption: "디테일 확대", detail: true }],
    },
  ],

  journal_posts: [
    {
      id: "loom-setup", published: true, date: "2026-10-12", category: "making",
      title: "졸업 작품 경사 걸기", thumbnail: null,
      summary: "예시: 1,200올 경사를 거는 데 걸린 사흘의 기록.",
      body: [
        { type: "p", text: "예시 본문입니다. 작업 과정에서 있었던 일, 시행착오, 생각을 자유롭게 씁니다." },
        { type: "img", src: null, caption: "예시 이미지 캡션" },
        { type: "p", text: "본문은 문단과 이미지 블록을 섞어 구성합니다." },
      ],
      related_work_id: "grid-memory",
    },
    {
      id: "indigo-research", published: true, date: "2026-08-03", category: "research",
      title: "쪽 염색 온도 기록", thumbnail: null,
      summary: "예시: 발효 온도에 따른 색 변화 관찰.",
      body: [{ type: "p", text: "예시 본문입니다." }],
      related_work_id: "indigo-tide",
    },
    {
      id: "grad-show-note", published: true, date: "2026-06-20", category: "exhibition",
      title: "졸업 전시 준비 노트", thumbnail: null,
      summary: "예시: 전시 공간 답사와 설치 계획.",
      body: [{ type: "p", text: "예시 본문입니다." }],
      related_work_id: null,
    },
  ],

  history: [
    { id: 1, kind: "education", year: "2027", text: "○○대학교 섬유디자인 전공 졸업 예정", sort: 1 },
    { id: 2, kind: "education", year: "2021", text: "○○대학교 섬유디자인 전공 입학", sort: 2 },
    { id: 3, kind: "exhibition", year: "2026", text: "졸업 전시 「전시명」, 장소", sort: 1 },
    { id: 4, kind: "exhibition", year: "2025", text: "그룹전 「전시명」, 장소", sort: 2 },
    { id: 5, kind: "award", year: "2025", text: "○○ 공모전 입선", sort: 1 },
    { id: 6, kind: "activity", year: "2024", text: "○○ 공방 어시스턴트", sort: 1 },
  ],
};

// About 페이지의 고정 소개 내용 (자주 바뀌지 않으므로 테이블 없이 여기서 관리)
const ABOUT = {
  photo: null,
  oneLiner: "실과 격자로 기억을 짜는 텍스타일 디자이너",
  intro: [
    "예시 소개글입니다. 어떤 주제에 관심이 있고, 어떤 방식으로 작업하는지 씁니다.",
    "주로 다루는 소재(면, 린넨, 울, 실크 등)와 기법(직조, 프린트, 자수, 염색)을 소개합니다.",
  ],
  skills: ["직조 (Weave)", "프린트 (Print)", "자수 (Stitch)", "염색 (Dye)"],
  tools: ["Adobe Illustrator", "Photoshop", "Weave Point", "Figma"],
};

const DB = {
  async works() {
    return SAMPLE.works.filter((w) => w.published).sort((a, b) => a.sort - b.sort);
  },
  async work(id) {
    return (await DB.works()).find((w) => w.id === id) || null;
  },
  async posts() {
    return SAMPLE.journal_posts.filter((p) => p.published).sort((a, b) => b.date.localeCompare(a.date));
  },
  async post(id) {
    return (await DB.posts()).find((p) => p.id === id) || null;
  },
  async history() {
    return [...SAMPLE.history].sort((a, b) => b.year.localeCompare(a.year) || a.sort - b.sort);
  },
  // inquiries insert. 연결 전에는 저장하지 못했음을 알려 메일 앱으로 대체한다.
  async submitInquiry(_inquiry) {
    return { ok: false, reason: "not-connected" };
  },
};
