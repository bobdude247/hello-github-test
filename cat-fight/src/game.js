const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const p1StaminaEl = document.getElementById("p1Stamina");
const p2StaminaEl = document.getElementById("p2Stamina");
const timerEl = document.getElementById("timer");
const announcementEl = document.getElementById("announcement");
const resetButton = document.getElementById("resetButton");
const matchStatusEl = document.getElementById("matchStatus");
const soundToggleEl = document.getElementById("soundToggle");
const statusLiveEl = document.getElementById("statusLive");
const gameWrapEl = document.getElementById("fightScreen");
const p1SignatureCooldownEl = document.getElementById("p1SignatureCooldown");
const p2SignatureCooldownEl = document.getElementById("p2SignatureCooldown");
const attractModeEl = document.getElementById("attractMode");

const selectScreenEl = document.getElementById("selectScreen");
const fightScreenEl = document.getElementById("fightScreen");
const controlsEl = document.getElementById("controls");
const pickOrderEl = document.getElementById("pickOrder");
const p1SelectedEl = document.getElementById("p1Selected");
const p2SelectedEl = document.getElementById("p2Selected");
const catGridEl = document.getElementById("catGrid");
const matchLengthEls = [...document.querySelectorAll('input[name="matchLength"]')];
const gameModeEls = [...document.querySelectorAll('input[name="gameMode"]')];
const p1ControlsCol = document.getElementById("p1ControlsCol");
const p2ControlsCol = document.getElementById("p2ControlsCol");

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
let roundElapsedMs = 0;
let lastFrameTime = null;
let popups = [];
let particles = [];
let matchEnded = false;
let roundDraw = false;
let hitStopMs = 0;
let countdownToken = 0;
let liveStatusTimeout;
let isExhibition = false;
let exhibitionToken = 0;
let exhibitionReturnTimer = null;
let attractIdleMs = 0;
let lastAttractFrame = null;
let attractModeSeconds = Number(localStorage.getItem("catFightAttractMode") || 60);
let setupSnapshot = null;
let exhibitionIndex = 0;
let visualEffects = [];
let lastPointerPosition = "";

const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
let audioContext = null;
let soundMuted = localStorage.getItem("catFightMuted") === "true";
const soundLastPlayed = new Map();

function ensureAudio() {
  if (soundMuted || audioContext || !window.AudioContext && !window.webkitAudioContext) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContext();
    if (audioContext.state === "suspended") {
      void audioContext.resume().catch(() => {
        audioContext = null;
      });
    }
  } catch {
    audioContext = null;
  }
}

