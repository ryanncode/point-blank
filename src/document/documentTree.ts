import * as vscode from 'vscode';
import { BlockNode } from './blockNode';

/**
 * Represents the immutable tree structure of a document, composed of BlockNodes.
 * This class acts as the single source of truth for the document's parsed state.
 */
export class DocumentTree {
    public readonly rootNodes: readonly BlockNode[];
    public readonly document: vscode.TextDocument;

    // A flat map for quick lookup of nodes by line number
    private readonly _nodesByLine: Map<number, BlockNode>;

    constructor(document: vscode.TextDocument, rootNodes: BlockNode[]) {
        this.document = document;
        this.rootNodes = rootNodes;
        this._nodesByLine = new Map<number, BlockNode>();
        this.populateNodesByLine(rootNodes);
    }

    /**
     * Populates the internal map for quick lookup of nodes by line number.
     * This is done recursively for all nodes in the tree.
     */
    private populateNodesByLine(nodes: readonly BlockNode[]): void {
        for (const node of nodes) {
            this._nodesByLine.set(node.lineNumber, node);
            if (node.children.length > 0) {
                this.populateNodesByLine(node.children);
            }
        }
    }

    /**
     * Retrieves a BlockNode by its line number.
     * @param lineNumber The line number of the desired node.
     * @returns The BlockNode at the specified line number, or undefined if not found.
     */
    public getNodeAtLine(lineNumber: number): BlockNode | undefined {
        return this._nodesByLine.get(lineNumber);
    }

    /**
     * Returns all BlockNodes in a flat array, ordered by line number.
     * This is useful for operations that need to iterate over all lines,
     * such as decoration calculation for the entire document.
     */
    public getAllNodesFlat(): BlockNode[] {
        const allNodes: BlockNode[] = [];
        // Iterate through the map which maintains insertion order (by line number)
        for (const node of this._nodesByLine.values()) {
            allNodes.push(node);
        }
        return allNodes;
    }

    /**
     * Returns all BlockNodes within a specified line number range, ordered by line number.
     * This is useful for operations that need to process only a visible portion of the document.
     * @param startLine The starting line number (inclusive).
     * @param endLine The ending line number (inclusive).
     * @returns An array of BlockNodes within the specified range.
     */
    public getNodesInLineRange(startLine: number, endLine: number): BlockNode[] {
        const nodesInRange: BlockNode[] = [];
        for (let i = startLine; i <= endLine; i++) {
            const node = this._nodesByLine.get(i);
            if (node) {
                nodesInRange.push(node);
            }
        }
        return nodesInRange;
    }

    /**
     * Creates a new DocumentTree instance with updated root nodes.
     * This is used by the incremental parser to return a new immutable tree.
     */
    public static create(document: vscode.TextDocument, rootNodes: BlockNode[]): DocumentTree {
        return new DocumentTree(document, rootNodes);
    }
}