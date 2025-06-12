import * as vscode from 'vscode';
import { BlockNode } from '../document/blockNode'; // Use BlockNode
import { DocumentTree } from '../document/documentTree'; // Import DocumentTree
import { DecorationCalculator } from './decorationCalculator';
import { ExtensionState } from '../state/extensionState';
import { debounce } from '../utils/debounce';

/**
 * Manages and applies text editor decorations based on document changes.
 * It orchestrates the decoration updates in a flicker-free manner.
 */
export class DecorationManager {
    private _extensionState: ExtensionState;
    private _decorationTypes: Map<string, vscode.TextEditorDecorationType> = new Map();
    private _disposables: vscode.Disposable[] = [];
    // Stores the currently applied decorations, categorized by type
    private _currentDecorations: Map<string, vscode.DecorationOptions[]> = new Map();

    // Debounced function for general decoration updates, now including visible ranges
    private _debouncedUpdateDecorations: (editor: vscode.TextEditor, tree: DocumentTree, changedRange: vscode.Range, visibleRanges?: readonly vscode.Range[]) => void;

    constructor() {
        this._extensionState = ExtensionState.getInstance();
        // Single debounced update function for all decoration changes
        this._debouncedUpdateDecorations = debounce(this.applyDecorationsInternal.bind(this), 50);
    }

    /**
     * Initializes the DecorationManager by setting up decoration types and event listeners.
     * This should be called after the Configuration has initialized decoration types in ExtensionState.
     */
    public initialize(): void {
        this.initializeDecorationTypesInternal();

        // Listen for selection changes (for cursor positioning)
        vscode.window.onDidChangeTextEditorSelection(this.onDidChangeTextEditorSelection, this, this._disposables);
        // Listen for visible range changes (for viewport-aware rendering)
        vscode.window.onDidChangeTextEditorVisibleRanges(this.onDidChangeTextEditorVisibleRanges, this, this._disposables);
    }

