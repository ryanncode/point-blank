import * as vscode from 'vscode';

/**
 * Determines the bullet type and its range based on the line content.
 * This function is extracted from BlockNode to be a stateless utility.
 * @param lineText The full text of the line.
 * @param indent The first non-whitespace character index of the line.
 * @param isCodeBlockDelimiter True if the line is a code block delimiter.
 * @param isExcluded True if the line is excluded from normal parsing (e.g., markdown header).
 * @param lineNumber The line number.
 * @returns An object containing the bulletType and its vscode.Range, or 'none' and undefined range.
 */
export function determineBulletType(
    lineText: string,
    indent: number,
    isCodeBlockDelimiter: boolean,
    isExcluded: boolean,
    lineNumber: number
): { bulletType: 'star' | 'plus' | 'minus' | 'numbered' | 'blockquote' | 'default' | 'none' | 'atSign'; bulletRange?: vscode.Range } {
    if (isCodeBlockDelimiter || isExcluded) {
        return { bulletType: 'none' };
    }

    const textAfterIndent = lineText.substring(indent);

    // Regex for common bullet types and their ranges
    const bulletPatterns = [
        { type: 'atSign', regex: /^(@)/, bulletChar: '@' },
        { type: 'star', regex: /^(\*\s)/, bulletChar: '*' },
        { type: 'plus', regex: /^(\+\s)/, bulletChar: '+' },
        { type: 'minus', regex: /^(-\s)/, bulletChar: '-' },
        { type: 'default', regex: /^(\u2022\s)/, bulletChar: '•' },
        { type: 'numbered', regex: /^(\d+[\.\)]\s)/, bulletChar: '1.' },
        { type: 'blockquote', regex: /^(>\s)/, bulletChar: '>' }
    ];

    for (const pattern of bulletPatterns) {
        const match = textAfterIndent.match(pattern.regex);
        if (match) {
            const bulletStart = indent;
            const bulletEnd = indent + match[1].length;
            const bulletRange = new vscode.Range(lineNumber, bulletStart, lineNumber, bulletEnd);
            return { bulletType: pattern.type as any, bulletRange };
        }
    }

    return { bulletType: 'none' };
}