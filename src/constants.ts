import * as vscode from 'vscode';

/**
 * Defines the decoration type for the default bullet points.
 * These are typically used for general list items.
 */
export const bulletDecorationType = vscode.window.createTextEditorDecorationType({
    before: {
        contentText: '•',
        color: new vscode.ThemeColor('editor.foreground'),
        margin: '0 0.5em 0 0',
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
});

/**
 * Defines the decoration type for custom bullet points using an asterisk (*).
 * This provides a subtle yellow/gold color to differentiate them.
 */
export const starBulletDecorationType = vscode.window.createTextEditorDecorationType({
    color: new vscode.ThemeColor('editorWarning.foreground'),
});

/**
 * Defines the decoration type for custom bullet points using a plus sign (+).
 * This provides a subtle green color, often indicating additions.
 */
export const plusBulletDecorationType = vscode.window.createTextEditorDecorationType({
    color: new vscode.ThemeColor('editorGutter.addedBackground'),
});

/**
 * Defines the decoration type for custom bullet points using a minus sign (-).
 * This provides a subtle red color, often indicating deletions.
 */
export const minusBulletDecorationType = vscode.window.createTextEditorDecorationType({
    color: new vscode.ThemeColor('editorGutter.deletedBackground'),
});

/**
 * Defines the decoration type for numbered bullet points (e.g., "1.", "2)").
 * This provides a subtle orange/yellow color for differentiation.
 */
export const numberedBulletDecorationType = vscode.window.createTextEditorDecorationType({
    color: new vscode.ThemeColor('editorBracketHighlight.foreground3'),
});