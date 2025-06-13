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
    public readonly bulletType: 'star' | 'plus' | 'minus' | 'numbered' | 'blockquote' | 'default' | 'none' | 'atSign';
    public readonly bulletRange?: vscode.Range;

    // Hierarchical properties
    public readonly parent?: BlockNode;
    public readonly children: readonly BlockNode[];

    constructor(
        line: vscode.TextLine,
        lineNumber: number,
        isExcluded: boolean, // Determined by parser based on code blocks, etc.
        parent?: BlockNode,
        children: BlockNode[] = [],
        bulletType: 'star' | 'plus' | 'minus' | 'numbered' | 'blockquote' | 'default' | 'none' | 'atSign' = 'none',
        bulletRange?: vscode.Range
    ) {
        this.line = line;
        this.lineNumber = lineNumber;
        this.text = line.text;
        this.trimmedText = line.text.trim();
        this.indent = line.firstNonWhitespaceCharacterIndex;
        this.isExcluded = isExcluded;
        this.parent = parent;
        this.children = children;

        const parsedProps = this.parseLineContent(this.trimmedText);
        this.isKeyValue = parsedProps.isKeyValue;
        this.keyValue = parsedProps.keyValue;
        this.isTypedNode = parsedProps.isTypedNode;
        this.type = parsedProps.type;
        this.typedNodeRange = parsedProps.typedNodeRange;
        this.isCodeBlockDelimiter = parsedProps.isCodeBlockDelimiter;

        // If bulletType and bulletRange are not explicitly provided, determine them
        if (bulletType === 'none' || bulletRange === undefined) {
            const determinedBullet = this.determineBulletType(this.text, this.indent, this.isCodeBlockDelimiter, this.isExcluded, this.lineNumber);
            this.bulletType = determinedBullet.bulletType;
            this.bulletRange = determinedBullet.bulletRange;
        } else {
            this.bulletType = bulletType;
            this.bulletRange = bulletRange;
        }
    }

    /**
     * Parses the content of the line to determine its properties.
     * This method is internal and should only be called during construction.
     */
    private parseLineContent(trimmedText: string): {
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
        if (trimmedText.startsWith('```')) {
            isCodeBlockDelimiter = true;
        }

        // Check for Key:: Value pattern
        const keyValueMatch = trimmedText.match(/^(-\s*)?(\S+::)\s*(.*)/);
        if (keyValueMatch) {
            isKeyValue = true;
            const leadingDash = keyValueMatch[1] || ''; // Capture group 1: optional "- "
            const keyPart = keyValueMatch[2]; // Capture group 2: "Key::"
            const valuePart = keyValueMatch[3]; // Capture group 3: "Value"
            const keyStartCharacter = this.indent + leadingDash.length;
            const keyRange = new vscode.Range(this.lineNumber, keyStartCharacter, this.lineNumber, keyStartCharacter + keyPart.length);
            const fullRange = new vscode.Range(this.lineNumber, 0, this.lineNumber, this.text.length);
            keyValue = {
                key: keyPart.slice(0, -2), // Remove "::"
                value: valuePart,
                range: fullRange,
                keyRange: keyRange
            };
        }

        // Check for Typed Node pattern: - (TypeName)
        const typedNodeMatch = trimmedText.match(/^\s*\((.+)\)/);
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
     * Determines the bullet type and its range based on the line content.
     * @param lineText The full text of the line.
     * @param indent The first non-whitespace character index of the line.
     * @param isCodeBlockDelimiter True if the line is a code block delimiter.
     * @param isExcluded True if the line is excluded from normal parsing (e.g., markdown header).
     * @param lineNumber The line number.
     * @returns An object containing the bulletType and its vscode.Range, or 'none' and undefined range.
     */
    private determineBulletType(
        lineText: string,
        indent: number,
        isCodeBlockDelimiter: boolean,
        isExcluded: boolean,
        lineNumber: number
    ): { bulletType: 'star' | 'plus' | 'minus' | 'numbered' | 'blockquote' | 'default' | 'none' | 'atSign'; bulletRange?: vscode.Range } {
        if (isCodeBlockDelimiter || isExcluded) {
            return { bulletType: 'none' };
        }

        const textAfterIndent = lineText.substring(indent);

        // Regex for common bullet types and their ranges
        const bulletPatterns = [
            { type: 'atSign', regex: /^(@)/, bulletChar: '@' }, // New: Matches '@' at the start
            { type: 'star', regex: /^(\*\s)/, bulletChar: '*' },
            { type: 'plus', regex: /^(\+\s)/, bulletChar: '+' },
            { type: 'minus', regex: /^(-\s)/, bulletChar: '-' }, // Ensure space is captured
            { type: 'default', regex: /^(\u2022\s)/, bulletChar: '•' }, // Ensure space is captured
            { type: 'numbered', regex: /^(\d+[\.\)]\s)/, bulletChar: '1.' }, // Example bulletChar
            { type: 'blockquote', regex: /^(>\s)/, bulletChar: '>' }
        ];

        for (const pattern of bulletPatterns) {
            const match = textAfterIndent.match(pattern.regex);
            if (match) {
                const bulletStart = indent;
                const bulletEnd = indent + match[1].length;
                const bulletRange = new vscode.Range(lineNumber, bulletStart, lineNumber, bulletEnd);
                return { bulletType: pattern.type as any, bulletRange };
            }
        }

        return { bulletType: 'none' };
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
            newChildren,
            this.bulletType as 'star' | 'plus' | 'minus' | 'numbered' | 'blockquote' | 'default' | 'none' | 'atSign',
            this.bulletRange
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
            Array.from(this.children), // Ensure children array is copied
            this.bulletType as 'star' | 'plus' | 'minus' | 'numbered' | 'blockquote' | 'default' | 'none' | 'atSign',
            this.bulletRange
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
               this.isExcluded !== otherNode.isExcluded ||
               this.bulletType !== otherNode.bulletType ||
               // Compare bulletRange:
               (this.bulletRange === undefined && otherNode.bulletRange !== undefined) ||
               (this.bulletRange !== undefined && otherNode.bulletRange === undefined) ||
               (this.bulletRange !== undefined && otherNode.bulletRange !== undefined && !this.bulletRange.isEqual(otherNode.bulletRange));
    }
}