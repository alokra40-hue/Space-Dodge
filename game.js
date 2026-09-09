"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreValue = document.getElementById("scoreValue");
const highScoreValue = document.getElementById("highScoreValue");
const livesValue = document.getElementById("livesValue");
const cooldownHud = document.getElementById("cooldownHud");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const soundToggle = document.getElementById("soundToggle");

const keys = { left: false, right: false };
let gameState = "ready";
let lastTime = 0;
let spawnTimer = 0;
let powerupTimer = 0;
let elapsedTime = 0;
let score = 0;
let lives = 3;
let highScore = Number(localStorage.getItem("spaceDodgeHighScore") || 0);
let dodgeCooldown = 0;
let dodgeTime = 0;
let hitInvulnerability = 0;
let shieldTime = 0;
let boostTime = 0;
let shakeTime = 0;
let soundOn = true;
let audioCtx = null;
let particles = [];
let enemies = [];
let powerups = [];
let player = createPlayer();

highScoreValue.textContent = highScore;

const stars = Array.from({ length: 90 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  size: Math.random() * 2 + 1,
  speed: Math.random() * 35 + 12
}));

function createPlayer() {
  return { x: canvas.width / 2 - 22, y: canvas.height - 78, width: 44, height: 34, speed: 320, tilt: 0 };
}

function startGame() {
  player = createPlayer(); enemies = []; powerups = []; particles = [];
  spawnTimer = 0; powerupTimer = 4; elapsedTime = 0; score = 0; lives = 3;
  dodgeCooldown = 0; dodgeTime = 0; hitInvulnerability = 0; shieldTime = 0; boostTime = 0; shakeTime = 0;
  gameState = "playing"; lastTime = performance.now(); pauseBtn.textContent = "PAUSE"; startBtn.textContent = "RESTART";
  ensureAudio(); beep(520, .07, "sine"); updateHud(); requestAnimationFrame(gameLoop);
}

function gameLoop(currentTime) {
  if (gameState !== "playing") { draw(); return; }
  const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.05);
  lastTime = currentTime;
  update(deltaTime); draw();
  requestAnimationFrame(gameLoop);
}

function update(dt) {
  elapsedTime += dt;
  score += dt * (10 + Math.min(elapsedTime * 0.12, 12));
  dodgeCooldown = Math.max(0, dodgeCooldown - dt);
  dodgeTime = Math.max(0, dodgeTime - dt);
  hitInvulnerability = Math.max(0, hitInvulnerability - dt);
  shieldTime = Math.max(0, shieldTime - dt);
  boostTime = Math.max(0, boostTime - dt);
  shakeTime = Math.max(0, shakeTime - dt);

  updateStars(dt); updatePlayer(dt); spawnEnemies(dt); updateEnemies(dt); spawnPowerups(dt); updatePowerups(dt); updateParticles(dt);
  checkCollisions(); updateHud();
}

function updateStars(dt) {
  for (const star of stars) { star.y += star.speed * dt * (1 + elapsedTime * .025); if (star.y > canvas.height) { star.y = 0; star.x = Math.random() * canvas.width; } }
}

function updatePlayer(dt) {
  let direction = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const speed = player.speed * (boostTime > 0 ? 1.7 : 1) * (dodgeTime > 0 ? 2.8 : 1);
  player.x += direction * speed * dt;
  player.tilt += ((direction * .16) - player.tilt) * Math.min(1, dt * 9);
  player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
}

function spawnEnemies(dt) {
  spawnTimer += dt;
  const difficulty = Math.min(elapsedTime / 60, 1);
  const spawnInterval = Math.max(.22, .72 - elapsedTime * .008 - difficulty * .12);
  if (spawnTimer < spawnInterval) return;
  spawnTimer = 0;
  const width = 25 + Math.random() * 30, height = 25 + Math.random() * 30;
  const speed = 175 + Math.random() * 135 + elapsedTime * 4.2;
  enemies.push({ x: Math.random() * (canvas.width - width), y: -height, width, height, speed, rotation: Math.random() * Math.PI, color: Math.random() > .5 ? "#ff4f70" : "#ff9257" });
  if (elapsedTime > 25 && Math.random() < .16) {
    const w = 20 + Math.random() * 20;
    enemies.push({ x: Math.random() * (canvas.width - w), y: -height - 70, width: w, height: w, speed: speed * 1.18, rotation: 0, color: "#ff3d8d" });
  }
}

