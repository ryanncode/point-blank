import * as vscode from 'vscode';

export interface TypedBlock {
    type: string;
    uri: vscode.Uri;
    startLine: number;
    properties: Map<string, string>; // All key-value pairs in the block
}