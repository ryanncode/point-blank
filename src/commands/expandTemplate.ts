import * as vscode from 'vscode';
import { TemplateService } from '../templates/templateService';
import { DocumentModel } from '../document/documentModel';
import { ExtensionState } from '../state/extensionState';

/**
 * Expands a template based on a type name (e.g., "Book") triggered by "@TypeName ".
 * This function replaces the trigger text with a formatted template from user settings.
 *
 * @param typeName The name of the template type to expand.
 * @param _documentModel The document model, passed for context but not directly used,
 *                       as the `onDidChangeTextDocument` event handles the re-parse.
 */
export async function expandTemplateCommand(typeName: string, _documentModel: DocumentModel): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const position = editor.selection.active;
    const line = editor.document.lineAt(position.line);

    // Retrieve the user's configured tab size
    const editorConfig = vscode.workspace.getConfiguration('editor');
    const tabSize = editorConfig.get<number>('tabSize', 2); // Default to 2 if not set

    // Retrieve the template content from the TemplateService.
    const templateService = TemplateService.getInstance();
    const templateContent = await templateService.getTemplate(typeName);

    if (templateContent === undefined) {
        vscode.window.showWarningMessage(`Point Blank: No template found for type "${typeName}".`);
        return;
    }

    let newTitleLineContent: string = '';

    await editor.edit(editBuilder => {
        // --- 1. Delete the Trigger Text ---
        // Find the '@' symbol to determine the start of the trigger text.
        const atSymbolIndex = line.text.indexOf('@', line.firstNonWhitespaceCharacterIndex);
        if (atSymbolIndex === -1) {
            // This should not happen if the command is triggered correctly by the InlineCompletionProvider.
            return;
        }

        // The range to delete includes everything from the '@' to the cursor (which is after the space).
        const deleteRange = new vscode.Range(line.lineNumber, atSymbolIndex, line.lineNumber, position.character);
        editBuilder.delete(deleteRange);

        // --- 2. Prepare and Insert New Content ---
        const currentIndent = line.text.substring(0, line.firstNonWhitespaceCharacterIndex);
        const propertyIndent = ' '.repeat(tabSize); // Use user's tab size for property indentation

        // Create the new title line, e.g., "  (Book) "
        newTitleLineContent = `${currentIndent}(${typeName}) `;
        editBuilder.insert(line.range.start, newTitleLineContent);

        // Format and insert the template properties, indented under the title line.
        const templateLines = templateContent.split('\n').filter(l => l.trim() !== '');
        const propertiesText = templateLines
            .map(prop => `\n${currentIndent}${propertyIndent}${prop}`) // Indent properties by user's tab size, no bullet.
            .join('');
        editBuilder.insert(line.range.end, propertiesText);
    });

    // --- 3. Reposition the Cursor ---
    // Move the cursor to the end of the newly inserted title line for a smooth editing flow.
    const newCursorPosition = new vscode.Position(line.lineNumber, newTitleLineContent.length);
    editor.selection = new vscode.Selection(newCursorPosition, newCursorPosition);

    // Crucially, force the document model to update after the programmatic edit.
    // This ensures that subsequent commands (like Enter key handling) operate on an up-to-date tree.
    // Add a small delay to allow VS Code's internal document model to fully synchronize.
    await new Promise(resolve => setTimeout(resolve, 100));
    _documentModel.updateAfterProgrammaticEdit(editor.document);
}