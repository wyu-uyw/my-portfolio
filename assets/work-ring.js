// ==================================================================
// Work 원형 회전 진열 — 보이지 않는 원 위에 작품을 놓고 가운데 다이얼과 함께 돌려 본다.
// 수치는 아래 RING 설정 객체에서만 조절한다. 움직임은 transform · opacity만 쓴다.
// 회전 각도(rot)는 시계 방향이 +, 작품 i는 12시에서 (i × 간격 + rot)만큼 돌아간 자리에 놓인다.
// ==================================================================
const RING = {
  // 원 반지름: 데스크톱은 원형 영역 짧은 변의 34%, 모바일 세로는 폭의 40%
  // (12시 작품 · 다이얼이 원형 영역 높이에 안 들어갈 때만 줄어듦. 나머지 원 경로는 잘려도 됨)
  radius: 0.34,
  radiusMobile: 0.40,
  mobileBelow: 640,       // 이 폭 미만이면 모바일 수치
  mobileDrop: 0.04,       // 모바일: 원 중심을 원형 영역 가운데보다 이만큼(높이 비율) 아래로
  thumb: 120,             // 썸네일 긴 변 (px)
  thumbMobile: 72,
  selScale: 2.2,          // 12시 작품 확대 배율
  selScaleMobile: 2.6,
  titleSpace: 64,         // 12시 작품 위 제목이 차지하는 높이 (원 중심을 내릴 때 계산에 씀)
  edge: 12,               // 원형 영역 가장자리 여백
  countSpace: 28,         // 다이얼 아래 01 / 12 숫자가 차지하는 높이
  // 가운데 다이얼 (메인 레버와 같은 흰 직선)
  dialRadius: 64,         // 눈금 점이 놓이는 반지름 (원 반지름의 dialMax까지)
  dialRadiusMobile: 40,
  dialMax: 0.32,
  dialLine: 0.78,         // 직선 길이 = 다이얼 반지름 × 이 값
};

const TAU = Math.PI * 2;
// 각도를 -π ~ π 로
const wrapAngle = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const SVG_NS = "http://www.w3.org/2000/svg";

