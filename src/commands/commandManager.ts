import * as vscode from 'vscode';
import { ExtensionState } from '../state/extensionState';
import { DocumentModel } from '../document/documentModel';
import { BlockNode } from '../document/blockNode';
import { PasteWithBullets } from './pasteWithBullets';
import { EnterKeyHandler } from './enterKey';
import { getBulletFromLine } from '../utils/bulletPointUtils';

/**
 * Manages the registration and logic for all commands, including overrides for default VS Code behavior.
 */
export class CommandManager {
    private extensionState: ExtensionState;

    constructor(extensionState: ExtensionState) {
        this.extensionState = extensionState;
    }

    /**
     * Registers all command handlers and listeners with the extension context.
     * @param context The extension context provided by VS Code.
     */
    public register(context: vscode.ExtensionContext): void {
        this.registerSelectionControl(context);
        this.registerCommandOverrides(context);
    }

    /**
     * Registers a listener to control text selection, preventing the cursor from moving inside decorated bullet ranges.
     * This ensures that bullets are treated as atomic units.
     * @param context The extension context.
     */
    private registerSelectionControl(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.window.onDidChangeTextEditorSelection(event => {
                const editor = event.textEditor;
                if (!editor) { return; }

                const documentModel = this.extensionState.getDocumentModel(editor.document.uri.toString());
                if (!documentModel) {
                    vscode.commands.executeCommand('setContext', 'pointblank.atBulletStart', false);
                    return;
                }

                // Only handle single-line selections for simplicity.
                if (!editor.selection.isSingleLine) {
                    vscode.commands.executeCommand('setContext', 'pointblank.atBulletStart', false);
                    return;
                }

                const line = editor.document.lineAt(editor.selection.active.line);
                const blockNode = documentModel.documentTree.getNodeAtLine(line.lineNumber);
                const activePosition = editor.selection.active;

                let atBulletStart = false;
                if (blockNode && blockNode.bulletRange) {
                    const bulletEndChar = blockNode.bulletRange.end.character;

                    // If the cursor is within the bullet's range, move it to the end of the bullet.
                    if (activePosition.character < bulletEndChar) {
                        const newPosition = new vscode.Position(activePosition.line, bulletEndChar);
                        if (editor.selection.isEmpty) {
                            // It's a cursor, not a selection. Move it to the boundary.
                            editor.selection = new vscode.Selection(newPosition, newPosition);
                        } else {
                            // It's a selection. Adjust the active end to the boundary.
                            editor.selection = new vscode.Selection(editor.selection.anchor, newPosition);
                        }
                    }

                    // Set context key: true if cursor is exactly at the end of the bullet
                    if (activePosition.character === bulletEndChar) {
                        atBulletStart = true;
                    }
                }
                vscode.commands.executeCommand('setContext', 'pointblank.atBulletStart', atBulletStart);
            })
        );
    }

    /**
     * Registers overrides for default text editor commands to provide custom behavior.
     * @param context The extension context.
     */
    private registerCommandOverrides(context: vscode.ExtensionContext): void {
        // --- `type` Command Override ---
        // Automatically inserts a bullet point when typing on an empty line.
        const typeCommand = vscode.commands.registerTextEditorCommand('type', async (editor, _edit, args) => {
            const position = editor.selection.active;
            const line = editor.document.lineAt(position.line);
            const typedChar = args.text;

            // If the typed character is a newline, delegate to our custom Enter key handler.

            // Check if the user is typing '[[', especially at the beginning of a line after a bullet.
            // This is a specific trigger for Foam's backlink completion.
            if (typedChar === '[' && position.character > 0 && line.text.charAt(position.character - 1) === '[') {
                await vscode.commands.executeCommand('default:type', args);
                return;
            }

            // Check if the cursor is inside an already formed Foam backlink (e.g., [[...]])
            const textBeforeCursor = line.text.substring(0, position.character);
            const textAfterCursor = line.text.substring(position.character);
            const isInsideBacklink = /\[\[[^\]]*$/.test(textBeforeCursor) && /^[^\[]*\]\]/.test(textAfterCursor);

            if (isInsideBacklink) {
                // If inside a backlink, defer to the default type command to allow Foam to handle it.
                await vscode.commands.executeCommand('default:type', args);
                return;
            }

            // Scenario 1: Auto-insert bullet on empty line if not already a markdown prefix
            if (typedChar.length === 1 && !typedChar.includes('\n') && !typedChar.includes('\r')) {
                if (line.text.trim().length === 0 && position.character === line.firstNonWhitespaceCharacterIndex) {
                    const markdownPrefixRegex = /^\s*([\*\+\-]|>|#{1,6}|\d+[\.\)])/;
                    // Only insert a bullet if the typed character is NOT a markdown prefix.
                    // This allows VS Code's default 'type' command to handle markdown prefixes like '[[',
                    // ensuring interoperability with other extensions like Foam.
                    if (!markdownPrefixRegex.test(typedChar)) {
                        let bulletToInsert = '• '; // Default bullet
                        if (position.line > 0) {
                            const previousLine = editor.document.lineAt(position.line - 1);
                            bulletToInsert = getBulletFromLine(previousLine);
                        }

                        await editor.edit(editBuilder => {
                            // Insert only the bullet point. The actual character typed by the user
                            // will be handled by the default:type command below.
                            editBuilder.insert(position, bulletToInsert);
                        });
                    }
                }
            }

            // Always let the default 'type' command handle the character insertion.
            // This ensures other extensions (like Foam) can correctly process the typed character.
            await vscode.commands.executeCommand('default:type', args);

            // After character is typed (either by us or default), check if '::' was just typed
            // and auto-complete to ':: '.
            const currentPositionAfterType = editor.selection.active;
            const currentLineAfterType = editor.document.lineAt(currentPositionAfterType.line);
            const textBeforeCursorAfterType = currentLineAfterType.text.substring(0, currentPositionAfterType.character);

            if (textBeforeCursorAfterType.endsWith('::')) {
                await editor.edit(editBuilder => {
                    editBuilder.insert(currentPositionAfterType, ' ');
                });
            }

            // After character is typed (either by us or default), check for key-value pair and remove bullet if necessary.
            await this.handleKeyValueBulletRemoval(editor, position.line);
        });

        // --- `deleteLeft` Command Override ---
        // Deletes the entire bullet point if the cursor is immediately after it.
        const deleteLeftCommand = vscode.commands.registerTextEditorCommand('pointblank.deleteLeft', (editor, edit) => {
            const documentModel = this.extensionState.getDocumentModel(editor.document.uri.toString());
            if (!documentModel || !editor.selection.isSingleLine) {
                vscode.commands.executeCommand('default:deleteLeft');
                return;
            }

            const line = editor.document.lineAt(editor.selection.active.line);
            const blockNode = documentModel.documentTree.getNodeAtLine(line.lineNumber);

            if (blockNode && blockNode.bulletRange) {
                const bulletEndChar = blockNode.bulletRange.end.character;
                if (editor.selection.active.character === bulletEndChar) {
                    // Cursor is immediately after the bullet; delete the bullet and the following space.
                    const rangeToDelete = new vscode.Range(
                        blockNode.bulletRange.start,
                        new vscode.Position(line.lineNumber, bulletEndChar + 1)
                    );
                    edit.delete(rangeToDelete);
                    return;
                }
            }
            vscode.commands.executeCommand('default:deleteLeft');
        });

        // --- `tab` Command Override ---
        // Indents the line if the cursor is at the end of a bullet.
        const tabCommand = vscode.commands.registerTextEditorCommand('pointblank.tab', async (editor) => {
            // This command will only be executed when 'pointblank.atBulletStart' context is true,
            // as defined in package.json keybindings.
            const position = editor.selection.active;
            const line = editor.document.lineAt(position.line);
            await editor.edit(editBuilder => {
                editBuilder.insert(new vscode.Position(line.lineNumber, 0), '    ');
            });
        });

        // --- Other Command Registrations ---
        const outdentCommand = vscode.commands.registerTextEditorCommand('pointblank.outdent', () => {
            vscode.commands.executeCommand('outdentLines');
        });

        const pasteWithBulletsInstance = new PasteWithBullets(this.extensionState);
        const pasteWithBulletsCommand = vscode.commands.registerTextEditorCommand('pointblank.pasteWithBullets', () => pasteWithBulletsInstance.pasteWithBulletsCommand());

        // --- Default Behavior Fallbacks ---
        // These commands currently fall back to default behavior but are registered for future extension.
        const deleteRightCommand = vscode.commands.registerTextEditorCommand('pointblank.deleteRight', () => vscode.commands.executeCommand('default:deleteRight'));
        const cursorLeftCommand = vscode.commands.registerTextEditorCommand('pointblank.cursorLeft', () => vscode.commands.executeCommand('default:cursorLeft'));
        const cursorRightCommand = vscode.commands.registerTextEditorCommand('pointblank.cursorRight', () => vscode.commands.executeCommand('default:cursorRight'));

        context.subscriptions.push(
            typeCommand,
            deleteLeftCommand,
            deleteRightCommand,
            cursorLeftCommand,
            cursorRightCommand,
            tabCommand,
            outdentCommand,
            pasteWithBulletsCommand
        );
    }
    /**
     * Checks the current line for a key-value pair pattern immediately following a default bullet
     * and removes the bullet if a match is found.
     * This is called after a character has been typed into the document.
     * @param editor The active text editor.
     * @param lineNumber The line number to check.
     */
    private async handleKeyValueBulletRemoval(editor: vscode.TextEditor, lineNumber: number): Promise<void> {
        const line = editor.document.lineAt(lineNumber);
        const lineText = line.text;
        const currentLineIndentation = line.firstNonWhitespaceCharacterIndex;

        const bulletPrefix = '• ';
        // Check if the line starts with our default bullet '• ' (after indentation)
        if (lineText.substring(currentLineIndentation).startsWith(bulletPrefix)) {
            const contentAfterBullet = lineText.substring(currentLineIndentation + bulletPrefix.length);
            // Regex to match "word:: " at the beginning of the content after the bullet
            const keyValuePattern = /^(\S+::\s)/; // Matches "Key:: "
            const keyValueMatch = contentAfterBullet.match(keyValuePattern);

            if (keyValueMatch) {
                // It's a key-value pair, remove the bullet point.
                const bulletStartPos = new vscode.Position(lineNumber, currentLineIndentation);
                const bulletEndPos = new vscode.Position(lineNumber, currentLineIndentation + bulletPrefix.length);

                await editor.edit(editBuilder => {
                    editBuilder.delete(new vscode.Range(bulletStartPos, bulletEndPos));
                });
            }
        }
    }
}