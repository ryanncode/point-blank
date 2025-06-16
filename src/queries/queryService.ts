import * as vscode from 'vscode';
import * as path from 'path';
import { ExtensionState } from '../state/extensionState';
import { DocumentModel } from '../document/documentModel';
import { DocumentTree } from '../document/documentTree';
import { BlockAggregator } from '../document/blockAggregator';
import { TypedBlock } from '../document/typedBlock';

interface Condition {
    key: string;
    operator?: '::' | '!=' | '>' | '<' | 'AND' | 'OR';
    value?: string;
}

interface Query {
    source: 'FILES' | 'BLOCKS';
    scope: 'this.file' | 'this.folder' | 'workspace'; // Default to workspace
    whereConjunction?: 'AND' | 'OR'; // To indicate how multiple conditions are joined
    whereConditions: Condition[];
    sortKey?: string;
    sortOrder?: 'ASC' | 'DESC';
}

export class QueryService {
    private _extensionState: ExtensionState;
    private _blockAggregator: BlockAggregator;

    constructor(extensionState: ExtensionState) {
        this._extensionState = extensionState;
        this._blockAggregator = new BlockAggregator();
    }

    /**
     * Executes a parsed query to find relevant files or blocks.
     * @param queryParts The parsed Query object.
     * @returns A promise that resolves to an array of formatted strings (file paths or block links).
     */
    public async executeQuery(queryParts: Query): Promise<string[]> {
        let results: { uri: vscode.Uri; properties: Map<string, string>; startLine?: number }[] = [];

        let urisToProcess: vscode.Uri[] = [];

        // Determine URIs based on scope
        if (queryParts.scope === 'this.file') {
            const activeEditor = this._extensionState.activeEditor;
            if (activeEditor) {
                urisToProcess.push(activeEditor.document.uri);
            }
        } else if (queryParts.scope === 'this.folder') {
            const activeEditor = this._extensionState.activeEditor;
            if (activeEditor) {
                const folderUri = vscode.Uri.file(path.dirname(activeEditor.document.uri.fsPath));
                urisToProcess = await vscode.workspace.findFiles(new vscode.RelativePattern(folderUri, '**/*.md'), '{**/node_modules/**,**/.vscode/templates/**}');
            }
        } else { // workspace
            urisToProcess = await vscode.workspace.findFiles('**/*.md', '{**/node_modules/**,**/.vscode/templates/**}');
        }

        if (queryParts.source === 'FILES') {
            for (const uri of urisToProcess) {
                try {
                    const document = await vscode.workspace.openTextDocument(uri);
                    const content = document.getText();
                    const properties = this.extractProperties(content);
                    results.push({ uri, properties });
                } catch (error) {
                    console.error(`Error reading file ${uri.fsPath}: ${error}`);
                }
            }
        } else if (queryParts.source === 'BLOCKS') {
            for (const uri of urisToProcess) {
                let documentModel = this._extensionState.getDocumentModel(uri.toString());

                if (!documentModel) {
                    // Document not open, open it and wait for its model to be ready
                    try {
                        const document = await vscode.workspace.openTextDocument(uri);
                        // The onDidOpenTextDocument listener in extension.ts should create the model.
                        // We need to wait for it to be added to extensionState and parsed.
                        documentModel = this._extensionState.getDocumentModel(uri.toString());
                        if (!documentModel) {
                            console.warn(`DocumentModel for ${uri.fsPath} not found after opening. Skipping.`);
                            continue;
                        }
                        // Wait for the document model to finish its initial parse
                        if (documentModel.isParsing) {
                            await new Promise<void>(resolve => {
                                const disposable = documentModel!.onDidParse(() => {
                                    disposable.dispose();
                                    resolve();
                                });
                            });
                        }
                    } catch (error) {
                        console.error(`Error opening document ${uri.fsPath}: ${error}`);
                        continue;
                    }
                }

                if (documentModel && documentModel.documentTree) {
                    const typedBlocks = this._blockAggregator.findTypedBlocks(documentModel.documentTree);
                    for (const block of typedBlocks) {
                        results.push({ uri: block.uri, properties: block.properties, startLine: block.startLine });
                    }
                }
            }
        }

        // Apply WHERE clause
        if (queryParts.whereConditions.length > 0) {
            results = this._applyWhereClause(results, queryParts.whereConditions, queryParts.whereConjunction);
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

        // Format results based on source
        if (queryParts.source === 'FILES') {
            return results.map(item => item.uri.fsPath);
        } else { // BLOCKS
            return results.map(item => {
                // Format as link to file with line number
                const relativePath = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]
                    ? path.relative(vscode.workspace.workspaceFolders[0].uri.fsPath, item.uri.fsPath)
                    : item.uri.fsPath;
                // VS Code's URI fragment for line numbers is #L<line_number>
                return `${relativePath}:${item.startLine! + 1}`; // +1 because VS Code lines are 1-based
            });
        }
    }

