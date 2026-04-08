// ============================================================
// engine3d.js — Vec, Utils, Input, Audio, Camera3D, Particles3D, Effects
// ============================================================

// --- Global Color Theme (Light Blue) ---
const Theme = {
  bg:       '#eef4ff',
  floor:    '#dce8f8',
  primary:  '#0b141a',
  secondary:'#4a6070',
  accent:   '#1b7ed6',
  accentSoft:'rgba(27, 126, 214, 0.35)',
  panel:    'rgba(210, 228, 252, 0.52)',
  panelBorder: 'rgba(27, 126, 214, 0.18)',
  text:     '#0b141a',
  textMuted:'#4a6070',
  white:    '#ffffff',
  danger:   '#d64545',
  success:  '#2a9d5c',
  warning:  '#d69f1b',
  grid:     'rgba(27, 126, 214, 0.06)',
  fontUI:   '"DM Mono", "Courier New", monospace',
  fontTitle:'"Bebas Neue", "DM Mono", sans-serif',
};

// --- Vector helpers ---
const Vec = {
  create: (x = 0, y = 0) => ({ x, y }),
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
  mul: (v, s) => ({ x: v.x * s, y: v.y * s }),
  len: (v) => Math.sqrt(v.x * v.x + v.y * v.y),
  lenSq: (v) => v.x * v.x + v.y * v.y,
  norm: (v) => { const l = Vec.len(v); return l > 0 ? Vec.mul(v, 1 / l) : { x: 0, y: 0 }; },
  dist: (a, b) => Vec.len(Vec.sub(a, b)),
  distSq: (a, b) => Vec.lenSq(Vec.sub(a, b)),
  dot: (a, b) => a.x * b.x + a.y * b.y,
  angle: (v) => Math.atan2(v.y, v.x),
  fromAngle: (a) => ({ x: Math.cos(a), y: Math.sin(a) }),
  lerp: (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }),
  rotate: (v, a) => ({
    x: v.x * Math.cos(a) - v.y * Math.sin(a),
    y: v.x * Math.sin(a) + v.y * Math.cos(a),
  }),
};

