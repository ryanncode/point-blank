# Cautious Refactoring Plan for Document Rendering

This document outlines a phased approach to refactor the document rendering logic to improve performance while minimizing risk. The core goal is to move from a full-document update model to a more efficient, incremental update model.

## Guiding Principles

- **Stability First**: Each phase must result in a stable, shippable product.
- **Incremental Changes**: Introduce optimizations one by one to isolate potential issues.
- **Verifiable Checkpoints**: Each phase will have clear success criteria and checkpoints to ensure we are on the right track.

---

## Phase 1: Viewport-Aware Rendering (Low Risk, High Reward)

This phase avoids any changes to the parsing logic. We will continue to do a full re-parse, but we will be much smarter about what we *decorate*.

- **Goal**: Stop calculating decorations for the entire document and only focus on what the user can see.
- **Step 1.1**: Modify the `DecorationManager` to listen for viewport changes (`onDidChangeTextEditorVisibleRanges`).
- **Step 1.2**: In the `applyDecorationsInternal` method, instead of getting all nodes from the `DocumentTree`, we will first get the visible ranges from the editor.
- **Step 1.3**: We will then ask the `DocumentTree` for only the nodes that fall within those visible ranges.
- **Step 1.4**: The `DecorationCalculator` will now receive a much smaller list of nodes to process.
- **Checkpoint**: The extension's behavior should be identical to the user, but for large files, performance during scrolling and editing will be significantly better. We can add logging to verify that the number of nodes being processed is drastically reduced. The risk of rendering bugs is extremely low because we are not changing how parsing works at all.

---

## Phase 2: Introduce a "Dirty Range" for Clearing Decorations (Medium Risk)

This is the first step toward true incremental updates. We will introduce the concept of a "dirty range" but use it in a very limited and safe way.

- **Goal**: To stop clearing all decorations across the entire editor on every change, which can contribute to flickering.
- **Step 2.1**: In `DocumentModel`, when `onDidChangeTextDocument` is fired, we will calculate a "dirty range" based on the `contentChanges`. To be safe, we will expand this range by a few lines above and below the actual change to handle potential ripple effects (like indentation changes).
- **Step 2.2**: This dirty range will be passed to `DecorationManager`.
- **Step 2.3**: The `DecorationManager` will now use this range to clear decorations *only* within that specific area before applying the new ones. We will *still* calculate decorations based on the visible viewport as we did in Phase 1.
- **Checkpoint**: We have a stable system where changes are happening within a localized part of the document. We can carefully test for the "ghost decorator" and flickering issues. Because we are still re-calculating based on the visible viewport, the system has a reliable "source of truth" to fall back on, which should prevent persistent ghosting.

---

## Phase 3: True Incremental Parsing (Highest Risk, Done Last)

Only after the first two phases are complete and stable will we attempt to change the parsing logic.

- **Goal**: To finally stop re-parsing the entire document on every keystroke.
- **Step 3.1**: We will build the incremental parsing logic in `DocumentParser.parse`. This will be the most complex part, and we will need to write extensive unit tests for it, covering all sorts of edge cases (multi-line edits, deletions at the start/end of the file, etc.).
- **Step 3.2**: The new parser will produce a new `DocumentTree` by reusing as many nodes as possible from the old tree.
- **Step 3.3**: Once the parser is proven to be reliable through testing, we will integrate it into the `DocumentModel`.
- **Checkpoint**: The parser correctly updates the `DocumentTree` without a full re-parse. The application remains stable, and performance on very large documents is now excellent, even during rapid typing.

---

## Workflow Diagram

```mermaid
graph TD
    subgraph "Phase 1: Viewport Rendering"
        A[Full Re-parse] --> B{Full DocumentTree};
        B --> C[Get Visible Lines];
        C --> D[Calculate Decorations for Visible Lines];
    end

    subgraph "Phase 2: Introduce Dirty Range"
        E[Full Re-parse] --> F{Full DocumentTree};
        G[Calculate Dirty Range] --> H[Clear Decorations in Dirty Range];
        F --> I[Get Visible Lines];
        I --> J[Calculate Decorations for Visible Lines];
    end

    subgraph "Phase 3: Incremental Parsing"
        K[Incremental Parse] --> L{Partial DocumentTree Update};
        M[Calculate Dirty Range] --> N[Clear Decorations in Dirty Range];
        L --> O[Get Visible Lines];
        O --> P[Calculate Decorations for Visible Lines];
    end

    A -- Stable Checkpoint 1 --> E;
    E -- Stable Checkpoint 2 --> K;