# Point Blank

Point Blank is a VS Code extension designed to transform the markdown editing experience into a powerful and intuitive outliner. This tool is intended for writers, developers, and anyone who uses markdown for note-taking, documentation, or brainstorming.

[Get it on the VS Code Marketplace!](https://marketplace.visualstudio.com/items?itemName=fastblit.pointblank)

## Features

Point Blank offers intelligent list styling, hierarchical folding, and support for structured data templates.

For a comprehensive overview of features, commands, configuration, and contributing guidelines, please visit our [documentation website](https://ryanncode.github.io/point-blank/).

## Architecture

Point Blank's architecture is designed to be modular, performant, and maintainable, centered around an immutable document model that serves as the single source of truth. Key components include:

*   `DocumentModel`: Manages the document's state and uses `DocumentParser` to create an immutable `DocumentTree`.
*   `DecorationManager`: Applies visual decorations to the editor based on the `DocumentTree` and `DecorationCalculator`.
*   `CommandManager`: Registers and handles all user commands, interacting with the `DocumentModel` and other components.
*   `DocumentParser`: A stateless component solely responsible for converting text into an immutable `DocumentTree`.

For a detailed history of changes, see the [CHANGELOG](https://github.com/ryanncode/point-blank/blob/main/CHANGELOG.md).

This project is licensed under the [LGPL License](LICENSE.md).

## Contributing

Contributions are welcome! If you're interested in contributing, please feel free to open an issue or submit a pull request.

To get started with development:

1.  Clone the repository.
2.  Run `pnpm install` to install the dependencies.
3.  Run `pnpm run watch` to start the webpack watcher.
4.  Press `F5` to open a new VS Code window with the extension loaded.