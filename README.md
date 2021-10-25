# Require Checklist

A GitHub Action that fails a pull request if there are any incomplete checklists in the issue body and/or comments. The action is triggered when a pull request is opened or its first comment (the main pull request message) is edited.

## Usage

Create a file named `.github/workflows/require-checklist.yaml` (or any name in that directory) with the following content:

```yaml
name: Require Checklist
on:
  pull_request:
    types: [opened, edited, synchronize]
jobs:
  job1:
    runs-on: ubuntu-16.04
    steps:
      - uses: mheap/require-checklist-action@v1
        with:
          requireChecklist: false # If this is true and there are no checklists detected, the action will fail
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
