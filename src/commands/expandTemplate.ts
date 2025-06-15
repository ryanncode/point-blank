import * as vscode from 'vscode';
import { TemplateService } from '../templates/templateService';
import { DocumentModel } from '../document/documentModel';
import { ExtensionState } from '../state/extensionState';

/**
 * Expands a template based on a type name (e.g., "Book") triggered by "Type:: ".
 * This function inserts the key-value property lines from the template.
 *
 * @param typeName The name of the template type to expand.
 * @param documentModel The document model, used to force a full re-parse after programmatic edits.
 * @param triggerLineNumber The line number where the "Type:: " trigger was found.
 */
export async function expandTemplateCommand(typeName: string, documentModel: DocumentModel, triggerLineNumber: number): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const line = editor.document.lineAt(triggerLineNumber);

    // Retrieve the user's configured tab size
    const editorConfig = vscode.workspace.getConfiguration('editor');
    const tabSize = editorConfig.get<number>('tabSize', 2); // Default to 2 if not set

    // Retrieve the template content from the TemplateService.
    const templateService = TemplateService.getInstance();
    const parsedTemplate = await templateService.getParsedTemplate(typeName);

    if (parsedTemplate === undefined) {
        vscode.window.showWarningMessage(`Point Blank: No template found for type "${typeName}".`);
        return;
    }

    const templateBody = parsedTemplate.body;

    const currentIndent = line.text.substring(0, line.firstNonWhitespaceCharacterIndex);
    const propertyIndent = ' '.repeat(tabSize); // Use user's tab size for property indentation

    const templateLines = templateBody.split('\n').filter(l => l.trim() !== '');
    const propertiesText = templateLines
        .map(prop => {
            const cleanedProp = prop.replace(/::\s*$/, '');
            return `${currentIndent}${propertyIndent}${cleanedProp}:: `;
        })
        .join('\n');

    // Perform all edits as a single, atomic bulk update operation.
    await documentModel.performBulkUpdate(async () => {
        // Delete the "Type:: " line
        await editor.edit(editBuilder => {
            editBuilder.delete(line.rangeIncludingLineBreak);
        });

        // Insert the property lines at the line where "Type:: " was
        await editor.edit(editBuilder => {
            editBuilder.insert(new vscode.Position(triggerLineNumber, 0), propertiesText + '\n');
        });

        // Position the cursor in the value section of the second line (the line immediately following the Type:: line)
        // This means the first inserted property line.
        const firstPropertyLine = editor.document.lineAt(triggerLineNumber);
        const firstPropertyKeyValueMatch = firstPropertyLine.text.match(/^\s*(\S.*?)::\s*(.*)$/);
        let newCursorCharacter = firstPropertyLine.firstNonWhitespaceCharacterIndex;
        if (firstPropertyKeyValueMatch && firstPropertyKeyValueMatch[1]) {
            newCursorCharacter = firstPropertyLine.text.indexOf('::') + 3; // After ":: "
        }
        const newCursorPosition = new vscode.Position(triggerLineNumber, newCursorCharacter);
        editor.selection = new vscode.Selection(newCursorPosition, newCursorPosition);
    });
}