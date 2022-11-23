const { Toolkit } = require("actions-toolkit");
const nock = require("nock");
nock.disableNetConnect();

process.env.GITHUB_WORKFLOW = "demo-workflow";
process.env.GITHUB_ACTION = "require-checklist-action";
process.env.GITHUB_ACTOR = "YOUR_USERNAME";
process.env.GITHUB_REPOSITORY = "YOUR_USERNAME/action-test";
process.env.GITHUB_WORKSPACE = "/tmp/github/workspace";
process.env.GITHUB_SHA = "fake-sha-a1c85481edd2ea7d19052874ea3743caa8f1bdf6";

describe("Require Checklist", () => {
  let action, tools;

  Toolkit.run = jest.fn((actionFn) => {
    action = actionFn;
  });
  require(".");

  beforeEach(() => {
    jest.resetModules();

    tools = mockEvent("pull_request", {
      action: "opened",
      pull_request: { number: 17 },
    });
  });

  it("handles issues with no checklist, requireChecklist disabled", async () => {
    process.env.INPUT_REQUIRECHECKLIST = "false";

    mockIssueBody("No checklist in the body");
    mockIssueComments(["Or in the comments"]);

    tools.exit.success = jest.fn();
    await action(tools);
    expect(tools.exit.success).toBeCalledWith(
      "There are no incomplete task list items"
    );
  });

  it("handles issues with completed checklist", async () => {
    process.env.INPUT_REQUIRECHECKLIST = "true";

    mockIssueBody("Demo\r\n\r\n- [x] One\r\n- [x] Two\n- [x] Three");
    mockIssueComments(["- [x] Comment done"]);

    tools.log.success = jest.fn();
    tools.exit.success = jest.fn();

    await action(tools);

    expect(tools.log.success).toBeCalledWith("Completed task list item: One");
    expect(tools.log.success).toBeCalledWith("Completed task list item: Two");
    expect(tools.log.success).toBeCalledWith("Completed task list item: Three");
    expect(tools.log.success).toBeCalledWith(
      "Completed task list item: Comment done"
    );

    expect(tools.exit.success).toBeCalledWith(
      "There are no incomplete task list items"
    );
  });

  it("handles issues with no checklist, requireChecklist enabled", async () => {
    process.env.INPUT_REQUIRECHECKLIST = "true";

    mockIssueBody("No checklist in the body");
    mockIssueComments(["Or in the comments"]);

    tools.exit.failure = jest.fn();
    await action(tools);
    expect(tools.exit.failure).toBeCalledWith(
      "No task list was present and requireChecklist is turned on"
    );
  });

  it("handles incomplete checklist in body", async () => {
    mockIssueBody("Demo\r\n\r\n- [x] One\r\n- [ ] Two\n- [ ] Three");
    mockIssueComments(["No checklist in comment"]);

    tools.log.success = jest.fn();
    tools.log.fatal = jest.fn();
    tools.exit.failure = jest.fn();
    await action(tools);

    expect(tools.log.success).toBeCalledWith("Completed task list item: One");
    expect(tools.log.fatal).toBeCalledWith("Incomplete task list item: Two");
    expect(tools.log.fatal).toBeCalledWith("Incomplete task list item: Three");

    expect(tools.exit.failure).toBeCalledWith(
      "The following items are not marked as completed: Two, Three"
    );
  });

  it("handles checklist with inapplicable items in body", async () => {
    mockIssueBody("Demo\r\n\r\n- [x] One\r\n- [ ] ~Two~");
    mockIssueComments(["No checklist in comment"]);

    tools.log.success = jest.fn();
    tools.exit.success = jest.fn();
    await action(tools);

    expect(tools.log.success).toBeCalledWith("Completed task list item: One");

    expect(tools.exit.success).toBeCalledWith(
      "There are no incomplete task list items"
    );
  });

  it("handles incomplete checklist in comments", async () => {
    mockIssueBody("Nothing in the body");
    mockIssueComments(["Demo\r\n\r\n- [x] One\r\n- [ ] Two\n- [ ] Three"]);

    tools.log.success = jest.fn();
    tools.log.fatal = jest.fn();
    tools.exit.failure = jest.fn();
    await action(tools);

    expect(tools.log.success).toBeCalledWith("Completed task list item: One");
    expect(tools.log.fatal).toBeCalledWith("Incomplete task list item: Two");
    expect(tools.log.fatal).toBeCalledWith("Incomplete task list item: Three");

    expect(tools.exit.failure).toBeCalledWith(
      "The following items are not marked as completed: Two, Three"
    );
  });

  it("handles checklist with inapplicable items in comments", async () => {
    mockIssueBody("Nothing in the body");
    mockIssueComments(["Demo\r\n\r\n- [x] One\r\n- [ ] ~Two~"]);

    tools.log.success = jest.fn();
    tools.exit.success = jest.fn();
    await action(tools);

    expect(tools.log.success).toBeCalledWith("Completed task list item: One");

    expect(tools.exit.success).toBeCalledWith(
      "There are no incomplete task list items"
    );
  });

  it("handles issues with empty body, requireChecklist disabled", async () => {
    process.env.INPUT_REQUIRECHECKLIST = "false";

    mockIssueBody(null);
    mockIssueComments(["No checklist in comment"]);

    tools.exit.success = jest.fn();
    await action(tools);
    expect(tools.exit.success).toBeCalledWith(
      "There are no incomplete task list items"
    );
  });

  it("handles issues with empty body, requireChecklist enabled", async () => {
    process.env.INPUT_REQUIRECHECKLIST = "true";

    mockIssueBody(null);
    mockIssueComments(["No checklist in comment"]);

    tools.exit.failure = jest.fn();
    await action(tools);
    expect(tools.exit.failure).toBeCalledWith(
      "No task list was present and requireChecklist is turned on"
    );
  });
});

function mockIssueBody(body) {
  nock("https://api.github.com")
    .get("/repos/YOUR_USERNAME/action-test/issues/17")
    .reply(200, {
      body,
    });
}

function mockIssueComments(comments) {
  nock("https://api.github.com")
    .get("/repos/YOUR_USERNAME/action-test/issues/17/comments")
    .reply(
      200,
      comments.map((c) => {
        return { body: c };
      })
    );
}

function mockEvent(name, mockPayload) {
  jest.mock(
    "/github/workspace/event.json",
    () => {
      return mockPayload;
    },
    {
      virtual: true,
    }
  );

  process.env.GITHUB_EVENT_NAME = name;
  process.env.GITHUB_EVENT_PATH = "/github/workspace/event.json";

  return new Toolkit();
}
