// ============================================================
// entities3d.js — Player, Weapons, Enemies (3D version)
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
    this.onGround = false;

    // 3D mesh
    this._angle = Math.atan2(this.vy, this.vx);
    if (this.isDart) {
      // Elongated diamond shape for darts
      const geo = new THREE.OctahedronGeometry(1);
      geo.scale(4, 1.5, 1.5); // long along X
      const mat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
      this.mesh = new THREE.Mesh(geo, mat);
      // Thin dark edge outline
      const edgeGeo = new THREE.EdgesGeometry(geo);
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x999999 });
      this.mesh.add(new THREE.LineSegments(edgeGeo, edgeMat));
    } else {
      this.mesh = Models.createProjectile(this.color, this.radius);
    }
    this.mesh.position.set(this.x, 8, this.y);
    Renderer.addToScene(this.mesh);
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
    if (this.trail && !this.onGround) Particles.trail(this.x, this.y, this.color, this.radius * 0.5);
    if (this.life <= 0) this.dead = true;
    // Sync mesh
    if (this.mesh) {
      if (this.onGround) {
        this.mesh.position.set(this.x, 3, this.y);
        this.mesh.scale.setScalar(0.5);
      } else {
        this.mesh.position.set(this.x, 8, this.y);
        // Rotate dart to face movement direction
        if (this.isDart) {
          this.mesh.rotation.y = -this._angle;
        }
      }
    }
    return !this.dead;
  }
  destroy() {
    if (this.mesh) Renderer.removeFromScene(this.mesh);
    this.mesh = null;
  }
  // Compat stub
  draw() {}
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
    this.isKatana = false;

    // 3D arc mesh
    const arcGeo = new THREE.RingGeometry(10, range, 16, 1, -arcWidth / 2, arcWidth);
    const arcMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.color),
      side: THREE.DoubleSide,
      transparent: true, opacity: 0.6,
    });
    this.mesh = new THREE.Mesh(arcGeo, arcMat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.rotation.z = -this.angle; // orient to aim direction
    this.mesh.position.set(this.x, 2, this.y);
    Renderer.addToScene(this.mesh);
  }
  update(dt) {
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    if (this.mesh) {
      const t = this.life / this.maxLife;
      this.mesh.material.opacity = t * 0.6;
      if (this.dead) {
        Renderer.removeFromScene(this.mesh);
        this.mesh = null;
      }
    }
    return !this.dead;
  }
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
  destroy() {
    if (this.mesh) Renderer.removeFromScene(this.mesh);
    this.mesh = null;
  }
  draw() {}
}

// ============================
// WEAPONS
// ============================

// --- Boxing Gloves ---
class BoxingGloves {
  constructor() {
    this.name = 'BOXING GLOVES'; this.color = Theme.accent;
    this.chargeTime = 0; this.charging = false;
    this.punchCooldown = 0; this.baseRange = 150;
    this.baseDamage = 100;
    this.lockedAngle = 0;

    // 3D visuals
    this.fistGroup = Models.createFistIndicator();
    this.fistGroup.visible = false;
    Renderer.addToScene(this.fistGroup);

    this.chargeGlow = Models.createChargeGlow();
    Renderer.addToScene(this.chargeGlow);
  }
  getRange(compactLevel) { return this.baseRange + compactLevel * 12; }

  update(dt, player, enemies, meleeHits) {
    if (this.punchCooldown > 0) this.punchCooldown -= dt;
    if (Input.mouse.down && !this.charging && this.punchCooldown <= 0) {
      this.charging = true; this.chargeTime = 0;
      this.lockedAngle = player.angle;
    }
    if (this.charging && Input.mouse.down) {
      this.chargeTime += dt;
      this.lockedAngle = player.angle;
    }
    if (this.charging && !Input.mouse.down) {
      this._release(player, enemies, meleeHits, this.lockedAngle);
      this.charging = false; this.chargeTime = 0;
    }
  }

  _release(player, enemies, meleeHits, punchAngle) {
    const t = this.chargeTime;
    const angle = punchAngle != null ? punchAngle : player.angle;

    // Fixed arc angle (~90 degrees) — never changes with charge
    const arc = Math.PI / 2;

    // Charge tiers: only RANGE and DAMAGE scale, angle stays fixed
    let dmgPct, knockback, shakeAmt, lungeDist, lungeDuration, range;
    if (t >= 2.0)      { dmgPct = 1.0;  range = 280; knockback = 300; shakeAmt = 14; lungeDist = 200; lungeDuration = 0.18; }
    else if (t >= 1.0) { dmgPct = 0.7;  range = 200; knockback = 200; shakeAmt = 9;  lungeDist = 120; lungeDuration = 0.14; }
    else if (t >= 0.5) { dmgPct = 0.3;  range = 120; knockback = 120; shakeAmt = 5;  lungeDist = 60;  lungeDuration = 0.10; }
    else               { dmgPct = 0.12; range = 60;  knockback = 60;  shakeAmt = 3;  lungeDist = 0;   lungeDuration = 0; }

    range += player.compactLevel * 12;
    const damage = this.baseDamage * dmgPct * (1 + player.compactLevel * 0.1);
    const hitColor = t >= 2.0 ? '#fff' : t >= 1.0 ? '#fa0' : '#f80';

    // === Main hit at player position — covers close range ===
    meleeHits.push(new MeleeHit(player.x, player.y, angle, range, arc, damage, {
      color: hitColor, knockback,
    }));

    // === Lunge: player dashes forward, with damage along the path ===
    if (lungeDist > 0) {
      const lungeSpeed = lungeDist / lungeDuration;
      player.dashing = true;
      player.invincible = true;
      player.dashTimer = lungeDuration;
      player.dashDir = Vec.fromAngle(angle);
      player.dashSpeed = lungeSpeed;
      for (let i = 0; i < 4; i++) {
        player.afterimages.push({ x: player.x, y: player.y, alpha: 0.5, angle: angle });
      }

      // Place extra hit zones along the lunge path so the whole dash deals damage
      const hitStep = 50; // one hit zone every 50 units
      for (let d = hitStep; d <= lungeDist; d += hitStep) {
        const hx = player.x + Math.cos(angle) * d;
        const hy = player.y + Math.sin(angle) * d;
        meleeHits.push(new MeleeHit(hx, hy, angle, range * 0.6, arc, damage * 0.7, {
          color: hitColor, knockback: knockback * 0.5,
        }));
      }
    }

    Effects.shake(shakeAmt, 0.15);
    if (t >= 1.0) Effects.slowMotion(0.15, 0.07);
    if (t >= 2.0) Effects.flash(Theme.accent, 0.1);
    Audio.hit();

    // Particles along attack direction
    const particleCount = Math.floor(5 + dmgPct * 20);
    Particles.emit(player.x + Math.cos(angle) * 30, player.y + Math.sin(angle) * 30,
      particleCount, this.color, { speed: 200 * dmgPct + 150, life: 0.4, angle: angle, spread: arc * 0.5 });
    if (lungeDist > 0) {
      for (let d = 0; d < lungeDist; d += 30) {
        const px = player.x + Math.cos(angle) * d;
        const py = player.y + Math.sin(angle) * d;
        Particles.emit(px, py, 3, '#ff8', { speed: 80, life: 0.25, size: 2, spread: Math.PI * 2 });
      }
    }
    this.punchCooldown = t >= 0.5 ? 0.35 : 0.12;
  }

