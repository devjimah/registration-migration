/*
 * Minimal stand-in for Stripe.js, served only when the server runs without Stripe keys
 * (local dev and Playwright). Implements just the surface src/payments.ts uses.
 *
 * Test card numbers mirror Stripe's:
 *   4242 4242 4242 4242  -> succeeds
 *   4000 0000 0000 0002  -> declined
 */
(function () {
  'use strict';

  var DECLINED = '4000000000000002';

  function FakeStripe(publishableKey) {
    var cardInput = null;

    function cardNumber() {
      return cardInput ? cardInput.value.replace(/\s+/g, '') : '';
    }

    return {
      elements: function (options) {
        var amount = options.amount;
        return {
          create: function () {
            return {
              mount: function (target) {
                var host = typeof target === 'string' ? document.querySelector(target) : target;
                host.innerHTML =
                  '<input class="stripe-field" aria-label="Card number" placeholder="Card number (mock)" inputmode="numeric">' +
                  '<small class="mock-note">Mock payments: use 4242 4242 4242 4242</small>';
                cardInput = host.querySelector('input');
              },
              on: function () { return this; },
              destroy: function () {}
            };
          },
          update: function (next) {
            if (next && typeof next.amount === 'number') amount = next.amount;
          },
          submit: function () {
            var n = cardNumber();
            if (!/^\d{16}$/.test(n)) {
              return Promise.resolve({ error: { type: 'validation_error', message: 'Your card number is incomplete.' } });
            }
            return Promise.resolve({});
          },
          _amount: function () { return amount; }
        };
      },

      confirmPayment: function (params) {
        var id = params.clientSecret.split('_secret_')[0];
        if (cardNumber() === DECLINED) {
          return Promise.resolve({ error: { type: 'card_error', code: 'card_declined', message: 'Your card was declined.' } });
        }
        return fetch('/api/__mock/payment-intents/' + encodeURIComponent(id) + '/succeed', { method: 'POST' }).then(function (res) {
          if (!res.ok) return { error: { type: 'api_error', message: 'Mock payment failed.' } };
          return { paymentIntent: { id: id, status: 'succeeded' } };
        });
      },

      _registerWrapper: function () {},
      _publishableKey: publishableKey
    };
  }

  FakeStripe.version = 'endive';
  window.Stripe = FakeStripe;
})();
