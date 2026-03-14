const dish = document.getElementById("dish");
const statusText = document.getElementById("statusText");
const activeSpecies = document.getElementById("activeSpecies");
const growthRateEl = document.getElementById("growthRate");
const colonyCountEl = document.getElementById("colonyCount");
const resetBtn = document.getElementById("resetBtn");
const controls = document.querySelectorAll(".control");
const speedInput = document.querySelector('[data-control="speed"] input');
const growthChart = document.getElementById("growthChart");
const spikeLog = document.getElementById("spikeLog");

let colonyCount = 0;
let active = null;
let growthTimer = null;
const baseInterval = 900;
const baseSpeed = 2;
let tick = 0;
let history = [];
let lastCount = 0;

const baseProfiles = {
  "Escherichia coli": { optimal: 37, ph: 7, oxygen: 18, nutrient: 70 },
  "Staphylococcus aureus": { optimal: 35, ph: 7.2, oxygen: 16, nutrient: 65 },
  "Saccharomyces cerevisiae": { optimal: 30, ph: 5.5, oxygen: 12, nutrient: 75 },
  Penicillium: { optimal: 25, ph: 6.5, oxygen: 14, nutrient: 60 },
  "Bacillus subtilis": { optimal: 33, ph: 7.5, oxygen: 19, nutrient: 55 },
  "Salmonella enterica": { optimal: 37, ph: 7, oxygen: 18, nutrient: 68 },
  "Pseudomonas aeruginosa": { optimal: 34, ph: 7.1, oxygen: 17, nutrient: 62 },
  "Lactobacillus acidophilus": { optimal: 37, ph: 5.8, oxygen: 6, nutrient: 72 },
  "Candida albicans": { optimal: 32, ph: 6.4, oxygen: 12, nutrient: 70 },
  "Deinococcus radiodurans": { optimal: 30, ph: 7.2, oxygen: 15, nutrient: 55 },
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

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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
  const nutrientScore = values.nutrient / 100;
  const humidityScore = values.humidity / 100;
  const radiationPenalty = values.radiation / 200;
  const antibioticPenalty = values.antibiotic / 50;

  const raw =
    tempScore * 0.25 +
    phScore * 0.2 +
    oxygenScore * 0.15 +
    nutrientScore * 0.2 +
    humidityScore * 0.2;

  const penalty = (radiationPenalty + antibioticPenalty) * 0.6;
  return clamp(raw - penalty, 0, 1);
};

const updateReadout = () => {
  if (!active) {
    growthRateEl.textContent = "0.0";
    return;
  }
  const values = getControlValues();
  const growth = computeGrowth(values, baseProfiles[active]);
  growthRateEl.textContent = growth.toFixed(2);
};

const getSpeedMultiplier = () => {
  if (!speedInput) return baseSpeed;
  return parseFloat(speedInput.value) * baseSpeed;
};

const findSpawnPosition = (size) => {
  const radius = dish.clientWidth / 2 - size / 2 - 10;
  const clusterRadius = radius * 0.45;
  const colonies = Array.from(dish.querySelectorAll(".colony"));
  const maxAttempts = 14;

  for (let i = 0; i < maxAttempts; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * clusterRadius;
    const x = radius + distance * Math.cos(angle);
    const y = radius + distance * Math.sin(angle);

    const fits = colonies.every((colony) => {
      const otherSize = parseFloat(colony.dataset.size || "20");
      const dx = x - parseFloat(colony.dataset.x || "0");
      const dy = y - parseFloat(colony.dataset.y || "0");
      const minDistance = (size + otherSize) * 0.5 * 0.9;
      return Math.hypot(dx, dy) > minDistance;
    });

    if (fits) {
      return { x, y };
    }
  }

  const angle = Math.random() * Math.PI * 2;
  const distance = Math.sqrt(Math.random()) * clusterRadius;
  return {
    x: radius + distance * Math.cos(angle),
    y: radius + distance * Math.sin(angle),
  };
};

const spawnColony = () => {
  if (!active) return;
  const colony = document.createElement("div");
  const profile = colonyProfiles[active];
  colony.className = `colony ${profile.className}`;
  const size = profile.size;
  const { x, y } = findSpawnPosition(size);
  colony.style.left = `${x}px`;
  colony.style.top = `${y}px`;
  colony.dataset.x = x.toString();
  colony.dataset.y = y.toString();
  colony.dataset.size = size.toString();
  dish.appendChild(colony);
  colonyCount += 1;
  colonyCountEl.textContent = colonyCount.toString();
  setTimeout(() => colony.remove(), 16000);
};

const collectSpikeReasons = (values, profile) => {
  const reasons = [];
  if (values.nutrient >= 75) reasons.push("영양 농도 충분");
  if (values.humidity >= 65) reasons.push("높은 습도");
  if (Math.abs(values.temperature - profile.optimal) <= 2) reasons.push("최적 온도 근접");
  if (Math.abs(values.ph - profile.ph) <= 0.4) reasons.push("pH 안정");
  if (values.radiation <= 15) reasons.push("방사선 낮음");
  if (values.antibiotic <= 5) reasons.push("항생제 농도 낮음");
  if (values.oxygen >= profile.oxygen - 2) reasons.push("산소 조건 양호");
  return reasons.slice(0, 3);
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

const startGrowth = () => {
  if (!active) return;
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
  colonyCount = 0;
  colonyCountEl.textContent = "0";
  active = null;
  activeSpecies.textContent = "없음";
  statusText.textContent = "배양 대기";
  growthRateEl.textContent = "0.0";
  tick = 0;
  history = [];
  lastCount = 0;
  if (spikeLog) {
    spikeLog.innerHTML = '<div class="spike-title">스파이크 원인</div><div class="spike-empty">아직 급증 이벤트가 없습니다.</div>';
  }
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

    const ghost = card.cloneNode(true);
    ghost.style.position = "absolute";
    ghost.style.top = "-9999px";
    ghost.style.left = "-9999px";
    ghost.style.opacity = "1";
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
    requestAnimationFrame(() => ghost.remove());
  });

  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
  });
});

dish.addEventListener("dragover", (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  dish.classList.add("drag-over");
});

dish.addEventListener("dragleave", () => {
  dish.classList.remove("drag-over");
});

dish.addEventListener("drop", (event) => {
  event.preventDefault();
  dish.classList.remove("drag-over");
  const species = event.dataTransfer.getData("text/plain");
  if (!species) return;
  active = species;
  activeSpecies.textContent = speciesLabels[species] || species;
  statusText.textContent = "샘플 투입 완료";
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

updateReadout();
drawChart();
