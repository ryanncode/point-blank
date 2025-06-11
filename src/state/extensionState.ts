import * as vscode from 'vscode';

/**
 * Manages the global state of the Point Blank extension, including the active text editor
 * and the VS Code decoration types used for visual enhancements.
 * This class is implemented as a singleton to ensure a single, consistent state
 * across the extension's lifecycle.
 */
export class ExtensionState {
    private static _instance: ExtensionState;
    private _activeEditor: vscode.TextEditor | undefined;
    private _decorationTypes: { [key: string]: vscode.TextEditorDecorationType } = {};

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
     * Disposes of all managed decoration types.
     * This should be called during extension deactivation to clean up resources.
     */
    public disposeDecorationTypes(): void {
        for (const key in this._decorationTypes) {
            if (this._decorationTypes.hasOwnProperty(key)) {
                this._decorationTypes[key].dispose();
            }
        }
        this._decorationTypes = {}; // Reset the map
    }
}