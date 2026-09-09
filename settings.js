"use strict";
(() => {
  const settingSound = document.getElementById("settingsSoundBtn");
  const fullScreen = document.getElementById("fullscreenBtn");
  const homeSound = document.getElementById("homeSoundBtn");
  const gameSound = document.getElementById("soundToggle");

  function renderSound() {
    const enabled = localStorage.getItem("spaceDodgeSound") !== "off";
    soundOn = enabled;
    settingSound.textContent = enabled ? "ON" : "OFF";
    settingSound.setAttribute("aria-pressed", String(enabled));
    homeSound.textContent = enabled ? "🔊" : "🔇";
    gameSound.textContent = enabled ? "🔊 Sound" : "🔇 Muted";
  }
  function setSound(enabled) {
    localStorage.setItem("spaceDodgeSound", enabled ? "on" : "off");
    soundOn = enabled;
    renderSound();
    if (enabled) { ensureAudio(); beep(600, .06, "sine"); }
  }
  [settingSound, homeSound, gameSound].forEach(button => button.addEventListener("click", event => {
    event.stopImmediatePropagation();
    setSound(localStorage.getItem("spaceDodgeSound") === "off");
  }, true));
  fullScreen.addEventListener("click", async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch (_) {}
  });
  document.addEventListener("fullscreenchange", () => { fullScreen.textContent = document.fullscreenElement ? "EXIT" : "OPEN"; });
  renderSound();
})();
