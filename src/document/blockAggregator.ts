import * as vscode from 'vscode';
import { DocumentTree } from './documentTree';
import { BlockNode } from './blockNode';
import { TypedBlock } from './typedBlock';

export class BlockAggregator {
    /**
     * Finds all typed blocks within a document tree.
     * A typed block starts with a `BlockNode` that is a `keyValue` pair with `key === 'Type'`.
     * It continues with subsequent `BlockNode`s that are also `isKeyValue` and have the same or greater indentation
     * as the `Type::` line, until a non-`isKeyValue` line or a line with less indentation is encountered.
     *
     * @param documentTree The DocumentTree to search within.
     * @returns An array of `TypedBlock` objects found in the document.
     */
    public findTypedBlocks(documentTree: DocumentTree): TypedBlock[] {
        const typedBlocks: TypedBlock[] = [];
        const allNodes = documentTree.getAllNodesFlat();
        const documentUri = documentTree.document.uri;

        for (let i = 0; i < allNodes.length; i++) {
            const node = allNodes[i];

            // Check if the current node is the start of a typed block (Type:: SomeType)
            if (node.isKeyValue && node.keyValue?.key === 'Type') {
                const type = node.keyValue.value;
                const startLine = node.lineNumber;
                const properties = new Map<string, string>();
                properties.set(node.keyValue.key, node.keyValue.value);

                const typeLineIndent = node.indent;

                // Iterate through subsequent nodes to collect properties of the current typed block
                let j = i + 1;
                while (j < allNodes.length) {
                    const nextNode = allNodes[j];

                    // A block continues if it's a key-value pair and has the same or greater indentation
                    if (nextNode.isKeyValue && nextNode.indent >= typeLineIndent) {
                        if (nextNode.keyValue) {
                            properties.set(nextNode.keyValue.key, nextNode.keyValue.value);
                        }
                        j++;
                    } else {
                        // Stop if it's not a key-value pair or indentation is less
                        break;
                    }
                }

                typedBlocks.push({
                    type: type,
                    uri: documentUri,
                    startLine: startLine,
                    properties: properties
                });

                // Move the outer loop index to the end of the current block to avoid re-processing
                i = j - 1;
            }
        }

        return typedBlocks;
    }
}