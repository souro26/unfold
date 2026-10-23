# AGENTS.md — unfold

## Project Overview

- **Type**: Tauri 2 + Rust + TypeScript desktop application
- **Package Manager**: npm (frontend) + Cargo (backend)
- **Language/Framework**: Rust 2021, TypeScript, Tauri 2, Vite 5, Skia (via skia-safe), wgpu
- **Architecture**: Native overlay with GPU-accelerated rendering, local-first AI, tiered vision pipeline

## Developer Commands

| Task | Command |
|------|---------|
| Install dependencies | `npm install && cargo build` |
| Development (frontend + backend) | `npm run tauri dev` |
| Frontend only dev server | `npm run dev` |
| Build production | `npm run tauri build` |
| Typecheck frontend | `npm run typecheck` |
| Lint frontend | `npm run lint` |
| Format code | `npm run fmt` |
| Run tests | `cargo test` |

## Architecture & Responsibilities

### Rust Backend (`src-tauri/src/`)

| Module | Responsibility |
|--------|----------------|
| `main.rs` | App entry, tray, global shortcuts, window management, state |
| `overlay.rs` | Overlay window lifecycle, click-through, per-monitor fullscreen |
| `settings.rs` | Persistent configuration (LLM, overlay, drawing, vision, hotkeys) |
| `ipc/mod.rs` | Tauri commands bridge (generate_plan, analyze_screen, etc.) |
| `drawing/types.rs` | Core type definitions (DrawingPlan, Element, Step, Viewport, etc.) |
| `drawing/layout.rs` | Layout engine (Dagre/ELK-style, collision resolution, isotropic scaling) |
| `drawing/renderer.rs` | Skia-based GPU renderer with animated stroke drawing |
| `drawing/planner.rs` | Universal LLM planner (Groq, Gemini, Ollama, OpenAI, Mock) with declarative spec compilation |
| `vision/mod.rs` | Vision pipeline orchestrator (3-tier: windows, OCR, local vision) |
| `vision/capture.rs` | Platform-specific screen/window capture (Windows Graphics Capture, ScreenCaptureKit, PipeWire) |
| `vision/ocr.rs` | Tesseract OCR engine integration |
| `vision/local_model.rs` | ONNX Runtime local vision models (Moondream2, Phi-3-Vision, YOLO) |

### TypeScript Frontend (`src/`)

| File | Responsibility |
|------|----------------|
| `overlay.html` | Single-page overlay UI (toolbar, command palette, canvas, controls) |
| `main.ts` | Main entry point - tool management, drawing, step navigation, IPC |
| `types.ts` | TypeScript interfaces mirroring Rust types (auto-generated via serde_wasm_bindgen) |

## Key Design Decisions

### 1. Declarative Spec Only (Mode A)
- LLM **never outputs explicit coordinates**
- Planner outputs semantic spec: `sequences`, `nodes`/`edges`, `headerCode`, `takeaway`, `steps`
- Rust `LayoutEngine` computes ALL positions via Dagre + collision resolution
- Eliminates 80% of positioning bugs

### 2. GPU-Accelerated Rendering
- Skia via `skia-safe` + `wgpu` for hardware-accelerated 2D
- 60fps animated stroke drawing (`stroke-dashoffset` on GPU)
- Pressure-sensitive freehand (Wacom, Apple Pencil, Windows Ink)
- True transparency overlay over video/games

### 3. Click-Through Mode (Non-Negotiable)
- Windows: `WS_EX_TRANSPARENT | WS_EX_LAYERED | WS_EX_TOPMOST`
- macOS: `NSWindow.setIgnoresMouseEvents(true)`
- Toggle via `Esc` key or toolbar button
- Toolbar remains interactive

### 4. Tiered Vision Pipeline (Privacy-First)
| Tier | Method | Latency | Use Case |
|------|--------|---------|----------|
| 1 | Window metadata (OS APIs) | <5ms | Avoid active windows, detect content type |
| 2 | Tesseract OCR (on-demand) | ~200ms | "Explain this error" - read text |
| 3 | Local vision model (ONNX) | ~500ms | "Explain this diagram" - understand UI/charts |
| 4 | Cloud (opt-in) | ~1s | Complex legacy UI, handwriting |

### 5. Progressive Step-by-Step Teaching
- 3-6 steps max per concept
- Each step has spoken `explanation` (voice narration)
- Auto-advance mode with configurable delay
- Final step always = definitive takeaway card

## Conventions

- **Branching**: `main` for stable, feature branches for work
- **Commits**: Conventional commits (feat, fix, chore, etc.)
- **Rust**: `rustfmt`, `clippy`, `cargo test` before commit
- **TypeScript**: `eslint`, `prettier`, `tsc --noEmit` before commit
- **Types**: Single source of truth in Rust, mirrored to TS via `serde_wasm_bindgen`

## Project Structure

