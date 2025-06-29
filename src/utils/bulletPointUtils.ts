/**
 * Pure version: Returns the bullet string for a line of text, or null if none found.
 */
export function getBulletFromLineString(lineText: string): string | null {
    const match = lineText.match(/^	*([\u2022\-\*\•])\s/);
    return match ? match[1] + ' ' : null;
}