const core = require("@actions/core");
const github = require("@actions/github");

const TASK_LIST_ITEM = /(?:^|\n)\s*-\s+\[([ xX])\]\s+((?!~).*)/g;

async function action() {
  const bodyList = [];

  const token = core.getInput("token");
  const octokit = github.getOctokit(token);

  const issueNumber =
    core.getInput("issueNumber") || github.context.issue?.number;

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

  const { data: comments } = await octokit.rest.issues.listComments({
    ...github.context.repo,
    issue_number: issueNumber,
  });

  for (let comment of comments) {
    bodyList.push(comment.body);
  }

  // Check each comment for a checklist
  let containsChecklist = false;
  var incompleteItems = [];
  for (let body of bodyList) {
    var matches = [...body.matchAll(TASK_LIST_ITEM)];
    for (let item of matches) {
      var is_complete = item[1] != " ";
      var item_text = item[2];

      containsChecklist = true;

      if (is_complete) {
        console.log("Completed task list item: " + item[2]);
      } else {
        console.log("Incomplete task list item: " + item[2]);
        incompleteItems.push(item[2]);
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