function updateEnemies(dt) {
  for (const enemy of enemies) { enemy.y += enemy.speed * dt; enemy.rotation += dt * 1.8; }
  enemies = enemies.filter(enemy => enemy.y < canvas.height + enemy.height);
}

function spawnPowerups(dt) {
  powerupTimer += dt;
  if (powerupTimer < 8) return;
  powerupTimer = 0;
  const type = Math.random() < .5 ? "shield" : "boost";
  powerups.push({ type, x: 22 + Math.random() * (canvas.width - 44), y: -24, size: 20, speed: 125, pulse: Math.random() * 6.28 });
}

function updatePowerups(dt) {
  for (const p of powerups) { p.y += p.speed * dt; p.pulse += dt * 5; }
  powerups = powerups.filter(p => p.y < canvas.height + 30);
}

function checkCollisions() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    if (!isColliding(player, enemy)) continue;
    if (dodgeTime > 0 || hitInvulnerability > 0) { burst(enemy.x + enemy.width/2, enemy.y + enemy.height/2, 8, enemy.color); enemies.splice(i, 1); score += 25; beep(760, .04, "square"); continue; }
    if (shieldTime > 0) { shieldTime = 0; hitInvulnerability = 1; burst(enemy.x + enemy.width/2, enemy.y + enemy.height/2, 18, "#73e8ff"); enemies.splice(i, 1); score += 30; shakeTime = .15; beep(860, .1, "sine"); continue; }
    lives--; hitInvulnerability = 1.4; shakeTime = .25; burst(player.x + player.width/2, player.y + player.height/2, 22, "#ff607e"); enemies.splice(i, 1); beep(130, .16, "sawtooth");
    if (lives <= 0) { gameOver(); return; }
  }

  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    const box = { x: p.x - p.size, y: p.y - p.size, width: p.size * 2, height: p.size * 2 };
    if (!isColliding(player, box)) continue;
    if (p.type === "shield") shieldTime = 7; else boostTime = 6;
    score += 50; burst(p.x, p.y, 16, p.type === "shield" ? "#64e7ff" : "#ffe16b"); beep(980, .08, "triangle"); powerups.splice(i, 1);
  }
}

function isColliding(a, b) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }

function dodge() {
  if (gameState !== "playing" || dodgeCooldown > 0) return;
  ensureAudio(); dodgeCooldown = 3.2; dodgeTime = .55; hitInvulnerability = .6;
  const direction = keys.left ? -1 : keys.right ? 1 : (Math.random() < .5 ? -1 : 1);
  player.x += direction * 105; player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
  burst(player.x + player.width/2, player.y + player.height, 16, "#9c7cff"); beep(720, .09, "triangle");
}

function gameOver() {
  gameState = "gameover";
  const finalScore = Math.floor(score);
  if (finalScore > highScore) { highScore = finalScore; localStorage.setItem("spaceDodgeHighScore", highScore); }
  beep(90, .25, "sawtooth"); updateHud(); draw();
}

function togglePause() {
  if (gameState === "playing") { gameState = "paused"; pauseBtn.textContent = "RESUME"; draw(); }
  else if (gameState === "paused") { gameState = "playing"; pauseBtn.textContent = "PAUSE"; lastTime = performance.now(); requestAnimationFrame(gameLoop); }
}

function draw() {
  ctx.save();
  const sx = shakeTime > 0 ? (Math.random() - .5) * 8 : 0;
  const sy = shakeTime > 0 ? (Math.random() - .5) * 8 : 0;
  ctx.translate(sx, sy);
  drawBackground(); drawStars(); drawPowerups(); drawEnemies(); drawPlayer(); drawParticles();
  ctx.restore();
  if (gameState === "ready") drawOverlay("SPACE DODGE", "Press SPACE or START to play");
  if (gameState === "paused") drawOverlay("PAUSED", "Press PAUSE / Space to resume");
  if (gameState === "gameover") drawOverlay("GAME OVER", `Score: ${Math.floor(score)} • Best: ${highScore}`);
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height); gradient.addColorStop(0, "#0b1230"); gradient.addColorStop(1, "#030510");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(83,230,255,.06)"; ctx.lineWidth = 1;
  for (let y = 70; y < canvas.height; y += 55) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
}

