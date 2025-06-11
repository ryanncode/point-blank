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
    private _activeEditor: vscode.TextEditor | undefined;
    private _disposables: vscode.Disposable[] = [];
    // Stores the currently applied decorations, categorized by type
    private _currentDecorations: Map<string, vscode.DecorationOptions[]> = new Map();

    // Debounced function for general decoration updates
    private _debouncedUpdateDecorations: (editor: vscode.TextEditor, tree: DocumentTree, changedRange: vscode.Range) => void;

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

        // Listen for active editor changes
        vscode.window.onDidChangeActiveTextEditor(this.onDidChangeActiveTextEditor, this, this._disposables);
        // Listen for selection changes (for cursor positioning)
        vscode.window.onDidChangeTextEditorSelection(this.onDidChangeTextEditorSelection, this, this._disposables);

        // Set initial active editor
        this.setActiveEditor(vscode.window.activeTextEditor);
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

    public setActiveEditor(editor: vscode.TextEditor | undefined): void {
        if (this._activeEditor === editor) {
            return;
        }
        this._activeEditor = editor;
        if (editor) {
            // When active editor changes, trigger a full re-render
            const documentModel = this._extensionState.getDocumentModel(editor.document.uri.toString());
            if (documentModel) {
                this.updateDecorations(documentModel.documentTree, new vscode.Range(0, 0, editor.document.lineCount, 0));
            }
        }
    }

    /**
     * Main entry point for updating decorations. This method should be called
     * by DocumentModel whenever the document tree changes.
     * It uses a debounced mechanism to prevent excessive updates.
     * @param tree The current `DocumentTree`.
     * @param changedRange The range of lines that have changed in the document.
     */
    public updateDecorations(tree: DocumentTree, changedRange: vscode.Range): void {
        if (!this._activeEditor || this._activeEditor.document.uri.toString() !== tree.document.uri.toString()) {
            return;
        }
        this._debouncedUpdateDecorations(this._activeEditor, tree, changedRange);
    }

    private onDidChangeActiveTextEditor(editor: vscode.TextEditor | undefined): void {
        this.setActiveEditor(editor);
    }

    // Removed onDidChangeTextEditorVisibleRanges as it's now handled by the unified updateDecorations
    // and the debounced nature of applyDecorationsInternal.

    private onDidChangeTextEditorSelection(event: vscode.TextEditorSelectionChangeEvent): void {
        if (this._activeEditor && event.textEditor === this._activeEditor) {
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
     */
    private applyDecorationsInternal(editor: vscode.TextEditor, tree: DocumentTree, _changedRange: vscode.Range): void {
        if (!editor) {
            return;
        }

        // Always recalculate and apply decorations for the entire document.
        // VS Code is optimized to diff and render changes efficiently, preventing flicker.
        const allNodes = tree.getAllNodesFlat();
        const newCalculatedDecorations = new Map<string, vscode.DecorationOptions[]>();

        for (const key of this._decorationTypes.keys()) {
            newCalculatedDecorations.set(key, []);
        }

        DecorationCalculator.calculateDecorations(allNodes, newCalculatedDecorations);

        // Apply all decorations for each type. This replaces any previously set decorations.
        for (const [typeName, decorationType] of this._decorationTypes.entries()) {
            const options = newCalculatedDecorations.get(typeName) || [];
            editor.setDecorations(decorationType, options);
            this._currentDecorations.set(typeName, options); // Update internal state to reflect what's applied
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