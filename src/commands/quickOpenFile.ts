import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { TemplateService } from '../templates/templateService';
import { Configuration } from '../config/configuration';

export async function quickOpenFileCommand(): Promise<void> {
    const templateService = TemplateService.getInstance();
    const configuration = Configuration.getInstance();

    const templateNames = templateService.getTemplateNames();
    if (templateNames.length === 0) {
        vscode.window.showInformationMessage('No templates configured. Please configure templates in settings.');
        return;
    }

    const selectedTemplateName = await vscode.window.showQuickPick(templateNames, {
        placeHolder: 'Select a template type',
        title: 'Quick Open File from Template'
    });

    if (!selectedTemplateName) {
        return; // User cancelled
    }

    const fileName = await vscode.window.showInputBox({
        prompt: `Enter filename for the new ${selectedTemplateName} file (e.g., my-note.md)`,
        value: `${selectedTemplateName.toLowerCase().replace(/\s/g, '-')}.md`,
        validateInput: text => {
            if (!text.trim()) {
                return 'Filename cannot be empty.';
            }
            if (!text.endsWith('.md')) {
                return 'Filename must end with .md';
            }
            return null;
        }
    });

    if (!fileName) {
        return; // User cancelled
    }

    let templateContent = await templateService.getTemplate(selectedTemplateName);
    if (!templateContent) {
        vscode.window.showErrorMessage(`Could not retrieve content for template '${selectedTemplateName}'.`);
        return;
    }

    // Prepend the node type title line and format template content with indentation and bullet points
    const formattedTemplateLines = templateContent.split('\n').filter(l => l.trim() !== '');
    let propertiesText = "";
    formattedTemplateLines.forEach(prop => {
        propertiesText += `\n  - ${prop}`; // Indent by 2 spaces and add a bullet point
    });
    templateContent = `(${selectedTemplateName})${propertiesText}`;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open. Cannot create file.');
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const newFileDirectorySetting = vscode.workspace.getConfiguration('pointblank').get('newFileDirectory', '.');
    const targetDirectory = path.join(workspaceRoot, newFileDirectorySetting);

    // Ensure the target directory exists
    try {
        await fs.mkdir(targetDirectory, { recursive: true });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create directory '${targetDirectory}': ${error instanceof Error ? error.message : String(error)}`);
        return;
    }

    let fullPath = path.join(targetDirectory, fileName);
    let counter = 1;
    let uniqueFileName = fileName;

    // Ensure unique filename
    while (true) {
        try {
            await fs.access(fullPath); // Check if file exists
            const nameParts = fileName.split('.');
            const baseName = nameParts[0];
            const extension = nameParts.slice(1).join('.');
            uniqueFileName = `${baseName}-${counter}.${extension}`;
            fullPath = path.join(targetDirectory, uniqueFileName);
            counter++;
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                // File does not exist, so this path is unique
                break;
            } else {
                vscode.window.showErrorMessage(`Error checking file existence: ${error.message}`);
                return;
            }
        }
    }

    try {
        await fs.writeFile(fullPath, templateContent, 'utf8');
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(fullPath));
        const editor = await vscode.window.showTextDocument(doc);

        // Place cursor at the end of the title line with one space
        const firstLine = editor.document.lineAt(0);
        const position = new vscode.Position(0, firstLine.text.length + 1);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position));

        vscode.window.showInformationMessage(`Created new file: ${uniqueFileName}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create or open file: ${error instanceof Error ? error.message : String(error)}`);
    }
}