// ============================================================
// world3d.js — Arena, Memory Cards, Wave Manager, Collision (3D)
// ============================================================

// --- Arena ---
class Arena {
  constructor(width, height, style = {}) {
    this.width = width; this.height = height;
    this.left = -width / 2; this.right = width / 2;
    this.top = -height / 2; this.bottom = height / 2;
    this.wallThickness = 20; this.gridSize = 60;
    this.borderColor = style.borderColor || '#0ff';
    this.floorColor = style.floorColor || Theme.floor;

    this.ambientParticles = [];
    for (let i = 0; i < 25; i++) {
      this.ambientParticles.push({
        x: randRange(this.left, this.right), y: randRange(this.top, this.bottom),
        vx: randRange(-8, 8), vy: randRange(-8, 8),
        size: randRange(1, 2.5), alpha: randRange(0.08, 0.25), hue: randRange(180, 280),
      });
    }

    // Build 3D arena
    this._buildMesh();
  }

  _buildMesh() {
    this.group = new THREE.Group();

    // Extended floor — much larger than arena so it feels borderless
    const extend = 600;
    const floorW = this.width + extend * 2;
    const floorH = this.height + extend * 2;
    const floorGeo = new THREE.PlaneGeometry(floorW, floorH);
    const floorMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(this.floorColor),
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Grid — only inside the arena area (subtle)
    const gridHelper = new THREE.GridHelper(
      Math.max(this.width, this.height),
      Math.max(this.width, this.height) / this.gridSize,
      0x1b7ed6, 0x1b7ed6
    );
    gridHelper.material.opacity = 0.04;
    gridHelper.material.transparent = true;
    gridHelper.position.y = 0;
    this.group.add(gridHelper);

    // NO solid walls — invisible collision only (handled by containPlayer)

    // Cyberpunk glitch text at the boundaries
    // Create floating code/glitch sprites along each edge
    this._glitchSprites = [];
    const chars = '01アイウエオカキクケコ§¶×÷≠≈∞∫∑∏√∇▓░▒█▀▄♦♣♠♥ⒶⒷⒸⒹ';
    const glitchColor = this.borderColor;

    const createGlitchStrip = (x, z, isHorizontal, length) => {
      // Create a canvas texture with scrolling code
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(0, 0, 512, 64);
      ctx.font = '14px "DM Mono", monospace';
      ctx.fillStyle = glitchColor;
      ctx.globalAlpha = 0.4;
      for (let i = 0; i < 60; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(ch, Math.random() * 500, 10 + Math.random() * 50);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.repeat.x = length / 200;

      const geo = new THREE.PlaneGeometry(length, 30);
      const mat = new THREE.MeshBasicMaterial({
        map: texture, transparent: true, opacity: 0.35,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 15, z);
      if (!isHorizontal) {
        mesh.rotation.y = Math.PI / 2;
      }
      this.group.add(mesh);
      this._glitchSprites.push({ mesh, texture, speed: 0.3 + Math.random() * 0.5 });
    };

    // Four edges
    createGlitchStrip(0, this.top - 10, true, this.width + 60);  // top
    createGlitchStrip(0, this.bottom + 10, true, this.width + 60); // bottom
    createGlitchStrip(this.left - 10, 0, false, this.height + 60); // left
    createGlitchStrip(this.right + 10, 0, false, this.height + 60); // right

    // Subtle corner markers (small glowing dots, not solid lines)
    const dotMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.borderColor), transparent: true, opacity: 0.3,
    });
    const dotGeo = new THREE.SphereGeometry(3, 6, 4);
    const corners = [
      [this.left, this.top], [this.right, this.top],
      [this.left, this.bottom], [this.right, this.bottom],
    ];
    corners.forEach(([cx, cz]) => {
      const dot = new THREE.Mesh(dotGeo, dotMat.clone());
      dot.position.set(cx, 2, cz);
      this.group.add(dot);
    });

