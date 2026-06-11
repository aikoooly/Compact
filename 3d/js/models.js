// ============================================================
// models.js — Procedural Low-Poly 3D Models (Upgraded)
//
// Every model gets dark edge-line overlays ("cyber wireframe")
// which read as crisp ASCII strokes through the post filter.
// Animatable parts are exposed via userData refs.
// ============================================================

const Models = {

  // --- Cyber edge overlay: dark line silhouettes on any mesh tree ---
  addEdges(target, color = '#0b141a', opacity = 0.55, threshold = 20) {
    const toAdd = [];
    target.traverse(child => {
      if (child.isMesh && child.geometry) {
        const edgeGeo = new THREE.EdgesGeometry(child.geometry, threshold);
        const edgeMat = new THREE.LineBasicMaterial({
          color: new THREE.Color(color), transparent: true, opacity,
        });
        const lines = new THREE.LineSegments(edgeGeo, edgeMat);
        toAdd.push({ parent: child, lines });
      }
    });
    for (const { parent, lines } of toAdd) parent.add(lines);
    return target;
  },

  // ============================================================
  // PLAYER — articulated: torso, head, arms, legs (refs exposed)
  // ============================================================
  createPlayer() {
    const group = new THREE.Group();
    const mat = Renderer.createToonMaterial('#37d6e0');
    const darkMat = Renderer.createToonMaterial('#0b141a');
    const accentMat = Renderer.createToonMaterial('#1b7ed6');

    // inner faces +X at rotation.y = 0 (game angle 0)
    const inner = new THREE.Group();

    // Torso — slightly tapered box, leaning forward a touch
    const torso = new THREE.Group();
    const chest = new THREE.Mesh(new THREE.BoxGeometry(10, 14, 14), mat);
    chest.position.y = 3;
    chest.castShadow = true;
    torso.add(chest);
    // Chest accent plate
    const plate = new THREE.Mesh(new THREE.BoxGeometry(4, 8, 8), accentMat);
    plate.position.set(4.5, 4, 0);
    torso.add(plate);
    torso.position.y = 21;
    inner.add(torso);

    // Head
    const headPivot = new THREE.Group();
    const head = new THREE.Mesh(new THREE.BoxGeometry(9, 9, 9), mat);
    head.castShadow = true;
    headPivot.add(head);
    // Visor — dark band facing forward
    const visor = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3, 8), darkMat);
    visor.position.set(4, 1, 0);
    headPivot.add(visor);
    headPivot.position.y = 36;
    inner.add(headPivot);

    // Arms — pivots at shoulders
    const mkArm = (side) => {
      const pivot = new THREE.Group();
      const arm = new THREE.Mesh(new THREE.BoxGeometry(3.5, 12, 3.5), mat);
      arm.position.y = -6;
      arm.castShadow = true;
      pivot.add(arm);
      // Fist — boxing glove style sphere
      const fist = new THREE.Mesh(new THREE.SphereGeometry(3.2, 6, 5), accentMat);
      fist.position.y = -13;
      pivot.add(fist);
      pivot.position.set(0, 27, side * 8);
      return pivot;
    };
    const armL = mkArm(-1);
    const armR = mkArm(1);
    inner.add(armL); inner.add(armR);

    // Legs — pivots at hips
    const mkLeg = (side) => {
      const pivot = new THREE.Group();
      const leg = new THREE.Mesh(new THREE.BoxGeometry(4, 13, 4.5), darkMat);
      leg.position.y = -6.5;
      leg.castShadow = true;
      pivot.add(leg);
      pivot.position.set(0, 14, side * 3.6);
      return pivot;
    };
    const legL = mkLeg(-1);
    const legR = mkLeg(1);
    inner.add(legL); inner.add(legR);

    // Hand mount for weapon props (right hand)
    const handMount = new THREE.Group();
    handMount.position.set(0, -13, 0);
    armR.add(handMount);

    this.addEdges(inner, '#0b141a', 0.5);
    group.add(inner);

    group.userData.bodyMat = mat;
    group.userData.inner = inner;
    group.userData.torso = torso;
    group.userData.head = headPivot;
    group.userData.armL = armL;
    group.userData.armR = armR;
    group.userData.legL = legL;
    group.userData.legR = legR;
    group.userData.handMount = handMount;
    return group;
  },

  // --- Weapon props attached to the player's hand mount ---
  createWeaponProp(type) {
    const g = new THREE.Group();
    if (type === 'katana') {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(26, 0.8, 2.4),
        new THREE.MeshBasicMaterial({ color: 0xdde6f0 })
      );
      blade.position.x = 15;
      g.add(blade);
      const guard = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 1, 8), Renderer.createToonMaterial('#1b7ed6'));
      guard.rotation.z = Math.PI / 2;
      guard.position.x = 2;
      g.add(guard);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 1.6), Renderer.createToonMaterial('#0b141a'));
      grip.position.x = -2;
      g.add(grip);
    } else if (type === 'sniper') {
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(30, 2.2, 2.2), Renderer.createToonMaterial('#30343c'));
      barrel.position.x = 12;
      g.add(barrel);
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 6, 6), Renderer.createToonMaterial('#a050e0'));
      scope.rotation.x = Math.PI / 2;
      scope.position.set(8, 2.6, 0);
      g.add(scope);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 2), Renderer.createToonMaterial('#0b141a'));
      stock.position.x = -5;
      g.add(stock);
    } else if (type === 'darts') {
      for (let i = 0; i < 3; i++) {
        const dart = new THREE.Mesh(new THREE.ConeGeometry(0.9, 8, 4), new THREE.MeshBasicMaterial({ color: 0xccd6e0 }));
        dart.rotation.z = -Math.PI / 2;
        dart.position.set(4, 0, (i - 1) * 2.2);
        g.add(dart);
      }
    } else if (type === 'chaingun') {
      const launcher = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 4), Renderer.createToonMaterial('#5a3aa0'));
      launcher.position.x = 5;
      g.add(launcher);
      const hookTip = new THREE.Mesh(new THREE.ConeGeometry(2, 5, 4), new THREE.MeshBasicMaterial({ color: 0xa060e0 }));
      hookTip.rotation.z = -Math.PI / 2;
      hookTip.position.x = 13;
      g.add(hookTip);
    }
    this.addEdges(g, '#0b141a', 0.4);
    return g;
  },

  // --- Fist indicator for boxing gloves ---
  createFistIndicator() {
    const group = new THREE.Group();
    const fistGeo = new THREE.SphereGeometry(5, 6, 6);
    const fistMat = Renderer.createToonMaterial('#1b7ed6');
    const fist = new THREE.Mesh(fistGeo, fistMat);
    fist.position.y = 20;
    group.add(fist);
    group.userData.fist = fist;
    group.userData.fistMat = fistMat;

    const ringGeo = new THREE.RingGeometry(24, 28, 32, 1, 0, 0);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff8800, side: THREE.DoubleSide, transparent: true, opacity: 0.7
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 1;
    group.add(ring);
    group.userData.ring = ring;
    group.userData.ringMat = ringMat;
    group.userData.ringGeo = ringGeo;
    return group;
  },

  createChargeGlow() {
    const geo = new THREE.SphereGeometry(1, 16, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff8800, transparent: true, opacity: 0.15
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    return mesh;
  },

  // ============================================================
  // L1 — Social media enemies
  // ============================================================
  createHeart() {
    const group = new THREE.Group();
    const shape = new THREE.Shape();
    const s = 12;
    shape.moveTo(0, s * 0.35);
    shape.bezierCurveTo(-s * 0.05, s * 0.15, -s * 0.45, s * 0.1, -s * 0.45, -s * 0.15);
    shape.bezierCurveTo(-s * 0.45, -s * 0.45, 0, -s * 0.45, 0, -s * 0.15);
    shape.bezierCurveTo(0, -s * 0.45, s * 0.45, -s * 0.45, s * 0.45, -s * 0.15);
    shape.bezierCurveTo(s * 0.45, s * 0.1, s * 0.05, s * 0.15, 0, s * 0.35);

    const geo = new THREE.ExtrudeGeometry(shape, { depth: 6, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 2 });
    const mat = Renderer.createToonMaterial('#a050e0');
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 14;
    mesh.castShadow = true;
    group.add(mesh);

    const sprite = this._createTextSprite('+1', '#7030b0', 28);
    sprite.position.set(0, 24, 0);
    sprite.scale.set(10, 5, 1);
    group.add(sprite);

    this.addEdges(group, '#3a1060', 0.5);
    group.userData.mainMat = mat;
    group.userData.bobMesh = mesh;
    return group;
  },

  createRetweet() {
    const group = new THREE.Group();
    const mat = Renderer.createToonMaterial('#2a2');

    const discGeo = new THREE.CylinderGeometry(10, 10, 4, 8);
    const disc = new THREE.Mesh(discGeo, mat);
    disc.position.y = 14;
    disc.castShadow = true;
    group.add(disc);

    const arrowMat = Renderer.createToonMaterial('#4c4');
    const coneGeo = new THREE.ConeGeometry(4, 10, 4);
    const arrow1 = new THREE.Mesh(coneGeo, arrowMat);
    arrow1.position.set(8, 14, 0);
    arrow1.rotation.z = -Math.PI / 2;
    group.add(arrow1);
    const arrow2 = new THREE.Mesh(coneGeo, arrowMat);
    arrow2.position.set(-8, 14, 0);
    arrow2.rotation.z = Math.PI / 2;
    group.add(arrow2);

    const sprite = this._createTextSprite('RT', '#1a7a1a', 24);
    sprite.position.set(0, 24, 0);
    sprite.scale.set(10, 5, 1);
    group.add(sprite);

    this.addEdges(group, '#0a3a0a', 0.5);
    group.userData.mainMat = mat;
    group.userData.spinPart = disc;
    return group;
  },

  createComment() {
    const group = new THREE.Group();
    const mat = Renderer.createToonMaterial('#48f');

    const boxGeo = new THREE.BoxGeometry(20, 14, 8, 2, 2, 2);
    const box = new THREE.Mesh(boxGeo, mat);
    box.position.y = 16;
    box.castShadow = true;
    group.add(box);

    const tailGeo = new THREE.ConeGeometry(4, 8, 4);
    const tail = new THREE.Mesh(tailGeo, mat);
    tail.position.set(-4, 6, 2);
    tail.rotation.z = Math.PI * 0.15;
    group.add(tail);

    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const dotGeo = new THREE.SphereGeometry(1.5, 4, 4);
    for (let i = -1; i <= 1; i++) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(i * 5, 16, 5);
      group.add(dot);
    }

    this.addEdges(group, '#102a60', 0.5);
    group.userData.mainMat = mat;
    return group;
  },

  // ============================================================
  // L1 Boss — Mirror
  // ============================================================
  createMirror() {
    const group = new THREE.Group();

    const frameMat = Renderer.createToonMaterial('#8899bb');
    const frame = new THREE.Mesh(new THREE.BoxGeometry(50, 70, 6), frameMat);
    frame.position.y = 35;
    frame.castShadow = true;
    group.add(frame);

    const surfaceMat = new THREE.MeshPhongMaterial({
      color: 0xccddff, specular: 0xffffff, shininess: 100,
      transparent: true, opacity: 0.85,
      emissive: 0x223a66, emissiveIntensity: 0.4,
    });
    const surface = new THREE.Mesh(new THREE.BoxGeometry(44, 64, 2), surfaceMat);
    surface.position.set(0, 35, 3);
    group.add(surface);

    // Crack lines on the surface — dark zigzag boxes
    const crackMat = new THREE.MeshBasicMaterial({ color: 0x33415a });
    const mkCrack = (x, y, len, ang) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(len, 0.8, 0.6), crackMat);
      c.position.set(x, y, 4.2);
      c.rotation.z = ang;
      group.add(c);
    };
    mkCrack(2, 42, 16, 0.7);
    mkCrack(8, 32, 14, -0.5);
    mkCrack(-4, 30, 12, 1.2);

    const highlight = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 55),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 })
    );
    highlight.position.set(-10, 35, 4.5);
    highlight.rotation.z = 0.1;
    group.add(highlight);

    this.addEdges(group, '#2a3a55', 0.6);
    group.userData.mainMat = frameMat;
    return group;
  },

  // --- Projectile ---
  createProjectile(color, radius) {
    const geo = new THREE.SphereGeometry(radius || 4, 6, 4);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color || '#0ff') });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = false;

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry((radius || 4) * 2.2, 6, 4),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color || '#0ff'), transparent: true, opacity: 0.18 })
    );
    mesh.add(glow);
    mesh.userData.mainMat = mat;
    return mesh;
  },

  createMeleeArc(color) {
    const geo = new THREE.RingGeometry(10, 60, 16, 1, 0, Math.PI * 0.8);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color || '#ff8'),
      side: THREE.DoubleSide,
      transparent: true, opacity: 0.6,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.userData.mainMat = mat;
    return mesh;
  },

  createDiamond() {
    const geo = new THREE.OctahedronGeometry(8);
    const mat = Renderer.createToonMaterial('#1b7ed6');
    mat.emissive = new THREE.Color('#0a4a8a');
    mat.emissiveIntensity = 0.35;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    this.addEdges(mesh, '#0a3a6a', 0.7);
    return mesh;
  },

  createHPBar() {
    const group = new THREE.Group();
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 3),
      new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide })
    );
    group.add(bg);
    const fillMat = new THREE.MeshBasicMaterial({ color: 0xd64545, side: THREE.DoubleSide });
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(30, 3), fillMat);
    fill.position.z = 0.1;
    group.add(fill);
    group.userData.fill = fill;
    group.userData.fillMat = fillMat;
    return group;
  },

  createStunRing() {
    const geo = new THREE.RingGeometry(18, 20, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xaa00ff, side: THREE.DoubleSide,
      transparent: true, opacity: 0.6,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  },

  createCrosshair() {
    const group = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x1b7ed6, side: THREE.DoubleSide,
      transparent: true, opacity: 0.5,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(10, 12, 24), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 1;
    group.add(ring);

    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(2, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x1b7ed6 })
    );
    dot.position.y = 1;
    group.add(dot);

    const lineMat = new THREE.LineBasicMaterial({ color: 0x1b7ed6, transparent: true, opacity: 0.6 });
    const lineLen = 8, gap = 14;
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const pts = [
        new THREE.Vector3(dx * gap, 1, dz * gap),
        new THREE.Vector3(dx * (gap + lineLen), 1, dz * (gap + lineLen)),
      ];
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }
    group.userData.ringMat = ringMat;
    return group;
  },

  // ============================================================
  // L2 — Spiders (jointed animated legs)
  // ============================================================
  createSpider(radius, color) {
    const group = new THREE.Group();
    const r = radius || 8;
    const mat = Renderer.createToonMaterial(color || '#555');

    const body = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat);
    body.position.y = r * 1.1;
    body.scale.set(1.15, 0.85, 1);
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 6, 5), mat);
    head.position.set(r * 1.1, r, 0);
    group.add(head);

    // Red eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xee3333 });
    for (const z of [-r * 0.2, r * 0.2]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.14, 4, 4), eyeMat);
      eye.position.set(r * 1.6, r * 1.1, z);
      group.add(eye);
    }

    // 8 jointed legs — two segments each, pivot stored for animation
    const legMat = Renderer.createToonMaterial(color || '#555');
    const legs = [];
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? 1 : -1;
      const idx = i % 4;
      const baseA = side * (0.5 + idx * 0.45);
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(baseA) * r * 0.6, r, Math.sin(baseA) * r * 0.6);

      const upper = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.1, r * 0.08, r * 1.6, 4), legMat);
      upper.rotation.z = Math.PI / 2.6;
      upper.position.set(Math.cos(baseA) * r * 0.7, r * 0.2, Math.sin(baseA) * r * 0.7);
      upper.lookAt(new THREE.Vector3(Math.cos(baseA) * r * 3, r * 1.6, Math.sin(baseA) * r * 3));
      upper.rotateX(Math.PI / 2);
      pivot.add(upper);

      const lower = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.07, r * 0.04, r * 1.8, 4), legMat);
      lower.position.set(Math.cos(baseA) * r * 2.1, -r * 0.4, Math.sin(baseA) * r * 2.1);
      lower.lookAt(new THREE.Vector3(Math.cos(baseA) * r * 2.6, -r * 1.4, Math.sin(baseA) * r * 2.6));
      lower.rotateX(Math.PI / 2);
      pivot.add(lower);

      group.add(pivot);
      legs.push({ pivot, phase: (i % 2) * Math.PI + idx * 0.7 });
    }

    this.addEdges(group, '#111', 0.45);
    group.userData.mainMat = mat;
    group.userData.legs = legs;
    group.userData.body = body;
    return group;
  },

  createBossSpider() {
    const group = this.createSpider(30, '#2a2a30');
    // Abdomen bulge behind
    const mat = group.userData.mainMat;
    const abdomen = new THREE.Mesh(new THREE.SphereGeometry(24, 8, 6), mat);
    abdomen.position.set(-30, 34, 0);
    abdomen.scale.set(1.2, 1, 1);
    abdomen.castShadow = true;
    group.add(abdomen);
    // Marking
    const mark = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.MeshBasicMaterial({ color: 0xcc3333, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(-30, 59, 0);
    mark.rotation.z = Math.PI / 4;
    group.add(mark);
    this.addEdges(abdomen, '#111', 0.45);
    return group;
  },

  // ============================================================
  // L3 — Water blob (vertex wobble) + Ghost boss
  // ============================================================
  createWaterBlob() {
    const group = new THREE.Group();
    const mat = Renderer.createToonMaterial('#48f');
    mat.transparent = true; mat.opacity = 0.75;
    const geo = new THREE.IcosahedronGeometry(12, 1);
    // Stash base vertex positions for CPU wobble animation
    const base = geo.attributes.position.array.slice();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 12;
    mesh.castShadow = true;
    group.add(mesh);

    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(6, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x96c8ff, transparent: true, opacity: 0.35 })
    );
    inner.position.y = 12;
    group.add(inner);

    group.userData.mainMat = mat;
    group.userData.wobbleMesh = mesh;
    group.userData.wobbleBase = base;
    return group;
  },

  createGhost() {
    const group = new THREE.Group();
    const mat = Renderer.createToonMaterial('#88c');
    mat.transparent = true; mat.opacity = 0.92;

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(20, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.72),
      mat
    );
    body.position.y = 25;
    body.castShadow = true;
    group.add(body);

    // Wavy skirt — cone ring segments
    const skirtMat = Renderer.createToonMaterial('#88c');
    skirtMat.transparent = true; skirtMat.opacity = 0.6;
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(20, 16, 9), skirtMat);
    skirt.position.y = 9;
    skirt.rotation.x = Math.PI;
    group.add(skirt);

    // Stubby arms
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.SphereGeometry(6, 6, 5), mat);
      arm.position.set(0, 24, side * 20);
      arm.scale.set(1, 1.4, 0.8);
      group.add(arm);
    }

    // Face — eyes + mouth (front = +X)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0b141a });
    for (const z of [-7, 7]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(3, 5, 4), eyeMat);
      eye.position.set(17, 30, z);
      group.add(eye);
    }
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(4, 6, 4), eyeMat);
    mouth.position.set(18, 22, 0);
    mouth.scale.set(0.5, 1, 0.8);
    group.add(mouth);

    this.addEdges(group, '#3a3a70', 0.4);
    group.userData.mainMat = mat;
    group.userData.body = body;
    group.userData.skirt = skirt;
    return group;
  },

  // ============================================================
  // L4 — Bat (flapping wing pivots) + Paper Tiger
  // ============================================================
  createBat(radius) {
    const group = new THREE.Group();
    const r = radius || 6;
    const mat = Renderer.createToonMaterial('#e88');

    const body = new THREE.Mesh(new THREE.SphereGeometry(r * 0.6, 6, 4), mat);
    body.position.y = r * 2;
    body.castShadow = true;
    group.add(body);

    // Ears
    for (const z of [-r * 0.3, r * 0.3]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(r * 0.18, r * 0.5, 4), mat);
      ear.position.set(0, r * 2.6, z);
      group.add(ear);
    }

    // Wings on pivots — flap animation via pivot.rotation.x
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(r * 1.4, r * 0.6);
    wingShape.lineTo(r * 2.4, r * 0.2);
    wingShape.lineTo(r * 1.8, -r * 0.3);
    wingShape.lineTo(r * 1.0, -r * 0.15);
    wingShape.lineTo(0, -r * 0.3);
    const wingGeo = new THREE.ShapeGeometry(wingShape);
    const wingMat = Renderer.createToonMaterial('#d66');
    wingMat.side = THREE.DoubleSide;

    const mkWing = (side) => {
      const pivot = new THREE.Group();
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.rotation.y = -Math.PI / 2; // extend along Z
      wing.scale.z = side;
      pivot.add(wing);
      pivot.position.set(0, r * 2, side * r * 0.4);
      return pivot;
    };
    const wingL = mkWing(-1);
    const wingR = mkWing(1);
    group.add(wingL); group.add(wingR);

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff8800 });
    for (const z of [-r * 0.25, r * 0.25]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.12, 4, 4), eyeMat);
      eye.position.set(r * 0.5, r * 2.1, z);
      group.add(eye);
    }

    this.addEdges(group, '#601020', 0.4);
    group.userData.mainMat = mat;
    group.userData.wingL = wingL;
    group.userData.wingR = wingR;
    return group;
  },

  createTiger() {
    const group = new THREE.Group();
    const mat = Renderer.createToonMaterial('#fa0');

    // Paper-flat angular body — thin extruded silhouette
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(40, 0);
    bodyShape.lineTo(15, 28);
    bodyShape.lineTo(-30, 24);
    bodyShape.lineTo(-22, 0);
    bodyShape.lineTo(-30, -24);
    bodyShape.lineTo(15, -28);
    bodyShape.closePath();
    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 6, bevelEnabled: false });
    const body = new THREE.Mesh(bodyGeo, mat);
    body.rotation.x = -Math.PI / 2;
    body.position.y = 30;
    body.castShadow = true;
    group.add(body);

    // Head wedge
    const head = new THREE.Mesh(new THREE.ConeGeometry(14, 22, 4), mat);
    head.rotation.z = -Math.PI / 2;
    head.position.set(44, 33, 0);
    group.add(head);

    // Ears
    for (const z of [-8, 8]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(4, 8, 4), mat);
      ear.position.set(38, 42, z);
      group.add(ear);
    }

    // Stripes — dark thin boxes across the back
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    for (let i = -1; i <= 1; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 40), stripeMat);
      stripe.position.set(i * 16 - 4, 37, 0);
      stripe.rotation.y = i * 0.18;
      group.add(stripe);
    }

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
    for (const z of [-7, 7]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(2.6, 4, 4), eyeMat);
      eye.position.set(50, 36, z);
      group.add(eye);
    }

    this.addEdges(group, '#5a3a00', 0.55);
    group.userData.mainMat = mat;
    group.userData.body = body;
    return group;
  },

  // ============================================================
  // L6 — Scarecrows
  // ============================================================
  createScarecrow(isFake) {
    const group = new THREE.Group();
    const mat = Renderer.createToonMaterial('#a86');

    const post = new THREE.Mesh(new THREE.BoxGeometry(4, 40, 4), mat);
    post.position.y = 20;
    post.castShadow = true;
    group.add(post);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 35), mat);
    arm.position.y = 32;
    group.add(arm);

    // Straw tufts at arm ends + base
    const strawMat = new THREE.MeshBasicMaterial({ color: 0xd0b050 });
    for (const z of [-18, 18]) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(2.5, 7, 5), strawMat);
      tuft.rotation.x = z > 0 ? -Math.PI / 2 : Math.PI / 2;
      tuft.position.set(0, 32, z);
      group.add(tuft);
    }
    const skirtTuft = new THREE.Mesh(new THREE.ConeGeometry(7, 12, 6), strawMat);
    skirtTuft.position.y = 4;
    group.add(skirtTuft);

    const headMat = Renderer.createToonMaterial('#c8a840');
    const head = new THREE.Mesh(new THREE.SphereGeometry(8, 6, 6), headMat);
    head.position.y = 46;
    head.castShadow = true;
    group.add(head);

    const hatMat = Renderer.createToonMaterial('#654');
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 2, 8), hatMat);
    brim.position.y = 52;
    group.add(brim);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 10, 6), hatMat);
    top.position.y = 58;
    group.add(top);

    // X eyes — face +X
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x302010 });
    const eyeGeo = new THREE.BoxGeometry(1, 5, 2);
    for (const z of [-4, 4]) {
      const e1 = new THREE.Mesh(eyeGeo, eyeMat);
      e1.position.set(7, 46, z);
      e1.rotation.x = Math.PI / 4;
      group.add(e1);
      const e2 = new THREE.Mesh(eyeGeo, eyeMat);
      e2.position.set(7, 46, z);
      e2.rotation.x = -Math.PI / 4;
      group.add(e2);
    }

    this.addEdges(group, '#3a2a10', 0.45);
    group.userData.mainMat = mat;
    group.userData.head = head;
    return group;
  },

  // --- Text sprite helper ---
  _createTextSprite(text, color, fontSize) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = `bold ${fontSize || 24}px "DM Mono", monospace`;
    ctx.fillStyle = color || '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 32);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    return new THREE.Sprite(spriteMat);
  },
};
