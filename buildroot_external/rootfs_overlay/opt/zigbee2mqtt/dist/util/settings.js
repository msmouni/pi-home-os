"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testing = exports.defaults = exports.LOG_LEVELS = exports.CURRENT_VERSION = exports.schemaJson = void 0;
exports.writeMinimalDefaults = writeMinimalDefaults;
exports.setOnboarding = setOnboarding;
exports.write = write;
exports.validate = validate;
exports.validateNonRequired = validateNonRequired;
exports.getPersistedSettings = getPersistedSettings;
exports.get = get;
exports.set = set;
exports.apply = apply;
exports.getGroup = getGroup;
exports.getDevice = getDevice;
exports.addDevice = addDevice;
exports.blockDevice = blockDevice;
exports.removeDevice = removeDevice;
exports.addGroup = addGroup;
exports.removeGroup = removeGroup;
exports.changeEntityOptions = changeEntityOptions;
exports.changeFriendlyName = changeFriendlyName;
exports.reRead = reRead;
const node_path_1 = __importDefault(require("node:path"));
const ajv_1 = __importDefault(require("ajv"));
const object_assign_deep_1 = __importDefault(require("object-assign-deep"));
const data_1 = __importDefault(require("./data"));
const settings_schema_json_1 = __importDefault(require("./settings.schema.json"));
exports.schemaJson = settings_schema_json_1.default;
const utils_1 = __importDefault(require("./utils"));
const yaml_1 = __importDefault(require("./yaml"));
// When updating also update:
// - https://github.com/Koenkk/zigbee2mqtt/blob/dev/data/configuration.example.yaml#L2
exports.CURRENT_VERSION = 5;
/** NOTE: by order of priority, lower index is lower level (more important) */
exports.LOG_LEVELS = ["error", "warning", "info", "debug"];
const CONFIG_FILE_PATH = data_1.default.joinPath("configuration.yaml");
const NULLABLE_SETTINGS = ["homeassistant"];
const ajvSetting = new ajv_1.default({ allErrors: true }).addKeyword("requiresRestart").compile(settings_schema_json_1.default);
const ajvRestartRequired = new ajv_1.default({ allErrors: true }).addKeyword({ keyword: "requiresRestart", validate: (s) => !s }).compile(settings_schema_json_1.default);
const ajvRestartRequiredDeviceOptions = new ajv_1.default({ allErrors: true })
    .addKeyword({ keyword: "requiresRestart", validate: (s) => !s })
    .compile(settings_schema_json_1.default.definitions.device);
const ajvRestartRequiredGroupOptions = new ajv_1.default({ allErrors: true })
    .addKeyword({ keyword: "requiresRestart", validate: (s) => !s })
    .compile(settings_schema_json_1.default.definitions.group);
