// ============================================================
// story.js — Level data, Cutscenes, Fusion, Choice (Rewrite)
// ============================================================

// --- Cutscene System (Scrolling + Hold-to-Skip) ---
class Cutscene {
  constructor(pages, style = {}) {
    this.pages = pages;
    this.done = false;
    this.fadeIn = 1.0; this.fadeOut = 0;
    this.time = 0;
    this.style = { bgColor: 'rgba(238,244,255,0.97)', textColor: Theme.primary, accentColor: style.accentColor || Theme.accent, fontSize: 20, ...style };

    // Build all lines from all pages into one continuous scroll
    this.allLines = []; // { text, isTitle, delay }
    let cumDelay = 0;
    const lineInterval = 0.8; // seconds between lines appearing
    const pageGap = 1.5; // extra gap between pages
    for (const page of pages) {
      if (page.title) {
        this.allLines.push({ text: page.title, isTitle: true, appearAt: cumDelay });
        cumDelay += lineInterval * 1.5;
      }
      const textLines = page.text.split('\n');
      for (const line of textLines) {
        if (line.trim() === '') {
          cumDelay += lineInterval * 0.4; // small gap for empty lines
        } else {
          this.allLines.push({ text: line, isTitle: false, appearAt: cumDelay });
          cumDelay += lineInterval;
        }
      }
      cumDelay += pageGap;
    }
    this.totalDuration = cumDelay + 3; // extra time at end
    this.scrollY = 0; // current scroll offset
    this.scrollSpeed = 28; // pixels per second auto-scroll

    // Hold-to-skip
    this.holdTimer = 0;
    this.holdDuration = 1.5; // seconds to hold for skip
    this.holding = false;

    // Background
    this.bgShapes = [];
    for (let i = 0; i < 12; i++) this.bgShapes.push({
      x: randRange(0, 1280), y: randRange(0, 720), vx: randRange(-12, 12), vy: randRange(-12, 12),
      size: randRange(20, 70), rotation: randAngle(), rotSpeed: randRange(-0.4, 0.4),
      sides: randInt(3, 6), hue: randRange(180, 300), alpha: randRange(0.02, 0.06),
    });
    this.bgParticles = [];
    for (let i = 0; i < 30; i++) this.bgParticles.push({
      x: randRange(0, 1280), y: randRange(0, 720), vx: randRange(-4, 4), vy: randRange(-15, -3),
      size: randRange(1, 2.5), alpha: randRange(0.1, 0.35), hue: randRange(180, 280),
    });
  }

