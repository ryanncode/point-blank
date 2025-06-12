import * as vscode from 'vscode';
import { DocumentParser } from './documentParser';
import { DecorationManager } from '../decorations/decorationManager';
import { DocumentTree } from './documentTree';
import { BlockNode } from './blockNode'; // Import BlockNode

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

    constructor(document: vscode.TextDocument) {
        this._document = document;
        this._parser = new DocumentParser();

        // Initial parse
        this._documentTree = this._parser.fullParse(this._document);

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
            this._decorationManager.updateDecorations(this._documentTree, new vscode.Range(0, 0, this._document.lineCount, 0));
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

        // Handle expandTemplateCommand trigger (if still needed, consider moving this logic)
        // This logic is specific to a command and might be better handled outside the core parsing loop.
        // For now, keeping it for functional parity, but it's a candidate for refactoring.
        if (event.contentChanges.length === 1) {
            const change = event.contentChanges[0];
            const line = event.document.lineAt(change.range.start.line);
            const lineText = line.text;

            const typedNodeTriggerMatch = lineText.match(/^\s*@([a-zA-Z0-9_]+)\s$/);

            if (typedNodeTriggerMatch && change.text === ' ') {
                const typeName = typedNodeTriggerMatch[1];
                vscode.commands.executeCommand('pointblank.expandTemplate', typeName, this);
                return; // Command will trigger another event with new content
            }
        }

        // Calculate the dirty range based on content changes
        let dirtyStartLine = this._document.lineCount;
        let dirtyEndLine = 0;

        for (const change of event.contentChanges) {
            dirtyStartLine = Math.min(dirtyStartLine, change.range.start.line);
            dirtyEndLine = Math.max(dirtyEndLine, change.range.end.line + change.text.split('\n').length - 1);
        }

        // Expand the dirty range slightly to account for potential ripple effects (e.g., indentation changes)
        const bufferLines = 2; // Small buffer for safety
        dirtyStartLine = Math.max(0, dirtyStartLine - bufferLines);
        dirtyEndLine = Math.min(this._document.lineCount - 1, dirtyEndLine + bufferLines);

        const dirtyRange = new vscode.Range(dirtyStartLine, 0, dirtyEndLine, this._document.lineAt(dirtyEndLine).text.length);

        // Parse the document incrementally (or full parse for now)
        const newDocumentTree = this._parser.parse(this._documentTree, event.contentChanges);
        this._documentTree = newDocumentTree;

        // Notify DecorationManager with the new tree and the calculated dirty range.
        // The DecorationManager will use this range to clear old decorations.
        this._decorationManager.updateDecorations(this._documentTree, dirtyRange);
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