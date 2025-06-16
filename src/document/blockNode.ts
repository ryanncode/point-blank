import * as vscode from 'vscode';
import { determineBulletType } from '../utils/bulletPointUtils';

export interface KeyValueProperty {
    key: string;
    value: string;
    range: vscode.Range; // Range of the entire key-value line
    keyRange: vscode.Range; // Range of just the "Key::" part
    valueRange?: vscode.Range; // Range of just the "Value" part (optional, as value might be empty)
}

/**
 * Represents a logical block or line in the document. It's an immutable object that
 * encapsulates the parsed properties of a single line, such as its indentation,
 * bullet type, and hierarchical relationship with other nodes.
 */
export class BlockNode {
    // Core properties
    public readonly line: vscode.TextLine;
    public readonly lineNumber: number;
    public readonly text: string;
    public readonly indent: number;

    // Parsed state properties
    public readonly isKeyValue: boolean;
    public readonly keyValue?: KeyValueProperty;
    public readonly isTypedNode: boolean;
    public readonly type?: string;
    public readonly typedNodeRange?: vscode.Range;
    public readonly isCodeBlockDelimiter: boolean;
    public readonly isExcluded: boolean;
    public readonly bulletType: 'star' | 'plus' | 'minus' | 'numbered' | 'blockquote' | 'default' | 'none' | 'atSign';
    public readonly bulletRange?: vscode.Range;

    // New header properties
    public readonly isHeader: boolean;
    public readonly headerLevel?: number;
    public readonly headerText?: string;

    // Hierarchy properties
    public readonly parent?: BlockNode;
    public readonly children: readonly BlockNode[];

    constructor(
        line: vscode.TextLine,
        lineNumber: number,
        isExcluded: boolean,
        parent?: BlockNode,
        children: BlockNode[] = []
    ) {
        this.line = line;
        this.lineNumber = lineNumber;
        this.text = line.text;
        this.indent = line.firstNonWhitespaceCharacterIndex;
        this.isExcluded = isExcluded;
        this.parent = parent;
        this.children = children;

        // Perform all parsing upon construction to ensure immutability.
        const { isKeyValue, keyValue, isTypedNode, type, typedNodeRange, isCodeBlockDelimiter, isHeader, headerLevel, headerText } = this.parseLineContent();
        this.isKeyValue = isKeyValue;
        this.keyValue = keyValue;
        this.isTypedNode = isTypedNode;
        this.type = type;
        this.typedNodeRange = typedNodeRange;
        this.isCodeBlockDelimiter = isCodeBlockDelimiter;
        this.isHeader = isHeader;
        this.headerLevel = headerLevel;
        this.headerText = headerText;

        const { bulletType, bulletRange } = determineBulletType(this.text, this.indent, this.isCodeBlockDelimiter, this.isExcluded, this.lineNumber);
        this.bulletType = bulletType;
        this.bulletRange = bulletRange;
    }

