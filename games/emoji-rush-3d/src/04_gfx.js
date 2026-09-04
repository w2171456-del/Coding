/* ---------------- emoji atlas (shared by WebGL + Canvas2D renderers) ---------------- */
const Atlas = {
  canvas: null, cell: 128, n: 8, map: new Map(), ready: false,
  build(glyphs, cell) {
    this.cell = cell; const n = this.n = Math.ceil(Math.sqrt(glyphs.length));
    const c = this.canvas = document.createElement('canvas'); c.width = c.height = n * cell;
    const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${Math.floor(cell * 0.76)}px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji','Twemoji Mozilla',sans-serif`;
    glyphs.forEach((g, i) => {
      const col = i % n, row = Math.floor(i / n), cx = col * cell + cell / 2, cy = row * cell + cell / 2 + cell * 0.04;
      ctx.fillText(g, cx, cy);
      this.map.set(g, { i, col, row, u: col / n, v: 1 - (row + 1) / n, w: 1 / n, h: 1 / n, sx: col * cell, sy: row * cell });
    });
    this.ready = true; return c;
  },
  get(g) { return this.map.get(g) || this.map.values().next().value; },
};

/* ---------------- WebGL renderer (three.js) ---------------- */
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js';
const G3D = {
  T: null, ok: false, mode: 'none', cols: 7, rows: 7, rect: { x: 0, y: 0, w: 300, h: 300 }, dpr: 1, dprCap: 2,
  cam: null, scene: null, r: null, tiles: null, faces: null, badges: null, shadows: null, pts: null, panel: null, N: 0,
  shakeT: 0, shakeA: 0, t: 0, blitz: false, showcaseGlyph: null, showcaseColor: 0, dirty: true, fov: 38, lowfx: false,
  P: null, pCount: 0, PMAX: 500,
  async init(canvas) {
    let T;
    // Probe before pulling three.js: no context means no download and no noisy renderer errors.
    try { const p = document.createElement('canvas'), gl = p.getContext('webgl2') || p.getContext('webgl'); if (!gl) throw new Error('no context'); gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch (e) { console.warn('WebGL unavailable, using 2D renderer'); return false; }
    try {
      T = await Promise.race([import(THREE_URL), new Promise((_, rej) => setTimeout(() => rej(new Error('three timeout')), 9000))]);
    } catch (e) { console.warn('three.js unavailable, using 2D renderer', e); return false; }
    try {
      this.T = T; this.canvas = canvas;
      this.lowfx = S.settings.quality === 'low' || (S.settings.quality === 'auto' && IS_MOBILE && (navigator.hardwareConcurrency || 4) <= 4);
      this.dprCap = S.settings.quality === 'high' ? 2.5 : this.lowfx ? 1.25 : IS_MOBILE ? 1.75 : 2;
      const r = this.r = new T.WebGLRenderer({ canvas, antialias: !this.lowfx, alpha: true, powerPreference: 'high-performance', stencil: false, premultipliedAlpha: true });
      r.setClearColor(0x000000, 0); r.outputColorSpace = T.SRGBColorSpace; r.toneMapping = T.NoToneMapping; r.setScissorTest(true);
      this.PMAX = this.lowfx ? 250 : 700;
      const scene = this.scene = new T.Scene();
      const cam = this.cam = new T.PerspectiveCamera(this.fov, 1, 0.5, 100);
      scene.add(new T.HemisphereLight(0xffffff, 0x3b2a7a, this.lowfx ? 1.6 : 1.1));
      const key = new T.DirectionalLight(0xffffff, this.lowfx ? 1.4 : 2.2); key.position.set(-4, 8, 10); scene.add(key);
      const rim = new T.DirectionalLight(0xff7ab0, 0.9); rim.position.set(6, -4, 6); scene.add(rim);
      if (!this.lowfx) this.buildEnv();
      this.buildAssets();
      this.ok = true; return true;
    } catch (e) { console.warn('WebGL init failed, using 2D renderer', e); this.ok = false; return false; }
  },
  buildEnv() {
    const T = this.T, pm = new T.PMREMGenerator(this.r), es = new T.Scene();
    es.add(new T.Mesh(new T.BoxGeometry(30, 30, 30), new T.MeshBasicMaterial({ color: 0x2a1c5e, side: T.BackSide })));
    const lg = new T.PlaneGeometry(8, 4);
    [[0xffffff, 0, 9, 5], [0xff7ab0, -9, 2, 6], [0x67e8f9, 9, 2, 6], [0xffd166, 0, -9, 4]].forEach(([c, x, y, z]) => { const m = new T.Mesh(lg, new T.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); });
    this.scene.environment = pm.fromScene(es, 0.02).texture; pm.dispose();
  },
  roundedRect(w, h, rad) {
    const T = this.T, s = new T.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + rad, y); s.lineTo(x + w - rad, y); s.quadraticCurveTo(x + w, y, x + w, y + rad); s.lineTo(x + w, y + h - rad); s.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    s.lineTo(x + rad, y + h); s.quadraticCurveTo(x, y + h, x, y + h - rad); s.lineTo(x, y + rad); s.quadraticCurveTo(x, y, x + rad, y); return s;
  },
  buildAssets() {
    const T = this.T, N = this.N = this.cols * this.rows * 2 + 4;
    const depth = 0.34, bevel = 0.06;
    // World-space clip plane just inside the panel's top edge so refilling tiles emerge from under it instead of floating above the board.
    this.r.localClippingEnabled = true; this.clip = new T.Plane(new T.Vector3(0, -1, 0), (this.rows + 0.6) / 2 - 0.02);
    const geo = new T.ExtrudeGeometry(this.roundedRect(0.86, 0.86, 0.2), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: 0.045, bevelSegments: this.lowfx ? 2 : 3, curveSegments: this.lowfx ? 4 : 6 });
    geo.translate(0, 0, -depth / 2);
    const bodyMat = this.lowfx ? new T.MeshLambertMaterial({ color: 0xffffff }) : new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.08, envMapIntensity: 0.9 });
    bodyMat.clippingPlanes = [this.clip];
    const tiles = this.tiles = new T.InstancedMesh(geo, bodyMat, N); tiles.instanceMatrix.setUsage(T.DynamicDrawUsage); tiles.frustumCulled = false;
    const white = new T.Color(1, 1, 1); for (let i = 0; i < N; i++) tiles.setColorAt(i, white); tiles.instanceColor.setUsage(T.DynamicDrawUsage);
    this.scene.add(tiles);
    this.tex = new T.CanvasTexture(Atlas.canvas); this.tex.colorSpace = T.SRGBColorSpace; this.tex.anisotropy = Math.min(4, this.r.capabilities.getMaxAnisotropy()); this.tex.generateMipmaps = true; this.tex.minFilter = T.LinearMipmapLinearFilter;
    const faceMat = new T.ShaderMaterial({
      uniforms: { map: { value: this.tex } }, transparent: true, depthWrite: false, clipping: true, clippingPlanes: [this.clip],
      vertexShader: `attribute vec4 aTile; varying vec2 vUv2;
        #include <clipping_planes_pars_vertex>
        void main(){ vUv2 = aTile.xy + uv * aTile.zw;
        #ifdef USE_INSTANCING
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position,1.0);
        #else
        vec4 mvPosition = modelViewMatrix * vec4(position,1.0);
        #endif
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
        }`,
      fragmentShader: `uniform sampler2D map; varying vec2 vUv2;
        #include <clipping_planes_pars_fragment>
        void main(){
        #include <clipping_planes_fragment>
        vec4 c = texture2D(map, vUv2); if (c.a < 0.03) discard; gl_FragColor = c;
        #include <colorspace_fragment>
        }`,
    });
    const mkFaces = (size, z) => {
      const g = new T.PlaneGeometry(size, size); g.translate(0, 0, z);
      const attr = new T.InstancedBufferAttribute(new Float32Array(N * 4), 4); attr.setUsage(T.DynamicDrawUsage); g.setAttribute('aTile', attr);
      const m = new T.InstancedMesh(g, faceMat, N); m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.frustumCulled = false; this.scene.add(m); return m;
    };
    this.faces = mkFaces(0.74, depth / 2 + bevel + 0.012);
    this.badges = mkFaces(0.36, depth / 2 + bevel + 0.03);
    // soft contact shadows
    const sc = document.createElement('canvas'); sc.width = sc.height = 64; const sx = sc.getContext('2d'); const gr = sx.createRadialGradient(32, 32, 6, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = gr; sx.fillRect(0, 0, 64, 64);
    const st = new T.CanvasTexture(sc);
    const sg = new T.PlaneGeometry(1.5, 1.5); sg.translate(0.08, -0.14, -depth / 2 - 0.16);
    this.shadows = new T.InstancedMesh(sg, new T.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, opacity: 0.9, clippingPlanes: [this.clip] }), N); this.shadows.instanceMatrix.setUsage(T.DynamicDrawUsage); this.shadows.frustumCulled = false; this.scene.add(this.shadows);
    // board panel
    this.panelMat = new T.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.95 });
    this.panel = new T.Mesh(new T.PlaneGeometry(1, 1), this.panelMat); this.panel.position.z = -depth / 2 - 0.3; this.scene.add(this.panel);
    this.buildPanel();
    // particles
    const PM = this.PMAX, pg = new T.BufferGeometry();
    pg.setAttribute('position', new T.BufferAttribute(new Float32Array(PM * 3), 3).setUsage(T.DynamicDrawUsage));
    pg.setAttribute('aColor', new T.BufferAttribute(new Float32Array(PM * 3), 3).setUsage(T.DynamicDrawUsage));
    pg.setAttribute('aSize', new T.BufferAttribute(new Float32Array(PM), 1).setUsage(T.DynamicDrawUsage));
    pg.setAttribute('aAlpha', new T.BufferAttribute(new Float32Array(PM), 1).setUsage(T.DynamicDrawUsage));
    this.pMat = new T.ShaderMaterial({
      uniforms: { uScale: { value: 300 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aAlpha; varying vec3 vC; varying float vA; uniform float uScale;
        void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); float a = smoothstep(0.5, 0.1, r) * vA; gl_FragColor = vec4(vC * a, a);
        #include <colorspace_fragment>
        }`,
    });
    this.pts = new T.Points(pg, this.pMat); this.pts.frustumCulled = false; this.scene.add(this.pts);
    this.P = { x: new Float32Array(PM), y: new Float32Array(PM), z: new Float32Array(PM), vx: new Float32Array(PM), vy: new Float32Array(PM), vz: new Float32Array(PM), life: new Float32Array(PM), max: new Float32Array(PM), size: new Float32Array(PM), r: new Float32Array(PM), g: new Float32Array(PM), b: new Float32Array(PM), grav: new Float32Array(PM) };
    this.pCount = 0;
    this._m = new T.Matrix4(); this._q = new T.Quaternion(); this._p = new T.Vector3(); this._s = new T.Vector3(); this._c = new T.Color(); this._e = new T.Euler();
    this._plane = new T.Plane(new T.Vector3(0, 0, 1), 0); this._ray = new T.Raycaster(); this._v2 = new T.Vector2(); this._hit = new T.Vector3();
    this.hide(0);
  },
  buildPanel() {
    const T = this.T, cols = this.cols, rows = this.rows, px = 48, c = document.createElement('canvas');
    c.width = (cols + 0.6) * px; c.height = (rows + 0.6) * px; const x = c.getContext('2d');
    const rr = (X, Y, W, Hh, R) => { x.beginPath(); x.roundRect(X, Y, W, Hh, R); };
    rr(0, 0, c.width, c.height, px * 0.5); x.fillStyle = 'rgba(8,4,30,.62)'; x.fill(); x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,.14)'; x.stroke();
    for (let r = 0; r < rows; r++) for (let cc = 0; cc < cols; cc++) { rr((cc + 0.3) * px + 3, (r + 0.3) * px + 3, px - 6, px - 6, px * 0.2); x.fillStyle = (r + cc) % 2 ? 'rgba(255,255,255,.055)' : 'rgba(255,255,255,.03)'; x.fill(); }
    if (this.panelMat.map) this.panelMat.map.dispose();
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; this.panelMat.map = t; this.panelMat.needsUpdate = true;
    this.panel.scale.set(cols + 0.6, rows + 0.6, 1);
    if (this.clip) this.clip.constant = (rows + 0.6) / 2 - 0.02;
  },
  setGrid(cols, rows) { if (cols === this.cols && rows === this.rows && this.panel) return; this.cols = cols; this.rows = rows; if (this.ok) { this.buildPanel(); this.fit(); } },
  setRect(rect) { this.rect = rect; this.clearFrame(); this.fit(); },
  fit() {
    if (!this.ok) return;
    const { w, h } = this.rect, aspect = Math.max(0.2, w / Math.max(1, h));
    const cam = this.cam, vf = this.fov * Math.PI / 180, W = this.cols + 0.9, Hh = this.rows + 0.9;
    let d = Math.max((Hh / 2) / Math.tan(vf / 2), (W / 2) / (Math.tan(vf / 2) * aspect)) * 1.04;
    if (this.mode === 'showcase') d = Math.max(1.36 / Math.tan(vf / 2), 1.67 / (Math.tan(vf / 2) * aspect)); // hero tile ~55% of height or ~45% of width
    this.camDist = d; cam.aspect = aspect; cam.updateProjectionMatrix();
    this.halfW = d * Math.tan(vf / 2) * aspect;
    this.pMat.uniforms.uScale.value = h * this.dpr * 0.5 / Math.tan(vf / 2);
    this.dirty = true;
  },
  resize() {
    if (!this.ok) return;
    const w = innerWidth, h = innerHeight; this.dpr = Math.min(devicePixelRatio || 1, this.dprCap);
    this.r.setPixelRatio(this.dpr); this.r.setSize(w, h, false); this.fit();
  },
  setDprCap(v) { this.dprCap = v; this.resize(); },
  setMode(m) { this.mode = m; this.clearFrame(); this.fit(); this.dirty = true; if (m !== 'board') this.hide(0); },
  hide(from) { for (let i = from; i < this.N; i++) { this._m.makeScale(0, 0, 0); this.tiles.setMatrixAt(i, this._m); this.faces.setMatrixAt(i, this._m); this.badges.setMatrixAt(i, this._m); this.shadows.setMatrixAt(i, this._m); } this.tiles.count = this.faces.count = this.badges.count = this.shadows.count = 0; this.flag(); },
  flag() { this.tiles.instanceMatrix.needsUpdate = true; this.faces.instanceMatrix.needsUpdate = true; this.badges.instanceMatrix.needsUpdate = true; this.shadows.instanceMatrix.needsUpdate = true; this.tiles.instanceColor.needsUpdate = true; this.faces.geometry.attributes.aTile.needsUpdate = true; this.badges.geometry.attributes.aTile.needsUpdate = true; this.dirty = true; },
  wx(c) { return c - (this.cols - 1) / 2; }, wy(r) { return (this.rows - 1) / 2 - r; },
  // views: array of {x,y,z,s,rot,tilt,color,glyph,badge}; x,y in board units (col,row floats)
  drawTiles(views, n) {
    if (!this.ok) return;
    const m = this._m, q = this._q, p = this._p, s = this._s, e = this._e, fa = this.faces.geometry.attributes.aTile.array, ba = this.badges.geometry.attributes.aTile.array;
    let k = 0;
    for (let i = 0; i < n; i++) {
      const v = views[i]; if (!v || v.s <= 0.001) continue;
      p.set(this.wx(v.x), this.wy(v.y), v.z || 0); e.set(v.tilt || 0, v.rot || 0, 0); q.setFromEuler(e); s.set(v.s, v.s, v.s); m.compose(p, q, s);
      this.tiles.setMatrixAt(k, m); this.faces.setMatrixAt(k, m); this.shadows.setMatrixAt(k, m);
      this._c.setHex(v.color); this.tiles.setColorAt(k, this._c);
      const g = v.glyph; fa[k * 4] = g.u; fa[k * 4 + 1] = g.v; fa[k * 4 + 2] = g.w; fa[k * 4 + 3] = g.h;
      if (v.badge) { p.set(this.wx(v.x) + 0.27 * v.s, this.wy(v.y) + 0.27 * v.s, (v.z || 0) + 0.05); s.set(v.s, v.s, v.s); m.compose(p, q, s); this.badges.setMatrixAt(k, m); const b = v.badge; ba[k * 4] = b.u; ba[k * 4 + 1] = b.v; ba[k * 4 + 2] = b.w; ba[k * 4 + 3] = b.h; }
      else { m.makeScale(0, 0, 0); this.badges.setMatrixAt(k, m); }
      k++;
    }
    this.tiles.count = this.faces.count = this.badges.count = this.shadows.count = k; this.flag();
  },
  burst(x, y, hex, count, o = {}) {
    if (!this.ok) return;
    const P = this.P, PM = this.PMAX; this._c.setHex(hex);
    const wx = this.wx(x), wy = this.wy(y), spd = o.speed || 4;
    for (let i = 0; i < count; i++) {
      const k = this.pCount < PM ? this.pCount++ : Math.floor(Math.random() * PM);
      const a = Math.random() * Math.PI * 2, sp = spd * (0.3 + Math.random());
      P.x[k] = wx + (Math.random() - .5) * 0.4; P.y[k] = wy + (Math.random() - .5) * 0.4; P.z[k] = 0.4 + Math.random() * 0.3;
      P.vx[k] = Math.cos(a) * sp; P.vy[k] = Math.sin(a) * sp + (o.up || 1.5); P.vz[k] = 1 + Math.random() * 3;
      P.life[k] = P.max[k] = (o.life || 0.6) * (0.6 + Math.random() * 0.7); P.size[k] = (o.size || 0.22) * (0.5 + Math.random());
      const tint = 0.7 + Math.random() * 0.5; P.r[k] = Math.min(1, this._c.r * tint + (o.white ? .3 : 0)); P.g[k] = Math.min(1, this._c.g * tint + (o.white ? .3 : 0)); P.b[k] = Math.min(1, this._c.b * tint + (o.white ? .3 : 0)); P.grav[k] = o.grav === undefined ? 9 : o.grav;
    }
    this.dirty = true;
  },
  shake(a) { this.shakeA = Math.max(this.shakeA, a); this.shakeT = 0.4; },
  update(dt) {
    if (!this.ok) return;
    this.t += dt;
    // particles
    const P = this.P, pos = this.pts.geometry.attributes.position.array, col = this.pts.geometry.attributes.aColor.array, sz = this.pts.geometry.attributes.aSize.array, al = this.pts.geometry.attributes.aAlpha.array;
    let n = this.pCount, live = 0;
    for (let i = 0; i < n; i++) {
      if (P.life[i] <= 0) continue;
      P.life[i] -= dt; P.vy[i] -= P.grav[i] * dt; P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt; P.vz[i] -= 4 * dt;
      const j = live * 3, f = Math.max(0, P.life[i] / P.max[i]);
      pos[j] = P.x[i]; pos[j + 1] = P.y[i]; pos[j + 2] = P.z[i]; col[j] = P.r[i]; col[j + 1] = P.g[i]; col[j + 2] = P.b[i]; sz[live] = P.size[i] * (0.5 + f); al[live] = f * f; live++;
    }
    if (live === 0 && n > 0) { let anyAlive = false; for (let i = 0; i < n; i++) if (P.life[i] > 0) { anyAlive = true; break; } if (!anyAlive) this.pCount = 0; }
    this.pts.geometry.setDrawRange(0, live);
    const ga = this.pts.geometry.attributes; ga.position.needsUpdate = ga.aColor.needsUpdate = ga.aSize.needsUpdate = ga.aAlpha.needsUpdate = true;
    if (live) this.dirty = true;
    // camera
    const cam = this.cam, d = this.camDist || 12;
    if (this.mode === 'showcase') { cam.position.set(Math.sin(this.t * 0.35) * 0.6, -0.7 + Math.sin(this.t * 0.5) * 0.15, d); cam.lookAt(0, 0.1, 0); this.dirty = true; }
    else {
      let ox = 0, oy = 0;
      if (this.shakeT > 0) { this.shakeT -= dt; const k = this.shakeA * this.shakeT / 0.4; ox = (Math.random() - .5) * k; oy = (Math.random() - .5) * k; this.dirty = true; if (this.shakeT <= 0) this.shakeA = 0; }
      const sway = this.blitz ? Math.sin(this.t * 6) * 0.08 : 0;
      cam.position.set(ox + sway, -d * 0.22 + oy, d * 0.975); cam.lookAt(0, 0.15, 0);
      if (this.blitz) this.dirty = true;
    }
  },
  render() {
    if (!this.ok || this.mode === 'none' || !this.dirty) return;
    const r = this.r, { x, y, w, h } = this.rect, H = innerHeight;
    r.setViewport(x, H - y - h, w, h); r.setScissor(x, H - y - h, w, h);
    r.clear(); r.render(this.scene, this.cam); this.dirty = false;
  },
  clearFrame() { if (this.ok) { this.r.setScissorTest(false); this.r.clear(); this.r.setScissorTest(true); } },
  project(x, y, z = 0) {
    if (!this.ok) return null;
    this._p.set(this.wx(x), this.wy(y), z).project(this.cam);
    return { sx: this.rect.x + (this._p.x + 1) / 2 * this.rect.w, sy: this.rect.y + (1 - this._p.y) / 2 * this.rect.h };
  },
  pick(cx, cy) {
    if (!this.ok) return null;
    this._v2.set(((cx - this.rect.x) / this.rect.w) * 2 - 1, -((cy - this.rect.y) / this.rect.h) * 2 + 1);
    this._ray.setFromCamera(this._v2, this.cam);
    if (!this._ray.ray.intersectPlane(this._plane, this._hit)) return null;
    return { x: this._hit.x + (this.cols - 1) / 2, y: (this.rows - 1) / 2 - this._hit.y };
  },
  setBlitz(b) { this.blitz = b; this.dirty = true; },
};

/* ---------------- Canvas2D fallback renderer (same interface) ---------------- */
const G2D = {
  ok: false, mode: 'none', cols: 7, rows: 7, rect: { x: 0, y: 0, w: 300, h: 300 }, cell: 40, dpr: 1, dprCap: 2, blitz: false, t: 0, dirty: true, shakeT: 0, shakeA: 0, parts: [], views: null, n: 0,
  init(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.ok = !!this.ctx; return this.ok; },
  setGrid(c, r) { this.cols = c; this.rows = r; this.fit(); }, setRect(r) { this.rect = r; this.fit(); },
  fit() { const { w, h } = this.rect; this.cell = Math.min(w / (this.cols + 0.9), h / (this.rows + 0.9)); if (this.mode === 'showcase') this.cell = Math.min(w * 0.3, h * 0.36); this.halfW = w / 2 / this.cell; this.dirty = true; },
  resize() { this.dpr = Math.min(devicePixelRatio || 1, this.dprCap); this.canvas.width = innerWidth * this.dpr; this.canvas.height = innerHeight * this.dpr; this.fit(); },
  setDprCap(v) { this.dprCap = v; this.resize(); },
  setMode(m) { this.mode = m; this.n = 0; this.clearFrame(); this.fit(); },
  hide() { this.n = 0; this.dirty = true; },
  cx(x) { return this.rect.x + this.rect.w / 2 + (x - (this.cols - 1) / 2) * this.cell; }, cy(y) { return this.rect.y + this.rect.h / 2 + (y - (this.rows - 1) / 2) * this.cell; },
  drawTiles(v, n) { this.views = v; this.n = n; this.dirty = true; },
  burst(x, y, hex, count, o = {}) { const c = '#' + hex.toString(16).padStart(6, '0'); for (let i = 0; i < count && this.parts.length < 400; i++) { const a = Math.random() * Math.PI * 2, sp = (o.speed || 4) * (0.3 + Math.random()); this.parts.push({ x: this.cx(x), y: this.cy(y), vx: Math.cos(a) * sp * this.cell, vy: -Math.sin(a) * sp * this.cell - this.cell * 1.5, life: (o.life || .6) * (0.6 + Math.random() * .7), max: 1, c, s: (o.size || .22) * this.cell * (0.5 + Math.random()) }); this.parts[this.parts.length - 1].max = this.parts[this.parts.length - 1].life; } },
  shake(a) { this.shakeA = Math.max(this.shakeA, a); this.shakeT = 0.4; },
  update(dt) { this.t += dt; for (let i = this.parts.length - 1; i >= 0; i--) { const p = this.parts[i]; p.life -= dt; p.vy += 9 * this.cell * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.life <= 0) this.parts.splice(i, 1); } if (this.parts.length || this.shakeT > 0 || this.mode === 'showcase') this.dirty = true; if (this.shakeT > 0) this.shakeT -= dt; },
  render() {
    if (!this.ok || this.mode === 'none' || !this.dirty) return; this.dirty = false;
    const x = this.ctx, d = this.dpr; x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, innerWidth, innerHeight);
    const R = this.rect; x.save(); x.beginPath(); x.rect(R.x, R.y, R.w, R.h); x.clip();
    if (this.shakeT > 0) { const k = this.shakeA * this.shakeT / 0.4 * this.cell * 0.3; x.translate((Math.random() - .5) * k, (Math.random() - .5) * k); }
    const board = this.mode === 'board';
    if (board) { const bw = (this.cols + 0.6) * this.cell, bh = (this.rows + 0.6) * this.cell, bx = R.x + R.w / 2 - bw / 2, by = R.y + R.h / 2 - bh / 2; x.fillStyle = 'rgba(8,4,30,.62)'; x.beginPath(); x.roundRect(bx, by, bw, bh, this.cell * .5); x.fill(); x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = 2; x.stroke(); x.save(); x.clip(); } // tiles dropping in stay hidden until they enter the panel (matches the G3D clip planes)
    const cs = this.cell, glyphPx = Math.floor(cs * 0.6);
    const arr = (this.views || []).slice(0, this.n).filter(v => v && v.s > 0.001).sort((a, b) => (a.z || 0) - (b.z || 0));
    for (const v of arr) {
      const px = this.cx(v.x), py = this.cy(v.y) - (v.z || 0) * cs * 0.35, sz = cs * 0.86 * v.s, h = sz / 2;
      x.save(); x.translate(px, py); if (v.rot) x.rotate(v.rot * 0.5);
      const c = '#' + v.color.toString(16).padStart(6, '0');
      x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.roundRect(-h + cs * .05, -h + cs * .12, sz, sz, sz * .22); x.fill();
      x.fillStyle = this.shade(c, -0.35); x.beginPath(); x.roundRect(-h, -h + cs * .08, sz, sz, sz * .22); x.fill();
      const g = x.createLinearGradient(0, -h, 0, h); g.addColorStop(0, this.shade(c, .25)); g.addColorStop(1, c); x.fillStyle = g; x.beginPath(); x.roundRect(-h, -h, sz, sz, sz * .22); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1.5; x.stroke();
      const gl = v.glyph, sc = Atlas.cell; x.drawImage(Atlas.canvas, gl.sx, gl.sy, sc, sc, -glyphPx * v.s * .75, -glyphPx * v.s * .75, glyphPx * 1.5 * v.s, glyphPx * 1.5 * v.s);
      if (v.badge) { const b = v.badge, bs = glyphPx * 0.7 * v.s; x.drawImage(Atlas.canvas, b.sx, b.sy, sc, sc, h - bs, -h - bs * .1, bs, bs); }
      x.restore();
    }
    if (board) x.restore();
    for (const p of this.parts) { x.globalAlpha = Math.max(0, p.life / p.max); x.fillStyle = p.c; x.beginPath(); x.arc(p.x, p.y, p.s, 0, 7); x.fill(); }
    x.globalAlpha = 1; x.restore();
  },
  clearFrame() { const x = this.ctx; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, this.canvas.width, this.canvas.height); },
  shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = v => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)))); return `rgb(${f(r)},${f(g)},${f(b)})`; },
  project(x, y) { return { sx: this.cx(x), sy: this.cy(y) }; },
  pick(cx, cy) { return { x: (cx - this.rect.x - this.rect.w / 2) / this.cell + (this.cols - 1) / 2, y: (cy - this.rect.y - this.rect.h / 2) / this.cell + (this.rows - 1) / 2 }; },
  setBlitz(b) { this.blitz = b; },
};
let GFX = G3D;
