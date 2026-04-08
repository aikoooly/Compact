// ============================================================
// art-config.js — Centralized Art Style Configuration
// ============================================================
// All rendering parameters in one place.
// Change values here to experiment with different visual styles.
// The test scene (art-test.html) and main game both read from this.

const ArtConfig = {

  // ── Scene Background ──
  scene: {
    bgColor: '#dce8f8',        // scene clear color
    fogEnabled: false,          // enable distance fog
    fogColor: '#dce8f8',
    fogNear: 400,
    fogFar: 1200,
  },

  // ── Camera ──
  camera: {
    frustum: 500,               // orthographic frustum half-size
    height: 600,                // camera Y position
    depth: 400,                 // camera Z offset (higher = more top-down)
    // Perspective alternative (set ortho=false to switch)
    ortho: true,
    perspectiveFov: 45,
  },

  // ── Lighting ──
  lighting: {
    ambientColor: '#ffffff',
    ambientIntensity: 0.6,

    hemiSkyColor: '#dce8f8',
    hemiGroundColor: '#8899aa',
    hemiIntensity: 0.3,

    dirColor: '#ffffff',
    dirIntensity: 0.9,
    dirPosition: [300, 500, 200],  // [x, y, z]
    dirShadow: true,
    dirShadowMapSize: 2048,
    dirShadowBias: -0.002,
  },

  // ── Toon Shading ──
  toon: {
    enabled: true,
    // Gradient steps (0-255): shadow, mid, lit, highlight
    gradientSteps: [80, 160, 220, 255],
  },

  // ── Materials ──
  materials: {
    // Player
    playerColor: '#4ff',
    playerEyeColor: '#0b141a',

    // Enemies — override per type or use defaults
    enemyDefaultColor: '#888',

    // Floor
    floorColor: '#dce8f8',
    floorMaterial: 'lambert',     // 'lambert', 'toon', 'standard', 'basic'

    // Arena border
    borderOpacity: 0.35,
  },

  // ── Post-Processing ── (for future use)
  postProcessing: {
    enabled: false,
    bloom: {
      enabled: false,
      strength: 0.3,
      radius: 0.4,
      threshold: 0.85,
    },
    outline: {
      enabled: false,
      color: '#000000',
      thickness: 1.5,
    },
    vignette: {
      enabled: false,
      darkness: 0.5,
      offset: 1.0,
    },
    pixelate: {
      enabled: false,
      pixelSize: 3,
    },
  },

  // ── Particles ──
  particles: {
    maxCount: 600,
    baseSize: 4,
    opacity: 0.8,
    sizeAttenuation: true,
  },

  // ── Crosshair ──
  crosshair: {
    color: '#1b7ed6',
    ringRadius: [10, 12],
    ringOpacity: 0.5,
    dotRadius: 2,
    lineLength: 8,
    lineGap: 14,
  },

  // ── WebGL Renderer ──
  renderer: {
    antialias: true,
    toneMapping: 'none',         // 'none', 'aces', 'reinhard', 'cineon'
    toneMappingExposure: 1.0,
    shadowType: 'pcfsoft',       // 'basic', 'pcf', 'pcfsoft'
    pixelRatioMax: 2,
  },

  // ── Helper: apply toneMapping string to THREE constant ──
  getToneMapping() {
    const map = {
      'none': THREE.NoToneMapping,
      'aces': THREE.ACESFilmicToneMapping,
      'reinhard': THREE.ReinhardToneMapping,
      'cineon': THREE.CineonToneMapping,
    };
    return map[this.renderer.toneMapping] || THREE.NoToneMapping;
  },

  getShadowType() {
    const map = {
      'basic': THREE.BasicShadowMap,
      'pcf': THREE.PCFShadowMap,
      'pcfsoft': THREE.PCFSoftShadowMap,
    };
    return map[this.renderer.shadowType] || THREE.PCFSoftShadowMap;
  },
};
