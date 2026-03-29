// ============================================================
// game.js — Main loop, State machine, HUD, Compact system
// ============================================================

const Game = {
  canvas: null, ctx: null, width: 1280, height: 720,
  // States: title, cutscene, playing, fusion, choice, compact, gameover, ending
  state: 'title',
  currentLevel: 0, // index into Levels[]
  lastTime: 0,
  player: null, projectiles: [], meleeHits: [], arena: null, waveManager: null,
  cutscene: null, choiceScreen: null,
  compactLevel: 0, // persists across deaths
  totalDeaths: 0,
  deathTimer: 0,
  titleTime: 0, titleParticles: [],
  compactAnimTimer: 0, compactAnimDuration: 2.0,
  fusedWeapon: false, // after L2 fusion
  playerChoseKatana: false, // L5 choice

  init() {
    this.canvas = document.getElementById('gameCanvas');
    this.canvas.width = this.width; this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d');
    Input.init(this.canvas); Audio.init();
    initAsciiSprites().then(() => console.log('Sprites ready'));
    for (let i = 0; i < 50; i++) this.titleParticles.push({
      x: randRange(0, this.width), y: randRange(0, this.height),
      vx: randRange(-6, 6), vy: randRange(-15, -2),
      size: randRange(1, 2.5), hue: randRange(170, 280), alpha: randRange(0.15, 0.5),
    });
    this.lastTime = performance.now();
    requestAnimationFrame(t => this.loop(t));
  },

  loop(timestamp) {
    let dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp; dt = Math.min(dt, 0.05);
    const gameDt = dt * Effects.slowMo;
    Input.update();
    switch (this.state) {
      case 'title': this.updateTitle(dt); break;
      case 'cutscene': case 'ending': this.updateCutscene(dt); break;
      case 'playing': this.updatePlaying(gameDt, dt); break;
      case 'death_screen': this.updateDeathScreen(dt); break;
      case 'compact': this.updateCompact(dt); break;
      case 'gameover': this.updateGameOver(dt); break;
      case 'fusion': this.updateCutscene(dt); break;
      case 'choice': this.updateChoice(dt); break;
    }
    this.draw();
    Input.postUpdate();
    requestAnimationFrame(t => this.loop(t));
  },

  // ---- Title ----
  updateTitle(dt) {
    this.titleTime += dt;
    for (const p of this.titleParticles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y < -5) { p.y = this.height + 5; p.x = randRange(0, this.width); }
    }
    if (Input.justPressed('Enter') || Input.justPressed('Space') || Input.mouse.clicked) {
      Audio.resume(); Audio.menuSelect();
      this.compactLevel = 0; this.totalDeaths = 0;
      this.fusedWeapon = false; this.playerChoseKatana = false;
      this.startLevel(0);
    }
  },
  drawTitle() {
    const ctx = this.ctx;
    const F = Theme.fontUI;
    const FT = Theme.fontTitle;
    ctx.fillStyle = Theme.bg; ctx.fillRect(0, 0, this.width, this.height);
    for (const p of this.titleParticles) {
      ctx.globalAlpha = p.alpha * 0.3 * (0.5 + Math.sin(this.titleTime + p.x) * 0.3);
      ctx.fillStyle = Theme.accent;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Subtle decorative lines
    ctx.fillStyle = Theme.accentSoft; ctx.font = `9px ${F}`;
    for (let i = 0; i < 5; i++) {
      const y = 180 + i * 75; const off = Math.sin(this.titleTime * 0.4 + i) * 40;
      const chars = '─'.repeat(80) + '═'.repeat(20) + '·'.repeat(40);
      const start = Math.floor(this.titleTime * 10 + i * 30) % chars.length;
      ctx.textAlign = 'center';
      ctx.fillText(chars.substring(start, start + 100), this.width / 2 + off * 0.5, y);
    }
    const titleY = this.height * 0.28;
    // Title — large Bebas Neue
    ctx.textAlign = 'center'; ctx.fillStyle = Theme.primary;
    ctx.font = `72px ${FT}`;
    ctx.fillText('C O M P A C T I N G', this.width / 2, titleY);
    // Accent underline
    ctx.strokeStyle = Theme.accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(this.width / 2 - 200, titleY + 12); ctx.lineTo(this.width / 2 + 200, titleY + 12); ctx.stroke();
    // Subtitle
    ctx.fillStyle = Theme.secondary; ctx.font = `14px ${F}`;
    ctx.fillText('> the bug of my memory_', this.width / 2, titleY + 45);
    ctx.fillStyle = Theme.textMuted; ctx.font = `12px ${F}`;
    ctx.fillText('// a game about little deaths', this.width / 2, titleY + 68);
    // Blink prompt
    if (Math.floor(this.titleTime * 2) % 2 === 0) {
      ctx.fillStyle = Theme.accent; ctx.font = `18px ${F}`;
      ctx.fillText('[ Press Enter or Click to Start ]', this.width / 2, this.height * 0.72);
    }
    // Controls
    ctx.fillStyle = Theme.textMuted; ctx.font = `12px ${F}`;
    ctx.fillText('WASD=move  MOUSE=aim  RCLICK=dash', this.width / 2, this.height * 0.87);
  },

  // ---- Level Management ----
  startLevel(idx) {
    this.currentLevel = idx;
    // Special: after L2 (idx=2 would be L3), show fusion
    if (idx === 2 && !this.fusedWeapon) {
      this.fusedWeapon = true;
      this.cutscene = new Cutscene(TransitionData.afterLevel2.pages, { accentColor: '#a0f' });
      this.state = 'fusion'; this._afterFusionTarget = 2; return;
    }
    // Special: L5 transition (after L4 = idx 4)
    if (idx === 4) { // This is actually the 5th level slot but we skip to choice
      // Wait, let me restructure. Levels array has indices 0-4 for L1,L2,L3,L4,L6
      // L5 (transition) is handled between idx 3 (L4) and idx 4 (L6)
    }
    const level = Levels[idx];
    if (!level) { this.showEnding(); return; }
    this.cutscene = new Cutscene(level.intro, { accentColor: level.arena.borderColor });
    this.state = 'cutscene';
  },

  showTransitionChoice() {
    this.cutscene = new Cutscene(TransitionData.level5.introPages, { accentColor: '#fff' });
    this.state = 'cutscene';
    this._afterCutsceneAction = 'showChoice';
  },

  showEnding() {
    this.cutscene = new Cutscene(TransitionData.ending, { accentColor: '#fff', charSpeed: 0.04 });
    this.state = 'ending';
  },

  startCombat() {
    const level = Levels[this.currentLevel];
    const ac = level.arena;
    this.arena = new Arena(ac.width, ac.height, ac);
    this.player = new Player(0, 0);
    this.player.compactLevel = this.compactLevel;
    // Assign weapon
    this.player.weapon = this._createWeapon(level.weapon);
    this.projectiles = []; this.meleeHits = [];
    this.waveManager = new WaveManager(level.waves);
    this.waveManager.start();
    if (level.memoryCards) this.waveManager.addMemoryCards(level.memoryCards, this.arena);
    Camera.x = 0; Camera.y = 0; Particles.clear();
    this.state = 'playing'; this.deathTimer = 0;
  },

  _createWeapon(type) {
    if (type === 'boxing') return new BoxingGloves();
    if (type === 'sniper') return new SniperRifle();
    if (type === 'chaingun') return new ChainGun();
    if (type === 'darts') return new DartWeapon();
    if (type === 'katana') return new KatanaWeapon();
    if (type === 'choice') return this.playerChoseKatana ? new KatanaWeapon() : new DartWeapon();
    return new BoxingGloves();
  },

  // ---- Cutscene ----
  updateCutscene(dt) {
    if (!this.cutscene) return;
    this.cutscene.update(dt);
    if (this.cutscene.done) {
      if (this.state === 'fusion') {
        // After fusion cutscene, start the target level
        this.startLevel(this._afterFusionTarget);
        return;
      }
      if (this.state === 'ending') {
        this.state = 'title'; return;
      }
      if (this._afterCutsceneAction === 'showChoice') {
        this._afterCutsceneAction = null;
        this.choiceScreen = new ChoiceScreen(
          TransitionData.level5.choiceTitle,
          TransitionData.level5.choiceDesc,
          TransitionData.level5.option1,
          TransitionData.level5.option2
        );
        this.state = 'choice'; return;
      }
      this.startCombat();
    }
  },

  // ---- Choice ----
  updateChoice(dt) {
    if (!this.choiceScreen) return;
    this.choiceScreen.update(dt);
    if (this.choiceScreen.done) {
      this.playerChoseKatana = (this.choiceScreen.selected === 0);
      // Proceed to Level 6 (index 4)
      this.startLevel(4);
    }
  },

  // ---- Combat ----
  updatePlaying(dt, realDt) {
    this.player.update(dt, this.projectiles, this.waveManager.enemies, this.meleeHits);
    this.arena.containPlayer(this.player);
    Camera.follow(this.player, Input.mouse.worldX, Input.mouse.worldY);
    Camera.update(dt);
    // Projectiles
    this.projectiles = this.projectiles.filter(p => {
      const alive = p.update(dt);
      if (this.arena.isOutside(p.x, p.y, 50)) {
        if (p.isDart && this.player.weapon instanceof DartWeapon) this.player.weapon.dropDart(p.x, p.y);
        return false;
      }
      return alive;
    });
    // Remove expired projectiles that are darts → drop them
    this.projectiles = this.projectiles.filter(p => {
      if (p.dead && p.isDart && this.player.weapon instanceof DartWeapon) {
        this.player.weapon.dropDart(p.x, p.y);
      }
      return !p.dead;
    });
    // Collision
    const dartWeapon = this.player.weapon instanceof DartWeapon ? this.player.weapon : null;
    this.projectiles = Collision.checkProjectilesVsEnemies(this.projectiles, this.waveManager.enemies, dartWeapon);
    Collision.checkMeleeVsEnemies(this.meleeHits, this.waveManager.enemies);
    this.meleeHits = this.meleeHits.filter(h => h.update(dt));
    Collision.separateEnemies(this.waveManager.enemies);
    this.waveManager.update(dt, this.player, this.arena);
    this.arena.update(dt, this.player);
    Particles.update(dt); Effects.update(realDt);
    // Level complete
    if (this.waveManager.allWavesComplete) {
      const level = Levels[this.currentLevel];
      this.cutscene = new Cutscene(level.outro, { accentColor: level.arena.borderColor });
      this.state = 'cutscene';
      // Set up what happens after outro
      if (this.currentLevel === 3) {
        // After L4 (index 3), go to L5 transition/choice
        this._afterCutsceneAction = 'showChoice';
      } else {
        this._afterCutsceneAction = null;
      }
      // When outro finishes and no special action, advance level
      const nextIdx = this.currentLevel + 1;
      this._afterOutroLevel = nextIdx;
    }
    // Player death → show DEATH, then restart level (skip cutscene)
    if (this.player.dead) {
      this.deathTimer += realDt;
      if (this.deathTimer > 1.5) {
        this.totalDeaths++;
        this.compactLevel++;
        this.state = 'death_screen';
        this.deathScreenTimer = 2.5;
      }
    }
  },

  // ---- Death Screen → restart level (skip intro cutscene) ----
  updateDeathScreen(dt) {
    this.deathScreenTimer -= dt;
    if (this.deathScreenTimer <= 0 || ((Input.mouse.clicked || Input.justPressed('Enter')) && this.deathScreenTimer < 1.5)) {
      this.startCombat(); // go straight to combat, no cutscene
    }
  },

  drawDeathScreen() {
    const ctx = this.ctx;
    const F = Theme.fontUI;
    const FT = Theme.fontTitle;
    const t = this.deathScreenTimer;
    ctx.fillStyle = Theme.bg; ctx.fillRect(0, 0, this.width, this.height);
    const alpha = t > 2.0 ? (2.5 - t) * 2 : (t < 0.5 ? t * 2 : 1);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    // Large DEATH title
    ctx.fillStyle = Theme.danger; ctx.font = `80px ${FT}`;
    ctx.fillText('D E A T H', this.width / 2, this.height / 2 - 40);
    // Underline
    ctx.strokeStyle = Theme.danger; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(this.width/2 - 160, this.height/2 - 20); ctx.lineTo(this.width/2 + 160, this.height/2 - 20); ctx.stroke();
    // Compact info
    ctx.fillStyle = Theme.accent; ctx.font = `20px ${F}`;
    ctx.fillText(`compact_level = ${this.compactLevel};`, this.width / 2, this.height / 2 + 30);
    ctx.fillStyle = Theme.secondary; ctx.font = `16px ${F}`;
    ctx.fillText(`// damage +${this.compactLevel * 10}%  range +${this.compactLevel * 12}px`, this.width / 2, this.height / 2 + 60);
    if (t < 1.5) {
      ctx.fillStyle = Theme.accent; ctx.font = `18px ${F}`;
      ctx.fillText('[ click to retry ]', this.width / 2, this.height / 2 + 110);
    }
    ctx.globalAlpha = 1;
  },

  // ---- Compact Animation (kept for visual only, no longer restarts level) ----
  updateCompact(dt) {
    this.compactAnimTimer -= dt;
    if (this.compactAnimTimer <= 0) {
      this.startLevel(this.currentLevel);
    }
  },
  drawCompact() {
    const ctx = this.ctx;
    const F = Theme.fontUI; const FT = Theme.fontTitle;
    const t = 1 - this.compactAnimTimer / this.compactAnimDuration;
    ctx.fillStyle = Theme.bg; ctx.fillRect(0, 0, this.width, this.height);
    const squeeze = Math.sin(t * Math.PI) * 0.3;
    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(1 - squeeze, 1 + squeeze * 0.5);
    ctx.translate(-this.width / 2, -this.height / 2);
    for (let i = 0; i < 20; i++) {
      const a = (Math.PI * 2 / 20) * i + t * 3;
      const dist = 300 * (1 - t);
      const px = this.width / 2 + Math.cos(a) * dist;
      const py = this.height / 2 + Math.sin(a) * dist;
      ctx.globalAlpha = 0.4; ctx.fillStyle = Theme.accent;
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = Theme.primary; ctx.font = `48px ${FT}`; ctx.textAlign = 'center';
    ctx.fillText('C O M P A C T I N G . . .', this.width / 2, this.height / 2 - 30);
    if (t > 0.4) {
      ctx.fillStyle = Theme.secondary; ctx.font = `16px ${F}`;
      ctx.fillText(`compact level: ${this.compactLevel}`, this.width / 2, this.height / 2 + 20);
      ctx.fillStyle = Theme.accent; ctx.font = `14px ${F}`;
      ctx.fillText(`damage +${this.compactLevel * 10}%  |  range +${this.compactLevel * 12}px`, this.width / 2, this.height / 2 + 45);
      ctx.fillStyle = Theme.textMuted; ctx.font = `13px ${F}`;
      ctx.fillText(`deaths: ${this.totalDeaths}`, this.width / 2, this.height / 2 + 70);
    }
    ctx.restore();
  },

  // ---- Game Over (shouldn't reach normally, but just in case) ----
  updateGameOver(dt) {
    this.deathTimer += dt;
    if (Input.justPressed('Enter') || Input.mouse.clicked) {
      if (this.deathTimer > 0.5) { Audio.menuSelect(); this.state = 'compact'; this.compactAnimTimer = this.compactAnimDuration; this.compactLevel++; this.totalDeaths++; }
    }
  },

  // ---- Draw ----
  draw() {
    const ctx = this.ctx;
    switch (this.state) {
      case 'title': this.drawTitle(); break;
      case 'cutscene': case 'fusion': case 'ending':
        if (this.cutscene) this.cutscene.draw(ctx, this.width, this.height); break;
      case 'playing': this.drawGame(); break;
      case 'death_screen': this.drawDeathScreen(); break;
      case 'compact': this.drawCompact(); break;
      case 'gameover': this.drawGame(); this.drawGameOverOverlay(); break;
      case 'choice':
        if (this.choiceScreen) this.choiceScreen.draw(ctx, this.width, this.height); break;
    }
  },

  drawGame() {
    const ctx = this.ctx;
    ctx.fillStyle = Theme.bg; ctx.fillRect(0, 0, this.width, this.height);
    Camera.apply(ctx);
    this.arena.draw(ctx);
    for (const p of this.projectiles) p.draw(ctx);
    this.waveManager.draw(ctx);
    for (const h of this.meleeHits) h.draw(ctx);
    Particles.draw(ctx);
    this.player.draw(ctx);
    Camera.restore(ctx);
    this.drawHUD();
    this.waveManager.drawHUD(ctx, this.width, this.height);
    Effects.drawFlash(ctx, this.width, this.height);
  },

  // ASCII bar helper: [████░░░░] style
  _asciiBar(filled, total) {
    const f = Math.round(filled * total);
    return '[' + '█'.repeat(f) + '░'.repeat(total - f) + ']';
  },

  drawHUD() {
    const ctx = this.ctx; const p = this.player;
    const F = Theme.fontUI;
    const FT = Theme.fontTitle;
    const S = 22;
    const x0 = 20, y0 = 36;

    // ── HP ──
    ctx.fillStyle = Theme.primary; ctx.font = `${S}px ${F}`; ctx.textAlign = 'left';
    const hpPct = p.hp / p.maxHp;
    const hpColor = hpPct > 0.5 ? Theme.success : hpPct > 0.25 ? Theme.warning : Theme.danger;
    ctx.fillText('HP ', x0, y0);
    ctx.fillStyle = hpColor;
    ctx.fillText(this._asciiBar(hpPct, 10), x0 + 60, y0);
    ctx.fillStyle = Theme.primary;
    ctx.fillText(`${Math.ceil(p.hp)}`, x0 + 280, y0);

    // DASH
    const dashPct = 1 - clamp(p.dashCdTimer / p.dashCooldown, 0, 1);
    ctx.font = `${S * 0.7 | 0}px ${F}`;
    ctx.fillStyle = dashPct >= 1 ? Theme.accent : Theme.secondary;
    ctx.fillText(`DASH ${this._asciiBar(dashPct, 6)}${dashPct >= 1 ? ' OK' : ''}`, x0, y0 + 32);

    // COMPACT
    if (this.compactLevel > 0) {
      ctx.fillStyle = Theme.accent; ctx.font = `${S * 0.7 | 0}px ${F}`;
      ctx.fillText(`COMPACT ${'■'.repeat(Math.min(this.compactLevel, 10))} ${this.compactLevel}`, x0, y0 + 58);
    }

    // ── Right side ──
    const rx = this.width - 20;
    const level = Levels[this.currentLevel];
    ctx.fillStyle = Theme.primary; ctx.font = `${S * 0.75 | 0}px ${F}`; ctx.textAlign = 'right';
    if (level) ctx.fillText(level.name, rx, y0);
    if (this.waveManager) {
      const wm = this.waveManager;
      const alive = wm.enemies.filter(e => !e.dead && !e.dying).length;
      ctx.fillStyle = Theme.secondary; ctx.font = `${S * 0.7 | 0}px ${F}`;
      ctx.fillText(`Wave ${wm.currentWave + 1}/${wm.waves.length}  Enemies: ${alive}`, rx, y0 + 30);
    }

    // ── Boss HP ──
    if (this.waveManager) {
      const boss = this.waveManager.getBoss();
      if (boss && !boss.dead && !boss.dying) {
        ctx.textAlign = 'center'; ctx.font = `28px ${FT}`;
        const bossName = boss.type.name || boss.type.behavior.replace('boss_', '').toUpperCase();
        ctx.fillStyle = Theme.primary; ctx.fillText(`── ${bossName} ──`, this.width / 2, 40);
        ctx.fillStyle = Theme.danger;
        ctx.font = `${S}px ${F}`;
        ctx.fillText(this._asciiBar(boss.hp / boss.maxHp, 20), this.width / 2, 70);
      }
    }

    // ── Weapon name ── using Bebas Neue
    if (p.weapon) {
      ctx.textAlign = 'center'; ctx.font = `28px ${FT}`;
      ctx.fillStyle = Theme.primary;
      ctx.fillText(`── ${p.weapon.name} ──`, this.width / 2, this.height - 18);
    }

    // ── Weapon-specific HUD ──
    if (p.weapon && p.weapon.drawHUD) p.weapon.drawHUD(ctx, this.width, this.height, p);
  },

  drawGameOverOverlay() {
    const ctx = this.ctx;
    const alpha = clamp(this.deathTimer * 2, 0, 0.8);
    ctx.fillStyle = `rgba(0,0,0,${alpha})`; ctx.fillRect(0, 0, this.width, this.height);
    if (this.deathTimer > 0.5) {
      ctx.fillStyle = Theme.danger; ctx.font = `56px ${Theme.fontTitle}`; ctx.textAlign = 'center';
      ctx.fillText('L I T T L E   D E A T H', this.width / 2, this.height / 2 - 30);
      ctx.fillStyle = Theme.secondary; ctx.font = `16px ${Theme.fontUI}`;
      ctx.fillText('compacting...', this.width / 2, this.height / 2 + 15);
    }
  },
};

// Fix cutscene → combat flow: when outro finishes, need to advance
const _origUpdateCutscene = Game.updateCutscene.bind(Game);
Game.updateCutscene = function(dt) {
  if (!this.cutscene) return;
  this.cutscene.update(dt);
  if (this.cutscene.done) {
    if (this.state === 'fusion') {
      this.startLevel(this._afterFusionTarget); return;
    }
    if (this.state === 'ending') { this.state = 'title'; return; }
    if (this._afterCutsceneAction === 'showChoice') {
      this._afterCutsceneAction = null;
      this.choiceScreen = new ChoiceScreen(
        TransitionData.level5.choiceTitle, TransitionData.level5.choiceDesc,
        TransitionData.level5.option1, TransitionData.level5.option2
      );
      this.state = 'choice'; return;
    }
    // If coming from outro, advance to next level
    if (this._afterOutroLevel !== undefined) {
      const next = this._afterOutroLevel; this._afterOutroLevel = undefined;
      if (next < Levels.length) this.startLevel(next);
      else this.showEnding();
      return;
    }
    // From intro, start combat
    this.startCombat();
  }
};

// --- Bootstrap ---
window.addEventListener('load', () => Game.init());