// items: [{ id, title, src, ratio(가로/세로, 이미지 없을 때), ... }]
function createRing(root) {
  const layer = root.querySelector(".ring-items");
  const dial = root.querySelector(".ring-dial");
  const dialRot = dial.querySelector(".dl-rot");
  const dialDots = dial.querySelector(".dl-dots");
  const dialLine = dial.querySelector(".dl-line");
  const count = root.querySelector(".ring-count");

  let items = [];
  let rot = 0;
  const g = { w: 0, h: 0, cx: 0, cy: 0, r: 0, thumb: RING.thumb, sel: RING.selScale, mobile: false };

  // 썸네일 상자: 긴 변 = 기본 크기, 원래 비율 유지 (회전과 무관하게 항상 똑바로 섬)
  function sizeThumb(it) {
    const r = it.ratio;
    it.tw = r >= 1 ? g.thumb : g.thumb * r;
    it.th = r >= 1 ? g.thumb / r : g.thumb;
    Object.assign(it.thumbEl.style, {
      width: it.tw + "px", height: it.th + "px",
      left: -it.tw / 2 + "px", top: -it.th / 2 + "px",
    });
  }

  function build(list) {
    layer.textContent = "";
    items = list.map((data) => {
      const el = document.createElement("div");
      el.className = "ring-item";
      const thumbEl = document.createElement("div");
      thumbEl.className = "ri-thumb";
      if (data.src) {
        const img = document.createElement("img");
        img.alt = data.title;
        img.loading = "lazy";
        img.decoding = "async";
        img.draggable = false;
        img.src = data.src;
        // 이미지를 받으면 원래 비율로 상자를 다시 맞춘다
        img.addEventListener("load", () => {
          if (img.naturalWidth && img.naturalHeight) { it.ratio = img.naturalWidth / img.naturalHeight; sizeThumb(it); }
        }, { once: true });
        thumbEl.append(img);
      } else {
        // 이미지가 없으면 하위 페이지와 같은 X 스티치 자리 표시
        const ph = document.createElement("div");
        ph.className = "ph";
        ph.setAttribute("role", "img");
        ph.setAttribute("aria-label", data.title + " (이미지 준비 중)");
        thumbEl.append(ph);
      }
      el.append(thumbEl);
      layer.append(el);
      const it = { ...data, el, thumbEl, z: -1 };
      return it;
    });
    // 다이얼 눈금: 작품 수만큼, 각 작품 자리 방향
    dialDots.textContent = "";
    items.forEach(() => {
      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("class", "dl-dot");
      c.setAttribute("r", "1.6");
      dialDots.append(c);
    });
  }

  // 원형 영역 크기 → 반지름 · 중심 · 다이얼 크기 (창 크기가 바뀔 때만)
  function layout() {
    const rect = root.getBoundingClientRect();
    g.w = rect.width;
    g.h = rect.height;
    g.mobile = innerWidth < RING.mobileBelow;
    g.thumb = g.mobile ? RING.thumbMobile : RING.thumb;
    g.sel = g.mobile ? RING.selScaleMobile : RING.selScale;

    // 화면 안에 꼭 들어와야 하는 것은 12시 작품(확대 + 위 제목)과 가운데 다이얼(+ 숫자)뿐.
    // 나머지 원 경로는 화면 비율에 따라 원형 영역 밖으로 잘려도 된다.
    const topNeed = (g.thumb * g.sel) / 2 + RING.titleSpace + RING.edge;
    const dialR = (r) => Math.min(g.mobile ? RING.dialRadiusMobile : RING.dialRadius, r * RING.dialMax);
    const belowCenter = (r) => dialR(r) + 8 + RING.countSpace + RING.edge;   // 중심 아래로 다이얼 · 숫자
    const want = g.mobile ? g.w * RING.radiusMobile : Math.min(g.w, g.h) * RING.radius;
    // 12시 작품 위쪽 ~ 다이얼 아래쪽이 원형 영역 높이에 들어가도록만 반지름을 줄인다
    let r = want;
    while (r > 40 && topNeed + r + belowCenter(r) > g.h) r -= 4;
    g.r = Math.max(40, r);
    // 원 중심: 가운데(모바일은 조금 아래), 단 12시 작품 · 제목이 위로 넘치지 않고 다이얼이 아래로 넘치지 않게
    const ideal = g.h / 2 + (g.mobile ? g.h * RING.mobileDrop : 0);
    g.cx = g.w / 2;
    g.cy = Math.min(Math.max(ideal, topNeed + g.r), g.h - belowCenter(g.r));

    // 다이얼
    const dr = dialR(g.r);
    const box = dr + 8;
    dial.setAttribute("width", box * 2);
    dial.setAttribute("height", box * 2);
    dial.setAttribute("viewBox", `${-box} ${-box} ${box * 2} ${box * 2}`);
    dial.style.transform = `translate(${g.cx - box}px, ${g.cy - box}px)`;
    dialLine.setAttribute("y2", -dr * RING.dialLine);
    const step = TAU / Math.max(1, items.length);
    [...dialDots.children].forEach((c, i) => {
      c.setAttribute("cx", (dr * Math.sin(i * step)).toFixed(2));
      c.setAttribute("cy", (-dr * Math.cos(i * step)).toFixed(2));
    });
    count.style.transform = `translate(${g.cx}px, ${g.cy + box + 6}px) translateX(-50%)`;

    items.forEach(sizeThumb);
    draw();
  }

  // 한 장면 그리기: 위치 · 쌓임 순서 · 다이얼 회전
  function draw() {
    const n = items.length;
    if (!n) return;
    const step = TAU / n;
    for (let i = 0; i < n; i++) {
      const it = items[i];
      const a = i * step + rot;
      const x = g.cx + g.r * Math.sin(a);
      const y = g.cy - g.r * Math.cos(a);
      it.el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
      // 12시에 가까울수록 위에 (겹칠 때). 바뀔 때만 쓴다
      const z = 1000 - Math.round(Math.abs(wrapAngle(a)) * 300);
      if (z !== it.z) { it.el.style.zIndex = z; it.z = z; }
    }
    dialRot.style.transform = `rotate(${rot}rad)`;
    count.textContent = `${String(selected() + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`;
  }

  // 12시에 가장 가까운 작품 번호
  function selected() {
    const n = items.length;
    if (!n) return -1;
    return ((Math.round(-rot / (TAU / n)) % n) + n) % n;
  }

  function setItems(list, startIndex = 0) {
    build(list);
    rot = list.length ? -startIndex * (TAU / list.length) : 0;
    root.hidden = !list.length;
    layout();
  }

  addEventListener("resize", layout);
  return { setItems, layout, selected };
}
