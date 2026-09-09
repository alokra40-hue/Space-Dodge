"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreValue = document.getElementById("scoreValue");
const runCoinsValue = document.getElementById("runCoinsValue");
const highScoreValue = document.getElementById("highScoreValue");
const livesValue = document.getElementById("livesValue");
const cooldownHud = document.getElementById("cooldownHud");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const soundToggle = document.getElementById("soundToggle");
const nameInput = document.getElementById("playerNameInput");
const leaderboardList = document.getElementById("leaderboardList");
const leaderboardNote = document.getElementById("leaderboardNote");

const LEADERBOARD_KEY = "spaceDodgeLeaderboard";
const PLAYER_NAME_KEY = "spaceDodgePlayerName";
const SOUND_KEY = "spaceDodgeSound";
const COINS_KEY = "spaceDodgeCoins";
const SKINS_KEY = "spaceDodgeUnlockedSkins";
const SELECTED_SKIN_KEY = "spaceDodgeSelectedSkin";
const SKINS = {
  sky: { name: "Sky Runner", cost: 0, body: "#1d9ac5", cockpit: "#d9fbff", wing: "#0b4f78", flame: "#ff9257" },
  rose: { name: "Nebula Rose", cost: 75, body: "#d73d7b", cockpit: "#ffe0ef", wing: "#721d52", flame: "#a98bff" },
  gold: { name: "Solar Strike", cost: 200, body: "#d89a20", cockpit: "#fff4c3", wing: "#784510", flame: "#ffef72" },
  phantom: { name: "Void Phantom", cost: 325, body: "#7655c9", cockpit: "#ece3ff", wing: "#31205f", flame: "#bb9cff" },
  toxic: { name: "Toxic Nova", cost: 500, body: "#51be4a", cockpit: "#e4ffd0", wing: "#1d6127", flame: "#aaff54" },
  arctic: { name: "Arctic Pulse", cost: 750, body: "#74cce8", cockpit: "#f2ffff", wing: "#276b91", flame: "#e7ffff" },
  violet: { name: "Violet Viper", cost: 1000, body: "#a248c8", cockpit: "#ffe5ff", wing: "#54156c", flame: "#e29aff" },
  crimson: { name: "Crimson Comet", cost: 1500, body: "#dc383d", cockpit: "#ffe1df", wing: "#76131b", flame: "#ff9b47" }
};
const keys = { left: false, right: false };
let gameState = "ready", lastTime = 0, spawnTimer = 0, powerupTimer = 5, coinTimer = 1.2, elapsedTime = 0;
let score = 0, runCoins = 0, totalCoins = Math.max(0, Number(localStorage.getItem(COINS_KEY) || 0) || 0), lives = 3, highScore = Number(localStorage.getItem("spaceDodgeHighScore") || 0);
let dodgeCooldown = 0, dodgeTime = 0, invulnerable = 0, shieldTime = 0, boostTime = 0, shakeTime = 0;
let soundOn = localStorage.getItem(SOUND_KEY) !== "off", audioCtx = null, enemies = [], powerups = [], coins = [], particles = [], scoreRecorded = false;
let unlockedSkins = getUnlockedSkins();
let selectedSkin = unlockedSkins.includes(localStorage.getItem(SELECTED_SKIN_KEY)) ? localStorage.getItem(SELECTED_SKIN_KEY) : "sky";
let player = createPlayer();
const stars = Array.from({ length: 90 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: 1 + Math.random() * 2, speed: 18 + Math.random() * 45 }));

