import * as vscode from 'vscode';
import { DocumentNode, KeyValueProperty } from './documentNode';
import { isExcludedLine } from '../decorations/lineFilters';

export class DocumentParser {
    private _cachedNodes: DocumentNode[] = [];
    private _inCodeBlock: boolean = false; // Track code block state across incremental updates


public fullParse(document: vscode.TextDocument): DocumentNode[] {
        const nodes: DocumentNode[] = [];
        let currentParentLineNumber: number | undefined = undefined;
        this._inCodeBlock = false; // Reset for full parse

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const node = this.parseLine(line, i);

            // Update code block state
            if (node.trimmedText.startsWith('```')) {
                this._inCodeBlock = !this._inCodeBlock;
            }
            // Set isCodeBlockDelimiter based on the state *after* processing the current line's delimiter
            node.isCodeBlockDelimiter = node.trimmedText.startsWith('```');

            // Determine parent for key-value lines and typed nodes
            if (node.isKeyValue) {
                node.parentLineNumber = currentParentLineNumber;
            } else if (!line.isEmptyOrWhitespace && !node.isCodeBlockDelimiter && !node.isExcluded) {
                currentParentLineNumber = i;
            }
            nodes.push(node);
        }
        this._cachedNodes = nodes;
        return nodes;
    }

    private parseLine(line: vscode.TextLine, lineNumber: number): DocumentNode {
        const text = line.text;
        const trimmedText = text.trim();
        const firstCharIndex = line.firstNonWhitespaceCharacterIndex;
        const lineTextFromNonWhitespace = text.substring(firstCharIndex);

        let isKeyValue = false;
        let keyValue: KeyValueProperty | undefined;
        let isLineExcluded = false;
        let isTypedNode = false;
        let type: string | undefined;
        let typedNodeRange: vscode.Range | undefined;

        // Check for excluded lines (Markdown headers, horizontal rules)
        if (isExcludedLine(line)) {
            isLineExcluded = true;
        }

        // Check for Key:: Value pattern
        const keyValueMatch = lineTextFromNonWhitespace.match(/^(\S+::)\s*(.*)/);
        if (keyValueMatch) {
            isKeyValue = true;
            const keyPart = keyValueMatch[1];
            const valuePart = keyValueMatch[2];
            const keyRange = new vscode.Range(lineNumber, firstCharIndex, lineNumber, firstCharIndex + keyPart.length);
            const fullRange = new vscode.Range(lineNumber, 0, lineNumber, text.length);
            keyValue = {
                key: keyPart.slice(0, -2), // Remove "::"
                value: valuePart,
                range: fullRange,
                keyRange: keyRange
            };
        }

        // Check for Typed Node pattern: - (TypeName)
        const typedNodeMatch = lineTextFromNonWhitespace.match(/^\s*\((.+)\)/);
        if (typedNodeMatch) {
            isTypedNode = true;
            type = typedNodeMatch[1];
            const startIndex = firstCharIndex + typedNodeMatch[0].indexOf('(');
            const endIndex = startIndex + typedNodeMatch[0].length - typedNodeMatch[0].indexOf('(');
            typedNodeRange = new vscode.Range(lineNumber, startIndex, lineNumber, endIndex);
        }
        
        return {
            line: line,
            lineNumber: lineNumber,
            text: text,
            trimmedText: trimmedText,
            indent: firstCharIndex,
            isKeyValue: isKeyValue,
            keyValue: keyValue,
            parentLineNumber: undefined, // Will be set during fullParse or incremental update
            isCodeBlockDelimiter: false, // Will be set during fullParse or incremental update
            isExcluded: isLineExcluded,
            isTypedNode: isTypedNode,
            type: type,
            typedNodeRange: typedNodeRange
        };
    }

    /**
     * Performs an incremental parse of the document based on a text document change event.
     * This method aims to re-parse only the affected lines and their immediate context
     * to update the document nodes efficiently.
     * @param document The current `vscode.TextDocument`.
     * @param event The `vscode.TextDocumentChangeEvent` describing the change.
     * @param oldNodes The array of `DocumentNode`s before the change.
     * @returns An object containing the updated array of `DocumentNode`s and a set of affected line numbers.
     */
    public incrementalParse(
        document: vscode.TextDocument,
        event: vscode.TextDocumentChangeEvent,
        oldNodes: DocumentNode[]
    ): { updatedNodes: DocumentNode[], affectedLineNumbers: Set<number> } {
        const updatedNodes: DocumentNode[] = [...oldNodes];
        const affectedLineNumbers = new Set<number>();

        // Determine the range of lines affected by the change
        let startLine = event.contentChanges.length > 0 ? event.contentChanges[0].range.start.line : 0;
        let endLine = event.contentChanges.length > 0 ? event.contentChanges[0].range.end.line : document.lineCount - 1;

        // Extend the affected range to include potential structural changes (e.g., indentation changes)
        // For simplicity, we'll re-parse from the start of the document for now,
        // but this is where more sophisticated incremental parsing logic would go.
        // A more advanced implementation would track indentation levels and re-parse
        // only the necessary subtree.
        startLine = 0; // For now, force full re-parse on change for simplicity and correctness

        // Re-parse the affected lines and update the nodes array
        const newNodes: DocumentNode[] = [];
        this._inCodeBlock = false; // Reset code block state for re-parsing

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const node = this.parseLine(line, i);

            // Update code block state
            if (node.trimmedText.startsWith('```')) {
                this._inCodeBlock = !this._inCodeBlock;
            }
            node.isCodeBlockDelimiter = node.trimmedText.startsWith('```');

            // For now, we're doing a full re-parse, so all nodes are "new"
            newNodes.push(node);
            affectedLineNumbers.add(i);
        }

        // In a true incremental parse, you would merge newNodes into updatedNodes
        // based on the affected range. For this refactor, we're simplifying by
        // effectively doing a full re-parse on every change for correctness,
        // and will optimize incremental parsing later if needed.
        return { updatedNodes: newNodes, affectedLineNumbers };
    }
}
