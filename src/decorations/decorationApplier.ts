import * as vscode from 'vscode';
import { ExtensionState } from '../state/extensionState';
import { DocumentNode } from '../document/documentNode';

/**
 * Manages and applies text editor decorations for bullet points and other outline elements.
 * This class encapsulates the logic for analyzing document lines and applying appropriate
 * visual styles based on content and formatting. It maintains the state of decorations
 * to allow for incremental updates.
 */
export class DecorationApplier {
    private _extensionState: ExtensionState;
    private _decorations: Map<string, vscode.DecorationOptions[]> = new Map();

    constructor() {
        this._extensionState = ExtensionState.getInstance();
        // Initialize the decorations map with all known decoration types
        const decorationTypes = [
            'bulletDecorationType',
            'starBulletDecorationType',
            'plusBulletDecorationType',
            'minusBulletDecorationType',
            'numberedBulletDecorationType',
            'blockquoteDecorationType',
            'keyValueDecorationType',
            'typedNodeDecorationType'
        ];
        for (const type of decorationTypes) {
            this._decorations.set(type, []);
        }
    }

    /**
     * Performs a full update of all decorations, typically on document open, focus change, or major change.
     * It clears all existing decorations and recalculates them for the visible nodes.
     * @param activeEditor The currently active text editor.
     * @param parsedNodes An array of all `DocumentNode` objects for the document.
     */
    public updateDecorationsForFullRender(activeEditor: vscode.TextEditor | undefined, parsedNodes: DocumentNode[]): void {
        if (!activeEditor) {
            return;
        }

        // Clear all decorations for a full update
        for (const key of this._decorations.keys()) {
            this._decorations.set(key, []);
        }

        const visibleNodes = parsedNodes.filter(node =>
            activeEditor.visibleRanges.some(range =>
                range.start.line <= node.lineNumber && node.lineNumber <= range.end.line
            )
        );

        this.calculateDecorations(visibleNodes);
        this.applyAllDecorations(activeEditor);
    }

    /**
     * Updates decorations for a specific set of lines, used for immediate feedback on typing.
     * It removes old decorations for the specified lines and calculates new ones.
     * @param activeEditor The currently active text editor.
     * @param nodesToUpdate An array of `DocumentNode` objects for the lines to be updated.
     */
    public updateDecorationsForNodes(activeEditor: vscode.TextEditor | undefined, nodesToUpdate: DocumentNode[]): void {
        if (!activeEditor) {
            return;
        }

        // Remove old decorations for the lines being updated
        const linesToUpdate = nodesToUpdate.map(n => n.lineNumber);
        for (const type of this._decorations.keys()) {
            const existingDecorations = this._decorations.get(type) || [];
            const newDecorations = existingDecorations.filter(d => !linesToUpdate.includes(d.range.start.line));
            this._decorations.set(type, newDecorations);
        }

        this.calculateDecorations(nodesToUpdate);
        this.applyAllDecorations(activeEditor);
    }

    /**
     * Calculates decorations for a given set of document nodes and adds them to the internal state.
     * @param nodes The document nodes to process.
     */
    private calculateDecorations(nodes: DocumentNode[]): void {
        for (const node of nodes) {
            if (node.isCodeBlockDelimiter || node.isExcluded || node.line.isEmptyOrWhitespace) {
                continue;
            }

            if (node.isTypedNode && node.typedNodeRange) {
                this._decorations.get('typedNodeDecorationType')!.push({ range: node.typedNodeRange });
                continue;
            }

            if (node.isKeyValue && node.keyValue) {
                this._decorations.get('keyValueDecorationType')!.push({ range: node.keyValue.keyRange });
                continue;
            }

            const firstCharIndex = node.indent;
            const firstChar = node.text.charAt(firstCharIndex);

            if (firstChar === '>' && node.text.charAt(firstCharIndex + 1) === ' ') {
                const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + 1);
                this._decorations.get('blockquoteDecorationType')!.push({ range });
                continue;
            }

            if (firstChar === '*' && node.text.charAt(firstCharIndex + 1) === ' ') {
                const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + 1);
                this._decorations.get('starBulletDecorationType')!.push({ range });
                continue;
            }
            if (firstChar === '+' && node.text.charAt(firstCharIndex + 1) === ' ') {
                const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + 1);
                this._decorations.get('plusBulletDecorationType')!.push({ range });
                continue;
            }
            if (firstChar === '-' && node.text.charAt(firstCharIndex + 1) === ' ') {
                const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + 1);
                this._decorations.get('minusBulletDecorationType')!.push({ range });
                continue;
            }

            const numberedMatch = node.trimmedText.match(/^(\d+[\.\)])\s*/);
            if (numberedMatch) {
                const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + numberedMatch[1].length);
                this._decorations.get('numberedBulletDecorationType')!.push({ range });
                continue;
            }

            const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex);
            this._decorations.get('bulletDecorationType')!.push({ range });
        }
    }

    /**
     * Applies all decorations from the internal state to the editor.
     * @param activeEditor The text editor to apply decorations to.
     */
    private applyAllDecorations(activeEditor: vscode.TextEditor): void {
        for (const [type, decorations] of this._decorations.entries()) {
            activeEditor.setDecorations(this._extensionState.getDecorationType(type)!, decorations);
        }
    }
}