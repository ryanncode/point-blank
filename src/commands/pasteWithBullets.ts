import * as vscode from 'vscode';
import { determineBulletType } from '../utils/bulletPointUtils';

export class PasteWithBullets {
    public static async pasteWithBulletsCommand() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const document = editor.document;
        const position = editor.selection.active;
        const lineAtCursor = document.lineAt(position.line);
        const textAfterCursor = lineAtCursor.text.substring(position.character);
        const currentLineIndentation = lineAtCursor.firstNonWhitespaceCharacterIndex;

        const clipboardText = await vscode.env.clipboard.readText();
        const lines = clipboardText.split(/\r?\n/);

        const processedLines: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            const trimmedLine = line.trim();
            const lineOriginalIndent = line.match(/^\s*/)?.[0].length || 0;

            if (trimmedLine.length === 0) {
                processedLines.push(''); // Keep empty lines as they are
                continue;
            }

            // Check if the line already has a bullet point, using its actual indentation
            const { bulletType } = determineBulletType(line, lineOriginalIndent, false, false, 0); // lineNumber is not relevant for this check

            if (bulletType === 'none') {
                // Prepend default bullet point if no bullet exists
                line = `• ${line}`;
            }

            // Handle indentation
            if (i === 0) {
                // First line gets relative indentation based on cursor's current line
                const firstLineProcessedIndent = line.match(/^\s*/)?.[0].length || 0;
                const relativeIndent = currentLineIndentation + firstLineProcessedIndent;
                processedLines.push(' '.repeat(relativeIndent) + line.trimStart());
            } else {
                // Subsequent lines keep their absolute indentation from the clipboard
                processedLines.push(line);
            }
        }

        // Append the text that was originally after the cursor to the last processed line
        if (processedLines.length > 0) {
            processedLines[processedLines.length - 1] += textAfterCursor;
        } else {
            // If clipboard was empty, just insert the original text after cursor
            processedLines.push(textAfterCursor);
        }

        const textToInsert = processedLines.join('\n');

        await editor.edit(editBuilder => {
            // Delete text after cursor on current line before inserting
            const rangeToDelete = new vscode.Range(position, lineAtCursor.range.end);
            editBuilder.delete(rangeToDelete);
            editBuilder.insert(position, textToInsert);
        });

        // Set new cursor position at the end of the pasted content
        const newPositionLine = position.line + processedLines.length - 1;
        const newPositionCharacter = processedLines[processedLines.length - 1].length;
        editor.selection = new vscode.Selection(newPositionLine, newPositionCharacter, newPositionLine, newPositionCharacter);
    }
}