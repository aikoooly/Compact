// ============================================================
// engine.js — Vector math, Input, Audio, Particles, Camera
// ============================================================

// --- Global Color Theme (Light Blue) ---
const Theme = {
  bg:       '#eef4ff',   // main background
  floor:    '#dce8f8',   // arena floor
  primary:  '#0b141a',   // player, enemies, main elements
  secondary:'#4a6070',   // muted text, weak elements
  accent:   '#1b7ed6',   // charge, compact, active states
  accentSoft:'rgba(27, 126, 214, 0.35)',
  panel:    'rgba(210, 228, 252, 0.52)', // UI panel bg
  panelBorder: 'rgba(27, 126, 214, 0.18)',
  text:     '#0b141a',   // main text
  textMuted:'#4a6070',   // secondary text
  white:    '#ffffff',
  danger:   '#d64545',   // damage, death
  success:  '#2a9d5c',   // health OK
  warning:  '#d69f1b',   // mid health
  grid:     'rgba(27, 126, 214, 0.06)', // arena grid lines
  // Fonts
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

// --- Neon glow helper ---
function drawGlow(ctx, x, y, radius, color, intensity = 1) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.4, color.replace('1)', `${0.5 * intensity})`).replace(')', `, ${0.5 * intensity})`));
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

// --- Input Manager ---
const Input = {
  keys: {},
  prevKeys: {},
  mouse: { x: 0, y: 0, worldX: 0, worldY: 0, down: false, clicked: false, rightDown: false, rightClicked: false },
  _clickedThisFrame: false,
  _rightClickedThisFrame: false,
  wheelDelta: 0,

  init(canvas) {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
      this.mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.down = true; this._clickedThisFrame = true; }
      if (e.button === 2) { this.mouse.rightDown = true; this._rightClickedThisFrame = true; }
    });
    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rightDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      this.wheelDelta += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
  },

  update() {
    this.mouse.clicked = this._clickedThisFrame;
    this.mouse.rightClicked = this._rightClickedThisFrame;
    this._clickedThisFrame = false;
    this._rightClickedThisFrame = false;
    // Update world coordinates
    this.mouse.worldX = this.mouse.x + Camera.x - Camera.canvasW / 2;
    this.mouse.worldY = this.mouse.y + Camera.y - Camera.canvasH / 2;
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

// --- Particle System ---
class Particle {
  constructor(x, y, vx, vy, life, size, color, opts = {}) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.size = size; this.startSize = size;
    this.color = color;
    this.friction = opts.friction || 0.98;
    this.gravity = opts.gravity || 0;
    this.shrink = opts.shrink !== false;
    this.glow = opts.glow || false;
    this.trail = opts.trail || false;
    this.prevX = x; this.prevY = y;
  }

  update(dt) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.shrink) {
      this.size = this.startSize * (this.life / this.maxLife);
    }
    return this.life > 0;
  }

  draw(ctx) {
    const alpha = clamp(this.life / this.maxLife, 0, 1);
    ctx.globalAlpha = alpha;

    if (this.trail) {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.prevX, this.prevY);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
    }

    if (this.glow) {
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0.5, this.size), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

