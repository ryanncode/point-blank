import * as vscode from 'vscode';
import { ExtensionState } from '../state/extensionState';

/**
 * Manages the configuration settings for the Point Blank extension.
 * This class provides methods to retrieve configuration values and to
 * initialize/update VS Code decoration types based on these settings.
 * It operates as a singleton to ensure consistent access to configuration.
 */
export class Configuration {
    private static _instance: Configuration;
    private _extensionState: ExtensionState;

    private constructor() {
        this._extensionState = ExtensionState.getInstance();
    }

    /**
     * Returns the singleton instance of the Configuration.
     * If an instance does not already exist, it creates one.
     * @returns The singleton instance of Configuration.
     */
    public static getInstance(): Configuration {
        if (!Configuration._instance) {
            Configuration._instance = new Configuration();
        }
        return Configuration._instance;
    }

    /**
     * Retrieves the VS Code configuration for 'pointblank'.
     * @returns A `vscode.WorkspaceConfiguration` object for the extension.
     */
    private getConfiguration(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration('pointblank');
    }

    /**
     * Initializes or re-initializes all VS Code decoration types based on the current
     * extension configuration. Existing decoration types are disposed to prevent memory leaks.
     * This method should be called on extension activation and whenever configuration changes.
     */
    public initializeDecorationTypes(): void {
        const configuration = this.getConfiguration();

        // Dispose existing decorations if they exist to prevent memory leaks
        this._extensionState.disposeDecorationTypes();

        /**
         * Defines the decoration type for the default bullet points.
         * These are typically used for general list items.
         */
        this._extensionState.setDecorationType('bulletDecorationType', vscode.window.createTextEditorDecorationType({
            before: {
                contentText: '•',
                color: configuration.get('level1Color') || new vscode.ThemeColor('editor.foreground'),
                margin: '0 0.5em 0 0',
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
        }));

        /**
         * Defines the decoration type for custom bullet points using an asterisk (*).
         * This provides a subtle yellow/gold color to differentiate them.
         */
        this._extensionState.setDecorationType('starBulletDecorationType', vscode.window.createTextEditorDecorationType({
            color: configuration.get('level2Color') || new vscode.ThemeColor('editorWarning.foreground'),
        }));

        /**
         * Defines the decoration type for custom bullet points using a plus sign (+).
         * This provides a subtle green color, often indicating additions.
         */
        this._extensionState.setDecorationType('plusBulletDecorationType', vscode.window.createTextEditorDecorationType({
            color: configuration.get('level3Color') || new vscode.ThemeColor('editorGutter.addedBackground'),
        }));

        /**
         * Defines the decoration type for custom bullet points using a minus sign (-).
         * This provides a subtle red color, often indicating deletions.
         */
        this._extensionState.setDecorationType('minusBulletDecorationType', vscode.window.createTextEditorDecorationType({
            color: configuration.get('level4Color') || new vscode.ThemeColor('editorGutter.deletedBackground'),
        }));

        /**
         * Defines the decoration type for numbered bullet points (e.g., "1.", "2)").
         * This provides a subtle orange/yellow color for differentiation.
         */
        this._extensionState.setDecorationType('numberedBulletDecorationType', vscode.window.createTextEditorDecorationType({
            color: configuration.get('level5Color') || new vscode.ThemeColor('editorBracketHighlight.foreground3'),
        }));

        /**
         * Defines the decoration type for blockquote prefixes (>).
         * This provides a subtle color for blockquote elements.
         */
        this._extensionState.setDecorationType('blockquoteDecorationType', vscode.window.createTextEditorDecorationType({
            color: configuration.get('blockquoteColor') || new vscode.ThemeColor('editor.foreground'),
        }));
    }
}