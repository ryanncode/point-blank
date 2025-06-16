---
layout: default
title: Queries
---

# Queries

Point Blank's inline query language allows you to search for and list files or specific blocks of content within your notes. This powerful feature helps you quickly find relevant information based on defined properties.

## Query Syntax

The general syntax for a query is as follows:

`LIST FROM [FILES|BLOCKS] [IN this.file|this.folder|workspace] WHERE <conditions> SORT BY <key> [ASC|DESC]`

### `LIST FROM [FILES|BLOCKS]`

This clause specifies what you want to list:
*   `FILES`: Returns a list of file paths that match your criteria.
*   `BLOCKS`: Returns a list of links to specific content blocks within files that match your criteria. These links are formatted as `[[relative/path#header]]` or `[[relative/path]]` if no preceding header is found.

### `IN [this.file|this.folder|workspace]`

This optional clause defines the scope of your search:
*   `this.file`: Searches only within the currently active file.
*   `this.folder`: Searches within the folder containing the current file, including all its subfolders.
*   `workspace`: Searches across your entire VS Code workspace (this is the default if no `IN` clause is specified).

### `WHERE <conditions>`

This optional clause allows you to filter results based on property values. Conditions are applied to the `Key:: Value` pairs found in your files or blocks.

*   **Operators:**
    *   `=`: Equality (e.g., `Status = "Done"`)
    *   `!=`: Not equal to (e.g., `Priority != "Low"`)
    *   `>`: Greater than (for numeric or date comparisons, e.g., `Date > "2024-01-01"`)
    *   `<`: Less than (for numeric or date comparisons, e.g., `Version < 1.0`)
    *   `::`: Existence check (e.g., `Type::` checks if the `Type` property exists, regardless of its value).

*   **Conjunctions:**
    *   `AND`: All conditions must be true.
    *   `OR`: At least one condition must be true.

**Important Note on Grouping:** The query parser currently supports chaining multiple conditions with a single `AND` or `OR` conjunction. **Parentheses `()` for grouping complex `WHERE` clauses (e.g., `WHERE A AND (B OR C)`) are NOT supported.** If you need to combine `AND` and `OR` logic, you may need to run separate queries or refine your data structure.

### `SORT BY <key> [ASC|DESC]`

This optional clause allows you to sort your results based on a property key.
*   `<key>`: The property name to sort by (e.g., `DueDate`, `Priority`).
*   `ASC`: Ascending order (A-Z, 0-9, oldest to newest). This is the default.
*   `DESC`: Descending order (Z-A, 9-0, newest to oldest).

## Query Examples

Here are several examples demonstrating the use of the query language:

### Basic Queries

1.  **List all files tagged as "Meeting" in the workspace:**
    ```
    LIST FROM FILES WHERE Type = "Meeting"
    ```

2.  **List all "Task" blocks in the workspace:**
    ```
    LIST FROM BLOCKS WHERE Type = "Task"
    ```

### Scoped Queries

3.  **Find all "Idea" blocks within the current file:**
    ```
    LIST FROM BLOCKS IN this.file WHERE Type = "Idea"
    ```

4.  **List all "Project" files within the current folder (and its subfolders):**
    ```
    LIST FROM FILES IN this.folder WHERE Type = "Project"
    ```

### Filtered Queries

5.  **List all "Task" blocks with "High" priority:**
    ```
    LIST FROM BLOCKS WHERE Type = "Task" AND Priority = "High"
    ```

6.  **List all "Task" blocks that are not "Done":**
    ```
    LIST FROM BLOCKS WHERE Type = "Task" AND Status != "Done"
    ```

7.  **Find all "Meeting" blocks that occurred after January 1, 2024:**
    ```
    LIST FROM BLOCKS WHERE Type = "Meeting" AND Date > "2024-01-01"
    ```

8.  **List all "Task" blocks that are either "Pending" or "In Progress":**
    ```
    LIST FROM BLOCKS WHERE Type = "Task" AND Status = "Pending" OR Status = "In Progress"
    ```

### Sorted Queries

9.  **List all incomplete "Task" blocks, sorted by `DueDate` in ascending order:**
    ```
    LIST FROM BLOCKS WHERE Type = "Task" AND Status != "Done" SORT BY DueDate ASC
    ```

10. **List all "Project" files, sorted by `Modified` date in descending order:**
    ```
    LIST FROM FILES WHERE Type = "Project" SORT BY Modified DESC
    ```

### Complex Queries (Combining Clauses)

11. **List all high-priority, incomplete "Task" blocks in the current folder, sorted by `DueDate`:**
    ```
    LIST FROM BLOCKS IN this.folder WHERE Type = "Task" AND Priority = "High" AND Status != "Done" SORT BY DueDate ASC

## Running Queries

There are two primary ways to execute queries in Point Blank: manually writing query blocks or using commands from the Command Palette.

### Manual Workflow

You can write queries directly in your markdown files. The query engine identifies queries by a special HTML comment.

1.  **Write the Query:** Type your query inside a comment block like this:
    ```markdown
    <!-- pointblank:query LIST FROM BLOCKS WHERE Type = "Task" AND Status = "Pending" -->
    ```
2.  **Execute the Query:** Place your cursor anywhere in the file and run the **`Point Blank: Update Query`** command from the VS Code Command Palette (`Ctrl+Shift+P`). The extension will find the nearest query block (searching down from the cursor), execute it, and insert the results directly above the comment block.

### Using Commands

Point Blank provides commands to simplify the process of creating and updating queries.

*   **`Point Blank: Insert Query by Type`** (`pointblank.insertTypeQuery`)
    *   This command will prompt you to enter a `Type` name (e.g., "Task", "Note").
    *   It will then insert a complete query block into the editor, ready to be executed.
    *   Example Query Inserted: `LIST FROM BLOCKS WHERE Type::Task`

*   **`Point Blank: Update Query`** (`pointblank.updateTypeQuery`)
    *   This command searches for the nearest query block below your cursor's current position.
    *   It re-runs the query and replaces the old results with the new ones. This is useful for refreshing a list after you've made changes to your notes.

## Command Reference

| Command | ID | Description |
| :--- | :--- | :--- |
| Insert Query by Type | `pointblank.insertTypeQuery` | Prompts for a type and inserts a new query block. |
| Update Query | `pointblank.updateTypeQuery` | Updates the results of the nearest query block. |