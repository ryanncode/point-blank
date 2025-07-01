import * as vscode from 'vscode';
import { DocumentParser } from '../src/document/documentParser';
import { BlockNode } from '../src/document/blockNode';
import { DocumentTree } from '../src/document/documentTree';

// Mock vscode.TextDocument
const createMockDocument = (lines: string[]): vscode.TextDocument => {
    return {
        lineCount: lines.length,
        lineAt: (index: number): vscode.TextLine => {
            if (index >= lines.length || index < 0) {
                return undefined as any; // VS Code API returns undefined for out-of-bounds lines
            }
            const text = lines[index];
            return {
                lineNumber: index,
                text: text,
                range: new vscode.Range(new vscode.Position(index, 0), new vscode.Position(index, text.length)),
                firstNonWhitespaceCharacterIndex: text.search(/\S|$/),
                rangeIncludingLineBreak: new vscode.Range(new vscode.Position(index, 0), new vscode.Position(index + 1, 0)),
                isEmptyOrWhitespace: text.trim().length === 0,
            };
        },
        getText: () => lines.join('\n'),
    } as vscode.TextDocument;
};

describe('DocumentParser Incremental Parsing', () => {
    let parser: DocumentParser;

    beforeEach(() => {
        parser = new DocumentParser();
    });

    it('should correctly re-parse a simple text change', () => {
        const initialContent = [
            'Root 1',
            '  Child 1.1',
            'Root 2'
        ];
        const doc = createMockDocument(initialContent);
        const initialTree = parser.fullParse(doc);

        const updatedContent = [
            'Root 1',
            '  Child 1.1 changed',
            'Root 2'
        ];
        const updatedDoc = createMockDocument(updatedContent);
        const changes: vscode.TextDocumentContentChangeEvent[] = [{
            range: new vscode.Range(new vscode.Position(1, 11), new vscode.Position(1, 11)),
            rangeOffset: 0, // Note: rangeOffset and rangeLength are not used by the parser logic
            rangeLength: 0,
            text: ' changed'
        }];

        const newTree = parser.parse(initialTree, changes, updatedDoc);

        expect(newTree.rootNodes.length).toBe(2);
        expect(newTree.rootNodes[0].text).toBe('Root 1');
        expect(newTree.rootNodes[0].children.length).toBe(1);
        expect(newTree.rootNodes[0].children[0].text).toBe('  Child 1.1 changed');
        expect(newTree.rootNodes[1].text).toBe('Root 2');

        // Check if unchanged nodes are reused
        const oldRoot1 = initialTree.getNodeAtLine(0);
        const newRoot1 = newTree.getNodeAtLine(0);
        const oldRoot2 = initialTree.getNodeAtLine(2);
        const newRoot2 = newTree.getNodeAtLine(2);

        // With the current implementation, parents of changed nodes are recreated.
        // So oldRoot1 will be different from newRoot1.
        expect(newRoot1).not.toStrictEqual(oldRoot1); 
        expect(newRoot2).toStrictEqual(oldRoot2); // This node should be reused.
    });

    it('should handle adding a new node', () => {
        const initialContent = [
            'Root 1',
            '  Child 1.1',
        ];
        const doc = createMockDocument(initialContent);
        const initialTree = parser.fullParse(doc);

        const updatedContent = [
            'Root 1',
            '  Child 1.1',
            'Root 2',
        ];
        const updatedDoc = createMockDocument(updatedContent);
        const changes: vscode.TextDocumentContentChangeEvent[] = [{
            range: new vscode.Range(new vscode.Position(2, 0), new vscode.Position(2, 0)),
            rangeOffset: 0,
            rangeLength: 0,
            text: '\nRoot 2'
        }];

        const newTree = parser.parse(initialTree, changes, updatedDoc);

        expect(newTree.rootNodes.length).toBe(2);
        expect(newTree.rootNodes[1].text).toBe('Root 2');
    });

    it('should handle deleting a node', () => {
        const initialContent = [
            'Root 1',
            '  Child 1.1',
            'Root 2'
        ];
        const doc = createMockDocument(initialContent);
        const initialTree = parser.fullParse(doc);

        const updatedContent = [
            'Root 1',
            'Root 2'
        ];
        const updatedDoc = createMockDocument(updatedContent);
        const changes: vscode.TextDocumentContentChangeEvent[] = [{
            range: new vscode.Range(new vscode.Position(1, 0), new vscode.Position(2, 0)),
            rangeOffset: 0,
            rangeLength: 12,
            text: ''
        }];

        const newTree = parser.parse(initialTree, changes, updatedDoc);

        expect(newTree.rootNodes.length).toBe(2);
        expect(newTree.rootNodes[0].children.length).toBe(0);
        expect(newTree.rootNodes[1].text).toBe('Root 2');
    });

    it('should handle changing indentation', () => {
        const initialContent = [
            'Root 1',
            '  Child 1.1',
            'Root 2'
        ];
        const doc = createMockDocument(initialContent);
        const initialTree = parser.fullParse(doc);

        const updatedContent = [
            'Root 1',
            'Child 1.1',
            'Root 2'
        ];
        const updatedDoc = createMockDocument(updatedContent);
        const changes: vscode.TextDocumentContentChangeEvent[] = [{
            range: new vscode.Range(new vscode.Position(1, 0), new vscode.Position(1, 2)),
            rangeOffset: 0,
            rangeLength: 2,
            text: ''
        }];

        const newTree = parser.parse(initialTree, changes, updatedDoc);

        expect(newTree.rootNodes.length).toBe(3);
        expect(newTree.rootNodes[0].text).toBe('Root 1');
        expect(newTree.rootNodes[1].text).toBe('Child 1.1');
        expect(newTree.rootNodes[2].text).toBe('Root 2');
    });

    it('should handle a multi-line paste that changes hierarchy', () => {
        const initialContent = [
            'Root 1',
            '    Child 1.1',
            'Root 2',
        ];
        const doc = createMockDocument(initialContent);
        const initialTree = parser.fullParse(doc);

        const updatedContent = [
            'Root 1',
            '    Child 1.1',
            '        Grandchild 1.1.1',
            '    Child 1.2',
            'Root 2',
        ];
        const updatedDoc = createMockDocument(updatedContent);
        const newText = `        Grandchild 1.1.1\n    Child 1.2`;
        const changes: vscode.TextDocumentContentChangeEvent[] = [{
            range: new vscode.Range(new vscode.Position(1, doc.lineAt(1).text.length), new vscode.Position(2, 0)),
            rangeOffset: 0,
            rangeLength: 0,
            text: newText
        }];

        const newTree = parser.parse(initialTree, changes, updatedDoc);

        expect(newTree.rootNodes.length).toBe(2);
        const root1 = newTree.getNodeAtLine(0)!;
        expect(root1.children.length).toBe(2);
        expect(root1.children[0].text).toBe('    Child 1.1');
        expect(root1.children[0].children.length).toBe(1);
        expect(root1.children[0].children[0].text).toBe('        Grandchild 1.1.1');
        expect(root1.children[1].text).toBe('    Child 1.2');
        const root2 = newTree.getNodeAtLine(4)!;
        expect(root2.text).toBe('Root 2');

        // Check for node reuse
        const oldRoot2 = initialTree.getNodeAtLine(2);
        const newRoot2 = newTree.getNodeAtLine(4)!;
        expect(oldRoot2).toBeDefined();
        expect(newRoot2.text).toEqual(oldRoot2!.text);
        expect(newRoot2.lineNumber).toBe(4);
    });

    it('should correctly parse when a node is outdented to become a root', () => {
        const initialContent = [
            'Root 1',
            '  Child 1.1',
            '    Grandchild 1.1.1',
            'Root 2'
        ];
        const doc = createMockDocument(initialContent);
        const initialTree = parser.fullParse(doc);

        const updatedContent = [
            'Root 1',
            '  Child 1.1',
            'Grandchild 1.1.1', // Outdented
            'Root 2'
        ];
        const updatedDoc = createMockDocument(updatedContent);
        const changes: vscode.TextDocumentContentChangeEvent[] = [{
            range: new vscode.Range(new vscode.Position(2, 0), new vscode.Position(2, 4)),
            rangeOffset: 0,
            rangeLength: 4,
            text: ''
        }];

        const newTree = parser.parse(initialTree, changes, updatedDoc);

        expect(newTree.rootNodes.length).toBe(3);
        expect(newTree.rootNodes[0].text).toBe('Root 1');
        expect(newTree.rootNodes[0].children.length).toBe(1);
        expect(newTree.rootNodes[0].children[0].children.length).toBe(0);
        expect(newTree.rootNodes[1].text).toBe('Grandchild 1.1.1');
        expect(newTree.rootNodes[2].text).toBe('Root 2');
    });

    it('should handle an empty document', () => {
        const initialContent: string[] = [];
        const doc = createMockDocument(initialContent);
        const initialTree = parser.fullParse(doc);

        const updatedContent = ['Root 1'];
        const updatedDoc = createMockDocument(updatedContent);
        const changes: vscode.TextDocumentContentChangeEvent[] = [{
            range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
            rangeOffset: 0,
            rangeLength: 0,
            text: 'Root 1'
        }];

        const newTree = parser.parse(initialTree, changes, updatedDoc);

        expect(newTree.rootNodes.length).toBe(1);
        expect(newTree.rootNodes[0].text).toBe('Root 1');
    });

    it('should handle pasting at the beginning of the file', () => {
        const initialContent = [
            'Root 1',
            '  Child 1.1'
        ];
        const doc = createMockDocument(initialContent);
        const initialTree = parser.fullParse(doc);

        const updatedContent = [
            'New Root',
            '  New Child',
            'Root 1',
            '  Child 1.1'
        ];
        const updatedDoc = createMockDocument(updatedContent);
        const newText = 'New Root\n  New Child';
        const changes: vscode.TextDocumentContentChangeEvent[] = [{
            range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
            rangeOffset: 0,
            rangeLength: 0,
            text: `${newText}\n`
        }];

        const newTree = parser.parse(initialTree, changes, updatedDoc);

        expect(newTree.rootNodes.length).toBe(2);
        expect(newTree.rootNodes[0].text).toBe('New Root');
        expect(newTree.rootNodes[0].children.length).toBe(1);
        expect(newTree.rootNodes[0].children[0].text).toBe('  New Child');
        expect(newTree.rootNodes[1].text).toBe('Root 1');
    });

    it('should handle pasting over existing content', () => {
        const initialContent = [
            'Root 1',
            '  Child 1.1',
            'Root 2'
        ];
        const doc = createMockDocument(initialContent);
        const initialTree = parser.fullParse(doc);

        const updatedContent = [
            'Root 1',
            '  New Child',
            'Root 2'
        ];
        const updatedDoc = createMockDocument(updatedContent);
        const changes: vscode.TextDocumentContentChangeEvent[] = [{
            range: new vscode.Range(new vscode.Position(1, 2), new vscode.Position(1, 11)),
            rangeOffset: 0,
            rangeLength: 9,
            text: 'New Child'
        }];

        const newTree = parser.parse(initialTree, changes, updatedDoc);

        expect(newTree.rootNodes.length).toBe(2);
        expect(newTree.rootNodes[0].children.length).toBe(1);
        expect(newTree.rootNodes[0].children[0].text).toBe('  New Child');
        expect(newTree.rootNodes[1].text).toBe('Root 2');
    });

    it('should handle deleting the entire document', () => {
        const initialContent = [
            'Root 1',
            '  Child 1.1'
        ];
        const doc = createMockDocument(initialContent);
        const initialTree = parser.fullParse(doc);

        const updatedContent: string[] = [];
        const updatedDoc = createMockDocument(updatedContent);
        const changes: vscode.TextDocumentContentChangeEvent[] = [{
            range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(1, doc.lineAt(1).text.length)),
            rangeOffset: 0,
            rangeLength: doc.getText().length,
            text: ''
        }];

        const newTree = parser.parse(initialTree, changes, updatedDoc);

        expect(newTree.rootNodes.length).toBe(0);
    });

    it('should handle changes with blank lines', () => {
        const initialContent = [
            'Root 1',
            '',
            'Root 2'
        ];
        const doc = createMockDocument(initialContent);
        const initialTree = parser.fullParse(doc);

        const updatedContent = [
            'Root 1',
            '  Child 1.1',
            '',
            'Root 2'
        ];
        const updatedDoc = createMockDocument(updatedContent);
        const changes: vscode.TextDocumentContentChangeEvent[] = [{
            range: new vscode.Range(new vscode.Position(1, 0), new vscode.Position(1, 0)),
            rangeOffset: 0,
            rangeLength: 0,
            text: '  Child 1.1\n'
        }];

        const newTree = parser.parse(initialTree, changes, updatedDoc);

        expect(newTree.rootNodes.length).toBe(2);
        expect(newTree.rootNodes[0].children.length).toBe(1);
        expect(newTree.rootNodes[0].children[0].text).toBe('  Child 1.1');
        expect(newTree.rootNodes[1].text).toBe('Root 2');
    });

    it('should handle indenting a root node to become a child', () => {
        const initialContent = [
            'Root 1',
            'Root 2',
            'Root 3'
        ];
        const doc = createMockDocument(initialContent);
        const initialTree = parser.fullParse(doc);

        const updatedContent = [
            'Root 1',
            '  Root 2',
            'Root 3'
        ];
        const updatedDoc = createMockDocument(updatedContent);
        const changes: vscode.TextDocumentContentChangeEvent[] = [{
            range: new vscode.Range(new vscode.Position(1, 0), new vscode.Position(1, 0)),
            rangeOffset: 0,
            rangeLength: 0,
            text: '  '
        }];

        const newTree = parser.parse(initialTree, changes, updatedDoc);

        expect(newTree.rootNodes.length).toBe(2);
        expect(newTree.rootNodes[0].text).toBe('Root 1');
        expect(newTree.rootNodes[0].children.length).toBe(1);
        expect(newTree.rootNodes[0].children[0].text).toBe('  Root 2');
        expect(newTree.rootNodes[1].text).toBe('Root 3');
    });

    it('should handle outdenting a child to become a root between two roots', () => {
        const initialContent = [
            'Root 1',
            '  Child 1.1',
            '    Grandchild 1.1.1',
            'Root 2'
        ];
        const doc = createMockDocument(initialContent);
        const initialTree = parser.fullParse(doc);

        const updatedContent = [
            'Root 1',
            'Child 1.1',
            '    Grandchild 1.1.1',
            'Root 2'
        ];
        const updatedDoc = createMockDocument(updatedContent);
        const changes: vscode.TextDocumentContentChangeEvent[] = [{
            range: new vscode.Range(new vscode.Position(1, 0), new vscode.Position(1, 2)),
            rangeOffset: 0,
            rangeLength: 2,
            text: ''
        }];

        const newTree = parser.parse(initialTree, changes, updatedDoc);

        expect(newTree.rootNodes.length).toBe(3);
        expect(newTree.rootNodes[0].text).toBe('Root 1');
        expect(newTree.rootNodes[0].children.length).toBe(0);
        expect(newTree.rootNodes[1].text).toBe('Child 1.1');
        expect(newTree.rootNodes[1].children.length).toBe(1);
        expect(newTree.rootNodes[1].children[0].text).toBe('    Grandchild 1.1.1');
        expect(newTree.rootNodes[2].text).toBe('Root 2');
    });

    it('should handle pasting a new root with children between two roots', () => {
        const initialContent = [
            'Root 1',
            'Root 3'
        ];
        const doc = createMockDocument(initialContent);
        const initialTree = parser.fullParse(doc);

        const updatedContent = [
            'Root 1',
            'Root 2',
            '  Child 2.1',
            'Root 3'
        ];
        const updatedDoc = createMockDocument(updatedContent);
        const newText = 'Root 2\n  Child 2.1';
        const changes: vscode.TextDocumentContentChangeEvent[] = [{
            range: new vscode.Range(new vscode.Position(1, 0), new vscode.Position(1, 0)),
            rangeOffset: 0,
            rangeLength: 0,
            text: `${newText}\n`
        }];

        const newTree = parser.parse(initialTree, changes, updatedDoc);

        expect(newTree.rootNodes.length).toBe(3);
        expect(newTree.rootNodes[0].text).toBe('Root 1');
        expect(newTree.rootNodes[1].text).toBe('Root 2');
        expect(newTree.rootNodes[1].children.length).toBe(1);
        expect(newTree.rootNodes[1].children[0].text).toBe('  Child 2.1');
        expect(newTree.rootNodes[2].text).toBe('Root 3');
    });

    it('should handle deleting a root with children, promoting its children', () => {
        const initialContent = [
            'Root 1',
            '  Child 1.1',
            '    Grandchild 1.1.1',
            'Root 2'
        ];
        const doc = createMockDocument(initialContent);
        const initialTree = parser.fullParse(doc);

        const updatedContent = [
            '  Child 1.1',
            '    Grandchild 1.1.1',
            'Root 2'
        ];
        const updatedDoc = createMockDocument(updatedContent);
        const changes: vscode.TextDocumentContentChangeEvent[] = [{
            range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(1, 0)),
            rangeOffset: 0,
            rangeLength: 'Root 1\n'.length,
            text: ''
        }];

        const newTree = parser.parse(initialTree, changes, updatedDoc);

        expect(newTree.rootNodes.length).toBe(2);
        expect(newTree.rootNodes[0].text).toBe('  Child 1.1');
        expect(newTree.rootNodes[0].children.length).toBe(1);
        expect(newTree.rootNodes[0].children[0].text).toBe('    Grandchild 1.1.1');
        expect(newTree.rootNodes[1].text).toBe('Root 2');
    });

    it('should handle a multi-line paste replacing a root and its children', () => {
        const initialContent = [
            'Root A',
            '  Child A.1',
            'Root C'
        ];
        const doc = createMockDocument(initialContent);
        const initialTree = parser.fullParse(doc);

        const updatedContent = [
            'Root B',
            '  Child B.1',
            '  Child B.2',
            'Root C'
        ];
        const updatedDoc = createMockDocument(updatedContent);
        const newText = 'Root B\n  Child B.1\n  Child B.2';
        const changes: vscode.TextDocumentContentChangeEvent[] = [{
            range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(2, 0)),
            rangeOffset: 0,
            rangeLength: 'Root A\n  Child A.1\n'.length,
            text: `${newText}\n`
        }];

        const newTree = parser.parse(initialTree, changes, updatedDoc);

        expect(newTree.rootNodes.length).toBe(2);
        expect(newTree.rootNodes[0].text).toBe('Root B');
        expect(newTree.rootNodes[0].children.length).toBe(2);
        expect(newTree.rootNodes[0].children[0].text).toBe('  Child B.1');
        expect(newTree.rootNodes[0].children[1].text).toBe('  Child B.2');
        expect(newTree.rootNodes[1].text).toBe('Root C');
    });

    it('should handle pasting content that creates multiple new root nodes', () => {
        const initialContent = [
            'Root 1',
            'Root 4'
        ];
        const doc = createMockDocument(initialContent);
        const initialTree = parser.fullParse(doc);

        const updatedContent = [
            'Root 1',
            'Root 2',
            '  Child 2.1',
            'Root 3',
            'Root 4'
        ];
        const updatedDoc = createMockDocument(updatedContent);
        const newText = 'Root 2\n  Child 2.1\nRoot 3';
        const changes: vscode.TextDocumentContentChangeEvent[] = [{
            range: new vscode.Range(new vscode.Position(1, 0), new vscode.Position(1, 0)),
            rangeOffset: 0,
            rangeLength: 0,
            text: `${newText}\n`
        }];

        const newTree = parser.parse(initialTree, changes, updatedDoc);

        expect(newTree.rootNodes.length).toBe(4);
        expect(newTree.rootNodes[0].text).toBe('Root 1');
        expect(newTree.rootNodes[1].text).toBe('Root 2');
        expect(newTree.rootNodes[1].children.length).toBe(1);
        expect(newTree.rootNodes[2].text).toBe('Root 3');
        expect(newTree.rootNodes[3].text).toBe('Root 4');
    });

    it('should handle deleting a block containing multiple root nodes', () => {
        const initialContent = [
            'Root 1',
            'Root 2',
            '  Child 2.1',
            'Root 3',
            'Root 4'
        ];
        const doc = createMockDocument(initialContent);
        const initialTree = parser.fullParse(doc);

        const updatedContent = [
            'Root 1',
            'Root 4'
        ];
        const updatedDoc = createMockDocument(updatedContent);
        const changes: vscode.TextDocumentContentChangeEvent[] = [{
            range: new vscode.Range(new vscode.Position(1, 0), new vscode.Position(4, 0)),
            rangeOffset: 0,
            rangeLength: 0, // Not used
            text: ''
        }];

        const newTree = parser.parse(initialTree, changes, updatedDoc);

        expect(newTree.rootNodes.length).toBe(2);
        expect(newTree.rootNodes[0].text).toBe('Root 1');
        expect(newTree.rootNodes[1].text).toBe('Root 4');
    });

    it('should handle complex indentation changes across multiple root nodes', () => {
        const initialContent = [
            'Root 1',
            'Root 2',
            'Root 3',
            'Root 4'
        ];
        const doc = createMockDocument(initialContent);
        const initialTree = parser.fullParse(doc);

        const updatedContent = [
            'Root 1',
            '  Root 2',
            '    Root 3',
            'Root 4'
        ];
        const updatedDoc = createMockDocument(updatedContent);
        const changes: vscode.TextDocumentContentChangeEvent[] = [
            { range: new vscode.Range(1, 0, 1, 0), rangeOffset: 0, rangeLength: 0, text: '  ' },
            { range: new vscode.Range(2, 0, 2, 0), rangeOffset: 0, rangeLength: 0, text: '    ' },
        ];

        const newTree = parser.parse(initialTree, changes, updatedDoc);

        expect(newTree.rootNodes.length).toBe(2);
        expect(newTree.rootNodes[0].text).toBe('Root 1');
        expect(newTree.rootNodes[0].children.length).toBe(1);
        const child = newTree.rootNodes[0].children[0];
        expect(child.text).toBe('  Root 2');
        expect(child.children.length).toBe(1);
        const grandchild = child.children[0];
        expect(grandchild.text).toBe('    Root 3');
        expect(newTree.rootNodes[1].text).toBe('Root 4');
    });

    it('should handle edits within a code block without affecting the tree structure', () => {
        const initialContent = [
            'Root 1',
            '```',
            'const x = 1;',
            '```',
            'Root 2'
        ];
        const doc = createMockDocument(initialContent);
        const initialTree = parser.fullParse(doc);

        const updatedContent = [
            'Root 1',
            '```',
            'const x = 2;',
            '```',
            'Root 2'
        ];
        const updatedDoc = createMockDocument(updatedContent);
        const changes: vscode.TextDocumentContentChangeEvent[] = [{
            range: new vscode.Range(new vscode.Position(2, 10), new vscode.Position(2, 11)),
            rangeOffset: 0,
            rangeLength: 1,
            text: '2'
        }];

        const newTree = parser.parse(initialTree, changes, updatedDoc);

        expect(newTree.rootNodes.length).toBe(5);
        expect(newTree.rootNodes[0].text).toBe('Root 1');
        expect(newTree.rootNodes[1].text).toBe('```');
        expect(newTree.rootNodes[2].text).toBe('const x = 2;');
        expect(newTree.rootNodes[3].text).toBe('```');
        expect(newTree.rootNodes[4].text).toBe('Root 2');
    });

    it('should handle adding a new root node at the end of the document', () => {
        const initialContent = [
            'Root 1',
            '  Child 1.1'
        ];
        const doc = createMockDocument(initialContent);
        const initialTree = parser.fullParse(doc);

        const updatedContent = [
            'Root 1',
            '  Child 1.1',
            'Root 2'
        ];
        const updatedDoc = createMockDocument(updatedContent);
        const changes: vscode.TextDocumentContentChangeEvent[] = [{
            range: new vscode.Range(new vscode.Position(2, 0), new vscode.Position(2, 0)),
            rangeOffset: 0,
            rangeLength: 0,
            text: '\nRoot 2'
        }];

        const newTree = parser.parse(initialTree, changes, updatedDoc);

        expect(newTree.rootNodes.length).toBe(2);
        expect(newTree.rootNodes[0].text).toBe('Root 1');
        expect(newTree.rootNodes[1].text).toBe('Root 2');
    });
});
