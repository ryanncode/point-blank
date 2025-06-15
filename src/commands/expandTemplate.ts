import * as vscode from 'vscode';
import { TemplateService } from '../templates/templateService';
import { DocumentModel } from '../document/documentModel';
import { ExtensionState } from '../state/extensionState';

/**
 * Expands a template based on a type name (e.g., "Book") triggered by "@TypeName ".
 * This function replaces the trigger text with a formatted template from user settings.
 *
 * @param typeName The name of the template type to expand.
 * @param _documentModel The document model, used to force a full re-parse after programmatic edits.
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

    // Find the '@' symbol to determine the start of the trigger text.
    const atSymbolIndex = line.text.indexOf('@', line.firstNonWhitespaceCharacterIndex);
    if (atSymbolIndex === -1) {
        // This should not happen if the command is triggered correctly by the InlineCompletionProvider.
        return;
    }

    // Prepare the new title line and properties text.
    const currentIndent = line.text.substring(0, line.firstNonWhitespaceCharacterIndex);
    const propertyIndent = ' '.repeat(tabSize); // Use user's tab size for property indentation
    newTitleLineContent = `${currentIndent}(${typeName}) `;

    const templateLines = templateContent.split('\n').filter(l => l.trim() !== '');
    const propertiesText = templateLines
        .map(prop => {
            // Remove any trailing "::" or ":: " from the template property line
            const cleanedProp = prop.replace(/::\s*$/, '');
            return `\n${currentIndent}${propertyIndent}${cleanedProp}:: `;
        })
        .join('');

    // Perform all edits as a single, atomic bulk update operation.
    await _documentModel.performBulkUpdate(async () => {
        const deleteRange = new vscode.Range(line.lineNumber, atSymbolIndex, line.lineNumber, position.character);

        // Step 1: Delete the trigger text (@TypeName).
        await editor.edit(editBuilder => {
            editBuilder.delete(deleteRange);
        });

        // Step 2: Insert the new title line (e.g., (Book)).
        // The position for insertion is where the trigger was, as it's now deleted.
        await editor.edit(editBuilder => {
            editBuilder.insert(new vscode.Position(line.lineNumber, atSymbolIndex), newTitleLineContent);
        });

        // Step 3: Insert the property lines.
        // The insertion point is at the end of the newly inserted title line.
        const titleLineEnd = new vscode.Position(line.lineNumber, newTitleLineContent.length);
        await editor.edit(editBuilder => {
            editBuilder.insert(titleLineEnd, propertiesText);
        });

        // Reposition the cursor to the end of the newly inserted title line.
        const newCursorPosition = new vscode.Position(line.lineNumber, newTitleLineContent.length);
        editor.selection = new vscode.Selection(newCursorPosition, newCursorPosition);
    });
}