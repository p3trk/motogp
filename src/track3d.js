// --- 3D ground (GDD 11o, phase 1): the ground bands (near and far, GDD 11a) are drawn by the GPU as textured planes
// in the three.js scene of the 3D bikes, with the same camera (gl3DProjection). This replaces projectTilted's one
// drawImage per screen row (about 1,000 a frame, the cost that held Chrome and Brave at 30 fps, GDD 11n). The speed
// blur (GDD 11f) is the same three zoomed copies, done by a shader on a 1/4 resolution image of the ground.
// The sky stays on the 2D game canvas under the 3D layer. Classic graphics, Top-down and machines without WebGL keep
// the 2D projection.
const GROUND = { ready: false, scene: null, quads: [], tex: new Map(), blur: null, rt: null, mask: null, maskCtx: null, maskTex: null };

// the ground is drawn in 3D: tilted camera, 3D graphics, WebGL running
function ground3DOn() { return useBike3D() && camTilted() && gl3DInit(); }

// a point of the ground canvas (css px of RW x RH) in the projection frame of gl3DProjection: the road plane
function groundPoint(cx, cy) {
  const v = cy - RH, a = tiltA();
  return [cx - RW / 2, v * Math.cos(a), v * Math.sin(a)];
}

// one textured quad of the ground: canvas rect x0..x1, y0..y1 (css px), texture rows v0..v1 (1 = top of the image),
// alpha a0 at the top edge and a1 at the bottom edge (the far band fades in over the near band)
function groundQuad(q, x0, y0, x1, y1, v0, v1, a0, a1) {
  const pos = q.geometry.attributes.position.array, uv = q.geometry.attributes.uv.array, col = q.geometry.attributes.color.array;
  const corners = [[x0, y0, 0, v0, a0], [x1, y0, 1, v0, a0], [x1, y1, 1, v1, a1], [x0, y1, 0, v1, a1]];
  corners.forEach(([cx, cy, u, v, a], i) => {
    pos.set(groundPoint(cx, cy), i * 3); uv[i * 2] = u; uv[i * 2 + 1] = v;
    col[i * 4] = col[i * 4 + 1] = col[i * 4 + 2] = 1; col[i * 4 + 3] = a;
  });
  q.geometry.attributes.position.needsUpdate = q.geometry.attributes.uv.needsUpdate = q.geometry.attributes.color.needsUpdate = true;
  q.visible = true;
}

// a canvas as a texture, made again when the canvas changes size (three.js keeps the GPU storage at its first size)
function groundTexture(c) {
  let t = GROUND.tex.get(c);
  if (t && (t.userData.w !== c.width || t.userData.h !== c.height)) { t.dispose(); t = null; }
  if (!t) {
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
    t.userData.w = c.width; t.userData.h = c.height; GROUND.tex.set(c, t);
  }
  t.needsUpdate = true;
  return t;
}

// the meshes: three ground quads (near band, far band fading in, far band) and the blur pass, built once
function ground3DInit() {
  if (GROUND.ready) { return; }
  GROUND.scene = new THREE.Scene();
  for (let k = 0; k < 3; k++) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(8), 2));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(16), 4));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: k === 1, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
    m.frustumCulled = false; m.renderOrder = k; GROUND.scene.add(m); GROUND.quads.push(m);
  }
  GROUND.blur = ground3DBlurMesh();
  GROUND.ready = true;
}

// the GLSL type of a uniform value: a number, a pair of numbers, or a texture
function glslType(v) {
  if (typeof v === 'number') { return 'float'; }
  return Array.isArray(v) ? 'vec2' : 'sampler2D';
}
// a full-screen pass: a quad over the whole target with its own fragment shader
function ground3DPass(uniforms, body, transparent) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const decl = Object.keys(uniforms).map(n => `uniform ${glslType(uniforms[n].value)} ${n};`).join(' ');
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `${decl} varying vec2 vUv;\nvoid main() {\n${body}\n  #include <colorspace_fragment>\n}`,
    transparent, depthTest: false, depthWrite: false
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(m);
  return { mesh: m, scene };
}

// the blur in two passes (GDD 11f). Zoom: at 1/4 resolution, the 1/2 resolution ground image zoomed about the horizon
// point from 1 to 1 + k times in 8 equal steps, with the road and the bikes cut out by the mask (as alpha). 8 steps,
// not the 2D blur's 3 copies: the GPU samples without averaging, so 3 copies showed as separate images. Show: that
// image stretched over the screen at strength s, one sample per pixel. The sky is not in the ground image, so it is
// not hazed over (it is smooth anyway).
function ground3DBlurMesh() {
  const zoom = ground3DPass({ src: { value: null }, mask: { value: null }, hz: { value: [0.5, 0.5] }, k: { value: 0 } }, [
    '  vec4 c = vec4(0.0);',
    '  for (int i = 0; i < 8; i++) { c += texture2D(src, hz + (vUv - hz) / (1.0 + k * float(i) / 7.0)); }',
    '  c /= 8.0;',
    '  gl_FragColor = vec4(c.rgb / max(c.a, 0.001), c.a * (1.0 - texture2D(mask, vUv).a));'].join('\n'), false);
  const show = ground3DPass({ src: { value: null }, s: { value: 0 } }, '  vec4 c = texture2D(src, vUv);\n  gl_FragColor = vec4(c.rgb, s * c.a);', true);
  return { zoom, show };
}

