// This is the main entry point for the Point Blank VS Code extension.
// It handles the activation and deactivation lifecycle of the extension,
// and orchestrates the registration of providers and event listeners.

import * as vscode from 'vscode';
import { IndentFoldingRangeProvider } from './providers/indentFoldingProvider';
import { ExtensionState } from './state/extensionState';
import { Configuration } from './config/configuration';
import { focusModeCommand } from './commands/focusMode';
import { unfocusModeCommand } from './commands/unfocusMode';
import { handleEnterKeyCommand } from './commands/handleEnterKey';
import { expandTemplateCommand } from './commands/expandTemplate';
import { quickOpenFileCommand } from './commands/quickOpenFile';
import { TemplateService } from './templates/templateService';
import { DocumentModel } from './document/documentModel';
import { DecorationManager } from './decorations/decorationManager'; // New import

/**
 * Activates the Point Blank extension.
 * This function is called when the extension is activated, which is determined by the
 * `activationEvents` in `package.json`.
 *
 * It initializes the decoration manager and folding range provider, and registers
 * necessary event listeners to update decorations and folding ranges
 * when the active editor changes or the document content is modified.
 *
 * @param context The extension context provided by VS Code.
 */
export function activate(context: vscode.ExtensionContext): void {
    const extensionState = ExtensionState.getInstance();
    const configuration = Configuration.getInstance();
    const templateService = TemplateService.getInstance();
    const decorationManager = new DecorationManager(); // Instantiate DecorationManager

    // Initialize decorations based on current configuration
    configuration.initializeDecorationTypes();
    decorationManager.initialize(); // Initialize DecorationManager after types are set

    // Set initial active editor for ExtensionState
    extensionState.setActiveEditor(vscode.window.activeTextEditor);

    // Register Focus Mode (Hoisting) command
    context.subscriptions.push(vscode.commands.registerCommand('pointblank.focusMode', () => focusModeCommand(extensionState)));

    // Register Unfocus command
    context.subscriptions.push(vscode.commands.registerCommand('pointblank.unfocusMode', unfocusModeCommand));

    // Register custom Enter key command
    context.subscriptions.push(vscode.commands.registerCommand('pointblank.handleEnterKey', handleEnterKeyCommand));

    // Register the new template expansion command
    context.subscriptions.push(vscode.commands.registerCommand('pointblank.expandTemplate', expandTemplateCommand));

    // Register the new quick open file from template command
    context.subscriptions.push(vscode.commands.registerCommand('pointblank.quickOpenFile', quickOpenFileCommand));

    // Initialize DocumentModel for all currently open text documents
    vscode.workspace.textDocuments.forEach(document => {
        if (document.uri.scheme === 'file' || document.uri.scheme === 'untitled') {
            const model = new DocumentModel(document);
            extensionState.addDocumentModel(document.uri.toString(), model);
            model.setDecorationManager(decorationManager); // Link DocumentModel to DecorationManager
        }
    });

    // Listen for new text documents being opened
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(document => {
        if (document.uri.scheme === 'file' || document.uri.scheme === 'untitled') {
            const model = new DocumentModel(document);
            extensionState.addDocumentModel(document.uri.toString(), model);
            model.setDecorationManager(decorationManager); // Link DocumentModel to DecorationManager
        }
    }));

    // Listen for configuration changes to re-initialize decorations
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async event => {
        if (event.affectsConfiguration('pointblank')) {
            configuration.initializeDecorationTypes();
            // Re-trigger decoration updates via the DecorationManager
            if (vscode.window.activeTextEditor) {
                const documentModel = extensionState.getDocumentModel(vscode.window.activeTextEditor.document.uri.toString());
                if (documentModel) {
                    decorationManager.updateDecorations(documentModel.documentTree, [new vscode.Range(0, 0, vscode.window.activeTextEditor.document.lineCount, 0)]);
                }
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
    // The DecorationManager handles setting its active editor internally.
    vscode.window.onDidChangeActiveTextEditor(editor => {
        extensionState.setActiveEditor(editor);
        if (editor) {
            const documentModel = extensionState.getDocumentModel(editor.document.uri.toString());
            if (documentModel) {
                documentModel.triggerUpdateDecorations();
            }
        }
    }, null, context.subscriptions);

    // Listen for document close events to dispose of DocumentModel instances
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(document => {
        extensionState.removeDocumentModel(document.uri.toString());
    }));

    // Add DecorationManager to disposables
    context.subscriptions.push(decorationManager);
}

/**
 * Deactivates the Point Blank extension.
 * This function is called when the extension is deactivated.
 * It disposes of all active decoration types and DocumentModel instances to prevent memory leaks.
 */
export function deactivate(): void {
    ExtensionState.getInstance().disposeDecorationTypes();
    // The DecorationManager is disposed via context.subscriptions
}

