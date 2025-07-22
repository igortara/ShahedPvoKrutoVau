// Kyiv Defense Game — адаптировано под пользовательскую PNG-карту (4000x2829), CRS.Simple

let money = 5000;
let selectedPVO = null;
let buyingMode = false;
let gameOver = false;
let score = 0;
let nukeLaunched = false;
let gameWon = false;
const PIXEL_TO_METERS = 1;
let currentWave = 0;
let isWaveInProgress = false;
let gameStartTime = 0;
const preMenu = document.getElementById("preMenu");
const startBtn = document.getElementById("startBtn");
const loading = document.getElementById("loading");
const loadingText = document.getElementById("loadingText");
const loadingProgress = document.getElementById("loadingProgress");
const assetsToLoad = [
  "assets/map.png",
  "assets/drone.png",
  "assets/rocket1.png",
  "assets/heavy-drone.png",
  "assets/pvo1.png",
  "assets/pvo3.png",
  "assets/pvo5.png",
  "assets/reb.png"
];
function preloadImages(assetList, onProgress, onComplete) {
  let loaded = 0;

  assetList.forEach(src => {
    const img = new Image();
    img.onload = () => {
      loaded++;
      onProgress(Math.floor((loaded / assetList.length) * 100));
      if (loaded === assetList.length) {
        onComplete();
      }
    };
    img.onerror = () => {
      console.warn(`Та шось не завантажилось 😬 ${src}`);
      loaded++;
      onProgress(Math.floor((loaded / assetList.length) * 100));
      if (loaded === assetList.length) {
        onComplete();
      }
    };
    img.src = src;
  });
}

startBtn.onclick = () => {
  startBtn.disabled = true;
  loading.style.display = "block";

  preloadImages(assetsToLoad, (percent) => {
    loadingText.textContent = `Завентаження: ${percent}%`;
    loadingProgress.style.width = percent + "%";
  }, () => {
    preMenu.style.display = "none";
    initializeMapAndGame(); // после загрузки всех картинок
  });
};



function initializeMapAndGame() {
  gameStartTime = performance.now();

  // 1. Загружаем карту (без игры)
  map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -1.6,
    maxZoom: 4
  });

  const imageBounds = [[0, 0], [2829, 4000]];
  L.imageOverlay("assets/map.png", imageBounds).addTo(map);
  map.fitBounds(imageBounds);

  const paddingTop = 500;
  const paddingLeft = 1000;
  const paddingBottom = 500;
  const paddingRight = 1000;

  const paddedBounds = [
    [-paddingTop, -paddingLeft],
    [2829 + paddingBottom, 4000 + paddingRight]
  ];
  map.setMaxBounds(paddedBounds);