exports.defaults = {
    homeassistant: {
        enabled: false,
        discovery_topic: "homeassistant",
        status_topic: "homeassistant/status",
        legacy_action_sensor: false,
        experimental_event_entities: false,
    },
    availability: {
        enabled: false,
        active: { timeout: 10, max_jitter: 30000, backoff: true, pause_on_backoff_gt: 0 },
        passive: { timeout: 1500 },
    },
    frontend: {
        enabled: false,
        package: "zigbee2mqtt-windfront",
        port: 8080,
        base_url: "/",
    },
    mqtt: {
        base_topic: "zigbee2mqtt",
        include_device_information: false,
        force_disable_retain: false,
        // 1MB = roughly 3.5KB per device * 300 devices for `/bridge/devices`
        maximum_packet_size: 1048576,
        keepalive: 60,
        reject_unauthorized: true,
        version: 4,
    },
    serial: {
        disable_led: false,
    },
    passlist: [],
    blocklist: [],
    map_options: {
        graphviz: {
            colors: {
                fill: {
                    enddevice: "#fff8ce",
                    coordinator: "#e04e5d",
                    router: "#4ea3e0",
                },
                font: {
                    coordinator: "#ffffff",
                    router: "#ffffff",
                    enddevice: "#000000",
                },
                line: {
                    active: "#009900",
                    inactive: "#994444",
                },
            },
        },
    },
    ota: {
        update_check_interval: 24 * 60,
        disable_automatic_update_check: false,
        image_block_request_timeout: 150000,
        image_block_response_delay: 250,
        default_maximum_data_size: 50,
    },
    device_options: {},
    advanced: {
        log_rotation: true,
        log_console_json: false,
        log_symlink_current: false,
        log_output: ["console", "file"],
        log_directory: node_path_1.default.join(data_1.default.getPath(), "log", "%TIMESTAMP%"),
        log_file: "log.log",
        log_level: /* v8 ignore next */ process.env.DEBUG ? "debug" : "info",
        log_namespaced_levels: {},
        log_syslog: {},
        log_debug_to_mqtt_frontend: false,
        log_debug_namespace_ignore: "",
        log_directories_to_keep: 10,
        pan_id: 0x1a62,
        ext_pan_id: [0xdd, 0xdd, 0xdd, 0xdd, 0xdd, 0xdd, 0xdd, 0xdd],
        channel: 11,
        adapter_concurrent: undefined,
        adapter_delay: undefined,
        cache_state: true,
        cache_state_persistent: true,
        cache_state_send_on_startup: true,
        last_seen: "disable",
        elapsed: false,
        network_key: [1, 3, 5, 7, 9, 11, 13, 15, 0, 2, 4, 6, 8, 10, 12, 13],
        timestamp_format: "YYYY-MM-DD HH:mm:ss",
        output: "json",
    },
    health: {
        interval: 10,
        reset_on_check: false,
    },
};
let _settings;
let _settingsWithDefaults;
function loadSettingsWithDefaults() {
    if (!_settings) {
        _settings = read();
    }
    _settingsWithDefaults = (0, object_assign_deep_1.default)({}, exports.defaults, getPersistedSettings());
    if (!_settingsWithDefaults.devices) {
        _settingsWithDefaults.devices = {};
    }
    if (!_settingsWithDefaults.groups) {
        _settingsWithDefaults.groups = {};
    }
}
function parseValueRef(text) {
    const match = /!(.*) (.*)/g.exec(text);
    if (match) {
        let filename = match[1];
        // This is mainly for backward compatibility.
        if (!filename.endsWith(".yaml") && !filename.endsWith(".yml")) {
            filename += ".yaml";
        }
        return { filename, key: match[2] };
    }
    return null;
}
function writeMinimalDefaults() {
    const minimal = {
        version: exports.CURRENT_VERSION,
        mqtt: {
            base_topic: exports.defaults.mqtt.base_topic,
            server: "mqtt://localhost:1883",
        },
        serial: {},
        advanced: {
            log_level: exports.defaults.advanced.log_level,
            channel: exports.defaults.advanced.channel,
            network_key: "GENERATE",
            pan_id: "GENERATE",
            ext_pan_id: "GENERATE",
        },
        frontend: {
            enabled: exports.defaults.frontend.enabled,
            port: exports.defaults.frontend.port,
        },
        homeassistant: {
            enabled: exports.defaults.homeassistant.enabled,
        },
    };
    applyEnvironmentVariables(minimal);
    yaml_1.default.writeIfChanged(CONFIG_FILE_PATH, minimal);
    _settings = read();
    loadSettingsWithDefaults();
}
function setOnboarding(value) {
    const settings = getPersistedSettings();
    if (value) {
        if (!settings.onboarding) {
            settings.onboarding = value;
            write();
        }
    }
    else if (settings.onboarding) {
        delete settings.onboarding;
        write();
    }
}
function write() {
    const settings = getPersistedSettings();
    const toWrite = (0, object_assign_deep_1.default)({}, settings);
    // Read settings to check if we have to split devices/groups into separate file.
    const actual = yaml_1.default.read(CONFIG_FILE_PATH);
    // In case the setting is defined in a separate file (e.g. !secret network_key) update it there.
    for (const [ns, key] of [
        ["mqtt", "server"],
        ["mqtt", "user"],
        ["mqtt", "password"],
        ["advanced", "network_key"],
        ["frontend", "auth_token"],
    ]) {
        if (actual[ns]?.[key]) {
            const ref = parseValueRef(actual[ns][key]);
            if (ref) {
                yaml_1.default.updateIfChanged(data_1.default.joinPath(ref.filename), ref.key, toWrite[ns][key]);
                toWrite[ns][key] = actual[ns][key];
            }
        }
    }
    // Write devices/groups to separate file if required.
    const writeDevicesOrGroups = (type) => {
        if (typeof actual[type] === "string" || (Array.isArray(actual[type]) && actual[type].length > 0)) {
            const fileToWrite = Array.isArray(actual[type]) ? actual[type][0] : actual[type];
            const content = (0, object_assign_deep_1.default)({}, settings[type]);
            // If an array, only write to first file and only devices which are not in the other files.
            if (Array.isArray(actual[type])) {
                // skip i==0
                for (let i = 1; i < actual[type].length; i++) {
                    for (const key in yaml_1.default.readIfExists(data_1.default.joinPath(actual[type][i]))) {
                        delete content[key];
                    }
                }
            }
            yaml_1.default.writeIfChanged(data_1.default.joinPath(fileToWrite), content);
            toWrite[type] = actual[type];
        }
    };
    writeDevicesOrGroups("devices");
    writeDevicesOrGroups("groups");
    applyEnvironmentVariables(toWrite);
    yaml_1.default.writeIfChanged(CONFIG_FILE_PATH, toWrite);
    _settings = read();
    loadSettingsWithDefaults();
}
function validate() {
    getPersistedSettings();
    if (!ajvSetting(_settings)) {
        // biome-ignore lint/style/noNonNullAssertion: When `ajvSetting()` return false it always has `errors`
        return ajvSetting.errors.map((v) => `${v.instancePath.substring(1)} ${v.message}`);
    }
    const errors = [];
    if (_settings.advanced?.network_key && typeof _settings.advanced.network_key === "string" && _settings.advanced.network_key !== "GENERATE") {
        errors.push(`advanced.network_key: should be array or 'GENERATE' (is '${_settings.advanced.network_key}')`);
    }
    if (_settings.advanced?.pan_id && typeof _settings.advanced.pan_id === "string" && _settings.advanced.pan_id !== "GENERATE") {
        errors.push(`advanced.pan_id: should be number or 'GENERATE' (is '${_settings.advanced.pan_id}')`);
    }
    if (_settings.advanced?.ext_pan_id && typeof _settings.advanced.ext_pan_id === "string" && _settings.advanced.ext_pan_id !== "GENERATE") {
        errors.push(`advanced.ext_pan_id: should be array or 'GENERATE' (is '${_settings.advanced.ext_pan_id}')`);
    }
    // Verify that all friendly names are unique
    const names = [];
    const check = (e) => {
        if (names.includes(e.friendly_name))
            errors.push(`Duplicate friendly_name '${e.friendly_name}' found`);
        errors.push(...utils_1.default.validateFriendlyName(e.friendly_name));
        names.push(e.friendly_name);
        if ("icon" in e && e.icon && !e.icon.startsWith("http://") && !e.icon.startsWith("https://") && !e.icon.startsWith("device_icons/")) {
            errors.push(`Device icon of '${e.friendly_name}' should start with 'device_icons/', got '${e.icon}'`);
        }
    };
    const settingsWithDefaults = get();
    for (const key in settingsWithDefaults.devices) {
        check(settingsWithDefaults.devices[key]);
    }
    for (const key in settingsWithDefaults.groups) {
        check(settingsWithDefaults.groups[key]);
    }
    if (settingsWithDefaults.mqtt.version !== 5) {
        for (const device of Object.values(settingsWithDefaults.devices)) {
            if (device.retention) {
                errors.push("MQTT retention requires protocol version 5");
            }
        }
    }
    return errors;
}
function validateNonRequired() {
    getPersistedSettings();
    if (!ajvSetting(_settings)) {
        // biome-ignore lint/style/noNonNullAssertion: When `ajvSetting()` return false it always has `errors`
        const errors = ajvSetting.errors.filter((e) => e.keyword !== "required");
        return errors.map((v) => `${v.instancePath.substring(1)} ${v.message}`);
    }
    return [];
}
function read() {
    const s = yaml_1.default.read(CONFIG_FILE_PATH);
    // Read !secret MQTT username and password if set
    const interpretValue = (value) => {
        if (typeof value === "string") {
            const ref = parseValueRef(value);
            if (ref) {
                return yaml_1.default.read(data_1.default.joinPath(ref.filename))[ref.key];
            }
        }
        return value;
    };
    if (s.mqtt?.user) {
        s.mqtt.user = interpretValue(s.mqtt.user);
    }
    if (s.mqtt?.password) {
        s.mqtt.password = interpretValue(s.mqtt.password);
    }
    if (s.mqtt?.server) {
        s.mqtt.server = interpretValue(s.mqtt.server);
    }
    if (s.advanced?.network_key) {
        s.advanced.network_key = interpretValue(s.advanced.network_key);
    }
    if (s.frontend?.auth_token) {
        s.frontend.auth_token = interpretValue(s.frontend.auth_token);
    }
    // Read devices/groups configuration from separate file if specified.
    const readDevicesOrGroups = (type) => {
        if (typeof s[type] === "string" || (Array.isArray(s[type]) && Array(s[type]).length > 0)) {
            const files = Array.isArray(s[type]) ? s[type] : [s[type]];
            s[type] = {};
            for (const file of files) {
                const content = yaml_1.default.readIfExists(data_1.default.joinPath(file));
                // @ts-expect-error noMutate not typed properly
                s[type] = object_assign_deep_1.default.noMutate(s[type], content);
            }
        }
    };
    readDevicesOrGroups("devices");
    readDevicesOrGroups("groups");
    return s;
}
function applyEnvironmentVariables(settings) {
    const iterate = (obj, path) => {
        for (const key in obj) {
            if (key !== "type") {
                if (key !== "properties" && obj[key]) {
                    const type = (obj[key].type || "object").toString();
                    const envPart = path.reduce((acc, val) => `${acc}${val}_`, "");
                    const envVariableName = `ZIGBEE2MQTT_CONFIG_${envPart}${key}`.toUpperCase();
                    const envVariable = process.env[envVariableName];
                    if (envVariable) {
                        const setting = path.reduce((acc, val) => {
                            // @ts-expect-error ignore typing
                            acc[val] = acc[val] || {};
                            // @ts-expect-error ignore typing
                            return acc[val];
                        }, settings);
                        if (type.indexOf("object") >= 0 || type.indexOf("array") >= 0) {
                            try {
                                setting[key] = JSON.parse(envVariable);
                            }
                            catch {
                                // biome-ignore lint/suspicious/noExplicitAny: auto-parsing
                                setting[key] = envVariable;
                            }
                        }
                        else if (type.indexOf("number") >= 0) {
                            // biome-ignore lint/suspicious/noExplicitAny: auto-parsing
                            setting[key] = (envVariable * 1);
                        }
                        else if (type.indexOf("boolean") >= 0) {
                            // biome-ignore lint/suspicious/noExplicitAny: auto-parsing
                            setting[key] = (envVariable.toLowerCase() === "true");
                        }
                        else {
                            if (type.indexOf("string") >= 0) {
                                // biome-ignore lint/suspicious/noExplicitAny: auto-parsing
                                setting[key] = envVariable;
                            }
                        }
                    }
                }
                if (typeof obj[key] === "object" && obj[key]) {
                    const newPath = [...path];
                    if (key !== "properties" && key !== "oneOf" && !Number.isInteger(Number(key))) {
                        newPath.push(key);
                    }
                    iterate(obj[key], newPath);
                }
            }
        }
    };
    iterate(settings_schema_json_1.default.properties, []);
}
/**
 * Get the settings actually written in the yaml.
 * Env vars are applied on top.
 * Defaults merged on startup are not included.
 */
