import '@jest/globals';

// Make sure Jest types are included in your tsconfig.json for 'expect' to work.
import { processClipboardLinesPure, processSingleLinePaste, processTypedNodePaste, PasteContext, SingleLinePasteContext, TypedNodePasteContext } from '../src/utils/pasteUtils';

describe('processClipboardLinesPure', () => {
    function makeMockDoc(lines: string[]): { lineCount: number, lineAt: (n: number) => { text: string, firstNonWhitespaceCharacterIndex: number } } {
        return {
            lineCount: lines.length,
            lineAt: (n: number) => {
                const text = lines[n] ?? '';
                return {
                    text,
                    firstNonWhitespaceCharacterIndex: text.match(/^\s*/)?.[0].length ?? 0
                };
            }
        };
    }

    it('matches bullet from line above at indent 0 for multi-line paste', () => {
        const doc = makeMockDoc(['+ something', '', '']);
        const ctx: PasteContext = {
            clipboardLines: ['foo', 'bar'],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: doc,
            lineNumber: 1
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['+ foo', '+ bar']);
    });

    it('matches bullet from line below at indent 0 for multi-line paste', () => {
        const doc = makeMockDoc(['', '', '* next']);
        const ctx: PasteContext = {
            clipboardLines: ['foo', 'bar'],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: doc,
            lineNumber: 1
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['* foo', '* bar']);
    });

    it('matches bullet from line above at indent 2 for multi-line paste', () => {
        const doc = makeMockDoc(['  - above', '', '']);
        const ctx: PasteContext = {
            clipboardLines: ['  foo', '  bar'],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 2,
            bulletTypeForLine,
            getBullet,
            document: doc,
            lineNumber: 1
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['  - foo', '  - bar']);
    });

    it('matches bullet from line below at indent 2 for multi-line paste', () => {
        const doc = makeMockDoc(['', '', '  * below']);
        const ctx: PasteContext = {
            clipboardLines: ['  foo', '  bar'],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 2,
            bulletTypeForLine,
            getBullet,
            document: doc,
            lineNumber: 1
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['  * foo', '  * bar']);
    });
    it('matches bullet style from line below at indent 0 (multi-line)', () => {
        const doc = makeMockDoc(['+ foo', '', '']);
        const ctx: PasteContext = {
            clipboardLines: ['bar'],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: doc,
            lineNumber: 1,
            findSiblingBulletByIndent: testFindSiblingBulletByIndent
        };
        // Should match bullet from line above (since below is empty)
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['+ bar']);
    });

    it('matches bullet style from line above at indent 0 (multi-line)', () => {
        const doc = makeMockDoc(['', '', '+ foo']);
        const ctx: PasteContext = {
            clipboardLines: ['bar'],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: doc,
            lineNumber: 1,
            findSiblingBulletByIndent: testFindSiblingBulletByIndent
        };
        // Should match bullet from line below
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['+ bar']);
    });
    it('adds a default bullet when pasting a single regular line onto an empty line', () => {
        const ctx: PasteContext = {
            clipboardLines: ['hello world'],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber,
            findSiblingBulletByIndent: testFindSiblingBulletByIndent
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['• hello world']);
    });
    // Provide test findSiblingBulletByIndent that always returns '• '
    const testFindSiblingBulletByIndent = () => '• ';

    it('handles clipboard with only empty lines', () => {
        const ctx: PasteContext = {
            clipboardLines: ['', '', ''],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber,
            findSiblingBulletByIndent: testFindSiblingBulletByIndent
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['', '', '']);
    });

    it('handles clipboard with only whitespace lines (spaces, tabs, mixed)', () => {
        const ctx: PasteContext = {
            clipboardLines: ['   ', '\t', '  \t  '],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber,
            findSiblingBulletByIndent: testFindSiblingBulletByIndent
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['   ', '\t', '  \t  ']);
    });

    it('handles clipboard with mix of empty, whitespace, and content lines', () => {
        const ctx: PasteContext = {
            clipboardLines: ['', '   ', 'foo', '', '\t', 'bar', ''],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber,
            findSiblingBulletByIndent: testFindSiblingBulletByIndent
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['', '   ', '• foo', '', '\t', '• bar', '']);
    });

    it('handles clipboard with only non-breaking and Unicode whitespace', () => {
        const ctx: PasteContext = {
            clipboardLines: ['\u00A0', '\u2003', ' '],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber,
            findSiblingBulletByIndent: testFindSiblingBulletByIndent
        };
        // All are whitespace-only, so should be empty strings
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['\u00A0', '\u2003', '\u2003']);
    });

    it('handles clipboard with a single line that is empty', () => {
        const ctx: PasteContext = {
            clipboardLines: [''],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber,
            findSiblingBulletByIndent: testFindSiblingBulletByIndent
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['']);
    });

    it('handles clipboard with a single line that is whitespace', () => {
        const ctx: PasteContext = {
            clipboardLines: ['   '],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber,
            findSiblingBulletByIndent: testFindSiblingBulletByIndent
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['   ']);
    });

    it('handles clipboard with a single line that is a bullet only', () => {
        const ctx: PasteContext = {
            clipboardLines: ['• '],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber,
            findSiblingBulletByIndent: testFindSiblingBulletByIndent
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['• ']);
    });

    it('handles clipboard with a line that is only a tab', () => {
        const ctx: PasteContext = {
            clipboardLines: ['\t'],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber,
            findSiblingBulletByIndent: testFindSiblingBulletByIndent
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['\t']);
    });

    it('handles clipboard with a line that is a mix of tabs and spaces', () => {
        const ctx: PasteContext = {
            clipboardLines: [' \t  '],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber,
            findSiblingBulletByIndent: testFindSiblingBulletByIndent
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual([' \t  ']);
    });

    it('handles clipboard with a line that is a bullet and whitespace only', () => {
        const ctx: PasteContext = {
            clipboardLines: ['   •   '],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber,
            findSiblingBulletByIndent: testFindSiblingBulletByIndent
        };
        const result = processClipboardLinesPure(ctx);
        // Should not add a bullet to a line that already has one
        expect(result).toEqual(['   •   ']);
    });

    it('handles clipboard with a line that is a bullet and then content', () => {
        const ctx: PasteContext = {
            clipboardLines: ['• foo'],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber,
            findSiblingBulletByIndent: testFindSiblingBulletByIndent
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['• foo']);
    });

    it('handles clipboard with a line that is only a newline character', () => {
        const ctx: PasteContext = {
            clipboardLines: ['\n'],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber,
            findSiblingBulletByIndent: testFindSiblingBulletByIndent
        };
        const result = processClipboardLinesPure(ctx);
        // '\n' is not empty, so it's whitespace-only
        expect(result).toEqual(['\n']);
    });

    it('handles clipboard with a line that is only carriage return', () => {
        const ctx: PasteContext = {
            clipboardLines: ['\r'],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber,
            findSiblingBulletByIndent: testFindSiblingBulletByIndent
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['\r']);
    });

    it('handles clipboard with a line that is only carriage return + newline', () => {
        const ctx: PasteContext = {
            clipboardLines: ['\r\n'],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber,
            findSiblingBulletByIndent: testFindSiblingBulletByIndent
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['\r\n']);
    });
    // Minimal mock document for bullet style logic
    const mockDocument = {
        lineCount: 100,
        lineAt: (_lineNumber: number) => ({
            text: '',
            firstNonWhitespaceCharacterIndex: 0
        })
    } as any;
    const defaultLineNumber = 0;

    it('pastes multi-line on empty line (each line new, nothing joined)', () => {
        const ctx: PasteContext = {
            clipboardLines: ['foo', 'bar', 'baz'],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['• foo', '• bar', '• baz']);
    });

    it('pastes multi-line at start of line (appends partAfterCursor)', () => {
        const ctx: PasteContext = {
            clipboardLines: ['foo', 'bar'],
            partBeforeCursor: '',
            partAfterCursor: 'AFTER',
            currentLineText: 'AFTER',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['• fooAFTER', '• bar']);
    });

    it('pastes multi-line in middle of line (partAfterCursor appended to last line)', () => {
        const ctx: PasteContext = {
            clipboardLines: ['foo', 'bar'],
            partBeforeCursor: 'BEFORE',
            partAfterCursor: 'AFTER',
            currentLineText: 'BEFOREAFTER',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['BEFOREfooAFTER', '• bar']);
    });

    it('pastes multi-line at end of line (first line appended, rest new lines)', () => {
        const ctx: PasteContext = {
            clipboardLines: ['foo', 'bar'],
            partBeforeCursor: 'BEFORE',
            partAfterCursor: '',
            currentLineText: 'BEFORE',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['BEFOREfoo', '• bar']);
    });

    it('pastes single line at start of line', () => {
        const ctx: PasteContext = {
            clipboardLines: ['foo'],
            partBeforeCursor: '',
            partAfterCursor: 'AFTER',
            currentLineText: 'AFTER',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber
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
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['BEFOREfooAFTER']);
    });

    it('pastes single line at end of line', () => {
        const ctx: PasteContext = {
            clipboardLines: ['foo'],
            partBeforeCursor: 'BEFORE',
            partAfterCursor: '',
            currentLineText: 'BEFORE',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['BEFOREfoo']);
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
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber
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
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['AfooB']);
    });

    it('handles multi-line with leading and trailing empty lines', () => {
        const ctx: PasteContext = {
            clipboardLines: ['', 'foo', '', 'bar', ''],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber
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
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber
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
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber
        };
        const result = processClipboardLinesPure(ctx);
        // Now, whitespace lines get a bullet with their indent preserved (tabs become a single space)
        expect(result).toEqual(['   ', '\t', '• foo', '   ']);
    });

    it('handles multi-line with indented lines', () => {
        const ctx: PasteContext = {
            clipboardLines: ['  foo', '    bar', '', 'baz'],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber
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
            currentLineText: '><',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber
        };
        const result = processClipboardLinesPure(ctx);
        // When pasting onto an empty line, before/after cursor is not added to any pasted line
        expect(result).toEqual(['><', '• foo', '', '• bar']);
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
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['• foo', '', '• bar']);
    });

    it('joins first/last lines with before/after cursor', () => {
        const ctx: PasteContext = {
            clipboardLines: ['a', 'b', 'c'],
            partBeforeCursor: '>',
            partAfterCursor: '<',
            currentLineText: '><',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber
        };
        const result = processClipboardLinesPure(ctx);
        // When pasting onto an empty line, before/after cursor is not added to any pasted line
        expect(result).toEqual(['>a<', '• b', '• c']);
    });

    it('handles all empty lines', () => {
        const ctx: PasteContext = {
            clipboardLines: ['', '', ''],
            partBeforeCursor: '',
            partAfterCursor: '',
            currentLineText: '',
            currentLineIndent: 0,
            bulletTypeForLine,
            getBullet,
            document: mockDocument,
            lineNumber: defaultLineNumber
        };
        const result = processClipboardLinesPure(ctx);
        expect(result).toEqual(['', '', '']);
    });
});

