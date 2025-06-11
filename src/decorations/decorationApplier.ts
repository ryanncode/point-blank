import * as vscode from 'vscode';
import { ExtensionState } from '../state/extensionState';
import { isExcludedLine } from './lineFilters';

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
     */
    public updateDecorations(activeEditor: vscode.TextEditor | undefined): void {
        if (!activeEditor) {
            return;
        }

        const document = activeEditor.document;

        // Initialize arrays to hold decoration options for each type.
        const bulletDecorations: vscode.DecorationOptions[] = [];
        const starBulletDecorations: vscode.DecorationOptions[] = [];
        const plusBulletDecorations: vscode.DecorationOptions[] = [];
        const minusBulletDecorations: vscode.DecorationOptions[] = [];
        const numberedBulletDecorations: vscode.DecorationOptions[] = [];
        const blockquoteDecorations: vscode.DecorationOptions[] = [];
        const keyValueDecorations: vscode.DecorationOptions[] = [];

        let inCodeBlock = false; // State to track if we are inside a fenced code block (e.g., ```)

        // Iterate only over visible ranges to avoid applying decorations to folded lines.
        for (const visibleRange of activeEditor.visibleRanges) {
            for (let i = visibleRange.start.line; i <= visibleRange.end.line; i++) {
                const line = document.lineAt(i);
                const text = line.text.trim();

                // Toggle `inCodeBlock` state for fenced code block delimiters (e.g., ```).
                if (text.startsWith('```')) {
                    inCodeBlock = !inCodeBlock;
                    continue; // Exclude the delimiter line itself from bullet decoration.
                }

                // Exclude lines that are inside a fenced code block.
                if (inCodeBlock) {
                    continue;
                }

                // Exclude empty or whitespace-only lines.
                if (line.isEmptyOrWhitespace) {
                    continue;
                }

                // Exclude other types of lines (e.g., Markdown headers, horizontal rules)
                // using the helper function.
                if (isExcludedLine(line)) {
                    continue;
                }

                const firstCharIndex = line.firstNonWhitespaceCharacterIndex;
                const lineText = line.text.substring(firstCharIndex); // Text from first non-whitespace char

                // Check for Key:: Value pattern
                const keyValueMatch = lineText.match(/^(\S+::)\s/);
                if (keyValueMatch) {
                    const keyPart = keyValueMatch[1];
                    const range = new vscode.Range(i, firstCharIndex, i, firstCharIndex + keyPart.length);
                    keyValueDecorations.push({ range });
                    continue; // Skip other bullet checks for key-value lines
                }

                const firstChar = line.text.charAt(firstCharIndex);

                // Check for blockquote prefix (>) and apply specific decoration.
                if (firstChar === '>' && line.text.charAt(firstCharIndex + 1) === ' ') {
                    const range = new vscode.Range(i, firstCharIndex, i, firstCharIndex + 1);
                    blockquoteDecorations.push({ range });
                    continue;
                }

                // Check for custom bullet points (*, +, -) and apply specific decoration.
                // These checks ensure that the character is followed by a space to distinguish
                // them from other uses of *, +, or -.
                if (firstChar === '*' && line.text.charAt(firstCharIndex + 1) === ' ') {
                    const range = new vscode.Range(i, firstCharIndex, i, firstCharIndex + 1);
                    starBulletDecorations.push({ range });
                    continue;
                }
                if (firstChar === '+' && line.text.charAt(firstCharIndex + 1) === ' ') {
                    const range = new vscode.Range(i, firstCharIndex, i, firstCharIndex + 1);
                    plusBulletDecorations.push({ range });
                    continue;
                }
                if (firstChar === '-' && line.text.charAt(firstCharIndex + 1) === ' ') {
                    const range = new vscode.Range(i, firstCharIndex, i, firstCharIndex + 1);
                    minusBulletDecorations.push({ range });
                    continue;
                }

                // Check for numbered lines (e.g., "1. ", "2) ", etc.) and apply specific decoration.
                const numberedMatch = text.match(/^(\d+[\.\)])\s*/);
                if (numberedMatch) {
                    const range = new vscode.Range(i, firstCharIndex, i, firstCharIndex + numberedMatch[1].length);
                    numberedBulletDecorations.push({ range });
                    continue;
                }

                // Apply the default bullet decoration to all other non-excluded lines.
                // The decoration is applied to a zero-width range at the first non-whitespace character,
                // allowing the `before` content (the bullet character) to be inserted.
                const range = new vscode.Range(i, firstCharIndex, i, firstCharIndex);
                bulletDecorations.push({ range });
            }
        }

        // Apply all collected decorations to the active editor.
        activeEditor.setDecorations(this._extensionState.getDecorationType('bulletDecorationType')!, bulletDecorations);
        activeEditor.setDecorations(this._extensionState.getDecorationType('starBulletDecorationType')!, starBulletDecorations);
        activeEditor.setDecorations(this._extensionState.getDecorationType('plusBulletDecorationType')!, plusBulletDecorations);
        activeEditor.setDecorations(this._extensionState.getDecorationType('minusBulletDecorationType')!, minusBulletDecorations);
        activeEditor.setDecorations(this._extensionState.getDecorationType('numberedBulletDecorationType')!, numberedBulletDecorations);
        activeEditor.setDecorations(this._extensionState.getDecorationType('blockquoteDecorationType')!, blockquoteDecorations);
        activeEditor.setDecorations(this._extensionState.getDecorationType('keyValueDecorationType')!, keyValueDecorations);
    }
}