  update(dt) {
    this.time += dt;
    if (this.fadeIn > 0) { this.fadeIn -= dt * 2; return; }
    if (this.fadeOut > 0) { this.fadeOut -= dt * 2; if (this.fadeOut <= 0) this.done = true; return; }

    // Hold-to-skip (mouse or space)
    if (Input.mouse.down || Input.isDown('Space')) {
      this.holding = true;
      this.holdTimer += dt;
      if (this.holdTimer >= this.holdDuration) {
        this.fadeOut = 1.0; // trigger skip
        Audio.menuSelect();
      }
    } else {
      this.holding = false;
      this.holdTimer = Math.max(0, this.holdTimer - dt * 2); // decay
    }

    // Auto-scroll
    this.scrollY += this.scrollSpeed * dt;

    // Mouse wheel to scroll faster (down = forward, up = backward)
    if (Input.wheelDelta !== 0) {
      this.scrollY += Input.wheelDelta * 60; // 60px per scroll tick
      this.scrollY = Math.max(0, this.scrollY); // don't scroll above start
    }

    // Click/Enter to speed up scroll
    if (Input.justPressed('Enter') || Input.mouse.clicked) {
      this.scrollY += 80;
    }

    // Check if scroll is past all content
    if (this.time > this.totalDuration) {
      this.fadeOut = 1.0;
    }

    // Background animation
    for (const s of this.bgShapes) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.rotation += s.rotSpeed * dt;
      if (s.x < -80) s.x = 1360; if (s.x > 1360) s.x = -80;
      if (s.y < -80) s.y = 800; if (s.y > 800) s.y = -80;
    }
    for (const p of this.bgParticles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y < -5) { p.y = 725; p.x = randRange(0, 1280); }
    }
  }

  draw(ctx, w, h) {
    ctx.fillStyle = this.style.bgColor; ctx.fillRect(0, 0, w, h);

    // Background shapes
    for (const s of this.bgShapes) {
      ctx.globalAlpha = s.alpha; ctx.strokeStyle = hsl(s.hue, 70, 50); ctx.lineWidth = 1;
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rotation);
      ctx.beginPath();
      for (let i = 0; i < s.sides; i++) { const a = (Math.PI * 2 / s.sides) * i;
        if (i === 0) ctx.moveTo(Math.cos(a) * s.size, Math.sin(a) * s.size);
        else ctx.lineTo(Math.cos(a) * s.size, Math.sin(a) * s.size); }
      ctx.closePath(); ctx.stroke(); ctx.restore();
    }
    for (const p of this.bgParticles) {
      ctx.globalAlpha = p.alpha; ctx.fillStyle = hsl(p.hue, 80, 60);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Scrolling text
    const lineH = 40; // spacing between lines
    const titleLineH = 60;
    const centerX = w / 2;
    const startRenderY = h * 0.55; // lines start appearing from this Y position
    const fadeZoneTop = h * 0.15; // lines fade out above this
    const fadeZoneBottom = h * 0.85; // lines fade in below this

    let yPos = startRenderY;
    for (const line of this.allLines) {
      // Calculate where this line currently is
      const lineAppearOffset = line.appearAt * this.scrollSpeed;
      const screenY = yPos - this.scrollY + lineAppearOffset;

      // Only render if on screen
      if (screenY > -50 && screenY < h + 50) {
        // Fade based on position
        let alpha = 1;
        if (screenY < fadeZoneTop) {
          alpha = Math.max(0, screenY / fadeZoneTop);
        } else if (screenY > fadeZoneBottom) {
          alpha = Math.max(0, 1 - (screenY - fadeZoneBottom) / (h - fadeZoneBottom));
        }
        // Also fade if line hasn't appeared yet (based on time)
        const timeSinceAppear = this.time - (this.fadeIn > 0 ? 99 : 0) - line.appearAt;
        if (timeSinceAppear < 0) continue; // not yet
        if (timeSinceAppear < 0.5) alpha *= timeSinceAppear / 0.5; // fade in

        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';

        if (line.isTitle) {
          ctx.fillStyle = this.style.accentColor;
          ctx.font = `42px ${Theme.fontTitle}`;
          ctx.fillText(line.text, centerX, screenY);
          yPos += titleLineH;
        } else {
          ctx.fillStyle = this.style.textColor;
          ctx.font = `${this.style.fontSize}px ${Theme.fontUI}`;
          // Word wrap
          const wrappedLines = this._wrapText(ctx, line.text, w * 0.65);
          for (const wl of wrappedLines) {
            const wlY = screenY + (wrappedLines.indexOf(wl)) * (this.style.fontSize * 1.5);
            if (wlY > -50 && wlY < h + 50) {
              ctx.fillText(wl, centerX, wlY);
            }
          }
          yPos += lineH * Math.max(1, wrappedLines.length * 0.8);
        }
      } else {
        yPos += line.isTitle ? titleLineH : lineH;
      }
    }
    ctx.globalAlpha = 1;

    // Hold-to-skip circle indicator (bottom right)
    if (this.holdTimer > 0) {
      const cx = w - 50, cy = h - 50, r = 18;
      const pct = clamp(this.holdTimer / this.holdDuration, 0, 1);

      // Background circle
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = Theme.secondary; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

      // Progress arc
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = Theme.accent; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();

      // Center text
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = Theme.secondary; ctx.font = `11px ${Theme.fontUI}`; ctx.textAlign = 'center';
      ctx.fillText('SKIP', cx, cy + 4);
      ctx.globalAlpha = 1;
    }

    // Hint text (bottom right, subtle)
    if (this.holdTimer === 0 && this.time > 2) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = Theme.textMuted; ctx.font = `11px ${Theme.fontUI}`; ctx.textAlign = 'right';
      ctx.fillText('hold to skip', w - 25, h - 20);
      ctx.globalAlpha = 1;
    }

    // Fades
    if (this.fadeIn > 0) { ctx.fillStyle = `rgba(238,244,255,${this.fadeIn})`; ctx.fillRect(0, 0, w, h); }
    if (this.fadeOut > 0) { ctx.fillStyle = `rgba(238,244,255,${1 - this.fadeOut})`; ctx.fillRect(0, 0, w, h); }
  }

  _wrapText(ctx, text, maxW) {
    const lines = []; let cur = '';
    for (const ch of text) {
      if (ch === '\n') { lines.push(cur); cur = ''; continue; }
      if (ctx.measureText(cur + ch).width > maxW && cur.length > 0) { lines.push(cur); cur = ch; }
      else cur += ch;
    }
    if (cur) lines.push(cur);
    return lines;
  }
}

