const dish = document.getElementById("dish");
const statusText = document.getElementById("statusText");
const activeSpecies = document.getElementById("activeSpecies");
const growthRateEl = document.getElementById("growthRate");
const colonyCountEl = document.getElementById("colonyCount");
const resetBtn = document.getElementById("resetBtn");
const controls = document.querySelectorAll(".control");

let colonyCount = 0;
let active = null;
let growthTimer = null;

const baseProfiles = {
  "Escherichia coli": { optimal: 37, ph: 7, oxygen: 18, nutrient: 70 },
  "Staphylococcus aureus": { optimal: 35, ph: 7.2, oxygen: 16, nutrient: 65 },
  "Saccharomyces cerevisiae": { optimal: 30, ph: 5.5, oxygen: 12, nutrient: 75 },
  Penicillium: { optimal: 25, ph: 6.5, oxygen: 14, nutrient: 60 },
  "Bacillus subtilis": { optimal: 33, ph: 7.5, oxygen: 19, nutrient: 55 },
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

const spawnColony = () => {
  const colony = document.createElement("div");
  colony.className = "colony";
  const radius = dish.clientWidth / 2 - 30;
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.random() * radius;
  const x = radius + distance * Math.cos(angle);
  const y = radius + distance * Math.sin(angle);
  colony.style.left = `${x}px`;
  colony.style.top = `${y}px`;
  dish.appendChild(colony);
  colonyCount += 1;
  colonyCountEl.textContent = colonyCount.toString();
  setTimeout(() => colony.remove(), 16000);
};

const startGrowth = () => {
  if (!active) return;
  if (growthTimer) clearInterval(growthTimer);
  statusText.textContent = "배양 진행 중";
  growthTimer = setInterval(() => {
    const values = getControlValues();
    const growth = computeGrowth(values, baseProfiles[active]);
    updateReadout();
    if (Math.random() < growth) {
      spawnColony();
    }
  }, 900);
};

const resetDish = () => {
  dish.querySelectorAll(".colony").forEach((node) => node.remove());
  colonyCount = 0;
  colonyCountEl.textContent = "0";
  active = null;
  activeSpecies.textContent = "없음";
  statusText.textContent = "배양 대기";
  growthRateEl.textContent = "0.0";
  if (growthTimer) {
    clearInterval(growthTimer);
    growthTimer = null;
  }
};

document.querySelectorAll(".microbe-card").forEach((card) => {
  card.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", card.dataset.species);
  });
});

dish.addEventListener("dragover", (event) => {
  event.preventDefault();
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
  activeSpecies.textContent = species;
  statusText.textContent = "배양 조건 분석";
  updateReadout();
  startGrowth();
  spawnColony();
});

controls.forEach((control) => {
  const input = control.querySelector("input");
  const value = control.querySelector(".value");
  input.addEventListener("input", () => {
    value.textContent = input.value;
    updateReadout();
  });
});

resetBtn.addEventListener("click", resetDish);

updateReadout();
