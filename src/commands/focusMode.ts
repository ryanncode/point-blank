import * as vscode from 'vscode';
import { ExtensionState } from '../state/extensionState';

/**
 * Implements the 'pointblank.focusMode' command.
 * This command folds all code blocks except for the one containing the cursor,
 * effectively "hoisting" the current block into focus.
 *
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
        // Ensure a clean, fully unfolded state before applying focus
        await vscode.commands.executeCommand('editor.unfoldAll');

        // Get all folding ranges from VS Code's native folding provider
        const allFoldingRanges = await vscode.commands.executeCommand(
            'vscode.executeFoldingRangeProvider',
            document.uri
        ) as vscode.FoldingRange[];

        if (!allFoldingRanges || allFoldingRanges.length === 0) {
            return; // No foldable regions found
        }

        const rangesToKeepUnfolded = new Set<vscode.FoldingRange>();
        let currentContainingRange: vscode.FoldingRange | undefined;

        // Find the innermost folding range that contains the current line
        // This is the "current block" the user is focused on.
        for (const range of allFoldingRanges) {
            if (currentLine >= range.start && currentLine <= range.end) {
                // If multiple ranges contain the line, pick the smallest (most specific) one
                if (!currentContainingRange ||
                    (range.end - range.start < currentContainingRange.end - currentContainingRange.start)) {
                    currentContainingRange = range;
                }
            }
        }

        if (currentContainingRange) {
            rangesToKeepUnfolded.add(currentContainingRange);

            // Find all true parent ranges of the current containing range
            let tempChildRange: vscode.FoldingRange | undefined = currentContainingRange;
            while (tempChildRange) {
                let immediateParent: vscode.FoldingRange | undefined;
                for (const potentialParent of allFoldingRanges) {
                    // A potential parent must contain the child range
                    if (potentialParent.start < tempChildRange.start && potentialParent.end >= tempChildRange.end) {
                        // Among all containing ranges, find the one that is the "tightest fit"
                        // i.e., its start line is closest to the child's start, and its end line is closest to the child's end.
                        if (!immediateParent ||
                            (potentialParent.start > immediateParent.start ||
                             (potentialParent.start === immediateParent.start && potentialParent.end < immediateParent.end))) {
                            immediateParent = potentialParent;
                        }
                    }
                }

                if (immediateParent && !rangesToKeepUnfolded.has(immediateParent)) {
                    rangesToKeepUnfolded.add(immediateParent);
                    tempChildRange = immediateParent; // Move up to the parent for the next iteration
                } else {
                    tempChildRange = undefined; // No more immediate parents found
                }
            }
        }

        // Iterate through all folding ranges and fold those not in rangesToKeepUnfolded
        for (const range of allFoldingRanges) {
            if (!rangesToKeepUnfolded.has(range)) {
                await vscode.commands.executeCommand('editor.fold', { selectionLines: [range.start] });
            }
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Error in Focus Mode: ${error instanceof Error ? error.message : String(error)}`);
    }
}