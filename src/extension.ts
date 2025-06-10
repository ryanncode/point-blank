// ---- src/extension.ts ----
// This is the main logic file for the extension.

import * as vscode from 'vscode';

// Define the decoration type for the bullet points.
const bulletDecorationType = vscode.window.createTextEditorDecorationType({
    before: {
        contentText: '•',
        color: new vscode.ThemeColor('editor.foreground'),
        margin: '0 1em 0 0',
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
});

// Define decoration types for custom bullet points.
const starBulletDecorationType = vscode.window.createTextEditorDecorationType({
    color: new vscode.ThemeColor('editorWarning.foreground'), // Subtle yellow/gold
});

const plusBulletDecorationType = vscode.window.createTextEditorDecorationType({
    color: new vscode.ThemeColor('editorGutter.addedBackground'), // Subtle green
});

const minusBulletDecorationType = vscode.window.createTextEditorDecorationType({
    color: new vscode.ThemeColor('editorGutter.deletedBackground'), // Subtle red
});

/**
 * A class that provides folding ranges based on indentation.
 */
class IndentFoldingRangeProvider implements vscode.FoldingRangeProvider {
    provideFoldingRanges(
        document: vscode.TextDocument,
        context: vscode.FoldingContext,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.FoldingRange[]> {
        const ranges: vscode.FoldingRange[] = [];
        const stack: { indent: number; startLine: number }[] = [];

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            if (line.isEmptyOrWhitespace) {
                continue;
            }

            const currentIndent = line.firstNonWhitespaceCharacterIndex;

            // While the current line's indent is less than or equal to the
            // indent of the last item on the stack, we've finished a folding block.
            while (stack.length > 0 && currentIndent <= stack[stack.length - 1].indent) {
                const top = stack.pop()!;
                // The fold ends on the line *before* the current one.
                if (i > top.startLine) {
                    ranges.push(new vscode.FoldingRange(top.startLine, i - 1));
                }
            }

            // If the next line is more indented, start a new folding range.
            if (i + 1 < document.lineCount) {
                const nextLine = document.lineAt(i + 1);
                if (!nextLine.isEmptyOrWhitespace && nextLine.firstNonWhitespaceCharacterIndex > currentIndent) {
                    stack.push({ indent: currentIndent, startLine: i });
                }
            }
        }

        // Close any remaining open folds at the end of the file.
        while (stack.length > 0) {
            const top = stack.pop()!;
            ranges.push(new vscode.FoldingRange(top.startLine, document.lineCount - 1));
        }

        return ranges;
    }
}

// Helper function to check if a line should be excluded from bullet points (excluding fenced code blocks, which are handled by state).
function isExcludedLine(line: vscode.TextLine): boolean {
    const text = line.text.trim();
    // Markdown ATX headers: #, ##, etc.
    if (text.match(/^#+\s/)) {
        return true;
    }
    // Setext header underlines: === or --- (at least 3 characters)
    if (text.match(/^[=-]{3,}$/)) {
        return true;
    }
    // Horizontal rules: ***, ---, ___ (at least 3 characters, with optional spaces)
    if (text.match(/^(\* *){3,}$|^(- *){3,}$|^(_ *){3,}$/)) {
        return true;
    }
    return false;
}

// Main activation function
export function activate(context: vscode.ExtensionContext) {
    let activeEditor = vscode.window.activeTextEditor;

    function updateDecorations() {
        if (!activeEditor) {
            return;
        }

        const document = activeEditor.document;
        const foldingProvider = new IndentFoldingRangeProvider();
        const foldingRanges = foldingProvider.provideFoldingRanges(document, {} as vscode.FoldingContext, {} as vscode.CancellationToken);

        const startLines = new Set<number>();
        if (foldingRanges) {
            (foldingRanges as vscode.FoldingRange[]).forEach(range => {
                startLines.add(range.start);
            });
        }

        const bulletDecorations: vscode.DecorationOptions[] = [];
        const starBulletDecorations: vscode.DecorationOptions[] = [];
        const plusBulletDecorations: vscode.DecorationOptions[] = [];
        const minusBulletDecorations: vscode.DecorationOptions[] = [];
        let inCodeBlock = false; // State to track if we are inside a fenced code block

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text.trim();

            // Toggle inCodeBlock state for fenced code block delimiters
            if (text.startsWith('```')) {
                inCodeBlock = !inCodeBlock;
                continue; // Exclude the delimiter line itself
            }

            // Exclude lines inside a fenced code block
            if (inCodeBlock) {
                continue;
            }

            // Exclude empty or whitespace-only lines
            if (line.isEmptyOrWhitespace) {
                continue;
            }
            
            // Exclude other types of excluded lines (headers, horizontal rules)
            if (isExcludedLine(line)) {
                continue;
            }

            const firstCharIndex = line.firstNonWhitespaceCharacterIndex;
            const firstChar = line.text.charAt(firstCharIndex);

            // Check for custom bullet points (*, +, -) and apply specific decoration
            if (firstChar === '*' && line.text.charAt(firstCharIndex + 1) === ' ') {
                const range = new vscode.Range(i, firstCharIndex, i, firstCharIndex + 1);
                starBulletDecorations.push({ range });
                continue;
            }
            if (firstChar === '+' && line.text.charAt(firstCharIndex + 1) === ' ') {
                const range = new vscode.Range(i, firstCharIndex, i, firstCharIndex + 1);
                plusBulletDecorations.push({ range });
                continue;
            }
            if (firstChar === '-' && line.text.charAt(firstCharIndex + 1) === ' ') {
                const range = new vscode.Range(i, firstCharIndex, i, firstCharIndex + 1);
                minusBulletDecorations.push({ range });
                continue;
            }

            // Apply default bullet decoration to all other non-excluded lines
            const range = new vscode.Range(i, firstCharIndex, i, firstCharIndex);
            bulletDecorations.push({ range });
        }
        activeEditor.setDecorations(bulletDecorationType, bulletDecorations);
        activeEditor.setDecorations(starBulletDecorationType, starBulletDecorations);
        activeEditor.setDecorations(plusBulletDecorationType, plusBulletDecorations);
        activeEditor.setDecorations(minusBulletDecorationType, minusBulletDecorations);
    }

    // Register our new FoldingRangeProvider for plain text and markdown files.
    // You can add more language identifiers here.
    context.subscriptions.push(
        vscode.languages.registerFoldingRangeProvider(
            ['plaintext', 'markdown', 'untitled'],
            new IndentFoldingRangeProvider()
        )
    );

    if (activeEditor) {
        updateDecorations();
    }

    vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            updateDecorations();
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeTextDocument(event => {
        if (activeEditor && event.document === activeEditor.document) {
            updateDecorations();
        }
    }, null, context.subscriptions);
}

export function deactivate() {}

