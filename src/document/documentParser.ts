import * as vscode from 'vscode';
import { DocumentNode, KeyValueProperty } from './documentNode';
import { isExcludedLine } from '../decorations/lineFilters';

export class DocumentParser {
    public parse(document: vscode.TextDocument): DocumentNode[] {
        const nodes: DocumentNode[] = [];
        let currentParentLineNumber: number | undefined = undefined;
        let inCodeBlock = false;

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text;
            const trimmedText = text.trim();
            const firstCharIndex = line.firstNonWhitespaceCharacterIndex;
            const lineTextFromNonWhitespace = text.substring(firstCharIndex);

            let isKeyValue = false;
            let keyValue: KeyValueProperty | undefined;
            let isCodeBlockDelimiter = false;
            let isLineExcluded = false;

            // Check for code block delimiters
            if (trimmedText.startsWith('```')) {
                inCodeBlock = !inCodeBlock;
                isCodeBlockDelimiter = true;
            }

            // Check for excluded lines (Markdown headers, horizontal rules)
            if (!isCodeBlockDelimiter && isExcludedLine(line)) {
                isLineExcluded = true;
            }

            // Check for Key:: Value pattern
            const keyValueMatch = lineTextFromNonWhitespace.match(/^(\S+::)\s*(.*)/);
            if (keyValueMatch) {
                isKeyValue = true;
                const keyPart = keyValueMatch[1];
                const valuePart = keyValueMatch[2];
                const keyRange = new vscode.Range(i, firstCharIndex, i, firstCharIndex + keyPart.length);
                const fullRange = new vscode.Range(i, 0, i, text.length);
                keyValue = {
                    key: keyPart.slice(0, -2), // Remove "::"
                    value: valuePart,
                    range: fullRange,
                    keyRange: keyRange
                };
            }

            // Determine parent for key-value lines
            let parentLineNum: number | undefined = undefined;
            if (isKeyValue) {
                parentLineNum = currentParentLineNumber;
            } else if (!line.isEmptyOrWhitespace && !isCodeBlockDelimiter && !isLineExcluded) {
                // This line is a potential parent node
                currentParentLineNumber = i;
            }

            const node: DocumentNode = {
                line: line,
                lineNumber: i,
                text: text,
                trimmedText: trimmedText,
                indent: firstCharIndex,
                isKeyValue: isKeyValue,
                keyValue: keyValue,
                parentLineNumber: parentLineNum,
                isCodeBlockDelimiter: isCodeBlockDelimiter,
                isExcluded: isLineExcluded
            };
            nodes.push(node);
        }
        return nodes;
    }
}