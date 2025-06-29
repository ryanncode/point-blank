/**
 * Returns the bullet style to use for a line, checking line below first, then above, then default.
 * @param document The document-like object (must support .lineAt(lineNumber) and .lineCount)
 * @param lineNumber The line number where the check occurs
 * @param indent The indent level to match
 * @param defaultBullet The fallback bullet (default: '• ')
 */
export function getBulletStyleFromAdjacentLines(document: { lineAt: (n: number) => { text: string, firstNonWhitespaceCharacterIndex: number }, lineCount: number }, lineNumber: number, indent: number, defaultBullet = '• '): string {
    function detectBulletFromLine(line: string): string | null {
        const match = line.match(/^\s*([\u2022\-\*\•\+])\s/);
        return match ? match[1] + ' ' : null;
    }
    // Check line below
    if (lineNumber + 1 < document.lineCount) {
        const line = document.lineAt(lineNumber + 1);
        if (line.text.trim().length > 0 && line.firstNonWhitespaceCharacterIndex === indent) {
            const bullet = detectBulletFromLine(line.text);
            if (bullet) { return bullet; }
        }
    }
    // Check line above
    if (lineNumber - 1 >= 0) {
        const line = document.lineAt(lineNumber - 1);
        if (line.text.trim().length > 0 && line.firstNonWhitespaceCharacterIndex === indent) {
            const bullet = detectBulletFromLine(line.text);
            if (bullet) { return bullet; }
        }
    }
    return defaultBullet;
}
/**
 * Returns the default bullet for the outliner.
 */
export function getDefaultBullet(): string {
    return '• ';
}
/**
 * Finds the bullet style from the next or previous non-empty sibling line with the same indentation.
 * Searches down first, then up, stopping at the first empty line in each direction.
 * Returns the bullet from that line, or the default if none found.
 */
export function findSiblingBulletByIndent(document: { lineAt: (n: number) => { text: string, firstNonWhitespaceCharacterIndex: number }, lineCount: number }, lineNumber: number, indent: number, defaultBullet = '• '): string {
    // Check 1 line below
    if (lineNumber + 1 < document.lineCount) {
        const line = document.lineAt(lineNumber + 1);
        if (line.text.trim().length > 0 && line.firstNonWhitespaceCharacterIndex === indent) {
            return getBulletFromLineString(line.text) ?? defaultBullet;
        }
    }
    // Check 1 line above
    if (lineNumber - 1 >= 0) {
        const line = document.lineAt(lineNumber - 1);
        if (line.text.trim().length > 0 && line.firstNonWhitespaceCharacterIndex === indent) {
            return getBulletFromLineString(line.text) ?? defaultBullet;
        }
    }
    return defaultBullet;
}
import { getBulletFromLineString } from './bulletPointUtils';

/**
 * Returns the bullet string to use for a new line at the given block node's position.
 * Prefers next sibling's bullet (if not blank), then previous sibling's bullet (if not blank), then default.
 * Uses getBulletFromLine for robust detection and number incrementing.
 * @param currentBlockNode The block node at the current line.
 * @param document The vscode.TextDocument for line access.
 * @param defaultBullet The bullet to use if no sibling bullet is found (default: '• ')
 */
// getBulletForNewLine is not used in pure logic and requires BlockNode/vscode context. Remove or refactor if needed for pure tests.
