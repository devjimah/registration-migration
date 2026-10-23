/* Legacy module: thin $.ajax wrappers around the Express API. Returns jQuery promises. */
(function (window, $) {
  'use strict';

  var RegApp = window.RegApp = window.RegApp || {};

  function postJSON(url, data) {
    return $.ajax({
      url: url,
      method: 'POST',
      contentType: 'application/json',
      dataType: 'json',
      data: JSON.stringify(data)
    });
  }

  RegApp.api = {
    getPlans: function () {
      return $.getJSON('/api/plans');
    },
    checkEmail: function (email) {
      return postJSON('/api/check-email', { email: email });
    },
    register: function (payload) {
      return postJSON('/api/register', payload);
    }
  };
})(window, jQuery);
