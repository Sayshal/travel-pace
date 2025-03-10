const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

Hooks.once('init', () => {
  game.settings.register('travel-pace', 'useMetric', {
    name: 'TravelPace.Settings.UseMetric.Name',
    hint: 'TravelPace.Settings.UseMetric.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register('travel-pace', 'showEffects', {
    name: 'TravelPace.Settings.ShowEffects.Name',
    hint: 'TravelPace.Settings.ShowEffects.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register('travel-pace', 'enabledMounts', {
    name: 'TravelPace.Settings.EnabledMounts.Name',
    hint: 'TravelPace.Settings.EnabledMounts.Hint',
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });

  // Register the mount configuration menu
  game.settings.registerMenu('travel-pace', 'mountConfig', {
    name: 'TravelPace.Settings.MountConfig.Name',
    label: 'TravelPace.Settings.MountConfig.Label',
    hint: 'TravelPace.Settings.MountConfig.Hint',
    icon: 'fas fa-horse',
    type: MountConfigMenu,
    restricted: true
  });
});

// Mount configuration menu class
class MountConfigMenu extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
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

  /* -------------------------------------------- */
  /*  Protected Methods                           */
  /* -------------------------------------------- */

  /**
   * Prepare context data for rendering the mount configuration template
   * @param {object} _options - Application render options
   * @returns {Promise<object>} Context data for template rendering
   * @protected
   */
  async _prepareContext(_options) {
    console.log('Travel Pace | Beginning _prepareContext');

    // Get the currently enabled mounts
    const enabledMounts = game.settings.get('travel-pace', 'enabledMounts');
    console.log('Travel Pace | Currently enabled mounts:', enabledMounts);

    // Get potential mounts and vehicles
    console.log('Travel Pace | Fetching potential mounts...');
    const actors = await this._getPotentialMounts();
    console.log('Travel Pace | Potential mounts returned:', actors);

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

    // Create a virtual document
    const selectedMounts = Object.keys(enabledMounts).filter((id) => enabledMounts[id]);
    console.log('Travel Pace | Selected mounts for context:', selectedMounts);

    const document = {
      schema: settingSchema,
      mounts: selectedMounts
    };

    const context = {
      document,
      fields: settingSchema.fields,
      mountsWidget: this._createMountsWidget.bind(this),
      buttons: [{ type: 'submit', icon: 'fas fa-save', label: 'TravelPace.Buttons.Save' }],
      actors: actors
    };

    console.log('Travel Pace | Returning context:', context);
    return context;
  }

  /**
   * Get all potential mounts and vehicles
   * @returns {Promise<Array>} Array of actor data objects
   * @private
   */
  async _getPotentialMounts() {
    console.log('Travel Pace | Beginning _getPotentialMounts');
    const actors = [];

    // 1. Get NPCs from the Mounts folder in the world
    const mountFolder = game.folders.find((f) => f.name === 'Mounts' && f.type === 'Actor');
    console.log('Travel Pace | Mounts folder found:', mountFolder);

    if (mountFolder) {
      const folderMounts = game.actors.filter((a) => a.folder?.id === mountFolder.id);
      console.log(`Travel Pace | Found ${folderMounts.length} actors in the Mounts folder`);

      folderMounts.forEach((actor) => {
        console.log(`Travel Pace | Adding folder mount: ${actor.name}`);
        actors.push({
          id: actor.id,
          name: actor.name,
          type: actor.type,
          speed: this._getActorSpeed(actor),
          img: actor.img,
          isWorld: true
        });
      });
    }

    // 2. Scan through all compendium packs for vehicles
    console.log(`Travel Pace | Scanning ${game.packs.size} compendium packs`);
    let packCount = 0;
    let vehicleCount = 0;

    for (const pack of game.packs) {
      if (pack.documentName === 'Actor') {
        packCount++;
        console.log(`Travel Pace | Scanning pack: ${pack.collection}`);

        try {
          // Get the index for the pack
          const index = await pack.getIndex();
          console.log(`Travel Pace | Pack ${pack.collection} has ${index.size} entries`);

          // Filter for vehicles
          const vehicleIndices = index.filter((i) => i.type === 'vehicle');
          console.log(`Travel Pace | Found ${vehicleIndices.length} vehicles in pack ${pack.collection}`);

          // If any vehicles are found, add them to the actors array
          for (const vehicleIndex of vehicleIndices) {
            vehicleCount++;
            // Get the full document for each vehicle
            try {
              const vehicle = await pack.getDocument(vehicleIndex._id);
              console.log(`Travel Pace | Adding compendium vehicle: ${vehicle.name}`);

              actors.push({
                id: `${pack.collection}.${vehicleIndex._id}`, // Use compendium UUID format
                name: vehicle.name,
                type: 'vehicle',
                speed: this._getActorSpeed(vehicle),
                img: vehicle.img,
                isCompendium: true,
                packId: pack.collection
              });
            } catch (docError) {
              console.error(`Travel Pace | Error getting document for ${vehicleIndex.name}:`, docError);
            }
          }
        } catch (error) {
          console.error(`Travel Pace | Error scanning pack ${pack.collection}:`, error);
        }
      }
    }

    console.log(`Travel Pace | Finished scanning ${packCount} actor packs, found ${vehicleCount} vehicles`);
    console.log(`Travel Pace | Total potential mounts collected: ${actors.length}`);
    return actors;
  }

  /* -------------------------------------------- */
  /*  Widget Creation                             */
  /* -------------------------------------------- */

  /**
   * Create a custom widget for the mounts selection
   * @param {DataField} field - The field being rendered
   * @param {object} groupConfig - Configuration for the form group
   * @param {object} inputConfig - Configuration for the input
   * @returns {HTMLElement} The custom form group element
   * @private
   */
  _createMountsWidget(field, groupConfig, inputConfig) {
    console.log('Travel Pace | Creating mounts widget');
    console.log('Travel Pace | Field:', field);
    console.log('Travel Pace | Group config:', groupConfig);
    console.log('Travel Pace | Input config:', inputConfig);

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

    // Get all potential mounts/vehicles
    // Access the actors from the instance directly since this is a bound method
    const actors = this.actors || [];
    console.log('Travel Pace | Widget actors access:', actors);

    // If no actors found, add a message
    if (!actors || actors.length === 0) {
      console.log('Travel Pace | No actors found for the widget');
      ff.insertAdjacentHTML('beforeend', `<p class="notification warning">${game.i18n.localize('TravelPace.Settings.MountConfig.NoMounts')}</p>`);
      return fg;
    }

    // Create options for the multi-select
    const options = [];

    // Group actors by source and type
    const worldVehicles = game.i18n.localize('TravelPace.Settings.MountConfig.WorldVehicles');
    const worldNPCs = game.i18n.localize('TravelPace.Settings.MountConfig.WorldNPCs');
    const compendiumVehicles = game.i18n.localize('TravelPace.Settings.MountConfig.CompendiumVehicles');

    for (const actor of actors) {
      let group;
      if (actor.isCompendium) {
        group = compendiumVehicles;
      } else {
        group = actor.type === 'vehicle' ? worldVehicles : worldNPCs;
      }

      options.push({
        group,
        value: actor.id,
        label: `${actor.name} (${actor.speed})`
      });
    }

    console.log('Travel Pace | Options for multi-select:', options);

    // Create the multi-select element
    const multiSelect = foundry.applications.fields.createMultiSelectInput({
      ...inputConfig,
      name: 'mounts',
      options,
      sort: true,
      value: inputConfig.value || []
    });

    console.log('Travel Pace | Created multi-select element:', multiSelect);
    ff.appendChild(multiSelect);

    return fg;
  }

  /* -------------------------------------------- */
  /*  Utility Methods                             */
  /* -------------------------------------------- */

  /**
   * Get the speed value for an actor, formatting it appropriately
   * @param {Actor} actor - The actor to get speed for
   * @returns {string} Formatted speed value
   * @private
   */
  _getActorSpeed(actor) {
    if (actor.type === 'vehicle') {
      // Handle vehicle speeds which might be in miles or kilometers per hour
      const movement = actor.system.attributes?.movement || {};
      if (movement.units === 'mi' || movement.units === 'km') {
        // For simplicity, we'll just take the highest speed
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

  /* -------------------------------------------- */
  /*  Static Form Handler                         */
  /* -------------------------------------------- */

  /**
   * Process form submission for the mount configuration
   * @param {Event} _event - The form submission event
   * @param {HTMLFormElement} _form - The form element
   * @param {FormDataExtended} formData - The processed form data
   * @returns {Promise<void>}
   * @static
   */
  static async formHandler(_event, _form, formData) {
    const enabledMounts = {};

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

    await game.settings.set('travel-pace', 'enabledMounts', enabledMounts);
    ui.notifications.info('TravelPace.Settings.MountConfig.Saved', { localize: true });
  }
}

// Helper function to create the Mounts folder if it doesn't exist
async function createMountsFolder() {
  if (!game.folders.find((f) => f.name === 'Mounts' && f.type === 'Actor')) {
    await Folder.create({
      name: 'Mounts',
      type: 'Actor',
      color: '#a97f33', // Horse-brown color
      icon: 'fas fa-horse',
      sort: 30000 // Sort at the end
    });
    console.log('Travel Pace | Created Mounts folder for organizing mount NPCs');
  }
}

/**
 * Get an actor by ID, whether from world or compendium
 * @param {string} id - The actor ID, which might be a world ID or compendium UUID
 * @returns {Promise<Actor|null>} The resolved actor or null
 */
async function getActorById(id) {
  // Check if this is a compendium UUID (contains a period)
  if (id.includes('.')) {
    // It's a compendium reference, use fromUuid
    return await fromUuid(id);
  } else {
    // It's a world actor ID
    return game.actors.get(id);
  }
}

// Add this to your initialization hooks
Hooks.once('ready', () => {
  // Create Mounts folder if it doesn't exist
  if (game.user.isGM) {
    createMountsFolder();
  }
});

// Update the settings registration to use the new class
Hooks.once('init', () => {
  // Other settings registrations remain the same...

  // Register the mount configuration menu
  game.settings.registerMenu('travel-pace', 'mountConfig', {
    name: 'TravelPace.Settings.MountConfig.Name',
    label: 'TravelPace.Settings.MountConfig.Label',
    hint: 'TravelPace.Settings.MountConfig.Hint',
    icon: 'fas fa-horse',
    type: MountConfigMenu,
    restricted: true
  });
});
