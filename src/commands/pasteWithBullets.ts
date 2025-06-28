import * as vscode from 'vscode';
import { ExtensionState } from '../state/extensionState';
import { BlockNode } from '../document/blockNode';
import { determineBulletType } from '../utils/bulletPointUtils';
import { getBulletForNewLine, findSiblingBulletByIndent } from '../utils/bulletStyleUtils';
import { processClipboardLinesPure, processSingleLinePaste, processTypedNodePaste } from '../utils/pasteUtils';

export class PasteWithBullets {
    private _extensionState: ExtensionState;

    constructor(extensionState: ExtensionState) {
        this._extensionState = extensionState;
    }

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

        // Unified robust multi-line paste logic using pure function for testability
        if (clipboardLines.length > 1 && selection.isEmpty) {
            const partBeforeCursor = currentLine.text.substring(0, selection.start.character);
            const partAfterCursor = currentLine.text.substring(selection.start.character);
            const documentModel = this._extensionState.getDocumentModel(document.uri.toString());
            if (!documentModel) {
                await vscode.commands.executeCommand('default:paste');
                return;
            }
            const currentBlockNode = documentModel.documentTree.getNodeAtLine(currentLine.lineNumber);
            if (!currentBlockNode) {
                await vscode.commands.executeCommand('default:paste');
                return;
            }
            const bulletTypeForLine = (line: string, indent: number) => {
                const result = determineBulletType(line, indent, false, false, 0);
                let bulletRange = undefined;
                if (result.bulletRange) {
                    bulletRange = {
                        start: result.bulletRange.start.character,
                        end: result.bulletRange.end.character
                    };
                }
                return {
                    bulletType: result.bulletType,
                    bulletRange
                };
            };
            const getBullet = () => {
                if (currentBlockNode && currentBlockNode.parent) {
                    return getBulletForNewLine(currentBlockNode, document);
                } else {
                    return findSiblingBulletByIndent(document, currentLine.lineNumber, currentLine.firstNonWhitespaceCharacterIndex, '• ');
                }
            };
            const newLines = processClipboardLinesPure({
                clipboardLines,
                partBeforeCursor,
                partAfterCursor,
                currentLineText: currentLine.text,
                currentLineIndent: currentLine.firstNonWhitespaceCharacterIndex,
                bulletTypeForLine,
                getBullet
            });
            // Replace the current line with all new lines at once, ensuring new lines are created
            await editor.edit(editBuilder => {
                editBuilder.replace(currentLine.range, newLines.join('\n'));
            });
            // Move cursor to end of last inserted line
            const lastIdx = newLines.length - 1;
            const lastLineText = newLines[lastIdx];
            const newPosition = new vscode.Position(selection.start.line + lastIdx, lastLineText.length);
            editor.selection = new vscode.Selection(newPosition, newPosition);
            return;
        }

        const documentModel = this._extensionState.getDocumentModel(document.uri.toString());
        if (!documentModel) {
            await vscode.commands.executeCommand('default:paste');
            return;
        }
        const currentBlockNode = documentModel.documentTree.getNodeAtLine(currentLine.lineNumber);
        if (!currentBlockNode) {
            await vscode.commands.executeCommand('default:paste');
            return;
        }

        if (this._isTypedNodePaste(clipboardLines)) {
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

        // Single-line paste (default case)
        const textToInsert = processSingleLinePaste({
            clipboardLine: clipboardLines[0],
            selectionStart: selection.start.character,
            selectionEnd: selection.end.character,
            currentLineText: currentLine.text
        });
        await editor.edit(editBuilder => {
            editBuilder.replace(selection, textToInsert);
        });
        const newPosition = new vscode.Position(selection.start.line, selection.start.character + clipboardLines[0].length);
        editor.selection = new vscode.Selection(newPosition, newPosition);
    }

