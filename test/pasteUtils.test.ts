import '@jest/globals';

// Make sure Jest types are included in your tsconfig.json for 'expect' to work.
import { processClipboardLinesPure, processSingleLinePaste, processTypedNodePaste, PasteContext, SingleLinePasteContext, TypedNodePasteContext } from '../src/utils/pasteUtils';

describe('processClipboardLinesPure', () => {
    it('pastes multi-line on empty line (each line new, nothing joined)', () => {
        const ctx: PasteContext = {
            clipboardLines: ['foo', 'bar', 'baz'],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['• foo', '• bar', '• baz']);
    });

    it('pastes multi-line at start of line (partAfterCursor not appended)', () => {
        const ctx: PasteContext = {
            clipboardLines: ['foo', 'bar'],
            partBeforeCursor: '',
            partAfterCursor: 'AFTER',
            currentLineText: 'AFTER',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['• foo', '• barAFTER']);
    });

    it('pastes multi-line in middle of line (partAfterCursor appended to last line)', () => {
        const ctx: PasteContext = {
            clipboardLines: ['foo', 'bar'],
            partBeforeCursor: 'BEFORE',
            partAfterCursor: 'AFTER',
            currentLineText: 'BEFOREAFTER',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['• BEFOREfoo', '• barAFTER']);
    });

    it('pastes multi-line at end of line (first line appended, rest new lines)', () => {
        const ctx: PasteContext = {
            clipboardLines: ['foo', 'bar'],
            partBeforeCursor: 'BEFORE',
            partAfterCursor: '',
            currentLineText: 'BEFORE',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['• BEFOREfoo', '• bar']);
    });

    it('pastes single line at start of line', () => {
        const ctx: PasteContext = {
            clipboardLines: ['foo'],
            partBeforeCursor: '',
            partAfterCursor: 'AFTER',
            currentLineText: 'AFTER',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['• fooAFTER']);
    });

    it('pastes single line in middle of line', () => {
        const ctx: PasteContext = {
            clipboardLines: ['foo'],
            partBeforeCursor: 'BEFORE',
            partAfterCursor: 'AFTER',
            currentLineText: 'BEFOREAFTER',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['• BEFOREfooAFTER']);
    });

    it('pastes single line at end of line', () => {
        const ctx: PasteContext = {
            clipboardLines: ['foo'],
            partBeforeCursor: 'BEFORE',
            partAfterCursor: '',
            currentLineText: 'BEFORE',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['• BEFOREfoo']);
    });
    it('pastes multi-line at start of line (partAfterCursor at end of last line)', () => {
        const ctx: PasteContext = {
            clipboardLines: ['foo', 'bar'],
            partBeforeCursor: '',
            partAfterCursor: 'AFTER',
            currentLineText: 'AFTER',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet
        };
        const result = processClipboardLinesPure(ctx);
        // Each line is new, but partAfterCursor is appended to the last pasted line
        expect(result).toEqual(['• foo', '• barAFTER']);
    });
    it('pastes multi-line in middle of line (partAfterCursor appended to last line)', () => {
        const ctx: PasteContext = {
            clipboardLines: ['foo', 'bar'],
            partBeforeCursor: 'BEFORE',
            partAfterCursor: 'AFTER',
            currentLineText: 'BEFOREAFTER',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet
        };
        const result = processClipboardLinesPure(ctx);
        // partAfterCursor is appended to last pasted line
        expect(result).toEqual(['• BEFOREfoo', '• barAFTER']);
    });
    it('pastes multi-line at end of line (first line appended, rest new lines)', () => {
        const ctx: PasteContext = {
            clipboardLines: ['foo', 'bar'],
            partBeforeCursor: 'BEFORE',
            partAfterCursor: '',
            currentLineText: 'BEFORE',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet
        };
        const result = processClipboardLinesPure(ctx);
        // first line is appended to end, rest are new lines
        expect(result).toEqual(['• BEFOREfoo', '• bar']);
    });
    it('adds bullets when pasting multi-line block onto selected text', () => {
        // Simulate replacing a selected line (currentLineText non-empty, selection replaced)
        const ctx: PasteContext = {
            clipboardLines: ['foo', 'bar', 'baz'],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: 'selected line',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet
        };
        const result = processClipboardLinesPure(ctx);
        // All pasted lines should get bullets
        expect(result).toEqual(['• foo', '• bar', '• baz']);
    });
    it('handles single line with before/after cursor', () => {
        const ctx: PasteContext = {
            clipboardLines: ['foo'],
            partBeforeCursor: 'A',
            partAfterCursor: 'B',
            currentLineText: 'AB',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['• AfooB']);
    });

    it('handles multi-line with leading and trailing empty lines', () => {
        const ctx: PasteContext = {
            clipboardLines: ['', 'foo', '', 'bar', ''],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['', '• foo', '', '• bar', '']);
    });

    it('handles multi-line with only one non-empty line', () => {
        const ctx: PasteContext = {
            clipboardLines: ['', '', 'foo', '', ''],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['', '', '• foo', '', '']);
    });

    it('handles multi-line with all whitespace lines', () => {
        const ctx: PasteContext = {
            clipboardLines: ['   ', '\t', 'foo', '   '],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet
        };
        const result = processClipboardLinesPure(ctx);
        // Now, whitespace lines get a bullet with their indent preserved (tabs become a single space)
        expect(result).toEqual(['   • ', ' • ', '• foo', '   • ']);
    });

    it('handles multi-line with indented lines', () => {
        const ctx: PasteContext = {
            clipboardLines: ['  foo', '    bar', '', 'baz'],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet
        };
        const result = processClipboardLinesPure(ctx);
        // Now, bullet is inserted after indent
        expect(result).toEqual(['  • foo', '    • bar', '', '• baz']);
    });

    it('handles multi-line with before/after cursor and empty lines', () => {
        const ctx: PasteContext = {
            clipboardLines: ['', 'foo', '', 'bar'],
            partBeforeCursor: '>',
            partAfterCursor: '<',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet
        };
        const result = processClipboardLinesPure(ctx);
        // When pasting onto an empty line, before/after cursor is not added to any pasted line
        expect(result).toEqual(['', '• foo', '', '• bar']);
    });
    const bulletTypeForLine = (_line: string, _indent: number) => ({ bulletType: 'none' });
    const getBullet = () => '• ';

    it('handles multi-line paste with bullets and preserves empty lines', () => {
        const ctx: PasteContext = {
            clipboardLines: ['foo', '', 'bar'],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['• foo', '', '• bar']);
    });

    it('joins first/last lines with before/after cursor', () => {
        const ctx: PasteContext = {
            clipboardLines: ['a', 'b', 'c'],
            partBeforeCursor: '>',
            partAfterCursor: '<',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet
        };
        const result = processClipboardLinesPure(ctx);
        // When pasting onto an empty line, before/after cursor is not added to any pasted line
        expect(result).toEqual(['• a', '• b', '• c']);
    });

    it('handles all empty lines', () => {
        const ctx: PasteContext = {
            clipboardLines: ['', '', ''],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['', '', '']);
    });
});