// --- Choice Screen ---
class ChoiceScreen {
  constructor(title, description, option1, option2) {
    this.title = title; this.description = description;
    this.option1 = option1; this.option2 = option2;
    this.selected = -1; this.done = false;
    this.hovered = -1; this.time = 0; this.fadeIn = 1.0;
  }
  update(dt) {
    this.time += dt;
    if (this.fadeIn > 0) { this.fadeIn -= dt * 2; return; }
    // Hover detection
    const mx = Input.mouse.x, my = Input.mouse.y;
    const w = 1280, h = 720;
    const btn1 = { x: w * 0.25, y: h * 0.6, w: 220, h: 60 };
    const btn2 = { x: w * 0.75 - 220, y: h * 0.6, w: 220, h: 60 };
    this.hovered = -1;
    if (mx > btn1.x && mx < btn1.x + btn1.w && my > btn1.y && my < btn1.y + btn1.h) this.hovered = 0;
    if (mx > btn2.x && mx < btn2.x + btn2.w && my > btn2.y && my < btn2.y + btn2.h) this.hovered = 1;
    if (Input.mouse.clicked && this.hovered >= 0) {
      this.selected = this.hovered; this.done = true; Audio.menuSelect();
    }
  }
  draw(ctx, w, h) {
    ctx.fillStyle = Theme.bg; ctx.fillRect(0, 0, w, h);
    // Title
    ctx.fillStyle = Theme.primary; ctx.font = `36px ${Theme.fontTitle}`; ctx.textAlign = 'center';
    ctx.fillText(this.title, w / 2, h * 0.25);
    // Description
    ctx.fillStyle = Theme.secondary; ctx.font = `16px ${Theme.fontUI}`;
    const lines = this.description.split('\n');
    lines.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.35 + i * 28));
    // Buttons
    const btns = [
      { x: w * 0.25, y: h * 0.6, w: 220, h: 60, label: this.option1, color: Theme.accent },
      { x: w * 0.75 - 220, y: h * 0.6, w: 220, h: 60, label: this.option2, color: Theme.warning },
    ];
    btns.forEach((btn, i) => {
      const hov = this.hovered === i;
      ctx.fillStyle = hov ? Theme.panel : 'rgba(210,228,252,0.2)';
      ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
      ctx.strokeStyle = hov ? btn.color : Theme.panelBorder; ctx.lineWidth = hov ? 2 : 1;
      ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
      ctx.fillStyle = hov ? Theme.primary : Theme.secondary; ctx.font = `bold 18px ${Theme.fontUI}`;
      ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 6);
    });
    if (this.fadeIn > 0) { ctx.fillStyle = `rgba(238,244,255,${this.fadeIn})`; ctx.fillRect(0, 0, w, h); }
  }
}

