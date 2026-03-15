const dish = document.getElementById("dish");
const statusText = document.getElementById("statusText");
const resetBtn = document.getElementById("resetBtn");
const resetControlsBtn = document.getElementById("resetControlsBtn");
const controls = document.querySelectorAll(".control");
const speedInput = document.querySelector('[data-control="speed"] input');
const growthChart = document.getElementById("growthChart");
const spikeLog = document.getElementById("spikeLog");
const readoutPanel = document.querySelector(".readout");
const readoutDefault = readoutPanel ? readoutPanel.innerHTML : "";
const disinfectionList = document.getElementById("disinfectionList");
const disinfectionCursor = document.getElementById("disinfectionCursor");
const disinfectionCursorLabel = document.getElementById("disinfectionCursorLabel");

let activeSpecies = document.getElementById("activeSpecies");
let growthRateEl = document.getElementById("growthRate");
let colonyCountEl = document.getElementById("colonyCount");

let colonyCount = 0;
let active = null;
let growthTimer = null;
const baseInterval = 900;
const baseSpeed = 2;
let tick = 0;
let history = [];
let lastCount = 0;
let inoculationPoint = null;
let isHalted = false;
let selectedDisinfection = "";
let isDisinfecting = false;
let disinfectionZones = [];
const disinfectionDuration = 10000;
const disinfectionRadius = 42;

const baseProfiles = {
  "Escherichia coli": { optimal: 37, ph: 7, oxygen: 18, co2: 5, nutrient: 70 },
  "Staphylococcus aureus": { optimal: 35, ph: 7.2, oxygen: 16, co2: 4, nutrient: 65 },
  "Saccharomyces cerevisiae": { optimal: 30, ph: 5.5, oxygen: 12, co2: 6, nutrient: 75 },
  Penicillium: { optimal: 25, ph: 6.5, oxygen: 14, co2: 5, nutrient: 60 },
  "Bacillus subtilis": { optimal: 33, ph: 7.5, oxygen: 19, co2: 4.5, nutrient: 55 },
  "Salmonella enterica": { optimal: 37, ph: 7, oxygen: 18, co2: 5, nutrient: 68 },
  "Pseudomonas aeruginosa": { optimal: 34, ph: 7.1, oxygen: 17, co2: 4.5, nutrient: 62 },
  "Lactobacillus acidophilus": { optimal: 37, ph: 5.8, oxygen: 6, co2: 7, nutrient: 72 },
  "Candida albicans": { optimal: 32, ph: 6.4, oxygen: 12, co2: 6, nutrient: 70 },
  "Deinococcus radiodurans": { optimal: 30, ph: 7.2, oxygen: 15, co2: 4, nutrient: 55 },
};

const colonyProfiles = {
  "Escherichia coli": { className: "ecoli", size: 26 },
  "Staphylococcus aureus": { className: "staph", size: 28 },
  "Saccharomyces cerevisiae": { className: "yeast", size: 22 },
  Penicillium: { className: "penicillium", size: 28 },
  "Bacillus subtilis": { className: "bacillus", size: 28 },
  "Salmonella enterica": { className: "salmonella", size: 26 },
  "Pseudomonas aeruginosa": { className: "pseudomonas", size: 24 },
  "Lactobacillus acidophilus": { className: "lactobacillus", size: 30 },
  "Candida albicans": { className: "candida", size: 20 },
  "Deinococcus radiodurans": { className: "deinococcus", size: 28 },
};

const speciesLabels = {
  "Escherichia coli": "에셔리키아 대장균",
  "Staphylococcus aureus": "황색포도상구균",
  "Saccharomyces cerevisiae": "맥주효모",
  Penicillium: "페니실리움",
  "Bacillus subtilis": "고초균",
  "Salmonella enterica": "살모넬라",
  "Pseudomonas aeruginosa": "녹농균",
  "Lactobacillus acidophilus": "아시도필루스 유산균",
  "Candida albicans": "칸디다",
  "Deinococcus radiodurans": "데이노코쿠스",
};

