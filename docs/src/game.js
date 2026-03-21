const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const p1StaminaEl = document.getElementById("p1Stamina");
const p2StaminaEl = document.getElementById("p2Stamina");
const timerEl = document.getElementById("timer");
const announcementEl = document.getElementById("announcement");
const resetButton = document.getElementById("resetButton");
const matchStatusEl = document.getElementById("matchStatus");

const selectScreenEl = document.getElementById("selectScreen");
const fightScreenEl = document.getElementById("fightScreen");
const controlsEl = document.getElementById("controls");
const pickOrderEl = document.getElementById("pickOrder");
const p1SelectedEl = document.getElementById("p1Selected");
const p2SelectedEl = document.getElementById("p2Selected");
const catGridEl = document.getElementById("catGrid");
const matchLengthEls = [...document.querySelectorAll('input[name="matchLength"]')];

const FLOOR_Y = 440;
const GRAVITY = 0.75;
const ROUND_TIME = 60;
const MELEE_STAMINA_DRAIN = 8;
const PROJECTILE_STAMINA_DRAIN = 6;
const HIND_STAMINA_DRAIN = 10;
const MELEE_PUSH_FORCE = 5;
const PROJECTILE_PUSH_FORCE = 4;
const HIND_PUSH_FORCE = 9;
const BLOCK_KNOCKBACK_SCALE = 0.5;
const CLOSE_BLOCK_DISTANCE = 140;

const keys = new Set();
const projectiles = [];
let roundOver = false;
let roundStarted = false;
let timeLeft = ROUND_TIME;
let timerTick = 0;
let popups = [];
let matchEnded = false;

const catRoster = [
  { name: "Sunny Tabby", color: "#ffb347", image: "./assets/cats/sunny-tabby.svg" },
  { name: "Misty Shorthair", color: "#b8c1cc", image: "./assets/cats/misty-shorthair.svg" },
  { name: "Midnight Shadow", color: "#2f2f43", image: "./assets/cats/midnight-shadow.svg" },
  { name: "Peaches Calico", color: "#f6b07e", image: "./assets/cats/peaches-calico.svg" },
  { name: "Snowball Puff", color: "#f8f8ff", image: "./assets/cats/snowball-puff.svg" },
  { name: "Cocoa Stripe", color: "#8b5a3c", image: "./assets/cats/cocoa-stripe.svg" },
  { name: "Lilac Whiskers", color: "#b09edb", image: "./assets/cats/lilac-whiskers.svg" },
  { name: "Muffin White Tabby", color: "#f5f8ff", image: "./assets/cats/muffin-white-tabby.svg" },
  { name: "Lilith Longhair", color: "#2a2b33", image: "./assets/cats/lilith-black-longhair.svg" },
  { name: "Minty Paws", color: "#8fd3bf", image: "./assets/cats/minty-paws.svg" }
];

let p1Pick = null;
let p2Pick = null;

let maxRounds = 1;
let roundsToWin = 1;
let p1RoundsWon = 0;
let p2RoundsWon = 0;

const sfxWords = ["BOP!", "POOF!", "BOING!", "MEOW!", "FLOOF!"];

function makeCat({ name, color, x, controls, facing }) {
  return {
    name,
    color,
    x,
    y: FLOOR_Y,
    w: 68,
    h: 80,
    vx: 0,
    vy: 0,
    speed: 4,
    jumpPower: 14,
    facing,
    stamina: 100,
    attackCooldown: 0,
    rangedCooldown: 0,
    hindCooldown: 0,
    knockbackX: 0,
    controls
  };
}

const player1 = makeCat({
  name: "Sunny Tabby",
  color: "#ffb347",
  x: 180,
  controls: {
    left: "KeyA",
    right: "KeyD",
    jump: "KeyW",
    attack: "KeyF",
    ranged: "KeyG",
    hind: "KeyH"
  },
  facing: 1
});

const player2 = makeCat({
  name: "Misty Shorthair",
  color: "#b8c1cc",
  x: 710,
  controls: {
    left: "ArrowLeft",
    right: "ArrowRight",
    jump: "ArrowUp",
    attack: "KeyK",
    ranged: "KeyL",
    hind: "KeyJ"
  },
  facing: -1
});