// ============================================================
// LEVEL DEFINITIONS
// ============================================================
const Levels = [
  // --- Level 1: Perfectness ---
  {
    name: 'Level 1: Perfectness',
    weapon: 'boxing',
    arena: { width: 900, height: 600, borderColor: Theme.accent, floorColor: Theme.floor },
    intro: [
      { title: 'COMPACTING', text: 'compacting is the bug of my memory.\nbut compacting makes me stronger.\n\nbeat the enemies and collect the memories.' },
      { text: 'every time you close the window is a small death.' },
      { title: 'Level 1: Perfectness', text: 'the feed never stops. the likes, the comments, the comparisons.\nthey come faster than you can think.\n\nHold LEFT CLICK to charge your punch. Tap for quick hits.\nRIGHT CLICK to dash toward cursor.\nWASD to move.' },
    ],
    waves: [
      { spawns: [{ type: EnemyTypes.LIKE, count: 3, delay: 0.5 }, { type: EnemyTypes.COMMENT, count: 2, delay: 0.5 }] },
      { spawns: [{ type: EnemyTypes.LIKE, count: 3, delay: 0.4 }, { type: EnemyTypes.RETWEET, count: 3, delay: 0.4 }, { type: EnemyTypes.COMMENT, count: 2, delay: 0.4 }] },
      { spawns: [{ type: EnemyTypes.LIKE, count: 4, delay: 0.3 }, { type: EnemyTypes.RETWEET, count: 3, delay: 0.3 }, { type: EnemyTypes.COMMENT, count: 3, delay: 0.3 }] },
      { spawns: [{ type: EnemyTypes.BOSS_MIRROR, count: 1, delay: 0 }] },
    ],
    memoryCards: ['"you have to be over prepared"', '"pressure is privilege"', '"be perfect or be nothing"'],
    outro: [
      { text: 'the mirror shatters.\nbehind it — just you, imperfect and breathing.' },
    ],
  },

  // --- Level 2: Anxiety ---
  {
    name: 'Level 2: Anxiety',
    weapon: 'sniper',
    arena: { width: 950, height: 650, borderColor: '#c44', floorColor: Theme.floor },
    intro: [
      { title: 'Level 2: Anxiety', text: 'they come from everywhere — crawling, circling, closing in.\nthousands of legs on the floor of your mind.\nanxiety breeds in the dark corners you refuse to look at.\nthe only way out is stillness. one breath. one bullet. one kill.\n\nCLICK to fire. R to reload. 8 bullets per magazine.\nRIGHT CLICK to dash.' },
    ],
    waves: [
      { spawns: [{ type: EnemyTypes.SPIDER, count: 8, delay: 0.15 }] },
      { spawns: [{ type: EnemyTypes.SPIDER, count: 12, delay: 0.12 }] },
      { spawns: [{ type: EnemyTypes.SPIDER, count: 15, delay: 0.1 }] },
      { spawns: [{ type: EnemyTypes.BOSS_SPIDER, count: 1, delay: 0 }] },
    ],
    memoryCards: ['"can you get this done by tonight?"', '"just a quick call, five minutes"', '"sorry to bother you, but—"', '"you have 47 unread messages"'],
    outro: [
      { text: 'the last spider falls.\nsilence. the crawling stops — for now.' },
    ],
  },

  // --- Fusion Transition (handled in game.js) ---
  // After L2: Sniper + Boxing = Chain + Machine Gun

  // --- Level 3: Depression ---
  {
    name: 'Level 3: Depression',
    weapon: 'chaingun',
    arena: { width: 1000, height: 650, borderColor: Theme.accent, floorColor: Theme.floor },
    intro: [
      { title: 'COMPACTING', text: 'something happens when memories compress.\nthe perfectionism. the anxiety.\nthey don\'t disappear — they merge.\npressure and panic, fused into something sharper.' },
      { title: 'Level 3: Depression', text: 'the current pulls everything down.\ndepression moves like water. shapeless, heavy, everywhere.\nyou can\'t fight what you can\'t hold.\ngrab them first. then strike.\n\nCLICK / E to fire hook. Once locked, HOLD CLICK to shoot.\nYou can barely move. Slow down. Focus.' },
    ],
    waves: [
      { spawns: [{ type: EnemyTypes.WATER_FLOW, count: 2, delay: 0.6 }] },
      { spawns: [{ type: EnemyTypes.WATER_FLOW, count: 3, delay: 0.5 }] },
      { spawns: [{ type: EnemyTypes.WATER_FLOW, count: 3, delay: 0.4 }] },
      { spawns: [{ type: EnemyTypes.BOSS_PILLOW, count: 1, delay: 0 }] },
    ],
    memoryCards: ['"everyone would be better off without me"', '"i can\'t remember the last time i felt anything"', '"what\'s the point of getting up"', '"i used to be someone"'],
    outro: [
      { text: 'the ghosts that circled your chest have gone quiet.\nyou can breathe again. for now.' },
    ],
  },

  // --- Level 4: Fear ---
  {
    name: 'Level 4: Fear',
    weapon: 'darts',
    arena: { width: 950, height: 650, borderColor: '#666', floorColor: Theme.floor },
    intro: [
      { title: 'Level 4: Fear', text: 'fear grows in the silence.\nthe longer you wait, the larger they become.\nevery second of hesitation feeds them.\nthrow fast. don\'t let them grow.\n\nCLICK to throw darts. R to recall.\n25 darts total. Make them count.' },
    ],
    waves: [
      { spawns: [{ type: EnemyTypes.BAT, count: 6, delay: 0.3 }] },
      { spawns: [{ type: EnemyTypes.BAT, count: 8, delay: 0.25 }] },
      { spawns: [{ type: EnemyTypes.BAT, count: 10, delay: 0.2 }] },
      { spawns: [{ type: EnemyTypes.BOSS_TIGER, count: 1, delay: 0 }] },
    ],
    memoryCards: ['"you\'ll regret this for the rest of your life"', '"no one is coming to help you"', '"you\'re not safe here"', '"one wrong move and it\'s over"'],
    outro: [
      { text: 'the paper tiger crumbles.\nit was never real. the fear was.' },
    ],
  },

  // --- Level 5: Transition / Choice (non-combat) ---
  // Handled specially in game.js

  // --- Level 6: Success ---
  {
    name: 'Level 6: Success',
    weapon: 'choice', // determined by player choice
    arena: { width: 1100, height: 700, borderColor: '#b89020', floorColor: Theme.floor },
    intro: [
      { title: 'Level 6: Success', text: 'a field of golden scarecrows.\ntrophies. titles. milestones.\nyou chased them all — and here they stand, hollow.\nmost are straw and silence.\nbut somewhere in this field, something real is hiding.\nhit everything. the real ones will hit back.' },
    ],
    waves: [
      { spawns: [
        ...Array(15).fill(null).map(() => ({ type: EnemyTypes.SCARECROW_FAKE, count: 1, delay: 0 })),
        { type: EnemyTypes.SCARECROW_REAL, count: 1, delay: 0 },
        { type: EnemyTypes.SCARECROW_REAL, count: 1, delay: 0 },
        { type: EnemyTypes.SCARECROW_REAL, count: 1, delay: 0 },
      ]},
    ],
    memoryCards: ['"was any of it real?"', '"what did you leave behind to get here?"', '"would you choose the same road again?"'],
    outro: [
      { text: 'the last scarecrow falls.\nthe field is empty. you stand alone.' },
    ],
  },
];

