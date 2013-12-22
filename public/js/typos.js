// Copyright 2013 Russell Cagle.
//
// Distributed under a BSD-style license found in the LICENSE file.

var typos = {};

// Modified from JavaScript: The Definitive Guide, section 14.2.1
typos.urlArgs = function(search) {
  var args = {};
  var query = search.substring(1); // minus the `?`
  var pairs = query.split("&");
  for (var i = 0; i < pairs.length; i++) {
    var pos = pairs[i].indexOf('=');
    var name = pairs[i].substring(0, pos);
    var value = pairs[i].substring(pos + 1);
    value = decodeURIComponent(value);
    args[name] = value;
  }
  return args;
};

typos.wsURL = function(search) {
  var args = typos.urlArgs(search);
  return "ws://localhost:" + args.port + "/?secret=" + args.secret;
}

typos.addMessageHandler = function(type, f) {
}

typos.removeMessageHandler = function(type) {
}

typos.sendMessage = function(msg) {
  typos.ws.sendMessage(JSON.stringify(msg));
}

typos.messageHandler = function(e) {
  var msg = JSON.parse(e.data);
  if (msg.type == "eval") {
    console.log("evaluating " + msg.js);
    eval(msg.js);
  } else {
    console.log("don't know how to handle this: " + msg);
  }
}

typos.onEval = function(msg) {
  eval(msg.js);
}

typos.onCallResponse = function(msg) {
  typos.calls[msg.id](msg);
  delete typos.calls[msg.id];
}

typos.go = function() {
  // Set up initial message handlers.
  typos.addMessageHandler("eval", typos.onEval);
  typos.addMessageHandler("call-response", typos.onCallResponse);

  var ws = new WebSocket(typos.wsURL(window.location.search));
  var logit = function(e) { console.log(e); };
  ws.onclose = ws.onerror = ws.onopen = logit;
  ws.onmessage = typos.messageHandler;
  return ws;
};

typos.exec = function(command, onCompletion) {
}

/*
 * Runs command remotely,
 */
typos.call = function(command, onCompletion) {
  var id = typos.calls.length;
  typos.calls[id] = onCompletion;
  typos.sendMessage({type: "call", command: command, id: id});
}

typos.createPrompt = function(readyfn) {
  typos.call("my-prompt", function(res) {
    var prompt = document.createElement("div");
    var x = JSON.parse(res);
    prompt.innerText = "<strong>" + x.date + "</strong>" + x.pwd + "%";
    readyfn(prompt);
  });
}

typos.promptAndRead = function() {
  var commandLine = typos.createCommandLine();
  commandLine.addEventListener("execute", function(e) {
    typos.sendMessage({type: "exec", command: e.detail.command});
  });

  typos.createPrompt(function(prompt) {
    document.body.appendChild(prompt);
    document.body.appendChild(commandLine);
  });

}

/**
 * Returns a textarea control that mimics a command line. Fires the
 * following events:
 *
 * execute:
 *   detail.command - the command string
 *
 * history:
 *   detail.direction - 1 (next) or -1 (previous)
 *
 * isearch:
 *   detail.direction - 1 (forward) or -1 (backward)
 *   detail.search - the search string
 *
 * autocomplete:
 *   detail.word - the word at the cursor
 *
 * signal:
 *   detail.signal - the signal to send to the host application, e.g. ctrl-c
 *
 * Has a command-line CSS class.
 */
typos.createCommandLine = function() {
  var ta = document.createElement("textarea");
  ta.class = "form-control command-line";
  ta.rows = 3;
  ta.addEventListener("keypress", function(e) {
    if (e.keyIdentifier == "Enter") {
      e.preventDefault();
      var execute = new CustomEvent("execute", {detail: {command: this.value}});
      this.dispatchEvent(execute);
    }
  });
  return ta;
};