const Particles = {
  list: [],

  emit(x, y, count, color, opts = {}) {
    const speed = opts.speed || 200;
    const life = opts.life || 0.5;
    const size = opts.size || 3;
    const spread = opts.spread || Math.PI * 2;
    const baseAngle = opts.angle || 0;

    for (let i = 0; i < count; i++) {
      const a = baseAngle + (Math.random() - 0.5) * spread;
      const s = speed * (0.3 + Math.random() * 0.7);
      const vx = Math.cos(a) * s;
      const vy = Math.sin(a) * s;
      const l = life * (0.5 + Math.random() * 0.5);
      const sz = size * (0.5 + Math.random() * 0.5);
      this.list.push(new Particle(x, y, vx, vy, l, sz, color, opts));
    }
  },

  burst(x, y, count, color, speed = 300) {
    this.emit(x, y, count, color, { speed, life: 0.6, size: 4, glow: true });
  },

  trail(x, y, color, size = 2) {
    this.list.push(new Particle(x, y, randRange(-20, 20), randRange(-20, 20), 0.3, size, color, { glow: true }));
  },

  update(dt) {
    this.list = this.list.filter(p => p.update(dt));
  },

  draw(ctx) {
    for (const p of this.list) p.draw(ctx);
  },

  clear() {
    this.list = [];
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
      this.slowMoTimer -= dt / this.slowMo; // real time
      if (this.slowMoTimer <= 0) this.slowMo = 1;
    }
    if (this.flashAlpha > 0) {
      this.flashAlpha -= dt * 3;
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

  drawFlash(ctx, w, h) {
    if (this.flashAlpha > 0) {
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  },
};

// --- Camera ---
const Camera = {
  x: 0, y: 0,
  targetX: 0, targetY: 0,
  canvasW: 1280, canvasH: 720,
  smoothing: 0.08,
  leadAmount: 60,

  follow(target, aimX, aimY) {
    // Lead camera toward aim direction
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

  // Tilt angle for 3/4 top-down perspective (0 = flat top-down, 0.4 = ~45deg)
  tilt: 0.35,

  apply(ctx) {
    const shake = Effects.getShakeOffset();
    ctx.save();
    // Move to center
    ctx.translate(this.canvasW / 2, this.canvasH / 2);
    // Apply perspective tilt: scale Y down + slight skew = isometric feel
    ctx.transform(1, 0, 0, 1 - this.tilt * 0.5, 0, 0); // compress Y
    // Camera offset
    ctx.translate(
      Math.floor(-this.x + shake.x),
      Math.floor(-this.y + shake.y)
    );
  },

  restore(ctx) {
    ctx.restore();
  },

  worldToScreen(wx, wy) {
    return {
      x: wx - this.x + this.canvasW / 2,
      y: wy - this.y + this.canvasH / 2,
    };
  },

  screenToWorld(sx, sy) {
    return {
      x: sx + this.x - this.canvasW / 2,
      y: sy + this.y - this.canvasH / 2,
    };
  },
};

// --- Image-to-ASCII Sprite System ---
const AsciiSprite = {
  _cache: {},
  _loading: {},
  // ASCII chars from dark to light
  CHARS: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  CHARS_SHORT: ' .:;+*#%@$',

  // Load an image and convert to ASCII sprite
  fromImage(name, src, opts = {}) {
    if (this._cache[name]) return Promise.resolve(this._cache[name]);
    if (this._loading[name]) return this._loading[name];

    this._loading[name] = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const sprite = this._convertToAscii(name, img, opts);
        resolve(sprite);
      };
      img.onerror = () => {
        console.warn(`Failed to load: ${src}`);
        // Fallback: create a simple placeholder
        this.create(name, ['[?]'], { fontSize: 10, color: '#f44' });
        resolve(this._cache[name]);
      };
      img.src = src;
    });
    return this._loading[name];
  },

  // Load a spritesheet and split into individual ASCII frames
  // Returns array of sprite names: [name_0, name_1, ..., name_N]
  fromSpritesheet(baseName, src, opts = {}) {
    const cols = opts.cols || 5;
    const rows = opts.rows || 5;
    const totalFrames = opts.frames || (cols * rows);
    const key = `sheet_${baseName}`;
    if (this._loading[key]) return this._loading[key];

    this._loading[key] = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const frameW = img.width / cols;
        const frameH = img.height / rows;
        const names = [];
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = frameW; frameCanvas.height = frameH;
        const fctx = frameCanvas.getContext('2d');

        for (let i = 0; i < totalFrames; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          fctx.clearRect(0, 0, frameW, frameH);
          fctx.drawImage(img, col * frameW, row * frameH, frameW, frameH, 0, 0, frameW, frameH);

          // Check if frame is empty (all transparent/white)
          const checkData = fctx.getImageData(0, 0, frameW, frameH).data;
          let hasContent = false;
          for (let p = 0; p < checkData.length; p += 16) { // sample every 4th pixel
            const r = checkData[p], g = checkData[p+1], b = checkData[p+2], a = checkData[p+3];
            if (a > 50 && !(r > 225 && g > 225 && b > 225)) { hasContent = true; break; }
          }
          if (!hasContent) continue; // skip empty frames

          // Create a temp image from this frame
          const frameName = `${baseName}_${names.length}`;
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = frameW; tempCanvas.height = frameH;
          tempCanvas.getContext('2d').drawImage(frameCanvas, 0, 0);
          // Convert via a temp Image-like object (canvas works as image source)
          this._convertToAscii(frameName, tempCanvas, opts);
          names.push(frameName);
        }
        console.log(`Spritesheet ${baseName}: ${names.length} frames from ${totalFrames} slots`);
        resolve(names);
      };
      img.onerror = () => { console.warn(`Failed to load sheet: ${src}`); resolve([]); };
      img.src = src;
    });
    return this._loading[key];
  },

  _convertToAscii(name, img, opts = {}) {
    const targetW = opts.width || 60;       // ASCII columns
    const charRatio = 0.55;                 // chars are taller than wide
    const targetH = Math.round(targetW * (img.height / img.width) * charRatio);
    const fontSize = opts.fontSize || 5;
    const colored = opts.colored !== false;  // color by default
    const brighten = opts.brighten || 1.0;  // boost dark colors for dark backgrounds
    const chars = opts.dense ? this.CHARS : this.CHARS_SHORT;

    // Sample image pixels
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = targetW; sampleCanvas.height = targetH;
    const sctx = sampleCanvas.getContext('2d');
    sctx.drawImage(img, 0, 0, targetW, targetH);
    const data = sctx.getImageData(0, 0, targetW, targetH).data;

    // Measure char dimensions
    const font = `${fontSize}px monospace`;
    const mctx = document.createElement('canvas').getContext('2d');
    mctx.font = font;
    const charW = mctx.measureText('M').width;
    const lineH = fontSize * 1.15;

    // Render ASCII to offscreen canvas
    const w = Math.ceil(targetW * charW) + 4;
    const h = Math.ceil(targetH * lineH) + 4;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.font = font;
    ctx.textBaseline = 'top';

    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        const i = (y * targetW + x) * 4;
        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];

        // Skip transparent pixels
        if (a < 50) continue;

        // Auto-remove white/gray background (image has no real alpha)
        const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
        const spread = maxC - minC; // color spread: 0 = pure gray

        if (opts.softBg) {
          // Keep slightly off-white pixels (pillow etc) but remove pure gray/white bg
          // Only skip if VERY uniform gray AND very bright (pure background)
          if (spread < 8 && brightness > 0.95) continue;
          if (a < 80) continue;
        } else if (opts.strictBg) {
          // Strict background removal — only skip very bright + very gray
          if (spread < 10 && brightness > 0.92) continue;
          if (r > 245 && g > 245 && b > 245) continue;
        } else {
          // Default: remove gray bg + near-white
          const grayBrightThresh = opts.grayThreshold || 0.82;
          if (spread < 20 && brightness > grayBrightThresh) continue;
          if (r > 225 && g > 225 && b > 225) continue;
        }

        const charIdx = Math.floor((1 - brightness) * (chars.length - 1));
        const ch = chars[clamp(charIdx, 0, chars.length - 1)];
        if (ch === ' ') continue;

        if (colored) {
          const br = Math.min(255, Math.round(r * brighten));
          const bg = Math.min(255, Math.round(g * brighten));
          const bb = Math.min(255, Math.round(b * brighten));
          ctx.fillStyle = `rgb(${br},${bg},${bb})`;
        } else {
          const v = Math.min(255, Math.round(brightness * 255 * brighten));
          ctx.fillStyle = `rgb(${v},${v},${v})`;
        }
        ctx.fillText(ch, 2 + x * charW, 2 + y * lineH);
      }
    }

    this._cache[name] = { canvas, w, h, cx: w / 2, cy: h / 2, srcImg: img };
    return this._cache[name];
  },

  // Create from raw ASCII lines (keep for fallback)
  create(name, lines, opts = {}) {
    const fontSize = opts.fontSize || 7;
    const color = opts.color || '#222';
    const font = `${fontSize}px monospace`;
    const mctx = document.createElement('canvas').getContext('2d');
    mctx.font = font;
    const charW = mctx.measureText('M').width;
    const lineH = fontSize * 1.15;
    const maxCols = Math.max(...lines.map(l => l.length));
    const w = Math.ceil(maxCols * charW) + 4;
    const h = Math.ceil(lines.length * lineH) + 4;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = 'top';
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], 2, 2 + i * lineH);
    this._cache[name] = { canvas, w, h, cx: w / 2, cy: h / 2 };
    return this._cache[name];
  },

  // Create a horizontally flipped version of an existing sprite
  createFlipped(newName, sourceName) {
    const src = this._cache[sourceName];
    if (!src) return null;
    const canvas = document.createElement('canvas');
    canvas.width = src.w; canvas.height = src.h;
    const ctx = canvas.getContext('2d');
    ctx.translate(src.w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src.canvas, 0, 0);
    this._cache[newName] = { canvas, w: src.w, h: src.h, cx: src.cx, cy: src.cy };
    return this._cache[newName];
  },

  draw(ctx, name, x, y, opts = {}) {
    const sprite = this._cache[name];
    if (!sprite) return;
    const scale = opts.scale || 1;
    const angle = opts.angle || 0;
    const alpha = opts.alpha || 1;
    const flipX = opts.flipX || false;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle);
    if (flipX) ctx.scale(-1, 1);
    ctx.scale(scale, scale);
    ctx.drawImage(sprite.canvas, -sprite.cx, -sprite.cy);
    ctx.restore();
  },

  get(name) { return this._cache[name]; },
  has(name) { return !!this._cache[name]; },
};

