// ============================================================
// models.js — Low-Poly Character & Enemy Models
//
// Faithful to the original design doc:
//   L1 Perfectness: like-heart(+1) / retweet arrows / comment bubble
//                   boss = ornate cracked mirror
//   L2 Anxiety:     spiders / giant spider boss
//   L3 Depression:  water flows / pillow-ghost boss
//   L4 Fear:        growing bats / paper tiger boss
//   L6 Success:     scarecrow field (fake & real)
//
// Style: low-poly flat shading + dark edge lines + soft blob shadows.
// Animatable parts are exposed via userData refs.
// ============================================================

const Models = {

  // Flat-shaded toon material — the low-poly look
  mat(color, opts = {}) {
    return Renderer.createToonMaterial(color, { flatShading: true, ...opts });
  },

  // --- Dark edge-line overlay (reads as crisp strokes) ---
  addEdges(target, color = '#0b141a', opacity = 0.5, threshold = 25) {
    const toAdd = [];
    target.traverse(child => {
      if (child.isMesh && child.geometry) {
        const edgeGeo = new THREE.EdgesGeometry(child.geometry, threshold);
        const edgeMat = new THREE.LineBasicMaterial({
          color: new THREE.Color(color), transparent: true, opacity,
        });
        toAdd.push({ parent: child, lines: new THREE.LineSegments(edgeGeo, edgeMat) });
      }
    });
    for (const { parent, lines } of toAdd) parent.add(lines);
    return target;
  },

  // --- Soft blob shadow (entities render crisp, so real shadows are gone) ---
  addBlobShadow(group, radius, opacity = 0.16) {
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 18),
      new THREE.MeshBasicMaterial({
        color: 0x0b141a, transparent: true, opacity, depthWrite: false,
      })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.6;
    group.add(disc);
    return disc;
  },

  // ============================================================
  // PLAYER — the rememberer. Deep-teal suit, glowing visor,
  // boxing gloves, scarf. Articulated for the animation system.
  // ============================================================
  createPlayer() {
    const group = new THREE.Group();
    const suit = this.mat('#11606e');        // deep teal suit
    const dark = this.mat('#13202c');        // navy under-suit / boots
    const accentGlow = new THREE.MeshBasicMaterial({ color: 0x2b9bf0 }); // glowing visor/trim
    const glove = this.mat('#1b7ed6');       // boxing gloves
    const scarfMat = this.mat('#e8eef8');    // pale scarf

    const inner = new THREE.Group(); // faces +X at rotation.y = 0

    // Torso — chest + waist, slight forward lean
    const torso = new THREE.Group();
    const chest = new THREE.Mesh(new THREE.BoxGeometry(9, 9, 13), suit);
    chest.position.y = 6;
    torso.add(chest);
    const waist = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 9), dark);
    waist.position.y = -1;
    torso.add(waist);
    // Glowing chest core
    const core = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.5, 3.5), accentGlow);
    core.position.set(4.4, 6.5, 0);
    torso.add(core);
    // Shoulder pads
    for (const side of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(6.5, 3, 4.5), dark);
      pad.position.set(0, 9.5, side * 6.8);
      pad.rotation.x = side * 0.18;
      torso.add(pad);
    }
    // Scarf — wrapped at neck, tail flying behind
    const scarfNeck = new THREE.Mesh(new THREE.BoxGeometry(7, 2.6, 9.5), scarfMat);
    scarfNeck.position.y = 11.5;
    torso.add(scarfNeck);
    const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(7, 1.6, 3), scarfMat);
    scarfTail.position.set(-6.5, 10.5, 2);
    scarfTail.rotation.z = 0.5;
    torso.add(scarfTail);
    torso.position.y = 17;
    torso.rotation.z = 0.06;
    inner.add(torso);

    // Head — rounded box + glowing visor band + hair wedge
    const headPivot = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), suit);
    headPivot.add(skull);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.6, 7.2), accentGlow);
    visor.position.set(3.8, 0.8, 0);
    headPivot.add(visor);
    const hair = new THREE.Mesh(new THREE.ConeGeometry(5, 4.5, 4), dark);
    hair.position.set(-1.5, 5.5, 0);
    hair.rotation.y = Math.PI / 4;
    headPivot.add(hair);
    headPivot.position.y = 33;
    inner.add(headPivot);

    // Arms — pivot at shoulder, boxing glove fists
    const mkArm = (side) => {
      const pivot = new THREE.Group();
      const upper = new THREE.Mesh(new THREE.BoxGeometry(3.2, 7, 3.2), suit);
      upper.position.y = -3.5;
      pivot.add(upper);
      const fore = new THREE.Mesh(new THREE.BoxGeometry(2.8, 6, 2.8), dark);
      fore.position.y = -9;
      pivot.add(fore);
      const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(3.4, 0), glove);
      fist.position.y = -13.5;
      pivot.add(fist);
      pivot.position.set(0, 26, side * 7.5);
      return pivot;
    };
    const armL = mkArm(-1);
    const armR = mkArm(1);
    inner.add(armL); inner.add(armR);

    // Legs — pivot at hip, accent-striped boots
    const mkLeg = (side) => {
      const pivot = new THREE.Group();
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(3.6, 7, 4), suit);
      thigh.position.y = -3.5;
      pivot.add(thigh);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(4.6, 5.5, 4.2), dark);
      boot.position.set(0.6, -9.2, 0);
      pivot.add(boot);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1, 4.4), accentGlow);
      stripe.position.set(0.6, -7.4, 0);
      pivot.add(stripe);
      pivot.position.set(0, 13, side * 3.8);
      return pivot;
    };
    const legL = mkLeg(-1);
    const legR = mkLeg(1);
    inner.add(legL); inner.add(legR);

    // Hand mount for weapon props (right hand)
    const handMount = new THREE.Group();
    handMount.position.set(0, -13.5, 0);
    armR.add(handMount);

    this.addEdges(inner, '#0b141a', 0.45);
    inner.scale.setScalar(1.35);
    group.add(inner);

    // Locator ring + blob shadow
    const locator = new THREE.Mesh(
      new THREE.RingGeometry(17, 22, 28),
      new THREE.MeshBasicMaterial({
        color: 0x1b7ed6, side: THREE.DoubleSide, transparent: true, opacity: 0.55,
      })
    );
    locator.rotation.x = -Math.PI / 2;
    locator.position.y = 1.2;
    group.add(locator);
    this.addBlobShadow(group, 16, 0.2);

    group.userData.bodyMat = suit;
    group.userData.locator = locator;
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
      const guard = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 1, 8), this.mat('#1b7ed6'));
      guard.rotation.z = Math.PI / 2;
      guard.position.x = 2;
      g.add(guard);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 1.6), this.mat('#13202c'));
      grip.position.x = -2;
      g.add(grip);
    } else if (type === 'sniper') {
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(30, 2.2, 2.2), this.mat('#30343c'));
      barrel.position.x = 12;
      g.add(barrel);
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 6, 6), this.mat('#a050e0'));
      scope.rotation.x = Math.PI / 2;
      scope.position.set(8, 2.6, 0);
      g.add(scope);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 2), this.mat('#13202c'));
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
      const launcher = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 4), this.mat('#5a3aa0'));
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
    const fistMat = this.mat('#1b7ed6');
    const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(5, 0), fistMat);
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
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.15 })
    );
    mesh.visible = false;
    return mesh;
  },

  // ============================================================
  // L1 Perfectness — social media swarm
  // ============================================================

  // ❤ Like — chunky low-poly heart, "+1" hovering above
  createHeart() {
    const group = new THREE.Group();
    const shape = new THREE.Shape();
    const s = 13;
    shape.moveTo(0, s * 0.35);
    shape.bezierCurveTo(-s * 0.05, s * 0.15, -s * 0.45, s * 0.1, -s * 0.45, -s * 0.15);
    shape.bezierCurveTo(-s * 0.45, -s * 0.5, 0, -s * 0.5, 0, -s * 0.15);
    shape.bezierCurveTo(0, -s * 0.5, s * 0.45, -s * 0.5, s * 0.45, -s * 0.15);
    shape.bezierCurveTo(s * 0.45, s * 0.1, s * 0.05, s * 0.15, 0, s * 0.35);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 7, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 1,
    });
    const matBody = this.mat('#b14fe0');
    const mesh = new THREE.Mesh(geo, matBody);
    // Stand upright, face toward the player (+X)
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(-3.5, 16, 0);
    group.add(mesh);

    // Notification badge: small white disc with +1, top-right of the heart
    const badge = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 1.6, 10), this.mat('#f4f7fc'));
    badge.rotation.z = Math.PI / 2;
    badge.position.set(4.5, 23, -5);
    group.add(badge);
    const plus = this._createTextSprite('+1', '#8a2fc0', 30);
    plus.position.set(6, 23, -5);
    plus.scale.set(9, 4.5, 1);
    group.add(plus);

    this.addEdges(group, '#3a1060', 0.5);
    this.addBlobShadow(group, 14);
    group.userData.mainMat = matBody;
    group.userData.bobMesh = mesh;
    return group;
  },

  // 🔄 Retweet — two curved arrows chasing each other
  createRetweet() {
    const group = new THREE.Group();
    const matBody = this.mat('#2aa53a');

    const hub = new THREE.Group();
    // Two arcs (torus segments) + cone arrowheads
    for (const side of [0, Math.PI]) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(10, 2, 5, 10, Math.PI * 0.85), matBody);
      arc.rotation.x = -Math.PI / 2;          // flat on ground plane
      arc.rotation.z = side;
      arc.position.y = 16;
      hub.add(arc);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(3.4, 7, 5), matBody);
      const a = side + Math.PI * 0.85;
      tip.position.set(Math.cos(a) * 10, 16, -Math.sin(a) * 10);
      tip.rotation.y = a + Math.PI;
      tip.rotation.x = Math.PI / 2;
      hub.add(tip);
    }
    group.add(hub);

    // Counter chip below
    const chip = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 8), this.mat('#f4f7fc'));
    chip.position.y = 6;
    group.add(chip);

    this.addEdges(group, '#0a3a0a', 0.5);
    this.addBlobShadow(group, 13);
    group.userData.mainMat = matBody;
    group.userData.spinPart = hub;     // whole arrow assembly spins
    return group;
  },

  // 💬 Comment — speech bubble with typing dots
  createComment() {
    const group = new THREE.Group();
    const matBody = this.mat('#3d7df0');

    // Bubble: rounded slab
    const bubble = new THREE.Mesh(new THREE.BoxGeometry(10, 14, 20, 1, 2, 2), matBody);
    bubble.position.y = 20;
    group.add(bubble);
    // Tail wedge pointing down-forward
    const tail = new THREE.Mesh(new THREE.ConeGeometry(3.5, 9, 4), matBody);
    tail.position.set(3, 11, -5);
    tail.rotation.z = Math.PI;
    group.add(tail);

    // "..." typing dots on the front face
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = -1; i <= 1; i++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(1.6, 5, 4), dotMat);
      dot.position.set(5.4, 20, i * 5);
      group.add(dot);
    }

    this.addEdges(group, '#102a60', 0.5);
    this.addBlobShadow(group, 13);
    group.userData.mainMat = matBody;
    return group;
  },

  // 🪞 Boss: the Mirror — gilded frame, pale glass, cracks, claw feet
  createMirror() {
    const group = new THREE.Group();
    const gold = this.mat('#b08c3c');
    const frameMat = gold;

    // Frame — thick rounded rectangle (4 bars + corner knobs)
    const fw = 54, fh = 78, ft = 7;
    const bars = [
      [fw, ft, 0, fh / 2], [fw, ft, 0, -fh / 2],
    ];
    for (const [w, t, x, y] of bars) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(t, t, w), frameMat);
      bar.position.set(0, y + fh / 2 + 6, x);
      group.add(bar);
    }
    for (const z of [-fw / 2, fw / 2]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(ft, fh, ft), frameMat);
      bar.position.set(0, fh / 2 + 6, z);
      group.add(bar);
    }
    for (const z of [-fw / 2, fw / 2]) {
      for (const y of [6, fh + 6]) {
        const knob = new THREE.Mesh(new THREE.DodecahedronGeometry(5.5, 0), gold);
        knob.position.set(0, y, z);
        group.add(knob);
      }
    }
    // Crown ornament
    const crown = new THREE.Mesh(new THREE.ConeGeometry(7, 12, 4), gold);
    crown.position.set(0, fh + 16, 0);
    group.add(crown);

    // Glass — pale icy blue, slightly emissive
    const glassMat = new THREE.MeshPhongMaterial({
      color: 0xbdd4f0, specular: 0xffffff, shininess: 90,
      emissive: 0x2a4a7a, emissiveIntensity: 0.35,
    });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(3, fh - 8, fw - 10), glassMat);
    glass.position.set(0, fh / 2 + 6, 0);
    group.add(glass);

    // Cracks — thin dark slashes across the glass
    const crackMat = new THREE.MeshBasicMaterial({ color: 0x2a3a55 });
    const mkCrack = (y, z, len, ang) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.8, len, 1), crackMat);
      c.position.set(2, y, z);
      c.rotation.x = ang;
      group.add(c);
    };
    mkCrack(58, 2, 18, 0.6);
    mkCrack(48, 8, 14, -0.4);
    mkCrack(44, -4, 16, 1.1);
    mkCrack(34, 4, 10, -0.9);

    // Shimmer stripe
    const shimmer = new THREE.Mesh(
      new THREE.PlaneGeometry(10, fh - 14),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })
    );
    shimmer.rotation.y = Math.PI / 2;
    shimmer.position.set(3.6, fh / 2 + 6, -12);
    group.add(shimmer);

    // Claw feet
    for (const z of [-18, 18]) {
      const foot = new THREE.Mesh(new THREE.ConeGeometry(4, 9, 4), gold);
      foot.position.set(0, 4, z);
      foot.rotation.x = Math.PI;
      group.add(foot);
    }

    this.addEdges(group, '#4a3a10', 0.5);
    this.addBlobShadow(group, 30, 0.2);
    group.userData.mainMat = frameMat;
    return group;
  },

  // --- Projectile ---
  createProjectile(color, radius) {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(radius || 4, 0),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color || '#0ff') })
    );
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry((radius || 4) * 2.2, 6, 4),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color || '#0ff'), transparent: true, opacity: 0.18 })
    );
    mesh.add(glow);
    mesh.userData.mainMat = mesh.material;
    return mesh;
  },

  createMeleeArc(color) {
    const geo = new THREE.RingGeometry(10, 60, 16, 1, 0, Math.PI * 0.8);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color || '#ff8'),
      side: THREE.DoubleSide, transparent: true, opacity: 0.6,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.userData.mainMat = mat;
    return mesh;
  },

  createDiamond() {
    const geo = new THREE.OctahedronGeometry(8);
    const mat = this.mat('#1b7ed6');
    mat.emissive = new THREE.Color('#0a4a8a');
    mat.emissiveIntensity = 0.35;
    const mesh = new THREE.Mesh(geo, mat);
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
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(18, 20, 16),
      new THREE.MeshBasicMaterial({ color: 0xaa00ff, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
    );
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  },

  createCrosshair() {
    const group = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x1b7ed6, side: THREE.DoubleSide, transparent: true, opacity: 0.5,
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
  // L2 Anxiety — spiders, thousands of legs
  // ============================================================
  createSpider(radius, color) {
    const group = new THREE.Group();
    const r = radius || 8;
    const bodyMat = this.mat(color || '#3a3a44');

    // Abdomen + head, angular low-poly
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), bodyMat);
    body.position.y = r * 1.15;
    body.scale.set(1.25, 0.8, 1);
    group.add(body);
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.55, 0), bodyMat);
    head.position.set(r * 1.25, r, 0);
    group.add(head);

    // Eyes — 4 glowing red dots
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xee3333 });
    for (const [z, y] of [[-r * 0.25, 1.15], [r * 0.25, 1.15], [-r * 0.1, 1.35], [r * 0.1, 1.35]]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.11, 4, 4), eyeMat);
      eye.position.set(r * 1.7, r * y, z);
      group.add(eye);
    }
    // Fangs
    for (const z of [-r * 0.2, r * 0.2]) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(r * 0.12, r * 0.45, 4), this.mat('#e8e8f0'));
      fang.position.set(r * 1.6, r * 0.65, z);
      fang.rotation.x = Math.PI;
      group.add(fang);
    }

    // 8 jointed legs — animated via pivot refs
    const legMat = this.mat(color || '#3a3a44');
    const legs = [];
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? 1 : -1;
      const idx = i % 4;
      const baseA = side * (0.5 + idx * 0.45);
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(baseA) * r * 0.6, r, Math.sin(baseA) * r * 0.6);

      const upper = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.1, r * 0.08, r * 1.6, 4), legMat);
      upper.position.set(Math.cos(baseA) * r * 0.7, r * 0.2, Math.sin(baseA) * r * 0.7);
      upper.lookAt(new THREE.Vector3(Math.cos(baseA) * r * 3, r * 1.6, Math.sin(baseA) * r * 3));
      upper.rotateX(Math.PI / 2);
      pivot.add(upper);

      const lower = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.07, r * 0.03, r * 1.8, 4), legMat);
      lower.position.set(Math.cos(baseA) * r * 2.1, -r * 0.4, Math.sin(baseA) * r * 2.1);
      lower.lookAt(new THREE.Vector3(Math.cos(baseA) * r * 2.6, -r * 1.4, Math.sin(baseA) * r * 2.6));
      lower.rotateX(Math.PI / 2);
      pivot.add(lower);

      group.add(pivot);
      legs.push({ pivot, phase: (i % 2) * Math.PI + idx * 0.7 });
    }

    this.addEdges(group, '#111', 0.45);
    this.addBlobShadow(group, r * 2.2, 0.14);
    group.userData.mainMat = bodyMat;
    group.userData.legs = legs;
    group.userData.body = body;
    return group;
  },

  // Giant spider boss — bloated abdomen with red hourglass mark
  createBossSpider() {
    const group = this.createSpider(30, '#26262e');
    const matBody = group.userData.mainMat;
    const abdomen = new THREE.Mesh(new THREE.IcosahedronGeometry(26, 0), matBody);
    abdomen.position.set(-34, 36, 0);
    abdomen.scale.set(1.25, 1, 1.1);
    group.add(abdomen);
    // Red hourglass marking
    const markMat = new THREE.MeshBasicMaterial({ color: 0xcc2222 });
    for (const flip of [1, -1]) {
      const tri = new THREE.Mesh(new THREE.ConeGeometry(7, 12, 3), markMat);
      tri.position.set(-34 + flip * -3, 62, 0);
      tri.rotation.z = flip > 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(tri);
    }
    // Spiky hairs on abdomen
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(2.5, 9, 4), matBody);
      spike.position.set(-34 + Math.cos(a) * 18, 40 + Math.sin(a) * 16, Math.sin(a * 2) * 10);
      spike.lookAt(new THREE.Vector3(-34 + Math.cos(a) * 50, 40 + Math.sin(a) * 50, Math.sin(a * 2) * 30));
      spike.rotateX(Math.PI / 2);
      group.add(spike);
    }
    this.addEdges(abdomen, '#111', 0.45);
    return group;
  },

  // ============================================================
  // L3 Depression — shapeless water, smothering pillow-ghost
  // ============================================================
  createWaterBlob() {
    const group = new THREE.Group();
    const matBody = this.mat('#3a78e8');
    matBody.transparent = true; matBody.opacity = 0.8;
    const geo = new THREE.IcosahedronGeometry(13, 1);
    const base = geo.attributes.position.array.slice();
    const mesh = new THREE.Mesh(geo, matBody);
    mesh.position.y = 12;
    group.add(mesh);

    // Bright core
    const inner = new THREE.Mesh(
      new THREE.IcosahedronGeometry(6, 0),
      new THREE.MeshBasicMaterial({ color: 0x9ecbff, transparent: true, opacity: 0.5 })
    );
    inner.position.y = 12;
    group.add(inner);

    // Orbiting droplets
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const drop = new THREE.Mesh(new THREE.OctahedronGeometry(2.6, 0), this.mat('#5a90f0'));
      drop.position.set(Math.cos(a) * 17, 14 + Math.sin(a * 2) * 4, Math.sin(a) * 17);
      group.add(drop);
    }

    this.addEdges(group, '#10254a', 0.35);
    this.addBlobShadow(group, 14, 0.12);
    group.userData.mainMat = matBody;
    group.userData.wobbleMesh = mesh;
    group.userData.wobbleBase = base;
    return group;
  },

  // Pillow-ghost boss — soft smothering spirit
  createGhost() {
    const group = new THREE.Group();
    const matBody = this.mat('#8b8bd8');
    matBody.transparent = true; matBody.opacity = 0.95;

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(22, 9, 8, 0, Math.PI * 2, 0, Math.PI * 0.72),
      matBody
    );
    body.position.y = 26;
    group.add(body);

    // Wavy hem — ring of low-poly cones
    const hemMat = this.mat('#8b8bd8');
    hemMat.transparent = true; hemMat.opacity = 0.7;
    const skirt = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(6.5, 13, 4), hemMat);
      tip.position.set(Math.cos(a) * 15, 8, Math.sin(a) * 15);
      tip.rotation.x = Math.PI;
      skirt.add(tip);
    }
    group.add(skirt);

    // Pillow it carries — soft slab hugged at the front
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(7, 14, 22, 1, 2, 2), this.mat('#e8e2d4'));
    pillow.position.set(17, 24, 0);
    pillow.rotation.z = -0.15;
    group.add(pillow);

    // Stubby arms hugging the pillow
    for (const z of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.SphereGeometry(6, 6, 5), matBody);
      arm.position.set(13, 27, z * 16);
      arm.scale.set(1.5, 0.9, 0.9);
      group.add(arm);
    }

    // Sleepy face — droopy eyes above the pillow
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0b141a });
    for (const z of [-8, 8]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 5), eyeMat);
      eye.position.set(19, 36, z);
      eye.rotation.x = z > 0 ? -0.3 : 0.3;
      group.add(eye);
    }

    this.addEdges(group, '#3a3a70', 0.4);
    this.addBlobShadow(group, 24, 0.12);
    group.userData.mainMat = matBody;
    group.userData.body = body;
    group.userData.skirt = skirt;
    return group;
  },

  // ============================================================
  // L4 Fear — bats that grow in the dark, the paper tiger
  // ============================================================
  createBat(radius) {
    const group = new THREE.Group();
    const r = radius || 6;
    const matBody = this.mat('#c4566a');

    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.7, 0), matBody);
    body.position.y = r * 2;
    body.scale.set(1.1, 1.25, 0.9);
    group.add(body);

    // Big ears
    for (const z of [-r * 0.32, r * 0.32]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(r * 0.22, r * 0.8, 4), matBody);
      ear.position.set(-r * 0.1, r * 2.85, z);
      ear.rotation.x = z > 0 ? 0.25 : -0.25;
      group.add(ear);
    }
    // Fangs
    for (const z of [-r * 0.15, r * 0.15]) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(r * 0.08, r * 0.3, 4), this.mat('#f0f0f4'));
      fang.position.set(r * 0.55, r * 1.7, z);
      fang.rotation.x = Math.PI;
      group.add(fang);
    }

    // Jagged membrane wings on flap pivots
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(r * 1.2, r * 0.7);
    wingShape.lineTo(r * 2.5, r * 0.35);
    wingShape.lineTo(r * 2.1, -r * 0.1);   // scallop
    wingShape.lineTo(r * 1.7, -r * 0.45);
    wingShape.lineTo(r * 1.1, -r * 0.2);   // scallop
    wingShape.lineTo(r * 0.6, -r * 0.5);
    wingShape.lineTo(0, -r * 0.25);
    const wingGeo = new THREE.ShapeGeometry(wingShape);
    const wingMat = this.mat('#a23a50');
    wingMat.side = THREE.DoubleSide;

    const mkWing = (side) => {
      const pivot = new THREE.Group();
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.rotation.y = -Math.PI / 2;
      wing.scale.z = side;
      pivot.add(wing);
      pivot.position.set(0, r * 2, side * r * 0.4);
      return pivot;
    };
    const wingL = mkWing(-1);
    const wingR = mkWing(1);
    group.add(wingL); group.add(wingR);

    // Glowing eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffa020 });
    for (const z of [-r * 0.22, r * 0.22]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 4, 4), eyeMat);
      eye.position.set(r * 0.55, r * 2.15, z);
      group.add(eye);
    }

    this.addEdges(group, '#601020', 0.4);
    this.addBlobShadow(group, r * 1.6, 0.12);
    group.userData.mainMat = matBody;
    group.userData.wingL = wingL;
    group.userData.wingR = wingR;
    return group;
  },

  // Paper tiger boss — looks fierce, is literally folded paper
  createTiger() {
    const group = new THREE.Group();
    const orange = this.mat('#f0a020');
    const paper = this.mat('#f6edd8');

    // Body — paper-thin folded silhouette (two angled slabs like an origami spine)
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(34, 0);
    bodyShape.lineTo(20, 14);
    bodyShape.lineTo(-14, 17);
    bodyShape.lineTo(-34, 10);
    bodyShape.lineTo(-28, 0);
    const half = new THREE.ExtrudeGeometry(bodyShape, { depth: 1.6, bevelEnabled: false });
    for (const side of [-1, 1]) {
      const slab = new THREE.Mesh(half, orange);
      slab.rotation.x = Math.PI / 2 + side * 0.5;  // tent fold
      slab.position.set(0, 46, side * 1.2);
      group.add(slab);
    }

    // Legs — 4 paper triangles
    for (const [x, z] of [[-22, -10], [-22, 10], [18, -10], [18, 10]]) {
      const leg = new THREE.Mesh(new THREE.ConeGeometry(5, 26, 3), orange);
      leg.position.set(x, 13, z);
      group.add(leg);
    }

    // Head — angular wedge with ears, white muzzle, red eyes
    const headG = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(13, 0), orange);
    skull.scale.set(1.15, 1, 1);
    headG.add(skull);
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(7, 7, 10), paper);
    muzzle.position.set(11, -3, 0);
    headG.add(muzzle);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(2, 3.5, 4), this.mat('#c04040'));
    nose.position.set(15.5, -1, 0);
    nose.rotation.z = -Math.PI / 2;
    headG.add(nose);
    for (const z of [-8, 8]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(4.5, 8, 3), orange);
      ear.position.set(-3, 11, z);
      headG.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(2.4, 4, 4), new THREE.MeshBasicMaterial({ color: 0xee2222 }));
      eye.position.set(8, 3, z * 0.6);
      headG.add(eye);
    }
    headG.position.set(40, 50, 0);
    group.add(headG);

    // Stripes — black paper strips glued on both flanks
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    for (let i = 0; i < 4; i++) {
      for (const side of [-1, 1]) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.5, 12, 0.6), stripeMat);
        stripe.position.set(-20 + i * 13, 48, side * 8.2);
        stripe.rotation.x = side * 0.5;
        stripe.rotation.z = (i % 2 ? 0.25 : -0.2);
        group.add(stripe);
      }
    }

    // Paper tail — zigzag strip
    const tail = new THREE.Mesh(new THREE.BoxGeometry(16, 1, 3), orange);
    tail.position.set(-40, 52, 0);
    tail.rotation.z = 0.5;
    group.add(tail);

    this.addEdges(group, '#5a3a00', 0.5);
    this.addBlobShadow(group, 34, 0.16);
    group.userData.mainMat = orange;
    group.userData.body = group;
    return group;
  },

  // ============================================================
  // L6 Success — the scarecrow field
  // ============================================================
  createScarecrow(isFake) {
    const group = new THREE.Group();
    const wood = this.mat('#7a5a34');
    const straw = this.mat('#d4b050');
    const burlap = this.mat('#c8a050');

    // Post + crossbar
    const post = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 42, 5), wood);
    post.position.y = 21;
    group.add(post);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 38, 5), wood);
    arm.rotation.x = Math.PI / 2;
    arm.position.y = 33;
    group.add(arm);

    // Ragged tunic — cone draped on the cross
    const tunic = new THREE.Mesh(new THREE.ConeGeometry(11, 22, 6), this.mat('#8a6a40'));
    tunic.position.y = 22;
    group.add(tunic);

    // Straw tufts — sleeves and skirt
    for (const z of [-19, 19]) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(2.8, 8, 5), straw);
      tuft.rotation.x = z > 0 ? -Math.PI / 2 : Math.PI / 2;
      tuft.position.set(0, 33, z);
      group.add(tuft);
    }
    const skirtTuft = new THREE.Mesh(new THREE.ConeGeometry(8, 10, 6), straw);
    skirtTuft.position.y = 8;
    group.add(skirtTuft);

    // Burlap sack head — slightly lumpy
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(8.5, 0), burlap);
    head.position.y = 47;
    head.scale.set(1, 1.15, 1);
    group.add(head);

    // Patched hat
    const hatMat = this.mat('#5a4426');
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(12.5, 13.5, 2, 7), hatMat);
    brim.position.y = 54;
    group.add(brim);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 8, 11, 6), hatMat);
    top.position.y = 60;
    top.rotation.z = 0.08;
    group.add(top);

    // X eyes + stitched mouth — face the +X direction
    const stitchMat = new THREE.MeshBasicMaterial({ color: 0x2a1a08 });
    const eyeGeo = new THREE.BoxGeometry(1, 5, 1.6);
    for (const z of [-3.5, 3.5]) {
      const e1 = new THREE.Mesh(eyeGeo, stitchMat);
      e1.position.set(7.4, 48, z);
      e1.rotation.x = Math.PI / 4;
      group.add(e1);
      const e2 = new THREE.Mesh(eyeGeo, stitchMat);
      e2.position.set(7.4, 48, z);
      e2.rotation.x = -Math.PI / 4;
      group.add(e2);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 8), stitchMat);
    mouth.position.set(7.8, 43, 0);
    group.add(mouth);
    for (let i = -2; i <= 2; i++) {
      const stitch = new THREE.Mesh(new THREE.BoxGeometry(1, 2.6, 0.9), stitchMat);
      stitch.position.set(7.8, 43, i * 1.8);
      group.add(stitch);
    }

    // A crow perched on the arm (only on fakes — a tell for sharp eyes)
    if (isFake) {
      const crow = new THREE.Mesh(new THREE.IcosahedronGeometry(3, 0), this.mat('#1a1a22'));
      crow.position.set(0, 36.5, 13);
      crow.scale.set(1.3, 1, 0.9);
      group.add(crow);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(1, 2.5, 4), this.mat('#d09020'));
      beak.position.set(3.5, 36.5, 13);
      beak.rotation.z = -Math.PI / 2;
      group.add(beak);
    }

    this.addEdges(group, '#3a2a10', 0.45);
    this.addBlobShadow(group, 15, 0.14);
    group.userData.mainMat = tunic.material;
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
