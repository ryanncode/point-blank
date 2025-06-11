import * as vscode from 'vscode';
import { ExtensionState } from '../state/extensionState';
import { DocumentNode } from '../document/documentNode';

/**
 * Manages and applies text editor decorations for bullet points and other outline elements.
 * This class is stateless and focuses solely on calculating and applying decorations
 * based on the current set of DocumentNodes. It does not maintain an internal cache
 * of applied decorations.
 */
export class DecorationRenderer {
    private _extensionState: ExtensionState;
    private _decorationTypes: Map<string, vscode.TextEditorDecorationType> = new Map();

    constructor() {
        this._extensionState = ExtensionState.getInstance();
        // Initialize and store decoration types for efficient access
        const decorationTypeNames = [
            'bulletDecorationType',
            'starBulletDecorationType',
            'plusBulletDecorationType',
            'minusBulletDecorationType',
            'numberedBulletDecorationType',
            'blockquoteDecorationType',
            'keyValueDecorationType',
            'typedNodeDecorationType'
        ];
        for (const typeName of decorationTypeNames) {
            const decorationType = this._extensionState.getDecorationType(typeName);
            if (decorationType) {
                this._decorationTypes.set(typeName, decorationType);
            }
        }
    }

    /**
     * Calculates decorations for a given set of document nodes and populates a map
     * with decoration options categorized by type.
     * @param nodes The document nodes to process.
     * @param decorationsMap The map to populate with calculated decorations.
     */
    public calculateDecorations(nodes: DocumentNode[], decorationsMap: Map<string, vscode.DecorationOptions[]>): void {
        // Ensure all decoration types are initialized in the map
        for (const typeName of this._decorationTypes.keys()) {
            if (!decorationsMap.has(typeName)) {
                decorationsMap.set(typeName, []);
            }
        }

        for (const node of nodes) {
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

            if (firstChar === '>' && node.text.charAt(firstCharIndex + 1) === ' ') {
                const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + 1);
                decorationsMap.get('blockquoteDecorationType')!.push({ range });
                continue;
            }

            if (firstChar === '*' && /\s/.test(node.text.charAt(firstCharIndex + 1))) {
                const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + 1);
                decorationsMap.get('starBulletDecorationType')!.push({ range });
                continue;
            }
            if (firstChar === '+' && /\s/.test(node.text.charAt(firstCharIndex + 1))) {
                const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + 1);
                decorationsMap.get('plusBulletDecorationType')!.push({ range });
                continue;
            }
            if (firstChar === '-' && /\s/.test(node.text.charAt(firstCharIndex + 1))) {
                const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + 1);
                decorationsMap.get('minusBulletDecorationType')!.push({ range });
                continue;
            }

            const numberedMatch = node.trimmedText.match(/^(\d+[\.\)])\s*/);
            if (numberedMatch) {
                const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + numberedMatch[1].length);
                decorationsMap.get('numberedBulletDecorationType')!.push({ range });
                continue;
            }

            // Default bullet point for any line that is not otherwise decorated
            const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex);
            decorationsMap.get('bulletDecorationType')!.push({ range });
        }
    }

    /**
     * Applies the given decorations to the text editor. This method clears all
     * previously applied decorations of the managed types and then applies the new ones.
     * @param editor The text editor to apply decorations to.
     * @param decorationsToApply A map of decoration types to their corresponding decoration options.
     */
    public applyDecorations(editor: vscode.TextEditor, decorationsToApply: Map<string, vscode.DecorationOptions[]>): void {
        for (const [typeName, decorationType] of this._decorationTypes.entries()) {
            const options = decorationsToApply.get(typeName) || [];
            editor.setDecorations(decorationType, options);
        }
    }

    /**
     * Disposes of all managed decoration types.
     */
    public dispose(): void {
        for (const decorationType of this._decorationTypes.values()) {
            decorationType.dispose();
        }
        this._decorationTypes.clear();
    }
}