    Renderer.arenaGroup.add(this.group);
  }

  _updateGlitch(dt) {
    // Static — no scrolling, no flicker
  }

  containPlayer(player) {
    const w = this.wallThickness;
    player.x = clamp(player.x, this.left + player.radius + w, this.right - player.radius - w);
    player.y = clamp(player.y, this.top + player.radius + w, this.bottom - player.radius - w);
  }

  isOutside(x, y, margin = 50) {
    return x < this.left - margin || x > this.right + margin || y < this.top - margin || y > this.bottom + margin;
  }

  update(dt, player) {
    for (const p of this.ambientParticles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < this.left || p.x > this.right) p.vx *= -1;
      if (p.y < this.top || p.y > this.bottom) p.vy *= -1;
    }
    this._updateGlitch(dt);
  }

  destroy() {
    if (this.group) Renderer.arenaGroup.remove(this.group);
  }

  draw() {}
}

// --- Memory Card (ground pickup) ---
class MemoryCard {
  constructor(x, y, text) {
    this.x = x; this.y = y; this.text = text;
    this.collected = false; this.bobPhase = Math.random() * Math.PI * 2;

    // 3D mesh
    this.mesh = Models.createDiamond();
    this.mesh.position.set(this.x, 8, this.y);
    Renderer.addToScene(this.mesh);
  }

  update(dt, player) {
    this.bobPhase += dt * 3;
    if (!this.collected && Vec.dist(this, player) < 30) {
      this.collected = true;
      player.hp = Math.min(player.hp + 10, player.maxHp);
      Audio.waveComplete();
      Particles.burst(this.x, this.y, 12, '#1b7ed6', 150);
      if (this.mesh) {
        Renderer.removeFromScene(this.mesh);
        this.mesh = null;
      }
      return true;
    }
    // Animate mesh
    if (this.mesh && !this.collected) {
      this.mesh.position.y = 8 + Math.sin(this.bobPhase * 0.8) * 4;
      this.mesh.rotation.y += dt * 2;
      const breath = 1 + Math.sin(this.bobPhase * 0.6) * 0.1;
      this.mesh.scale.setScalar(breath);
    }
    return false;
  }

  destroy() {
    if (this.mesh) Renderer.removeFromScene(this.mesh);
  }

  draw() {}
}

// --- Memory Card UI (HTML overlay) ---
class MemoryCardUI {
  constructor() {
    this.cards = [];
    this.container = document.getElementById('memory-ui');
  }

  add(text) {
    this.cards.push({ text, timer: 6, alpha: 0, phase: 0, el: null });
  }

  update(dt) {
    for (const c of this.cards) {
      c.timer -= dt;
      c.phase += dt;
      if (c.phase < 0.5) c.alpha = c.phase / 0.5;
      else if (c.timer < 1) c.alpha = c.timer;
      else c.alpha = 1;

      // Create DOM element if needed
      if (!c.el && this.container) {
        c.el = document.createElement('div');
        c.el.className = 'memory-card';
        c.el.textContent = c.text;
        this.container.appendChild(c.el);
      }
      if (c.el) {
        c.el.style.opacity = c.alpha * 0.85;
        if (c.alpha > 0.1) c.el.classList.add('visible');
      }
    }
    // Remove expired
    this.cards = this.cards.filter(c => {
      if (c.timer <= 0 && c.el) {
        c.el.remove();
        return false;
      }
      return c.timer > 0;
    });
  }

  clear() {
    this.cards.forEach(c => { if (c.el) c.el.remove(); });
    this.cards = [];
  }

  draw() {}
}

// --- Wave Manager ---
class WaveManager {
  constructor(waves) {
    this.waves = waves; this.currentWave = 0;
    this.enemies = []; this.enemyProjectiles = [];
    this.state = 'waiting'; this.spawnTimer = 0; this.spawnQueue = [];
    this.wavePauseTimer = 0; this.allWavesComplete = false;
    this.totalEnemiesKilled = 0;
    this.waveAnnounceTimer = 0; this.waveAnnounceText = '';
    this.memoryCards = [];
    this.memoryUI = new MemoryCardUI();
  }

