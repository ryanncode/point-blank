import * as vscode from 'vscode';
import { AddBulletsToSelection } from './addBulletsToSelection';
import { ExtensionState } from '../state/extensionState';
import { DocumentModel } from '../document/documentModel';
import { BlockNode } from '../document/blockNode';
import { PasteWithBullets } from './pasteWithBullets';
import { EnterKeyHandler } from './enterKey';
import { getBulletFromLine } from '../utils/bulletPointUtils.vscode';
import { getBulletStyleFromAdjacentLines } from '../utils/bulletStyleUtils';
import { Configuration } from '../config/configuration';
import { QueryService } from '../queries/queryService';

/**
 * Manages the registration and logic for all commands, including overrides for default VS Code behavior.
 */
export class CommandManager {
    private extensionState: ExtensionState;
    private queryService: QueryService;

    constructor(extensionState: ExtensionState) {
        this.extensionState = extensionState;
        this.queryService = new QueryService(extensionState);
    }

    /**
     * Registers all command handlers and listeners with the extension context.
     * @param context The extension context provided by VS Code.
     */
    public register(context: vscode.ExtensionContext): void {
        this.registerCommandOverrides(context);

        // Set up context key for Tab override
        vscode.window.onDidChangeTextEditorSelection(this.updateAtBulletStartContext, this, context.subscriptions);
        vscode.window.onDidChangeActiveTextEditor(this.updateAtBulletStartContext, this, context.subscriptions);
        // Set initial context
        this.updateAtBulletStartContext();
    }

    /**
     * Sets the 'pointblank.atBulletStart' context key if the cursor is at the start of a bullet or at the start of the line.
     */
    private updateAtBulletStartContext(): void {
        const editor = vscode.window.activeTextEditor;
        let atBulletStart = false;
        if (editor && editor.selection.isSingleLine) {
            const selection = editor.selection;
            const line = editor.document.lineAt(selection.active.line);
            const lineText = line.text;
            const indent = line.firstNonWhitespaceCharacterIndex;
            const bulletMatch = lineText.slice(indent).match(/^([*\-+•‣◦▪‣•·])\s+/);
            if (bulletMatch) {
                const bulletEnd = indent + bulletMatch[0].length;
                if (selection.active.character === 0 || selection.active.character === bulletEnd) {
                    atBulletStart = true;
                }
            } else {
                if (selection.active.character === 0) {
                    atBulletStart = true;
                }
            }
        }
        vscode.commands.executeCommand('setContext', 'pointblank.atBulletStart', atBulletStart);
    }


