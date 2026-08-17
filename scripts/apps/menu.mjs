const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** @type {object} The core submit-button footer both configuration menus render. */
export const FOOTER_PART = { template: 'templates/generic/form-footer.hbs' };

/** Shared chrome for the module's configuration menus. */
export class TravelPaceMenu extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * Hand back the rendered instance instead of opening a second copy of the same menu.
   * @param {object} [options] Application options
   */
  constructor(options = {}) {
    super(options);
    const existing = foundry.applications.instances.get(this.id);
    if (existing && existing !== this) return existing;
  }

  static DEFAULT_OPTIONS = {
    tag: 'form',
    classes: ['travel-pace-app'],
    position: { width: 480, height: 'auto' },
    window: { contentClasses: ['standard-form'], resizable: true }
  };
}
