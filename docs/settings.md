---
layout: default
title: Settings
---

# Configuration

Here are the configurable settings for the Point Blank VS Code extension:


## Settings

`pointblank.defaultBulletColor`
Color for default bullet decorators.

`pointblank.starBulletColor`
Color for '*' bullet decorators.

`pointblank.plusBulletColor`
Color for '+' bullet decorators.

`pointblank.minusBulletColor`
Color for '-' bullet decorators.

`pointblank.numberedBulletColor`
Color for numbered bullet decorators.

`pointblank.blockquoteColor`
Color for blockquote decorators.  
Default: `#808080`

`pointblank.keyValueColor`
The color for Key:: properties.  
Default: `#6c757d`

`pointblank.templates`
Map of type names to their template file paths.  
Default: `{ "Book": ".vscode/templates/book.md", "Person": ".vscode/templates/person.md" }`

`pointblank.debounceDelay`
The debounce delay in milliseconds for document and visible range changes.  
Default: `15`

`pointblank.newFileDirectory`
The default directory for new files created via Quick Open.  
Default: `.`

`pointblank.viewportBuffer`
The number of extra lines to render above and below the visible viewport for decorations.  
Default: `20`

`pointblank.autoBullets`
Automatically insert bullet points on new lines and pastes. Toggle with the Point Blank: Toggle Auto Bullets command.  
Default: `true`