# Lunar Site Planner & Mission Explorer

An interactive web application for exploring, learning, and evaluating lunar landing sites and operational dates for Artemis and CLPS missions. For any point on the Moon and any UTC date, it computes topocentric Sun and Earth vectors relative to the local LOLA terrain horizon, estimates solar power generation, evaluates direct-to-Earth (DTE) radio links with DSN coverage, and compares mission scenarios.

Built for the NASA Space Apps Challenge, *CLPS Lunar Mission Browser*.

---

## 🌟 Application Modes

The application features three integrated modes in `index.html`, plus an advanced CesiumJS expert mode in `planner.html`:

### 1. 🛰️ Mission Explorer
- **Interactive 3D Moon Globe**: Real-time Three.js lunar globe with physically oriented Sun direction lighting, sub-Earth/sub-solar line rays, and camera presets (*South Pole*, *Fly to Site*, *Overview*, *Earth-Moon Line*).
- **South-Pole LOLA Polar Stereographic Map**: High-resolution 2D canvas map with toggleable WAC basemap, 2027 illumination overlay, and Earth visibility contours.
- **Operations Timeline**: 4-track interactive canvas timeline (Sun elevation, Solar power output, Earth elevation, and Direct-to-Earth link windows) with time scrubbing and playback.
- **Assessment Panel**: Gauge meters for peak and instantaneous solar power, link margin (dB), horizon skyline SVG with Sun/Earth elevations, and operational event countdowns.

### 2. 🦉 Duolingo-Style Learning Map (Lunar Academy)
- **Gamified Progression**: Serpentine node map spanning 3 comprehensive curriculum units:
  - *Unit 1: Polar Light & Shadows* (Why the poles?, Shackleton Crater, Peak of Eternal Light).
  - *Unit 2: Solar Power & Cold Surviving* (Solar arrays, Battery drawdown, Surviving the lunar night).
  - *Unit 3: Direct-to-Earth Communications* (Line of sight, DSN coverage, Multi-site trade-offs).
- **Interactive Lessons & Quizzes**: Multiple-choice questions with immediate visual feedback, explanation callouts, XP tracking, and streak counters.
- **Lumi the Mascot**: Dynamic animated SVG mascot reacting with custom emotional states (*proud*, *happy*, *thinking*, *crying*, *starry*).
- **Deep Links**: Lesson simulation buttons link directly into the Mission Explorer configured with exact site and time parameters.

### 3. ⚖️ Scenario Comparison Lab
- **Multi-Site & Launch Slip Evaluation**: Compare landing sites side-by-side across sunlit %, average power, longest darkness, battery drawdown, and DTE link margin.
- **Schedule Slip ×3**: Automatically calculate trade-offs for +1, +2, and +3 synodic month launch slips (~29.53 days each).
- **Nearby Alternatives Scanner**: Scan LOLA terrain within 5 km for elevated ridge points with improved solar visibility.
- **CSV Export**: Export all evaluated metrics and window parameters to spreadsheet-ready CSV.

### 4. 🔭 Expert Mode (`planner.html`)
- Full CesiumJS 3D Moon digital elevation model (DEM) with optional Cesium Ion high-resolution terrain streaming and Artemis candidate region boundaries.
- **Video tutorial**: new visitors are asked at start-up whether they want a narrated, captioned walkthrough (about 3½ minutes, 11 chapters) built from screenshots of the planner. It can be reopened with the amber **▶ Video tutorial** button, and is also available as an [MP4 download](public/tutorial/lunar-site-planner-tutorial.mp4). **Tour** starts an interactive walkthrough that uses the real controls instead.

---

## 🚀 Quick Start

```bash
npm install
npm run dev          # Start local dev server at http://localhost:5174
```

```bash
npm test             # Run test suite (Node.js ESM test runner)
npm run build        # Build production-ready bundle into dist/
```

Browser end-to-end check of every control on the expert planner, including the tour and phone layout:

```bash
npm run dev &        # in another terminal is fine too
npm run test:e2e     # needs Playwright: npm i --no-save playwright && npx playwright install chromium
```

No API keys are required: terrain data, imagery, ephemeris calculations, and fonts all function offline.

---

## 📐 Scientific Model & Data Sources

