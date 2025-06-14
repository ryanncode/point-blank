import * as vscode from 'vscode';

/**
 * Manages the configuration settings for the Point Blank extension.
 * This class acts as a singleton to provide a single point of access to configuration values
 * and to initialize VS Code decoration types based on those settings.
 */
export class Configuration {
    private static _instance: Configuration;

    private constructor() { }

    /**
     * Returns the singleton instance of the Configuration class.
     */
    public static getInstance(): Configuration {
        if (!Configuration._instance) {
            Configuration._instance = new Configuration();
        }
        return Configuration._instance;
    }

    /**
     * Retrieves the VS Code workspace configuration for the 'pointblank' extension.
     */
    private getConfiguration(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration('pointblank');
    }

    /**
     * Gets the configured debounce delay for decoration updates.
     * @returns The delay in milliseconds.
     */
    public getDebounceDelay(): number {
        return this.getConfiguration().get<number>('debounceDelay', 15);
    }

    /**
     * Gets the configured viewport buffer size. This determines how many extra lines
     * above and below the visible viewport are rendered to ensure smooth scrolling.
     * @returns The number of buffer lines.
     */
    public getViewportBuffer(): number {
        return this.getConfiguration().get<number>('viewportBuffer', 20);
    }

    /**
     * Returns a map of decoration type names to their corresponding `vscode.DecorationRenderOptions`.
     * This method provides the raw options needed to create decoration types,
     * without creating or managing the `vscode.TextEditorDecorationType` objects themselves.
     * @returns A Map where keys are decoration type names and values are `vscode.DecorationRenderOptions`.
     */
    public getDecorationRenderOptions(): Map<string, vscode.DecorationRenderOptions> {
        const config = this.getConfiguration();
        const decorationOptions = new Map<string, vscode.DecorationRenderOptions>();

        // Decoration for '*' bullet points.
        decorationOptions.set('starBulletDecorationType', {
            color: config.get('level2Color') || new vscode.ThemeColor('editorWarning.foreground'),
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
        });

        // Decoration for '+' bullet points.
        decorationOptions.set('plusBulletDecorationType', {
            color: config.get('level3Color') || new vscode.ThemeColor('editorGutter.addedBackground'),
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
        });

        // Decoration for '-' bullet points.
        decorationOptions.set('minusBulletDecorationType', {
            color: config.get('level4Color') || new vscode.ThemeColor('editorGutter.deletedBackground'),
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
        });

        // Decoration for numbered bullet points (e.g., "1.", "2)").
        decorationOptions.set('numberedBulletDecorationType', {
            color: config.get('level5Color') || new vscode.ThemeColor('editorBracketHighlight.foreground3'),
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
        });

        // Decoration for blockquote prefixes ('>').
        decorationOptions.set('blockquoteDecorationType', {
            color: config.get('blockquoteColor') || new vscode.ThemeColor('comment'),
        });

        // Decoration for the key part of 'Key::' properties.
        decorationOptions.set('keyValueDecorationType', {
            color: config.get('keyValueColor') || new vscode.ThemeColor('textSeparator.foreground'),
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
        });

        // Decoration for typed nodes (e.g., "(Book)").
        decorationOptions.set('typedNodeDecorationType', {
            color: new vscode.ThemeColor('textLink.foreground'),
            fontWeight: 'bold',
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
        });

        return decorationOptions;
    }
}