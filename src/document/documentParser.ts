import * as vscode from 'vscode';
import { BlockNode } from './blockNode';
import { DocumentTree } from './documentTree';
import { isExcludedLine } from '../decorations/lineFilters'; // Assuming this is still needed for initial exclusion

/**
 * Parses the document content into a hierarchical DocumentTree of BlockNodes.
 * This parser is stateless and focuses on building immutable tree structures.
 */
export class DocumentParser {

    /**
     * Performs a full parse of the document and constructs a new DocumentTree.
     * This method is used for initial parsing or when a full re-parse is unavoidable.
     * @param document The current `vscode.TextDocument`.
     * @returns A new `DocumentTree` representing the parsed document.
     */
    public fullParse(document: vscode.TextDocument): DocumentTree {
        const flatNodes: BlockNode[] = [];
        let currentInCodeBlock = false;

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const trimmedText = line.text.trim();

            let isLineExcluded = isExcludedLine(line);
            const isCodeBlockDelimiter = trimmedText.startsWith('```');

            if (isCodeBlockDelimiter) {
                currentInCodeBlock = !currentInCodeBlock;
            }
            isLineExcluded = isLineExcluded || currentInCodeBlock;

            const newNode = new BlockNode(line, i, isLineExcluded);
            flatNodes.push(newNode);
        }

        const tree = DocumentTree.create(document, flatNodes);
        return tree;
    }

    /**
     * Performs an incremental parse of the document based on changes.
     * This method intelligently updates the existing DocumentTree to create a new, immutable tree.
     * @param previousTree The previous `DocumentTree` instance.
     * @param changes The `vscode.TextDocumentContentChangeEvent` array.
     * @returns A new `DocumentTree` instance reflecting the changes.
     */
    public parse(previousTree: DocumentTree, changes: readonly vscode.TextDocumentContentChangeEvent[]): DocumentTree {
        if (changes.length === 0) {
            console.timeEnd('DocumentParser.parse');
            return previousTree;
        }

        // Find the first line affected by any of the changes.
        let firstChangedLine = previousTree.document.lineCount;
        for (const change of changes) {
            firstChangedLine = Math.min(firstChangedLine, change.range.start.line);
        }

        const document = previousTree.document;
        const newNodes: BlockNode[] = [];

        // 1. Keep all nodes before the first change
        const oldNodes = previousTree.getAllNodesFlat();
        newNodes.push(...oldNodes.filter(node => node.lineNumber < firstChangedLine));

        // 2. Re-parse from the first change to the end of the document
        newNodes.push(...this.partialParse(document, firstChangedLine, document.lineCount - 1));

        // 3. Rebuild the entire tree hierarchy from the new flat list
        const rootNodes = this.buildTreeFromFlatList(newNodes);

        const tree = DocumentTree.create(document, rootNodes);
        return tree;
    }

    /**
     * Parses a slice of the document and returns a flat list of BlockNodes.
     */
    private partialParse(document: vscode.TextDocument, startLine: number, endLine: number): BlockNode[] {
        const nodes: BlockNode[] = [];
        let currentInCodeBlock = false; // This state is local to the partial parse

        for (let i = startLine; i <= endLine; i++) {
            const line = document.lineAt(i);
            const trimmedText = line.text.trim();

            let isLineExcluded = isExcludedLine(line);
            const isCodeBlockDelimiter = trimmedText.startsWith('```');

            if (isCodeBlockDelimiter) {
                currentInCodeBlock = !currentInCodeBlock;
            }
            isLineExcluded = isLineExcluded || currentInCodeBlock;

            const newNode = new BlockNode(line, i, isLineExcluded);
            nodes.push(newNode);
        }
        return nodes;
    }

    /**
     * Reconstructs the parent/child hierarchy from a flat list of nodes based on indentation and header levels.
     */
    private buildTreeFromFlatList(nodes: BlockNode[]): BlockNode[] {
        const rootNodes: BlockNode[] = [];
        const parentStack: BlockNode[] = []; // Stores potential parent nodes

        for (const node of nodes) {
            const nodeHeaderLevel = DocumentParser.getHeaderLevel(node.trimmedText);

            // Adjust parentStack based on indentation or header level
            while (parentStack.length > 0) {
                const lastParent = parentStack[parentStack.length - 1];
                const lastParentHeaderLevel = DocumentParser.getHeaderLevel(lastParent.trimmedText);

                if (nodeHeaderLevel > 0 && lastParentHeaderLevel > 0) {
                    // Both are headers: pop if current node's level is less than or equal to parent's
                    if (nodeHeaderLevel <= lastParentHeaderLevel) {
                        parentStack.pop();
                    } else {
                        break; // Current header is a sub-header of the last parent header
                    }
                } else if (node.indent <= lastParent.indent) {
                    // Indentation-based: pop if current node's indent is less than or equal to parent's
                    parentStack.pop();
                } else {
                    break; // Current node is a child by indentation
                }
            }

            const parent = parentStack.length > 0 ? parentStack[parentStack.length - 1] : undefined;

            // Create a new node with the correct parent
            // Note: BlockNode's children array is readonly, so we need to reconstruct parents
            // if we were truly aiming for full immutability here. For this context,
            // we'll assume the direct manipulation of children (via casting) is acceptable
            // for the purpose of demonstrating the tree building logic.
            const newNode = new BlockNode(node.line, node.lineNumber, node.isExcluded, parent);

            if (parent) {
                // This cast is a simplification. In a truly immutable design,
                // the parent would need to be recreated with the new child.
                (parent.children as BlockNode[]).push(newNode);
            } else {
                rootNodes.push(newNode);
            }

            // Only push non-excluded nodes onto the stack as potential parents
            // and only if they are not code block delimiters.
            if (!newNode.isExcluded && !newNode.isCodeBlockDelimiter) {
                parentStack.push(newNode);
            }
        }
        return rootNodes;
    }

    /**
     * Determines the header level of a given text line.
     * Returns 0 if the line is not a markdown header.
     * @param text The trimmed text of the line.
     * @returns The header level (1-6) or 0 if not a header.
     */
    private static getHeaderLevel(text: string): number {
        const match = text.match(/^(#+)\s/);
        if (match) {
            return match[1].length;
        }
        return 0;
    }
}
