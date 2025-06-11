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
        const affectedLineNumbers = new Set<number>();

        let changeStartLine = event.contentChanges.length > 0 ? event.contentChanges[0].range.start.line : 0;
        let changeEndLine = event.contentChanges.length > 0 ? event.contentChanges[0].range.end.line : document.lineCount - 1;
        const linesRemoved = event.contentChanges.length > 0 ? event.contentChanges[0].range.end.line - event.contentChanges[0].range.start.line : 0;
        const linesAdded = event.contentChanges.length > 0 ? event.contentChanges[0].text.split('\n').length - 1 : 0;
        const deltaLines = linesAdded - linesRemoved;

        // Determine the effective start and end lines for re-parsing
        // This is where the "Smart Structural Analysis" comes in.
        // For now, we'll still re-parse a larger section to ensure correctness,
        // but we'll refine this in later phases.

        // Start from the beginning of the document to correctly re-evaluate parentage and code blocks
        let reparseStartLine = 0;
        let reparseEndLine = document.lineCount - 1;

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

            // Determine parent for key-value lines and typed nodes
            // This logic needs to be applied during incremental parse as well
            let currentParentLineNumber: number | undefined = undefined;
            if (i > 0 && newNodes[i - 1]) {
                currentParentLineNumber = newNodes[i - 1].parentLineNumber; // Inherit from previous node
                if (!newNodes[i - 1].isKeyValue && !newNodes[i - 1].line.isEmptyOrWhitespace && !newNodes[i - 1].isCodeBlockDelimiter && !newNodes[i - 1].isExcluded) {
                    currentParentLineNumber = newNodes[i - 1].lineNumber;
                }
            }

            if (node.isKeyValue) {
                node.parentLineNumber = currentParentLineNumber;
            } else if (!line.isEmptyOrWhitespace && !node.isCodeBlockDelimiter && !node.isExcluded) {
                node.parentLineNumber = i; // This node is a new parent
            } else {
                node.parentLineNumber = currentParentLineNumber; // Inherit parent if not a new parent
            }

            newNodes.push(node);
            affectedLineNumbers.add(i);
        }

        // For Phase 2, we are still doing a full re-parse to ensure correctness of parentage.
        // The optimization will come in Phase 3.
        return { updatedNodes: newNodes, affectedLineNumbers };
    }
}
