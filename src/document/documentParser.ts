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

            const newNode = new BlockNode(line, i, isLineExcluded, undefined, [], 'none', undefined);
            flatNodes.push(newNode);
        }

        const rootNodes = this.buildTreeFromFlatList(flatNodes);
        const tree = DocumentTree.create(document, rootNodes);
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

            const newNode = new BlockNode(line, i, isLineExcluded, undefined, [], 'none', undefined);
            nodes.push(newNode);
        }
        return nodes;
    }

    /**
     * Reconstructs the parent/child hierarchy from a flat list of nodes based on indentation and header levels.
     */
    private buildTreeFromFlatList(nodes: BlockNode[]): BlockNode[] {
        interface TempMutableNode {
            original: BlockNode; // Reference to the original immutable BlockNode
            parent?: TempMutableNode;
            children: TempMutableNode[];
            lineNumber: number;
            indent: number;
            trimmedText: string;
            isExcluded: boolean;
            isCodeBlockDelimiter: boolean;
            headerLevel: number;
        }

        const mutableRootNodes: TempMutableNode[] = [];
        const parentStack: TempMutableNode[] = []; // Stores potential parent mutable nodes

        // Single Pass: Build a Mutable Tree based on indentation and header levels
        for (const node of nodes) {
            const mutableNode: TempMutableNode = {
                original: node,
                children: [],
                lineNumber: node.lineNumber,
                indent: node.indent,
                trimmedText: node.trimmedText,
                isExcluded: node.isExcluded,
                isCodeBlockDelimiter: node.trimmedText.startsWith('```'),
                headerLevel: DocumentParser.getHeaderLevel(node.text) // Use node.text (untrimmed)
            };

            // Pop parents from stack if current node is less indented or same indentation
            while (parentStack.length > 0 && mutableNode.indent <= parentStack[parentStack.length - 1].indent) {
                parentStack.pop();
            }

            const potentialParent = parentStack.length > 0 ? parentStack[parentStack.length - 1] : undefined;

            if (potentialParent) {
                mutableNode.parent = potentialParent;
                potentialParent.children.push(mutableNode);
            } else {
                mutableRootNodes.push(mutableNode);
            }

            // Push current node onto stack as potential parent for subsequent nodes
            // Only push if it's not an excluded line (like code blocks)
            if (!mutableNode.isExcluded && !mutableNode.isCodeBlockDelimiter) {
                parentStack.push(mutableNode);
            }
        }

        // Convert to an Immutable Tree (bottom-up)
        const immutableNodeMap = new Map<TempMutableNode, BlockNode>();

        const convertToImmutable = (mutableNode: TempMutableNode): BlockNode => {
            if (immutableNodeMap.has(mutableNode)) {
                return immutableNodeMap.get(mutableNode)!;
            }

            // Recursively convert children first
            const immutableChildren: BlockNode[] = mutableNode.children.map(child => convertToImmutable(child));

            // Create the immutable BlockNode
            const immutableBlockNode = new BlockNode(
                mutableNode.original.line,
                mutableNode.lineNumber,
                mutableNode.isExcluded,
                undefined, // Parent will be set by its own parent's conversion
                immutableChildren,
                mutableNode.original.bulletType, // Pass existing bulletType
                mutableNode.original.bulletRange // Pass existing bulletRange
            );

            immutableNodeMap.set(mutableNode, immutableBlockNode);

            // Now that the immutable node exists, update its children's parent references
            // This is crucial for the immutable BlockNode's parent property to be correct
            const updatedChildrenWithParents: BlockNode[] = immutableChildren.map(child => {
                if (child.parent !== immutableBlockNode) {
                    return child.withParent(immutableBlockNode);
                }
                return child;
            });

            // Create a new immutableBlockNode with correctly parented children
            const finalImmutableBlockNode = immutableBlockNode.withChildren(updatedChildrenWithParents);
            immutableNodeMap.set(mutableNode, finalImmutableBlockNode); // Update map with the final version

            return finalImmutableBlockNode;
        };

        const finalImmutableRootNodes: BlockNode[] = mutableRootNodes.map(root => convertToImmutable(root));

        return finalImmutableRootNodes;
    }

    /**
     * Determines the header level of a given text line.
     * Returns 0 if the line is not a markdown header.
     * @param text The full text of the line (untrimmed).
     * @returns The header level (1-6) or 0 if not a header.
     */
    private static getHeaderLevel(text: string): number {
        // Markdown ATX headers can be preceded by up to 3 spaces.
        // Must be followed by a space.
        const match = text.match(/^[ ]{0,3}(#+)\s/);
        if (match) {
            return match[1].length;
        }
        return 0;
    }
}
