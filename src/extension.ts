// This is the main entry point for the Point Blank VS Code extension.
// It handles the activation and deactivation lifecycle of the extension,
// and orchestrates the registration of providers and event listeners.

import * as vscode from 'vscode';
import { IndentFoldingRangeProvider } from './foldingProvider';
import { DecorationApplier } from './decorations/decorationApplier';
import { initializeDecorations } from './constants';
import { debounce } from './utils/debounce';

/**
 * Activates the Point Blank extension.
 * This function is called when the extension is activated, which is determined by the
 * `activationEvents` in `package.json`.
 *
 * It initializes the decoration applier and folding range provider, and registers
 * necessary event listeners to update decorations and folding ranges
 * when the active editor changes or the document content is modified.
 *
 * @param context The extension context provided by VS Code.
 */
export function activate(context: vscode.ExtensionContext): void {
    // Initialize decorations based on current configuration
    initializeDecorations();

    let activeEditor = vscode.window.activeTextEditor;
    const decorationApplier = new DecorationApplier(activeEditor);

    // Initial update of decorations if an editor is already active.
    if (activeEditor) {
        decorationApplier.updateDecorations();
    }

    // Listen for configuration changes to re-initialize decorations
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('pointblank')) {
            initializeDecorations();
            // Re-apply decorations to the active editor if settings change
            if (vscode.window.activeTextEditor) {
                decorationApplier.setActiveEditor(vscode.window.activeTextEditor);
                decorationApplier.updateDecorations();
            }
        }
    }));

    // Register the IndentFoldingRangeProvider for specified languages.
    // This enables indentation-based folding in plain text, markdown, and untitled files.
    context.subscriptions.push(
        vscode.languages.registerFoldingRangeProvider(
            ['plaintext', 'markdown', 'untitled'],
            new IndentFoldingRangeProvider()
        )
    );

    // Listen for changes in the active text editor.
    // When the active editor changes, update the decoration applier's editor
    // and trigger a decoration update for the new editor.
    vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        decorationApplier.setActiveEditor(activeEditor);
        if (activeEditor) {
            decorationApplier.updateDecorations();
        }
    }, null, context.subscriptions);

    // Listen for changes in the text document.
    // If the change occurs in the currently active editor's document,
    // trigger a decoration update to reflect the latest content.
    // Listen for changes in the text document.
    // If the change occurs in the currently active editor's document,
    // trigger a decoration update to reflect the latest content.
    const debouncedUpdateDecorations = debounce(() => {
        if (activeEditor) {
            decorationApplier.updateDecorations();
        }
    }, 30); // Debounce time of 30ms

    vscode.workspace.onDidChangeTextDocument(event => {
        if (activeEditor && event.document === activeEditor.document) {
            debouncedUpdateDecorations();
        }
    }, null, context.subscriptions);

    // NEW: Debounced update for visible range changes (scrolling)
    vscode.window.onDidChangeTextEditorVisibleRanges(event => {
        if (activeEditor && event.textEditor === activeEditor) {
            debouncedUpdateDecorations();
        }
    }, null, context.subscriptions);
}

/**
 * Deactivates the Point Blank extension.
 * This function is called when the extension is deactivated.
 * Currently, no specific cleanup is required beyond what VS Code handles automatically
 * by disposing of subscriptions.
 */
export function deactivate(): void {
    // No explicit cleanup needed as subscriptions are handled by context.subscriptions.
}

