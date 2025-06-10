import * as vscode from 'vscode';
import {
    bulletDecorationType,
    starBulletDecorationType,
    plusBulletDecorationType,
    minusBulletDecorationType,
    numberedBulletDecorationType
} from '../constants';
import { isExcludedLine } from '../utils/lineFilters';

/**
 * Manages and applies text editor decorations for bullet points and other outline elements.
 * This class encapsulates the logic for analyzing document lines and applying appropriate
 * visual styles based on content and formatting.
 */
export class DecorationApplier {
    private activeEditor: vscode.TextEditor | undefined;

    /**
     * Creates an instance of DecorationApplier.
     * @param editor The active text editor to which decorations will be applied.
     */
    constructor(editor: vscode.TextEditor | undefined) {
        this.activeEditor = editor;
    }

    /**
     * Sets the active text editor for the decoration applier.
     * @param editor The new active text editor.
     */
    public setActiveEditor(editor: vscode.TextEditor | undefined): void {
        this.activeEditor = editor;
    }

    /**
     * Updates the decorations in the active text editor.
     * This method iterates through each line of the document, determines the appropriate
     * decoration based on content (e.g., bullet type, headers, code blocks), and applies them.
     */
    public updateDecorations(): void {
        if (!this.activeEditor) {
            return;
        }

        const document = this.activeEditor.document;

        // Initialize arrays to hold decoration options for each type.
        const bulletDecorations: vscode.DecorationOptions[] = [];
        const starBulletDecorations: vscode.DecorationOptions[] = [];
        const plusBulletDecorations: vscode.DecorationOptions[] = [];
        const minusBulletDecorations: vscode.DecorationOptions[] = [];
        const numberedBulletDecorations: vscode.DecorationOptions[] = [];

        let inCodeBlock = false; // State to track if we are inside a fenced code block (e.g., ```)

        for (let i = 0; i < document.lineCount; i++) {
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
            const firstChar = line.text.charAt(firstCharIndex);

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

        // Apply all collected decorations to the active editor.
        this.activeEditor.setDecorations(bulletDecorationType, bulletDecorations);
        this.activeEditor.setDecorations(starBulletDecorationType, starBulletDecorations);
        this.activeEditor.setDecorations(plusBulletDecorationType, plusBulletDecorations);
        this.activeEditor.setDecorations(minusBulletDecorationType, minusBulletDecorations);
        this.activeEditor.setDecorations(numberedBulletDecorationType, numberedBulletDecorations);
    }
}