import * as vscode from 'vscode';

/**
 * Implements the 'pointblank.unfocusMode' command.
 * This command unfolds all code blocks in the active editor, restoring the full view.
 */
export async function unfocusModeCommand(): Promise<void> {
    try {
        await vscode.commands.executeCommand('editor.unfoldAll');
    } catch (error) {
        vscode.window.showErrorMessage(`Error in Unfocus Mode: ${error instanceof Error ? error.message : String(error)}`);
    }
}