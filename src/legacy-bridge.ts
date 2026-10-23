// Temporary bridge: exposes migrated TypeScript modules on window.RegApp so
// the remaining legacy IIFEs keep working. Delete once src/legacy is empty.
import * as validation from './validation';

window.RegApp = window.RegApp ?? {};
window.RegApp.validation = validation;
