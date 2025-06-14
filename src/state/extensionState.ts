import * as vscode from 'vscode';
import { DocumentModel } from '../document/documentModel'; // Import DocumentModel

/**
 * Manages the global state of the extension as a singleton. This includes tracking
 * the active text editor, storing `TextEditorDecorationType` instances, and managing
 * the lifecycle of `DocumentModel`s for all open documents.
 */
export class ExtensionState {
    private static _instance: ExtensionState;
    private _activeEditor?: vscode.TextEditor;
    private _documentModels: Map<string, DocumentModel> = new Map();

    private constructor() {
        // Private constructor ensures singleton pattern.
    }

    /**
     * Returns the singleton instance of the `ExtensionState`.
     */
    public static getInstance(): ExtensionState {
        if (!ExtensionState._instance) {
            ExtensionState._instance = new ExtensionState();
        }
        return ExtensionState._instance;
    }

    // --- Active Editor Management ---

    public get activeEditor(): vscode.TextEditor | undefined {
        return this._activeEditor;
    }

    public setActiveEditor(editor: vscode.TextEditor | undefined): void {
        this._activeEditor = editor;
    }

    // --- Document Model Management ---

    /**
     * Adds a `DocumentModel` to the state, keyed by its URI.
     */
    public addDocumentModel(uri: string, model: DocumentModel): void {
        this._documentModels.set(uri, model);
    }

    /**
     * Retrieves a `DocumentModel` by its URI.
     */
    public getDocumentModel(uri: string): DocumentModel | undefined {
        return this._documentModels.get(uri);
    }

    /**
     * Removes and disposes of a `DocumentModel` when its corresponding document is closed.
     */
    public removeDocumentModel(uri: string): void {
        const model = this._documentModels.get(uri);
        if (model) {
            model.dispose();
            this._documentModels.delete(uri);
        }
    }

    /**
     * Disposes of all managed resources, including decoration types and document models.
     * This should be called during extension deactivation to ensure a clean shutdown.
     */
    public dispose(): void {
        this._documentModels.forEach(model => model.dispose());
        this._documentModels.clear();
    }
}