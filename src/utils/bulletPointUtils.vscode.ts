import * as vscode from 'vscode';

export type BulletType = 'star' | 'plus' | 'minus' | 'numbered' | 'blockquote' | 'default' | 'none';

export interface BulletInfo {
    bulletType: BulletType;
    bulletRange?: vscode.Range;
}

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

    const bulletPatterns: { type: BulletType, regex: RegExp }[] = [
        { type: 'star',       regex: /^(\*)\s+/ },
        { type: 'plus',       regex: /^(\+)\s+/ },
        { type: 'minus',      regex: /^(-)\s+/ },
        { type: 'default',    regex: /^(\u2022)\s+/ },
        { type: 'numbered',   regex: /^(\d+[\.\)])\s+/ },
        { type: 'blockquote', regex: /^(>)\s+/ }
    ];

    for (const pattern of bulletPatterns) {
        const match = textAfterIndent.match(pattern.regex);
        if (match) {
            const bulletStart = indent;
            const bulletEnd = indent + match[0].length;
            const bulletRange = new vscode.Range(lineNumber, bulletStart, lineNumber, bulletEnd);
            return { bulletType: pattern.type, bulletRange };
        }
    }

    return { bulletType: 'none' };
}

export function getBulletFromLine(line: vscode.TextLine): string {
    const lineText = line.text;
    const indent = line.firstNonWhitespaceCharacterIndex;
    const lineNumber = line.lineNumber;

    const bulletInfo = determineBulletType(
        lineText,
        indent,
        false,
        false,
        lineNumber
    );

    switch (bulletInfo.bulletType) {
        case 'star':
            return '* ';
        case 'plus':
            return '+ ';
        case 'minus':
            return '- ';
        case 'numbered':
            const match = lineText.substring(indent).match(/^(\d+)/);
            if (match && match[1]) {
                const num = parseInt(match[1], 10);
                return `${num + 1}. `;
            }
            return '1. ';
        case 'blockquote':
            return '> ';
        case 'default':
        case 'none':
        default:
            return '• ';
    }
}
