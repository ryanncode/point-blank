import * as vscode from 'vscode';
import { BlockNode } from './blockNode';

/**
 * An immutable representation of the document's hierarchical structure, composed of `BlockNode`s.
 * It provides efficient methods for accessing nodes, which is crucial for features like
 * decoration rendering and command logic.
 */
export class DocumentTree {
    public readonly rootNodes: readonly BlockNode[];
    public readonly document: vscode.TextDocument;

    // A map for O(1) lookup of nodes by their line number.
    private readonly _nodesByLine: Map<number, BlockNode>;
    // A sorted array of all nodes for efficient range-based lookups.
    private readonly _allNodesSorted: readonly BlockNode[];

    private constructor(document: vscode.TextDocument, rootNodes: BlockNode[]) {
        this.document = document;
        this.rootNodes = rootNodes;
        this._nodesByLine = new Map<number, BlockNode>();

        // Populate the lookup map and the sorted array in a single traversal.
        const allNodes: BlockNode[] = [];
        const stack: BlockNode[] = [...rootNodes].reverse(); // Use reverse for depth-first traversal order.

        while (stack.length > 0) {
            const node = stack.pop()!;
            allNodes.push(node);
            this._nodesByLine.set(node.lineNumber, node);
            // Add children to the stack in reverse order to maintain correct traversal.
            for (let i = node.children.length - 1; i >= 0; i--) {
                stack.push(node.children[i]);
            }
        }
        this._allNodesSorted = allNodes;
    }

    /**
     * Retrieves a `BlockNode` by its line number using a direct map lookup.
     * @param lineNumber The line number of the desired node.
     * @returns The `BlockNode` at the specified line, or `undefined` if not found.
     */
    public getNodeAtLine(lineNumber: number): BlockNode | undefined {
        return this._nodesByLine.get(lineNumber);
    }

    /**
     * Returns a flat array of all `BlockNode`s in the tree, ordered by line number.
     */
    public getAllNodesFlat(): readonly BlockNode[] {
        return this._allNodesSorted;
    }

    /**
     * Efficiently returns all `BlockNode`s within a specified line number range.
     * This is optimized for viewport-aware features.
     * @param startLine The starting line number (inclusive).
     * @param endLine The ending line number (inclusive).
     * @returns An array of `BlockNode`s within the specified range.
     */
    public getNodesInLineRange(startLine: number, endLine: number): BlockNode[] {
        // This could be further optimized with a binary search if performance becomes an issue.
        const nodesInRange: BlockNode[] = [];
        for (const node of this._allNodesSorted) {
            if (node.lineNumber >= startLine && node.lineNumber <= endLine) {
                nodesInRange.push(node);
            }
            if (node.lineNumber > endLine) {
                break; // Stop iterating once we've passed the desired range.
            }
        }
        return nodesInRange;
    }

    /**
     * A static factory method to create a new `DocumentTree` instance.
     * This is used by the `DocumentParser` to construct a new tree after parsing.
     * @param document The `vscode.TextDocument` the tree represents.
     * @param rootNodes The array of root-level `BlockNode`s.
     * @returns A new `DocumentTree` instance.
     */
    public static create(document: vscode.TextDocument, rootNodes: BlockNode[]): DocumentTree {
        return new DocumentTree(document, rootNodes);
    }
}