// Copyright 2013 Russell Cagle.
//
// Distributed under a BSD-style license found in the LICENSE file.

/**
 * @param {Object} argv The argument object passed in from the Terminal.
 */
typos.CommandInstance = function(argv) {
  // Command arguments.
  this.argv_ = argv;

  // Command environment.
  this.environment_ = argv.environment || {};

  // hterm.Terminal.IO instance.
  this.io = null;

  // Counters used to acknowledge writes from the plugin.
  this.stdoutAcknowledgeCount_ = 0;
  this.stderrAcknowledgeCount_ = 0;

  // Prevent us from reporting an exit twice.
  this.exited_ = false;
};

/**
 * The name of this command used in messages to the user.
 *
 * Perhaps this will also be used by the user to invoke this command if we
 * build a command line shell.
 */
typos.CommandInstance.prototype.commandName = 'typos';

/**
 * Static run method invoked by the terminal.
 */
typos.CommandInstance.run = function(argv) {
  return new typos.CommandInstance(argv);
};

/**
 * Start the typos command.
 *
 * Instance run method invoked by the typos.CommandInstance ctor.
 */
typos.CommandInstance.prototype.run = function() {
  this.io = this.argv_.io.push();

  // Similar to lib.fs.err, except this logs to the terminal too.
  var ferr = function(msg) {
    return function(err) {
      var ary = Array.apply(null, arguments);
      console.error(msg + ': ' + ary.join(', '));

      this.io.println(hterm.msg('UNEXPECTED_ERROR'));
      this.io.println(err);
    }.bind(this);
  }.bind(this);

  this.socket_ = new WebSocket("ws://localhost:8080/websocket");
  this.socket_.onopen = this.onSocketOpen_.bind(this);
  this.socket_.onmessage = this.onSocketData_.bind(this);
  this.socket_.onclose = this.socket_.onerror =
      this.onSocketError_.bind(this);

  this.io.setTerminalProfile('default');

  this.io.onVTKeystroke = this.sendString_.bind(this);
  this.io.sendString = this.sendString_.bind(this);
  this.io.onTerminalResize = this.onTerminalResize_.bind(this);

  var argv = {};
  argv.terminalWidth = this.io.terminal_.screenSize.width;
  argv.terminalHeight = this.io.terminal_.screenSize.height;
  argv.useJsSocket = true;
  argv.environment = this.environment_;

  document.querySelector('#terminal').focus();

};

/**
 * Reconnects to host, using the same CommandInstance.
 *
 * @param {string} argstr The connection ArgString
 */
typos.CommandInstance.prototype.reconnect = function(argstr) {
  // Terminal reset.
  this.io.print('\x1b[!p');

  this.io = this.argv_.io.push();

  this.plugin_.parentNode.removeChild(this.plugin_);
  this.plugin_ = null;

  this.stdoutAcknowledgeCount_ = 0;
  this.stderrAcknowledgeCount_ = 0;
};

typos.CommandInstance.prototype.onSocketOpen_ = function(e) {
  if (e.target !== this.socket_)
    return;
};

typos.CommandInstance.prototype.onSocketData_ = function(e) {
  if (e.target !== this.socket_)
    return;

  var msg = JSON.parse(e.data);
  var type = msg["type"];
  if (type == "host_data") {
    this.io.writeUTF8(msg["message"]);
  } else if (type == "security_token") {
    this.securityToken = msg["message"];
  } else {
    console.log("bad message:" + e.data);
  }

};

typos.CommandInstance.prototype.onSocketError_ = function(e) {
  if (e.target !== this.socket_)
    return;

  this.socket_ = null;
  conosole.log('Error reading from the socket. ' + e);
};

/**
 * Send a string to the remote host.
 *
 * @param {string} string The string to send.
 */
typos.CommandInstance.prototype.sendString_ = function(string) {
  this.socket_.send(JSON.stringify({"type": "terminal_data", "data": {"keys": string}}));
};

/**
 * Notify plugin about new terminal size.
 *
 * @param {string|integer} terminal width.
 * @param {string|integer} terminal height.
 */
typos.CommandInstance.prototype.onTerminalResize_ = function(width, height) {
  this.socket_.send(JSON.stringify({"type": "resized", "data": {"width": Number(width), "height": Number(height)}}));
};

/**
 * Exit the typos command.
 */
typos.CommandInstance.prototype.exit = function(code) {
  window.onbeforeunload = null;

  this.io.println(hterm.msg('DISCONNECT_MESSAGE', [code]));
  this.io.println(hterm.msg('RECONNECT_MESSAGE'));
  this.io.onVTKeystroke = function(string) {
    var ch = string.toLowerCase();
    if (ch == 'r' || ch == ' ' || ch == '\x0d' /* enter */)
      this.reconnect(document.location.hash.substr(1));

    if (ch == 'c' || ch == '\x12' /* ctrl-r */) {
      document.location.hash = '';
      document.location.reload();
      return;
    }

    if (ch == 'e' || ch == 'x' || ch == '\x1b' /* ESC */ ||
        ch == '\x17' /* C-w */) {
      if (this.exited_)
        return;

      this.exited_ = true;
      this.io.pop();
      if (this.argv_.onExit)
        this.argv_.onExit(code);
    }
  }.bind(this);
};
