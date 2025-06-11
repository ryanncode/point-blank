import * as vscode from 'vscode';
import { FoldingUtils } from '../folding/foldingUtils';
import { ExtensionState } from '../state/extensionState';

/**
 * Implements the 'pointblank.focusMode' command.
 * This command folds all code blocks except for the one containing the cursor,
 * effectively "hoisting" the current block into focus.
 *
 * @param context The extension context.
 * @param extensionState The singleton instance of ExtensionState.
 */
export async function focusModeCommand(extensionState: ExtensionState): Promise<void> {
    const editor = extensionState.activeEditor;
    if (!editor) {
        vscode.window.showInformationMessage('No active editor found.');
        return;
    }

    const document = editor.document;
    const currentLine = editor.selection.active.line;

    try {
        const allFoldingRanges = await FoldingUtils.getAllFoldingRanges(document);
        const targetRange = FoldingUtils.findNearestFoldingBlock(currentLine, allFoldingRanges);

        if (targetRange) {
            // First, unfold everything to ensure a clean state.
            await vscode.commands.executeCommand('editor.unfoldAll');

            // Then, fold all ranges that are not part of the target's lineage (not ancestors or descendants).
            // This leaves a clear "path" to the focused block.
            for (const range of allFoldingRanges) {
                const isAncestor = range.start <= targetRange.start && range.end >= targetRange.end;
                const isDescendant = range.start >= targetRange.start && range.end <= targetRange.end;

                // We only want to fold ranges that are not in the direct line of the target.
                if (!isAncestor && !isDescendant) {
                    await vscode.commands.executeCommand('editor.fold', { selectionLines: [range.start] });
                }
            }
        } else {
            vscode.window.showInformationMessage('No folding block found at the current line.');
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Error in Focus Mode: ${error instanceof Error ? error.message : String(error)}`);
    }
}