# Require Checklist

A GitHub Action that fails a pull request if there are any incomplete checklists in the issue body and/or comments. The action is triggered when a pull request is opened or its first comment (the main pull request message) is edited.

## Usage

Create a file named `.github/workflows/require-checklist.yaml` (or any name in that directory), this file will contain the body of your GitHub Action.

### Use with a `pull_request` or `issue` event

This action will default to using the `pull_request` or `issue` number when used inside a workflow triggered by one of those events. Below is an example of how to use it.

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

### Use with a `workflow_run` event

If you would like to use this action outside of a `pull_request` or `issue` trigger. You can pass in the issue number manually. Note that "issue number" is used even in the context of pull requests.

```yaml
name: Require Checklist

on:
  workflow_run:
    workflows: ["Other Workflow"]
    types:
      - completed

jobs:
  job1:
    runs-on: ubuntu-latest
    steps:
      - uses: mheap/require-checklist-action@v2
        with:
          requireChecklist: false # If this is true and there are no checklists detected, the action will fail
          issueNumber: ${{ github.event.workflow_run.pull_requests[0].number }}
```

### Inapplicable checklist items

In case there are some items that are not applicable in given checklist they can be ~stroked through~ and this action will ignore them. For example:

- [X] Applicable item
- [ ] ~Inapplicable item~
