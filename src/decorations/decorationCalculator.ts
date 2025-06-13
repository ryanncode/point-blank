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
                case 'blockquote':
                case 'star':
                case 'plus':
                case 'minus':
                case 'numbered': {
                    if (node.bulletRange) {
                        let decorationType: string;
                        switch (node.bulletType) {
                            case 'blockquote':
                                decorationType = 'blockquoteDecorationType';
                                break;
                            case 'star':
                                decorationType = 'starBulletDecorationType';
                                break;
                            case 'plus':
                                decorationType = 'plusBulletDecorationType';
                                break;
                            case 'minus':
                                decorationType = 'minusBulletDecorationType';
                                break;
                            case 'numbered':
                                decorationType = 'numberedBulletDecorationType';
                                break;
                            default:
                                continue; // Should not happen
                        }
                        decorationsMap.get(decorationType)!.push({ range: node.bulletRange });
                    }
                    break;
                }
                case 'atSign': {
                    // No decoration for '@' as per requirement
                    break;
                }
                case 'atSign': {
                    // No decoration for '@' as per requirement
                    break;
                }
                case 'default': {
                    if (node.bulletRange) {
                        decorationsMap.get('bulletDecorationType')!.push({ range: node.bulletRange });
                    }
                    break;
                }
            }
        }
    }
}