// ============================================================
// renderer.js — Three.js Scene + ASCII Post-Processing Pipeline
//
// The 3D scene is rendered into an offscreen target, then a
// fullscreen shader converts it into real ASCII glyphs sampled
// from a glyph atlas — keeping the light-blue cyber aesthetic
// of the original 2D game, but with true 3D underneath.
// ============================================================

const Renderer = {
  scene: null,
  camera: null,
  renderer: null,
  container: null,

  arenaGroup: null,
  entitiesGroup: null,
  particlesGroup: null,

  gradientMap: null,

  width: 1280,
  height: 720,

  // --- ASCII pipeline state ---
  asciiMode: 1,          // 0 = raw 3D, 1 = hybrid (ASCII bg + 3D entities), 2 = full ASCII
  _sceneTarget: null,
  _asciiScene: null,
  _asciiCamera: null,
  _asciiQuad: null,
  _asciiUniforms: null,
  _glyphAtlas: null,
  _glyphCount: 0,
  glitch: 0,             // 0..1, decays; set by Effects on player damage
  time: 0,

  init() {
    this.container = document.getElementById('three-canvas');

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe7eefb);

    this.width = this.container.clientWidth || 1280;
    this.height = this.container.clientHeight || 720;

    const aspect = this.width / this.height;
    const frustum = 500;
    this.camera = new THREE.OrthographicCamera(
      -frustum * aspect, frustum * aspect,
      frustum, -frustum,
      1, 2000
    );
    this.camera.position.set(0, 600, 400);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.container.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => this._onResize());

    this._createGradientMap();
    this._setupLights();

    this.arenaGroup = new THREE.Group();
    this.entitiesGroup = new THREE.Group();
    this.particlesGroup = new THREE.Group();
    this.scene.add(this.arenaGroup);
    this.scene.add(this.entitiesGroup);
    this.scene.add(this.particlesGroup);

    this._setupAsciiPipeline();
  },

  _createGradientMap() {
    // 4-step toon gradient — hard bands read well through the ASCII filter.
    // RGBA (not RedFormat): this three.js build samples the gradient's RGB,
    // so a red-only texture would tint all direct light red.
    const steps = [60, 140, 210, 255];
    const colors = new Uint8Array(steps.length * 4);
    steps.forEach((v, i) => {
      colors[i * 4] = v; colors[i * 4 + 1] = v; colors[i * 4 + 2] = v; colors[i * 4 + 3] = 255;
    });
    this.gradientMap = new THREE.DataTexture(colors, steps.length, 1, THREE.RGBAFormat);
    this.gradientMap.minFilter = THREE.NearestFilter;
    this.gradientMap.magFilter = THREE.NearestFilter;
    this.gradientMap.needsUpdate = true;
  },

  _setupLights() {
    // Restrained light levels — overexposure flattens the ASCII ink mapping
    const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambient);
    this._ambient = ambient;

    const hemi = new THREE.HemisphereLight(0xdce8f8, 0x8899aa, 0.15);
    this.scene.add(hemi);
    this._hemi = hemi;

    const dir = new THREE.DirectionalLight(0xffffff, 0.52);
    dir.position.set(300, 500, 200);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    dir.shadow.camera.left = -700;
    dir.shadow.camera.right = 700;
    dir.shadow.camera.top = 700;
    dir.shadow.camera.bottom = -700;
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 1200;
    dir.shadow.bias = -0.002;
    this.scene.add(dir);
    this._dirLight = dir;
  },

  createToonMaterial(color, opts = {}) {
    return new THREE.MeshToonMaterial({
      color: new THREE.Color(color),
      gradientMap: this.gradientMap,
      ...opts,
    });
  },

  // ============================================================
  // ASCII post-processing
  // ============================================================

  _buildGlyphAtlas(cellW, cellH) {
    // Glyphs sorted light → dense. Pure ASCII so any monospace fallback works.
    const glyphs = " .'`^\":;~-+=<>icjtfxnesazSXEKB%8&#@";
    this._glyphCount = glyphs.length;
    const dpr = 2; // crisp glyphs
    const canvas = document.createElement('canvas');
    canvas.width = cellW * glyphs.length * dpr;
    canvas.height = cellH * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cellW * glyphs.length, cellH);
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.floor(cellH * 0.95)}px "DM Mono", "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < glyphs.length; i++) {
      ctx.fillText(glyphs[i], i * cellW + cellW / 2, cellH * 0.54);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  },

  _setupAsciiPipeline() {
    const pr = this.renderer.getPixelRatio();
    this._sceneTarget = new THREE.WebGLRenderTarget(
      this.width * pr, this.height * pr,
      { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat }
    );

    const cellW = 7, cellH = 11; // device px per ASCII cell (chars taller than wide)
    this._glyphAtlas = this._buildGlyphAtlas(16, 24);

    const bg = new THREE.Color(Theme.bg);
    const accent = new THREE.Color(Theme.accent);
    const ink = new THREE.Color(Theme.primary);

    this._asciiUniforms = {
      tDiffuse:   { value: this._sceneTarget.texture },
      tGlyph:     { value: this._glyphAtlas },
      resolution: { value: new THREE.Vector2(this.width * pr, this.height * pr) },
      cellSize:   { value: new THREE.Vector2(cellW * pr, cellH * pr) },
      glyphCount: { value: this._glyphCount },
      bgColor:    { value: new THREE.Vector3(bg.r, bg.g, bg.b) },
      accentColor:{ value: new THREE.Vector3(accent.r, accent.g, accent.b) },
      inkColor:   { value: new THREE.Vector3(ink.r, ink.g, ink.b) },
      time:       { value: 0 },
      glitch:     { value: 0 },
      mixRaw:     { value: 0 },  // 1 = bypass ASCII (raw 3D)
    };

    const vert = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;

    const frag = `
      precision highp float;
      uniform sampler2D tDiffuse;
      uniform sampler2D tGlyph;
      uniform vec2 resolution;
      uniform vec2 cellSize;
      uniform float glyphCount;
      uniform vec3 bgColor;
      uniform vec3 accentColor;
      uniform vec3 inkColor;
      uniform float time;
      uniform float glitch;
      uniform float mixRaw;
      varying vec2 vUv;

      float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      void main() {
        vec2 fragPx = vUv * resolution;

        // --- glitch: horizontal row displacement + RGB split ---
        vec2 uv = vUv;
        if (glitch > 0.001) {
          float row = floor(fragPx.y / cellSize.y);
          float jitter = (hash(vec2(row, floor(time * 24.0))) - 0.5) * 2.0;
          float gate = step(0.72, hash(vec2(row * 1.7, floor(time * 18.0))));
          uv.x += jitter * gate * glitch * 0.035;
        }

        vec2 cell = floor(uv * resolution / cellSize);
        vec2 cellCenterUv = (cell + 0.5) * cellSize / resolution;

        // average 5 taps in the cell so thin features survive
        vec2 o = cellSize / resolution * 0.28;
        vec3 s0 = texture2D(tDiffuse, cellCenterUv).rgb;
        vec3 s1 = texture2D(tDiffuse, cellCenterUv + vec2( o.x,  o.y)).rgb;
        vec3 s2 = texture2D(tDiffuse, cellCenterUv + vec2(-o.x,  o.y)).rgb;
        vec3 s3 = texture2D(tDiffuse, cellCenterUv + vec2( o.x, -o.y)).rgb;
        vec3 s4 = texture2D(tDiffuse, cellCenterUv + vec2(-o.x, -o.y)).rgb;
        vec3 scene = (s0 * 2.0 + s1 + s2 + s3 + s4) / 6.0;

        float L = lum(scene);
        float mx = max(scene.r, max(scene.g, scene.b));
        float mn = min(scene.r, min(scene.g, scene.b));
        float sat = mx > 0.001 ? (mx - mn) / mx : 0.0;

        // "ink": darkness OR strong color both produce glyphs.
        float ink = max((1.0 - L) * 1.25, sat * (0.35 + (1.0 - L)));

        // Paper culling: bright low-saturation surfaces (the pale floor) carry
        // no ink — entities (saturated) and shadows (dark) keep theirs.
        float colored = smoothstep(0.18, 0.32, sat);
        float darkness = smoothstep(0.3, 0.55, 1.0 - L);
        ink *= max(colored, darkness);

        // --- edge detection (luminance sobel at cell scale) → crisper silhouettes
        vec2 e = cellSize / resolution;
        float lL = lum(texture2D(tDiffuse, cellCenterUv - vec2(e.x, 0.0)).rgb);
        float lR = lum(texture2D(tDiffuse, cellCenterUv + vec2(e.x, 0.0)).rgb);
        float lU = lum(texture2D(tDiffuse, cellCenterUv + vec2(0.0, e.y)).rgb);
        float lD = lum(texture2D(tDiffuse, cellCenterUv - vec2(0.0, e.y)).rgb);
        float edge = clamp((abs(lR - lL) + abs(lU - lD)) * 2.2, 0.0, 1.0);
        ink = max(ink, edge * 0.85);

        // per-cell dither breaks banding
        ink += (hash(cell) - 0.5) * 0.06;
        ink = clamp(ink, 0.0, 1.0);

        // pick glyph by ink density
        float gIdx = floor(ink * (glyphCount - 1.0) + 0.5);
        vec2 inCell = fract(fragPx / cellSize);
        // sample glyph alpha from atlas
        vec2 gUv = vec2((gIdx + inCell.x) / glyphCount, inCell.y);
        float glyph = texture2D(tGlyph, gUv).a;

        // glyph color: keep scene hue, darken bright colors so they read on light bg
        vec3 gCol = scene;
        float l2 = max(L, 0.0001);
        float darken = mix(1.0, 0.52 / l2, smoothstep(0.55, 0.9, L) * step(0.18, sat));
        gCol *= darken;
        // near-black scene → theme ink color (unify blacks)
        gCol = mix(inkColor, gCol, smoothstep(0.0, 0.22, L));

        // faint ambient grid glyphs on empty floor
        float floorGlyph = step(0.93, hash(cell + floor(time * 0.2))) * 0.05;
        float inkVis = smoothstep(0.045, 0.13, ink);

        vec3 col = mix(bgColor, gCol, glyph * max(inkVis, floorGlyph));

        // Glitch: corrupted rows flash accent-colored noise glyphs.
        // Touches glyphs only — background stays clean (no full-screen tint).
        if (glitch > 0.001) {
          float gate = step(0.9, hash(vec2(cell.y, floor(time * 20.0))));
          float noiseG = step(0.93, hash(cell + floor(time * 30.0))) * gate;
          // noise cells use a dense glyph shape — never solid rectangles
          float gIdx2 = glyphCount - 4.0;
          float glyph2 = texture2D(tGlyph, vec2((gIdx2 + inCell.x) / glyphCount, inCell.y)).a;
          float corrupt = clamp((glyph * gate * 0.7 + glyph2 * noiseG * 0.8) * glitch, 0.0, 1.0);
          col = mix(col, accentColor, corrupt);
        }

        // Gentle vignette
        vec2 vigUv = vUv - 0.5;
        float vig = 1.0 - dot(vigUv, vigUv) * 0.1;
        col *= vig;

        // raw bypass
        vec3 raw = texture2D(tDiffuse, vUv).rgb;
        gl_FragColor = vec4(mix(col, raw, mixRaw), 1.0);
      }
    `;

    this._asciiScene = new THREE.Scene();
    this._asciiCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const quadMat = new THREE.ShaderMaterial({
      uniforms: this._asciiUniforms,
      vertexShader: vert,
      fragmentShader: frag,
      depthTest: false,
      depthWrite: false,
    });
    this._asciiQuad = new THREE.Mesh(quadGeo, quadMat);
    this._asciiScene.add(this._asciiQuad);
  },

  cycleAsciiMode() {
    this.asciiMode = (this.asciiMode + 1) % 3;
    return ['RAW 3D', 'HYBRID', 'FULL ASCII'][this.asciiMode];
  },

  // Brighter lights for the crisp entity pass, dimmer for the ASCII bg pass
  _setLightLevel(entityPass) {
    if (entityPass) {
      this._ambient.intensity = 0.42;
      this._hemi.intensity = 0.2;
      this._dirLight.intensity = 0.62;
    } else {
      this._ambient.intensity = 0.3;
      this._hemi.intensity = 0.15;
      this._dirLight.intensity = 0.52;
    }
  },

  _onResize() {
    this.width = this.container.clientWidth || 1280;
    this.height = this.container.clientHeight || 720;
    const aspect = this.width / this.height;
    const frustum = 500;
    this.camera.left = -frustum * aspect;
    this.camera.right = frustum * aspect;
    this.camera.top = frustum;
    this.camera.bottom = -frustum;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    const pr = this.renderer.getPixelRatio();
    if (this._sceneTarget) {
      this._sceneTarget.setSize(this.width * pr, this.height * pr);
      this._asciiUniforms.resolution.value.set(this.width * pr, this.height * pr);
    }
  },

  addToScene(mesh) {
    this.entitiesGroup.add(mesh);
  },

  removeFromScene(mesh) {
    if (mesh.parent) mesh.parent.remove(mesh);
  },

  render(dt) {
    this.time += dt || 0.016;
    this.glitch = Math.max(0, this.glitch - (dt || 0.016) * 2.2);

    if (this.asciiMode === 0 || !this._asciiQuad) {
      this._setLightLevel(true);
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this._asciiUniforms.time.value = this.time;
    this._asciiUniforms.glitch.value = this.glitch;
    this._asciiUniforms.mixRaw.value = 0;

    const hybrid = this.asciiMode === 1;

    // Pass 1: background (arena only in hybrid) → ASCII shader
    if (hybrid) {
      this.entitiesGroup.visible = false;
      this.particlesGroup.visible = false;
    }
    this._setLightLevel(false);
    this.renderer.setRenderTarget(this._sceneTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this._asciiScene, this._asciiCamera);

    // Pass 2 (hybrid): crisp low-poly entities on top of the ASCII background
    if (hybrid) {
      this.entitiesGroup.visible = true;
      this.particlesGroup.visible = true;
      this.arenaGroup.visible = false;
      const oldBg = this.scene.background;
      this.scene.background = null;
      this._setLightLevel(true);
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.scene, this.camera);
      this.renderer.autoClear = true;
      this.scene.background = oldBg;
      this.arenaGroup.visible = true;
    }
  },
};
