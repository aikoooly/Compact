// ============================================================
// world.js — Arena, Memory Cards, Wave Manager (Rewrite)
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
    this.gridColor = style.gridColor || Theme.grid;
    // Background image with parallax scrolling
    this.bgImage = null; this.bgLoaded = false;
    this.bgScrollX = 0; this.bgScrollY = 0;
    this.bgParallax = 0.3; // how much bg moves relative to player (0=fixed, 1=moves with player)
    this._loadBg('assets/player/background.png');
    this.ambientParticles = [];
    for (let i = 0; i < 25; i++) {
      this.ambientParticles.push({
        x: randRange(this.left, this.right), y: randRange(this.top, this.bottom),
        vx: randRange(-8, 8), vy: randRange(-8, 8),
        size: randRange(1, 2.5), alpha: randRange(0.08, 0.25), hue: randRange(180, 280),
      });
    }
  }
  _loadBg(src) {
    const img = new Image();
    img.onload = () => { this.bgImage = img; this.bgLoaded = true; };
    img.onerror = () => console.warn('Background image not found:', src);
    img.src = src;
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
    // Parallax scroll: bg moves opposite to player movement
    if (player) {
      this.bgScrollX -= player.vx * dt * this.bgParallax;
      this.bgScrollY -= player.vy * dt * this.bgParallax;
    }
    for (const p of this.ambientParticles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < this.left || p.x > this.right) p.vx *= -1;
      if (p.y < this.top || p.y > this.bottom) p.vy *= -1;
    }
  }
  draw(ctx) {
    // Floor base color
    ctx.fillStyle = this.floorColor;
    ctx.fillRect(this.left, this.top, this.width, this.height);

    // Background image with parallax tiling
    if (this.bgLoaded && this.bgImage) {
      ctx.save();
      // Clip to arena bounds
      ctx.beginPath();
      ctx.rect(this.left, this.top, this.width, this.height);
      ctx.clip();

      const img = this.bgImage;
      // Scale bg to fill arena width, maintain aspect ratio
      const scale = Math.max(this.width / img.width, this.height / img.height) * 1.3;
      const bw = img.width * scale;
      const bh = img.height * scale;

      // Wrap scroll position for seamless tiling
      const ox = ((this.bgScrollX % bw) + bw) % bw;
      const oy = ((this.bgScrollY % bh) + bh) % bh;

      // Draw tiled (2x2 grid to cover all scroll positions)
      ctx.globalAlpha = 0.5; // blend with floor color
      for (let ty = -1; ty <= 1; ty++) {
        for (let tx = -1; tx <= 1; tx++) {
          ctx.drawImage(img,
            this.left - ox + tx * bw,
            this.top - oy + ty * bh,
            bw, bh);
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Grid lines (on top of bg)
    ctx.strokeStyle = this.gridColor; ctx.lineWidth = 1;
    for (let x = this.left; x <= this.right; x += this.gridSize) {
      ctx.beginPath(); ctx.moveTo(x, this.top); ctx.lineTo(x, this.bottom); ctx.stroke();
    }
    for (let y = this.top; y <= this.bottom; y += this.gridSize) {
      ctx.beginPath(); ctx.moveTo(this.left, y); ctx.lineTo(this.right, y); ctx.stroke();
    }
    // Ambient particles
    for (const p of this.ambientParticles) {
      ctx.globalAlpha = p.alpha; ctx.fillStyle = hsl(p.hue, 80, 60);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Walls
    ctx.fillStyle = Theme.bg;
    ctx.fillRect(this.left - this.wallThickness, this.top - this.wallThickness, this.width + this.wallThickness * 2, this.wallThickness);
    ctx.fillRect(this.left - this.wallThickness, this.bottom, this.width + this.wallThickness * 2, this.wallThickness);
    ctx.fillRect(this.left - this.wallThickness, this.top, this.wallThickness, this.height);
    ctx.fillRect(this.right, this.top, this.wallThickness, this.height);
    // Border glow
    ctx.strokeStyle = this.borderColor; ctx.lineWidth = 2;
    ctx.shadowColor = this.borderColor; ctx.shadowBlur = 12;
    ctx.strokeRect(this.left, this.top, this.width, this.height);
    ctx.shadowBlur = 0;
    // Corner accents
    const cs = 25; ctx.lineWidth = 3;
    [[this.left, this.top, 1, 1], [this.right, this.top, -1, 1],
     [this.left, this.bottom, 1, -1], [this.right, this.bottom, -1, -1]].forEach(([cx, cy, sx, sy]) => {
      ctx.beginPath(); ctx.moveTo(cx + sx * cs, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * cs); ctx.stroke();
    });
  }
}

// --- Memory Card (ground pickup) ---
class MemoryCard {
  constructor(x, y, text) {
    this.x = x; this.y = y; this.text = text;
    this.collected = false; this.bobPhase = Math.random() * Math.PI * 2;
    this.glowHue = randRange(180, 300);
  }
  update(dt, player) {
    this.bobPhase += dt * 3;
    if (!this.collected && Vec.dist(this, player) < 30) {
      this.collected = true;
      // Heal player +10 HP
      player.hp = Math.min(player.hp + 10, player.maxHp);
      Audio.waveComplete();
      Particles.burst(this.x, this.y, 12, '#1b7ed6', 150);
      return true; // signal collected
    }
    return false;
  }
  draw(ctx) {
    if (this.collected) return;
    const t = this.bobPhase;
    const bob = Math.sin(t * 0.8) * 4; // slower bob
    const x = this.x, y = this.y + bob;

    // Slow breathing scale
    const breath = 1 + Math.sin(t * 0.6) * 0.1;
    // Slow shimmer — gentle twinkle
    const shimmer = 0.75 + Math.sin(t * 0.8) * 0.2;

    // Try ASCII diamond sprite
    if (AsciiSprite.has('memory_diamond')) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(breath, breath);
      ctx.globalAlpha = shimmer;
      const sprite = AsciiSprite.get('memory_diamond');
      ctx.drawImage(sprite.canvas, -sprite.cx, -sprite.cy);
      ctx.restore();
      ctx.globalAlpha = 1;
    } else {
      // Fallback: simple diamond outline
      const s = 12;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(breath, breath);
      ctx.globalAlpha = shimmer;
      ctx.strokeStyle = Theme.accent; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0);
      ctx.closePath(); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }
}

// --- Memory Card UI (left side display) ---
class MemoryCardUI {
  constructor() {
    this.cards = []; // { text, timer, alpha }
  }
  add(text) {
    this.cards.push({ text, timer: 6, alpha: 0, phase: 0 });
  }
  update(dt) {
    for (const c of this.cards) {
      c.timer -= dt;
      c.phase += dt;
      if (c.phase < 0.5) c.alpha = c.phase / 0.5;
      else if (c.timer < 1) c.alpha = c.timer;
      else c.alpha = 1;
    }
    this.cards = this.cards.filter(c => c.timer > 0);
  }
  draw(ctx, w, h) {
    let y = 200;
    for (const c of this.cards) {
      const x = 20;
      ctx.globalAlpha = c.alpha * 0.85;
      // Card background
      ctx.fillStyle = Theme.panel;
      const textW = Math.min(ctx.measureText(c.text).width + 30, 280);
      ctx.fillRect(x, y, textW, 36);
      ctx.strokeStyle = Theme.panelBorder; ctx.lineWidth = 1;
      ctx.strokeRect(x, y, textW, 36);
      const revealLen = Math.floor(c.phase * 20);
      const displayText = c.text.substring(0, Math.min(revealLen, c.text.length));
      ctx.fillStyle = Theme.primary; ctx.font = `italic 13px ${Theme.fontUI}`; ctx.textAlign = 'left';
      ctx.fillText(displayText, x + 12, y + 22);
      ctx.globalAlpha = 1;
      y += 44;
    }
  }
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
    this.memoryCards = []; // ground pickups
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
    // Memory card pickups
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
    // Update enemies
    for (const e of this.enemies) {
      e.update(dt, player, this.enemyProjectiles, arena);
      if (e.canDamagePlayer(player) && !player.invincible && !player.dashing) {
        player.takeDamage(e.damage);
        // Knockback away from enemy — but don't stack multiple knockbacks
        const kb = Vec.norm(Vec.sub(player, e));
        player.x += kb.x * 25; player.y += kb.y * 25;
        break; // only one enemy can damage per frame to prevent stacking
      }
    }
    // Push player out of overlapping enemies (no damage, just separation)
    for (const e of this.enemies) {
      if (e.dead || e.dying || e.spawnTimer > 0) continue;
      const dist = Vec.dist(e, player);
      const minDist = e.radius + player.radius;
      if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const push = Vec.norm(Vec.sub(player, e));
        // Only push player slightly — don't block movement
        player.x += push.x * overlap * 0.3;
        player.y += push.y * overlap * 0.3;
        // Push enemy away more
        e.x -= push.x * overlap * 0.7;
        e.y -= push.y * overlap * 0.7;
      }
    }
    // Enemy projectiles
    this.enemyProjectiles = this.enemyProjectiles.filter(p => {
      p.update(dt);
      if (!p.fromPlayer && Vec.dist(p, player) < p.radius + player.radius) {
        if (!player.invincible && !player.dashing) player.takeDamage(p.damage);
        return false;
      }
      if (arena.isOutside(p.x, p.y, 100)) return false;
      return !p.dead;
    });
    // Remove dead
    const prevCount = this.enemies.length;
    this.enemies = this.enemies.filter(e => !e.dead);
    this.totalEnemiesKilled += prevCount - this.enemies.length;
    // Check wave complete
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
      // Scatter across arena
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
  draw(ctx) {
    for (const card of this.memoryCards) card.draw(ctx);
    for (const e of this.enemies) e.draw(ctx);
    for (const p of this.enemyProjectiles) p.draw(ctx);
  }
  drawHUD(ctx, w, h) {
    this.memoryUI.draw(ctx, w, h);
    if (this.waveAnnounceTimer > 0) {
      ctx.globalAlpha = clamp(this.waveAnnounceTimer, 0, 1);
      ctx.fillStyle = Theme.primary; ctx.font = `36px ${Theme.fontTitle}`; ctx.textAlign = 'center';
      ctx.fillText(this.waveAnnounceText, w / 2, h / 2 - 100);
      ctx.globalAlpha = 1;
    }
  }
  getBoss() { return this.enemies.find(e => e.isBoss && !e.dead && !e.dying); }
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
            // Drop dart on ground if it's a dart
            if (p.isDart && dartWeapon) dartWeapon.dropDart(p.x, p.y);
            break;
          }
        }
      }
    }
    // Handle dead projectiles - drop darts
    return projectiles.filter(p => {
      if (p.dead && p.isDart && dartWeapon && !p.onGround) dartWeapon.dropDart(p.x, p.y);
      return !p.dead;
    });
  },
  checkMeleeVsEnemies(meleeHits, enemies) {
    for (const hit of meleeHits) {
      for (const e of enemies) {
        if (e.dead || e.dying) continue;
        if (hit.hitsEnemy(e)) {
          e.takeDamage(hit.damage);
          hit.hitEnemies.add(e);
          // Knockback
          const dir = Vec.norm(Vec.sub(e, { x: hit.x, y: hit.y }));
          e.x += dir.x * hit.knockback * 0.3;
          e.y += dir.y * hit.knockback * 0.3;
          Particles.emit(e.x, e.y, 8, hit.color, { speed: 200, life: 0.2, size: 3 });
          Effects.slowMotion(0.15, 0.03); // hit-stop!
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
