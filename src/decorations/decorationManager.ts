import * as vscode from 'vscode';
import { DocumentNode } from '../document/documentNode';
import { DecorationCalculator } from './decorationCalculator';
import { ExtensionState } from '../state/extensionState';
import { debounce } from '../utils/debounce';

/**
 * Manages and applies text editor decorations based on document changes,
 * visible range changes, and selection changes. It orchestrates the
 * decoration updates with different debounce timings.
 */
export class DecorationManager {
    private _extensionState: ExtensionState;
    private _decorationTypes: Map<string, vscode.TextEditorDecorationType> = new Map();
    private _activeEditor: vscode.TextEditor | undefined;
    private _disposables: vscode.Disposable[] = [];
    private _currentDecorations: Map<string, vscode.DecorationOptions[]> = new Map(); // Stores the currently applied decorations

    private _debouncedUpdateVisibleRange: (editor: vscode.TextEditor) => void;
    private _debouncedUpdateFullDocument: (editor: vscode.TextEditor) => void;

    constructor() {
        this._extensionState = ExtensionState.getInstance();
        this._debouncedUpdateVisibleRange = debounce(this.updateVisibleRangeDecorations.bind(this), 20);
        this._debouncedUpdateFullDocument = debounce(this.updateFullDocumentDecorations.bind(this), 150);
    }

