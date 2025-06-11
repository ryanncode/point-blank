import * as vscode from 'vscode';
import { isExcludedLine } from '../decorations/lineFilters';

export interface KeyValueProperty {
    key: string;
    value: string;
    range: vscode.Range; // Range of the entire key-value line
    keyRange: vscode.Range; // Range of just the "Key::" part
}

/**
 * Represents a single line in the document, encapsulating its parsed properties.
 * This class is responsible for parsing its own content.
 */
export class LineNode {
    public line: vscode.TextLine;
    public lineNumber: number;
    public text: string; // Full text of the line
    public trimmedText: string; // Trimmed text of the line
    public indent: number; // First non-whitespace character index
    public isKeyValue: boolean;
    public keyValue?: KeyValueProperty; // If this node is a key-value pair
    public parentLineNumber?: number; // Line number of the parent node (set by DocumentModel/Parser)
    public isTypedNode: boolean;
    public type?: string;
    public typedNodeRange?: vscode.Range; // Range of the typed node (e.g., "(Book)")
    public isTemplate?: boolean; // Placeholder for future features
    public templateName?: string; // Placeholder for future features
    public tags?: string[]; // Placeholder for future features
    public isCodeBlockDelimiter: boolean; // To handle code blocks
    public isExcluded: boolean; // To handle excluded lines

    constructor(line: vscode.TextLine, lineNumber: number, inCodeBlock: boolean = false) {
        this.line = line;
        this.lineNumber = lineNumber;
        this.text = line.text;
        this.trimmedText = line.text.trim();
        this.indent = line.firstNonWhitespaceCharacterIndex;

        const lineTextFromNonWhitespace = this.text.substring(this.indent);

        this.isKeyValue = false;
        this.keyValue = undefined;
        this.isTypedNode = false;
        this.type = undefined;
        this.typedNodeRange = undefined;
        this.isCodeBlockDelimiter = false;
        this.isExcluded = false;

        this.parseLineContent(lineTextFromNonWhitespace, inCodeBlock);
    }

    /**
     * Parses the content of the line to determine its properties.
     * @param lineTextFromNonWhitespace The text of the line starting from the first non-whitespace character.
     * @param inCodeBlock Whether the line is currently within a code block.
     */
    private parseLineContent(lineTextFromNonWhitespace: string, inCodeBlock: boolean): void {
        // Check for excluded lines (Markdown headers, horizontal rules)
        if (isExcludedLine(this.line) || inCodeBlock) {
            this.isExcluded = true;
        }

        // Check for code block delimiter
        if (this.trimmedText.startsWith('```')) {
            this.isCodeBlockDelimiter = true;
        }

        // Check for Key:: Value pattern
        const keyValueMatch = lineTextFromNonWhitespace.match(/^(\S+::)\s*(.*)/);
        if (keyValueMatch) {
            this.isKeyValue = true;
            const keyPart = keyValueMatch[1];
            const valuePart = keyValueMatch[2];
            const keyRange = new vscode.Range(this.lineNumber, this.indent, this.lineNumber, this.indent + keyPart.length);
            const fullRange = new vscode.Range(this.lineNumber, 0, this.lineNumber, this.text.length);
            this.keyValue = {
                key: keyPart.slice(0, -2), // Remove "::"
                value: valuePart,
                range: fullRange,
                keyRange: keyRange
            };
        }

        // Check for Typed Node pattern: - (TypeName)
        const typedNodeMatch = lineTextFromNonWhitespace.match(/^\s*\((.+)\)/);
        if (typedNodeMatch) {
            this.isTypedNode = true;
            this.type = typedNodeMatch[1];
            const startIndex = this.indent + typedNodeMatch[0].indexOf('(');
            const endIndex = startIndex + typedNodeMatch[0].length - typedNodeMatch[0].indexOf('(');
            this.typedNodeRange = new vscode.Range(this.lineNumber, startIndex, this.lineNumber, endIndex);
        }
    }

    /**
     * Compares two LineNodes to determine if their properties relevant to decoration have changed.
     * @param otherNode The other LineNode to compare against.
     * @returns True if the nodes are different in relevant properties, false otherwise.
     */
    public isDifferent(otherNode: LineNode): boolean {
        return this.text !== otherNode.text ||
               this.indent !== otherNode.indent ||
               this.isKeyValue !== otherNode.isKeyValue ||
               this.isTypedNode !== otherNode.isTypedNode ||
               this.isCodeBlockDelimiter !== otherNode.isCodeBlockDelimiter ||
               this.isExcluded !== otherNode.isExcluded ||
               this.parentLineNumber !== otherNode.parentLineNumber;
    }
}