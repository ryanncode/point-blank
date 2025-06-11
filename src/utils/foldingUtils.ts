import * as vscode from 'vscode';
import { IndentFoldingRangeProvider } from '../foldingProvider';

/**
 * Provides utility functions related to folding ranges.
 */
export class FoldingUtils {
    /**
     * Retrieves all folding ranges for a given text document using the IndentFoldingRangeProvider.
     * @param document The text document.
     * @returns A promise that resolves to an array of FoldingRange objects.
     */
    public static async getAllFoldingRanges(document: vscode.TextDocument): Promise<vscode.FoldingRange[]> {
        // Use VS Code's built-in folding range provider to get all folding ranges
        const ranges = await vscode.commands.executeCommand(
            'vscode.executeFoldingRangeProvider',
            document.uri
        ) as vscode.FoldingRange[];
        return ranges || [];
    }

    /**
     * Finds the nearest folding block that contains or starts at the given line,
     * prioritizing the closest level of indentation.
     * @param document The text document.
     * @param line The line number to find the folding block for.
     * @param allRanges All folding ranges in the document.
     * @returns The most relevant FoldingRange, or undefined if none is found.
     */
    public static findNearestFoldingBlock(
        line: number,
        allRanges: vscode.FoldingRange[]
    ): vscode.FoldingRange | undefined {
        let bestMatch: vscode.FoldingRange | undefined;
        let bestRangeSize: number = Infinity; // To find the smallest containing range

        for (const range of allRanges) {
            // Check if the current line is within the range
            if (line >= range.start && line <= range.end) {
                const currentRangeSize = range.end - range.start;

                if (currentRangeSize < bestRangeSize) {
                    bestMatch = range;
                    bestRangeSize = currentRangeSize;
                } else if (currentRangeSize === bestRangeSize) {
                    // If sizes are equal, pick the one that starts later (more "nearest" geographically)
                    if (!bestMatch || range.start > bestMatch.start) {
                        bestMatch = range;
                    }
                }
            }
        }
        return bestMatch;
    }
}