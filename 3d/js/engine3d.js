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

  // Pitch-swept tone — the backbone of "punchy" procedural SFX
  _sweep(f0, f1, duration, type = 'sine', volume = 0.3) {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), this.ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain); gain.connect(this.masterGain);
    osc.start(); osc.stop(this.ctx.currentTime + duration);
  },

  // Bass kick: sine drop 150→40Hz — gives impacts a body
  _kick(volume = 0.4, duration = 0.16) { this._sweep(150, 40, duration, 'sine', volume); },

  shoot() { this._playTone(800, 0.1, 'square', 0.15); this._playNoise(0.05, 0.1); },
  sniper() { this._kick(0.35, 0.2); this._sweep(900, 120, 0.25, 'sawtooth', 0.18); this._playNoise(0.18, 0.22); },
  dart() { this._sweep(1600, 900, 0.07, 'sine', 0.12); },
  grapple() { this._sweep(120, 320, 0.3, 'sawtooth', 0.18); },
  grappleHit() { this._kick(0.3, 0.12); this._playTone(100, 0.2, 'square', 0.2); },
  hit() { this._playTone(200, 0.08, 'square', 0.18); this._playNoise(0.06, 0.14); },
  punchLight() { this._sweep(300, 120, 0.08, 'square', 0.2); this._playNoise(0.04, 0.12); },
  punchHeavy() { this._kick(0.5, 0.22); this._sweep(420, 60, 0.18, 'square', 0.28); this._playNoise(0.14, 0.25); },
  katana() { this._sweep(2400, 300, 0.12, 'sawtooth', 0.1); this._playNoise(0.1, 0.18); },
  enemyDie() { this._kick(0.25, 0.14); this._sweep(400, 60, 0.3, 'sawtooth', 0.14); this._playNoise(0.18, 0.14); },
  playerHit() { this._kick(0.45, 0.2); this._sweep(220, 50, 0.25, 'square', 0.25); this._playNoise(0.15, 0.2); },
  dash() { this._sweep(300, 900, 0.14, 'sine', 0.14); },
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

  // --- Ambient cyber drone (procedural, loops forever, M to mute) ---
  _music: null,
  startMusic() {
    if (!this.ctx || this._music) return;
    const t = this.ctx.currentTime;
    const musicGain = this.ctx.createGain();
    musicGain.gain.value = 0.05;
    musicGain.connect(this.masterGain);

    // Two detuned saws through a slowly-sweeping lowpass = soft pad
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 2;
    filter.connect(musicGain);

    const oscs = [];
    [[110, -7], [110, 7], [220, 0]].forEach(([f, det]) => {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      o.connect(filter); o.start();
      oscs.push(o);
    });

    // LFO sweeps the filter — slow breathing
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.06;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain); lfoGain.connect(filter.frequency);
    lfo.start();

    // Sparse high "data blip" pattern
    const blipTimer = setInterval(() => {
      if (this.muted || !this._music) return;
      if (Math.random() < 0.4) {
        const f = [523, 659, 784, 880, 1047][Math.floor(Math.random() * 5)];
        this._playTone(f, 0.4, 'sine', 0.02);
      }
    }, 1800);

    this._music = { oscs, lfo, musicGain, blipTimer };
  },

  setMusicIntensity(level) {
    // 0 = calm (menus), 1 = combat — raises pad volume slightly
    if (!this._music) return;
    const target = level > 0.5 ? 0.07 : 0.04;
    this._music.musicGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 1.5);
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : 0.3;
    return this.muted;
  },
};

