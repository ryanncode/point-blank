import * as vscode from 'vscode';
import { DocumentNode, KeyValueProperty } from './documentNode';
import { isExcludedLine } from '../decorations/lineFilters';

export class DocumentParser {
    private _cachedNodes: DocumentNode[] = [];
    private _inCodeBlock: boolean = false; // Track code block state across incremental updates

    public parse(document: vscode.TextDocument, event?: vscode.TextDocumentChangeEvent): DocumentNode[] {
        if (!event || this._cachedNodes.length === 0) {
            // Full parse if no event or cache is empty
            return this.fullParse(document);
        }

        // Incremental parse
        let nodes = [...this._cachedNodes]; // Start with a copy of current nodes
        let currentParentLineNumber: number | undefined = undefined;
        this._inCodeBlock = false; // Reset for full re-evaluation of code blocks

        // Re-evaluate parent line numbers and code block state from the beginning
        // This is a simplification; a true incremental parse would be more complex
        // and track parentage more robustly. For now, re-parsing affected sections.
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const trimmedText = line.text.trim();
            if (trimmedText.startsWith('```')) {
                this._inCodeBlock = !this._inCodeBlock;
            }
            if (!line.isEmptyOrWhitespace && !this._inCodeBlock && !isExcludedLine(line)) {
                currentParentLineNumber = i;
            }
            // Update parentLineNumber for existing nodes if needed
            if (nodes[i]) {
                nodes[i].parentLineNumber = currentParentLineNumber;
            }
        }

        for (const change of event.contentChanges) {
            const startLine = change.range.start.line;
            const endLine = change.range.end.line;
            const linesDeleted = endLine - startLine + 1;
            const newLinesCount = change.text.split('\n').length;

            // Remove affected lines
            nodes.splice(startLine, linesDeleted);

            // Parse and insert new lines
            const newNodes: DocumentNode[] = [];
            for (let i = 0; i < newLinesCount; i++) {
                const lineIndex = startLine + i;
                const line = document.lineAt(lineIndex);
                newNodes.push(this.parseLine(line, lineIndex));
            }
            nodes.splice(startLine, 0, ...newNodes);
        }

        // Re-calculate parent line numbers and code block state for the entire document
        // after changes, as incremental updates can shift context.
        // This is a temporary measure for simplicity; a more robust solution
        // would involve a tree-like structure that can be patched.
        this._inCodeBlock = false;
        currentParentLineNumber = undefined;
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const line = document.lineAt(i); // Get the actual line from the document
            const trimmedText = line.text.trim();

            node.lineNumber = i; // Ensure line numbers are correct after splice/insert
            node.line = line;
            node.text = line.text;
            node.trimmedText = trimmedText;
            node.indent = line.firstNonWhitespaceCharacterIndex;

            if (trimmedText.startsWith('```')) {
                this._inCodeBlock = !this._inCodeBlock;
                node.isCodeBlockDelimiter = true;
            } else {
                node.isCodeBlockDelimiter = false;
            }

            node.isExcluded = isExcludedLine(line);

            // Re-evaluate Key:: Value pattern
            const lineTextFromNonWhitespace = line.text.substring(node.indent);
            const keyValueMatch = lineTextFromNonWhitespace.match(/^(\S+::)\s*(.*)/);
            if (keyValueMatch) {
                node.isKeyValue = true;
                const keyPart = keyValueMatch[1];
                const valuePart = keyValueMatch[2];
                const keyRange = new vscode.Range(i, node.indent, i, node.indent + keyPart.length);
                const fullRange = new vscode.Range(i, 0, i, line.text.length);
                node.keyValue = {
                    key: keyPart.slice(0, -2),
                    value: valuePart,
                    range: fullRange,
                    keyRange: keyRange
                };
            } else {
                node.isKeyValue = false;
                node.keyValue = undefined;
            }

            // Re-evaluate Typed Node pattern: - (TypeName)
            const typedNodeMatch = lineTextFromNonWhitespace.match(/^\s*\((.+)\)/);
            if (typedNodeMatch) {
                node.isTypedNode = true;
                node.type = typedNodeMatch[1];
                const startIndex = node.indent + typedNodeMatch[0].indexOf('(');
                const endIndex = startIndex + typedNodeMatch[0].length - typedNodeMatch[0].indexOf('(');
                node.typedNodeRange = new vscode.Range(i, startIndex, i, endIndex);
            } else {
                node.isTypedNode = false;
                node.type = undefined;
                node.typedNodeRange = undefined;
            }

            if (node.isKeyValue) {
                node.parentLineNumber = currentParentLineNumber;
            } else if (!line.isEmptyOrWhitespace && !node.isCodeBlockDelimiter && !node.isExcluded) {
                currentParentLineNumber = i;
            }
        }

        this._cachedNodes = nodes;
        return this._cachedNodes;
    }

    private fullParse(document: vscode.TextDocument): DocumentNode[] {
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
            node.isCodeBlockDelimiter = this._inCodeBlock; // This needs to be set based on the *current* state

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
}