const spreadProfiles = {
  "Escherichia coli": { mode: "radial", growth: 0.6 },
  "Staphylococcus aureus": { mode: "scatter", growth: 0.5 },
  "Saccharomyces cerevisiae": { mode: "radial", growth: 0.35 },
  Penicillium: { mode: "radial", growth: 0.9 },
  "Bacillus subtilis": { mode: "radial", growth: 0.55 },
  "Salmonella enterica": { mode: "radial", growth: 0.6 },
  "Pseudomonas aeruginosa": { mode: "radial", growth: 0.5 },
  "Lactobacillus acidophilus": { mode: "radial", growth: 0.4 },
  "Candida albicans": { mode: "radial", growth: 0.35 },
  "Deinococcus radiodurans": { mode: "scatter", growth: 0.45 },
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const pruneDisinfectionZones = () => {
  const now = Date.now();
  disinfectionZones = disinfectionZones.filter((zone) => {
    const active = zone.expiresAt > now;
    if (!active && zone.el) {
      zone.el.remove();
    }
    return active;
  });
};

const isPointDisinfected = (x, y) => {
  pruneDisinfectionZones();
  return disinfectionZones.some((zone) => Math.hypot(x - zone.x, y - zone.y) <= zone.radius);
};

const getControlValues = () => {
  const values = {};
  controls.forEach((control) => {
    const key = control.dataset.control;
    const input = control.querySelector("input");
    values[key] = parseFloat(input.value);
  });
  return values;
};

const computeGrowth = (values, profile) => {
  const tempScore = 1 - Math.abs(values.temperature - profile.optimal) / 20;
  const phScore = 1 - Math.abs(values.ph - profile.ph) / 5;
  const oxygenScore = 1 - Math.abs(values.oxygen - profile.oxygen) / 20;
  const co2Score = 1 - Math.abs(values.co2 - profile.co2) / 10;
  const nutrientScore = values.nutrient / 100;
  const humidityScore = values.humidity / 100;
  const radiationPenalty = values.radiation / 200;
  const antibioticPenalty = values.antibiotic / 50;

  const raw =
    tempScore * 0.22 +
    phScore * 0.18 +
    oxygenScore * 0.14 +
    co2Score * 0.12 +
    nutrientScore * 0.18 +
    humidityScore * 0.16;

  const penalty = (radiationPenalty + antibioticPenalty) * 0.6;
  return clamp(raw - penalty, 0, 1);
};

const updateReadout = () => {
  if (!active) {
    growthRateEl.textContent = "0.0";
    return;
  }
  if (isHalted) return;
  const values = getControlValues();
  const growth = computeGrowth(values, baseProfiles[active]);
  growthRateEl.textContent = growth.toFixed(2);
};

const getSpeedMultiplier = () => {
  if (!speedInput) return baseSpeed;
  return parseFloat(speedInput.value) * baseSpeed;
};

const clampToDish = (x, y, radius) => {
  const center = radius;
  const dx = x - center;
  const dy = y - center;
  const distance = Math.hypot(dx, dy);
  if (distance <= radius) return { x, y };
  const ratio = radius / distance;
  return { x: center + dx * ratio, y: center + dy * ratio };
};

const findSpawnPosition = (size) => {
  const radius = dish.clientWidth / 2 - size / 2 - 10;
  const spreadProfile = spreadProfiles[active] || { mode: "radial", growth: 0.6 };
  const baseClusterRadius = radius * 0.55;
  const spreadRadius = Math.min(baseClusterRadius, 14 + colonyCount * spreadProfile.growth);
  const origin =
    spreadProfile.mode === "scatter"
      ? {
          x: Math.random() * radius * 2,
          y: Math.random() * radius * 2,
        }
      : inoculationPoint || { x: radius, y: radius };
  const colonies = Array.from(dish.querySelectorAll(".colony"));
  const maxAttempts = 14;

  for (let i = 0; i < maxAttempts; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * spreadRadius;
    const x = origin.x + distance * Math.cos(angle);
    const y = origin.y + distance * Math.sin(angle);
    const clamped = clampToDish(x, y, radius);
    if (isPointDisinfected(clamped.x, clamped.y)) {
      continue;
    }

    const fits = colonies.every((colony) => {
      const otherSize = parseFloat(colony.dataset.size || "20");
      const dx = clamped.x - parseFloat(colony.dataset.x || "0");
      const dy = clamped.y - parseFloat(colony.dataset.y || "0");
      const minDistance = (size + otherSize) * 0.5 * 0.9;
      return Math.hypot(dx, dy) > minDistance;
    });

    if (fits) {
      return { x: clamped.x, y: clamped.y };
    }
  }

  const angle = Math.random() * Math.PI * 2;
  const distance = Math.sqrt(Math.random()) * spreadRadius;
  const fallback = {
    x: origin.x + distance * Math.cos(angle),
    y: origin.y + distance * Math.sin(angle),
  };
  const clampedFallback = clampToDish(fallback.x, fallback.y, radius);
  if (isPointDisinfected(clampedFallback.x, clampedFallback.y)) {
    return null;
  }
  return clampedFallback;
};

const buildDragIcon = (imageEl) => {
  const size = 44;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(12, 18, 20, 0.9)";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  if (imageEl && imageEl.complete) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(imageEl, 2, 2, size - 4, size - 4);
    ctx.restore();
  }
  ctx.strokeStyle = "rgba(125, 211, 199, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.stroke();
  return canvas;
};