function getPersistedSettings() {
    if (!_settings) {
        _settings = read();
    }
    return _settings;
}
function get() {
    if (!_settingsWithDefaults) {
        loadSettingsWithDefaults();
    }
    // biome-ignore lint/style/noNonNullAssertion: just loaded
    return _settingsWithDefaults;
}
function set(path, value) {
    // biome-ignore lint/suspicious/noExplicitAny: auto-parsing
    let settings = getPersistedSettings();
    for (let i = 0; i < path.length; i++) {
        const key = path[i];
        if (i === path.length - 1) {
            settings[key] = value;
        }
        else {
            if (!settings[key]) {
                settings[key] = {};
            }
            settings = settings[key];
        }
    }
    write();
}
function apply(settings, throwOnError = true) {
    getPersistedSettings(); // Ensure _settings is initialized.
    // @ts-expect-error noMutate not typed properly
    const newSettings = object_assign_deep_1.default.noMutate(_settings, settings);
    utils_1.default.removeNullPropertiesFromObject(newSettings, NULLABLE_SETTINGS);
    if (!ajvSetting(newSettings) && throwOnError) {
        // biome-ignore lint/style/noNonNullAssertion: When `ajvSetting()` return false it always has `errors`
        const errors = ajvSetting.errors.filter((e) => e.keyword !== "required");
        if (errors.length) {
            const error = errors[0];
            throw new Error(`${error.instancePath.substring(1)} ${error.message}`);
        }
    }
    _settings = newSettings;
    write();
    ajvRestartRequired(settings);
    const restartRequired = Boolean(ajvRestartRequired.errors && !!ajvRestartRequired.errors.find((e) => e.keyword === "requiresRestart"));
    return restartRequired;
}
function getGroup(IDorName) {
    const settings = get();
    const byID = settings.groups[IDorName];
    if (byID) {
        return { ...byID, ID: Number(IDorName) };
    }
    for (const [ID, group] of Object.entries(settings.groups)) {
        if (group.friendly_name === IDorName) {
            return { ...group, ID: Number(ID) };
        }
    }
    return undefined;
}
function getGroupThrowIfNotExists(IDorName) {
    const group = getGroup(IDorName);
    if (!group) {
        throw new Error(`Group '${IDorName}' does not exist`);
    }
    return group;
}
function getDevice(IDorName) {
    const settings = get();
    const byID = settings.devices[IDorName];
    if (byID) {
        return { ...byID, ID: IDorName };
    }
    for (const [ID, device] of Object.entries(settings.devices)) {
        if (device.friendly_name === IDorName) {
            return { ...device, ID };
        }
    }
    return undefined;
}
function getDeviceThrowIfNotExists(IDorName) {
    const device = getDevice(IDorName);
    if (!device) {
        throw new Error(`Device '${IDorName}' does not exist`);
    }
    return device;
}
function addDevice(id) {
    if (getDevice(id)) {
        throw new Error(`Device '${id}' already exists`);
    }
    const settings = getPersistedSettings();
    if (!settings.devices) {
        settings.devices = {};
    }
    settings.devices[id] = { friendly_name: id };
    write();
    // biome-ignore lint/style/noNonNullAssertion: valid from creation above
    return getDevice(id);
}
function blockDevice(id) {
    const settings = getPersistedSettings();
    if (!settings.blocklist) {
        settings.blocklist = [];
    }
    settings.blocklist.push(id);
    write();
}
function removeDevice(IDorName) {
    const device = getDeviceThrowIfNotExists(IDorName);
    const settings = getPersistedSettings();
    delete settings.devices?.[device.ID];
    write();
}
function addGroup(name, id) {
    utils_1.default.validateFriendlyName(name, true);
    if (getGroup(name) || getDevice(name)) {
        throw new Error(`friendly_name '${name}' is already in use`);
    }
    const settings = getPersistedSettings();
    if (!settings.groups) {
        settings.groups = {};
    }
    if (id == null || (typeof id === "string" && id.trim() === "")) {
        // look for free ID
        id = "1";
        while (settings.groups[id]) {
            id = (Number.parseInt(id, 10) + 1).toString();
        }
    }
    else {
        // ensure provided ID is not in use
        id = id.toString();
        if (settings.groups[id]) {
            throw new Error(`Group ID '${id}' is already in use`);
        }
    }
    settings.groups[id] = { friendly_name: name };
    write();
    // biome-ignore lint/style/noNonNullAssertion: valid from creation above
    return getGroup(id);
}
function removeGroup(IDorName) {
    const groupID = getGroupThrowIfNotExists(IDorName.toString()).ID;
    const settings = getPersistedSettings();
    // biome-ignore lint/style/noNonNullAssertion: throwing above if not valid
    delete settings.groups[groupID];
    write();
}
function changeEntityOptions(IDorName, newOptions) {
    const settings = getPersistedSettings();
    delete newOptions.friendly_name;
    delete newOptions.devices;
    let validator;
    const device = getDevice(IDorName);
    if (device) {
        // biome-ignore lint/style/noNonNullAssertion: valid from above
        const settingsDevice = settings.devices[device.ID];
        (0, object_assign_deep_1.default)(settingsDevice, newOptions);
        utils_1.default.removeNullPropertiesFromObject(settingsDevice, NULLABLE_SETTINGS);
        validator = ajvRestartRequiredDeviceOptions;
    }
    else {
        const group = getGroup(IDorName);
        if (group) {
            // biome-ignore lint/style/noNonNullAssertion: valid from above
            const settingsGroup = settings.groups[group.ID];
            (0, object_assign_deep_1.default)(settingsGroup, newOptions);
            utils_1.default.removeNullPropertiesFromObject(settingsGroup, NULLABLE_SETTINGS);
            validator = ajvRestartRequiredGroupOptions;
        }
        else {
            throw new Error(`Device or group '${IDorName}' does not exist`);
        }
    }
    write();
    validator(newOptions);
    const restartRequired = Boolean(validator.errors && !!validator.errors.find((e) => e.keyword === "requiresRestart"));
    return restartRequired;
}
function changeFriendlyName(IDorName, newName) {
    utils_1.default.validateFriendlyName(newName, true);
    if (getGroup(newName) || getDevice(newName)) {
        throw new Error(`friendly_name '${newName}' is already in use`);
    }
    const settings = getPersistedSettings();
    const device = getDevice(IDorName);
    if (device) {
        // biome-ignore lint/style/noNonNullAssertion: valid from above
        settings.devices[device.ID].friendly_name = newName;
    }
    else {
        const group = getGroup(IDorName);
        if (group) {
            // biome-ignore lint/style/noNonNullAssertion: valid from above
            settings.groups[group.ID].friendly_name = newName;
        }
        else {
            throw new Error(`Device or group '${IDorName}' does not exist`);
        }
    }
    write();
}
function reRead() {
    _settings = undefined;
    getPersistedSettings();
    _settingsWithDefaults = undefined;
    get();
}
exports.testing = {
    write,
    clear: () => {
        _settings = undefined;
        _settingsWithDefaults = undefined;
    },
    defaults: exports.defaults,
    CURRENT_VERSION: exports.CURRENT_VERSION,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dGluZ3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdXRpbC9zZXR0aW5ncy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUEySkEsb0RBOEJDO0FBRUQsc0NBY0M7QUFFRCxzQkF1REM7QUFFRCw0QkFvREM7QUFFRCxrREFXQztBQW9IRCxvREFNQztBQUVELGtCQU9DO0FBRUQsa0JBa0JDO0FBRUQsc0JBeUJDO0FBRUQsNEJBZUM7QUFZRCw4QkFlQztBQVdELDhCQWdCQztBQUVELGtDQVFDO0FBRUQsb0NBS0M7QUFFRCw0QkFpQ0M7QUFFRCxrQ0FPQztBQUVELGtEQWlDQztBQUVELGdEQXdCQztBQUVELHdCQUtDO0FBL3JCRCwwREFBNkI7QUFFN0IsOENBQXNCO0FBQ3RCLDRFQUFrRDtBQUNsRCxrREFBMEI7QUFDMUIsa0ZBQWdEO0FBSXhDLHFCQUpELDhCQUFVLENBSUM7QUFIbEIsb0RBQTRCO0FBQzVCLGtEQUEwQjtBQUcxQiw2QkFBNkI7QUFDN0Isc0ZBQXNGO0FBQ3pFLFFBQUEsZUFBZSxHQUFHLENBQUMsQ0FBQztBQUNqQyw4RUFBOEU7QUFDakUsUUFBQSxVQUFVLEdBQXNCLENBQUMsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFVLENBQUM7QUFHNUYsTUFBTSxnQkFBZ0IsR0FBRyxjQUFJLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLENBQUM7QUFDN0QsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQzVDLE1BQU0sVUFBVSxHQUFHLElBQUksYUFBRyxDQUFDLEVBQUMsU0FBUyxFQUFFLElBQUksRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLGlCQUFpQixDQUFDLENBQUMsT0FBTyxDQUFDLDhCQUFVLENBQUMsQ0FBQztBQUNoRyxNQUFNLGtCQUFrQixHQUFHLElBQUksYUFBRyxDQUFDLEVBQUMsU0FBUyxFQUFFLElBQUksRUFBQyxDQUFDLENBQUMsVUFB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