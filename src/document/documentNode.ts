import * as vscode from 'vscode';

export interface KeyValueProperty {
    key: string;
    value: string;
    range: vscode.Range; // Range of the entire key-value line
    keyRange: vscode.Range; // Range of just the "Key::" part
}

export interface DocumentNode {
    line: vscode.TextLine;
    lineNumber: number;
    text: string; // Full text of the line
    trimmedText: string; // Trimmed text of the line
    indent: number; // First non-whitespace character index
    isKeyValue: boolean;
    keyValue?: KeyValueProperty; // If this node is a key-value pair
    parentLineNumber?: number; // Line number of the parent node
    // Placeholders for future features
    isTypedNode?: boolean;
    type?: string;
    typedNodeRange?: vscode.Range; // New field for the range of the typed node (e.g., "(Book)")
    isTemplate?: boolean;
    templateName?: string;
    tags?: string[];
    isCodeBlockDelimiter?: boolean; // To handle code blocks in parser
    isExcluded?: boolean; // To handle excluded lines in parser
}