# Typos

Typos is a terminal emulator that supports inline HTML and
Javascript. The terminal runs in the browser and connects to a web
service that spawns a pseudo-terminal.

The terminal emulator is a fork of 
[hterm](http://git.chromium.org/gitweb/?p=chromiumos/platform/assets.git;a=blob;f=chromeapps/hterm/doc/faq.txt), 
which is a Chromium OS project.

## Example

Here is a console with typeset ls output:

<div>
  <pre style='font-family: arial'>
  <span style='font-family: monospace'>bash (typos)-3.2$ ./examples/ls.rb</span>
  <table>
    <tr>
       <td>.</td>
       <td>..</td>
       <td>.git</td>
       <td>.gitignore</td>
    </tr>
    <tr>
       <td>bin</td>
       <td>classes</td>
       <td>examples</td>
       <td>typos-0.0.0-SNAPSHOT-standalone.jar</td>
    </tr>
    <tr>
       <td>typos-0.0.0-SNAPSHOT.jar</td>
       <td>lib</td>
       <td>project.clj</td>
       <td>public</td>
    </tr>
    <tr>
       <td>README.md</td>
       <td>src</td>
       <td>test</td>
       <td>tmp</td>
    </tr>
  </table>
  <span style='font-family: monospace'>bash (typos)-3.2$ </span>
  </pre>

</div>

More code is in the examples directory.

## Usage

**WARNING** This project is insecure alpha code. Do not run it
anywhere. It sends your keystrokes in plain text. It doesn't do
authentication.

Typos requires a Unix-like system to run, and has only been tested
on the Chrome browser.

First, build the native code and Java classes:

    make
    lein javac

Once those tasks have completed successfully, then this command will
start the local shell service:

    lein run -m typos.core

Then point your browser to http://localhost:8080, which will start a shell
session.

## How It Works

An ANSI escape sequence begins HTML markup, and since the escape
character is illegal in XML, another escape sequence ends HTML markup.

The HTML is rendered inline with the rest of the console output, but
given a style that removes it from the document flow so that it will
not interfere with console rendering. The fragment is parsed as HTML,
and the resulting element is added to the terminal at the current
cursor position. If data-vt-width and/or data-vt-height attributes are
present, then they are interpreted as the width and the height of the
element in terminal characters. The terminal cursor is positioned on
the line immediately after and below the HTML content. The content can
be manipulated or removed using Javascript. The content is given the
CSS class typos-fragment, which can be styled however the user wants.

Typos uses the operating system command escape sequence, code 8080:

    host to terminal: OSC 8080 ; session-token ; html-fragment BEL

For example:

    ^]8080;12345;<em>Hi</em>^G

This escape sequence was chosen to match other application-specific
escape sequences like the xterm titlebar hack. The number 8080 wasn't
taken, and is somewhat HTTP-related. It also has the advantage of
being hidden if it is accidentally sent to a non HTML-enabled
terminal. For example, it doesn't cause trouble in Terminal.app,
screen, or xterm.

The escape sequence does *not* work through screen or other terminal
multiplexers, however.

## Security

Plain text files could contain malicious HTML fragments. To prevent
HTML injection, all HTML content must include a random session token
that is passed to the host applications as an environment variable.

An app you run on a remote server could inject malicious Javascript that
monitored the rest of your terminal session, stole passwords, and sent
arbitrary commands to any server you had access to. Typos does
not guard against this problem today, but it could be solved by creating
sandboxed iframes when you connect to a remote server:

    typos.push_context(random_token)

    ... remote SSH session ...

    typos.pop_context(random_token)

## Design Rationale

I wanted typesetting, layout, and proportional fonts in my console
applications. For example, I wanted to use a table tag instead of tabs
to do layout. Also, deploying a script is much simpler than deploying
a web application.

Since typos is a graphical terminal, it has some functional
overlap with X11. But X lacks typesetting and flexible layouts, and
the browser also provides a secure local scripting environment.

## License

Copyright © 2013 Russell Cagle. Distributed under a BSD-style license in
the LICENSE file.

This project contains code from the Chromium OS project, copyright ©
2012 The Chromium OS Authors.
