import * as vscode from 'vscode';
import { DocumentModel } from '../document/documentModel'; // Import DocumentModel

/**
 * Manages the global state of the Point Blank extension, including the active text editor,
 * the VS Code decoration types, and a map of DocumentModel instances for open documents.
 * This class is implemented as a singleton to ensure a single, consistent state
 * across the extension's lifecycle.
 */
export class ExtensionState {
    private static _instance: ExtensionState;
    private _activeEditor: vscode.TextEditor | undefined;
    private _decorationTypes: { [key: string]: vscode.TextEditorDecorationType } = {};
    private _documentModels: Map<string, DocumentModel> = new Map(); // Map to hold DocumentModel instances

    private constructor() {
        // Private constructor to prevent direct instantiation
    }

    /**
     * Returns the singleton instance of the ExtensionState.
     * If an instance does not already exist, it creates one.
     * @returns The singleton instance of ExtensionState.
     */
    public static getInstance(): ExtensionState {
        if (!ExtensionState._instance) {
            ExtensionState._instance = new ExtensionState();
        }
        return ExtensionState._instance;
    }

    /**
     * Gets the currently active text editor.
     * @returns The active `vscode.TextEditor` or `undefined` if no editor is active.
     */
    public get activeEditor(): vscode.TextEditor | undefined {
        return this._activeEditor;
    }

    /**
     * Sets the active text editor.
     * @param editor The `vscode.TextEditor` to set as active.
     */
    public setActiveEditor(editor: vscode.TextEditor | undefined): void {
        this._activeEditor = editor;
    }

    /**
     * Gets a specific decoration type by its key.
     * @param key The key identifying the decoration type (e.g., 'bulletDecorationType').
     * @returns The `vscode.TextEditorDecorationType` associated with the key, or `undefined`.
     */
    public getDecorationType(key: string): vscode.TextEditorDecorationType | undefined {
        return this._decorationTypes[key];
    }

    /**
     * Sets a decoration type, associating it with a given key.
     * If a decoration type with the same key already exists, it will be disposed
     * before the new one is set to prevent memory leaks.
     * @param key The key to associate with the decoration type.
     * @param type The `vscode.TextEditorDecorationType` to store.
     */
    public setDecorationType(key: string, type: vscode.TextEditorDecorationType): void {
        if (this._decorationTypes[key]) {
            this._decorationTypes[key].dispose();
        }
        this._decorationTypes[key] = type;
    }

    /**
     * Adds a DocumentModel instance to the state.
     * @param uri The URI string of the document.
     * @param model The DocumentModel instance.
     */
    public addDocumentModel(uri: string, model: DocumentModel): void {
        this._documentModels.set(uri, model);
    }

    /**
     * Retrieves a DocumentModel instance by its URI.
     * @param uri The URI string of the document.
     * @returns The DocumentModel instance or undefined if not found.
     */
    public getDocumentModel(uri: string): DocumentModel | undefined {
        return this._documentModels.get(uri);
    }

    /**
     * Removes and disposes a DocumentModel instance from the state.
     * @param uri The URI string of the document to remove.
     */
    public removeDocumentModel(uri: string): void {
        const model = this._documentModels.get(uri);
        if (model) {
            model.dispose();
            this._documentModels.delete(uri);
        }
    }

    /**
     * Disposes of all managed decoration types and DocumentModel instances.
     * This should be called during extension deactivation to clean up resources.
     */
    public disposeDecorationTypes(): void {
        for (const key in this._decorationTypes) {
            if (this._decorationTypes.hasOwnProperty(key)) {
                this._decorationTypes[key].dispose();
            }
        }
        this._decorationTypes = {}; // Reset the map

        // Dispose all DocumentModel instances
        for (const model of this._documentModels.values()) {
            model.dispose();
        }
        this._documentModels.clear();
    }
}