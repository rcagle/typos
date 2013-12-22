// Copyright 2013 Russell Cagle

function keypress(keyIdentifier) {
  return new KeyboardEvent('keypress', {keyIdentifier: keyIdentifier});
}

describe("Connect to service", function() {
  it("creates WebSocket URI using parameters embedded in the search string", function() {
    expect(typos.wsURL("?port=1234&secret=shh")).
      toEqual("ws://localhost:1234/?secret=shh");
  });

});

describe("CommandLine", function() {
  var commandLine;

  beforeEach(function() {
    commandLine = typos.createCommandLine();
  });

  it("interprets enter as execute", function() {
    var actualCommand;
    var expectedCommand = "cat foo.txt";
    commandLine.innerText = expectedCommand;

    commandLine.addEventListener("execute", function(e) {
      actualCommand = e.detail.command;
    });
    commandLine.dispatchEvent(keypress("Enter"));

    expect(actualCommand).toEqual(expectedCommand);
  });
});

describe("REPL", function() {
  it("creates read controls");
});
