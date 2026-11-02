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
  infoSpace: 58,          // 12시 작품 아래 정보(연도 · 기법 · 한 줄 설명)가 차지하는 높이
  // 선택 효과: 12시에서 이 각도(라디안, 단 작품 간격보다 넓지 않게) 안에서 크기 · 글자가 연속으로 바뀜
  selRange: 0.6,
  textFrom: 0.45,         // 선택 정도가 이 값을 넘어야 제목 · 정보가 나타나기 시작 (0~1)
  textGap: 10,            // 썸네일과 제목 · 정보 사이 간격
  countSpace: 50,        // 다이얼 아래 01 / 12 숫자 + 첫 방문 안내 글자가 차지하는 높이
  // 가운데 다이얼 (메인 레버와 같은 흰 직선)
  dialRadius: 64,         // 눈금 점이 놓이는 반지름 (원 반지름의 dialMax까지)
  dialRadiusMobile: 40,
  dialMax: 0.32,
  dialLine: 0.78,         // 직선 길이 = 다이얼 반지름 × 이 값
  hintGap: 22,            // 다이얼 바깥 안내 화살표까지 거리
  // 회전 · 관성 · 스냅
  deadZone: 18,           // 원 중심에서 이 거리 안에서는 각도가 튀므로 회전에 쓰지 않음 (px)
  velWindow: 80,          // 놓을 때 회전 속도를 재는 최근 구간 (ms). 이보다 오래 멈췄다 놓으면 관성 없음
  maxVel: 16,             // 관성 최대 속도 (rad/s)
  friction: 3.2,          // 관성 감속 (클수록 빨리 멈춤, 1/s)
  snapSpeed: 1.6,         // 이 속도(rad/s) 아래로 느려지면 가장 가까운 작품을 12시로 맞추기 시작
  spring: 140,            // 스냅 스프링 세기 (임계 감쇠라 넘치지 않음)
  // 클릭 · 휠
  clickMove: 6,           // 이동이 이보다 작고 (px)
  clickMs: 250,           // 이보다 짧게 눌렀다 떼면 클릭 (ms)
  wheelStep: 60,          // 휠 이만큼(px)마다 한 칸 (트랙패드의 잔 움직임은 모아서)
  morphMs: 520,           // 필터 · 탭을 바꿀 때 새 항목 수로 다시 배치되는 시간
};

