// Three.js 3D Moon Globe interactive renderer with real-time solar illumination and Earth vector rays.
import * as THREE from 'three';
import { clamp, DEG, RAD } from '../core/constants.js';

export function createGlobeRenderer(canvas, onPickSite, options = {}) {
  let yaw = -0.45, pitch = -1.15, distance = 3.1;
  let targetYaw = yaw, targetPitch = pitch, targetDist = distance;
  let dragging = null;
  // Pan offset in the camera's screen plane (Creo: Shift + middle-drag).
  let panX = 0, panY = 0, targetPanX = 0, targetPanY = 0;
  const onHint = options.onHint || (() => {});
  let sunDir = [1, 0.1, 0];
  let earthDir = [0.6, 0.7, -0.1];
  let realLighting = true;
  let selectedSite = null;

  const textureUrl = options.textureUrl || `${import.meta.env.BASE_URL}data/moonGlobal.jpg`;

  let three = null;
  try {
    if (window.THREE || THREE) {
      const T = window.THREE || THREE;
      const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      const scene = new T.Scene();
      scene.background = new T.Color(0x05070c);
      const camera = new T.PerspectiveCamera(40, 1, 0.05, 100);

      const ambient = new T.AmbientLight(0xdbeafe, 0.34);
      scene.add(ambient);
      const dirLight = new T.DirectionalLight(0xfffbeb, 1.85);
      scene.add(dirLight);

      // Starfield: a few thousand faint points on a distant shell.
      {
        const n = 2600, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 45 + Math.random() * 10;
          const q = Math.sqrt(1 - u * u);
          pos.set([r * q * Math.cos(th), r * u, r * q * Math.sin(th)], i * 3);
          const b = 0.35 + Math.random() * 0.65, warm = Math.random();
          col.set([b, b * (0.92 + 0.08 * warm), b * (0.85 + 0.15 * (1 - warm))], i * 3);
        }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(pos, 3));
        g.setAttribute('color', new T.BufferAttribute(col, 3));
        scene.add(new T.Points(g, new T.PointsMaterial({ size: 0.11, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false })));
      }

      const texLoader = new T.TextureLoader();
      const tex = texLoader.load(textureUrl, () => renderGlobe());
      const moonGeo = new T.SphereGeometry(1, 64, 48);
      const moonMat = new T.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0.02 });
      const moonMesh = new T.Mesh(moonGeo, moonMat);
      scene.add(moonMesh);

      const selMarker = new T.Mesh(
        new T.SphereGeometry(0.024, 16, 16),
        new T.MeshBasicMaterial({ color: 0xfbbf24 })
      );
      scene.add(selMarker);

      const makeRay = (hex) => {
        const g = new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3(1, 0, 0)]);
        const m = new T.LineBasicMaterial({ color: hex });
        const l = new T.Line(g, m);
        scene.add(l);
        return l;
      };
      const sunLine = makeRay(0xfbbf24);
      const earthLine = makeRay(0x38bdf8);

      three = { T, renderer, scene, camera, ambient, dirLight, moonMesh, selMarker, sunLine, earthLine };
    }
  } catch (err) {
    console.warn('Three.js initialization fallback:', err);
    three = null;
  }

  const latLonToVec3 = (lat, lon, r = 1) => {
    const la = lat * DEG, lo = lon * DEG;
    return [r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo)];
  };

  function renderGlobe() {
    const cw = canvas.clientWidth || 0;
    const ch = canvas.clientHeight || 0;
    if (cw < 24 || ch < 24) return;

    yaw += (targetYaw - yaw) * 0.25;
    pitch += (targetPitch - pitch) * 0.25;
    distance += (targetDist - distance) * 0.25;
    panX += (targetPanX - panX) * 0.25;
    panY += (targetPanY - panY) * 0.25;
    const settling = Math.abs(targetYaw - yaw) + Math.abs(targetPitch - pitch) + Math.abs(targetDist - distance) + Math.abs(targetPanX - panX) + Math.abs(targetPanY - panY) > 1e-4;

    if (three) {
      three.renderer.setSize(cw, ch, false);
      three.camera.aspect = cw / ch;
      three.camera.updateProjectionMatrix();

      const cx = distance * Math.cos(pitch) * Math.sin(yaw);
      const cy = distance * Math.sin(pitch);
      const cz = distance * Math.cos(pitch) * Math.cos(yaw);
      three.camera.position.set(cx, cy, cz);
      three.camera.lookAt(0, 0, 0);
      if (panX || panY) {
        three.camera.updateMatrixWorld();
        const right = new three.T.Vector3().setFromMatrixColumn(three.camera.matrixWorld, 0);
        const up = new three.T.Vector3().setFromMatrixColumn(three.camera.matrixWorld, 1);
        three.camera.position.addScaledVector(right, panX).addScaledVector(up, panY);
      }

      three.ambient.intensity = realLighting ? 0.34 : 1.35;
      three.dirLight.intensity = realLighting ? 1.85 : 0.35;
      three.dirLight.position.set(sunDir[1] * 10, sunDir[2] * 10, sunDir[0] * 10);

      if (selectedSite) {
        const p = latLonToVec3(selectedSite.lat, selectedSite.lon, 1.008);
        three.selMarker.position.set(p[0], p[1], p[2]);
        const sEnd = [p[0] + sunDir[1] * 0.65, p[1] + sunDir[2] * 0.65, p[2] + sunDir[0] * 0.65];
        const eEnd = [p[0] + earthDir[1] * 0.65, p[1] + earthDir[2] * 0.65, p[2] + earthDir[0] * 0.65];
        three.sunLine.geometry.setFromPoints([new three.T.Vector3(...p), new three.T.Vector3(...sEnd)]);
        three.earthLine.geometry.setFromPoints([new three.T.Vector3(...p), new three.T.Vector3(...eEnd)]);
      }
      three.renderer.render(three.scene, three.camera);
      if (settling && !renderGlobe.queued) {
        renderGlobe.queued = true;
        requestAnimationFrame(() => { renderGlobe.queued = false; renderGlobe(); });
      }
    } else {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(cw * dpr), h = Math.round(ch * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#05070c';
      ctx.fillRect(0, 0, cw, ch);
      const R = Math.min(cw, ch) * (1.15 / distance);
      ctx.beginPath();
      ctx.arc(cw / 2, ch / 2, R, 0, Math.PI * 2);
      ctx.fillStyle = '#334155';
      ctx.fill();
    }
  }

  // Mouse controls modelled on PTC Creo, with fallbacks for trackpads:
  //   Middle-drag = spin, Shift + middle-drag = pan, Ctrl + middle-drag = zoom,
  //   wheel = zoom. Left-drag also spins and right-drag also pans, so a laptop
  //   without a middle button still has every move. Left-click picks a site.
  const actionFor = (e) => {
    if (e.button === 1) return e.shiftKey ? 'pan' : (e.ctrlKey || e.metaKey) ? 'zoom' : 'spin';
    if (e.button === 2) return 'pan';
    return e.shiftKey ? 'pan' : 'spin';
  };
  const HINTS = { spin: 'Spin', pan: 'Pan', zoom: 'Zoom' };
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
  canvas.addEventListener('pointerdown', (e) => {
    const action = actionFor(e);
    dragging = { x: e.clientX, y: e.clientY, yaw: targetYaw, pitch: targetPitch, dist: targetDist, panX: targetPanX, panY: targetPanY, moved: false, action, button: e.button };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = action === 'pan' ? 'move' : action === 'zoom' ? 'ns-resize' : 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      if (!dragging.moved) onHint(HINTS[dragging.action]);
      dragging.moved = true;
    }
    if (dragging.action === 'spin') {
      targetYaw = dragging.yaw - dx * 0.006;
      targetPitch = clamp(dragging.pitch + dy * 0.006, -1.53, 1.53);
    } else if (dragging.action === 'pan') {
      const k = (distance * 0.9) / Math.max(200, canvas.clientHeight);
      targetPanX = clamp(dragging.panX - dx * k, -2, 2);
      targetPanY = clamp(dragging.panY + dy * k, -2, 2);
    } else {
      targetDist = clamp(dragging.dist * Math.exp(dy * 0.006), 1.15, 6.5);
    }
    renderGlobe();
  });
  const endDrag = (e) => {
    const d = dragging;
    dragging = null;
    canvas.style.cursor = '';
    if (d?.moved) onHint(null);
    if (!d || d.moved || d.button !== 0 || !three) return;
    const rect = canvas.getBoundingClientRect();
    const mouse = new three.T.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new three.T.Raycaster();
    raycaster.setFromCamera(mouse, three.camera);
    const hits = raycaster.intersectObject(three.moonMesh);
    if (hits.length > 0) {
      const pt = hits[0].point.clone().normalize();
      const lat = Math.asin(clamp(pt.y, -1, 1)) * RAD;
      const lon = Math.atan2(pt.x, pt.z) * RAD;
      onPickSite({ lat, lon });
    }
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => { dragging = null; canvas.style.cursor = ''; onHint(null); });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    targetDist = clamp(targetDist * Math.exp(e.deltaY * 0.0012), 1.15, 6.5);
    renderGlobe();
  }, { passive: false });

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => renderGlobe()).observe(canvas);
  }

  return {
    render: renderGlobe,
    setSite(site) {
      selectedSite = site;
      renderGlobe();
    },
    setLighting(isReal) {
      realLighting = isReal;
      renderGlobe();
    },
    setVectors(state) {
      const sn = Math.hypot(...state.sun) || 1;
      const en = Math.hypot(...state.earth) || 1;
      sunDir = state.sun.map((v) => v / sn);
      earthDir = state.earth.map((v) => v / en);
      renderGlobe();
    },
    flyToSite(site) {
      if (!site) return;
      targetPanX = 0; targetPanY = 0;
      selectedSite = site;
      targetYaw = site.lon * DEG;
      targetPitch = clamp(site.lat * DEG, -1.52, 1.52);
      targetDist = site.lat < -75 ? 1.85 : 2.5;
      renderGlobe();
    },
    southPole() {
      targetPanX = 0; targetPanY = 0;
      targetYaw = 0; targetPitch = -1.48; targetDist = 2.05;
      renderGlobe();
    },
    overview() {
      targetPanX = 0; targetPanY = 0;
      targetYaw = 0.2; targetPitch = -0.35; targetDist = 3.2;
      renderGlobe();
    },
    earthMoon() {
      targetPanX = 0; targetPanY = 0;
      targetYaw = 0.4; targetPitch = -0.2; targetDist = 4.8;
      renderGlobe();
    },
    reset() {
      targetYaw = -0.45; targetPitch = -1.15; targetDist = 3.1; targetPanX = 0; targetPanY = 0;
      renderGlobe();
    },
    view(name) {
      targetPanX = 0; targetPanY = 0;
      const v = { front: [0, 0, 3], back: [Math.PI, 0, 3], left: [-Math.PI / 2, 0, 3], right: [Math.PI / 2, 0, 3], top: [0, 1.53, 3], bottom: [0, -1.53, 3] }[name];
      if (v) [targetYaw, targetPitch, targetDist] = v;
      renderGlobe();
    },
    zoomBy(f) {
      targetDist = clamp(targetDist * f, 1.35, 6.5);
      renderGlobe();
    },
  };
}