// === Цели ===
function getRandomTargets(arr, count) {
  const shuffled = arr.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
document.getElementById("controlPanel").style.display = "block";

const allDefensePoints = getRandomTargets(allowedSpawnPoints, 5);

const defensePoints = []; // Пусто в начале

function activateDefensePoint(index) {
  const coords = allDefensePoints[index];
  const [lat, lng] = coords;

  // 🎯 Ставим маркер
  const marker = L.marker([lat, lng]).addTo(map).bindPopup("Ціль");

  // 🔴 Добавляем красный круг запрета
  const noBuildCircle = L.circle([lat, lng], {
    radius: 100,
    color: "red",
    fillColor: "#ff4444",
    fillOpacity: 0.2,
    dashArray: "4, 4",
    interactive: false
  }).addTo(map);

  defensePoints.push({
    lat,
    lng,
    marker,
    noBuildCircle, // ⬅️ Сохраняем, если потом понадобится удалить
    alive: true
  });
}



// === ПВО ===
const pvoTypes = [
  { name: "Кулемет", price: 100, radius: 80, damage: 8, cd: 550, img: "assets/pvo1.png" }, 
  { name: "С-300", price: 500, radius: 140, damage: 27, cd: 850, img: "assets/pvo3.png" },
  { name: "Patriot", price: 2500, radius: 240, damage: 55, cd: 1050, img: "assets/pvo5.png" },
  { name: "ЗРК Оса", price: 1300, radius: 160, damage: 40, cd: 850, img: "assets/osa.png" }, 
  { name: "ПЗРК гла", price: 300, radius: 65, damage: 45, cd: 4000, img: "assets/igla.png" }, // ← новый объект
  { name: "РЕБ", price: 800, radius: 100, damage: 0, cd: 0, reb: true, slowFactor: 0.4, img: "assets/reb.png" },
  { name: "THAAD", price: 3000, radius: 300, damage: 340, cd: 2000, img: "assets/thaad.png" },
];
const pvoColorMap = {
  "Кулемет": "#52f752",
  "С-300": "#30c730",
  "Patriot": "#228B22",
  "РЕБ": "#d673fa",
  "THAAD": "#a13c23",
};


const colorMap = {
  50: "#b2ffb2",
  100: "#88ff88",
  150: "#55cc55",
  200: "#33aa33",
  250: "#229922"
};

const menu = document.getElementById("pvoMenu");

const pvoPurchaseCounts = {};

// Создаем кнопку продажи ПВО и добавляем в меню
const sellPVOButton = document.createElement("button");
sellPVOButton.id = "sellPVOButton";
sellPVOButton.textContent = "Продати вибране ППО";
sellPVOButton.disabled = true;
sellPVOButton.style.backgroundColor = "#d64b3c";
sellPVOButton.style.color = "#fff";
sellPVOButton.style.marginTop = "10px";
sellPVOButton.style.borderRadius = "8px"; 
menu.appendChild(sellPVOButton);
// Создаем кнопку улучшения ПВО
const upgradePVOButton = document.createElement("button");
upgradePVOButton.id = "upgradePVOButton";
upgradePVOButton.textContent = "Покращити вибране ППО (💰100)";
upgradePVOButton.disabled = true;
upgradePVOButton.style.backgroundColor = "#5c9143"; 
upgradePVOButton.style.color = "#fff";
upgradePVOButton.style.marginTop = "10px";
upgradePVOButton.style.borderRadius = "8px"; 
menu.appendChild(upgradePVOButton);
menu.style.background = "#181818";
const upgradeInfo = document.createElement("div");
upgradeInfo.id = "upgradeInfo";
upgradeInfo.style.marginTop = "5px";
upgradeInfo.style.color = "gray";
menu.appendChild(upgradeInfo);

upgradePVOButton.onclick = () => {
  if (!selectedPVO) return;
  if (selectedPVO.upgradeCount >= 10) {
  alert("❌ Це ППО покращено вже 10 разів - більше не можна!");
  return;
}


  const baseUpgradeCost = 100; // базовая цена апгрейда
const upgradeCost = baseUpgradeCost * Math.pow(2, selectedPVO.upgradeCount);
if (money < upgradeCost) {
  alert(`Недостатньо коштів для покращення, потрібно: ${upgradeCost} карбованців.`);
  return;
}
money -= upgradeCost;


  // Улучшаем ПВО
  selectedPVO.damage = Math.min(selectedPVO.damage + 2, selectedPVO.damage * 3);
  selectedPVO.radius = Math.min(selectedPVO.radius + 7, selectedPVO.radius * 3);
  selectedPVO.cd = Math.max(selectedPVO.cd - 100, 100);

  selectedPVO.upgradeCount++; // ⬅️ ВАЖНО
  upgradeInfo.textContent = `Покращено: ${selectedPVO.upgradeCount} / 10`;
  updateUpgradeButtonText();
  // Обновляем круг действия
  if (selectedPVO.rangeCircle) {
    selectedPVO.rangeCircle.setRadius(selectedPVO.radius);
    const zoneColor = pvoColorMap[selectedPVO.name] || "#00FF00";
selectedPVO.rangeCircle.setStyle({
  color: zoneColor,
  fillColor: zoneColor,

      fillOpacity: 0.2,
  className: 'no-blur-circle'
    });
  }
  
  updateMoney();
};


pvoTypes.forEach((type) => {
  const div = document.createElement("div");
  div.className = "pvo-item";

  
  div.style.background = "#232323";
  div.style.color = "#fff";
  div.style.border = "1px solid #444";
  div.style.borderRadius = "10px";
  div.style.margin = "8px 0";
  div.style.padding = "8px";
  div.style.display = "flex";
  div.style.flexDirection = "column";
  div.style.alignItems = "center";
  div.style.cursor = "pointer";
  div.style.transition = "background 0.2s";

  div.onmouseenter = () => { div.style.background = "#333"; };
  div.onmouseleave = () => { div.style.background = "#232323"; };

  div.innerHTML = `
    <img src="${type.img}" />
    <b>${type.name}</b><br/>
    💰${type.price}<br/>
    📏${type.radius}
  `;

  div.onclick = () => {
    const count = pvoPurchaseCounts[type.name] ?? 0; // исправлено
    const dynamicPrice = Math.floor(type.price * Math.pow(1.2, count));

    if (money < dynamicPrice) {
      alert(`Недостатньо коштів, потрібно: ${dynamicPrice} карбованців.`);
      return;
    }

    selectedPVO = type;
    buyingMode = true;

    document.querySelectorAll('.pvo-item').forEach(item => item.classList.remove('selected'));
    div.classList.add('selected');

    sellPVOButton.disabled = true;
  };

  menu.appendChild(div);
});


const pvoList = [];


  // Если покупаем ПВО — ставим новое
  map.on("click", (e) => {
  if (buyingMode && selectedPVO) {
    // ❌ Запрет ставить ПВО слишком близко к цели
for (let dp of defensePoints) {
  const dx = e.latlng.lng - dp.lng;
  const dy = e.latlng.lat - dp.lat;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 50) {
    alert("❌ Не можна ставити ППО надто близько до цілі! Тримай відстань.");
    return;
  }
}

    if (pvoList.length >= MAX_PVO_COUNT) {
      alert(`Максимальна кількість ППО на карті — ${MAX_PVO_COUNT}. Покращи існуючі!`);
      return;
    }
    const count = pvoPurchaseCounts[selectedPVO.name] || 0;
    const dynamicPrice = Math.floor(selectedPVO.price * Math.pow(1.2, count));

    if (money < dynamicPrice) {
      alert(`Недостатньо коштів, потрібно ${dynamicPrice} карбованців.`);
      return;
    }

    // Лимит на Patriot
    if (selectedPVO.name === "Patriot") {
      const patriotCount = pvoList.filter(pvo => pvo.name === "Patriot").length;
      if (patriotCount >= 5) {
        alert("❌ Максимум 5 Patriot на карті!");
        return;
      }
    }

    const icon = L.icon({
      iconUrl: selectedPVO.img,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

 const zoneColor = pvoColorMap[selectedPVO.name] || "#00FF00";

const rangeCircle = L.circle(e.latlng, {
  radius: selectedPVO.radius,
  color: zoneColor,
  fillColor: zoneColor,
  fillOpacity: 0.2
}).addTo(map);



    const marker = L.marker(e.latlng, { icon }).addTo(map);

    const pvo = {
      latlng: e.latlng,
      ...selectedPVO,
      baseDamage: selectedPVO.damage,
      baseRadius: selectedPVO.radius,
      baseCd: selectedPVO.cd,
      lastShot: 0,
      marker,
      rangeCircle,
      upgradeCount: 0
    };

    pvoList.push(pvo);

    money -= dynamicPrice;  // вычитаем цену с учётом покупки
    updateMoney();

    // Увеличиваем количество купленных для данного типа
    pvoPurchaseCounts[selectedPVO.name] = count + 1;

    // Обновляем цену в меню (динамически!)
    updatePvoMenuPrice(selectedPVO.name);

    buyingMode = false;
    selectedPVO = null;
    updatePvoPurchaseAvailability();


    document.querySelectorAll('.pvo-item').forEach(item => item.classList.remove('selected'));
    sellPVOButton.disabled = true;
    upgradePVOButton.disabled = true;
    upgradeInfo.textContent = "";

    return;
  }

  // Если не покупаем — ищем ближайшее ПВО в радиусе
  let nearest = null;
  let minDist = Infinity;

  pvoList.forEach(pvo => {
    const dx = e.latlng.lng - pvo.latlng.lng;
    const dy = e.latlng.lat - pvo.latlng.lat;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= pvo.radius && dist < minDist) {
      nearest = pvo;
      minDist = dist;
    }
  });

  if (nearest) {
    selectedPVO = nearest;
    sellPVOButton.disabled = false;
    upgradePVOButton.disabled = false;
    upgradeInfo.textContent = `Покращено: ${selectedPVO.upgradeCount} / 10`;
      updateUpgradeButtonText(); // обновляем цену

  } else {
    // Нажатие мимо ПВО — сбрасываем выбор
    selectedPVO = null;
    sellPVOButton.disabled = true;
    upgradePVOButton.disabled = true;
    upgradeInfo.textContent = "";
    document.querySelectorAll('.pvo-item').forEach(item => item.classList.remove('selected'));
  }
});


sellPVOButton.onclick = () => {
  if (!selectedPVO) return;

  money += Math.floor(selectedPVO.price * 0.6);
  updateMoney();

  map.removeLayer(selectedPVO.marker);
  // Удаляем круг действия ПВО
  if (selectedPVO.rangeCircle) {
    map.removeLayer(selectedPVO.rangeCircle);
  }

  const index = pvoList.indexOf(selectedPVO);
  if (index !== -1) pvoList.splice(index, 1);
updatePvoPurchaseAvailability();

  selectedPVO = null;
  sellPVOButton.disabled = true;
  
};

// === Дроны ===
const droneIcon = L.icon({
  iconUrl: "assets/drone.png",
  iconSize: [25, 25],
  iconAnchor: [12, 12]
});
const heavyDroneIcon = L.icon({
  iconUrl: "assets/kinshal.png",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});


let drones = [];

// === Ракеты ===
const rocketIcon = L.icon({
  iconUrl: "assets/rocket1.png",
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

let rockets = [];



// === Shahed 238 ICON ===
const shahed238Icon = L.icon({
  iconUrl: "assets/shahed238.png", // добавьте иконку в assets
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});


function spawnWave(droneCount = 3, rocketCount = 0) {
  // --- 1 дрон с левой стороны (обязательный) только начиная с 3-й волны ---
  // УБРАТЬ этот блок полностью:
  // if (waveNumber >= 3) {
  //   let startLat = Math.random() * 2829;
  //   let startLng = -100 + Math.random() * 100;
  //   ...
  // }

  const startIndex = (waveNumber >= 3) ? 1 : 0;

  for (let i = startIndex; i < droneCount; i++) {
    let startLat, startLng;
    let spawnDirections = [];

    if (waveNumber <= 4) {
      spawnDirections = ["right"];
    } else if (waveNumber <= 9) {
      spawnDirections = ["right", "bottom"];
    } else if (waveNumber <= 14) {
      spawnDirections = ["right", "bottom", "top"];
    } else {
      spawnDirections = ["right", "bottom", "top"];
      // "left" полностью убираем!
    }

    const chosenDirection = spawnDirections[Math.floor(Math.random() * spawnDirections.length)];

    if (chosenDirection === "right") {
      startLat = Math.random() * 2829;
      startLng = 4000 + Math.random() * 200;
    } else if (chosenDirection === "bottom") {
      // Только восточная и центральная часть (например, lng >= 1200)
      startLat = 2829 + Math.random() * 200;
      startLng = 1200 + Math.random() * (4000 - 1200);
    } else if (chosenDirection === "top") {
      // Только восточная и центральная часть (например, lng >= 1200)
      startLat = -100 + Math.random() * 100;
      startLng = 1200 + Math.random() * (4000 - 1200);
    }

    let target;
    if (Math.random() < 0.1 && pvoList.length > 0) {
      const randomPVO = pvoList[Math.floor(Math.random() * pvoList.length)];
      target = { lat: randomPVO.latlng.lat, lng: randomPVO.latlng.lng, isPVO: true };
    } else {
      const dp = defensePoints.filter(p => p.alive);
      target = dp[Math.floor(Math.random() * dp.length)];
    }

    drones.push({
      type: "light",
      position: [startLat, startLng],
      marker: L.marker([startLat, startLng], {
        icon: L.divIcon({
          className: "rotating-icon",
          html: `<img src="assets/drone.png" width="40" height="40" />`,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        })
      }).addTo(map),
      target: [target.lat, target.lng],
      speed: (0.21 + Math.random() * 0.31) + waveNumber * 0.01,
      hp: 13 + waveNumber * 10
    });
  }

  // === ТЯЖЁЛЫЕ ДРОНЫ ===
if (waveNumber >= 5) {
  const heavyCount = waveNumber - 4;
  for (let i = 0; i < heavyCount; i++) {
    const startLat = Math.random() * 2829;
    const startLng = 4000 + Math.random() * 200;

    const dp = defensePoints.filter(p => p.alive);
    const target = dp[Math.floor(Math.random() * dp.length)];

    drones.push({
      type: "kinzhal",
      position: [startLat, startLng],
      marker: L.marker([startLat, startLng], {
        icon: L.divIcon({
          className: "rotating-icon",
          html: `<img src="assets/kinshal.png" width="40" height="40" />`,
          iconSize: [70, 70],
          iconAnchor: [20, 20]
        })
      }).addTo(map),
      target: [target.lat, target.lng],
      speed: (5 + Math.random() * 0.3) + waveNumber * 0.03,
      hp: 250
    });
  }
}


  // === Shahed 238 ===
  // УДАЛИТЬ или закомментировать этот блок:
  /*
  if (waveNumber >= 2) {
    const shahedCount = Math.floor((waveNumber - 1) / 3) + 1;
    for (let i = 0; i < shahedCount; i++) {
      // ...код генерации Shahed 238...
    }
  }
  */

  // --- Ракеты ---
  for (let i = 0; i < rocketCount; i++) {
    let startLat, startLng;

    const direction = ["right", "top", "bottom"][Math.floor(Math.random() * 3)];

    if (direction === "right") {
      startLat = Math.random() * 2829;
      startLng = 4000 + 200;
    } else if (direction === "top") {
      startLat = -200;
      startLng = 1200 + Math.random() * (4000 - 1200);
    } else if (direction === "bottom") {
      startLat = 2829 + 200;
      startLng = 1200 + Math.random() * (4000 - 1200);
    }

    let target;
    if (Math.random() < 0.30 && pvoList.length > 0) {
      const randomPVO = pvoList[Math.floor(Math.random() * pvoList.length)];
      target = { lat: randomPVO.latlng.lat, lng: randomPVO.latlng.lng, isPVO: true };
    } else {
      const dp = defensePoints.filter(p => p.alive);
      target = dp[Math.floor(Math.random() * dp.length)];
    }

    rockets.push({
      position: [startLat, startLng],
      marker: L.marker([startLat, startLng], {
        icon: L.divIcon({
          className: "rotating-icon",
          html: `<img src="assets/rocket1.png" width="40" height="40" />`,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        })
      }).addTo(map),
      target: [target.lat, target.lng],
      speed: (1.2 + Math.random() * 1.6) + waveNumber * 0.01,
      hp: 20 + waveNumber * 15
    });
  }
}
function spawnNuke() {
  const target = defensePoints.find(p => p.alive);
  if (!target) return;

  const startPoint = [2500, 0]; // верхняя часть карты, можно изменить
  const nuke = {
    type: 'nuke',
    hp: 5000,
    speed: 1,
    position: [...startPoint],
    target: [target.lat, target.lng],
    marker: L.marker(startPoint, {
      icon: L.icon({
        iconUrl: 'assets/nuke.png', // не забудь положить nuke.png в папку assets
        iconSize: [60, 60],
        iconAnchor: [30, 30]
      })
    }).addTo(map)
  };
  rockets.push(nuke);
}

function triggerWaveAlarm() {
  const sound = document.getElementById("alarmSound");
  const indicator = document.getElementById("alarmIndicator");

  if (sound) {
    sound.currentTime = 0;
    sound.play();
  }

  if (indicator) {
    indicator.style.display = "block";
    indicator.classList.add("blinking");

    // Скрыть через 3 секунды
    setTimeout(() => {
      indicator.style.display = "none";
      indicator.classList.remove("blinking");
    }, 6000);
  }
}


function startWave() {
  triggerWaveAlarm();
  console.log("🔥 Старт волны", currentWave + 1);
  if (currentWave >= waves.length) {
    alert("Вітаю, ти справився. Всі ворожі цілі знешкоджено!");
    return;
  }

  // ✅ Переместить одну живую цель на 13-й волне
  //if (currentWave === 10) {
  //  relocateDefensePoint();
  // }

  const droneCount = 5 + currentWave * 5;
  const rocketCount = currentWave >= 3 ? currentWave - 1 : 0;


  spawnWave(droneCount, rocketCount);

  isWaveInProgress = true;

  const wave = waves[currentWave];
  wave.threats.forEach(threat => {
    for (let i = 0; i < threat.count; i++) {
      setTimeout(() => {
        spawnThreat(threat.type, threat.path);
      }, i * threat.delay);
    }
  });

  const longestDuration = Math.max(...wave.threats.map(t => t.count * t.delay)) + 2000;

  setTimeout(() => {
    isWaveInProgress = false;
    // alert(`Волна ${currentWave + 1} завершена!`);
  }, longestDuration);
}



function spawnThreat(type, pathKey) {
  const path = paths[pathKey];
  if (!path) return;

  if (type === 'drone') {
    createDrone(path);
  } else if (type === 'missile') {
    createMissile(path);
  }
}
// ===== ПВО стреляет =====
function pvoFire(ts = performance.now()) {
  pvoList.forEach(pvo => {
    if (ts - pvo.lastShot < pvo.cd) return;  // Если еще не перезарядилось — пропускаем

    const targets = [...drones, ...rockets].filter(t => {
      const dx = t.position[1] - pvo.latlng.lng;
      const dy = t.position[0] - pvo.latlng.lat;
      return Math.sqrt(dx * dx + dy * dy) <= pvo.radius;
    });

    if (targets.length > 0) {
      const target = targets[0];  // Стреляем в первого попавшегося
      target.hp -= pvo.damage;
      pvo.lastShot = ts;

      if (target.hp <= 0) {
        map.removeLayer(target.marker);
        drones = drones.filter(d => d !== target);
        rockets = rockets.filter(r => r !== target);
        score += 10;
        updateUI();
      }
    }
  });
}

function moveDrones(ts = 0) {
  if (gameOver) return;

  // Обновляем цели дронов
  drones.forEach(drone => {
    const currentTarget = defensePoints.find(p => p.lat === drone.target[0] && p.lng === drone.target[1]);
    if (!currentTarget || !currentTarget.alive) {
      const aliveTargets = defensePoints.filter(p => p.alive);
      if (aliveTargets.length === 0) {
        endGame();
        return;
      }
      const newTarget = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
      drone.target = [newTarget.lat, newTarget.lng];
    }
  });

  // Двигаем дронов и проверяем попадания
  drones.forEach((drone, index) => {
    if (drone.hp <= 0) {
      const explosion = L.marker(drone.position, {
        icon: L.icon({ iconUrl: "game_assets/explosion.gif", iconSize: [40, 40], iconAnchor: [20, 20] })
      }).addTo(map);
      setTimeout(() => map.removeLayer(explosion), 600);
      map.removeLayer(drone.marker);
      drones.splice(index, 1);
      money += 90;
      score++;
      updateUI();
      return;
    }

    const dx = drone.target[0] - drone.position[0];
    const dy = drone.target[1] - drone.position[1];
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 1) {
  // Попадание по ПВО
  const pvoTarget = pvoList.find(pvo =>
    pvo.latlng.lat === drone.target[0] && pvo.latlng.lng === drone.target[1]
  );

  if (pvoTarget) {
    map.removeLayer(pvoTarget.marker);
    if (pvoTarget.rangeCircle) map.removeLayer(pvoTarget.rangeCircle);
    pvoList.splice(pvoList.indexOf(pvoTarget), 1);
    const explosion = L.marker(pvoTarget.latlng, {
      icon: L.icon({ iconUrl: "assets/explosion.gif", iconSize: [40, 40], iconAnchor: [20, 20] })
    }).addTo(map);
    setTimeout(() => map.removeLayer(explosion), 600);
    map.removeLayer(drone.marker);
    drones.splice(index, 1);
    return;
  }

  const target = defensePoints.find(p => p.lat === drone.target[0] && p.lng === drone.target[1]);
  if (target && target.alive) {
    target.alive = false;
    target.marker.setIcon(L.divIcon({ html: "💥", className: "" }));
    if (target.noBuildCircle) {
  map.removeLayer(target.noBuildCircle);
  target.noBuildCircle = null;
}

  }

  map.removeLayer(drone.marker);
  drones.splice(index, 1);

  if (defensePoints.filter(p => p.alive).length === 0) {
    endGame();
  }
  return;
}


    const normDx = dx / dist;
    const normDy = dy / dist;
    // Проверка: если дрон в зоне действия РЭБ, замедляем
let slowed = false;
pvoList.forEach(pvo => {
  if (pvo.reb) {
    const dx = (drone.position[1] - pvo.latlng.lng);
    
    const dy = (drone.position[0] - pvo.latlng.lat);
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < pvo.radius) {
      slowed = true;
    }
  }
});
if (slowed) {
  drone.speedOriginal = drone.speedOriginal || drone.speed;
  drone.speed = drone.speedOriginal * 0.4; // замедляем до 40%
} else if (drone.speedOriginal) {
  drone.speed = drone.speedOriginal;
}

    drone.position[0] += normDx * drone.speed;
    drone.position[1] += normDy * drone.speed;
    drone.marker.setLatLng(drone.position);
    // Вычисляем угол поворота (радианы -> градусы)
const angleRad = Math.atan2(normDy, normDx);
const angleDeg = angleRad * (180 / Math.PI);

// Получаем элемент изображения дрона в маркере
const img = drone.marker.getElement()?.querySelector('img');
if (img) {
  img.style.transformOrigin = 'center center';
  img.style.transform = `rotate(${angleDeg}deg)`;
}


    // ПВО атакуют дрона
    pvoList.forEach(pvo => {
      const dx = (drone.position[1] - pvo.latlng.lng);
      const dy = (drone.position[0] - pvo.latlng.lat);
      const r = Math.sqrt(dx * dx + dy * dy) * PIXEL_TO_METERS;

      if (r < pvo.radius && ts - pvo.lastShot >= pvo.cd / 2) {
        drone.hp -= pvo.damage;
        pvo.lastShot = ts;
        const bulletLine = L.polyline([pvo.latlng, drone.position], {
  color: "#edb355",
  weight: 2,
  opacity: 0.9,
  dashArray: '4, 6' // 4px линия, 6px пробел — имитация очереди пуль
}).addTo(map);
setTimeout(() => map.removeLayer(bulletLine), 200);

      }
    });
  });

  requestAnimationFrame(moveDrones);
}
function updatePvoMenuPrice(name) {
  const count = pvoPurchaseCounts[name] ?? 0; // исправлено
  const dynamicPrice = Math.floor(
    pvoTypes.find(t => t.name === name).price * Math.pow(1.2, count)
  );

  const pvoDivs = document.querySelectorAll('.pvo-item');
  pvoDivs.forEach(div => {
    const title = div.querySelector('b');
    if (title && title.textContent === name) {
      // Обновляем цену в этом элементе меню (вторая строка)
      div.innerHTML = `
        <img src="${pvoTypes.find(t => t.name === name).img}" />
        <b>${name}</b><br/>
        💰${dynamicPrice}<br/>
        📏${pvoTypes.find(t => t.name === name).radius}
      `;
    }
  });
}

function updatePvoPurchaseAvailability() {
  const disable = pvoList.length >= MAX_PVO_COUNT;

  document.querySelectorAll('.pvo-item').forEach(div => {
    if (disable) {
      div.classList.add('disabled'); // применим стили "неактивно"
      div.onclick = () => {
        alert(`❌ Досягнуто ліміт ${MAX_PVO_COUNT} ППО. Покращи вже створені.`);
      };
    } else {
      div.classList.remove('disabled');

      // Восстанавливаем оригинальный обработчик
      const typeName = div.querySelector("b")?.textContent;
      const type = pvoTypes.find(t => t.name === typeName);
      if (!type) return;

      div.onclick = () => {
        const count = pvoPurchaseCounts[type.name] ?? 0; // исправлено
        const dynamicPrice = Math.floor(type.price * Math.pow(1.2, count));

        if (money < dynamicPrice) {
          alert(`Недостатньо коштів. Потрібно ${dynamicPrice} карбованців.`);
          return;
        }

        selectedPVO = type;
        buyingMode = true;

        document.querySelectorAll('.pvo-item').forEach(item => item.classList.remove('selected'));
        div.classList.add('selected');
        sellPVOButton.disabled = true;
      };
    }
  });
}


function moveRockets(ts = 0) {
  if (gameOver) return;

  // Обновляем цели ракет
  rockets.forEach(rocket => {
    const currentTarget = defensePoints.find(p => p.lat === rocket.target[0] && p.lng === rocket.target[1]);
    if (!currentTarget || !currentTarget.alive) {
      const aliveTargets = defensePoints.filter(p => p.alive);
      if (aliveTargets.length === 0) {
        endGame();
        return;
      }
      const newTarget = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
      rocket.target = [newTarget.lat, newTarget.lng];
    }
  });

rockets.forEach((rocket, index) => {
  // УДАЛЕННЫЙ или сбитый
  if (rocket.hp <= 0) {
    const isNuke = rocket.type === 'nuke';

    const explosion = L.marker(rocket.position, {
      icon: L.icon({ iconUrl: "assets/explosion.gif", iconSize: [40, 40], iconAnchor: [20, 20] })
    }).addTo(map);
    setTimeout(() => map.removeLayer(explosion), 600);
    map.removeLayer(rocket.marker);
    rockets.splice(index, 1);
    money += 350;
    score++;
    updateUI();

    if (isNuke) {
      setTimeout(checkVictory, 100);
      return;
    }

    return;
  }


    const dx = rocket.target[0] - rocket.position[0];
    const dy = rocket.target[1] - rocket.position[1];
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 1) {
      // Попадание по ПВО
      const pvoTarget = pvoList.find(pvo =>
        pvo.latlng.lat === rocket.target[0] && pvo.latlng.lng === rocket.target[1]
      );

      if (pvoTarget) {
        map.removeLayer(pvoTarget.marker);
        if (pvoTarget.rangeCircle) map.removeLayer(pvoTarget.rangeCircle);
        pvoList.splice(pvoList.indexOf(pvoTarget), 1);
        const explosion = L.marker(pvoTarget.latlng, {
          icon: L.icon({ iconUrl: "assets/explosion.gif", iconSize: [40, 40], iconAnchor: [20, 20] })
        }).addTo(map);
        setTimeout(() => map.removeLayer(explosion), 600);
        map.removeLayer(rocket.marker);
        rockets.splice(index, 1);
        return;
      }

      // Попадание по обычной цели
      const target = defensePoints.find(p => p.lat === rocket.target[0] && p.lng === rocket.target[1]);
      if (target && target.alive) {
        target.alive = false;

        if (rocket.type === 'nuke') {
          setTimeout(checkVictory, 1000); // Проверим победу через секунду после удара
        }

        target.marker.setIcon(L.divIcon({ html: "💥", className: "" }));
      }

      map.removeLayer(rocket.marker);
      rockets.splice(index, 1);

      if (defensePoints.filter(p => p.alive).length === 0) {
        endGame();
      }
      return;
    }

    const normDx = dx / dist;
    const normDy = dy / dist;

    // Проверка: если ракета в зоне действия РЭБ — замедляем
    let slowed = false;
    pvoList.forEach(pvo => {
      if (pvo.reb) {
        const dx = (rocket.position[1] - pvo.latlng.lng);
        const dy = (rocket.position[0] - pvo.latlng.lat);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < pvo.radius) {
          slowed = true;
        }
      }
    });

    if (slowed) {
      rocket.speedOriginal = rocket.speedOriginal || rocket.speed;
      rocket.speed = rocket.speedOriginal * 0.4; // замедление до 40%
    } else if (rocket.speedOriginal) {
      rocket.speed = rocket.speedOriginal;
    }

    rocket.position[0] += normDx * rocket.speed;
    rocket.position[1] += normDy * rocket.speed;
    rocket.marker.setLatLng(rocket.position);

    const angleRad = Math.atan2(normDy, normDx);
    const angleDeg = angleRad * (180 / Math.PI);
    const markerEl = rocket.marker.getElement();
    if (markerEl) {
      const currentTransform = markerEl.style.transform || "";
      const newTransform = currentTransform.replace(/rotate\([^)]+\)/, "").trim();
      markerEl.style.transform = `${newTransform} rotate(${angleDeg}deg)`.trim();
      markerEl.style.transformOrigin = "center center";
    }

    // ПВО атакуют ракету (включая ядерку)
    pvoList.forEach(pvo => {
      const dx = (rocket.position[1] - pvo.latlng.lng);
      const dy = (rocket.position[0] - pvo.latlng.lat);
      const r = Math.sqrt(dx * dx + dy * dy) * PIXEL_TO_METERS;

      if (r < pvo.radius && ts - pvo.lastShot >= pvo.cd / 2) {
        rocket.hp -= pvo.damage;
        pvo.lastShot = ts;
        const bulletLine = L.polyline([pvo.latlng, rocket.position], {
          color: "yellow",
          weight: 2,
          opacity: 0.9,
          dashArray: '4, 6'
        }).addTo(map);
        setTimeout(() => map.removeLayer(bulletLine), 200);
      }
    });
  });

  requestAnimationFrame(moveRockets);
}

