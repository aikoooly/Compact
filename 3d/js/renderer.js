// ============================================================
// renderer.js — Three.js Scene, Camera, Lighting, Render
// ============================================================

const Renderer = {
  scene: null,
  camera: null,
  renderer: null,
  container: null,

  // Groups for organizing scene
  arenaGroup: null,
  entitiesGroup: null,
  particlesGroup: null,

  // Toon gradient for cel-shading
  gradientMap: null,

  width: 1280,
  height: 720,

  init() {
    this.container = document.getElementById('three-canvas');

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdce8f8); // match floor color for seamless look

    // Get actual container size
    this.width = this.container.clientWidth || 1280;
    this.height = this.container.clientHeight || 720;

    // Orthographic camera for isometric view — zoomed in for larger entities
    const aspect = this.width / this.height;
    const frustum = 280;
    this.camera = new THREE.OrthographicCamera(
      -frustum * aspect, frustum * aspect,
      frustum, -frustum,
      1, 2000
    );
    // Isometric-ish angle (~50 degrees from horizontal)
    this.camera.position.set(0, 600, 400);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.container.appendChild(this.renderer.domElement);

    // Handle window resize
    window.addEventListener('resize', () => this._onResize());

    // Create toon gradient map (3-step for cel-shading)
    this._createGradientMap();

    // Lighting
    this._setupLights();

    // Scene groups
    this.arenaGroup = new THREE.Group();
    this.entitiesGroup = new THREE.Group();
    this.particlesGroup = new THREE.Group();
    this.scene.add(this.arenaGroup);
    this.scene.add(this.entitiesGroup);
    this.scene.add(this.particlesGroup);
  },

  _createGradientMap() {
    const colors = new Uint8Array(4);
    colors[0] = 80;   // shadow
    colors[1] = 160;  // mid
    colors[2] = 220;  // lit
    colors[3] = 255;  // highlight
    this.gradientMap = new THREE.DataTexture(colors, colors.length, 1, THREE.RedFormat);
    this.gradientMap.minFilter = THREE.NearestFilter;
    this.gradientMap.magFilter = THREE.NearestFilter;
    this.gradientMap.needsUpdate = true;
  },

  _setupLights() {
    // Ambient
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    // Hemisphere for sky/ground blend
    const hemi = new THREE.HemisphereLight(0xdce8f8, 0x8899aa, 0.3);
    this.scene.add(hemi);

    // Main directional light (upper right)
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(300, 500, 200);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    dir.shadow.camera.left = -600;
    dir.shadow.camera.right = 600;
    dir.shadow.camera.top = 600;
    dir.shadow.camera.bottom = -600;
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 1200;
    dir.shadow.bias = -0.002;
    this.scene.add(dir);
  },

  createToonMaterial(color, opts = {}) {
    const mat = new THREE.MeshToonMaterial({
      color: new THREE.Color(color),
      gradientMap: this.gradientMap,
      ...opts,
    });
    return mat;
  },

  _onResize() {
    this.width = this.container.clientWidth || 1280;
    this.height = this.container.clientHeight || 720;
    const aspect = this.width / this.height;
    const frustum = 280;
    this.camera.left = -frustum * aspect;
    this.camera.right = frustum * aspect;
    this.camera.top = frustum;
    this.camera.bottom = -frustum;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  },

  addToScene(mesh) {
    this.entitiesGroup.add(mesh);
  },

  removeFromScene(mesh) {
    if (mesh.parent) mesh.parent.remove(mesh);
  },

  render() {
    this.renderer.render(this.scene, this.camera);
  },
};