function resetRound(startImmediately = true) {
  Object.assign(player1, makeCat({
    name: p1Pick?.name || "Sunny Tabby",
    color: p1Pick?.color || "#ffb347",
    x: 180,
    controls: player1.controls,
    facing: 1
  }));
  Object.assign(player2, makeCat({
    name: p2Pick?.name || "Misty Shorthair",
    color: p2Pick?.color || "#b8c1cc",
    x: 710,
    controls: player2.controls,
    facing: -1
  }));
  projectiles.length = 0;
  popups = [];
  roundOver = false;
  roundStarted = startImmediately;
  matchEnded = false;
  timeLeft = ROUND_TIME;
  timerTick = 0;
  if (startImmediately) {
    announce("Round Start! 🐾", 120);
  } else {
    announce("Pick cats to begin! 🐾", 99999);
  }
  updateHud();
}

let announceFrames = 0;
function announce(text, frames = 50) {
  announcementEl.textContent = text;
  announceFrames = frames;
}

function addPopup(text, x, y) {
  popups.push({ text, x, y, life: 45 });
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function overlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function isHoldingAway(defender, attacker) {
  const attackerCenterX = attacker.x + attacker.w / 2;
  const defenderCenterX = defender.x + defender.w / 2;

  if (attackerCenterX < defenderCenterX) {
    return keys.has(defender.controls.right);
  }
  return keys.has(defender.controls.left);
}

function isProjectileThreat(defender, attacker) {
  const defenderCenterX = defender.x + defender.w / 2;
  const defenderCenterY = defender.y + defender.h / 2;

  for (const p of projectiles) {
    if (p.owner !== attacker) continue;

    const projectileCenterX = p.x + p.size / 2;
    const projectileCenterY = p.y + p.size / 2;
    const movingTowardDefender =
      (p.vx > 0 && projectileCenterX <= defenderCenterX) ||
      (p.vx < 0 && projectileCenterX >= defenderCenterX);

    if (!movingTowardDefender) continue;

    const closeOnX = Math.abs(projectileCenterX - defenderCenterX) < 220;
    const closeOnY = Math.abs(projectileCenterY - defenderCenterY) < defender.h * 0.7;
    if (closeOnX && closeOnY) {
      return true;
    }
  }

  return false;
}

function isEnemyStriking(attacker) {
  return (
    keys.has(attacker.controls.attack) ||
    keys.has(attacker.controls.hind) ||
    keys.has(attacker.controls.ranged)
  );
}

function applyHit({ attacker, defender, damage, knockback, popupText }) {
  const blocked = isHoldingAway(defender, attacker);
  const pushDirection = defender.x >= attacker.x ? 1 : -1;
  const appliedKnockback = knockback * (blocked ? BLOCK_KNOCKBACK_SCALE : 1);

  defender.knockbackX += pushDirection * appliedKnockback;

  if (blocked) {
    addPopup("BLOCK!", defender.x + 22, defender.y + 6);
    return;
  }

  defender.stamina = clamp(defender.stamina - damage, 0, 100);
  addPopup(popupText, defender.x + 22, defender.y + 6);
}

function handleInput(cat, enemy) {
  cat.vx = 0;
  let desiredFacing = cat.facing;

  if (keys.has(cat.controls.left)) {
    cat.vx = -cat.speed;
    desiredFacing = -1;
  }
  if (keys.has(cat.controls.right)) {
    cat.vx = cat.speed;
    desiredFacing = 1;
  }

  const enemyCenterX = enemy.x + enemy.w / 2;
  const catCenterX = cat.x + cat.w / 2;
  const closeToEnemy = Math.abs(enemyCenterX - catCenterX) <= CLOSE_BLOCK_DISTANCE;
  const incomingPressure =
    isProjectileThreat(cat, enemy) || (closeToEnemy && isEnemyStriking(enemy));
  const shouldHoldGuardFacing = isHoldingAway(cat, enemy) && incomingPressure;

  if (shouldHoldGuardFacing) {
    cat.facing = enemyCenterX >= catCenterX ? 1 : -1;
  } else if (cat.vx !== 0) {
    cat.facing = desiredFacing;
  }

  if (keys.has(cat.controls.jump) && cat.y >= FLOOR_Y) {
    cat.vy = -cat.jumpPower;
  }

  if (cat.attackCooldown > 0) cat.attackCooldown--;
  if (cat.rangedCooldown > 0) cat.rangedCooldown--;
  if (cat.hindCooldown > 0) cat.hindCooldown--;

  if (keys.has(cat.controls.attack) && cat.attackCooldown === 0) {
    cat.attackCooldown = 28;
    const range = 55;
    const hitBox = {
      x: cat.facing === 1 ? cat.x + cat.w : cat.x - range,
      y: cat.y + 14,
      w: range,
      h: cat.h - 22
    };
    if (overlap(hitBox, enemy)) {
      applyHit({
        attacker: cat,
        defender: enemy,
        damage: MELEE_STAMINA_DRAIN,
        knockback: MELEE_PUSH_FORCE,
        popupText: sfxWords[(Math.random() * sfxWords.length) | 0]
      });
    } else {
      addPopup("SWISH!", cat.x + cat.w / 2, cat.y + 14);
    }
  }

  if (keys.has(cat.controls.ranged) && cat.rangedCooldown === 0) {
    cat.rangedCooldown = 50;
    projectiles.push({
      owner: cat,
      x: cat.facing === 1 ? cat.x + cat.w + 4 : cat.x - 16,
      y: cat.y + 26,
      vx: cat.facing * 6,
      size: 14
    });
    addPopup("YARN!", cat.x + cat.w / 2, cat.y);
  }

  if (keys.has(cat.controls.hind) && cat.hindCooldown === 0) {
    cat.hindCooldown = 42;
    const range = 44;
    const hitBox = {
      x: cat.facing === 1 ? cat.x - range : cat.x + cat.w,
      y: cat.y + 24,
      w: range,
      h: cat.h - 30
    };
    if (overlap(hitBox, enemy)) {
      applyHit({
        attacker: cat,
        defender: enemy,
        damage: HIND_STAMINA_DRAIN,
        knockback: HIND_PUSH_FORCE,
        popupText: "HIND LEG!"
      });
    } else {
      addPopup("THUMP!", cat.x + cat.w / 2, cat.y + 22);
    }
  }
}

function updateCat(cat) {
  cat.vy += GRAVITY;
  cat.x += cat.vx + cat.knockbackX;
  cat.y += cat.vy;

  cat.knockbackX *= 0.82;
  if (Math.abs(cat.knockbackX) < 0.1) {
    cat.knockbackX = 0;
  }

  cat.x = clamp(cat.x, 8, canvas.width - cat.w - 8);
  if (cat.y > FLOOR_Y) {
    cat.y = FLOOR_Y;
    cat.vy = 0;
  }
}

function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx;
    const target = p.owner === player1 ? player2 : player1;
    const hitBox = { x: p.x, y: p.y, w: p.size, h: p.size };
    if (overlap(hitBox, target)) {
      applyHit({
        attacker: p.owner,
        defender: target,
        damage: PROJECTILE_STAMINA_DRAIN,
        knockback: PROJECTILE_PUSH_FORCE,
        popupText: "PLOP!"
      });
      projectiles.splice(i, 1);
      continue;
    }
    if (p.x < -20 || p.x > canvas.width + 20) {
      projectiles.splice(i, 1);
    }
  }
}

