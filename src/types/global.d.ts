import type * as validation from '../validation';
import type * as api from '../api';

declare global {
  interface Window {
    $: JQueryStatic;
    jQuery: JQueryStatic;
    /** Legacy namespace shared with the not-yet-migrated IIFEs in src/legacy. */
    RegApp?: {
      validation?: typeof validation;
      api?: typeof api;
    };
  }
}

export {};
