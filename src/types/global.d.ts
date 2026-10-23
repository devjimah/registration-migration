import type * as validation from '../validation';

declare global {
  interface Window {
    $: JQueryStatic;
    jQuery: JQueryStatic;
    /** Legacy namespace shared with the not-yet-migrated IIFEs in src/legacy. */
    RegApp?: {
      validation?: typeof validation;
      api?: unknown;
    };
  }
}

export {};