function playSound(type) {
  if (soundMuted) return;
  ensureAudio();
  if (!audioContext) return;
  const now = performance.now();
  const minGap = type === "hit" || type === "damage" ? 65 : 25;
  if (now - (soundLastPlayed.get(type) || 0) < minGap) return;
  soundLastPlayed.set(type, now);

  const tones = {
    tick: [520, 0.06, "square"], fight: [760, 0.16, "triangle"],
    hit: [180, 0.1, "triangle"], hind: [105, 0.15, "sawtooth"],
    block: [280, 0.08, "square"], miss: [150, 0.06, "sine"],
    damage: [90, 0.1, "sine"], roundWin: [660, 0.3, "triangle"],
    matchWin: [880, 0.45, "triangle"], select: [440, 0.07, "sine"],
    button: [330, 0.06, "sine"], sunbeam: [740, 0.16, "triangle"],
    misty: [260, 0.24, "sine"], shadow: [170, 0.2, "sawtooth"],
    confetti: [610, 0.22, "square"], snowball: [390, 0.2, "sine"],
    cocoa: [115, 0.22, "sawtooth"], lilac: [520, 0.24, "triangle"],
    muffin: [300, 0.22, "square"], lasso: [205, 0.22, "triangle"],
    zoomies: [800, 0.16, "square"]
  };
  const [frequency, duration, wave] = tones[type] || tones.button;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const start = audioContext.currentTime;
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(55, frequency * 0.72), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(type === "matchWin" ? 0.09 : 0.055, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function updateSoundToggle() {
  soundToggleEl.textContent = soundMuted ? "Sound: Off" : "Sound: On";
  soundToggleEl.setAttribute("aria-pressed", String(!soundMuted));
  soundToggleEl.setAttribute("aria-label", soundMuted ? "Turn sound on" : "Turn sound off");
}

function toggleSound() {
  soundMuted = !soundMuted;
  localStorage.setItem("catFightMuted", String(soundMuted));
  updateSoundToggle();
  if (!soundMuted) {
    ensureAudio();
    playSound("button");
  }
}

const catRoster = [
  { name: "Sunny Tabby", color: "#ffb347", image: "./assets/cats/sunny-tabby.svg", signature: { id: "sunbeamPounce", name: "Sunbeam Pounce", description: "A bright dash that bonks close foes.", style: "Rushdown", damage: 12, cooldown: 8, range: 230, sound: "sunbeam" } },
  { name: "Misty Shorthair", color: "#b8c1cc", image: "./assets/cats/misty-shorthair.svg", signature: { id: "mistyVeil", name: "Misty Veil", description: "A soft cloud that briefly guards and slips away.", style: "Defensive", damage: 0, cooldown: 10, range: 0, sound: "misty" } },
  { name: "Midnight Shadow", color: "#2f2f43", image: "./assets/cats/midnight-shadow.svg", signature: { id: "shadowFeint", name: "Shadow Feint", description: "A spooky sidestep that swaps the attack angle.", style: "Feint", damage: 9, cooldown: 9, range: 170, sound: "shadow" } },
  { name: "Peaches Calico", color: "#f6b07e", image: "./assets/cats/peaches-calico.svg", signature: { id: "calicoConfetti", name: "Calico Confetti", description: "A colorful close burst with playful area reach.", style: "Area", damage: 8, cooldown: 11, range: 180, sound: "confetti" } },
  { name: "Snowball Puff", color: "#f8f8ff", image: "./assets/cats/snowball-puff.svg", signature: { id: "snowballRoll", name: "Snowball Roll", description: "A chilly yarn ball that travels straight ahead.", style: "Projectile", damage: 9, cooldown: 8, range: 360, sound: "snowball" } },
  { name: "Cocoa Stripe", color: "#8b5a3c", image: "./assets/cats/cocoa-stripe.svg", signature: { id: "cocoaClobber", name: "Cocoa Clobber", description: "A slow, sturdy thump with extra push.", style: "Heavy", damage: 16, cooldown: 12, range: 90, sound: "cocoa" } },
  { name: "Lilac Whiskers", color: "#b09edb", image: "./assets/cats/lilac-whiskers.svg", signature: { id: "whiskerWave", name: "Whisker Wave", description: "A long whisker-shaped wave that checks space.", style: "Zoning", damage: 8, cooldown: 9, range: 420, sound: "lilac" } },
  { name: "Muffin White Tabby", color: "#f5f8ff", image: "./assets/cats/muffin-white-tabby.svg", signature: { id: "muffinBounce", name: "Muffin Bounce", description: "A bouncy hop that bumps nearby cats.", style: "Mobility", damage: 10, cooldown: 10, range: 130, sound: "muffin" } },
  { name: "Lilith Longhair", color: "#2a2b33", image: "./assets/cats/lilith-black-longhair.svg", signature: { id: "longhairLasso", name: "Longhair Lasso", description: "A loose strand tugs a distant opponent closer.", style: "Control", damage: 6, cooldown: 11, range: 260, sound: "lasso" } },
  { name: "Minty Paws", color: "#8fd3bf", image: "./assets/cats/minty-paws.svg", signature: { id: "mintyZoomies", name: "Minty Zoomies", description: "A quick zigzag dash with a refreshing bonk.", style: "Movement", damage: 10, cooldown: 8, range: 250, sound: "zoomies" } }
];

let p1Pick = null;
let p2Pick = null;
let gameMode = "1p";

let maxRounds = 1;
let roundsToWin = 1;
let p1RoundsWon = 0;
let p2RoundsWon = 0;

const sfxWords = ["BOP!", "POOF!", "BOING!", "MEOW!", "FLOOF!"];
const hindWords = ["HIND LEG!", "THUMP!", "KAPOW!"];

function makeCat({ name, color, x, controls, facing, signature = null, isCpu = false }) {
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
    hitFlash: 0,
    attackAnimation: null,
    signatureAnimation: null,
    signatureCooldownMs: 0,
    signatureLatch: false,
    guardMs: 0,
    isCpu,
    signature,
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
    hind: "KeyH",
    signature: "KeyV"
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
    hind: "KeyJ",
    signature: "KeyU"
  },
  facing: -1
});

function resetRound(startImmediately = true) {
  Object.assign(player1, makeCat({
    name: p1Pick?.name || "Sunny Tabby",
    color: p1Pick?.color || "#ffb347",
    x: 180,
    controls: player1.controls,
    facing: 1,
    signature: p1Pick?.signature,
    isCpu: isExhibition || isSinglePlayer()
  }));
  Object.assign(player2, makeCat({
    name: p2Pick?.name || "Misty Shorthair",
    color: p2Pick?.color || "#b8c1cc",
    x: 710,
    controls: player2.controls,
    facing: -1,
    signature: p2Pick?.signature,
    isCpu: isExhibition
  }));
  projectiles.length = 0;
  popups = [];
  particles = [];
  visualEffects = [];
  clearControlKeys(player1);
  clearControlKeys(player2);
  roundOver = false;
  roundStarted = startImmediately;
  matchEnded = false;
  roundDraw = false;
  timeLeft = ROUND_TIME;
  roundElapsedMs = 0;
  lastFrameTime = null;
  hitStopMs = 0;
  if (exhibitionReturnTimer) {
    window.clearTimeout(exhibitionReturnTimer);
    exhibitionReturnTimer = null;
  }
  gameWrapEl.classList.remove("shake-light", "shake-strong");
  p1StaminaEl.classList.remove("damage-flash");
  p2StaminaEl.classList.remove("damage-flash");
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
  statusLiveEl.textContent = text.replace(/[🐾😴🏆🧶]/gu, "").trim();
}

function addPopup(text, x, y) {
  popups.push({ text, x, y, life: 45 });
}

function addBurst(x, y, color, strong = false) {
  const count = strong ? 12 : 8;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    particles.push({ x, y, vx: Math.cos(angle) * (strong ? 3.8 : 2.6), vy: Math.sin(angle) * (strong ? 3.8 : 2.6), life: 22, color });
  }
}

function triggerShake(strong) {
  if (prefersReducedMotion) return;
  gameWrapEl.classList.remove("shake-light", "shake-strong");
  void gameWrapEl.offsetWidth;
  gameWrapEl.classList.add(strong ? "shake-strong" : "shake-light");
}

