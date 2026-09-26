// 3D 显示：每块砖一个 Mesh（砖身 + 凸点合并成一个几何体，同尺寸共用）。
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COLORS } from '../core/catalog.js';

const GAP = 0.03;
const STUD_R = 0.3;
const STUD_H = 0.2;
const HIGHLIGHT = 0xff8a00;

export function createViewer(canvas, model) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const { x0, x1, z0, z1, y1 } = model.bounds;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const H = model.layerHeight;
  const height = y1 * H;
  let focusY = height * 0.47;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c3cf, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(14, height + 10, 26);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: height + 10, bottom: -10, near: 1, far: 160 });
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(-20, 10, -10);
  scene.add(fill);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(20, 64), new THREE.ShadowMaterial({ opacity: 0.18 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 400);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.addEventListener('start', () => (zooming = false));
  controls.minDistance = 12;
  controls.maxDistance = 160;
  // 默认视角：右前方稍高，整个模型留一圈边
  // 拼装步骤里只看已经拼到的高度（至少 35%），不然高的作品一开始的几层小得看不清
  let viewHeight = height;
  let zooming = false;
  const distanceFor = (h) => {
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const byHeight = (h * 0.62) / tan;
    const byWidth = ((x1 - x0) * 0.75) / (tan * camera.aspect);
    return Math.max(byHeight, byWidth) + (z1 - z0) / 2;
  };
  const fitCamera = () => {
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const byHeight = (viewHeight * 0.62) / tan;
    const byWidth = ((x1 - x0) * 0.75) / (tan * camera.aspect);
    const dist = Math.max(byHeight, byWidth) + (z1 - z0) / 2;
    const dir = new THREE.Vector3(0.5, 0.28, 0.82).normalize();
    controls.target.set(0, focusY, 0);
    camera.position.copy(controls.target).addScaledVector(dir, dist);
    controls.update();
  };

  // 几何体和材质缓存
  const geometries = new Map();
  const brickGeometry = (w, d) => {
    const k = `${w}x${d}x${H}`;
    if (geometries.has(k)) return geometries.get(k);
    const parts = [new THREE.BoxGeometry(w - GAP * 2, H - GAP, d - GAP * 2).translate(0, (H - GAP) / 2, 0)];
    for (let i = 0; i < w; i++)
      for (let j = 0; j < d; j++)
        parts.push(
          new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 16).translate(
            i - w / 2 + 0.5,
            H + STUD_H / 2 - GAP,
            j - d / 2 + 0.5,
          ),
        );
    const g = mergeGeometries(parts.map((p) => p.toNonIndexed()));
    const edges = new THREE.EdgesGeometry(parts[0]);
    geometries.set(k, { g, edges });
    return geometries.get(k);
  };
  const materials = Object.fromEntries(
    Object.entries(COLORS).map(([name, c]) => [
      name,
      {
        solid: new THREE.MeshStandardMaterial({ color: c.hex, roughness: 0.32, metalness: 0 }),
        ghost: new THREE.MeshStandardMaterial({ color: c.hex, roughness: 0.5, transparent: true, opacity: 0.1, depthWrite: false }),
      },
    ]),
  );
  const edgeNormal = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 });
  const edgeHighlight = new THREE.LineBasicMaterial({ color: HIGHLIGHT });

  const meshes = model.bricks.map((b) => {
    const { g, edges } = brickGeometry(b.w, b.d);
    const mesh = new THREE.Mesh(g, materials[b.color].solid);
    // 只在地面投影；砖身上的阴影在屏幕上看起来像半透明的灰块，干扰看颜色
    mesh.castShadow = true;
    const home = new THREE.Vector3(b.x + b.w / 2 - cx, b.y * H, b.z + b.d / 2 - cz);
    mesh.position.copy(home);
    mesh.userData = { brick: b, home };
    const line = new THREE.LineSegments(edges, edgeNormal);
    mesh.add(line);
    mesh.userData.line = line;
    scene.add(mesh);
    return mesh;
  });

  // 状态：visible / ghost / 高亮描边 / 掉落动画
  let drops = [];
  const apply = (state) => {
    const now = performance.now();
    drops = [];
    meshes.forEach((m, i) => {
      const s = state(model.bricks[i]);
      m.visible = s !== 'hidden';
      m.material = s === 'ghost' ? materials[m.userData.brick.color].ghost : materials[m.userData.brick.color].solid;
      m.castShadow = s !== 'ghost';
      m.userData.line.material = s === 'current' ? edgeHighlight : edgeNormal;
      m.userData.line.visible = s !== 'ghost';
      m.position.copy(m.userData.home);
      if (s === 'current') drops.push({ m, start: now + (i % 7) * 25 });
    });
  };

  const showAll = () => {
    apply(() => 'solid');
    focusY = height * 0.47;
    viewHeight = height;
    zooming = true;
  };
  const showStep = (steps, index) => {
    const done = new Set(steps.slice(0, index).flatMap((s) => s.bricks));
    const current = new Set(steps[index].bricks);
    apply((b) => (current.has(b.id) ? 'current' : done.has(b.id) ? 'solid' : 'hidden'));
    // 镜头跟着正在拼的那一层上下移动
    const top = (Math.max(...steps[index].bricks.map((id) => model.bricks[id].y)) + 1) * H;
    viewHeight = Math.max(top * 1.15, height * 0.35);
    focusY = THREE.MathUtils.clamp(top * 0.6, viewHeight * 0.35, height * 0.6);
    zooming = true;
  };
  const highlight = (match) => apply((b) => (match(b) ? 'solid' : 'ghost'));

  // 悬停提示
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let onHover = () => {};
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(meshes.filter((m) => m.visible && m.material.opacity === 1), false)[0];
    onHover(hit ? hit.object.userData.brick : null, e);
  });
  canvas.addEventListener('pointerleave', () => onHover(null));

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (!fitted) (fitCamera(), (fitted = true));
    }
  };

  let autoRotate = false;
  let fitted = false;
  const tick = (t) => {
    resize();
    for (const d of drops) {
      const k = Math.min(1, Math.max(0, (t - d.start) / 380));
      const ease = 1 - (1 - k) ** 3;
      d.m.position.y = d.m.userData.home.y + (1 - ease) * 2.4;
    }
    // 平滑地拉近 / 拉远到当前要看的高度；用户自己滚轮缩放后不再干预，直到翻下一步
    if (zooming) {
      const offset = camera.position.clone().sub(controls.target);
      const want = distanceFor(viewHeight);
      const next = offset.length() + (want - offset.length()) * 0.1;
      camera.position.copy(controls.target).addScaledVector(offset.normalize(), next);
      if (Math.abs(want - next) < 0.05) zooming = false;
    }
    const dy = (focusY - controls.target.y) * 0.08;
    if (Math.abs(dy) > 1e-3) {
      controls.target.y += dy;
      camera.position.y += dy;
    }
    controls.autoRotate = autoRotate;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return {
    showAll,
    showStep,
    highlight,
    setAutoRotate: (v) => (autoRotate = v),
    setHover: (fn) => (onHover = fn),
    resetCamera: fitCamera,
    // 正对着脸看（截图检查用）
    front: () => {
      fitCamera();
      const d = camera.position.distanceTo(controls.target);
      camera.position.set(0, controls.target.y + d * 0.12, d);
      autoRotate = false;
    },
  };
}