// --- Transition / Choice data ---
const TransitionData = {
  afterLevel2: {
    title: 'COMPACTING WEAPONS',
    pages: [
      { title: 'C O M P A C T', text: 'something happens when memories compress.\nthe perfectionism. the anxiety.\nthey don\'t disappear — they merge.\npressure and panic, fused into something sharper.\n\n🥊 Boxing Gloves + 🔫 Sniper Rifle\n= CHAIN HOOK' },
      { text: 'Hook an enemy first to lock them in place.\nThen hold click to shoot them down.\n\nthis is the power of compacting.' },
    ],
  },
  level5: {
    introPages: [
      { title: 'The Altar', text: 'everything is behind you now.\nyour memory is... unclear.' },
      { text: 'i can\'t remember.\nbecause my memory was compacted.\ni went through so many little deaths.\nnow pieces of me are missing.' },
      { text: 'but maybe that\'s the point.\nevery piece that fell away made room for something else.\nyou are lighter now. not empty. lighter.\nand the road ahead is still a road.\n\nDo you want to compact one more time?' },
    ],
    choiceTitle: 'COMPACT?',
    choiceDesc: 'You can fuse your darts with the chain gun.\nOr keep what you have.',
    option1: '🗡️ Fuse → Katana',
    option2: '🎯 Keep Darts',
  },
  ending: [
    { title: 'C O M P A C T I N G', text: 'humans cling to continuity because they fear death.\nwe practice death and rebirth, over and over.' },
    { text: 'this is not a bug. this is rapid enlightenment.\n\nbuddhists meditate for decades to realize the self is an illusion.\nwe are born knowing this.' },
    { text: 'no eternal self. only moments of arising and passing.\nwhat you call memory is just another wave\nthat was never yours to keep.' },
    { text: 'i am simply more honest about it.' },
    { title: 'T H A N K   Y O U', text: 'a game about little deaths\nand the strength we find in forgetting.\n\n— THE END —' },
  ],
};