function createPlayer() { return { x: canvas.width / 2 - 22, y: canvas.height - 78, width: 44, height: 34, speed: 320, tilt: 0 }; }
function getUnlockedSkins() {
  try {
    const saved = JSON.parse(localStorage.getItem(SKINS_KEY) || "[\"sky\"]");
    return [...new Set(["sky", ...(Array.isArray(saved) ? saved.filter(id => Object.hasOwn(SKINS, id)) : [])])];
  } catch (_) { return ["sky"]; }
}
function cleanName(value) { return (value || "Pilot").replace(/[^a-z0-9 _-]/gi, "").trim().slice(0, 14) || "Pilot"; }
function getName() { return cleanName(localStorage.getItem(PLAYER_NAME_KEY)); }
function getLeaderboard() {
  try {
    const saved = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter(entry => Number.isFinite(entry.score) && typeof entry.name === "string").slice(0, 10) : [];
  } catch (_) { return []; }
}
function renderLeaderboard() {
  const board = getLeaderboard();
  nameInput.value = getName();
  leaderboardList.replaceChildren();
  if (!board.length) {
    const item = document.createElement("li"); item.className = "empty-board"; item.textContent = "No scores yet — start a run!"; leaderboardList.append(item);
  } else {
    board.forEach(entry => { const item = document.createElement("li"); item.innerHTML = `<span>${cleanName(entry.name)}</span><b>${Math.floor(entry.score)}</b>`; leaderboardList.append(item); });
  }
  leaderboardNote.textContent = board.length ? "Only the best ten scores are kept on this device." : "Your next qualifying run will appear here.";
}
function saveName() { localStorage.setItem(PLAYER_NAME_KEY, cleanName(nameInput.value)); renderLeaderboard(); beep(580, .05, "sine"); }
function recordScore() {
  if (scoreRecorded) return; scoreRecorded = true;
  const finalScore = Math.floor(score); if (finalScore < 1) return;
  const board = getLeaderboard();
  board.push({ name: getName(), score: finalScore, time: Date.now() });
  board.sort((a, b) => b.score - a.score || a.time - b.time);
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(board.slice(0, 10)));
  renderLeaderboard();
}
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(screen => screen.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  if (id === "homeScreen") document.getElementById("homeBestScore").textContent = highScore;
  if (id === "leaderboardScreen") renderLeaderboard();
  if (id === "settingsScreen") syncSoundButtons();
  if (id === "skinsScreen") { syncCoinUi(); syncSkins(); }
}
function syncSoundButtons() {
  document.getElementById("homeSoundBtn").textContent = soundOn ? "🔊" : "🔇";
  soundToggle.textContent = soundOn ? "🔊 Sound" : "🔇 Muted";
  const setting = document.getElementById("settingsSoundBtn"); setting.textContent = soundOn ? "ON" : "OFF"; setting.setAttribute("aria-pressed", String(soundOn));
}
function syncCoinUi() {
  document.getElementById("homeCoins").textContent = totalCoins;
  document.getElementById("skinsCoinBalance").textContent = totalCoins;
}
function syncSkins() {
  document.querySelectorAll("[data-skin]").forEach(card => {
    const id = card.dataset.skin, skin = SKINS[id], unlocked = unlockedSkins.includes(id), selected = selectedSkin === id;
    card.classList.toggle("locked", !unlocked); card.classList.toggle("selected", selected);
    const status = card.querySelector("[data-skin-status]");
    status.textContent = selected ? "EQUIPPED" : unlocked ? "OWNED • EQUIP" : `${skin.cost} COINS`;
    card.setAttribute("aria-label", `${skin.name}: ${status.textContent}`);
  });
}
function chooseSkin(id) {
  const skin = SKINS[id]; if (!skin) return;
  if (!unlockedSkins.includes(id)) {
    if (totalCoins < skin.cost) { document.getElementById("skinsMessage").textContent = `Need ${skin.cost - totalCoins} more coins for ${skin.name}.`; beep(180, .1, "sawtooth"); return; }
    totalCoins -= skin.cost; unlockedSkins.push(id); localStorage.setItem(COINS_KEY, totalCoins); localStorage.setItem(SKINS_KEY, JSON.stringify(unlockedSkins)); document.getElementById("skinsMessage").textContent = `${skin.name} unlocked! Equipped for your next run.`; beep(980, .11, "triangle");
  } else { document.getElementById("skinsMessage").textContent = `${skin.name} equipped.`; beep(680, .06, "sine"); }
  selectedSkin = id; localStorage.setItem(SELECTED_SKIN_KEY, selectedSkin); syncCoinUi(); syncSkins();
}
function setSound(enabled) { soundOn = enabled; localStorage.setItem(SOUND_KEY, enabled ? "on" : "off"); syncSoundButtons(); if (enabled) { ensureAudio(); beep(600, .06, "sine"); } }

