// ============================================================
// game3d.js — Main loop, State machine, HUD (3D version)
// ============================================================

const Game = {
  width: 1280, height: 720,
  state: 'title',
  currentLevel: 0,
  lastTime: 0,
  player: null, projectiles: [], meleeHits: [], arena: null, waveManager: null,
  cutscene: null, choiceScreen: null,
  compactLevel: 0,
  totalDeaths: 0,
  deathTimer: 0,
  titleTime: 0,
  compactAnimTimer: 0, compactAnimDuration: 2.0,
  fusedWeapon: false,
  playerChoseKatana: false,
  deathScreenTimer: 0,

  crosshair: null,

  init() {
    Renderer.init();
    Input.init(Renderer.renderer.domElement);
    Audio.init();
    Particles.init();

    // Create crosshair (always visible during gameplay)
    this.crosshair = Models.createCrosshair();
    this.crosshair.visible = false;
    Renderer.addToScene(this.crosshair);

    this._setupTitle();
    this.lastTime = performance.now();
    // Use both rAF and setTimeout fallback for background tab support
    this._scheduleLoop();
  },

  _scheduleLoop() {
    const self = this;
    function tick(ts) {
      if (!ts) ts = performance.now();
      try {
        self.loop(ts);
      } catch(e) {
        console.error('Game loop error:', e);
      }
    }
    // rAF-based loop with setTimeout fallback
    function scheduleNext() {
      requestAnimationFrame(function(ts) {
        tick(ts);
        scheduleNext();
      });
    }
    // Also keep a setTimeout heartbeat to ensure loop runs even when rAF is throttled
    setInterval(function() {
      tick(performance.now());
    }, 16);
  },

  _setupTitle() {
    const overlay = document.getElementById('overlay-title');
    overlay.classList.remove('hidden');
    overlay.innerHTML = '';

    const content = document.createElement('div');
    content.id = 'title-content';

    const h1 = document.createElement('h1');
    h1.textContent = 'C O M P A C T I N G';
    content.appendChild(h1);

    const line = document.createElement('div');
    line.className = 'title-line';
    content.appendChild(line);

    const sub1 = document.createElement('div');
    sub1.className = 'subtitle';
    sub1.textContent = '> the bug of my memory_';
    content.appendChild(sub1);

    const sub2 = document.createElement('div');
    sub2.className = 'subtitle';
    sub2.style.fontSize = '12px';
    sub2.textContent = '// a game about little deaths — 3D Edition';
    content.appendChild(sub2);

    const prompt = document.createElement('div');
    prompt.className = 'prompt';
    prompt.textContent = '[ Press Enter or Click to Start ]';
    content.appendChild(prompt);

    const controls = document.createElement('div');
    controls.className = 'controls';
    controls.textContent = 'WASD=move  MOUSE=aim  RCLICK=dash';
    content.appendChild(controls);

    overlay.appendChild(content);

    // Click handler for title screen
    overlay.addEventListener('click', () => {
      if (this.state === 'title') this._titleClicked = true;
    });
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

    // Render 3D scene
    if (this.state === 'playing' || this.state === 'gameover') {
      // Sync all 3D meshes
      if (this.player) this.player.updateMesh();
      if (this.waveManager) this.waveManager.updateMeshes();
      Particles.update(gameDt);
      Camera.apply();

      // Update crosshair position at mouse world coords
      if (this.crosshair) {
        this.crosshair.visible = true;
        this.crosshair.position.set(Input.mouse.worldX, 0, Input.mouse.worldY);
        // Pulse animation
        const pulse = 1 + Math.sin(Date.now() / 200) * 0.1;
        this.crosshair.scale.setScalar(pulse * 0.6);
      }
      this.updateHUD();
    } else {
      // Hide crosshair when not in gameplay
      if (this.crosshair) this.crosshair.visible = false;
    }
    Renderer.render();

    Input.postUpdate();
  },

  // ---- Title ----
  updateTitle(dt) {
    this.titleTime += dt;
    if (this._titleClicked || Input.justPressed('Enter') || Input.justPressed('Space') || Input.mouse.clicked) {
      this._titleClicked = false;
      Audio.resume(); Audio.menuSelect();
      this.compactLevel = 0; this.totalDeaths = 0;
      this.fusedWeapon = false; this.playerChoseKatana = false;
      document.getElementById('overlay-title').classList.add('hidden');
      this.startLevel(0);
    }
  },

  // ---- Level Management ----
  startLevel(idx) {
    this.currentLevel = idx;
    if (idx === 2 && !this.fusedWeapon) {
      this.fusedWeapon = true;
      this.cutscene = new Cutscene(TransitionData.afterLevel2.pages, { accentColor: '#a0f' });
      this.state = 'fusion'; this._afterFusionTarget = 2; return;
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
    this.cutscene = new Cutscene(TransitionData.ending, { accentColor: '#fff' });
    this.state = 'ending';
  },

  startCombat() {
    // Clean up old arena
    if (this.arena) this.arena.destroy();
    if (this.waveManager) this.waveManager.destroy();
    if (this.player) this.player.destroy();
    this.projectiles.forEach(p => p.destroy());
    this.meleeHits.forEach(h => h.destroy());

    const level = Levels[this.currentLevel];
    const ac = level.arena;
    this.arena = new Arena(ac.width, ac.height, ac);
    this.player = new Player(0, 0);
    this.player.compactLevel = this.compactLevel;
    this.player.weapon = this._createWeapon(level.weapon);
    this.projectiles = []; this.meleeHits = [];
    this.waveManager = new WaveManager(level.waves);
    this.waveManager.start();
    if (level.memoryCards) this.waveManager.addMemoryCards(level.memoryCards, this.arena);
    Camera.x = 0; Camera.y = 0; Particles.clear();
    this.state = 'playing'; this.deathTimer = 0;

    // Show HUD
    document.getElementById('hud').classList.remove('hidden');
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
        this.startLevel(this._afterFusionTarget); return;
      }
      if (this.state === 'ending') {
        this._setupTitle();
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
      if (this._afterOutroLevel !== undefined) {
        const next = this._afterOutroLevel; this._afterOutroLevel = undefined;
        if (next < Levels.length) this.startLevel(next);
        else this.showEnding();
        return;
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
    const dw = this.player.weapon instanceof DartWeapon ? this.player.weapon : null;
    this.projectiles = this.projectiles.filter(p => {
      const alive = p.update(dt);
      if (this.arena.isOutside(p.x, p.y, 50)) {
        if (p.isDart && dw) dw.dropDart(p.x, p.y);
        p.destroy();
        return false;
      }
      if (p.dead) {
        if (p.isDart && dw && !p.onGround) dw.dropDart(p.x, p.y);
        p.destroy(); return false;
      }
      return alive;
    });

    // Collision
    const dartWeapon = this.player.weapon instanceof DartWeapon ? this.player.weapon : null;
    this.projectiles = Collision.checkProjectilesVsEnemies(this.projectiles, this.waveManager.enemies, dartWeapon);
    Collision.checkMeleeVsEnemies(this.meleeHits, this.waveManager.enemies);
    this.meleeHits = this.meleeHits.filter(h => {
      const alive = h.update(dt);
      if (!alive) h.destroy();
      return alive;
    });
    Collision.separateEnemies(this.waveManager.enemies);
    this.waveManager.update(dt, this.player, this.arena);
    this.arena.update(dt, this.player);
    Effects.update(realDt);

    // Level complete
    if (this.waveManager.allWavesComplete) {
      document.getElementById('hud').classList.add('hidden');
      const level = Levels[this.currentLevel];
      this.cutscene = new Cutscene(level.outro, { accentColor: level.arena.borderColor });
      this.state = 'cutscene';
      if (this.currentLevel === 3) {
        this._afterCutsceneAction = 'showChoice';
      } else {
        this._afterCutsceneAction = null;
      }
      const nextIdx = this.currentLevel + 1;
      this._afterOutroLevel = nextIdx;

      // Clean up 3D scene
      this._cleanupCombat();
    }

    // Player death
    if (this.player.dead) {
      this.deathTimer += realDt;
      if (this.deathTimer > 1.5) {
        this.totalDeaths++;
        this.compactLevel++;
        this.state = 'death_screen';
        this.deathScreenTimer = 2.5;
        document.getElementById('hud').classList.add('hidden');
        this._showDeathScreen();
        this._cleanupCombat();
      }
    }
  },

  _cleanupCombat() {
    // Remove 3D objects but keep arena for visual continuity during transitions
    if (this.arena) { this.arena.destroy(); this.arena = null; }
    if (this.player) { this.player.destroy(); this.player = null; }
    if (this.waveManager) { this.waveManager.destroy(); this.waveManager = null; }
    this.projectiles.forEach(p => p.destroy());
    this.projectiles = [];
    this.meleeHits.forEach(h => h.destroy());
    this.meleeHits = [];
    Particles.clear();
  },

  // ---- Death Screen ----
  _showDeathScreen() {
    const overlay = document.getElementById('overlay-death');
    overlay.classList.remove('hidden');
    overlay.innerHTML = `
      <div>
        <h1>D E A T H</h1>
        <div class="death-line"></div>
        <div class="compact-info">compact_level = ${this.compactLevel};</div>
        <div class="compact-detail">// damage +${this.compactLevel * 10}%  bullet size +${this.compactLevel * 2}px  melee range +${this.compactLevel * 12}px</div>
        <div class="retry">[ click to retry ]</div>
      </div>
    `;
  },

  updateDeathScreen(dt) {
    this.deathScreenTimer -= dt;
    if (this.deathScreenTimer <= 0 || ((Input.mouse.clicked || Input.justPressed('Enter')) && this.deathScreenTimer < 1.5)) {
      document.getElementById('overlay-death').classList.add('hidden');
      this.startCombat();
    }
  },

  // ---- Compact Animation ----
  updateCompact(dt) {
    this.compactAnimTimer -= dt;
    if (this.compactAnimTimer <= 0) {
      document.getElementById('overlay-compact').classList.add('hidden');
      this.startLevel(this.currentLevel);
    }
  },

  // ---- Game Over ----
  updateGameOver(dt) {
    this.deathTimer += dt;
    if (Input.justPressed('Enter') || Input.mouse.clicked) {
      if (this.deathTimer > 0.5) {
        Audio.menuSelect();
        this.state = 'compact';
        this.compactAnimTimer = this.compactAnimDuration;
        this.compactLevel++; this.totalDeaths++;
      }
    }
  },

  // ---- HUD ----
  _asciiBar(filled, total) {
    const f = Math.round(filled * total);
    return '[' + '█'.repeat(f) + '░'.repeat(total - f) + ']';
  },

  updateHUD() {
    if (!this.player) return;
    const p = this.player;

    // HP
    const hpEl = document.getElementById('hud-hp');
    const hpPct = p.hp / p.maxHp;
    const hpColor = hpPct > 0.5 ? Theme.success : hpPct > 0.25 ? Theme.warning : Theme.danger;
    hpEl.innerHTML = `<span>HP </span><span style="color:${hpColor}">${this._asciiBar(hpPct, 10)}</span> <span>${Math.ceil(p.hp)}</span>`;

    // Dash
    const dashEl = document.getElementById('hud-dash');
    const dashPct = 1 - clamp(p.dashCdTimer / p.dashCooldown, 0, 1);
    dashEl.style.color = dashPct >= 1 ? Theme.accent : Theme.secondary;
    dashEl.textContent = `DASH ${this._asciiBar(dashPct, 6)}${dashPct >= 1 ? ' OK' : ''}`;

    // Compact
    const compactEl = document.getElementById('hud-compact');
    if (this.compactLevel > 0) {
      compactEl.textContent = `COMPACT ${'■'.repeat(Math.min(this.compactLevel, 10))} ${this.compactLevel}`;
      compactEl.style.display = '';
    } else {
      compactEl.style.display = 'none';
    }

    // Level name
    const levelEl = document.getElementById('hud-level');
    const level = Levels[this.currentLevel];
    levelEl.textContent = level ? level.name : '';

    // Wave info
    const waveEl = document.getElementById('hud-wave');
    if (this.waveManager) {
      const wm = this.waveManager;
      const alive = wm.enemies.filter(e => !e.dead && !e.dying).length;
      waveEl.textContent = `Wave ${wm.currentWave + 1}/${wm.waves.length}  Enemies: ${alive}`;
    }

    // Boss HP
    const bossEl = document.getElementById('hud-boss');
    if (this.waveManager) {
      const boss = this.waveManager.getBoss();
      if (boss && !boss.dead && !boss.dying) {
        bossEl.classList.remove('hidden');
        document.getElementById('hud-boss-name').textContent = `── ${boss.type.name || boss.type.behavior.replace('boss_', '').toUpperCase()} ──`;
        document.getElementById('hud-boss-bar').textContent = this._asciiBar(boss.hp / boss.maxHp, 20);
      } else {
        bossEl.classList.add('hidden');
      }
    }

    // Weapon name
    const weaponNameEl = document.getElementById('hud-weapon-name');
    if (p.weapon) {
      weaponNameEl.textContent = `── ${p.weapon.name} ──`;
    }

    // Weapon-specific HUD
    const hintEl = document.getElementById('hud-weapon-hint');
    const chargeEl = document.getElementById('hud-weapon-charge');
    const w = p.weapon;
    if (w instanceof BoxingGloves) {
      hintEl.textContent = 'HOLD=charge  TAP=quick  RCLICK=dash';
      if (w.charging) {
        const t = w.chargeTime;
        let label, color, bar;
        if (t >= 2.0)      { label = '>>> MAX'; color = Theme.accent; bar = '[████████]'; }
        else if (t >= 1.0) { label = '>>  Strong'; color = '#fa0'; bar = '[█████░░░]'; }
        else if (t >= 0.5) { label = '>   Medium'; color = '#f80'; bar = '[███░░░░░]'; }
        else               { label = '    Charging'; color = '#aaa'; bar = '[█░░░░░░░]'; }
        chargeEl.style.color = color;
        chargeEl.textContent = `${bar} ${label}`;
      } else {
        chargeEl.textContent = '';
      }
    } else if (w instanceof SniperRifle) {
      const holdHint = w.charged ? '>>> RELEASE TO FIRE <<<' : 'HOLD 1s=aim  RELEASE=fire  R=reload';
      hintEl.textContent = holdHint;
      const ammoStr = '|'.repeat(w.ammo) + '.'.repeat(w.maxAmmo - w.ammo);
      let chargeText = `AMMO [${ammoStr}] ${w.ammo}/${w.maxAmmo}`;
      if (w.reloading) {
        const pct = 1 - w.reloadTimer / w.reloadTime;
        chargeText += `  RELOADING ${Math.floor(pct * 100)}%`;
      }
      if (w.holdTime > 0 && !w.charged) {
        chargeText += `  charging ${Math.floor(clamp(w.holdTime / w.chargeThreshold, 0, 1) * 100)}%`;
      } else if (w.charged) {
        chargeText += '  LOCKED!';
      }
      chargeEl.style.color = '#f44';
      chargeEl.textContent = chargeText;
    } else if (w instanceof ChainGun) {
      hintEl.textContent = 'CLICK=hook  HOLD=shoot  RCLICK=dash';
      let chainText, chainColor;
      if (w.chainState === 'ready') { chainText = 'HOOK: READY'; chainColor = Theme.success; }
      else if (w.chainState === 'flying') { chainText = 'HOOK: FLYING...'; chainColor = Theme.accent; }
      else if (w.chainState === 'locked') { chainText = `LOCKED! FIRE! ${w.chainTimer.toFixed(1)}s`; chainColor = Theme.warning; }
      else { chainText = 'HOOK: READY'; chainColor = Theme.success; }
      chargeEl.style.color = chainColor;
      chargeEl.textContent = chainText;
    } else if (w instanceof DartWeapon) {
      const reloadHint = w.hasReloaded ? '(R used)' : 'R=recall (once)';
      hintEl.textContent = `CLICK=throw  ${reloadHint}  RCLICK=dash`;
      const dartColor = w.totalDarts > 5 ? Theme.primary : w.totalDarts > 0 ? '#fa0' : '#f44';
      let dartText = `DARTS: ${w.totalDarts}`;
      if (w.groundDarts.length > 0) dartText += ` (${w.groundDarts.length} on ground)`;
      chargeEl.style.color = dartColor;
      chargeEl.textContent = dartText;
    } else if (w instanceof KatanaWeapon) {
      hintEl.textContent = 'HOLD=charge  RELEASE=slash  RCLICK=dash';
      if (w.charging) {
        const t = w.chargeTime;
        let label, col;
        if (t >= 1.0) { label = '>>> HEAVY'; col = '#ff4'; }
        else if (t >= 0.4) { label = '>>  MEDIUM'; col = '#fa0'; }
        else { label = '>   LIGHT'; col = '#fff'; }
        chargeEl.style.color = col;
        chargeEl.textContent = label;
      } else {
        chargeEl.textContent = '';
      }
    } else {
      hintEl.textContent = '';
      chargeEl.textContent = '';
    }

    // Wave announce
    const announceEl = document.getElementById('hud-wave-announce');
    if (this.waveManager && this.waveManager.waveAnnounceTimer > 0) {
      announceEl.classList.remove('hidden');
      announceEl.textContent = this.waveManager.waveAnnounceText;
      announceEl.style.opacity = clamp(this.waveManager.waveAnnounceTimer, 0, 1);
    } else {
      announceEl.classList.add('hidden');
    }
  },
};

// --- Bootstrap ---
window.addEventListener('load', () => Game.init());
