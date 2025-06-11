import * as vscode from 'vscode';
import { isExcludedLine } from '../decorations/lineFilters';

/**
 * Provides folding ranges for text documents based on indentation levels.
 * This allows users to collapse blocks of text that are indented, improving readability
 * and navigation in outline-like documents.
 */
export class IndentFoldingRangeProvider implements vscode.FoldingRangeProvider {
    /**
     * Provides an array of folding ranges for the given document.
     * Folding ranges are determined by changes in indentation.
     *
     * @param document The text document for which to provide folding ranges.
     * @param context Additional context for the folding request (currently unused).
     * @param token A cancellation token that indicates the request is cancelled.
     * @returns A promise that resolves to an array of `vscode.FoldingRange` objects,
     *          or `undefined` if no folding ranges are found.
     */
    public provideFoldingRanges(
        document: vscode.TextDocument,
        _context: vscode.FoldingContext, // eslint-disable-line @typescript-eslint/no-unused-vars
        _token: vscode.CancellationToken // eslint-disable-line @typescript-eslint/no-unused-vars
    ): vscode.ProviderResult<vscode.FoldingRange[]> {
        const ranges: vscode.FoldingRange[] = [];
        // Stack to keep track of open folding blocks: { indent: indentation level, startLine: line number }
        const stack: { indent: number; startLine: number }[] = [];

        // Helper to get effective indentation, considering markdown list items
        const getEffectiveIndent = (line: vscode.TextLine, document: vscode.TextDocument): number => {
            const actualIndent = line.firstNonWhitespaceCharacterIndex;
            // For markdown files, treat list items as having an increased effective indent
            if (document.languageId === 'markdown') {
                const text = line.text.trimStart();
                // Check for common list item markers: *, -, + followed by a space
                if (/^(\*|\-|\+)\s/.test(text)) {
                    // Artificially increase indent to make list items foldable
                    return actualIndent + 2;
                }
            }
            return actualIndent;
        };

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            if (line.isEmptyOrWhitespace || isExcludedLine(line)) { // Skip empty or excluded lines
                continue;
            }

            const currentEffectiveIndent = getEffectiveIndent(line, document);

            // Pop from stack: If the current line's effective indent is less than or equal to the
            // indent of the last item on the stack, it means we've finished a folding block.
            while (stack.length > 0 && currentEffectiveIndent <= stack[stack.length - 1].indent) {
                const top = stack.pop();
                if (top && i > top.startLine) { // Ensure a valid range (start line is before current line)
                    ranges.push(new vscode.FoldingRange(top.startLine, i - 1));
                }
            }

            // Push to stack: If the next line is more effectively indented, it indicates the start of a new folding range.
            if (i + 1 < document.lineCount) {
                const nextLine = document.lineAt(i + 1);
                if (!nextLine.isEmptyOrWhitespace) {
                    const nextEffectiveIndent = getEffectiveIndent(nextLine, document);
                    if (nextEffectiveIndent > currentEffectiveIndent) {
                        stack.push({ indent: currentEffectiveIndent, startLine: i });
                    }
                }
            }
        }

        // Close any remaining open folds at the end of the file.
        while (stack.length > 0) {
            const top = stack.pop();
            if (top) {
                ranges.push(new vscode.FoldingRange(top.startLine, document.lineCount - 1));
            }
        }

        return ranges;
    }
}