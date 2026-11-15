// Three.js 3D Moon Globe interactive renderer with real-time solar illumination and Earth vector rays.
import * as THREE from 'three';
import { clamp, DEG, RAD } from '../core/constants.js';

export function createGlobeRenderer(canvas, onPickSite, options = {}) {
  let yaw = -0.45, pitch = -1.15, distance = 3.1;
  let targetYaw = yaw, targetPitch = pitch, targetDist = distance;
  let dragging = null;

  // Orbit center in world space (Moon center is [0, 0, 0]; Earth center is [ePos.x, ePos.y, ePos.z]).
  const center = [0, 0, 0], targetCenter = [0, 0, 0];
  // Camera "up": dynamically adjusted at the poles to prevent gimbal lock.
  const camUp = [0, 1, 0], targetUp = [0, 1, 0];
  // Earth is drawn scaled for visibility: 7 Moon radii away and 0.45 Moon radii.
  const EARTH_DIST = 7, EARTH_R = 0.45;
  let highlights = [];
  const onHint = options.onHint || (() => {});
  let sunDir = [1, 0.1, 0];
  let earthDir = [0.6, 0.7, -0.1];
  let realLighting = true;
  let selectedSite = null;
  let isEarthView = false;
  let allSites = [];
  let siteMarkers = [];

  const textureUrl = options.textureUrl || `${import.meta.env.BASE_URL}data/moonGlobal.jpg`;

  let three = null;
  let sitesGroup = null;

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

      // Starfield: distant stars background
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

      const tex = loadTex(textureUrl);
      const moonGeo = new T.SphereGeometry(1, 128, 96);
      const moonMat = new T.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0.02 });
      const moonMesh = new T.Mesh(moonGeo, moonMat);
      moonMesh.rotation.y = -Math.PI / 2;
      scene.add(moonMesh);

      texLoader.load(options.hiResUrl || `${import.meta.env.BASE_URL}data/moon_wac_global_4k.jpg`, (hi) => {
        hi.anisotropy = aniso;
        if ('colorSpace' in hi) hi.colorSpace = T.SRGBColorSpace;
        moonMat.map = hi; moonMat.needsUpdate = true; renderGlobe();
      });

      // South-polar cap (75-90 S) from the 450 m polar WAC mosaic
      const capMat = new T.MeshStandardMaterial({ map: loadTex(`${import.meta.env.BASE_URL}data/sp_wac_geo.jpg`), roughness: 0.92, metalness: 0.02, polygonOffset: true, polygonOffsetFactor: -2 });
      const cap = new T.Mesh(new T.SphereGeometry(1.0004, 256, 48, 0, Math.PI * 2, (165 * Math.PI) / 180, (15 * Math.PI) / 180), capMat);
      cap.rotation.y = -Math.PI / 2;
      scene.add(cap);

      // Selected site marker (pulsing gold ring)
      const selMarker = new T.Group();
      const selDot = new T.Mesh(new T.SphereGeometry(0.022, 16, 16), new T.MeshBasicMaterial({ color: 0xfbbf24 }));
      const selRing = new T.Mesh(new T.RingGeometry(0.028, 0.038, 32), new T.MeshBasicMaterial({ color: 0xfbbf24, side: T.DoubleSide, transparent: true, opacity: 0.9 }));
      selMarker.add(selDot);
      selMarker.add(selRing);
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

      // Earth: NASA Blue Marble with atmospheric glow
      const earthMesh = new T.Mesh(
        new T.SphereGeometry(EARTH_R, 96, 64),
        new T.MeshStandardMaterial({ map: loadTex(options.earthUrl || `${import.meta.env.BASE_URL}data/earth_blue_marble_4k.jpg`), roughness: 0.75, metalness: 0 })
      );
      const earthGlow = new T.Mesh(
        new T.SphereGeometry(EARTH_R * 1.08, 48, 32),
        new T.MeshBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0.22, side: T.BackSide, blending: T.AdditiveBlending, depthWrite: false })
      );
      earthMesh.add(earthGlow);
      earthMesh.rotation.z = (23.4 * Math.PI) / 180;
      scene.add(earthMesh);

      // Sites group for all historical and planned mission markers
      sitesGroup = new T.Group();
      scene.add(sitesGroup);

      const hlGroup = new T.Group();
      scene.add(hlGroup);

      three = { T, renderer, scene, camera, ambient, dirLight, moonMesh, selMarker, selRing, sunLine, earthLine, earthMesh, sitesGroup, hlGroup };
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

  // --- Hover tooltip for site markers ---
  const siteTooltip = document.createElement('div');
  siteTooltip.className = 'xp-site-tooltip';
  siteTooltip.style.cssText = 'position:absolute;pointer-events:none;opacity:0;transition:opacity 0.15s;z-index:25;background:rgba(10,14,24,0.92);color:#fff;border:1px solid rgba(255,255,255,0.2);padding:6px 10px;border-radius:10px;font:500 12px var(--xp-font,sans-serif);white-space:nowrap;box-shadow:0 6px 20px rgba(0,0,0,0.5);transform:translate(-50%,-130%);';
  canvas.parentElement?.appendChild(siteTooltip);

  function showSiteTooltip(site, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    siteTooltip.innerHTML = `<b style="display:block;font-size:12px">${site.name}</b><span style="font-size:10px;color:#94a3b8">${site.lat.toFixed(2)}°, ${site.lon.toFixed(2)}° · ${site.group?.toUpperCase()}</span>`;
    siteTooltip.style.left = `${clientX - rect.left}px`;
    siteTooltip.style.top = `${clientY - rect.top}px`;
    siteTooltip.style.opacity = '1';
  }

  function hideSiteTooltip() {
    siteTooltip.style.opacity = '0';
  }

  // --- Earth view banner ---
  const earthBanner = document.createElement('div');
  earthBanner.className = 'xp-earth-banner';
  earthBanner.style.cssText = 'position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:20;background:rgba(15,23,42,0.9);color:#e2e8f0;border:1px solid rgba(56,189,248,0.4);border-radius:999px;padding:6px 14px;font:500 12px var(--xp-font,sans-serif);display:none;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,0.4);';
  earthBanner.innerHTML = '<span>Viewing Earth in 3D (Direct radio view)</span><button type="button" style="background:#38bdf8;color:#0f172a;border:0;border-radius:999px;padding:3px 10px;font-weight:700;font-size:11px;cursor:pointer;">← Return to Moon</button>';
  canvas.parentElement?.appendChild(earthBanner);
  earthBanner.querySelector('button')?.addEventListener('click', () => overview());

  function showEarthBanner(show) {
    earthBanner.style.display = show ? 'flex' : 'none';
  }

  // --- Site markers for previous missions ---
  function siteColorHex(site) {
    if (site.group === 'apollo') return 0x38bdf8; // Sky blue
    if (site.group === 'clps') return 0xc084fc;   // Violet
    if (site.group === 'south') return 0x34d399;  // Emerald
    if (site.group === 'intl') return 0xfb7185;   // Rose pink
    return 0xfbbf24;                              // Gold / amber
  }

  function setSites(sitesList) {
    if (!three || !sitesList) return;
    allSites = sitesList;
    while (sitesGroup.children.length > 0) {
      const obj = sitesGroup.children[0];
      sitesGroup.remove(obj);
      obj.traverse((c) => { c.geometry?.dispose(); c.material?.dispose(); });
    }
    siteMarkers = [];

    for (const site of sitesList) {
      const p = latLonToVec3(site.lat, site.lon, 1.003);
      const col = siteColorHex(site);
      const grp = new three.T.Group();
      grp.position.set(p[0], p[1], p[2]);
      grp.lookAt(p[0] * 2, p[1] * 2, p[2] * 2);

      const dot = new three.T.Mesh(new three.T.SphereGeometry(0.013, 16, 16), new three.T.MeshBasicMaterial({ color: col }));
      const ring = new three.T.Mesh(new three.T.RingGeometry(0.018, 0.025, 24), new three.T.MeshBasicMaterial({ color: col, side: three.T.DoubleSide, transparent: true, opacity: 0.85 }));
      grp.add(dot);
      grp.add(ring);
      grp.userData = { site };
      dot.userData = { site };
      ring.userData = { site };

      sitesGroup.add(grp);
      siteMarkers.push(grp);
    }
    renderGlobe();
  }

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

    // Smooth camera up vector at high latitudes to completely avoid gimbal singularity at the poles
    const absPitch = Math.abs(pitch);
    if (absPitch > 1.05) {
      const blend = clamp((absPitch - 1.05) / 0.45, 0, 1);
      const poleUpZ = pitch < 0 ? 1 : -1;
      targetUp[0] = 0;
      targetUp[1] = 1 - blend;
      targetUp[2] = blend * poleUpZ;
    } else {
      targetUp[0] = 0;
      targetUp[1] = 1;
      targetUp[2] = 0;
    }

    let dc = 0;
    for (let k = 0; k < 3; k++) {
      center[k] += (targetCenter[k] - center[k]) * 0.25; dc += Math.abs(targetCenter[k] - center[k]);
      camUp[k] += (targetUp[k] - camUp[k]) * 0.25; dc += Math.abs(targetUp[k] - camUp[k]);
    }
    const settling = dc + Math.abs(targetYaw - yaw) + Math.abs(targetPitch - pitch) + Math.abs(targetDist - distance) > 1e-4;

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

      three.ambient.intensity = realLighting ? 0.34 : 1.35;
      three.dirLight.intensity = realLighting ? 1.85 : 0.35;
      three.dirLight.position.set(sunDir[1] * 10, sunDir[2] * 10, sunDir[0] * 10);
      const ePos = new three.T.Vector3(earthDir[1], earthDir[2], earthDir[0]).multiplyScalar(EARTH_DIST);
      three.earthMesh.position.copy(ePos);
      updateHighlights(ePos);

      // Scale site markers slightly with distance so they remain easy to see
      const markerScale = clamp((distance - 1) / 2.2, 0.4, 1.25);
      for (const m of siteMarkers) {
        m.scale.setScalar(markerScale);
      }

      if (selectedSite) {
        const p = latLonToVec3(selectedSite.lat, selectedSite.lon, 1.008);
        three.selMarker.position.set(p[0], p[1], p[2]);
        three.selMarker.lookAt(p[0] * 2, p[1] * 2, p[2] * 2);
        three.selMarker.scale.setScalar(clamp((distance - 1) / 2.1, 0.18, 1.1));
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

  // --- Controls: Smooth Dragging, Panning & Zooming ---
  const actionFor = (e) => {
    if (e.button === 1) return e.shiftKey ? 'pan' : (e.ctrlKey || e.metaKey) ? 'zoom' : 'spin';
    if (e.button === 2) return 'pan';
    return e.shiftKey ? 'pan' : 'spin';
  };
  const HINTS = { spin: 'Spin', pan: 'Pan', zoom: 'Zoom' };

  let lastX = 0, lastY = 0;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });

  canvas.addEventListener('pointerdown', (e) => {
    const action = actionFor(e);
    lastX = e.clientX;
    lastY = e.clientY;
    dragging = { startX: e.clientX, startY: e.clientY, moved: false, action, button: e.button };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = action === 'pan' ? 'move' : action === 'zoom' ? 'ns-resize' : 'grabbing';
  });

  canvas.addEventListener('pointermove', (e) => {
    // Hover raycasting when not dragging
    if (!dragging) {
      if (!three || siteMarkers.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const mouse = new three.T.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new three.T.Raycaster();
      raycaster.setFromCamera(mouse, three.camera);
      const hits = raycaster.intersectObjects(sitesGroup.children, true);
      if (hits.length > 0) {
        let rootGrp = hits[0].object;
        while (rootGrp.parent && rootGrp.parent !== sitesGroup) rootGrp = rootGrp.parent;
        const site = rootGrp.userData?.site;
        if (site) {
          canvas.style.cursor = 'pointer';
          showSiteTooltip(site, e.clientX, e.clientY);
          return;
        }
      }
      hideSiteTooltip();
      canvas.style.cursor = '';
      return;
    }

    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    if (Math.abs(e.clientX - dragging.startX) + Math.abs(e.clientY - dragging.startY) > 4) {
      if (!dragging.moved) onHint(HINTS[dragging.action]);
      dragging.moved = true;
      hideSiteTooltip();
    }

    if (dragging.action === 'spin') {
      targetYaw -= dx * 0.0055;
      targetPitch = clamp(targetPitch + dy * 0.0055, -1.50, 1.50);
    } else if (dragging.action === 'pan') {
      if (three) {
        three.camera.updateMatrixWorld();
        const right = new three.T.Vector3().setFromMatrixColumn(three.camera.matrixWorld, 0);
        const up = new three.T.Vector3().setFromMatrixColumn(three.camera.matrixWorld, 1);
        const factor = (distance * 1.1) / Math.max(200, canvas.clientHeight);
        targetCenter[0] += (-right.x * dx + up.x * dy) * factor;
        targetCenter[1] += (-right.y * dx + up.y * dy) * factor;
        targetCenter[2] += (-right.z * dx + up.z * dy) * factor;
      }
    } else {
      const minDist = isEarthView ? 0.65 : 1.10;
      targetDist = clamp(targetDist * Math.exp(dy * 0.005), minDist, 16);
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

    // 1. Did the user click on a site dot?
    if (siteMarkers.length > 0) {
      const siteHits = raycaster.intersectObjects(sitesGroup.children, true);
      if (siteHits.length > 0) {
        let rootGrp = siteHits[0].object;
        while (rootGrp.parent && rootGrp.parent !== sitesGroup) rootGrp = rootGrp.parent;
        const site = rootGrp.userData?.site;
        if (site) {
          onPickSite({ site });
          flyToSite(site);
          return;
        }
      }
    }

    // 2. Did the user click on Earth?
    const earthHits = raycaster.intersectObject(three.earthMesh, true);
    if (earthHits.length > 0) {
      viewEarth();
      return;
    }

    // 3. Did the user click on the Moon?
    const moonHits = raycaster.intersectObject(three.moonMesh);
    if (moonHits.length > 0) {
      if (isEarthView) {
        overview();
        return;
      }
      const pt = moonHits[0].point.clone().normalize();
      const lat = Math.asin(clamp(pt.y, -1, 1)) * RAD;
      const lon = Math.atan2(pt.x, pt.z) * RAD;
      // Check if click was very close to an existing site (within ~1.8 degrees)
      const nearby = allSites.find((s) => Math.hypot(s.lat - lat, s.lon - lon) < 1.8);
      if (nearby) {
        onPickSite({ site: nearby });
        flyToSite(nearby);
      } else {
        onPickSite({ lat, lon });
      }
    }
  };

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => { dragging = null; canvas.style.cursor = ''; onHint(null); });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const minDist = isEarthView ? 0.65 : 1.10;
    const factor = Math.exp(clamp(e.deltaY, -100, 100) * 0.0014);
    targetDist = clamp(targetDist * factor, minDist, 16);
    renderGlobe();
  }, { passive: false });

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => renderGlobe()).observe(canvas);
  }

  function viewEarth() {
    isEarthView = true;
    showEarthBanner(true);
    const ePos = [earthDir[1] * EARTH_DIST, earthDir[2] * EARTH_DIST, earthDir[0] * EARTH_DIST];
    targetCenter[0] = ePos[0];
    targetCenter[1] = ePos[1];
    targetCenter[2] = ePos[2];
    targetDist = 1.6;
    targetPitch = 0.15;
    targetYaw = 0;
    renderGlobe();
  }

  function overview() {
    isEarthView = false;
    showEarthBanner(false);
    targetCenter.fill(0); targetUp[0] = 0; targetUp[1] = 1; targetUp[2] = 0;
    targetYaw = 0.2; targetPitch = -0.35; targetDist = 3.2;
    renderGlobe();
  }

  function flyToSite(site) {
    if (!site) return;
    isEarthView = false;
    showEarthBanner(false);
    targetCenter.fill(0); targetUp[0] = 0; targetUp[1] = 1; targetUp[2] = 0;
    selectedSite = site;
    targetYaw = site.lon * DEG;
    targetPitch = clamp(site.lat * DEG, -1.50, 1.50);
    targetDist = site.lat < -75 ? 1.85 : 2.5;
    renderGlobe();
  }

  function southPole() {
    isEarthView = false;
    showEarthBanner(false);
    targetCenter.fill(0); targetUp[0] = 0; targetUp[1] = 1; targetUp[2] = 0;
    targetYaw = 0; targetPitch = -1.48; targetDist = 2.05;
    renderGlobe();
  }

  function earthMoon() {
    isEarthView = false;
    showEarthBanner(false);
    const e = [earthDir[1], earthDir[2], earthDir[0]];
    for (let k = 0; k < 3; k++) targetCenter[k] = e[k] * EARTH_DIST * 0.5;
    targetUp[0] = 0; targetUp[1] = 1; targetUp[2] = 0;
    let side = [-e[2], 0, e[0]];
    const n = Math.hypot(...side) || 1;
    side = side.map((v) => v / n);
    targetPitch = 0.35; targetYaw = Math.atan2(side[0], side[2]); targetDist = 10.5;
    renderGlobe();
  }

  return {
    render: renderGlobe,
    setSite(site) {
      selectedSite = site;
      renderGlobe();
    },
    setSites,
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
    flyToSite,
    southPole,
    overview,
    earthMoon,
    viewEarth,
    lookAlong(kind = 'sun') {
      if (!selectedSite) return;
      isEarthView = false;
      showEarthBanner(false);
      const d = kind === 'earth' ? earthDir : sunDir;
      const p = latLonToVec3(selectedSite.lat, selectedSite.lon, 1);
      const up = p;
      let v = [d[1], d[2], d[0]];
      const vu = v[0] * up[0] + v[1] * up[1] + v[2] * up[2];
      v = v.map((x, k) => x - vu * up[k]);
      const vn = Math.hypot(...v) || 1;
      v = v.map((x) => x / vn);
      let c = v.map((x, k) => -x + 0.42 * up[k]);
      const cn = Math.hypot(...c);
      c = c.map((x) => x / cn);
      for (let k = 0; k < 3; k++) { targetCenter[k] = p[k] + v[k] * 0.1; targetUp[k] = up[k]; }
      targetPitch = Math.asin(clamp(c[1], -1, 1));
      targetYaw = Math.atan2(c[0], c[2]);
      targetDist = 0.32;
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
      isEarthView = false;
      showEarthBanner(false);
      targetCenter.fill(0); targetUp[0] = 0; targetUp[1] = 1; targetUp[2] = 0;
      targetYaw = -0.45; targetPitch = -1.15; targetDist = 3.1;
      renderGlobe();
    },
    view(name) {
      isEarthView = false;
      showEarthBanner(false);
      targetCenter.fill(0); targetUp[0] = 0; targetUp[1] = 1; targetUp[2] = 0;
      const v = { front: [0, 0, 3], back: [Math.PI, 0, 3], left: [-Math.PI / 2, 0, 3], right: [Math.PI / 2, 0, 3], top: [0, 1.50, 3], bottom: [0, -1.50, 3] }[name];
      if (v) [targetYaw, targetPitch, targetDist] = v;
      renderGlobe();
    },
    zoomBy(f) {
      const minDist = isEarthView ? 0.65 : 1.10;
      targetDist = clamp(targetDist * f, minDist, 16);
      renderGlobe();
    },
  };
}
