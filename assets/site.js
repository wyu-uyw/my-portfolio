// ==================================================================
// 하위 페이지 공통: 사이트 정보, 헤더/푸터, + 격자 정렬, 페이지 전환
// 각 페이지는 <body data-page="work"> 처럼 현재 메뉴를 표시한다.
// ==================================================================
const SITE = {
  name: "KIM HANEUL",                       // 임시 가명 — 실제 이름 확정 후 교체
  email: "haneul.kim@example.com",           // 임시
  instagram: "https://instagram.com/",       // 임시
  instagramLabel: "Instagram",
  status: "협업 문의 가능 · 2027.02 졸업 예정",
  cvUrl: null,                               // CV PDF 경로 (예: "assets/cv.pdf"). null이면 '준비 중'
  menus: [
    { key: "work",    label: "Work",    href: "work.html" },
    { key: "journal", label: "Journal", href: "journal.html" },
    { key: "about",   label: "About",   href: "about.html" },
    { key: "contact", label: "Contact", href: "contact.html" },
  ],
};

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// 문자열을 HTML에 넣을 때 항상 이스케이프
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function param(name) {
  return new URLSearchParams(location.search).get(name);
}
// 이미지가 있으면 <img>, 없으면 스티치 무늬 자리 표시
function media(src, alt, ratio = "4 / 5", label = "IMAGE") {
  const style = `style="--ratio:${ratio}"`;
  if (src) return `<img class="media" ${style} src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`;
  return `<div class="ph" ${style} role="img" aria-label="${esc(alt)} (이미지 준비 중)">${label ? `<span>${esc(label)}</span>` : ""}</div>`;
}
function formatDate(iso) {
  return iso ? iso.replaceAll("-", ".") : "";
}

function renderChrome() {
  const page = document.body.dataset.page;
  const bg = document.createElement("div");
  bg.className = "site-bg";
  bg.setAttribute("aria-hidden", "true");
  document.body.prepend(bg);

  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <a class="home-link" href="index.html" data-home><span>←</span> PORTFOLIO</a>
    <nav class="site-nav" aria-label="메뉴">
      ${SITE.menus.map((m) => `<a href="${m.href}"${m.key === page ? ' aria-current="page"' : ""}>${m.label}</a>`).join("")}
    </nav>`;
  bg.after(header);

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="links">
      <a href="mailto:${esc(SITE.email)}">${esc(SITE.email)}</a>
      <a href="${esc(SITE.instagram)}" target="_blank" rel="noopener">${esc(SITE.instagramLabel)}</a>
    </div>
    <div class="end">
      <button class="theme-btn" type="button" data-theme-toggle></button>
      <span>© ${esc(SITE.name)} ${new Date().getFullYear()}</span>
    </div>`;
  document.body.append(footer);
  setupThemeToggle(footer.querySelector("[data-theme-toggle]"));
}

// 배색 전환 (파란 배경 ↔ 흰 배경). 메인과 같은 localStorage 키를 쓴다.
// 저장된 배색은 각 페이지 <head>의 한 줄 스크립트가 그리기 전에 먼저 적용한다.
function setupThemeToggle(btn) {
  const root = document.documentElement;
  const sync = () => {
    const inverse = root.dataset.theme === "inverse";
    btn.textContent = inverse ? "Blue" : "White";
    btn.setAttribute("aria-pressed", String(inverse));
    btn.setAttribute("aria-label", inverse ? "파란 배경으로 보기" : "흰 배경으로 보기");
  };
  btn.addEventListener("click", () => {
    const inverse = root.dataset.theme !== "inverse";
    if (inverse) root.dataset.theme = "inverse";
    else delete root.dataset.theme;
    try { localStorage.setItem("theme", inverse ? "inverse" : "default"); } catch (_) {}
    sync();
  });
  sync();
}

// + 격자를 메인과 같이 화면 중앙 기준으로 정렬
function alignGrid() {
  const ox = Math.round(innerWidth / 2) - 12;
  const oy = Math.round(innerHeight / 2) - 12;
  document.documentElement.style.setProperty("--grid-ox", ox + "px");
  document.documentElement.style.setProperty("--grid-oy", oy + "px");
}

// 같은 사이트 안 이동은 페이드아웃 후 이동. 메인으로 갈 때는 줄이 다시 매달리는 연출을 요청.
function setupTransitions() {
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !url.pathname.endsWith(".html") && !url.pathname.endsWith("/")) return;
    if (url.pathname === location.pathname && url.hash) return;
    if (/(^|\/)(index\.html)?$/.test(url.pathname)) {
      try { sessionStorage.setItem("rehang", "1"); } catch (_) {}
    }
    if (reducedMotion) return;
    e.preventDefault();
    document.body.classList.add("leaving");
    setTimeout(() => (location.href = url.href), 280);
  });
  // 뒤로가기(bfcache)로 돌아왔을 때 페이드아웃 상태 해제
  addEventListener("pageshow", (e) => { if (e.persisted) document.body.classList.remove("leaving"); });
}

renderChrome();
alignGrid();
addEventListener("resize", alignGrid);
setupTransitions();