// === Игровой цикл ===
let waveNumber = 1;
let nextWaveTime = 0;
function gameLoop(ts) {
 if (gameOver || gameWon) return;
  const elapsed = (performance.now() - gameStartTime) / 1000; // в секундах

  if (currentWave < waveSchedule.length && elapsed >= waveSchedule[currentWave]) {

    // ✅ СНАЧАЛА активируем цель
    if (waveNumber === 3) activateDefensePoint(1);
    if (waveNumber === 6) activateDefensePoint(2);
    if (waveNumber === 8) activateDefensePoint(3);
    if (waveNumber === 12) activateDefensePoint(4);

    // ✅ ПОТОМ запускаем волну
    startWave();

    waveNumber++;
    money += waveNumber * 125; // бонус после каждой волны
    currentWave++;
    updateUI();
  }

  // ✅ ПОСЛЕ 20-й волны запускаем финальную ядерную ракету, если врагов уже нет
  if (
    waveNumber > 19 &&
    !nukeLaunched &&
    drones.length === 0 &&
    rockets.length === 0
  ) {
    nukeLaunched = true;
    setTimeout(() => {
      spawnNuke(); // Функция должна быть у тебя уже реализована
    }, 3000); // задержка перед запуском ядерки (10 секунд)
  }

  requestAnimationFrame(gameLoop);
}

