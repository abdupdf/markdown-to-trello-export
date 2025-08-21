# Trello Export Script

This script exports unchecked checklist items from a Markdown file generated from your project using Cursor to Trello cards. It allows for flexible grouping of cards into Trello lists based on Markdown headings.

here's when to use it, when you're working on a porject in Cursor and you have generated a to-do list for your project in markdown, you might want to export that to-do to Trello for your team or customer to see your progress. this script helps you to do that in seconds.
it's customizable and to add more features for your own needs just open the script in Cursor and tell it to add (feature 1) or tell it to run it. 

> P.S if it's confusing just tell Cursor to run it based on your project. 

## Setup

1.  **Obtain Trello API Key and Token:**
    *   Go to [https://trello.com/app-key](https://trello.com/app-key).
    *   Copy your **API Key**.
    *   Click on "Generate a new token" to get your **API Token**.

2.  **Get Trello Board ID:**
    *   Navigate to your Trello board in your web browser.
    *   The Board ID is part of the URL, e.g., `https://trello.com/b/<BOARD_ID>/your-board-name`.

3.  **Set Environment Variables:**
    Create a `.env` file in the root of your project or set these variables directly in your shell:

    ```bash
    TRELLO_KEY="your_trello_api_key"
    TRELLO_TOKEN="your_trello_api_token"
    TRELLO_BOARD_ID="your_trello_board_id"
    ```

## Usage

Navigate to the script directory in your terminal:

```bash
cd scripts/export-trello
```

Run the script:

```bash
node export-trello.js
```

### Options (Environment Variables)

You can customize the script's behavior by setting these optional environment variables:

*   `TRELLO_LIST_ID`: (Optional) If provided, all cards will be exported to this specific Trello list. This overrides the grouping behavior.
    ```bash
    TRELLO_LIST_ID="your_existing_list_id" node export-trello.js
    ```
*   `TRELLO_LIST_NAME`: (Optional) The name for a new Trello list if `TRELLO_LIST_ID` is set. Default is `Markdown Export YYYY-MM-DD`.
    ```bash
    TRELLO_LIST_NAME="My Custom List" TRELLO_LIST_ID="..." node export-trello.js
    ```
*   `EXCLUDE_COMPLETED`: Set to `1` to skip checklist items marked as completed (`- [x]`). Default is `0` (include all).
    ```bash
    EXCLUDE_COMPLETED=1 node export-trello.js
    ```
*   `INCLUDE_TOPLEVEL`: Set to `1` to include top-level checklist items (tasks without indentation). Default is `0` (skip top-level).
    ```bash
    INCLUDE_TOPLEVEL=1 node export-trello.js
    ```
*   `GROUP_BY`: Determines how Trello lists are created based on Markdown headings. Can be `h4`, `h3`, or `h2`. Default is `h4` (falls back to `h3` then `h2` if `h4` is not present).
    ```bash
    GROUP_BY=h3 node export-trello.js
    ```

## Markdown Checklist Format

The script expects checklist items in the format:

```markdown
- [ ] My unchecked task
  - [x] My completed sub-task (will be skipped if EXCLUDE_COMPLETED=1)
- [ ] Another task
```

Headings are used for grouping:

```markdown
## Major Section
### Sub-Section A
#### Detail Group 1
- [ ] Task 1.1
- [ ] Task 1.2

#### Detail Group 2
- [ ] Task 2.1

### Sub-Section B
- [ ] Task 3.1
```

In this example, if `GROUP_BY=h4`, tasks will go to "Detail Group 1" and "Detail Group 2" lists. If `GROUP_BY=h3`, tasks will go to "Sub-Section A" and "Sub-Section B" lists.



## 🔗 Links
[![twitter](https://img.shields.io/badge/twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://x.com/alharari01)
