import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { TemplateService } from '../templates/templateService';
import { Configuration } from '../config/configuration';

/**
 * Implements the `pointblank.quickOpenFile` command, which allows users to quickly
 * create and open a new file based on a pre-configured template.
 */
export async function quickOpenFileCommand(): Promise<void> {
    const templateService = TemplateService.getInstance();
    const templateNames = templateService.getTemplateNames(); // This now dynamically loads from files

    if (templateNames.length === 0) {
        vscode.window.showInformationMessage('Point Blank: No templates found in .vscode/templates directory. Please create template files with a "Type::" property.');
        return;
    }

    // --- Step 1: Get User Input ---
    const selectedTemplateName = await vscode.window.showQuickPick(templateNames, {
        placeHolder: 'Select a template type to create a new file',
        title: 'Quick Open File from Template'
    });
    if (!selectedTemplateName) return; // User cancelled

    const fileName = await vscode.window.showInputBox({
        prompt: `Enter a filename for the new ${selectedTemplateName} file`,
        value: `${selectedTemplateName.toLowerCase().replace(/\s/g, '-')}.md`,
        validateInput: text => {
            if (!text.trim()) return 'Filename cannot be empty.';
            if (!text.endsWith('.md')) return 'Filename must end with .md';
            return null;
        }
    });
    if (!fileName) return; // User cancelled

    // --- Step 2: Prepare File Content ---
    const parsedTemplate = await templateService.getParsedTemplate(selectedTemplateName);
    if (!parsedTemplate) {
        vscode.window.showErrorMessage(`Point Blank: Could not retrieve content for template '${selectedTemplateName}'.`);
        return;
    }

    // Format the template content with a title line and indented properties.
    const propertiesText = parsedTemplate.body.split('\n')
        .filter(l => l.trim() !== '')
        .map(prop => `\n${prop}`)
        .join('');
    
    let finalContent = `${propertiesText}`;

    // Prepend front matter if it exists
    if (parsedTemplate.frontMatter) {
        finalContent = `---\n${parsedTemplate.frontMatter}\n---\n${finalContent}`;
    }

    // --- Step 3: Determine File Path and Ensure Uniqueness ---
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('Point Blank: No workspace folder open. Cannot create file.');
        return;
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const newFileDirectorySetting = vscode.workspace.getConfiguration('pointblank').get('newFileDirectory', '.');
    const targetDirectory = path.join(workspaceRoot, newFileDirectorySetting);

    try {
        await fs.mkdir(targetDirectory, { recursive: true });
    } catch (error) {
        vscode.window.showErrorMessage(`Point Blank: Failed to create directory '${targetDirectory}': ${error instanceof Error ? error.message : String(error)}`);
        return;
    }

    const uniqueFullPath = await findUniqueFilePath(targetDirectory, fileName);

    // --- Step 4: Write File and Open in Editor ---
    try {
        await fs.writeFile(uniqueFullPath, finalContent, 'utf8');
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(uniqueFullPath));
        const editor = await vscode.window.showTextDocument(doc);

        // Place cursor at the end of the first line for immediate editing.
        // If there's front matter, the cursor should be after the closing '---'.
        // If no front matter, it's the first line of properties.
        let cursorLine = 0;
        if (parsedTemplate.frontMatter) {
            cursorLine = (parsedTemplate.frontMatter.split('\n').length || 0) + 2; // +2 for '---' lines
        }
        const position = new vscode.Position(cursorLine, 0); // Start of the first property line
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position));

        vscode.window.showInformationMessage(`Point Blank: Created new file: ${path.basename(uniqueFullPath)}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Point Blank: Failed to create or open file: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Finds a unique file path by appending a counter if the file already exists.
 * @param directory The directory where the file will be created.
 * @param fileName The desired initial filename.
 * @returns A promise that resolves to a unique file path.
 */
async function findUniqueFilePath(directory: string, fileName: string): Promise<string> {
    let fullPath = path.join(directory, fileName);
    let counter = 1;
    let uniqueFileName = fileName;

    while (true) {
        try {
            await fs.access(fullPath); // Check if file exists.
            const { name, ext } = path.parse(fileName);
            uniqueFileName = `${name}-${counter}${ext}`;
            fullPath = path.join(directory, uniqueFileName);
            counter++;
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return fullPath; // File does not exist, path is unique.
            }
            // For other errors, re-throw to be caught by the main try-catch block.
            throw new Error(`Error checking file existence: ${error.message}`);
        }
    }
}