    /**
     * Initializes the DecorationManager by setting up decoration types and event listeners.
     * This should be called after the Configuration has initialized decoration types in ExtensionState.
     */
    public initialize(): void {
        this.initializeDecorationTypesInternal();

        // Listen for active editor changes
        vscode.window.onDidChangeActiveTextEditor(this.onDidChangeActiveTextEditor, this, this._disposables);
        // Listen for visible range changes (scrolling)
        vscode.window.onDidChangeTextEditorVisibleRanges(this.onDidChangeTextEditorVisibleRanges, this, this._disposables);
        // Listen for selection changes (for immediate current line update)
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
            // Immediately trigger a full update for the new active editor
            this.triggerFullUpdateImmediate(editor);
        }
    }

    /**
     * Notifies the DecorationManager that the document nodes have changed.
     * This triggers a debounced full document decoration update.
     */
    public notifyDocumentNodesChanged(editor: vscode.TextEditor): void {
        this._debouncedUpdateFullDocument(editor);
    }

    /**
     * Triggers an immediate full document decoration update.
     * Used when a document is opened or becomes active to ensure immediate display.
     */
    public triggerFullUpdateImmediate(editor: vscode.TextEditor): void {
        const documentModel = this._extensionState.getDocumentModel(editor.document.uri.toString());
        if (!documentModel) {
            return;
        }
        // Calculate and apply decorations for all nodes immediately
        this._updateAndApplyDecorations(editor, documentModel.nodes);
    }

    private onDidChangeActiveTextEditor(editor: vscode.TextEditor | undefined): void {
        this.setActiveEditor(editor);
    }

    private onDidChangeTextEditorVisibleRanges(event: vscode.TextEditorVisibleRangesChangeEvent): void {
        if (this._activeEditor && event.textEditor === this._activeEditor) {
            this._debouncedUpdateVisibleRange(this._activeEditor);
        }
    }

    private onDidChangeTextEditorSelection(event: vscode.TextEditorSelectionChangeEvent): void {
        if (this._activeEditor && event.textEditor === this._activeEditor) {
            // Immediately update decorations for the current line(s)
            this.updateCurrentLineDecorations(this._activeEditor, event.selections);
        }
    }

    /**
     * Immediately updates decorations for the current line(s) based on selection.
     * This is crucial for immediate feedback during typing.
     */
    private updateCurrentLineDecorations(editor: vscode.TextEditor, selections: readonly vscode.Selection[]): void {
        const documentModel = this._extensionState.getDocumentModel(editor.document.uri.toString());
        if (!documentModel) {
            return;
        }

        const affectedLineNumbers = new Set<number>();
        selections.forEach(selection => {
            affectedLineNumbers.add(selection.active.line);
            // Also consider the line where the selection started if it's a range
            if (!selection.isEmpty) {
                affectedLineNumbers.add(selection.start.line);
                affectedLineNumbers.add(selection.end.line);
            }
        });

        const nodesToProcess: DocumentNode[] = [];
        documentModel.nodes.forEach(node => {
            if (affectedLineNumbers.has(node.lineNumber)) {
                nodesToProcess.push(node);
            }
        });

        const decorationsToApply = new Map<string, vscode.DecorationOptions[]>();
        for (const typeName of this._decorationTypes.keys()) {
            if (!decorationsToApply.has(typeName)) {
                decorationsToApply.set(typeName, []);
            }
        }

        DecorationCalculator.calculateDecorations(nodesToProcess, decorationsToApply);

        // Apply only the decorations for the current line(s)
        this._updateAndApplyDecorations(editor, nodesToProcess);
    }

    /**
     * Updates decorations for the currently visible range of the editor.
     * This is debounced to optimize for scrolling.
     */
    private updateVisibleRangeDecorations(editor: vscode.TextEditor): void {
        const documentModel = this._extensionState.getDocumentModel(editor.document.uri.toString());
        if (!documentModel) {
            return;
        }

        const visibleRanges = editor.visibleRanges;
        const bufferLines = 20; // Extend visible range by a few lines for smoother scrolling

        const nodesToProcess: DocumentNode[] = [];
        documentModel.nodes.forEach(node => {
            const isVisible = visibleRanges.some(range =>
                range.start.line <= node.lineNumber && node.lineNumber <= range.end.line + bufferLines
            );
            if (isVisible) {
                nodesToProcess.push(node);
            }
        });

        this._updateAndApplyDecorations(editor, nodesToProcess);
    }

    /**
     * Updates all decorations for the entire document.
     * This is debounced for overall document changes (typing, pasting).
     */
    private updateFullDocumentDecorations(editor: vscode.TextEditor): void {
        const documentModel = this._extensionState.getDocumentModel(editor.document.uri.toString());
        if (!documentModel) {
            return;
        }
        // For a full document update, process all nodes
        this._updateAndApplyDecorations(editor, documentModel.nodes);
    }

    /**
     * Calculates decorations for a given set of nodes and applies them to the editor.
     * This method clears all existing decorations of managed types before applying new ones.
     */
    /**
     * Centralized method to calculate, update internal state, and apply decorations.
     * This ensures all decoration updates go through a single, state-aware path.
     */
    private _updateAndApplyDecorations(editor: vscode.TextEditor, nodesToProcess: DocumentNode[]): void {
        const newDecorationsForProcessedNodes = new Map<string, vscode.DecorationOptions[]>();
        for (const typeName of this._decorationTypes.keys()) {
            newDecorationsForProcessedNodes.set(typeName, []);
        }

        DecorationCalculator.calculateDecorations(nodesToProcess, newDecorationsForProcessedNodes);

        const affectedLineNumbers = new Set(nodesToProcess.map(node => node.lineNumber));

        for (const [typeName, decorationType] of this._decorationTypes.entries()) {
            const existingOptions = this._currentDecorations.get(typeName) || [];
            const updatedOptions: vscode.DecorationOptions[] = [];

            // Add existing decorations that are NOT on affected lines
            existingOptions.forEach(opt => {
                if (!affectedLineNumbers.has(opt.range.start.line)) {
                    updatedOptions.push(opt);
                }
            });

            // Add new decorations for affected lines
            const newOptionsForType = newDecorationsForProcessedNodes.get(typeName) || [];
            updatedOptions.push(...newOptionsForType);

            this._currentDecorations.set(typeName, updatedOptions);
        }

        this.applyAllCurrentDecorations(editor);
    }

    /**
     * Applies all decorations currently stored in `_currentDecorations` to the editor.
     * This is the single point where `editor.setDecorations` is called.
     */
    private applyAllCurrentDecorations(editor: vscode.TextEditor): void {
        for (const [typeName, decorationType] of this._decorationTypes.entries()) {
            const options = this._currentDecorations.get(typeName) || [];
            editor.setDecorations(decorationType, options);
        }
    }

    /**
     * Disposes of all resources held by the DecorationManager.
     */
    public dispose(): void {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
        // Decoration types are managed by ExtensionState, so no need to dispose them here.
        this._currentDecorations.clear();
    }
}