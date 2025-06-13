import * as vscode from 'vscode';
import { BlockNode } from '../document/blockNode';

/**
 * Calculates decoration options for a given set of document nodes.
 * This class is stateless and does not manage decoration types or apply them directly.
 */
export class DecorationCalculator {
    /**
     * Calculates decorations for a given set of document nodes and populates a map
     * with decoration options categorized by type.
     * @param nodes The document nodes to process.
     * @param decorationsMap The map to populate with calculated decorations.
     * @param totalLineCount The total number of lines in the document.
     */
    public static calculateDecorations(nodes: BlockNode[], decorationsMap: Map<string, vscode.DecorationOptions[]>): void {
        for (const node of nodes) {
            // General skip for code blocks, excluded lines, and any line VS Code considers empty/whitespace
            if (node.isCodeBlockDelimiter || node.isExcluded || node.line.isEmptyOrWhitespace) {
                continue;
            }

            if (node.isTypedNode && node.typedNodeRange) {
                decorationsMap.get('typedNodeDecorationType')!.push({ range: node.typedNodeRange });
                continue;
            }

            if (node.isKeyValue && node.keyValue) {
                decorationsMap.get('keyValueDecorationType')!.push({ range: node.keyValue.keyRange });
                continue;
            }

            const firstCharIndex = node.indent;
            const firstChar = node.text.charAt(firstCharIndex);

            switch (node.bulletType) {
                case 'blockquote': {
                    const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + 1);
                    decorationsMap.get('blockquoteDecorationType')!.push({ range });
                    break;
                }
                case 'star': {
                    const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + 1);
                    decorationsMap.get('starBulletDecorationType')!.push({ range });
                    break;
                }
                case 'plus': {
                    const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + 1);
                    decorationsMap.get('plusBulletDecorationType')!.push({ range });
                    break;
                }
                case 'minus': {
                    const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + 1);
                    decorationsMap.get('minusBulletDecorationType')!.push({ range });
                    break;
                }
                case 'numbered': {
                    // Re-calculate the length of the numbered bullet prefix
                    const numberedMatch = node.trimmedText.match(/^(\d+[\.\)])\s*/);
                    if (numberedMatch) {
                        const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + numberedMatch[1].length);
                        decorationsMap.get('numberedBulletDecorationType')!.push({ range });
                    }
                    break;
                }
                default: {
                    // Default bullet point for any line that is not otherwise decorated, but only if it has content
                    if (node.trimmedText.length > 0) {
                        // Set range to zero-width at the start of the line's content
                        const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex);
                        decorationsMap.get('bulletDecorationType')!.push({ range });
                    }
                    break;
                }
            }
        }
    }
}