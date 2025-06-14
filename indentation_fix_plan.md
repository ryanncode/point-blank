# Plan to Fix Indentation Regression

This document outlines the plan to fix the indentation regression bug in the "paste with bullets" feature.

## Problem Description

When pasting text at the beginning of a line, the indentation of the first pasted line is incorrect. It currently only uses the indentation of the cursor's line, ignoring the original indentation of the first line from the clipboard.

The correct behavior is to sum the cursor's current indentation with the first pasted line's original indentation.

## Root Cause Analysis

The issue stems from an incorrect understanding of the `editBuilder.replace` API in VS Code. When replacing an entire line, the editor does not automatically preserve or add any base indentation. The new line content is inserted exactly as provided.

The current implementation fails to calculate and prepend the combined indentation to the first line of the pasted text.

## The Fix

The fix involves a targeted change in `src/commands/pasteWithBullets.ts` within the `if (isPastingAtLineStart)` block.

1.  **Calculate Final Indentation:** The total indentation for the first line must be calculated as the sum of the current line's indentation and the first clipboard line's original indentation.
    ```
    const finalIndentation = currentLineIndentation + firstClipboardLineOriginalIndent;
    ```

2.  **Construct the Corrected First Line:** The first line to be pasted must be constructed with this new `finalIndentation`.
    *   **Current (Incorrect):** `clipboardProcessedLines.push(' '.repeat(currentLineIndentation) + finalFirstLineContent);`
    *   **Corrected:** `clipboardProcessedLines.push(' '.repeat(finalIndentation) + finalFirstLineContent);`

3.  **Replace the Full Line:** The existing `editBuilder.replace` call, which replaces the entire line, will then correctly apply the fully constructed line with the proper indentation.

This change will restore the correct indentation behavior without affecting the other bug fixes that have been implemented (e.g., robust bullet detection and cursor positioning).