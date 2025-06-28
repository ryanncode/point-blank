/**
 * Finds the bullet style from the next or previous non-empty sibling line with the same indentation.
 * Searches down first, then up, stopping at the first empty line in each direction.
 * Returns the bullet from that line, or the default if none found.
 */
export function findSiblingBulletByIndent(document: import('vscode').TextDocument, lineNumber: number, indent: number, defaultBullet = '• '): string {
    // Search down
    for (let i = lineNumber + 1; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        if (line.text.trim().length === 0) { break; }
        if (line.firstNonWhitespaceCharacterIndex === indent) {
            return require('./bulletPointUtils').getBulletFromLine(line);
        }
    }
    // Search up
    for (let i = lineNumber - 1; i >= 0; i--) {
        const line = document.lineAt(i);
        if (line.text.trim().length === 0) { break; }
        if (line.firstNonWhitespaceCharacterIndex === indent) {
            return require('./bulletPointUtils').getBulletFromLine(line);
        }
    }
    return defaultBullet;
}
import { BlockNode } from '../document/blockNode';
import * as vscode from 'vscode';
import { getBulletFromLine } from './bulletPointUtils';

/**
 * Returns the bullet string to use for a new line at the given block node's position.
 * Prefers next sibling's bullet (if not blank), then previous sibling's bullet (if not blank), then default.
 * Uses getBulletFromLine for robust detection and number incrementing.
 * @param currentBlockNode The block node at the current line.
 * @param document The vscode.TextDocument for line access.
 * @param defaultBullet The bullet to use if no sibling bullet is found (default: '• ')
 */
export function getBulletForNewLine(currentBlockNode: BlockNode, document: vscode.TextDocument, defaultBullet = '• '): string {
    if (!currentBlockNode || !currentBlockNode.parent) { return defaultBullet; }
    const siblings = currentBlockNode.parent.children;
    const idx = siblings.findIndex(n => n.lineNumber === currentBlockNode.lineNumber);
    // Try next sibling (line below, same indent, not blank)
    if (idx !== -1 && idx + 1 < siblings.length) {
        const next = siblings[idx + 1];
        if (
            next.indent === currentBlockNode.indent &&
            next.line.text.trim().length > 0
        ) {
            try {
                const nextLine = document.lineAt(next.lineNumber);
                const bullet = getBulletFromLine(nextLine);
                if (bullet && bullet.trim().length > 0) {
                    return bullet;
                }
            } catch {}
        }
    }
    // Try previous sibling (line above, same indent, not blank)
    if (idx > 0) {
        const prev = siblings[idx - 1];
        if (
            prev.indent === currentBlockNode.indent &&
            prev.line.text.trim().length > 0
        ) {
            try {
                const prevLine = document.lineAt(prev.lineNumber);
                const bullet = getBulletFromLine(prevLine);
                if (bullet && bullet.trim().length > 0) {
                    return bullet;
                }
            } catch {}
        }
    }
    return defaultBullet;
}
