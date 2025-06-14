import * as vscode from 'vscode';
import { ExtensionState } from '../state/extensionState';
import { BlockNode } from '../document/blockNode';
import { determineBulletType } from '../utils/bulletPointUtils';

/**
 * Implements the `pointblank.pasteWithBullets` command, which provides intelligent pasting
 * of text, ensuring that each line is formatted as a bullet point.
 */
export class PasteWithBullets {
    private _extensionState: ExtensionState;

    constructor(extensionState: ExtensionState) {
        this._extensionState = extensionState;
    }

    /**
     * Main command handler for pasting with bullets.
     */
    public async pasteWithBulletsCommand(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const clipboardText = await vscode.env.clipboard.readText();
        const clipboardLines = clipboardText.split(/\r?\n/);
        if (clipboardLines.length === 0) return;

        const { selection, document } = editor;
        const currentLine = document.lineAt(selection.start.line);

        const documentModel = this._extensionState.getDocumentModel(document.uri.toString());
        if (!documentModel) {
            // Fallback to default paste if document model is not available
            await vscode.commands.executeCommand('default:paste');
            return;
        }
        const currentBlockNode = documentModel.documentTree.getNodeAtLine(currentLine.lineNumber);
        if (!currentBlockNode) {
            // Fallback to default paste if current block node is not available
            await vscode.commands.executeCommand('default:paste');
            return;
        }

        if (this._isTypedNodePaste(clipboardLines, currentLine.firstNonWhitespaceCharacterIndex)) {
            const pasteStartCharacter = selection.start.character;

            const adjustedClipboardLines: string[] = [];
            if (clipboardLines.length > 0) {
                const firstClipboardLine = clipboardLines[0];
                const originalFirstLineIndent = firstClipboardLine.match(/^\s*/)?.[0].length || 0;

                // The first line of the pasted content should simply be its trimmed content.
                // Its indentation will be handled by the 'replace' operation at selection.start.character.
                adjustedClipboardLines.push(firstClipboardLine.trimStart());

                // For subsequent lines, calculate their relative indentation to the first line
                // and apply it on top of the pasteStartCharacter.
                for (let i = 1; i < clipboardLines.length; i++) {
                    const line = clipboardLines[i];
                    const originalLineIndent = line.match(/^\s*/)?.[0].length || 0;
                    const contentWithoutOriginalIndent = line.substring(originalLineIndent);

                    // Calculate the relative indent from the original first line of the clipboard content
                    const relativeIndent = originalLineIndent - originalFirstLineIndent;

                    // Calculate the new absolute indent for the current line
                    const newAbsoluteIndent = pasteStartCharacter + relativeIndent;

                    adjustedClipboardLines.push(' '.repeat(newAbsoluteIndent) + contentWithoutOriginalIndent);
                }
            }

            const textToInsert = adjustedClipboardLines.join('\n');

            await editor.edit(editBuilder => {
                editBuilder.replace(selection, textToInsert);
            });

            this.updateCursorPosition(editor, adjustedClipboardLines, currentLine, selection);
            return;
        }

        // Process the clipboard content line by line.
        const processedLines = this.processClipboardLines(clipboardLines, currentLine, currentBlockNode, selection);
        const textToInsert = processedLines.join('\n');

        // Perform the edit and update the cursor position.
        await editor.edit(editBuilder => {
            const rangeToReplace = new vscode.Range(selection.start.line, 0, selection.start.line, currentLine.text.length);
            editBuilder.replace(rangeToReplace, textToInsert);
        });

        this.updateCursorPosition(editor, processedLines, currentLine, selection);
    }

