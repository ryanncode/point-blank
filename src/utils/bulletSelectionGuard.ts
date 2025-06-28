import * as vscode from 'vscode';
import { ExtensionState } from '../state/extensionState';

/**
 * Utility to check if a position is inside a bullet range.
 */
function isPositionInBullet(position: vscode.Position, bulletRange: { start: { character: number }, end: { character: number } }): boolean {
    return position.character > bulletRange.start.character && position.character < bulletRange.end.character;
}

/**
 * Listen for selection changes and adjust if the cursor is inside a bullet.
 * This should be registered in the extension's activation.
 */
export function registerBulletSelectionGuard(extensionState: ExtensionState, context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(event => {
            const editor = event.textEditor;
            const document = editor.document;
            const selections = editor.selections;
            const documentModel = extensionState.getDocumentModel(document.uri.toString());
            if (!documentModel) {
                return;
            }

            // Only adjust if selection is a single-point cursor (not a range)
            let changed = false;
            const newSelections = selections.map(sel => {
                if (sel.start.line !== sel.end.line) {
                    return sel;
                }
                // Only adjust if selection is empty (cursor), not a range
                if (!sel.isEmpty) {
                    return sel;
                }
                const line = document.lineAt(sel.start.line);
                const blockNode = documentModel.documentTree.getNodeAtLine(line.lineNumber);
                if (!blockNode || blockNode.bulletType === 'none' || !blockNode.bulletRange) {
                    return sel;
                }
                // If at start of line, do not interfere (let VS Code handle left-arrow to previous line)
                if (sel.start.character === 0) {
                    return sel;
                }
                // If inside bullet, snap to after bullet
                if (isPositionInBullet(sel.start, blockNode.bulletRange)) {
                    changed = true;
                    return new vscode.Selection(
                        new vscode.Position(sel.start.line, blockNode.bulletRange.end.character),
                        new vscode.Position(sel.start.line, blockNode.bulletRange.end.character)
                    );
                }
                return sel;
            });
            if (changed) {
                editor.selections = newSelections;
            }
        })
    );
}
