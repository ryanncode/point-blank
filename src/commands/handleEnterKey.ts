import * as vscode from 'vscode';
import { ExtensionState } from '../state/extensionState';
import { BlockNode } from '../document/blockNode';
import { Timer } from '../utils/timer'; // Import Timer utility

export class EnterKeyHandler {
    public static enabled: boolean = true; // Global flag to enable/disable Enter key logic timer output

    public static async handleEnterKeyCommand() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const enterKeyTimer = new Timer('Enter Key Logic');
        if (EnterKeyHandler.enabled) {
            enterKeyTimer.start();
        }

        const document = editor.document;
        const position = editor.selection.active;
        const extensionState = ExtensionState.getInstance();
        const documentModel = extensionState.getDocumentModel(document.uri.toString());

        if (!documentModel) {
            // If no document model, execute default Enter key action
            await vscode.commands.executeCommand('type', { text: '\n' });
            if (EnterKeyHandler.enabled) {
                enterKeyTimer.stop();
            }
            return;
        }

        const currentBlockNode = documentModel.documentTree.getNodeAtLine(position.line);

        if (currentBlockNode) {
            const typedNodeTimer = new Timer('Enter Key - Typed Node Logic');
            if (EnterKeyHandler.enabled) {
                typedNodeTimer.start();
            }

            let typedNodeParent: BlockNode | undefined = undefined;
            if (currentBlockNode.isTypedNode) {
                typedNodeParent = currentBlockNode;
            } else {
                // Check if current node is a child of a typed node
                let parent = currentBlockNode.parent;
                while (parent) {
                    if (parent.isTypedNode) {
                        typedNodeParent = parent;
                        break;
                    }
                    parent = parent.parent;
                }
            }

            if (typedNodeParent) {
                const typedNodeChildren = typedNodeParent.children;
                const typedNodeTitleLine = typedNodeParent.lineNumber;
                const typedNodeIndent = document.lineAt(typedNodeTitleLine).firstNonWhitespaceCharacterIndex;

                // Case 1: Cursor is on the typed node title line
                if (currentBlockNode.lineNumber === typedNodeTitleLine) {
                    if (typedNodeChildren.length > 0) {
                        // Move to the first child (property)
                        const firstChildNode = typedNodeChildren[0];
                        const firstChildLineNumber = firstChildNode.lineNumber;
                        let newPositionCharacter = firstChildNode.indent;
                        if (firstChildNode.isKeyValue && firstChildNode.keyValue) {
                            newPositionCharacter = firstChildNode.keyValue.keyRange.end.character + 2; // After ":: "
                        }
                        editor.selection = new vscode.Selection(firstChildLineNumber, newPositionCharacter, firstChildLineNumber, newPositionCharacter);
                        if (EnterKeyHandler.enabled) {
                            typedNodeTimer.stop();
                            enterKeyTimer.stop();
                        }
                        return;
                    } else {
                        // Insert a new line with increased indentation for the first property
                        const newIndent = typedNodeIndent + 2; // Assuming 2 spaces for properties
                        const insertPosition = new vscode.Position(typedNodeTitleLine + 1, 0);
                        await editor.edit(editBuilder => {
                            editBuilder.insert(insertPosition, ' '.repeat(newIndent) + '\n');
                        });
                        const newPosition = new vscode.Position(typedNodeTitleLine + 1, newIndent);
                        editor.selection = new vscode.Selection(newPosition, newPosition);
                        if (EnterKeyHandler.enabled) {
                            typedNodeTimer.stop();
                            enterKeyTimer.stop();
                        }
                        return;
                    }
                }

                // Case 2: Cursor is on a property line of the typed node
                const currentChildIndex = typedNodeChildren.findIndex(child => child.lineNumber === currentBlockNode.lineNumber);
                if (currentChildIndex !== -1) {
                    if (currentChildIndex < typedNodeChildren.length - 1) {
                        // Move to the next property
                        const nextChildNode = typedNodeChildren[currentChildIndex + 1];
                        const nextChildLineNumber = nextChildNode.lineNumber;
                        let newPositionCharacter = nextChildNode.indent;
                        if (nextChildNode.isKeyValue && nextChildNode.keyValue) {
                            newPositionCharacter = nextChildNode.keyValue.keyRange.end.character + 2; // After ":: "
                        }
                        editor.selection = new vscode.Selection(nextChildLineNumber, newPositionCharacter, nextChildLineNumber, newPositionCharacter);
                        if (EnterKeyHandler.enabled) {
                            typedNodeTimer.stop();
                            enterKeyTimer.stop();
                        }
                        return;
                    } else {
                        // It's the last property, insert a new line after the typed node block
                        // with the indentation of the typed node title line.
                        const insertLine = typedNodeParent.lineNumber + typedNodeParent.children.length + 1;
                        const insertPosition = new vscode.Position(insertLine, 0);
                        await editor.edit(editBuilder => {
                            editBuilder.insert(insertPosition, ' '.repeat(typedNodeIndent) + '\n');
                        });
                        const newPosition = new vscode.Position(insertLine, typedNodeIndent);
                        editor.selection = new vscode.Selection(newPosition, newPosition);
                        if (EnterKeyHandler.enabled) {
                            typedNodeTimer.stop();
                            enterKeyTimer.stop();
                        }
                        return;
                    }
                }
            }
            if (EnterKeyHandler.enabled) {
                typedNodeTimer.stop();
            }
        }

