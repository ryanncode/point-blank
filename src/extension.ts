// This is the main logic file for the extension.

import * as vscode from 'vscode';

// Define the decoration type. This is created once and reused.
// We are using a simple bullet character '•' as the content.
const bulletDecorationType = vscode.window.createTextEditorDecorationType({
    // Use 'before' to place the content before the actual line content
    before: {
        contentText: '•',
        color: new vscode.ThemeColor('editor.foreground'), // Use theme's foreground color
        margin: '0 1em 0 0' // Add some margin to the right of the bullet
    },
    // This makes the decoration apply to the start of the line
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen
});

// This function gets called when the extension is activated
export function activate(context: vscode.ExtensionContext) {

    let activeEditor = vscode.window.activeTextEditor;

    // This function will apply the decorations
    function updateDecorations() {
        if (!activeEditor) {
            return;
        }

        const regEx = /^\s*/; // Regular expression to find leading whitespace
        const text = activeEditor.document.getText();
        const bulletDecorations: vscode.DecorationOptions[] = [];
        const lines = text.split('\n');

        lines.forEach((line, i) => {
            // Ignore empty lines
            if (line.trim().length === 0) {
                return;
            }

            const match = line.match(regEx);
            if (match) {
                const indentLength = match[0].length;
                
                // Position the decoration at the start of the line, right after the indentation
                const position = new vscode.Position(i, indentLength);
                const range = new vscode.Range(position, position);

                const decoration = { range };
                bulletDecorations.push(decoration);
            }
        });
        
        // Apply all decorations at once
        activeEditor.setDecorations(bulletDecorationType, bulletDecorations);
    }

    // Initial call to decorate the active editor
    if (activeEditor) {
        updateDecorations();
    }

    // Listen for when the active editor changes
    vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            updateDecorations();
        }
    }, null, context.subscriptions);

    // Listen for changes in the text document to re-apply decorations
    vscode.workspace.onDidChangeTextDocument(event => {
        if (activeEditor && event.document === activeEditor.document) {
            updateDecorations();
        }
    }, null, context.subscriptions);
}

// This function is called when your extension is deactivated
export function deactivate() {}