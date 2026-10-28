// ==================================================================
// 하위 페이지 공통: 사이트 정보, 헤더/푸터, + 격자 정렬, 라이트박스, 배색 전환
// 각 페이지는 <body data-page="work" data-title="Work"> 처럼 현재 메뉴와 제목을 표시한다.
// 하위 페이지는 인터랙션을 최소화한다: 이미지 페이드인, 호버 확대, 라이트박스만.
// ==================================================================
// 이름·이메일·SNS·상태·CV 등은 관리 페이지의 "사이트 설정"(site_settings)에서 온다 (assets/data.js를 먼저 불러올 것)
// 첫 화면은 마지막으로 받은 설정(SETTINGS)으로 바로 그리고, 최신 설정을 받으면(siteReady) 다시 채운다.
const SETTINGS = typeof DB !== "undefined" ? DB.cachedSettings() : {};
const SITE = {
  menus: [
    { key: "work",    label: "Work",    href: "work.html" },
    { key: "journal", label: "Journal", href: "journal.html" },
    { key: "about",   label: "About",   href: "about.html" },
    { key: "contact", label: "Contact", href: "contact.html" },
  ],
};
function applySettings(s) {
  Object.assign(SETTINGS, s);
  SITE.name = s.name || "";
  SITE.email = s.email || "";
  SITE.sns = s.sns || [];
  SITE.status = s.status || "";
  SITE.cvUrl = s.cv_pdf || null;              // null이면 About의 CV 버튼이 '준비 중'
}
applySettings(SETTINGS);

// 문자열을 HTML에 넣을 때 항상 이스케이프
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function param(name) {
  return new URLSearchParams(location.search).get(name);
}
function formatDate(iso) {
  return iso ? iso.replaceAll("-", ".") : "";
}
// 빈 줄로 나뉜 텍스트 → 문단 배열
function paragraphs(text) {
  return String(text || "").split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean);
}
// <title>을 "페이지명 — 이름" 형식으로
// description을 주면 검색 결과·공유 미리보기에 쓰이는 설명도 바꾼다 (Journal·작품 글 노출용)
let titleName = "";
function setTitle(pageName, description) {
  titleName = pageName;
  document.title = SITE.name ? `${pageName} — ${SITE.name}` : pageName;
  if (description) document.querySelector('meta[name="description"]')?.setAttribute("content", description.slice(0, 160));
}

// 이미지가 있으면 <img>(불러오면 페이드인), 없으면 스티치 무늬 자리 표시
function media(src, alt, ratio = "4 / 5", label = "IMAGE") {
  const style = `style="--ratio:${ratio}"`;
  if (src) {
    return `<img class="media" ${style} src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" onload="this.classList.add('loaded')">`;
  }
  return `<div class="ph" ${style} role="img" aria-label="${esc(alt)} (이미지 준비 중)">${label ? `<span>${esc(label)}</span>` : ""}</div>`;
}
// 누르면 라이트박스로 크게 보는 이미지. 같은 group끼리 ←/→로 넘겨 본다.
function zoomable({ src, alt, ratio = "4 / 5", label = "IMAGE", caption = "", info = "", group = "page" }) {
  return `<button type="button" class="zoom" data-lb data-lb-group="${esc(group)}"
    data-lb-src="${esc(src || "")}" data-lb-alt="${esc(alt)}" data-lb-ratio="${esc(ratio)}"
    data-lb-caption="${esc(caption)}" data-lb-info="${esc(info)}" aria-label="${esc(alt)} 크게 보기">${media(src, alt, ratio, label)}</button>`;
}

function renderChrome() {
  const page = document.body.dataset.page;
  if (document.body.dataset.title) setTitle(document.body.dataset.title);

  const bg = document.createElement("div");
  bg.className = "site-bg";
  bg.setAttribute("aria-hidden", "true");
  document.body.prepend(bg);

  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <a class="logo" href="index.html" data-home></a>
    <nav class="site-nav" aria-label="메뉴">
      ${SITE.menus.map((m) => `<a href="${m.href}"${m.key === page ? ' aria-current="page"' : ""}>${m.label}</a>`).join("")}
    </nav>`;
  bg.after(header);

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="links" data-contact-links></div>
    <div class="end">
      <button class="theme-btn" type="button" data-theme-toggle></button>
      <span data-copyright></span>
    </div>`;
  document.body.append(footer);
  fillChrome();
  setupThemeToggle(footer.querySelector("[data-theme-toggle]"));

  // 이름(로고)으로 메인에 돌아가면 메인의 줄이 다시 매달리는 연출
  header.querySelector("[data-home]").addEventListener("click", () => {
    try { sessionStorage.setItem("rehang", "1"); } catch (_) {}
  });
}