// --- Pre-build player ASCII sprites ---
async function initAsciiSprites() {
  const basePath = 'assets/player/';
  const spriteOpts = { width: 70, fontSize: 5, colored: true, dense: true, brighten: 1.6, cols: 5, rows: 5, frames: 25 };

  // Load 4 spritesheets: idle, run, attack (boxing), gun (sniper)
  const [idleFrames, runFrames, attackFrames, gunFrames, hookFrames, dartsFrames, katanaFrames] = await Promise.all([
    AsciiSprite.fromSpritesheet('player_idle', basePath + 'Player-idle.png', spriteOpts),
    AsciiSprite.fromSpritesheet('player_run', basePath + 'Player-run.png', spriteOpts),
    AsciiSprite.fromSpritesheet('player_attack', basePath + 'Player-attack.png', spriteOpts),
    AsciiSprite.fromSpritesheet('player_gun', basePath + 'gun.png', spriteOpts),
    AsciiSprite.fromSpritesheet('player_hook', basePath + 'hook.png', spriteOpts),
    AsciiSprite.fromSpritesheet('player_darts', basePath + 'darts.png', spriteOpts),
    AsciiSprite.fromSpritesheet('player_katana', basePath + 'katana.png', spriteOpts),
  ]);

  // Store frame lists for animation system
  AsciiSprite._anims = {
    idle: idleFrames || [],
    run: runFrames || [],
    attack: attackFrames || [],
    gun: gunFrames || [],
    hook: hookFrames || [],
    darts: dartsFrames || [],
    katana: katanaFrames || [],
  };

  // Set up legacy names used by player draw code
  if (idleFrames.length > 0) {
    AsciiSprite._cache['player_idle'] = AsciiSprite._cache[idleFrames[0]];
  }
  if (runFrames.length > 0) {
    AsciiSprite._cache['player_walk1'] = AsciiSprite._cache[runFrames[0]];
    AsciiSprite._cache['player_walk2'] = AsciiSprite._cache[runFrames[Math.min(1, runFrames.length - 1)]];
  }
  if (!AsciiSprite.has('player_dash')) {
    AsciiSprite._cache['player_dash'] = AsciiSprite._cache['player_idle'];
  }

  console.log(`Sprites loaded! idle:${idleFrames.length} run:${runFrames.length} attack:${attackFrames.length}`);

  // --- Generate procedural enemy ASCII sprites ---
  await loadMonsterSprites();
}

