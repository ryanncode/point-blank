import * as vscode from 'vscode';
import { ExtensionState } from '../state/extensionState';

/**
 * Provides the logic for inline template expansion. It doesn't use the official
 * `InlineCompletionItemProvider` API, but instead listens for text document changes
 * to detect a specific trigger pattern (e.g., "@TypeName ") and then executes the
 * template expansion command.
 */
export class InlineCompletionProvider implements vscode.Disposable {
    private _disposables: vscode.Disposable[] = [];
    private _extensionState: ExtensionState;

    constructor() {
        this._extensionState = ExtensionState.getInstance();
        const disposable = vscode.workspace.onDidChangeTextDocument(this.handleTextChange, this);
        this._disposables.push(disposable);
    }

    /**
     * Handles text document changes to detect the template expansion trigger.
     */
    private handleTextChange(event: vscode.TextDocumentChangeEvent): void {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || activeEditor.document !== event.document) {
            return;
        }

        const change = event.contentChanges[0];
        // The trigger is specifically the space character.
        if (!change || change.text !== ' ') {
            return;
        }

        const position = activeEditor.selection.active;
        const line = activeEditor.document.lineAt(position.line);
        const lineText = line.text;

        // Set a context key indicating if the current line starts with '@'.
        // This can be used for conditional UI elements in package.json.
        const isAtSignLine = lineText.trim().startsWith('@');
        vscode.commands.executeCommand('setContext', 'pointblank.isAtSignLine', isAtSignLine);

        // Regex to match the trigger pattern: "@TypeName " (preceded by optional whitespace).
        const triggerRegex = /^\s*@([a-zA-Z0-9_]+)\s$/;
        const match = lineText.match(triggerRegex);

        if (match) {
            const typeName = match[1];
            const documentModel = this._extensionState.getDocumentModel(event.document.uri.toString());
            if (documentModel) {
                // Execute the command to expand the template.
                vscode.commands.executeCommand('pointblank.expandTemplate', typeName, documentModel);
            }
        }
    }

    /**
     * Disposes of the event listener when the extension is deactivated.
     */
    public dispose(): void {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    }
}