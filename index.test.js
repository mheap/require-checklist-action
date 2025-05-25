const http = require("node:http");
const express = require("express");
const fakeApiApp = express()
const fakeApiServer = http.createServer(fakeApiApp);
const mockEnv = require("mocked-env");

process.env.GITHUB_API = "demo-workflow";
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
  let action, core, github;
  let issueNumber = 42;

  const makeTools = (num = issueNumber) => {
    return mockEvent("pull_request", {
      action: "opened",
      pull_request: { number: num },
    })
  };

  const mockIssueBody = (body, num = issueNumber) => {
    fakeApiApp.get(
      `/repos/YOUR_USERNAME/action-test/issues/${num}`,
      (_req, res) => res.json({ body })
    );
  }

  const mockIssueComments = (comments, num = issueNumber) => {
    fakeApiApp.get(
      `/repos/YOUR_USERNAME/action-test/issues/${num}/comments`,
      (_req, res) => res.json(comments.map((c) => {
        return { body: c };
      }))
    );
  }

  const mockEvent = (name, mockPayload) => {
    github.context.payload = mockPayload;

    restore = mockEnv({
      GITHUB_EVENT_NAME: name,
      GITHUB_EVENT_PATH: "/github/workspace/event.json",
    });
  }

  beforeAll(async () => {
    // Wait for server listening event (or fail on error)
    await new Promise((resolve, reject) => {
      fakeApiServer.on('error', (e) => reject(e));
      fakeApiServer.on('listening', () => resolve());
      fakeApiServer.listen(0, '127.0.0.1');
    })

    const fakeApiAddress = fakeApiServer.address();
    process.env.GITHUB_API_URL = `http://${fakeApiAddress.address}:${fakeApiAddress.port}`;

    // We need to require late - actions libraries initialize defaults way too early
    action = require(".");
    core = require("@actions/core");
    github = require("@actions/github");
  })

  afterAll(() => fakeApiServer.close())

  beforeEach(() => {
    jest.resetModules();

    tools = makeTools();

    restoreTest = () => { };
  });

  afterEach(() => {
    restore();
    restoreTest();
    issueNumber++;
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
    expect(console.log).toBeCalledWith("Completed task list item: Comment done");
    expect(console.log).toBeCalledWith("There are no incomplete task list items");
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
      INPUT_ISSUENUMBER: `${issueNumber}`
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
      INPUT_ISSUENUMBER: `${issueNumber}`
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
      INPUT_ISSUENUMBER: `${issueNumber}`
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

    console.log = jest.fn();

    await action(tools);

    expect(console.log).toBeCalledWith("Completed task list item: One");
    expect(console.log).toBeCalledWith("Completed task list item: Two");
    expect(console.log).toBeCalledWith("Skipping task list item: This is (Optional) skipped");

    expect(console.log).toBeCalledWith(
      "There are no incomplete task list items"
    );
  });

  describe("Pseudo radio-button checklists", () => {
    it("handles issues with acceptably completed checklist", async () => {
      mockIssueBody("Demo\r\n- [x] Identify the cat\r\n- [x] Pet the cat <!-- TaskRadio Alpha -->\r\n- [ ] Flee the cat <!-- TaskRadio Alpha -->\r\n- [ ] Report the incident <!-- TaskRadio 2 -->\r\n- [x] Hide in shame <!-- TaskRadio 2 -->");
      mockIssueComments(["- [x] Comment done <!-- TaskRadio Alpha -->\r\n - [ ] Uncomment done <!-- TaskRadio Alpha -->"]);

      console.log = jest.fn();
      core.setFailed = jest.fn();

      await action(tools);

      expect(core.setFailed).not.toHaveBeenCalled()

      expect(console.log).toBeCalledWith("Completed task list item: Identify the cat");
      expect(console.log).toBeCalledWith("Completed task list item: Pet the cat <!-- TaskRadio Alpha -->");
      expect(console.log).toBeCalledWith("Incomplete task list item: Flee the cat <!-- TaskRadio Alpha -->");
      expect(console.log).toBeCalledWith("Incomplete task list item: Report the incident <!-- TaskRadio 2 -->");
      expect(console.log).toBeCalledWith("Completed task list item: Hide in shame <!-- TaskRadio 2 -->");

      expect(console.log).toBeCalledWith("Completed task list item: Comment done <!-- TaskRadio Alpha -->");
      expect(console.log).toBeCalledWith("Incomplete task list item: Uncomment done <!-- TaskRadio Alpha -->");

      expect(console.log).toBeCalledWith(
        "There are no incomplete task list items"
      );
    });

    it("handles issues with unacceptable multi-select", async () => {
      mockIssueBody("Demo\r\n- [x] Identify the cat\r\n- [x] Pet the cat <!-- TaskRadio Alpha -->\r\n- [ ] Flee the cat <!-- TaskRadio Alpha -->\r\n- [ ] Report the incident <!-- TaskRadio 2 -->\r\n- [x] Hide in shame <!-- TaskRadio 2 --> <!-- TaskRadio Alpha -->");
      mockIssueComments(["- [x] Comment done <!-- TaskRadio Alpha -->\r\n - [ ] Uncomment done <!-- TaskRadio Alpha -->"]);

      console.log = jest.fn();
      core.setFailed = jest.fn();

      await action(tools);

      expect(console.log).toBeCalledWith("Completed task list item: Identify the cat");
      expect(console.log).toBeCalledWith("Completed task list item: Pet the cat <!-- TaskRadio Alpha -->");
      expect(console.log).toBeCalledWith("Incomplete task list item: Flee the cat <!-- TaskRadio Alpha -->");
      expect(console.log).toBeCalledWith("Incomplete task list item: Report the incident <!-- TaskRadio 2 -->");
      expect(console.log).toBeCalledWith("Completed task list item: Hide in shame <!-- TaskRadio 2 --> <!-- TaskRadio Alpha -->");

      expect(console.log).toBeCalledWith("Completed task list item: Comment done <!-- TaskRadio Alpha -->");
      expect(console.log).toBeCalledWith("Incomplete task list item: Uncomment done <!-- TaskRadio Alpha -->");

      expect(core.setFailed).toBeCalledWith(
        "The following items cannot be marked as completed simultaneously: Pet the cat <!-- TaskRadio Alpha -->, Hide in shame <!-- TaskRadio 2 --> <!-- TaskRadio Alpha -->"
      );
    });
  })
});
