import * as vscode from 'vscode';
import { DocumentNode } from './documentNode';
import { DocumentParser } from './documentParser';
import { DecorationManager } from '../decorations/decorationManager'; // New import
import { Configuration } from '../config/configuration';

/**
 * Manages the document's parsed structure (DocumentNodes).
 * It acts as the single source of truth for the document's state
 * and notifies the DecorationManager of changes.
 */
export class DocumentModel {
    private _document: vscode.TextDocument;
    private _nodes: DocumentNode[] = [];
    private _parser: DocumentParser;
    private _decorationManager: DecorationManager | undefined; // Reference to the DecorationManager
    private _disposables: vscode.Disposable[] = [];

    constructor(document: vscode.TextDocument) {
        this._document = document;
        this._parser = new DocumentParser();

        // Initial parse
        this.parseDocument();

        // Listen for document changes
        vscode.workspace.onDidChangeTextDocument(this.onDidChangeTextDocument, this, this._disposables);
    }

    /**
     * Sets the DecorationManager instance for this DocumentModel.
     * This is called after the DocumentModel is created and registered.
     */
    public setDecorationManager(manager: DecorationManager): void {
        this._decorationManager = manager;
        // Trigger an initial full update via the manager
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document === this._document) {
            this._decorationManager.notifyDocumentNodesChanged(activeEditor);
        }
    }

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
     * Performs a full parse of the document and updates the internal nodes.
     */
    private parseDocument(): void {
        this._nodes = this._parser.fullParse(this._document);
    }

    /**
     * Handles text document changes. Triggers incremental parsing and notifies the DecorationManager.
     */
    private onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent): void {
        if (event.document !== this._document) {
            return;
        }

        // Determine if the change is structural (adding/removing lines)
        let isStructuralChange = false;
        for (const change of event.contentChanges) {
            const linesRemoved = change.range.end.line - change.range.start.line;
            const linesAdded = (change.text.match(/\n/g) || []).length;

            if (linesRemoved !== linesAdded || change.text.includes('\n') || change.rangeLength === 0 && change.text.length > 0 && change.text.includes('\n')) {
                isStructuralChange = true;
                break;
            }
        }

        // Perform incremental parse
        const { updatedNodes, affectedLineNumbers } = this._parser.incrementalParse(this._document);
        this._nodes = updatedNodes; // Update the model's nodes with the incrementally parsed ones

        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document === this._document && this._decorationManager) {
            if (isStructuralChange) {
                // For structural changes, trigger an immediate full update
                this._decorationManager.triggerFullUpdateImmediate(activeEditor);
            } else {
                // For non-structural changes (e.g., typing on a single line), use the debounced update
                this._decorationManager.notifyDocumentNodesChanged(activeEditor);
            }
        }
    }

    /**
     * Disposes of all resources held by the DocumentModel.
     */
    public dispose(): void {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
        this._decorationManager = undefined; // Clear reference
    }
}