    private processClipboardLines(
        clipboardLines: string[],
        currentLine: vscode.TextLine,
        currentBlockNode: BlockNode,
        selection: vscode.Selection,
        document: vscode.TextDocument
    ): string[] {
        const processed: string[] = [];
        const currentLineIndentation = currentLine.firstNonWhitespaceCharacterIndex;
        const firstClipboardLine = clipboardLines[0];
        const originalClipboardFirstLineIndent = firstClipboardLine.match(/^\s*/)?.[0].length || 0;
        const { bulletType: clipboardFirstLineBulletType, bulletRange: clipboardFirstLineBulletRange } = determineBulletType(firstClipboardLine, originalClipboardFirstLineIndent, false, false, 0);
        const contentAfterClipboardBullet = clipboardFirstLineBulletType !== 'none'
            ? firstClipboardLine.substring(clipboardFirstLineBulletRange!.end.character).trimStart()
            : firstClipboardLine.trim();
        const cursorIndent = currentLine.firstNonWhitespaceCharacterIndex;
        let detectedBullet: string | undefined;
        for (let i = 0; i < clipboardLines.length; i++) {
            const line = clipboardLines[i];
            const lineIndent = line.match(/^\s*/)?.[0].length || 0;
            if (lineIndent === cursorIndent) {
                detectedBullet = findSiblingBulletByIndent(document, currentLine.lineNumber, cursorIndent, '• ');
                break;
            }
        }
        if (selection.start.character === currentLine.firstNonWhitespaceCharacterIndex) {
            let restOfLine = currentLine.text.substring(currentLine.firstNonWhitespaceCharacterIndex);
            if (currentBlockNode.bulletType !== 'none' && currentBlockNode.bulletRange) {
                restOfLine = currentLine.text.substring(currentBlockNode.bulletRange.end.character);
            }
            let finalFirstLineContent: string;
            if (clipboardFirstLineBulletType !== 'none') {
                finalFirstLineContent = `${firstClipboardLine.substring(clipboardFirstLineBulletRange!.start.character, clipboardFirstLineBulletRange!.end.character)}${contentAfterClipboardBullet}`;
            } else {
                let bullet;
                if (currentBlockNode && currentBlockNode.parent) {
                    bullet = getBulletForNewLine(currentBlockNode, document);
                } else {
                    bullet = findSiblingBulletByIndent(document, currentLine.lineNumber, currentLine.firstNonWhitespaceCharacterIndex, '• ');
                }
                finalFirstLineContent = `${bullet}${contentAfterClipboardBullet}`;
            }
            processed.push(' '.repeat(currentLineIndentation + originalClipboardFirstLineIndent) + finalFirstLineContent + restOfLine);
        } else {
            const textToInsert = contentAfterClipboardBullet;
            const partBeforeCursor = currentLine.text.substring(0, selection.start.character);
            const partAfterCursor = currentLine.text.substring(selection.end.character);
            processed.push(partBeforeCursor + textToInsert + partAfterCursor);
        }
        for (let i = 1; i < clipboardLines.length; i++) {
            const line = clipboardLines[i];
            const originalLineIndent = line.match(/^\s*/)?.[0].length || 0;
            const { bulletType, bulletRange } = determineBulletType(line, originalLineIndent, false, false, 0);
            const contentAfterBullet = bulletType !== 'none'
                ? line.substring(bulletRange!.end.character).trimStart()
                : line.trim();
            let processedLine: string;
            if (bulletType !== 'none') {
                processedLine = `${line.substring(bulletRange!.start.character, bulletRange!.end.character)}${contentAfterBullet}`;
            } else if (contentAfterBullet.trim() === '') {
                processedLine = contentAfterBullet;
            } else if (originalLineIndent === cursorIndent) {
                processedLine = `${detectedBullet || '• '}${contentAfterBullet}`;
            } else {
                processedLine = `• ${contentAfterBullet}`;
            }
            processed.push(' '.repeat(originalLineIndent) + processedLine);
        }
        return processed;
    }

    private _isTypedNodePaste(clipboardLines: string[]): boolean {
        if (clipboardLines.length === 0) {return false;}
        const firstLine = clipboardLines[0].trim();
        const typedNodeRegex = /^\(\w+\)/;
        if (!typedNodeRegex.test(firstLine)) {return false;}
        if (clipboardLines.length > 1) {
            const firstLineIndent = clipboardLines[0].match(/^\s*/)?.[0].length || 0;
            for (let i = 1; i < clipboardLines.length; i++) {
                const line = clipboardLines[i];
                const lineIndent = line.match(/^\s*/)?.[0].length || 0;
                if (line.trim().length > 0 && lineIndent <= firstLineIndent) {return false;}
            }
        }
        return true;
    }
}