```
unfold/
├── .env.example              # Environment template (GROQ_API_KEY, GEMINI_API_KEY)
├── .gitignore
├── AGENTS.md                 # This file
├── package.json              # Frontend deps, scripts
├── tsconfig.json             # TypeScript strict config
├── tsconfig.node.json        # Node build config
├── vite.config.ts            # Vite config for frontend
├── tauri.conf.json           # Tauri 2 configuration
├── Cargo.toml                # Rust workspace + deps
├── src-tauri/
│   ├── build.rs              # Tauri build script
│   ├── src/
│   │   ├── main.rs           # App entry
│   │   ├── overlay.rs        # Overlay window manager
│   │   ├── settings.rs       # Settings persistence
│   │   ├── ipc/mod.rs        # Tauri commands
│   │   ├── drawing/
│   │   │   ├── mod.rs
│   │   │   ├── types.rs      # DrawingPlan, Element, Step, Viewport
│   │   │   ├── layout.rs     # LayoutEngine
│   │   │   ├── renderer.rs   # SkiaRenderer
│   │   │   └── planner.rs    # LLMPlanner
│   │   └── vision/
│   │       ├── mod.rs
│   │       ├── capture.rs    # Screen/window capture
│   │       ├── ocr.rs        # Tesseract OCR
│   │       └── local_model.rs # ONNX vision models
│   ├── icons/                # App icons (32x32, 128x128, 256x256, .icns, .ico)
│   ├── entitlements.plist    # macOS entitlements
│   └── target/               # Cargo build output
├── src/
│   ├── overlay.html          # Overlay UI
│   ├── main.ts               # Frontend entry
│   └── types.ts              # TS types (mirrored from Rust)
├── public/                   # Static assets
└── dist/                     # Vite build output
```

## Current Implementation Status (v0.1.0)

### ✅ Completed (Core Architecture)
- [x] Tauri 2 project structure with proper configuration
- [x] Rust type system for DrawingPlan, Elements, Steps, Viewport
- [x] Overlay window manager with per-monitor support
- [x] Click-through toggle (Windows `WS_EX_TRANSPARENT`, macOS `ignoresMouseEvents`)
- [x] Global shortcuts: `Ctrl+Shift+U` (toggle), `Ctrl+I` (command palette), `Esc` (click-through)
- [x] System tray with show/quit menu
- [x] Settings persistence (LLM providers, overlay, drawing, vision, hotkeys)
- [x] LayoutEngine with isotropic scaling, safe bounds, collision resolution
- [x] SkiaRenderer with animated stroke drawing for all element types
- [x] Universal LLM planner (Groq, Gemini, Ollama, OpenAI, Mock)
- [x] Declarative spec compiler (sequences → lists, nodes/edges → graphs)
- [x] Validation → repair → retry loop (3 attempts)
- [x] Tier 1 vision: Window metadata capture (Windows/macOS/Linux stubs)
- [x] Tier 2 vision: Tesseract OCR integration
- [x] Tier 3 vision: ONNX Runtime local model loader (Moondream2, Phi-3-Vision, YOLO)
- [x] IPC command bridge (generate_plan, analyze_screen, load_drawing_plan, etc.)
- [x] Frontend: Toolbar, command palette, drawing controls, tool settings popover
- [x] Frontend: Freehand drawing with pressure + Catmull-Rom smoothing
- [x] Frontend: Step navigation (next/prev/reset), voice, autopilot
- [x] Frontend: Canvas rendering fallback (while Skia WASM integration completes)

### 🔄 In Progress
- [x] Skia WASM integration for frontend renderer (hardware-accelerated CanvasKit surface with animated drawing)
- [x] KaTeX math rendering in frontend (inline $...$ and block $$...$$)
- [x] Presentation mode (hide all UI, floating HUD, step navigation, F5 toggle)
- [x] Voice narration (Web Speech API + SSML)
- [x] Export to Mermaid/Excalidraw/PlantUML/Manim
- [ ] Windows Graphics Capture implementation (currently using GDI BitBlt fallback)
- [ ] macOS ScreenCaptureKit / Linux PipeWire capture

### 📋 Planned (Post-v1.0)
- [ ] Plugin system (custom element types, layout algorithms, export formats)
- [ ] Collaborative mode (WebRTC + Yjs for shared overlay)
- [ ] Manim code export for video generation
- [ ] Advanced gesture recognition (pinch-zoom, rotate)
- [ ] Multi-language voice support
- [ ] Local LLM via llama.cpp sidecar (Nemotron-3-4B-int4 for RTX 4060 8GB)

## Gotchas / Quirks

### Windows
- **Graphics Capture** requires Windows 10 1903+ and `windows-capture` crate
- **Click-through** must re-apply after window state changes
- **High DPI**: Use `SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)`

### macOS
- **ScreenCaptureKit** requires macOS 12.3+ and proper entitlements
- **App Sandbox**: Disable for screen recording, or use `com.apple.security.cs.disable-library-validation`
- **Notarization**: Required for distribution outside App Store

### Linux
- **PipeWire** required for Wayland screen capture
- **X11 fallback** for non-Wayland compositors
- **AppImage** build via `tauri build --target appimage`

