# Point Blank

Point Blank is a VS Code extension designed to transform the markdown editing experience into a powerful and intuitive outliner. It enhances productivity by providing intelligent list styling, hierarchical folding, and support for structured data templates. This tool is intended for writers, developers, and anyone who uses markdown for note-taking, documentation, or brainstorming.

## Features

### Intelligent Bullet Point Styling

Point Blank enhances standard markdown lists by applying custom styling directly to the bullet characters (`*`, `+`, `-`, etc.). The extension can be configured to automatically insert a default bullet point on a new line. The rendering engine's job is only to style what is physically present in the file.

The following prefixes are recognized and styled:

*   `*` (asterisk)
*   `+` (plus)
*   `-` (minus)
*   `1.`, `1)` (numbered lists)
*   `>` (blockquote)
*   `@` (at-sign, for special mentions or commands)

### Hierarchical Outlining & Folding

The core of the outliner is its ability to create a hierarchy based on indentation. Users can create nested lists simply by indenting lines. The extension uses this structure to provide robust, indentation-based code folding, allowing users to collapse and expand sections of their outline to easily navigate large documents.

### Typed Nodes for Structured Data

A key feature of Point Blank is the concept of "typed nodes." By writing a line like `(Book)`, users can create a structured data block. This block can contain key-value pairs (e.g., `Author:: John Doe`) that are visually distinguished and can be navigated with custom keybindings, streamlining data entry.

### Template Expansion

To accelerate the creation of typed nodes, the extension supports template expansion. When a user types `@Book` followed by a space, the extension inserts a pre-defined block of text into the document. From that point on, the new content is styled just like any other text.

### Focus Mode

Focus Mode allows users to "hoist" a specific folding block, collapsing all other sections of the document. This provides a distraction-free environment for concentrating on a single part of a larger outline.

## Commands

| Command | Title | Keybinding |
| --- | --- | --- |
| `pointblank.focusMode` | Point Blank: Focus Mode (Hoisting) | `Alt+F` |
| `pointblank.unfocusMode` | Point Blank: Unfocus | `Alt+U` |
| `pointblank.quickOpenFile` | Point Blank: Quick Open File from Template | `Alt+N` |
| `pointblank.expandTemplate` | Point Blank: Expand Template Inline | |

## Configuration

| Setting | Description | Default |
| --- | --- | --- |
| `pointblank.level1Color` | Color for level 1 decorators. | |
| `pointblank.level2Color` | Color for level 2 decorators. | |
| `pointblank.level3Color` | Color for level 3 decorators. | |
| `pointblank.level4Color` | Color for level 4 decorators. | |
| `pointblank.level5Color` | Color for level 5 decorators. | |
| `pointblank.blockquoteColor` | Color for blockquote decorators. | `#808080` |
| `pointblank.keyValueColor` | The color for Key:: properties. | `#6c757d` |
| `pointblank.templates` | Map of type names to their template file paths. | `{"Book": ".vscode/templates/book.md", "Person": ".vscode/templates/person.md"}` |
| `pointblank.debounceDelay` | The debounce delay in milliseconds for document and visible range changes. | `15` |
| `pointblank.newFileDirectory` | The default directory for new files created via Quick Open. | `.` |
| `pointblank.viewportBuffer` | The number of extra lines to render above and below the visible viewport for decorations. | `20` |

## Contributing

Contributions are welcome! Point Blank's architecture is designed to be modular, performant, and maintainable, centered around an immutable document model that serves as the single source of truth. Key components include:

*   `DocumentModel`: Manages the document's state and uses `DocumentParser` to create an immutable `DocumentTree`.
*   `DecorationManager`: Applies visual decorations to the editor based on the `DocumentTree` and `DecorationCalculator`.
*   `CommandManager`: Registers and handles all user commands, interacting with the `DocumentModel` and other components.

To get started with development:

1.  Clone the repository.
2.  Run `pnpm install` to install the dependencies.
3.  Run `pnpm run watch` to start the webpack watcher.
4.  Press `F5` to open a new VS Code window with the extension loaded.