function relocateDefensePoint() {
  // 🔍 1. Выбираем живые цели
  const alivePoints = defensePoints.filter(p => p.alive);
  if (alivePoints.length === 0) return; // никто не выжил

  // 🎯 2. Случайная живая цель
  const pointToMove = alivePoints[Math.floor(Math.random() * alivePoints.length)];

  // 📌 3. Список уже занятых координат (чтобы не ставить туда же)
  const usedCoords = defensePoints.map(p => `${p.lat},${p.lng}`);

  // 🆕 4. Ищем свободную точку
  const freeSpots = allowedSpawnPoints.filter(
    ([lat, lng]) => !usedCoords.includes(`${lat},${lng}`)
  );

  if (freeSpots.length === 0) return; // все места заняты

  // 📦 5. Выбираем случайную новую позицию
  const [newLat, newLng] = freeSpots[Math.floor(Math.random() * freeSpots.length)];

  // 🔁 6. Обновляем координаты
  pointToMove.lat = newLat;
  pointToMove.lng = newLng;
  pointToMove.marker.setLatLng([newLat, newLng]); // меняем положение на карте
  // 🔁 Перемещаем круг запрета вместе с целью
if (pointToMove.noBuildCircle) {
  pointToMove.noBuildCircle.setLatLng([newLat, newLng]);
}


  // 🌟 7. Вспышка или сообщение
  pointToMove.marker.bindPopup("🎯 Ціль переміщена!").openPopup();
  setTimeout(() => pointToMove.marker.closePopup(), 2000);

  console.log("⚠️ Ціль переміщена на:", newLat, newLng);
}
function createDrone(path) {
  const spawn = paths[path][0];
  const drone = {
    type: "drone",
    position: [...spawn],
    target: getClosestAliveTarget(spawn),
    speed: 1,
    hp: 3,
    marker: L.marker(spawn, {
      icon: L.icon({
        iconUrl: "assets/drone.png",
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        className: "rotating-icon"
      })
    }).addTo(map)
  };
  drones.push(drone);
}
function createMissile(path) {
  const spawn = paths[path][0];
  const rocket = {
    type: "missile",
    position: [...spawn],
    target: getClosestAliveTarget(spawn),
    speed: 1.5,
    hp: 5,
    marker: L.marker(spawn, {
      icon: L.icon({
        iconUrl: "assets/rocket.png",
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      })
    }).addTo(map)
  };
  rockets.push(rocket);
}
function getClosestAliveTarget(fromPosition) {
  const alive = defensePoints.filter(p => p.alive);
  if (alive.length === 0) return fromPosition;

  alive.sort((a, b) => {
    const da = Math.hypot(fromPosition[0] - a.lat, fromPosition[1] - a.lng);
    const db = Math.hypot(fromPosition[0] - b.lat, fromPosition[1] - b.lng);
    return da - db;
  });

  return [alive[0].lat, alive[0].lng];
}