    /**
     * Parses the line's content to identify special structures like key-value pairs,
     * typed nodes, or code block delimiters.
     * @returns An object containing the parsed properties.
     */
    private parseLineContent() {
        const trimmedText = this.text.substring(this.indent);

        // Check for code block delimiter: ```
        if (trimmedText.startsWith('```')) {
            return { isCodeBlockDelimiter: true, isKeyValue: false, isTypedNode: false, isHeader: false, headerLevel: undefined, headerText: undefined };
        }

        // Check for markdown headers: #, ##, etc.
        const headerMatch = trimmedText.match(/^(#+)\s+(.*)/);
        if (headerMatch) {
            const level = headerMatch[1].length;
            const text = headerMatch[2].trim();
            return { isHeader: true, headerLevel: level, headerText: text, isCodeBlockDelimiter: false, isKeyValue: false, isTypedNode: false };
        }

        // Check for Key:: Value pattern.
        const keyValueMatch = trimmedText.match(/^(-\s*)?(\S+::) (.*)/);
        if (keyValueMatch) {
            const leadingDash = keyValueMatch[1] || '';
            const keyPart = keyValueMatch[2];
            const valuePart = keyValueMatch[3];
            const keyStartChar = this.indent + leadingDash.length;
            const keyRange = new vscode.Range(this.lineNumber, keyStartChar, this.lineNumber, keyStartChar + keyPart.length);
            const fullRange = new vscode.Range(this.lineNumber, 0, this.lineNumber, this.text.length);
            const keyValue: KeyValueProperty = {
                key: keyPart.slice(0, -2), // Remove "::"
                value: valuePart,
                range: fullRange,
                keyRange: keyRange,
                valueRange: valuePart ? new vscode.Range(this.lineNumber, keyStartChar + keyPart.length + 1, this.lineNumber, keyStartChar + keyPart.length + 1 + valuePart.length) : undefined
            };
            return { isKeyValue: true, keyValue, isTypedNode: false, isCodeBlockDelimiter: false, isHeader: false, headerLevel: undefined, headerText: undefined };
        }

        // Check for Typed Node pattern: (TypeName)
        const typedNodeMatch = trimmedText.match(/^\s*\((.+)\)/);
        if (typedNodeMatch) {
            const type = typedNodeMatch[1];
            const startIndex = this.text.indexOf(`(${type})`);
            const endIndex = startIndex + type.length + 2; // +2 for parentheses
            const typedNodeRange = new vscode.Range(this.lineNumber, startIndex, this.lineNumber, endIndex);
            return { isTypedNode: true, type, typedNodeRange, isKeyValue: false, isCodeBlockDelimiter: false, isHeader: false, headerLevel: undefined, headerText: undefined };
        }

        return { isKeyValue: false, isTypedNode: false, isCodeBlockDelimiter: false, isHeader: false, headerLevel: undefined, headerText: undefined };
    }

    /**
     * Recursively finds a BlockNode within the tree (or subtree) by its line number.
     * @param lineNumber The line number of the BlockNode to find.
     * @returns The BlockNode if found, otherwise undefined.
     */
    public findNodeAtLine(lineNumber: number): BlockNode | undefined {
        if (this.lineNumber === lineNumber) {
            return this;
        }
        for (const child of this.children) {
            const found = child.findNodeAtLine(lineNumber);
            if (found) {
                return found;
            }
        }
        return undefined;
    }

    /**
     * Creates a new `BlockNode` instance with updated children.
     * This method is essential for maintaining the immutability of the document tree.
     * @param newChildren The new array of child nodes.
     * @returns A new `BlockNode` instance.
     */
    public withChildren(newChildren: BlockNode[]): BlockNode {
        return new BlockNode(this.line, this.lineNumber, this.isExcluded, this.parent, newChildren);
    }

    /**
     * Creates a new `BlockNode` instance with an updated parent.
     * @param newParent The new parent node.
     * @returns A new `BlockNode` instance.
     */
    public withParent(newParent?: BlockNode): BlockNode {
        return new BlockNode(this.line, this.lineNumber, this.isExcluded, newParent, [...this.children]);
    }

    /**
     * Performs a shallow comparison to check if two `BlockNode`s have different content
     * relevant to decoration. This is used to optimize re-rendering.
     * @param otherNode The other `BlockNode` to compare against.
     * @returns `true` if the content is different, `false` otherwise.
     */
    public isContentDifferent(otherNode: BlockNode): boolean {
        if (this.text !== otherNode.text ||
            this.bulletType !== otherNode.bulletType ||
            this.isKeyValue !== otherNode.isKeyValue ||
            this.isTypedNode !== otherNode.isTypedNode ||
            this.isHeader !== otherNode.isHeader ||
            this.headerLevel !== otherNode.headerLevel ||
            this.headerText !== otherNode.headerText) {
            return true;
        }

        // Deep compare bulletRange only if necessary.
        const range1 = this.bulletRange;
        const range2 = otherNode.bulletRange;
        if ((range1 && !range2) || (!range1 && range2) || (range1 && range2 && !range1.isEqual(range2))) {
            return true;
        }

        return false;
    }
}