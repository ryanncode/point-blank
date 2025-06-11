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

        return DocumentTree.create(document, flatNodes);
    }

    /**
     * Performs an incremental parse of the document based on changes.
     * This method intelligently updates the existing DocumentTree to create a new, immutable tree.
     * @param previousTree The previous `DocumentTree` instance.
     * @param changes The `vscode.TextDocumentContentChangeEvent` array.
     * @returns A new `DocumentTree` instance reflecting the changes.
     */
    public parse(previousTree: DocumentTree, _changes: readonly vscode.TextDocumentContentChangeEvent[]): DocumentTree {
        // For simplicity in the initial refactoring, a full parse is performed for any change.
        // The true incremental parsing logic will be implemented in a later iteration.
        // This ensures correctness while we establish the new data structures.
        return this.fullParse(previousTree.document);
    }
}
