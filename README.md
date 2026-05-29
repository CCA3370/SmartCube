# SmartCube — Rubik's Cube Solving Assistant

A browser app that scans your scrambled 3×3 cube with the camera, recognizes its
state, computes the fewest-move solution, and guides you through solving it with a
step-by-step 3D animation.

## Features

- **Guided camera scan** — a 3×3 alignment overlay shows where to hold each face;
  the app auto-captures when the frame is sharp, well-lit, and steady (with a
  manual capture button too).
- **Logo-safe color recognition** — samples a ring around each sticker (skipping
  the center logo), takes the median, converts to CIELAB, and classifies each
  sticker relative to the 6 live center colors via CIEDE2000. No calibration step;
  tolerant of lighting changes.
- **Editable review** — every recognized face is shown as a 3×3 grid; tap any
  sticker to correct it. Low-confidence reads are flagged.
- **Validation** — checks the scan is a physically solvable cube (color counts,
  centers, edge-flip / corner-twist / permutation parity) and tells you which
  face to re-scan if something's off.
- **Optimal solve** — Kociemba two-phase solver (cubejs) runs in a Web Worker and
  returns a ≤22-move solution.
- **3D guided playback** — cubing.js `<twisty-player>` shows your scrambled cube
  and animates the solution one move at a time, with prev/next/play/jump controls
  and a clickable move list.

## Stack

- Vite + React + TypeScript
- `cubejs` (MIT) — Kociemba two-phase solver, in a Web Worker
- `cubing` — `<twisty-player>` 3D animation + `Alg` parsing (twisty/alg only)
- Plain Canvas + custom CIELAB / CIEDE2000 for color CV (no OpenCV)
- A Web Worker for per-frame sharpness / exposure / stability analysis

## Run it

```bash
npm install
npm run dev        # serves over HTTPS (mkcert) — needed for camera + workers
```

Open the printed `https://localhost:5173` on desktop, or one of the `Network`
URLs on a phone on the same Wi-Fi (accept the local cert). Camera access requires
HTTPS and a user gesture; the "Start" button provides it.

```bash
npm run build      # type-checks and builds to dist/
npm test           # runs the Vitest suite
npm run typecheck  # tsc project build, no emit
```

## How scanning maps to the cube

You scan 6 faces in a fixed sequence with on-screen hold cues. The holds are
chosen so each face's camera view already matches the solver's net orientation
(rotation 0 for all six) — see `src/lib/cube/orientation.ts` for the geometry and
the self-tests that prove it (`orientation.test.ts` reconstructs 25 random
scrambles to exact facelet strings via an independent 3D model).

## Project layout

```
src/
  app/        state machine, context, recognition glue
  screens/    Welcome / Scan / Review / Solve / Done
  components/ CameraView, FaceGrid, TwistyView, MoveList, StepControls, ...
  hooks/      useCamera, useFrameAnalyzer, useAutoCapture
  workers/    frameAnalyzer.worker, solver.worker
  lib/
    color/    colorspace (CIELAB), ciede2000, sampling, classify
    cube/     types, facelets, orientation, validate
    solver/   worker client + types
    twisty/   player (invert trick) + stepping (isolated experimental APIs)
    vision/   frame readiness metrics
```

## Notes / limits

- Advanced camera controls (torch, continuous focus/exposure/white-balance) are
  used when available (mainly Chromium on Android) and silently skipped otherwise.
- The solver produces a computer-optimal solution (not a human CFOP method).
- Real-time "did you turn correctly?" detection is a planned future addition; the
  re-scan path already supports re-planning from any state.
```