function drawStars() { for (const star of stars) { ctx.fillStyle = `rgba(210,235,255,${.35 + star.size/3})`; ctx.fillRect(star.x, star.y, star.size, star.size * 1.7); } }

function drawPlayer() {
  ctx.save(); ctx.translate(player.x + player.width/2, player.y + player.height/2); ctx.rotate(player.tilt); ctx.translate(-player.width/2, -player.height/2);
  if (shieldTime > 0 || dodgeTime > 0) { ctx.beginPath(); ctx.arc(player.width/2, player.height/2, 34 + Math.sin(elapsedTime*8)*2, 0, Math.PI*2); ctx.strokeStyle = dodgeTime > 0 ? "#b796ff" : "#62e9ff"; ctx.lineWidth = 3; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 18; ctx.stroke(); }
  ctx.shadowColor = "#53e6ff"; ctx.shadowBlur = 18;
  ctx.fillStyle = "#1d9ac5"; ctx.beginPath(); ctx.moveTo(22,0); ctx.lineTo(42,30); ctx.lineTo(32,28); ctx.lineTo(27,34); ctx.lineTo(17,34); ctx.lineTo(12,28); ctx.lineTo(2,30); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#d9fbff"; ctx.beginPath(); ctx.moveTo(22,5); ctx.lineTo(31,23); ctx.lineTo(13,23); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#0b4f78"; ctx.fillRect(8,23,9,8); ctx.fillRect(27,23,9,8);
  ctx.fillStyle = boostTime > 0 ? "#ffe16b" : "#ff9257"; ctx.beginPath(); ctx.moveTo(15,31); ctx.lineTo(19,31); ctx.lineTo(17,39 + Math.random()*5); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(25,31); ctx.lineTo(29,31); ctx.lineTo(27,39 + Math.random()*5); ctx.closePath(); ctx.fill(); ctx.restore();
}

function drawEnemies() { for (const e of enemies) { ctx.save(); ctx.translate(e.x+e.width/2,e.y+e.height/2); ctx.rotate(e.rotation); ctx.shadowColor=e.color; ctx.shadowBlur=14; ctx.fillStyle=e.color; ctx.fillRect(-e.width/2,-e.height/2,e.width,e.height); ctx.fillStyle="#351225"; ctx.fillRect(-e.width*.28,-e.height*.22,e.width*.18,e.height*.18); ctx.fillRect(e.width*.1,-e.height*.22,e.width*.18,e.height*.18); ctx.restore(); } }

function drawPowerups() { for (const p of powerups) { ctx.save(); ctx.translate(p.x,p.y); const s = p.size + Math.sin(p.pulse)*2; ctx.shadowColor = p.type === "shield" ? "#64e7ff" : "#ffe16b"; ctx.shadowBlur=18; ctx.fillStyle=ctx.shadowColor; ctx.beginPath(); ctx.arc(0,0,s,0,Math.PI*2); ctx.fill(); ctx.fillStyle="#102044"; ctx.font="bold 17px Arial"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(p.type === "shield" ? "S" : "⚡",0,1); ctx.restore(); } }

function drawParticles() { for (const p of particles) { ctx.globalAlpha=Math.max(0,p.life/p.maxLife); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,p.size,p.size); } ctx.globalAlpha=1; }

function drawOverlay(title, subtitle) {
  ctx.fillStyle="rgba(2,5,18,.78)"; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.textAlign="center";
  ctx.fillStyle="#77e8ff"; ctx.font="bold 38px Arial"; ctx.fillText(title,canvas.width/2,canvas.height/2-42);
  ctx.fillStyle="#fff"; ctx.font="16px Arial"; ctx.fillText(subtitle,canvas.width/2,canvas.height/2+2);
  ctx.fillStyle="#9da9ca"; ctx.font="14px Arial"; ctx.fillText("Avoid blocks • Collect power-ups • Beat your best",canvas.width/2,canvas.height/2+34);
  if (gameState === "gameover") { ctx.fillStyle="#77e8ff"; ctx.font="bold 17px Arial"; ctx.fillText("Press START or SPACE to play again",canvas.width/2,canvas.height/2+72); }
}

