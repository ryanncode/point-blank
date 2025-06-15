import * as vscode from 'vscode';
import { ExtensionState } from '../state/extensionState';
import { BlockNode } from '../document/blockNode';
import { getBulletFromLine } from '../utils/bulletPointUtils';
import { expandTemplateCommand } from './expandTemplate'; // Import the command

/**
 * Provides the logic for the `pointblank.handleEnterKey` command, overriding the default
 * Enter key behavior to provide context-aware actions like smart indentation,
 * navigating between properties of a typed node, and handling folded regions.
 */
export class EnterKeyHandler {
    private _extensionState: ExtensionState;

    constructor(extensionState: ExtensionState) {
        this._extensionState = extensionState;
    }

    /**
     * Main command handler for the Enter key. It orchestrates various checks to determine
     * the correct action based on the cursor's position and the document's structure.
     */
    public async handleEnterKeyCommand(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }

        const document = editor.document;
        const position = editor.selection.active;
        const documentModel = this._extensionState.getDocumentModel(document.uri.toString());

        if (!documentModel) {
            await vscode.commands.executeCommand('default:type', { text: '\n' });
            return;
        }

        const currentLine = document.lineAt(position.line);
        const currentBlockNode = documentModel.documentTree.getNodeAtLine(position.line);

        // 1. Handle Property Lines (including Type:: triggers)
        if (currentLine.text.includes('::')) {
            if (await this.handlePropertyEnter(editor, currentBlockNode, position, document, documentModel)) {
                return; // Handled by property logic, consume event
            }
        }

        // 2. Folded Block Handling: If on the title line of a folded block, create a new line after the block.
        if (currentBlockNode && currentBlockNode.children.length > 0 && await this.handleFoldedBlock(editor, currentBlockNode)) {
            return; // Handled by folded block logic, consume event
        }

        // 3. Bullet Point Handling: If the cursor is immediately after a bullet, create a new line above.
        if (currentBlockNode && currentBlockNode.bulletRange && position.character === currentBlockNode.bulletRange.end.character) {
            await editor.edit(editBuilder => {
                editBuilder.insert(new vscode.Position(position.line, 0), '\n');
            });
            return; // Handled by bullet point logic, consume event
        }

        // 4. Default Behavior with Smart Splitting: If none of the above, split the line,
        // creating a new bullet point for the text that was after the cursor.
        const textAfterCursor = currentLine.text.substring(position.character);

