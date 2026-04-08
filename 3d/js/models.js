// ============================================================
// models.js — Procedural Low-Poly 3D Models
// ============================================================

const Models = {
  // --- Player ---
  createPlayer() {
    const group = new THREE.Group();
    const mat = Renderer.createToonMaterial('#4ff');

    // Inner group for the model (rotated so default forward = +X, matching game angle=0)
    const inner = new THREE.Group();

    // Body: tapered cylinder
    const bodyGeo = new THREE.CylinderGeometry(7, 10, 24, 8);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 12;
    body.castShadow = true;
    inner.add(body);

    // Head: low-poly sphere
    const headGeo = new THREE.SphereGeometry(7, 8, 6);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.y = 30;
    head.castShadow = true;
    inner.add(head);

    // Eyes - face +X direction (game forward when angle=0)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0b141a });
    const eyeGeo = new THREE.SphereGeometry(1.5, 4, 4);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(5, 31, -3);
    inner.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(5, 31, 3);
    inner.add(eyeR);

    group.add(inner);
    group.userData.bodyMat = mat;
    return group;
  },

  // --- Fist indicator for boxing gloves ---
  createFistIndicator() {
    const group = new THREE.Group();
    // Fist sphere
    const fistGeo = new THREE.SphereGeometry(5, 6, 6);
    const fistMat = Renderer.createToonMaterial('#1b7ed6');
    const fist = new THREE.Mesh(fistGeo, fistMat);
    fist.position.y = 20;
    group.add(fist);
    group.userData.fist = fist;
    group.userData.fistMat = fistMat;

    // Charge ring
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

  // --- Charge glow sphere (around player during boxing charge) ---
  createChargeGlow() {
    const geo = new THREE.SphereGeometry(1, 16, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff8800, transparent: true, opacity: 0.15
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    return mesh;
  },

  // --- Heart enemy (Like) ---
  createHeart() {
    const group = new THREE.Group();
    // Use a simple extruded heart shape
    const shape = new THREE.Shape();
    const s = 12;
    shape.moveTo(0, s * 0.35);
    shape.bezierCurveTo(-s * 0.05, s * 0.15, -s * 0.45, s * 0.1, -s * 0.45, -s * 0.15);
    shape.bezierCurveTo(-s * 0.45, -s * 0.45, 0, -s * 0.45, 0, -s * 0.15);
    shape.bezierCurveTo(0, -s * 0.45, s * 0.45, -s * 0.45, s * 0.45, -s * 0.15);
    shape.bezierCurveTo(s * 0.45, s * 0.1, s * 0.05, s * 0.15, 0, s * 0.35);

    const extrudeSettings = { depth: 6, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 2 };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const mat = Renderer.createToonMaterial('#a050e0');
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 14;
    mesh.position.z = 0;
    mesh.castShadow = true;
    group.add(mesh);

    // "+1" text sprite
    const sprite = this._createTextSprite('+1', '#a050e0', 24);
    sprite.position.set(0, 22, 4);
    sprite.scale.set(8, 4, 1);
    group.add(sprite);

    group.userData.mainMat = mat;
    return group;
  },

  // --- Retweet enemy ---
  createRetweet() {
    const group = new THREE.Group();
    const mat = Renderer.createToonMaterial('#2a2');

    // Two arrow shapes on a disc
    const discGeo = new THREE.CylinderGeometry(10, 10, 4, 8);
    const disc = new THREE.Mesh(discGeo, mat);
    disc.position.y = 14;
    disc.castShadow = true;
    group.add(disc);

    // Arrow indicators using cones
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

    // "RT" text
    const sprite = this._createTextSprite('RT', '#2a2', 20);
    sprite.position.set(0, 22, 0);
    sprite.scale.set(8, 4, 1);
    group.add(sprite);

    group.userData.mainMat = mat;
    return group;
  },

  // --- Comment enemy ---
  createComment() {
    const group = new THREE.Group();
    const mat = Renderer.createToonMaterial('#48f');

    // Speech bubble: rounded box
    const boxGeo = new THREE.BoxGeometry(20, 14, 8, 2, 2, 2);
    const box = new THREE.Mesh(boxGeo, mat);
    box.position.y = 16;
    box.castShadow = true;
    group.add(box);

    // Tail: small cone
    const tailGeo = new THREE.ConeGeometry(4, 8, 4);
    const tail = new THREE.Mesh(tailGeo, mat);
    tail.position.set(-4, 6, 2);
    tail.rotation.z = Math.PI * 0.15;
    group.add(tail);

    // "..." dots
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const dotGeo = new THREE.SphereGeometry(1.5, 4, 4);
    for (let i = -1; i <= 1; i++) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(i * 5, 16, 5);
      group.add(dot);
    }

    group.userData.mainMat = mat;
    return group;
  },

  // --- Boss Mirror ---
  createMirror() {
    const group = new THREE.Group();

    // Mirror frame
    const frameMat = Renderer.createToonMaterial('#8899bb');
    const frameGeo = new THREE.BoxGeometry(50, 70, 6);
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = 35;
    frame.castShadow = true;
    group.add(frame);

    // Mirror surface (slightly inset, shinier)
    const surfaceMat = new THREE.MeshPhongMaterial({
      color: 0xccddff, specular: 0xffffff, shininess: 100,
      transparent: true, opacity: 0.8,
    });
    const surfaceGeo = new THREE.BoxGeometry(44, 64, 2);
    const surface = new THREE.Mesh(surfaceGeo, surfaceMat);
    surface.position.set(0, 35, 3);
    group.add(surface);

    // Reflection highlight
    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.2,
    });
    const highlightGeo = new THREE.PlaneGeometry(15, 55);
    const highlight = new THREE.Mesh(highlightGeo, highlightMat);
    highlight.position.set(-10, 35, 4.5);
    highlight.rotation.z = 0.1;
    group.add(highlight);

    group.userData.mainMat = frameMat;
    return group;
  },

  // --- Projectile ---
  createProjectile(color, radius) {
    const geo = new THREE.SphereGeometry(radius || 4, 6, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color || '#0ff'),
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = false;

    // Glow ring
    const glowGeo = new THREE.SphereGeometry((radius || 4) * 2.5, 6, 4);
    const glowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color || '#0ff'),
      transparent: true, opacity: 0.2,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    mesh.add(glow);

    mesh.userData.mainMat = mat;
    return mesh;
  },

  // --- Melee arc (flat ring on ground) ---
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

  // --- Memory card diamond ---
  createDiamond() {
    const geo = new THREE.OctahedronGeometry(8);
    const mat = Renderer.createToonMaterial('#1b7ed6');
    mat.emissive = new THREE.Color('#0a4a8a');
    mat.emissiveIntensity = 0.3;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  },

  // --- Enemy HP bar (small plane above enemy) ---
  createHPBar() {
    const group = new THREE.Group();

    // Background
    const bgGeo = new THREE.PlaneGeometry(30, 3);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    group.add(bg);

    // Fill
    const fillGeo = new THREE.PlaneGeometry(30, 3);
    const fillMat = new THREE.MeshBasicMaterial({ color: 0xd64545, side: THREE.DoubleSide });
    const fill = new THREE.Mesh(fillGeo, fillMat);
    fill.position.z = 0.1;
    group.add(fill);

    group.userData.fill = fill;
    group.userData.fillMat = fillMat;
    return group;
  },

  // --- Stun ring ---
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

  // --- Crosshair (mouse cursor indicator on ground) ---
  createCrosshair() {
    const group = new THREE.Group();

    // Outer ring
    const ringGeo = new THREE.RingGeometry(10, 12, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x1b7ed6, side: THREE.DoubleSide,
      transparent: true, opacity: 0.5,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 1;
    group.add(ring);

    // Center dot
    const dotGeo = new THREE.SphereGeometry(2, 8, 6);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x1b7ed6 });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.y = 1;
    group.add(dot);

    // Cross lines (4 short lines forming a +)
    const lineMat = new THREE.LineBasicMaterial({ color: 0x1b7ed6, transparent: true, opacity: 0.6 });
    const lineLen = 8;
    const gap = 14;
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [dx, dz] of dirs) {
      const pts = [
        new THREE.Vector3(dx * gap, 1, dz * gap),
        new THREE.Vector3(dx * (gap + lineLen), 1, dz * (gap + lineLen)),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      group.add(new THREE.Line(geo, lineMat));
    }

    group.userData.ringMat = ringMat;
    return group;
  },

  // --- Spider (L2 enemy) ---
  createSpider(radius, color) {
    const group = new THREE.Group();
    const mat = Renderer.createToonMaterial(color || '#555');
    // Body
    const bodyGeo = new THREE.SphereGeometry(radius || 8, 8, 6);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = radius || 8;
    body.castShadow = true;
    group.add(body);
    // 8 legs
    const legMat = new THREE.LineBasicMaterial({ color: new THREE.Color(color || '#555') });
    const r = radius || 8;
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 / 8) * i;
      const pts = [
        new THREE.Vector3(Math.cos(a) * r * 0.8, r, Math.sin(a) * r * 0.8),
        new THREE.Vector3(Math.cos(a) * r * 1.5, r * 1.5, Math.sin(a) * r * 1.5),
        new THREE.Vector3(Math.cos(a) * r * 2.5, 2, Math.sin(a) * r * 2.5),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      group.add(new THREE.Line(geo, legMat));
    }
    group.userData.mainMat = mat;
    return group;
  },

  // --- Boss Spider (L2 boss) ---
  createBossSpider() {
    const group = this.createSpider(35, '#333');
    // Red eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
    const eyeGeo = new THREE.SphereGeometry(4, 4, 4);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-10, 38, 12);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(10, 38, 12);
    group.add(eyeR);
    return group;
  },

  // --- Water Flow (L3 enemy) ---
  createWaterBlob() {
    const group = new THREE.Group();
    const mat = Renderer.createToonMaterial('#48f');
    mat.transparent = true; mat.opacity = 0.7;
    const geo = new THREE.IcosahedronGeometry(12, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 12;
    mesh.castShadow = true;
    group.add(mesh);
    // Inner glow
    const innerMat = new THREE.MeshBasicMaterial({ color: 0x96c8ff, transparent: true, opacity: 0.3 });
    const inner = new THREE.Mesh(new THREE.SphereGeometry(6, 6, 6), innerMat);
    inner.position.y = 12;
    group.add(inner);
    group.userData.mainMat = mat;
    group.userData.wobbleMesh = mesh;
    return group;
  },

  // --- Ghost/Pillow Boss (L3 boss) ---
  createGhost() {
    const group = new THREE.Group();
    const mat = Renderer.createToonMaterial('#88c');
    // Rounded body
    const bodyGeo = new THREE.SphereGeometry(20, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.7);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 25;
    body.castShadow = true;
    group.add(body);
    // Bottom wavy part
    const bottomGeo = new THREE.ConeGeometry(20, 15, 8);
    const bottomMat = Renderer.createToonMaterial('#88c');
    bottomMat.transparent = true; bottomMat.opacity = 0.6;
    const bottom = new THREE.Mesh(bottomGeo, bottomMat);
    bottom.position.y = 8;
    bottom.rotation.x = Math.PI;
    group.add(bottom);
    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0b141a });
    const eyeGeo = new THREE.SphereGeometry(3, 4, 4);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-7, 28, 16);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(7, 28, 16);
    group.add(eyeR);
    // Mouth
    const mouthGeo = new THREE.SphereGeometry(4, 6, 4);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x0b141a });
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, 20, 17);
    mouth.scale.set(1, 0.6, 0.5);
    group.add(mouth);
    group.userData.mainMat = mat;
    return group;
  },

  // --- Bat (L4 enemy) ---
  createBat(radius) {
    const group = new THREE.Group();
    const r = radius || 6;
    const mat = Renderer.createToonMaterial('#e88');
    // Body
    const bodyGeo = new THREE.SphereGeometry(r * 0.6, 6, 4);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = r;
    body.castShadow = true;
    group.add(body);
    // Wings (two flat triangles)
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(r * 2, r * 0.5);
    wingShape.lineTo(r * 1.5, -r * 0.5);
    wingShape.lineTo(0, -r * 0.3);
    const wingGeo = new THREE.ShapeGeometry(wingShape);
    const wingMat = Renderer.createToonMaterial('#e88');
    const wingR = new THREE.Mesh(wingGeo, wingMat);
    wingR.rotation.y = -Math.PI / 2;
    wingR.rotation.x = -Math.PI / 6;
    wingR.position.set(0, r, r * 0.3);
    group.add(wingR);
    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.rotation.y = Math.PI / 2;
    wingL.rotation.x = -Math.PI / 6;
    wingL.position.set(0, r, -r * 0.3);
    wingL.scale.z = -1;
    group.add(wingL);
    group.userData.mainMat = mat;
    return group;
  },

  // --- Boss Tiger (L4 boss) ---
  createTiger() {
    const group = new THREE.Group();
    const mat = Renderer.createToonMaterial('#fa0');
    // Angular body
    const bodyGeo = new THREE.DodecahedronGeometry(30, 0);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 30;
    body.castShadow = true;
    body.scale.set(1.3, 0.8, 1);
    group.add(body);
    // Stripes
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    for (let i = -1; i <= 1; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(4, 20, 35), stripeMat);
      stripe.position.set(i * 15, 30, 0);
      stripe.rotation.z = i * 0.2;
      group.add(stripe);
    }
    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
    const eyeGeo = new THREE.SphereGeometry(3, 4, 4);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(20, 34, -8);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(20, 34, 8);
    group.add(eyeR);
    group.userData.mainMat = mat;
    return group;
  },

  // --- Scarecrow (L6 enemies) ---
  createScarecrow(isFake) {
    const group = new THREE.Group();
    const color = isFake ? '#a86' : '#a86';
    const mat = Renderer.createToonMaterial(color);
    // Vertical post
    const postGeo = new THREE.BoxGeometry(4, 40, 4);
    const post = new THREE.Mesh(postGeo, mat);
    post.position.y = 20;
    post.castShadow = true;
    group.add(post);
    // Horizontal arms
    const armGeo = new THREE.BoxGeometry(35, 4, 4);
    const arm = new THREE.Mesh(armGeo, mat);
    arm.position.y = 32;
    group.add(arm);
    // Head
    const headGeo = new THREE.SphereGeometry(8, 6, 6);
    const headMat = Renderer.createToonMaterial('#c8a840');
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 46;
    head.castShadow = true;
    group.add(head);
    // Hat
    const hatBrimGeo = new THREE.CylinderGeometry(12, 12, 2, 8);
    const hatMat = Renderer.createToonMaterial('#654');
    const brim = new THREE.Mesh(hatBrimGeo, hatMat);
    brim.position.y = 52;
    group.add(brim);
    const hatTopGeo = new THREE.CylinderGeometry(6, 8, 10, 6);
    const top = new THREE.Mesh(hatTopGeo, hatMat);
    top.position.y = 58;
    group.add(top);
    // Eyes (X marks)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x302010 });
    const eyeGeo = new THREE.BoxGeometry(2, 5, 1);
    for (const ex of [-4, 4]) {
      const e1 = new THREE.Mesh(eyeGeo, eyeMat);
      e1.position.set(ex, 46, 7);
      e1.rotation.z = Math.PI / 4;
      group.add(e1);
      const e2 = new THREE.Mesh(eyeGeo, eyeMat);
      e2.position.set(ex, 46, 7);
      e2.rotation.z = -Math.PI / 4;
      group.add(e2);
    }
    group.userData.mainMat = mat;
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