function checkVictory() {
  if (gameWon || gameOver) return;

  const aliveTargets = defensePoints.filter(p => p.alive);
  const aliveCount = aliveTargets.length;

  if (aliveCount > 0) {
    gameWon = true;

    let message = "🎉 Перемога! Ти захистив Україну!";

    if (aliveCount === 5) {
      message += "<br><b>🟢 ОГО 5/5. Завтра 9:00 ранку в воєнкоматі чекаємо!</b>";
    } else if (aliveCount === 4) {
      message += "<br><b>🟢 4 з 5 вціліли. Та ви просто майстер оборони!</b>";
    } else if (aliveCount === 3) {
      message += "<br><b>🟡 Вижили 3 цілі. Добре потримали удар!</b>";
    } else if (aliveCount === 2) {
      message += "<br><b>🟠 Лишилось лише 2... Але ж перемога — це перемога!</b>";
    } else {
      message += "<br><b>🔴 Вижила одна-єдина... Але ми вистояли! 💪</b>";
    }

    // Добавим кнопку доната
    message += `
      <br><br>
      <button onclick="window.open('https://send.monobank.ua/jar/6vUroyDvQL', '_blank')" 
        style="padding:10px 20px; font-size:16px; background-color:#28a745; color:#fff; border:none; border-radius:8px; cursor:pointer;">
        💚 Донат на ППО
      </button>
    `;

    showVictoryScreen(message);
  }
}



