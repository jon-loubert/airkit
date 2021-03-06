/**
 * @fileoverview Utility functions related to URIs.
 */

var objects = require('./objects');


/**
 * Returns the value of a key in a query string.
 */
function getParameterValue(key, opt_uri) {
  var uri = opt_uri || window.location.href;
  key = key.replace(/[\[]/, '\\\[').replace(/[\]]/, '\\\]');
  var regex = new RegExp('[\\?&]' + key + '=([^&#]*)');
  var results = regex.exec(uri);
  var result = results === null ? null : results[1];
  return result ? urlDecode_(result) : null;
}


/**
 * Returns a map of keys to values from a query string. Compatible with empty
 * values.
 */
function getParameters(opt_queryString) {
  return parseQueryMap(opt_queryString || window.location.search);
}


/**
 * Returns whether a parameter key is present in a query string.
 */
function hasParameter(key, opt_queryString) {
  return key in getParameters(opt_queryString);
}


var UpdateParamsFromUrlDefaultConfig = {
  serializeAttr: 'data-ak-update-params-serialize-into-key',
  selector: 'a.ak-update-params[href]',
  attr: 'href',
  params: null,
};


/**
 * Updates the URL attribute of elements with query params from the current URL.
 * @param {Object} config Config object. Properties are:
 *     selector: CSS query selector of elements to act upon.
 *     attr: The element attribute to update.
 *     params: A list of URL params (string or RegExp) to set on the element
 *         attr from the current URL. If params is empty, all params are propagated.
 */
function updateParamsFromUrl(config) {
  // If there is no query string in the URL, then there's nothing to do in this
  // function, so break early.
  if (!location.search) {
    return;
  }

  var c = objects.clone(UpdateParamsFromUrlDefaultConfig);
  objects.merge(c, config);
  var selector = c.selector;
  var attr = c.attr;
  var params = c.params;
  var vals = {};

  parseQueryString(location.search, function(key, value) {
    if (!params) {
      vals[key] = value;
      return;
    }
    for (var i = 0; i < params.length; i++) {
      var param = params[i];
      if (param instanceof RegExp) {
        if (key.match(param)) {
          vals[key] = value;
        }
      } else {
        if (param === key) {
          vals[key] = value;
        }
      }
    }
  });

  var els = document.querySelectorAll(selector);
  for (var i = 0, el; el = els[i]; i++) {
    var href = el.getAttribute(attr);
    if (href && !href.startsWith('#')) {
      var url = new URL(el.getAttribute(attr), location.href);
      var map = parseQueryMap(url.search);
      // Optionally serialize the keys and values into a single key and value,
      // and rewrite the element's attribute with the new serialized query
      // string. This was built specifically to do things like pass `utm_*`
      // parameters into a `referrer` query string, for Google Play links, e.g.
      // `&referrer=utm_source%3DSOURCE`.
      // See https://developers.google.com/analytics/devguides/collection/android/v4/campaigns#google-play-url-builder
      var serializeIntoKey = el.getAttribute(c.serializeAttr);
      if (serializeIntoKey) {
        var serializedQueryString = encodeQueryMap(vals);
        map[serializeIntoKey] = serializedQueryString;
        url.search = encodeQueryMap(map);
      } else {
        for (var key in vals) {
          map[key] = vals[key];
        }
        url.search = encodeQueryMap(map);
      }
      el.setAttribute(attr, url.toString());
    }
  }
}


/**
 * Parses a query string and calls a callback function for every key-value
 * pair found in the string.
 * @param {string} query Query string (without the leading question mark).
 * @param {function(string, string)} callback Function called for every
 *     key-value pair found in the query string.
 */
function parseQueryString(query, callback) {
  // Break early for empty string.
  if (!query) {
    return;
  }
  // Remove leading `?` so that callers can pass `location.search` directly to
  // this function.
  if (query.startsWith('?')) {
    query = query.slice(1);
  }

  var pairs = query.split('&');
  for (var i = 0; i < pairs.length; i++) {
    var separatorIndex = pairs[i].indexOf('=');
    if (separatorIndex >= 0) {
      var key = pairs[i].substring(0, separatorIndex);
      var value = pairs[i].substring(separatorIndex + 1);
      callback(key, urlDecode_(value));
    } else {
      // Treat "?foo" without the "=" as having an empty value.
      var key = pairs[i];
      callback(key, '');
    }
  }
}


/**
 * Parses a query string and returns a map of key-value pairs.
 * @param {string} query Query string (without the leading question mark).
 * @return {Object} Map of key-value pairs.
 */
function parseQueryMap(query) {
  var map = {};
  parseQueryString(query, function(key, value) {
    map[key] = value;
  });
  return map;
}


/**
 * Returns a URL-encoded query string from a map of key-value pairs.
 * @param {Object} map Map of key-value pairs.
 * @return {string} URL-encoded query string.
 */
function encodeQueryMap(map) {
  var params = [];
  for (var key in map) {
    var value = map[key];
    params.push(key + '=' + urlEncode_(value));
  }
  return params.join('&');
}


function urlDecode_(str) {
  return decodeURIComponent(str.replace(/\+/g, ' '));
}


function urlEncode_(str) {
  return encodeURIComponent(String(str));
}


module.exports = {
  encodeQueryMap: encodeQueryMap,
  getParameterValue: getParameterValue,
  hasParameter: hasParameter,
  getParameters: getParameters,
  parseQueryMap: parseQueryMap,
  parseQueryString: parseQueryString,
  updateParamsFromUrl: updateParamsFromUrl
};
