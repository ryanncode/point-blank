import * as vscode from 'vscode';
import { DocumentParser } from './documentParser';
import { DecorationManager } from '../decorations/decorationManager';
import { DocumentTree } from './documentTree';
import { BlockNode } from './blockNode'; // Import BlockNode

/**
 * Represents the parsed state of a single text document. It holds the `DocumentTree`,
 * listens for changes to the document, and orchestrates the re-parsing and re-decoration
 * process by coordinating between the `DocumentParser` and `DecorationManager`.
 */
export class DocumentModel {
    private _document: vscode.TextDocument;
    private _documentTree: DocumentTree;
    private _parser: DocumentParser;
    private _decorationManager?: DecorationManager;
    private _disposables: vscode.Disposable[] = [];
    private _isParsing: boolean = false; // New flag to indicate if a parse is in progress
    private _onDidParse: vscode.EventEmitter<void> = new vscode.EventEmitter<void>(); // New event emitter

    constructor(document: vscode.TextDocument) {
        this._document = document;
        this._parser = new DocumentParser();

        // Perform an initial full parse of the document upon creation.
        this._documentTree = this._parser.fullParse(this._document);

        // Listen for document changes to trigger incremental parsing.
        const disposable = vscode.workspace.onDidChangeTextDocument(this.handleDocumentChange, this);
        this._disposables.push(disposable);
    }

    // --- Getters ---

    public get document(): vscode.TextDocument {
        return this._document;
    }

    public get documentTree(): DocumentTree {
        return this._documentTree;
    }

    public get isParsing(): boolean {
        return this._isParsing;
    }

    public get onDidParse(): vscode.Event<void> {
        return this._onDidParse.event;
    }

    /**
     * Assigns a `DecorationManager` to this model and triggers an initial decoration.
     * This is called from `extension.ts` after the model is created.
     */
    public setDecorationManager(manager: DecorationManager): void {
        this._decorationManager = manager;
        this.triggerUpdateDecorations();
    }

    /**
     * Manually triggers a decoration update. This is useful when a document becomes active
     * or when settings affecting decorations have changed.
     */
    public triggerUpdateDecorations(): void {
        if (this._decorationManager) {
            this._decorationManager.updateDecorations(this._documentTree);
        }
    }

    /**
     * Handles the `onDidChangeTextDocument` event. It determines if the change
     * pertains to this model's document and, if so, triggers an incremental parse
     * and notifies the `DecorationManager`.
     */
    private handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
        if (event.document !== this._document || !this._decorationManager) {
            return;
        }

        this._isParsing = true; // Set parsing flag to true

        // Create a new, updated tree by applying the changes to the previous tree.
        const newDocumentTree = this._parser.parse(this._documentTree, event.contentChanges);
        this._documentTree = newDocumentTree;

        // Notify the DecorationManager with the new tree. The manager will then
        // handle the debounced update of the actual decorations in the editor.
        this._decorationManager.updateDecorations(this._documentTree);

        this._isParsing = false; // Set parsing flag to false
        this._onDidParse.fire(); // Fire the event
    }

    /**
     * Disposes of all resources held by the `DocumentModel`, primarily the event listener.
     */
    public dispose(): void {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
        this._decorationManager = undefined;
        this._onDidParse.dispose(); // Dispose the event emitter
    }
}