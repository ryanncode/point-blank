import * as vscode from 'vscode';

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
        context: vscode.FoldingContext, // eslint-disable-line @typescript-eslint/no-unused-vars
        token: vscode.CancellationToken // eslint-disable-line @typescript-eslint/no-unused-vars
    ): vscode.ProviderResult<vscode.FoldingRange[]> {
        const ranges: vscode.FoldingRange[] = [];
        // Stack to keep track of open folding blocks: { indent: indentation level, startLine: line number }
        const stack: { indent: number; startLine: number }[] = [];

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            if (line.isEmptyOrWhitespace) {
                continue;
            }

            const currentIndent = line.firstNonWhitespaceCharacterIndex;

            // Pop from stack: If the current line's indent is less than or equal to the
            // indent of the last item on the stack, it means we've finished a folding block.
            while (stack.length > 0 && currentIndent <= stack[stack.length - 1].indent) {
                const top = stack.pop();
                if (top && i > top.startLine) { // Ensure a valid range (start line is before current line)
                    ranges.push(new vscode.FoldingRange(top.startLine, i - 1));
                }
            }

            // Push to stack: If the next line is more indented, it indicates the start of a new folding range.
            if (i + 1 < document.lineCount) {
                const nextLine = document.lineAt(i + 1);
                if (!nextLine.isEmptyOrWhitespace && nextLine.firstNonWhitespaceCharacterIndex > currentIndent) {
                    stack.push({ indent: currentIndent, startLine: i });
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