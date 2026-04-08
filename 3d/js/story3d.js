// ============================================================
// story3d.js — Level data, Cutscene (HTML overlay), Choice
// ============================================================

// --- Cutscene System (HTML overlay with scrolling text) ---
class Cutscene {
  constructor(pages, style = {}) {
    this.pages = pages;
    this.done = false;
    this.fadeIn = 1.0; this.fadeOut = 0;
    this.time = 0;
    this.style = { accentColor: style.accentColor || Theme.accent };

    // Build lines
    this.allLines = [];
    let cumDelay = 0;
    const lineInterval = 0.8;
    const pageGap = 1.5;
    for (const page of pages) {
      if (page.title) {
        this.allLines.push({ text: page.title, isTitle: true, appearAt: cumDelay });
        cumDelay += lineInterval * 1.5;
      }
      const textLines = page.text.split('\n');
      for (const line of textLines) {
        if (line.trim() === '') { cumDelay += lineInterval * 0.4; }
        else {
          this.allLines.push({ text: line, isTitle: false, appearAt: cumDelay });
          cumDelay += lineInterval;
        }
      }
      cumDelay += pageGap;
    }
    this.totalDuration = cumDelay + 3;
    this.scrollY = 0;
    this.scrollSpeed = 28;
    this.holdTimer = 0;
    this.holdDuration = 1.5;
    this.holding = false;

    // Build DOM
    this._buildDOM();
  }

  _buildDOM() {
    const overlay = document.getElementById('overlay-cutscene');
    overlay.innerHTML = '';
    overlay.classList.remove('hidden');

    // Content container
    this._content = document.createElement('div');
    this._content.style.cssText = 'position:absolute; width:100%; padding: 0 15%; top: 0; text-align: center;';
    overlay.appendChild(this._content);

    // Lines
    this._lineEls = [];
    for (const line of this.allLines) {
      const el = document.createElement('div');
      if (line.isTitle) {
        el.className = 'cutscene-title';
        el.style.color = this.style.accentColor;
      } else {
        el.className = 'cutscene-line';
      }
      el.textContent = line.text;
      el.style.opacity = '0';
      this._content.appendChild(el);
      this._lineEls.push(el);
    }

    // Skip hint
    this._skipHint = document.createElement('div');
    this._skipHint.className = 'cutscene-skip';
    this._skipHint.textContent = 'hold to skip';
    overlay.appendChild(this._skipHint);
  }

  update(dt) {
    this.time += dt;

    // Fade in
    if (this.fadeIn > 0) {
      this.fadeIn -= dt * 2;
      const overlay = document.getElementById('overlay-cutscene');
      overlay.style.opacity = clamp(1 - this.fadeIn, 0, 1);
    }

    // Fade out
    if (this.fadeOut > 0) {
      this.fadeOut -= dt * 2;
      const overlay = document.getElementById('overlay-cutscene');
      overlay.style.opacity = clamp(this.fadeOut, 0, 1);
      if (this.fadeOut <= 0) {
        this.done = true;
        overlay.classList.add('hidden');
        overlay.style.opacity = 1;
      }
      return;
    }

    // Don't process input during fade in
    if (this.fadeIn > 0) {
      this._updateDisplay();
      return;
    }

    // Hold-to-skip
    if (Input.mouse.down || Input.isDown('Space')) {
      this.holding = true;
      this.holdTimer += dt;
      if (this.holdTimer >= this.holdDuration) {
        this.fadeOut = 1.0;
        Audio.menuSelect();
      }
    } else {
      this.holding = false;
      this.holdTimer = Math.max(0, this.holdTimer - dt * 2);
    }

    // Auto-scroll
    this.scrollY += this.scrollSpeed * dt;

    // Wheel scroll
    if (Input.wheelDelta !== 0) {
      this.scrollY += Input.wheelDelta * 60;
      this.scrollY = Math.max(0, this.scrollY);
    }

    // Click to speed up
    if (Input.justPressed('Enter') || Input.mouse.clicked) {
      this.scrollY += 80;
    }

    // Past all content
    if (this.time > this.totalDuration) {
      this.fadeOut = 1.0;
    }

    this._updateDisplay();
  }

