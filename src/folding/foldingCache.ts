import * as vscode from 'vscode';

/**
 * Manages a cache for folding ranges to improve performance.
 * Folding ranges are computed by the IndentFoldingRangeProvider and stored here.
 * This prevents redundant computations, especially when the Enter key is pressed.
 */
export class FoldingCache {
    private static _instance: FoldingCache;
    private _cachedRanges: vscode.FoldingRange[] | undefined;
    private _documentUri: vscode.Uri | undefined;
    private _lastDocumentVersion: number | undefined;

    private constructor() { }

    public static getInstance(): FoldingCache {
        if (!FoldingCache._instance) {
            FoldingCache._instance = new FoldingCache();
        }
        return FoldingCache._instance;
    }

    /**
     * Sets the cached folding ranges for a given document.
     * @param document The document for which ranges are being cached.
     * @param ranges The folding ranges to cache.
     */
    public setCache(document: vscode.TextDocument, ranges: vscode.FoldingRange[]): void {
        this._documentUri = document.uri;
        this._lastDocumentVersion = document.version;
        this._cachedRanges = ranges;
    }

    /**
     * Retrieves cached folding ranges for a document if they are still valid.
     * A cache is considered valid if the document URI and version match the cached ones.
     * @param document The document for which to retrieve cached ranges.
     * @returns Cached folding ranges if valid, otherwise `undefined`.
     */
    public getCache(document: vscode.TextDocument): vscode.FoldingRange[] | undefined {
        if (this._documentUri?.toString() === document.uri.toString() &&
            this._lastDocumentVersion === document.version) {
            return this._cachedRanges;
        }
        return undefined; // Cache is stale or for a different document
    }

    /**
     * Clears the folding range cache.
     */
    public clearCache(): void {
        this._cachedRanges = undefined;
        this._documentUri = undefined;
        this._lastDocumentVersion = undefined;
    }
}