function flashStamina(el) {
  el.classList.remove("damage-flash");
  void el.offsetWidth;
  el.classList.add("damage-flash");
}

function triggerHitEffects(attacker, defender, strong, blocked = false) {
  const x = defender.x + defender.w / 2;
  const y = defender.y + defender.h * 0.45;
  addBurst(x, y, blocked ? "#8fc8ff" : strong ? "#ff8a56" : "#ff4f9b", strong);
  triggerShake(strong);
  defender.hitFlash = 10;
  if (!blocked) {
    flashStamina(defender === player1 ? p1StaminaEl : p2StaminaEl);
    hitStopMs = Math.max(hitStopMs, prefersReducedMotion ? 0 : strong ? 85 : 45);
  }
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
    keys.has(attacker.controls.ranged) ||
    keys.has(attacker.controls.signature)
  );
}

function attackHitBox(cat, type) {
  const range = type === "hind" ? 44 : 55;
  return {
    x: cat.facing === 1 ? cat.x + cat.w : cat.x - range,
    y: cat.y + (type === "hind" ? 24 : 14),
    w: range,
    h: cat.h - (type === "hind" ? 30 : 22)
  };
}

function startAttack(cat, type) {
  if (cat.attackAnimation || (type === "paw" ? cat.attackCooldown : cat.hindCooldown) > 0) return;
  const duration = type === "hind" ? (prefersReducedMotion ? 13 : 24) : (prefersReducedMotion ? 9 : 16);
  cat.attackAnimation = { type, frame: 0, duration, impact: Math.floor(duration * 0.55), resolved: false };
  if (type === "hind") cat.hindCooldown = 42;
  else cat.attackCooldown = 28;
}

function resolveStandardAttack(cat, enemy, animation) {
  const hitBox = attackHitBox(cat, animation.type);
  if (overlap(hitBox, enemy)) {
    applyHit({
      attacker: cat,
      defender: enemy,
      damage: animation.type === "hind" ? HIND_STAMINA_DRAIN : MELEE_STAMINA_DRAIN,
      knockback: animation.type === "hind" ? HIND_PUSH_FORCE : MELEE_PUSH_FORCE,
      popupText: animation.type === "hind" ? hindWords[(Math.random() * hindWords.length) | 0] : sfxWords[(Math.random() * sfxWords.length) | 0],
      kind: animation.type
    });
  } else {
    addPopup(animation.type === "hind" ? "THUMP!" : "SWISH!", cat.x + cat.w / 2, cat.y + 14);
    playSound("miss");
  }
}

function updateAttackAnimations() {
  for (const [cat, enemy] of [[player1, player2], [player2, player1]]) {
    const animation = cat.attackAnimation;
    if (!animation) continue;
    animation.frame++;
    if (!animation.resolved && animation.frame >= animation.impact) {
      animation.resolved = true;
      resolveStandardAttack(cat, enemy, animation);
    }
    if (animation.frame >= animation.duration) cat.attackAnimation = null;
  }
}