// --- Utility functions ---
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function randRange(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(randRange(min, max + 1)); }
function randAngle() { return Math.random() * Math.PI * 2; }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function easeOutElastic(t) {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

// --- Color helpers ---
function hsl(h, s, l, a = 1) {
  return a < 1 ? `hsla(${h}, ${s}%, ${l}%, ${a})` : `hsl(${h}, ${s}%, ${l}%)`;
}
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

// --- Input Manager ---
const Input = {
  keys: {},
  prevKeys: {},
  mouse: { x: 0, y: 0, worldX: 0, worldY: 0, down: false, clicked: false, rightDown: false, rightClicked: false },
  _clickedThisFrame: false,
  _rightClickedThisFrame: false,
  wheelDelta: 0,
  _raycaster: null,
  _groundPlane: null,
  _ndc: null,

  init(canvas) {
    this._canvas = canvas;
    this._raycaster = new THREE.Raycaster();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._ndc = new THREE.Vector2();

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    // Listen on the whole window so mouse outside canvas still works
    window.addEventListener('mousemove', (e) => {
      const rect = this._canvas.getBoundingClientRect();
      // Map to NDC-ready coords using actual canvas dimensions
      this.mouse.screenX = e.clientX;
      this.mouse.screenY = e.clientY;
      this.mouse.canvasX = e.clientX - rect.left;
      this.mouse.canvasY = e.clientY - rect.top;
      this.mouse.canvasW = rect.width;
      this.mouse.canvasH = rect.height;
    });
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.down = true; this._clickedThisFrame = true; }
      if (e.button === 2) { this.mouse.rightDown = true; this._rightClickedThisFrame = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rightDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => {
      this.wheelDelta += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
  },

  update() {
    this.mouse.clicked = this._clickedThisFrame;
    this.mouse.rightClicked = this._rightClickedThisFrame;
    this._clickedThisFrame = false;
    this._rightClickedThisFrame = false;

    // Compute NDC from actual canvas-relative mouse position
    const cw = this.mouse.canvasW || 1;
    const ch = this.mouse.canvasH || 1;
    this._ndc.set(
      (this.mouse.canvasX / cw) * 2 - 1,
      -(this.mouse.canvasY / ch) * 2 + 1
    );
    this._raycaster.setFromCamera(this._ndc, Renderer.camera);
    const intersection = new THREE.Vector3();
    if (this._raycaster.ray.intersectPlane(this._groundPlane, intersection)) {
      this.mouse.worldX = intersection.x;
      this.mouse.worldY = intersection.z; // 3D z maps to game y
    }

    // Also set legacy x/y for HUD overlays
    this.mouse.x = (this.mouse.canvasX / cw) * 1280;
    this.mouse.y = (this.mouse.canvasY / ch) * 720;
  },

  postUpdate() {
    Object.assign(this.prevKeys, this.keys);
    this.wheelDelta = 0;
  },

  justPressed(code) {
    return this.keys[code] && !this.prevKeys[code];
  },

  isDown(code) {
    return !!this.keys[code];
  },

  getMovement() {
    let dx = 0, dy = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) { dx /= len; dy /= len; }
    return { x: dx, y: dy };
  },
};

// --- Audio (Web Audio API procedural sounds) ---
const Audio = {
  ctx: null,
  masterGain: null,
  muted: false,

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Web Audio not available');
    }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  _playTone(freq, duration, type = 'sine', volume = 0.3, detune = 0) {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },

  _playNoise(duration, volume = 0.2) {
    if (!this.ctx || this.muted) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  },

  shoot() { this._playTone(800, 0.1, 'square', 0.15); this._playNoise(0.05, 0.1); },
  sniper() { this._playTone(200, 0.3, 'sawtooth', 0.2); this._playTone(600, 0.2, 'sine', 0.15); this._playNoise(0.15, 0.2); },
  dart() { this._playTone(1200, 0.05, 'sine', 0.1); },
  grapple() { this._playTone(150, 0.4, 'sawtooth', 0.2); this._playTone(300, 0.3, 'sine', 0.15); },
  grappleHit() { this._playTone(100, 0.2, 'square', 0.2); },
  hit() { this._playTone(200, 0.1, 'square', 0.2); this._playNoise(0.08, 0.15); },
  enemyDie() { this._playTone(150, 0.3, 'sawtooth', 0.15); this._playTone(80, 0.4, 'square', 0.1); this._playNoise(0.2, 0.15); },
  playerHit() { this._playTone(100, 0.2, 'square', 0.3); this._playNoise(0.15, 0.2); },
  dash() { this._playTone(400, 0.15, 'sine', 0.15); this._playTone(600, 0.1, 'sine', 0.1); },
  waveComplete() {
    this._playTone(523, 0.15, 'sine', 0.2);
    setTimeout(() => this._playTone(659, 0.15, 'sine', 0.2), 100);
    setTimeout(() => this._playTone(784, 0.3, 'sine', 0.2), 200);
  },
  levelComplete() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this._playTone(f, 0.3, 'sine', 0.25), i * 150);
    });
  },
  menuSelect() { this._playTone(600, 0.08, 'sine', 0.15); },
  charReveal() { this._playTone(800 + Math.random() * 400, 0.03, 'sine', 0.05); },
};

// --- Camera3D ---
const Camera = {
  x: 0, y: 0,
  targetX: 0, targetY: 0,
  canvasW: 1280, canvasH: 720,
  smoothing: 0.08,
  leadAmount: 60,

  follow(target, aimX, aimY) {
    const dx = aimX - target.x;
    const dy = aimY - target.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const leadX = dist > 0 ? (dx / dist) * this.leadAmount : 0;
    const leadY = dist > 0 ? (dy / dist) * this.leadAmount : 0;
    this.targetX = target.x + leadX;
    this.targetY = target.y + leadY;
  },

  update(dt) {
    this.x = lerp(this.x, this.targetX, this.smoothing);
    this.y = lerp(this.y, this.targetY, this.smoothing);
  },

  apply() {
    const shake = Effects.getShakeOffset();
    const cam = Renderer.camera;
    cam.position.x = this.x + shake.x;
    cam.position.y = 600;
    cam.position.z = this.y + 400 + shake.y;
    cam.lookAt(this.x + shake.x, 0, this.y + shake.y);
  },
};

