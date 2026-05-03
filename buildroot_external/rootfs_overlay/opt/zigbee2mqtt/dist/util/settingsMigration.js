"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateIfNecessary = migrateIfNecessary;
const node_fs_1 = require("node:fs");
const data_1 = __importDefault(require("./data"));
const settings = __importStar(require("./settings"));
const utils_1 = __importDefault(require("./utils"));
const SUPPORTED_VERSIONS = [undefined, 2, 3, 4, settings.CURRENT_VERSION];
function backupSettings(version) {
    const filePath = data_1.default.joinPath("configuration.yaml");
    (0, node_fs_1.copyFileSync)(filePath, filePath.replace(".yaml", `_backup_v${version}.yaml`));
}
/**
 * Set the given path in given settings to given value. If requested, create path.
 *
 * @param currentSettings
 * @param path
 * @param value
 * @param createPathIfNotExist
 * @returns Returns true if value was set, false if not.
 */
// biome-ignore lint/suspicious/noExplicitAny: auto-parsing
function setValue(currentSettings, path, value, createPathIfNotExist = false) {
    for (let i = 0; i < path.length; i++) {
        const key = path[i];
        if (i === path.length - 1) {
            currentSettings[key] = value;
        }
        else {
            if (!currentSettings[key]) {
                if (createPathIfNotExist) {
                    currentSettings[key] = {};
                    /* v8 ignore start */
                }
                else {
                    // invalid path
                    // ignored in test since currently call is always guarded by get-validated path, so this is never reached
                    return false;
                }
                /* v8 ignore stop */
            }
            currentSettings = currentSettings[key];
        }
    }
    return true;
}
/**
 * Get the value at the given path in given settings.
 *
 * @param currentSettings
 * @param path
 * @returns
 *   - true if path was valid
 *   - the value at path
 */
// biome-ignore lint/suspicious/noExplicitAny: auto-parsing
function getValue(currentSettings, path) {
    for (let i = 0; i < path.length; i++) {
        const key = path[i];
        const value = currentSettings[key];
        if (i === path.length - 1) {
            return [value !== undefined, value];
        }
        if (!value) {
            // invalid path
            break;
        }
        currentSettings = value;
    }
    return [false, undefined];
}
/**
 * Add a value at given path, path is created as needed.
 * @param currentSettings
 * @param addition
 */
function addValue(currentSettings, addition) {
    setValue(currentSettings, addition.path, addition.value, true);
}
/**
 * Remove value at given path, if path is valid.
 * Value is actually set to undefined, which triggers removal when `settings.apply` is called.
 * @param currentSettings
 * @param removal
 * @returns
 */
function removeValue(currentSettings, removal) {
    const [validPath, previousValue] = getValue(currentSettings, removal.path);
    if (validPath && previousValue != null) {
        setValue(currentSettings, removal.path, undefined);
    }
    return [validPath, previousValue];
}
/**
 * Change value at given path, if path is valid, and value matched one of the defined values (if any).
 * @param currentSettings
 * @param change
 * @returns
 */
function changeValue(currentSettings, change) {
    const [validPath, previousValue] = getValue(currentSettings, change.path);
    let changed = false;
    if (validPath && previousValue !== change.newValue) {
        if (!change.previousValueAnyOf || change.previousValueAnyOf.includes(previousValue)) {
            setValue(currentSettings, change.path, change.newValue);
            changed = true;
        }
    }
    return [validPath, previousValue, changed];
}
/**
 * Transfer value at given path, to new path.
 * Given path must be valid.
 * New path must not be valid or new path value must be nullish, otherwise given path is removed only.
 * Value at given path is actually set to undefined, which triggers removal when `settings.apply` is called.
 * New path is created as needed.
 * @param currentSettings
 * @param transfer
 * @returns
 */
