import * as vscode from 'vscode';
import { BlockNode } from './blockNode';
import { DocumentTree } from './documentTree';
import { isExcludedLine } from '../decorations/lineFilters'; // Assuming this is still needed for initial exclusion
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
        return withTiming(() => {
            if (changes.length === 0) {
                return previousTree;
            }

        const document = previousTree.document;
        // Determine the range of lines that need to be re-parsed.
        // This is from the first changed line to the end of the document.
        const firstChangedLine = changes.reduce((min, change) => Math.min(min, change.range.start.line), document.lineCount);

        // Get all nodes from the previous tree that are *before* the first changed line.
        const oldNodesBeforeChange = previousTree.getAllNodesFlat().filter(node => node.lineNumber < firstChangedLine);

        // Create new flat nodes for the changed and subsequent lines.
        const newlyParsedNodes = this.createFlatNodeList(document, firstChangedLine);

        // Combine the unchanged old nodes with the newly parsed nodes.
        const allNodes = [...oldNodesBeforeChange, ...newlyParsedNodes];

        // Rebuild the entire tree from the combined flat list.
        // This ensures that all parent-child relationships are correctly re-established,
        // even for newly created nodes or structural changes.
        const rootNodes = this.buildTreeFromFlatList(allNodes);
        return DocumentTree.create(document, rootNodes);
        });
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
     * This function ensures that all parent and child links point to the correct, final immutable instances.
     * @param nodes The list of all nodes with their initial parent references set.
     * @returns An array of root nodes with their children and parent references correctly populated.
     */
    private reconstructImmutableTree(nodes: BlockNode[]): BlockNode[] {
        const childrenMap = new Map<number, BlockNode[]>();
        const newNodesMap = new Map<number, BlockNode>(); // Map to store the final, immutable nodes by line number

        // Pass 1: Populate childrenMap with original nodes
        for (const node of nodes) {
            if (node.parent) {
                if (!childrenMap.has(node.parent.lineNumber)) {
                    childrenMap.set(node.parent.lineNumber, []);
                }
                childrenMap.get(node.parent.lineNumber)!.push(node);
            }
        }

        // Pass 2: Create new, immutable nodes with correct children. Iterate backwards to ensure children are processed before parents.
        const nodesInReverseOrder = [...nodes].reverse();
        for (const oldNode of nodesInReverseOrder) {
            const childrenOfOldNode = childrenMap.get(oldNode.lineNumber) || [];
            const newChildren: BlockNode[] = [];

            // Get the new instances of children from newNodesMap
            for (const child of childrenOfOldNode) {
                const newChild = newNodesMap.get(child.lineNumber);
                if (newChild) {
                    newChildren.push(newChild);
                }
            }
            const newNode = oldNode.withChildren(newChildren);
            newNodesMap.set(newNode.lineNumber, newNode);
        }

        // Pass 3: Create final nodes with correct parent references.
        // At this point, newNodesMap contains nodes with correct children, but their parents' children arrays
        // might still point to older instances. This pass ensures each node has its correct parent.
        for (const oldNode of nodes) {
            const nodeWithChildren = newNodesMap.get(oldNode.lineNumber)!;
            if (oldNode.parent) {
                const newParent = newNodesMap.get(oldNode.parent.lineNumber);
                if (newParent) {
                    // Create a new instance with the correct parent reference
                    const nodeWithCorrectParent = nodeWithChildren.withParent(newParent);
                    newNodesMap.set(nodeWithCorrectParent.lineNumber, nodeWithCorrectParent);
                }
            }
        }

        // Pass 4: Final reconciliation to ensure parent.children arrays point to the correct, final instances.
        // This is necessary because in Pass 2, children were set based on instances available then,
        // but Pass 3 might have created new instances for parents.
        const finalNodesMap = new Map<number, BlockNode>();
        for (const node of nodes) {
            const currentNode = newNodesMap.get(node.lineNumber)!;
            const newChildren: BlockNode[] = [];
            for (const child of currentNode.children) {
                const finalChild = newNodesMap.get(child.lineNumber);
                if (finalChild) {
                    newChildren.push(finalChild);
                }
            }
            const finalNode = currentNode.withChildren(newChildren);
            finalNodesMap.set(finalNode.lineNumber, finalNode);
        }

        // Identify and return the root nodes from the fully reconciled map.
        const finalRootNodes: BlockNode[] = [];
        for (const node of nodes) {
            const finalNode = finalNodesMap.get(node.lineNumber)!;
            if (!finalNode.parent) {
                finalRootNodes.push(finalNode);
            }
        }

        return finalRootNodes;
    }
}