describe('processSingleLinePaste', () => {
    it('inserts at start of line', () => {
        const ctx: SingleLinePasteContext = {
            clipboardLine: 'X',
            selectionStart: 0,
            selectionEnd: 0,
            currentLineText: 'abc'
        };
        expect(processSingleLinePaste(ctx)).toBe('Xabc');
    });

    it('inserts at end of line', () => {
        const ctx: SingleLinePasteContext = {
            clipboardLine: 'X',
            selectionStart: 3,
            selectionEnd: 3,
            currentLineText: 'abc'
        };
        expect(processSingleLinePaste(ctx)).toBe('abcX');
    });

    it('replaces whole line', () => {
        const ctx: SingleLinePasteContext = {
            clipboardLine: 'X',
            selectionStart: 0,
            selectionEnd: 3,
            currentLineText: 'abc'
        };
        expect(processSingleLinePaste(ctx)).toBe('X');
    });
    it('replaces selection with clipboard line', () => {
        const ctx: SingleLinePasteContext = {
            clipboardLine: 'paste',
            selectionStart: 2,
            selectionEnd: 4,
            currentLineText: 'hello world'
        };
        expect(processSingleLinePaste(ctx)).toBe('hepasteo world');
    });
});

describe('processTypedNodePaste', () => {
    it('handles indented node with empty children', () => {
        const ctx: TypedNodePasteContext = {
            clipboardLines: ['    (Node)', '', '      child', '']
        };
        expect(processTypedNodePaste(ctx)).toEqual(['(Node)', '', '      child', '']);
    });

    it('handles node with only whitespace children', () => {
        const ctx: TypedNodePasteContext = {
            clipboardLines: ['    (Node)', '   ', '\t', '      child']
        };
        // Now, tabs are normalized to a single space
        expect(processTypedNodePaste(ctx)).toEqual(['(Node)', '   ', ' ', '      child']);
    });
    it('removes leading indent from first line and preserves others', () => {
        const ctx: TypedNodePasteContext = {
            clipboardLines: ['    (Node)', '      child', '      child2']
        };
        expect(processTypedNodePaste(ctx)).toEqual(['(Node)', '      child', '      child2']);
    });
    it('returns empty array for empty input', () => {
        expect(processTypedNodePaste({ clipboardLines: [] })).toEqual([]);
    });
});
