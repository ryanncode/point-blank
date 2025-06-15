import * as vscode from 'vscode';
import * as path from 'path';

export class QueryService {
    constructor() {}

    /**
     * Finds all Markdown files in the workspace that contain a specific Type:: declaration.
     * @param typeName The type name to search for (e.g., "Task", "Note").
     * @returns A promise that resolves to an array of absolute file paths matching the type.
     */
    public async executeQuery(queryString: string): Promise<string[]> {
        const queryParts = this.parseQuery(queryString);
        if (!queryParts || !queryParts.type) {
            return []; // Invalid query
        }

        const typeName = queryParts.type;
        let files = await vscode.workspace.findFiles('**/*.md', '{**/node_modules/**,**/.vscode/templates/**}');

        let results: { uri: vscode.Uri; properties: Map<string, string> }[] = [];

        for (const uri of files) {
            try {
                const document = await vscode.workspace.openTextDocument(uri);
                const content = document.getText();
                const properties = this.extractProperties(content);

                if (properties.get('Type') === typeName) {
                    results.push({ uri, properties });
                }
            } catch (error) {
                console.error(`Error reading file ${uri.fsPath}: ${error}`);
            }
        }

        // Apply WHERE clause
        if (queryParts.whereKey && queryParts.whereValue) {
            results = results.filter(item => item.properties.get(queryParts.whereKey!) === queryParts.whereValue);
        }

        // Apply SORT BY clause
        if (queryParts.sortKey) {
            results.sort((a, b) => {
                const valA = a.properties.get(queryParts.sortKey!) || '';
                const valB = b.properties.get(queryParts.sortKey!) || '';
                if (queryParts.sortOrder === 'DESC') {
                    return valB.localeCompare(valA);
                } else {
                    return valA.localeCompare(valB);
                }
            });
        }

        return results.map(item => item.uri.fsPath);
    }

    private parseQuery(queryString: string): { type?: string; whereKey?: string; whereValue?: string; sortKey?: string; sortOrder?: 'ASC' | 'DESC' } | null {
        const queryRegex = /^LIST FROM Type::\s*(\w+)(?:\s+WHERE\s+([\w\s]+)::\s*(.*?))?(?:\s+SORT BY\s+([\w\s]+)\s+(ASC|DESC))?$/;
        const match = queryString.match(queryRegex);

        if (!match) {
            return null; // Invalid query format or order
        }

        const type = match[1];
        const whereKey = match[2];
        const whereValue = match[3];
        const sortKey = match[4];
        const sortOrder = match[5] ? (match[5].toUpperCase() as 'ASC' | 'DESC') : undefined;

        return {
            type: type,
            whereKey: whereKey,
            whereValue: whereValue,
            sortKey: sortKey,
            sortOrder: sortOrder
        };
    }

    private extractProperties(content: string): Map<string, string> {
        const properties = new Map<string, string>();
        const lines = content.split(/\r?\n/);

        let inFrontmatter = false;
        let startParsingLine = 0;

        if (lines[0] === '---') {
            inFrontmatter = true;
            for (let i = 1; i < lines.length; i++) {
                if (lines[i] === '---') {
                    startParsingLine = i + 1;
                    inFrontmatter = false;
                    break;
                }
            }
        }

        for (let i = startParsingLine; i < lines.length; i++) {
            const line = lines[i].trim();
            const match = line.match(/^(\w+)::\s*(.*)/);
            if (match) {
                properties.set(match[1], match[2]);
            } else if (line.length > 0 && !inFrontmatter) {
                // Stop parsing properties once we hit the first non-property content after frontmatter
                break;
            }
        }
        return properties;
    }
}