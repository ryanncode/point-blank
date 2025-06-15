/**
 * This file is the main entry point for the Point Blank VS Code extension.
 * It handles the activation and deactivation lifecycle of the extension,
 * orchestrating the registration of commands, providers, and event listeners.
 */

import * as vscode from 'vscode';
import { findTypedNodeParent } from './utils/nodeUtils';
import { ExtensionState } from './state/extensionState';
import { Configuration } from './config/configuration';
import { focusModeCommand } from './commands/focusMode';
import { unfocusModeCommand } from './commands/unfocusMode';
import { EnterKeyHandler } from './commands/handleEnterKey';
import { expandTemplateCommand } from './commands/expandTemplate';
import { quickOpenFileCommand } from './commands/quickOpenFile';
import { TemplateService } from './templates/templateService';
import { DocumentModel } from './document/documentModel';
import { DecorationManager } from './decorations/decorationManager';
import { CommandManager } from './commands/commandManager';
import { InlineCompletionProvider } from './providers/inlineCompletionProvider';

/**
 * Activates the Point Blank extension.
 * This function is called by VS Code when the extension is activated, as defined
 * by the `activationEvents` in `package.json`. It sets up the core components,
 * registers commands, and initializes event listeners.
 *
 * @param context The extension context provided by VS Code, used for managing disposables.
 */
export function activate(context: vscode.ExtensionContext): void {

    // --- Singleton Initializations ---
    const extensionState = ExtensionState.getInstance();
    const configuration = Configuration.getInstance();
    TemplateService.getInstance(); // Ensures it's initialized and watching for config changes.

    // --- Component Initializations ---
    const decorationManager = new DecorationManager(extensionState);
    const commandManager = new CommandManager(extensionState);

    // Initialize decoration types from configuration and prepare the manager.
    decorationManager.initialize();

    // Register command overrides (e.g., 'type', 'deleteLeft') and listeners.
    commandManager.register(context);

    // Register the inline completion provider for '@' sign triggers.
    context.subscriptions.push(new InlineCompletionProvider());

    // Set the initial active editor in the extension's state.
    extensionState.setActiveEditor(vscode.window.activeTextEditor);

    // --- Command Registrations ---
    context.subscriptions.push(
        vscode.commands.registerCommand('pointblank.focusMode', () => focusModeCommand(extensionState)),
        vscode.commands.registerCommand('pointblank.unfocusMode', unfocusModeCommand),
        vscode.commands.registerCommand('pointblank.handleEnterKey', () => new EnterKeyHandler(extensionState).handleEnterKeyCommand()),
        vscode.commands.registerCommand('pointblank.expandTemplate', expandTemplateCommand),
        vscode.commands.registerCommand('pointblank.quickOpenFile', quickOpenFileCommand)
    );

    // --- Document Model Management ---
    // Initialize a DocumentModel for each currently open text document.
    vscode.workspace.textDocuments.forEach(document => {
        if (document.uri.scheme === 'file' || document.uri.scheme === 'untitled') {
            const model = new DocumentModel(document);
            extensionState.addDocumentModel(document.uri.toString(), model);
            model.setDecorationManager(decorationManager);
            decorationManager.updateDecorations(model.documentTree);
        }
    });

    // Listen for new documents being opened and create a DocumentModel for them.
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(document => {
        if (document.uri.scheme === 'file' || document.uri.scheme === 'untitled') {
            const model = new DocumentModel(document);
            extensionState.addDocumentModel(document.uri.toString(), model);
            model.setDecorationManager(decorationManager);
            decorationManager.updateDecorations(model.documentTree);
        }
    }));

    // Listen for document close events to clean up and dispose of DocumentModel instances.
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(document => {
        extensionState.removeDocumentModel(document.uri.toString());
    }));

    // --- Event Listeners ---
    // Listen for configuration changes to re-initialize decoration styles.
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('pointblank')) {
            decorationManager.reloadDecorationTypes(); // Reload decoration types in manager
            // Re-trigger decoration updates for the active editor.
            if (vscode.window.activeTextEditor) {
                const documentModel = extensionState.getDocumentModel(vscode.window.activeTextEditor.document.uri.toString());
                if (documentModel) {
                    documentModel.triggerUpdateDecorations();
                }
            }
        }
    }));

    // Listen for changes in the active text editor to update decorations.
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        extensionState.setActiveEditor(editor);
        if (editor) {
            const documentModel = extensionState.getDocumentModel(editor.document.uri.toString());
            if (documentModel) {
                documentModel.triggerUpdateDecorations();
            }
        }
    }));

    // Listen for selection changes to update the 'pointblank.lineHasBullet' context key.
    // This is used for conditional UI, like the "outdent" command visibility.
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(event => {
        const editor = event.textEditor;
        if (!editor) return;

        const documentModel = extensionState.getDocumentModel(editor.document.uri.toString());
        if (!documentModel) return;

        const selection = editor.selection;
        let lineHasBullet = false;
        const line = editor.document.lineAt(selection.active.line);
        const blockNode = documentModel.documentTree.getNodeAtLine(line.lineNumber);
        if (blockNode) {
            const typedNodeParent = findTypedNodeParent(blockNode);
            vscode.commands.executeCommand('setContext', 'pointblank.isInTypedNode', !!typedNodeParent);
        } else {
            vscode.commands.executeCommand('setContext', 'pointblank.isInTypedNode', false);
        }

        if (selection.isSingleLine) {
            if (blockNode && blockNode.bulletRange) {
                lineHasBullet = true;
            }
        }
        vscode.commands.executeCommand('setContext', 'pointblank.lineHasBullet', lineHasBullet);
    }));

    // --- Resource Management ---
    // Ensure the DecorationManager is disposed when the extension is deactivated.
    context.subscriptions.push(decorationManager as vscode.Disposable);
}

/**
 * Deactivates the Point Blank extension.
 * This function is called by VS Code when the extension is deactivated. It's responsible
 * for cleaning up resources, such as disposing of decoration types and document models,
 * to prevent memory leaks.
 */
export function deactivate(): void {
    // The DecorationManager is automatically disposed via context.subscriptions.
}