    /**
     * Parses a query string into a structured Query object.
     * The query string is expected to follow the format:
     * `LIST FROM Type::[typeName] WHERE [conditions] SORT BY [sortKey] [ASC|DESC]`
     *
     * @param queryString The raw query string to parse.
     * @returns A `Query` object representing the parsed query, or `null` if the query string is invalid.
     *          The `Query` object has the following structure:
     *          - `source`: 'FILES' or 'BLOCKS' indicating where to query from.
     *          - `scope`: 'this.file', 'this.folder', or 'workspace' indicating the query scope. Defaults to 'workspace'.
     *          - `whereConjunction`: Optional. 'AND' or 'OR' if multiple conditions are present in the WHERE clause.
     *          - `whereConditions`: An array of `Condition` objects. Each `Condition` has:
     *              - `key`: The property key to filter by.
     *              - `operator`: Optional. The comparison operator (e.g., '::', '!=', '>', '<'). Defaults to '::'.
     *              - `value`: Optional. The value to compare against.
     *          - `sortKey`: Optional. The property key to sort results by.
     *          - `sortOrder`: Optional. 'ASC' or 'DESC' for sorting order.
     */
    public parseQuery(queryString: string): Query | null {
        const queryRegex = /^LIST FROM\s+(FILES|BLOCKS)(?:\s+IN\s+(this\.file|this\.folder|workspace))?(?:\s+WHERE\s+(.*?))?(?:\s+SORT BY\s+([\w\s]+)\s+(ASC|DESC))?$/i;
        const match = queryString.match(queryRegex);

        if (!match) {
            return null; // Invalid query format or order
        }

        const source = match[1].toUpperCase() as 'FILES' | 'BLOCKS';
        const scope = (match[2] || 'workspace') as 'this.file' | 'this.folder' | 'workspace';
        const whereClauseString = match[3];
        const sortKey = match[4];
        const sortOrder = match[5] ? (match[5].toUpperCase() as 'ASC' | 'DESC') : undefined;

        let whereConditions: Condition[] = [];
        let whereConjunction: 'AND' | 'OR' | undefined;

        if (whereClauseString) {
            const conjunctionMatch = whereClauseString.match(/\s(AND|OR)\s/i);
            if (conjunctionMatch) {
                whereConjunction = conjunctionMatch[1].toUpperCase() as 'AND' | 'OR';
                const conditionsStrings = whereClauseString.split(new RegExp(`\\s${whereConjunction}\\s`, 'i'));
                whereConditions = conditionsStrings.map(this.parseCondition);
            } else {
                whereConditions = [this.parseCondition(whereClauseString)];
            }
        }

        return {
            source: source,
            scope: scope,
            whereConjunction: whereConjunction,
            whereConditions: whereConditions,
            sortKey: sortKey,
            sortOrder: sortOrder
        };
    }

    private parseCondition(conditionString: string): Condition {
        const conditionMatch = conditionString.match(/^(\w+)(?:\s*(::|!=|>|<)\s*(.*))?$/);
        if (conditionMatch) {
            const key = conditionMatch[1];
            const operator = conditionMatch[2] as '::' | '!=' | '>' | '<' | undefined;
            let value = conditionMatch[3];

            // Remove quotes from value if present
            if (value && (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
            }

            return {
                key: key,
                operator: operator || '::', // Default to '::' for existence check
                value: value
            };
        }
        return { key: conditionString.trim(), operator: '::', value: undefined }; // Default for existence check
    }

    /**
     * Applies filtering conditions to a list of results based on the provided conditions and conjunction.
     * This method filters the results in-place, retaining only those items that satisfy the WHERE clause.
     *
     * @param results An array of objects, each containing a `vscode.Uri` and a `Map` of properties.
     * @param conditions An array of `Condition` objects to apply for filtering.
     * @param conjunction The logical conjunction ('AND' or 'OR') to apply if multiple conditions are present.
     *                    If 'AND', all conditions must be true. If 'OR', at least one condition must be true.
     *                    If undefined, it implies a single condition.
     * @returns A new array containing only the results that satisfy the specified conditions.
     *          Filtering is applied based on the operator in each condition:
     *          - `::`: Equality check (propertyValue === condition.value) or existence check (if condition.value is undefined).
     *          - `!=`: Not equal to.
     *          - `>`: Greater than (numeric comparison).
     *          - `<`: Less than (numeric comparison).
     */
    private _applyWhereClause(
        results: { uri: vscode.Uri; properties: Map<string, string> }[],
        conditions: Condition[],
        conjunction: 'AND' | 'OR' | undefined
    ): { uri: vscode.Uri; properties: Map<string, string> }[] {
        return results.filter(item => {
            if (conditions.length === 0) {
                return true;
            }

            const evaluateCondition = (condition: Condition): boolean => {
                const propertyValue = item.properties.get(condition.key);

                switch (condition.operator) {
                    case '::': // Equality or existence check
                        if (condition.value === undefined || condition.value === '') {
                            return item.properties.has(condition.key); // Key existence check
                        } else {
                            return propertyValue === condition.value; // Value equality check
                        }
                    case '!=': // Not Equal
                        return propertyValue !== condition.value;
                    case '>': // Greater Than (numeric)
                        return propertyValue !== undefined && parseFloat(propertyValue) > parseFloat(condition.value!);
                    case '<': // Less Than (numeric)
                        return propertyValue !== undefined && parseFloat(propertyValue) < parseFloat(condition.value!);
                    default:
                        return false;
                }
            };

            if (conjunction === 'AND') {
                return conditions.every(evaluateCondition);
            } else if (conjunction === 'OR') {
                return conditions.some(evaluateCondition);
            } else {
                // If no conjunction, it implies a single condition.
                return conditions.length === 1 ? evaluateCondition(conditions[0]) : false;
            }
        });
    }

    /**
     * Extracts key-value properties from the content of a Markdown file.
     * Properties are expected to be in the format `Key:: Value` and are typically found
     * at the beginning of the file, either within or after frontmatter.
     * Parsing stops at the first non-property line after any frontmatter.
     *
     * @param content The full text content of the Markdown file.
     * @returns A `Map` where keys are property names (e.g., "Type", "Status") and values are their corresponding string values.
     */
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