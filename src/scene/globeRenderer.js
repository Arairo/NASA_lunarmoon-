// Three.js 3D Moon Globe interactive renderer with real-time solar illumination and Earth vector rays.
import * as THREE from 'three';
import { clamp, DEG, RAD } from '../core/constants.js';

export function createGlobeRenderer(canvas, onPickSite, options = {}) {
  let yaw = -0.45, pitch = -1.15, distance = 3.1;
  let targetYaw = yaw, targetPitch = pitch, targetDist = distance;
  let dragging = null;
  // Pan offset in the camera's screen plane (Creo: Shift + middle-drag).
  let panX = 0, panY = 0, targetPanX = 0, targetPanY = 0;
  // Orbit centre (normally the Moon's centre; moves toward Earth in the Earth-Moon view).
  const center = [0, 0, 0], targetCenter = [0, 0, 0];
  // Camera "up": world north normally; the local vertical when standing at a site.
  const camUp = [0, 1, 0], targetUp = [0, 1, 0];
  // Earth is drawn NOT to scale: 7 Moon radii away (really ~221) and 0.45 Moon radii (really 3.7).
  const EARTH_DIST = 7, EARTH_R = 0.45;
  let highlights = [];
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
      const aniso = renderer.capabilities.getMaxAnisotropy?.() || 1;
      const loadTex = (url) => {
        const t = texLoader.load(url, () => renderGlobe());
        t.anisotropy = aniso;
        if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace;
        return t;
      };
      // Start with the small image so the globe appears at once, then swap in
      // the 4K LROC WAC mosaic when it has downloaded.
      const tex = loadTex(textureUrl);
      const moonGeo = new T.SphereGeometry(1, 128, 96);
      const moonMat = new T.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0.02 });
      const moonMesh = new T.Mesh(moonGeo, moonMat);
      // Three.js puts texture longitude -180 at phi = 0; turn the sphere so
      // longitude 0 faces +Z, matching latLonToVec3, the site markers and the
      // Sun/Earth vectors.
      moonMesh.rotation.y = -Math.PI / 2;
      scene.add(moonMesh);
      texLoader.load(options.hiResUrl || `${import.meta.env.BASE_URL}data/moon_wac_global_4k.jpg`, (hi) => {
        hi.anisotropy = aniso;
        if ('colorSpace' in hi) hi.colorSpace = T.SRGBColorSpace;
        moonMat.map = hi; moonMat.needsUpdate = true; renderGlobe();
      });
      // South-polar cap (75-90 S) from the 450 m polar WAC mosaic, so the pole
      // stays sharp instead of smearing where the global image converges.
      const capMat = new T.MeshStandardMaterial({ map: loadTex(`${import.meta.env.BASE_URL}data/sp_wac_geo.jpg`), roughness: 0.92, metalness: 0.02, polygonOffset: true, polygonOffsetFactor: -2 });
      const cap = new T.Mesh(new T.SphereGeometry(1.0004, 256, 48, 0, Math.PI * 2, (165 * Math.PI) / 180, (15 * Math.PI) / 180), capMat);
      cap.rotation.y = -Math.PI / 2;
      scene.add(cap);

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

      // Earth: NASA Blue Marble, lit by the same Sun so its phase is right.
      const earthMesh = new T.Mesh(
        new T.SphereGeometry(EARTH_R, 96, 64),
        new T.MeshStandardMaterial({ map: loadTex(options.earthUrl || `${import.meta.env.BASE_URL}data/earth_blue_marble_4k.jpg`), roughness: 0.75, metalness: 0 })
      );
      const earthGlow = new T.Mesh(
        new T.SphereGeometry(EARTH_R * 1.08, 48, 32),
        new T.MeshBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0.18, side: T.BackSide, blending: T.AdditiveBlending, depthWrite: false })
      );
      earthMesh.add(earthGlow);
      earthMesh.rotation.z = (23.4 * Math.PI) / 180;
      scene.add(earthMesh);
      const hlGroup = new T.Group();
      scene.add(hlGroup);

      three = { T, renderer, scene, camera, ambient, dirLight, moonMesh, selMarker, sunLine, earthLine, earthMesh, hlGroup };
    }
  } catch (err) {
    console.warn('Three.js initialization fallback:', err);
    three = null;
  }

  const latLonToVec3 = (lat, lon, r = 1) => {
    const la = lat * DEG, lo = lon * DEG;
    return [r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo)];
  };

  // --- Highlighted spots with dotted lines to Earth -------------------------
  const labelLayer = document.createElement('div');
  labelLayer.className = 'xp-spot-labels';
  canvas.parentElement?.appendChild(labelLayer);

  function clearHighlights() {
    if (!three) return;
    for (const h of highlights) {
      three.hlGroup.remove(h.obj);
      h.obj.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
      h.label.remove();
    }
    highlights = [];
  }

  function updateHighlights(ePos) {
    for (const h of highlights) {
      const p = h.pos;
      const toEarth = ePos.clone().sub(p);
      const end = p.clone().add(toEarth.clone().setLength(toEarth.length() - EARTH_R * 1.05));
      h.line.geometry.setFromPoints([p, end]);
      h.line.computeLineDistances();
      h.line.material.opacity = h.earthUp ? 0.95 : 0.3;
      h.ring.scale.setScalar(clamp((distance - 1) / 2.1, 0.25, 1.4));
      h.dot.scale.setScalar(clamp((distance - 1) / 2.1, 0.25, 1.4));
    }
  }

  function placeLabels(cw, ch) {
    if (!three) return;
    const cam = three.camera.position;
    for (const h of highlights) {
      const facing = h.pos.clone().normalize().dot(cam.clone().sub(h.pos)) > 0;
      const v = h.pos.clone().project(three.camera);
      const on = facing && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      h.label.style.opacity = on ? '1' : '0';
      h.label.style.transform = `translate(${((v.x + 1) / 2) * cw}px, ${((1 - v.y) / 2) * ch}px)`;
    }
  }

  function setHighlights(list) {
    if (!three) return;
    clearHighlights();
    const T = three.T;
    for (const item of list) {
      const pArr = latLonToVec3(item.lat, item.lon, 1.006);
      const pos = new T.Vector3(...pArr);
      const obj = new T.Group();
      const color = new T.Color(item.color);
      const dot = new T.Mesh(new T.SphereGeometry(0.016, 16, 16), new T.MeshBasicMaterial({ color }));
      dot.position.copy(pos);
      const ring = new T.Mesh(new T.RingGeometry(0.028, 0.036, 48), new T.MeshBasicMaterial({ color, side: T.DoubleSide, transparent: true, opacity: 0.9 }));
      ring.position.copy(pos);
      ring.lookAt(pos.clone().multiplyScalar(2));
      const line = new T.Line(new T.BufferGeometry().setFromPoints([pos, pos]), new T.LineDashedMaterial({ color, dashSize: 0.06, gapSize: 0.045, transparent: true, opacity: 0.95 }));
      obj.add(dot, ring, line);
      three.hlGroup.add(obj);
      const label = document.createElement('div');
      label.className = 'xp-spot-label';
      label.style.setProperty('--c', item.color);
      label.innerHTML = `<b>${item.title}</b><span>${item.sub || ''}</span>`;
      labelLayer.appendChild(label);
      highlights.push({ ...item, pos, obj, dot, ring, line, label, earthUp: item.earthUp });
    }
    renderGlobe();
  }

  function renderGlobe() {
    const cw = canvas.clientWidth || 0;
    const ch = canvas.clientHeight || 0;
    if (cw < 24 || ch < 24) return;

    yaw += (targetYaw - yaw) * 0.25;
    pitch += (targetPitch - pitch) * 0.25;
    distance += (targetDist - distance) * 0.25;
    panX += (targetPanX - panX) * 0.25;
    panY += (targetPanY - panY) * 0.25;
    let dc = 0;
    for (let k = 0; k < 3; k++) {
      center[k] += (targetCenter[k] - center[k]) * 0.2; dc += Math.abs(targetCenter[k] - center[k]);
      camUp[k] += (targetUp[k] - camUp[k]) * 0.2; dc += Math.abs(targetUp[k] - camUp[k]);
    }
    const settling = dc + Math.abs(targetYaw - yaw) + Math.abs(targetPitch - pitch) + Math.abs(targetDist - distance) + Math.abs(targetPanX - panX) + Math.abs(targetPanY - panY) > 1e-4;

    if (three) {
      three.renderer.setSize(cw, ch, false);
      three.camera.aspect = cw / ch;
      three.camera.updateProjectionMatrix();

      const cx = distance * Math.cos(pitch) * Math.sin(yaw);
      const cy = distance * Math.sin(pitch);
      const cz = distance * Math.cos(pitch) * Math.cos(yaw);
      three.camera.position.set(cx + center[0], cy + center[1], cz + center[2]);
      three.camera.up.set(camUp[0], camUp[1], camUp[2]).normalize();
      three.camera.lookAt(center[0], center[1], center[2]);
      if (panX || panY) {
        three.camera.updateMatrixWorld();
        const right = new three.T.Vector3().setFromMatrixColumn(three.camera.matrixWorld, 0);
        const up = new three.T.Vector3().setFromMatrixColumn(three.camera.matrixWorld, 1);
        three.camera.position.addScaledVector(right, panX).addScaledVector(up, panY);
      }

      three.ambient.intensity = realLighting ? 0.34 : 1.35;
      three.dirLight.intensity = realLighting ? 1.85 : 0.35;
      three.dirLight.position.set(sunDir[1] * 10, sunDir[2] * 10, sunDir[0] * 10);
      const ePos = new three.T.Vector3(earthDir[1], earthDir[2], earthDir[0]).multiplyScalar(EARTH_DIST);
      three.earthMesh.position.copy(ePos);
      updateHighlights(ePos);

      if (selectedSite) {
        const p = latLonToVec3(selectedSite.lat, selectedSite.lon, 1.008);
        three.selMarker.position.set(p[0], p[1], p[2]);
        three.selMarker.scale.setScalar(clamp((distance - 1) / 2.1, 0.12, 1));
        const sEnd = [p[0] + sunDir[1] * 0.65, p[1] + sunDir[2] * 0.65, p[2] + sunDir[0] * 0.65];
        const eEnd = [p[0] + earthDir[1] * 0.65, p[1] + earthDir[2] * 0.65, p[2] + earthDir[0] * 0.65];
        three.sunLine.geometry.setFromPoints([new three.T.Vector3(...p), new three.T.Vector3(...sEnd)]);
        three.earthLine.geometry.setFromPoints([new three.T.Vector3(...p), new three.T.Vector3(...eEnd)]);
      }
      three.renderer.render(three.scene, three.camera);
      placeLabels(cw, ch);
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
      targetDist = clamp(dragging.dist * Math.exp(dy * 0.006), 1.15, 14);
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
    targetDist = clamp(targetDist * Math.exp(e.deltaY * 0.0012), 1.15, 14);
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
      targetCenter.fill(0); targetUp[0] = 0; targetUp[1] = 1; targetUp[2] = 0;
      targetPanX = 0; targetPanY = 0;
      selectedSite = site;
      targetYaw = site.lon * DEG;
      targetPitch = clamp(site.lat * DEG, -1.52, 1.52);
      targetDist = site.lat < -75 ? 1.85 : 2.5;
      renderGlobe();
    },
    southPole() {
      targetCenter.fill(0); targetUp[0] = 0; targetUp[1] = 1; targetUp[2] = 0;
      targetPanX = 0; targetPanY = 0;
      targetYaw = 0; targetPitch = -1.48; targetDist = 2.05;
      renderGlobe();
    },
    overview() {
      targetCenter.fill(0); targetUp[0] = 0; targetUp[1] = 1; targetUp[2] = 0;
      targetPanX = 0; targetPanY = 0;
      targetYaw = 0.2; targetPitch = -0.35; targetDist = 3.2;
      renderGlobe();
    },
    earthMoon() {
      targetPanX = 0; targetPanY = 0;
      // Look at the midpoint, from a side view perpendicular to the Earth-Moon line.
      const e = [earthDir[1], earthDir[2], earthDir[0]];
      for (let k = 0; k < 3; k++) targetCenter[k] = e[k] * EARTH_DIST * 0.5;
      targetUp[0] = 0; targetUp[1] = 1; targetUp[2] = 0;
      let side = [-e[2], 0, e[0]];
      const n = Math.hypot(...side) || 1;
      side = side.map((v) => v / n);
      targetPitch = 0.35; targetYaw = Math.atan2(side[0], side[2]); targetDist = 10.5;
      renderGlobe();
    },
    /** Drop the camera just behind the selected site, looking toward the Sun or Earth. */
    lookAlong(kind = 'sun') {
      if (!selectedSite) return;
      const d = kind === 'earth' ? earthDir : sunDir;
      const p = latLonToVec3(selectedSite.lat, selectedSite.lon, 1);
      const up = p;
      let v = [d[1], d[2], d[0]];
      const vu = v[0] * up[0] + v[1] * up[1] + v[2] * up[2];
      v = v.map((x, k) => x - vu * up[k]); // horizontal part of the direction
      const vn = Math.hypot(...v) || 1;
      v = v.map((x) => x / vn);
      let c = v.map((x, k) => -x + 0.42 * up[k]); // camera sits behind the site and a little above
      const cn = Math.hypot(...c);
      c = c.map((x) => x / cn);
      for (let k = 0; k < 3; k++) { targetCenter[k] = p[k] + v[k] * 0.1; targetUp[k] = up[k]; }
      targetPanX = 0; targetPanY = 0;
      targetPitch = Math.asin(clamp(c[1], -1, 1));
      targetYaw = Math.atan2(c[0], c[2]);
      targetDist = 0.32;
      // Keep the shortest way round so the camera does not spin a full turn.
      while (targetYaw - yaw > Math.PI) targetYaw -= 2 * Math.PI;
      while (targetYaw - yaw < -Math.PI) targetYaw += 2 * Math.PI;
      renderGlobe();
    },
    setHighlights,
    setHighlightEarth(states) {
      highlights.forEach((h, i) => { h.earthUp = states[i]; });
      renderGlobe();
    },
    reset() {
      targetCenter.fill(0); targetUp[0] = 0; targetUp[1] = 1; targetUp[2] = 0;
      targetYaw = -0.45; targetPitch = -1.15; targetDist = 3.1; targetPanX = 0; targetPanY = 0;
      renderGlobe();
    },
    view(name) {
      targetCenter.fill(0); targetUp[0] = 0; targetUp[1] = 1; targetUp[2] = 0;
      targetPanX = 0; targetPanY = 0;
      const v = { front: [0, 0, 3], back: [Math.PI, 0, 3], left: [-Math.PI / 2, 0, 3], right: [Math.PI / 2, 0, 3], top: [0, 1.53, 3], bottom: [0, -1.53, 3] }[name];
      if (v) [targetYaw, targetPitch, targetDist] = v;
      renderGlobe();
    },
    zoomBy(f) {
      targetDist = clamp(targetDist * f, 1.15, 14);
      renderGlobe();
    },
  };
}
