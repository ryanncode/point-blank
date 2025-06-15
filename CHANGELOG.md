# Change Log

All notable changes to the "pointblank" extension will be documented in this file.

## [0.5.1] - 2025-06-15
### Added
- When creating a new bullet point, it will now inherit the style of the previous line.

### Changed
- Updated and clarified the names of color-related settings.

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
### Added
- Initial implementation of styled bullet point prefixes.
- Support for `key::value` pairs and node type templating.
### Changed
- **Major Refactor**: Switched to a tree-node document model, laying the foundation for hierarchical outlining and structured data.