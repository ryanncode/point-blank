import * as vscode from 'vscode';
import { BlockNode } from '../document/blockNode'; // Use BlockNode
import { DocumentTree } from '../document/documentTree'; // Import DocumentTree
import { DecorationCalculator } from './decorationCalculator';
import { ExtensionState } from '../state/extensionState';
import { debounce } from '../utils/debounce';
import { Configuration } from '../config/configuration';

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

    constructor() {
        this._extensionState = ExtensionState.getInstance();
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
                const documentModel = this._extensionState.getDocumentModel(document.uri.toString());
                const node = documentModel?.documentTree.getNodeAtLine(selection.active.line); // Fixed: getNodeByLineNumber to getNodeAtLine

                if (node) {
                    let bulletEndPosition = -1;
                    switch (node.bulletType) {
                        case 'star':
                        case 'plus':
                        case 'minus':
                        case 'blockquote':
                            bulletEndPosition = firstCharIndex + 1; // For single character bullets
                            break;
                        case 'numbered':
                            const numberedMatch = node.trimmedText.match(/^(\d+[\.\)])\s*/);
                            if (numberedMatch) {
                                bulletEndPosition = firstCharIndex + numberedMatch[1].length;
                            }
                            break;
                        case 'implicit':
                            bulletEndPosition = firstCharIndex; // For default, cursor should be at the start of content
                            break;
                    }

                    if (bulletEndPosition !== -1 && selection.active.character < bulletEndPosition) {
                        const newPosition = new vscode.Position(selection.active.line, bulletEndPosition);
                        editor.selection = new vscode.Selection(newPosition, newPosition); // Fixed: selection.active.line, bulletEndPosition to newPosition, newPosition
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
     */
    private applyDecorationsInternal(editor: vscode.TextEditor, tree: DocumentTree): void {
        if (!editor) {
            return;
        }

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