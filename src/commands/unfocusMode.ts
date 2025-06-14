import * as vscode from 'vscode';

/**
 * Implements the 'pointblank.unfocusMode' command.
 * This command is a simple wrapper around the built-in 'editor.unfoldAll' command,
 * effectively restoring the full, unfolded view of the document.
 */
export async function unfocusModeCommand(): Promise<void> {
    try {
        await vscode.commands.executeCommand('editor.unfoldAll');
    } catch (error) {
        vscode.window.showErrorMessage(`Point Blank: Error in Unfocus Mode: ${error instanceof Error ? error.message : String(error)}`);
    }
}