// =============================================================
// Procedural Enemy Shape → ASCII Sprite Generator
// Uses pretext-style brightness+width dual matching
// =============================================================
const EnemyArt = {
  // Character palette sorted by brightness (built once)
  _palette: null,
  _font: '5px monospace',

  buildPalette() {
    if (this._palette) return;
    const chars = ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$';
    const entries = [];
    const c = document.createElement('canvas');
    c.width = 28; c.height = 28;
    const ctx = c.getContext('2d');
    const mctx = document.createElement('canvas').getContext('2d');
    mctx.font = this._font;

    for (const ch of chars) {
      // Measure brightness: render char, sum alpha
      ctx.clearRect(0, 0, 28, 28);
      ctx.fillStyle = '#fff'; ctx.font = '20px monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      ctx.fillText(ch, 14, 14);
      const data = ctx.getImageData(0, 0, 28, 28).data;
      let alphaSum = 0;
      for (let i = 3; i < data.length; i += 4) alphaSum += data[i];
      const brightness = alphaSum / (255 * 784);
      // Measure width
      const width = mctx.measureText(ch).width;
      entries.push({ ch, brightness, width });
    }
    this._palette = entries.sort((a, b) => a.brightness - b.brightness);
  },

  // Find best character for target brightness+width (pretext algorithm)
  findBest(targetBrightness, targetWidth) {
    const p = this._palette;
    if (!p || p.length === 0) return ' ';
    // Binary search
    let lo = 0, hi = p.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (p[mid].brightness < targetBrightness) lo = mid + 1;
      else hi = mid;
    }
    // Score nearby ±15
    let best = p[lo], bestErr = Infinity;
    for (let i = Math.max(0, lo - 15); i < Math.min(p.length, lo + 15); i++) {
      const e = p[i];
      const err = Math.abs(e.brightness - targetBrightness) * 2.5
                + (targetWidth > 0 ? Math.abs(e.width - targetWidth) / targetWidth : 0);
      if (err < bestErr) { bestErr = err; best = e; }
    }
    return best.ch;
  },

  // Draw a shape to a temp canvas, then convert to ASCII sprite
  shapeToAscii(name, drawFn, size, color, asciiW) {
    this.buildPalette();
    asciiW = asciiW || 30;
    const charRatio = 0.55;
    const asciiH = Math.round(asciiW * charRatio);

    // Draw shape to temp canvas
    const shapeCanvas = document.createElement('canvas');
    shapeCanvas.width = size; shapeCanvas.height = size;
    const sctx = shapeCanvas.getContext('2d');
    drawFn(sctx, size);

    // Sample and convert
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = asciiW; sampleCanvas.height = asciiH;
    const sampCtx = sampleCanvas.getContext('2d');
    sampCtx.drawImage(shapeCanvas, 0, 0, asciiW, asciiH);
    const data = sampCtx.getImageData(0, 0, asciiW, asciiH).data;

    // Render ASCII
    const fontSize = 5;
    const font = `${fontSize}px monospace`;
    const mctx = document.createElement('canvas').getContext('2d');
    mctx.font = font;
    const charW = mctx.measureText('M').width;
    const lineH = fontSize * 1.15;
    const w = Math.ceil(asciiW * charW) + 4;
    const h = Math.ceil(asciiH * lineH) + 4;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = w; outCanvas.height = h;
    const ctx = outCanvas.getContext('2d');
    ctx.font = font; ctx.textBaseline = 'top';

    // Parse color
    const rgb = hexToRgb(color) || { r: 11, g: 20, b: 26 };

    for (let y = 0; y < asciiH; y++) {
      for (let x = 0; x < asciiW; x++) {
        const i = (y * asciiW + x) * 4;
        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
        if (a < 30) continue;
        const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        if (brightness > 0.95 && a < 200) continue;

        const ch = this.findBest(1 - brightness * (a / 255), charW);
        if (ch === ' ') continue;

        // Tint with enemy color, modulated by brightness
        const br = Math.min(255, Math.round(rgb.r + (255 - rgb.r) * brightness * 0.3));
        const bg = Math.min(255, Math.round(rgb.g + (255 - rgb.g) * brightness * 0.3));
        const bb = Math.min(255, Math.round(rgb.b + (255 - rgb.b) * brightness * 0.3));
        ctx.fillStyle = `rgba(${br},${bg},${bb},${a / 255})`;
        ctx.fillText(ch, 2 + x * charW, 2 + y * lineH);
      }
    }

    AsciiSprite._cache[name] = { canvas: outCanvas, w, h, cx: w / 2, cy: h / 2 };
    return name;
  },
};