  updateVisuals(player) {
    // Hide old solid meshes — all visuals via halftone dots now
    this.fistGroup.visible = false;
    this.chargeGlow.visible = false;

    // Fist dot: a small cluster of dots at aim position
    const fistDist = 22;
    const fx = player.x + Math.cos(player.angle) * fistDist;
    const fz = player.y + Math.sin(player.angle) * fistDist;
    const fistDots = [];
    const fc = new THREE.Color(this.color);
    // Fist: small sphere of dots
    for (let dx = -4; dx <= 4; dx += 4) {
      for (let dy = 16; dy <= 24; dy += 4) {
        for (let dz = -4; dz <= 4; dz += 4) {
          if (dx*dx + dz*dz > 20) continue;
          fistDots.push({ x: fx + dx, y: dy, z: fz + dz, r: fc.r, g: fc.g, b: fc.b, size: 2.0 });
        }
      }
    }
    EntityDots.submit(fistDots);

    // Charge: expanding halftone cloud around player
    if (this.charging) {
      const t = this.chargeTime;
      let tier = 0;
      if (t >= 2.0) tier = 3;
      else if (t >= 1.0) tier = 2;
      else if (t >= 0.5) tier = 1;

      const pct = clamp(t / 2.0, 0, 1);
      const chargeRadius = 20 + pct * 40;
      const colors = ['#f80', '#f80', '#fa0', '#fff'];
      const cc = new THREE.Color(colors[tier]);

      // Halftone charge ring: dots in a ring pattern
      const numDots = Math.floor(8 + pct * 20);
      const chargeDots = [];
      for (let i = 0; i < numDots; i++) {
        const a = (Math.PI * 2 / numDots) * i + Date.now() / 300;
        const r = chargeRadius * (0.8 + Math.random() * 0.4);
        // Density: inner ring dense, outer sparse
        if (Math.random() > 0.4 + pct * 0.5) continue;
        chargeDots.push({
          x: player.x + Math.cos(a) * r,
          y: 10 + Math.random() * 15,
          z: player.y + Math.sin(a) * r,
          r: cc.r, g: cc.g, b: cc.b,
          size: 1.5 + pct * 1.5,
        });
      }
      EntityDots.submit(chargeDots);

      // Orbiting particle streams for high charge
      if (tier >= 2) {
        for (let i = 0; i < 4; i++) {
          const a = Date.now() / 200 + (Math.PI * 2 / 4) * i;
          Particles.trail(player.x + Math.cos(a) * 25, player.y + Math.sin(a) * 25, colors[tier], 3);
        }
      }

      // Directional charge buildup: dots concentrating toward aim direction
      if (pct > 0.3) {
        const aimDots = [];
        for (let d = 10; d < chargeRadius; d += 8) {
          const spread = 0.3;
          const a = player.angle + (Math.random() - 0.5) * spread;
          if (Math.random() > pct) continue;
          aimDots.push({
            x: player.x + Math.cos(a) * d,
            y: 12 + Math.random() * 10,
            z: player.y + Math.sin(a) * d,
            r: cc.r * 0.8, g: cc.g * 0.8, b: cc.b * 0.8,
            size: 1.5,
          });
        }
        EntityDots.submit(aimDots);
      }
    }
  }

  draw() {}
  drawHUD() {}

  destroy() {
    if (this.fistGroup) Renderer.removeFromScene(this.fistGroup);
    if (this.chargeGlow) Renderer.removeFromScene(this.chargeGlow);
  }
}

// --- Sniper Rifle (L2) ---
class SniperRifle {
  constructor() {
    this.name = 'SNIPER RIFLE'; this.color = '#f44';
    this.ammo = 6; this.maxAmmo = 6;
    this.reloading = false; this.reloadTimer = 0; this.reloadTime = 1.8;
    this.baseDamage = 120;
    this._laserFlashTimer = 0;
    this._laserFlashAngle = 0;
    this._laserFlashX = 0; this._laserFlashY = 0;
    this.holdTime = 0;
    this.chargeThreshold = 1.0;
    this.charged = false;
    this.holdAngle = 0;
    // 3D: laser beam mesh
    this._laserMesh = null;
    this._flashMesh = null;
  }
  update(dt, player, enemies, meleeHits, projectiles) {
    if (this._laserFlashTimer > 0) this._laserFlashTimer -= dt;
    player.speed = player.baseSpeed;

    // Reload
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) { this.ammo = this.maxAmmo; this.reloading = false; }
    }
    // Manual reload with R
    if (Input.justPressed('KeyR') && !this.reloading && this.ammo < this.maxAmmo) {
      this.reloading = true; this.reloadTimer = this.reloadTime; Audio.menuSelect();
      // Reset hold state so player can fire again after reload
      this.holdTime = 0; this.charged = false;
    }
    // Auto-reload when empty
    if (this.ammo <= 0 && !this.reloading) {
      this.reloading = true; this.reloadTimer = this.reloadTime;
      // Reset hold state to prevent getting stuck
      this.holdTime = 0; this.charged = false;
    }

    // Hold-to-fire: can only charge when NOT reloading and have ammo
    if (Input.mouse.down && this.ammo > 0 && !this.reloading) {
      this.holdTime += dt;
      if (!this.charged && this.holdTime >= this.chargeThreshold) {
        this.charged = true;
        this.holdAngle = player.angle;
        Audio._playTone(800, 0.1, 'sine', 0.15);
      }
      if (this.charged) {
        this.holdAngle = player.angle;
        player.speed = player.baseSpeed * 0.35;
      }
    } else if (!Input.mouse.down && this.holdTime > 0) {
      // Mouse released — fire if charged
      if (this.charged && this.ammo > 0) {
        this.ammo--;
        const dmg = this.baseDamage * (1 + player.compactLevel * 0.1);
        const fireAngle = player.angle;
        projectiles.push(new Projectile(
          player.x + Math.cos(fireAngle) * 20, player.y + Math.sin(fireAngle) * 20,
          fireAngle, 1500, dmg,
          { color: '#a050e0', radius: 5 + player.compactLevel * 2, pierce: true, life: 1.5, trail: true }
        ));
        Audio.sniper(); Effects.shake(6, 0.15);
        Particles.emit(player.x + Math.cos(fireAngle) * 25, player.y + Math.sin(fireAngle) * 25,
          8, '#a050e0', { speed: 300, life: 0.15, angle: fireAngle, spread: 0.4 });
        player.x -= Math.cos(fireAngle) * 8;
        player.y -= Math.sin(fireAngle) * 8;
        this._laserFlashTimer = 0.15;
        this._laserFlashAngle = fireAngle;
        this._laserFlashX = player.x; this._laserFlashY = player.y;
      }
      this.holdTime = 0;
      this.charged = false;
    }
    // Also reset if reloading started while holding
    if (this.reloading && this.holdTime > 0) {
      this.holdTime = 0; this.charged = false;
    }
  }
  updateVisuals(player) {
    // Laser beam: BoxGeometry so it's visible from any camera angle
    if (!this._laserBeam) {
      // Main beam — thin box (length along X, width along Z, height along Y)
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x8c3cdc, transparent: true, opacity: 0.5, depthWrite: false,
      });
      this._laserBeam = new THREE.Mesh(geo, mat);
      this._laserBeam.visible = false;
      Renderer.addToScene(this._laserBeam);
      // Glow beam — wider box
      const glowGeo = new THREE.BoxGeometry(1, 1, 1);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0x8c3cdc, transparent: true, opacity: 0.15, depthWrite: false,
      });
      this._laserGlow = new THREE.Mesh(glowGeo, glowMat);
      this._laserGlow.visible = false;
      Renderer.addToScene(this._laserGlow);
      // Charge ring on ground
      const ringGeo = new THREE.RingGeometry(22, 26, 32, 1, 0, 0);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x8c3cdc, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
      this._chargeRing = new THREE.Mesh(ringGeo, ringMat);
      this._chargeRing.rotation.x = -Math.PI / 2;
      this._chargeRing.position.y = 1;
      this._chargeRing.visible = false;
      Renderer.addToScene(this._chargeRing);
    }
    if (!this._flashBeam) {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false,
      });
      this._flashBeam = new THREE.Mesh(geo, mat);
      this._flashBeam.visible = false;
      Renderer.addToScene(this._flashBeam);
    }

    // Aiming laser while holding mouse
    if (this.holdTime > 0 || this.charged) {
      const len = 900;
      const angle = player.angle;
      const cx = player.x + Math.cos(angle) * len / 2;
      const cz = player.y + Math.sin(angle) * len / 2;
      const chargePct = clamp(this.holdTime / this.chargeThreshold, 0, 1);
      const pulse = 0.5 + Math.sin(Date.now() / 60) * 0.2;

      // Main beam — box: X=length along aim, Y=height(visible vertically), Z=width(visible from top)
      const beamThick = 2 + chargePct * 3;
      this._laserBeam.visible = true;
      this._laserBeam.position.set(cx, 10, cz);
      this._laserBeam.rotation.set(0, -angle, 0);
      this._laserBeam.scale.set(len, beamThick * 2, beamThick);
      this._laserBeam.material.opacity = (0.4 + chargePct * 0.4) * pulse;

      // Glow beam — bigger box
      this._laserGlow.visible = true;
      this._laserGlow.position.set(cx, 10, cz);
      this._laserGlow.rotation.set(0, -angle, 0);
      this._laserGlow.scale.set(len, beamThick * 6, beamThick * 4);
      this._laserGlow.material.opacity = (0.08 + chargePct * 0.12) * pulse;

      if (this.charged) {
        this._laserBeam.material.color.set(0xb450ff);
        this._laserBeam.material.opacity = 0.7 * pulse;
        this._laserGlow.material.color.set(0xb450ff);
        this._laserGlow.material.opacity = 0.25 * pulse;
        if (Math.random() > 0.7) {
          const d = randRange(50, len * 0.8);
          Particles.trail(player.x + Math.cos(angle) * d, player.y + Math.sin(angle) * d, '#a050e0', 2);
        }
      } else {
        this._laserBeam.material.color.set(0x8c3cdc);
        this._laserGlow.material.color.set(0x8c3cdc);
      }

      // Charge progress ring
      if (!this.charged) {
        this._chargeRing.visible = true;
        this._chargeRing.position.set(player.x, 1, player.y);
        this._chargeRing.geometry.dispose();
        this._chargeRing.geometry = new THREE.RingGeometry(22, 26, 32, 1, 0, chargePct * Math.PI * 2);
        this._chargeRing.material.opacity = 0.3 + chargePct * 0.5;
      } else {
        this._chargeRing.visible = false;
      }
    } else {
      this._laserBeam.visible = false;
      this._laserGlow.visible = false;
      this._chargeRing.visible = false;
    }

    // Fire flash
    if (this._laserFlashTimer > 0) {
      const t = this._laserFlashTimer / 0.15;
      const angle = this._laserFlashAngle;
      const len = 900;
      const cx = this._laserFlashX + Math.cos(angle) * len / 2;
      const cz = this._laserFlashY + Math.sin(angle) * len / 2;
      this._flashBeam.visible = true;
      this._flashBeam.position.set(cx, 10, cz);
      this._flashBeam.rotation.set(0, -angle, 0);
      this._flashBeam.scale.set(len, t * 20, t * 15);
      this._flashBeam.material.opacity = t * 0.9;
      this._flashBeam.material.color.set(t > 0.5 ? 0xffffff : 0xa050e0);
    } else {
      this._flashBeam.visible = false;
    }
  }
  draw() {}
  drawHUD() {}
  destroy() {
    if (this._laserBeam) Renderer.removeFromScene(this._laserBeam);
    if (this._laserGlow) Renderer.removeFromScene(this._laserGlow);
    if (this._chargeRing) Renderer.removeFromScene(this._chargeRing);
    if (this._flashBeam) Renderer.removeFromScene(this._flashBeam);
  }
}

