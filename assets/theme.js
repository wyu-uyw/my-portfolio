// ===================================================================
// 배색 프리셋 — 모든 페이지 <head>에서 그리기 전에 실행 (깜빡임 방지)
// 색 값은 assets/theme.css. 고른 프리셋은 localStorage "theme"에 남아 모든 페이지에 이어진다.
// ===================================================================
(function () {
  const PRESETS = [
    { key: "blue",     label: "Blue" },
    { key: "white",    label: "White" },
    { key: "linen",    label: "Linen" },
    { key: "greige",   label: "Greige" },
    { key: "gallery",  label: "Gallery" },
    { key: "charcoal", label: "Charcoal" },
  ];
  const OLD = { inverse: "white", default: "blue" };   // 2단 토글 시절 저장값
  const root = document.documentElement;
  const listeners = [];

  const valid = (key) => PRESETS.some((p) => p.key === key);
  const current = () => (valid(root.dataset.theme) ? root.dataset.theme : "blue");
  function apply(key) {
    if (key === "blue") delete root.dataset.theme;
    else root.dataset.theme = key;
  }

  let saved = null;
  try { saved = localStorage.getItem("theme"); } catch (_) {}
  saved = OLD[saved] || saved;
  if (valid(saved)) apply(saved);

  function set(key) {
    if (!valid(key)) return;
    apply(key);
    try { localStorage.setItem("theme", key); } catch (_) {}
    listeners.forEach((fn) => fn(key));
  }
  function next() {
    const i = PRESETS.findIndex((p) => p.key === current());
    set(PRESETS[(i + 1) % PRESETS.length].key);
  }

  // 버튼에는 지금 프리셋 이름. 누를 때마다 다음 프리셋으로.
  function bindButton(btn) {
    const sync = () => {
      const i = PRESETS.findIndex((p) => p.key === current());
      const now = PRESETS[i], after = PRESETS[(i + 1) % PRESETS.length];
      btn.textContent = now.label;
      btn.setAttribute("aria-label", `배색 ${now.label} — 눌러서 ${after.label}로 바꾸기`);
    };
    btn.addEventListener("click", next);
    listeners.push(sync);
    sync();
  }

  window.THEME = { presets: PRESETS, current, set, next, bindButton, onChange: (fn) => listeners.push(fn) };
})();