// ============================================================
// Load monster sprites from image files
// ============================================================
async function loadMonsterSprites() {
  const monsterPath = 'assets/monster/';
  const monsterOpts = { width: 35, fontSize: 5, colored: true, dense: true, brighten: 1.4 };
  const bossOpts = { width: 50, fontSize: 5, colored: true, dense: true, brighten: 1.4 };

  // Map: sprite name used in code → file path
  const monsters = {
    'enemy_high_heel':    { src: monsterPath + 'L1enemy_heel.png', opts: monsterOpts },
    'enemy_leather_shoe': { src: monsterPath + 'L1enemy_leather.png', opts: monsterOpts },
    'enemy_mirror':       { src: monsterPath + 'L1boss_mirror.png', opts: bossOpts },
    'enemy_spider':       { src: monsterPath + 'L2enemy_spider.png', opts: monsterOpts },
    'enemy_giant_spider': { src: monsterPath + 'L2boss_spider.png', opts: bossOpts },
    'enemy_water':        { src: monsterPath + 'L3enemy_water.png', opts: monsterOpts },
    'enemy_pillow':       { src: monsterPath + 'L3boss_pillow.png', opts: { ...bossOpts, softBg: true, brighten: 1.0 } },
    'enemy_bat':          { src: monsterPath + 'L4enemy_bat.png', opts: { ...monsterOpts, grayThreshold: 0.35 } },
    'enemy_paper_tiger':  { src: monsterPath + 'L4boss_tiger.png', opts: bossOpts },
    'enemy_scarecrow':    { src: monsterPath + 'L6enemy_scarecrow.png', opts: monsterOpts },
  };

  // Also load memory card diamond
  monsters['memory_diamond'] = { src: monsterPath + 'diamond_blue.png', opts: { width: 20, fontSize: 5, colored: true, dense: true, brighten: 0.7 } };

  const promises = Object.entries(monsters).map(([name, { src, opts }]) =>
    AsciiSprite.fromImage(name, src, opts)
  );
  await Promise.all(promises);
  console.log(`Monster sprites loaded! (${Object.keys(monsters).length} types)`);
}

