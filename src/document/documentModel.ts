import * as vscode from 'vscode';
import { DocumentParser } from './documentParser';
import { DecorationManager } from '../decorations/decorationManager';
import { DocumentTree } from './documentTree';
import { BlockNode } from './blockNode'; // Import BlockNode
import { Timer } from '../utils/timer'; // Import Timer utility

/**
 * Manages the document's parsed structure (DocumentTree of BlockNodes).
 * It acts as the single source of truth for the document's state
 * and notifies the DecorationManager of changes.
 */
export class DocumentModel {
    private _document: vscode.TextDocument;
    private _documentTree: DocumentTree; // Use DocumentTree
    private _parser: DocumentParser;
    private _decorationManager: DecorationManager | undefined;
    private _disposables: vscode.Disposable[] = [];
    private _parseTimer: Timer; // Timer for document parsing

    constructor(document: vscode.TextDocument) {
        this._document = document;
        this._parser = new DocumentParser();

        // Initial parse
        this._documentTree = this._parser.fullParse(this._document);
        this._parseTimer = new Timer('Document Parsing');

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
            // Pass the entire document tree for initial rendering
            this._decorationManager.updateDecorations(this._documentTree);
        }
    }

    /**
     * Triggers a full decoration update for the document managed by this model.
     * This is useful when the document becomes active or is opened.
     */
    public triggerUpdateDecorations(): void {
        if (this._decorationManager) {
            this._decorationManager.updateDecorations(this._documentTree);
        }
    }

    /**
     * Returns all parsed BlockNodes for the current document in a flat array.
     */
    public get nodes(): BlockNode[] {
        return this._documentTree.getAllNodesFlat();
    }

    public get document(): vscode.TextDocument {
        return this._document;
    }

    public get documentTree(): DocumentTree {
        return this._documentTree;
    }

    /**
     * Handles text document changes. Triggers parsing and decoration updates.
     */
    private onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent): void {
        if (event.document !== this._document) {
            return;
        }

        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || activeEditor.document !== this._document || !this._decorationManager) {
            return;
        }


        // Parse the document incrementally (or full parse for now)
        this._parseTimer.start();
        const newDocumentTree = this._parser.parse(this._documentTree, event.contentChanges);
        this._parseTimer.stop();
        this._documentTree = newDocumentTree;

        // Notify DecorationManager with the new tree.
        // The DecorationManager will now handle visible ranges internally.
        this._decorationManager.updateDecorations(this._documentTree);
    }

    /**
     * Disposes of all resources held by the DocumentModel.
     */
    public dispose(): void {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
        this._decorationManager = undefined;
        // No need to dispose _documentTree as it's immutable and managed by GC
    }
}