describe('processSingleLinePaste', () => {
    it('matches bullet from current line at indent 0 for single-line paste', () => {
        const ctx: SingleLinePasteContext = {
            clipboardLine: 'foo',
            selectionStart: 0,
            selectionEnd: 0,
            currentLineText: '+ something'
        };
        expect(processSingleLinePaste(ctx)).toBe('+ foosomething');
    });

    it('matches bullet from current line at indent 2 for single-line paste', () => {
        const ctx: SingleLinePasteContext = {
            clipboardLine: 'bar',
            selectionStart: 2,
            selectionEnd: 2,
            currentLineText: '  * hello'
        };
        expect(processSingleLinePaste(ctx)).toBe('  barhello');
    });
    it('matches bullet style from current line at indent 0 (single-line)', () => {
        const ctx: SingleLinePasteContext = {
            clipboardLine: 'bar',
            selectionStart: 0,
            selectionEnd: 0,
            currentLineText: '+ foo'
        };
        expect(processSingleLinePaste(ctx)).toBe('+ barfoo');
    });
    it('inserts at start of line', () => {
        const ctx: SingleLinePasteContext = {
            clipboardLine: 'X',
            selectionStart: 0,
            selectionEnd: 0,
            currentLineText: 'abc'
        };
        expect(processSingleLinePaste(ctx)).toBe('• Xabc');
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
        expect(processSingleLinePaste(ctx)).toBe('• X');
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
