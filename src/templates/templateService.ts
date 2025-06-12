import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export class TemplateService {
    private static instance: TemplateService;
    private templatesConfig: { [key: string]: string } = {};

    private constructor() {
        this.loadConfiguration();
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('pointblank.templates')) {
                this.loadConfiguration();
            }
        });
    }

    public static getInstance(): TemplateService {
        if (!TemplateService.instance) {
            TemplateService.instance = new TemplateService();
        }
        return TemplateService.instance;
    }

    private loadConfiguration(): void {
        const config = vscode.workspace.getConfiguration('pointblank');
        this.templatesConfig = config.get('templates') || {};
    }

    public getTemplateNames(): string[] {
        return Object.keys(this.templatesConfig);
    }

    public async getTemplate(typeName: string): Promise<string | undefined> {
        const templatePathRelative = this.templatesConfig[typeName];
        if (!templatePathRelative) {
            return undefined;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder open to resolve template path.');
            return undefined;
        }

        // Assuming the template path is relative to the first workspace folder
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const fullTemplatePath = path.join(workspaceRoot, templatePathRelative);

        try {
            const content = await fs.readFile(fullTemplatePath, 'utf8');
            return content;
        } catch (error) {
            vscode.window.showErrorMessage(`Could not read template file for type '${typeName}': ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    }
}