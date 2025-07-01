# Change Log

All notable changes to the "pointblank" extension will be documented in this file.

## [0.7.0] - 2025-06-29
### Added
- You can now select a single-line bullet point for copying, making it easier to duplicate or move bullet items.
- When typing or pasting from the start of a list item line, the bullet point style now matches the next or previous list item line at the same level of indent for consistency.
### Changed
- Replaced the document parser with a high-performance "Dirty Range" incremental parser, eliminating typing lag in large documents.
### Fixed
- Pasting a bullet at the beginning of a line no longer erases the line; pasted content is merged or inserted intelligently.
- Numbered list items will remove their default bullet point.
- Paste handling is now more robust: bullets are correctly added when pasting at the start of indented lines, and never in the middle of a line.
### Testing
- Added a comprehensive unit test for paste scenarios.
- All parsing and paste logic is now tested using Jest unit tests.

## [0.6.3] - 2025-06-27
### Fixed
- Inline query update now correctly recognizes and replaces both `LIST` (`- [[...]]`) and `TRANSCLUDE` (`- ![[...]]`) result lines above the query block. This prevents duplicate or stale results when using markdown transclusion in queries.

## [0.6.2] - 2025-06-27
### Added
- New setting and command: **Toggle Auto Bullets** (`pointblank.toggleAutoBullets`). You can now enable or disable automatic bullet point insertion for new lines and pastes, with a default keybinding (`Alt+B`).
### Fixed
- Multi-line paste: If the first line of the pasted content is empty, default bullet points are now correctly added to all following non-empty lines (when auto bullets are enabled).

## [6.1.0] - 2025-06-15
### Added
- **Powerful Inline Query Language**: A major new feature that allows you to search for and display information directly within your notes.
    - Supports `LIST` (wiki-style links) and `TRANSCLUDE` (embedded content) actions.
    - Query from `FILES` (metadata) or `BLOCKS` (inline content).
    - Filter results with a `WHERE` clause supporting `AND`/`OR` and multiple operators (`=`, `!=`, `>`, `<`, `::`).
    - Sort results with `SORT BY`.
    - Define search scope with `IN` clause, supporting `this.file`, `this.folder`, `workspace`, and now **relative paths** (e.g., `IN "./notes/"`).

## [0.6.0] - 2025-06-15
### Changed
- Major refactor of the template system. Templates are now defined by a `Type::` property and stored in `.vscode/templates`.
- Inline template expansion is now triggered by `TypeName::` instead of the old `@TypeName` syntax.
### Added
- Support for optional YAML front matter in template files for extended metadata (used in quick open file type, though not used in inline expansion).

## [0.5.1] - 2025-06-15
### Changed
- Updated and clarified the names of color-related settings.
### Added
- When creating a new bullet point, it will now inherit the style of the previous line.
### Fixed
- Resolved widescreen layout issues on the website.

## [0.5.0] - 2025-06-14
### Changed
- Upgraded the document parser from a 4-pass to a more efficient 2-pass system, significantly improving performance and reducing lag on large documents.
### Fixed
- Resolved issues with pasting multi-line blocks and inline type nodes.

## [0.4.0] - 2025-06-13
### Changed
- **Major Refactor**: Transitioned from visual-only "ghost" characters to using real characters for all bullet points. This improves stability, interoperability with other extensions, and ensures the document remains pure markdown.
### Added
- Comprehensive handling for inline type node inputs, including return key behavior.

## [0.3.0] - 2025-06-12
### Added
- **Focus Mode**: Implemented a "focus mode" to hoist a specific folding block, providing a distraction-free writing environment.
### Fixed
- Addressed several folding and decorator rendering issues.

## [0.2.0] - 2025-06-11
### Changed
- **Major Performance Overhaul**: Refactored the document rendering logic, improving performance from ~400ms to sub-1ms. Implemented viewport-aware rendering to only process the visible portion of the document.
### Added
- Introduced a quick-open command for template files.

## [0.1.0] - 2025-06-10
### Changed
- **Major Refactor**: Switched to a tree-node document model, laying the foundation for hierarchical outlining and structured data.
### Added
- Initial implementation of styled bullet point prefixes.
- Support for `key::value` pairs and node type templating.