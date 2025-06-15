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
    private _documentTree: DocumentTree = DocumentTree.create(null as any, []); // Initialize with a dummy tree
    private _parser: DocumentParser;
    private _decorationManager?: DecorationManager;
    private _disposables: vscode.Disposable[] = [];
    private _isParsing: boolean = false;
    private _onDidParseEventEmitter = new vscode.EventEmitter<void>();
    private _isBulkUpdating: boolean = false; // New flag for bulk updates

    constructor(document: vscode.TextDocument) {
        this._document = document;
        this._parser = new DocumentParser();

        // Perform an initial full parse of the document upon creation.
        this.performFullParse(this._document);

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

    public get isParsing(): boolean { // New getter for parsing status
        return this._isParsing;
    }

    public get onDidParse(): vscode.Event<void> { // New event for parsing completion
        return this._onDidParseEventEmitter.event;
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
        if (event.document.uri.toString() !== this._document.uri.toString() || !this._decorationManager) {
            return;
        }

        // If a bulk update is in progress, defer incremental parsing until the bulk update completes.
        if (this._isBulkUpdating) {
            return;
        }

        // Update the internal document reference to the latest version
        this._document = event.document;

        this._isParsing = true; // Set parsing flag
        // Create a new, updated tree by applying the changes to the previous tree.
        const newDocumentTree = this._parser.parse(this._documentTree, event.contentChanges);
        this._documentTree = newDocumentTree;
        this._isParsing = false; // Clear parsing flag
        this._onDidParseEventEmitter.fire(); // Fire event

        // Notify the DecorationManager with the new tree. The manager will then
        // handle the debounced update of the actual decorations in the editor.
        this._decorationManager.updateDecorations(this._documentTree);
    }

    /**
     * Disposes of all resources held by the `DocumentModel`, primarily the event listener.
     */
    public dispose(): void {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
        this._decorationManager = undefined;
        this._onDidParseEventEmitter.dispose(); // Dispose event emitter
    }

    /**
     * Forces a full re-parse of the document and updates the DocumentTree.
     * This is used for programmatic edits where the onDidChangeTextDocument event
     * might not have processed the changes synchronously.
     * @param document The latest TextDocument instance after programmatic edits.
     */
    public updateAfterProgrammaticEdit(document: vscode.TextDocument): void {
        this.performFullParse(document);
    }

    /**
     * Performs a full parse and updates the document tree, setting and clearing the parsing flag.
     * @param document The TextDocument to parse.
     */
    private performFullParse(document: vscode.TextDocument): void {
        this._document = document; // Update the internal document reference
        this._isParsing = true; // Set parsing flag
        this._documentTree = this._parser.fullParse(this._document);
        this._isParsing = false; // Clear parsing flag
        this._onDidParseEventEmitter.fire(); // Fire event

        if (this._decorationManager) {
            this._decorationManager.updateDecorations(this._documentTree);
        }
    }

    /**
     * Performs a series of document edits as a single, atomic operation from the perspective of the DocumentModel.
     * During a bulk update, incremental parsing is temporarily suspended, and a single full parse is triggered
     * at the end to ensure the document tree is consistent.
     * @param updateFn A function containing the VS Code editor edits.
     */
    public async performBulkUpdate(updateFn: () => Promise<void>): Promise<void> {
        this._isBulkUpdating = true;
        try {
            await updateFn();
        } finally {
            this._isBulkUpdating = false;
            // After the bulk update, force a full re-parse to ensure the model is up-to-date.
            this.performFullParse(this._document);
        }
    }
}