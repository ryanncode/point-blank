import * as vscode from 'vscode';
import * as path from 'path';
interface Condition {
    key: string;
    operator?: '::' | '!=' | '>' | '<' | 'AND' | 'OR';
    value?: string;
}

interface Query {
    type: string;
    whereConjunction?: 'AND' | 'OR'; // To indicate how multiple conditions are joined
    whereConditions: Condition[];
    sortKey?: string;
    sortOrder?: 'ASC' | 'DESC';
}

export class QueryService {
    constructor() {}

    /**
     * Finds all Markdown files in the workspace that contain a specific Type:: declaration.
     * @param typeName The type name to search for (e.g., "Task", "Note").
     * @returns A promise that resolves to an array of absolute file paths matching the type.
     */
    public async executeQuery(queryString: string): Promise<string[]> {
        const queryParts: Query | null = this.parseQuery(queryString);
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

        return results.map(item => item.uri.fsPath);
    }

    /**
     * Parses a query string into a structured Query object.
     * The query string is expected to follow the format:
     * `LIST FROM Type::[typeName] WHERE [conditions] SORT BY [sortKey] [ASC|DESC]`
     *
     * @param queryString The raw query string to parse.
     * @returns A `Query` object representing the parsed query, or `null` if the query string is invalid.
     *          The `Query` object has the following structure:
     *          - `type`: The main type being queried (e.g., "Task", "Note").
     *          - `whereConjunction`: Optional. 'AND' or 'OR' if multiple conditions are present in the WHERE clause.
     *          - `whereConditions`: An array of `Condition` objects. Each `Condition` has:
     *              - `key`: The property key to filter by.
     *              - `operator`: Optional. The comparison operator (e.g., '::', '!=', '>', '<'). Defaults to '::'.
     *              - `value`: Optional. The value to compare against.
     *          - `sortKey`: Optional. The property key to sort results by.
     *          - `sortOrder`: Optional. 'ASC' or 'DESC' for sorting order.
     */
    private parseQuery(queryString: string): Query | null {
        const queryRegex = /^LIST FROM Type::\s*(\w+)(?:\s+WHERE\s+(.*?))?(?:\s+SORT BY\s+([\w\s]+)\s+(ASC|DESC))?$/;
        const match = queryString.match(queryRegex);

        if (!match) {
            return null; // Invalid query format or order
        }

        const type = match[1];
        const whereClauseString = match[2];
        const sortKey = match[3];
        const sortOrder = match[4] ? (match[4].toUpperCase() as 'ASC' | 'DESC') : undefined;

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
            type: type,
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