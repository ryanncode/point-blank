import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * A singleton service responsible for managing and providing access to user-defined templates.
 * It loads template configurations from VS Code settings and retrieves template content from the filesystem.
 */
export class TemplateService {
    private static instance: TemplateService;
    private templateMap: Map<string, string> = new Map(); // Maps typeName to full file path

    private constructor() {
        this.loadTemplates();
        // No longer listening for 'pointblank.templates' config changes
    }

    /**
     * Returns the singleton instance of the `TemplateService`.
     */
    public static getInstance(): TemplateService {
        if (!TemplateService.instance) {
            TemplateService.instance = new TemplateService();
        }
        return TemplateService.instance;
    }

    /**
     * Scans the .vscode/templates directory for .md files, parses the 'Type::' property,
     * and populates the internal templateMap. Files without a 'Type::' property are ignored.
     */
    private async loadTemplates(): Promise<void> {
        this.templateMap.clear(); // Clear existing map before reloading
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Point Blank: No workspace folder is open. Cannot load templates.');
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const templatesDir = path.join(workspaceRoot, '.vscode', 'templates');

        try {
            const files = await fs.readdir(templatesDir);
            for (const file of files) {
                if (file.endsWith('.md')) {
                    const fullPath = path.join(templatesDir, file);
                    try {
                        const fileContent = await fs.readFile(fullPath, 'utf8');
                        const typeMatch = fileContent.match(/^Type::\s*(.*)$/m);
                        if (typeMatch && typeMatch[1]) {
                            const typeName = typeMatch[1].trim();
                            this.templateMap.set(typeName, fullPath);
                        } else {
                            console.warn(`Point Blank: Template file '${file}' in '${templatesDir}' is missing a 'Type::' property and will be ignored.`);
                        }
                    } catch (readError) {
                        console.error(`Point Blank: Could not read template file '${file}': ${readError instanceof Error ? readError.message : String(readError)}`);
                    }
                }
            }
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                // Directory does not exist, which is fine if no templates are configured.
                console.log(`Point Blank: No templates directory found at '${templatesDir}'.`);
            } else {
                vscode.window.showErrorMessage(`Point Blank: Failed to load templates from '${templatesDir}': ${error.message}`);
            }
        }
    }

    /**
     * Returns an array of all configured template names.
     */
    public getTemplateNames(): string[] {
        return Array.from(this.templateMap.keys());
    }

    /**
     * Retrieves the content of a specific template file.
     * @param typeName The name of the template to retrieve.
     * @returns A promise that resolves to the template content as a string, or `undefined` if not found.
     */
    public async getTemplate(typeName: string): Promise<string | undefined> {
        const parsedTemplate = await this.getParsedTemplate(typeName);
        return parsedTemplate?.body;
    }

    /**
     * Retrieves and parses the content of a specific template file, separating front matter from the body.
     * @param typeName The name of the template to retrieve.
     * @returns A promise that resolves to an object containing frontMatter (string or null) and body (string),
     *          or `undefined` if the template is not found or cannot be read.
     */
    public async getParsedTemplate(typeName: string): Promise<{ frontMatter: string | null, body: string } | undefined> {
        let fullTemplatePath = this.templateMap.get(typeName);

        // If template not found, try reloading templates once.
        if (!fullTemplatePath) {
            await this.loadTemplates();
            fullTemplatePath = this.templateMap.get(typeName);
        }

        if (!fullTemplatePath) {
            return undefined; // Still not found after reload
        }

        try {
            const fileContent = await fs.readFile(fullTemplatePath, 'utf8');
            const lines = fileContent.split('\n');

            let frontMatter: string | null = null;
            let bodyLines: string[] = [];
            let inFrontMatter = false;
            let frontMatterEndLine = -1;

            if (lines[0].trim() === '---') {
                inFrontMatter = true;
                for (let i = 1; i < lines.length; i++) {
                    if (lines[i].trim() === '---') {
                        inFrontMatter = false;
                        frontMatterEndLine = i;
                        break;
                    }
                    frontMatter = (frontMatter === null ? '' : frontMatter + '\n') + lines[i];
                }
            }

            if (frontMatterEndLine !== -1) {
                bodyLines = lines.slice(frontMatterEndLine + 1);
            } else {
                bodyLines = lines;
            }

            return { frontMatter, body: bodyLines.join('\n') };

        } catch (error) {
            vscode.window.showErrorMessage(`Point Blank: Could not read template file for type '${typeName}' at '${fullTemplatePath}': ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    }
}