    private initializeDecorationTypesInternal(): void {
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
                // Initialize _currentDecorations map with empty arrays for each type
                this._currentDecorations.set(typeName, []);
            }
        }
    }

    /**
     * Main entry point for updating decorations. This method should be called
     * by DocumentModel whenever the document tree changes.
     * It uses a debounced mechanism to prevent excessive updates.
     * @param tree The current `DocumentTree`.
     * @param changedRange The range of lines that have changed in the document.
     * @param visibleRanges Optional: The currently visible ranges in the editor. If not provided, current editor's visible ranges will be used.
     */
    public updateDecorations(tree: DocumentTree, changedRange: vscode.Range, visibleRanges?: readonly vscode.Range[]): void {
        const activeEditor = this._extensionState.activeEditor;
        if (!activeEditor || activeEditor.document.uri.toString() !== tree.document.uri.toString()) {
            return;
        }
        this._debouncedUpdateDecorations(activeEditor, tree, changedRange, visibleRanges);
    }

    private onDidChangeTextEditorVisibleRanges(event: vscode.TextEditorVisibleRangesChangeEvent): void {
        const activeEditor = this._extensionState.activeEditor;
        if (activeEditor && event.textEditor === activeEditor) {
            const documentModel = this._extensionState.getDocumentModel(activeEditor.document.uri.toString());
            if (documentModel) {
                // Trigger an update, passing the new visible ranges
                this.updateDecorations(documentModel.documentTree, new vscode.Range(0, 0, activeEditor.document.lineCount, 0), event.visibleRanges);
            }
        }
    }

    // Removed onDidChangeTextEditorVisibleRanges as it's now handled by the unified updateDecorations
    // and the debounced nature of applyDecorationsInternal.

    private onDidChangeTextEditorSelection(event: vscode.TextEditorSelectionChangeEvent): void {
        const activeEditor = this._extensionState.activeEditor;
        if (activeEditor && event.textEditor === activeEditor) {
            // Handle cursor positioning to prevent typing before bullet points
            const editor = event.textEditor;
            const document = editor.document;
            const selection = editor.selection;

            if (selection.isEmpty) { // Only act if there's a single cursor
                const currentLine = document.lineAt(selection.active.line);
                const firstCharIndex = currentLine.firstNonWhitespaceCharacterIndex;

                // Check if the current line has a bullet point (simple check for common bullet types)
                const hasBullet = currentLine.text.substring(firstCharIndex, firstCharIndex + 2).match(/^(\*|\-|\+|\d+\.|\d+\))\s/);

                if (hasBullet) {
                    const bulletEndPosition = firstCharIndex + hasBullet[0].length;
                    // If cursor is before the end of the bullet point, move it after
                    if (selection.active.character < bulletEndPosition) {
                        const newPosition = new vscode.Position(selection.active.line, bulletEndPosition);
                        editor.selection = new vscode.Selection(newPosition, newPosition);
                    }
                }
            }
        }
    }

    /**
     * Internal method to calculate and apply decorations. This is the core
     * logic that gets debounced.
     * @param editor The active text editor.
     * @param tree The current `DocumentTree`.
     * @param changedRange The range of lines that have changed.
     * @param visibleRanges The currently visible ranges in the editor.
     */
    private applyDecorationsInternal(editor: vscode.TextEditor, tree: DocumentTree, _changedRange: vscode.Range, visibleRanges?: readonly vscode.Range[]): void {
        if (!editor) {
            return;
        }

        const bufferLines = 5; // Number of lines to extend above and below the visible range

        // 1. Determine the actual range of lines that need to be re-evaluated for decorations.
        // This is the union of the visible ranges and the changed range, expanded by a buffer.
        let effectiveStartLine = editor.document.lineCount;
        let effectiveEndLine = 0;

        // Include visible ranges
        const currentVisibleRanges = visibleRanges && visibleRanges.length > 0 ? visibleRanges : [new vscode.Range(0, 0, editor.document.lineCount, 0)];
        for (const range of currentVisibleRanges) {
            effectiveStartLine = Math.min(effectiveStartLine, range.start.line);
            effectiveEndLine = Math.max(effectiveEndLine, range.end.line);
        }

        // Include changed range
        effectiveStartLine = Math.min(effectiveStartLine, _changedRange.start.line);
        effectiveEndLine = Math.max(effectiveEndLine, _changedRange.end.line);

        // Apply buffer
        effectiveStartLine = Math.max(0, effectiveStartLine - bufferLines);
        effectiveEndLine = Math.min(editor.document.lineCount - 1, effectiveEndLine + bufferLines);

        const effectiveRange = new vscode.Range(effectiveStartLine, 0, effectiveEndLine, editor.document.lineAt(effectiveEndLine).text.length);

        // 2. Get nodes within this effective range
        const nodesToRecalculate = tree.getNodesInLineRange(effectiveRange.start.line, effectiveRange.end.line);

        // 3. Calculate new decorations for this effective range
        const recalculatedDecorationsForEffectiveRange = new Map<string, vscode.DecorationOptions[]>();
        for (const key of this._decorationTypes.keys()) {
            recalculatedDecorationsForEffectiveRange.set(key, []);
        }
        DecorationCalculator.calculateDecorations(nodesToRecalculate, recalculatedDecorationsForEffectiveRange);

        // 4. Update _currentDecorations:
        //    a. Remove all old decorations that intersect with the effectiveRange.
        //    b. Add the newly calculated decorations for the effectiveRange.
        for (const [typeName, currentOptions] of this._currentDecorations.entries()) {
            // Filter out old decorations that are within the effective range
            const filteredOptions = currentOptions.filter(option => !effectiveRange.intersection(option.range));
            this._currentDecorations.set(typeName, filteredOptions);

            // Add the newly calculated decorations for this type within the effective range
            const newOptionsForType = recalculatedDecorationsForEffectiveRange.get(typeName) || [];
            this._currentDecorations.set(typeName, [...(this._currentDecorations.get(typeName) || []), ...newOptionsForType]);
        }

        // 5. Apply the *entire* _currentDecorations to the editor
        for (const [typeName, decorationType] of this._decorationTypes.entries()) {
            const optionsToApply = this._currentDecorations.get(typeName) || [];
            editor.setDecorations(decorationType, optionsToApply);
        }
    }

    /**
     * Disposes of all resources held by the DecorationManager.
     */
    public dispose(): void {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
        this._currentDecorations.clear();
        // Dispose of decoration types to prevent memory leaks
        this._decorationTypes.forEach(type => type.dispose());
        this._decorationTypes.clear();
    }
}