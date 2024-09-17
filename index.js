const core = require("@actions/core");
const github = require("@actions/github");

const TASK_LIST_ITEM = /(?:^|\n)\s*-\s+\[([ xX])\]\s+((?!~).*)/g;
const COMMENT_START = "<!--";
const COMMENT_END = "-->";

async function action() {
  const bodyList = [];

  const token = core.getInput("token");
  const octokit = github.getOctokit(token);
  const skipRegexPattern = core.getInput("skipDescriptionRegex");
  const skipRegexFlags = core.getInput("skipDescriptionRegexFlags");
  const skipDescriptionRegex = !!skipRegexPattern ? new RegExp(skipRegexPattern, skipRegexFlags) : false;

  let issueNumber =
    core.getInput("issueNumber") || github.context.issue?.number;

  if (!issueNumber && github.context.eventName == "merge_queue") {
    // Parse out of the ref for merge queue
    // e.g. refs/heads/gh-readonly-queue/main/pr-17-a3c310584587d4b97c2df0cb46fe050cc46a15d6
    const lastPart = github.context.ref.split("/").pop();
    issueNumber = lastPart.match(/pr-(\d+)-/)[1];
  }

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

  // Check each comment for a checklist
  let containsChecklist = false;
  let openComment = false;
  var incompleteItems = [];
  for (let body of bodyList) {
    // Break in to lines to do comment detection
    for (let line of body.split("\n")) {
      if (line.includes(COMMENT_START)) {
        openComment = true;
      }

      if (line.includes(COMMENT_END)) {
        openComment = false;
      }

      if (!openComment) {
        var matches = [...line.matchAll(TASK_LIST_ITEM)];
        for (let item of matches) {
          var is_complete = item[1] != " ";

          if(skipRegexPattern && skipDescriptionRegex.test(item[2])) {
            console.log("Skipping task list item: " + item[2]);
            continue;
          }

          containsChecklist = true;

          if (is_complete) {
            console.log("Completed task list item: " + item[2]);
          } else {
            console.log("Incomplete task list item: " + item[2]);
            incompleteItems.push(item[2]);
          }
        }
      }
    }
  }

  if (incompleteItems.length > 0) {
    core.setFailed(
      "The following items are not marked as completed: " +
        incompleteItems.join(", ")
    );
    return;
  }

  const requireChecklist = core.getInput("requireChecklist");
  if (requireChecklist != "false" && !containsChecklist) {
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
