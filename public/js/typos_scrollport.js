// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('hterm.PubSub', 'hterm.Size');

/**
 * @param {RowProvider} rowProvider An object capable of providing rows as
 *     raw text or row nodes.
 */
typos.ScrollPort = function(rowProvider) {
  hterm.PubSub.addBehavior(this);

  this.rowProvider_ = rowProvider;

  // SWAG the character size until we can measure it.
  this.characterSize = new hterm.Size(10, 10);

  // DOM node used for character measurement.
  this.ruler_ = null;

  // The css rule that we use to control the height of a row.
  this.xrowCssRule_ = null;

  this.div_ = null;
  this.document_ = null;

  // Collection of active timeout handles.
  this.timeouts_ = {};

  this.observers_ = {};

  this.DEBUG_ = false;
}

/**
 * Turn a div into this typos.ScrollPort.
 */
typos.ScrollPort.prototype.decorate = function(div) {
  this.div_ = div;

  this.iframe_ = div.ownerDocument.createElement('iframe');
  this.iframe_.style.cssText = (
      'border: 0;' +
      'height: 100%;' +
     'position: absolute;' +
      'width: 100%');

  div.appendChild(this.iframe_);

  this.iframe_.contentWindow.addEventListener('resize',
                                              this.onResize_.bind(this));

  var doc = this.document_ = this.iframe_.contentDocument;
  doc.body.style.cssText = (
      'margin: 0px;' +
      'padding: 0px;' +
      'height: 100%;' +
      'width: 100%;' +
      'overflow: hidden;');

  var style = doc.createElement('style');
  style.textContent = 'x-row {position: relative;}';
  doc.head.appendChild(style);

  this.xrowCssRule_ = doc.styleSheets[0].cssRules[0];
  this.xrowCssRule_.style.display = 'block';

  // TODO(rginda): Sorry, this 'screen_' isn't the same thing as hterm.Screen
  // from screen.js.  I need to pick a better name for one of them to avoid
  // the collision.
  this.screen_ = doc.createElement('x-screen');
  this.screen_.setAttribute('role', 'textbox');
  this.screen_.setAttribute('tabindex', '-1');
  this.screen_.style.cssText = (
      'display: block;' +
      'font-family: Monaco;' +
      'font-size: 16px;' +
      'height: 100%;' +
      'overflow-y: scroll; overflow-x: hidden;' +
      'white-space: pre;' +
      'width: 100%;' +
      'outline: none !important');

  doc.body.appendChild(this.screen_);

  this.screen_.addEventListener('scroll', this.onScroll_.bind(this));
  this.screen_.addEventListener('mousewheel', this.onScrollWheel_.bind(this));
  this.screen_.addEventListener('copy', this.onCopy_.bind(this));
  this.screen_.addEventListener('paste', this.onPaste_.bind(this));
  this.screen_.addEventListener('mousedown', this.onMouseDown_.bind(this));

  this.setSelectionEnabled(true);
  this.resize();
};

/**
 * Enable or disable mouse based text selection in the scrollport.
 */
typos.ScrollPort.prototype.setSelectionEnabled = function(state) {
  this.selectionEnabled_ = state;
};

/**
 * Select the font-family and font-smoothing for this scrollport.
 *
 * @param {string} fontFamily Value of the CSS 'font-family' to use for this
 *     scrollport.  Should be a monospace font.
 * @param {string} opt_smoothing Optional value for '-webkit-font-smoothing'.
 *     Defaults to an empty string if not specified.
 */
typos.ScrollPort.prototype.setFontFamily = function(fontFamily, opt_smoothing) {
  this.screen_.style.fontFamily = fontFamily;
  if (opt_smoothing) {
    this.screen_.style.webkitFontSmoothing = opt_smoothing;
  } else {
    this.screen_.style.webkitFontSmoothing = '';
  }

  this.syncCharacterSize();
};

typos.ScrollPort.prototype.getFontFamily = function() {
  return this.screen_.style.fontFamily;
};

typos.ScrollPort.prototype.focus = function() {
  this.iframe_.focus();
  this.screen_.focus();
};

typos.ScrollPort.prototype.getForegroundColor = function() {
  return this.screen_.style.color;
};

typos.ScrollPort.prototype.setForegroundColor = function(color) {
  this.screen_.style.color = color;
};

typos.ScrollPort.prototype.getBackgroundColor = function() {
  return this.screen_.style.backgroundColor;
};

typos.ScrollPort.prototype.setBackgroundColor = function(color) {
  this.screen_.style.backgroundColor = color;
};

