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
        if (clipboardLines.length === 0) {
            await vscode.commands.executeCommand('default:paste');
            return;
        }

        const { selection, document } = editor;
        const currentLine = document.lineAt(selection.start.line);

        // Handle the specific edge case: multi-line paste with an empty first line onto a line with text
        if (clipboardLines.length > 1 && clipboardLines[0] === '' && selection.isEmpty) {
            const currentLineText = currentLine.text;
            const partBeforeCursor = currentLineText.substring(0, selection.start.character);
            const partAfterCursor = currentLineText.substring(selection.start.character);

            // Remove the first empty line from clipboard content
            const contentToPaste = clipboardLines.slice(1);

            // Append the partAfterCursor to the last line of the pasted content
            if (contentToPaste.length > 0) {
                contentToPaste[contentToPaste.length - 1] += partAfterCursor;
            } else {
                // If only an empty line was copied, and nothing else, then just paste nothing.
                // This case should ideally be handled by the clipboardLines.length === 0 check above,
                // but as a safeguard.
                await vscode.commands.executeCommand('default:paste');
                return;
            }

            const textToInsert = partBeforeCursor + '\n' + contentToPaste.join('\n');

            await editor.edit(editBuilder => {
                // Replace the current line with the modified content
                editBuilder.replace(currentLine.range, textToInsert);
            });

            // Set the new cursor position at the end of the pasted content
            const newPositionLine = selection.start.line + contentToPaste.length;
            const newPositionChar = contentToPaste[contentToPaste.length - 1].length - partAfterCursor.length;
            const newPosition = new vscode.Position(newPositionLine, newPositionChar);
            editor.selection = new vscode.Selection(newPosition, newPosition);
            return;
        }

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

        if (this._isTypedNodePaste(clipboardLines)) {
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
                    // and apply it on top of the pasteStartCharacter.
                    const relativeIndent = originalLineIndent - originalFirstLineIndent;
                    // Each line after the first should only have its original absolute indent level.
                    adjustedClipboardLines.push(' '.repeat(originalLineIndent) + contentWithoutOriginalIndent);
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

        // If the first line of clipboard content is empty, it should have been handled by the special case above.
        // This block now assumes the first line is NOT empty or it's a single-line paste.
        let finalFirstLineContent: string;
        const originalClipboardFirstLineIndent = firstClipboardLine.match(/^\s*/)?.[0].length || 0;
        const { bulletType: clipboardFirstLineBulletType, bulletRange: clipboardFirstLineBulletRange } = determineBulletType(firstClipboardLine, originalClipboardFirstLineIndent, false, false, 0);
        const contentAfterClipboardBullet = clipboardFirstLineBulletType !== 'none'
            ? firstClipboardLine.substring(clipboardFirstLineBulletRange!.end.character).trimStart()
            : firstClipboardLine.trim();

        let baseIndentForSubsequentLines: number;

        if (selection.start.character === currentLine.firstNonWhitespaceCharacterIndex) {
            // Pasting at the very beginning of the line (before any existing bullet or text)
            baseIndentForSubsequentLines = currentLineIndentation;
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
            baseIndentForSubsequentLines = 0;
            // The pasted content should never introduce a new bullet point here.
            const textToInsert = contentAfterClipboardBullet; // Already stripped if it had a bullet
            const partBeforeCursor = currentLine.text.substring(0, selection.start.character);
            const partAfterCursor = currentLine.text.substring(selection.end.character);
            processed.push(partBeforeCursor + textToInsert + partAfterCursor);
        }
        // Process subsequent lines from the clipboard.
        for (let i = 1; i < clipboardLines.length; i++) {
            const line = clipboardLines[i];
            const originalLineIndent = line.match(/^\s*/)?.[0].length || 0;
            const { bulletType, bulletRange } = determineBulletType(line, originalLineIndent, false, false, 0);
            const contentAfterBullet = bulletType !== 'none'
                ? line.substring(bulletRange!.end.character).trimStart()
                : line.trim();

            let processedLine: string;
            if (bulletType !== 'none') {
                // If the line has a bullet, preserve it and its content
                processedLine = `${line.substring(bulletRange!.start.character, bulletRange!.end.character)}${contentAfterBullet}`;
            } else if (contentAfterBullet.trim() === '') {
                // If the line is empty or only whitespace, do not add a bullet
                processedLine = contentAfterBullet;
            }
            else {
                // If no bullet and not empty, add a default one
                processedLine = `• ${contentAfterBullet}`;
            }

            // Each line after the first should only have its original absolute indent level.
            processed.push(' '.repeat(originalLineIndent) + processedLine);
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
     * @returns True if the content is a typed node paste, false otherwise.
     */
    private _isTypedNodePaste(clipboardLines: string[]): boolean {
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