// --- Chain Gun (L3: Fused Boxing + Sniper) ---
class ChainGun {
  constructor() {
    this.name = 'CHAIN HOOK'; this.color = '#a0f';
    this.chainX = 0; this.chainY = 0; this.chainVX = 0; this.chainVY = 0;
    this.chainTarget = null;
    this.chainState = 'ready';
    this.chainTimer = 0; this.chainDuration = 3;
    this.chainSpeed = 900; this.chainRange = 450;
    this.gunFireRate = 10; this.gunFireTimer = 0;
    this.gunDamage = 15; this.gunSpread = 0.12;
    this.slowSpeed = 50;
    // 3D: chain line
    this._chainLine = null;
    this._hookDot = null;
  }
  update(dt, player, enemies, meleeHits, projectiles) {
    player.speed = this.slowSpeed;
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
      if (this.gunFireTimer > 0) this.gunFireTimer -= dt;
      if (Input.mouse.down && this.gunFireTimer <= 0 && this.chainTarget && !this.chainTarget.dead) {
        this.gunFireTimer = 1 / this.gunFireRate;
        const toTarget = Math.atan2(this.chainTarget.y - player.y, this.chainTarget.x - player.x);
        const angle = toTarget + (Math.random() - 0.5) * this.gunSpread;
        const dmg = this.gunDamage * (1 + player.compactLevel * 0.1);
        projectiles.push(new Projectile(
          player.x + Math.cos(toTarget) * 18, player.y + Math.sin(toTarget) * 18,
          angle, 750, dmg, { color: '#ff0', radius: 3 + player.compactLevel * 2, life: 0.8, trail: true }
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
  updateVisuals(player) {
    // Chain line
    if (!this._chainLine) {
      const mat = new THREE.LineBasicMaterial({ color: 0x8c3cdc, transparent: true, opacity: 0.5 });
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      this._chainLine = new THREE.Line(geo, mat);
      this._chainLine.visible = false;
      Renderer.addToScene(this._chainLine);
    }
    if (!this._hookDot) {
      const geo = new THREE.SphereGeometry(4, 6, 6);
      const mat = new THREE.MeshBasicMaterial({ color: 0xa060e0 });
      this._hookDot = new THREE.Mesh(geo, mat);
      this._hookDot.visible = false;
      Renderer.addToScene(this._hookDot);
    }
    if (this.chainState === 'flying' || this.chainState === 'locked') {
      this._chainLine.visible = true;
      this._hookDot.visible = true;
      const positions = this._chainLine.geometry.attributes.position;
      positions.setXYZ(0, player.x, 15, player.y);
      positions.setXYZ(1, this.chainX, 15, this.chainY);
      positions.needsUpdate = true;
      this._hookDot.position.set(this.chainX, 15, this.chainY);
    } else {
      this._chainLine.visible = false;
      this._hookDot.visible = false;
    }
  }
  draw() {}
  drawHUD() {}
  destroy() {
    if (this._chainLine) Renderer.removeFromScene(this._chainLine);
    if (this._hookDot) Renderer.removeFromScene(this._hookDot);
  }
}

// --- Dart Weapon (L4) ---
class DartWeapon {
  constructor() {
    this.name = 'DARTS'; this.color = '#ccc';
    this.totalDarts = 25; this.throwCooldown = 0;
    this.throwRate = 5;
    this.baseDamage = 60;
    this.groundDarts = [];
    this.hasReloaded = false;
    // 3D: ground dart meshes
    this._groundMeshes = [];
  }
  update(dt, player, enemies, meleeHits, projectiles) {
    if (this.throwCooldown > 0) this.throwCooldown -= dt;
    if (Input.mouse.clicked && this.totalDarts > 0 && this.throwCooldown <= 0) {
      this.totalDarts--;
      this.throwCooldown = 1 / this.throwRate;
      const dmg = this.baseDamage * (1 + player.compactLevel * 0.1);
      projectiles.push(new Projectile(
        player.x + Math.cos(player.angle) * 16, player.y + Math.sin(player.angle) * 16,
        player.angle, 1700, dmg,
        { color: '#ccc', radius: 4 + player.compactLevel, life: 1.2, trail: false, isDart: true }
      ));
      Audio.dart();
    }
    if (Input.justPressed('KeyR') && !this.hasReloaded) {
      this.hasReloaded = true;
      this.groundDarts.forEach(d => {
        this.totalDarts++;
        Particles.emit(d.x, d.y, 3, '#ccc', { speed: 50, life: 0.2 });
      });
      this.groundDarts = [];
      this._syncGroundMeshes();
      Audio.menuSelect();
    }
    this.groundDarts = this.groundDarts.filter(d => {
      if (Vec.dist(d, player) < 25) { this.totalDarts++; return false; }
      return true;
    });
    this._syncGroundMeshes();
  }
  dropDart(x, y) {
    this.groundDarts.push({ x, y });
  }
  _syncGroundMeshes() {
    // Remove excess meshes
    while (this._groundMeshes.length > this.groundDarts.length) {
      const m = this._groundMeshes.pop();
      Renderer.removeFromScene(m);
    }
    // Add new meshes
    while (this._groundMeshes.length < this.groundDarts.length) {
      const geo = new THREE.OctahedronGeometry(3);
      const mat = new THREE.MeshBasicMaterial({ color: 0xbbbbbb, transparent: true, opacity: 0.6 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = Math.PI / 4;
      Renderer.addToScene(mesh);
      this._groundMeshes.push(mesh);
    }
    // Sync positions
    for (let i = 0; i < this.groundDarts.length; i++) {
      const d = this.groundDarts[i];
      const m = this._groundMeshes[i];
      m.position.set(d.x, 3, d.y);
      m.rotation.y = Date.now() / 500 + d.x;
    }
  }
  updateVisuals(player) {
    // Ground darts are synced in update()
  }
  draw() {}
  drawHUD() {}
  destroy() {
    this._groundMeshes.forEach(m => Renderer.removeFromScene(m));
    this._groundMeshes = [];
  }
}

// --- Katana Weapon (L5 choice) — Sweeping slash, not fan ---
class KatanaWeapon {
  constructor() {
    this.name = 'KATANA'; this.color = '#ccc';
    this.baseDamage = 80; this.baseRange = 115;
    this.charging = false; this.chargeTime = 0;
    this.slashCooldown = 0;
    // Slash state: blade sweeps from startAngle to endAngle over duration
    this.slashing = false;
    this.slashStartAngle = 0;
    this.slashEndAngle = 0;
    this.slashTimer = 0;
    this.slashDuration = 0.35;
    this.slashRange = 100;
    this.slashDamage = 0;
    this.slashKnockback = 100;
    this._slashHitEnemies = new Set(); // track who's been hit this slash
    // 3D: blade mesh
    this._bladeMesh = null;
    this._trailMeshes = [];
  }

  update(dt, player, enemies, meleeHits) {
    if (this.slashCooldown > 0) this.slashCooldown -= dt;

    // Active slash: sweep blade and check hits each frame
    if (this.slashing) {
      this.slashTimer -= dt;
      if (this.slashTimer <= 0) {
        this.slashing = false;
        this._slashHitEnemies.clear();
      } else {
        // Current blade angle (interpolate from start to end)
        const progress = 1 - (this.slashTimer / this.slashDuration);
        const currentAngle = this.slashStartAngle + (this.slashEndAngle - this.slashStartAngle) * progress;
        const bladeWidth = 0.15; // ±0.15 radians (~9 degrees) — thin blade

        // Check each enemy against the current blade position
        for (const e of enemies) {
          if (e.dead || e.dying || this._slashHitEnemies.has(e)) continue;
          const dx = e.x - player.x, dy = e.y - player.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > this.slashRange + e.radius) continue;
          const enemyAngle = Math.atan2(dy, dx);
          let diff = enemyAngle - currentAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          if (Math.abs(diff) < bladeWidth) {
            // HIT! Blade passes through this enemy
            e.takeDamage(this.slashDamage);
            this._slashHitEnemies.add(e);
            // Knockback away from blade
            const dir = Vec.norm(Vec.sub(e, player));
            e.x += dir.x * this.slashKnockback * 0.3;
            e.y += dir.y * this.slashKnockback * 0.3;
            Particles.emit(e.x, e.y, 8, '#ccc', { speed: 200, life: 0.2, size: 3 });
            Effects.slowMotion(0.15, 0.03);
          }
        }
      }
    }

    // Charge: hold mouse
    if (Input.mouse.down && this.slashCooldown <= 0 && !this.slashing) {
      if (!this.charging) { this.charging = true; this.chargeTime = 0; }
      this.chargeTime += dt;
    }

    // Release: trigger sweeping slash
    if (this.charging && !Input.mouse.down) {
      const t = this.chargeTime;
      let range, dmgMult, knockback, shakeAmt, cooldown, duration, sweepArc;
      if (t >= 1.0)      { range = 180; dmgMult = 1.8; knockback = 200; shakeAmt = 8; cooldown = 0.5; duration = 0.4; sweepArc = Math.PI * 0.8; }
      else if (t >= 0.4) { range = 140; dmgMult = 1.3; knockback = 150; shakeAmt = 5; cooldown = 0.3; duration = 0.35; sweepArc = Math.PI * 0.6; }
      else               { range = 100; dmgMult = 0.7; knockback = 100; shakeAmt = 3; cooldown = 0.15; duration = 0.25; sweepArc = Math.PI * 0.4; }
      range += player.compactLevel * 8;
      const dmg = this.baseDamage * dmgMult * (1 + player.compactLevel * 0.1);

      // Slash sweeps from (aim - halfArc) to (aim + halfArc)
      this.slashing = true;
      this.slashStartAngle = player.angle - sweepArc / 2;
      this.slashEndAngle = player.angle + sweepArc / 2;
      this.slashTimer = duration;
      this.slashDuration = duration;
      this.slashRange = range;
      this.slashDamage = dmg;
      this.slashKnockback = knockback;
      this._slashHitEnemies.clear();

      this.slashCooldown = cooldown;
      Effects.shake(shakeAmt, 0.1);
      if (t >= 1.0) Effects.slowMotion(0.15, 0.06);
      Audio.hit();
      this.charging = false; this.chargeTime = 0;
    }
  }

  updateVisuals(player) {
    // Create blade mesh if needed
    if (!this._bladeMesh) {
      // Blade: thin tall box
      const geo = new THREE.BoxGeometry(2, 20, 1);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xcccccc, transparent: true, opacity: 0.8, depthWrite: false,
      });
      this._bladeMesh = new THREE.Mesh(geo, mat);
      this._bladeMesh.visible = false;
      Renderer.addToScene(this._bladeMesh);
    }

    // Charging: orbiting particles (qi effect)
    if (this.charging && this.chargeTime > 0.1) {
      const pct = clamp(this.chargeTime / 1.0, 0, 1);
      const numOrbs = pct >= 0.8 ? 4 : pct >= 0.3 ? 3 : 2;
      const orbitR = 28 + pct * 15;
      const speed = 3 + pct * 4;
      const t = Date.now() / 1000;
      for (let i = 0; i < numOrbs; i++) {
        const a = t * speed + (Math.PI * 2 / numOrbs) * i;
        const ox = player.x + Math.cos(a) * orbitR;
        const oy = player.y + Math.sin(a) * orbitR;
        Particles.trail(ox, oy, i % 2 === 0 ? '#666' : '#aaa', 3);
      }
    }

    // Slashing: show blade at current sweep position
    if (this.slashing && this.slashTimer > 0) {
      const progress = 1 - (this.slashTimer / this.slashDuration);
      const currentAngle = this.slashStartAngle + (this.slashEndAngle - this.slashStartAngle) * progress;
      const range = this.slashRange;

      // Position blade at midpoint of the range, rotated to current angle
      const midDist = range * 0.55;
      const bx = player.x + Math.cos(currentAngle) * midDist;
      const bz = player.y + Math.sin(currentAngle) * midDist;
      this._bladeMesh.visible = true;
      this._bladeMesh.position.set(bx, 15, bz);
      this._bladeMesh.rotation.y = -currentAngle;
      // Scale blade length to range
      this._bladeMesh.scale.set(range * 0.9, 1, 1);
      this._bladeMesh.material.opacity = 0.7 + Math.sin(progress * Math.PI) * 0.3;

      // Trail particles along the blade
      const tipX = player.x + Math.cos(currentAngle) * range;
      const tipZ = player.y + Math.sin(currentAngle) * range;
      Particles.trail(tipX, tipZ, '#ccc', 3);
      // Mid-blade spark
      if (Math.random() > 0.5) {
        const d = randRange(30, range * 0.8);
        Particles.trail(
          player.x + Math.cos(currentAngle) * d,
          player.y + Math.sin(currentAngle) * d,
          '#eee', 2
        );
      }
    } else {
      if (this._bladeMesh) this._bladeMesh.visible = false;
    }
  }

  draw() {}
  drawHUD() {}
  destroy() {
    if (this._bladeMesh) Renderer.removeFromScene(this._bladeMesh);
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
    this.weapon = null;
    this.compactLevel = 0;
    this.afterimages = []; this.dead = false;
    this.bodyColor = '#4ff';
    this.stunned = false; this.stunnedTimer = 0;

    // 3D mesh
    this.mesh = Models.createPlayer();
    this.mesh.position.set(this.x, 0, this.y);
    Renderer.addToScene(this.mesh);

    // Afterimage meshes pool
    this._afterimageMeshes = [];
  }

  update(dt, projectiles, enemies, meleeHits) {
    if (this.dead) return;
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
    if (Input.mouse.rightClicked && this.dashCdTimer <= 0 && !this.dashing) {
      this.dashing = true; this.invincible = true; this.dashTimer = this.dashDuration;
      this.dashCdTimer = this.dashCooldown;
      this.dashSpeed = this.baseDashSpeed;
      this.dashDir = Vec.norm(Vec.sub({ x: Input.mouse.worldX, y: Input.mouse.worldY }, this));
      Audio.dash(); Particles.emit(this.x, this.y, 8, '#4ff', { speed: 150, life: 0.3, size: 3 });
    }
    if (this.dashCdTimer > 0) this.dashCdTimer -= dt;
    if (this.invTimer > 0) { this.invTimer -= dt; if (this.invTimer <= 0) this.invincible = false; }
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
    this.afterimages = this.afterimages.filter(a => { a.alpha -= dt * 4; return a.alpha > 0; });
    if (this.weapon) this.weapon.update(dt, this, enemies, meleeHits, projectiles);
  }

  takeDamage(amount) {
    if (this.invincible || this.dead) return;
    this.hp -= amount; this.invincible = true; this.invTimer = 0.5; this.hitFlashTimer = 0.15;
    Audio.playerHit(); Effects.shake(8, 0.2); Effects.flash(Theme.danger, 0.15);
    Particles.burst(this.x, this.y, 12, '#f44', 200);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  // Pre-generate body dot samples (once)
  _initBodyDots() {
    if (this._bodyDots) return;
    // Player body: cylinder (body) + sphere (head) in local space
    this._bodyDots = [];
    // Body cylinder: radius ~10, height 0-24
    this._bodyDots.push(...EntityDots.sampleCylinder(0, 0, 0, 10, 24, 0.8));
    // Head sphere: radius ~7 at y=28
    this._bodyDots.push(...EntityDots.sampleSphere(0, 28, 0, 8, 0.9));
    // Eyes: two specific dots (dark)
    this._bodyDots.push({ lx: 5, ly: 31, lz: -3, isEye: true });
    this._bodyDots.push({ lx: 5, ly: 31, lz: 3, isEye: true });
  },

  updateMesh() {
    if (!this.mesh) return;
    this._initBodyDots();

    // Hide solid mesh — we render as dot cloud instead
    this.mesh.visible = false;

    if (this.dead) return;

    // Invincibility blink: skip dots every other frame
    if (this.invincible && !this.dashing && Math.floor(Date.now() / 60) % 2 === 0) {
      // Don't submit dots — creates blinking effect
    } else {
      // Submit player body as halftone dot cloud
      const c = new THREE.Color(this.hitFlashTimer > 0 ? '#fff' : this.bodyColor);
      const eyeColor = { r: 0.04, g: 0.08, b: 0.1 };
      const cos = Math.cos(-this.angle), sin = Math.sin(-this.angle);
      const dots = [];
      for (const ld of this._bodyDots) {
        // Rotate local dot by player angle (around Y axis)
        const rx = ld.lx * cos - ld.lz * sin;
        const rz = ld.lx * sin + ld.lz * cos;
        const col = ld.isEye ? eyeColor : { r: c.r, g: c.g, b: c.b };
        dots.push({
          x: this.x + rx, y: ld.ly, z: this.y + rz,
          r: col.r, g: col.g, b: col.b,
          size: ld.isEye ? 2.0 : 2.5,
        });
      }
      EntityDots.submit(dots);
    }

    // Movement trail: emit halftone particles when moving
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > 50) {
      const trailIntensity = clamp(speed / 300, 0.2, 1);
      // Drop trail dots behind player
      if (Math.random() < trailIntensity) {
        Particles.emit(
          this.x - this.vx * 0.02, this.y - this.vy * 0.02,
          Math.floor(1 + trailIntensity * 3), this.bodyColor,
          { speed: 30, life: 0.3 + trailIntensity * 0.3, size: 2 + trailIntensity * 2,
            angle: Math.atan2(-this.vy, -this.vx), spread: 0.8 }
        );
      }
    }

    // Weapon visuals
    if (this.weapon && this.weapon.updateVisuals) {
      this.weapon.updateVisuals(this);
    }

    // Afterimage as dot clouds (much simpler than mesh cloning)
    for (const ai of this.afterimages) {
      if (ai.alpha < 0.1) continue;
      const ac = new THREE.Color(this.bodyColor);
      const acos = Math.cos(-ai.angle), asin = Math.sin(-ai.angle);
      const aiDots = [];
      // Sparse sampling for afterimage (every other dot)
      for (let i = 0; i < this._bodyDots.length; i += 3) {
        const ld = this._bodyDots[i];
        if (ld.isEye) continue;
        const rx = ld.lx * acos - ld.lz * asin;
        const rz = ld.lx * asin + ld.lz * acos;
        aiDots.push({
          x: ai.x + rx, y: ld.ly, z: ai.y + rz,
          r: ac.r * ai.alpha, g: ac.g * ai.alpha, b: ac.b * ai.alpha,
          size: 1.5 * ai.alpha,
        });
      }
      EntityDots.submit(aiDots);
    }

    // Clean up old afterimage meshes (legacy, still needed for cleanup)
    this._afterimageMeshes = this._afterimageMeshes.filter(am => {
      am.life -= 0.016;
      if (am.life <= 0) {
        Renderer.removeFromScene(am.mesh);
        return false;
      }
      return true;
    });

    // No longer create clone meshes for afterimages
    while (this.afterimages.length > 0 && false) {
      const ai = this.afterimages[0];
      if (ai.alpha > 0.3) {
        const clone = Models.createPlayer();
        clone.position.set(ai.x, 0, ai.y);
        clone.rotation.y = -ai.angle + Math.PI / 2;
        clone.traverse(child => {
          if (child.material) {
            child.material = child.material.clone();
            child.material.transparent = true;
            child.material.opacity = 0.3;
          }
        });
        Renderer.addToScene(clone);
        this._afterimageMeshes.push({ mesh: clone, life: 0.3 });
      }
      break; // Only one per frame
    }
  }

  destroy() {
    if (this.mesh) Renderer.removeFromScene(this.mesh);
    this._afterimageMeshes.forEach(am => Renderer.removeFromScene(am.mesh));
    this._afterimageMeshes = [];
    if (this.weapon && this.weapon.destroy) this.weapon.destroy();
  }

  draw() {}
}

// ============================
// ENEMIES
// ============================

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

    // 3D mesh
    this.mesh = this._createMesh();
    this.mesh.position.set(this.x, 0, this.y);
    this.mesh.scale.setScalar(0.01); // start tiny for spawn
    Renderer.addToScene(this.mesh);

    // HP bar (for non-boss enemies that take damage)
    this.hpBar = null;
    if (!this.isFake) {
      this.hpBar = Models.createHPBar();
      this.hpBar.visible = false;
      Renderer.addToScene(this.hpBar);
    }

    // Stun ring
    this.stunRing = null;
  }

  _createMesh() {
    const b = this.type.behavior;
    const icon = this.type.icon;
    // L1: Social media enemies
    if (b === 'social') {
      if (icon === '❤') return Models.createHeart();
      if (icon === '🔄') return Models.createRetweet();
      if (icon === '💬') return Models.createComment();
    }
    if (b === 'boss_mirror') return Models.createMirror();
    // L2: Spiders
    if (b === 'spider') return Models.createSpider(this.radius, this.color);
    if (b === 'boss_spider') return Models.createBossSpider();
    // L3: Water / Ghost
    if (b === 'water') return Models.createWaterBlob();
    if (b === 'boss_pillow') return Models.createGhost();
    // L4: Bats / Tiger
    if (b === 'bat') return Models.createBat(this.radius);
    if (b === 'boss_tiger') return Models.createTiger();
    // L6: Scarecrows
    if (b === 'scarecrow') return Models.createScarecrow(this.isFake);
    // Fallback: colored cylinder
    const geo = new THREE.CylinderGeometry(this.radius, this.radius, this.radius * 2, 8);
    const mat = Renderer.createToonMaterial(this.color);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = this.radius;
    mesh.castShadow = true;
    const group = new THREE.Group();
    group.add(mesh);
    group.userData.mainMat = mat;
    return group;
  }

  update(dt, player, enemyProjectiles, arena) {
    if (this.dying) { this.dyingTimer -= dt; if (this.dyingTimer <= 0) this.dead = true; return; }
    if (this.spawnTimer > 0) { this.spawnTimer -= dt; return; }
    if (this.stunned) { this.stunTimer -= dt; if (this.stunTimer <= 0) this.stunned = false; this.hitFlash -= dt; return; }
    this.hitFlash -= dt; this.attackTimer -= dt;
    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.angle = Math.atan2(dy, dx);
    if (this.growthRate > 0) {
      this.radius = Math.min(this.radius + this.growthRate * dt, this.origRadius * 4);
      this.damage = this.type.damage * (this.radius / this.origRadius);
    }
    const b = this.type.behavior;
    if (b === 'shoe' || b === 'social') this._behaviorShoe(dt, player, dist);
    else if (b === 'spider') this._behaviorSpider(dt, player, dist);
    else if (b === 'water') { this._arena = arena; this._behaviorWater(dt, player, dist, enemyProjectiles); }
    else if (b === 'bat') this._behaviorBat(dt, player, dist);
    else if (b === 'scarecrow') this._behaviorScarecrow(dt, player, dist);
    else if (b === 'boss_mirror') this._bossMirror(dt, player, dist, enemyProjectiles);
    else if (b === 'boss_spider') this._bossSpider(dt, player, dist, enemyProjectiles);
    else if (b === 'boss_pillow') { this._enemyProjectiles = enemyProjectiles; this._bossPillow(dt, player, dist); }
    else if (b === 'boss_tiger') this._bossTiger(dt, player, dist, enemyProjectiles);
    else if (b === 'boss_real') this._bossReal(dt, player, dist, enemyProjectiles);

    this.x += this.vx * dt; this.y += this.vy * dt;
    if (arena) {
      this.x = clamp(this.x, arena.left + this.radius, arena.right - this.radius);
      this.y = clamp(this.y, arena.top + this.radius, arena.bottom - this.radius);
    }
  }

  // --- Behaviors (identical to original) ---
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

  _behaviorSpider(dt, player, dist) {
    this.orbitAngle += this.orbitSpeed * dt;
    this.orbitRadius = Math.max(30, this.orbitRadius - 8 * dt);
    const targetX = player.x + Math.cos(this.orbitAngle) * this.orbitRadius;
    const targetY = player.y + Math.sin(this.orbitAngle) * this.orbitRadius * 0.6;
    const dir = Vec.norm(Vec.sub({ x: targetX, y: targetY }, this));
    this.vx = dir.x * this.speed; this.vy = dir.y * this.speed;
  }

  _behaviorWater(dt, player, dist, enemyProjectiles) {
    const preferDist = 200;
    if (dist < preferDist - 40) {
      const dir = Vec.norm(Vec.sub(this, player));
      this.vx = dir.x * this.speed; this.vy = dir.y * this.speed;
    } else if (dist > preferDist + 60) {
      const dir = Vec.norm(Vec.sub(player, this));
      this.vx = dir.x * this.speed * 0.7; this.vy = dir.y * this.speed * 0.7;
    } else {
      const perpDir = Vec.norm({ x: -(player.y - this.y), y: player.x - this.x });
      const strafeDir = this.orbitSpeed > 0 ? 1 : -1;
      this.vx = perpDir.x * this.speed * 0.6 * strafeDir;
      this.vy = perpDir.y * this.speed * 0.6 * strafeDir;
    }
    if (this.attackTimer <= 0 && dist < 350) {
      this.attackTimer = this.type.attackCooldown;
      if (enemyProjectiles) {
        enemyProjectiles.push(new Projectile(this.x, this.y, this.angle, 200, 1,
          { color: '#48f', radius: 4, fromPlayer: false, life: 1.5, trail: true }));
      }
    }
    if (Math.random() > 0.5) Particles.trail(this.x, this.y, '#48f', 2);
  }

  _behaviorBat(dt, player, dist) {
    const spd = Math.max(40, this.speed - this.radius);
    const dir = Vec.norm(Vec.sub(player, this));
    this.vx = dir.x * spd; this.vy = dir.y * spd;
  }

  _behaviorScarecrow(dt, player, dist) {
    if (this.isFake) { this.vx = 0; this.vy = 0; return; }
    if (!this.revealed) { this.vx = 0; this.vy = 0; return; }
    const dir = Vec.norm(Vec.sub(player, this));
    this.vx = dir.x * this.speed; this.vy = dir.y * this.speed;
  }

  _bossMirror(dt, player, dist, projectiles) {
    this.bossPatternTimer -= dt;
    if (this.bossPatternTimer <= 0) { this.bossPattern = (this.bossPattern + 1) % 3; this.bossPatternTimer = 4; }
    switch (this.bossPattern) {
      case 0:
        this.vx = -player.vx * 0.8; this.vy = -player.vy * 0.8; break;
      case 1:
        if (!this.chargeState) { this.chargeState = 'windup'; this.chargeTimer = 0.6; this.chargeDir = Vec.norm(Vec.sub(player, this)); }
        if (this.chargeState === 'windup') { this.chargeTimer -= dt; this.vx *= 0.9; this.vy *= 0.9; if (this.chargeTimer <= 0) { this.chargeState = 'charge'; this.chargeTimer = 0.3; } }
        else if (this.chargeState === 'charge') { this.vx = this.chargeDir.x * 500; this.vy = this.chargeDir.y * 500; Particles.trail(this.x, this.y, this.color, 4); this.chargeTimer -= dt; if (this.chargeTimer <= 0) this.chargeState = null; }
        break;
      case 2:
        this.vx *= 0.95; this.vy *= 0.95;
        if (this.attackTimer <= 0) { this.attackTimer = 1.2; this.phaseTimer += 0.5;
          for (let i = 0; i < 4; i++) { const a = (Math.PI * 2 / 4) * i + this.phaseTimer;
            projectiles.push(new Projectile(this.x, this.y, a, 160, 10, { color: '#aaf', radius: 4, fromPlayer: false, life: 2.5 })); }
        } break;
    }
  }

  _bossSpider(dt, player, dist, projectiles) {
    this.bossPatternTimer -= dt;
    if (this.bossPatternTimer <= 0) { this.bossPattern = (this.bossPattern + 1) % 3; this.bossPatternTimer = 3.5; }
    switch (this.bossPattern) {
      case 0:
        this.vx *= 0.95; this.vy *= 0.95;
        if (this.attackTimer <= 0) { this.attackTimer = 0.3; const a = this.angle + (Math.random() - 0.5) * 0.8;
          projectiles.push(new Projectile(this.x, this.y, a, 300, 10, { color: '#aaa', radius: 6, fromPlayer: false, life: 2.5 })); } break;
      case 1:
        const dir = Vec.norm(Vec.sub(player, this)); this.vx = dir.x * this.speed * 2.5; this.vy = dir.y * this.speed * 2.5;
        Particles.trail(this.x, this.y, this.color, 3); break;
      case 2:
        this.orbitAngle += 1.5 * dt; this.vx = Math.cos(this.orbitAngle) * this.speed; this.vy = Math.sin(this.orbitAngle) * this.speed;
        if (this.attackTimer <= 0) { this.attackTimer = 0.6;
          projectiles.push(new Projectile(this.x, this.y, this.angle, 350, 12, { color: '#fa0', radius: 5, fromPlayer: false, life: 2 })); } break;
    }
  }

  _bossPillow(dt, player, dist) {
    if (!this._orbitAngle) this._orbitAngle = Math.random() * Math.PI * 2;
    if (!this._orbitRadius) this._orbitRadius = 200;
    if (!this._orbitSpeed) this._orbitSpeed = 2.5;
    if (!this._shootTimer) this._shootTimer = 0;
    if (!this._phaseTimer) this._phaseTimer = 0;
    if (!this._phase) this._phase = 0;

    this._phaseTimer -= dt;
    if (this._phaseTimer <= 0) { this._phase = (this._phase + 1) % 3; this._phaseTimer = 5; }

    if (this.stunned) {
      if (!this._breakFreeTimer) this._breakFreeTimer = 0.4;
      this._breakFreeTimer -= dt;
      if (this._breakFreeTimer <= 0) {
        this.stunned = false; this.stunTimer = 0; this._breakFreeTimer = null;
        this._orbitSpeed = 4.0; Effects.shake(6, 0.12);
        Particles.burst(this.x, this.y, 10, '#aaf', 200);
      }
      return;
    }
    this._breakFreeTimer = null;
    this._orbitSpeed = lerp(this._orbitSpeed, 2.5, 0.02);

    switch (this._phase) {
      case 0:
        this._orbitRadius = lerp(this._orbitRadius, 180, 0.03);
        this._shootTimer -= dt;
        if (this._shootTimer <= 0) {
          this._shootTimer = 0.8;
          const toPlayer = Math.atan2(player.y - this.y, player.x - this.x);
          if (this._enemyProjectiles) {
            this._enemyProjectiles.push(new Projectile(this.x, this.y, toPlayer, 280, 8,
              { color: '#88f', radius: 5, fromPlayer: false, life: 2.5, trail: true }));
          }
        }
        break;
      case 1:
        this._orbitRadius = lerp(this._orbitRadius, 100, 0.05);
        this._orbitSpeed = lerp(this._orbitSpeed, 3.5, 0.03);
        this._shootTimer -= dt;
        if (this._shootTimer <= 0) {
          this._shootTimer = 1.2;
          for (let i = -2; i <= 2; i++) {
            const toPlayer = Math.atan2(player.y - this.y, player.x - this.x) + i * 0.25;
            if (this._enemyProjectiles) {
              this._enemyProjectiles.push(new Projectile(this.x, this.y, toPlayer, 220, 6,
                { color: '#aaf', radius: 4, fromPlayer: false, life: 2.0, trail: true }));
            }
          }
          Audio.shoot();
        }
        break;
      case 2:
        this._orbitRadius = lerp(this._orbitRadius, 250, 0.03);
        this._orbitSpeed = lerp(this._orbitSpeed, 2.0, 0.02);
        this._shootTimer -= dt;
        if (this._shootTimer <= 0) {
          this._shootTimer = 0.3;
          const spiralAngle = this._orbitAngle * 2;
          if (this._enemyProjectiles) {
            this._enemyProjectiles.push(new Projectile(this.x, this.y, spiralAngle, 180, 5,
              { color: '#88f', radius: 4, fromPlayer: false, life: 3.0, trail: true }));
          }
        }
        break;
    }

    this._orbitAngle += this._orbitSpeed * dt;
    const targetX = player.x + Math.cos(this._orbitAngle) * this._orbitRadius;
    const targetY = player.y + Math.sin(this._orbitAngle) * this._orbitRadius;
    this.vx = (targetX - this.x) * 5;
    this.vy = (targetY - this.y) * 5;
    if (Math.random() > 0.5) Particles.trail(this.x, this.y, '#aaf', 3);
  }

  _bossTiger(dt, player, dist, projectiles) {
    this.bossPatternTimer -= dt;
    if (this.bossPatternTimer <= 0) { this.bossPattern = (this.bossPattern + 1) % 3; this.bossPatternTimer = 2.5; }
    if (this.bossPattern === 0) {
      if (!this.chargeState) { this.chargeState = 'windup'; this.chargeTimer = 0.4; this.chargeDir = Vec.norm(Vec.sub(player, this)); this._tigerDashes = 0; }
      if (this.chargeState === 'windup') { this.vx = (Math.random()-0.5)*100; this.vy = (Math.random()-0.5)*100; this.chargeTimer -= dt; if (this.chargeTimer <= 0) { this.chargeState = 'charge'; this.chargeTimer = 0.3; this.chargeDir = Vec.norm(Vec.sub(player, this)); } }
      else if (this.chargeState === 'charge') { this.vx = this.chargeDir.x * 650; this.vy = this.chargeDir.y * 650; Particles.trail(this.x, this.y, '#fa0', 5); this.chargeTimer -= dt;
        if (this.chargeTimer <= 0) { this._tigerDashes++; if (this._tigerDashes < 3) { this.chargeState = 'windup'; this.chargeTimer = 0.2; } else this.chargeState = null; }
      }
    } else if (this.bossPattern === 1) {
      this.vx *= 0.92; this.vy *= 0.92;
      if (this.attackTimer <= 0) { this.attackTimer = 0.3;
        for (let i = 0; i < 10; i++) { const a = (Math.PI*2/10)*i + (this.time||0)*0.5;
          projectiles.push(new Projectile(this.x, this.y, a, 350, 15, { color: '#fa0', radius: 4, fromPlayer: false, life: 2.5 }));
        } Effects.shake(4, 0.1);
      }
    } else {
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

  _bossReal(dt, player, dist, projectiles) {
    this.bossPatternTimer -= dt;
    if (this.bossPatternTimer <= 0) { this.bossPattern = (this.bossPattern + 1) % 5; this.bossPatternTimer = 3; }
    switch (this.bossPattern) {
      case 0:
        const dir0 = Vec.norm(Vec.sub(player, this));
        this.vx = dir0.x * this.speed * 2; this.vy = dir0.y * this.speed * 2;
        Particles.trail(this.x, this.y, '#da0', 2); break;
      case 1:
        if (!this.chargeState) { this.chargeState = 'windup'; this.chargeTimer = 0.25; this.chargeDir = Vec.norm(Vec.sub(player, this)); this._dashCount = 0; }
        if (this.chargeState === 'windup') { this.vx = (Math.random()-0.5)*100; this.vy = (Math.random()-0.5)*100; this.chargeTimer -= dt; if (this.chargeTimer <= 0) { this.chargeState = 'charge'; this.chargeTimer = 0.2; this.chargeDir = Vec.norm(Vec.sub(player, this)); } }
        else if (this.chargeState === 'charge') { this.vx = this.chargeDir.x * 700; this.vy = this.chargeDir.y * 700; Particles.trail(this.x, this.y, '#ff0', 5); this.chargeTimer -= dt;
          if (this.chargeTimer <= 0) { this._dashCount++; if (this._dashCount < 3) { this.chargeState = 'windup'; this.chargeTimer = 0.2; } else this.chargeState = null; }
        } break;
      case 2:
        this.vx *= 0.85; this.vy *= 0.85;
        if (this.attackTimer <= 0) { this.attackTimer = 0.5; this._laserPhase = (this._laserPhase || 0) + 0.3;
          for (let i = 0; i < 8; i++) { const a = (Math.PI * 2 / 8) * i + this._laserPhase;
            projectiles.push(new Projectile(this.x, this.y, a, 350, 12, { color: '#ff0', radius: 5, fromPlayer: false, life: 2.5, trail: true }));
          } Effects.shake(3, 0.08);
        } break;
      case 3:
        const dir3 = Vec.norm(Vec.sub(player, this));
        this.vx = -dir3.x * this.speed * 0.5; this.vy = -dir3.y * this.speed * 0.5;
        if (this.attackTimer <= 0) { this.attackTimer = 0.2;
          const toPlayer = Math.atan2(player.y - this.y, player.x - this.x);
          projectiles.push(new Projectile(this.x, this.y, toPlayer, 600, 15, { color: '#ff0', radius: 6, fromPlayer: false, life: 1.5, trail: true, pierce: true }));
          Particles.emit(this.x + dir3.x * 15, this.y + dir3.y * 15, 3, '#ff0', { speed: 200, life: 0.1, angle: toPlayer, spread: 0.3, size: 3 });
        } break;
      case 4:
        this.orbitAngle = (this.orbitAngle || 0) + 2.5 * dt;
        const targetX = player.x + Math.cos(this.orbitAngle) * 120;
        const targetY = player.y + Math.sin(this.orbitAngle) * 120;
        const d4 = Vec.norm(Vec.sub({ x: targetX, y: targetY }, this));
        this.vx = d4.x * this.speed * 1.5; this.vy = d4.y * this.speed * 1.5;
        if (this.attackTimer <= 0) { this.attackTimer = 0.18;
          projectiles.push(new Projectile(this.x, this.y, this.angle, 500, 10, { color: '#ff0', radius: 4, fromPlayer: false, life: 1.8, trail: true }));
        } break;
    }
  }

  takeDamage(amount) {
    if (this.dying || this.dead) return;
    if (this.isFake) { this.die(); Particles.burst(this.x, this.y, 8, '#da0', 100); return; }
    if (this.type.behavior === 'scarecrow' && !this.revealed) {
      this.revealed = true; this.isBoss = true;
      this.hp = this.type.realHp || this.hp; this.maxHp = this.hp;
      Particles.burst(this.x, this.y, 20, '#f80', 250);
      Effects.shake(10, 0.2); Effects.slowMotion(0.2, 0.1);
      return;
    }
    if (this.type.behavior === 'boss_pillow' && !this.stunned) amount *= 0.3;
    this.hp -= amount; this.hitFlash = 0.1; Audio.hit();
    if (this.hp <= 0) this.die();
  }

  die() {
    this.dying = true; this.dyingTimer = 0.3; this.vx = 0; this.vy = 0;
    Audio.enemyDie(); Effects.slowMotion(0.3, 0.05);
    if (this.type.behavior === 'bat' || this.type.behavior === 'boss_tiger') {
      const count = Math.floor(this.radius * 1.5);
      for (let i = 0; i < count; i++) {
        const a = randAngle(), spd = randRange(100, 350);
        Particles.list.push({
          x: this.x, y: this.y,
          vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
          life: randRange(0.5, 1.2), maxLife: 1.2,
          size: randRange(3, 8), startSize: 8,
          r: 0.87, g: 0.87, b: 0.87,
          friction: 0.96, height: randRange(5, 20),
        });
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

  _initBodyDots() {
    if (this._bodyDots) return;
    this._bodyDots = [];
    const r = this.radius;
    // Generate dots based on enemy type shape
    if (this.isBoss) {
      // Bosses: large sphere
      this._bodyDots = EntityDots.sampleSphere(0, r * 1.2, 0, r * 1.5, 0.7);
    } else {
      // Regular enemies: smaller sphere
      this._bodyDots = EntityDots.sampleSphere(0, r, 0, r * 1.2, 0.8);
    }
  }

  updateMesh() {
    if (!this.mesh) return;
    this._initBodyDots();

    // Hide solid mesh — render as dot cloud
    this.mesh.visible = false;

    // Spawn animation: sparse dots that fill in
    if (this.spawnTimer > 0) {
      const t = 1 - this.spawnTimer / 0.4;
      const c = new THREE.Color(this.color);
      const dots = [];
      for (const ld of this._bodyDots) {
        if (Math.random() > t) continue; // sparse during spawn
        dots.push({
          x: this.x + ld.lx * t, y: ld.ly * t, z: this.y + ld.lz * t,
          r: c.r, g: c.g, b: c.b, size: 2.0 * t,
        });
      }
      EntityDots.submit(dots);
      return;
    }

    // Dying: dots scatter outward
    if (this.dying) {
      const t = 1 - this.dyingTimer / 0.3;
      const c = new THREE.Color(this.color);
      const dots = [];
      for (const ld of this._bodyDots) {
        if (Math.random() > (1 - t)) continue; // dots disappear over time
        const scatter = t * 30;
        dots.push({
          x: this.x + ld.lx + (Math.random() - 0.5) * scatter,
          y: ld.ly + Math.random() * scatter,
          z: this.y + ld.lz + (Math.random() - 0.5) * scatter,
          r: c.r * (1 - t), g: c.g * (1 - t), b: c.b * (1 - t),
          size: 2.0 * (1 - t),
        });
      }
      EntityDots.submit(dots);
      return;
    }

    // Normal: render entity as dot cloud
    const c = new THREE.Color(this.hitFlash > 0 ? '#fff' : this.color);
    const t = Date.now() / 1000;
    const breath = 1 + Math.sin(t * 2.2 + this.phaseTimer) * 0.06;
    const dots = [];
    for (const ld of this._bodyDots) {
      dots.push({
        x: this.x + ld.lx, y: ld.ly * breath, z: this.y + ld.lz,
        r: c.r, g: c.g, b: c.b, size: 2.2,
      });
    }
    EntityDots.submit(dots);

    // HP bar (keep as 3D mesh — it's UI, not entity body)
    if (this.hpBar) {
      if (this.hp < this.maxHp && !this.isBoss && !this.isFake && !this.dying) {
        this.hpBar.visible = true;
        this.hpBar.position.set(this.x, 40, this.y);
        this.hpBar.lookAt(Renderer.camera.position);
        const fill = this.hpBar.userData.fill;
        if (fill) {
          const pct = this.hp / this.maxHp;
          fill.scale.x = Math.max(0.01, pct);
          fill.position.x = -15 * (1 - pct);
        }
        const fillMat = this.hpBar.userData.fillMat;
        if (fillMat) fillMat.color.set(this.color);
      } else {
        this.hpBar.visible = false;
      }
    }

    // Stun ring as dot ring
    if (this.stunRing) this.stunRing.visible = false;
    if (this.stunned) {
      const stunDots = [];
      const sr = this.radius + 8;
      for (let i = 0; i < 12; i++) {
        const a = (Math.PI * 2 / 12) * i + t * 3;
        stunDots.push({
          x: this.x + Math.cos(a) * sr, y: 3, z: this.y + Math.sin(a) * sr,
          r: 0.67, g: 0, b: 1, size: 2.0,
        });
      }
      EntityDots.submit(stunDots);
    }
  }

  destroy() {
    if (this.mesh) Renderer.removeFromScene(this.mesh);
    if (this.hpBar) Renderer.removeFromScene(this.hpBar);
    if (this.stunRing) Renderer.removeFromScene(this.stunRing);
    this.mesh = null; this.hpBar = null; this.stunRing = null;
  }

  draw() {}
}

// ============================
// ENEMY TYPE DEFINITIONS
// ============================
const EnemyTypes = {
  LIKE: {
    hp: 25, speed: 140, radius: 14, color: '#a050e0', damage: 4, attackCooldown: 1.5,
    behavior: 'social', icon: '❤', iconColor: '#a050e0', score: 10,
  },
  RETWEET: {
    hp: 30, speed: 120, radius: 14, color: '#2a2', damage: 5, attackCooldown: 1.8,
    behavior: 'social', icon: '🔄', iconColor: '#2a2', score: 12,
  },
  COMMENT: {
    hp: 35, speed: 110, radius: 15, color: '#48f', damage: 6, attackCooldown: 2.0,
    behavior: 'social', icon: '💬', iconColor: '#48f', score: 12,
  },
  HIGH_HEEL: {
    hp: 60, speed: 130, radius: 13, color: '#e5a', damage: 12, attackCooldown: 1.5,
    behavior: 'shoe', heelColor: '#c38', score: 10,
  },
  LEATHER_SHOE: {
    hp: 80, speed: 100, radius: 16, color: '#864', damage: 15, attackCooldown: 2.0,
    behavior: 'shoe', heelColor: '#543', score: 12,
  },
  BOSS_MIRROR: {
    hp: 600, speed: 100, radius: 28, color: '#aaf', damage: 15, attackCooldown: 0.8,
    behavior: 'boss_mirror', isBoss: true, score: 100, name: 'MIRROR',
  },
  SPIDER: {
    hp: 40, speed: 160, radius: 8, color: '#555', damage: 8, attackCooldown: 1.0,
    behavior: 'spider', orbitRadius: 220, orbitSpeed: 2.5, score: 8,
  },
  BOSS_SPIDER: {
    hp: 800, speed: 110, radius: 35, color: '#333', damage: 20, attackCooldown: 0.3,
    behavior: 'boss_spider', isBoss: true, score: 100, name: 'SPIDER QUEEN',
  },
  WATER_FLOW: {
    hp: 50, speed: 220, radius: 14, color: '#48f', damage: 8, attackCooldown: 1.0,
    behavior: 'water', score: 15,
    floatingText: ["everyone would be better off", "i can't feel anything", "what's the point", "i used to be someone"],
  },
  BOSS_PILLOW: {
    hp: 900, speed: 200, radius: 22, color: '#88c', damage: 30, attackCooldown: 0.8,
    behavior: 'boss_pillow', isBoss: true, score: 100, icon: 'ghost', name: 'GHOST',
  },
  BAT: {
    hp: 40, speed: 160, radius: 12, color: '#e88', damage: 8, attackCooldown: 1.2,
    behavior: 'bat', growthRate: 3, score: 12,
  },
  BOSS_TIGER: {
    hp: 1000, speed: 200, radius: 35, color: '#fa0', damage: 28, attackCooldown: 0.3,
    behavior: 'boss_tiger', isBoss: true, score: 100, name: 'PAPER TIGER',
  },
  SCARECROW_FAKE: {
    hp: 1, speed: 0, radius: 16, color: '#a86', damage: 0, attackCooldown: 99,
    behavior: 'scarecrow', isFake: true, score: 2,
  },
  SCARECROW_REAL: {
    hp: 1, speed: 200, radius: 16, color: '#a86', damage: 10, attackCooldown: 0.8,
    behavior: 'scarecrow', isFake: false, realHp: 400, score: 100, isBoss: true,
  },
};