  start() { this.state = 'waiting'; this.wavePauseTimer = 1.5; this.currentWave = 0; this._prepareWave(); }

  addMemoryCards(cards, arena) {
    for (const text of cards) {
      const x = randRange(arena.left + 60, arena.right - 60);
      const y = randRange(arena.top + 60, arena.bottom - 60);
      this.memoryCards.push(new MemoryCard(x, y, text));
    }
  }

  _prepareWave() {
    if (this.currentWave >= this.waves.length) {
      this.allWavesComplete = true; this.state = 'complete'; return;
    }
    const wave = this.waves[this.currentWave];
    this.spawnQueue = [];
    for (const spawn of wave.spawns) {
      for (let i = 0; i < spawn.count; i++) {
        this.spawnQueue.push({ type: spawn.type, delay: spawn.delay || 0.3 });
      }
    }
    this.waveAnnounceText = `Wave ${this.currentWave + 1}/${this.waves.length}`;
    this.waveAnnounceTimer = 2; this.state = 'spawning'; this.spawnTimer = 0.5;
  }

  update(dt, player, arena) {
    this.waveAnnounceTimer -= dt;
    this.memoryUI.update(dt);
    for (const card of this.memoryCards) {
      if (card.update(dt, player)) this.memoryUI.add(card.text);
    }
    if (this.state === 'waiting') {
      this.wavePauseTimer -= dt;
      if (this.wavePauseTimer <= 0) this._prepareWave();
      return;
    }
    if (this.state === 'spawning') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.spawnQueue.length > 0) {
        const spawn = this.spawnQueue.shift();
        this._spawnEnemy(spawn.type, arena);
        this.spawnTimer = spawn.delay;
      }
      if (this.spawnQueue.length === 0) this.state = 'active';
    }
    for (const e of this.enemies) {
      e.update(dt, player, this.enemyProjectiles, arena);
      if (e.canDamagePlayer(player) && !player.invincible && !player.dashing) {
        player.takeDamage(e.damage);
        const kb = Vec.norm(Vec.sub(player, e));
        player.x += kb.x * 25; player.y += kb.y * 25;
        break;
      }
    }
    for (const e of this.enemies) {
      if (e.dead || e.dying || e.spawnTimer > 0) continue;
      const dist = Vec.dist(e, player);
      const minDist = e.radius + player.radius;
      if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const push = Vec.norm(Vec.sub(player, e));
        player.x += push.x * overlap * 0.3;
        player.y += push.y * overlap * 0.3;
        e.x -= push.x * overlap * 0.7;
        e.y -= push.y * overlap * 0.7;
      }
    }
    this.enemyProjectiles = this.enemyProjectiles.filter(p => {
      p.update(dt);
      if (!p.fromPlayer && Vec.dist(p, player) < p.radius + player.radius) {
        if (!player.invincible && !player.dashing) player.takeDamage(p.damage);
        p.destroy();
        return false;
      }
      if (arena.isOutside(p.x, p.y, 100)) { p.destroy(); return false; }
      if (p.dead) { p.destroy(); return false; }
      return true;
    });
    const prevCount = this.enemies.length;
    this.enemies = this.enemies.filter(e => {
      if (e.dead) { e.destroy(); return false; }
      return true;
    });
    this.totalEnemiesKilled += prevCount - this.enemies.length;
    if (this.state === 'active' && this.enemies.length === 0) {
      this.currentWave++;
      if (this.currentWave >= this.waves.length) {
        this.allWavesComplete = true; this.state = 'complete'; Audio.levelComplete();
      } else {
        this.state = 'waiting'; this.wavePauseTimer = 2; Audio.waveComplete();
      }
    }
  }

  _spawnEnemy(type, arena) {
    let x, y; const margin = 40;
    if (type.behavior === 'scarecrow') {
      x = randRange(arena.left + margin, arena.right - margin);
      y = randRange(arena.top + margin, arena.bottom - margin);
    } else {
      const side = randInt(0, 3);
      switch (side) {
        case 0: x = randRange(arena.left + margin, arena.right - margin); y = arena.top + margin; break;
        case 1: x = randRange(arena.left + margin, arena.right - margin); y = arena.bottom - margin; break;
        case 2: x = arena.left + margin; y = randRange(arena.top + margin, arena.bottom - margin); break;
        case 3: x = arena.right - margin; y = randRange(arena.top + margin, arena.bottom - margin); break;
      }
    }
    this.enemies.push(new Enemy(type, x, y));
    if (type.behavior !== 'scarecrow') Particles.burst(x, y, 6, type.color, 120);
  }

  updateMeshes() {
    for (const e of this.enemies) e.updateMesh();
    for (const p of this.enemyProjectiles) { /* projectiles update their own mesh in update() */ }
  }

  destroy() {
    this.enemies.forEach(e => e.destroy());
    this.enemyProjectiles.forEach(p => p.destroy());
    this.memoryCards.forEach(c => c.destroy());
    this.memoryUI.clear();
    this.enemies = [];
    this.enemyProjectiles = [];
    this.memoryCards = [];
  }

  getBoss() { return this.enemies.find(e => e.isBoss && !e.dead && !e.dying); }

  draw() {}
  drawHUD() {}
}

