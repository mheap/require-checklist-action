# Require Checklist

GitHub Action that fails a PR if there are any incomplete checklists in the issue body and/or comments

## Usage

```yaml
name: Require Checklist
on: pull_request
jobs:
  my-job:
    runs-on: ubuntu-16.04
    steps:
      - uses: mheap/require-checklist-action@master
        with:
          requireChecklist: false # Set to true if needed
```
