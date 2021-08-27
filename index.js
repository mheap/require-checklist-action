const { Toolkit } = require("actions-toolkit");
const TASK_LIST_ITEM = /(?:^|\n)\s*-\s+\[([ xX])\]\s+(.*)/g;

Toolkit.run(async (tools) => {
  const bodyList = [];

  const { data: issue } = await tools.github.issues.get({
    ...tools.context.issue,
  });

  if (issue.body) {
    bodyList.push(issue.body)
  };

  const { data: comments } = await tools.github.issues.listComments({
    ...tools.context.issue,
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
        tools.log.success("Completed task list item: " + item[2]);
      } else {
        tools.log.fatal("Incomplete task list item: " + item[2]);
        incompleteItems.push(item[2]);
      }
    }
  }

  if (incompleteItems.length > 0) {
    tools.exit.failure(
      "The following items are not marked as completed: " +
        incompleteItems.join(", ")
    );
    return;
  }

  if (tools.inputs.requireChecklist != "false" && !containsChecklist) {
    tools.exit.failure(
      "No task list was present and requireChecklist is turned on"
    );
    return;
  }

  tools.exit.success("There are no incomplete task list items");
});
