/* Legacy module: client-side validation rules, attached to the global RegApp namespace. */
(function (window) {
  'use strict';

  var RegApp = window.RegApp = window.RegApp || {};

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validate(values) {
    var errors = {};

    if (!values.name || $.trim(values.name).length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }
    if (!EMAIL_RE.test(values.email || '')) {
      errors.email = 'Enter a valid email address';
    }
    if (!values.password || values.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    if (values.confirm !== values.password) {
      errors.confirm = 'Passwords do not match';
    }
    if (!values.plan) {
      errors.plan = 'Choose a plan';
    }

    return errors;
  }

  RegApp.validation = {
    validate: validate,
    isEmail: function (value) { return EMAIL_RE.test(value || ''); }
  };
})(window);