    /**
     * Registers overrides for default text editor commands to provide custom behavior.
     * @param context The extension context.
     */
    private registerCommandOverrides(context: vscode.ExtensionContext): void {
        const config = Configuration.getInstance();
        // --- `type` Command Override ---
        // Automatically inserts a bullet point when typing on an empty line.
        const typeCommand = vscode.commands.registerTextEditorCommand('type', async (editor, _edit, args) => {
            const position = editor.selection.active;
            const line = editor.document.lineAt(position.line);
            const typedChar = args.text;

            // If autoBullets is disabled, fall back to default behavior for bullet logic.
            if (!config.getAutoBullets()) {
                await vscode.commands.executeCommand('default:type', args);
                return;
            }

            // --- Auto-completion Handling ---
            // Defer to default handler for chars that trigger auto-completion to prevent interference.
            const autoCompleteChars = ['[', '{', '(', "'", '"'];
            if (autoCompleteChars.includes(typedChar) && line.text.trim().length === 0) {
                await vscode.commands.executeCommand('default:type', args);
                // Now, check if we should add a bullet *before* the auto-completed pair.
                const lineAfterType = editor.document.lineAt(editor.selection.active.line);
                if (lineAfterType.text.trim().length > 0) { // Check if something was actually inserted
                    const indent = line.firstNonWhitespaceCharacterIndex;
                    const bulletToInsert = getBulletStyleFromAdjacentLines(editor.document, position.line, indent, '• ');
                    await editor.edit(editBuilder => {
                        editBuilder.insert(new vscode.Position(position.line, indent), bulletToInsert);
                    });
                }
                return; // Stop further processing
            }

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

            let handled = false;
            if (typedChar.length === 1 && !typedChar.includes('\n') && !typedChar.includes('\r')) {
                if (line.text.trim().length === 0 && position.character === line.firstNonWhitespaceCharacterIndex) {
                    const markdownPrefixRegex = /^\s*([\*\+\-]|>|#{1,6}|\d+[\.\)])$/;
                    if (!markdownPrefixRegex.test(typedChar)) {
                        // Use shared helper for bullet style matching
                        const indent = line.firstNonWhitespaceCharacterIndex;
                        const bulletToInsert = getBulletStyleFromAdjacentLines(editor.document, position.line, indent, '• ');
                        await editor.edit(editBuilder => {
                            editBuilder.insert(position, bulletToInsert + typedChar);
                        });
                        // Move cursor to just after the inserted character
                        const newPos = position.with(undefined, position.character + (bulletToInsert + typedChar).length);
                        editor.selection = new vscode.Selection(newPos, newPos);
                        handled = true;
                    }
                }
            }

            if (!handled) {
                // Always let the default 'type' command handle the character insertion.
                // This ensures other extensions (like Foam) can correctly process the typed character.
                await vscode.commands.executeCommand('default:type', args);
            }

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

            // Remove the default bullet if a numbered list item is being typed at the start of the line (e.g., '1.')
            const currentLineText = currentLineAfterType.text;
            const currentLineIndent = currentLineAfterType.firstNonWhitespaceCharacterIndex;
            const bulletPrefix = '• ';
            // Regex matches e.g. '1. ', '2. ', '10. ', etc. at the start of the line (after indentation)
            const numberedListPattern = /^\d+\.\s/;
            if (currentLineText.substring(currentLineIndent).startsWith(bulletPrefix)) {
                const afterBullet = currentLineText.substring(currentLineIndent + bulletPrefix.length);
                if (numberedListPattern.test(afterBullet)) {
                    // Remove the bullet
                    const bulletStartPos = new vscode.Position(currentLineAfterType.lineNumber, currentLineIndent);
                    const bulletEndPos = new vscode.Position(currentLineAfterType.lineNumber, currentLineIndent + bulletPrefix.length);
                    await editor.edit(editBuilder => {
                        editBuilder.delete(new vscode.Range(bulletStartPos, bulletEndPos));
                    });
                }
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
            const selection = editor.selection;
            if (selection.isSingleLine) {
                const line = editor.document.lineAt(selection.active.line);
                const lineText = line.text;
                const indent = line.firstNonWhitespaceCharacterIndex;
                // Find bullet (if any) at start of line
                const bulletMatch = lineText.slice(indent).match(/^([*\-+•‣◦▪‣•·])\s+/);
                if (bulletMatch) {
                    // If at start of line or just after bullet, indent the bullet and text together
                    const bulletEnd = indent + bulletMatch[0].length;
                    if (selection.active.character === 0 || selection.active.character === bulletEnd) {
                        // Always insert indent at position 0 (start of line), even if indent is 0
                        await editor.edit(editBuilder => {
                            editBuilder.insert(new vscode.Position(line.lineNumber, 0), '    ');
                        });
                        return;
                    }
                } else {
                    // No bullet, just indent at start of line
                    if (selection.active.character === 0) {
                        await editor.edit(editBuilder => {
                            editBuilder.insert(new vscode.Position(line.lineNumber, 0), '    ');
                        });
                        return;
                    }
                }
            }
            // Otherwise, fall back to default tab behavior (move text or selection)
            await vscode.commands.executeCommand('tab');
        });

        // --- Other Command Registrations ---
        const outdentCommand = vscode.commands.registerTextEditorCommand('pointblank.outdent', () => {
            vscode.commands.executeCommand('outdentLines');
        });

        const pasteWithBulletsInstance = new PasteWithBullets(this.extensionState);
        const pasteWithBulletsCommand = vscode.commands.registerTextEditorCommand('pointblank.pasteWithBullets', async () => {
            if (!config.getAutoBullets()) {
                await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
                return;
            }
            await pasteWithBulletsInstance.pasteWithBulletsCommand();
        });
        const toggleAutoBulletsCommand = vscode.commands.registerCommand('pointblank.toggleAutoBullets', async () => {
            const current = config.getAutoBullets();
            await config.setAutoBullets(!current);
            // Show a notification that disappears quickly (1s)
            const message = `Point Blank: Auto Bullets ${!current ? 'Enabled' : 'Disabled'}`;
            const disposable = vscode.window.setStatusBarMessage(message, 5000);
        });

        const addBulletsToSelectionInstance = new AddBulletsToSelection();
        const addBulletsToSelectionCommand = vscode.commands.registerCommand('pointblank.addBulletsToSelection', async () => {
            await addBulletsToSelectionInstance.addBulletsToSelectionCommand();
        });

        // --- Default Behavior Fallbacks ---
        // These commands currently fall back to default behavior but are registered for future extension.
        const deleteRightCommand = vscode.commands.registerTextEditorCommand('pointblank.deleteRight', () => vscode.commands.executeCommand('default:deleteRight'));
        const cursorLeftCommand = vscode.commands.registerTextEditorCommand('pointblank.cursorLeft', () => vscode.commands.executeCommand('default:cursorLeft'));
        const cursorRightCommand = vscode.commands.registerTextEditorCommand('pointblank.cursorRight', () => vscode.commands.executeCommand('default:cursorRight'));

        context.subscriptions.push(
            typeCommand,
            deleteLeftCommand,
            toggleAutoBulletsCommand,
            addBulletsToSelectionCommand,
            deleteRightCommand,
            cursorLeftCommand,
            cursorRightCommand,
            tabCommand,
            outdentCommand,
            pasteWithBulletsCommand,
            toggleAutoBulletsCommand,
            // --- New Commands ---
            vscode.commands.registerTextEditorCommand('pointblank.insertTypeQuery', async (editor) => {
                const typeName = await vscode.window.showInputBox({ prompt: 'Enter the node Type to query for' });
                if (!typeName) { return; }

                const queryString = `LIST FROM BLOCKS WHERE Type == ${typeName}`;
                const parsedQuery = this.queryService.parseQuery(queryString);
                if (!parsedQuery) {
                    vscode.window.showErrorMessage('Failed to parse query for insertTypeQuery.');
                    return;
                }
                const results = await this.queryService.executeQuery(parsedQuery);
                // The QueryService now returns fully formatted links (e.g., [[link]] or ![[link]])
                // so we only need to prepend the list bullet.
                const queryBlock = this._formatQueryBlock(results, queryString);

                const snippet = new vscode.SnippetString(queryBlock);
                editor.insertSnippet(snippet, editor.selection.active);
            }),

            vscode.commands.registerTextEditorCommand('pointblank.updateTypeQuery', async (editor) => {
                const document = editor.document;

                let queryCommentLine: vscode.TextLine | undefined;
                let fullQueryString: string | undefined;

                // Search downwards for the query comment
                for (let i = editor.selection.start.line; i < document.lineCount; i++) {
                    const line = document.lineAt(i);
                    const match = line.text.match(/<!-- (?:pointblank|pb):query (.*?) -->/);
                    if (match) {
                        queryCommentLine = line;
                        fullQueryString = match[1].trim();
                        break;
                    }
                }

                if (!queryCommentLine || !fullQueryString) {
                    vscode.window.showWarningMessage('No "pointblank:query" comment found below the cursor.');
                    return;
                }

                const parsedQuery = this.queryService.parseQuery(fullQueryString);
                if (!parsedQuery) {
                    vscode.window.showErrorMessage('Failed to parse query for updateTypeQuery.');
                    return;
                }
                const results = await this.queryService.executeQuery(parsedQuery);
                // The QueryService now returns fully formatted links (e.g., [[link]] or ![[link]])
                // so we only need to prepend the list bullet.
                const newQueryBlock = this._formatQueryBlock(results, fullQueryString);

                const queryCommentStartLine = queryCommentLine.lineNumber;
                let resultsStartLine = queryCommentStartLine;

                // Determine the start of the existing results block (searching upwards from the comment)
                for (let i = queryCommentStartLine - 1; i >= 0; i--) {
                    const line = document.lineAt(i);
                    // Stop if we hit another query comment, an empty line, or a line that doesn't look like a result
                    if (
                        line.text.trim() === '' ||
                        line.text.match(/^<!-- (?:pointblank|pb):query/) ||
                        !(line.text.startsWith('- [[') || line.text.startsWith('- ![['))
                    ) {
                        resultsStartLine = i + 1;
                        break;
                    }
                    resultsStartLine = i;
                }

                const rangeToReplace = new vscode.Range(
                    new vscode.Position(resultsStartLine, 0),
                    new vscode.Position(queryCommentStartLine + 1, 0) // +1 to include the comment line and its newline
                );

                await editor.edit(editBuilder => {
                    editBuilder.replace(rangeToReplace, newQueryBlock);
                });

                // Set the cursor position to the start of the query comment line
                let newQueryCommentLineNumber = resultsStartLine;
                if (results.length > 0) {
                    newQueryCommentLineNumber += results.length;
                }
                const newPosition = new vscode.Position(newQueryCommentLineNumber, 0);
                editor.selection = new vscode.Selection(newPosition, newPosition);
            })
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

    /**
     * Formats the query results and the query comment into a single string block.
     * @param results The array of result strings.
     * @param queryString The original query string.
     * @returns A string representing the complete query block.
     */
    private _formatQueryBlock(results: string[], queryString: string): string {
        const queryComment = `<!-- pb:query ${queryString} -->`;
        const resultsText = results.map(r => `- ${r}`).join('\n');
        if (resultsText) {
            return `${resultsText}\n${queryComment}\n`;
        }
        return `${queryComment}\n`;
    }
}