// ============================================================
// Legacy procedural enemy art (kept as fallback)
// ============================================================
function generateEnemySprites() {
  EnemyArt.buildPalette();
  const S = 128; // source canvas size

  // --- HIGH HEEL SHOE (L1) ---
  EnemyArt.shapeToAscii('enemy_high_heel', (ctx, s) => {
    ctx.fillStyle = '#1a1a2e'; ctx.strokeStyle = '#0b141a'; ctx.lineWidth = 3;
    ctx.beginPath();
    // Heel
    ctx.moveTo(s*0.2, s*0.3); ctx.lineTo(s*0.75, s*0.35);
    ctx.lineTo(s*0.8, s*0.5); ctx.lineTo(s*0.75, s*0.55);
    // Sole
    ctx.lineTo(s*0.3, s*0.55); ctx.lineTo(s*0.25, s*0.85);
    ctx.lineTo(s*0.18, s*0.85); ctx.lineTo(s*0.15, s*0.55);
    ctx.lineTo(s*0.1, s*0.5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Heel spike
    ctx.fillStyle = '#c44'; ctx.beginPath();
    ctx.moveTo(s*0.2, s*0.55); ctx.lineTo(s*0.23, s*0.9);
    ctx.lineTo(s*0.17, s*0.9); ctx.closePath(); ctx.fill();
    // Toe detail
    ctx.strokeStyle = '#334'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(s*0.65, s*0.42, s*0.08, 0, Math.PI); ctx.stroke();
  }, S, '#1a1a2e', 28);

  // --- LEATHER SHOE (L1) ---
  EnemyArt.shapeToAscii('enemy_leather_shoe', (ctx, s) => {
    ctx.fillStyle = '#2a1a0a'; ctx.strokeStyle = '#0b141a'; ctx.lineWidth = 3;
    // Rounded shoe from above
    ctx.beginPath();
    ctx.ellipse(s*0.5, s*0.45, s*0.35, s*0.2, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Sole
    ctx.fillStyle = '#1a0a00';
    ctx.beginPath();
    ctx.ellipse(s*0.5, s*0.5, s*0.33, s*0.15, 0, 0, Math.PI);
    ctx.fill();
    // Lace detail
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const lx = s*0.35 + i * s*0.08;
      ctx.beginPath(); ctx.moveTo(lx, s*0.38); ctx.lineTo(lx + s*0.04, s*0.32); ctx.stroke();
    }
  }, S, '#2a1a0a', 28);

  // --- MIRROR BOSS (L1) ---
  EnemyArt.shapeToAscii('enemy_mirror', (ctx, s) => {
    // Ornate frame
    ctx.strokeStyle = '#8a7030'; ctx.lineWidth = 5;
    ctx.fillStyle = '#c0d8e8';
    const rx = s*0.15, ry = s*0.1, rw = s*0.7, rh = s*0.8;
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, 12);
    ctx.fill(); ctx.stroke();
    // Reflection shimmer
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.moveTo(s*0.25, s*0.15); ctx.lineTo(s*0.45, s*0.15);
    ctx.lineTo(s*0.3, s*0.75); ctx.lineTo(s*0.2, s*0.75); ctx.closePath(); ctx.fill();
    // Crack lines
    ctx.strokeStyle = '#556'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(s*0.5, s*0.3); ctx.lineTo(s*0.6, s*0.5);
    ctx.lineTo(s*0.45, s*0.65); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s*0.5, s*0.3); ctx.lineTo(s*0.35, s*0.55); ctx.stroke();
  }, S, '#4a6080', 35);

  // --- SPIDER (L2) ---
  EnemyArt.shapeToAscii('enemy_spider', (ctx, s) => {
    const cx = s*0.5, cy = s*0.5;
    ctx.fillStyle = '#1a1a1a'; ctx.strokeStyle = '#0b0b0b'; ctx.lineWidth = 2;
    // Body
    ctx.beginPath(); ctx.ellipse(cx, cy, s*0.12, s*0.1, 0, 0, Math.PI*2); ctx.fill();
    // Head
    ctx.beginPath(); ctx.arc(cx, cy - s*0.15, s*0.07, 0, Math.PI*2); ctx.fill();
    // 8 legs
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 4; i++) {
      const angle = (i - 1.5) * 0.4;
      // Left
      ctx.beginPath();
      ctx.moveTo(cx - s*0.1, cy + (i-1.5)*s*0.06);
      ctx.quadraticCurveTo(cx - s*0.3, cy + (i-1.5)*s*0.1 - s*0.1, cx - s*0.35, cy + (i-1.5)*s*0.12 + s*0.05);
      ctx.stroke();
      // Right
      ctx.beginPath();
      ctx.moveTo(cx + s*0.1, cy + (i-1.5)*s*0.06);
      ctx.quadraticCurveTo(cx + s*0.3, cy + (i-1.5)*s*0.1 - s*0.1, cx + s*0.35, cy + (i-1.5)*s*0.12 + s*0.05);
      ctx.stroke();
    }
    // Eyes (red dots)
    ctx.fillStyle = '#c44';
    ctx.beginPath(); ctx.arc(cx - s*0.03, cy - s*0.16, s*0.02, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + s*0.03, cy - s*0.16, s*0.02, 0, Math.PI*2); ctx.fill();
  }, S, '#1a1a1a', 32);

  // --- GIANT SPIDER BOSS (L2) ---
  EnemyArt.shapeToAscii('enemy_spider_boss', (ctx, s) => {
    const cx = s*0.5, cy = s*0.5;
    ctx.fillStyle = '#0a0a0a'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
    // Fat abdomen
    ctx.beginPath(); ctx.ellipse(cx, cy + s*0.05, s*0.22, s*0.18, 0, 0, Math.PI*2); ctx.fill();
    // Thorax
    ctx.beginPath(); ctx.ellipse(cx, cy - s*0.15, s*0.14, s*0.12, 0, 0, Math.PI*2); ctx.fill();
    // Head
    ctx.beginPath(); ctx.arc(cx, cy - s*0.28, s*0.08, 0, Math.PI*2); ctx.fill();
    // 8 thick legs
    ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      const yo = (i - 1.5) * s*0.08;
      ctx.beginPath();
      ctx.moveTo(cx - s*0.18, cy + yo);
      ctx.quadraticCurveTo(cx - s*0.38, cy + yo - s*0.12, cx - s*0.42, cy + yo + s*0.08);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + s*0.18, cy + yo);
      ctx.quadraticCurveTo(cx + s*0.38, cy + yo - s*0.12, cx + s*0.42, cy + yo + s*0.08);
      ctx.stroke();
    }
    // Red eyes
    ctx.fillStyle = '#f33';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.arc(cx + i * s*0.04, cy - s*0.3, s*0.025, 0, Math.PI*2); ctx.fill();
    }
    // Fangs
    ctx.strokeStyle = '#c44'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - s*0.04, cy - s*0.22); ctx.lineTo(cx - s*0.06, cy - s*0.16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + s*0.04, cy - s*0.22); ctx.lineTo(cx + s*0.06, cy - s*0.16); ctx.stroke();
  }, S, '#0a0a0a', 40);

  // --- WATER FLOW (L3) ---
  EnemyArt.shapeToAscii('enemy_water', (ctx, s) => {
    ctx.fillStyle = '#2060a0';
    // Wavy water shape
    ctx.beginPath(); ctx.moveTo(s*0.15, s*0.35);
    ctx.bezierCurveTo(s*0.3, s*0.2, s*0.5, s*0.2, s*0.7, s*0.35);
    ctx.bezierCurveTo(s*0.85, s*0.45, s*0.8, s*0.6, s*0.7, s*0.65);
    ctx.bezierCurveTo(s*0.5, s*0.75, s*0.3, s*0.7, s*0.2, s*0.6);
    ctx.bezierCurveTo(s*0.1, s*0.5, s*0.1, s*0.4, s*0.15, s*0.35);
    ctx.fill();
    // Wave lines
    ctx.strokeStyle = '#4080c0'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const y = s*0.38 + i * s*0.1;
      ctx.beginPath();
      ctx.moveTo(s*0.25, y);
      ctx.quadraticCurveTo(s*0.4, y - s*0.05, s*0.55, y);
      ctx.quadraticCurveTo(s*0.65, y + s*0.05, s*0.75, y);
      ctx.stroke();
    }
    // Drips
    ctx.fillStyle = '#3070b0';
    ctx.beginPath(); ctx.ellipse(s*0.35, s*0.72, s*0.03, s*0.05, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s*0.6, s*0.7, s*0.025, s*0.04, 0, 0, Math.PI*2); ctx.fill();
  }, S, '#2060a0', 26);

  // --- PILLOW BOSS (L3) ---
  EnemyArt.shapeToAscii('enemy_pillow', (ctx, s) => {
    // Soft pillow shape
    ctx.fillStyle = '#d0c0b0'; ctx.strokeStyle = '#a09080'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s*0.15, s*0.3);
    ctx.quadraticCurveTo(s*0.5, s*0.1, s*0.85, s*0.3);
    ctx.quadraticCurveTo(s*0.95, s*0.5, s*0.85, s*0.7);
    ctx.quadraticCurveTo(s*0.5, s*0.9, s*0.15, s*0.7);
    ctx.quadraticCurveTo(s*0.05, s*0.5, s*0.15, s*0.3);
    ctx.fill(); ctx.stroke();
    // Puffy wrinkles
    ctx.strokeStyle = '#b0a090'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(s*0.3, s*0.35); ctx.quadraticCurveTo(s*0.5, s*0.45, s*0.7, s*0.35); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s*0.3, s*0.65); ctx.quadraticCurveTo(s*0.5, s*0.55, s*0.7, s*0.65); ctx.stroke();
    // Sleepy eyes
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s*0.38, s*0.48, s*0.04, 0, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(s*0.62, s*0.48, s*0.04, 0, Math.PI); ctx.stroke();
  }, S, '#b0a090', 38);

  // --- BAT (L4) ---
  EnemyArt.shapeToAscii('enemy_bat', (ctx, s) => {
    ctx.fillStyle = '#4a2060'; ctx.strokeStyle = '#3a1050'; ctx.lineWidth = 2;
    const cx = s*0.5, cy = s*0.45;
    // Body
    ctx.beginPath(); ctx.ellipse(cx, cy, s*0.08, s*0.12, 0, 0, Math.PI*2); ctx.fill();
    // Left wing
    ctx.beginPath();
    ctx.moveTo(cx - s*0.06, cy - s*0.05);
    ctx.quadraticCurveTo(cx - s*0.35, cy - s*0.3, cx - s*0.42, cy - s*0.1);
    ctx.quadraticCurveTo(cx - s*0.3, cy, cx - s*0.2, cy + s*0.05);
    ctx.lineTo(cx - s*0.1, cy + s*0.02);
    ctx.fill(); ctx.stroke();
    // Right wing
    ctx.beginPath();
    ctx.moveTo(cx + s*0.06, cy - s*0.05);
    ctx.quadraticCurveTo(cx + s*0.35, cy - s*0.3, cx + s*0.42, cy - s*0.1);
    ctx.quadraticCurveTo(cx + s*0.3, cy, cx + s*0.2, cy + s*0.05);
    ctx.lineTo(cx + s*0.1, cy + s*0.02);
    ctx.fill(); ctx.stroke();
    // Ears
    ctx.beginPath();
    ctx.moveTo(cx - s*0.05, cy - s*0.1); ctx.lineTo(cx - s*0.08, cy - s*0.2); ctx.lineTo(cx - s*0.02, cy - s*0.12); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + s*0.05, cy - s*0.1); ctx.lineTo(cx + s*0.08, cy - s*0.2); ctx.lineTo(cx + s*0.02, cy - s*0.12); ctx.fill();
    // Eyes
    ctx.fillStyle = '#f80';
    ctx.beginPath(); ctx.arc(cx - s*0.03, cy - s*0.06, s*0.015, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + s*0.03, cy - s*0.06, s*0.015, 0, Math.PI*2); ctx.fill();
  }, S, '#4a2060', 30);

  // --- PAPER TIGER BOSS (L4) ---
  EnemyArt.shapeToAscii('enemy_tiger', (ctx, s) => {
    ctx.fillStyle = '#d4a040'; ctx.strokeStyle = '#0b141a'; ctx.lineWidth = 2;
    // Head
    ctx.beginPath(); ctx.arc(s*0.5, s*0.3, s*0.18, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    // Ears
    ctx.beginPath();
    ctx.moveTo(s*0.35, s*0.18); ctx.lineTo(s*0.3, s*0.05); ctx.lineTo(s*0.42, s*0.15); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s*0.65, s*0.18); ctx.lineTo(s*0.7, s*0.05); ctx.lineTo(s*0.58, s*0.15); ctx.fill(); ctx.stroke();
    // Body
    ctx.beginPath(); ctx.ellipse(s*0.5, s*0.6, s*0.22, s*0.2, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    // Stripes
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 4; i++) {
      const x = s*0.35 + i * s*0.08;
      ctx.beginPath(); ctx.moveTo(x, s*0.5); ctx.lineTo(x + s*0.02, s*0.7); ctx.stroke();
    }
    // Face
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(s*0.43, s*0.28, s*0.035, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(s*0.57, s*0.28, s*0.035, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#0b141a';
    ctx.beginPath(); ctx.arc(s*0.43, s*0.28, s*0.02, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(s*0.57, s*0.28, s*0.02, 0, Math.PI*2); ctx.fill();
    // Nose
    ctx.fillStyle = '#c44'; ctx.beginPath();
    ctx.moveTo(s*0.48, s*0.34); ctx.lineTo(s*0.52, s*0.34); ctx.lineTo(s*0.5, s*0.37); ctx.fill();
    // Paper fold lines (it's made of paper!)
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(s*0.2, s*0.4); ctx.lineTo(s*0.8, s*0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s*0.5, s*0.1); ctx.lineTo(s*0.5, s*0.8); ctx.stroke();
    ctx.setLineDash([]);
  }, S, '#b08030', 36);

  // --- SCARECROW (L6) ---
  EnemyArt.shapeToAscii('enemy_scarecrow', (ctx, s) => {
    ctx.fillStyle = '#8a7030'; ctx.strokeStyle = '#5a4020'; ctx.lineWidth = 2;
    // Stick body (cross shape from top)
    ctx.fillStyle = '#6a5020';
    ctx.fillRect(s*0.47, s*0.2, s*0.06, s*0.6); // vertical
    ctx.fillRect(s*0.25, s*0.3, s*0.5, s*0.06); // horizontal
    // Head (burlap sack)
    ctx.fillStyle = '#c0a060';
    ctx.beginPath(); ctx.arc(s*0.5, s*0.18, s*0.1, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    // Hat
    ctx.fillStyle = '#5a4020';
    ctx.fillRect(s*0.35, s*0.06, s*0.3, s*0.05);
    ctx.fillRect(s*0.4, s*0.0, s*0.2, s*0.07);
    // Face
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(s*0.46, s*0.17, s*0.015, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(s*0.54, s*0.17, s*0.015, 0, Math.PI*2); ctx.fill();
    // Stitched mouth
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(s*0.44, s*0.22); ctx.lineTo(s*0.56, s*0.22); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const x = s*0.45 + i * s*0.035;
      ctx.beginPath(); ctx.moveTo(x, s*0.215); ctx.lineTo(x, s*0.225); ctx.stroke();
    }
    // Straw tufts
    ctx.strokeStyle = '#d0b050'; ctx.lineWidth = 1;
    for (let a = -0.5; a <= 0.5; a += 0.25) {
      ctx.beginPath(); ctx.moveTo(s*0.25, s*0.33); ctx.lineTo(s*0.15, s*0.33 + a * s*0.15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s*0.75, s*0.33); ctx.lineTo(s*0.85, s*0.33 + a * s*0.15); ctx.stroke();
    }
  }, S, '#8a6020', 28);

  console.log('Enemy ASCII sprites generated!');
}