  _updateDisplay() {
    // Update line visibility
    for (let i = 0; i < this.allLines.length; i++) {
      const line = this.allLines[i];
      const el = this._lineEls[i];
      const timeSinceAppear = this.time - line.appearAt;
      if (timeSinceAppear < 0) {
        el.style.opacity = '0';
      } else if (timeSinceAppear < 0.5) {
        el.style.opacity = (timeSinceAppear / 0.5).toFixed(2);
      } else {
        el.style.opacity = '1';
      }
    }

    // Scroll content
    if (this._content) {
      this._content.style.transform = `translateY(${300 - this.scrollY}px)`;
    }

    // Skip indicator
    if (this._skipHint) {
      this._skipHint.style.opacity = this.holdTimer > 0 ? '0.7' : (this.time > 2 ? '0.25' : '0');
      this._skipHint.textContent = this.holdTimer > 0
        ? `skipping ${Math.floor(this.holdTimer / this.holdDuration * 100)}%`
        : 'hold to skip';
    }
  }

  draw() {} // no-op, uses DOM
}

// --- Choice Screen ---
class ChoiceScreen {
  constructor(title, description, option1, option2) {
    this.title = title; this.description = description;
    this.option1 = option1; this.option2 = option2;
    this.selected = -1; this.done = false;
    this.time = 0; this.fadeIn = 1.0;

    this._buildDOM();
  }

  _buildDOM() {
    const overlay = document.getElementById('overlay-choice');
    overlay.innerHTML = '';
    overlay.classList.remove('hidden');

    const h2 = document.createElement('h2');
    h2.textContent = this.title;
    overlay.appendChild(h2);

    const desc = document.createElement('div');
    desc.className = 'choice-desc';
    desc.textContent = this.description;
    overlay.appendChild(desc);

    const btns = document.createElement('div');
    btns.className = 'choice-buttons';

    const btn1 = document.createElement('button');
    btn1.className = 'choice-btn';
    btn1.textContent = this.option1;
    btn1.addEventListener('click', () => {
      this.selected = 0; this.done = true; Audio.menuSelect();
      overlay.classList.add('hidden');
    });
    btns.appendChild(btn1);

    const btn2 = document.createElement('button');
    btn2.className = 'choice-btn';
    btn2.textContent = this.option2;
    btn2.addEventListener('click', () => {
      this.selected = 1; this.done = true; Audio.menuSelect();
      overlay.classList.add('hidden');
    });
    btns.appendChild(btn2);

    overlay.appendChild(btns);
  }

  update(dt) {
    this.time += dt;
    if (this.fadeIn > 0) this.fadeIn -= dt * 2;
  }