function transferValue(currentSettings, transfer) {
    const [validPath, previousValue] = getValue(currentSettings, transfer.path);
    const [destValidPath, destValue] = getValue(currentSettings, transfer.newPath);
    const transfered = validPath && previousValue != null && (!destValidPath || destValue == null || Array.isArray(destValue));
    // no point in set if already undefined
    if (validPath && previousValue != null) {
        setValue(currentSettings, transfer.path, undefined);
    }
    if (transfered) {
        if (Array.isArray(previousValue) && Array.isArray(destValue)) {
            setValue(currentSettings, transfer.newPath, [...previousValue, ...destValue], true);
        }
        else {
            setValue(currentSettings, transfer.newPath, previousValue, true);
        }
    }
    return [validPath, previousValue, transfered];
}
const noteIfWasTrue = (previousValue) => previousValue === true;
const noteIfWasDefined = (previousValue) => previousValue != null;
const noteIfWasNonEmptyArray = (previousValue) => Array.isArray(previousValue) && previousValue.length > 0;
function migrateToTwo(currentSettings, transfers, changes, additions, removals, customHandlers) {
    transfers.push({
        path: ["advanced", "homeassistant_discovery_topic"],
        note: "HA discovery_topic was moved from advanced.homeassistant_discovery_topic to homeassistant.discovery_topic.",
        noteIf: noteIfWasDefined,
        newPath: ["homeassistant", "discovery_topic"],
    }, {
        path: ["advanced", "homeassistant_status_topic"],
        note: "HA status_topic was moved from advanced.homeassistant_status_topic to homeassistant.status_topic.",
        noteIf: noteIfWasDefined,
        newPath: ["homeassistant", "status_topic"],
    }, {
        path: ["advanced", "baudrate"],
        note: "Baudrate was moved from advanced.baudrate to serial.baudrate.",
        noteIf: noteIfWasDefined,
        newPath: ["serial", "baudrate"],
    }, {
        path: ["advanced", "rtscts"],
        note: "RTSCTS was moved from advanced.rtscts to serial.rtscts.",
        noteIf: noteIfWasDefined,
        newPath: ["serial", "rtscts"],
    }, {
        path: ["experimental", "transmit_power"],
        note: "Transmit power was moved from experimental.transmit_power to advanced.transmit_power.",
        noteIf: noteIfWasDefined,
        newPath: ["advanced", "transmit_power"],
    }, {
        path: ["experimental", "output"],
        note: "Output was moved from experimental.output to advanced.output.",
        noteIf: noteIfWasDefined,
        newPath: ["advanced", "output"],
    }, {
        path: ["ban"],
        note: "ban was renamed to passlist.",
        noteIf: noteIfWasDefined,
        newPath: ["blocklist"],
    }, {
        path: ["whitelist"],
        note: "whitelist was renamed to passlist.",
        noteIf: noteIfWasDefined,
        newPath: ["passlist"],
    });
    changes.push({
        path: ["advanced", "log_level"],
        note: `Log level 'warn' has been renamed to 'warning'.`,
        noteIf: (previousValue) => previousValue === "warn",
        previousValueAnyOf: ["warn"],
        newValue: "warning",
    });
    additions.push({
        path: ["version"],
        note: "Migrated settings to version 2",
        value: 2,
    });
    const haLegacyTriggers = {
        path: ["homeassistant", "legacy_triggers"],
        note: "Action and click sensors have been removed (homeassistant.legacy_triggers setting). This means all sensor.*_action and sensor.*_click entities are removed. Use the MQTT device trigger instead.",
        noteIf: noteIfWasTrue,
    };
    const haLegacyEntityAttrs = {
        path: ["homeassistant", "legacy_entity_attributes"],
        note: "Entity attributes (homeassistant.legacy_entity_attributes setting) has been removed. This means that entities discovered by Zigbee2MQTT will no longer have entity attributes (Home Assistant entity attributes are accessed via e.g. states.binary_sensor.my_sensor.attributes).",
        noteIf: noteIfWasTrue,
    };
    const otaIkeaUseTestUrl = {
        path: ["ota", "ikea_ota_use_test_url"],
        note: "Due to the OTA rework, the ota.ikea_ota_use_test_url option has been removed.",
        noteIf: noteIfWasTrue,
    };
    removals.push(haLegacyTriggers, haLegacyEntityAttrs, {
        path: ["advanced", "homeassistant_legacy_triggers"],
        note: haLegacyTriggers.note,
        noteIf: haLegacyTriggers.noteIf,
    }, {
        path: ["advanced", "homeassistant_legacy_entity_attributes"],
        note: haLegacyEntityAttrs.note,
        noteIf: haLegacyEntityAttrs.noteIf,
    }, {
        path: ["permit_join"],
        note: "The permit_join setting has been removed, use the frontend or MQTT to permit joining.",
        noteIf: noteIfWasTrue,
    }, otaIkeaUseTestUrl, {
        path: ["advanced", "ikea_ota_use_test_url"],
        note: otaIkeaUseTestUrl.note,
        noteIf: otaIkeaUseTestUrl.noteIf,
    }, {
        path: ["advanced", "legacy_api"],
        note: "The MQTT legacy API has been removed (advanced.legacy_api setting). See link below for affected topics.",
        noteIf: noteIfWasTrue,
    }, {
        path: ["advanced", "legacy_availability_payload"],
        note: 'Due to the removal of advanced.legacy_availability_payload, zigbee2mqtt/bridge/state will now always be a JSON object ({"state":"online"} or {"state":"offline"})',
        noteIf: noteIfWasTrue,
    }, {
        path: ["advanced", "soft_reset_timeout"],
        note: "Removed deprecated: Soft reset feature (advanced.soft_reset_timeout setting)",
        noteIf: noteIfWasDefined,
    }, {
        path: ["advanced", "report"],
        note: "Removed deprecated: Report feature (advanced.report setting)",
        noteIf: noteIfWasTrue,
    }, {
        path: ["advanced", "availability_timeout"],
        note: "Removed deprecated: advanced.availability_timeout availability settings",
        noteIf: noteIfWasDefined,
    }, {
        path: ["advanced", "availability_blocklist"],
        note: "Removed deprecated: advanced.availability_blocklist availability settings",
        noteIf: noteIfWasNonEmptyArray,
    }, {
        path: ["advanced", "availability_passlist"],
        note: "Removed deprecated: advanced.availability_passlist availability settings",
        noteIf: noteIfWasNonEmptyArray,
    }, {
        path: ["advanced", "availability_blacklist"],
        note: "Removed deprecated: advanced.availability_blacklist availability settings",
        noteIf: noteIfWasNonEmptyArray,
    }, {
        path: ["advanced", "availability_whitelist"],
        note: "Removed deprecated: advanced.availability_whitelist availability settings",
        noteIf: noteIfWasNonEmptyArray,
    }, {
        path: ["device_options", "legacy"],
        note: "Removed everything that was enabled through device_options.legacy. See link below for affected devices.",
        noteIf: noteIfWasTrue,
    }, {
        path: ["experimental"],
        note: "The entire experimental section was removed.",
        noteIf: noteIfWasDefined,
    }, {
        path: ["external_converters"],
        note: "External converters are now automatically loaded from the 'data/external_converters' directory without requiring settings to be set. Make sure your external converters are still needed (might be supported out-of-the-box now), and if so, move them to that directory.",
        noteIf: noteIfWasNonEmptyArray,
    });
    // note only once
    const noteEntityOptionsRetrieveState = "Retrieve state option ((devices|groups).xyz.retrieve_state setting)";
    for (const deviceKey in currentSettings.devices) {
        removals.push({
            path: ["devices", deviceKey, "retrieve_state"],
            note: noteEntityOptionsRetrieveState,
            noteIf: noteIfWasTrue,
        });
    }
    for (const groupKey in currentSettings.groups) {
        removals.push({
            path: ["groups", groupKey, "retrieve_state"],
            note: noteEntityOptionsRetrieveState,
            noteIf: noteIfWasTrue,
        });
        removals.push({
            path: ["groups", groupKey, "devices"],
            note: "Removed configuring group members through configuration.yaml (groups.xyz.devices setting). This will not impact current group members; however, you will no longer be able to add or remove devices from a group through the configuration.yaml.",
            noteIf: noteIfWasDefined,
        });
    }
    customHandlers.push();
}
function migrateToThree(_currentSettings, transfers, changes, additions, removals, customHandlers) {
    transfers.push();
    changes.push({
        path: ["version"],
        note: "Migrated settings to version 3",
        newValue: 3,
    });
    additions.push();
    removals.push();
    const changeToObject = (currentSettings, path) => {
        const [validPath, previousValue] = getValue(currentSettings, path);
        if (validPath) {
            if (typeof previousValue === "boolean") {
                setValue(currentSettings, path, { enabled: previousValue });
            }
            else {
                setValue(currentSettings, path, { enabled: true, ...previousValue });
            }
        }
        return [validPath, previousValue, validPath];
    };
    customHandlers.push({
        note: `Property 'homeassistant' is now always an object.`,
        noteIf: () => true,
        execute: (currentSettings) => changeToObject(currentSettings, ["homeassistant"]),
    }, {
        note: `Property 'frontend' is now always an object.`,
        noteIf: () => true,
        execute: (currentSettings) => changeToObject(currentSettings, ["frontend"]),
    }, {
        note: `Property 'availability' is now always an object.`,
        noteIf: () => true,
        execute: (currentSettings) => changeToObject(currentSettings, ["availability"]),
    });
}
function migrateToFour(_currentSettings, transfers, changes, additions, removals, customHandlers) {
    transfers.push();
    changes.push({
        path: ["version"],
        note: "Migrated settings to version 4",
        newValue: 4,
    });
    additions.push();
    removals.push();
    const saveBase64DeviceIconsAsImage = (currentSettings) => {
        const [validPath, previousValue] = getValue(currentSettings, ["devices"]);
        let changed = false;
        if (validPath) {
            for (const deviceKey in currentSettings.devices) {
                const base64Match = utils_1.default.matchBase64File(currentSettings.devices[deviceKey].icon);
                if (base64Match) {
                    changed = true;
                    currentSettings.devices[deviceKey].icon = utils_1.default.saveBase64DeviceIcon(base64Match);
                }
            }
        }
        return [validPath, previousValue, changed];
    };
    customHandlers.push({
        note: "Device icons are now saved as images.",
        noteIf: () => true,
        execute: (currentSettings) => saveBase64DeviceIconsAsImage(currentSettings),
    });
}
function migrateToFive(_currentSettings, transfers, changes, additions, removals, customHandlers) {
    transfers.push();
    changes.push({
        path: ["version"],
        note: "Migrated settings to version 5",
        newValue: 5,
    });
    additions.push();
    removals.push();
    const resetOtaStates = (_currentSettings) => {
        const filePath = data_1.default.joinPath("state.json");
        if ((0, node_fs_1.existsSync)(filePath)) {
            try {
                const stateFile = (0, node_fs_1.readFileSync)(filePath, "utf8");
                const stateObj = JSON.parse(stateFile);
                for (const key in stateObj) {
                    const entry = stateObj[key];
                    if (entry.update) {
                        delete entry.update;
                    }
                }
                (0, node_fs_1.writeFileSync)(filePath, JSON.stringify(stateObj), "utf8");
                // hack, this does not actually affect settings, we just want to ensure the migration note triggers
                return [true, undefined, true];
            }
            catch (error) {
                console.error(`Failed to write state to '${filePath}' (${error})`);
            }
        }
        return [false, undefined, false];
    };
    customHandlers.push({
        note: "Reset all cached OTA states due to internal changes.",
        noteIf: () => true,
        execute: (currentSettings) => resetOtaStates(currentSettings),
    });
}
/**
 * Order of execution:
 * - Transfer
 * - Change
 * - Add
 * - Remove
 *
 * Should allow the most flexibility whenever combination of migrations is necessary (e.g. Transfer + Change)
 */
