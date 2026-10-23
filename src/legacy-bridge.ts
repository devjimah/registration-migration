// Temporary bridge: exposes migrated TypeScript modules on window.RegApp so
// the remaining legacy IIFEs keep working. Delete once src/legacy is empty.
import * as validation from './validation';
import * as api from './api';

window.RegApp = window.RegApp ?? {};
window.RegApp.validation = validation;
window.RegApp.api = api;
