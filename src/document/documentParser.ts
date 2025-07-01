import * as vscode from 'vscode';
import { BlockNode } from './blockNode';
import { DocumentTree } from './documentTree';
import { isExcludedLine } from '../decorations/lineFilters';
import { withTiming } from '../utils/debugUtils';

/**
 * A stateless parser responsible for transforming a `vscode.TextDocument` into an
 * immutable `DocumentTree` of `BlockNode`s. It supports both full and incremental parsing.
 */
export class DocumentParser {

    /**
     * Performs a full parse of the document. This is used for the initial creation of the
     * document model or when a full re-parse is necessary.
     * @param document The `vscode.TextDocument` to parse.
     * @returns A new `DocumentTree` representing the entire document.
     */
    public fullParse(document: vscode.TextDocument): DocumentTree {
        return withTiming(() => {
            const flatNodes = this.createFlatNodeList(document);
            const rootNodes = this.buildTreeFromFlatList(flatNodes);
            return DocumentTree.create(document, rootNodes);
        }, `DocumentParser.fullParse`);
    }

    /**
     * Performs an incremental parse based on document changes using a "dirty range" strategy.
     * It finds the top-level nodes affected by the change, re-parses that contiguous block,
     * and splices the result back into the tree.
     * @param previousTree The `DocumentTree` from before the change.
     * @param changes The content changes from the `onDidChangeTextDocument` event.
     * @param document The new `vscode.TextDocument` after the changes.
     * @returns A new `DocumentTree` reflecting the applied changes.
     */
    public parse(previousTree: DocumentTree, changes: readonly vscode.TextDocumentContentChangeEvent[], document: vscode.TextDocument): DocumentTree {
        return withTiming(() => {
            if (changes.length === 0 || previousTree.rootNodes.length === 0) {
                return this.fullParse(document);
            }

            // 1. Find the range of lines affected by the change in the *old* document.
            const { oldStartLine, oldEndLine } = this.getOldChangeRange(changes);

            // 2. Find the top-level root nodes that contain the start and end of the change.
            let firstDirtyRootIndex = this.findRootNodeIndexAtLine(previousTree, oldStartLine);

            // If we can't find the nodes, it's safer to do a full re-parse.
            if (firstDirtyRootIndex === -1) {
                return this.fullParse(document);
            }

            // Expand the dirty range to include the previous root node.
            // This is necessary to correctly handle cases where a node is indented
            // and becomes a child of the previous node.
            if (firstDirtyRootIndex > 0) {
                firstDirtyRootIndex--;
            }

            let lastDirtyRootIndex = this.findRootNodeIndexAtLine(previousTree, oldEndLine);

            // If we can't find the nodes, it's safer to do a full re-parse.
            if (lastDirtyRootIndex === -1) {
                // If the end of the change is outside any node, re-parse to the end.
                lastDirtyRootIndex = previousTree.rootNodes.length - 1;
            }

            // 3. Determine the text range in the *new* document to re-parse.
            const firstDirtyNode = previousTree.rootNodes[firstDirtyRootIndex];
            const lastDirtyNode = previousTree.rootNodes[lastDirtyRootIndex];
            const lineDelta = document.lineCount - previousTree.document.lineCount;
            const newReparseStartLine = firstDirtyNode.lineNumber;
            const newReparseEndLine = lastDirtyNode.getSelfAndDescendants().reduce((max, n) => Math.max(max, n.lineNumber), 0) + lineDelta;

            // 4. Re-parse only that block of text.
            const newFlatNodes = this.createFlatNodeList(document, newReparseStartLine, newReparseEndLine + 1);
            const newSubtreeRoots = this.buildTreeFromFlatList(newFlatNodes);

            // 5. Splice the new nodes into the old list of root nodes.
            const newRootNodes = [
                ...previousTree.rootNodes.slice(0, firstDirtyRootIndex),
                ...newSubtreeRoots,
                ...previousTree.rootNodes.slice(lastDirtyRootIndex + 1)
            ];

            return DocumentTree.create(document, newRootNodes);
        }, `DocumentParser.parse`);
    }

    private findRootNodeIndexAtLine(tree: DocumentTree, lineNumber: number): number {
        return tree.rootNodes.findIndex(node => {
            const endLine = node.getSelfAndDescendants().reduce((max, n) => Math.max(max, n.lineNumber), 0);
            return lineNumber >= node.lineNumber && lineNumber <= endLine;
        });
    }

    private getOldChangeRange(changes: readonly vscode.TextDocumentContentChangeEvent[]): { oldStartLine: number, oldEndLine: number } {
        let oldStartLine = Number.MAX_SAFE_INTEGER;
        let oldEndLine = 0;

        for (const change of changes) {
            oldStartLine = Math.min(oldStartLine, change.range.start.line);
            oldEndLine = Math.max(oldEndLine, change.range.end.line);
        }
        return { oldStartLine, oldEndLine };
    }

    /**
     * Creates a flat list of `BlockNode`s from a document, optionally starting from a specific line.
     * It handles the state of being inside a code block.
     * @param document The document to parse.
     * @param startLine The line number to start parsing from.
     * @returns An array of `BlockNode`s.
     */
    private createFlatNodeList(document: vscode.TextDocument, startLine: number = 0, endLine: number = document.lineCount): BlockNode[] {
        return withTiming(() => {
            const nodes: BlockNode[] = [];
            let inCodeBlock = false;
            for (let i = startLine; i < endLine; i++) {
                const line = document.lineAt(i);
                if (!line) {
                    continue; // Add a guard for lines that might not exist in a transient state
                }
                const isDelimiter = line.text.trim().startsWith('```');
                let isExcluded = isExcludedLine(line);
                if (isDelimiter) {
                    inCodeBlock = !inCodeBlock;
                }
                isExcluded = isExcluded || (inCodeBlock && !isDelimiter);

                // Skip empty or whitespace-only lines from being part of the tree,
                // but only if they are not inside a code block.
                if (line.isEmptyOrWhitespace && !inCodeBlock) {
                    continue;
                }

                nodes.push(new BlockNode(line, i, isExcluded));
            }
            return nodes;
        }, `createFlatNodeList for lines ${startLine}-${endLine}`);
    }

    /**
     * Reconstructs the parent-child hierarchy from a flat list of nodes based on their indentation.
     * This is the core logic for building the tree structure.
     * @param nodes A flat array of `BlockNode`s, ordered by line number.
     * @returns An array of root `BlockNode`s.
     */
    private buildTreeFromFlatList(nodes: BlockNode[]): BlockNode[] {
        return withTiming(() => {
            if (nodes.length === 0) {
                return [];
            }

            const rootNodes: BlockNode[] = [];
            const parentStack: BlockNode[] = []; // Stack of nodes to track hierarchy

            for (const currentNode of nodes) {
                while (parentStack.length > 0) {
                    const parentNode = parentStack[parentStack.length - 1];
                    if (currentNode.indent > parentNode.indent) {
                        parentNode.addChild(currentNode.withParent(parentNode));
                        break; // Found parent, break inner loop
                    } else {
                        parentStack.pop();
                    }
                }

                if (parentStack.length === 0) {
                    rootNodes.push(currentNode);
                }

                if (!currentNode.isExcluded) {
                    parentStack.push(currentNode);
                }
            }

            return rootNodes;
        }, `buildTreeFromFlatList for ${nodes.length} nodes`);
    }
}