const TAU = Math.PI * 2;
// 각도를 -π ~ π 로
const wrapAngle = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const SVG_NS = "http://www.w3.org/2000/svg";
// 0~1로 자른 뒤 부드러운 곡선 (smoothstep)
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// items: [{ id, title, src, ratio(가로/세로, 이미지 없을 때), ... }]
// opts.onOpen(item) — 12시 작품을 열 때 (선택된 작품 클릭 · Enter)
// opts.onSettle(item) — 회전이 멈춰 12시 작품이 정해졌을 때 (주소에 남기기 등)
function createRing(root, opts = {}) {
  const layer = root.querySelector(".ring-items");
  const dial = root.querySelector(".ring-dial");
  const dialRot = dial.querySelector(".dl-rot");
  const dialDots = dial.querySelector(".dl-dots");
  const dialLine = dial.querySelector(".dl-line");
  const count = root.querySelector(".ring-count");

  const hintArrow = dial.querySelector(".dl-arrow");
  const hintText = root.querySelector(".ring-hint");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let items = [];
  let rot = 0;
  // 움직임 상태: idle(정지) · drag(잡고 돌리는 중) · coast(관성) · snap(12시로 맞추는 중)
  let mode = "idle", vel = 0, target = 0;
  // 다시 배치(필터 · 탭 변경): 남는 항목은 이전 각도 → 새 각도, 새 항목은 나타나고 빠진 항목은 사라짐
  let morph = null;   // { t: 0~1, leaving: [요소] }
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
    it.k = -1;   // 크기가 바뀌었으니 다음 그리기에서 확대 · 제목 위치를 다시 계산
  }

  // reuse: 이전 항목(id → 항목). 같은 id는 화면의 요소를 그대로 이어 쓴다 (다시 배치될 때 제자리에서 움직이도록)
  function build(list, reuse = new Map()) {
    items = list.map((data) => {
      const prev = reuse.get(data.id);
      if (prev) { reuse.delete(data.id); return prev; }
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
          if (img.naturalWidth && img.naturalHeight) { it.ratio = img.naturalWidth / img.naturalHeight; sizeThumb(it); draw(); }
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
      // 선택 상태일 때만 보이는 제목(위) · 정보(아래): 연도 · 기법 태그 · 한 줄 설명
      const titleEl = document.createElement("p");
      titleEl.className = "ri-title";
      titleEl.textContent = data.title;
      const infoEl = document.createElement("div");
      infoEl.className = "ri-info";
      const meta = document.createElement("div");
      meta.className = "ri-meta";
      if (data.year) meta.append(Object.assign(document.createElement("span"), { className: "ri-year", textContent: data.year }));
      (data.tags || []).forEach((t) => meta.append(Object.assign(document.createElement("span"), { className: "tag", textContent: t })));
      infoEl.append(meta);
      if (data.desc) infoEl.append(Object.assign(document.createElement("p"), { className: "ri-desc", textContent: data.desc }));
      el.append(thumbEl, titleEl, infoEl);   // 원에 붙이는 것은 setItems (새 항목인지 구분)
      const it = { ...data, el, thumbEl, titleEl, infoEl, z: -1, k: -1 };
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
    // 12시 작품 아래 정보가 가운데 다이얼 · 안내 화살표에 닿지 않을 만큼은 반지름을 확보
    const minR = (g.thumb * g.sel) / 2 + RING.infoSpace + dialR(want) + RING.hintGap + 4;
    let r = Math.max(want, minR);
    while (r > 40 && topNeed + r + belowCenter(r) > g.h) r -= 4;
    g.r = Math.max(40, r);
    // 원 중심: 가운데(모바일은 조금 아래), 단 12시 작품 · 제목이 위로 넘치지 않고 다이얼이 아래로 넘치지 않게
    const ideal = g.h / 2 + (g.mobile ? g.h * RING.mobileDrop : 0);
    g.cx = g.w / 2;
    g.cy = Math.min(Math.max(ideal, topNeed + g.r), g.h - belowCenter(g.r));

    // 다이얼
    const dr = dialR(g.r);
    dialLine.setAttribute("y2", -dr * RING.dialLine);
    // 첫 방문 안내: 다이얼 바깥 오른쪽 위로 시계 방향 곡선 화살표 (메인 레버와 같은 표현)
    const ha = dr + RING.hintGap, a0 = -0.95, a1 = -0.15;
    const px = (a) => (ha * Math.sin(a)).toFixed(1), py = (a) => (-ha * Math.cos(a)).toFixed(1);
    const tip = [ha * Math.sin(a1), -ha * Math.cos(a1)], tan = [Math.cos(a1), Math.sin(a1)], nrm = [Math.sin(a1), -Math.cos(a1)];
    const wing = (s) => `${(tip[0] - tan[0] * 6 + nrm[0] * 4 * s).toFixed(1)} ${(tip[1] - tan[1] * 6 + nrm[1] * 4 * s).toFixed(1)}`;
    hintArrow.setAttribute("d", `M${px(a0)} ${py(a0)} A${ha} ${ha} 0 0 1 ${px(a1)} ${py(a1)} M${wing(1)} L${px(a1)} ${py(a1)} L${wing(-1)}`);
    const hbox = ha + 8;
    dial.setAttribute("width", hbox * 2);
    dial.setAttribute("height", hbox * 2);
    dial.setAttribute("viewBox", `${-hbox} ${-hbox} ${hbox * 2} ${hbox * 2}`);
    dial.style.transform = `translate(${g.cx - hbox}px, ${g.cy - hbox}px)`;
    const step = TAU / Math.max(1, items.length);
    [...dialDots.children].forEach((c, i) => {
      c.setAttribute("cx", (dr * Math.sin(i * step)).toFixed(2));
      c.setAttribute("cy", (-dr * Math.cos(i * step)).toFixed(2));
    });
    count.style.transform = `translate(${g.cx}px, ${g.cy + dr + 14}px) translateX(-50%)`;
    hintText.style.transform = `translate(${g.cx}px, ${g.cy + dr + 36}px) translateX(-50%)`;

    items.forEach(sizeThumb);
    draw();
  }

  // 한 장면 그리기: 위치 · 쌓임 순서 · 다이얼 회전
  function draw() {
    const n = items.length;
    if (!n) return;
    const step = TAU / n;
    const range = Math.min(step, RING.selRange);
    for (let i = 0; i < n; i++) {
      const it = items[i];
      let a = i * step + rot;
      if (morph && it.fromA != null) a = it.fromA + wrapAngle(a - it.fromA) * morph.e;
      const d = Math.abs(wrapAngle(a));
      const x = g.cx + g.r * Math.sin(a);
      const y = g.cy - g.r * Math.cos(a);
      it.el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
      // 12시에 가까울수록 위에 (겹칠 때). 바뀔 때만 쓴다
      const z = 1000 - Math.round(d * 300);
      if (z !== it.z) { it.el.style.zIndex = z; it.z = z; }

      // 선택 정도 k (0~1): 12시에서 멀어지는 각도에 따라 연속으로 (계단식 아님)
      const k = smooth(1 - d / range);
      if (k === it.k) continue;          // 선택 범위 밖에서 계속 0이면 건드리지 않음
      it.k = k;
      // 12시에 맞춰진 작품: 누르면 열린다는 표시 (커서)
      const on = k > 0.98;
      if (on !== it.on) { it.on = on; it.el.classList.toggle("is-sel", on); }
      const s = 1 + (g.sel - 1) * k;
      it.thumbEl.style.transform = k ? `scale(${s.toFixed(4)})` : "";
      // 제목 · 정보는 선택 범위 끝 쪽에서는 보이지 않다가 12시에 가까워질수록 나타남
      const t = smooth((k - RING.textFrom) / (1 - RING.textFrom));
      const half = (it.th * s) / 2 + RING.textGap;
      it.titleEl.style.opacity = t;
      it.infoEl.style.opacity = t;
      it.titleEl.style.visibility = it.infoEl.style.visibility = t > 0 ? "visible" : "hidden";
      if (t > 0) {
        it.titleEl.style.transform = `translate(-50%, ${(-half).toFixed(2)}px) translateY(-100%)`;
        it.infoEl.style.transform = `translate(-50%, ${half.toFixed(2)}px)`;
      }
    }
    if (morph) {
      for (const it of items) if (it.entering) it.el.style.opacity = morph.e.toFixed(3);
      for (const el of morph.leaving) el.style.opacity = (1 - morph.e).toFixed(3);
    }
    // 다이얼 직선 · 눈금은 원 전체의 회전 각도를 그대로 따라 돈다
    dialRot.style.transform = `rotate(${rot.toFixed(4)}rad)`;
    const label = `${String(selected() + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`;
    if (label !== count.textContent) count.textContent = label;
  }

  // ---------- 움직임: requestAnimationFrame 루프 하나 (멈추면 루프도 멈춤) ----------
  let raf = 0, last = 0;
  function kick() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (morph) {
      morph.t = Math.min(1, morph.t + (dt * 1000) / RING.morphMs);
      morph.e = easeInOut(morph.t);
      if (morph.t >= 1) { finishMorph(); settled(); }
    }
    if (mode === "coast") {
      // 관성: 놓은 속도로 돌다가 마찰로 감속, 충분히 느려지면 스냅으로
      rot += vel * dt;
      vel *= Math.exp(-RING.friction * dt);
      if (Math.abs(vel) < RING.snapSpeed) startSnap();
    }
    if (mode === "snap") {
      // 임계 감쇠 스프링으로 목표 각도에 부드럽게 맞춤 (관성 속도를 이어받아 끊기지 않음)
      const d = target - rot;
      vel += (RING.spring * d - 2 * Math.sqrt(RING.spring) * vel) * dt;
      rot += vel * dt;
      // 0.0005rad ≈ 원 위 0.1px — 눈에 보이지 않는 꼬리는 기다리지 않고 맞춘다
      if (Math.abs(d) < 5e-4 && Math.abs(vel) < 5e-3) { rot = target; vel = 0; mode = "idle"; settled(); }
    }
    draw();
    if (mode === "coast" || mode === "snap" || morph) raf = requestAnimationFrame(tick);
  }
  function finishMorph() {
    if (!morph) return;
    for (const el of morph.leaving) el.remove();
    for (const it of items) { it.fromA = null; if (it.entering) { it.entering = false; it.el.style.opacity = ""; } }
    morph = null;
    draw();
  }
  // 가장 가까운 작품이 12시에 오는 각도로
  function startSnap() {
    const step = TAU / Math.max(1, items.length);
    target = Math.round(rot / step) * step;
    snapTo(target);
  }
  // 목표 각도로 스냅 (움직임 줄이기면 바로)
  function snapTo(t) {
    target = t;
    if (reducedMotion) { rot = target; vel = 0; mode = "idle"; draw(); settled(); return; }
    mode = "snap";
    kick();
  }
  // i번 작품이 12시에 오도록 가장 짧은 방향으로
  function goTo(i) {
    const step = TAU / Math.max(1, items.length);
    snapTo(rot + wrapAngle(-i * step - rot));
  }
  // 한 칸씩 (dir +1 = 다음 작품). 이어서 누르면 목표에 쌓인다
  function stepBy(dir) {
    if (!items.length) return;
    const step = TAU / items.length;
    const base = mode === "snap" ? target : Math.round(rot / step) * step;
    seenHint();
    snapTo(base - dir * step);
  }
  function settled() {
    const i = selected();
    if (i >= 0 && opts.onSettle) opts.onSettle(items[i], i);
  }
  // 12시에 (거의) 정확히 와 있는 작품만 '선택됨'으로 열 수 있다
  function isSettledAt(i) {
    const step = TAU / Math.max(1, items.length);
    return i === selected() && Math.abs(wrapAngle(i * step + rot)) < step * 0.25;
  }
  function open(i) {
    if (opts.onOpen) opts.onOpen(items[i], i);
  }

  // ---------- 잡고 돌리기: 원형 영역 어디든 (다이얼 · 썸네일 · 빈 곳), 마우스 · 손가락 공통 ----------
  // 회전량 = 원 중심 기준으로 포인터가 움직인 각도 변화 (atan2)
  let drag = null;
  const pointerAngle = (e) => {
    const rect = root.getBoundingClientRect();
    const x = e.clientX - rect.left - g.cx, y = e.clientY - rect.top - g.cy;
    // 12시 = 0, 시계 방향 + (rot과 같은 기준)
    return { a: Math.atan2(x, -y), d: Math.hypot(x, y) };
  };
  root.addEventListener("pointerdown", (e) => {
    if (drag || !items.length || (e.pointerType === "mouse" && e.button !== 0)) return;
    finishMorph();
    const p = pointerAngle(e);
    const hitEl = e.target.closest(".ring-item");
    drag = {
      id: e.pointerId, a: p.a, samples: [{ t: e.timeStamp, rot }],
      x0: e.clientX, y0: e.clientY, t0: e.timeStamp, moved: 0,
      hit: hitEl ? items.findIndex((it) => it.el === hitEl) : -1,
    };
    mode = "drag";
    vel = 0;
    root.setPointerCapture(e.pointerId);
    root.classList.add("dragging");
    seenHint();
  });
  root.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0));
    const p = pointerAngle(e);
    // 중심 가까이에서는 작은 움직임에도 각도가 크게 튀므로 기준 각도만 갱신
    if (p.d > RING.deadZone) rot += wrapAngle(p.a - drag.a);
    drag.a = p.a;
    drag.samples.push({ t: e.timeStamp, rot });
    while (drag.samples.length > 2 && e.timeStamp - drag.samples[0].t > RING.velWindow) drag.samples.shift();
    kick();
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    // 클릭: 조금만 움직이고 짧게 눌렀다 뗌 → 선택된 작품이면 열기, 아니면 그 작품을 12시로
    if (e.type === "pointerup" && drag.moved < RING.clickMove && e.timeStamp - drag.t0 < RING.clickMs) {
      const hit = drag.hit;
      drag = null;
      root.classList.remove("dragging");
      if (hit < 0) startSnap();
      else if (isSettledAt(hit)) { startSnap(); open(hit); }
      else goTo(hit);
      return;
    }
    // 놓는 순간의 회전 속도 (최근 구간). 멈췄다 놓았으면 0
    const s = drag.samples, first = s[0], lastS = s[s.length - 1];
    const span = (lastS.t - first.t) / 1000;
    const idle = e.timeStamp - lastS.t > RING.velWindow;
    vel = !idle && span > 0.008 ? (lastS.rot - first.rot) / span : 0;
    vel = Math.max(-RING.maxVel, Math.min(RING.maxVel, vel));
    drag = null;
    root.classList.remove("dragging");
    if (reducedMotion || Math.abs(vel) < RING.snapSpeed) startSnap();
    else { mode = "coast"; kick(); }
  }
  root.addEventListener("pointerup", endDrag);
  root.addEventListener("pointercancel", endDrag);

  // ---------- 휠 · 키보드: 한 칸씩 ----------
  let wheelAcc = 0, wheelAt = 0;
  root.addEventListener("wheel", (e) => {
    if (!items.length || e.ctrlKey) return;          // ctrl + 휠(확대)은 브라우저에 맡김
    e.preventDefault();
    const px = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? innerHeight : 1;
    if (e.timeStamp - wheelAt > 200) wheelAcc = 0;   // 잠시 멈췄다 다시 굴리면 새로 셈
    wheelAt = e.timeStamp;
    const d = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * px;
    // 마우스 휠 한 눈금(큰 값) = 한 칸, 트랙패드의 잔 움직임은 모아서 한 칸
    if (Math.abs(d) >= RING.wheelStep) { wheelAcc = 0; stepBy(Math.sign(d)); return; }
    wheelAcc += d;
    while (Math.abs(wheelAcc) >= RING.wheelStep) {
      const dir = Math.sign(wheelAcc);
      wheelAcc -= dir * RING.wheelStep;
      stepBy(dir);
    }
  }, { passive: false });
  root.addEventListener("keydown", (e) => {
    if (!items.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") stepBy(1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") stepBy(-1);
    else if (e.key === "Enter") { const i = selected(); if (isSettledAt(i)) open(i); else goTo(i); }
    else return;
    e.preventDefault();
  });

  // ---------- 첫 방문 안내: "돌려서 둘러보기" + 곡선 화살표, 첫 조작 뒤 사라짐 (브라우저에 기억) ----------
  const HINT_KEY = "workRingHintSeen";
  let hintSeen = false;
  try { hintSeen = localStorage.getItem(HINT_KEY) === "1"; } catch (_) {}
  root.classList.toggle("hinted", hintSeen);
  function seenHint() {
    if (hintSeen) return;
    hintSeen = true;
    root.classList.add("hinted");
    try { localStorage.setItem(HINT_KEY, "1"); } catch (_) {}
  }

  // 12시에 가장 가까운 작품 번호
  function selected() {
    const n = items.length;
    if (!n) return -1;
    return ((Math.round(-rot / (TAU / n)) % n) + n) % n;
  }

  // animate: 지금 보이는 원에서 새 항목 수의 원으로 부드럽게 다시 배치 (필터 · 탭 변경)
  function setItems(list, startIndex = 0, { animate = false } = {}) {
    finishMorph();
    const prevN = items.length;
    const canMorph = animate && !reducedMotion && prevN > 0 && list.length > 0 && !root.hidden;
    const reuse = new Map();
    if (canMorph) items.forEach((it, i) => { it.fromA = i * (TAU / prevN) + rot; reuse.set(it.id, it); });
    else layer.textContent = "";
    build(list, reuse);
    // 남은 이전 항목 = 빠지는 항목
    const leaving = [...reuse.values()].map((it) => it.el);
    for (const it of items) if (canMorph && !it.el.isConnected) { it.entering = true; it.el.style.opacity = "0"; }
    for (const it of items) if (!it.el.isConnected) layer.append(it.el);
    rot = list.length ? -startIndex * (TAU / list.length) : 0;
    mode = "idle";
    vel = 0;
    root.hidden = !list.length;
    if (canMorph) { morph = { t: 0, e: 0, leaving }; kick(); }
    else leaving.forEach((el) => el.remove());
    layout();
  }

  addEventListener("resize", layout);
  return { setItems, layout, selected, goTo, current: () => items[selected()] };
}
