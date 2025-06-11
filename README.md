# Point Blank

Point Blank: A VS Code extension for plain text and Markdown outlining, with smart folding, custom styling, focus mode, and powerful templating for node types and key-value properties.

![banner](assets/banner.png)

## Features

- **Indent-Based Folding:** Automatically creates folding ranges based on indentation, allowing you to collapse and expand blocks of text.
- **Custom Bullet Points:** Provides a variety of bullet point decorations to visually distinguish between different list item types.
- **Focus Mode:** A command to fold all code blocks except for the one containing the cursor, helping you focus on the current context.
- **Templating:** Quickly insert predefined content blocks into your documents.

## Templating

Point Blank allows you to define and expand custom templates to quickly insert structured content into your files.

### Configuration

Configure your templates in your VS Code `settings.json` under the `pointblank.templates` property. This property is a map where keys are the template names (e.g., "Book", "Person") and values are the relative paths to your template files within your workspace.

Example `settings.json` entry:

```json
"pointblank.templates": {
  "Book": ".vscode/templates/book.md",
  "Person": ".vscode/templates/person.md"
}
```

### Usage

Once configured, you can expand a template by typing `@TypeName ` (e.g., `@Book `) in your editor. The extension will replace `@TypeName ` with the content of your specified template file, maintaining proper indentation.

**Before:**
```
- My Reading List
  - @Book 
```

**After (assuming `book.md` contains `Title::\nAuthor::`):**
```
- My Reading List
  - (Book) Title::
    Author::
```

## Commands

| Command | Title | Keybinding |
| --- | --- | --- |
| `pointblank.focusMode` | Point Blank: Focus Mode (Hoisting) | `Alt+F` |
| `pointblank.unfocusMode` | Point Blank: Unfocus | `Alt+U` |

## Configuration

All extension settings, including colors for bullet points and debounce delay, can be found by searching for "Point Blank" in the VS Code Settings UI (`Ctrl+,` or `Cmd+,`).

## Roadmap

Future enhancements planned for Point Blank include:

-   Template quick file open
-   Block shifting
-   Timeline views
-   Multi-level tagging
-   Query sets
-   Object type views
-   Advanced keyboard navigation

## Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.

### Development

1.  Clone the repository.
2.  Run `pnpm install` to install the dependencies.
3.  Run `pnpm run watch` to start the webpack watcher.
4.  Press `F5` to open a new VS Code window with the extension loaded.