function startGame() {
  score = 0;
  waveNumber = 1;
  currentWave = 0;
  gameStartTime = performance.now();
  activateDefensePoint(0);
  drones = [];
  rockets = [];
  startWave(); // первая волна вручную
  requestAnimationFrame(gameLoop);
  requestAnimationFrame(moveDrones);
  requestAnimationFrame(moveRockets);
}

// Удалите или закомментируйте эти функции и вызов:
//
// function restartGame() {
//   location.reload();
// }
//
// function addReloadButtonToPvoList() {
//   const pvoList = document.getElementById('pvoList');
//   if (!pvoList) return;
//
//   const oldBtn = document.getElementById('reloadBtn');
//   if (oldBtn) oldBtn.remove();
//
//   const btn = document.createElement('button');
//   btn.id = 'reloadBtn';
//   btn.style.background = 'none';
//   btn.style.border = 'none';
//   btn.style.padding = '0';
//   btn.style.cursor = 'pointer';
//   btn.title = 'Перезапустити гру';
//
//   const img = document.createElement('img');
//   img.src = 'assets/reload.png';
//   img.alt = 'Перезапустити';
//   img.width = 32;
//   img.height = 32;
//
//   btn.appendChild(img);
//   btn.onclick = restartGame;
//
//   pvoList.appendChild(btn);
// }
//
// addReloadButtonToPvoList();
//
// function restartGame() { location.reload(); }

