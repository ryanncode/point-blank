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

        const linesToUpdate = new Set<number>();
        nodesToUpdate.forEach(node => linesToUpdate.add(node.lineNumber));

        // Store which decoration types were affected by the nodesToUpdate
        const affectedDecorationTypes = new Set<string>();

        // Clear decorations for the lines being updated across all decoration types
        // and collect affected types before clearing
        for (const type of this._decorations.keys()) {
            const existingDecorations = this._decorations.get(type) || [];
            const decorationsToKeep: vscode.DecorationOptions[] = [];
            for (const d of existingDecorations) {
                if (linesToUpdate.has(d.range.start.line)) {
                    affectedDecorationTypes.add(type); // Mark this type as affected
                } else {
                    decorationsToKeep.push(d);
                }
            }
            this._decorations.set(type, decorationsToKeep);
        }

        // Calculate new decorations for the updated nodes, tracking newly added types
        const newlyCalculatedTypes = new Set<string>();
        this.calculateDecorations(nodesToUpdate, newlyCalculatedTypes); // This will add new decorations to _decorations

        // Merge newly calculated types into affectedDecorationTypes
        for (const type of newlyCalculatedTypes) {
            affectedDecorationTypes.add(type);
        }

        // Apply decorations only for the types that were affected or newly calculated
        for (const type of affectedDecorationTypes) {
            activeEditor.setDecorations(this._extensionState.getDecorationType(type)!, this._decorations.get(type)!);
        }
    }

    /**
     * Updates decorations specifically for visible range changes (scrolling).
     * It adds decorations for newly visible nodes and removes decorations for nodes
     * that are no longer visible.
     * @param activeEditor The currently active text editor.
     * @param allNodes An array of all `DocumentNode` objects for the document.
     * @param visibleRanges The current visible ranges in the editor.
     */
    public updateDecorationsForScrolling(
        activeEditor: vscode.TextEditor,
        allNodes: DocumentNode[],
        visibleRanges: readonly vscode.Range[]
    ): void {
        if (!activeEditor) {
            return;
        }

        const currentlyVisibleLines = new Set<number>();
        visibleRanges.forEach(range => {
            for (let i = range.start.line; i <= range.end.line; i++) {
                currentlyVisibleLines.add(i);
            }
        });

        const newDecorations: Map<string, vscode.DecorationOptions[]> = new Map();
        for (const type of this._decorations.keys()) {
            newDecorations.set(type, []);
        }

        // Filter existing decorations to keep only those that are still visible
        for (const [type, decorations] of this._decorations.entries()) {
            const filtered = decorations.filter(d => currentlyVisibleLines.has(d.range.start.line));
            newDecorations.set(type, filtered);
        }
        this._decorations = newDecorations; // Update internal state with filtered decorations

        // Identify newly visible nodes and calculate their decorations
        const nodesToCalculate: DocumentNode[] = [];
        for (const node of allNodes) {
            if (currentlyVisibleLines.has(node.lineNumber)) {
                let isAlreadyDecorated = false;
                for (const type of this._decorations.keys()) {
                    if (this._decorations.get(type)?.some(d => d.range.start.line === node.lineNumber)) {
                        isAlreadyDecorated = true;
                        break;
                    }
                }
                if (!isAlreadyDecorated) {
                    nodesToCalculate.push(node);
                }
            }
        }

        this.calculateDecorations(nodesToCalculate);
        this.applyAllDecorations(activeEditor);
    }

    /**
     * Updates decorations specifically for a newline insertion, shifting existing decorations
     * and recalculating only for the affected lines.
     * @param activeEditor The currently active text editor.
     * @param insertedLineNumber The line number where the new line was inserted.
     * @param newNode The DocumentNode for the newly created line.
     * @param originalLineNode The DocumentNode for the original line that was split.
     */
    public updateDecorationsForNewline(
        activeEditor: vscode.TextEditor,
        insertedLineNumber: number,
        newNode: DocumentNode,
        originalLineNode: DocumentNode
    ): void {
        if (!activeEditor) {
            return;
        }

        // Shift existing decorations down by one line for all lines below the insertion point
        for (const type of this._decorations.keys()) {
            const existingDecorations = this._decorations.get(type) || [];
            const shiftedDecorations: vscode.DecorationOptions[] = [];

            for (const decoration of existingDecorations) {
                if (decoration.range.start.line >= insertedLineNumber) {
                    // Shift decoration down by one line
                    shiftedDecorations.push({
                        range: new vscode.Range(
                            decoration.range.start.line + 1,
                            decoration.range.start.character,
                            decoration.range.end.line + 1,
                            decoration.range.end.character
                        )
                    });
                } else {
                    shiftedDecorations.push(decoration);
                }
            }
            this._decorations.set(type, shiftedDecorations);
        }

        // Clear decorations for the original line and the new line using the helper
        const linesToClear = new Set<number>();
        linesToClear.add(originalLineNode.lineNumber);
        linesToClear.add(newNode.lineNumber);
        this._clearDecorationsForLines(linesToClear);

        // Recalculate and apply decorations for the affected lines
        this.calculateDecorations([originalLineNode, newNode]);
        this.applyAllDecorations(activeEditor);
    }

    /**
     * Calculates decorations for a given set of document nodes and adds them to the internal state.
     * @param nodes The document nodes to process.
     */
    private calculateDecorations(nodes: DocumentNode[], newlyAddedTypes?: Set<string>): void {
        for (const node of nodes) {
            this._calculateDecorationsForSingleNode(node, newlyAddedTypes);
        }
    }

    /**
     * Calculates decorations for a single document node and adds them to the internal state.
     * @param node The document node to process.
     * @param newlyAddedTypes An optional set to track which decoration types were added.
     */
    private _calculateDecorationsForSingleNode(node: DocumentNode, newlyAddedTypes?: Set<string>): void {
        if (node.isCodeBlockDelimiter || node.isExcluded || node.line.isEmptyOrWhitespace) {
            return;
        }

        if (node.isTypedNode && node.typedNodeRange) {
            this._decorations.get('typedNodeDecorationType')!.push({ range: node.typedNodeRange });
            newlyAddedTypes?.add('typedNodeDecorationType');
            return;
        }

        if (node.isKeyValue && node.keyValue) {
            this._decorations.get('keyValueDecorationType')!.push({ range: node.keyValue.keyRange });
            newlyAddedTypes?.add('keyValueDecorationType');
            return;
        }

        const firstCharIndex = node.indent;
        const firstChar = node.text.charAt(firstCharIndex);

        if (firstChar === '>' && node.text.charAt(firstCharIndex + 1) === ' ') {
            const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + 1);
            this._decorations.get('blockquoteDecorationType')!.push({ range });
            newlyAddedTypes?.add('blockquoteDecorationType');
            return;
        }

        if (firstChar === '*' && /\s/.test(node.text.charAt(firstCharIndex + 1))) {
            const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + 1);
            this._decorations.get('starBulletDecorationType')!.push({ range });
            newlyAddedTypes?.add('starBulletDecorationType');
            return;
        }
        if (firstChar === '+' && /\s/.test(node.text.charAt(firstCharIndex + 1))) {
            const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + 1);
            this._decorations.get('plusBulletDecorationType')!.push({ range });
            newlyAddedTypes?.add('plusBulletDecorationType');
            return;
        }
        if (firstChar === '-' && /\s/.test(node.text.charAt(firstCharIndex + 1))) {
            const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + 1);
            this._decorations.get('minusBulletDecorationType')!.push({ range });
            newlyAddedTypes?.add('minusBulletDecorationType');
            return;
        }

        const numberedMatch = node.trimmedText.match(/^(\d+[\.\)])\s*/);
        if (numberedMatch) {
            const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex + numberedMatch[1].length);
            this._decorations.get('numberedBulletDecorationType')!.push({ range });
            newlyAddedTypes?.add('numberedBulletDecorationType');
            return;
        }

        const range = new vscode.Range(node.lineNumber, firstCharIndex, node.lineNumber, firstCharIndex);
        this._decorations.get('bulletDecorationType')!.push({ range });
        newlyAddedTypes?.add('bulletDecorationType');
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

    /**
     * Clears all decorations for a specific set of lines across all decoration types.
     * This is a helper method to ensure no stale decorations remain.
     * @param linesToClear A set of line numbers for which to clear decorations.
     */
    private _clearDecorationsForLines(linesToClear: Set<number>): void {
        for (const type of this._decorations.keys()) {
            const existingDecorations = this._decorations.get(type) || [];
            const filteredDecorations = existingDecorations.filter(d => !linesToClear.has(d.range.start.line));
            this._decorations.set(type, filteredDecorations);
        }
    }
}