        if (textAfterCursor.length > 0) {
            await this.insertBulletPointAndMoveText(editor, position, document);
            return; // Explicitly return after handling, consume event
        } else {
            // If at the end of the line, just insert a newline.
            await vscode.commands.executeCommand('default:type', { text: '\n' });
            return; // Explicitly return after handling, consume event
        }
    }

    /**
     * Splits a property line when the cursor is in the middle of the value.
     * Moves the text after the cursor to a new line directly below the current line,
     * indented to align with the value part of the property above it.
     * Does not add a bullet point.
     */
    private async splitPropertyLine(editor: vscode.TextEditor, position: vscode.Position, document: vscode.TextDocument, currentBlockNode: BlockNode): Promise<void> {
        const currentLine = document.lineAt(position.line);
        const textAfterCursor = currentLine.text.substring(position.character);
        
        let valueIndentation = 0;
        if (currentBlockNode.isKeyValue && currentBlockNode.keyValue && currentBlockNode.keyValue.valueRange) {
            valueIndentation = currentBlockNode.keyValue.valueRange.start.character;
        } else {
            // Fallback for non-key-value nodes, though this function should ideally only be called for key-value.
            valueIndentation = currentLine.firstNonWhitespaceCharacterIndex;
        }

        await editor.edit(editBuilder => {
            // Delete text after the cursor on the current line.
            editBuilder.delete(new vscode.Range(position, currentLine.range.end));
            // Insert a new line with the calculated value indentation and the moved text.
            editBuilder.insert(position, `\n${' '.repeat(valueIndentation)}${textAfterCursor}`);
        });

        // Position the cursor at the beginning of the new line's content.
        const newPosition = new vscode.Position(position.line + 1, valueIndentation);
        editor.selection = new vscode.Selection(newPosition, newPosition);
    }

    /**
     * Handles Enter key logic when on a line containing '::' (a property line).
     * @returns `true` if the key press was handled, `false` otherwise.
     */
    private async handlePropertyEnter(editor: vscode.TextEditor, currentBlockNode: BlockNode | undefined, position: vscode.Position, document: vscode.TextDocument, documentModel: any): Promise<boolean> {
        const currentLine = document.lineAt(position.line);
        const isAtEndOfLine = position.character === currentLine.text.length;

        // Check for "Type:: " trigger for inline template expansion
        const typeTriggerRegex = /^\s*Type::\s*(\S.*)$/;
        const typeMatch = currentLine.text.match(typeTriggerRegex);

        if (typeMatch && isAtEndOfLine) {
            const typeName = typeMatch[1].trim();
            // Force a re-parse after template insertion to ensure the document tree is up-to-date
            // before subsequent operations.
            await expandTemplateCommand(typeName, documentModel, position.line);
            documentModel.updateAfterProgrammaticEdit(document);
            await new Promise<void>(resolve => {
                const disposable = documentModel.onDidParse(() => {
                    disposable.dispose();
                    resolve();
                });
            });
            return true; // Handled by template expansion, consume event
        }

        // If currentBlockNode is undefined, it means the line is not yet part of the parsed tree.
        // This can happen if the user just typed '::' and the parser hasn't caught up.
        // In this case, we fall back to default newline behavior.
        if (!currentBlockNode) {
            await vscode.commands.executeCommand('default:type', { text: '\n' });
            return true;
        }

        // If it's a property line, handle navigation or new property creation.
        if (isAtEndOfLine) {
            // Check if the next line is also a key:: value pair
            const nextLineNumber = position.line + 1;
            if (nextLineNumber < document.lineCount) {
                const nextLine = document.lineAt(nextLineNumber);
                if (nextLine.text.includes('::')) {
                    // Move cursor to the next property line
                    const nextBlockNode = documentModel.documentTree.getNodeAtLine(nextLineNumber);
                    if (nextBlockNode) {
                        this.moveCursorToNodeValue(editor, nextBlockNode);
                        return true;
                    }
                }
            }
            // If no next property line, or not a key::value, just insert a new line with current indentation
            const currentLineIndentation = currentLine.text.substring(0, currentLine.firstNonWhitespaceCharacterIndex);
            await editor.edit(editBuilder => {
                editBuilder.insert(new vscode.Position(position.line + 1, 0), currentLineIndentation + '\n');
            });
            const newPosition = new vscode.Position(position.line + 1, currentLineIndentation.length);
            editor.selection = new vscode.Selection(newPosition, newPosition);
            return true;
        } else {
            // If not at the end of the line, split the property line
            await this.splitPropertyLine(editor, position, document, currentBlockNode);
            return true;
        }
    }

    /**
     * Handles Enter key logic when on the title line of a folded block.
     * @returns `true` if the key press was handled, `false` otherwise.
     */
    private async handleFoldedBlock(editor: vscode.TextEditor, currentBlockNode: BlockNode): Promise<boolean> {
        const blockRange = this.findBlockRangeInTree(currentBlockNode);
        const isFolded = editor.visibleRanges.every(range =>
            range.start.line > blockRange.end || range.end.line < blockRange.start + 1
        );

        if (isFolded && editor.selection.active.line === blockRange.start) {
            const titleLine = editor.document.lineAt(blockRange.start);
            const indentation = titleLine.text.substring(0, titleLine.firstNonWhitespaceCharacterIndex);
            const insertPosition = new vscode.Position(blockRange.end + 1, 0);

            await editor.edit(editBuilder => {
                editBuilder.insert(insertPosition, indentation + '\n');
            });

            const newPosition = new vscode.Position(blockRange.end + 1, indentation.length);
            editor.selection = new vscode.Selection(newPosition, newPosition);
            return true;
        }
        return false;
    }

    /**
     * Splits the current line at the cursor, creating a new line with a bullet point
     * and moving the text that was after the cursor to the new line.
     */
    private async insertBulletPointAndMoveText(editor: vscode.TextEditor, position: vscode.Position, document: vscode.TextDocument): Promise<void> {
        const currentLine = document.lineAt(position.line);
        const textAfterCursor = currentLine.text.substring(position.character);
        const indentation = currentLine.text.substring(0, currentLine.firstNonWhitespaceCharacterIndex);

        await editor.edit(editBuilder => {
            // Delete text after the cursor on the current line.
            editBuilder.delete(new vscode.Range(position, currentLine.range.end));
            // Determine the bullet point based on the current line.
            const bullet = getBulletFromLine(currentLine);
            // Insert a new line with indentation, the determined bullet, and the moved text.
            editBuilder.insert(position, `\n${indentation}${bullet}${textAfterCursor}`);
        });

        // Position the cursor after the new bullet point.
        const newPosition = new vscode.Position(position.line + 1, indentation.length + getBulletFromLine(currentLine).length);
        editor.selection = new vscode.Selection(newPosition, newPosition);
    }

    /**
     * Moves the cursor to the beginning of the value part of a key-value node,
     * or to the start of the content for other nodes.
     */
    private moveCursorToNodeValue(editor: vscode.TextEditor, node: BlockNode): void {
        const line = node.lineNumber;
        const lineText = editor.document.lineAt(line).text;
        const char = lineText.length; // Move to the end of the line
        const newPosition = new vscode.Position(line, char);
        editor.selection = new vscode.Selection(newPosition, newPosition);
    }

    /**
     * Inserts a new line with specified indentation and positions the cursor.
     */
    private async insertNewLineAndPositionCursor(editor: vscode.TextEditor, lineNumber: number, indentation: number): Promise<void> {
        await editor.edit(editBuilder => {
            editBuilder.insert(new vscode.Position(lineNumber, 0), ' '.repeat(indentation) + '\n');
        });
        const newPosition = new vscode.Position(lineNumber, indentation);
        editor.selection = new vscode.Selection(newPosition, newPosition);
    }

    /**
     * Calculates the full line range of a block, including all its children.
     */
    private findBlockRangeInTree(blockNode: BlockNode): { start: number, end: number } {
        let maxLine = blockNode.lineNumber;
        const traverse = (node: BlockNode) => {
            for (const child of node.children) {
                maxLine = Math.max(maxLine, child.lineNumber);
                traverse(child);
            }
        };
        traverse(blockNode);
        return { start: blockNode.lineNumber, end: maxLine };
    }
}