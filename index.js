// @ts-check

const core = require("@actions/core");
const github = require("@actions/github");

const TASK_LIST_ITEM = /(?:^|\n)\s*-\s+\[(?<checkMark>[ xX])\]\s+(?<text>(?!~).*)/g;
const COMMENT_START = "<!--";
const COMMENT_END = "-->";
const RADIO_TAG_ITEM = /<!-- TaskRadio (?<radioTag>\S+) -->/g

async function action() {
  const bodyList = [];

  const token = core.getInput("token");
  const octokit = github.getOctokit(token);
  const skipRegexPattern = core.getInput("skipDescriptionRegex");
  const skipRegexFlags = core.getInput("skipDescriptionRegexFlags");
  const skipDescriptionRegex = !!skipRegexPattern ? new RegExp(skipRegexPattern, skipRegexFlags) : false;

  const issueNumber =
    parseInt(core.getInput("issueNumber")) || github.context.issue?.number;

  core.debug(`issue number: ${issueNumber}`);

  if (!issueNumber) {
    core.setFailed("Could not determine issue number");
    return;
  }

  const { data: issue } = await octokit.rest.issues.get({
    ...github.context.repo,
    issue_number: issueNumber,
  });

  if (issue.body) {
    bodyList.push(issue.body);
  }

  if (core.getInput("skipComments") != "true") {
    const { data: comments } = await octokit.rest.issues.listComments({
      ...github.context.repo,
      issue_number: issueNumber,
    });

    for (let comment of comments) {
      bodyList.push(comment.body);
    }
  }

  /**
   * @typedef {Object} ChecklistItem
   * @property {string} text
   * @property {string[]} radioGroups
   * @property {boolean} isComplete
   */

  /** @type ChecklistItem[][] */
  let checklistBodies = []

  // Collect check list items
  for (let body of bodyList) {
    // Check each comment for a checklist
    let multilineComment = false;

    if (typeof body === "undefined") continue

    /** @type ChecklistItem[] */
    let checklistItems = []

    // Break into lines to do comment detection
    for (let line of body.split("\n")) {
      // NOTE: Assume we never start nor end a multiline comment in the middle of a line... for now
      if (line.lastIndexOf(COMMENT_START) > line.lastIndexOf(COMMENT_END)) {
        multilineComment = true;
      }
      if (line.lastIndexOf(COMMENT_START) < line.lastIndexOf(COMMENT_END)) {
        multilineComment = false;
      }

      if (!multilineComment) {
        /**
         * @typedef {Object} TaskItem
         * @property {string} checkMark
         * @property {string} text
         */
        for (let match of line.matchAll(TASK_LIST_ITEM)) {
          if (typeof match.groups === "undefined") continue

          /** @type TaskItem */
          let item = (({ checkMark, text }) => ({ checkMark: checkMark || "", text: text || "" }))(match.groups)
          let is_complete = ["x", "X"].includes(item.checkMark);

          if (skipRegexPattern && skipDescriptionRegex && skipDescriptionRegex.test(item.text)) {
            console.log("Skipping task list item: " + item.text);
            continue;
          }

          if (is_complete) {
            console.log("Completed task list item: " + item.text);
          } else {
            console.log("Incomplete task list item: " + item.text);
          }

          checklistItems.push({
            text: item.text,
            radioGroups: [...item.text.matchAll(RADIO_TAG_ITEM)].map((radioMatch) => radioMatch.groups && radioMatch.groups.radioTag || "").filter((tag) => tag),
            isComplete: is_complete
          })
        }
      }
    }

    if (checklistItems.length > 0) checklistBodies.push(checklistItems)
  }

  /**
   * @typedef {Object.<string, ChecklistItem[]>} ChecklistRadioGroup
   */

  /** @type ChecklistItem[] */
  let incompleteItems = []
  /** @type ChecklistItem[][] */
  let radioConflictItems = []

  for (let items of checklistBodies) {
    /** @type ChecklistRadioGroup */
    let radioGroupedItems = {}

    for (let item of items) {
      if (item.radioGroups.length == 0 && !item.isComplete) {
        incompleteItems.push(item)
        continue
      }

      for (let radioGroup of item.radioGroups) {
        if (typeof radioGroupedItems[radioGroup] === "undefined") radioGroupedItems[radioGroup] = []
        radioGroupedItems[radioGroup].push(item)
      }
    }

    for (let group in radioGroupedItems) {
      let completedItems = radioGroupedItems[group].filter((item) => item.isComplete)

      if (completedItems.length == 0) incompleteItems.push(...radioGroupedItems[group])
      if (completedItems.length > 1) radioConflictItems.push(completedItems)
    }
  }

  if (incompleteItems.length > 0) {
    core.setFailed(
      "The following items are not marked as completed: " +
      incompleteItems.map((item) => item.text).join(", ")
    );
  }

  if (radioConflictItems.length > 0) {
    for (let items of radioConflictItems) {
      core.setFailed(
        "The following items cannot be marked as completed simultaneously: " +
        items.map((item) => item.text).join(", ")
      )
    }
    return
  }

  const requireChecklist = core.getInput("requireChecklist");
  if (requireChecklist != "false" && checklistBodies.length == 0) {
    core.setFailed(
      "No task list was present and requireChecklist is turned on"
    );
    return;
  }

  console.log("There are no incomplete task list items");
}

if (require.main === module) {
  action();
}

module.exports = action;
