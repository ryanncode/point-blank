import * as vscode from 'vscode';

/**
 * Checks if a line of text should be excluded from the standard parsing and decoration logic.
 * This is used to ignore lines that have special Markdown significance, such as headers,
 * horizontal rules, or other syntax that should not be treated as a regular text line.
 *
 * Note: Fenced code blocks (` ``` `) are handled by the `DocumentParser`'s state machine
 * and are not checked by this function.
 *
 * @param line The `vscode.TextLine` to check.
 * @returns `true` if the line should be excluded from standard processing, `false` otherwise.
 */
export function isExcludedLine(line: vscode.TextLine): boolean {
    const text = line.text;
    const trimmedText = text.trim();

    // Regex for ATX headers (e.g., #, ##) which can be preceded by up to 3 spaces.
    const atxHeaderRegex = /^[ ]{0,3}#+\s/;
    if (atxHeaderRegex.test(text)) {
        return true;
    }

    // Regex for Setext header underlines (e.g., ===, ---).
    const setextHeaderRegex = /^[=-]{3,}$/;
    if (setextHeaderRegex.test(trimmedText)) {
        return true;
    }

    // Regex for horizontal rules (e.g., ***, ---, ___), allowing for spaces between characters.
    const horizontalRuleRegex = /^(\* *){3,}$|^(- *){3,}$|^(_ *){3,}$/;
    if (horizontalRuleRegex.test(trimmedText)) {
        return true;
    }


    return false;
}