typos.ScrollPort.prototype.setBackgroundImage = function(image) {
  this.screen_.style.backgroundImage = image;
};

typos.ScrollPort.prototype.setBackgroundSize = function(size) {
  this.screen_.style.backgroundSize = size;
};

typos.ScrollPort.prototype.setBackgroundPosition = function(position) {
  this.screen_.style.backgroundPosition = position;
};

typos.ScrollPort.prototype.getScreenWidth = function() {
  return this.screen_.clientWidth;
};

typos.ScrollPort.prototype.getScreenHeight = function() {
  return this.screen_.clientHeight;
};

/**
 * Return the document that holds the visible rows of this typos.ScrollPort.
 */
typos.ScrollPort.prototype.getDocument = function() {
  return this.document_;
};

/**
 * Change the current rowProvider.
 *
 * This will clear the row cache and cause a redraw.
 *
 * @param {Object} rowProvider An object capable of providing the rows
 *     in this typos.ScrollPort.
 */
typos.ScrollPort.prototype.setRowProvider = function(rowProvider) {
  this.rowProvider_ = rowProvider;
  this.scheduleRedraw();
};

/**
 * Inform the ScrollPort that the root DOM nodes for some or all of the visible
 * rows are no longer valid.
 *
 * Specifically, this should be called if this.rowProvider_.getRowNode() now
 * returns an entirely different node than it did before.  It does not
 * need to be called if the content of a row node is the only thing that
 * changed.
 *
 * This skips some of the overhead of a full redraw, but should not be used
 * in cases where the scrollport has been scrolled, or when the row count has
 * changed.
 */
typos.ScrollPort.prototype.invalidate = function() {
  for (var i = 0; i < this.visibleRowCount; i++) {
    var e = this.screen_.removeChild(this.screen_.lastChild);
  }
  this.redraw_();
};

typos.ScrollPort.prototype.scheduleInvalidate = function() {
};

/**
 * Set the font size of the ScrollPort.
 */
typos.ScrollPort.prototype.setFontSize = function(px) {
  this.screen_.style.fontSize = px + 'px';
  this.syncCharacterSize();
};

/**
 * Return the current font size of the ScrollPort.
 */
typos.ScrollPort.prototype.getFontSize = function() {
  return parseInt(this.screen_.style.fontSize);
};

/**
 * Measure the size of a single character in pixels.
 *
 * @param {string} opt_weight The font weight to measure, or 'normal' if
 *     omitted.
 * @return {hterm.Size} A new hterm.Size object.
 */
typos.ScrollPort.prototype.measureCharacterSize = function(opt_weight) {
  if (!this.ruler_) {
    this.ruler_ = this.document_.createElement('div');
    this.ruler_.style.cssText = (
        'position: absolute;' +
        'top: 0;' +
        'left: 0;' +
        'visibility: hidden;' +
        'height: auto !important;' +
        'width: auto !important;');

    this.ruler_.textContent = 'X';
  }

  this.ruler_.style.fontWeight = opt_weight || '';

  this.screen_.appendChild(this.ruler_);

  // In some fonts, underscores actually show up below the reported height.
  // We add one to the height here to compensate, and have to add a bottom
  // border to text with a background color over in text_attributes.js.
  var size = new hterm.Size(this.ruler_.clientWidth,
                            this.ruler_.clientHeight + 1);

  this.ruler_.style.webkitTextSizeAdjust = 'none';
  size.zoomFactor = size.width / this.ruler_.clientWidth;
  this.ruler_.style.webkitTextSizeAdjust = '';

  this.screen_.removeChild(this.ruler_);
  return size;
};

/**
 * Synchronize the character size.
 *
 * This will re-measure the current character size and adjust the height
 * of an x-row to match.
 */
typos.ScrollPort.prototype.syncCharacterSize = function() {
  this.characterSize = this.measureCharacterSize();

  var lineHeight = this.characterSize.height + 'px';
  this.xrowCssRule_.style.height = lineHeight;

  this.resize();

  if (this.DEBUG_) {
    // When we're debugging we add padding to the body so that the offscreen
    // elements are visible.
    this.document_.body.style.paddingTop =
        this.document_.body.style.paddingBottom =
        3 * this.characterSize.height + 'px';
  }
};

/**
 * Reset dimensions and visible row count to account for a change in the
 * dimensions of the 'x-screen'.
 */
typos.ScrollPort.prototype.resize = function() {
  this.syncScrollHeight();
  this.syncRowNodesDimensions_();

  var self = this;
  this.publish(
      'resize', { scrollPort: this },
      function() {
        self.scrollRowToBottom(self.rowProvider_.getRowCount());
        self.scheduleRedraw();
      });
};