const spawnColony = () => {
  if (!active) return;
  const colony = document.createElement("div");
  const profile = colonyProfiles[active];
  colony.className = `colony ${profile.className}`;
  const size = profile.size;
  const position = findSpawnPosition(size);
  if (!position) return;
  const { x, y } = position;
  colony.style.left = `${x}px`;
  colony.style.top = `${y}px`;
  colony.dataset.x = x.toString();
  colony.dataset.y = y.toString();
  colony.dataset.size = size.toString();
  dish.appendChild(colony);
  colonyCount += 1;
  colonyCountEl.textContent = colonyCount.toString();
};

const collectSpikeReasons = (values, profile) => {
  const reasons = [];
  if (values.nutrient >= 75) reasons.push("영양 농도 충분");
  if (values.humidity >= 65) reasons.push("높은 습도");
  if (Math.abs(values.temperature - profile.optimal) <= 2) reasons.push("최적 온도 근접");
  if (Math.abs(values.ph - profile.ph) <= 0.4) reasons.push("pH 안정");
  if (Math.abs(values.co2 - profile.co2) <= 1) reasons.push("이산화탄소 조건 양호");
  if (values.radiation <= 15) reasons.push("방사선 낮음");
  if (values.antibiotic <= 5) reasons.push("항생제 농도 낮음");
  if (values.oxygen >= profile.oxygen - 2) reasons.push("산소 조건 양호");
  return reasons.slice(0, 3);
};

const refreshReadoutElements = () => {
  activeSpecies = document.getElementById("activeSpecies");
  growthRateEl = document.getElementById("growthRate");
  colonyCountEl = document.getElementById("colonyCount");
};

const updateSpikeLog = (message, reasons) => {
  const empty = spikeLog.querySelector(".spike-empty");
  if (empty) empty.remove();
  const item = document.createElement("div");
  item.className = "spike-item";
  item.innerHTML = `<span>${message}</span><span>${reasons.join(", ")}</span>`;
  spikeLog.appendChild(item);
  const items = spikeLog.querySelectorAll(".spike-item");
  if (items.length > 4) items[0].remove();
};


