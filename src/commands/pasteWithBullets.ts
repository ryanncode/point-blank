import * as vscode from 'vscode';
import { determineBulletType } from '../utils/bulletPointUtils';

export class PasteWithBullets {
    public static async pasteWithBulletsCommand() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const document = editor.document;
        const selection = editor.selection;
        const originalCursorCharacter = selection.start.character;
        const currentLine = document.lineAt(selection.start.line);
        const currentLineIndentation = currentLine.firstNonWhitespaceCharacterIndex;
        const { bulletType: currentLineBulletType, bulletRange: currentLineBulletRange } = determineBulletType(currentLine.text, currentLineIndentation, false, false, currentLine.lineNumber);

        const clipboardText = await vscode.env.clipboard.readText();
        const lines = clipboardText.split(/\r?\n/);

        const isPastingAtLineStart = originalCursorCharacter <= currentLineIndentation;

        const clipboardProcessedLines: string[] = [];

        if (lines.length > 0) {
            let firstClipboardLineContent = lines[0];
            const firstClipboardLineOriginalIndent = firstClipboardLineContent.match(/^\s*/)?.[0].length || 0;
            const firstClipboardLineTrimmedContent = firstClipboardLineContent.trim();
            const { bulletType: firstClipboardLineBulletType, bulletRange: firstClipboardLineBulletRange } = determineBulletType(firstClipboardLineContent, firstClipboardLineOriginalIndent, false, false, 0);

            if (isPastingAtLineStart) {
                // Scenario A: Pasting at the start of the line (replace entire line)
                let finalFirstLineContent: string;
                if (firstClipboardLineBulletType === 'none') {
                    finalFirstLineContent = `• ${firstClipboardLineTrimmedContent}`;
                } else {
                    // Preserve existing bullet from clipboard
                    finalFirstLineContent = firstClipboardLineContent.trim();
                }
                clipboardProcessedLines.push(' '.repeat(currentLineIndentation + firstClipboardLineOriginalIndent) + finalFirstLineContent);

            } else {
                // Scenario B: Pasting mid-line (insert text, remove bullet from pasted content)
                let textToInsertFromClipboard = firstClipboardLineContent;
                if (firstClipboardLineBulletType !== 'none' && firstClipboardLineBulletRange) {
                    // Remove the bullet from the pasted content
                    textToInsertFromClipboard = firstClipboardLineContent.substring(firstClipboardLineBulletRange.end.character).trimStart();
                } else {
                    textToInsertFromClipboard = firstClipboardLineContent.trimStart();
                }
                
                // The first line of the processed output will be the modified current line
                // This line will be constructed by combining parts of the current line with the processed clipboard content
                const partBeforeCursor = currentLine.text.substring(0, originalCursorCharacter);
                const partAfterCursor = currentLine.text.substring(originalCursorCharacter);
                clipboardProcessedLines.push(partBeforeCursor + textToInsertFromClipboard + partAfterCursor);
            }
        }

        // Process subsequent lines (only if multi-line paste)
        for (let i = 1; i < lines.length; i++) {
            let lineContent = lines[i];
            const lineOriginalIndent = lineContent.match(/^\s*/)?.[0].length || 0;
            const trimmedLineContent = lineContent.trim();

            if (trimmedLineContent.length === 0) {
                clipboardProcessedLines.push(''); // Keep empty lines as they are
                continue;
            }

            const { bulletType } = determineBulletType(lineContent, lineOriginalIndent, false, false, 0);

            let finalLine = lineContent;
            if (bulletType === 'none') {
                finalLine = `• ${trimmedLineContent}`;
            }
            
            // Subsequent lines keep their absolute indentation from the clipboard
            clipboardProcessedLines.push(' '.repeat(lineOriginalIndent) + finalLine.trimStart());
        }

        const textToInsert = clipboardProcessedLines.join('\n');

        await editor.edit(editBuilder => {
            if (isPastingAtLineStart) {
                // Replace the entire current line content
                const rangeToReplace = new vscode.Range(selection.start.line, 0, selection.start.line, currentLine.text.length);
                editBuilder.replace(rangeToReplace, textToInsert);
            } else {
                // Replace the selection (which is a collapsed range for insertion)
                editBuilder.replace(selection, textToInsert);
            }
        });

        // Set new cursor position at the end of the pasted content
        const newPositionLine = selection.start.line + clipboardProcessedLines.length - 1;
        let newPositionCharacter: number;

        if (clipboardProcessedLines.length === 1) {
            if (isPastingAtLineStart) {
                newPositionCharacter = clipboardProcessedLines[0].length;
            } else {
                newPositionCharacter = originalCursorCharacter + (clipboardProcessedLines[0].length - currentLine.text.length);
            }
        } else {
            newPositionCharacter = clipboardProcessedLines[clipboardProcessedLines.length - 1].length;
        }
        
        editor.selection = new vscode.Selection(newPositionLine, newPositionCharacter, newPositionLine, newPositionCharacter);
    }
}