/**
 * Set the position and size of the row nodes element.
 */
typos.ScrollPort.prototype.syncRowNodesDimensions_ = function() {
  var screenWidth = this.screen_.clientWidth;
  var screenHeight = this.screen_.clientHeight;

  this.lastScreenWidth_ = screenWidth;
  this.lastScreenHeight_ = screenHeight;

  // We don't want to show a partial row because it would be distracting
  // in a terminal, so we floor any fractional row count.
  this.visibleRowCount = Math.floor(screenHeight / this.characterSize.height);

  // Then compute the height of our integral number of rows.
  var visibleRowsHeight = this.visibleRowCount * this.characterSize.height;

  // Then the difference between the screen height and total row height needs to
  // be made up for as top margin.  We need to record this value so it
  // can be used later to determine the topRowIndex.
  this.visibleRowTopMargin = 0;
  this.visibleRowBottomMargin = screenHeight - visibleRowsHeight;

};

typos.ScrollPort.prototype.syncScrollHeight = function() {
  // Resize the scroll area to appear as though it contains every row.
  this.lastRowCount_ = this.rowProvider_.getRowCount();
  // this.scrollArea_.style.height = (this.characterSize.height *
  //                                  this.lastRowCount_ +
  //                                  this.visibleRowTopMargin +
  //                                  this.visibleRowBottomMargin +
  //                                  'px');
};

/**
 * Schedule a redraw to happen asynchronously.
 *
 * If this method is called multiple times before the redraw has a chance to
 * run only one redraw occurs.
 */
typos.ScrollPort.prototype.scheduleRedraw = function() {
  if (this.timeouts_.redraw)
    return;

  var self = this;
  this.timeouts_.redraw = setTimeout(function () {
      delete self.timeouts_.redraw;
      self.redraw_();
    }, 0);
  // this.redraw_();
};

typos.ScrollPort.prototype.redraw_ = function() {
  var prevNode = null;
  for (var i = this.rowProvider_.getRowCount() - 1; i >= 0; i--) {
    var node = this.rowProvider_.getRowNode(i);
    if (node.parentElement)
      break;

    if (prevNode)
      this.screen_.insertBefore(node, prevNode);
    else
      this.screen_.appendChild(node);
    prevNode = node;
  }
};

/**
 * Ensure that the rows between the top and bottom folds are as they should be.
 *
 * This method assumes that drawTopFold_() and drawBottomFold_() have already
 * run, and that they have left any visible selection row (selection start
 * or selection end) between the folds.
 *
 * It recycles DOM nodes from the previous redraw where possible, but will ask
 * the rowSource to make new nodes if necessary.
 *
 * It is critical that this method does not move the selection nodes.  Doing
 * so would clear the current selection.  Instead, the rest of the DOM is
 * adjusted around them.
 */
typos.ScrollPort.prototype.drawVisibleRows_ = function(
    topRowIndex, bottomRowIndex) {

};

/**
 * Fetch the row node for the given index.
 *
 * This will return a node from the cache if possible, or will request one
 * from the RowProvider if not.
 *
 * If a redraw_ is in progress the row will be added to the current cache.
 */
typos.ScrollPort.prototype.fetchRowNode_ = function(rowIndex) {
  var node;

  if (this.previousRowNodeCache_ && rowIndex in this.previousRowNodeCache_) {
    node = this.previousRowNodeCache_[rowIndex];
  } else {
    node = this.rowProvider_.getRowNode(rowIndex);
  }

  if (this.currentRowNodeCache_)
    this.cacheRowNode_(node);

  return node;
};

/**
 * Scroll the given rowIndex to the top of the typos.ScrollPort.
 *
 * @param {integer} rowIndex Index of the target row.
 */
typos.ScrollPort.prototype.scrollRowToTop = function(rowIndex) {
  this.syncScrollHeight();

  this.isScrolledEnd = (
    rowIndex + this.visibleRowCount >= this.lastRowCount_);

  var scrollTop = rowIndex * this.characterSize.height +
      this.visibleRowTopMargin;

  var scrollMax = this.getScrollMax_();
  if (scrollTop > scrollMax)
    scrollTop = scrollMax;

  if (this.screen_.scrollTop == scrollTop)
    return;

  this.screen_.scrollTop = scrollTop;
  // this.scheduleRedraw();
};

/**
 * Scroll the given rowIndex to the bottom of the typos.ScrollPort.
 *
 * @param {integer} rowIndex Index of the target row.
 */
