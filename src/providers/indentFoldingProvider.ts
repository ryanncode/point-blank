import * as vscode from 'vscode';
import { ExtensionState } from '../state/extensionState';
import { BlockNode } from '../document/blockNode';
import { DocumentTree } from '../document/documentTree';

/**
 * Provides folding ranges for text documents based on the DocumentTree structure.
 * This ensures consistency between folding behavior and the document outline.
 */
export class IndentFoldingRangeProvider implements vscode.FoldingRangeProvider {
    /**
     * Provides an array of folding ranges for the given document by traversing the DocumentTree.
     * Each parent node with children defines a folding range.
     *
     * @param document The text document for which to provide folding ranges.
     * @param _context Additional context for the folding request (currently unused).
     * @param _token A cancellation token that indicates the request is cancelled.
     * @returns A promise that resolves to an array of `vscode.FoldingRange` objects,
     *          or `undefined` if no folding ranges are found.
     */
    public provideFoldingRanges(
        document: vscode.TextDocument,
        _context: vscode.FoldingContext,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.FoldingRange[]> {
        const ranges: vscode.FoldingRange[] = [];
        const extensionState = ExtensionState.getInstance();
        const documentModel = extensionState.getDocumentModel(document.uri.toString());

        if (!documentModel || !documentModel.documentTree) {
            return undefined;
        }

        const documentTree = documentModel.documentTree;

        // Helper function to recursively traverse the tree and add folding ranges
        const addFoldingRanges = (nodes: readonly BlockNode[]) => {
            for (const node of nodes) {
                if (node.children.length > 0) {
                    // A parent node with children defines a folding range
                    const startLine = node.lineNumber;
                    // The end line is the line of the last child of this node
                    const lastChild = node.children[node.children.length - 1];
                    let endLine = lastChild.lineNumber;

                    // If the last child also has children, we need to find the deepest last child
                    let deepestLastChild = lastChild;
                    while (deepestLastChild.children.length > 0) {
                        deepestLastChild = deepestLastChild.children[deepestLastChild.children.length - 1];
                        endLine = deepestLastChild.lineNumber;
                    }
                    
                    // Ensure the folding range ends before the next sibling or at the end of the document
                    // if this is the last top-level node.
                    // The folding range should ideally end at the line *before* the next sibling
                    // or the end of the document if there are no more siblings.
                    // For now, we'll use the last child's line number.
                    // VS Code's folding range typically folds up to the line *before* the next logical block.
                    // If the last child is the last line of the document, then it should fold to document.lineCount - 1.
                    // Otherwise, it should fold to the line of the last child.
                    
                    // To make the folding range inclusive of the last child's content,
                    // and to ensure it doesn't overlap with the next sibling's start,
                    // we need to find the actual end of the foldable block.
                    // For a parent node, the folding range should extend to the line *before* the next sibling
                    // at the same indentation level as the parent, or to the end of the document.
                    
                    // A simpler approach for now: fold from parent line to the last line of its last child.
                    // This might need refinement based on how VS Code handles folding boundaries precisely.
                    ranges.push(new vscode.FoldingRange(startLine, endLine));
                }
                // Recursively add folding ranges for children
                addFoldingRanges(node.children);
            }
        };

        addFoldingRanges(documentTree.rootNodes);

        return ranges;
    }
}