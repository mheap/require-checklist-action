# Require Checklist

A GitHub Action that fails a pull request if there are any incomplete checklists in the issue body and/or comments. The action is triggered when a pull request is opened or its first comment (the main pull request message) is edited.

## Usage

Create a file named `.github/workflows/require-checklist.yaml` (or any name in that directory) with the following content:

```yaml
name: Require Checklist
on:
  pull_request:
    types: [opened, edited, synchronize]
  issues:
    types: [opened, edited, deleted]
jobs:
  job1:
    runs-on: ubuntu-latest
    steps:
      - uses: mheap/require-checklist-action@v2
        with:
          requireChecklist: false # If this is true and there are no checklists detected, the action will fail
```

### Inapplicable checklist items

In case there are some items that are not applicable in given checklist they can be ~stroked through~ and this action will ignore them. For example:

- [X] Applicable item
- [ ] ~Inapplicable item~
