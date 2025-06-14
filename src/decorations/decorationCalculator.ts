import * as vscode from 'vscode';
import { BlockNode } from '../document/blockNode';

/**
 * A stateless calculator responsible for determining which decorations to apply based on the properties of `BlockNode`s.
 * It does not manage decoration types or apply them to the editor directly.
 */
export class DecorationCalculator {
    /**
     * Iterates through a list of `BlockNode`s and populates a map with the necessary `DecorationOptions`
     * for each decoration type.
     *
     * @param nodes The `BlockNode`s to process, typically representing the visible portion of the document.
     * @param decorationsMap A map where keys are decoration type names (e.g., 'starBulletDecorationType')
     *                       and values are arrays of `DecorationOptions` to be applied.
     */
    public static calculateDecorations(nodes: BlockNode[], decorationsMap: Map<string, vscode.DecorationOptions[]>): void {
        for (const node of nodes) {
            // Skip decoration for code blocks, markdown headers, or empty lines.
            if (node.isCodeBlockDelimiter || node.isExcluded || node.line.isEmptyOrWhitespace) {
                continue;
            }

            // Handle typed nodes like `(Book)`.
            if (node.isTypedNode && node.typedNodeRange) {
                decorationsMap.get('typedNodeDecorationType')!.push({ range: node.typedNodeRange });
                continue; // Typed nodes don't have other decorations.
            }

            // Handle key-value pairs like `Author:: John Doe`.
            if (node.isKeyValue && node.keyValue) {
                decorationsMap.get('keyValueDecorationType')!.push({ range: node.keyValue.keyRange });
                continue; // Key-value pairs don't have other decorations.
            }

            // Handle various bullet point types.
            if (node.bulletRange) {
                const decorationType = this.getDecorationTypeForBullet(node.bulletType);
                if (decorationType) {
                    decorationsMap.get(decorationType)!.push({ range: node.bulletRange });
                }
            }
        }
    }

    /**
     * Maps a bullet type string to its corresponding decoration type name.
     * @param bulletType The type of the bullet from the `BlockNode`.
     * @returns The name of the decoration type, or `undefined` if no specific decoration is needed.
     */
    private static getDecorationTypeForBullet(bulletType: BlockNode['bulletType']): string | undefined {
        switch (bulletType) {
            case 'blockquote': return 'blockquoteDecorationType';
            case 'star': return 'starBulletDecorationType';
            case 'plus': return 'plusBulletDecorationType';
            case 'minus': return 'minusBulletDecorationType';
            case 'numbered': return 'numberedBulletDecorationType';
            // 'atSign', 'default', and 'none' types do not have specific decorations.
            default: return undefined;
        }
    }
}