        const foldingLogicTimer = new Timer('Enter Key - Folding Logic');
        if (EnterKeyHandler.enabled) {
            foldingLogicTimer.start();
        }

        // Integrate DocumentTree based folding logic
        if (currentBlockNode && currentBlockNode.children.length > 0) {
            const blockRange = EnterKeyHandler.findBlockRangeInTree(currentBlockNode);
            const isFolded = editor.visibleRanges.every(range => {
                return range.start.line > blockRange.end || range.end.line < blockRange.start + 1;
            });

            if (isFolded && position.line === blockRange.start) {
                const titleLine = document.lineAt(blockRange.start);
                const indentation = titleLine.text.substring(0, titleLine.firstNonWhitespaceCharacterIndex);

                const insertPosition = new vscode.Position(blockRange.end + 1, 0);
                await editor.edit(editBuilder => {
                    editBuilder.insert(insertPosition, indentation + '\n');
                });

                const newPosition = new vscode.Position(blockRange.end + 1, indentation.length);
                editor.selection = new vscode.Selection(newPosition, newPosition);
                if (EnterKeyHandler.enabled) {
                    foldingLogicTimer.stop();
                    enterKeyTimer.stop();
                }
                return;
            }
        }
 
        const line = document.lineAt(position.line);
 
        // New logic to handle Enter key after a bullet point
        if (currentBlockNode && currentBlockNode.bulletRange && position.character === currentBlockNode.bulletRange.end.character) {
            await editor.edit(editBuilder => {
                editBuilder.insert(new vscode.Position(position.line, 0), '\n');
            });
 
            if (EnterKeyHandler.enabled) {
                foldingLogicTimer.stop();
                enterKeyTimer.stop();
            }
            return;
        }
 
        // If not on a folded block's title line or block is not folded, execute default Enter key action
        const textAfterCursor = line.text.substring(position.character);

        if (textAfterCursor.length > 0) {
            await EnterKeyHandler.insertBulletPointAndMoveText(editor, position, document);
        } else {
            await vscode.commands.executeCommand('type', { text: '\n' });
        }

        if (EnterKeyHandler.enabled) {
            foldingLogicTimer.stop();
            enterKeyTimer.stop();
        }
    }

    private static async insertBulletPointAndMoveText(editor: vscode.TextEditor, position: vscode.Position, document: vscode.TextDocument): Promise<void> {
        const line = document.lineAt(position.line);
        const textAfterCursor = line.text.substring(position.character);
        const indentation = line.text.substring(0, line.firstNonWhitespaceCharacterIndex);

        await editor.edit(editBuilder => {
            // Delete text after cursor on current line
            const rangeToDelete = new vscode.Range(position, line.range.end);
            editBuilder.delete(rangeToDelete);
            
            // Insert a new line with a bullet point, indentation, and the text from after the cursor
            const textToInsert = `\n${indentation}• ${textAfterCursor}`;
            editBuilder.insert(position, textToInsert);
        });

        // Set new cursor position
        const newPosition = new vscode.Position(position.line + 1, indentation.length + 2); // After '• '
        editor.selection = new vscode.Selection(newPosition, newPosition);
    }

    private static findBlockRangeInTree(blockNode: BlockNode): { start: number, end: number } {
        let maxLine = blockNode.lineNumber;

        function traverseChildren(node: BlockNode) {
            for (const child of node.children) {
                maxLine = Math.max(maxLine, child.lineNumber);
                traverseChildren(child);
            }
        }

        traverseChildren(blockNode);
        return { start: blockNode.lineNumber, end: maxLine };
    }
}