function migrateIfNecessary() {
    const currentSettings = settings.getPersistedSettings();
    if (!SUPPORTED_VERSIONS.includes(currentSettings.version)) {
        throw new Error(`Your configuration.yaml has an unsupported version ${currentSettings.version}, expected one of ${SUPPORTED_VERSIONS.map((v) => String(v)).join(",")}.`);
    }
    /* v8 ignore next */
    const finalVersion = process.env.VITEST_WORKER_ID ? settings.testing.CURRENT_VERSION : settings.CURRENT_VERSION;
    if (currentSettings.version === finalVersion) {
        // when same version as current, nothing to do
        return;
    }
    while (currentSettings.version !== finalVersion) {
        let migrationNotesFileName;
        // don't duplicate outputs
        const migrationNotes = new Set();
        const transfers = [];
        const changes = [];
        const additions = [];
        const removals = [];
        const customHandlers = [];
        backupSettings(currentSettings.version || 1);
        // each version should only bump to the next version so as to gradually migrate if necessary
        if (currentSettings.version == null) {
            // migrating from 1 (`version` did not exist) to 2
            migrationNotesFileName = "migration-1-to-2.log";
            migrateToTwo(currentSettings, transfers, changes, additions, removals, customHandlers);
        }
        else if (currentSettings.version === 2) {
            migrationNotesFileName = "migration-2-to-3.log";
            migrateToThree(currentSettings, transfers, changes, additions, removals, customHandlers);
        }
        else if (currentSettings.version === 3) {
            migrationNotesFileName = "migration-3-to-4.log";
            migrateToFour(currentSettings, transfers, changes, additions, removals, customHandlers);
        }
        else if (currentSettings.version === 4) {
            migrationNotesFileName = "migration-4-to-5.log";
            migrateToFive(currentSettings, transfers, changes, additions, removals, customHandlers);
        }
        for (const transfer of transfers) {
            const [validPath, previousValue, transfered] = transferValue(currentSettings, transfer);
            if (validPath && (!transfer.noteIf || transfer.noteIf(previousValue))) {
                migrationNotes.add(`[${transfered ? "TRANSFER" : "REMOVAL"}] ${transfer.note}`);
            }
        }
        for (const change of changes) {
            const [validPath, previousValue, changed] = changeValue(currentSettings, change);
            if (validPath && changed && (!change.noteIf || change.noteIf(previousValue))) {
                migrationNotes.add(`[CHANGE] ${change.note}`);
            }
        }
        for (const addition of additions) {
            addValue(currentSettings, addition);
            migrationNotes.add(`[ADDITION] ${addition.note}`);
        }
        for (const removal of removals) {
            const [validPath, previousValue] = removeValue(currentSettings, removal);
            if (validPath && (!removal.noteIf || removal.noteIf(previousValue))) {
                migrationNotes.add(`[REMOVAL] ${removal.note}`);
            }
        }
        for (const customHandler of customHandlers) {
            const [validPath, previousValue, changed] = customHandler.execute(currentSettings);
            if (validPath && changed && (!customHandler.noteIf || customHandler.noteIf(previousValue))) {
                migrationNotes.add(`[SPECIAL] ${customHandler.note}`);
            }
        }
        if (migrationNotesFileName && migrationNotes.size > 0) {
            migrationNotes.add("For more details, see https://github.com/Koenkk/zigbee2mqtt/discussions/24198");
            const migrationNotesFilePath = data_1.default.joinPath(migrationNotesFileName);
            (0, node_fs_1.writeFileSync)(migrationNotesFilePath, Array.from(migrationNotes).join("\r\n\r\n"), "utf8");
            console.log(`Migration notes written in ${migrationNotesFilePath}`);
        }
    }
    // don't throw, onboarding will validate at end of process
    settings.apply(currentSettings, false);
    settings.reRead();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dGluZ3NNaWdyYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdXRpbC9zZXR0aW5nc01pZ3JhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQStoQkEsZ0RBb0dDO0FBbm9CRCxxQ0FBOEU7QUFDOUUsa0RBQTBCO0FBQzFCLHFEQUF1QztBQUN2QyxvREFBNEI7QUEyQjVCLE1BQU0sa0JBQWtCLEdBQTBCLENBQUMsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUVqRyxTQUFTLGNBQWMsQ0FBQyxPQUFlO0lBQ25DLE1BQU0sUUFBUSxHQUFHLGNBQUksQ0FBQyxRQUFRLENBQUMsb0JBQW9CLENBQUMsQ0FBQztJQUVyRCxJQUFBLHNCQUFZLEVBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFlBQVksT0FBTyxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQ2xGLENBQUM7QUFFRDs7Ozs7Ozs7R0FRRztBQUNILDJEQUEyRDtBQUMzRCxTQUFTLFFBQVEsQ0FBQyxlQUFvQixFQUFFLElBQWMsRUFBRSxLQUFjLEVBQUUsb0JBQW9CLEdBQUcsS0FBSztJQUNoRyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ25DLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVwQixJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ3hCLGVBQWUsQ0FBQyxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUM7UUFDakMsQ0FBQzthQUFNLENBQUM7WUFDSixJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FB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