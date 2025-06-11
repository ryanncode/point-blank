import * as vscode from 'vscode';
import { DocumentNode } from './documentNode';
import { DocumentParser } from './documentParser';
import { DecorationRenderer } from '../decorations/decorationRenderer';
import { debounce } from '../utils/debounce';
import { Configuration } from '../config/configuration';

/**
 * Manages the document's parsed structure (DocumentNodes) and orchestrates
 * updates to decorations based on document changes. It acts as the single
 * source of truth for the document's state.
 */
export class DocumentModel {
    private _document: vscode.TextDocument;
    private _nodes: DocumentNode[] = [];
    private _parser: DocumentParser;
    private _decorationRenderer: DecorationRenderer;
    private _disposables: vscode.Disposable[] = [];

    // Debounce the decoration update to avoid excessive re-renders during rapid typing
    private _debouncedUpdateDecorations: (editor: vscode.TextEditor) => void;

    constructor(document: vscode.TextDocument) {
        this._document = document;
        this._parser = new DocumentParser();
        this._decorationRenderer = new DecorationRenderer();
        const configuration = Configuration.getInstance();
        const debounceDelay = configuration.getDebounceDelay();

        // Initial parse and render
        this.parseAndRender(document);

        // Debounce the decoration update for document changes (typing, pasting, etc.)
        this._debouncedUpdateDecorations = debounce((editor: vscode.TextEditor) => {
            this.updateDecorations(editor);
        }, debounceDelay);

        // Debounce the decoration update for visible range changes (scrolling) with a lower delay
        this._debouncedUpdateVisibleRangeDecorations = debounce((editor: vscode.TextEditor) => {
            this.updateDecorations(editor);
        }, 20); // 20ms for visible range changes

        // Listen for document changes
        vscode.workspace.onDidChangeTextDocument(this.onDidChangeTextDocument, this, this._disposables);
        vscode.window.onDidChangeTextEditorVisibleRanges(this.onDidChangeTextEditorVisibleRanges, this, this._disposables);
        vscode.window.onDidChangeActiveTextEditor(this.onDidChangeActiveTextEditor, this, this._disposables);
    }

    private _debouncedUpdateVisibleRangeDecorations: (editor: vscode.TextEditor) => void;

    /**
     * Returns all parsed DocumentNodes for the current document.
     */
    public get nodes(): DocumentNode[] {
        return this._nodes;
    }

    public get document(): vscode.TextDocument {
        return this._document;
    }

    /**
     * Performs a full parse of the document and updates all decorations.
     * This is typically called on document open or significant changes.
     */
    private parseAndRender(document: vscode.TextDocument): void {
        this._nodes = this._parser.fullParse(document);
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document === this._document) {
            this.updateDecorations(activeEditor);
        }
    }

    /**
     * Handles text document changes. Triggers incremental parsing and debounced decoration updates.
     */
    private onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent): void {
        if (event.document !== this._document) {
            return;
        }

        // Perform incremental parse
        const { updatedNodes, affectedLineNumbers } = this._parser.incrementalParse(this._document, event, this._nodes);
        this._nodes = updatedNodes; // Update the model's nodes with the incrementally parsed ones

        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document === this._document) {
            // Check if the change is on the active line and is a single character insertion/deletion
            const isSingleCharChangeOnActiveLine = event.contentChanges.length === 1 &&
                                                   event.contentChanges[0].range.start.line === activeEditor.selection.active.line &&
                                                   (event.contentChanges[0].text.length === 1 || event.contentChanges[0].rangeLength === 1);

            if (isSingleCharChangeOnActiveLine) {
                // For immediate feedback on typing, update decorations for the current line directly
                this.updateDecorations(activeEditor);
            } else {
                // For other document changes (e.g., paste, multi-line edit), use debounced update
                this._debouncedUpdateDecorations(activeEditor);
            }
        }
    }

    /**
     * Handles changes in visible ranges (scrolling).
     */
    private onDidChangeTextEditorVisibleRanges(event: vscode.TextEditorVisibleRangesChangeEvent): void {
        if (event.textEditor.document !== this._document) {
            return;
        }
        // Use a debounced update for visible range changes to prevent excessive re-renders during scrolling
        this._debouncedUpdateVisibleRangeDecorations(event.textEditor);
    }

    /**
     * Handles active text editor changes.
     */
    private onDidChangeActiveTextEditor(editor: vscode.TextEditor | undefined): void {
        if (editor && editor.document === this._document) {
            this.updateDecorations(editor);
        }
    }

    /**
     * Calculates and applies decorations for the currently visible lines.
     * This method is called by the debounced update or on visible range changes.
     */
    private updateDecorations(editor: vscode.TextEditor): void {
        const decorationsToApply = new Map<string, vscode.DecorationOptions[]>();
        const visibleRanges = editor.visibleRanges;
        const bufferLines = 5; // Extend visible range by a few lines for smoother scrolling

        // Collect all nodes that are within the extended visible range
        const nodesInView: DocumentNode[] = [];
        this._nodes.forEach(node => {
            if (visibleRanges.some(range =>
                range.start.line <= node.lineNumber && node.lineNumber <= range.end.line + bufferLines
            )) {
                nodesInView.push(node);
            }
        });

        // Calculate decorations for these nodes
        this._decorationRenderer.calculateDecorations(nodesInView, decorationsToApply);

        // Apply the calculated decorations
        this._decorationRenderer.applyDecorations(editor, decorationsToApply);
    }

    /**
     * Disposes of all resources held by the DocumentModel.
     */
    public dispose(): void {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
        this._decorationRenderer.dispose(); // Dispose decoration types
    }
}