function endGame() {
  gameOver = true;

  const message = `
    <div style="font-size:18px; text-align:center;">
      🟥 <b>Гра закінчена!</b><br>Всі цілі знищено :(
      <br><br>
      <button onclick="window.open('https://send.monobank.ua/jar/6vUroyDvQL', '_blank')" 
        style="padding:10px 20px; font-size:16px; background-color:#28a745; color:#fff; border:none; border-radius:8px; cursor:pointer; margin-bottom:10px;">
        💚 Донат на ЗСУ
      </button>
      <br>
      <button onclick="location.reload()" 
        style="padding:10px 20px; font-size:16px; background-color:#555; color:#fff; border:none; border-radius:8px; cursor:pointer;">
        🔁 Спробувати ще
      </button>
    </div>
  `;

  const modal = document.createElement('div');
  modal.innerHTML = message;
  modal.style.position = 'fixed';
  modal.style.top = '50%';
  modal.style.left = '50%';
  modal.style.transform = 'translate(-50%, -50%)';
  modal.style.background = '#111';
  modal.style.color = '#fff';
  modal.style.padding = '30px';
  modal.style.borderRadius = '12px';
  modal.style.zIndex = '10000';
  modal.style.boxShadow = '0 0 20px rgba(0,0,0,0.7)';
  document.body.appendChild(modal);
}


function makeDraggable(panel, handle) {
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.onmousedown = function(e) {
    isDragging = true;
    offsetX = e.clientX - panel.offsetLeft;
    offsetY = e.clientY - panel.offsetTop;

    document.onmousemove = function(e) {
      if (!isDragging) return;
      panel.style.left = (e.clientX - offsetX) + 'px';
      panel.style.top = (e.clientY - offsetY) + 'px';
    };

    document.onmouseup = function() {
      isDragging = false;
      document.onmousemove = null;
      document.onmouseup = null;
    };
  };
} startGame(); // Вызов в самом конце
}

