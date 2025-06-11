import * as vscode from 'vscode';
import { ExtensionState } from '../state/extensionState';
import { isExcludedLine } from './lineFilters';
import { DocumentNode } from '../document/documentNode'; // New import

/**
 * Manages and applies text editor decorations for bullet points and other outline elements.
 * This class encapsulates the logic for analyzing document lines and applying appropriate
 * visual styles based on content and formatting.
 */
export class DecorationApplier {
    private _extensionState: ExtensionState;

    constructor() {
        this._extensionState = ExtensionState.getInstance();
    }

    /**
     * Updates the decorations in the active text editor.
     * This method iterates through each line of the document, determines the appropriate
     * decoration based on content (e.g., bullet type, headers, code blocks), and applies them.
     * @param activeEditor The currently active text editor.
     * @param parsedNodes An array of `DocumentNode` objects representing the parsed document.
     */
    public updateDecorations(activeEditor: vscode.TextEditor | undefined, parsedNodes: DocumentNode[]): void {
        if (!activeEditor) {
            return;
        }

        // Initialize arrays to hold decoration options for each type.
        const bulletDecorations: vscode.DecorationOptions[] = [];
        const starBulletDecorations: vscode.DecorationOptions[] = [];
        const plusBulletDecorations: vscode.DecorationOptions[] = [];
        const minusBulletDecorations: vscode.DecorationOptions[] = [];
        const numberedBulletDecorations: vscode.DecorationOptions[] = [];
        const blockquoteDecorations: vscode.DecorationOptions[] = [];
        const keyValueDecorations: vscode.DecorationOptions[] = [];
        const typedNodeDecorations: vscode.DecorationOptions[] = [];

        // Iterate through parsed nodes
        for (const node of parsedNodes) {
            // Only apply decorations to visible ranges
            const isLineVisible = activeEditor.visibleRanges.some(range =>
                range.start.line <= node.lineNumber && node.lineNumber <= range.end.line
            );

            if (!isLineVisible) {
                continue;
            }

            // Skip lines that are part of a code block, or are delimiters, or are excluded, or are empty
            if (node.isCodeBlockDelimiter || node.isExcluded || node.line.isEmptyOrWhitespace) {
                continue;
            }

            if (node.isTypedNode && node.typedNodeRange) {
                // Apply decoration only to the typed node part (e.g., "(Book)")
                typedNodeDecorations.push({ range: node.typedNodeRange });
                continue; // Skip other bullet checks for typed nodes
            }

            if (node.isKeyValue && node.keyValue) {
                keyValueDecorations.push({ range: node.keyValue.keyRange });
                continue; // Skip other bullet checks for key-value lines
            }

            const firstCharIndex = node.indent;
            const firstChar = node.text.charAt(firstCharIndex);

            // Check for blockquote prefix (>) and apply specific decoration.
            if (firstChar === '>' && node.text.charAt(firstCharIndex + 1) === ' ') {
                const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + 1);
                blockquoteDecorations.push({ range });
                continue;
            }

            // Check for custom bullet points (*, +, -) and apply specific decoration.
            if (firstChar === '*' && node.text.charAt(firstCharIndex + 1) === ' ') {
                const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + 1);
                starBulletDecorations.push({ range });
                continue;
            }
            if (firstChar === '+' && node.text.charAt(firstCharIndex + 1) === ' ') {
                const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + 1);
                plusBulletDecorations.push({ range });
                continue;
            }
            if (firstChar === '-' && node.text.charAt(firstCharIndex + 1) === ' ') {
                const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + 1);
                minusBulletDecorations.push({ range });
                continue;
            }

            // Check for numbered lines (e.g., "1. ", "2) ", etc.) and apply specific decoration.
            const numberedMatch = node.trimmedText.match(/^(\d+[\.\)])\s*/);
            if (numberedMatch) {
                const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + numberedMatch[1].length);
                numberedBulletDecorations.push({ range });
                continue;
            }

            // Apply the default bullet decoration to all other non-excluded lines.
            const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex);
            bulletDecorations.push({ range });
        }

        // Apply all collected decorations to the active editor.
        activeEditor.setDecorations(this._extensionState.getDecorationType('bulletDecorationType')!, bulletDecorations);
        activeEditor.setDecorations(this._extensionState.getDecorationType('starBulletDecorationType')!, starBulletDecorations);
        activeEditor.setDecorations(this._extensionState.getDecorationType('plusBulletDecorationType')!, plusBulletDecorations);
        activeEditor.setDecorations(this._extensionState.getDecorationType('minusBulletDecorationType')!, minusBulletDecorations);
        activeEditor.setDecorations(this._extensionState.getDecorationType('numberedBulletDecorationType')!, numberedBulletDecorations);
        activeEditor.setDecorations(this._extensionState.getDecorationType('blockquoteDecorationType')!, blockquoteDecorations);
        activeEditor.setDecorations(this._extensionState.getDecorationType('keyValueDecorationType')!, keyValueDecorations);
        activeEditor.setDecorations(this._extensionState.getDecorationType('typedNodeDecorationType')!, typedNodeDecorations);
    }
}