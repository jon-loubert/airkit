/**
 * @fileoverview Creates a YouTube player in a modal.
 */

var classes = require('../utils/classes');
var dom = require('../utils/dom');
var events = require('../utils/events');
var objects = require('../utils/objects');
var useragent = require('../utils/useragent');


var player = null;
var singleton = null;
var defaultConfig = {
  useHandlerOnMobile: true,
  history: false,
  historyNamePrefix: 'video:',
  transitionDuration: 300,
  className: 'ak-youtubemodal',
  parentSelector: 'body',
  onModalOpen: null,
  onModalClose: null,
  playerVars: {
    'autohide': 1,
    'autoplay': 1,
    'fs': 1,
    'modestbranding': 1,
    'rel': 0,
    'showinfo': 0,
    'iv_load_policy': 3
  }
};


/**
 * Plays a YouTube video in a modal dialog.
 * @constructor
 */
function YouTubeModal(config) {
  this.config = config;
  this.parentElement = document.querySelector(this.config.parentSelector);
  this.initDom_();
  this.lastActiveVideoId_ = null;
  this.scrollY = 0;

  var func = function(targetEl) {
    var data = 'data-' + this.config.className + '-video-id';
    var videoId = targetEl.getAttribute(data);
    var startDataAttribute = 'data-' + this.config.className + '-video-start-seconds';
    var startTime = +targetEl.getAttribute(startDataAttribute);
    if (videoId) {
      this.play(videoId, false, startTime);
    }
  }.bind(this);

  // Loads YouTube iframe API.
  events.addDelegatedListener(document, 'click', func);
  var tag = document.createElement('script');
  tag.setAttribute('src', 'https://www.youtube.com/iframe_api');
  this.parentElement.appendChild(tag);
}


/**
 * Creates the DOM for the YouTube modal.
 * @private
 */
YouTubeModal.prototype.initDom_ = function() {
  var createDom = dom.createDom;
  var el = createDom('div', this.config.className);
  var closeEl = createDom('div', this.config.className + '-x');
  closeEl.setAttribute('role', 'button');
  closeEl.setAttribute('aria-label', 'Close video player');
  el.appendChild(closeEl);
  el.appendChild(createDom('div', this.config.className + '-player'));
  el.appendChild(createDom('div', this.config.className + '-mask'));
  this.parentElement.appendChild(el);
  closeEl.addEventListener('click', function() {
    this.setActive_(false);
  }.bind(this));

  if (this.config.history) {
    window.addEventListener('popstate', this.onHistoryChange_.bind(this));
  }
};


/**
 * Sets the modal's visibility.
 * @param {boolean} enabled Whether the modal should be visible.
 */
YouTubeModal.prototype.setVisible = function(enabled) {
  // Plays or pauses depending on visibility.
  if (player) {
    // Delay call to give player time to load.
    window.setTimeout(function() {
      if (enabled) {
        player.playVideo();
      } else {
        player.pauseVideo();
      }
    }, 100);
  }

  var _keyToggle = function(e) {
    if (e.keyCode == 27) {
      this.setActive_(false);
      document.body.removeEventListener('keydown', _keyToggle);
    }
  }.bind(this);

  if (enabled) {
    document.body.addEventListener('keydown', _keyToggle);
  } else {
    document.body.removeEventListener('keydown', _keyToggle);
  }

  var lightboxEl = document.querySelector('.' + this.config.className);
  window.setTimeout(function() {
    classes.enable(lightboxEl, this.config.className + '--enabled', enabled);
  }.bind(this), enabled ? 0 : this.config.transitionDuration);
  window.setTimeout(function() {
    classes.enable(lightboxEl, this.config.className + '--visible', enabled);
  }.bind(this), enabled ? this.config.transitionDuration : 0);
};


/**
 * Sets whether the modal is active (and thus visible and playing). Handles history state if applicable.
 * @param {boolean} active Whether the modal is active.
 * @param {string=} opt_videoId Video ID to use in the history hash.
 * @param {boolean=} opt_updateState Whether to update the history state.
 * @private
 */
YouTubeModal.prototype.setActive_ = function(active, opt_videoId, opt_updateState) {
  if (opt_videoId) {
    this.lastActiveVideoId_ = opt_videoId;
  }

  if (active) {
    this.config.onModalOpen && this.config.onModalOpen(this.lastActiveVideoId_);
    this.scrollY = window.pageYOffset;
  } else {
    this.config.onModalClose && this.config.onModalClose(this.lastActiveVideoId_);
    window.scrollTo(0, this.scrollY);
  }
  if (!this.config.history) {
    this.setVisible(active);
    return;
  }

  this.setVisible(active);
  if (opt_updateState === false) {
    return;
  }
  var videoId = opt_videoId || this.activeVideoId_;
  if (active) {
    // Avoid pushing two equal items onto the state.
    var stateId = window.history.state && window.history.state['videoId'];
    if (stateId == videoId) {
      return;
    }
    window.history.pushState(
        {'videoId': videoId}, '',
        '#' + this.config.historyNamePrefix + videoId);
  } else {
    window.history.pushState(
        {'videoId': null}, '', window.location.pathname);
  }
};


/**
 * Callback for changes to the history state.
 * @param {Event} e Pop state event.
 * @private
 */
YouTubeModal.prototype.onHistoryChange_ = function(e) {
  if (e.state && e.state['videoId']) {
    this.play(e.state['videoId'], false);
  } else {
    this.setVisible(false);
  }
};


/**
 * Plays a YouTube video.
 * @param {string} videoId Video ID to play.
 * @param {boolean=} opt_updateState Whether to update the history state.
 * @param {number=} opt_startTime A specific time in the video to start at.
 */
YouTubeModal.prototype.play = function(videoId, opt_updateState, opt_startTime) {
  var useHandler = (
      this.config.useHandlerOnMobile
      && (useragent.isIOS() || useragent.isAndroid()));

  if (useHandler) {
    var url = 'https://m.youtube.com/watch?v=' + videoId;
    if (opt_startTime) {
      url += '&t=' + opt_startTime + 's';
    }
    window.location.href = url;
    return;
  }

  this.setActive_(true, videoId, opt_updateState);
  if (player && videoId == this.activeVideoId_) {
    return;
  } else if (player && videoId != this.activeVideoId_) {
    player.loadVideoById(videoId, 0, 'large');
    this.activeVideoId_ = videoId;
    return;
  }
  var playerEl = document.querySelector('.' + this.config.className + '-player');
  let playerVars = objects.clone(this.config.playerVars);
  if (opt_startTime) {
    playerVars['start'] = opt_startTime;
  }

  var options = {
    'videoId': videoId,
    'playerVars': playerVars
  };
  player = new YT.Player(playerEl, options);
  this.activeVideoId_ = videoId;
}


/**
 * Initializes a YouTube modal dialog singleton.
 * @param {Object=} opt_config Config options.
 */
function init(opt_config) {
  if (singleton) {
    return;
  }
  var config = objects.clone(defaultConfig);
  if (opt_config) {
    objects.merge(config, opt_config);
  }

  singleton = new YouTubeModal(config);
}


/**
 * Plays a YouTube video in a modal, without requiring a click on an element.
 * @param {string} videoId YouTube video ID.
 */
function play(videoId) {
  if (!singleton) {
    throw 'youtubemodal.init must be run first.';
  }
  return singleton.play(videoId);
}


module.exports = {
  init: init,
  play: play
};
