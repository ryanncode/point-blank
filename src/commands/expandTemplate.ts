import * as vscode from 'vscode';
import { TemplateService } from '../templates/templateService';
import { DocumentParser } from '../document/documentParser';
import { DecorationApplier } from '../decorations/decorationApplier';

export async function expandTemplateCommand(typeName: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const document = editor.document;
    const position = editor.selection.active;
    const line = document.lineAt(position.line);

    // The typeName is passed directly from extension.ts, so no need to re-parse the line.
    const templateService = TemplateService.getInstance();
    const templateContent = await templateService.getTemplate(typeName);

    if (templateContent === undefined) {
        vscode.window.showWarningMessage(`No template found for type: ${typeName}`);
        return;
    }

    await editor.edit(editBuilder => {
        // Delete the trigger text (e.g., "@Book ")
        // The range should cover from the first non-whitespace character to the cursor position (after the space)
        // Calculate the start character of the text to be deleted.
        // This should be the index of the '@' symbol.
        const atSymbolIndex = line.text.indexOf('@', line.firstNonWhitespaceCharacterIndex);
        if (atSymbolIndex === -1) {
            // Fallback, should not happen if extension.ts triggers correctly
            return;
        }

        const deleteStartChar = atSymbolIndex;
        const deleteEndChar = position.character; // End at the cursor position (after the space)

        // The actual range to delete, which includes '@TypeName' and the trailing space.
        const deleteRange = new vscode.Range(line.lineNumber, deleteStartChar, line.lineNumber, deleteEndChar);
        editBuilder.delete(deleteRange);

        // Get the current leading whitespace for indentation
        const currentIndent = line.text.substring(0, line.firstNonWhitespaceCharacterIndex);

        // Insert the new title line, ensuring it starts with a bullet point
        // Insert the new title line, ensuring it starts with the original indentation
        // and the (TypeName) format.
        const newTitleLine = `${currentIndent}(${typeName}) `;
        editBuilder.insert(line.range.start, newTitleLine);

        // Insert template lines with appropriate indentation
        const templateLines = templateContent.split('\n').filter(l => l.trim() !== '');
        let propertiesText = "";
        templateLines.forEach(prop => {
            // Properties should be indented relative to the typed node line
            propertiesText += `\n${currentIndent}  - ${prop}`; // Keep bullet for properties, indent by 2 spaces
        });
        editBuilder.insert(line.range.end, propertiesText);
    });

    // After the edit is complete, explicitly trigger a re-parse and re-decoration.
    // This ensures the parser sees the *new* text and applies correct decorations.
    const documentParser = new DocumentParser();
    const decorationApplier = new DecorationApplier();
    const parsedNodes = documentParser.parse(document);
    decorationApplier.updateDecorations(editor, parsedNodes);
}