function updatePopups() {
  popups = popups.filter((p) => {
    p.y -= 0.6;
    p.life--;
    return p.life > 0;
  });
}

function decideWinner() {
  if (player1.stamina <= 0 && player2.stamina <= 0) return "Double Cat Nap! 😴";
  if (player1.stamina <= 0) return `${player2.name} wins by Cat Nap! 😴`;
  if (player2.stamina <= 0) return `${player1.name} wins by Cat Nap! 😴`;
  if (player1.stamina === player2.stamina) return "Draw! Friendship wins! 🧶";
  if (player1.stamina > player2.stamina) return `${player1.name} wins! 🏆`;
  return `${player2.name} wins! 🏆`;
}

function selectedMatchLength() {
  const selected = matchLengthEls.find((el) => el.checked);
  return selected ? Number(selected.value) : 1;
}

function updateMatchStatus(text) {
  matchStatusEl.textContent = text;
}

function updatePickOrderLabel() {
  if (!p1Pick) {
    pickOrderEl.textContent = "Pick order: Player 1 turn";
    return;
  }
  if (!p2Pick) {
    pickOrderEl.textContent = "Pick order: Player 2 turn";
    return;
  }
  pickOrderEl.textContent = "Pick order: Locked in";
}

function updateRoundButton() {
  if (!roundStarted || !roundOver) {
    resetButton.classList.add("hidden");
    return;
  }

  resetButton.classList.remove("hidden");
  resetButton.textContent = matchEnded ? "Start New Match" : "Start Next Round";
}