const drawChart = () => {
  if (!growthChart) return;
  const ctx = growthChart.getContext("2d");
  const width = growthChart.width;
  const height = growthChart.height;
  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(125, 211, 199, 0.2)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i += 1) {
    const y = (height / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  if (history.length < 2) return;
  const maxValue = Math.max(...history.map((point) => point.count), 5);
  ctx.strokeStyle = "rgba(125, 211, 199, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  history.forEach((point, index) => {
    const x = (width / (history.length - 1)) * index;
    const y = height - (point.count / maxValue) * (height - 12) - 6;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
};

function haltGrowth(message) {
  isHalted = true;
  statusText.textContent = "증식 중지";
  if (growthTimer) {
    clearInterval(growthTimer);
    growthTimer = null;
  }
  if (readoutPanel) {
    readoutPanel.innerHTML = `<div class="readout-alert">${message}</div>`;
  }
}

const startGrowth = () => {
  if (!active) return;
  if (isHalted) return;
  if (growthTimer) clearInterval(growthTimer);
  statusText.textContent = "배양 진행 중";
  const speedMultiplier = getSpeedMultiplier();
  const interval = Math.max(80, baseInterval / speedMultiplier);
  growthTimer = setInterval(() => {
    const values = getControlValues();
    const growth = computeGrowth(values, baseProfiles[active]);
    updateReadout();
    if (Math.random() < growth) {
      spawnColony();
    }
    if (colonyCount > 300) {
      haltGrowth("집락 수 300개 초과로 증식을 중지했습니다.");
      return;
    }
    const delta = colonyCount - lastCount;
    tick += 1;
    history.push({ tick, count: colonyCount });
    if (history.length > 40) history.shift();
    if (delta >= 3) {
      const reasons = collectSpikeReasons(values, baseProfiles[active]);
      if (reasons.length) {
        updateSpikeLog(`t+${tick}s 급증`, reasons);
      }
    }
    lastCount = colonyCount;
    drawChart();
  }, interval);
};

const resetDish = () => {
  dish.querySelectorAll(".colony").forEach((node) => node.remove());
  dish.querySelectorAll(".disinfection-zone").forEach((node) => node.remove());
  colonyCount = 0;
  if (colonyCountEl) colonyCountEl.textContent = "0";
  active = null;
  if (activeSpecies) activeSpecies.textContent = "없음";
  statusText.textContent = "배양 대기";
  if (growthRateEl) growthRateEl.textContent = "0.0";
  tick = 0;
  history = [];
  lastCount = 0;
  inoculationPoint = null;
  isHalted = false;
  if (readoutPanel && readoutDefault) {
    readoutPanel.innerHTML = readoutDefault;
    refreshReadoutElements();
  }
  if (spikeLog) {
    spikeLog.innerHTML = '<div class="spike-title">스파이크 원인</div><div class="spike-empty">아직 급증 이벤트가 없습니다.</div>';
  }
  if (disinfectionList) {
    disinfectionList.querySelectorAll(".disinfection-item").forEach((button) => {
      button.classList.remove("is-active");
      button.setAttribute("aria-pressed", "false");
    });
  }
  selectedDisinfection = "";
  isDisinfecting = false;
  disinfectionZones = [];
  document.body.classList.remove("disinfecting-active");
  if (disinfectionCursor) disinfectionCursor.classList.remove("is-active");
  drawChart();
  if (growthTimer) {
    clearInterval(growthTimer);
    growthTimer = null;
  }
};

document.querySelectorAll(".microbe-card").forEach((card) => {
  card.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", card.dataset.species);
    event.dataTransfer.effectAllowed = "move";
    card.classList.add("dragging");
    statusText.textContent = "배지에 접종 위치를 지정하세요";

    const img = card.querySelector("img");
    const icon = buildDragIcon(img);
    icon.style.position = "absolute";
    icon.style.top = "-9999px";
    icon.style.left = "-9999px";
    document.body.appendChild(icon);
    event.dataTransfer.setDragImage(icon, icon.width / 2, icon.height / 2);
    requestAnimationFrame(() => icon.remove());
  });

  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
    if (!active) {
      statusText.textContent = "배양 대기";
    }
  });
});

dish.addEventListener("dragover", (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  dish.classList.add("drag-over");
  if (!active) {
    statusText.textContent = "접종 위치 지정 중";
  }
});

dish.addEventListener("dragleave", () => {
  dish.classList.remove("drag-over");
  if (!active) {
    statusText.textContent = "배양 대기";
  }
});

dish.addEventListener("drop", (event) => {
  event.preventDefault();
  dish.classList.remove("drag-over");
  const species = event.dataTransfer.getData("text/plain");
  if (!species) return;
  if (active) {
    statusText.textContent = "배양 중 - 초기화 필요";
    return;
  }
  const rect = dish.getBoundingClientRect();
  const radius = dish.clientWidth / 2 - 20;
  const rawX = event.clientX - rect.left;
  const rawY = event.clientY - rect.top;
  inoculationPoint = clampToDish(rawX, rawY, radius);
  active = species;
  activeSpecies.textContent = speciesLabels[species] || species;
  statusText.textContent = "접종 완료";
  updateReadout();
  startGrowth();
  spawnColony();
});

