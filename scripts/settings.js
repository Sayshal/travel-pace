import { CONST } from './config.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// Register module settings
Hooks.once('init', () => {
  // Use metric system setting
  game.settings.register(CONST.moduleId, CONST.settings.useMetric, {
    name: 'TravelPace.Settings.UseMetric.Name',
    hint: 'TravelPace.Settings.UseMetric.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true
  });

  // Show pace effects in chat setting
  game.settings.register(CONST.moduleId, CONST.settings.showEffects, {
    name: 'TravelPace.Settings.ShowEffects.Name',
    hint: 'TravelPace.Settings.ShowEffects.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true
  });

  // Enabled mounts and vehicles setting (not visible in settings menu)
  game.settings.register(CONST.moduleId, CONST.settings.enabledMounts, {
    name: 'TravelPace.Settings.EnabledMounts.Name',
    hint: 'TravelPace.Settings.EnabledMounts.Hint',
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });

  // Register the mount configuration menu
  game.settings.registerMenu(CONST.moduleId, 'mountConfig', {
    name: 'TravelPace.Settings.MountConfig.Name',
    label: 'TravelPace.Settings.MountConfig.Label',
    hint: 'TravelPace.Settings.MountConfig.Hint',
    icon: 'fas fa-horse',
    type: MountConfigMenu,
    restricted: true
  });
});

/**
 * Mount configuration menu application
 */
