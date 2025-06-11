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
import { expandTemplateCommand } from './commands/expandTemplate'; // New import
import { DocumentParser } from './document/documentParser';
import { DocumentNode } from './document/documentNode';
import { TemplateService } from './templates/templateService';

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
    const documentParser = new DocumentParser();
    const templateService = TemplateService.getInstance(); // New instance

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

    // Register the new template expansion command
    context.subscriptions.push(vscode.commands.registerCommand('pointblank.expandTemplate', expandTemplateCommand));

    // Initial update of decorations if an editor is already active.
    if (extensionState.activeEditor) {
        const parsedNodes = documentParser.parse(extensionState.activeEditor.document);
        decorationApplier.updateDecorations(extensionState.activeEditor, parsedNodes);
    }

    // Listen for configuration changes to re-initialize decorations
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('pointblank')) {
            configuration.initializeDecorationTypes();
            // Re-apply decorations to the active editor if settings change
            if (extensionState.activeEditor) {
                const parsedNodes = documentParser.parse(extensionState.activeEditor.document);
                decorationApplier.updateDecorations(extensionState.activeEditor, parsedNodes);
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
            const parsedNodes = documentParser.parse(extensionState.activeEditor.document);
            decorationApplier.updateDecorations(extensionState.activeEditor, parsedNodes);
        }
    }, null, context.subscriptions);

    // Listen for changes in the text document.
    // If the change occurs in the currently active editor's document,
    // trigger a decoration update to reflect the latest content.
    const debouncedUpdateDecorations = debounce(() => {
        if (extensionState.activeEditor) {
            const parsedNodes = documentParser.parse(extensionState.activeEditor.document); // Parse document
            decorationApplier.updateDecorations(extensionState.activeEditor, parsedNodes); // Pass parsed nodes
        }
    }, 30); // Debounce time of 30ms

    vscode.workspace.onDidChangeTextDocument(event => {
        if (extensionState.activeEditor && event.document === extensionState.activeEditor.document) {
            debouncedUpdateDecorations();

            const editor = extensionState.activeEditor;
            const document = event.document;
            const change = event.contentChanges[0];

            // Only trigger on single space insertion
            if (change && change.text === ' ' && change.rangeLength === 0) {
                const line = document.lineAt(change.range.start.line);
                // Match the text *before* the inserted space, including the bullet and @ prefix
                const textBeforeSpace = line.text.substring(0, change.range.start.character);
                const match = textBeforeSpace.match(/^\s*[-*]?\s*@(\w+)$/);

                if (match) {
                    const typeName = match[1];
                    // Execute the command to handle the template expansion, passing the typeName
                    vscode.commands.executeCommand('pointblank.expandTemplate', typeName);
                }
            }
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

