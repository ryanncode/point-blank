import * as vscode from 'vscode';
import { ExtensionState } from '../state/extensionState';
import { DocumentModel } from '../document/documentModel';
import { BlockNode } from '../document/blockNode';
import { PasteWithBullets } from './pasteWithBullets';

export class CommandManager {
    private extensionState: ExtensionState;

    constructor(extensionState: ExtensionState) {
        this.extensionState = extensionState;
    }

    public register(context: vscode.ExtensionContext) {
        // Selection Control
        context.subscriptions.push(
            vscode.window.onDidChangeTextEditorSelection(event => {
                const editor = event.textEditor;
                if (!editor) {
                    return;
                }

                const documentModel = this.extensionState.getDocumentModel(editor.document.uri.toString());
                if (!documentModel) {
                    return;
                }

                const documentTree = documentModel.documentTree;
                const selection = editor.selection;

                // Only handle single-line selections for now
                if (!selection.isSingleLine) {
                    return;
                }

                const line = editor.document.lineAt(selection.active.line);
                const blockNode = documentTree.getNodeAtLine(line.lineNumber);

if (blockNode && blockNode.bulletRange) {
    const bulletEndChar = blockNode.bulletRange.end.character;
    const activePosition = editor.selection.active;

    if (activePosition.character < bulletEndChar) {
        if (editor.selection.isEmpty) {
            // It's a cursor, not a selection. Move it to the boundary.
            const newPosition = new vscode.Position(activePosition.line, bulletEndChar);
            editor.selection = new vscode.Selection(newPosition, newPosition);
        } else {
            // It's a selection. Adjust the active end to the boundary.
            const newActivePosition = new vscode.Position(activePosition.line, bulletEndChar);
            editor.selection = new vscode.Selection(editor.selection.anchor, newActivePosition);
        }
    }
}
            })
        );

        // Command Overrides
        context.subscriptions.push(
            vscode.commands.registerTextEditorCommand('type', (editor, _edit, args) => {
                const position = editor.selection.active;
                const line = editor.document.lineAt(position.line);
                const typedCharacter = args.text;

                // Check if a single character is being typed and it's not a newline
                if (typedCharacter.length === 1 && !typedCharacter.includes('\n') && !typedCharacter.includes('\r')) {
                    // Check if the line is currently empty or only contains whitespace
                    // AND the cursor is at the beginning of the line's content (after any indentation)
                    if (line.text.trim().length === 0 && position.character === line.firstNonWhitespaceCharacterIndex) {
                        const markdownPrefixRegex = /^\s*([\*\+\-@]|>|#{1,6}|\d+[\.\)])/;
                        // Prevent insertion if the typed character is a markdown prefix
                        if (!markdownPrefixRegex.test(typedCharacter)) {
                            // Use insertSnippet to atomically insert the bullet and the typed character
                            editor.insertSnippet(new vscode.SnippetString('• ' + typedCharacter), position);
                            return; // Prevent default:type from running, as we've handled the insertion
                        }
                    }
                }

                // If no bullet was inserted, execute the default type command
                vscode.commands.executeCommand('default:type', args);
            }),
            vscode.commands.registerTextEditorCommand('pointblank.deleteLeft', (editor, edit) => {
                const documentModel = this.extensionState.getDocumentModel(editor.document.uri.toString());
                if (!documentModel) {
                    vscode.commands.executeCommand('default:deleteLeft');
                    return;
                }

                const documentTree = documentModel.documentTree;
                const selection = editor.selection;

                if (!selection.isSingleLine) {
                    vscode.commands.executeCommand('default:deleteLeft');
                    return;
                }

                const line = editor.document.lineAt(selection.active.line);
                const blockNode = documentTree.getNodeAtLine(line.lineNumber);

                if (blockNode && blockNode.bulletRange) {
                    const bulletEndChar = blockNode.bulletRange.end.character;
                    if (selection.active.character === bulletEndChar) {
                        // Cursor is immediately after the bullet, delete bullet and following space
                        const rangeToDelete = new vscode.Range(
                            blockNode.bulletRange.start,
                            new vscode.Position(line.lineNumber, bulletEndChar + 1) // Include the space after the bullet
                        );
                        edit.delete(rangeToDelete);
                        return;
                    }
                }
                // Default deleteLeft behavior
                vscode.commands.executeCommand('default:deleteLeft');
            }),
            vscode.commands.registerTextEditorCommand('pointblank.deleteRight', (_editor, _edit) => {
                // Default deleteRight behavior
                vscode.commands.executeCommand('default:deleteRight');
            }),
            vscode.commands.registerTextEditorCommand('pointblank.cursorLeft', (_editor, _edit) => {
                // Default cursorLeft behavior
                vscode.commands.executeCommand('default:cursorLeft');
            }),
            vscode.commands.registerTextEditorCommand('pointblank.cursorRight', (_editor, _edit) => {
                // Default cursorRight behavior
                vscode.commands.executeCommand('default:cursorRight');
            }),
            vscode.commands.registerTextEditorCommand('pointblank.tab', async (editor) => {
                const position = editor.selection.active;
                const line = editor.document.lineAt(position.line);
                const documentModel = this.extensionState.getDocumentModel(editor.document.uri.toString());

                if (!documentModel) {
                    vscode.commands.executeCommand('default:tab');
                    return;
                }

                const blockNode = documentModel.documentTree.getNodeAtLine(line.lineNumber);

                if (blockNode && blockNode.bulletRange) {
                    const bulletEndChar = blockNode.bulletRange.end.character;

                    // If cursor is exactly at the end of the bullet (e.g., "* |" or "    * |")
                    if (position.character === bulletEndChar) {
                        const indentSpaces = '    '; // Assuming 4 spaces for indentation
                        await editor.edit(editBuilder => {
                            editBuilder.insert(new vscode.Position(line.lineNumber, 0), indentSpaces);
                        });
                    } else {
                        // Otherwise, insert a regular tab at the cursor position
                        await editor.edit(editBuilder => {
                            editBuilder.insert(position, '\t');
                        });
                    }
                } else {
                    // If no bullet, execute default tab command
                    vscode.commands.executeCommand('default:tab');
                }
            }),
            vscode.commands.registerTextEditorCommand('pointblank.outdent', () => {
                vscode.commands.executeCommand('outdentLines');
            }),
            vscode.commands.registerTextEditorCommand('pointblank.pasteWithBullets', PasteWithBullets.pasteWithBulletsCommand)
        );
    }
}