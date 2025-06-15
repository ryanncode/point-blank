import * as vscode from 'vscode';
import * as path from 'path';

export class QueryService {
    constructor() {}

    /**
     * Finds all Markdown files in the workspace that contain a specific Type:: declaration.
     * @param typeName The type name to search for (e.g., "Task", "Note").
     * @returns A promise that resolves to an array of absolute file paths matching the type.
     */
    public async findFilesByType(typeName: string): Promise<string[]> {
        const matchingFiles: string[] = [];
        const files = await vscode.workspace.findFiles('**/*.md', '{**/node_modules/**,**/.vscode/templates/**}');

        for (const uri of files) {
            try {
                const document = await vscode.workspace.openTextDocument(uri);
                const content = document.getText();
                const lines = content.split(/\r?\n/);

                let startLine = 0;
                if (lines[0] === '---') {
                    // Skip YAML frontmatter
                    for (let i = 1; i < lines.length; i++) {
                        if (lines[i] === '---') {
                            startLine = i + 1;
                            break;
                        }
                    }
                }

                // Find the first non-empty line after frontmatter
                let firstContentLine = '';
                for (let i = startLine; i < lines.length; i++) {
                    if (lines[i].trim().length > 0) {
                        firstContentLine = lines[i].trim();
                        break;
                    }
                }

                if (firstContentLine.startsWith(`Type:: ${typeName}`)) {
                    matchingFiles.push(uri.fsPath);
                }

            } catch (error) {
                console.error(`Error reading file ${uri.fsPath}: ${error}`);
            }
        }

        return matchingFiles;
    }
}