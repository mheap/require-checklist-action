const { Toolkit } = require("actions-toolkit");

process.env.GITHUB_WORKFLOW = "demo-workflow";
process.env.GITHUB_ACTION = "require-checklist-action";
process.env.GITHUB_ACTOR = "YOUR_USERNAME";
process.env.GITHUB_REPOSITORY = "YOUR_USERNAME/action-test";
process.env.GITHUB_WORKSPACE = "/tmp/github/workspace";
process.env.GITHUB_SHA = "fake-sha-a1c85481edd2ea7d19052874ea3743caa8f1bdf6";

describe("Require Checklist", () => {
  let action;

  // Mock Toolkit.run to define `action` so we can call it
  Toolkit.run = jest.fn((actionFn) => {
    action = actionFn;
  });
  // Load up our entrypoint file
  require(".");

  beforeEach(() => {
    jest.resetModules();
  });

  it("exits successfully", () => {
    const tools = mockEvent("issues", { action: "opened" });
    action(tools);
    expect(tools.exit.success).toHaveBeenCalled();
    expect(tools.exit.success).toHaveBeenCalledWith("We did it!");
  });
});

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
