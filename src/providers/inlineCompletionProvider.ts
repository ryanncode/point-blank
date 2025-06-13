import * as vscode from 'vscode';
import { ExtensionState } from '../state/extensionState';

/**
 * Provides inline completion functionality for template expansion.
 * It listens for text document changes to detect specific trigger patterns
 * (e.g., "@TypeName ") and then executes the corresponding template expansion command.
 */
export class InlineCompletionProvider implements vscode.Disposable {
    private _disposables: vscode.Disposable[] = [];
    private _extensionState: ExtensionState;

    constructor(context: vscode.ExtensionContext) {
        this._extensionState = ExtensionState.getInstance();
        // Listen for text document changes
        context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(this.onDidChangeTextDocument, this));
    }

    /**
     * Handles text document changes to detect template expansion triggers.
     */
    private onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent): void {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || activeEditor.document !== event.document) {
            return;
        }

        // Only process single character changes, specifically a space
        if (event.contentChanges.length === 1) {
            const change = event.contentChanges[0];
            const line = event.document.lineAt(change.range.start.line);
            const lineText = line.text;

            // Check for the pattern "@TypeName " followed by a space
            const typedNodeTriggerMatch = lineText.match(/^\s*@([a-zA-Z0-9_]+)\s$/);

            if (typedNodeTriggerMatch && change.text === ' ') {
                const typeName = typedNodeTriggerMatch[1];
                // Execute the expandTemplate command
                vscode.commands.executeCommand('pointblank.expandTemplate', typeName, this._extensionState.getDocumentModel(event.document.uri.toString()));
                // Return early as the command will trigger another document change event
                return;
            }
        }
    }

    /**
     * Disposes of all resources held by the InlineCompletionProvider.
     */
    public dispose(): void {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    }
}