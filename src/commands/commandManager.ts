import * as vscode from 'vscode';
import { ExtensionState } from '../state/extensionState';
import { DocumentModel } from '../document/documentModel';
import { BlockNode } from '../document/blockNode';

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
                    if (selection.active.character <= bulletEndChar) {
                        // Prevent cursor from entering or being before the bullet
                        const newPosition = new vscode.Position(line.lineNumber, bulletEndChar);
                        editor.selection = new vscode.Selection(newPosition, newPosition);
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
                        const markdownPrefixRegex = /^\s*([\*\+\-]|>|#{1,6}|\d+[\.\)])/;
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
            vscode.commands.registerTextEditorCommand('pointblank.tab', () => {
                vscode.commands.executeCommand('indentLines');
            }),
            vscode.commands.registerTextEditorCommand('pointblank.outdent', () => {
                vscode.commands.executeCommand('outdentLines');
            })
        );
    }
}