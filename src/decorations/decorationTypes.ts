import * as vscode from 'vscode';
import { ExtensionState } from '../state/extensionState';

/**
 * Provides access to the VS Code decoration types used by the Point Blank extension.
 * These types are initialized and managed by the `Configuration` and `ExtensionState` classes.
 * This file acts as a central point for importing these decoration types throughout the extension.
 */

const extensionState = ExtensionState.getInstance();

export const starBulletDecorationType = extensionState.getDecorationType('starBulletDecorationType') as vscode.TextEditorDecorationType;
export const plusBulletDecorationType = extensionState.getDecorationType('plusBulletDecorationType') as vscode.TextEditorDecorationType;
export const minusBulletDecorationType = extensionState.getDecorationType('minusBulletDecorationType') as vscode.TextEditorDecorationType;
export const numberedBulletDecorationType = extensionState.getDecorationType('numberedBulletDecorationType') as vscode.TextEditorDecorationType;
export const blockquoteDecorationType = extensionState.getDecorationType('blockquoteDecorationType') as vscode.TextEditorDecorationType;
export const typedNodeDecorationType = extensionState.getDecorationType('typedNodeDecorationType') as vscode.TextEditorDecorationType;