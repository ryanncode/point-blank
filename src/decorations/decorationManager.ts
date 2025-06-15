import * as vscode from 'vscode';
import { BlockNode } from '../document/blockNode'; // Use BlockNode
import { DocumentTree } from '../document/documentTree'; // Import DocumentTree
import { DecorationCalculator } from './decorationCalculator';
import { debounce } from '../utils/debounce';
import { Configuration } from '../config/configuration';
import { ExtensionState } from '../state/extensionState';
import { withTiming } from '../utils/debugUtils';

/**
 * Manages the application of text editor decorations. It orchestrates decoration updates
 * efficiently by using debouncing and considering only the visible ranges of the editor,
 * which is crucial for performance in large files.
 */
export class DecorationManager implements vscode.Disposable {
    private _decorationTypes: Map<string, vscode.TextEditorDecorationType> = new Map();
    private _disposables: vscode.Disposable[] = [];
private _debouncedUpdate: (editor: vscode.TextEditor, tree: DocumentTree) => void;
    private _extensionState: ExtensionState;

    constructor(extensionState: ExtensionState) {
        this._extensionState = extensionState;
        const configuration = Configuration.getInstance();
        const debounceDelay = configuration.getDebounceDelay();
        this._debouncedUpdate = debounce(this.applyDecorations.bind(this), debounceDelay);
    }

    /**
     * Initializes the manager by loading decoration types from the global state
     * and setting up a listener for viewport changes.
     */
    public initialize(): void {
        this.reloadDecorationTypes(); // Initial load after configuration is ready
        vscode.window.onDidChangeTextEditorVisibleRanges(this.handleVisibilityChange, this, this._disposables);
    }

    /**
     * Clears existing decoration types and reloads them from ExtensionState.
     * This should be called when configuration changes or on initial activation
     * after decoration types have been initialized in ExtensionState.
     */
    public reloadDecorationTypes(): void {
        this._decorationTypes.forEach(type => type.dispose()); // Dispose existing types
        this._decorationTypes.clear(); // Clear existing types
        this.loadDecorationTypes();    // Reload from Configuration
    }

    /**
     * Loads the configured decoration types from `Configuration` into a local map for quick access.
     */
    private loadDecorationTypes(): void {
        const configuration = Configuration.getInstance();
        const renderOptions = configuration.getDecorationRenderOptions();

        renderOptions.forEach((options, key) => {
            if (options) {
                const decorationType = vscode.window.createTextEditorDecorationType(options);
                this._decorationTypes.set(key, decorationType);
            }
        });
    }

    /**
     * The main entry point for triggering a decoration update. It's called by `DocumentModel`
     * when the document tree changes. The update is debounced to prevent excessive processing.
     * @param tree The current, immutable `DocumentTree` of the document.
     */
    public updateDecorations(tree: DocumentTree): void {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.uri.toString() === tree.document.uri.toString()) {
            this._debouncedUpdate(activeEditor, tree);
        }
    }

    /**
     * Handles changes in the editor's visible ranges (e.g., scrolling).
     * It triggers a decoration update to ensure that newly visible lines are decorated correctly.
     */
    private handleVisibilityChange(event: vscode.TextEditorVisibleRangesChangeEvent): void {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && event.textEditor === activeEditor) {
            const documentModel = this._extensionState.getDocumentModel(activeEditor.document.uri.toString());
            if (documentModel) {
                this._debouncedUpdate(activeEditor, documentModel.documentTree);
            }
        }
    }

    /**
     * The core logic for applying decorations. It calculates decorations only for the nodes
     * within the visible viewport (plus a buffer) and applies them to the editor.
     * @param editor The active text editor.
     * @param tree The current `DocumentTree`.
     */
    private applyDecorations(editor: vscode.TextEditor, tree: DocumentTree): void {
        withTiming(() => {
            const decorationsToApply = new Map<string, vscode.DecorationOptions[]>();
            this._decorationTypes.forEach((_, key) => decorationsToApply.set(key, []));

        const nodesToDecorate = this.getNodesInViewport(editor, tree);
        DecorationCalculator.calculateDecorations(nodesToDecorate, decorationsToApply);

            this._decorationTypes.forEach((decorationType, typeName) => {
                editor.setDecorations(decorationType, decorationsToApply.get(typeName) || []);
            });
        }, `Decoration rendering for ${editor.document.uri.fsPath}`);
    }

    /**
     * Determines which nodes are currently within the visible viewport, including a configured buffer.
     * This optimization prevents processing the entire document on every update.
     * @param editor The active text editor.
     * @param tree The document's `DocumentTree`.
     * @returns An array of `BlockNode`s that need to be decorated.
     */
    private getNodesInViewport(editor: vscode.TextEditor, tree: DocumentTree): BlockNode[] {
        const configuration = Configuration.getInstance();
        const viewportBuffer = configuration.getViewportBuffer();
        const nodesInViewport: BlockNode[] = [];
        const processedLines = new Set<number>();

        for (const range of editor.visibleRanges) {
            const startLine = Math.max(0, range.start.line - viewportBuffer);
            const endLine = Math.min(editor.document.lineCount - 1, range.end.line + viewportBuffer);

            const nodesInRange = tree.getNodesInLineRange(startLine, endLine);
            for (const node of nodesInRange) {
                if (!processedLines.has(node.lineNumber)) {
                    nodesInViewport.push(node);
                    processedLines.add(node.lineNumber);
                }
            }
        }
        return nodesInViewport;
    }

    /**
     * Disposes of all resources held by the `DecorationManager`, including event listeners
     * and the decoration types themselves, to prevent memory leaks.
     */
    public dispose(): void {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
        this._decorationTypes.forEach(type => type.dispose());
        this._decorationTypes.clear();
    }
}