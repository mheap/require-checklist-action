const action = require(".");
const core = require("@actions/core");
const github = require("@actions/github");
const nock = require("nock");
nock.disableNetConnect();
const mockEnv = require("mocked-env");

process.env.GITHUB_WORKFLOW = "demo-workflow";
process.env.GITHUB_ACTION = "require-checklist-action";
process.env.GITHUB_ACTOR = "YOUR_USERNAME";
process.env.GITHUB_REPOSITORY = "YOUR_USERNAME/action-test";
process.env.GITHUB_WORKSPACE = "/tmp/github/workspace";
process.env.GITHUB_SHA = "fake-sha-a1c85481edd2ea7d19052874ea3743caa8f1bdf6";
process.env.INPUT_TOKEN = "FAKE_GITHUB_TOKEN";

// Variables to store references to what we need to reset
let restore;
let restoreTest;

describe("Require Checklist", () => {
  let tools;

  beforeEach(() => {
    jest.resetModules();

    tools = mockEvent("pull_request", {
      action: "opened",
      pull_request: { number: 17 },
    });

    restoreTest = () => { };
  });

  afterEach(() => {
    restore();
    restoreTest();
  });

  it("handles issues with no checklist, requireChecklist disabled", async () => {
    restoreTest = mockEnv({
      INPUT_REQUIRECHECKLIST: "false",
    });

    mockIssueBody("No checklist in the body");
    mockIssueComments(["Or in the comments"]);

    console.log = jest.fn();
    await action(tools);
    expect(console.log).toBeCalledWith(
      "There are no incomplete task list items"
    );
  });

  it("handles issues with completed checklist", async () => {
    restoreTest = mockEnv({
      INPUT_REQUIRECHECKLIST: "true",
    });

    mockIssueBody("Demo\r\n\r\n- [x] One\r\n- [x] Two\n- [x] Three");
    mockIssueComments(["- [x] Comment done"]);

    console.log = jest.fn();

    await action(tools);

    expect(console.log).toBeCalledWith("Completed task list item: One");
    expect(console.log).toBeCalledWith("Completed task list item: Two");
    expect(console.log).toBeCalledWith("Completed task list item: Three");
    expect(console.log).toBeCalledWith(
      "Completed task list item: Comment done"
    );

    expect(console.log).toBeCalledWith(
      "There are no incomplete task list items"
    );
  });

  it("handles issues with no checklist, requireChecklist enabled", async () => {
    restoreTest = mockEnv({
      INPUT_REQUIRECHECKLIST: "true",
    });

    mockIssueBody("No checklist in the body");
    mockIssueComments(["Or in the comments"]);

    core.setFailed = jest.fn();
    await action(tools);
    expect(core.setFailed).toBeCalledWith(
      "No task list was present and requireChecklist is turned on"
    );
  });

  it("handles incomplete checklist in body", async () => {
    mockIssueBody("Demo\r\n\r\n- [x] One\r\n- [ ] Two\n- [ ] Three");
    mockIssueComments(["No checklist in comment"]);

    console.log = jest.fn();
    core.setFailed = jest.fn();
    await action(tools);

    expect(console.log).toBeCalledWith("Completed task list item: One");
    expect(console.log).toBeCalledWith("Incomplete task list item: Two");
    expect(console.log).toBeCalledWith("Incomplete task list item: Three");

    expect(core.setFailed).toBeCalledWith(
      "The following items are not marked as completed: Two, Three"
    );
  });

  it("handles checklist with inapplicable items in body", async () => {
    mockIssueBody("Demo\r\n\r\n- [x] One\r\n- [ ] ~Two~");
    mockIssueComments(["No checklist in comment"]);

    console.log = jest.fn();
    await action(tools);

    expect(console.log).toBeCalledWith("Completed task list item: One");

    expect(console.log).toBeCalledWith(
      "There are no incomplete task list items"
    );
  });

  it("handles checklist with commented out items", async () => {
    mockIssueBody(
      "Demo\r\n\r\n- [x] One\r\n<!-- Optional Tasks\n- [ ] Two\n-->"
    );
    mockIssueComments(["No checklist in comment"]);

    console.log = jest.fn();
    await action(tools);

    expect(console.log).toBeCalledWith("Completed task list item: One");

    expect(console.log).toBeCalledWith(
      "There are no incomplete task list items"
    );
  });

  it("handles checklist with commented out items on a single line", async () => {
    mockIssueBody("Demo\r\n\r\n- [x] One\r\n<!-- - [ ] Two -->");
    mockIssueComments(["No checklist in comment"]);

    console.log = jest.fn();
    await action(tools);

    expect(console.log).toBeCalledWith("Completed task list item: One");

    expect(console.log).toBeCalledWith(
      "There are no incomplete task list items"
    );
  });

  it("handles incomplete checklist in comments", async () => {
    mockIssueBody("Nothing in the body");
    mockIssueComments(["Demo\r\n\r\n- [x] One\r\n- [ ] Two\n- [ ] Three"]);

    console.log = jest.fn();
    core.setFailed = jest.fn();
    await action(tools);

    expect(console.log).toBeCalledWith("Completed task list item: One");
    expect(console.log).toBeCalledWith("Incomplete task list item: Two");
    expect(console.log).toBeCalledWith("Incomplete task list item: Three");

    expect(core.setFailed).toBeCalledWith(
      "The following items are not marked as completed: Two, Three"
    );
  });

  it("handles checklist with inapplicable items in comments", async () => {
    mockIssueBody("Nothing in the body");
    mockIssueComments(["Demo\r\n\r\n- [x] One\r\n- [ ] ~Two~"]);

    console.log = jest.fn();
    await action(tools);

    expect(console.log).toBeCalledWith("Completed task list item: One");

    expect(console.log).toBeCalledWith(
      "There are no incomplete task list items"
    );
  });

  it("handles issues with empty body, requireChecklist disabled", async () => {
    restoreTest = mockEnv({
      INPUT_REQUIRECHECKLIST: "false"
    });

    mockIssueBody(null);
    mockIssueComments(["No checklist in comment"]);

    await action(tools);
    expect(console.log).toBeCalledWith(
      "There are no incomplete task list items"
    );
  });

  it("handles issues with empty body, requireChecklist enabled", async () => {
    restoreTest = mockEnv({
      INPUT_REQUIRECHECKLIST: "true"
    });

    mockIssueBody(null);
    mockIssueComments(["No checklist in comment"]);

    core.setFailed = jest.fn();
    await action(tools);

    expect(core.setFailed).toBeCalledWith(
      "No task list was present and requireChecklist is turned on"
    );
  });

  it("handles using issue number input with completed checklist", async () => {
    restoreTest = mockEnv({
      INPUT_REQUIRECHECKLIST: "true",
      INPUT_ISSUENUMBER: "11"
    });

    const runTools = mockEvent("workflow_run", {});

    mockIssueBody(
      "Demo\r\n\r\n- [x] One\r\n- [x] Two\n- [x] Three",
      process.env.INPUT_ISSUENUMBER
    );
    mockIssueComments(["- [x] Comment done"], process.env.INPUT_ISSUENUMBER);

    console.log = jest.fn();
    await action(runTools);

    expect(console.log).toBeCalledWith("Completed task list item: One");
    expect(console.log).toBeCalledWith("Completed task list item: Two");
    expect(console.log).toBeCalledWith("Completed task list item: Three");
    expect(console.log).toBeCalledWith(
      "Completed task list item: Comment done"
    );

    expect(console.log).toBeCalledWith(
      "There are no incomplete task list items"
    );
  });

  it("handles using issue number input with incomplete checklist in comments", async () => {
    restoreTest = mockEnv({
      INPUT_ISSUENUMBER: "11"
    });

    const runTools = mockEvent("workflow_run", {});

    mockIssueBody("Nothing in the body", process.env.INPUT_ISSUENUMBER);
    mockIssueComments(
      ["Demo\r\n\r\n- [x] One\r\n- [ ] Two\n- [ ] Three"],
      process.env.INPUT_ISSUENUMBER
    );

    console.log = jest.fn();
    core.setFailed = jest.fn();
    await action(runTools);

    expect(console.log).toBeCalledWith("Completed task list item: One");
    expect(console.log).toBeCalledWith("Incomplete task list item: Two");
    expect(console.log).toBeCalledWith("Incomplete task list item: Three");

    expect(core.setFailed).toBeCalledWith(
      "The following items are not marked as completed: Two, Three"
    );
  });

  it("handles missing issue number", async () => {
    const runTools = mockEvent("workflow_run", {});

    core.setFailed = jest.fn();
    await action(runTools);

    expect(core.setFailed).toBeCalledWith("Could not determine issue number");
  });

  it("defaults to using the input issue number on pull_request event", async () => {
    restoreTest = mockEnv({
      INPUT_ISSUENUMBER: "11"
    });

    mockIssueBody("Nothing in the body", process.env.INPUT_ISSUENUMBER);
    mockIssueComments(
      ["Demo\r\n\r\n- [x] One\r\n- [ ] Two\n- [ ] Three"],
      process.env.INPUT_ISSUENUMBER
    );

    console.log = jest.fn();
    core.setFailed = jest.fn();
    await action(tools);

    expect(console.log).toBeCalledWith("Completed task list item: One");
    expect(console.log).toBeCalledWith("Incomplete task list item: Two");
    expect(console.log).toBeCalledWith("Incomplete task list item: Three");

    expect(core.setFailed).toBeCalledWith(
      "The following items are not marked as completed: Two, Three"
    );
  });

  it("ignores checklists in comments when skipComments is enabled", async () => {
    restoreTest = mockEnv({
      INPUT_REQUIRECHECKLIST: "true",
      INPUT_SKIPCOMMENTS: "true"
    });
    mockIssueBody("Nothing in the body");

    core.setFailed = jest.fn();
    await action(tools);

    expect(core.setFailed).toBeCalledWith(
      "No task list was present and requireChecklist is turned on"
    );
  });

  it("ignores items that match the skipDescriptionRegex + skipDescriptionRegexFlags args", async () => {
    restoreTest = mockEnv({
      INPUT_REQUIRECHECKLIST: "true",
      INPUT_SKIPDESCRIPTIONREGEX: ".*\(optional\).*",
      INPUT_SKIPDESCRIPTIONREGEXFLAGS: "i",
      INPUT_SKIPCOMMENTS: "true"
    });

    mockIssueBody("Demo\r\n\r\n- [x] One\r\n- [x] Two\n- [x] This is (Optional) skipped");
    mockIssueComments([], process.env.INPUT_ISSUENUMBER);

    console.log = jest.fn();

    await action(tools);

    expect(console.log).toBeCalledWith("Completed task list item: One");
    expect(console.log).toBeCalledWith("Completed task list item: Two");
    expect(console.log).toBeCalledWith("Skipping task list item: This is (Optional) skipped");

    expect(console.log).toBeCalledWith(
      "There are no incomplete task list items"
    );
  });
});

function mockIssueBody(body, issueNumber = 17) {
  nock("https://api.github.com")
    .get(`/repos/YOUR_USERNAME/action-test/issues/${issueNumber}`)
    .reply(200, {
      body,
    });
}

function mockIssueComments(comments, issueNumber = 17) {
  nock("https://api.github.com")
    .get(`/repos/YOUR_USERNAME/action-test/issues/${issueNumber}/comments`)
    .reply(
      200,
      comments.map((c) => {
        return { body: c };
      })
    );
}

function mockEvent(name, mockPayload) {
  github.context.payload = mockPayload;

  restore = mockEnv({
    GITHUB_EVENT_NAME: name,
    GITHUB_EVENT_PATH: "/github/workspace/event.json",
  });
}
