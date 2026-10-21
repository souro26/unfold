# Unfold Implementation Plan

## Phase 1: Frontend UI Changes
- [ ] Replace 4 suggestion cards with 2 teaching mode cards ("Teach me what's on my screen", "Teach me on the blackboard")
- [ ] Add mode selection handler to trigger different workflows
- [ ] Add screen-teaching mode workflow (capture screen/region, vision API)
- [ ] Add blackboard mode (dedicated visualization workspace)

## Phase 2: Screen Capture & Vision Integration
- [ ] Implement screen capture using `windows-capture` crate
- [ ] Add vision API integration for screen-teaching mode
- [ ] Add screen capture permission handling
- [ ] Add capture confirmation/preview before sending

## Phase 3: Blackboard Mode
- [ ] Create dedicated visualization workspace
- [ ] Add visualization rendering pipeline
- [ ] Add visualization controls (clear, reset, zoom, close)
- [ ] Support equations, shapes, flowcharts, diagrams

## Phase 4: Provider Abstraction Layer
- [ ] Create provider trait/interface in Rust
- [ ] Implement Ollama provider (local)
- [ ] Implement OpenRouter provider (hosted)
- [ ] Provider capability discovery
- [ ] Model/provider capability discovery

## Phase 5: SQLite Database & Persistence
- [ ] Add SQLx/sqlite dependencies
- [ ] Create migrations for conversations, messages, attachments, settings
- [ ] Implement repositories
- [ ] Migrate from localStorage to SQLite

## Phase 6: Settings UI & Provider Management
- [ ] Settings UI for provider/model selection
- [ ] Provider connectivity testing
- [ ] API key secure storage (OS keyring)
- [ ] Connection testing

## Phase 6: Screen-Teaching Workflow
- [ ] Screen capture integration (windows-capture)
- [ ] Capture preview/confirmation
- [ ] Vision API integration for screen content analysis

## Phase 7: Blackboard Mode
- [ ] Dedicated visualization workspace
- [ ] Visualization controls (clear, reset, zoom, close)
- [ ] Support for equations, shapes, flowcharts, diagrams

## Phase 8: Chat Memory & Context
- [ ] Conversation summaries for long conversations
- [ ] Cross-conversation memory (optional, inspectable)

## Phase 9: Settings UI & Provider Management
- [ ] Provider selection UI
- [ ] Model selection per provider
- [ ] Connection testing
- [ ] API key secure storage (OS keyring)

## Phase 10: Testing & Polish
- [ ] Build verification (tsc, cargo check, cargo build)
- [ ] End-to-end testing
- [ ] Error handling and edge cases