class MountConfigMenu extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'travel-pace-mount-config',
    classes: ['travel-pace-app'],
    tag: 'form',
    form: {
      handler: MountConfigMenu.formHandler,
      closeOnSubmit: true,
      submitOnChange: false
    },
    position: {
      height: 'auto',
      width: 480
    },
    window: {
      title: 'TravelPace.Settings.MountConfig.Title',
      icon: 'fas fa-horse',
      resizable: false
    }
  };

  static PARTS = {
    form: {
      template: 'modules/travel-pace/templates/mount-config.hbs',
      id: 'body',
      classes: ['travel-pace-mount-config']
    },
    footer: {
      template: 'templates/generic/form-footer.hbs',
      id: 'footer',
      classes: ['travel-pace-footer']
    }
  };

  /**
   * Prepare context data for rendering the mount configuration template
   * @param {object} _options - Application render options
   * @returns {Promise<object>} Context data for template rendering
   */
  async _prepareContext(_options) {
    // Get the currently enabled mounts
    const enabledMounts = game.settings.get(CONST.moduleId, CONST.settings.enabledMounts);

    // Get potential mounts and vehicles
    const actors = await MountConfigMenu._getPotentialMounts();

    // Store actors in the instance for use in the widget
    this.actors = actors;

    // Create a virtual document with schema for the form fields
    const settingSchema = new foundry.data.fields.SchemaField({
      mounts: new foundry.data.fields.SetField(
        new foundry.data.fields.StringField({
          required: false
        })
      )
    });

    // Create a virtual document with selected mounts
    const selectedMounts = Object.keys(enabledMounts).filter((id) => enabledMounts[id]);
    const document = {
      schema: settingSchema,
      mounts: selectedMounts
    };

    // Bind the widget creator with the current instance
    const app = this;
    const mountsWidget = (field, groupConfig, inputConfig) => {
      return MountConfigMenu._createMountsWidget(field, groupConfig, inputConfig, app);
    };

    return {
      document,
      fields: settingSchema.fields,
      mountsWidget,
      buttons: [{ type: 'submit', icon: 'fas fa-save', label: 'TravelPace.Buttons.Save' }],
      actors: actors
    };
  }

  /**
   * Shows a confirmation dialog for reloading the world/application
   * @param {object} options - Configuration options
   * @param {boolean} options.world - Whether to reload the entire world
   * @returns {Promise<void>}
   * @static
   */
  static async reloadConfirm({ world = false } = {}) {
    const reload = await DialogV2.confirm({
      id: 'reload-world-confirm',
      modal: true,
      rejectClose: false,
      window: { title: 'SETTINGS.ReloadPromptTitle' },
      position: { width: 400 },
      content: `<p>${game.i18n.localize('SETTINGS.ReloadPromptBody')}</p>`
    });
    if (!reload) return;
    if (world && game.user.can('SETTINGS_MODIFY')) game.socket.emit('reload');
    foundry.utils.debouncedReload();
  }

  /**
   * Get all potential mounts and vehicles
   * @returns {Promise<Array>} Array of actor data objects
   */
  static async _getPotentialMounts() {
    const actors = [];

    // 1. Get NPCs from the Mounts folder in the world
    const mountFolder = game.folders.find((f) => f.name === 'Mounts' && f.type === 'Actor');
    if (mountFolder) {
      const folderMounts = game.actors.filter((a) => a.folder?.id === mountFolder.id);
      for (const actor of folderMounts) {
        actors.push({
          id: actor.id,
          name: actor.name,
          type: actor.type,
          speed: MountConfigMenu._getActorSpeed(actor),
          img: actor.img,
          isWorld: true
        });
      }
    }

    // 2. Scan through all compendium packs for vehicles
    for (const pack of game.packs) {
      if (pack.documentName === 'Actor') {
        try {
          // Get the index for the pack
          const index = await pack.getIndex();

          // Filter for vehicles
          const vehicleIndices = index.filter((i) => i.type === 'vehicle');

          // Add each vehicle to the actors array
          for (const vehicleIndex of vehicleIndices) {
            try {
              const vehicle = await pack.getDocument(vehicleIndex._id);
              actors.push({
                id: `${pack.collection}.${vehicleIndex._id}`, // Use compendium UUID format
                name: vehicle.name,
                type: 'vehicle',
                speed: MountConfigMenu._getActorSpeed(vehicle),
                img: vehicle.img,
                isCompendium: true,
                packId: pack.collection
              });
            } catch (docError) {
              // Skip this vehicle
            }
          }
        } catch (error) {
          // Skip this pack
        }
      }
    }

    return actors;
  }

  /**
   * Create a custom widget for the mounts selection
   * @param {DataField} field - The field being rendered
   * @param {object} groupConfig - Configuration for the form group
   * @param {object} inputConfig - Configuration for the input
   * @param {MountConfigMenu} app - The application instance
   * @returns {HTMLElement} The custom form group element
   */
  static _createMountsWidget(field, groupConfig, inputConfig, app) {
    // Create the form group container
    const fg = document.createElement('div');
    fg.className = 'form-group stacked mounts';

    // Create form fields container
    const ff = fg.appendChild(document.createElement('div'));
    ff.className = 'form-fields';

    // Add hint text if provided
    if (groupConfig.hint) {
      fg.insertAdjacentHTML('beforeend', `<p class="hint">${groupConfig.hint}</p>`);
    }

    // Access the actors from the instance directly
    const actors = app.actors || [];

    // If no actors found, add a message
    if (!actors || actors.length === 0) {
      ff.insertAdjacentHTML('beforeend', `<p class="notification warning">${game.i18n.localize('TravelPace.Settings.MountConfig.NoMounts')}</p>`);
      return fg;
    }

    // Group actors by source and type
    const worldVehicles = game.i18n.localize('TravelPace.Settings.MountConfig.WorldVehicles');
    const worldNPCs = game.i18n.localize('TravelPace.Settings.MountConfig.WorldNPCs');
    const compendiumVehicles = game.i18n.localize('TravelPace.Settings.MountConfig.CompendiumVehicles');

    // Create options for the multi-select
    const options = actors.map((actor) => {
      let group;
      if (actor.isCompendium) {
        group = compendiumVehicles;
      } else {
        group = actor.type === 'vehicle' ? worldVehicles : worldNPCs;
      }

      return {
        group,
        value: actor.id,
        label: `${actor.name} (${actor.speed})`
      };
    });

    // Create the multi-select element
    const multiSelect = foundry.applications.fields.createMultiSelectInput({
      ...inputConfig,
      name: 'mounts',
      options,
      sort: true,
      value: inputConfig.value || []
    });

    ff.appendChild(multiSelect);
    return fg;
  }

  /**
   * Get the speed value for an actor, formatting it appropriately
   * @param {Actor} actor - The actor to get speed for
   * @returns {string} Formatted speed value
   */
  static _getActorSpeed(actor) {
    if (actor.type === 'vehicle') {
      // Handle vehicle speeds which might be in miles or kilometers per hour
      const movement = actor.system.attributes?.movement || {};
      if (movement.units === 'mi' || movement.units === 'km') {
        // Take the highest speed
        const speeds = Object.entries(movement)
          .filter(([key, value]) => typeof value === 'number' && key !== 'units')
          .map(([key, value]) => value);

        if (speeds.length) return `${Math.max(...speeds)} ${movement.units}/hour`;
        return 'Unknown';
      }
    }

    // For NPCs and other actor types
    const speed = actor.system.attributes?.movement?.walk || 0;
    return `${speed} ft`;
  }

  /**
   * Process form submission for the mount configuration
   * @param {Event} _event - The form submission event
   * @param {HTMLFormElement} _form - The form element
   * @param {FormDataExtended} formData - The processed form data
   * @returns {Promise<void>}
   */
  static async formHandler(_event, _form, formData) {
    const enabledMounts = {};
    const requiresWorldReload = true; // Settings changes require world reload

    // Get the selected mounts from the multi-select
    const selectedMounts = formData.object.mounts || [];

    // Convert to the format expected by the settings
    if (Array.isArray(selectedMounts)) {
      selectedMounts.forEach((id) => {
        enabledMounts[id] = true;
      });
    } else if (selectedMounts) {
      // Handle single selection case
      enabledMounts[selectedMounts] = true;
    }

    MountConfigMenu.reloadConfirm({ world: requiresWorldReload });

    await game.settings.set(CONST.moduleId, CONST.settings.enabledMounts, enabledMounts);
    ui.notifications.info('TravelPace.Settings.MountConfig.Saved', { localize: true });
  }
}

/**
 * Create the Mounts folder if it doesn't exist
 */
async function createMountsFolder() {
  if (!game.folders.find((f) => f.name === 'Mounts' && f.type === 'Actor')) {
    await Folder.create({
      name: 'Mounts',
      type: 'Actor',
      color: '#a97f33',
      sort: 30000,
      sorting: 'a',
      descriptions: 'Mounts folder created by the Travel Pace Calculator module.'
    });
  }
}

// Create Mounts folder when ready (if GM)
Hooks.once('ready', () => {
  if (game.user.isGM) {
    createMountsFolder();
  }
});
