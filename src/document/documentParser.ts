import * as vscode from 'vscode';
import { BlockNode } from './blockNode';
import { DocumentTree } from './documentTree';
import { isExcludedLine } from '../decorations/lineFilters'; // Assuming this is still needed for initial exclusion

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
        const flatNodes = this.createFlatNodeList(document);
        const rootNodes = this.buildTreeFromFlatList(flatNodes);
        return DocumentTree.create(document, rootNodes);
    }

    /**
     * Performs an incremental parse based on document changes. It reuses unchanged nodes
     * from the previous tree and only re-parses the affected portion of the document,
     * which is critical for performance.
     * @param previousTree The `DocumentTree` from before the change.
     * @param changes The content changes from the `onDidChangeTextDocument` event.
     * @returns A new `DocumentTree` reflecting the applied changes.
     */
    public parse(previousTree: DocumentTree, changes: readonly vscode.TextDocumentContentChangeEvent[]): DocumentTree {
        if (changes.length === 0) {
            return previousTree;
        }

        // For simplicity and robustness, this implementation currently re-parses from the first
        // changed line to the end of the document. A more complex implementation could
        // analyze the changes to re-parse a smaller range.
        const document = previousTree.document;
        const firstChangedLine = changes.reduce((min, change) => Math.min(min, change.range.start.line), document.lineCount);

        const oldNodes = previousTree.getAllNodesFlat();
        const newNodes = oldNodes.filter(node => node.lineNumber < firstChangedLine);
        newNodes.push(...this.createFlatNodeList(document, firstChangedLine));

        const rootNodes = this.buildTreeFromFlatList(newNodes);
        return DocumentTree.create(document, rootNodes);
    }

    /**
     * Creates a flat list of `BlockNode`s from a document, optionally starting from a specific line.
     * It handles the state of being inside a code block.
     * @param document The document to parse.
     * @param startLine The line number to start parsing from.
     * @returns An array of `BlockNode`s.
     */
    private createFlatNodeList(document: vscode.TextDocument, startLine: number = 0): BlockNode[] {
        const nodes: BlockNode[] = [];
        let inCodeBlock = false; // State machine for tracking code blocks.

        for (let i = startLine; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const isDelimiter = line.text.trim().startsWith('```');
            let isExcluded = isExcludedLine(line);

            if (isDelimiter) {
                inCodeBlock = !inCodeBlock;
            }
            // A line is excluded if it's a markdown element or inside a code block (but not the delimiter itself).
            isExcluded = isExcluded || (inCodeBlock && !isDelimiter);

            nodes.push(new BlockNode(line, i, isExcluded));
        }
        return nodes;
    }

    /**
     * Reconstructs the parent-child hierarchy from a flat list of nodes based on their indentation.
     * This is the core logic for building the tree structure.
     * @param nodes A flat array of `BlockNode`s, ordered by line number.
     * @returns An array of root `BlockNode`s.
     */
    private buildTreeFromFlatList(nodes: BlockNode[]): BlockNode[] {
        const rootNodes: BlockNode[] = [];
        const parentStack: BlockNode[] = []; // A stack to keep track of the current parent candidates.
        const processedNodes: BlockNode[] = []; // New array to store nodes with parents set

        for (const node of nodes) {
            // Pop parents from the stack until we find a suitable parent for the current node.
            // A suitable parent must have a smaller indentation level.
            while (parentStack.length > 0 && node.indent <= parentStack[parentStack.length - 1].indent) {
                parentStack.pop();
            }

            const parent = parentStack.length > 0 ? parentStack[parentStack.length - 1] : undefined;
            let newNode: BlockNode;

            if (parent) {
                // Create a new node with the parent reference set
                newNode = node.withParent(parent);
            } else {
                // This is a root node.
                newNode = node; // No parent to set, use the original node
                rootNodes.push(newNode);
            }

            processedNodes.push(newNode); // Add the (potentially new) node to the processed list

            // The current node (or its new instance with parent) becomes a potential parent for subsequent, more indented nodes.
            // Excluded nodes (like headers or lines in code blocks) cannot be parents.
            if (!newNode.isExcluded) {
                parentStack.push(newNode);
            }
        }

        // Pass the processed nodes (which now have correct parent references) to reconstructImmutableTree
        return this.reconstructImmutableTree(processedNodes);
    }

    /**
     * Reconstructs the full immutable tree from a list of nodes that have their parent references set.
     * @param nodes The list of all nodes.
     * @returns An array of root nodes with their children correctly populated.
     */
    private reconstructImmutableTree(nodes: BlockNode[]): BlockNode[] {
        const nodeMap = new Map(nodes.map(node => [node.lineNumber, node]));
        const childrenMap = new Map<number, BlockNode[]>();

        // Create a map of children for each parent.
        for (const node of nodes) {
            if (node.parent) {
                if (!childrenMap.has(node.parent.lineNumber)) {
                    childrenMap.set(node.parent.lineNumber, []);
                }
                childrenMap.get(node.parent.lineNumber)!.push(node);
            }
        }

        const newNodes: BlockNode[] = [];
        const rootNodes: BlockNode[] = [];

        // Create new, immutable nodes with the correct children.
        for (const oldNode of nodes) {
            const newChildren = childrenMap.get(oldNode.lineNumber) || [];
            const newNode = oldNode.withChildren(newChildren);
            nodeMap.set(newNode.lineNumber, newNode);
            newNodes.push(newNode);
        }

        // Set the correct parent references on the new nodes and identify root nodes.
        for (const newNode of newNodes) {
            if (!newNode.parent) { // Only add root nodes
                rootNodes.push(newNode);
            }
        }

        return rootNodes;
    }
}