// 로고·푸터의 이름·이메일·SNS를 설정값으로 채운다 (설정을 새로 받으면 다시 부름)
function fillChrome() {
  const logo = document.querySelector(".site-header [data-home]");
  if (logo) logo.textContent = SITE.name;
  const links = document.querySelector("[data-contact-links]");
  if (links) {
    links.innerHTML = (SITE.email ? `<a href="mailto:${esc(SITE.email)}">${esc(SITE.email)}</a>` : "") +
      SITE.sns.map((s) => `<a href="${esc(s.href)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join("");
  }
  const copy = document.querySelector("[data-copyright]");
  if (copy) copy.textContent = `© ${SITE.name} ${new Date().getFullYear()}`;
  if (titleName) setTitle(titleName);
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

// + 격자를 메인과 같이 화면 중앙 기준으로 정렬 (dim 상태만, 밝아지는 효과 없음)
function alignGrid() {
  const ox = Math.round(innerWidth / 2) - 12;
  const oy = Math.round(innerHeight / 2) - 12;
  document.documentElement.style.setProperty("--grid-ox", ox + "px");
  document.documentElement.style.setProperty("--grid-oy", oy + "px");
}

// ---------- 라이트박스 ----------
const lightbox = (() => {
  const el = document.createElement("div");
  el.className = "lightbox";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "이미지 크게 보기");
  el.innerHTML = `
    <button class="lb-btn lb-close" type="button" aria-label="닫기">✕</button>
    <button class="lb-btn lb-prev" type="button" aria-label="이전 이미지">←</button>
    <figure class="lb-figure">
      <div class="lb-media"></div>
      <figcaption><strong class="lb-caption"></strong><span class="lb-info"></span><span class="lb-count"></span></figcaption>
    </figure>
    <button class="lb-btn lb-next" type="button" aria-label="다음 이미지">→</button>`;
  let items = [];
  let index = 0;
  let opener = null;

  function show(i) {
    index = (i + items.length) % items.length;
    const d = items[index].dataset;
    el.querySelector(".lb-media").innerHTML = d.lbSrc
      ? `<img src="${esc(d.lbSrc)}" alt="${esc(d.lbAlt)}">`
      : media(null, d.lbAlt, d.lbRatio, "IMAGE");
    el.querySelector(".lb-caption").textContent = d.lbCaption || d.lbAlt;
    el.querySelector(".lb-info").textContent = d.lbInfo || "";
    el.querySelector(".lb-count").textContent = items.length > 1 ? `${index + 1} / ${items.length}` : "";
    el.querySelector(".lb-prev").hidden = el.querySelector(".lb-next").hidden = items.length < 2;
  }
  function open(trigger) {
    opener = trigger;
    items = [...document.querySelectorAll(`[data-lb][data-lb-group="${CSS.escape(trigger.dataset.lbGroup)}"]`)];
    show(items.indexOf(trigger));
    el.hidden = false;
    document.body.style.overflow = "hidden";
    el.querySelector(".lb-close").focus();
  }
  function close() {
    el.hidden = true;
    document.body.style.overflow = "";
    if (opener) opener.focus();
  }
  el.querySelector(".lb-close").addEventListener("click", close);
  el.querySelector(".lb-prev").addEventListener("click", () => show(index - 1));
  el.querySelector(".lb-next").addEventListener("click", () => show(index + 1));
  el.addEventListener("click", (e) => { if (e.target === el) close(); });
  document.addEventListener("keydown", (e) => {
    if (el.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft" && items.length > 1) show(index - 1);
    else if (e.key === "ArrowRight" && items.length > 1) show(index + 1);
    else if (e.key === "Tab") {
      // 포커스를 라이트박스 안에 가둔다
      const f = [...el.querySelectorAll("button:not([hidden])")];
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-lb]");
    if (t) open(t);
  });
  return { el };
})();

renderChrome();
// 최신 설정 받기 — 페이지 스크립트는 설정이 필요한 부분을 siteReady.then(...) 안에서 그린다
const siteReady = (typeof DB !== "undefined" ? DB.settings() : Promise.resolve({})).then((s) => {
  applySettings(s);
  fillChrome();
  return s;
});
document.body.append(lightbox.el);
alignGrid();
addEventListener("resize", alignGrid);