const waveSchedule = [10, 30, 50, 70, 120, 170, 220, 270, 320, 370, 420, 470, 520, 570, 620, 670, 720, 750, 810]; // в секундах
// ==== ВОЛНЫ ====
const waves = [
  { number: 1, threats: [ { type: 'drone', path: 'A', count: 50, delay: 1000 } ] },
  { number: 2, threats: [ { type: 'drone', path: 'A', count: 50, delay: 800 } ] },
  { number: 3, threats: [ { type: 'drone', path: 'A', count: 7, delay: 700 } ] },
  { number: 4, threats: [ { type: 'drone', path: 'B', count: 5, delay: 900 } ] },
  { number: 5, threats: [
    { type: 'drone', path: 'A', count: 6, delay: 700 },
    { type: 'drone', path: 'B', count: 4, delay: 1000 }
  ] },
  { number: 6, threats: [ { type: 'missile', path: 'C', count: 2, delay: 1500 } ] },
  { number: 7, threats: [
    { type: 'drone', path: 'A', count: 5, delay: 600 },
    { type: 'missile', path: 'C', count: 3, delay: 1300 }
  ] },
  { number: 8, threats: [
    { type: 'drone', path: 'B', count: 6, delay: 600 },
    { type: 'missile', path: 'D', count: 3, delay: 1400 }
  ] },
  { number: 9, threats: [
    { type: 'drone', path: 'A', count: 8, delay: 500 },
    { type: 'drone', path: 'B', count: 5, delay: 800 },
    { type: 'missile', path: 'C', count: 4, delay: 1200 }
  ] },
  { number: 10, threats: [
    { type: 'drone', path: 'A', count: 10, delay: 500 },
    { type: 'drone', path: 'B', count: 6, delay: 700 },
    { type: 'missile', path: 'D', count: 5, delay: 1000 }
  ] },
  { number: 11, threats: [
    { type: 'drone', path: 'A', count: 42, delay: 500 },
    { type: 'drone', path: 'B', count: 28, delay: 600 },
    { type: 'missile', path: 'A', count: 7, delay: 1200 }
  ] },
  { number: 12, threats: [
    { type: 'drone', path: 'A', count: 46, delay: 500 },
    { type: 'drone', path: 'B', count: 32, delay: 600 },
    { type: 'missile', path: 'D', count: 8, delay: 1200 }
  ] },
  { number: 13, threats: [
    { type: 'drone', path: 'A', count: 51, delay: 500 },
    { type: 'drone', path: 'B', count: 35, delay: 600 },
    { type: 'missile', path: 'A', count: 10, delay: 1200 }
  ] },
  { number: 14, threats: [
    { type: 'drone', path: 'A', count: 56, delay: 500 },
    { type: 'drone', path: 'B', count: 38, delay: 600 },
    { type: 'missile', path: 'D', count: 11, delay: 1200 }
  ] },
  { number: 15, threats: [
    { type: 'drone', path: 'A', count: 60, delay: 500 },
    { type: 'drone', path: 'B', count: 40, delay: 600 },
    { type: 'missile', path: 'C', count: 14, delay: 1200 }
  ] },
  { number: 16, threats: [
    { type: 'drone', path: 'A', count: 58, delay: 500 },
    { type: 'drone', path: 'B', count: 40, delay: 600 },
    { type: 'missile', path: 'D', count: 15, delay: 1200 }
  ] },
  { number: 17, threats: [
    { type: 'drone', path: 'A', count: 57, delay: 500 },
    { type: 'drone', path: 'B', count: 39, delay: 600 },
    { type: 'missile', path: 'A', count: 16, delay: 1200 }
  ] },
  { number: 18, threats: [
    { type: 'drone', path: 'A', count: 56, delay: 500 },
    { type: 'drone', path: 'B', count: 38, delay: 600 },
    { type: 'missile', path: 'D', count: 17, delay: 1200 }
  ] },
  { number: 19, threats: [
    { type: 'drone', path: 'A', count: 55, delay: 500 },
    { type: 'drone', path: 'B', count: 37, delay: 600 },
    { type: 'missile', path: 'C', count: 18, delay: 1200 }
  ] },
  { number: 20, threats: [
    { type: 'drone', path: 'A', count: 54, delay: 500 },
    { type: 'drone', path: 'B', count: 36, delay: 600 },
    { type: 'missile', path: 'D', count: 20, delay: 1200 }
  ] }
];

// ==== ПУТИ АТАК ====
const paths = {
  A: [ [10, 10], [20, 20], [30, 30], [40, 40] ],       // Путь А
  B: [ [90, 10], [80, 20], [70, 30], [60, 40] ],       // Путь B
  C: [ [10, 90], [20, 80], [30, 70], [40, 60] ],       // Путь C (ракеты)
  D: [ [90, 90], [80, 80], [70, 70], [60, 60] ],       // Путь D
};


const MAX_PVO_COUNT = 40;
const waveDisplay = document.getElementById("waveDisplay");
const scoreDisplay = document.getElementById("scoreDisplay");
const moneyDisplay = document.getElementById("money");

function updateMoney() {
  moneyDisplay.textContent = money;
}

function updateUI() {
  updateMoney();
  waveDisplay.textContent = currentWave + 1;
  scoreDisplay.textContent = score;
}
function updateUpgradeButtonText() {
  if (!selectedPVO) return;
  const baseUpgradeCost = 100;
  const upgradeCost = baseUpgradeCost * Math.pow(2, selectedPVO.upgradeCount);
  upgradePVOButton.textContent = `Покращити вибране ППО (💰${upgradeCost})`;
}
function showVictoryScreen(text = "🎉 Перемога!") {
  const div = document.createElement("div");
  div.style.position = "absolute";
  div.style.top = "50%";
  div.style.left = "50%";
  div.style.transform = "translate(-50%, -50%)";
  div.style.padding = "30px";
  div.style.background = "white";
  div.style.border = "3px solid green";
  div.style.zIndex = "9999";
  div.style.fontSize = "24px";
  div.style.textAlign = "center";
  div.innerHTML = text + "<br><br><button onclick='location.reload()'>🔁 Грати ще раз</button>";
  document.body.appendChild(div);
}


const allowedSpawnPoints = [
  [1870, 780],
  [1400, 1100],
  [2200, 1760],
  [1670, 1340],
  [1515, 900],
  [2040, 1870],
  [1400, 1555],
  [1913, 888],
  [1300, 1500],
  [1788, 680],
  [1946, 1200],
  [1920, 1200],
  [1827, 2401],
  [1984, 2225] ,
  [1568, 2225] ,
  [1591, 1999] ,
  [1366, 1687] ,
  [1216, 2512] ,
  [2222, 2225] ,
  [2100, 1679] ,
  [1687, 600] ,
  [2200, 878] ,
  [1700, 3000] , 
  [1600, 3000],  
  [1500, 3000], 
  [1400, 3000] ,
  [1300, 3000] 
];

const controlPanel = document.getElementById("controlPanel");
const dragHandle = document.getElementById("dragHandle");

makeDraggable(controlPanel, dragHandle);

updateUI();