controls.forEach((control) => {
  const input = control.querySelector("input");
  const value = control.querySelector(".value");
  input.addEventListener("input", () => {
    if (control.dataset.control === "speed") {
      value.textContent = `${input.value}x`;
      startGrowth();
    } else {
      value.textContent = input.value;
    }
    updateReadout();
  });
});

resetBtn.addEventListener("click", resetDish);

if (resetControlsBtn) {
  resetControlsBtn.addEventListener("click", () => {
    controls.forEach((control) => {
      const input = control.querySelector("input");
      const value = control.querySelector(".value");
      input.value = input.defaultValue;
      if (control.dataset.control === "speed") {
        value.textContent = `${input.value}x`;
      } else {
        value.textContent = input.value;
      }
    });
    updateReadout();
    if (active && !isHalted) {
      startGrowth();
    }
  });
}

if (disinfectionList) {
  disinfectionList.querySelectorAll(".disinfection-item").forEach((item) => {
    item.addEventListener("click", () => {
      const nextState = item.getAttribute("aria-pressed") !== "true";
      disinfectionList.querySelectorAll(".disinfection-item").forEach((button) => {
        button.classList.remove("is-active");
        button.setAttribute("aria-pressed", "false");
      });
      if (nextState) {
        item.classList.add("is-active");
        item.setAttribute("aria-pressed", "true");
        selectedDisinfection = item.textContent.trim();
        if (disinfectionCursorLabel) {
          disinfectionCursorLabel.textContent = selectedDisinfection;
        }
        if (disinfectionCursor) {
          disinfectionCursor.classList.add("is-active");
        }
        document.body.classList.add("disinfecting-active");
      }
      if (!nextState) {
        selectedDisinfection = "";
        if (disinfectionCursor) disinfectionCursor.classList.remove("is-active");
        document.body.classList.remove("disinfecting-active");
      }
    });
  });
}

const updateDisinfectionCursor = (event) => {
  if (!disinfectionCursor || !selectedDisinfection) return;
  disinfectionCursor.style.left = `${event.clientX}px`;
  disinfectionCursor.style.top = `${event.clientY}px`;
};

const disinfectAt = (event) => {
  if (!selectedDisinfection) return;
  const rect = dish.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
  const colonies = Array.from(dish.querySelectorAll(".colony"));
  const radius = disinfectionRadius;
  let removed = 0;
  colonies.forEach((colony) => {
    const cx = parseFloat(colony.dataset.x || "0");
    const cy = parseFloat(colony.dataset.y || "0");
    if (Math.hypot(x - cx, y - cy) <= radius) {
      colony.remove();
      removed += 1;
    }
  });
  pruneDisinfectionZones();
  const expiresAt = Date.now() + disinfectionDuration;
  disinfectionZones.forEach((zone) => {
    if (Math.hypot(x - zone.x, y - zone.y) <= radius + zone.radius) {
      zone.expiresAt = Math.max(zone.expiresAt, expiresAt);
      if (zone.el) {
        zone.el.style.animationDuration = `${(zone.expiresAt - Date.now()) / 1000}s`;
      }
    }
  });
  const zoneEl = document.createElement("div");
  zoneEl.className = "disinfection-zone";
  zoneEl.style.left = `${x}px`;
  zoneEl.style.top = `${y}px`;
  zoneEl.style.width = `${radius * 2}px`;
  zoneEl.style.height = `${radius * 2}px`;
  zoneEl.style.animationDuration = `${disinfectionDuration / 1000}s`;
  dish.appendChild(zoneEl);
  disinfectionZones.push({
    x,
    y,
    radius,
    expiresAt,
    el: zoneEl,
  });
  if (removed > 0) {
    colonyCount = Math.max(0, colonyCount - removed);
    if (colonyCountEl) colonyCountEl.textContent = colonyCount.toString();
    drawChart();
  }
};

document.addEventListener("mousemove", (event) => {
  updateDisinfectionCursor(event);
  pruneDisinfectionZones();
  if (isDisinfecting) disinfectAt(event);
});

dish.addEventListener("mousedown", (event) => {
  if (!selectedDisinfection) return;
  isDisinfecting = true;
  disinfectAt(event);
});

document.addEventListener("mouseup", () => {
  isDisinfecting = false;
});

updateReadout();
drawChart();
