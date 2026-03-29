// ============================================================
// entities.js — Player, Weapons, Enemies (Complete Rewrite)
// ============================================================

// --- Projectile ---
class Projectile {
  constructor(x, y, angle, speed, damage, opts = {}) {
    this.x = x; this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.speed = speed; this.damage = damage;
    this.radius = opts.radius || 4;
    this.life = opts.life || 2; this.maxLife = this.life;
    this.color = opts.color || '#0ff';
    this.pierce = opts.pierce || false;
    this.fromPlayer = opts.fromPlayer !== false;
    this.trail = opts.trail !== false;
    this.dead = false;
    this.hitEnemies = new Set();
    this.isDart = opts.isDart || false;
    this.onGround = false; // for dart pickup
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
    if (this.trail && !this.onGround) Particles.trail(this.x, this.y, this.color, this.radius * 0.5);
    if (this.life <= 0) this.dead = true;
    return !this.dead;
  }
  draw(ctx) {
    if (this.onGround) {
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 300) * 0.2;
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(this.x, this.y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; return;
    }
    if (this.isDart) {
      // Silver diamond dart — no glow, sharp shape
      const angle = Math.atan2(this.vy, this.vx);
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(angle);
      ctx.fillStyle = '#ddd';
      ctx.beginPath();
      ctx.moveTo(8, 0);    // tip
      ctx.lineTo(0, -3);   // top edge
      ctx.lineTo(-6, 0);   // tail
      ctx.lineTo(0, 3);    // bottom edge
      ctx.closePath();
      ctx.fill();
      // Thin dark edge
      ctx.strokeStyle = '#999'; ctx.lineWidth = 0.5; ctx.stroke();
      ctx.restore();
    } else {
      // Normal projectile with glow
      ctx.globalAlpha = 0.3; ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.radius * 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// --- Melee Hit (for boxing/katana) ---
class MeleeHit {
  constructor(x, y, angle, range, arcWidth, damage, opts = {}) {
    this.x = x; this.y = y; this.angle = angle;
    this.range = range; this.arcWidth = arcWidth;
    this.damage = damage; this.life = 0.12;
    this.maxLife = this.life; this.color = opts.color || '#ff8';
    this.knockback = opts.knockback || 150;
    this.hitEnemies = new Set();
    this.dead = false;
  }
  update(dt) { this.life -= dt; if (this.life <= 0) this.dead = true; return !this.dead; }
  hitsEnemy(enemy) {
    if (this.hitEnemies.has(enemy)) return false;
    const dx = enemy.x - this.x, dy = enemy.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > this.range + enemy.radius) return false;
    const angle = Math.atan2(dy, dx);
    let diff = angle - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) < this.arcWidth / 2;
  }
  draw(ctx) {
    if (this.isKatana) return; // katana draws its own blade sweep, skip MeleeHit visual
    const t = this.life / this.maxLife;
    ctx.globalAlpha = t * 0.6;
    ctx.strokeStyle = this.color; ctx.lineWidth = 4 * t + 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.range * (1 - t * 0.3), this.angle - this.arcWidth / 2, this.angle + this.arcWidth / 2);
    ctx.stroke();
    // Impact flash
    ctx.fillStyle = '#fff'; ctx.globalAlpha = t * 0.3;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.arc(this.x, this.y, this.range * 0.8, this.angle - this.arcWidth / 2, this.angle + this.arcWidth / 2);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ============================
// WEAPONS
// ============================

// --- Boxing Gloves ---
class BoxingGloves {
  constructor() {
    this.name = '拳击手套'; this.color = Theme.accent;
    this.chargeTime = 0; this.charging = false;
    this.punchCooldown = 0; this.baseRange = 55;
    this.baseDamage = 100; // at full charge
    // dashWithMouse removed — right-click dash is now global for all weapons
  }
  getRange(compactLevel) { return this.baseRange + compactLevel * 12; }
  update(dt, player, enemies, meleeHits) {
    if (this.punchCooldown > 0) this.punchCooldown -= dt;
    if (Input.mouse.down && !this.charging && this.punchCooldown <= 0) {
      this.charging = true; this.chargeTime = 0;
    }
    if (this.charging && Input.mouse.down) {
      this.chargeTime += dt;
    }
    if (this.charging && !Input.mouse.down) {
      this._release(player, enemies, meleeHits);
      this.charging = false; this.chargeTime = 0;
    }
    // Quick punch on click (tap < 0.1s handled by release with low charge)
  }
  _release(player, enemies, meleeHits) {
    const t = this.chargeTime;
    let dmgPct, rangeMul, knockback, shakeAmt, lungeDist, lungeDuration;
    if (t >= 2.0)      { dmgPct = 1.0;  rangeMul = 1.6; knockback = 300; shakeAmt = 14; lungeDist = 280; lungeDuration = 0.18; }
    else if (t >= 1.0) { dmgPct = 0.7;  rangeMul = 1.3; knockback = 200; shakeAmt = 9;  lungeDist = 170; lungeDuration = 0.14; }
    else if (t >= 0.5) { dmgPct = 0.3;  rangeMul = 1.1; knockback = 120; shakeAmt = 5;  lungeDist = 90;  lungeDuration = 0.10; }
    else               { dmgPct = 0.12; rangeMul = 0.8; knockback = 60;  shakeAmt = 3;  lungeDist = 0;   lungeDuration = 0; }
    const range = this.getRange(player.compactLevel) * rangeMul;
    const damage = this.baseDamage * dmgPct * (1 + player.compactLevel * 0.1);
    const arc = t >= 1.0 ? 1.8 : 1.2;

    // === PUNCH LUNGE: charge makes player fly forward, unstoppable ===
    if (lungeDist > 0) {
      const lungeSpeed = lungeDist / lungeDuration;
      player.dashing = true;
      player.invincible = true;
      player.dashTimer = lungeDuration;
      player.dashDir = Vec.fromAngle(player.angle);
      player.dashSpeed = lungeSpeed; // override dash speed for this lunge
      // Spawn afterimages during lunge
      for (let i = 0; i < 4; i++) {
        player.afterimages.push({ x: player.x, y: player.y, alpha: 0.5, angle: player.angle });
      }
    }

    // Create the melee hit at the DESTINATION, not the start
    // Use a slight delay so it lines up with where the player lands
    const hitX = player.x + Math.cos(player.angle) * lungeDist * 0.5;
    const hitY = player.y + Math.sin(player.angle) * lungeDist * 0.5;
    meleeHits.push(new MeleeHit(hitX, hitY, player.angle, range + lungeDist * 0.4, arc, damage, {
      color: t >= 2.0 ? '#fff' : t >= 1.0 ? '#fa0' : '#f80', knockback,
    }));

    Effects.shake(shakeAmt, 0.15);
    if (t >= 1.0) Effects.slowMotion(0.15, 0.07);
    if (t >= 2.0) Effects.flash(Theme.accent, 0.1);
    Audio.hit();

    // Big particle burst along the lunge path
    const particleCount = Math.floor(5 + dmgPct * 20);
    Particles.emit(player.x + Math.cos(player.angle) * 30, player.y + Math.sin(player.angle) * 30,
      particleCount, this.color, { speed: 200 * dmgPct + 150, life: 0.4, angle: player.angle, spread: arc * 0.5, glow: true });
    // Trail sparks along lunge direction
    if (lungeDist > 0) {
      for (let d = 0; d < lungeDist; d += 30) {
        const px = player.x + Math.cos(player.angle) * d;
        const py = player.y + Math.sin(player.angle) * d;
        Particles.emit(px, py, 3, '#ff8', { speed: 80, life: 0.25, size: 2, spread: Math.PI * 2 });
      }
    }

    this.punchCooldown = t >= 0.5 ? 0.35 : 0.12;
  }
  draw(ctx, player) {
    // Charge indicator
    if (this.charging) {
      const t = this.chargeTime;
      let tier = 0, tierColor = '#f80';
      if (t >= 2.0) { tier = 3; tierColor = '#fff'; }
      else if (t >= 1.0) { tier = 2; tierColor = '#fa0'; }
      else if (t >= 0.5) { tier = 1; tierColor = '#f80'; }
      // Pulsing glow
      const pulse = 1 + Math.sin(Date.now() / 80) * 0.15;
      const range = this.getRange(player.compactLevel) * (0.8 + tier * 0.3) * pulse;
      ctx.globalAlpha = 0.15 + tier * 0.05;
      ctx.fillStyle = tierColor;
      ctx.beginPath(); ctx.arc(player.x, player.y, range, 0, Math.PI * 2); ctx.fill();
      // Charge ring
      const pct = clamp(t / 2.0, 0, 1);
      ctx.globalAlpha = 0.7; ctx.strokeStyle = tierColor; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(player.x, player.y, 28, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
      // Tier markers
      ctx.globalAlpha = 0.4; ctx.lineWidth = 1;
      [0.25, 0.5, 1.0].forEach(p => {
        const a = -Math.PI / 2 + p * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(player.x + Math.cos(a) * 24, player.y + Math.sin(a) * 24);
        ctx.lineTo(player.x + Math.cos(a) * 32, player.y + Math.sin(a) * 32); ctx.stroke();
      });
      ctx.globalAlpha = 1;
      // Orbiting particles for high charge
      if (tier >= 2) {
        for (let i = 0; i < 3; i++) {
          const a = Date.now() / 200 + (Math.PI * 2 / 3) * i;
          Particles.trail(player.x + Math.cos(a) * 25, player.y + Math.sin(a) * 25, tierColor, 2);
        }
      }
    }
    // Fist / aim indicator with ring — offset up 10px to chest/hand level
    const aimOffY = -10;
    const fistDist = 22 + (this.charging ? Math.min(this.chargeTime * 4, 10) : 0);
    const fx = player.x + Math.cos(player.angle) * fistDist;
    const fy = player.y + aimOffY + Math.sin(player.angle) * fistDist;
    // Outer ring (semi-transparent, pulsing)
    const ringSize = 14 + (this.charging ? Math.min(this.chargeTime * 3, 8) : 0);
    const pulse = 1 + Math.sin(Date.now() / 150) * 0.15;
    ctx.globalAlpha = 0.25; ctx.strokeStyle = this.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(fx, fy, ringSize * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.12; ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(fx, fy, ringSize * pulse, 0, Math.PI * 2); ctx.fill();
    // Inner dot
    ctx.globalAlpha = 0.9; ctx.fillStyle = this.color; ctx.beginPath();
    ctx.arc(fx, fy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  drawHUD(ctx, w, h, player) {
    const F = Theme.fontUI;
    ctx.fillStyle = Theme.primary; ctx.font = `16px ${F}`; ctx.textAlign = 'left';
    ctx.fillText('HOLD=charge  TAP=quick  RCLICK=dash', 20, h - 50);
    if (this.charging) {
      const t = this.chargeTime;
      let label, color, bar;
      if (t >= 2.0)      { label = '>>> MAX'; color = Theme.accent; bar = '[████████]'; }
      else if (t >= 1.0) { label = '>>  Strong';    color = '#fa0'; bar = '[█████░░░]'; }
      else if (t >= 0.5) { label = '>   Medium';    color = '#f80'; bar = '[███░░░░░]'; }
      else               { label = '    Charging';  color = '#aaa'; bar = '[█░░░░░░░]'; }
      ctx.fillStyle = color; ctx.font = `bold 22px ${F}`;
      ctx.fillText(`${bar} ${label}`, 20, h - 75);
    }
  }
}

// --- Sniper Rifle ---
class SniperRifle {
  constructor() {
    this.name = '狙击枪'; this.color = '#f44';
    this.ammo = 8; this.maxAmmo = 8;
    this.reloading = false; this.reloadTimer = 0; this.reloadTime = 1.5;
    this.fireCooldown = 0; this.baseDamage = 200;
    this._laserFlashTimer = 0; // bright laser flash on fire
    this._laserFlashAngle = 0;
    this._laserFlashX = 0; this._laserFlashY = 0;
  }
  update(dt, player, enemies, meleeHits, projectiles) {
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this._laserFlashTimer > 0) this._laserFlashTimer -= dt;
    player.speed = player.baseSpeed;
    // Reload
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) { this.ammo = this.maxAmmo; this.reloading = false; }
    }
    if (Input.justPressed('KeyR') && !this.reloading && this.ammo < this.maxAmmo) {
      this.reloading = true; this.reloadTimer = this.reloadTime; Audio.menuSelect();
    }
    if (this.ammo <= 0 && !this.reloading) { this.reloading = true; this.reloadTimer = this.reloadTime; }
    // Fire — left click
    if (Input.mouse.clicked && this.ammo > 0 && this.fireCooldown <= 0 && !this.reloading) {
      this.ammo--;
      this.fireCooldown = 0.5;
      const dmg = this.baseDamage * (1 + player.compactLevel * 0.1);
      projectiles.push(new Projectile(
        player.x + Math.cos(player.angle) * 20, player.y + Math.sin(player.angle) * 20,
        player.angle, 1500, dmg,
        { color: '#f44', radius: 5, pierce: true, life: 1.0, trail: true }
      ));
      Audio.sniper(); Effects.shake(6, 0.15);
      Particles.emit(player.x + Math.cos(player.angle) * 25, player.y + Math.sin(player.angle) * 25,
        8, '#f44', { speed: 300, life: 0.15, angle: player.angle, spread: 0.4 });
      // Recoil
      player.x -= Math.cos(player.angle) * 8;
      player.y -= Math.sin(player.angle) * 8;
      // Laser flash
      this._laserFlashTimer = 0.15;
      this._laserFlashAngle = player.angle;
      this._laserFlashX = player.x; this._laserFlashY = player.y;
    }
  }
  draw(ctx, player) {
    // Thin red laser sight (always visible, subtle) — offset up 10px for hand alignment
    const laserOffY = -10;
    ctx.strokeStyle = 'rgba(255,50,50,0.35)'; ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(player.x + Math.cos(player.angle) * 20, player.y + Math.sin(player.angle) * 20 + laserOffY);
    ctx.lineTo(player.x + Math.cos(player.angle) * 600, player.y + Math.sin(player.angle) * 600 + laserOffY);
    ctx.stroke(); ctx.setLineDash([]);

    // LASER FLASH on fire — bright wide beam that fades quickly
    if (this._laserFlashTimer > 0) {
      const t = this._laserFlashTimer / 0.15; // 1→0
      const a = this._laserFlashAngle;
      const sx = this._laserFlashX + Math.cos(a) * 15;
      const sy = this._laserFlashY + Math.sin(a) * 15 - 10;
      const ex = this._laserFlashX + Math.cos(a) * 800;
      const ey = this._laserFlashY + Math.sin(a) * 800 - 10;
      // Bright core
      ctx.strokeStyle = `rgba(255,255,255,${t * 0.9})`; ctx.lineWidth = 3 * t;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      // Red glow
      ctx.strokeStyle = `rgba(255,60,60,${t * 0.7})`; ctx.lineWidth = 8 * t;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      // Outer glow
      ctx.strokeStyle = `rgba(255,0,0,${t * 0.3})`; ctx.lineWidth = 18 * t;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      // Muzzle flash
      ctx.fillStyle = `rgba(255,200,150,${t})`; ctx.beginPath();
      ctx.arc(sx, sy, 10 * t, 0, Math.PI * 2); ctx.fill();
    }
  }
  drawHUD(ctx, w, h, player) {
    const F = Theme.fontUI;
    ctx.fillStyle = Theme.primary; ctx.font = `16px ${F}`; ctx.textAlign = 'left';
    ctx.fillText('CLICK=fire  R=reload  RCLICK=dash', 20, h - 50);
    const ammoStr = '|'.repeat(this.ammo) + '.'.repeat(this.maxAmmo - this.ammo);
    ctx.fillStyle = '#f44'; ctx.font = `bold 22px ${F}`;
    ctx.fillText(`AMMO [${ammoStr}] ${this.ammo}/${this.maxAmmo}`, 20, h - 75);
    if (this.reloading) {
      const pct = 1 - this.reloadTimer / this.reloadTime;
      ctx.fillStyle = '#fa0'; ctx.font = `bold 22px ${F}`;
      ctx.fillText(`RELOADING... ${Math.floor(pct * 100)}%`, 20, h - 100);
    }
  }
}

// --- Chain Gun (Fused: Boxing + Sniper) ---
class ChainGun {
  constructor() {
    this.name = '钩索枪'; this.color = '#a0f';
    this.chainX = 0; this.chainY = 0; this.chainVX = 0; this.chainVY = 0;
    this.chainTarget = null;
    this.chainState = 'ready'; // ready, flying, locked
    this.chainTimer = 0; this.chainDuration = 3;
    this.chainSpeed = 900; this.chainRange = 450;
    this.gunFireRate = 10; this.gunFireTimer = 0;
    this.gunDamage = 20; this.gunSpread = 0.12;
    this.slowSpeed = 50; // very slow movement when this weapon is equipped
  }
  update(dt, player, enemies, meleeHits, projectiles) {
    // Override player speed — very slow, just enough to pick up memory cards
    player.speed = this.slowSpeed;

    // Fire chain with E or CLICK (when not locked)
    if (this.chainState === 'ready' && (Input.justPressed('KeyE') || Input.mouse.clicked)) {
      this.chainState = 'flying';
      this.chainX = player.x; this.chainY = player.y;
      this.chainVX = Math.cos(player.angle) * this.chainSpeed;
      this.chainVY = Math.sin(player.angle) * this.chainSpeed;
      this.chainTimer = this.chainRange / this.chainSpeed;
      Audio.grapple();
    }
    if (this.chainState === 'flying') {
      this.chainX += this.chainVX * dt; this.chainY += this.chainVY * dt;
      this.chainTimer -= dt;
      for (const e of enemies) {
        if (e.dead || e.dying) continue;
        if (Vec.dist({ x: this.chainX, y: this.chainY }, e) < 15 + e.radius) {
          this.chainState = 'locked'; this.chainTarget = e;
          e.stunned = true; e.stunTimer = this.chainDuration;
          this.chainTimer = this.chainDuration;
          Audio.grappleHit(); Effects.shake(5, 0.12);
          Particles.burst(e.x, e.y, 10, '#a0f', 150);
          break;
        }
      }
      if (this.chainTimer <= 0) { this.chainState = 'ready'; }
    }
    if (this.chainState === 'locked') {
      this.chainTimer -= dt;
      if (this.chainTarget) { this.chainX = this.chainTarget.x; this.chainY = this.chainTarget.y; }
      // Only allow shooting when locked onto a target
      if (this.gunFireTimer > 0) this.gunFireTimer -= dt;
      if (Input.mouse.down && this.gunFireTimer <= 0 && this.chainTarget && !this.chainTarget.dead) {
        this.gunFireTimer = 1 / this.gunFireRate;
        const toTarget = Math.atan2(this.chainTarget.y - player.y, this.chainTarget.x - player.x);
        const angle = toTarget + (Math.random() - 0.5) * this.gunSpread;
        const dmg = this.gunDamage * (1 + player.compactLevel * 0.1);
        projectiles.push(new Projectile(
          player.x + Math.cos(toTarget) * 18, player.y + Math.sin(toTarget) * 18,
          angle, 750, dmg, { color: '#ff0', radius: 3, life: 0.8, trail: true }
        ));
        Audio.dart();
        Particles.emit(player.x + Math.cos(toTarget) * 20, player.y + Math.sin(toTarget) * 20,
          2, '#ff0', { speed: 100, life: 0.08, angle: toTarget, spread: 0.4, size: 2 });
      }
      if (this.chainTimer <= 0 || !this.chainTarget || this.chainTarget.dead) {
        if (this.chainTarget) { this.chainTarget.stunned = false; }
        this.chainState = 'ready'; this.chainTarget = null;
      }
    }
  }
  draw(ctx, player) {
    // Gun shape — offset up 10px to align with hand
    const gunOffY = -10;
    ctx.save(); ctx.translate(player.x, player.y + gunOffY); ctx.rotate(player.angle);
    ctx.fillStyle = '#888'; ctx.fillRect(5, -3, 22, 6);
    ctx.fillStyle = '#666'; ctx.fillRect(0, -4, 8, 8);
    ctx.restore();
    // Chain visual — also offset up
    if (this.chainState === 'flying' || this.chainState === 'locked') {
      ctx.strokeStyle = '#a0f'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
      ctx.beginPath(); ctx.moveTo(player.x, player.y + gunOffY); ctx.lineTo(this.chainX, this.chainY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#fff'; ctx.beginPath();
      ctx.arc(this.chainX, this.chainY, 6, 0, Math.PI * 2); ctx.fill();
      if (this.chainState === 'locked' && this.chainTarget) {
        ctx.strokeStyle = '#a0f'; ctx.lineWidth = 2;
        const r = this.chainTarget.radius + 8;
        ctx.beginPath(); ctx.arc(this.chainTarget.x, this.chainTarget.y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#a0f'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(this.chainTarget.x, this.chainTarget.y, r + 4, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }
  drawHUD(ctx, w, h, player) {
    const F = Theme.fontUI;
    ctx.fillStyle = Theme.primary; ctx.font = `16px ${F}`; ctx.textAlign = 'left';
    ctx.fillText('CLICK=hook  HOLD=shoot  RCLICK=dash', 20, h - 50);
    let chainText, chainColor;
    if (this.chainState === 'ready') { chainText = 'HOOK: READY'; chainColor = Theme.success; }
    else if (this.chainState === 'flying') { chainText = 'HOOK: FLYING...'; chainColor = Theme.accent; }
    else if (this.chainState === 'locked') { chainText = `LOCKED! FIRE! ${this.chainTimer.toFixed(1)}s`; chainColor = Theme.warning; }
    else { chainText = 'HOOK: READY'; chainColor = Theme.success; }
    ctx.fillStyle = chainColor; ctx.font = `bold 22px ${F}`;
    ctx.fillText(chainText, 20, h - 75);
  }
}

// --- Dart Weapon ---
class DartWeapon {
  constructor() {
    this.name = '飞镖'; this.color = '#ccc';
    this.totalDarts = 25; this.throwCooldown = 0;
    this.throwRate = 5; // per sec
    this.baseDamage = 60;
    this.groundDarts = []; // darts on the ground for pickup
    this.hasReloaded = false; // R only works once
  }
  update(dt, player, enemies, meleeHits, projectiles) {
    if (this.throwCooldown > 0) this.throwCooldown -= dt;
    // Throw dart
    if (Input.mouse.clicked && this.totalDarts > 0 && this.throwCooldown <= 0) {
      this.totalDarts--;
      this.throwCooldown = 1 / this.throwRate;
      const dmg = this.baseDamage * (1 + player.compactLevel * 0.1);
      const p = new Projectile(
        player.x + Math.cos(player.angle) * 16, player.y + Math.sin(player.angle) * 16,
        player.angle, 850, dmg,
        { color: '#ccc', radius: 4, life: 1.2, trail: false, isDart: true }
      );
      projectiles.push(p);
      Audio.dart();
    }
    // R to recall ground darts — only works ONCE
    if (Input.justPressed('KeyR') && !this.hasReloaded) {
      this.hasReloaded = true;
      const pickupRange = 9999; // recall ALL ground darts
      this.groundDarts = this.groundDarts.filter(d => {
        this.totalDarts++;
        Particles.emit(d.x, d.y, 3, '#ccc', { speed: 50, life: 0.2 });
        return false;
      });
      Audio.menuSelect();
    }
    // Auto pickup on walk-over
    this.groundDarts = this.groundDarts.filter(d => {
      if (Vec.dist(d, player) < 25) { this.totalDarts++; return false; }
      return true;
    });
  }
  // Called when a dart projectile dies (missed or enemy died)
  dropDart(x, y) {
    this.groundDarts.push({ x, y });
  }
  draw(ctx, player) {
    // Only draw ground darts (pickups) — hand weapon comes from spritesheet
    for (const d of this.groundDarts) {
      ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 300 + d.x) * 0.15;
      ctx.fillStyle = '#bbb';
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(0, -5); ctx.lineTo(3, 0); ctx.lineTo(0, 5); ctx.lineTo(-3, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }
  drawHUD(ctx, w, h, player) {
    const F = Theme.fontUI;
    ctx.fillStyle = Theme.primary; ctx.font = `16px ${F}`; ctx.textAlign = 'left';
    const reloadHint = this.hasReloaded ? '(R used)' : 'R=recall (once)';
    ctx.fillText(`CLICK=throw  ${reloadHint}  RCLICK=dash`, 20, h - 50);
    ctx.fillStyle = this.totalDarts > 5 ? '#fff' : this.totalDarts > 0 ? '#fa0' : '#f44';
    ctx.font = `bold 22px ${F}`;
    ctx.fillText(`DARTS: ${this.totalDarts}`, 20, h - 75);
    if (this.groundDarts.length > 0) {
      ctx.fillStyle = Theme.primary; ctx.font = `16px ${F}`;
      ctx.fillText(`(${this.groundDarts.length} on ground)`, 200, h - 75);
    }
  }
}

// --- Katana (charge arc: short=45°, medium=90°, long=120°) ---
class KatanaWeapon {
  constructor() {
    this.name = '武士刀'; this.color = '#ccc';
    this.baseDamage = 80; this.baseRange = 115;
    this.charging = false; this.chargeTime = 0;
    this.slashCooldown = 0;
    // Slash visual state
    this.slashing = false; this.slashArc = 0; this.slashAngle = 0;
    this.slashTimer = 0; this.slashDuration = 0.15;
  }
  update(dt, player, enemies, meleeHits) {
    if (this.slashCooldown > 0) this.slashCooldown -= dt;
    // Slash animation
    if (this.slashing) {
      this.slashTimer -= dt;
      if (this.slashTimer <= 0) this.slashing = false;
    }
    // Charge: hold mouse
    if (Input.mouse.down && this.slashCooldown <= 0 && !this.slashing) {
      if (!this.charging) { this.charging = true; this.chargeTime = 0; }
      this.chargeTime += dt;
    }
    // Release: slash with arc based on charge time
    if (this.charging && !Input.mouse.down) {
      const t = this.chargeTime;
      let arcDeg, dmgMult, label;
      if (t >= 1.0) { arcDeg = 120; dmgMult = 1.8; label = 'heavy'; }
      else if (t >= 0.4) { arcDeg = 90; dmgMult = 1.3; label = 'medium'; }
      else { arcDeg = 45; dmgMult = 0.7; label = 'light'; }
      const arcRad = (arcDeg / 180) * Math.PI;
      const range = this.baseRange * (1 + player.compactLevel * 0.08);
      const dmg = this.baseDamage * dmgMult * (1 + player.compactLevel * 0.1);
      const hit = new MeleeHit(player.x, player.y, player.angle, range, arcRad, dmg, {
        color: '#ccc', knockback: arcDeg >= 90 ? 200 : 100,
      });
      hit.isKatana = true;
      meleeHits.push(hit);
      // Slash visual
      this.slashing = true; this.slashArc = arcRad; this.slashAngle = player.angle;
      this.slashTimer = this.slashDuration;
      this.slashCooldown = arcDeg >= 120 ? 0.5 : arcDeg >= 90 ? 0.3 : 0.15;
      const shakeAmt = arcDeg >= 120 ? 8 : arcDeg >= 90 ? 5 : 3;
      Effects.shake(shakeAmt, 0.1);
      if (arcDeg >= 120) Effects.slowMotion(0.15, 0.06);
      Audio.hit();
      this.charging = false; this.chargeTime = 0;
    }
  }
  draw(ctx, player) {
    // All visuals come from the katana spritesheet animation — no extra lines needed
  }
  drawHUD(ctx, w, h, player) {
    const F = Theme.fontUI;
    ctx.fillStyle = Theme.primary; ctx.font = `16px ${F}`; ctx.textAlign = 'left';
    ctx.fillText('HOLD=charge  45°/90°/120°  RCLICK=dash', 20, h - 50);
    if (this.charging) {
      const t = this.chargeTime;
      let label, col;
      if (t >= 1.0) { label = '>>> 120° HEAVY'; col = '#ff4'; }
      else if (t >= 0.4) { label = '>>  90° MEDIUM'; col = '#fa0'; }
      else { label = '>   45° LIGHT'; col = '#fff'; }
      ctx.fillStyle = col; ctx.font = `bold 22px ${F}`;
      ctx.fillText(label, 20, h - 75);
    }
  }
}

// ============================
// PLAYER
// ============================
class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.radius = 14; this.hp = 100; this.maxHp = 100;
    this.baseSpeed = 280; this.speed = 280; this.angle = 0;
    this.baseDashSpeed = 650; this.dashSpeed = 650; this.dashDuration = 0.24; this.dashCooldown = 0.6;
    this.dashTimer = 0; this.dashCdTimer = 0; this.dashing = false; this.dashDir = { x: 0, y: 0 };
    this.invincible = false; this.invTimer = 0; this.hitFlashTimer = 0;
    this.weapon = null; // Set per level
    this.compactLevel = 0;
    this.afterimages = []; this.dead = false;
    this.bodyColor = '#4ff';
    this.stunned = false; this.stunnedTimer = 0;
  }
  update(dt, projectiles, enemies, meleeHits) {
    if (this.dead) return;
    // Stunned: can't move or act
    if (this.stunned) {
      this.stunnedTimer -= dt;
      this.vx = 0; this.vy = 0;
      if (this.stunnedTimer <= 0) { this.stunned = false; }
      return;
    }
    this.angle = Math.atan2(Input.mouse.worldY - this.y, Input.mouse.worldX - this.x);
    const move = Input.getMovement();
    if (this.dashing) {
      this.dashTimer -= dt;
      this.vx = this.dashDir.x * this.dashSpeed; this.vy = this.dashDir.y * this.dashSpeed;
      if (Math.random() > 0.3) this.afterimages.push({ x: this.x, y: this.y, alpha: 0.6, angle: this.angle });
      if (this.dashTimer <= 0) { this.dashing = false; this.invincible = false; this.dashSpeed = this.baseDashSpeed; }
    } else {
      this.vx = move.x * this.speed; this.vy = move.y * this.speed;
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    // Dash: always right-click, dash toward cursor
    if (Input.mouse.rightClicked && this.dashCdTimer <= 0 && !this.dashing) {
      this.dashing = true; this.invincible = true; this.dashTimer = this.dashDuration;
      this.dashCdTimer = this.dashCooldown;
      this.dashSpeed = this.baseDashSpeed; // ensure base speed for normal dash
      this.dashDir = Vec.norm(Vec.sub({ x: Input.mouse.worldX, y: Input.mouse.worldY }, this));
      Audio.dash(); Particles.emit(this.x, this.y, 8, '#4ff', { speed: 150, life: 0.3, size: 3 });
    }
    if (this.dashCdTimer > 0) this.dashCdTimer -= dt;
    if (this.invTimer > 0) { this.invTimer -= dt; if (this.invTimer <= 0) this.invincible = false; }
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
    this.afterimages = this.afterimages.filter(a => { a.alpha -= dt * 4; return a.alpha > 0; });
    // Weapon
    if (this.weapon) this.weapon.update(dt, this, enemies, meleeHits, projectiles);
  }
  takeDamage(amount) {
    if (this.invincible || this.dead) return;
    this.hp -= amount; this.invincible = true; this.invTimer = 0.5; this.hitFlashTimer = 0.15;
    Audio.playerHit(); Effects.shake(8, 0.2); Effects.flash(Theme.danger, 0.15);
    Particles.burst(this.x, this.y, 12, '#f44', 200);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }
  draw(ctx) {
    for (const a of this.afterimages) {
      ctx.globalAlpha = a.alpha * 0.4;
      this._drawBody(ctx, a.x, a.y, a.angle, '#4ff');
    }
    ctx.globalAlpha = 1;
    if (this.dead) return;
    if (this.invincible && !this.dashing && Math.floor(Date.now() / 60) % 2 === 0) ctx.globalAlpha = 0.3;
    const color = this.hitFlashTimer > 0 ? '#fff' : this.bodyColor;
    this._drawBody(ctx, this.x, this.y, this.angle, color);
    ctx.globalAlpha = 1;
    if (this.weapon) this.weapon.draw(ctx, this);
  }
  _drawBody(ctx, x, y, angle, color) {
    const anims = AsciiSprite._anims || {};

    // Determine animation state and pick frame
    let frames, fps, freezeFrame = -1;
    const w = this.weapon;
    const isCharging = w && w.charging;
    const isReleasing = w && (w.punchCooldown > 0 || w.slashing || (w.gunFireTimer > 0 && w.chainState === 'locked'));
    const isSniper = w instanceof SniperRifle;
    const isSniperFiring = isSniper && w._laserFlashTimer > 0;

    const isHook = w instanceof ChainGun;
    const isHookFlying = isHook && w.chainState === 'flying';
    const isHookLocked = isHook && w.chainState === 'locked';

    const isDarts = w instanceof DartWeapon;
    const isDartThrowing = isDarts && w.throwCooldown > 0;

    const isKatana = w instanceof KatanaWeapon;
    const isKatanaCharging = isKatana && w.charging;
    const isKatanaSlashing = isKatana && w.slashing;

    if (isDarts && anims.darts && anims.darts.length > 0) {
      // Darts: play throw animation when throwing, else run/idle
      if (isDartThrowing) {
        frames = anims.darts; fps = 18;
      } else if (this.dashing && anims.run && anims.run.length > 0) {
        frames = anims.run; fps = 20;
      } else if ((Math.abs(this.vx) > 10 || Math.abs(this.vy) > 10) && anims.run && anims.run.length > 0) {
        frames = anims.run; fps = 12;
      } else if (anims.idle && anims.idle.length > 0) {
        frames = anims.idle; fps = 8;
      }
    } else if (isKatana && anims.katana && anims.katana.length > 0) {
      // Katana: charge freezes on early frames, slash plays full animation
      if (isKatanaSlashing) {
        frames = anims.katana; fps = 20; // fast slash playback
      } else if (isKatanaCharging) {
        frames = anims.katana;
        const ct = w.chargeTime || 0;
        if (ct >= 1.0)      freezeFrame = Math.min(3, frames.length - 1);
        else if (ct >= 0.4) freezeFrame = Math.min(2, frames.length - 1);
        else                freezeFrame = Math.min(1, frames.length - 1);
        fps = 1;
      } else if (this.dashing && anims.run && anims.run.length > 0) {
        frames = anims.run; fps = 20;
      } else if ((Math.abs(this.vx) > 10 || Math.abs(this.vy) > 10) && anims.run && anims.run.length > 0) {
        frames = anims.run; fps = 12;
      } else if (anims.idle && anims.idle.length > 0) {
        frames = anims.idle; fps = 8;
      }
    } else if (isHook && anims.hook && anims.hook.length >= 5) {
      // Hook weapon: first 5 frames for throwing, freeze frame 5 when locked+shooting, else run/idle
      if (isHookFlying) {
        frames = anims.hook.slice(0, 5); fps = 15; // throw animation
      } else if (isHookLocked) {
        frames = anims.hook.slice(0, 5); freezeFrame = 4; fps = 1; // freeze on frame 5
      } else if (this.dashing && anims.run && anims.run.length > 0) {
        frames = anims.run; fps = 20;
      } else if ((Math.abs(this.vx) > 10 || Math.abs(this.vy) > 10) && anims.run && anims.run.length > 0) {
        frames = anims.run; fps = 12;
      } else if (anims.idle && anims.idle.length > 0) {
        frames = anims.idle; fps = 8;
      }
    } else if (isSniper && anims.gun && anims.gun.length > 0) {
      // Sniper: gun sprite ONLY when shooting, otherwise use normal run/idle
      if (isSniperFiring) {
        const recoilFrames = anims.gun.length > 8 ? [anims.gun[7], anims.gun[8]] : [anims.gun[anims.gun.length - 1]];
        frames = recoilFrames; fps = 10;
      } else if (this.dashing && anims.run && anims.run.length > 0) {
        frames = anims.run; fps = 20;
      } else if ((Math.abs(this.vx) > 10 || Math.abs(this.vy) > 10) && anims.run && anims.run.length > 0) {
        frames = anims.run; fps = 12;
      } else if (anims.idle && anims.idle.length > 0) {
        frames = anims.idle; fps = 8;
      }
    } else if (isCharging && anims.attack && anims.attack.length >= 4) {
      // Boxing charging: use first 4 attack frames
      frames = anims.attack.slice(0, 4);
      const ct = w.chargeTime || 0;
      if (ct >= 2.0)      freezeFrame = 3;
      else if (ct >= 1.0) freezeFrame = 2;
      else if (ct >= 0.5) freezeFrame = 1;
      else                freezeFrame = 0;
      fps = 1;
    } else if (isReleasing && anims.attack && anims.attack.length > 8) {
      frames = [anims.attack[7], anims.attack[8]]; fps = 10;
    } else if (this.dashing && anims.run && anims.run.length > 0) {
      frames = anims.run; fps = 20;
    } else if ((Math.abs(this.vx) > 10 || Math.abs(this.vy) > 10) && anims.run && anims.run.length > 0) {
      frames = anims.run; fps = 12;
    } else if (anims.idle && anims.idle.length > 0) {
      frames = anims.idle; fps = 8;
    } else {
      frames = null;
    }

    // Flip based on aim direction — but LOCK direction during attack animations
    const inAttackAnim = w && (w.slashing || w.charging || w.punchCooldown > 0 ||
      (w instanceof ChainGun && w.chainState === 'flying') ||
      (w instanceof SniperRifle && w._laserFlashTimer > 0) ||
      (w instanceof DartWeapon && w.throwCooldown > 0));

    if (inAttackAnim) {
      // Keep the locked direction from when the attack started
      if (this._lockedFacingLeft === undefined) {
        this._lockedFacingLeft = Math.abs(angle) > Math.PI / 2;
      }
    } else {
      // Free to change direction
      this._lockedFacingLeft = Math.abs(angle) > Math.PI / 2;
    }
    const facingLeft = this._lockedFacingLeft;

    ctx.save();
    ctx.translate(x, y);
    if (facingLeft) ctx.scale(-1, 1);

    if (frames && frames.length > 0) {
      const frameIdx = freezeFrame >= 0 ? freezeFrame : Math.floor(Date.now() / (1000 / fps)) % frames.length;
      const spriteName = frames[frameIdx];
      const sprite = AsciiSprite.get(spriteName);
      if (sprite) {
        ctx.drawImage(sprite.canvas, -sprite.cx, -sprite.cy);
      }
    } else {
      // Fallback triangle if sprites not loaded
      ctx.rotate(angle);
      ctx.fillStyle = color; ctx.beginPath();
      ctx.moveTo(this.radius + 4, 0); ctx.lineTo(-this.radius + 2, -this.radius + 2);
      ctx.lineTo(-this.radius + 6, 0); ctx.lineTo(-this.radius + 2, this.radius - 2);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

// ============================
// ENEMIES
// ============================

// --- Base Enemy ---
class Enemy {
  constructor(type, x, y) {
    this.type = type; this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.hp = type.hp; this.maxHp = type.hp;
    this.speed = type.speed; this.radius = type.radius;
    this.color = type.color; this.damage = type.damage;
    this.attackTimer = type.attackCooldown * Math.random();
    this.attackCooldown = type.attackCooldown;
    this.angle = 0; this.dead = false; this.dying = false; this.dyingTimer = 0;
    this.hitFlash = 0; this.stunned = false; this.stunTimer = 0;
    this.spawnTimer = 0.4; this.isBoss = type.isBoss || false;
    this.score = type.score || 10;
    // Specific state
    this.phaseTimer = Math.random() * Math.PI * 2;
    this.orbitAngle = Math.random() * Math.PI * 2;
    this.orbitRadius = type.orbitRadius || 200;
    this.orbitSpeed = type.orbitSpeed || 2;
    this.growthRate = type.growthRate || 0;
    this.floatingText = type.floatingText || null;
    this.textIndex = 0;
    this.bossPattern = 0; this.bossPatternTimer = 0;
    this.chargeState = null; this.chargeDir = { x: 0, y: 0 }; this.chargeTimer = 0;
    this.isFake = type.isFake || false;
    this.revealed = false;
    this.origRadius = type.radius;
    this.ghostStepTimer = 0; this.ghostDir = { x: 0, y: 0 };
  }

  update(dt, player, enemyProjectiles, arena) {
    if (this.dying) { this.dyingTimer -= dt; if (this.dyingTimer <= 0) this.dead = true; return; }
    if (this.spawnTimer > 0) { this.spawnTimer -= dt; return; }
    if (this.stunned) { this.stunTimer -= dt; if (this.stunTimer <= 0) this.stunned = false; this.hitFlash -= dt; return; }
    this.hitFlash -= dt; this.attackTimer -= dt;
    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.angle = Math.atan2(dy, dx);
    // Growth (bats)
    if (this.growthRate > 0) {
      this.radius += this.growthRate * dt;
      this.damage = this.type.damage * (this.radius / this.origRadius);
    }
    // Behavior dispatch
    const b = this.type.behavior;
    if (b === 'shoe') this._behaviorShoe(dt, player, dist);
    else if (b === 'spider') this._behaviorSpider(dt, player, dist);
    else if (b === 'water') { this._arena = arena; this._behaviorWater(dt, player, dist, enemyProjectiles); }
    else if (b === 'bat') this._behaviorBat(dt, player, dist);
    else if (b === 'scarecrow') this._behaviorScarecrow(dt, player, dist);
    else if (b === 'boss_mirror') this._bossMirror(dt, player, dist, enemyProjectiles);
    else if (b === 'boss_spider') this._bossSpider(dt, player, dist, enemyProjectiles);
    else if (b === 'boss_pillow') this._bossPillow(dt, player, dist);
    else if (b === 'boss_tiger') this._bossTiger(dt, player, dist);
    else if (b === 'boss_real') this._bossReal(dt, player, dist, enemyProjectiles);

    this.x += this.vx * dt; this.y += this.vy * dt;
    if (arena) {
      this.x = clamp(this.x, arena.left + this.radius, arena.right - this.radius);
      this.y = clamp(this.y, arena.top + this.radius, arena.bottom - this.radius);
    }
  }

  // --- Shoe: Slow approach, occasional stomp lunge ---
  _behaviorShoe(dt, player, dist) {
    if (this.chargeState === 'stomp') {
      this.chargeTimer -= dt;
      this.vx = this.chargeDir.x * this.speed * 4;
      this.vy = this.chargeDir.y * this.speed * 4;
      Particles.trail(this.x, this.y, this.color, 2);
      if (this.chargeTimer <= 0) this.chargeState = null;
      return;
    }
    const dir = Vec.norm(Vec.sub(player, this));
    this.vx = dir.x * this.speed; this.vy = dir.y * this.speed;
    if (dist < 180 && this.attackTimer <= 0 && Math.random() < 0.08) {
      this.chargeState = 'stomp';
      this.chargeDir = Vec.norm(Vec.sub(player, this));
      this.chargeTimer = 0.2;
      this.attackTimer = this.attackCooldown;
    }
  }

  // --- Spider: Elliptical orbit, spiraling inward ---
  _behaviorSpider(dt, player, dist) {
    this.orbitAngle += this.orbitSpeed * dt;
    this.orbitRadius = Math.max(30, this.orbitRadius - 8 * dt); // spiral in
    const targetX = player.x + Math.cos(this.orbitAngle) * this.orbitRadius;
    const targetY = player.y + Math.sin(this.orbitAngle) * this.orbitRadius * 0.6; // ellipse
    const dir = Vec.norm(Vec.sub({ x: targetX, y: targetY }, this));
    this.vx = dir.x * this.speed; this.vy = dir.y * this.speed;
  }

  // --- Water Flow: Strafe around player + shoot projectiles ---
  _behaviorWater(dt, player, dist, enemyProjectiles) {
    const preferDist = 200;
    if (dist < preferDist - 40) {
      // Too close — back away
      const dir = Vec.norm(Vec.sub(this, player));
      this.vx = dir.x * this.speed; this.vy = dir.y * this.speed;
    } else if (dist > preferDist + 60) {
      // Too far — approach
      const dir = Vec.norm(Vec.sub(player, this));
      this.vx = dir.x * this.speed * 0.7; this.vy = dir.y * this.speed * 0.7;
    } else {
      // Strafe orbit around player
      const perpDir = Vec.norm({ x: -(player.y - this.y), y: player.x - this.x });
      const strafeDir = this.orbitSpeed > 0 ? 1 : -1;
      this.vx = perpDir.x * this.speed * 0.6 * strafeDir;
      this.vy = perpDir.y * this.speed * 0.6 * strafeDir;
    }
    // Shoot water projectiles at player (slow, low damage)
    if (this.attackTimer <= 0 && dist < 350) {
      this.attackTimer = this.type.attackCooldown;
      if (typeof enemyProjectiles !== 'undefined' && enemyProjectiles) {
        enemyProjectiles.push(new Projectile(this.x, this.y, this.angle, 200, 1,
          { color: '#48f', radius: 4, fromPlayer: false, life: 1.5, trail: true }));
      }
    }
    // Leave water trail
    if (Math.random() > 0.5) Particles.trail(this.x, this.y, '#48f', 2);
  }

  // --- Bat: Chase, grow over time ---
  _behaviorBat(dt, player, dist) {
    const spd = Math.max(40, this.speed - this.radius); // slower when bigger
    const dir = Vec.norm(Vec.sub(player, this));
    this.vx = dir.x * spd; this.vy = dir.y * spd;
  }

  // --- Scarecrow: Stand still (fake) or hide (real) ---
  _behaviorScarecrow(dt, player, dist) {
    if (this.isFake) { this.vx = 0; this.vy = 0; return; }
    if (!this.revealed) { this.vx = 0; this.vy = 0; return; }
    // Once revealed, chase aggressively
    const dir = Vec.norm(Vec.sub(player, this));
    this.vx = dir.x * this.speed; this.vy = dir.y * this.speed;
  }

  // --- Boss: Mirror (L1) ---
  _bossMirror(dt, player, dist, projectiles) {
    this.bossPatternTimer -= dt;
    if (this.bossPatternTimer <= 0) { this.bossPattern = (this.bossPattern + 1) % 3; this.bossPatternTimer = 4; }
    switch (this.bossPattern) {
      case 0: // Mirror player movement
        this.vx = -player.vx * 0.8; this.vy = -player.vy * 0.8; break;
      case 1: // Charge at player
        if (!this.chargeState) { this.chargeState = 'windup'; this.chargeTimer = 0.6; this.chargeDir = Vec.norm(Vec.sub(player, this)); }
        if (this.chargeState === 'windup') { this.chargeTimer -= dt; this.vx *= 0.9; this.vy *= 0.9; if (this.chargeTimer <= 0) { this.chargeState = 'charge'; this.chargeTimer = 0.3; } }
        else if (this.chargeState === 'charge') { this.vx = this.chargeDir.x * 500; this.vy = this.chargeDir.y * 500; Particles.trail(this.x, this.y, this.color, 4); this.chargeTimer -= dt; if (this.chargeTimer <= 0) this.chargeState = null; }
        break;
      case 2: // Spawn mirror shards (projectiles)
        this.vx *= 0.95; this.vy *= 0.95;
        if (this.attackTimer <= 0) { this.attackTimer = 1.2; this.phaseTimer += 0.5;
          for (let i = 0; i < 4; i++) { const a = (Math.PI * 2 / 4) * i + this.phaseTimer;
            projectiles.push(new Projectile(this.x, this.y, a, 160, 10, { color: '#aaf', radius: 4, fromPlayer: false, life: 2.5 })); }
        } break;
    }
  }

  // --- Boss: Giant Spider (L2) ---
  _bossSpider(dt, player, dist, projectiles) {
    this.bossPatternTimer -= dt;
    if (this.bossPatternTimer <= 0) { this.bossPattern = (this.bossPattern + 1) % 3; this.bossPatternTimer = 3.5; }
    switch (this.bossPattern) {
      case 0: // Web spray
        this.vx *= 0.95; this.vy *= 0.95;
        if (this.attackTimer <= 0) { this.attackTimer = 0.3; const a = this.angle + (Math.random() - 0.5) * 0.8;
          projectiles.push(new Projectile(this.x, this.y, a, 300, 10, { color: '#aaa', radius: 6, fromPlayer: false, life: 2.5 })); } break;
      case 1: // Rush at player
        const dir = Vec.norm(Vec.sub(player, this)); this.vx = dir.x * this.speed * 2.5; this.vy = dir.y * this.speed * 2.5;
        Particles.trail(this.x, this.y, this.color, 3); break;
      case 2: // Circle and shoot
        this.orbitAngle += 1.5 * dt; this.vx = Math.cos(this.orbitAngle) * this.speed; this.vy = Math.sin(this.orbitAngle) * this.speed;
        if (this.attackTimer <= 0) { this.attackTimer = 0.6;
          projectiles.push(new Projectile(this.x, this.y, this.angle, 350, 12, { color: '#fa0', radius: 5, fromPlayer: false, life: 2 })); } break;
    }
  }

  // --- Boss: Pillow (L3) — wraps/engulfs player ---
  _bossPillow(dt, player, dist) {
    if (!this._pillowState) this._pillowState = 'idle';
    if (!this._pillowTimer) this._pillowTimer = 1.2;
    this._pillowTimer -= dt;

    // BREAK FREE from chain stun after 1s, then instant counter-attack
    if (this.stunned && this._pillowState !== 'wrapping') {
      if (!this._breakFreeTimer) this._breakFreeTimer = 1.0;
      this._breakFreeTimer -= dt;
      if (this._breakFreeTimer <= 0) {
        this.stunned = false; this.stunTimer = 0;
        this._breakFreeTimer = null;
        // Immediately counter-attack: lunge at player
        this._pillowState = 'lunge';
        this._pillowTimer = 0.4;
        this._engulfDir = Vec.norm(Vec.sub(player, this));
        this.radius = 55;
        Effects.shake(8, 0.15);
        Particles.burst(this.x, this.y, 15, '#aaf', 250);
        Audio.grapple();
        return;
      }
    } else {
      this._breakFreeTimer = null;
    }

    if (this._pillowState === 'idle') {
      // Aggressively approach player
      const dir = Vec.norm(Vec.sub(player, this));
      this.vx = dir.x * this.speed * 1.5; this.vy = dir.y * this.speed * 1.5;
      if (this._pillowTimer <= 0) {
        this._pillowState = 'windup';
        this._pillowTimer = 0.4;
        this._engulfDir = Vec.norm(Vec.sub(player, this));
        this.vx = 0; this.vy = 0;
      }
    } else if (this._pillowState === 'windup') {
      this._pillowTimer -= dt;
      this.radius = 40 + (0.8 - this._pillowTimer) * 20;
      this.vx = (Math.random() - 0.5) * 120; this.vy = (Math.random() - 0.5) * 120;
      if (this._pillowTimer <= 0) {
        this._pillowState = 'lunge';
        this._pillowTimer = 0.4;
        this._engulfDir = Vec.norm(Vec.sub(player, this));
        Audio.grapple();
      }
    } else if (this._pillowState === 'lunge') {
      this._pillowTimer -= dt;
      this.radius = 58;
      this.vx = this._engulfDir.x * 750;
      this.vy = this._engulfDir.y * 750;
      Particles.trail(this.x, this.y, '#aaf', 4);
      if (dist < this.radius + player.radius && !player.invincible && !player.dashing) {
        this._pillowState = 'wrapping';
        this._pillowTimer = 2.0;
        player.stunned = true;
        player.stunnedTimer = 2.0;
        player.takeDamage(this.damage);
        Effects.shake(12, 0.3);
        Effects.flash(Theme.accent, 0.3);
        Audio.playerHit();
      }
      if (this._pillowTimer <= 0) {
        this._pillowState = 'cooldown';
        this._pillowTimer = 0.6; // shorter cooldown = more aggressive
      }
    } else if (this._pillowState === 'wrapping') {
      this._pillowTimer -= dt;
      this.x = lerp(this.x, player.x, 0.3);
      this.y = lerp(this.y, player.y, 0.3);
      this.vx = 0; this.vy = 0;
      this.radius = 58 + Math.sin(Date.now() / 80) * 6;
      if (Math.floor(Date.now() / 300) % 2 === 0 && !player.invincible) {
        player.takeDamage(5 * dt * 60);
      }
      if (this._pillowTimer <= 0) {
        player.stunned = false;
        this._pillowState = 'cooldown';
        this._pillowTimer = 0.8;
        Particles.burst(this.x, this.y, 15, '#aaf', 250);
      }
    } else if (this._pillowState === 'cooldown') {
      this._pillowTimer -= dt;
      this.radius = lerp(this.radius, 40, 0.08);
      const dir = Vec.norm(Vec.sub(player, this));
      this.vx = dir.x * this.speed * 0.5; this.vy = dir.y * this.speed * 0.5;
      if (this._pillowTimer <= 0) {
        this._pillowState = 'idle';
        this._pillowTimer = 1.0; // attacks more frequently
        this.radius = 40;
      }
    }
  }

  // --- Boss: Paper Tiger (L4) ---
  _bossTiger(dt, player, dist, projectiles) {
    this.bossPatternTimer -= dt;
    if (this.bossPatternTimer <= 0) { this.bossPattern = (this.bossPattern + 1) % 3; this.bossPatternTimer = 2.5; }
    if (this.bossPattern === 0) { // Triple charge combo
      if (!this.chargeState) { this.chargeState = 'windup'; this.chargeTimer = 0.4; this.chargeDir = Vec.norm(Vec.sub(player, this)); this._tigerDashes = 0; }
      if (this.chargeState === 'windup') { this.vx = (Math.random()-0.5)*100; this.vy = (Math.random()-0.5)*100; this.chargeTimer -= dt; if (this.chargeTimer <= 0) { this.chargeState = 'charge'; this.chargeTimer = 0.3; this.chargeDir = Vec.norm(Vec.sub(player, this)); } }
      else if (this.chargeState === 'charge') { this.vx = this.chargeDir.x * 650; this.vy = this.chargeDir.y * 650; Particles.trail(this.x, this.y, '#fa0', 5); this.chargeTimer -= dt;
        if (this.chargeTimer <= 0) { this._tigerDashes++; if (this._tigerDashes < 3) { this.chargeState = 'windup'; this.chargeTimer = 0.2; } else this.chargeState = null; }
      }
    } else if (this.bossPattern === 1) { // Paper shrapnel burst
      this.vx *= 0.92; this.vy *= 0.92;
      if (this.attackTimer <= 0) { this.attackTimer = 0.3;
        for (let i = 0; i < 10; i++) { const a = (Math.PI*2/10)*i + this.time*0.5;
          projectiles.push(new Projectile(this.x, this.y, a, 350, 15, { color: '#fa0', radius: 4, fromPlayer: false, life: 2.5 }));
        } Effects.shake(4, 0.1);
      }
    } else { // Fast circle strafe + aimed shots
      this.orbitAngle = (this.orbitAngle || 0) + 2.5 * dt;
      const targetX = player.x + Math.cos(this.orbitAngle) * 110;
      const targetY = player.y + Math.sin(this.orbitAngle) * 110;
      const d = Vec.norm(Vec.sub({ x: targetX, y: targetY }, this));
      this.vx = d.x * this.speed * 1.5; this.vy = d.y * this.speed * 1.5;
      if (this.attackTimer <= 0) { this.attackTimer = 0.35;
        projectiles.push(new Projectile(this.x, this.y, this.angle, 500, 18, { color: '#fa0', radius: 4, fromPlayer: false, life: 2 }));
      }
    }
    this.time = (this.time || 0) + dt;
  }

  // --- Boss: Real Scarecrow (L6) — very aggressive boss ---
  _bossReal(dt, player, dist, projectiles) {
    this.bossPatternTimer -= dt;
    if (this.bossPatternTimer <= 0) { this.bossPattern = (this.bossPattern + 1) % 4; this.bossPatternTimer = 2.5; }
    switch (this.bossPattern) {
      case 0: // Aggressive chase with high speed
        const dir0 = Vec.norm(Vec.sub(player, this));
        this.vx = dir0.x * this.speed * 2; this.vy = dir0.y * this.speed * 2;
        Particles.trail(this.x, this.y, '#a86', 2);
        break;
      case 1: // Rapid dash attacks (multiple)
        if (!this.chargeState) { this.chargeState = 'windup'; this.chargeTimer = 0.25; this.chargeDir = Vec.norm(Vec.sub(player, this)); this._dashCount = 0; }
        if (this.chargeState === 'windup') {
          this.vx = (Math.random() - 0.5) * 100; this.vy = (Math.random() - 0.5) * 100;
          this.chargeTimer -= dt;
          if (this.chargeTimer <= 0) { this.chargeState = 'charge'; this.chargeTimer = 0.2; this.chargeDir = Vec.norm(Vec.sub(player, this)); }
        } else if (this.chargeState === 'charge') {
          this.vx = this.chargeDir.x * 700; this.vy = this.chargeDir.y * 700;
          Particles.trail(this.x, this.y, '#f80', 5);
          this.chargeTimer -= dt;
          if (this.chargeTimer <= 0) {
            this._dashCount++;
            if (this._dashCount < 3) { this.chargeState = 'windup'; this.chargeTimer = 0.2; }
            else this.chargeState = null;
          }
        }
        break;
      case 2: // Straw shotgun burst
        this.vx *= 0.9; this.vy *= 0.9;
        if (this.attackTimer <= 0) { this.attackTimer = 0.3;
          for (let i = -2; i <= 2; i++) {
            projectiles.push(new Projectile(this.x, this.y, this.angle + i * 0.2, 400, 18,
              { color: '#da0', radius: 4, fromPlayer: false, life: 2 }));
          }
        }
        break;
      case 3: // Circle strafe + continuous fire
        this.orbitAngle = (this.orbitAngle || 0) + 2.5 * dt;
        const targetX = player.x + Math.cos(this.orbitAngle) * 120;
        const targetY = player.y + Math.sin(this.orbitAngle) * 120;
        const d3 = Vec.norm(Vec.sub({ x: targetX, y: targetY }, this));
        this.vx = d3.x * this.speed * 1.5; this.vy = d3.y * this.speed * 1.5;
        if (this.attackTimer <= 0) { this.attackTimer = 0.25;
          projectiles.push(new Projectile(this.x, this.y, this.angle, 450, 15,
            { color: '#f80', radius: 3, fromPlayer: false, life: 1.5 }));
        }
        break;
    }
  }

  takeDamage(amount) {
    if (this.dying || this.dead) return;
    // Fake scarecrow: instant kill
    if (this.isFake) { this.die(); Particles.burst(this.x, this.y, 8, '#da0', 100); return; }
    // Real scarecrow: reveal on first hit
    if (this.type.behavior === 'scarecrow' && !this.revealed) {
      this.revealed = true; this.isBoss = true;
      this.hp = this.type.realHp || this.hp;
      this.maxHp = this.hp;
      Particles.burst(this.x, this.y, 20, '#f80', 250);
      Effects.shake(10, 0.2); Effects.slowMotion(0.2, 0.1);
      return;
    }
    // Pillow boss: reduced damage unless stunned
    if (this.type.behavior === 'boss_pillow' && !this.stunned) amount *= 0.3;
    this.hp -= amount; this.hitFlash = 0.1; Audio.hit();
    if (this.hp <= 0) this.die();
  }

  die() {
    this.dying = true; this.dyingTimer = 0.3; this.vx = 0; this.vy = 0;
    Audio.enemyDie(); Effects.slowMotion(0.3, 0.05);
    // Paper shatter for bats/tiger
    if (this.type.behavior === 'bat' || this.type.behavior === 'boss_tiger') {
      const count = Math.floor(this.radius * 1.5);
      for (let i = 0; i < count; i++) {
        const a = randAngle(), spd = randRange(100, 350);
        Particles.list.push(new Particle(this.x, this.y, Math.cos(a) * spd, Math.sin(a) * spd,
          randRange(0.5, 1.2), randRange(3, 8), '#ddd', { friction: 0.96, gravity: 80 }));
      }
    } else {
      Particles.burst(this.x, this.y, 20, this.color, 300);
      Particles.burst(this.x, this.y, 10, '#fff', 150);
    }
  }

  canDamagePlayer(player) {
    if (this.dying || this.dead || this.spawnTimer > 0 || this.stunned || (this.isFake && !this.revealed)) return false;
    return Vec.dist(this, player) < this.radius + player.radius;
  }

  draw(ctx) {
    const alpha = this.spawnTimer > 0 ? (1 - this.spawnTimer / 0.4) : 1;
    ctx.globalAlpha = alpha;
    if (this.dying) {
      const t = 1 - this.dyingTimer / 0.3;
      ctx.globalAlpha = 1 - t;
      this._drawShape(ctx, this.x, this.y, this.radius * (1 + t * 0.5), '#fff');
      ctx.globalAlpha = 1; return;
    }
    const drawColor = this.hitFlash > 0 ? '#fff' : this.color;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath();
    ctx.ellipse(this.x + 3, this.y + 5, this.radius * 1.1, this.radius * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    // Stun indicator
    if (this.stunned) {
      ctx.strokeStyle = '#a0f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2); ctx.stroke();
      const t = Date.now() / 200;
      for (let i = 0; i < 3; i++) { const a = t + (Math.PI * 2 / 3) * i;
        ctx.fillStyle = Theme.warning; ctx.font = `10px ${Theme.fontUI}`;
        ctx.fillText('✦', this.x + Math.cos(a) * (this.radius + 10), this.y + Math.sin(a) * (this.radius + 10));
      }
    }
    // Floating text (water enemies)
    if (this.floatingText && !this.stunned) {
      this.textIndex = (this.textIndex || 0) + 0.002;
      const texts = this.floatingText;
      const text = texts[Math.floor(Date.now() / 3000) % texts.length];
      ctx.globalAlpha = 0.5; ctx.fillStyle = Theme.accent; ctx.font = `italic 10px ${Theme.fontUI}`; ctx.textAlign = 'center';
      ctx.fillText(text, this.x, this.y - this.radius - 10);
      ctx.globalAlpha = alpha;
    }
    this._drawShape(ctx, this.x, this.y, this.radius, drawColor);
    // HP bar
    if (this.isBoss || (this.hp < this.maxHp && !this.isFake)) {
      if (!this.isBoss) {
        const barW = this.radius * 2, barH = 3;
        ctx.fillStyle = '#333'; ctx.fillRect(this.x - barW / 2, this.y - this.radius - 8, barW, barH);
        ctx.fillStyle = this.color; ctx.fillRect(this.x - barW / 2, this.y - this.radius - 8, barW * (this.hp / this.maxHp), barH);
      }
    }
    ctx.globalAlpha = 1;
  }

  _drawShape(ctx, x, y, r, color) {
    const b = this.type.behavior;
    // Glow
    ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.12;
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = Math.min(1, (ctx.globalAlpha || 0.12) / 0.12) || 1;

    if (b === 'shoe') {
      // Shoe shape (elongated oval with heel)
      ctx.fillStyle = color; ctx.save(); ctx.translate(x, y); ctx.rotate(this.angle);
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.3, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = this.type.heelColor || '#a66';
      ctx.fillRect(-r * 0.8, -r * 0.3, r * 0.4, r * 0.6);
      ctx.restore();
    } else if (b === 'spider') {
      // Spider: body + 8 legs
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 / 8) * i + Date.now() / 300;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * r * 2, y + Math.sin(a) * r * 2); ctx.stroke();
      }
    } else if (b === 'water') {
      // Flowing amorphous water blob
      ctx.fillStyle = color; ctx.save(); ctx.translate(x, y);
      const t = Date.now() / 200 + this.phaseTimer * 5;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 / 8) * i;
        const wobble = r * (0.8 + Math.sin(t + i * 1.5) * 0.4);
        const px = Math.cos(a) * wobble, py = Math.sin(a) * wobble;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      // Inner glow
      ctx.fillStyle = 'rgba(150,200,255,0.3)';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (b === 'bat') {
      // Wing shape
      ctx.fillStyle = color; ctx.save(); ctx.translate(x, y);
      const wingFlap = Math.sin(Date.now() / 100) * 0.3;
      // Left wing
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-r * 1.5, -r * (0.8 + wingFlap), -r * 2, r * 0.3);
      ctx.lineTo(0, r * 0.3); ctx.fill();
      // Right wing
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(r * 1.5, -r * (0.8 + wingFlap), r * 2, r * 0.3);
      ctx.lineTo(0, r * 0.3); ctx.fill();
      // Body
      ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (b === 'scarecrow' || b === 'boss_real') {
      // Cross/stick figure — all look the same, no highlight for real ones
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke(); // body
      ctx.beginPath(); ctx.moveTo(x - r, y - r * 0.3); ctx.lineTo(x + r, y - r * 0.3); ctx.stroke(); // arms
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y - r * 1.1, r * 0.35, 0, Math.PI * 2); ctx.fill(); // head
    } else if (b === 'boss_mirror') {
      // Mirror: rectangle with reflection effect
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = '#aac'; ctx.fillRect(-r, -r * 1.3, r * 2, r * 2.6);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(-r * 0.8, -r * 1.1, r * 0.6, r * 2.2);
      ctx.strokeStyle = '#ddf'; ctx.lineWidth = 2;
      ctx.strokeRect(-r, -r * 1.3, r * 2, r * 2.6);
      ctx.restore();
    } else if (b === 'boss_spider') {
      // Giant spider
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f44'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + r * 0.3, y - r * 0.2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 / 8) * i + Math.sin(Date.now() / 200) * 0.1;
        const legLen = r * 2.5;
        const midX = x + Math.cos(a) * r * 1.3;
        const midY = y + Math.sin(a) * r * 1.3 - 5;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        ctx.quadraticCurveTo(midX, midY, x + Math.cos(a) * legLen, y + Math.sin(a) * legLen);
        ctx.stroke();
      }
    } else if (b === 'boss_pillow') {
      // Soft pillow shape — expands when lunging/wrapping
      const isWrapping = this._pillowState === 'wrapping';
      const isLunging = this._pillowState === 'lunge';
      const isWindup = this._pillowState === 'windup';
      ctx.fillStyle = isWrapping ? '#aac' : color;
      ctx.save(); ctx.translate(x, y);
      const squish = Math.sin(Date.now() / (isWrapping ? 100 : 500)) * (isWrapping ? 0.15 : 0.1);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * (1.4 + squish), r * (1.0 - squish), 0, 0, Math.PI * 2);
      ctx.fill();
      // Angry face when attacking
      if (isLunging || isWindup) {
        ctx.fillStyle = '#f44'; ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.1, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.3, -r * 0.1, 5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // Wrapping glow
      if (isWrapping) {
        ctx.strokeStyle = '#f44'; ctx.lineWidth = 3; ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 80) * 0.3;
        ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // Crease lines
      ctx.strokeStyle = '#aaf'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.3); ctx.lineTo(-r * 0.2, 0); ctx.lineTo(-r * 0.5, r * 0.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.3); ctx.lineTo(r * 0.2, 0); ctx.lineTo(r * 0.5, r * 0.3); ctx.stroke();
      ctx.restore();
    } else if (b === 'boss_tiger') {
      // Paper tiger - angular, intimidating but papery
      ctx.fillStyle = color; ctx.save(); ctx.translate(x, y); ctx.rotate(this.angle);
      ctx.beginPath();
      ctx.moveTo(r * 1.3, 0);
      ctx.lineTo(r * 0.5, -r);
      ctx.lineTo(-r, -r * 0.8);
      ctx.lineTo(-r * 0.7, 0);
      ctx.lineTo(-r, r * 0.8);
      ctx.lineTo(r * 0.5, r);
      ctx.closePath(); ctx.fill();
      // Stripes
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.6); ctx.lineTo(0, 0); ctx.lineTo(-r * 0.3, r * 0.6); ctx.stroke();
      // Eyes
      ctx.fillStyle = '#f44';
      ctx.beginPath(); ctx.arc(r * 0.4, -r * 0.25, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.4, r * 0.25, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else {
      // Default circle
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    // Core dot
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
  }
}

// ============================
// ENEMY TYPE DEFINITIONS
// ============================
const EnemyTypes = {
  // Level 1: Perfectness
  HIGH_HEEL: {
    hp: 60, speed: 130, radius: 13, color: '#e5a', damage: 12, attackCooldown: 1.5,
    behavior: 'shoe', heelColor: '#c38', score: 10,
  },
  LEATHER_SHOE: {
    hp: 80, speed: 100, radius: 16, color: '#864', damage: 15, attackCooldown: 2.0,
    behavior: 'shoe', heelColor: '#543', score: 12,
  },
  BOSS_MIRROR: {
    hp: 300, speed: 85, radius: 28, color: '#aaf', damage: 15, attackCooldown: 1.0,
    behavior: 'boss_mirror', isBoss: true, score: 100,
  },
  // Level 2: Anxiety
  SPIDER: {
    hp: 25, speed: 160, radius: 8, color: '#555', damage: 8, attackCooldown: 1.0,
    behavior: 'spider', orbitRadius: 220, orbitSpeed: 2.5, score: 8,
  },
  BOSS_SPIDER: {
    hp: 350, speed: 90, radius: 35, color: '#333', damage: 20, attackCooldown: 0.5,
    behavior: 'boss_spider', isBoss: true, score: 100,
  },
  // Level 3: Depression
  WATER_FLOW: {
    hp: 35, speed: 220, radius: 14, color: '#48f', damage: 8, attackCooldown: 1.2,
    behavior: 'water', score: 15,
    floatingText: ["i'm the worst", "i'm stupid", "i cannot do it", "why bother"],
  },
  BOSS_PILLOW: {
    hp: 600, speed: 180, radius: 40, color: '#88c', damage: 35, attackCooldown: 1.0,
    behavior: 'boss_pillow', isBoss: true, score: 100,
  },
  // Level 4: Fear
  BAT: {
    hp: 40, speed: 200, radius: 10, color: '#e88', damage: 18, attackCooldown: 0.8,
    behavior: 'bat', growthRate: 5, score: 12,
  },
  BOSS_TIGER: {
    hp: 500, speed: 180, radius: 35, color: '#fa0', damage: 28, attackCooldown: 0.4,
    behavior: 'boss_tiger', isBoss: true, score: 100,
  },
  // Level 6: Success
  SCARECROW_FAKE: {
    hp: 1, speed: 0, radius: 16, color: '#a86', damage: 0, attackCooldown: 99,
    behavior: 'scarecrow', isFake: true, score: 2,
  },
  SCARECROW_REAL: {
    hp: 1, speed: 200, radius: 16, color: '#a86', damage: 22, attackCooldown: 0.5,
    behavior: 'scarecrow', isFake: false, realHp: 400, score: 100, isBoss: true,
  },
};
