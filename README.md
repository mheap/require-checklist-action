# Require Checklist

A GitHub Action that fails a pull request if there are any incomplete checklists in the issue body and/or comments. The action is triggered when a pull request is opened, when regular comments are added (not review or code comments), and when comments are edited.

## Usage

Create a file named `.github/workflows/require-checklist.yaml` (or any name in that directory) with the following content:

```yaml
name: Require Checklist
on:
  pull_request:
    types: [opened, edited]
  issue_comment:
    types: [created, edited, deleted]
jobs:
  job1:
    runs-on: ubuntu-16.04
    steps:
      - uses: mheap/require-checklist-action@master
        with:
          github_token: ${{ github.token }}
          requireChecklist: false # Set to true if needed
```