function burst(x,y,count,color) { for(let i=0;i<count;i++){ const angle=Math.random()*Math.PI*2, speed=40+Math.random()*180; particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,size:2+Math.random()*4,life:.25+Math.random()*.55,maxLife:.8,color}); } }
function updateParticles(dt) { for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.985;p.vy*=.985;p.life-=dt;} particles=particles.filter(p=>p.life>0); }

function updateHud() {
  scoreValue.textContent = Math.floor(score); highScoreValue.textContent = highScore;
  livesValue.textContent = "❤️".repeat(lives) + "🖤".repeat(Math.max(0,3-lives));
  if (dodgeCooldown <= 0) cooldownHud.textContent = "Dodge: READY"; else cooldownHud.textContent = `Dodge: ${dodgeCooldown.toFixed(1)}s`;
}

function ensureAudio() { if (!soundOn) return; if (!audioCtx) { const AudioContext = window.AudioContext || window.webkitAudioContext; if (AudioContext) audioCtx = new AudioContext(); } if (audioCtx && audioCtx.state === "suspended") audioCtx.resume(); }
function beep(freq,duration,type) { if(!soundOn) return; ensureAudio(); if(!audioCtx) return; const osc=audioCtx.createOscillator(), gain=audioCtx.createGain(); osc.type=type; osc.frequency.value=freq; gain.gain.setValueAtTime(.045,audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration); osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime+duration); }

function setLeft(value){ keys.left=value; }
function setRight(value){ keys.right=value; }
function bindHold(id, down, up){ const el=document.getElementById(id); ["pointerdown","touchstart"].forEach(ev=>el.addEventListener(ev,e=>{e.preventDefault();down();},{passive:false})); ["pointerup","pointercancel","pointerleave","touchend"].forEach(ev=>el.addEventListener(ev,e=>{e.preventDefault();up();},{passive:false})); }
bindHold("leftBtn",()=>setLeft(true),()=>setLeft(false)); bindHold("rightBtn",()=>setRight(true),()=>setRight(false));
document.getElementById("dodgeBtn").addEventListener("pointerdown",e=>{e.preventDefault();dodge();});

function handleKeyDown(event) {
  const key = event.key.toLowerCase();
  if (event.code === "ArrowLeft" || key === "a") { keys.left=true; event.preventDefault(); }
  if (event.code === "ArrowRight" || key === "d") { keys.right=true; event.preventDefault(); }
  if (event.code === "ShiftLeft" || event.code === "ShiftRight") { dodge(); event.preventDefault(); }
  if (event.code === "Space") { event.preventDefault(); if(gameState === "ready" || gameState === "gameover") startGame(); else if(gameState === "paused") togglePause(); }
}
function handleKeyUp(event) { const key=event.key.toLowerCase(); if(event.code === "ArrowLeft" || key === "a") keys.left=false; if(event.code === "ArrowRight" || key === "d") keys.right=false; }

canvas.addEventListener("pointermove", event => { if(gameState !== "playing" || event.pointerType === "touch") return; const r=canvas.getBoundingClientRect(), mouseX=(event.clientX-r.left)*(canvas.width/r.width); player.x=Math.max(0,Math.min(canvas.width-player.width,mouseX-player.width/2)); });
canvas.addEventListener("click",()=>{ if(gameState === "ready" || gameState === "gameover") startGame(); });
startBtn.addEventListener("click",()=>{ ensureAudio(); startGame(); });
pauseBtn.addEventListener("click",()=>{ ensureAudio(); if(gameState === "ready" || gameState === "gameover") return; togglePause(); });
soundToggle.addEventListener("click",()=>{ soundOn=!soundOn; soundToggle.textContent=soundOn ? "🔊 Sound" : "🔇 Muted"; if(soundOn) { ensureAudio(); beep(600,.06,"sine"); } });
document.addEventListener("keydown",handleKeyDown); document.addEventListener("keyup",handleKeyUp); window.addEventListener("blur",()=>{keys.left=false;keys.right=false;});

draw(); updateHud();
