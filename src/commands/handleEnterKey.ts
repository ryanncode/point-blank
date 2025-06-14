import * as vscode from 'vscode';
import { ExtensionState } from '../state/extensionState';
import { BlockNode } from '../document/blockNode';
import { findTypedNodeParent } from '../utils/nodeUtils';

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
        if (!editor) return;

        const document = editor.document;
        const position = editor.selection.active;
        const documentModel = this._extensionState.getDocumentModel(document.uri.toString());

        if (!documentModel) {
            await vscode.commands.executeCommand('type', { text: '\n' });
            return;
        }

        const currentBlockNode = documentModel.documentTree.getNodeAtLine(position.line);

        // --- Context-Specific Enter Key Logic ---

        // 1. Typed Node Navigation: If inside a typed node (e.g., `(Book)`), navigate between properties.
        if (currentBlockNode && await this.handleTypedNodeNavigation(editor, currentBlockNode)) {
            return;
        }

        // 2. Folded Block Handling: If on the title line of a folded block, create a new line after the block.
        if (currentBlockNode && currentBlockNode.children.length > 0 && await this.handleFoldedBlock(editor, currentBlockNode)) {
            return;
        }

        // 3. Bullet Point Handling: If the cursor is immediately after a bullet, create a new line above.
        if (currentBlockNode && currentBlockNode.bulletRange && position.character === currentBlockNode.bulletRange.end.character) {
            await editor.edit(editBuilder => {
                editBuilder.insert(new vscode.Position(position.line, 0), '\n');
            });
            return;
        }

        // 4. Default Behavior with Smart Splitting: If none of the above, split the line,
        // creating a new bullet point for the text that was after the cursor.
        const line = document.lineAt(position.line);
        const textAfterCursor = line.text.substring(position.character);

        if (textAfterCursor.length > 0) {
            await this.insertBulletPointAndMoveText(editor, position, document);
        } else {
            // If at the end of the line, just insert a newline.
            await vscode.commands.executeCommand('type', { text: '\n' });
        }
    }

    /**
     * Handles Enter key logic when the cursor is within a typed node block.
     * It navigates to the next property or exits the block.
     * @returns `true` if the key press was handled, `false` otherwise.
     */
    private async handleTypedNodeNavigation(editor: vscode.TextEditor, currentBlockNode: BlockNode): Promise<boolean> {
        const typedNodeParent = findTypedNodeParent(currentBlockNode);
        if (!typedNodeParent) return false;

        const { document } = editor;
        const typedNodeChildren = typedNodeParent.children;
        const typedNodeTitleLine = typedNodeParent.lineNumber;

        // Case 1: Cursor is on the typed node's title line.
        if (currentBlockNode.lineNumber === typedNodeTitleLine) {
            if (typedNodeChildren.length > 0) {
                // Move to the value of the first property.
                this.moveCursorToNodeValue(editor, typedNodeChildren[0]);
            } else {
                // Create a new property line.
                const newIndent = document.lineAt(typedNodeTitleLine).firstNonWhitespaceCharacterIndex + 2;
                await this.insertNewLineAndPositionCursor(editor, typedNodeTitleLine + 1, newIndent);
            }
            return true;
        }

        // Case 2: Cursor is on a property line of the typed node.
        const currentChildIndex = typedNodeChildren.findIndex((child: BlockNode) => child.lineNumber === currentBlockNode.lineNumber);
        if (currentChildIndex !== -1) {
            // Check if the cursor is at the end of the line (or if the line is empty after the key part)
            const line = document.lineAt(currentBlockNode.lineNumber);
            const isAtEndOfLine = editor.selection.active.character === line.text.length;

            if (isAtEndOfLine) {
                if (currentChildIndex < typedNodeChildren.length - 1) {
                    // Move to the value of the next property.
                    this.moveCursorToNodeValue(editor, typedNodeChildren[currentChildIndex + 1]);
                } else {
                    // Last property: create a new line after the entire block.
                    const indent = document.lineAt(typedNodeTitleLine).firstNonWhitespaceCharacterIndex;
                    const insertLineNum = this.findBlockRangeInTree(typedNodeParent).end + 1;
                    await this.insertNewLineAndPositionCursor(editor, insertLineNum, indent);
                }
                return true;
            }
        }

        return false;
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
        const line = document.lineAt(position.line);
        const textAfterCursor = line.text.substring(position.character);
        const indentation = line.text.substring(0, line.firstNonWhitespaceCharacterIndex);

        await editor.edit(editBuilder => {
            // Delete text after the cursor on the current line.
            editBuilder.delete(new vscode.Range(position, line.range.end));
            // Insert a new line with indentation, a bullet, and the moved text.
            editBuilder.insert(position, `\n${indentation}• ${textAfterCursor}`);
        });

        // Position the cursor after the new bullet point.
        const newPosition = new vscode.Position(position.line + 1, indentation.length + 2); // After '• '
        editor.selection = new vscode.Selection(newPosition, newPosition);
    }


    /**
     * Moves the cursor to the beginning of the value part of a key-value node,
     * or to the start of the content for other nodes.
     */
    private moveCursorToNodeValue(editor: vscode.TextEditor, node: BlockNode): void {
        const line = node.lineNumber;
        let char = node.indent;
        if (node.isKeyValue && node.keyValue) {
            char = node.keyValue.keyRange.end.character + 2; // After ":: "
        }
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