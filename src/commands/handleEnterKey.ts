import * as vscode from 'vscode';
import { FoldingUtils } from '../folding/foldingUtils';
import { FoldingCache } from '../folding/foldingCache';
import { ExtensionState } from '../state/extensionState';
import { BlockNode } from '../document/blockNode';

export async function handleEnterKeyCommand() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const document = editor.document;
    const position = editor.selection.active;
    const extensionState = ExtensionState.getInstance();
    const documentModel = extensionState.getDocumentModel(document.uri.toString());

    if (!documentModel) {
        // If no document model, execute default Enter key action
        await vscode.commands.executeCommand('type', { text: '\n' });
        return;
    }

    const currentBlockNode = documentModel.documentTree.getNodeAtLine(position.line);

    if (currentBlockNode) {
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
                    return;
                }
            }
        }
    }

    const foldingCache = FoldingCache.getInstance();

    let allRanges = foldingCache.getCache(document);

    if (!allRanges) {
        // If cache is stale or empty, compute and update cache
        allRanges = await FoldingUtils.getAllFoldingRanges(document);
        if (allRanges) {
            foldingCache.setCache(document, allRanges);
        }
    }

    if (!allRanges || allRanges.length === 0) {
        // If no folding ranges, execute default Enter key action
        await vscode.commands.executeCommand('type', { text: '\n' });
        return;
    }

    // Find the nearest folding block that starts at or contains the current line
    const currentLine = position.line;
    const nearestBlock = FoldingUtils.findNearestFoldingBlock(currentLine, allRanges);

    if (nearestBlock && nearestBlock.start === currentLine) {
        // Check if the block is folded
        const isFolded = editor.visibleRanges.every(range => {
            // A block is folded if its content lines are not visible
            return range.start.line > nearestBlock.end || range.end.line < nearestBlock.start + 1;
        });

        if (isFolded) {
            // Cursor is at the end of the title line of a folded block
            // Get the indentation of the title line
            const titleLine = document.lineAt(nearestBlock.start);
            const indentation = titleLine.text.substring(0, titleLine.firstNonWhitespaceCharacterIndex);

            // Insert a new line after the folded block with the same indentation
            const insertPosition = new vscode.Position(nearestBlock.end + 1, 0);
            await editor.edit(editBuilder => {
                editBuilder.insert(insertPosition, indentation + '\n');
            });

            // Move cursor to the new line
            const newPosition = new vscode.Position(nearestBlock.end + 1, indentation.length);
            editor.selection = new vscode.Selection(newPosition, newPosition);
            return;
        }
    }

    // If not on a folded block's title line or block is not folded, execute default Enter key action
    await vscode.commands.executeCommand('type', { text: '\n' });
}