// places the ground quads for this frame from the band layout of resize() (LAYERS: far, near)
function ground3DPlace() {
  const far = LAYERS[0], near = LAYERS[1], hN = near.h, hB = far.hB, hF = hN - hB;
  const [qN, qFade, qFar] = GROUND.quads;
  qN.material.map = groundTexture(near.c); qFade.material.map = qFar.material.map = groundTexture(far.c);
  qN.material.needsUpdate = qFade.material.needsUpdate = qFar.material.needsUpdate = !qN.userData.mapped;
  qN.userData.mapped = true;
  const fv = cy => 1 - (cy - far.y0) / far.h; // texture row of the far band at canvas row cy
  groundQuad(qN, near.x0, near.y0, near.x0 + near.w, near.y0 + hN, 1, 0, 1, 1);
  groundQuad(qFade, far.x0, RH - hN, far.x0 + far.w, RH - hF, fv(RH - hN), fv(RH - hF), 1, 0); // fades in from hF up to hN
  groundQuad(qFar, far.x0, far.y0, far.x0 + far.w, RH - hN, 1, fv(RH - hN), 1, 1);
}

// the screen mask of the blur: the road with its kerbs and the bikes (white), on a 1/4 resolution canvas
function ground3DMask(Q, w, h) {
  if (!GROUND.mask) { GROUND.mask = mkCanvas(1, 1); GROUND.maskCtx = GROUND.mask.getContext('2d'); }
  const c = GROUND.mask, g = GROUND.maskCtx;
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; if (GROUND.maskTex) { GROUND.maskTex.dispose(); GROUND.maskTex = null; } }
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); g.setTransform(Q, 0, 0, Q, 0, 0);
  g.fillStyle = g.strokeStyle = '#fff'; g.lineWidth = 6; g.lineJoin = 'round'; // the stroke keeps the soft mask edge outside the margin
  for (const run of blurRoadRuns()) { g.beginPath(); g.moveTo(run[0], run[1]); for (let j = 2; j < run.length; j += 2) { g.lineTo(run[j], run[j + 1]); } g.closePath(); g.fill(); g.stroke(); }
  g.beginPath(); for (const [x, y, rx, ry] of blurBikeSpots()) { g.moveTo(x + rx, y); g.ellipse(x, y, rx, ry, 0, 0, TAU); } g.fill();
  if (!GROUND.maskTex) { GROUND.maskTex = new THREE.CanvasTexture(c); GROUND.maskTex.minFilter = GROUND.maskTex.magFilter = THREE.LinearFilter; GROUND.maskTex.generateMipmaps = false; }
  GROUND.maskTex.needsUpdate = true;
  return GROUND.maskTex;
}

// the speed blur over the ground, when the speed calls for it: ground at 1/2 resolution into a render target, the
// zoom pass into a 1/4 one, then shown over the screen
function ground3DBlur(r) {
  const s = BLUR.s = blurStrength(); if (s <= 0.01) { return false; }
  const Q = 0.25, w = Math.max(1, Math.ceil(VW * Q)), h = Math.max(1, Math.ceil(VH * Q)), rw = 2 * w, rh = 2 * h; // image at 1/2: the GPU samples without averaging, so 1/4 shimmered
  GROUND.rt = ground3DTarget(GROUND.rt, rw, rh); GROUND.rtZ = ground3DTarget(GROUND.rtZ, w, h);
  r.setRenderTarget(GROUND.rt); r.clear(); r.render(GROUND.scene, GL3D.cam);
  const P = tiltP(), uTop = RH * Math.cos(tiltA()) * P / (P + RH * Math.sin(tiltA())), hx = VW / 2, hy = Math.max(0, VH - uTop);
  const far = Math.hypot(VW / 2, Math.max(hy, VH - hy)), u = GROUND.blur.zoom.mesh.material.uniforms, us = GROUND.blur.show.mesh.material.uniforms;
  u.src.value = GROUND.rt.texture; u.mask.value = ground3DMask(Q, w, h); u.hz.value = [hx / VW, 1 - hy / VH]; u.k.value = TILT.bs * s / far;
  r.setRenderTarget(GROUND.rtZ); r.clear(); r.render(GROUND.blur.zoom.scene, GL3D.cam);
  r.setRenderTarget(null); us.src.value = GROUND.rtZ.texture; us.s.value = s;
  r.render(GROUND.blur.show.scene, GL3D.cam);
  return true;
}

// a render target of this size, made again when the size changes
function ground3DTarget(t, w, h) {
  if (t && t.width === w && t.height === h) { return t; }
  if (t) { t.dispose(); }
  return new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
}

// draws the ground (and the blur) on the 3D canvas, which gl3DDraw has just cleared and set the camera of
function ground3DRender() {
  ground3DInit(); ground3DPlace();
  const r = GL3D.renderer;
  r.render(GROUND.scene, GL3D.cam);
  ground3DBlur(r);
}

// the sky on the 2D game canvas, under the 3D ground: gradient down to the far edge of the ground, haze below it
// where a narrow ground does not reach the screen sides (as projectTilted draws it)
function drawSky(g, uTop) {
  g.setTransform(ODPR, 0, 0, ODPR, 0, 0);
  const sky = g.createLinearGradient(0, 0, 0, VH - uTop + 2); sky.addColorStop(0, '#6fa3d2'); sky.addColorStop(1, '#c9d8de');
  g.fillStyle = sky; g.fillRect(0, 0, VW, VH - uTop + 2);
  g.fillStyle = '#c9d8de'; g.fillRect(0, VH - uTop, VW, uTop);
}