function showSelectScreen() {
  selectScreenEl.classList.remove("hidden");
  fightScreenEl.classList.add("hidden");
  controlsEl.classList.add("hidden");
  resetButton.classList.add("hidden");
  updatePickOrderLabel();
}

function showFightScreen() {
  selectScreenEl.classList.add("hidden");
  fightScreenEl.classList.remove("hidden");
  controlsEl.classList.remove("hidden");
}

function renderCatOptions() {
  catGridEl.innerHTML = "";

  for (const cat of catRoster) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat-option";
    if (p1Pick?.name === cat.name) btn.classList.add("active-p1");
    if (p2Pick?.name === cat.name) btn.classList.add("active-p2");

    const image = document.createElement("img");
    image.className = "cat-option-image";
    image.alt = `${cat.name} portrait`;
    image.src = cat.image;

    const name = document.createElement("span");
    name.className = "cat-option-name";
    name.textContent = cat.name;

    btn.appendChild(image);
    btn.appendChild(name);
    btn.addEventListener("click", () => {
      if (!p1Pick) {
        p1Pick = cat;
        p1SelectedEl.textContent = `Player 1: ${cat.name}`;
      } else if (!p2Pick) {
        p2Pick = cat;
        p2SelectedEl.textContent = `Player 2: ${cat.name}`;
      }
      updatePickOrderLabel();
      renderCatOptions();
      maybeStartFromSelection();
    });

    catGridEl.appendChild(btn);
  }
}

async function startCountdown() {
  const beats = ["Ready?!", "3", "2", "1", "Play!"];
  for (const beat of beats) {
    announce(beat, 55);
    await new Promise((resolve) => {
      window.setTimeout(resolve, 650);
    });
  }
}

function maybeStartFromSelection() {
  if (!p1Pick || !p2Pick) {
    const waitText = p1Pick || p2Pick ? "Waiting for second pick..." : "Select cats to begin";
    updateMatchStatus(`Match: ${waitText}`);
    return;
  }

  matchLengthEls.forEach((el) => {
    el.disabled = true;
  });

  maxRounds = selectedMatchLength();
  roundsToWin = Math.floor(maxRounds / 2) + 1;
  p1RoundsWon = 0;
  p2RoundsWon = 0;

  updateMatchStatus(
    `Match: ${p1Pick.name} vs ${p2Pick.name} — First to ${roundsToWin} round${roundsToWin > 1 ? "s" : ""}`
  );

  showFightScreen();
  resetRound(false);
  roundStarted = false;
  void startCountdown().then(() => {
    roundStarted = true;
    announce("Round 1 Start! 🐾", 90);
  });
}

function evaluateRoundResult() {
  let roundWinner = 0;
  if (player1.stamina <= 0 && player2.stamina <= 0) roundWinner = 0;
  else if (player1.stamina <= 0) roundWinner = 2;
  else if (player2.stamina <= 0) roundWinner = 1;
  else if (player1.stamina > player2.stamina) roundWinner = 1;
  else if (player2.stamina > player1.stamina) roundWinner = 2;

  if (roundWinner === 1) p1RoundsWon++;
  if (roundWinner === 2) p2RoundsWon++;

  matchEnded = p1RoundsWon >= roundsToWin || p2RoundsWon >= roundsToWin;
  updateMatchStatus(
    `Match: ${player1.name} ${p1RoundsWon} - ${p2RoundsWon} ${player2.name}${matchEnded ? " (match complete)" : ""}`
  );
  updateRoundButton();
}

function resetToSelection() {
  p1Pick = null;
  p2Pick = null;
  p1SelectedEl.textContent = "Player 1: Not selected";
  p2SelectedEl.textContent = "Player 2: Not selected";
  matchLengthEls.forEach((el) => {
    el.disabled = false;
  });
  updateMatchStatus("Match: Select cats to begin");
  showSelectScreen();
  resetRound(false);
  renderCatOptions();
}

function updateHud() {
  p1StaminaEl.textContent = `P1 Stamina: ${player1.stamina}`;
  p2StaminaEl.textContent = `P2 Stamina: ${player2.stamina}`;
  timerEl.textContent = `Time: ${timeLeft}`;
}

