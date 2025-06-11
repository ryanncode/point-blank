// This is the main entry point for the Point Blank VS Code extension.
// It handles the activation and deactivation lifecycle of the extension,
// and orchestrates the registration of providers and event listeners.

import * as vscode from 'vscode';
import { IndentFoldingRangeProvider } from './providers/indentFoldingProvider';
import { DecorationApplier } from './decorations/decorationApplier';
import { debounce } from './utils/debounce';
import { ExtensionState } from './state/extensionState';
import { Configuration } from './config/configuration';
import { focusModeCommand } from './commands/focusMode';
import { unfocusModeCommand } from './commands/unfocusMode';
import { handleEnterKeyCommand } from './commands/handleEnterKey';

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
    const extensionState = ExtensionState.getInstance();
    const configuration = Configuration.getInstance();
    const decorationApplier = new DecorationApplier();

    // Initialize decorations based on current configuration
    configuration.initializeDecorationTypes();

    // Set initial active editor
    extensionState.setActiveEditor(vscode.window.activeTextEditor);

    // Register Focus Mode (Hoisting) command
    context.subscriptions.push(vscode.commands.registerCommand('pointblank.focusMode', () => focusModeCommand(extensionState)));

    // Register Unfocus command
    context.subscriptions.push(vscode.commands.registerCommand('pointblank.unfocusMode', unfocusModeCommand));

    // Register custom Enter key command
    context.subscriptions.push(vscode.commands.registerCommand('pointblank.handleEnterKey', handleEnterKeyCommand));

    // Initial update of decorations if an editor is already active.
    if (extensionState.activeEditor) {
        decorationApplier.updateDecorations(extensionState.activeEditor);
    }

    // Listen for configuration changes to re-initialize decorations
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('pointblank')) {
            configuration.initializeDecorationTypes();
            // Re-apply decorations to the active editor if settings change
            if (extensionState.activeEditor) {
                decorationApplier.updateDecorations(extensionState.activeEditor);
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
        extensionState.setActiveEditor(editor);
        if (extensionState.activeEditor) {
            decorationApplier.updateDecorations(extensionState.activeEditor);
        }
    }, null, context.subscriptions);

    // Listen for changes in the text document.
    // If the change occurs in the currently active editor's document,
    // trigger a decoration update to reflect the latest content.
    const debouncedUpdateDecorations = debounce(() => {
        if (extensionState.activeEditor) {
            decorationApplier.updateDecorations(extensionState.activeEditor);
        }
    }, 30); // Debounce time of 30ms

    vscode.workspace.onDidChangeTextDocument(event => {
        if (extensionState.activeEditor && event.document === extensionState.activeEditor.document) {
            debouncedUpdateDecorations();
        }
    }, null, context.subscriptions);

    // Debounced update for visible range changes (scrolling)
    vscode.window.onDidChangeTextEditorVisibleRanges(event => {
        if (extensionState.activeEditor && event.textEditor === extensionState.activeEditor) {
            debouncedUpdateDecorations();
        }
    }, null, context.subscriptions);
}

/**
 * Deactivates the Point Blank extension.
 * This function is called when the extension is deactivated.
 * It disposes of all active decoration types to prevent memory leaks.
 */
export function deactivate(): void {
    ExtensionState.getInstance().disposeDecorationTypes();
}

