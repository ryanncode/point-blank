import * as vscode from 'vscode';
import { ExtensionState } from '../state/extensionState';

/**
 * Implements the 'pointblank.focusMode' command.
 * This command folds all code blocks except for the one containing the cursor and its parent blocks,
 * effectively "hoisting" the current block into focus.
 *
 * @param extensionState The singleton instance of ExtensionState, providing access to the active editor.
 */
export async function focusModeCommand(extensionState: ExtensionState): Promise<void> {
    const editor = extensionState.activeEditor;
    if (!editor) {
        vscode.window.showInformationMessage('Point Blank: No active editor found.');
        return;
    }

    const document = editor.document;
    const currentLine = editor.selection.active.line;

    try {
        // 1. Start with a clean slate by unfolding everything.
        await vscode.commands.executeCommand('editor.unfoldAll');

        // 2. Get all possible folding ranges from the active document.
        const allFoldingRanges = await vscode.commands.executeCommand<vscode.FoldingRange[]>(
            'vscode.executeFoldingRangeProvider',
            document.uri
        );

        if (!allFoldingRanges || allFoldingRanges.length === 0) {
            return; // No foldable regions found.
        }

        // 3. Identify the hierarchy of ranges to keep unfolded.
        const rangesToKeepUnfolded = new Set<vscode.FoldingRange>();
        let currentBlockRange: vscode.FoldingRange | undefined;

        // Find the innermost folding range that contains the cursor.
        for (const range of allFoldingRanges) {
            if (currentLine >= range.start && currentLine <= range.end) {
                if (!currentBlockRange || (range.end - range.start < currentBlockRange.end - currentBlockRange.start)) {
                    currentBlockRange = range;
                }
            }
        }

        // If a containing range is found, trace its parentage up to the root.
        if (currentBlockRange) {
            rangesToKeepUnfolded.add(currentBlockRange);

            let childRange: vscode.FoldingRange | undefined = currentBlockRange;
            while (childRange) {
                let immediateParent: vscode.FoldingRange | undefined;
                // Find the tightest fitting parent range.
                for (const potentialParent of allFoldingRanges) {
                    if (potentialParent.start < childRange.start && potentialParent.end >= childRange.end) {
                        if (!immediateParent || (potentialParent.start > immediateParent.start || (potentialParent.start === immediateParent.start && potentialParent.end < immediateParent.end))) {
                            immediateParent = potentialParent;
                        }
                    }
                }

                if (immediateParent && !rangesToKeepUnfolded.has(immediateParent)) {
                    rangesToKeepUnfolded.add(immediateParent);
                    childRange = immediateParent; // Move up the hierarchy.
                } else {
                    childRange = undefined; // No more parents found.
                }
            }
        }

        // 4. Fold all ranges that are not part of the focused hierarchy.
        for (const range of allFoldingRanges) {
            if (!rangesToKeepUnfolded.has(range)) {
                await vscode.commands.executeCommand('editor.fold', { selectionLines: [range.start] });
            }
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Point Blank: Error in Focus Mode: ${error instanceof Error ? error.message : String(error)}`);
    }
}