### Performance Targets
- Bundle size: < 15 MB (Tauri + Rust)
- Idle RAM: < 60 MB
- Idle CPU: < 1%
- Drawing latency: < 8ms (pen to pixel)
- Frame rate: 60fps sustained
- AI plan generation: < 3s local / < 1.5s cloud

## Testing Strategy

| Layer | Tool | Coverage |
|-------|------|----------|
| Rust unit | `cargo test` | Layout engine, planner validation, type serialization |
| Rust integration | `cargo test --test` | IPC commands, vision pipeline |
| Frontend unit | `vitest` | Tool logic, step navigation, IPC wrappers |
| E2E | `playwright` + Tauri driver | Full user flows (prompt → drawing → step) |
| Visual regression | `pixelmatch` | Rendering output consistency |

## Key Dependencies

### Rust (Cargo.toml)
```toml
tauri = { version = "2", features = ["macos-private-api", "window-state", "global-shortcut", ...] }
skia-safe = { version = "0.77", features = ["png", "svg", "textlayout", "fontmgr", "pdf"] }
wgpu = { version = "22", features = ["dx12", "vulkan", "metal", "webgpu"] }
daggy = "0.15"  # Dagre port for layout
petgraph = "0.6"
ort = { version = "1.17", features = ["onnxruntime", "load-dynamic"] }  # ONNX Runtime
tesseract = { version = "0.2", features = ["lept"] }
tokio = { version = "1.38", features = ["full"] }
```

### Frontend (package.json)
```json
{
  "@tauri-apps/api": "^2",
  "@tauri-apps/plugin-global-shortcut": "^2",
  "@tauri-apps/plugin-window-state": "^2",
  "dagre": "^0.8.5",
  "katex": "^0.16.10",
  "motion": "^11",
  "tesseract.js": "^5"
}
```

## Migration from Electron (v0.0.x)

| Electron | Tauri 2 |
|----------|---------|
| `electron/main.ts` | `src-tauri/src/main.rs` + `overlay.rs` |
| `electron/preload.ts` | Tauri IPC (auto-generated) |
| `src/overlay-main.ts` | `src/main.ts` |
| `src/drawing/renderer.ts` (SVG) | `src-tauri/src/drawing/renderer.rs` (Skia) |
| `src/drawing/layout.ts` | `src-tauri/src/drawing/layout.rs` |
| `src/drawing/llm-planner.ts` | `src-tauri/src/drawing/planner.rs` |
| `src/drawing/auto-layout.ts` | Declarative spec compiler in `planner.rs` |
| `vite.config.*` | `vite.config.ts` + `tauri.conf.json` |
| `package.json` scripts | `npm run tauri dev/build` |

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `GROQ_API_KEY` | Groq Cloud API | For Groq provider |
| `GEMINI_API_KEY` | Google Gemini API | For Gemini provider |
| `OPENAI_API_KEY` | OpenAI-compatible API | For OpenAI provider |
| `OLLAMA_ENDPOINT` | Local Ollama server | Default: `http://localhost:11434` |
| `RUST_LOG` | Rust logging level | Default: `info` |
| `TAURI_DEBUG` | Enable Tauri debug | Development only |

## Troubleshooting

### "Overlay not appearing"
- Check `tauri.conf.json` → `app.windows` is empty (we create overlay programmatically)
- Verify `WebviewWindowBuilder::transparent(true)` and `decorations(false)`
- Windows: Check `WS_EX_LAYERED` is set

### "Click-through not working"
- Windows: Verify `SetWindowLongPtr(GWL_EXSTYLE, WS_EX_TRANSPARENT)` called
- macOS: Verify `setIgnoresMouseEvents(true)` called
- Toolbar must have `pointer-events: auto` CSS

### "LLM planner returns invalid JSON"
- Check `response_format: { type: "json_object" }` in request
- Verify system prompt enforces "OUTPUT ONLY VALID JSON"
- Check validation errors in `PlannerOutput.validationErrors`

### "Screen capture black/empty"
- Windows: Requires `windows-capture` crate with proper session
- macOS: Requires ScreenCaptureKit permission in System Settings
- Linux: Requires PipeWire + `xdg-desktop-portal` running

### "Skia renderer not drawing"
- Verify `DirectContext` created successfully
- Check surface creation matches window swapchain
- Fallback to raster surface for testing

## Future Architecture Notes

### When to add WebGPU compute shaders
- Particle systems for physics visualizations
- Real-time video processing for vision tier
- Large diagram layout force-directed algorithms

### When to split into sidecars
- Local LLM inference (llama.cpp) → separate process
- Vision models (Moondream2) → separate process
- Keeps main process responsive, allows independent updates

### When to add WebView2/MSIX packaging
- Windows Store distribution
- Enterprise deployment requirements
- Automatic updates via Tauri updater plugin

---

*Last updated: 2026-10-19 | Version 0.1.0 | Architecture: Tauri 2 + Rust + Skia + ONNX*