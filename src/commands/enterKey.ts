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
     * Attempts to navigate to the next property in a typed node.
     * @returns `true` if navigation occurred, `false` otherwise.
     */
    private async tryNavigate(editor: vscode.TextEditor, currentBlockNode: BlockNode, position: vscode.Position, propertyPeers: BlockNode[]): Promise<boolean> {
        // Only navigate if the cursor is at the absolute end of the line
        if (position.character !== editor.document.lineAt(position.line).text.length) {
            return false;
        }

        const currentIndex = propertyPeers.findIndex(node => node.lineNumber === currentBlockNode.lineNumber);
        if (currentIndex === -1) {
            return false; // currentBlockNode not found in peers, should not happen if called correctly
        }

        if (currentIndex < propertyPeers.length - 1) {
            // There is a next property, navigate to it
            const nextPropertyNode = propertyPeers[currentIndex + 1];
            this.moveCursorToNodeValue(editor, nextPropertyNode);
            return true;
        } else {
            // This is the last property in the group, create a new empty line below it
            const currentLine = editor.document.lineAt(currentBlockNode.lineNumber);
            const indentation = currentLine.text.substring(0, currentLine.firstNonWhitespaceCharacterIndex);
            const newLineNumber = currentBlockNode.lineNumber + 1;

            await editor.edit(editBuilder => {
                editBuilder.insert(new vscode.Position(newLineNumber, 0), indentation + '\n');
            });

            const newPosition = new vscode.Position(newLineNumber, indentation.length);
            editor.selection = new vscode.Selection(newPosition, newPosition);
            return true;
        }
    }

    /**
     * Identifies all adjacent BlockNodes that form a logical property group.
     * This means finding all sibling nodes at the same or greater indentation level
     * until a node with less indentation is encountered.
     * @param currentBlockNode The starting BlockNode.
     * @returns An array of BlockNode peers in document order.
     */

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

        // If it's a property line within a typed node block, handle navigation or new property creation.
        const logicalBlock = this.findLogicalBlock(currentBlockNode);
        if (logicalBlock.length > 0) {
            const propertyPeers = logicalBlock.filter(node => node.isKeyValue || node.isTypedNode);
            if (isAtEndOfLine) {
                if (await this.tryNavigate(editor, currentBlockNode, position, propertyPeers)) {
                    return true;
                }
            }
            // If not at the end of the line, or tryNavigate didn't handle it, split the property line
            await this.splitPropertyLine(editor, position, document, currentBlockNode);
            return true;
        } else {
            // If it's a standalone property line (not part of a typed node block), just insert a new line.
            await vscode.commands.executeCommand('default:type', { text: '\n' });
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
        let char = node.indent;
        if (node.isKeyValue && node.keyValue) {
            char = node.keyValue.keyRange.end.character + 1; // After "::" (the space is at +1)
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
    /**
     * Identifies all adjacent BlockNodes that form a logical block, starting from the current node
     * and going upwards to find the block's root, then downwards to collect all children
     * that are part of the same logical indentation block.
     * This is used to determine the scope of "property peers" or a "folded block".
     * @param currentBlockNode The starting BlockNode.
     * @returns An array of BlockNode peers in document order that belong to the same logical block.
     */
    private findLogicalBlock(currentBlockNode: BlockNode): BlockNode[] {
        const block: BlockNode[] = [];
        if (!currentBlockNode) {
            return block;
        }

        // Find the effective root of the current logical block.
        // This means going up until we find a node with strictly less indentation,
        // or a node that is a direct child of the document root.
        let blockRoot: BlockNode = currentBlockNode;
        while (blockRoot.parent && blockRoot.parent.indent < blockRoot.indent) {
            blockRoot = blockRoot.parent;
        }

        // Now, traverse downwards from the blockRoot to collect all nodes
        // that are part of this logical block (same or greater indentation).
        const collectChildren = (node: BlockNode) => {
            block.push(node);
            for (const child of node.children) {
                if (child.indent >= blockRoot.indent) {
                    collectChildren(child);
                }
            }
        };

        collectChildren(blockRoot);
        return block.sort((a, b) => a.lineNumber - b.lineNumber); // Ensure document order
    }
}