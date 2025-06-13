import * as vscode from 'vscode';
import { BlockNode } from '../document/blockNode'; // Use BlockNode
import { DocumentTree } from '../document/documentTree'; // Import DocumentTree
import { DecorationCalculator } from './decorationCalculator';
import { ExtensionState } from '../state/extensionState';
import { debounce } from '../utils/debounce';
import { Configuration } from '../config/configuration';
import { Timer } from '../utils/timer'; // Import Timer utility

/**
 * Manages and applies text editor decorations based on document changes.
 * It orchestrates the decoration updates in a flicker-free manner.
 */
export class DecorationManager implements vscode.Disposable {
    private _extensionState: ExtensionState;
    private _decorationTypes: Map<string, vscode.TextEditorDecorationType> = new Map();
    private _disposables: vscode.Disposable[] = [];
    // Debounced function for general decoration updates, now including visible ranges
    private _debouncedUpdateDecorations?: (editor: vscode.TextEditor, tree: DocumentTree) => void;
    private _screenUpdateTimer: Timer; // Timer for screen updates

    constructor() {
        this._extensionState = ExtensionState.getInstance();
        this._screenUpdateTimer = new Timer('Screen Update');
    }

    /**
     * Initializes the DecorationManager by setting up decoration types and event listeners.
     * This should be called after the Configuration has initialized decoration types in ExtensionState.
     */
    public initialize(): void {
        this.initializeDecorationTypesInternal();
        const configuration = Configuration.getInstance();
        const debounceDelay = configuration.getDebounceDelay();
        this._debouncedUpdateDecorations = debounce(this.applyDecorationsInternal.bind(this), debounceDelay);

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
            }
        }
    }

    /**
     * Main entry point for updating decorations. This method should be called
     * by DocumentModel whenever the document tree changes.
     * It uses a debounced mechanism to prevent excessive updates.
     * @param tree The current `DocumentTree`.
     */
    public updateDecorations(tree: DocumentTree): void {
        const activeEditor = this._extensionState.activeEditor;
        if (!activeEditor || activeEditor.document.uri.toString() !== tree.document.uri.toString() || !this._debouncedUpdateDecorations) {
            return;
        }
        this._debouncedUpdateDecorations(activeEditor, tree);
    }

    private onDidChangeTextEditorVisibleRanges(event: vscode.TextEditorVisibleRangesChangeEvent): void {
        const activeEditor = this._extensionState.activeEditor;
        if (activeEditor && event.textEditor === activeEditor) {
            const documentModel = this._extensionState.getDocumentModel(activeEditor.document.uri.toString());
            if (documentModel) {
                // Trigger an update
                this.updateDecorations(documentModel.documentTree);
            }
        }
    }

    // Removed onDidChangeTextEditorVisibleRanges as it's now handled by the unified updateDecorations
    // and the debounced nature of applyDecorationsInternal.


    /**
     * Internal method to calculate and apply decorations. This is the core
     * logic that gets debounced.
     * @param editor The active text editor.
     * @param tree The current `DocumentTree`.
     */
    private applyDecorationsInternal(editor: vscode.TextEditor, tree: DocumentTree): void {
        if (!editor) {
            return;
        }

        this._screenUpdateTimer.start();

        const decorationsToApply = new Map<string, vscode.DecorationOptions[]>();
        for (const key of this._decorationTypes.keys()) {
            decorationsToApply.set(key, []);
        }

        const configuration = Configuration.getInstance();
        const viewportBuffer = configuration.getViewportBuffer();

        const currentVisibleRanges = editor.visibleRanges;

        const allNodesToDecorate: BlockNode[] = [];
        const processedLineNumbers = new Set<number>();

        for (let i = 0; i < currentVisibleRanges.length; i++) {
            const currentRange = currentVisibleRanges[i];

            const startLine = Math.max(0, currentRange.start.line - viewportBuffer);

            let endLine: number;
            const bufferedEndLine = Math.min(editor.document.lineCount - 1, currentRange.end.line + viewportBuffer);

            if (i + 1 < currentVisibleRanges.length) {
                const nextRangeStartLine = currentVisibleRanges[i + 1].start.line;
                endLine = Math.min(bufferedEndLine, nextRangeStartLine - 1);
            } else {
                endLine = bufferedEndLine;
            }

            // Ensure endLine doesn't go below startLine, especially for very small ranges or large buffers
            endLine = Math.max(startLine, endLine);

            const nodesInCurrentBufferedRange = tree.getNodesInLineRange(startLine, endLine);

            for (const node of nodesInCurrentBufferedRange) {
                if (!processedLineNumbers.has(node.lineNumber)) {
                    allNodesToDecorate.push(node);
                    processedLineNumbers.add(node.lineNumber);
                }
            }
        }

        DecorationCalculator.calculateDecorations(allNodesToDecorate, decorationsToApply);
        // Apply the newly calculated decorations to the editor
        for (const [typeName, decorationType] of this._decorationTypes.entries()) {
            const optionsToApply = decorationsToApply.get(typeName) || [];
            editor.setDecorations(decorationType, optionsToApply);
        }
        this._screenUpdateTimer.stop();
    }

    /**
     * Disposes of all resources held by the DecorationManager.
     */
    public dispose(): void {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
        // Dispose of decoration types to prevent memory leaks
        this._decorationTypes.forEach(type => type.dispose());
        this._decorationTypes.clear();
    }
}