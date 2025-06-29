
import * as vscode from 'vscode';
import { processClipboardLinesPure, processSingleLinePaste, processTypedNodePaste } from '../utils/pasteUtils';
function detectBulletFromLine(line: string): string | null {
    // Match a bullet at the start: bullet char + space (including '+')
    const match = line.match(/^\s*([\u2022\-\*\•\+])\s/);
    return match ? match[1] + ' ' : null;
}

function getBulletStyle(document: vscode.TextDocument, lineNumber: number): string {
    const totalLines = document.lineCount;
    // Check above
    for (let i = lineNumber - 1; i >= 0; i--) {
        const bullet = detectBulletFromLine(document.lineAt(i).text);
        if (bullet) { return bullet; }
        if (document.lineAt(i).text.trim() !== '') { break; }
    }
    // Check below
    for (let i = lineNumber + 1; i < totalLines; i++) {
        const bullet = detectBulletFromLine(document.lineAt(i).text);
        if (bullet) { return bullet; }
        if (document.lineAt(i).text.trim() !== '') { break; }
    }
    return '• ';
}

export class PasteWithBullets {
    public async pasteWithBulletsCommand(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }

        const clipboardText = await vscode.env.clipboard.readText();
        const clipboardLines = clipboardText.split(/\r?\n/);
        if (clipboardLines.length === 0) {
            await vscode.commands.executeCommand('default:paste');
            return;
        }

        const { selection, document } = editor;
        const currentLine = document.lineAt(selection.start.line);

        // Typed node paste
        if (clipboardLines.length > 0 && /^\(\w+\)/.test(clipboardLines[0].trim())) {
            const adjustedClipboardLines = processTypedNodePaste({ clipboardLines });
            const textToInsert = adjustedClipboardLines.join('\n');
            await editor.edit(editBuilder => {
                editBuilder.replace(selection, textToInsert);
            });
            const lastLineIdx = adjustedClipboardLines.length - 1;
            const lastLineText = adjustedClipboardLines[lastLineIdx] || '';
            const newPosition = new vscode.Position(selection.start.line + lastLineIdx, lastLineText.length);
            editor.selection = new vscode.Selection(newPosition, newPosition);
            return;
        }

        // Multi-line paste
        if (clipboardLines.length > 1 && selection.isEmpty) {
            let partBeforeCursor: string;
            let partAfterCursor: string;
            // If cursor is at first non-whitespace character, treat as start of line for bullet logic
            if (selection.start.character === currentLine.firstNonWhitespaceCharacterIndex) {
                partBeforeCursor = '';
                partAfterCursor = currentLine.text.substring(selection.start.character);
            } else {
                partBeforeCursor = currentLine.text.substring(0, selection.start.character);
                partAfterCursor = currentLine.text.substring(selection.start.character);
            }
            const bullet = getBulletStyle(document, currentLine.lineNumber);
            const newLines = processClipboardLinesPure({
                clipboardLines,
                partBeforeCursor,
                partAfterCursor,
                currentLineText: currentLine.text,
                currentLineIndent: currentLine.firstNonWhitespaceCharacterIndex,
                bulletTypeForLine: () => ({ bulletType: 'none' }),
                getBullet: () => bullet,
                document,
                lineNumber: currentLine.lineNumber
            });
            await editor.edit(editBuilder => {
                editBuilder.replace(currentLine.range, newLines.join('\n'));
            });
            const lastIdx = newLines.length - 1;
            const lastLineText = newLines[lastIdx];
            const newPosition = new vscode.Position(selection.start.line + lastIdx, lastLineText.length);
            editor.selection = new vscode.Selection(newPosition, newPosition);
            return;
        }

        // Single-line paste: use the same bullet detection and context as multi-line paste
        let partBeforeCursor: string;
        let partAfterCursor: string;
        if (selection.start.character === currentLine.firstNonWhitespaceCharacterIndex) {
            partBeforeCursor = '';
            partAfterCursor = currentLine.text.substring(selection.start.character);
        } else {
            partBeforeCursor = currentLine.text.substring(0, selection.start.character);
            partAfterCursor = currentLine.text.substring(selection.start.character);
        }
        const bullet = getBulletStyle(document, currentLine.lineNumber);
        const newLines = processClipboardLinesPure({
            clipboardLines: [clipboardLines[0]],
            partBeforeCursor,
            partAfterCursor,
            currentLineText: currentLine.text,
            currentLineIndent: currentLine.firstNonWhitespaceCharacterIndex,
            bulletTypeForLine: () => ({ bulletType: 'none' }),
            getBullet: () => bullet,
            document,
            lineNumber: currentLine.lineNumber
        });
        await editor.edit(editBuilder => {
            editBuilder.replace(currentLine.range, newLines[0]);
        });
        const newPosition = new vscode.Position(selection.start.line, newLines[0].length);
        editor.selection = new vscode.Selection(newPosition, newPosition);
    }
}