typos.ScrollPort.prototype.scrollRowToBottom = function(rowIndex) {
  this.syncScrollHeight();

  this.isScrolledEnd = (
    rowIndex + this.visibleRowCount >= this.lastRowCount_);

  var scrollTop = rowIndex * this.characterSize.height +
      this.visibleRowTopMargin + this.visibleRowBottomMargin;
  scrollTop -= this.visibleRowCount * this.characterSize.height;

  if (scrollTop < 0)
    scrollTop = 0;

  if (this.screen_.scrollTop == scrollTop)
    return;

  this.screen_.scrollTop = scrollTop;
  this.scheduleRedraw();
};

/**
 * Return the row index of the first visible row.
 *
 * This is based on the scroll position.  If a redraw_ is in progress this
 * returns the row that *should* be at the top.
 */
typos.ScrollPort.prototype.getTopRowIndex = function() {
  return Math.floor(this.screen_.scrollTop / this.characterSize.height);
};

/**
 * Return the row index of the last visible row.
 *
 * This is based on the scroll position.  If a redraw_ is in progress this
 * returns the row that *should* be at the bottom.
 */
typos.ScrollPort.prototype.getBottomRowIndex = function(topRowIndex) {
  return topRowIndex + this.visibleRowCount - 1;
};

/**
 * Handler for scroll events.
 *
 * The onScroll event fires when scrollArea's scrollTop property changes.  This
 * may be due to the user manually move the scrollbar, or a programmatic change.
 */
typos.ScrollPort.prototype.onScroll_ = function(e) {
  var rect = this.screen_.getBoundingClientRect();
  if (this.screen_.clientWidth != this.lastScreenWidth_ ||
      this.screen_.clientHeight != this.lastScreenHeight_) {
    // This event may also fire during a resize (but before the resize event!).
    // This happens when the browser moves the scrollbar as part of the resize.
    // In these cases, we want to ignore the scroll event and let onResize
    // handle things.  If we don't, then we end up scrolling to the wrong
    // position after a resize.
    this.resize();
    return;
  }

  this.redraw_();
  this.publish('scroll', { scrollPort: this });
};

/**
 * Clients can override this if they want to hear scrollwheel events.
 *
 * Clients may call event.preventDefault() if they want to keep the scrollport
 * from also handling the events.
 */
typos.ScrollPort.prototype.onScrollWheel = function(e) {};

/**
 * Handler for scroll-wheel events.
 *
 * The onScrollWheel event fires when the user moves their scrollwheel over this
 * typos.ScrollPort.  Because the frontmost element in the typos.ScrollPort is
 * a fixed position DIV, the scroll wheel does nothing by default.  Instead, we
 * have to handle it manually.
 */
typos.ScrollPort.prototype.onScrollWheel_ = function(e) {
  this.onScrollWheel(e);

  if (e.defaultPrevented)
    return;
};

/**
 * Handler for resize events.
 *
 * The browser will resize us such that the top row stays at the top, but we
 * prefer to the bottom row to stay at the bottom.
 */
typos.ScrollPort.prototype.onResize_ = function(e) {
  // Re-measure, since onResize also happens for browser zoom changes.
  this.syncCharacterSize();
  this.resize();
};

/**
 * Clients can override this if they want to hear copy events.
 *
 * Clients may call event.preventDefault() if they want to keep the scrollport
 * from also handling the events.
 */
typos.ScrollPort.prototype.onCopy = function(e) { };

/**
 * Handler for copy-to-clipboard events.
 *
 * If some or all of the selected rows are off screen we may need to fill in
 * the rows between selection start and selection end.  This handler determines
 * if we're missing some of the selected text, and if so populates one or both
 * of the "select bags" with the missing text.
 */
typos.ScrollPort.prototype.onCopy_ = function(e) {
  this.onCopy(e);

  if (e.defaultPrevented)
    return;
};

/**
 * Handle a paste event on the the ScrollPort's screen element.
 */
typos.ScrollPort.prototype.onPaste_ = function(e) {
  this.pasteTarget_.focus();

  var self = this;
  setTimeout(function() {
      self.publish('paste', { text: self.pasteTarget_.value });
      self.pasteTarget_.value = '';
      self.screen_.focus();
    }, 0);
};

/**
 * Handle mouse down events on the ScrollPort's screen element.
 */
typos.ScrollPort.prototype.onMouseDown_ = function(e) {
  if (e.which == 1 && !this.selectionEnabled_) {
    e.preventDefault();
  }
};

/**
 * Set the vertical scrollbar mode of the ScrollPort.
 */
typos.ScrollPort.prototype.setScrollbarVisible = function(state) {
  this.screen_.style.overflowY = state ? 'scroll' : 'hidden';
};