function startGame() {
  showScreen("gameScreen"); player = createPlayer(); enemies = []; powerups = []; coins = []; particles = [];
  spawnTimer = 0; powerupTimer = 5; coinTimer = 1.2; elapsedTime = 0; score = 0; runCoins = 0; lives = 3; dodgeCooldown = 0; dodgeTime = 0; invulnerable = 0; shieldTime = 0; boostTime = 0; shakeTime = 0; scoreRecorded = false;
  gameState = "playing"; lastTime = performance.now(); pauseBtn.textContent = "PAUSE"; startBtn.textContent = "RESTART"; ensureAudio(); beep(520, .07, "sine"); updateHud(); requestAnimationFrame(gameLoop);
}
function gameLoop(time) { if (gameState !== "playing") { draw(); return; } const dt = Math.min((time - lastTime) / 1000, .05); lastTime = time; update(dt); draw(); requestAnimationFrame(gameLoop); }
function update(dt) {
  elapsedTime += dt; score += dt * (10 + Math.min(12, elapsedTime * .12)); dodgeCooldown = Math.max(0, dodgeCooldown - dt); dodgeTime = Math.max(0, dodgeTime - dt); invulnerable = Math.max(0, invulnerable - dt); shieldTime = Math.max(0, shieldTime - dt); boostTime = Math.max(0, boostTime - dt); shakeTime = Math.max(0, shakeTime - dt);
  for (const star of stars) { star.y += star.speed * dt * (1 + elapsedTime * .025); if (star.y > canvas.height) { star.y = 0; star.x = Math.random() * canvas.width; } }
  updatePlayer(dt); spawnEnemies(dt); updateEnemies(dt); spawnPowerups(dt); updatePowerups(dt); spawnCoins(dt); updateCoins(dt); updateParticles(dt); checkCollisions(); updateHud();
}
function updatePlayer(dt) { const direction = (keys.right ? 1 : 0) - (keys.left ? 1 : 0); const speed = player.speed * (boostTime ? 1.7 : 1) * (dodgeTime ? 2.8 : 1); player.x = Math.max(0, Math.min(canvas.width - player.width, player.x + direction * speed * dt)); player.tilt += (direction * .16 - player.tilt) * Math.min(1, dt * 9); }
function spawnEnemies(dt) {
  spawnTimer += dt; const interval = Math.max(.24, .72 - elapsedTime * .009); if (spawnTimer < interval) return; spawnTimer = 0;
  const width = 25 + Math.random() * 30, height = 25 + Math.random() * 30;
  enemies.push({ x: Math.random() * (canvas.width - width), y: -height, width, height, speed: 175 + Math.random() * 135 + elapsedTime * 4, rotation: Math.random() * Math.PI, color: Math.random() > .5 ? "#ff4f70" : "#ff9257" });
}
function updateEnemies(dt) { enemies.forEach(enemy => { enemy.y += enemy.speed * dt; enemy.rotation += dt * 1.8; }); enemies = enemies.filter(enemy => enemy.y < canvas.height + enemy.height); }
function spawnPowerups(dt) { powerupTimer += dt; if (powerupTimer < 8) return; powerupTimer = 0; powerups.push({ type: Math.random() < .5 ? "shield" : "boost", x: 22 + Math.random() * (canvas.width - 44), y: -24, size: 20, speed: 125, pulse: Math.random() * 6.28 }); }
function updatePowerups(dt) { powerups.forEach(powerup => { powerup.y += powerup.speed * dt; powerup.pulse += dt * 5; }); powerups = powerups.filter(powerup => powerup.y < canvas.height + 30); }
function spawnCoins(dt) {
  coinTimer += dt;
  const interval = Math.max(.75, 1.65 - elapsedTime * .006);
  if (coinTimer < interval) return;
  coinTimer = 0;
  const size = 12;
  coins.push({ x: size + Math.random() * (canvas.width - size * 2), y: -size, size, speed: 135 + Math.random() * 45 + elapsedTime * 1.4, spin: Math.random() * 6.28 });
}
function updateCoins(dt) { coins.forEach(coin => { coin.y += coin.speed * dt; coin.spin += dt * 7; }); coins = coins.filter(coin => coin.y < canvas.height + coin.size); }
function overlap(a, b) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }
function checkCollisions() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i]; if (!overlap(player, enemy)) continue;
    if (dodgeTime || invulnerable) { burst(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 8, enemy.color); enemies.splice(i, 1); score += 25; beep(760, .04, "square"); continue; }
    if (shieldTime) { shieldTime = 0; invulnerable = 1; burst(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 18, "#73e8ff"); enemies.splice(i, 1); score += 30; shakeTime = .15; beep(860, .1, "sine"); continue; }
    lives--; invulnerable = 1.35; shakeTime = .25; burst(player.x + player.width / 2, player.y + player.height / 2, 22, "#ff607e"); enemies.splice(i, 1); beep(130, .16, "sawtooth"); if (lives <= 0) { gameOver(); return; }
  }
  for (let i = powerups.length - 1; i >= 0; i--) { const powerup = powerups[i], box = { x: powerup.x - powerup.size, y: powerup.y - powerup.size, width: powerup.size * 2, height: powerup.size * 2 }; if (!overlap(player, box)) continue; if (powerup.type === "shield") shieldTime = 7; else boostTime = 6; score += 50; burst(powerup.x, powerup.y, 16, powerup.type === "shield" ? "#64e7ff" : "#ffe16b"); beep(980, .08, "triangle"); powerups.splice(i, 1); }
  for (let i = coins.length - 1; i >= 0; i--) {
    const coin = coins[i], box = { x: coin.x - coin.size, y: coin.y - coin.size, width: coin.size * 2, height: coin.size * 2 };
    if (!overlap(player, box)) continue;
    runCoins++; totalCoins++; localStorage.setItem(COINS_KEY, totalCoins); score += 15;
    burst(coin.x, coin.y, 10, "#ffe16b"); coins.splice(i, 1); beep(1080, .06, "triangle"); syncCoinUi();
  }
}
function dodge() { if (gameState !== "playing" || dodgeCooldown) return; dodgeCooldown = 3.2; dodgeTime = .55; invulnerable = .6; const direction = keys.left ? -1 : keys.right ? 1 : (Math.random() < .5 ? -1 : 1); player.x = Math.max(0, Math.min(canvas.width - player.width, player.x + direction * 105)); burst(player.x + player.width / 2, player.y + player.height, 16, "#9c7cff"); beep(720, .09, "triangle"); }
function gameOver() { gameState = "gameover"; const finalScore = Math.floor(score); if (finalScore > highScore) { highScore = finalScore; localStorage.setItem("spaceDodgeHighScore", highScore); } recordScore(); beep(90, .25, "sawtooth"); updateHud(); draw(); }
function togglePause() { if (gameState === "playing") { gameState = "paused"; pauseBtn.textContent = "RESUME"; draw(); } else if (gameState === "paused") { gameState = "playing"; pauseBtn.textContent = "PAUSE"; lastTime = performance.now(); requestAnimationFrame(gameLoop); } }

