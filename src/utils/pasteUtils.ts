// Additional pure functions for single-line and typed-node paste

export interface SingleLinePasteContext {
    clipboardLine: string;
    selectionStart: number;
    selectionEnd: number;
    currentLineText: string;
}

export function processSingleLinePaste(ctx: SingleLinePasteContext): string {
    // Replace the selected range in currentLineText with clipboardLine
    return (
        ctx.currentLineText.substring(0, ctx.selectionStart) +
        ctx.clipboardLine +
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
    bulletTypeForLine: (line: string, indent: number) => { bulletType: string, bulletRange?: { start: number, end: number } };
    getBullet: (line: string, indent: number) => string;
}

/**
 * Processes clipboard lines for multi-line paste, adding bullets and preserving all lines.
 * Returns the new lines to insert.
 */
export function processClipboardLinesPure(ctx: PasteContext): string[] {
    const { clipboardLines, partBeforeCursor, partAfterCursor, currentLineText, bulletTypeForLine, getBullet } = ctx;
    const isSingleLine = clipboardLines.length === 1;
    const isEmptyLine = currentLineText === '';
    // Special case: multi-line paste onto an empty line
    if (!isSingleLine && isEmptyLine) {
        return clipboardLines.map(line => {
            // Add bullet if line is not empty or is whitespace only
            if (line.trim() !== '' || /^\s+$/.test(line)) {
                const originalLineIndent = line.match(/^\s*/)?.[0].length || 0;
                const { bulletType, bulletRange } = bulletTypeForLine(line, originalLineIndent);
                const contentAfterBullet = bulletType !== 'none'
                    ? line.substring(bulletRange!.end).trimStart()
                    : line.trim();
                let bullet;
                if (bulletType !== 'none') {
                    bullet = line.substring(bulletRange!.start, bulletRange!.end);
                } else {
                    bullet = getBullet(line, originalLineIndent);
                }
                // For whitespace-only lines, preserve indent and add bullet, but no content
                if (line.trim() === '') {
                    return ' '.repeat(originalLineIndent) + bullet;
                } else {
                    return ' '.repeat(originalLineIndent) + bullet + contentAfterBullet;
                }
            }
            return line;
        });
    }

    let newLines: string[] = [];
    const isCursorAtStart = partBeforeCursor === '' && partAfterCursor !== '';
    const isCursorAtEnd = partBeforeCursor !== '' && partAfterCursor === '';
    const isCursorInMiddle = partBeforeCursor !== '' && partAfterCursor !== '';

    for (let i = 0; i < clipboardLines.length; i++) {
        let line = clipboardLines[i];
        // First line: join with partBeforeCursor
        if (i === 0) {
            line = partBeforeCursor + line;
        }
        // Single-line paste: always join with partAfterCursor
        if (isSingleLine && i === 0) {
            line = line + partAfterCursor;
        }
        // Multi-line paste:
        if (!isSingleLine) {
            // (2) Pasting at start or in middle: partAfterCursor is appended to last pasted line
            // (3) Pasting at end: nothing is appended
            if (i === clipboardLines.length - 1) {
                if ((isCursorInMiddle || isCursorAtStart) && !isEmptyLine) {
                    line = line + partAfterCursor;
                }
            }
        }
        // Add bullet if line is not empty or is whitespace only
        let bulletLine = line;
        if (line.trim() !== '' || /^\s+$/.test(line)) {
            const originalLineIndent = line.match(/^\s*/)?.[0].length || 0;
            const { bulletType, bulletRange } = bulletTypeForLine(line, originalLineIndent);
            const contentAfterBullet = bulletType !== 'none'
                ? line.substring(bulletRange!.end).trimStart()
                : line.trim();
            let bullet;
            if (bulletType !== 'none') {
                bullet = line.substring(bulletRange!.start, bulletRange!.end);
            } else {
                bullet = getBullet(line, originalLineIndent);
            }
            // For whitespace-only lines, preserve indent and add bullet, but no content
            if (line.trim() === '') {
                bulletLine = ' '.repeat(originalLineIndent) + bullet;
            } else {
                bulletLine = ' '.repeat(originalLineIndent) + bullet + contentAfterBullet;
            }
        }
        newLines.push(bulletLine);
    }
    return newLines;
}