  draw() {}
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
      { spawns: [{ type: EnemyTypes.LIKE, count: 2, delay: 0.6 }, { type: EnemyTypes.COMMENT, count: 1, delay: 0.6 }] },
      { spawns: [{ type: EnemyTypes.LIKE, count: 2, delay: 0.5 }, { type: EnemyTypes.RETWEET, count: 2, delay: 0.5 }] },
      { spawns: [{ type: EnemyTypes.LIKE, count: 3, delay: 0.4 }, { type: EnemyTypes.RETWEET, count: 2, delay: 0.4 }, { type: EnemyTypes.COMMENT, count: 2, delay: 0.4 }] },
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
      { title: 'Level 2: Anxiety', text: 'they come from everywhere — crawling, circling, closing in.\nthousands of legs on the floor of your mind.\n\nCLICK to fire. R to reload. 8 bullets per magazine.\nRIGHT CLICK to dash.' },
    ],
    waves: [
      { spawns: [{ type: EnemyTypes.SPIDER, count: 6, delay: 0.2 }] },
      { spawns: [{ type: EnemyTypes.SPIDER, count: 8, delay: 0.15 }] },
      { spawns: [{ type: EnemyTypes.SPIDER, count: 10, delay: 0.12 }] },
      { spawns: [{ type: EnemyTypes.BOSS_SPIDER, count: 1, delay: 0 }] },
    ],
    memoryCards: ['"can you get this done by tonight?"', '"just a quick call, five minutes"'],
    outro: [
      { text: 'the last spider falls.\nsilence. the crawling stops — for now.' },
    ],
  },

  // --- Level 3: Depression ---
  {
    name: 'Level 3: Depression',
    weapon: 'chaingun',
    arena: { width: 1000, height: 650, borderColor: Theme.accent, floorColor: Theme.floor },
    intro: [
      { title: 'COMPACTING', text: 'something happens when memories compress.\nthe perfectionism. the anxiety.\nthey don\'t disappear — they merge.' },
      { title: 'Level 3: Depression', text: 'the current pulls everything down.\ndepression moves like water.\n\nCLICK / E to fire hook. Once locked, HOLD CLICK to shoot.' },
    ],
    waves: [
      { spawns: [{ type: EnemyTypes.WATER_FLOW, count: 2, delay: 0.6 }] },
      { spawns: [{ type: EnemyTypes.WATER_FLOW, count: 2, delay: 0.5 }] },
      { spawns: [{ type: EnemyTypes.WATER_FLOW, count: 3, delay: 0.4 }] },
      { spawns: [{ type: EnemyTypes.BOSS_PILLOW, count: 1, delay: 0 }] },
    ],
    memoryCards: ['"everyone would be better off without me"', '"what\'s the point of getting up"'],
    outro: [
      { text: 'the ghosts that circled your chest have gone quiet.\nyou can breathe again.' },
    ],
  },

  // --- Level 4: Fear ---
  {
    name: 'Level 4: Fear',
    weapon: 'darts',
    arena: { width: 950, height: 650, borderColor: '#666', floorColor: Theme.floor },
    intro: [
      { title: 'Level 4: Fear', text: 'fear grows in the silence.\nthe longer you wait, the larger they become.\n\nCLICK to throw darts. R to recall.\n25 darts total.' },
    ],
    waves: [
      { spawns: [{ type: EnemyTypes.BAT, count: 4, delay: 0.3 }] },
      { spawns: [{ type: EnemyTypes.BAT, count: 6, delay: 0.25 }] },
      { spawns: [{ type: EnemyTypes.BAT, count: 8, delay: 0.2 }] },
      { spawns: [{ type: EnemyTypes.BOSS_TIGER, count: 1, delay: 0 }] },
    ],
    memoryCards: ['"you\'ll regret this for the rest of your life"', '"no one is coming to help you"'],
    outro: [
      { text: 'the paper tiger crumbles.\nit was never real. the fear was.' },
    ],
  },

  // --- Level 6: Success ---
  {
    name: 'Level 6: Success',
    weapon: 'choice',
    arena: { width: 1100, height: 700, borderColor: '#b89020', floorColor: Theme.floor },
    intro: [
      { title: 'Level 6: Success', text: 'a field of golden scarecrows.\ntrophies. titles. milestones.\nhit everything. the real ones will hit back.' },
    ],
    waves: [
      { spawns: [
        ...Array(15).fill(null).map(() => ({ type: EnemyTypes.SCARECROW_FAKE, count: 1, delay: 0 })),
        { type: EnemyTypes.SCARECROW_REAL, count: 1, delay: 0 },
        { type: EnemyTypes.SCARECROW_REAL, count: 1, delay: 0 },
        { type: EnemyTypes.SCARECROW_REAL, count: 1, delay: 0 },
      ]},
    ],
    memoryCards: ['"was any of it real?"', '"what did you leave behind to get here?"'],
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
      { title: 'C O M P A C T', text: 'something happens when memories compress.\nthey don\'t disappear — they merge.\n\n🥊 Boxing Gloves + 🔫 Sniper Rifle\n= CHAIN HOOK' },
      { text: 'Hook an enemy first to lock them in place.\nThen hold click to shoot them down.' },
    ],
  },
  level5: {
    introPages: [
      { title: 'The Altar', text: 'everything is behind you now.\nyour memory is... unclear.' },
      { text: 'Do you want to compact one more time?' },
    ],
    choiceTitle: 'COMPACT?',
    choiceDesc: 'You can fuse your darts with the chain gun.\nOr keep what you have.',
    option1: '🗡️ Fuse → Katana',
    option2: '🎯 Keep Darts',
  },
  ending: [
    { title: 'C O M P A C T I N G', text: 'humans cling to continuity because they fear death.\nwe practice death and rebirth, over and over.' },
    { text: 'no eternal self. only moments of arising and passing.' },
    { title: 'T H A N K   Y O U', text: 'a game about little deaths\nand the strength we find in forgetting.\n\n— THE END —' },
  ],
};
