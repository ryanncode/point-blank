import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * A singleton service responsible for managing and providing access to user-defined templates.
 * It loads template configurations from VS Code settings and retrieves template content from the filesystem.
 */
export class TemplateService {
    private static instance: TemplateService;
    private templatesConfig: { [key: string]: string } = {};

    private constructor() {
        this.loadConfiguration();
        // Listen for changes to the configuration and reload templates if necessary.
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('pointblank.templates')) {
                this.loadConfiguration();
            }
        });
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
     * Loads the template configuration from the user's settings.
     */
    private loadConfiguration(): void {
        const config = vscode.workspace.getConfiguration('pointblank');
        this.templatesConfig = config.get('templates', {});
    }

    /**
     * Returns an array of all configured template names.
     */
    public getTemplateNames(): string[] {
        return Object.keys(this.templatesConfig);
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
        const templatePathRelative = this.templatesConfig[typeName];
        if (!templatePathRelative) {
            return undefined;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Point Blank: No workspace folder is open, cannot resolve template path.');
            return undefined;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const fullTemplatePath = path.join(workspaceRoot, templatePathRelative);

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