// --- Screen Effects ---
const Effects = {
  shakeAmount: 0,
  shakeDuration: 0,
  shakeTimer: 0,
  slowMo: 1,
  slowMoTimer: 0,
  flashAlpha: 0,
  flashColor: '#fff',

  shake(amount, duration = 0.2) {
    this.shakeAmount = amount;
    this.shakeDuration = duration;
    this.shakeTimer = duration;
  },

  slowMotion(factor, duration) {
    this.slowMo = factor;
    this.slowMoTimer = duration;
  },

  flash(color = '#fff', alpha = 0.3) {
    this.flashColor = color;
    this.flashAlpha = alpha;
  },

  update(dt) {
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
    }
    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= dt / this.slowMo;
      if (this.slowMoTimer <= 0) this.slowMo = 1;
    }
    if (this.flashAlpha > 0) {
      this.flashAlpha -= dt * 3;
    }
    // Update flash overlay DOM
    const flashEl = document.getElementById('overlay-flash');
    if (flashEl) {
      if (this.flashAlpha > 0) {
        flashEl.style.backgroundColor = this.flashColor;
        flashEl.style.opacity = this.flashAlpha;
      } else {
        flashEl.style.opacity = 0;
      }
    }
  },

  getShakeOffset() {
    if (this.shakeTimer <= 0) return { x: 0, y: 0 };
    const progress = this.shakeTimer / this.shakeDuration;
    const intensity = this.shakeAmount * progress;
    return {
      x: (Math.random() - 0.5) * 2 * intensity,
      y: (Math.random() - 0.5) * 2 * intensity,
    };
  },
};

// --- Particle System (3D version using THREE.Points) ---
const Particles = {
  list: [],
  points: null,
  maxParticles: 600,
  positions: null,
  colors: null,
  sizes: null,
  geometry: null,

  init() {
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);
    this.sizes = new Float32Array(this.maxParticles);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 4,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, mat);
    Renderer.particlesGroup.add(this.points);
  },

  emit(x, y, count, color, opts = {}) {
    const speed = opts.speed || 200;
    const life = opts.life || 0.5;
    const size = opts.size || 3;
    const spread = opts.spread || Math.PI * 2;
    const baseAngle = opts.angle || 0;
    const c = new THREE.Color(color);

    for (let i = 0; i < count; i++) {
      if (this.list.length >= this.maxParticles) break;
      const a = baseAngle + (Math.random() - 0.5) * spread;
      const s = speed * (0.3 + Math.random() * 0.7);
      const l = life * (0.5 + Math.random() * 0.5);
      const sz = size * (0.5 + Math.random() * 0.5);
      this.list.push({
        x, y, // game coords
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: l, maxLife: l,
        size: sz, startSize: sz,
        r: c.r, g: c.g, b: c.b,
        friction: opts.friction || 0.98,
        height: opts.height || 5, // 3D height
      });
    }
  },

  burst(x, y, count, color, speed = 300) {
    this.emit(x, y, count, color, { speed, life: 0.6, size: 4 });
  },

  trail(x, y, color, size = 2) {
    this.emit(x, y, 1, color, { speed: 20, life: 0.3, size });
  },

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.size = p.startSize * (p.life / p.maxLife);
      if (p.life <= 0) {
        this.list.splice(i, 1);
      }
    }

    // Update buffer
    for (let i = 0; i < this.maxParticles; i++) {
      if (i < this.list.length) {
        const p = this.list[i];
        const alpha = clamp(p.life / p.maxLife, 0, 1);
        this.positions[i * 3] = p.x;
        this.positions[i * 3 + 1] = p.height;
        this.positions[i * 3 + 2] = p.y; // game y → 3D z
        this.colors[i * 3] = p.r * alpha;
        this.colors[i * 3 + 1] = p.g * alpha;
        this.colors[i * 3 + 2] = p.b * alpha;
        this.sizes[i] = Math.max(0.5, p.size);
      } else {
        this.positions[i * 3 + 1] = -1000; // hide unused
        this.sizes[i] = 0;
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  },

  clear() {
    this.list = [];
  },

  // Compat: draw is a no-op in 3D (particles render via Points)
  draw() {},
};
