import { CONST } from './config.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Configuration menu for mounts and vehicles. */
export class MountConfigMenu extends HandlebarsApplicationMixin(ApplicationV2) {
  static PARTS = {
    form: { template: 'modules/travel-pace/templates/mount-config.hbs', id: 'travelpace-mountconfig-body', classes: ['travel-pace-mount-config'] },
    footer: { template: 'templates/generic/form-footer.hbs', id: 'travelpace-mountconfig-footer', classes: ['travel-pace-footer'] }
  };

  static DEFAULT_OPTIONS = {
    id: 'travel-pace-mount-config',
    tag: 'form',
    classes: ['travel-pace-app'],
    position: { width: 480, height: 'auto' },
    window: { icon: 'fa-solid fa-horse', title: 'TravelPace.Settings.MountConfig.Title', resizable: true },
    form: { handler: MountConfigMenu.#onSubmit, closeOnSubmit: true }
  };

  /**
   * Return the already-rendered instance (if any) instead of creating a duplicate.
   * @param {object} [options] Application options
   */
  constructor(options = {}) {
    super(options);
    const existing = foundry.applications.instances.get(this.id);
    if (existing && existing !== this) {
      existing.bringToFront();
      return existing;
    }
  }

  /** @inheritdoc */
  async _prepareContext(_options) {
    const enabledMounts = game.settings.get(CONST.moduleId, CONST.settings.enabledMounts);
    this.actors = await MountConfigMenu.#getPotentialMounts();
    const settingSchema = new foundry.data.fields.SchemaField({
      mounts: new foundry.data.fields.SetField(new foundry.data.fields.StringField({ required: false }))
    });
    const selectedMounts = Object.keys(enabledMounts).filter((id) => enabledMounts[id]);
    const document = { schema: settingSchema, mounts: selectedMounts };
    return {
      document,
      fields: settingSchema.fields,
      mountsWidget: (field, groupConfig, inputConfig) => this.#createMountsWidget(field, groupConfig, inputConfig),
      buttons: [{ type: 'submit', icon: 'fas fa-save', label: 'TravelPace.Buttons.Save' }],
      actors: this.actors
    };
  }

  /**
   * Persist the mount-selection form submission.
   * @this {MountConfigMenu}
   * @param {SubmitEvent} _event Form submit event
   * @param {HTMLFormElement} _form Submitted form element
   * @param {foundry.applications.ux.FormDataExtended} formData Parsed form data
   * @returns {Promise<void>}
   */
  static async #onSubmit(_event, _form, formData) {
    const mountIds = formData.object.mounts || [];
    const ids = Array.isArray(mountIds) ? mountIds : [mountIds];
    const selectedMounts = Object.fromEntries(this.actors.map((actor) => [actor.id, ids.includes(actor.id)]));
    await game.settings.set(CONST.moduleId, CONST.settings.enabledMounts, selectedMounts);
    ui.notifications.info(_loc('TravelPace.Settings.MountConfig.Saved'));
  }

  /**
   * Collect candidate mounts and vehicles from world actors and Actor compendiums.
   * @returns {Promise<Array<object>>} Candidate actor descriptors ({id, name, type, img, isWorld, pack?})
   */
  static async #getPotentialMounts() {
    const actors = [];
    for (const actor of game.actors) if (actor.type === 'npc' || actor.type === 'vehicle') actors.push({ id: actor.id, name: actor.name, type: actor.type, img: actor.img, isWorld: true });
    for (const pack of game.packs) {
      if (pack.metadata.type !== 'Actor') continue;
      const index = await pack.getIndex({ fields: ['type', 'img'] });
      for (const entry of index) {
        if (entry.type !== 'vehicle') continue;
        actors.push({ id: entry.uuid, name: entry.name, type: entry.type, img: entry.img, isWorld: false, pack: pack.title });
      }
    }
    return actors;
  }

  /**
   * Render the mount selector widget for the form-field helper.
   * @param {object} _field Schema field (unused; required by the form-field signature)
   * @param {object} _groupConfig Group configuration (unused)
   * @param {object} _inputConfig Input configuration (unused)
   * @returns {HTMLDivElement} The widget container element
   */
  #createMountsWidget(_field, _groupConfig, _inputConfig) {
    const div = document.createElement('div');
    div.classList.add('mounts-widget');
    if (!this.actors?.length) {
      const p = document.createElement('p');
      p.textContent = _loc('TravelPace.Settings.MountConfig.NoActors');
      div.append(p);
      return div;
    }
    const enabledMounts = game.settings.get(CONST.moduleId, CONST.settings.enabledMounts) || {};
    const sections = [
      { titleKey: 'TravelPace.Settings.MountConfig.WorldNPCs', items: this.actors.filter((a) => a.isWorld && a.type === 'npc') },
      { titleKey: 'TravelPace.Settings.MountConfig.WorldVehicles', items: this.actors.filter((a) => a.isWorld && a.type === 'vehicle') },
      { titleKey: 'TravelPace.Settings.MountConfig.CompendiumVehicles', items: this.actors.filter((a) => !a.isWorld), suffix: (a) => ` (${a.pack})` }
    ];
    for (const section of sections) {
      if (!section.items.length) continue;
      div.append(MountConfigMenu.#buildSection(section, enabledMounts));
    }
    return div;
  }

  /**
   * Build a labeled section of mount checkboxes.
   * @param {object} section Section descriptor with titleKey (string), items (Array&lt;object&gt;), and optional suffix builder
   * @param {string} section.titleKey Localization key for the section heading
   * @param {Array<object>} section.items Actor descriptors to render
   * @param {function(object): string} [section.suffix] Optional builder that returns a name suffix per actor
   * @param {object<string, boolean>} enabledMounts Current enabled-mount toggles
   * @returns {HTMLDivElement} The section container element
   */
  static #buildSection({ titleKey, items, suffix }, enabledMounts) {
    const section = document.createElement('div');
    section.classList.add('mount-section');
    const heading = document.createElement('h4');
    heading.textContent = _loc(titleKey);
    section.append(heading);
    for (const actor of items) {
      const label = document.createElement('label');
      label.classList.add('checkbox');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'mounts';
      checkbox.value = actor.id;
      if (enabledMounts[actor.id]) checkbox.checked = true;
      const img = document.createElement('img');
      img.src = actor.img;
      img.alt = actor.name;
      img.width = 24;
      img.height = 24;
      label.append(checkbox, img, document.createTextNode(` ${actor.name}${suffix ? suffix(actor) : ''}`));
      section.append(label);
    }
    return section;
  }
}

/** Register all module settings and the mount-config menu. Call once during the init hook. */
export function registerSettings() {
  game.settings.register(CONST.moduleId, CONST.settings.useMetric, {
    name: 'TravelPace.Settings.UseMetric.Name',
    hint: 'TravelPace.Settings.UseMetric.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });
  game.settings.register(CONST.moduleId, CONST.settings.showEffects, {
    name: 'TravelPace.Settings.ShowEffects.Name',
    hint: 'TravelPace.Settings.ShowEffects.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(CONST.moduleId, CONST.settings.enabledMounts, {
    name: 'TravelPace.Settings.EnabledMounts.Name',
    hint: 'TravelPace.Settings.EnabledMounts.Hint',
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });
  game.settings.registerMenu(CONST.moduleId, 'mountConfigMenu', {
    name: 'TravelPace.Settings.MountConfig.Name',
    label: 'TravelPace.Settings.MountConfig.Label',
    hint: 'TravelPace.Settings.MountConfig.Hint',
    icon: 'fas fa-horse',
    type: MountConfigMenu,
    restricted: true
  });
}
