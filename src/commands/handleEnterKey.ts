import * as vscode from 'vscode';
import { FoldingUtils } from '../folding/foldingUtils';
import { FoldingCache } from '../folding/foldingCache'; // Import FoldingCache

export async function handleEnterKeyCommand() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const document = editor.document;
    const position = editor.selection.active;
    const foldingCache = FoldingCache.getInstance();

    let allRanges = foldingCache.getCache(document);

    if (!allRanges) {
        // If cache is stale or empty, compute and update cache
        allRanges = await FoldingUtils.getAllFoldingRanges(document);
        if (allRanges) {
            foldingCache.setCache(document, allRanges);
        }
    }

    if (!allRanges || allRanges.length === 0) {
        // If no folding ranges, execute default Enter key action
        await vscode.commands.executeCommand('type', { text: '\n' });
        return;
    }

    // Find the nearest folding block that starts at or contains the current line
    const currentLine = position.line;
    const nearestBlock = FoldingUtils.findNearestFoldingBlock(currentLine, allRanges);

    if (nearestBlock && nearestBlock.start === currentLine) {
        // Check if the block is folded
        const isFolded = editor.visibleRanges.every(range => {
            // A block is folded if its content lines are not visible
            return range.start.line > nearestBlock.end || range.end.line < nearestBlock.start + 1;
        });

        if (isFolded) {
            // Cursor is at the end of the title line of a folded block
            // Get the indentation of the title line
            const titleLine = document.lineAt(nearestBlock.start);
            const indentation = titleLine.text.substring(0, titleLine.firstNonWhitespaceCharacterIndex);

            // Insert a new line after the folded block with the same indentation
            const insertPosition = new vscode.Position(nearestBlock.end + 1, 0);
            await editor.edit(editBuilder => {
                editBuilder.insert(insertPosition, indentation + '\n');
            });

            // Move cursor to the new line
            const newPosition = new vscode.Position(nearestBlock.end + 1, indentation.length);
            editor.selection = new vscode.Selection(newPosition, newPosition);
            return;
        }
    }

    // If not on a folded block's title line or block is not folded, execute default Enter key action
    await vscode.commands.executeCommand('type', { text: '\n' });
}