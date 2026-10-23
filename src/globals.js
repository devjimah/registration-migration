// The legacy IIFEs expect jQuery on window. ES imports are hoisted, so this
// lives in its own module and is imported first to run before them.
import $ from 'jquery';

window.$ = window.jQuery = $;