// --- Camera3D ---
const Camera = {
  x: 0, y: 0,
  targetX: 0, targetY: 0,
  canvasW: 1280, canvasH: 720,
  smoothing: 0.1,
  leadAmount: 70,
  zoomPunch: 0,      // impact zoom, decays fast
  baseZoom: 1.55,    // closer framing — characters read larger through the ASCII filter

  follow(target, aimX, aimY) {
    const dx = aimX - target.x;
    const dy = aimY - target.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Lead scales with aim distance (capped) — feels more deliberate
    const lead = Math.min(this.leadAmount, dist * 0.25);
    const leadX = dist > 0 ? (dx / dist) * lead : 0;
    const leadY = dist > 0 ? (dy / dist) * lead : 0;
    this.targetX = target.x + leadX;
    this.targetY = target.y + leadY;
  },

  punchZoom(amount = 0.06) {
    this.zoomPunch = Math.max(this.zoomPunch, amount);
  },

  update(dt) {
    this.x = lerp(this.x, this.targetX, this.smoothing);
    this.y = lerp(this.y, this.targetY, this.smoothing);
    this.zoomPunch = Math.max(0, this.zoomPunch - dt * 0.35);
  },

  apply() {
    const shake = Effects.getShakeOffset();
    const cam = Renderer.camera;
    // ~48° 3/4 view — shows character silhouettes, not just their heads
    cam.position.x = this.x + shake.x;
    cam.position.y = 540;
    cam.position.z = this.y + 480 + shake.y;
    cam.lookAt(this.x + shake.x, 0, this.y + shake.y);
    const z = this.baseZoom + this.zoomPunch;
    if (Math.abs(cam.zoom - z) > 0.0005) {
      cam.zoom = z;
      cam.updateProjectionMatrix();
    }
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
    // trauma accumulates instead of overwriting — repeated hits feel heavier
    this.shakeAmount = Math.max(this.shakeAmount * (this.shakeTimer > 0 ? 0.5 : 0), amount);
    this.shakeDuration = duration;
    this.shakeTimer = duration;
  },

  slowMotion(factor, duration) {
    this.slowMo = factor;
    this.slowMoTimer = duration;
  },

  // Hard hit-stop: near-freeze for a few frames. The cheapest, strongest juice.
  hitStop(duration = 0.07) {
    this.slowMo = 0.02;
    this.slowMoTimer = duration;
  },

  // Cyber glitch burst on the ASCII shader (player damage, boss death)
  glitch(amount = 0.8) {
    Renderer.glitch = Math.max(Renderer.glitch, amount);
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
    const intensity = this.shakeAmount * progress * progress; // quadratic falloff: sharp attack, fast settle
    return {
      x: (Math.random() - 0.5) * 2 * intensity,
      y: (Math.random() - 0.5) * 2 * intensity,
    };
  },
};

// --- Floating damage numbers (HTML, projected from world space) ---
// ASCII-style crisp text that lives above the canvas, so it stays
// sharp even through the ASCII shader.
const DamageNumbers = {
  list: [],
  container: null,
  _vec: null,

  init() {
    this.container = document.getElementById('damage-numbers');
    this._vec = new THREE.Vector3();
  },

  spawn(x, y, text, color = '#0b141a', opts = {}) {
    if (!this.container) return;
    if (this.list.length > 40) { const old = this.list.shift(); old.el.remove(); }
    const el = document.createElement('div');
    el.className = 'dmg-num' + (opts.big ? ' big' : '');
    el.textContent = text;
    el.style.color = color;
    this.container.appendChild(el);
    this.list.push({
      el, x, y,
      h: opts.height || 30,        // world height offset
      vy: opts.rise || 55,         // world rise speed
      vx: (Math.random() - 0.5) * 30,
      life: opts.life || 0.8,
      maxLife: opts.life || 0.8,
    });
  },

  update(dt) {
    if (!this.container) return;
    const cam = Renderer.camera;
    const w = Renderer.width, h = Renderer.height;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i];
      d.life -= dt;
      if (d.life <= 0) { d.el.remove(); this.list.splice(i, 1); continue; }
      d.h += d.vy * dt;
      d.x += d.vx * dt;
      const t = d.life / d.maxLife;
      this._vec.set(d.x, d.h, d.y).project(cam);
      const sx = (this._vec.x * 0.5 + 0.5) * w;
      const sy = (-this._vec.y * 0.5 + 0.5) * h;
      d.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%) scale(${0.8 + t * 0.4})`;
      d.el.style.opacity = Math.min(1, t * 2.5);
    }
  },

  clear() {
    for (const d of this.list) d.el.remove();
    this.list = [];
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

    // Custom shader so the per-particle `size` attribute actually works
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * 3.4; // sized so each particle covers an ASCII cell
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          if (dot(d, d) > 0.25) discard;
          gl_FragColor = vec4(vColor, 0.85);
        }
      `,
      vertexColors: true,
    });

    this.points = new THREE.Points(this.geometry, mat);
    this.points.frustumCulled = false;
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

// --- Shockwave rings (expanding ground rings on heavy impacts) ---
const Shockwaves = {
  list: [],

  spawn(x, y, opts = {}) {
    const color = opts.color || Theme.accent;
    const geo = new THREE.RingGeometry(0.8, 1.0, 40);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: opts.opacity || 0.7,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 1.5, y);
    Renderer.particlesGroup.add(mesh);
    this.list.push({
      mesh, mat,
      life: opts.life || 0.4,
      maxLife: opts.life || 0.4,
      maxRadius: opts.radius || 80,
      baseOpacity: opts.opacity || 0.7,
    });
  },

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      s.life -= dt;
      if (s.life <= 0) {
        Renderer.particlesGroup.remove(s.mesh);
        s.mesh.geometry.dispose(); s.mat.dispose();
        this.list.splice(i, 1);
        continue;
      }
      const t = 1 - s.life / s.maxLife;
      const r = easeOutCubic(t) * s.maxRadius;
      s.mesh.scale.setScalar(Math.max(0.001, r));
      s.mat.opacity = s.baseOpacity * (1 - t);
    }
  },

  clear() {
    for (const s of this.list) {
      Renderer.particlesGroup.remove(s.mesh);
      s.mesh.geometry.dispose(); s.mat.dispose();
    }
    this.list = [];
  },
};