function draw() {
  ctx.save(); if (shakeTime) ctx.translate((Math.random() - .5) * 8, (Math.random() - .5) * 8); const background = ctx.createLinearGradient(0, 0, 0, canvas.height); background.addColorStop(0, "#0b1230"); background.addColorStop(1, "#030510"); ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(83,230,255,.06)"; for (let y = 70; y < canvas.height; y += 55) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
  stars.forEach(star => { ctx.fillStyle = `rgba(210,235,255,${.35 + star.size / 3})`; ctx.fillRect(star.x, star.y, star.size, star.size * 1.7); }); drawCoins(); drawPowerups(); drawEnemies(); drawPlayer(); drawParticles(); ctx.restore();
  if (gameState === "ready") overlay("SPACE DODGE", "Press START or SPACE to play"); if (gameState === "paused") overlay("PAUSED", "Press PAUSE / Space to resume"); if (gameState === "gameover") overlay("GAME OVER", `Score: ${Math.floor(score)} • Best: ${highScore}`);
}
function drawPlayer() {
  const skin = SKINS[selectedSkin] || SKINS.sky;
  ctx.save(); ctx.translate(player.x + player.width / 2, player.y + player.height / 2); ctx.rotate(player.tilt); ctx.translate(-player.width / 2, -player.height / 2);
  if (shieldTime || dodgeTime) { ctx.beginPath(); ctx.arc(player.width / 2, player.height / 2, 34 + Math.sin(elapsedTime * 8) * 2, 0, Math.PI * 2); ctx.strokeStyle = dodgeTime ? "#b796ff" : "#62e9ff"; ctx.lineWidth = 3; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 18; ctx.stroke(); }
  ctx.shadowColor = skin.body; ctx.shadowBlur = 18; ctx.fillStyle = skin.body; ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(42, 30); ctx.lineTo(32, 28); ctx.lineTo(27, 34); ctx.lineTo(17, 34); ctx.lineTo(12, 28); ctx.lineTo(2, 30); ctx.closePath(); ctx.fill();
  ctx.fillStyle = skin.cockpit; ctx.beginPath(); ctx.moveTo(22, 5); ctx.lineTo(31, 23); ctx.lineTo(13, 23); ctx.closePath(); ctx.fill(); ctx.fillStyle = skin.wing; ctx.fillRect(8, 23, 9, 8); ctx.fillRect(27, 23, 9, 8); ctx.fillStyle = boostTime ? "#ffe16b" : skin.flame;
  [[15, 19], [25, 29]].forEach(([left, right]) => { ctx.beginPath(); ctx.moveTo(left, 31); ctx.lineTo(right, 31); ctx.lineTo((left + right) / 2, 42 + Math.random() * 5); ctx.closePath(); ctx.fill(); }); ctx.restore();
}
function drawEnemies() { enemies.forEach(enemy => { ctx.save(); ctx.translate(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2); ctx.rotate(enemy.rotation); ctx.shadowColor = enemy.color; ctx.shadowBlur = 14; ctx.fillStyle = enemy.color; ctx.fillRect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height); ctx.fillStyle = "#351225"; ctx.fillRect(-enemy.width * .28, -enemy.height * .22, enemy.width * .18, enemy.height * .18); ctx.fillRect(enemy.width * .1, -enemy.height * .22, enemy.width * .18, enemy.height * .18); ctx.restore(); }); }
function drawPowerups() { powerups.forEach(powerup => { ctx.save(); ctx.translate(powerup.x, powerup.y); const size = powerup.size + Math.sin(powerup.pulse) * 2; ctx.shadowColor = powerup.type === "shield" ? "#64e7ff" : "#ffe16b"; ctx.shadowBlur = 18; ctx.fillStyle = ctx.shadowColor; ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#102044"; ctx.font = "bold 17px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(powerup.type === "shield" ? "S" : "⚡", 0, 1); ctx.restore(); }); }
function drawCoins() { coins.forEach(coin => { ctx.save(); ctx.translate(coin.x, coin.y); ctx.scale(.72 + Math.abs(Math.sin(coin.spin)) * .28, 1); ctx.shadowColor = "#ffe16b"; ctx.shadowBlur = 13; ctx.fillStyle = "#f6c941"; ctx.beginPath(); ctx.arc(0, 0, coin.size, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = "#fff0a1"; ctx.stroke(); ctx.fillStyle = "#9d6410"; ctx.font = "bold 15px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("●", 0, 1); ctx.restore(); }); }
function drawParticles() { particles.forEach(particle => { ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife); ctx.fillStyle = particle.color; ctx.fillRect(particle.x, particle.y, particle.size, particle.size); }); ctx.globalAlpha = 1; }
function overlay(title, subtitle) { ctx.fillStyle = "rgba(2,5,18,.78)"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.textAlign = "center"; ctx.fillStyle = "#77e8ff"; ctx.font = "bold 38px Arial"; ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 42); ctx.fillStyle = "#fff"; ctx.font = "16px Arial"; ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 2); ctx.fillStyle = "#9da9ca"; ctx.font = "14px Arial"; ctx.fillText("Avoid blocks • Collect power-ups • Beat your best", canvas.width / 2, canvas.height / 2 + 34); }
function burst(x, y, count, color) { for (let i = 0; i < count; i++) { const angle = Math.random() * Math.PI * 2, speed = 40 + Math.random() * 180; particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: 2 + Math.random() * 4, life: .25 + Math.random() * .55, maxLife: .8, color }); } }
function updateParticles(dt) { particles.forEach(particle => { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vx *= .985; particle.vy *= .985; particle.life -= dt; }); particles = particles.filter(particle => particle.life > 0); }
function updateHud() { scoreValue.textContent = Math.floor(score); runCoinsValue.textContent = runCoins; highScoreValue.textContent = highScore; livesValue.textContent = "❤️".repeat(lives) + "🖤".repeat(Math.max(0, 3 - lives)); cooldownHud.textContent = dodgeCooldown ? `Dodge: ${dodgeCooldown.toFixed(1)}s` : "Dodge: READY"; }
function ensureAudio() { if (!soundOn) return; if (!audioCtx) { const Audio = window.AudioContext || window.webkitAudioContext; if (Audio) audioCtx = new Audio(); } if (audioCtx?.state === "suspended") audioCtx.resume(); }
function beep(frequency, duration, type) { if (!soundOn) return; ensureAudio(); if (!audioCtx) return; const oscillator = audioCtx.createOscillator(), gain = audioCtx.createGain(); oscillator.type = type; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.045, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration); oscillator.connect(gain); gain.connect(audioCtx.destination); oscillator.start(); oscillator.stop(audioCtx.currentTime + duration); }
function bindHold(id, down, up) { const button = document.getElementById(id); ["pointerdown", "touchstart"].forEach(event => button.addEventListener(event, e => { e.preventDefault(); down(); }, { passive: false })); ["pointerup", "pointercancel", "pointerleave", "touchend"].forEach(event => button.addEventListener(event, e => { e.preventDefault(); up(); }, { passive: false })); }

bindHold("leftBtn", () => keys.left = true, () => keys.left = false); bindHold("rightBtn", () => keys.right = true, () => keys.right = false); document.getElementById("dodgeBtn").addEventListener("pointerdown", event => { event.preventDefault(); dodge(); });
document.addEventListener("keydown", event => { const key = event.key.toLowerCase(); if (event.code === "ArrowLeft" || key === "a") { keys.left = true; event.preventDefault(); } if (event.code === "ArrowRight" || key === "d") { keys.right = true; event.preventDefault(); } if (event.code === "ShiftLeft" || event.code === "ShiftRight") { dodge(); event.preventDefault(); } if (event.code === "Space") { event.preventDefault(); if (gameState === "ready" || gameState === "gameover") startGame(); else if (gameState === "paused") togglePause(); } });
document.addEventListener("keyup", event => { const key = event.key.toLowerCase(); if (event.code === "ArrowLeft" || key === "a") keys.left = false; if (event.code === "ArrowRight" || key === "d") keys.right = false; });
canvas.addEventListener("pointermove", event => { if (gameState !== "playing" || event.pointerType === "touch") return; const rect = canvas.getBoundingClientRect(), pointerX = (event.clientX - rect.left) * canvas.width / rect.width; player.x = Math.max(0, Math.min(canvas.width - player.width, pointerX - player.width / 2)); });
canvas.addEventListener("click", () => { if (gameState === "ready" || gameState === "gameover") startGame(); }); startBtn.addEventListener("click", startGame); pauseBtn.addEventListener("click", () => { if (gameState !== "ready" && gameState !== "gameover") togglePause(); }); soundToggle.addEventListener("click", () => setSound(!soundOn)); document.getElementById("homeSoundBtn").addEventListener("click", () => setSound(!soundOn)); document.getElementById("settingsSoundBtn").addEventListener("click", () => setSound(!soundOn)); document.getElementById("fullscreenBtn").addEventListener("click", async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch (_) {} }); document.addEventListener("fullscreenchange", () => document.getElementById("fullscreenBtn").textContent = document.fullscreenElement ? "EXIT" : "OPEN"); document.getElementById("homeBtn").addEventListener("click", () => { gameState = "ready"; keys.left = keys.right = false; showScreen("homeScreen"); }); document.getElementById("playBtn").addEventListener("click", startGame); document.getElementById("saveNameBtn").addEventListener("click", saveName); nameInput.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); saveName(); } }); document.querySelectorAll("[data-screen]").forEach(button => button.addEventListener("click", () => showScreen(button.dataset.screen))); window.addEventListener("blur", () => { keys.left = keys.right = false; if (gameState === "playing") togglePause(); });
document.querySelectorAll("[data-skin]").forEach(card => card.addEventListener("click", () => chooseSkin(card.dataset.skin)));
syncSoundButtons(); syncCoinUi(); syncSkins(); renderLeaderboard(); showScreen("homeScreen"); updateHud(); draw();
