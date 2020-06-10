const { Toolkit } = require("actions-toolkit");

// Run your GitHub Action!
Toolkit.run(async (tools) => {
  const bodyList = [];

  const { data: issue } = await tools.github.issues.get({
    ...tools.context.issue,
  });

  bodyList.push(issue.body);

  const { data: comments } = await tools.github.issues.listComments({
    ...tools.context.issue,
  });

  for (let comment of comments) {
    bodyList.push(comment.body);
  }

  // Check each comment for a checklist
  let containsChecklist = false;
  for (let body of bodyList) {
    if (body.includes("\n- [ ]")) {
      tools.exit.failure("Incomplete checklist item detected");
    }

    if (body.includes("\n- [x]")) {
      containsChecklist = true;
    }
  }

  if (tools.inputs.requireChecklist != "false" && !containsChecklist) {
    tools.exit.failure("Checklist required but not detected");
  }
});