    /**
     * Processes each line from the clipboard, adding bullets where necessary.
     * @param clipboardLines The array of lines read from the clipboard.
     * @param currentLine The `TextLine` where the paste operation is initiated.
     * @param currentBlockNode The `BlockNode` for the current line, providing context about existing bullets.
     * @param selection The current selection in the editor, used to determine paste position.
     * @returns An array of processed lines ready for insertion.
     */
    private processClipboardLines(clipboardLines: string[], currentLine: vscode.TextLine, currentBlockNode: BlockNode, selection: vscode.Selection): string[] {
        const processed: string[] = [];
        const currentLineIndentation = currentLine.firstNonWhitespaceCharacterIndex;
        // --- Handle the first line of the paste ---
        const firstClipboardLine = clipboardLines[0];
        const trimmedFirstClipboardLine = firstClipboardLine.trim();

        if (trimmedFirstClipboardLine.length === 0) {
            // If the first line of clipboard content is empty, just insert an empty line with current line's indentation.
            processed.push(' '.repeat(currentLineIndentation));
        } else {
            let finalFirstLineContent: string;
            const originalClipboardFirstLineIndent = firstClipboardLine.match(/^\s*/)?.[0].length || 0;
            const { bulletType: clipboardFirstLineBulletType, bulletRange: clipboardFirstLineBulletRange } = determineBulletType(firstClipboardLine, originalClipboardFirstLineIndent, false, false, 0);
            const contentAfterClipboardBullet = clipboardFirstLineBulletType !== 'none'
                ? firstClipboardLine.substring(clipboardFirstLineBulletRange!.end.character).trimStart()
                : firstClipboardLine.trim();

            if (selection.start.character === currentLine.firstNonWhitespaceCharacterIndex) {
                // Pasting at the very beginning of the line (before any existing bullet or text)
                if (clipboardFirstLineBulletType !== 'none') {
                    // If clipboard has a bullet, use it and its content
                    finalFirstLineContent = `${firstClipboardLine.substring(clipboardFirstLineBulletRange!.start.character, clipboardFirstLineBulletRange!.end.character)}${contentAfterClipboardBullet}`;
                } else if (currentBlockNode.bulletType !== 'none' && currentBlockNode.bulletRange) {
                    // If current line has a bullet but clipboard doesn't, preserve current line's bullet
                    finalFirstLineContent = `${currentBlockNode.line.text.substring(currentBlockNode.bulletRange.start.character, currentBlockNode.bulletRange.end.character)}${contentAfterClipboardBullet}`;
                } else {
                    // Neither has a bullet, add a default one
                    finalFirstLineContent = `• ${contentAfterClipboardBullet}`;
                }
                processed.push(' '.repeat(currentLineIndentation + originalClipboardFirstLineIndent) + finalFirstLineContent);
            } else {
                // Pasting mid-line or after existing content/bullet
                // The pasted content should never introduce a new bullet point here.
                const textToInsert = contentAfterClipboardBullet; // Already stripped if it had a bullet
                const partBeforeCursor = currentLine.text.substring(0, selection.start.character);
                const partAfterCursor = currentLine.text.substring(selection.end.character);
                processed.push(partBeforeCursor + textToInsert + partAfterCursor);
            }
        }

        // --- Handle subsequent lines of the paste (for multi-line content) ---
        for (let i = 1; i < clipboardLines.length; i++) {
            const line = clipboardLines[i];
            const originalIndentLength = line.match(/^\s*/)?.[0].length || 0;
            const { bulletType: clipboardLineBulletType, bulletRange: clipboardLineBulletRange } = determineBulletType(line, originalIndentLength, false, false, 0);
            const contentAfterClipboardBullet = clipboardLineBulletType !== 'none'
                ? line.substring(clipboardLineBulletRange!.end.character).trimStart()
                : line.trim();

            if (contentAfterClipboardBullet.length === 0) {
                processed.push(' '.repeat(originalIndentLength)); // Preserve original indentation for empty lines.
                continue;
            }

            // For subsequent lines, always add a bullet if one isn't present in the clipboard line itself.
            let finalLine = clipboardLineBulletType === 'none' ? `• ${contentAfterClipboardBullet}` : `${line.substring(clipboardLineBulletRange!.start.character, clipboardLineBulletRange!.end.character)}${contentAfterClipboardBullet}`;
            processed.push(' '.repeat(originalIndentLength) + finalLine);
        }

        return processed;
    }

    /**
     * Calculates and sets the new cursor position after the paste operation.
     * @param editor The active text editor.
     * @param processedLines The lines that were inserted.
     * @param originalLine The `TextLine` before the paste.
     * @param selection The current selection in the editor, used to determine paste position.
     */
    private updateCursorPosition(editor: vscode.TextEditor, processedLines: string[], originalLine: vscode.TextLine, selection: vscode.Selection): void {
        const newPositionLine = selection.start.line + processedLines.length - 1;
        let newPositionChar: number;

        if (processedLines.length === 1) {
            // For a single-line paste, calculate the new character position based on the change in line length.
            // If pasting at the start of the line, the new position is the length of the new line.
            // Otherwise, it's the original cursor position plus the length of the inserted text.
            newPositionChar = selection.start.character + (processedLines[0].length - originalLine.text.length);
        } else {
            // For a multi-line paste, move the cursor to the end of the last pasted line.
            newPositionChar = processedLines[processedLines.length - 1].length;
        }

        const newPosition = new vscode.Position(newPositionLine, newPositionChar);
        editor.selection = new vscode.Selection(newPosition, newPosition);
    }

    /**
     * Determines if the clipboard content represents a full typed node paste.
     * A typed node paste is identified by:
     * 1. The first line starting with `(TypeName)`.
     * 2. Subsequent lines (if any) being indented relative to the first line.
     * @param clipboardLines The array of lines read from the clipboard.
     * @param currentLineIndentation The indentation level of the line where pasting is initiated.
     * @returns True if the content is a typed node paste, false otherwise.
     */
    private _isTypedNodePaste(clipboardLines: string[], currentLineIndentation: number): boolean {
        if (clipboardLines.length === 0) {
            return false;
        }

        const firstLine = clipboardLines[0].trim();
        // Check if the first line starts with (TypeName)
        const typedNodeRegex = /^\(\w+\)/;
        if (!typedNodeRegex.test(firstLine)) {
            return false;
        }

        // For multi-line pastes, check if subsequent lines are indented.
        if (clipboardLines.length > 1) {
            const firstLineIndent = clipboardLines[0].match(/^\s*/)?.[0].length || 0;
            for (let i = 1; i < clipboardLines.length; i++) {
                const line = clipboardLines[i];
                const lineIndent = line.match(/^\s*/)?.[0].length || 0;
                // Subsequent lines of a typed node should be indented more than the first line.
                // Or, if they are empty, they should at least maintain the first line's indentation.
                if (line.trim().length > 0 && lineIndent <= firstLineIndent) {
                    return false;
                }
            }
        }

        return true;
    }
}