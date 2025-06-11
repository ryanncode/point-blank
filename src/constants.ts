import * as vscode from 'vscode';

let _bulletDecorationType: vscode.TextEditorDecorationType;
let _starBulletDecorationType: vscode.TextEditorDecorationType;
let _plusBulletDecorationType: vscode.TextEditorDecorationType;
let _minusBulletDecorationType: vscode.TextEditorDecorationType;
let _numberedBulletDecorationType: vscode.TextEditorDecorationType;
let _blockquoteDecorationType: vscode.TextEditorDecorationType;

export function initializeDecorations(): void {
    const configuration = vscode.workspace.getConfiguration('pointblank');

    // Dispose existing decorations if they exist to prevent memory leaks
    if (_bulletDecorationType) { _bulletDecorationType.dispose(); }
    if (_starBulletDecorationType) { _starBulletDecorationType.dispose(); }
    if (_plusBulletDecorationType) { _plusBulletDecorationType.dispose(); }
    if (_minusBulletDecorationType) { _minusBulletDecorationType.dispose(); }
    if (_numberedBulletDecorationType) { _numberedBulletDecorationType.dispose(); }
    if (_blockquoteDecorationType) { _blockquoteDecorationType.dispose(); }

    /**
     * Defines the decoration type for the default bullet points.
     * These are typically used for general list items.
     */
    _bulletDecorationType = vscode.window.createTextEditorDecorationType({
        before: {
            contentText: '•',
            color: configuration.get('level1Color') || new vscode.ThemeColor('editor.foreground'),
            margin: '0 0.5em 0 0',
        },
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
    });

    /**
     * Defines the decoration type for custom bullet points using an asterisk (*).
     * This provides a subtle yellow/gold color to differentiate them.
     */
    _starBulletDecorationType = vscode.window.createTextEditorDecorationType({
        color: configuration.get('level2Color') || new vscode.ThemeColor('editorWarning.foreground'),
    });

    /**
     * Defines the decoration type for custom bullet points using a plus sign (+).
     * This provides a subtle green color, often indicating additions.
     */
    _plusBulletDecorationType = vscode.window.createTextEditorDecorationType({
        color: configuration.get('level3Color') || new vscode.ThemeColor('editorGutter.addedBackground'),
    });

    /**
     * Defines the decoration type for custom bullet points using a minus sign (-).
     * This provides a subtle red color, often indicating deletions.
     */
    _minusBulletDecorationType = vscode.window.createTextEditorDecorationType({
        color: configuration.get('level4Color') || new vscode.ThemeColor('editorGutter.deletedBackground'),
    });

    /**
     * Defines the decoration type for numbered bullet points (e.g., "1.", "2)").
     * This provides a subtle orange/yellow color for differentiation.
     */
    _numberedBulletDecorationType = vscode.window.createTextEditorDecorationType({
        color: configuration.get('level5Color') || new vscode.ThemeColor('editorBracketHighlight.foreground3'),
    });

    /**
     * Defines the decoration type for blockquote prefixes (>).
     * This provides a subtle color for blockquote elements.
     */
    _blockquoteDecorationType = vscode.window.createTextEditorDecorationType({
        color: configuration.get('blockquoteColor') || new vscode.ThemeColor('editor.foreground'),
    });
}

// Initialize decorations on extension load
initializeDecorations();

export {
    _bulletDecorationType as bulletDecorationType,
    _starBulletDecorationType as starBulletDecorationType,
    _plusBulletDecorationType as plusBulletDecorationType,
    _minusBulletDecorationType as minusBulletDecorationType,
    _numberedBulletDecorationType as numberedBulletDecorationType,
    _blockquoteDecorationType as blockquoteDecorationType
};