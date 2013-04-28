// Copyright 2013 Russell Cagle.
//
// Distributed under a BSD-style license found in the LICENSE file.

'use strict';

lib.rtdep('lib.f');

// CSP means that we can't kick off the initialization from the html file,
// so we do it like this instead.
window.onload = function() {
  function execTypos() {
    var terminal = new hterm.Terminal("default", document.querySelector('#terminal'));
    terminal.onTerminalReady = function() {
        terminal.setCursorPosition(0, 0);
        terminal.setCursorVisible(true);
        terminal.runCommandClass(typos.CommandInstance,
                                 document.location.hash.substr(1));
    };

    // Useful for console debugging.
    window.term_ = terminal;
  }

  lib.ensureRuntimeDependencies();
  hterm.init(execTypos);
};
