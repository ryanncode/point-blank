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
        const templatePathRelative = this.templatesConfig[typeName];
        if (!templatePathRelative) {
            return undefined;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Point Blank: No workspace folder is open, cannot resolve template path.');
            return undefined;
        }

        // Resolve the template path relative to the first workspace folder.
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const fullTemplatePath = path.join(workspaceRoot, templatePathRelative);

        try {
            return await fs.readFile(fullTemplatePath, 'utf8');
        } catch (error) {
            vscode.window.showErrorMessage(`Point Blank: Could not read template file for type '${typeName}' at '${fullTemplatePath}': ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    }
}