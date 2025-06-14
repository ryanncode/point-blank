import * as vscode from 'vscode';

/**
 * Defines the possible types of bullets that can be recognized.
 */
export type BulletType = 'star' | 'plus' | 'minus' | 'numbered' | 'blockquote' | 'default' | 'atSign' | 'none';

/**
 * Represents the result of a bullet type determination.
 */
export interface BulletInfo {
    bulletType: BulletType;
    bulletRange?: vscode.Range;
}

/**
 * A stateless utility function to determine the bullet type and its range from a line of text.
 * This logic is centralized here to be reusable and decoupled from `BlockNode`.
 *
 * @param lineText The full text of the line to analyze.
 * @param indent The starting character index of the content (after leading whitespace).
 * @param isCodeBlockDelimiter A flag indicating if the line is a code block delimiter (e.g., ```).
 * @param isExcluded A flag indicating if the line should be excluded from parsing (e.g., a markdown header).
 * @param lineNumber The zero-based line number in the document.
 * @returns A `BulletInfo` object containing the detected `bulletType` and its `vscode.Range`.
 *          Returns type 'none' if no bullet is detected or if the line is excluded.
 */
export function determineBulletType(
    lineText: string,
    indent: number,
    isCodeBlockDelimiter: boolean,
    isExcluded: boolean,
    lineNumber: number
): BulletInfo {
    if (isCodeBlockDelimiter || isExcluded) {
        return { bulletType: 'none' };
    }

    const textAfterIndent = lineText.substring(indent);

    // Defines the patterns for recognizing different bullet types.
    const bulletPatterns: { type: BulletType, regex: RegExp }[] = [
        { type: 'atSign',     regex: /^(@)\s+/ },
        { type: 'star',       regex: /^(\*)\s+/ },
        { type: 'plus',       regex: /^(\+)\s+/ },
        { type: 'minus',      regex: /^(-)\s+/ },
        { type: 'default',    regex: /^(\u2022)\s+/ }, // Unicode for •
        { type: 'numbered',   regex: /^(\d+[\.\)])\s+/ },
        { type: 'blockquote', regex: /^(>)\s+/ }
    ];

    for (const pattern of bulletPatterns) {
        const match = textAfterIndent.match(pattern.regex);
        if (match) {
            // The range covers the bullet character itself plus any trailing whitespace.
            const bulletStart = indent;
            const bulletEnd = indent + match[0].length;
            const bulletRange = new vscode.Range(lineNumber, bulletStart, lineNumber, bulletEnd);
            return { bulletType: pattern.type, bulletRange };
        }
    }

    return { bulletType: 'none' };
}