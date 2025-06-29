import { getBulletStyleFromAdjacentLines } from './bulletStyleUtils';
// Additional pure functions for single-line and typed-node paste

export interface SingleLinePasteContext {
    clipboardLine: string;
    selectionStart: number;
    selectionEnd: number;
    currentLineText: string;
    bullet?: string; // The bullet style to use, if provided
}

export function processSingleLinePaste(ctx: SingleLinePasteContext): string {
    // Use the provided bullet style, or match the bullet of the current line or adjacent lines if not provided
    let bullet = ctx.bullet ?? '• ';
    const bulletMatch = ctx.currentLineText.match(/^(\s*)([\u2022\-\*\•\+])\s/);
    // If no explicit bullet, try to match from current line, else from adjacent lines (using getBulletStyleFromAdjacentLines)
    if (ctx.bullet === undefined) {
        if (bulletMatch) {
            bullet = bulletMatch[2] + ' ';
        } else if (typeof (ctx as any).document === 'object' && typeof (ctx as any).lineNumber === 'number') {
            // Determine the indent the pasted line will have after insertion
            // If pasting into a blank/whitespace line, use the current line's indent (visual position of cursor)
            // Otherwise, use the indent of the clipboard line
            let targetIndent = 0;
            const currentLineIndent = ctx.currentLineText.match(/^\s*/)?.[0].length ?? 0;
            const clipboardIndent = ctx.clipboardLine.match(/^\s*/)?.[0].length ?? 0;
            if (/^\s*$/.test(ctx.currentLineText)) {
                targetIndent = currentLineIndent;
            } else {
                targetIndent = clipboardIndent;
            }
            bullet = getBulletStyleFromAdjacentLines((ctx as any).document, (ctx as any).lineNumber, targetIndent, '• ');
        }
    }
    let lineToPaste = ctx.clipboardLine;
    // Only add a bullet if pasting at the start of the line or replacing the whole line/selection
    const isAtLineStart = ctx.selectionStart === 0 && ctx.selectionEnd === 0;
    const isWholeLineSelected = ctx.selectionStart === 0 && ctx.selectionEnd === ctx.currentLineText.length;
    if ((isAtLineStart || isWholeLineSelected) && !/^\s*([\u2022\-\*\•\+])\s/.test(lineToPaste)) {
        lineToPaste = bullet + lineToPaste;
    }
    // If current line starts with a bullet, and paste is at or just after the bullet+space, replace bullet+space with the pasted line (with bullet)
    if (bulletMatch && ctx.selectionStart <= bulletMatch[0].length && ctx.selectionEnd <= bulletMatch[0].length) {
        // Paste is at or just after the bullet and space
        // Insert after indent, then pasted line, then rest of line after bullet+space
        return (
            ctx.currentLineText.substring(0, bulletMatch[1].length) +
            lineToPaste +
            ctx.currentLineText.substring(bulletMatch[1].length + bulletMatch[0].length - bulletMatch[1].length)
        );
    }
    return (
        ctx.currentLineText.substring(0, ctx.selectionStart) +
        lineToPaste +
        ctx.currentLineText.substring(ctx.selectionEnd)
    );
}

export interface TypedNodePasteContext {
    clipboardLines: string[];
}

export function processTypedNodePaste(ctx: TypedNodePasteContext): string[] {
    const { clipboardLines } = ctx;
    if (clipboardLines.length === 0) { return []; }
    const adjustedClipboardLines: string[] = [];
    const firstClipboardLine = clipboardLines[0];
    const originalFirstLineIndent = firstClipboardLine.match(/^\s*/)?.[0].length || 0;
    adjustedClipboardLines.push(firstClipboardLine.trimStart());
    for (let i = 1; i < clipboardLines.length; i++) {
        const line = clipboardLines[i];
        const originalLineIndent = line.match(/^\s*/)?.[0].length || 0;
        const contentWithoutOriginalIndent = line.substring(originalLineIndent);
        adjustedClipboardLines.push(' '.repeat(originalLineIndent) + contentWithoutOriginalIndent);
    }
    return adjustedClipboardLines;
}
// pasteUtils.ts
// Pure functions for processing clipboard lines for bullet pasting logic

export interface PasteContext {
    clipboardLines: string[];
    partBeforeCursor: string;
    partAfterCursor: string;
    currentLineText: string;
    currentLineIndent: number;
    bulletTypeForLine: (line: string, indent: number) => { bulletType: string; bulletRange?: { start: number; end: number } };
    getBullet: (line: string, indent: number) => string;
    document: any;
    lineNumber: number;
    findSiblingBulletByIndent?: (document: any, lineNumber: number, indent: number, defaultBullet: string) => string;
}

/**
 * Processes clipboard lines for multi-line paste, adding bullets and preserving all lines.
 * Returns the new lines to insert.
 */
export function processClipboardLinesPure(ctx: PasteContext): string[] {
    const { clipboardLines, partBeforeCursor, partAfterCursor, currentLineIndent, document, lineNumber } = ctx;
    let newLines: string[] = [];
    for (let i = 0; i < clipboardLines.length; i++) {
        let line = clipboardLines[i];
        // Detect and preserve pasted indent
        const match = line.match(/^(\s*)/);
        const pastedIndent = match ? match[1] : '';
        let content = line.slice(pastedIndent.length);
        // Determine indent level for this line
        const thisIndent = pastedIndent.length;
        // For each line, match bullet style from adjacent lines at that indent
        let bullet = '• ';
        if (document && typeof lineNumber === 'number') {
            bullet = getBulletStyleFromAdjacentLines(document, lineNumber, thisIndent, '• ');
        }
        let finalLine;
        if (i === 0) {
            // If cursor is at start, use pastedIndent or cursor indent. If not, just use partBeforeCursor.
            const isAtLineStart = partBeforeCursor.length === 0;
            const isWholeLineSelected = partBeforeCursor.length === 0 && partAfterCursor.length === 0 && ctx.currentLineText.length > 0;
            if (isAtLineStart || isWholeLineSelected) {
                const totalIndent = pastedIndent.length > 0 ? pastedIndent : ' '.repeat(currentLineIndent);
                // Only add bullet if not already present and not empty/whitespace
                if (!/^\s*([\u2022\-\*\•\+])\s/.test(content) && content.trim() !== '') {
                    content = bullet + content;
                }
                finalLine = totalIndent + content + partAfterCursor;
            } else {
                // Pasting into the middle/end of a line: do not add bullet
                finalLine = partBeforeCursor + content + partAfterCursor;
            }
        } else {
            // Subsequent lines: just pasted indent
            // Only add bullet if line is not empty and doesn't already have one
            if (!/^\s*([\u2022\-\*\•\+])\s/.test(content) && content.trim() !== '') {
                content = bullet + content;
            }
            finalLine = pastedIndent + content;
        }
        newLines.push(finalLine);
    }
    return newLines;
}