function drawCat(cat) {
  ctx.save();
  ctx.translate(cat.x, cat.y);

  ctx.fillStyle = cat.color;
  ctx.fillRect(8, 24, 52, 44);

  ctx.beginPath();
  ctx.arc(34, 24, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(16, 7);
  ctx.lineTo(22, -8);
  ctx.lineTo(29, 10);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(40, 10);
  ctx.lineTo(47, -8);
  ctx.lineTo(52, 8);
  ctx.fill();

  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(27, 22, 2.6, 0, Math.PI * 2);
  ctx.arc(41, 22, 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff89ad";
  ctx.beginPath();
  ctx.arc(34, 30, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillRect(cat.facing === 1 ? 53 : -8, 34, 10, 6);

  ctx.restore();
}

function drawArena() {
  ctx.fillStyle = "#97d88f";
  ctx.fillRect(0, FLOOR_Y + 80, canvas.width, 30);

  ctx.fillStyle = "#ffffff88";
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(90 + i * 180, 80 + (i % 2) * 20, 36, 0, Math.PI * 2);
    ctx.arc(120 + i * 180, 80 + (i % 2) * 20, 26, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawProjectiles() {
  ctx.fillStyle = "#ff86b2";
  for (const p of projectiles) {
    ctx.beginPath();
    ctx.arc(p.x + p.size / 2, p.y + p.size / 2, p.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x + 3, p.y + 3);
    ctx.lineTo(p.x + p.size - 3, p.y + p.size - 3);
    ctx.moveTo(p.x + p.size - 3, p.y + 3);
    ctx.lineTo(p.x + 3, p.y + p.size - 3);
    ctx.stroke();
  }
}

function drawPopups() {
  ctx.font = "bold 22px Comic Sans MS";
  ctx.textAlign = "center";
  for (const p of popups) {
    ctx.globalAlpha = p.life / 45;
    ctx.fillStyle = "#ff3f8f";
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawArena();

  if (!roundOver && roundStarted) {
    handleInput(player1, player2);
    handleInput(player2, player1);

    updateCat(player1);
    updateCat(player2);
    updateProjectiles();
    updatePopups();

    timerTick++;
    if (timerTick >= 60) {
      timerTick = 0;
      timeLeft--;
    }

    if (player1.stamina <= 0 || player2.stamina <= 0 || timeLeft <= 0) {
      roundOver = true;
      announce(decideWinner(), 99999);
      evaluateRoundResult();
    }
  }

  drawProjectiles();
  drawCat(player1);
  drawCat(player2);
  drawPopups();
  updateHud();

  if (announceFrames > 0) {
    announceFrames--;
    if (announceFrames === 0 && !roundOver) {
      announcementEl.textContent = "";
    }
  }

  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (["ArrowUp", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
    e.preventDefault();
  }
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
});

document.querySelectorAll("button[data-key]").forEach((btn) => {
  const key = btn.getAttribute("data-key");
  const press = (e) => {
    e.preventDefault();
    keys.add(key);
  };
  const release = (e) => {
    e.preventDefault();
    keys.delete(key);
  };
  btn.addEventListener("touchstart", press, { passive: false });
  btn.addEventListener("touchend", release, { passive: false });
  btn.addEventListener("mousedown", press);
  btn.addEventListener("mouseup", release);
  btn.addEventListener("mouseleave", release);
});

resetButton.addEventListener("click", () => {
  if (matchEnded) {
    resetToSelection();
    return;
  }

  const nextRoundNumber = p1RoundsWon + p2RoundsWon + 1;
  resetRound(true);
  announce(`Round ${nextRoundNumber} Start! 🐾`, 90);
  updateRoundButton();
});

matchLengthEls.forEach((el) => {
  el.addEventListener("change", () => {
    if (!p1Pick || !p2Pick) {
      const rounds = Number(el.value);
      const needed = Math.floor(rounds / 2) + 1;
      updateMatchStatus(`Match: ${rounds === 1 ? "Single round" : "Best of 3"} selected (first to ${needed})`);
    }
  });
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (isLocalhost) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      return;
    }

    navigator.serviceWorker.register("./sw.js").catch(() => {
      // ignore registration failure
    });
  });
}

showSelectScreen();
renderCatOptions();
resetRound(false);
p1SelectedEl.textContent = "Player 1: Not selected";
p2SelectedEl.textContent = "Player 2: Not selected";
updateMatchStatus("Match: Select cats to begin");
loop();