All calculations run in pure browser-compatible ES modules located in `src/core/`:
- **Sun & Earth Ephemerides**: Computed via [astronomy-engine](https://github.com/cosinekitty/astronomy) rotated into the lunar body-fixed Mean Earth/Polar Axis frame using IAU/WGCCRE rotational models and optical librations.
- **Terrain Horizons**: Sampled over LRO LOLA elevation grids (including lunar spherical curvature).
- **Power Model**: Solar constant $1361\text{ W/m}^2 \times (1\text{ AU} / r)^2 \times \text{visible solar fraction} \times \cos(\theta) \times \text{area} \times \text{efficiency}$.
- **Communications**: Topocentric free-space path loss and grazing diffraction margin to NASA Deep Space Network (DSN) 34 m ground antennas (Goldstone, Madrid, Canberra).

---

## 🎬 Video Tutorial (expert planner)

The player (`src/planner/ui/videoTutorial.js`) plays the voice-over track and draws each frame from the current playback time: zooms, spotlights, the cursor and captions are computed from the narration timing, so seeking, speed changes and muting stay in sync. Without audio it runs on an internal clock with captions. Keys: Space play/pause, ←/→ 5 s, Shift+←/→ chapter, C captions, M voice, F full screen.

To change it, edit the narration and the on-screen directions in `src/planner/ui/tutorial/script.json` (`shot`, `zoom`, `spot`, `cursor`, `click`, `label`, `card`), then rebuild the parts that changed:

```bash
pip install kokoro-onnx soundfile numpy           # offline neural text-to-speech
# kokoro-v1.0.int8.onnx and voices-v1.0.bin from github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0)
python tools/tutorial/build_narration.py kokoro-v1.0.int8.onnx voices-v1.0.bin   # voice-over + timing.json

npm run build && npx vite preview --port 4174 &   # a static build, so edits don't reload the page mid-capture
npm run tutorial:shots                            # screenshots + control positions (after UI changes)
npm run tutorial:video                            # downloadable 720p MP4, about 10 MB (rebuild first so it uses the new shots)
```

---

## 📁 Repository Layout

```
├── index.html                   # Main entry point (Mission Explorer, Academy, Compare Lab)
├── planner.html                 # CesiumJS 3D expert mode
├── src/
│   ├── main.js                  # Main application orchestrator & state manager (index.html)
│   ├── planner/                 # Expert mode (planner.html): its own entry, UI and styles
│   │   ├── main.js              # Expert planner orchestrator
│   │   ├── styles.css           # Expert planner styles
│   │   ├── scene/moonScene.js   # CesiumJS Moon scene
│   │   └── ui/                  # Sky plot, timeline, polar map, results, compare, glossary,
│   │                            # learn mode, tour, video tutorial player and start-up welcome
│   │                            # (tutorial script, timing and shot positions in ui/tutorial/)
│   ├── academy/
│   │   ├── academyView.js       # Duolingo-style learning map UI & quiz modals
│   │   ├── content.js           # 3 Academy units, nodes, and quiz data
│   │   └── mascot.js            # Lumi mascot SVG generator
│   ├── scene/
│   │   └── globeRenderer.js     # Three.js 3D lunar globe with Sun & Earth vectors
│   ├── ui/
│   │   ├── polarMap.js          # 2D LOLA South-Pole canvas renderer
│   │   ├── timeline.js          # Multi-track operations timeline canvas
│   │   ├── skyplot.js           # 360° horizon elevation skyline
│   │   ├── assessment.js        # Power & link assessment panel
│   │   ├── compare.js           # Comparison Lab & CSV exporter
│   │   ├── modals.js            # Guided tour & glossary modals
│   │   └── format.js            # Formatters for coordinates, time, units
│   ├── core/
│   │   ├── analysis.js          # Unified site evaluation & window scanner
│   │   ├── horizon.js           # Ray-marched and precomputed terrain horizons
│   │   ├── ephemeris.js         # Sun and Earth lunar-centric ephemeris
│   │   ├── comms.js             # DSN visibility and RF link budgets
│   │   ├── power.js             # Solar array and battery sizing models
│   │   ├── geo.js               # Lunar coordinate transformations & ENU frames
│   │   └── constants.js         # Physical constants, glossary, site metadata
│   ├── data/                    # Bundled ES module data sources
│   └── styles.css               # Design tokens, typography & animations
├── public/data/                 # Static textures, LOLA DEM, and illumination maps
├── public/tutorial/             # Video tutorial screenshots, voice-over and MP4
├── tools/                       # Data build scripts; tools/tutorial/ rebuilds the video tutorial
├── test/
│   ├── core.spec.js             # 24 automated unit tests
│   └── browser-e2e.cjs          # Browser end-to-end check of the expert planner
└── package.json
```
