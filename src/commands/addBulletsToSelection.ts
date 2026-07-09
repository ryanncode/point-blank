import * as vscode from 'vscode';

export class AddBulletsToSelection {
    public async addBulletsToSelectionCommand(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }

        const config = vscode.workspace.getConfiguration('pointblank');
        const defaultBullet = config.get<string>('defaultBulletPoint', '• ');

        const selection = editor.selection;
        if (selection.isEmpty) { return; }

        let endLine = selection.end.line;
        // If selection ends at the very beginning of a line, don't include that line
        if (selection.end.character === 0 && endLine > selection.start.line) {
            endLine--;
        }

        await editor.edit(editBuilder => {
            for (let i = selection.start.line; i <= endLine; i++) {
                const line = editor.document.lineAt(i);
                const text = line.text;
                
                // Ignore empty lines
                if (text.trim() === '') { continue; }
                
                // Check if it already has a bullet or is a header
                if (!/^\s*([\u2022\-\*\•\+])\s/.test(text) && !/^\s*#+\s/.test(text)) {
                    // Prepend bullet after indentation
                    const indentMatch = text.match(/^\s*/);
                    const indent = indentMatch ? indentMatch[0] : '';
                    const content = text.substring(indent.length);
                    const replacement = indent + defaultBullet + content;
                    
                    editBuilder.replace(line.range, replacement);
                }
            }
        });
    }
}