// --- Collision ---
const Collision = {
  checkProjectilesVsEnemies(projectiles, enemies, dartWeapon) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      if (!p.fromPlayer || p.onGround) continue;
      for (const e of enemies) {
        if (e.dead || e.dying) continue;
        if (Vec.dist(p, e) < p.radius + e.radius) {
          e.takeDamage(p.damage);
          Particles.emit(e.x, e.y, 5, p.color, { speed: 150, life: 0.2, size: 2 });
          if (p.pierce) { p.hitEnemies.add(e); }
          else {
            p.dead = true;
            if (p.isDart && dartWeapon) dartWeapon.dropDart(p.x, p.y);
            break;
          }
        }
      }
    }
    return projectiles.filter(p => {
      if (p.dead && p.isDart && dartWeapon && !p.onGround) dartWeapon.dropDart(p.x, p.y);
      if (p.dead) { p.destroy(); return false; }
      return true;
    });
  },
  checkMeleeVsEnemies(meleeHits, enemies) {
    for (const hit of meleeHits) {
      for (const e of enemies) {
        if (e.dead || e.dying) continue;
        if (hit.hitsEnemy(e)) {
          e.takeDamage(hit.damage);
          hit.hitEnemies.add(e);
          const dir = Vec.norm(Vec.sub(e, { x: hit.x, y: hit.y }));
          e.x += dir.x * hit.knockback * 0.3;
          e.y += dir.y * hit.knockback * 0.3;
          Particles.emit(e.x, e.y, 8, hit.color, { speed: 200, life: 0.2, size: 3 });
          Effects.slowMotion(0.15, 0.03);
        }
      }
    }
  },
  separateEnemies(enemies) {
    for (let i = 0; i < enemies.length; i++) {
      for (let j = i + 1; j < enemies.length; j++) {
        const a = enemies[i], b = enemies[j];
        if (a.dead || b.dead || a.dying || b.dying) continue;
        const dist = Vec.dist(a, b);
        const minDist = a.radius + b.radius;
        if (dist < minDist && dist > 0) {
          const overlap = (minDist - dist) / 2;
          const dir = Vec.norm(Vec.sub(b, a));
          a.x -= dir.x * overlap; a.y -= dir.y * overlap;
          b.x += dir.x * overlap; b.y += dir.y * overlap;
        }
      }
    }
  },
};
