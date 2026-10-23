/* Legacy module: wires the registration form to validation + API. Depends on RegApp.validation and RegApp.api. */
(function (window, $) {
  'use strict';

  var RegApp = window.RegApp;

  function formatPrice(cents) {
    return cents === 0 ? 'Free' : '$' + (cents / 100).toFixed(2) + '/mo';
  }

  function readValues($form) {
    var values = {};
    $.each($form.serializeArray(), function (_, field) {
      values[field.name] = field.value;
    });
    return values;
  }

  function showErrors($form, errors) {
    $form.find('.error').text('');
    $form.find('input, select').removeClass('invalid');
    $.each(errors, function (field, message) {
      $form.find('[data-error-for="' + field + '"]').text(message);
      $form.find('[name="' + field + '"]').addClass('invalid');
    });
  }

  function loadPlans() {
    var $plan = $('#plan');
    RegApp.api.getPlans().done(function (res) {
      $plan.empty().append($('<option>', { value: '', text: 'Select a plan' }));
      $.each(res.plans, function (_, plan) {
        $plan.append($('<option>', {
          value: plan.id,
          text: plan.name + ' — ' + formatPrice(plan.priceCents)
        }));
      });
    });
  }

  function bindEmailCheck() {
    $('#email').on('blur', function () {
      var email = $(this).val();
      if (!RegApp.validation.isEmail(email)) return;
      RegApp.api.checkEmail(email).done(function (res) {
        if (!res.available) {
          showErrors($('#registration-form'), { email: 'An account with this email already exists' });
        }
      });
    });
  }

  function bindSubmit() {
    var $form = $('#registration-form');
    var $submit = $('#submit');

    $form.on('submit', function (e) {
      e.preventDefault();
      var values = readValues($form);
      var errors = RegApp.validation.validate(values);
      showErrors($form, errors);
      if (!$.isEmptyObject(errors)) return;

      $submit.prop('disabled', true).text('Creating account…');

      RegApp.api.register({
        name: values.name,
        email: values.email,
        password: values.password,
        plan: values.plan
      })
        .done(function (res) {
          $form.prop('hidden', true);
          $('#success-message').text('Your account for ' + res.user.email + ' is ready.');
          $('#success').prop('hidden', false);
        })
        .fail(function (xhr) {
          var body = xhr.responseJSON || {};
          showErrors($form, body.errors || { form: 'Something went wrong. Please try again.' });
        })
        .always(function () {
          $submit.prop('disabled', false).text('Create account');
        });
    });
  }

  $(function () {
    loadPlans();
    bindEmailCheck();
    bindSubmit();
  });
})(window, jQuery);
