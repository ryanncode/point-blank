import * as vscode from 'vscode';
import { FoldingUtils } from '../folding/foldingUtils';
import { ExtensionState } from '../state/extensionState';
import { DocumentModel } from '../document/documentModel';
import { BlockNode } from '../document/blockNode';

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

    const documentModel = extensionState.getDocumentModel(document.uri.toString());
    if (!documentModel) {
        vscode.window.showInformationMessage('Document model not found for the active editor.');
        return;
    }

    const documentTree = documentModel.documentTree;
    let currentNode: BlockNode | undefined = documentTree.getNodeAtLine(currentLine);

    // If the current line is not a block node, do nothing as per the plan.
    if (!currentNode) {
        return;
    }

    const linesToKeepUnfolded = new Set<number>();
    let tempNode: BlockNode | undefined = currentNode;

    // Add the current node and all its ancestors to the set of lines to keep unfolded
    while (tempNode) {
        linesToKeepUnfolded.add(tempNode.lineNumber);
        tempNode = tempNode.parent;
    }

    try {
        const allFoldingRanges = await FoldingUtils.getAllFoldingRanges(document);
        const linesToFold: number[] = [];

        for (const range of allFoldingRanges) {
            let shouldFold = true;
            // Check if any line within this folding range is in our "keep unfolded" set
            for (let i = range.start; i <= range.end; i++) {
                if (linesToKeepUnfolded.has(i)) {
                    shouldFold = false;
                    break; // No need to check further lines in this range
                }
            }

            if (shouldFold) {
                linesToFold.push(range.start);
            }
        }

        // Execute fold commands for the identified lines
        if (linesToFold.length > 0) {
            await vscode.commands.executeCommand('editor.fold', { selectionLines: linesToFold });
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Error in Focus Mode: ${error instanceof Error ? error.message : String(error)}`);
    }
}