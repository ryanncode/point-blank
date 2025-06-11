import * as vscode from 'vscode';

export interface KeyValueProperty {
    key: string;
    value: string;
    range: vscode.Range; // Range of the entire key-value line
    keyRange: vscode.Range; // Range of just the "Key::" part
}

/**
 * Represents a logical block in the document, encapsulating its parsed properties
 * and its hierarchical relationship with other blocks.
 */
export class BlockNode {
    public readonly line: vscode.TextLine;
    public readonly lineNumber: number;
    public readonly text: string; // Full text of the line
    public readonly trimmedText: string; // Trimmed text of the line
    public readonly indent: number; // First non-whitespace character index
    public readonly isKeyValue: boolean;
    public readonly keyValue?: KeyValueProperty; // If this node is a key-value pair
    public readonly isTypedNode: boolean;
    public readonly type?: string;
    public readonly typedNodeRange?: vscode.Range; // Range of the typed node (e.g., "(Book)")
    public readonly isCodeBlockDelimiter: boolean; // To handle code blocks
    public readonly isExcluded: boolean; // To handle excluded lines (e.g., Markdown headers)

    // Hierarchical properties
    public readonly parent?: BlockNode;
    public readonly children: readonly BlockNode[];

    constructor(
        line: vscode.TextLine,
        lineNumber: number,
        isExcluded: boolean, // Determined by parser based on code blocks, etc.
        parent?: BlockNode,
        children: BlockNode[] = []
    ) {
        this.line = line;
        this.lineNumber = lineNumber;
        this.text = line.text;
        this.trimmedText = line.text.trim();
        this.indent = line.firstNonWhitespaceCharacterIndex;
        this.isExcluded = isExcluded;
        this.parent = parent;
        this.children = children;

        const lineTextFromNonWhitespace = this.text.substring(this.indent);

        const parsedProps = this.parseLineContent(lineTextFromNonWhitespace);
        this.isKeyValue = parsedProps.isKeyValue;
        this.keyValue = parsedProps.keyValue;
        this.isTypedNode = parsedProps.isTypedNode;
        this.type = parsedProps.type;
        this.typedNodeRange = parsedProps.typedNodeRange;
        this.isCodeBlockDelimiter = parsedProps.isCodeBlockDelimiter;
    }

    /**
     * Parses the content of the line to determine its properties.
     * This method is internal and should only be called during construction.
     */
    private parseLineContent(lineTextFromNonWhitespace: string): {
        isKeyValue: boolean;
        keyValue?: KeyValueProperty;
        isTypedNode: boolean;
        type?: string;
        typedNodeRange?: vscode.Range;
        isCodeBlockDelimiter: boolean;
    } {
        let isKeyValue = false;
        let keyValue: KeyValueProperty | undefined = undefined;
        let isTypedNode = false;
        let type: string | undefined = undefined;
        let typedNodeRange: vscode.Range | undefined = undefined;
        let isCodeBlockDelimiter = false;

        // Check for code block delimiter
        if (this.trimmedText.startsWith('```')) {
            isCodeBlockDelimiter = true;
        }

        // Check for Key:: Value pattern
        const keyValueMatch = lineTextFromNonWhitespace.match(/^(\S+::)\s*(.*)/);
        if (keyValueMatch) {
            isKeyValue = true;
            const keyPart = keyValueMatch[1];
            const valuePart = keyValueMatch[2];
            const keyRange = new vscode.Range(this.lineNumber, this.indent, this.lineNumber, this.indent + keyPart.length);
            const fullRange = new vscode.Range(this.lineNumber, 0, this.lineNumber, this.text.length);
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
            const startIndex = this.indent + typedNodeMatch[0].indexOf('(');
            const endIndex = startIndex + typedNodeMatch[0].length - typedNodeMatch[0].indexOf('(');
            typedNodeRange = new vscode.Range(this.lineNumber, startIndex, this.lineNumber, endIndex);
        }

        return {
            isKeyValue,
            keyValue,
            isTypedNode,
            type,
            typedNodeRange,
            isCodeBlockDelimiter
        };
    }

    /**
     * Creates a new BlockNode with updated children.
     * This is useful for maintaining immutability when the tree structure changes.
     */
    public withChildren(newChildren: BlockNode[]): BlockNode {
        return new BlockNode(
            this.line,
            this.lineNumber,
            this.isExcluded,
            this.parent,
            newChildren
        );
    }

    /**
     * Creates a new BlockNode with an updated parent.
     */
    public withParent(newParent?: BlockNode): BlockNode {
        return new BlockNode(
            this.line,
            this.lineNumber,
            this.isExcluded,
            newParent,
            Array.from(this.children) // Ensure children array is copied
        );
    }

    /**
     * Compares two BlockNodes to determine if their properties relevant to decoration have changed.
     * This is a shallow comparison for the node's own properties, not its children.
     */
    public isContentDifferent(otherNode: BlockNode): boolean {
        return this.text !== otherNode.text ||
               this.indent !== otherNode.indent ||
               this.isKeyValue !== otherNode.isKeyValue ||
               this.isTypedNode !== otherNode.isTypedNode ||
               this.isCodeBlockDelimiter !== otherNode.isCodeBlockDelimiter ||
               this.isExcluded !== otherNode.isExcluded;
    }
}