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
        const parsedNodes = documentParser.parse(extensionState.activeEditor.document); // Initial full parse
        decorationApplier.updateDecorations(extensionState.activeEditor, parsedNodes);
    }

    // Listen for configuration changes to re-initialize decorations
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('pointblank')) {
            configuration.initializeDecorationTypes();
            // Re-apply decorations to the active editor if settings change
            if (extensionState.activeEditor) {
                const parsedNodes = documentParser.parse(extensionState.activeEditor.document); // Full parse on config change
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
            const parsedNodes = documentParser.parse(extensionState.activeEditor.document); // Full parse on active editor change
            decorationApplier.updateDecorations(extensionState.activeEditor, parsedNodes);
        }
    }, null, context.subscriptions);

    // Debounced update for full document parsing and decoration
    const debouncedFullUpdate = debounce((event?: vscode.TextDocumentChangeEvent) => {
        if (extensionState.activeEditor) {
            const parsedNodes = documentParser.parse(extensionState.activeEditor.document, event);
            decorationApplier.updateDecorations(extensionState.activeEditor, parsedNodes);
        }
    }, configuration.getDebounceDelay());

    // Fast debounced update for visible range changes (scrolling)
    const debouncedVisibleRangeUpdate = debounce(() => {
        if (extensionState.activeEditor) {
            const parsedNodes = documentParser.parse(extensionState.activeEditor.document);
            decorationApplier.updateDecorations(extensionState.activeEditor, parsedNodes);
        }
    }, 20);

    // Listen for text document changes
    vscode.workspace.onDidChangeTextDocument(event => {
        if (extensionState.activeEditor && event.document === extensionState.activeEditor.document) {
            // Immediate update for the changed lines
            const changedLines = event.contentChanges.map(c => c.range.start.line);
            const uniqueChangedLines = [...new Set(changedLines)];
            const parsedLines = documentParser.parse(event.document, event);
            const lineNodes = parsedLines.filter(node => uniqueChangedLines.includes(node.lineNumber));

            if (lineNodes.length > 0) {
                decorationApplier.updateLineDecorations(extensionState.activeEditor, lineNodes);
            }

            // Trigger the full debounced update
            debouncedFullUpdate(event);

            const change = event.contentChanges[0];
            if (change && change.text === ' ' && change.rangeLength === 0) {
                const line = event.document.lineAt(change.range.start.line);
                const textBeforeSpace = line.text.substring(0, change.range.start.character);
                const match = textBeforeSpace.match(/^\s*[-*]?\s*@(\w+)$/);
                if (match) {
                    const typeName = match[1];
                    vscode.commands.executeCommand('pointblank.expandTemplate', typeName);
                }
            }
        }
    }, null, context.subscriptions);

    // Listen for visible range changes (scrolling)
    vscode.window.onDidChangeTextEditorVisibleRanges(event => {
        if (extensionState.activeEditor && event.textEditor === extensionState.activeEditor) {
            debouncedVisibleRangeUpdate();
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