function applyHit({ attacker, defender, damage, knockback, popupText, kind = "hit" }) {
  const blocked = defender.guardMs > 0 || isHoldingAway(defender, attacker);
  const pushDirection = defender.x >= attacker.x ? 1 : -1;
  const appliedKnockback = knockback * (blocked ? BLOCK_KNOCKBACK_SCALE : 1);

  defender.knockbackX += pushDirection * appliedKnockback;

  if (blocked) {
    addPopup(defender.guardMs > 0 ? "VEIL BLOCK!" : "BLOCK!", defender.x + 22, defender.y + 6);
    playSound("block");
    triggerHitEffects(attacker, defender, false, true);
    return;
  }

  defender.stamina = clamp(defender.stamina - damage, 0, 100);
  addPopup(popupText, defender.x + 22, defender.y + 6);
  playSound(kind === "hind" ? "hind" : "hit");
  playSound("damage");
  triggerHitEffects(attacker, defender, kind === "hind");
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

  if (keys.has(cat.controls.attack)) startAttack(cat, "paw");

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

  if (keys.has(cat.controls.hind)) startAttack(cat, "hind");
  if (keys.has(cat.controls.signature)) {
    if (!cat.signatureLatch) startSignature(cat);
    cat.signatureLatch = true;
  } else {
    cat.signatureLatch = false;
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
        popupText: "PLOP!",
        kind: "yarn"
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

function signatureInRange(attacker, defender, range) {
  return Math.abs((attacker.x + attacker.w / 2) - (defender.x + defender.w / 2)) <= range;
}

function signatureHit(attacker, defender, damage, knockback, text, strong = false) {
  applyHit({ attacker, defender, damage, knockback, popupText: text, kind: strong ? "hind" : "signature" });
  if (strong) triggerShake(true);
}

function startSignature(cat) {
  if (!cat.signature || cat.signatureCooldownMs > 0 || cat.signatureAnimation || cat.attackAnimation) return;
  const duration = prefersReducedMotion ? 18 : 34;
  cat.signatureAnimation = { frame: 0, duration, impact: Math.floor(duration * 0.5), resolved: false };
  cat.signatureCooldownMs = cat.signature.cooldown * 1000;
  addPopup(cat.signature.name, cat.x + cat.w / 2, cat.y - 12);
  playSound(cat.signature.sound);
  visualEffects.push({ type: cat.signature.id, owner: cat, life: duration + 10, maxLife: duration + 10 });
  announce(`${cat.name}: ${cat.signature.name}`, 45);
}

function resolveSignature(cat, enemy) {
  const move = cat.signature;
  if (!move) return;
  const close = signatureInRange(cat, enemy, move.range);
  switch (move.id) {
    case "sunbeamPounce":
      cat.x = clamp(enemy.x - cat.facing * (cat.w + 18), 8, canvas.width - cat.w - 8);
      if (signatureInRange(cat, enemy, 90)) signatureHit(cat, enemy, move.damage, 8, "SUN BONK!");
      break;
    case "mistyVeil":
      cat.guardMs = 900;
      cat.knockbackX = -cat.facing * 3;
      addPopup("VEIL!", cat.x + cat.w / 2, cat.y - 4);
      break;
    case "shadowFeint":
      cat.x = clamp(enemy.x + enemy.w + 20, 8, canvas.width - cat.w - 8);
      cat.facing = -1;
      if (signatureInRange(cat, enemy, 100)) signatureHit(cat, enemy, move.damage, 6, "SHADOW BOP!");
      break;
    case "calicoConfetti":
      if (close) signatureHit(cat, enemy, move.damage, 6, "CONFETTI!");
      addBurst(cat.x + cat.w / 2, cat.y + 32, "#ff9bba", true);
      break;
    case "snowballRoll":
      projectiles.push({ owner: cat, x: cat.facing === 1 ? cat.x + cat.w + 4 : cat.x - 22, y: cat.y + 28, vx: cat.facing * 5.5, size: 22, kind: "snowball", spin: 0 });
      break;
    case "cocoaClobber":
      if (close) signatureHit(cat, enemy, move.damage, 13, "COCOA CLOBBER!", true);
      break;
    case "whiskerWave":
      projectiles.push({ owner: cat, x: cat.facing === 1 ? cat.x + cat.w + 4 : cat.x - 24, y: cat.y + 25, vx: cat.facing * 7, size: 20, kind: "wave", spin: 0 });
      break;
    case "muffinBounce":
      cat.vy = -cat.jumpPower * 0.9;
      if (close) signatureHit(cat, enemy, move.damage, 8, "BOUNCE BONK!");
      break;
    case "longhairLasso":
      if (close) {
        signatureHit(cat, enemy, move.damage, 2, "LASSO!");
        enemy.knockbackX += enemy.x > cat.x ? -8 : 8;
      }
      break;
    case "mintyZoomies":
      cat.x = clamp(cat.x + cat.facing * 150, 8, canvas.width - cat.w - 8);
      if (signatureInRange(cat, enemy, 110)) signatureHit(cat, enemy, move.damage, 7, "ZOOMIES!");
      break;
  }
}

function updateSignatureAnimations() {
  for (const [cat, enemy] of [[player1, player2], [player2, player1]]) {
    if (cat.guardMs > 0) cat.guardMs = Math.max(0, cat.guardMs - 16.67);
    const animation = cat.signatureAnimation;
    if (!animation) continue;
    animation.frame++;
    if (!animation.resolved && animation.frame >= animation.impact) {
      animation.resolved = true;
      resolveSignature(cat, enemy);
    }
    if (animation.frame >= animation.duration) cat.signatureAnimation = null;
  }
  visualEffects = visualEffects.filter((effect) => --effect.life > 0);
}

function updateCooldowns() {
  for (const cat of [player1, player2]) {
    cat.attackCooldown = Math.max(0, cat.attackCooldown - 1);
    cat.rangedCooldown = Math.max(0, cat.rangedCooldown - 1);
    cat.hindCooldown = Math.max(0, cat.hindCooldown - 1);
    cat.signatureCooldownMs = Math.max(0, cat.signatureCooldownMs - 16.67);
  }
}

function updateParticles() {
  particles = particles.filter((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vx *= 0.9;
    particle.vy *= 0.9;
    particle.life--;
    return particle.life > 0;
  });
  player1.hitFlash = Math.max(0, player1.hitFlash - 1);
  player2.hitFlash = Math.max(0, player2.hitFlash - 1);
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

function selectedGameMode() {
  const selected = gameModeEls.find((el) => el.checked);
  return selected ? selected.value : "1p";
}

function isSinglePlayer() {
  return gameMode === "1p";
}

function resetAttractIdle() {
  attractIdleMs = 0;
  lastAttractFrame = null;
}

function updateAttractMode(timestamp) {
  if (isExhibition || attractModeSeconds <= 0 || document.hidden || selectScreenEl.classList.contains("hidden")) {
    lastAttractFrame = null;
    return;
  }
  if (lastAttractFrame === null) {
    lastAttractFrame = timestamp;
    return;
  }
  attractIdleMs += Math.min(100, Math.max(0, timestamp - lastAttractFrame));
  lastAttractFrame = timestamp;
  if (attractIdleMs >= attractModeSeconds * 1000) startExhibition();
}

function startExhibition() {
  if (isExhibition || attractModeSeconds <= 0) return;
  setupSnapshot = {
    p1Pick,
    p2Pick,
    gameMode,
    matchLength: selectedMatchLength()
  };
  const first = exhibitionIndex % catRoster.length;
  const second = (first + 3 + (exhibitionIndex % 4)) % catRoster.length;
  exhibitionIndex++;
  isExhibition = true;
  exhibitionToken++;
  p1Pick = catRoster[first];
  p2Pick = catRoster[second];
  gameMode = "exhibition";
  maxRounds = 1;
  roundsToWin = 1;
  p1RoundsWon = 0;
  p2RoundsWon = 0;
  updateMatchStatus(`CPU Exhibition: ${p1Pick.name} vs ${p2Pick.name}`);
  showFightScreen();
  resetRound(false);
  gameMode = "exhibition";
  updateMatchStatus(`CPU Exhibition: ${p1Pick.name} vs ${p2Pick.name}`);
  roundStarted = false;
  resetAttractIdle();
  void startCountdown().then((canStart) => {
    if (!canStart || !isExhibition) return;
    roundStarted = true;
    announce("CPU EXHIBITION! FIGHT! 🐾", 90);
  });
}

function exitExhibition() {
  if (!isExhibition) return;
  exhibitionToken++;
  countdownToken++;
  if (exhibitionReturnTimer) window.clearTimeout(exhibitionReturnTimer);
  exhibitionReturnTimer = null;
  isExhibition = false;
  clearAllInput();
  if (setupSnapshot) {
    p1Pick = setupSnapshot.p1Pick;
    p2Pick = setupSnapshot.p2Pick;
    gameMode = setupSnapshot.gameMode;
    matchLengthEls.forEach((el) => { el.checked = Number(el.value) === setupSnapshot.matchLength; el.disabled = false; });
  }
  gameModeEls.forEach((el) => { el.checked = el.value === gameMode; el.disabled = false; });
  setupSnapshot = null;
  showSelectScreen();
  resetRound(false);
  updateModeUi();
  renderCatOptions();
  updateMatchStatus("Match: Select cats to begin");
  resetAttractIdle();
  announce("Exhibition ended. Your setup is restored.", 70);
}

function updateMatchStatus(text) {
  matchStatusEl.textContent = text;
}

function updatePickOrderLabel() {
  if (!p1Pick) {
    pickOrderEl.textContent = isSinglePlayer()
      ? "Pick order: CPU cat first (Player 1)"
      : "Pick order: Player 1 turn";
    return;
  }
  if (isSinglePlayer()) {
    pickOrderEl.textContent = !p2Pick
      ? "Pick order: Your cat next (Player 2 - Arrow keys)"
      : "Pick order: Locked in";
    return;
  }
  if (!p2Pick) {
    pickOrderEl.textContent = "Pick order: Player 2 turn";
    return;
  }
  pickOrderEl.textContent = "Pick order: Locked in";
}

function clearControlKeys(cat) {
  const controlValues = Object.values(cat.controls);
  controlValues.forEach((code) => keys.delete(code));
}

function clearAllInput() {
  keys.clear();
}

function updateModeUi() {
  if (p1ControlsCol) {
    p1ControlsCol.classList.toggle("hidden", isSinglePlayer());
  }

  if (p2ControlsCol) {
    p2ControlsCol.classList.remove("hidden");
  }

  if (!p1Pick) {
    p1SelectedEl.textContent = isSinglePlayer()
      ? "Player 1 (CPU): Not selected"
      : "Player 1: Not selected";
  }

  if (!p2Pick) {
    p2SelectedEl.textContent = isSinglePlayer()
      ? "Player 2 (You): Not selected"
      : "Player 2: Not selected";
  }

  updatePickOrderLabel();
}

function updateRoundButton() {
  if (isExhibition || !roundStarted || !roundOver) {
    resetButton.classList.add("hidden");
    return;
  }

  resetButton.classList.remove("hidden");
  resetButton.textContent = matchEnded ? "Start New Match" : roundDraw ? "Replay Drawn Round" : "Start Next Round";
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
  controlsEl.classList.toggle("hidden", isExhibition);
  if (p1ControlsCol) {
    p1ControlsCol.classList.toggle("hidden", isSinglePlayer());
  }
  if (p2ControlsCol) {
    p2ControlsCol.classList.remove("hidden");
  }
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

    const signature = document.createElement("span");
    signature.className = "cat-option-signature";
    signature.textContent = cat.signature.name;

    const description = document.createElement("span");
    description.className = "cat-option-description";
    description.textContent = cat.signature.description;

    const style = document.createElement("span");
    style.className = "cat-option-style";
    style.textContent = `${cat.signature.style} · ${cat.signature.cooldown}s cooldown`;

    btn.appendChild(image);
    btn.appendChild(name);
    btn.appendChild(signature);
    btn.appendChild(description);
    btn.appendChild(style);
    btn.addEventListener("click", () => {
      resetAttractIdle();
      ensureAudio();
      playSound("select");
      if (!p1Pick) {
        p1Pick = cat;
        p1SelectedEl.textContent = isSinglePlayer()
          ? `Player 1 (CPU): ${cat.name}`
          : `Player 1: ${cat.name}`;
      } else if (!p2Pick) {
        p2Pick = cat;
        p2SelectedEl.textContent = isSinglePlayer()
          ? `Player 2 (You): ${cat.name}`
          : `Player 2: ${cat.name}`;
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
  const token = ++countdownToken;
  for (const beat of beats) {
    if (token !== countdownToken) return false;
    announce(beat, 55);
    playSound(beat === "Play!" ? "fight" : "tick");
    await new Promise((resolve) => {
      window.setTimeout(resolve, 650);
    });
  }
  return token === countdownToken;
}

function maybeStartFromSelection() {
  gameMode = selectedGameMode();

  if (!p1Pick) {
    updateMatchStatus("Match: Select cats to begin");
    return;
  }

  if (!p2Pick) {
    const waitText = isSinglePlayer()
      ? "Waiting for your Player 2 pick..."
      : "Waiting for second pick...";
    updateMatchStatus(`Match: ${waitText}`);
    return;
  }

  matchLengthEls.forEach((el) => {
    el.disabled = true;
  });
  gameModeEls.forEach((el) => {
    el.disabled = true;
  });

  maxRounds = selectedMatchLength();
  roundsToWin = Math.floor(maxRounds / 2) + 1;
  p1RoundsWon = 0;
  p2RoundsWon = 0;

  const p1MatchName = isSinglePlayer() ? `CPU (${p1Pick.name})` : p1Pick.name;
  const p2MatchName = isSinglePlayer() ? `You (${p2Pick.name})` : p2Pick.name;

  updateMatchStatus(
    `Match: ${p1MatchName} vs ${p2MatchName} — First to ${roundsToWin} round${roundsToWin > 1 ? "s" : ""}`
  );

  showFightScreen();
  resetRound(false);
  roundStarted = false;
  void startCountdown().then((canStart) => {
    if (!canStart) return;
    roundStarted = true;
    announce("FIGHT! 🐾", 90);
  });
}

function evaluateRoundResult() {
  let roundWinner = 0;
  if (player1.stamina <= 0 && player2.stamina <= 0) roundWinner = 0;
  else if (player1.stamina <= 0) roundWinner = 2;
  else if (player2.stamina <= 0) roundWinner = 1;
  else if (player1.stamina > player2.stamina) roundWinner = 1;
  else if (player2.stamina > player1.stamina) roundWinner = 2;

  // Draws replay without awarding a point, so best-of-three always progresses.
  roundDraw = roundWinner === 0;
  if (isExhibition) {
    matchEnded = true;
    updateMatchStatus(`CPU Exhibition complete: ${player1.name} ${player1.stamina} - ${player2.stamina} ${player2.name}`);
    announce(roundDraw ? "EXHIBITION DRAW" : "EXHIBITION COMPLETE! 🏆", 99999);
    playSound(roundDraw ? "block" : "roundWin");
    const token = exhibitionToken;
    exhibitionReturnTimer = window.setTimeout(() => {
      if (isExhibition && exhibitionToken === token) exitExhibition();
    }, 2600);
    return;
  }
  if (roundWinner === 1) p1RoundsWon++;
  if (roundWinner === 2) p2RoundsWon++;

  matchEnded = p1RoundsWon >= roundsToWin || p2RoundsWon >= roundsToWin;
  const p1StatusName = isSinglePlayer() ? `CPU ${player1.name}` : player1.name;
  const p2StatusName = isSinglePlayer() ? `You ${player2.name}` : player2.name;
  const resultText = roundDraw
    ? "Round draw. Replay the round to decide it."
    : matchEnded
      ? `${p1StatusName} ${p1RoundsWon} - ${p2RoundsWon} ${p2StatusName} — match complete!`
      : `Round won. ${p1StatusName} ${p1RoundsWon} - ${p2RoundsWon} ${p2StatusName}`;
  updateMatchStatus(`Match: ${resultText}`);
  announce(roundDraw ? "DRAW! Replay round" : matchEnded ? "MATCH WIN! 🏆" : "ROUND WIN! 🏆", 99999);
  playSound(matchEnded ? "matchWin" : roundDraw ? "block" : "roundWin");
  updateRoundButton();
}

function resetToSelection() {
  if (isExhibition) {
    exitExhibition();
    return;
  }
  countdownToken++;
  clearAllInput();
  p1Pick = null;
  p2Pick = null;
  p1SelectedEl.textContent = "Player 1: Not selected";
  p2SelectedEl.textContent = "Player 2: Not selected";
  matchLengthEls.forEach((el) => {
    el.disabled = false;
  });
  gameModeEls.forEach((el) => {
    el.disabled = false;
  });
  gameMode = selectedGameMode();
  updateMatchStatus("Match: Select cats to begin");
  showSelectScreen();
  resetRound(false);
  updateModeUi();
  renderCatOptions();
}

function updateHud() {
  p1StaminaEl.textContent = `${isSinglePlayer() ? "CPU" : "P1"} Stamina: ${player1.stamina}`;
  p2StaminaEl.textContent = `${isSinglePlayer() ? "You" : "P2"} Stamina: ${player2.stamina}`;
  timerEl.textContent = `Time: ${timeLeft}`;
  updateSignatureCooldown(player1, p1SignatureCooldownEl, isSinglePlayer() ? "CPU" : "P1");
  updateSignatureCooldown(player2, p2SignatureCooldownEl, isSinglePlayer() ? "You" : "P2");
}

function updateSignatureCooldown(cat, element, label) {
  if (!cat.signature) {
    element.textContent = `${label} Signature: Unavailable`;
    return;
  }
  const remaining = Math.ceil(cat.signatureCooldownMs / 1000);
  element.classList.toggle("cooling", remaining > 0);
  element.textContent = remaining > 0
    ? `${label} Signature: Cooling down (${remaining}s)`
    : `${label} Signature: Ready (${cat.signature.name})`;
}

function updateAiInput(ai, enemy) {
  clearControlKeys(ai);

  const horizontalGap = enemy.x - ai.x;
  const absGap = Math.abs(horizontalGap);

  if (absGap > 72) {
    keys.add(horizontalGap > 0 ? ai.controls.right : ai.controls.left);
  } else if (Math.random() < 0.35) {
    keys.add(horizontalGap > 0 ? ai.controls.left : ai.controls.right);
  }

  if (ai.y >= FLOOR_Y && Math.random() < 0.012) {
    keys.add(ai.controls.jump);
  }

  if (absGap < 95 && Math.random() < 0.11) {
    keys.add(ai.controls.attack);
  }

  if (absGap < 70 && Math.random() < 0.05) {
    keys.add(ai.controls.hind);
  }

  if (absGap >= 85 && Math.random() < 0.06) {
    keys.add(ai.controls.ranged);
  }

  if (ai.signature && ai.signatureCooldownMs === 0) {
    const useful = absGap <= ai.signature.range ||
      ["snowballRoll", "whiskerWave", "longhairLasso"].includes(ai.signature.id) ||
      (ai.signature.id === "mistyVeil" && (isEnemyStriking(enemy) || ai.stamina < 55));
    if (useful && Math.random() < (isExhibition ? 0.025 : 0.012)) keys.add(ai.controls.signature);
  }
}

function drawAttackLimb(cat) {
  const animation = cat.attackAnimation;
  if (!animation) return;
  const phase = animation.frame / animation.duration;
  const extension = phase < 0.25
    ? phase / 0.25 * 0.2
    : phase < 0.65
      ? 0.2 + (phase - 0.25) / 0.4 * 0.8
      : Math.max(0, 1 - (phase - 0.65) / 0.35);
  const direction = cat.facing;
  const reach = (animation.type === "hind" ? 45 : 54) * extension;
  const startX = animation.type === "hind" ? 27 : 40;
  const startY = animation.type === "hind" ? 57 : 48;
  ctx.strokeStyle = animation.type === "hind" ? "#8c5b46" : cat.color;
  ctx.lineWidth = animation.type === "hind" ? 12 : 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(startX + direction * reach, startY + (animation.type === "hind" ? 3 : -5));
  ctx.stroke();
  ctx.fillStyle = animation.type === "hind" ? "#f2bd9d" : "#fff3f8";
  ctx.beginPath();
  ctx.arc(startX + direction * reach, startY + (animation.type === "hind" ? 3 : -5), animation.type === "hind" ? 8 : 7, 0, Math.PI * 2);
  ctx.fill();
}

function drawSignatureEffects() {
  for (const effect of visualEffects) {
    const cat = effect.owner;
    const progress = 1 - effect.life / effect.maxLife;
    const x = cat.x + cat.w / 2;
    const y = cat.y + 32;
    ctx.save();
    ctx.globalAlpha = Math.min(1, effect.life / 12);
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    if (effect.type === "sunbeamPounce") {
      ctx.strokeStyle = "#ffd447";
      ctx.beginPath(); ctx.moveTo(x - cat.facing * 8, y - 22); ctx.lineTo(x + cat.facing * 42, y - 38); ctx.stroke();
    } else if (effect.type === "mistyVeil") {
      ctx.fillStyle = "#d8f4ff88"; ctx.beginPath(); ctx.arc(x, y, 42 + progress * 8, 0, Math.PI * 2); ctx.fill();
    } else if (effect.type === "shadowFeint") {
      ctx.strokeStyle = "#8d7bff"; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(x, y, 28 + progress * 20, 0, Math.PI * 2); ctx.stroke();
    } else if (effect.type === "calicoConfetti") {
      ctx.fillStyle = "#ff7caa";
      for (let i = 0; i < 8; i++) { const angle = i * Math.PI / 4; ctx.fillRect(x + Math.cos(angle) * (15 + progress * 35), y + Math.sin(angle) * (15 + progress * 35), 6, 6); }
    } else if (effect.type === "cocoaClobber") {
      ctx.strokeStyle = "#9b6848"; ctx.beginPath(); ctx.arc(x + cat.facing * 28, y + 8, 28 + progress * 12, 0, Math.PI * 2); ctx.stroke();
    } else if (effect.type === "muffinBounce") {
      ctx.strokeStyle = "#ffb7d2"; ctx.beginPath(); ctx.arc(x, y + 28, 20 + progress * 20, 0, Math.PI * 2); ctx.stroke();
    } else if (effect.type === "longhairLasso") {
      ctx.strokeStyle = "#f6e7ff"; ctx.beginPath(); ctx.arc(x + cat.facing * 60, y, 28, 0, Math.PI * 1.6); ctx.stroke();
    } else if (effect.type === "mintyZoomies") {
      ctx.strokeStyle = "#73e4c2"; ctx.beginPath(); ctx.moveTo(x - cat.facing * 35, y + 25); ctx.quadraticCurveTo(x, y - 20, x + cat.facing * 35, y + 20); ctx.stroke();
    } else if (effect.type === "whiskerWave") {
      ctx.strokeStyle = "#c7a9ff"; ctx.beginPath(); ctx.arc(x + cat.facing * 50, y, 25 + progress * 15, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    }
    ctx.restore();
  }
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

  drawAttackLimb(cat);

  if (cat.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.75, cat.hitFlash / 12)})`;
    ctx.fillRect(4, 0, 60, 72);
  }

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
  for (const p of projectiles) {
    const center = p.size / 2;
    ctx.save();
    ctx.translate(p.x + center, p.y + center);
    p.spin = (p.spin || 0) + 0.16;
    ctx.rotate(p.spin);
    ctx.fillStyle = p.kind === "snowball" ? "#e8f8ff" : p.kind === "wave" ? "#c7a9ff" : "#ff86b2";
    ctx.beginPath(); ctx.arc(0, 0, center, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = p.kind === "snowball" ? "#82cce7" : "#fff7fb";
    ctx.lineWidth = 2;
    for (let strand = 0; strand < 3; strand++) {
      ctx.beginPath();
      ctx.arc(0, 0, center - 3 - strand * 2, strand * 0.8, Math.PI * 1.6 + strand * 0.7);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(center - 2, center - 1); ctx.quadraticCurveTo(center + 12, center + 8, center + 6, center + 17); ctx.stroke();
    ctx.fillStyle = "#ffffffaa"; ctx.beginPath(); ctx.arc(-center * 0.3, -center * 0.35, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
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

function drawParticles() {
  for (const particle of particles) {
    ctx.globalAlpha = particle.life / 22;
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x - 2, particle.y - 2, 5, 5);
  }
  ctx.globalAlpha = 1;
}

function updateRoundTimer(timestamp) {
  if (lastFrameTime === null) {
    lastFrameTime = timestamp;
    return;
  }
  const delta = Math.min(100, Math.max(0, timestamp - lastFrameTime));
  lastFrameTime = timestamp;
  roundElapsedMs += delta;
  timeLeft = Math.max(0, ROUND_TIME - Math.floor(roundElapsedMs / 1000));
}

function finishRound() {
  if (roundOver) return;
  roundOver = true;
  announce(decideWinner(), 99999);
  evaluateRoundResult();
}

function loop(timestamp) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawArena();
  updateAttractMode(timestamp);

  if (!roundOver && roundStarted) {
    updateRoundTimer(timestamp);
    updateCooldowns();
    if (isExhibition) {
      updateAiInput(player1, player2);
      updateAiInput(player2, player1);
    } else if (isSinglePlayer()) {
      updateAiInput(player1, player2);
    }

    if (hitStopMs > 0) {
      hitStopMs = Math.max(0, hitStopMs - 16.67);
    } else {
      handleInput(player1, player2);
      handleInput(player2, player1);
      updateAttackAnimations();
      updateSignatureAnimations();
      updateCat(player1);
      updateCat(player2);
      updateProjectiles();
      updatePopups();
      updateParticles();
    }

    if (player1.stamina <= 0 || player2.stamina <= 0 || timeLeft <= 0) {
      finishRound();
    }
  }

  drawProjectiles();
  drawSignatureEffects();
  drawCat(player1);
  drawCat(player2);
  drawParticles();
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
  if (isExhibition) {
    e.preventDefault();
    exitExhibition();
    return;
  }
  resetAttractIdle();
  ensureAudio();
  if (isSinglePlayer() && Object.values(player1.controls).includes(e.code)) {
    e.preventDefault();
    return;
  }

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
    ensureAudio();
    keys.add(key);
    if (e.pointerId !== undefined && btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
  };
  const release = (e) => {
    e.preventDefault();
    keys.delete(key);
  };
  btn.addEventListener("pointerdown", press);
  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointercancel", release);
  btn.addEventListener("lostpointercapture", release);
});

window.addEventListener("blur", clearAllInput);
document.addEventListener("visibilitychange", () => {
  clearAllInput();
  lastFrameTime = null;
  resetAttractIdle();
});

window.addEventListener("pointerdown", (e) => {
  if (isExhibition) {
    e.preventDefault();
    exitExhibition();
    return;
  }
  resetAttractIdle();
}, true);

window.addEventListener("pointermove", (e) => {
  const position = `${e.clientX}:${e.clientY}`;
  if (!isExhibition && position !== lastPointerPosition) {
    lastPointerPosition = position;
    resetAttractIdle();
  }
});

soundToggleEl.addEventListener("click", toggleSound);

resetButton.addEventListener("click", () => {
  ensureAudio();
  playSound("button");
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
    resetAttractIdle();
    if (!p1Pick || !p2Pick) {
      const rounds = Number(el.value);
      const needed = Math.floor(rounds / 2) + 1;
      updateMatchStatus(`Match: ${rounds === 1 ? "Single round" : "Best of 3"} selected (first to ${needed})`);
    }
  });
});

gameModeEls.forEach((el) => {
  el.addEventListener("change", () => {
    resetAttractIdle();
    if (p1Pick || p2Pick) return;

    gameMode = selectedGameMode();
    updateModeUi();
    const modeText = isSinglePlayer() ? "1 Player vs CPU" : "2 Players";
    updateMatchStatus(`Match: ${modeText} selected`);
    renderCatOptions();
  });
});

attractModeSeconds = [0, 30, 60, 120].includes(attractModeSeconds) ? attractModeSeconds : 60;
attractModeEl.value = String(attractModeSeconds);
attractModeEl.addEventListener("change", () => {
  attractModeSeconds = Number(attractModeEl.value);
  localStorage.setItem("catFightAttractMode", String(attractModeSeconds));
  resetAttractIdle();
  announce(attractModeSeconds ? `Attract demo set for ${attractModeSeconds} seconds.` : "Attract demo off.", 60);
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

    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).catch(() => {
      // ignore registration failure
    });
  });
}

showSelectScreen();
gameMode = selectedGameMode();
updateModeUi();
renderCatOptions();
resetRound(false);
p1SelectedEl.textContent = "Player 1: Not selected";
updateMatchStatus("Match: Select cats to begin");
updateSoundToggle();
loop();
