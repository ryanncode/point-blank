import * as vscode from 'vscode';

/**
 * Checks if a given line should be excluded from bullet point decoration.
 * This function identifies various markdown syntax elements that should not be treated as list items.
 * Fenced code blocks are handled by state in the decoration applier and are not checked here.
 *
 * @param line The `vscode.TextLine` object to check.
 * @returns `true` if the line should be excluded, `false` otherwise.
 */
export function isExcludedLine(line: vscode.TextLine): boolean {
    const text = line.text;

    // Markdown ATX headers: #, ##, etc.
    // Can be preceded by up to 3 spaces.
    if (text.match(/^[ ]{0,3}#+\s/)) {
        return true;
    }
    const trimmedText = text.trim();
    // Setext header underlines: === or --- (at least 3 characters)
    if (trimmedText.match(/^[=-]{3,}$/)) {
        return true;
    }

    // Horizontal rules: ***, ---, ___ (at least 3 characters, with optional spaces)
    if (trimmedText.match(/^(\* *){3,}$|^(- *){3,}$|^(_ *){3,}$/)) {
        return true;
    }

    // Typed node trigger: @TypeName
    // Matches lines starting with @ followed by zero or more word characters.
    if (text.match(/^\s*@\w*$/)) {
        return true;
    }

    return false;
}