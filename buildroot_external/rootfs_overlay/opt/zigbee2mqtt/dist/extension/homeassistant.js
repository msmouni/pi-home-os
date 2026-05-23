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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
exports.HomeAssistant = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const logger_1 = __importDefault(require("../util/logger"));
const settings = __importStar(require("../util/settings"));
const utils_1 = __importStar(require("../util/utils"));
const extension_1 = __importDefault(require("./extension"));
const ACTION_PATTERNS = [
    "^(?<button>(?:button_)?[a-z0-9]+)_(?<action>(?:press|hold)(?:_release)?)$",
    "^(?<action>recall|scene)_(?<scene>[0-2][0-9]{0,2})$",
    "^(?<actionPrefix>region_)(?<region>[1-9]|10)_(?<action>enter|leave|occupied|unoccupied)$",
    "^(?<action>dial_rotate)_(?<direction>left|right)_(?<speed>step|slow|fast)$",
    "^(?<action>brightness_step)(?:_(?<direction>up|down))?$",
];
const ACCESS_STATE = 0b001;
const ACCESS_SET = 0b010;
const GROUP_SUPPORTED_TYPES = ["light", "switch", "lock", "cover"];
const COVER_OPENING_LOOKUP = ["opening", "open", "forward", "up", "rising"];
const COVER_CLOSING_LOOKUP = ["closing", "close", "backward", "back", "reverse", "down", "declining"];
const COVER_STOPPED_LOOKUP = ["stopped", "stop", "pause", "paused"];
const SWITCH_DIFFERENT = ["valve_detection", "window_detection", "auto_lock", "away_mode"];
const BINARY_DISCOVERY_LOOKUP = {
    activity_led_indicator: { icon: "mdi:led-on" },
    area1Occupancy: { device_class: "occupancy" },
    area2Occupancy: { device_class: "occupancy" },
    area3Occupancy: { device_class: "occupancy" },
    area4Occupancy: { device_class: "occupancy" },
    auto_off: { icon: "mdi:flash-auto" },
    battery_low: { entity_category: "diagnostic", device_class: "battery" },
    button_lock: { entity_category: "config", icon: "mdi:lock" },
    calibration: { entity_category: "config", icon: "mdi:progress-wrench" },
    capabilities_configurable_curve: { entity_category: "diagnostic", icon: "mdi:tune" },
    capabilities_forward_phase_control: { entity_category: "diagnostic", icon: "mdi:tune" },
    capabilities_overload_detection: { entity_category: "diagnostic", icon: "mdi:tune" },
    capabilities_reactance_discriminator: { entity_category: "diagnostic", icon: "mdi:tune" },
    capabilities_reverse_phase_control: { entity_category: "diagnostic", icon: "mdi:tune" },
    carbon_monoxide: { device_class: "carbon_monoxide" },
    card: { entity_category: "config", icon: "mdi:clipboard-check" },
    child_lock: { entity_category: "config", icon: "mdi:account-lock" },
    color_sync: { entity_category: "config", icon: "mdi:sync-circle" },
    consumer_connected: { device_class: "plug" },
    contact: { device_class: "door" },
    garage_door_contact: { device_class: "garage_door", payload_on: false, payload_off: true },
    eco_mode: { entity_category: "config", icon: "mdi:leaf" },
    expose_pin: { entity_category: "config", icon: "mdi:pin" },
    flip_indicator_light: { entity_category: "config", icon: "mdi:arrow-left-right" },
    gas: { device_class: "gas" },
    indicator_mode: { entity_category: "config", icon: "mdi:led-on" },
    invert_cover: { entity_category: "config", icon: "mdi:arrow-left-right" },
    led_disabled_night: { entity_category: "config", icon: "mdi:led-off" },
    led_indication: { entity_category: "config", icon: "mdi:led-on" },
    led_enable: { entity_category: "config", icon: "mdi:led-on" },
    motor_reversal: { entity_category: "config", icon: "mdi:arrow-left-right" },
    moving: { device_class: "moving" },
    no_position_support: { entity_category: "config", icon: "mdi:minus-circle-outline" },
    noise_detected: { device_class: "sound" },
    occupancy: { device_class: "occupancy" },
    power_outage_memory: { entity_category: "config", icon: "mdi:memory" },
    presence: { device_class: "occupancy" },
    rain_status: { device_class: "moisture", icon: "mdi:weather-pouring" },
    setup: { device_class: "running" },
    smoke: { device_class: "smoke" },
    sos: { device_class: "safety" },
    schedule: { icon: "mdi:calendar" },
    status_capacitive_load: { entity_category: "diagnostic", icon: "mdi:tune" },
    status_forward_phase_control: { entity_category: "diagnostic", icon: "mdi:tune" },
    status_inductive_load: { entity_category: "diagnostic", icon: "mdi:tune" },
    status_overload: { entity_category: "diagnostic", icon: "mdi:tune" },
    status_reverse_phase_control: { entity_category: "diagnostic", icon: "mdi:tune" },
    tamper: { device_class: "tamper" },
    temperature_scale: { entity_category: "config", icon: "mdi:temperature-celsius" },
    test: { entity_category: "diagnostic", icon: "mdi:test-tube" },
    th_heater: { icon: "mdi:heat-wave" },
    trigger_indicator: { icon: "mdi:led-on" },
    valve_alarm: { device_class: "problem" },
    valve_detection: { icon: "mdi:pipe-valve" },
    valve_state: { device_class: "opening" },
    vibration: { device_class: "vibration" },
    water_leak: { device_class: "moisture" },
    window: { device_class: "window" },
    window_detection: { icon: "mdi:window-open-variant" },
    window_open: { device_class: "window" },
};
const NUMERIC_DISCOVERY_LOOKUP = {
    ac_frequency: { device_class: "frequency", state_class: "measurement" },
    action_duration: { icon: "mdi:timer", device_class: "duration" },
    alarm_humidity_max: { device_class: "humidity", entity_category: "config", icon: "mdi:water-plus" },
    alarm_humidity_min: { device_class: "humidity", entity_category: "config", icon: "mdi:water-minus" },
    alarm_temperature_max: { device_class: "temperature", entity_category: "config", icon: "mdi:thermometer-high" },
    alarm_temperature_min: { device_class: "temperature", entity_category: "config", icon: "mdi:thermometer-low" },
    angle: { icon: "angle-acute" },
    angle_axis: { icon: "angle-acute" },
    apparent_temperature: { icon: "mdi:thermometer-lines", state_class: "measurement" },
    aqi: { device_class: "aqi", state_class: "measurement" },
    auto_relock_time: { entity_category: "config", icon: "mdi:timer" },
    away_preset_days: { entity_category: "config", icon: "mdi:timer" },
    away_preset_temperature: { entity_category: "config", icon: "mdi:thermometer" },
    ballast_maximum_level: { entity_category: "config" },
    ballast_minimum_level: { entity_category: "config" },
    ballast_physical_maximum_level: { entity_category: "diagnostic" },
    ballast_physical_minimum_level: { entity_category: "diagnostic" },
    battery: { device_class: "battery", state_class: "measurement" },
    battery2: { device_class: "battery", entity_category: "diagnostic", state_class: "measurement" },
    battery_voltage: { device_class: "voltage", entity_category: "diagnostic", state_class: "measurement", enabled_by_default: true },
    boost_heating_countdown: { device_class: "duration" },
    boost_heating_countdown_time_set: { entity_category: "config", icon: "mdi:timer" },
    boost_time: { entity_category: "config", icon: "mdi:timer" },
    calibration: { entity_category: "config", icon: "mdi:wrench-clock" },
    calibration_time: { entity_category: "config", icon: "mdi:wrench-clock" },
    co2: { device_class: "carbon_dioxide", state_class: "measurement" },
    comfort_temperature: { entity_category: "config", icon: "mdi:thermometer" },
    cpu_temperature: {
        device_class: "temperature",
        entity_category: "diagnostic",
        state_class: "measurement",
    },
    cube_side: { icon: "mdi:cube" },
    current: { device_class: "current", state_class: "measurement" },
    current_phase_b: { device_class: "current", state_class: "measurement" },
    current_phase_c: { device_class: "current", state_class: "measurement" },
    deadzone_temperature: { entity_category: "config", icon: "mdi:thermometer" },
    detection_interval: { icon: "mdi:timer" },
    device_temperature: {
        device_class: "temperature",
        entity_category: "diagnostic",
        state_class: "measurement",
    },
    dew_point: { icon: "mdi:thermometer-water", state_class: "measurement" },
    distance: { device_class: "distance", state_class: "measurement" },
    duration: { entity_category: "config", icon: "mdi:timer" },
    eco2: { device_class: "volatile_organic_compounds_parts", state_class: "measurement" },
    eco_temperature: { entity_category: "config", icon: "mdi:thermometer" },
    energy: { device_class: "energy", state_class: "total_increasing" },
    external_temperature_input: { device_class: "temperature", icon: "mdi:thermometer" },
    external_temperature: { device_class: "temperature", icon: "mdi:thermometer", state_class: "measurement" },
    external_humidity: { device_class: "humidity", icon: "mdi:water-percent", state_class: "measurement" },
    formaldehyd: { state_class: "measurement" },
    flow: { device_class: "volume_flow_rate", state_class: "measurement" },
    gas: { device_class: "gas", state_class: "total_increasing", icon: "mdi:meter-gas" },
    gas_density: { icon: "mdi:google-circles-communities", state_class: "measurement" },
    gust_speed: { icon: "mdi:weather-windy-variant", state_class: "measurement" },
    hcho: { icon: "mdi:air-filter", state_class: "measurement" },
    heat_stress: { icon: "mdi:weather-sunny-alert", state_class: "measurement" },
    humidex: { icon: "mdi:thermometer-alert", state_class: "measurement" },
    humidity: { device_class: "humidity", state_class: "measurement" },
    humidity_calibration: { entity_category: "config", icon: "mdi:wrench-clock" },
    humidity_max: { entity_category: "config", icon: "mdi:water-percent" },
    humidity_min: { entity_category: "config", icon: "mdi:water-percent" },
    illuminance_calibration: { entity_category: "config", icon: "mdi:wrench-clock" },
    illuminance: { device_class: "illuminance", state_class: "measurement" },
    illuminance_raw: { state_class: "measurement" },
    internalTemperature: {
        device_class: "temperature",
        entity_category: "diagnostic",
        state_class: "measurement",
    },
    linkquality: {
        enabled_by_default: false,
        entity_category: "diagnostic",
        icon: "mdi:signal",
        state_class: "measurement",
    },
    load_estimate: { state_class: "measurement" },
    local_temperature: { device_class: "temperature", state_class: "measurement" },
    max_range: { entity_category: "config", icon: "mdi:signal-distance-variant" },
    max_temperature: { entity_category: "config", icon: "mdi:thermometer-high" },
    max_temperature_limit: { entity_category: "config", icon: "mdi:thermometer-high" },
    min_temperature_limit: { entity_category: "config", icon: "mdi:thermometer-low" },
    min_temperature: { entity_category: "config", icon: "mdi:thermometer-low" },
    minimum_on_level: { entity_category: "config" },
    measurement_poll_interval: { entity_category: "config", icon: "mdi:clock-out" },
    motion_sensitivity: { entity_category: "config", icon: "mdi:motion-sensor" },
    noise: { device_class: "sound_pressure", state_class: "measurement" },
    noise_detect_level: { icon: "mdi:volume-equal" },
    noise_timeout: { icon: "mdi:timer" },
    occupancy_level: { icon: "mdi:motion-sensor", state_class: "measurement" },
    occupancy_sensitivity: { entity_category: "config", icon: "mdi:motion-sensor" },
    occupancy_timeout: { entity_category: "config", icon: "mdi:timer" },
    overload_protection: { icon: "mdi:flash" },
    pm10: { device_class: "pm10", state_class: "measurement" },
    pm25: { device_class: "pm25", state_class: "measurement" },
    people: { state_class: "measurement", icon: "mdi:account-multiple" },
    position: { icon: "mdi:valve", state_class: "measurement" },
    power: { device_class: "power", state_class: "measurement" },
    power_phase_b: { device_class: "power", state_class: "measurement" },
    power_phase_c: { device_class: "power", state_class: "measurement" },
    power_factor: { device_class: "power_factor", enabled_by_default: false, entity_category: "diagnostic", state_class: "measurement" },
    power_outage_count: { icon: "mdi:counter", enabled_by_default: false, state_class: "measurement" },
    precipitation: { device_class: "precipitation", icon: "mdi:weather-rainy", state_class: "total_increasing" },
    precision: { entity_category: "config", icon: "mdi:decimal-comma-increase" },
    pressure: { device_class: "atmospheric_pressure", state_class: "measurement" },
    pressure_trend: { icon: "mdi:trending-up", state_class: "measurement" },
    presence_timeout: { entity_category: "config", icon: "mdi:timer" },
    rain_rate: { device_class: "precipitation_intensity", icon: "mdi:weather-pouring", state_class: "measurement" },
    reporting_time: { entity_category: "config", icon: "mdi:clock-time-one-outline" },
    requested_brightness_level: {
        enabled_by_default: false,
        entity_category: "diagnostic",
        icon: "mdi:brightness-5",
    },
    requested_brightness_percent: {
        enabled_by_default: false,
        entity_category: "diagnostic",
        icon: "mdi:brightness-5",
    },
    smoke_density: { icon: "mdi:google-circles-communities", state_class: "measurement" },
    soil_moisture: { device_class: "moisture", state_class: "measurement" },
    temperature: { device_class: "temperature", state_class: "measurement" },
    temperature_probe: { device_class: "temperature", state_class: "measurement" },
    temperature_calibration: { entity_category: "config", icon: "mdi:wrench-clock" },
    temperature_max: { entity_category: "config", icon: "mdi:thermometer-plus" },
    temperature_min: { entity_category: "config", icon: "mdi:thermometer-minus" },
    temperature_offset: { icon: "mdi:thermometer-lines" },
    transition: { entity_category: "config", icon: "mdi:transition" },
    trigger_count: { icon: "mdi:counter", enabled_by_default: false, state_class: "measurement" },
    uv_index: { icon: "mdi:white-balance-sunny", state_class: "measurement" },
    voc: { device_class: "volatile_organic_compounds", state_class: "measurement" },
    voc_index: { state_class: "measurement", icon: "mdi:molecule" },
    voc_parts: { device_class: "volatile_organic_compounds_parts", state_class: "measurement" },
    vibration_timeout: { entity_category: "config", icon: "mdi:timer" },
    voltage: { device_class: "voltage", state_class: "measurement" },
    voltage_phase_b: { device_class: "voltage", state_class: "measurement" },
    voltage_phase_c: { device_class: "voltage", state_class: "measurement" },
    water_consumed: {
        device_class: "water",
        state_class: "total_increasing",
    },
    wind_chill: { icon: "mdi:snowflake-thermometer", state_class: "measurement" },
    wind_direction: { icon: "mdi:compass-outline", state_class: "measurement" },
    wind_speed: { device_class: "wind_speed", icon: "mdi:weather-windy", state_class: "measurement" },
    x: { icon: "mdi:axis-x-arrow", state_class: "measurement" },
    x_axis: { icon: "mdi:axis-x-arrow", state_class: "measurement" },
    y: { icon: "mdi:axis-y-arrow", state_class: "measurement" },
    y_axis: { icon: "mdi:axis-y-arrow", state_class: "measurement" },
    z: { icon: "mdi:axis-z-arrow", state_class: "measurement" },
    z_axis: { icon: "mdi:axis-z-arrow", state_class: "measurement" },
};
const ENUM_DISCOVERY_LOOKUP = {
    action: { icon: "mdi:gesture-double-tap" },
    alarm_humidity: { entity_category: "config", icon: "mdi:water-percent-alert" },
    alarm_temperature: { entity_category: "config", icon: "mdi:thermometer-alert" },
    backlight_auto_dim: { entity_category: "config", icon: "mdi:brightness-auto" },
    backlight_mode: { entity_category: "config", icon: "mdi:lightbulb" },
    calibrate: { icon: "mdi:tune" },
    color_power_on_behavior: { entity_category: "config", icon: "mdi:palette" },
    control_mode: { entity_category: "config", icon: "mdi:tune" },
    device_mode: { entity_category: "config", icon: "mdi:tune" },
    effect: { enabled_by_default: false, icon: "mdi:palette" },
    force: { entity_category: "config", icon: "mdi:valve" },
    keep_time: { entity_category: "config", icon: "mdi:av-timer" },
    identify: { device_class: "identify" },
    keypad_lockout: { entity_category: "config", icon: "mdi:lock" },
    load_detection_mode: { entity_category: "config", icon: "mdi:tune" },
    load_dimmable: { entity_category: "config", icon: "mdi:chart-bell-curve" },
    load_type: { entity_category: "config", icon: "mdi:led-on" },
    melody: { entity_category: "config", icon: "mdi:music-note" },
    mode_phase_control: { entity_category: "config", icon: "mdi:tune" },
    mode: { entity_category: "config", icon: "mdi:tune" },
    mode_switch: { icon: "mdi:tune" },
    motion_sensitivity: { entity_category: "config", icon: "mdi:tune" },
    operation_mode: { entity_category: "config", icon: "mdi:tune" },
    power_on_behavior: { entity_category: "config", icon: "mdi:power-settings" },
    power_outage_memory: { entity_category: "config", icon: "mdi:power-settings" },
    power_supply_mode: { entity_category: "config", icon: "mdi:power-settings" },
    power_type: { entity_category: "config", icon: "mdi:lightning-bolt-circle" },
    restart: { device_class: "restart" },
    sensitivity: { entity_category: "config", icon: "mdi:tune" },
    sensor: { icon: "mdi:tune" },
    sensors_type: { entity_category: "config", icon: "mdi:tune" },
    sound_volume: { entity_category: "config", icon: "mdi:volume-high" },
    status: { icon: "mdi:state-machine" },
    switch_type: { entity_category: "config", icon: "mdi:tune" },
    temperature_display_mode: { entity_category: "config", icon: "mdi:thermometer" },
    temperature_sensor_select: { entity_category: "config", icon: "mdi:home-thermometer" },
    thermostat_unit: { entity_category: "config", icon: "mdi:thermometer" },
    update: { device_class: "update" },
    volume: { entity_category: "config", icon: "mdi: volume-high" },
    weather_condition: { icon: "mdi:weather-partly-cloudy" },
    week: { entity_category: "config", icon: "mdi:calendar-clock" },
};
const LIST_DISCOVERY_LOOKUP = {
    action: { icon: "mdi:gesture-double-tap" },
    color_options: { icon: "mdi:palette" },
    level_config: { entity_category: "diagnostic" },
    programming_mode: { icon: "mdi:calendar-clock" },
    schedule_settings: { icon: "mdi:calendar-clock" },
};
const featurePropertyWithoutEndpoint = (feature) => {
    if (feature.endpoint) {
        return feature.property.slice(0, -1 + -1 * feature.endpoint.length);
    }
    return feature.property;
};
/**
 * This class handles the bridge entity configuration for Home Assistant Discovery.
 */
class Bridge {
    coordinatorIeeeAddress;
    coordinatorType;
    coordinatorFirmwareVersion;
    discoveryEntries;
    options;
    // biome-ignore lint/style/useNamingConvention: API
    get ID() {
        return this.coordinatorIeeeAddress;
    }
    get name() {
        return "bridge";
    }
    get hardwareVersion() {
        return this.coordinatorType;
    }
    get firmwareVersion() {
        return this.coordinatorFirmwareVersion;
    }
    get configs() {
        return this.discoveryEntries;
    }
    constructor(ieeeAdress, version, discovery) {
        this.coordinatorIeeeAddress = ieeeAdress;
        this.coordinatorType = version.type;
        this.coordinatorFirmwareVersion = version.meta.revision ? `${version.meta.revision}` : /* v8 ignore next */ "";
        this.discoveryEntries = discovery;
        this.options = {
            ID: `bridge_${ieeeAdress}`,
            homeassistant: {
                name: "Zigbee2MQTT Bridge",
            },
        };
    }
    isDevice() {
        return false;
    }
    isGroup() {
        return false;
    }
}
/**
 * This extensions handles integration with HomeAssistant
 */
class HomeAssistant extends extension_1.default {
    discovered = {};
    discoveryTopic;
    discoveryRegex;
    discoveryRegexWoTopic = /(.*)\/(.*)\/(.*)\/config/;
    groupMemberLookup = new Map();
    statusTopic;
    legacyActionSensor;
    experimentalEventEntities;
    // @ts-expect-error initialized in `start`
    zigbee2MQTTVersion;
    // @ts-expect-error initialized in `start`
    discoveryOrigin;
    // @ts-expect-error initialized in `start`
    bridge;
    // @ts-expect-error initialized in `start`
    bridgeIdentifier;
    actionValueTemplate;
    constructor(zigbee, mqtt, state, publishEntityState, eventBus, enableDisableExtension, restartCallback, addExtension) {
        super(zigbee, mqtt, state, publishEntityState, eventBus, enableDisableExtension, restartCallback, addExtension);
        if (settings.get().advanced.output === "attribute") {
            throw new Error("Home Assistant integration is not possible with attribute output!");
        }
        const haSettings = settings.get().homeassistant;
        (0, node_assert_1.default)(haSettings.enabled, `Home Assistant extension created with setting 'enabled: false'`);
        this.discoveryTopic = haSettings.discovery_topic;
        this.discoveryRegex = new RegExp(`${haSettings.discovery_topic}/(.*)/(.*)/(.*)/config`);
        this.statusTopic = haSettings.status_topic;
        this.legacyActionSensor = haSettings.legacy_action_sensor;
        this.experimentalEventEntities = haSettings.experimental_event_entities;
        if (haSettings.discovery_topic === settings.get().mqtt.base_topic) {
            throw new Error(`'homeassistant.discovery_topic' cannot not be equal to the 'mqtt.base_topic' (got '${settings.get().mqtt.base_topic}')`);
        }
        this.actionValueTemplate = this.getActionValueTemplate();
    }
    async start() {
        if (!settings.get().advanced.cache_state) {
            logger_1.default.warning("In order for Home Assistant integration to work properly set `cache_state: true");
        }
        this.zigbee2MQTTVersion = (await utils_1.default.getZigbee2MQTTVersion(false)).version;
        this.discoveryOrigin = { name: "Zigbee2MQTT", sw: this.zigbee2MQTTVersion, url: "https://www.zigbee2mqtt.io" };
        this.bridge = this.getBridgeEntity(await this.zigbee.getCoordinatorVersion());
        this.bridgeIdentifier = this.getDevicePayload(this.bridge).identifiers[0];
        this.eventBus.onEntityRemoved(this, this.onEntityRemoved);
        this.eventBus.onMQTTMessage(this, this.onMQTTMessage);
        this.eventBus.onEntityRenamed(this, this.onEntityRenamed);
        this.eventBus.onPublishEntityState(this, this.onPublishEntityState);
        this.eventBus.onGroupMembersChanged(this, this.onGroupMembersChanged);
        this.eventBus.onDeviceAnnounce(this, this.onZigbeeEvent);
        this.eventBus.onDeviceJoined(this, this.onZigbeeEvent);
        // TODO: this is triggering for any `data.status`?
        this.eventBus.onDeviceInterview(this, this.onZigbeeEvent);
        this.eventBus.onDeviceMessage(this, this.onZigbeeEvent);
        this.eventBus.onScenesChanged(this, this.onScenesChanged);
        this.eventBus.onEntityOptionsChanged(this, async (data) => await this.discover(data.entity));
        this.eventBus.onExposesChanged(this, async (data) => await this.discover(data.device));
        await this.mqtt.subscribe(this.statusTopic);
        /**
         * Prevent unnecessary re-discovery of entities by waiting 5 seconds for retained discovery messages to come in.
         * Any received discovery messages will not be published again.
         * Unsubscribe from the discoveryTopic to prevent receiving our own messages.
         */
        const discoverWait = 5;
        // Discover with `published = false`, this will populate `this.discovered` without publishing the discoveries.
        // This is needed for clearing outdated entries in `this.onMQTTMessage()`
        // Discover devices before groups to populate `this.groupMemberLookup` for group discovery.
        await this.discover(this.bridge, false);
        for (const device of this.zigbee.devicesIterator(utils_1.default.deviceNotCoordinator)) {
            await this.discover(device, false);
        }
        for (const group of this.zigbee.groupsIterator()) {
            await this.discover(group, false);
        }
        logger_1.default.debug(`Discovering entities to Home Assistant in ${discoverWait}s`);
        await this.mqtt.subscribe(`${this.discoveryTopic}/#`);
        setTimeout(async () => {
            await this.mqtt.unsubscribe(`${this.discoveryTopic}/#`);
            logger_1.default.debug("Discovering entities to Home Assistant");
            await this.discover(this.bridge);
            for (const e of this.zigbee.devicesAndGroupsIterator(utils_1.default.deviceNotCoordinator)) {
                await this.discover(e);
            }
        }, utils_1.default.seconds(discoverWait));
    }
    getDiscovered(entity) {
        const ID = typeof entity === "string" || typeof entity === "number" ? entity : entity.ID;
        if (!(ID in this.discovered)) {
            this.discovered[ID] = { messages: {}, triggers: new Set(), mockProperties: new Set(), discovered: false };
        }
        return this.discovered[ID];
    }
    exposeToConfig(exposes, entity, allExposes) {
        // For groups an array of exposes (of the same type) is passed, this is to determine e.g. what features
        // to use for a bulb (e.g. color_xy/color_temp)
        (0, node_assert_1.default)(entity.isGroup() || exposes.length === 1, "Multiple exposes for device not allowed");
        const firstExpose = exposes[0];
        (0, node_assert_1.default)(entity.isDevice() || GROUP_SUPPORTED_TYPES.includes(firstExpose.type), `Unsupported expose type ${firstExpose.type} for group`);
        const discoveryEntries = [];
        const endpointName = entity.isDevice() ? exposes[0].endpoint : undefined;
        const getProperty = (feature) => (entity.isGroup() ? featurePropertyWithoutEndpoint(feature) : feature.property);
        switch (firstExpose.type) {
            case "light": {
                const hasColorXY = exposes.find((expose) => expose.features.find((e) => e.name === "color_xy"));
                const hasColorHS = exposes.find((expose) => expose.features.find((e) => e.name === "color_hs"));
                const hasBrightness = exposes.find((expose) => expose.features.find((e) => e.name === "brightness"));
                const hasColorTemp = exposes.find((expose) => expose.features.find((e) => e.name === "color_temp"));
                const state = firstExpose.features.find((f) => f.name === "state");
                (0, node_assert_1.default)(state, `Light expose must have a 'state'`);
                // Prefer HS over XY when at least one of the lights in the group prefers HS over XY.
                // A light prefers HS over XY when HS is earlier in the feature array than HS.
                const preferHS = exposes
                    .map((e) => [e.features.findIndex((ee) => ee.name === "color_xy"), e.features.findIndex((ee) => ee.name === "color_hs")])
                    .filter((d) => d[0] !== -1 && d[1] !== -1 && d[1] < d[0]).length !== 0;
                const discoveryEntry = {
                    type: "light",
                    object_id: endpointName ? `light_${endpointName}` : "light",
                    mockProperties: [{ property: state.property, value: null }],
                    discovery_payload: {
                        name: endpointName ? utils_1.default.capitalize(endpointName) : null,
                        brightness: !!hasBrightness,
                        schema: "json",
                        command_topic: true,
                        brightness_scale: 254,
                        command_topic_prefix: endpointName,
                        state_topic_postfix: endpointName,
                    },
                };
                const colorModes = [
                    hasColorXY && !preferHS ? "xy" : null,
                    (!hasColorXY || preferHS) && hasColorHS ? "hs" : null,
                    hasColorTemp ? "color_temp" : null,
                ].filter((c) => c);
                if (colorModes.length) {
                    discoveryEntry.discovery_payload.supported_color_modes = colorModes;
                }
                else {
                    /**
                     * All bulbs support brightness, note that `brightness` cannot be combined
                     * with other color modes.
                     * https://github.com/Koenkk/zigbee2mqtt/issues/26520#issuecomment-2692432058
                     */
                    discoveryEntry.discovery_payload.supported_color_modes = ["brightness"];
                }
                if (hasColorTemp) {
                    const colorTemps = exposes
                        .map((expose) => expose.features.find((e) => e.name === "color_temp"))
                        .filter((e) => e !== undefined && (0, utils_1.isNumericExpose)(e));
                    const max = Math.min(...colorTemps.map((e) => e.value_max).filter((e) => e !== undefined));
                    const min = Math.max(...colorTemps.map((e) => e.value_min).filter((e) => e !== undefined));
                    discoveryEntry.discovery_payload.max_mireds = max;
                    discoveryEntry.discovery_payload.min_mireds = min;
                }
                const effects = utils_1.default.arrayUnique(utils_1.default.flatten(allExposes
                    .filter(utils_1.isEnumExpose)
                    .filter((e) => e.name === "effect")
                    .map((e) => e.values)));
                if (effects.length) {
                    discoveryEntry.discovery_payload.effect = true;
                    discoveryEntry.discovery_payload.effect_list = effects;
                }
                discoveryEntries.push(discoveryEntry);
                break;
            }
            case "switch": {
                const state = firstExpose.features.filter(utils_1.isBinaryExpose).find((f) => f.name === "state");
                (0, node_assert_1.default)(state, `Switch expose must have a 'state'`);
                const property = getProperty(state);
                const discoveryEntry = {
                    type: "switch",
                    object_id: endpointName ? `switch_${endpointName}` : "switch",
                    mockProperties: [{ property: property, value: null }],
                    discovery_payload: {
                        name: endpointName ? utils_1.default.capitalize(endpointName) : null,
                        payload_off: state.value_off,
                        payload_on: state.value_on,
                        value_template: `{{ value_json.${property} }}`,
                        command_topic: true,
                        command_topic_prefix: endpointName,
                    },
                };
                if (SWITCH_DIFFERENT.includes(property)) {
                    discoveryEntry.discovery_payload.name = firstExpose.label;
                    discoveryEntry.discovery_payload.command_topic_postfix = property;
                    discoveryEntry.discovery_payload.state_off = state.value_off;
                    discoveryEntry.discovery_payload.state_on = state.value_on;
                    discoveryEntry.object_id = property;
                    if (property === "window_detection") {
                        discoveryEntry.discovery_payload.icon = "mdi:window-open-variant";
                    }
                }
                discoveryEntries.push(discoveryEntry);
                break;
            }
            case "climate": {
                const setpointProperties = ["occupied_heating_setpoint", "current_heating_setpoint"];
                const setpoint = firstExpose.features.filter(utils_1.isNumericExpose).find((f) => setpointProperties.includes(f.name));
                (0, node_assert_1.default)(setpoint && setpoint.value_min !== undefined && setpoint.value_max !== undefined, "No setpoint found or it is missing value_min/max");
                const temperature = firstExpose.features.find((f) => f.name === "local_temperature");
                (0, node_assert_1.default)(temperature, "No temperature found");
                const discoveryEntry = {
                    type: "climate",
                    object_id: endpointName ? `climate_${endpointName}` : "climate",
                    mockProperties: [],
                    discovery_payload: {
                        name: endpointName ? utils_1.default.capitalize(endpointName) : null,
                        // Static
                        state_topic: false,
                        temperature_unit: "C",
                        // Setpoint
                        temp_step: setpoint.value_step,
                        min_temp: setpoint.value_min.toString(),
                        max_temp: setpoint.value_max.toString(),
                        // Temperature
                        current_temperature_topic: true,
                        current_temperature_template: `{{ value_json.${temperature.property} }}`,
                        command_topic_prefix: endpointName,
                    },
                };
                const mode = firstExpose.features.filter(utils_1.isEnumExpose).find((f) => f.name === "system_mode");
                if (mode) {
                    if (mode.values.includes("sleep")) {
                        // 'sleep' is not supported by Home Assistant, but is valid according to ZCL
                        // TRV that support sleep (e.g. Viessmann) will have it removed from here,
                        // this allows other expose consumers to still use it, e.g. the frontend.
                        mode.values.splice(mode.values.indexOf("sleep"), 1);
                    }
                    discoveryEntry.discovery_payload.mode_state_topic = true;
                    discoveryEntry.discovery_payload.mode_state_template = `{{ value_json.${mode.property} }}`;
                    discoveryEntry.discovery_payload.modes = mode.values;
                    discoveryEntry.discovery_payload.mode_command_topic = true;
                }
                const state = firstExpose.features.find((f) => f.name === "running_state");
                if (state) {
                    discoveryEntry.mockProperties.push({ property: state.property, value: null });
                    discoveryEntry.discovery_payload.action_topic = true;
                    discoveryEntry.discovery_payload.action_template = `{% set values = {None:None,'idle':'idle','heat':'heating','cool':'cooling','fan_only':'fan'} %}{{ values[value_json.${state.property}] }}`;
                }
                const coolingSetpoint = firstExpose.features.find((f) => f.name === "occupied_cooling_setpoint");
                if (coolingSetpoint) {
                    discoveryEntry.discovery_payload.temperature_low_command_topic = setpoint.name;
                    discoveryEntry.discovery_payload.temperature_low_state_template = `{{ value_json.${setpoint.property} }}`;
                    discoveryEntry.discovery_payload.temperature_low_state_topic = true;
                    discoveryEntry.discovery_payload.temperature_high_command_topic = coolingSetpoint.name;
                    discoveryEntry.discovery_payload.temperature_high_state_template = `{{ value_json.${coolingSetpoint.property} }}`;
                    discoveryEntry.discovery_payload.temperature_high_state_topic = true;
                }
                else {
                    discoveryEntry.discovery_payload.temperature_command_topic = setpoint.name;
                    discoveryEntry.discovery_payload.temperature_state_template = `{{ value_json.${setpoint.property} }}`;
                    discoveryEntry.discovery_payload.temperature_state_topic = true;
                }
                const fanMode = firstExpose.features.filter(utils_1.isEnumExpose).find((f) => f.name === "fan_mode");
                if (fanMode) {
                    discoveryEntry.discovery_payload.fan_modes = fanMode.values;
                    discoveryEntry.discovery_payload.fan_mode_command_topic = true;
                    discoveryEntry.discovery_payload.fan_mode_state_template = `{{ value_json.${fanMode.property} }}`;
                    discoveryEntry.discovery_payload.fan_mode_state_topic = true;
                }
                const swingMode = firstExpose.features.filter(utils_1.isEnumExpose).find((f) => f.name === "swing_mode");
                if (swingMode) {
                    discoveryEntry.discovery_payload.swing_modes = swingMode.values;
                    discoveryEntry.discovery_payload.swing_mode_command_topic = true;
                    discoveryEntry.discovery_payload.swing_mode_state_template = `{{ value_json.${swingMode.property} }}`;
                    discoveryEntry.discovery_payload.swing_mode_state_topic = true;
                }
                const preset = firstExpose.features.filter(utils_1.isEnumExpose).find((f) => f.name === "preset");
                if (preset) {
                    discoveryEntry.discovery_payload.preset_modes = preset.values;
                    discoveryEntry.discovery_payload.preset_mode_command_topic = "preset";
                    discoveryEntry.discovery_payload.preset_mode_value_template = `{{ value_json.${preset.property} }}`;
                    discoveryEntry.discovery_payload.preset_mode_state_topic = true;
                }
                const tempCalibration = firstExpose.features
                    .filter(utils_1.isNumericExpose)
                    .find((f) => f.name === "local_temperature_calibration");
                if (tempCalibration) {
                    const discoveryEntry = {
                        type: "number",
                        object_id: endpointName ? `${tempCalibration.name}_${endpointName}` : `${tempCalibration.name}`,
                        mockProperties: [{ property: tempCalibration.property, value: null }],
                        discovery_payload: {
                            name: endpointName ? `${tempCalibration.label} ${endpointName}` : tempCalibration.label,
                            value_template: `{{ value_json.${tempCalibration.property} }}`,
                            command_topic: true,
                            command_topic_prefix: endpointName,
                            command_topic_postfix: tempCalibration.property,
                            device_class: "temperature_delta",
                            entity_category: "config",
                            ...(tempCalibration.unit && { unit_of_measurement: tempCalibration.unit }),
                        },
                    };
                    if (tempCalibration.value_min != null)
                        discoveryEntry.discovery_payload.min = tempCalibration.value_min;
                    if (tempCalibration.value_max != null)
                        discoveryEntry.discovery_payload.max = tempCalibration.value_max;
                    if (tempCalibration.value_step != null) {
                        discoveryEntry.discovery_payload.step = tempCalibration.value_step;
                    }
                    discoveryEntries.push(discoveryEntry);
                }
                const piHeatingDemand = firstExpose.features.filter(utils_1.isNumericExpose).find((f) => f.name === "pi_heating_demand");
                if (piHeatingDemand) {
                    const discoveryEntry = {
                        object_id: endpointName ? `${piHeatingDemand.name}_${endpointName}` : `${piHeatingDemand.name}`,
                        mockProperties: [{ property: piHeatingDemand.property, value: null }],
                        discovery_payload: {
                            name: endpointName ? `${piHeatingDemand.label} ${endpointName}` : piHeatingDemand.label,
                            value_template: `{{ value_json.${piHeatingDemand.property} }}`,
                            ...(piHeatingDemand.unit && { unit_of_measurement: piHeatingDemand.unit }),
                            icon: "mdi:radiator",
                        },
                    };
                    (0, node_assert_1.default)(discoveryEntry.discovery_payload);
                    if (piHeatingDemand.access & ACCESS_SET) {
                        discoveryEntry.type = "number";
                        discoveryEntry.discovery_payload.command_topic = true;
                        discoveryEntry.discovery_payload.command_topic_prefix = endpointName;
                        discoveryEntry.discovery_payload.command_topic_postfix = piHeatingDemand.property;
                        discoveryEntry.discovery_payload.min = piHeatingDemand.value_min;
                        discoveryEntry.discovery_payload.max = piHeatingDemand.value_max;
                    }
                    else {
                        discoveryEntry.type = "sensor";
                        discoveryEntry.discovery_payload.entity_category = "diagnostic";
                    }
                    discoveryEntries.push(discoveryEntry);
                }
                const piCoolingDemand = firstExpose.features.filter(utils_1.isNumericExpose).find((f) => f.name === "pi_cooling_demand");
                if (piCoolingDemand) {
                    const discoveryEntry = {
                        type: "sensor",
                        object_id: endpointName ? /* v8 ignore next */ `${piCoolingDemand.name}_${endpointName}` : `${piCoolingDemand.name}`,
                        mockProperties: [{ property: piCoolingDemand.property, value: null }],
                        discovery_payload: {
                            name: endpointName ? /* v8 ignore next */ `${piCoolingDemand.label} ${endpointName}` : piCoolingDemand.label,
                            value_template: `{{ value_json.${piCoolingDemand.property} }}`,
                            ...(piCoolingDemand.unit && { unit_of_measurement: piCoolingDemand.unit }),
                            entity_category: "diagnostic",
                            icon: "mdi:air-conditioner",
                        },
                    };
                    discoveryEntries.push(discoveryEntry);
                }
                const localTemperature = firstExpose.features.filter(utils_1.isNumericExpose).find((f) => f.name === "local_temperature");
                const temperatureSensor = allExposes?.filter(utils_1.isNumericExpose).find((e) => e.name === "temperature" && e.access & ACCESS_STATE);
                const localTemperatureSensor = allExposes
                    ?.filter(utils_1.isNumericExpose)
                    .find((e) => e.name === "local_temperature" && e.access & ACCESS_STATE);
                if (localTemperature && !temperatureSensor && !localTemperatureSensor) {
                    const discoveryEntry = {
                        type: "sensor",
                        object_id: endpointName ? `${localTemperature.name}_${endpointName}` : `${localTemperature.name}`,
                        mockProperties: [{ property: localTemperature.property, value: null }],
                        discovery_payload: {
                            name: endpointName ? `${localTemperature.label} ${endpointName}` : localTemperature.label,
                            value_template: `{{ value_json.${localTemperature.property} }}`,
                            ...(localTemperature.unit && { unit_of_measurement: localTemperature.unit }),
                            device_class: "temperature",
                            state_class: "measurement",
                        },
                    };
                    discoveryEntries.push(discoveryEntry);
                }
                const currentHumidity = allExposes?.filter(utils_1.isNumericExpose).find((e) => e.name === "humidity" && e.access & ACCESS_STATE);
                if (currentHumidity) {
                    discoveryEntry.discovery_payload.current_humidity_template = `{{ value_json.${currentHumidity.property} }}`;
                    discoveryEntry.discovery_payload.current_humidity_topic = true;
                }
                discoveryEntries.push(discoveryEntry);
                break;
            }
            case "lock": {
                const state = firstExpose.features.filter(utils_1.isBinaryExpose).find((f) => f.name === "state");
                (0, node_assert_1.default)(state?.name === "state", "Lock expose must have a 'state'");
                const discoveryEntry = {
                    type: "lock",
                    /* v8 ignore next */
                    object_id: endpointName ? `lock_${endpointName}` : "lock",
                    mockProperties: [{ property: state.property, value: null }],
                    discovery_payload: {
                        /* v8 ignore next */
                        name: endpointName ? utils_1.default.capitalize(endpointName) : null,
                        command_topic_prefix: endpointName,
                        command_topic: true,
                        value_template: `{{ value_json.${state.property} }}`,
                        state_locked: state.value_on,
                        state_unlocked: state.value_off,
                        /* v8 ignore next */
                        command_topic_postfix: endpointName ? state.property : null,
                    },
                };
                discoveryEntries.push(discoveryEntry);
                break;
            }
            case "cover": {
                const state = exposes
                    .find((expose) => expose.features.find((e) => e.name === "state"))
                    ?.features.find((f) => f.name === "state");
                (0, node_assert_1.default)(state, `Cover expose must have a 'state'`);
                const position = exposes
                    .find((expose) => expose.features.find((e) => e.name === "position"))
                    ?.features.find((f) => f.name === "position");
                const tilt = exposes
                    .find((expose) => expose.features.find((e) => e.name === "tilt"))
                    ?.features.find((f) => f.name === "tilt");
                const motorState = allExposes
                    ?.filter(utils_1.isEnumExpose)
                    .find((e) => ["motor_state", "moving"].includes(e.name) && e.access === ACCESS_STATE);
                const running = allExposes?.filter(utils_1.isBinaryExpose)?.find((e) => e.name === "running");
                const discoveryEntry = {
                    type: "cover",
                    mockProperties: [{ property: state.property, value: null }],
                    object_id: endpointName ? `cover_${endpointName}` : "cover",
                    discovery_payload: {
                        name: endpointName ? utils_1.default.capitalize(endpointName) : null,
                        command_topic_prefix: endpointName,
                        command_topic: true,
                        state_topic: true,
                        state_topic_postfix: endpointName,
                    },
                };
                // If curtains have `running` property, use this in discovery.
                // The movement direction is calculated (assumed) in this case.
                if (running) {
                    (0, node_assert_1.default)(position, `Cover must have 'position' when it has 'running'`);
                    discoveryEntry.discovery_payload.value_template = `{% if "${featurePropertyWithoutEndpoint(running)}" in value_json and value_json.${featurePropertyWithoutEndpoint(running)} %} {% if value_json.${featurePropertyWithoutEndpoint(position)} > 0 %} closing {% else %} opening {% endif %} {% else %} stopped {% endif %}`;
                }
                // If curtains have `motor_state` or `moving` property, lookup for possible
                // state names to detect movement direction and use this in discovery.
                if (motorState) {
                    const openingState = motorState.values.find((s) => COVER_OPENING_LOOKUP.includes(s.toString().toLowerCase()));
                    const closingState = motorState.values.find((s) => COVER_CLOSING_LOOKUP.includes(s.toString().toLowerCase()));
                    const stoppedState = motorState.values.find((s) => COVER_STOPPED_LOOKUP.includes(s.toString().toLowerCase()));
                    if (openingState && closingState && stoppedState) {
                        discoveryEntry.discovery_payload.state_opening = openingState;
                        discoveryEntry.discovery_payload.state_closing = closingState;
                        discoveryEntry.discovery_payload.state_stopped = stoppedState;
                        discoveryEntry.discovery_payload.value_template = `{% if "${featurePropertyWithoutEndpoint(motorState)}" in value_json and value_json.${featurePropertyWithoutEndpoint(motorState)} %} {{ value_json.${featurePropertyWithoutEndpoint(motorState)} }} {% else %} ${stoppedState} {% endif %}`;
                    }
                }
                // If curtains do not have `running`, `motor_state` or `moving` properties.
                if (!discoveryEntry.discovery_payload.value_template) {
                    discoveryEntry.discovery_payload.value_template = `{{ value_json.${featurePropertyWithoutEndpoint(state)} }}`;
                    discoveryEntry.discovery_payload.state_open = "OPEN";
                    discoveryEntry.discovery_payload.state_closed = "CLOSE";
                    discoveryEntry.discovery_payload.state_stopped = "STOP";
                }
                /* v8 ignore start */
                if (!position && !tilt) {
                    discoveryEntry.discovery_payload.optimistic = true;
                }
                /* v8 ignore stop */
                if (position) {
                    discoveryEntry.discovery_payload = {
                        ...discoveryEntry.discovery_payload,
                        position_template: `{{ value_json.${featurePropertyWithoutEndpoint(position)} }}`,
                        set_position_template: `{ "${getProperty(position)}": {{ position }} }`,
                        set_position_topic: true,
                        position_topic: true,
                    };
                }
                if (tilt) {
                    discoveryEntry.discovery_payload = {
                        ...discoveryEntry.discovery_payload,
                        tilt_command_topic: true,
                        tilt_status_topic: true,
                        tilt_status_template: `{{ value_json.${featurePropertyWithoutEndpoint(tilt)} }}`,
                    };
                }
                discoveryEntries.push(discoveryEntry);
                break;
            }
            case "fan": {
                (0, node_assert_1.default)(!endpointName, "Endpoint not supported for fan type");
                const discoveryEntry = {
                    type: "fan",
                    object_id: "fan",
                    mockProperties: [{ property: "fan_state", value: null }],
                    discovery_payload: {
                        name: null,
                        state_topic: true,
                        command_topic: true,
                    },
                };
                const modeEmulatedSpeed = firstExpose.features.filter(utils_1.isEnumExpose).find((e) => e.name === "mode");
                const nativeSpeed = firstExpose.features.filter(utils_1.isNumericExpose).find((e) => e.name === "speed");
                // Exactly one mode needs to be active (logical xor)
                (0, node_assert_1.default)(!modeEmulatedSpeed !== !nativeSpeed, "Fans need to be either mode- or speed-controlled");
                if (modeEmulatedSpeed) {
                    // A fan entity in Home Assistant 2021.3 and above may have a speed,
                    // controlled by a percentage from 1 to 100, and/or non-speed presets.
                    // The MQTT Fan integration allows the speed percentage to be mapped
                    // to a narrower range of speeds (e.g. 1-3), and for these speeds to be
                    // translated to and from MQTT messages via templates.
                    //
                    // For the fixed fan modes in ZCL hvacFanCtrl, we model speeds "low",
                    // "medium", and "high" as three speeds covering the full percentage
                    // range as done in Home Assistant's zigpy fan integration, plus
                    // presets "on", "auto" and "smart" to cover the remaining modes in
                    // ZCL. This supports a generic ZCL HVAC Fan Control fan. "Off" is
                    // always a valid speed.
                    let speeds = ["off"].concat(["low", "medium", "high", "1", "2", "3", "4", "5", "6", "7", "8", "9"].filter((s) => modeEmulatedSpeed.values.includes(s)));
                    let presets = ["on", "auto", "smart"].filter((s) => modeEmulatedSpeed.values.includes(s));
                    if (entity.isDevice() && entity.definition?.model === "99432") {
                        // The Hampton Bay 99432 fan implements 4 speeds using the ZCL
                        // hvacFanCtrl values `low`, `medium`, `high`, and `on`, and
                        // 1 preset called "Comfort Breeze" using the ZCL value `smart`.
                        // ZCL value `auto` is unused.
                        speeds = ["off", "low", "medium", "high", "on"];
                        presets = ["smart"];
                    }
                    const allowed = [...speeds, ...presets];
                    for (const val of modeEmulatedSpeed.values) {
                        (0, node_assert_1.default)(allowed.includes(val.toString()));
                    }
                    const percentValues = speeds.map((s, i) => `'${s}':${i}`).join(", ");
                    const percentCommands = speeds.map((s, i) => `${i}:'${s}'`).join(", ");
                    const presetList = presets.map((s) => `'${s}'`).join(", ");
                    discoveryEntry.discovery_payload.percentage_state_topic = true;
                    discoveryEntry.discovery_payload.percentage_command_topic = "fan_mode";
                    discoveryEntry.discovery_payload.percentage_value_template = `{{ {${percentValues}}[value_json.${modeEmulatedSpeed.property}] | default('None') }}`;
                    discoveryEntry.discovery_payload.percentage_command_template = `{{ {${percentCommands}}[value] | default('') }}`;
                    discoveryEntry.discovery_payload.speed_range_min = 1;
                    discoveryEntry.discovery_payload.speed_range_max = speeds.length - 1;
                    (0, node_assert_1.default)(presets.length !== 0);
                    discoveryEntry.discovery_payload.preset_mode_state_topic = true;
                    discoveryEntry.discovery_payload.preset_mode_command_topic = "fan_mode";
                    discoveryEntry.discovery_payload.preset_mode_value_template = `{{ value_json.${modeEmulatedSpeed.property} if value_json.${modeEmulatedSpeed.property} in [${presetList}] else 'None' | default('None') }}`;
                    discoveryEntry.discovery_payload.preset_modes = presets;
                    // Emulate state based on mode
                    discoveryEntry.discovery_payload.state_value_template = "{{ value_json.fan_state }}";
                    discoveryEntry.discovery_payload.command_topic_postfix = "fan_state";
                }
                else if (nativeSpeed) {
                    discoveryEntry.discovery_payload.percentage_state_topic = true;
                    discoveryEntry.discovery_payload.percentage_command_topic = "speed";
                    discoveryEntry.discovery_payload.percentage_value_template = `{{ value_json.${nativeSpeed.property} | default('None') }}`;
                    discoveryEntry.discovery_payload.percentage_command_template = `{{ value | default('') }}`;
                    discoveryEntry.discovery_payload.speed_range_min = nativeSpeed.value_min;
                    discoveryEntry.discovery_payload.speed_range_max = nativeSpeed.value_max;
                    // Speed-controlled fans generally have an onOff cluster, use that for state
                    discoveryEntry.discovery_payload.state_value_template = "{{ value_json.state }}";
                    discoveryEntry.discovery_payload.command_topic_postfix = "state";
                }
                discoveryEntries.push(discoveryEntry);
                break;
            }
            case "binary": {
                /**
                 * If Z2M binary attribute has SET access then expose it as `switch` in HA
                 * There is also a check on the values for typeof boolean to prevent invalid values and commands
                 * silently failing - commands work fine but some devices won't reject unexpected values.
                 * https://github.com/Koenkk/zigbee2mqtt/issues/7740
                 */
                (0, utils_1.assertBinaryExpose)(firstExpose);
                if (firstExpose.access & ACCESS_SET) {
                    const discoveryEntry = {
                        type: "switch",
                        mockProperties: [{ property: firstExpose.property, value: null }],
                        object_id: endpointName ? `switch_${firstExpose.name}_${endpointName}` : `switch_${firstExpose.name}`,
                        discovery_payload: {
                            name: endpointName ? /* v8 ignore next */ `${firstExpose.label} ${endpointName}` : firstExpose.label,
                            value_template: typeof firstExpose.value_on === "boolean"
                                ? `{% if value_json.${firstExpose.property} %}true{% else %}false{% endif %}`
                                : `{{ value_json.${firstExpose.property} }}`,
                            payload_on: firstExpose.value_on.toString(),
                            payload_off: firstExpose.value_off.toString(),
                            command_topic: true,
                            command_topic_prefix: endpointName,
                            command_topic_postfix: firstExpose.property,
                            ...(BINARY_DISCOVERY_LOOKUP[firstExpose.name] || {}),
                        },
                    };
                    discoveryEntries.push(discoveryEntry);
                }
                else {
                    const discoveryEntry = {
                        type: "binary_sensor",
                        object_id: endpointName ? `${firstExpose.name}_${endpointName}` : `${firstExpose.name}`,
                        mockProperties: [{ property: firstExpose.property, value: null }],
                        discovery_payload: {
                            name: endpointName ? /* v8 ignore next */ `${firstExpose.label} ${endpointName}` : firstExpose.label,
                            value_template: `{{ value_json.${firstExpose.property} }}`,
                            payload_on: firstExpose.value_on,
                            payload_off: firstExpose.value_off,
                            ...(BINARY_DISCOVERY_LOOKUP[firstExpose.name] || {}),
                        },
                    };
                    discoveryEntries.push(discoveryEntry);
                }
                break;
            }
            case "numeric": {
                (0, utils_1.assertNumericExpose)(firstExpose);
                const allowsSet = firstExpose.access & ACCESS_SET;
                /**
                 * If numeric attribute has SET access then expose as SELECT entity.
                 */
                if (allowsSet) {
                    const discoveryEntry = {
                        type: "number",
                        object_id: endpointName ? `${firstExpose.name}_${endpointName}` : `${firstExpose.name}`,
                        mockProperties: [{ property: firstExpose.property, value: null }],
                        discovery_payload: {
                            name: endpointName ? `${firstExpose.label} ${endpointName}` : firstExpose.label,
                            value_template: `{{ value_json.${firstExpose.property} }}`,
                            command_topic: true,
                            command_topic_prefix: endpointName,
                            command_topic_postfix: firstExpose.property,
                            ...(firstExpose.unit && { unit_of_measurement: firstExpose.unit }),
                            ...(firstExpose.value_step && { step: firstExpose.value_step }),
                            ...NUMERIC_DISCOVERY_LOOKUP[firstExpose.name],
                        },
                    };
                    if (NUMERIC_DISCOVERY_LOOKUP[firstExpose.name]?.device_class === "temperature") {
                        discoveryEntry.discovery_payload.device_class = NUMERIC_DISCOVERY_LOOKUP[firstExpose.name]?.device_class;
                    }
                    else {
                        delete discoveryEntry.discovery_payload.device_class;
                    }
                    if (firstExpose.value_min != null)
                        discoveryEntry.discovery_payload.min = firstExpose.value_min;
                    if (firstExpose.value_max != null)
                        discoveryEntry.discovery_payload.max = firstExpose.value_max;
                    discoveryEntries.push(discoveryEntry);
                    break;
                }
                const extraAttrs = {};
                // If a variable includes Wh, mark it as energy
                if (firstExpose.unit && ["Wh", "kWh"].includes(firstExpose.unit)) {
                    Object.assign(extraAttrs, { device_class: "energy", state_class: "total_increasing" });
                }
                // If a variable includes A or mA, mark it as current
                else if (firstExpose.unit && ["A", "mA"].includes(firstExpose.unit)) {
                    Object.assign(extraAttrs, { device_class: "current", state_class: "measurement" });
                }
                // If a variable includes mW, W, kW mark it as power
                else if (firstExpose.unit && ["mW", "W", "kW"].includes(firstExpose.unit)) {
                    Object.assign(extraAttrs, { device_class: "power", state_class: "measurement" });
                }
                let key = firstExpose.name;
                // Home Assistant uses a different voc device_class for µg/m³ versus ppb or ppm.
                if (firstExpose.name === "voc" && firstExpose.unit && ["ppb", "ppm"].includes(firstExpose.unit)) {
                    key = "voc_parts";
                }
                const discoveryEntry = {
                    type: "sensor",
                    object_id: endpointName ? `${firstExpose.name}_${endpointName}` : `${firstExpose.name}`,
                    mockProperties: [{ property: firstExpose.property, value: null }],
                    discovery_payload: {
                        name: endpointName ? `${firstExpose.label} ${endpointName}` : firstExpose.label,
                        value_template: `{{ value_json.${firstExpose.property} }}`,
                        enabled_by_default: !allowsSet,
                        ...(firstExpose.unit && { unit_of_measurement: firstExpose.unit }),
                        ...NUMERIC_DISCOVERY_LOOKUP[key],
                        ...extraAttrs,
                    },
                };
                // When a device_class is set, unit_of_measurement must be set, otherwise warnings are generated.
                // https://github.com/Koenkk/zigbee2mqtt/issues/15958#issuecomment-1377483202
                if (discoveryEntry.discovery_payload.device_class && !discoveryEntry.discovery_payload.unit_of_measurement) {
                    delete discoveryEntry.discovery_payload.device_class;
                }
                // entity_category config is not allowed for sensors
                // https://github.com/Koenkk/zigbee2mqtt/issues/20252
                if (discoveryEntry.discovery_payload.entity_category === "config") {
                    discoveryEntry.discovery_payload.entity_category = "diagnostic";
                }
                discoveryEntries.push(discoveryEntry);
                break;
            }
            case "enum": {
                (0, utils_1.assertEnumExpose)(firstExpose);
                /**
                 * If enum attribute does not have SET access and is named 'action', then expose
                 * as EVENT entity. Wildcard actions like `recall_*` are currently not supported.
                 */
                if (firstExpose.property === "action") {
                    if (this.experimentalEventEntities &&
                        firstExpose.access & ACCESS_STATE &&
                        !(firstExpose.access & ACCESS_SET) &&
                        firstExpose.property === "action") {
                        discoveryEntries.push({
                            type: "event",
                            object_id: firstExpose.property,
                            mockProperties: [],
                            discovery_payload: {
                                name: endpointName ? /* v8 ignore next */ `${firstExpose.label} ${endpointName}` : firstExpose.label,
                                state_topic: true,
                                event_types: this.prepareActionEventTypes(firstExpose.values),
                                value_template: this.actionValueTemplate,
                                ...ENUM_DISCOVERY_LOOKUP[firstExpose.name],
                            },
                        });
                    }
                    if (!this.legacyActionSensor) {
                        break;
                    }
                }
                const valueTemplate = firstExpose.access & ACCESS_STATE ? `{{ value_json.${firstExpose.property} }}` : undefined;
                /**
                 * If enum has only one item and has SET access then expose as BUTTON entity.
                 */
                if (firstExpose.access & ACCESS_SET && firstExpose.values.length === 1) {
                    discoveryEntries.push({
                        type: "button",
                        object_id: firstExpose.property,
                        mockProperties: [{ property: firstExpose.property, value: null }],
                        discovery_payload: {
                            name: endpointName ? /* v8 ignore next */ `${firstExpose.label} ${endpointName}` : firstExpose.label,
                            state_topic: false,
                            command_topic_prefix: endpointName,
                            command_topic: true,
                            command_topic_postfix: firstExpose.property,
                            payload_press: firstExpose.values[0].toString(),
                            ...ENUM_DISCOVERY_LOOKUP[firstExpose.name],
                        },
                    });
                    break;
                }
                /**
                 * If enum attribute has SET access then expose as SELECT entity.
                 */
                if (firstExpose.access & ACCESS_SET) {
                    discoveryEntries.push({
                        type: "select",
                        object_id: firstExpose.property,
                        mockProperties: [{ property: firstExpose.property, value: null }],
                        discovery_payload: {
                            name: endpointName ? `${firstExpose.label} ${endpointName}` : firstExpose.label,
                            value_template: valueTemplate,
                            state_topic: !!(firstExpose.access & ACCESS_STATE),
                            command_topic_prefix: endpointName,
                            command_topic: true,
                            command_topic_postfix: firstExpose.property,
                            options: firstExpose.values.map((v) => v.toString()),
                            ...ENUM_DISCOVERY_LOOKUP[firstExpose.name],
                        },
                    });
                    break;
                }
                /**
                 * Otherwise expose as SENSOR entity.
                 */
                if (firstExpose.access & ACCESS_STATE) {
                    discoveryEntries.push({
                        type: "sensor",
                        object_id: firstExpose.property,
                        mockProperties: [{ property: firstExpose.property, value: null }],
                        discovery_payload: {
                            name: endpointName ? `${firstExpose.label} ${endpointName}` : firstExpose.label,
                            value_template: valueTemplate,
                            ...ENUM_DISCOVERY_LOOKUP[firstExpose.name],
                        },
                    });
                }
                break;
            }
            case "text":
            case "composite":
            case "list": {
                const firstExposeTyped = firstExpose;
                // Warning composite → HA siren entity
                if (firstExposeTyped.type === "composite" && firstExposeTyped.name === "warning" && firstExposeTyped.access & ACCESS_SET) {
                    const warningExpose = firstExpose;
                    const modeFeature = warningExpose.features.filter(utils_1.isEnumExpose).find((f) => f.name === "mode");
                    const levelFeature = warningExpose.features.filter(utils_1.isEnumExpose).find((f) => f.name === "level");
                    const durationFeature = warningExpose.features.filter(utils_1.isNumericExpose).find((f) => f.name === "duration");
                    const discoveryEntry = {
                        type: "siren",
                        object_id: endpointName ? /* v8 ignore next */ `siren_${endpointName}` : "siren",
                        mockProperties: [{ property: warningExpose.property, value: null }],
                        discovery_payload: {
                            name: endpointName ? /* v8 ignore next */ utils_1.default.capitalize(endpointName) : null,
                            command_topic: true,
                            command_topic_prefix: endpointName,
                            state_topic: false,
                            optimistic: true,
                        },
                    };
                    if (modeFeature) {
                        const tones = modeFeature.values.filter((v) => v !== "stop");
                        if (tones.length) {
                            discoveryEntry.discovery_payload.available_tones = tones;
                        }
                    }
                    if (levelFeature) {
                        discoveryEntry.discovery_payload.support_volume_set = true;
                    }
                    if (durationFeature) {
                        discoveryEntry.discovery_payload.support_duration = true;
                    }
                    const levelTemplate = "{% if volume_level is defined %}" +
                        "{% if volume_level | float <= 0.25 %}low" +
                        "{% elif volume_level | float <= 0.5 %}medium" +
                        "{% elif volume_level | float <= 0.75 %}high" +
                        "{% else %}very_high{% endif %}" +
                        "{% else %}medium{% endif %}";
                    discoveryEntry.discovery_payload.command_template =
                        `{"warning": {"mode": "{{ tone | default('emergency') }}", ` +
                            `"level": "${levelTemplate}", ` +
                            `"duration": {{ duration | default(10) }}}}`;
                    discoveryEntry.discovery_payload.command_off_template = '{"warning": {"mode": "stop"}}';
                    discoveryEntries.push(discoveryEntry);
                    break;
                }
                if (firstExposeTyped.type === "text" && firstExposeTyped.access & ACCESS_SET) {
                    discoveryEntries.push({
                        type: "text",
                        object_id: firstExposeTyped.property,
                        mockProperties: [{ property: firstExposeTyped.property, value: null }],
                        discovery_payload: {
                            name: endpointName ? `${firstExposeTyped.label} ${endpointName}` : firstExposeTyped.label,
                            state_topic: firstExposeTyped.access & ACCESS_STATE,
                            value_template: `{{ value_json.${firstExposeTyped.property} }}`,
                            command_topic_prefix: endpointName,
                            command_topic: true,
                            command_topic_postfix: firstExposeTyped.property,
                            ...LIST_DISCOVERY_LOOKUP[firstExposeTyped.name],
                        },
                    });
                    break;
                }
                if (firstExposeTyped.access & ACCESS_STATE) {
                    discoveryEntries.push({
                        type: "sensor",
                        object_id: firstExposeTyped.property,
                        mockProperties: [{ property: firstExposeTyped.property, value: null }],
                        discovery_payload: {
                            name: endpointName ? `${firstExposeTyped.label} ${endpointName}` : firstExposeTyped.label,
                            // Truncate text if it's too long
                            // https://github.com/Koenkk/zigbee2mqtt/issues/23199
                            value_template: `{{ value_json.${firstExposeTyped.property} | default('',True) | string | truncate(254, True, '', 0) }}`,
                            ...LIST_DISCOVERY_LOOKUP[firstExposeTyped.name],
                        },
                    });
                }
                break;
            }
        }
        // Exposes with category 'config' or 'diagnostic' are always added to the respective category.
        // This takes precedence over definitions in this file.
        if (firstExpose.category === "config" || firstExpose.category === "diagnostic") {
            for (const entry of discoveryEntries) {
                entry.discovery_payload.entity_category = firstExpose.category;
            }
        }
        for (const entry of discoveryEntries) {
            // If a sensor has entity category `config`, then change
            // it to `diagnostic`. Sensors have no input, so can't be configured.
            // https://github.com/Koenkk/zigbee2mqtt/pull/19474
            if (["binary_sensor", "sensor"].includes(entry.type) && entry.discovery_payload.entity_category === "config") {
                entry.discovery_payload.entity_category = "diagnostic";
            }
            // Event entities cannot have an entity_category set.
            if (entry.type === "event" && entry.discovery_payload.entity_category) {
                delete entry.discovery_payload.entity_category;
            }
            // Let Home Assistant generate entity name when device_class is present
            if (entry.discovery_payload.device_class) {
                delete entry.discovery_payload.name;
            }
            entry.endpoint = entity.isDevice() ? entity.endpoint(endpointName) : undefined;
        }
        return discoveryEntries;
    }
    async onEntityRemoved(data) {
        logger_1.default.debug(`Clearing Home Assistant discovery for '${data.name}'`);
        const discovered = this.getDiscovered(data.entity.ID);
        for (const topic of Object.keys(discovered.messages)) {
            await this.mqtt.publish(topic, "", { clientOptions: { retain: true, qos: 1 }, baseTopic: this.discoveryTopic, skipReceive: false });
        }
        delete this.discovered[data.entity.ID];
    }
    async onGroupMembersChanged(data) {
        await this.discover(data.group);
    }
    async onPublishEntityState(data) {
        /**
         * In case we deal with a lightEndpoint configuration Zigbee2MQTT publishes
         * e.g. {state_l1: ON, brightness_l1: 250} to zigbee2mqtt/mydevice.
         * As the Home Assistant MQTT JSON light cannot be configured to use state_l1/brightness_l1
         * as the state variables, the state topic is set to zigbee2mqtt/mydevice/l1.
         * Here we retrieve all the attributes with the _l1 values and republish them on
         * zigbee2mqtt/mydevice/l1.
         */
        // biome-ignore lint/style/noNonNullAssertion: TODO: biome migration: should this be validated instead?
        const entity = this.zigbee.resolveEntity(data.entity.name);
        if (entity.isDevice()) {
            for (const topic in this.getDiscovered(entity).messages) {
                const topicMatch = topic.match(this.discoveryRegexWoTopic);
                /* v8 ignore start */
                if (!topicMatch) {
                    continue;
                }
                /* v8 ignore stop */
                const objectID = topicMatch[3];
                const lightMatch = /^light_(.*)/.exec(objectID);
                const coverMatch = /^cover_(.*)/.exec(objectID);
                const match = lightMatch || coverMatch;
                if (match) {
                    const endpoint = match[1];
                    const endpointRegExp = new RegExp(`(.*)_${endpoint}`);
                    const payload = {};
                    for (const key of Object.keys(data.message)) {
                        const keyMatch = endpointRegExp.exec(key);
                        if (keyMatch) {
                            payload[keyMatch[1]] = data.message[key];
                        }
                    }
                    await this.mqtt.publish(`${data.entity.name}/${endpoint}`, (0, json_stable_stringify_without_jsonify_1.default)(payload), {});
                }
            }
        }
        /**
         * Publish an empty value for click and action payload, in this way Home Assistant
         * can use Home Assistant entities in automations.
         * https://github.com/Koenkk/zigbee2mqtt/issues/959#issuecomment-480341347
         */
        if (this.legacyActionSensor && data.message.action) {
            await this.publishEntityState(data.entity, { action: "" });
        }
        /**
         * Implements the MQTT device trigger (https://www.home-assistant.io/integrations/device_trigger.mqtt/)
         * The MQTT device trigger does not support JSON parsing, so it cannot listen to zigbee2mqtt/my_device
         * Whenever a device publish an {action: *} we discover an MQTT device trigger sensor
         * and republish it to zigbee2mqtt/my_device/action
         */
        if (settings.get().advanced.output === "json" && entity.isDevice() && entity.definition && data.message.action) {
            const value = data.message.action.toString();
            await this.publishDeviceTriggerDiscover(entity, "action", value);
            await this.mqtt.publish(`${data.entity.name}/action`, value, {});
        }
    }
    async onEntityRenamed(data) {
        logger_1.default.debug(`Refreshing Home Assistant discovery topic for '${data.entity.name}'`);
        // Clear before rename so Home Assistant uses new friendly_name
        // https://github.com/Koenkk/zigbee2mqtt/issues/4096#issuecomment-674044916
        if (data.homeAssisantRename) {
            const discovered = this.getDiscovered(data.entity);
            for (const topic of Object.keys(discovered.messages)) {
                await this.mqtt.publish(topic, "", { clientOptions: { retain: true, qos: 1 }, baseTopic: this.discoveryTopic, skipReceive: false });
            }
            discovered.messages = {};
            // Make sure Home Assistant deletes the old entity first otherwise another one (_2) is created
            // https://github.com/Koenkk/zigbee2mqtt/issues/12610
            await utils_1.default.sleep(2);
        }
        await this.discover(data.entity);
        if (data.entity.isDevice()) {
            for (const config of this.getDiscovered(data.entity).triggers) {
                const key = config.substring(0, config.indexOf("_"));
                const value = config.substring(config.indexOf("_") + 1);
                await this.publishDeviceTriggerDiscover(data.entity, key, value, true);
            }
        }
    }
    getConfigs(entity) {
        const isDevice = entity.isDevice();
        const isGroup = entity.isGroup();
        /* v8 ignore next */
        if (!entity || (isDevice && !entity.definition))
            return [];
        let configs = [];
        if (isDevice) {
            const exposes = entity.exposes(); // avoid calling it hundred of times/s
            for (const expose of exposes) {
                configs.push(...this.exposeToConfig([expose], entity, exposes));
            }
        }
        else if (isGroup) {
            // group
            const exposesByType = {};
            const allExposes = [];
            for (const member of entity.zh.members) {
                const device = this.zigbee.resolveEntity(member.getDevice());
                if (device.definition) {
                    const exposes = device.exposes();
                    allExposes.push(...exposes);
                    for (const expose of exposes.filter((e) => GROUP_SUPPORTED_TYPES.includes(e.type))) {
                        let key = expose.type;
                        if (["switch", "lock", "cover"].includes(expose.type) && expose.endpoint) {
                            // A device can have multiple of these types which have to discovered separately.
                            // e.g. switch with property state and valve_detection.
                            const state = expose.features.find((f) => f.name === "state");
                            (0, node_assert_1.default)(state, `'switch', 'lock' or 'cover' is missing state`);
                            key += featurePropertyWithoutEndpoint(state);
                        }
                        if (!exposesByType[key])
                            exposesByType[key] = [];
                        exposesByType[key].push(expose);
                    }
                }
            }
            configs = [].concat(...Object.values(exposesByType).map((exposes) => this.exposeToConfig(exposes, entity, allExposes)));
        }
        else {
            // Discover bridge config.
            configs.push(...entity.configs);
        }
        if (isDevice && settings.get().advanced.last_seen !== "disable") {
            const config = {
                type: "sensor",
                object_id: "last_seen",
                mockProperties: [{ property: "last_seen", value: null }],
                discovery_payload: {
                    name: "Last seen",
                    value_template: "{{ value_json.last_seen }}",
                    icon: "mdi:clock",
                    enabled_by_default: false,
                    entity_category: "diagnostic",
                },
            };
            if (settings.get().advanced.last_seen.startsWith("ISO_8601")) {
                config.discovery_payload.device_class = "timestamp";
            }
            configs.push(config);
        }
        if (isDevice && entity.definition?.ota) {
            const updateSensor = {
                type: "update",
                object_id: "update",
                mockProperties: [{ property: "update", value: { state: null } }],
                discovery_payload: {
                    name: null,
                    entity_picture: "https://github.com/Koenkk/zigbee2mqtt/raw/master/images/logo.png",
                    state_topic: true,
                    device_class: "firmware",
                    entity_category: "config",
                    command_topic: `${settings.get().mqtt.base_topic}/bridge/request/device/ota_update/update`,
                    payload_install: `{"id": "${entity.ieeeAddr}"}`,
                    value_template: `{"latest_version":"{{ value_json['update']['latest_version'] }}","installed_version":"{{ value_json['update']['installed_version'] }}","update_percentage":{{ value_json['update'].get('progress', 'null') }},"in_progress":{{ (value_json['update']['state'] == 'updating')|lower }}}`,
                },
            };
            configs.push(updateSensor);
        }
        // Discover scenes.
        for (const endpointOrGroup of isDevice ? entity.zh.endpoints : isGroup ? [entity.zh] : []) {
            for (const scene of utils_1.default.getScenes(endpointOrGroup)) {
                const sceneEntry = {
                    type: "scene",
                    object_id: `scene_${scene.id}`,
                    mockProperties: [],
                    discovery_payload: {
                        name: `${scene.name}`,
                        state_topic: false,
                        command_topic: true,
                        payload_on: `{ "scene_recall": ${scene.id} }`,
                        object_id_postfix: `_${scene.name.replace(/\s+/g, "_").toLowerCase()}`,
                    },
                };
                configs.push(sceneEntry);
            }
        }
        // deep clone of the config objects
        configs = JSON.parse(JSON.stringify(configs));
        if (entity.options.homeassistant) {
            const s = entity.options.homeassistant;
            configs = configs.filter((config) => s[config.object_id] === undefined || s[config.object_id] != null);
            for (const config of configs) {
                const configOverride = s[config.object_id];
                if (configOverride) {
                    config.object_id = configOverride.object_id || config.object_id;
                    config.type = configOverride.type || config.type;
                }
            }
        }
        return configs;
    }
    async discover(entity, publish = true) {
        // Handle type differences.
        const isDevice = entity.isDevice();
        const isGroup = entity.isGroup();
        if (isGroup && entity.zh.members.length === 0) {
            return;
        }
        if (isDevice &&
            (!entity.definition || !entity.interviewed || (entity.options.homeassistant !== undefined && !entity.options.homeassistant))) {
            return;
        }
        const discovered = this.getDiscovered(entity);
        discovered.discovered = true;
        const lastDiscoveredTopics = Object.keys(discovered.messages);
        const newDiscoveredTopics = new Set();
        for (const config of this.getConfigs(entity)) {
            const payload = { ...config.discovery_payload };
            const baseTopic = `${settings.get().mqtt.base_topic}/${entity.name}`;
            let stateTopic = baseTopic;
            if (payload.state_topic_postfix) {
                stateTopic += `/${payload.state_topic_postfix}`;
                delete payload.state_topic_postfix;
            }
            if (payload.state_topic === undefined || payload.state_topic) {
                payload.state_topic = stateTopic;
            }
            else {
                if (payload.state_topic !== undefined) {
                    delete payload.state_topic;
                }
            }
            if (payload.position_topic) {
                payload.position_topic = stateTopic;
            }
            if (payload.tilt_status_topic) {
                payload.tilt_status_topic = stateTopic;
            }
            const devicePayload = this.getDevicePayload(entity);
            // Suggest object_id (entity_id) for entity
            payload.object_id = devicePayload.name.replace(/\s+/g, "_").toLowerCase();
            if (config.object_id.startsWith(config.type) && config.object_id.includes("_")) {
                payload.object_id += `_${config.object_id.split(/_(.+)/)[1]}`;
            }
            else if (!config.object_id.startsWith(config.type)) {
                payload.object_id += `_${config.object_id}`;
            }
            // Allow customization of the `payload.object_id` without touching the other uses of `config.object_id`
            // (e.g. for setting the `payload.unique_id` and as an internal key).
            payload.object_id = `${payload.object_id}${payload.object_id_postfix ?? ""}`;
            delete payload.object_id_postfix;
            // Set `default_entity_id`, as of HA 2025.10 this replaces the `object_id`.
            // For migration purposes we set both for now.
            // https://github.com/home-assistant/core/pull/151775
            payload.default_entity_id = `${config.type}.${payload.object_id}`;
            // Set unique_id
            const uniqueId = `${entity.options.ID}_${config.object_id}_${settings.get().mqtt.base_topic}`;
            payload.unique_id = uniqueId;
            if (config.endpoint) {
                (0, node_assert_1.default)(entity.isDevice());
                const memberKey = `${config.endpoint.deviceIeeeAddress}_${config.endpoint.ID}_${config.type}`;
                this.groupMemberLookup.set(memberKey, uniqueId);
            }
            // Add group member unique_ids for Home Assistant entity grouping
            // This assumes that `discover()` already has been called for all devices, since it depends on the
            // `groupMemberLookup` being populated.
            // https://www.home-assistant.io/integrations/mqtt#grouping-entities
            if (isGroup) {
                const memberIds = [];
                for (const endpoint of entity.zh.members) {
                    const memberKey = `${endpoint.deviceIeeeAddress}_${endpoint.ID}_${config.type}`;
                    const memberUniqueId = this.groupMemberLookup.get(memberKey);
                    if (memberUniqueId) {
                        memberIds.push(memberUniqueId);
                    }
                }
                if (memberIds.length > 0) {
                    payload.group = memberIds;
                }
            }
            // Attributes for device registry and origin
            payload.device = devicePayload;
            payload.origin = this.discoveryOrigin;
            // Availability payload (can be disabled by setting `payload.availability = false`).
            if (payload.availability === undefined || payload.availability) {
                payload.availability = [{ topic: `${settings.get().mqtt.base_topic}/bridge/state` }];
                if (isDevice || isGroup) {
                    if (utils_1.default.isAvailabilityEnabledForEntity(entity, settings.get())) {
                        payload.availability_mode = "all";
                        payload.availability.push({ topic: `${baseTopic}/availability` });
                    }
                }
                else {
                    // Bridge availability is different.
                    payload.availability_mode = "all";
                }
                if (isDevice && entity.options.disabled) {
                    // Mark disabled device always as unavailable
                    for (const entry of payload.availability) {
                        entry.value_template = '{{ "offline" }}';
                    }
                }
                else {
                    for (const entry of payload.availability) {
                        entry.value_template = "{{ value_json.state }}";
                    }
                }
            }
            else {
                delete payload.availability;
            }
            const commandTopicPrefix = payload.command_topic_prefix ? `${payload.command_topic_prefix}/` : "";
            delete payload.command_topic_prefix;
            const commandTopicPostfix = payload.command_topic_postfix ? `/${payload.command_topic_postfix}` : "";
            delete payload.command_topic_postfix;
            const commandTopic = `${baseTopic}/${commandTopicPrefix}set${commandTopicPostfix}`;
            if (payload.command_topic && typeof payload.command_topic !== "string") {
                payload.command_topic = commandTopic;
            }
            if (payload.set_position_topic) {
                payload.set_position_topic = commandTopic;
            }
            if (payload.tilt_command_topic) {
                payload.tilt_command_topic = `${baseTopic}/${commandTopicPrefix}set/tilt`;
            }
            if (payload.mode_state_topic) {
                payload.mode_state_topic = stateTopic;
            }
            if (payload.mode_command_topic) {
                payload.mode_command_topic = `${baseTopic}/${commandTopicPrefix}set/system_mode`;
            }
            if (payload.current_temperature_topic) {
                payload.current_temperature_topic = stateTopic;
            }
            if (payload.temperature_state_topic) {
                payload.temperature_state_topic = stateTopic;
            }
            if (payload.temperature_low_state_topic) {
                payload.temperature_low_state_topic = stateTopic;
            }
            if (payload.temperature_high_state_topic) {
                payload.temperature_high_state_topic = stateTopic;
            }
            if (payload.temperature_command_topic) {
                payload.temperature_command_topic = `${baseTopic}/${commandTopicPrefix}set/${payload.temperature_command_topic}`;
            }
            if (payload.temperature_low_command_topic) {
                payload.temperature_low_command_topic = `${baseTopic}/${commandTopicPrefix}set/${payload.temperature_low_command_topic}`;
            }
            if (payload.temperature_high_command_topic) {
                payload.temperature_high_command_topic = `${baseTopic}/${commandTopicPrefix}set/${payload.temperature_high_command_topic}`;
            }
            if (payload.fan_mode_state_topic) {
                payload.fan_mode_state_topic = stateTopic;
            }
            if (payload.fan_mode_command_topic) {
                payload.fan_mode_command_topic = `${baseTopic}/${commandTopicPrefix}set/fan_mode`;
            }
            if (payload.swing_mode_state_topic) {
                payload.swing_mode_state_topic = stateTopic;
            }
            if (payload.swing_mode_command_topic) {
                payload.swing_mode_command_topic = `${baseTopic}/${commandTopicPrefix}set/swing_mode`;
            }
            if (payload.percentage_state_topic) {
                payload.percentage_state_topic = stateTopic;
            }
            if (payload.percentage_command_topic) {
                payload.percentage_command_topic = `${baseTopic}/${commandTopicPrefix}set/${payload.percentage_command_topic}`;
            }
            if (payload.preset_mode_state_topic) {
                payload.preset_mode_state_topic = stateTopic;
            }
            if (payload.preset_mode_command_topic) {
                payload.preset_mode_command_topic = `${baseTopic}/${commandTopicPrefix}set/${payload.preset_mode_command_topic}`;
            }
            if (payload.action_topic) {
                payload.action_topic = stateTopic;
            }
            if (payload.current_humidity_topic) {
                payload.current_humidity_topic = stateTopic;
            }
            // Override configuration with user settings.
            if (entity.options.homeassistant != null) {
                const add = (obj, ignoreName) => {
                    for (const key in obj) {
                        if (key === "type" || key === "object_id") {
                            continue;
                        }
                        if (ignoreName && key === "name") {
                            continue;
                        }
                        if (["number", "string", "boolean"].includes(typeof obj[key]) || Array.isArray(obj[key])) {
                            payload[key] = obj[key];
                        }
                        else if (obj[key] === null) {
                            delete payload[key];
                        }
                        else if (key === "device" && typeof obj[key] === "object") {
                            for (const devKey in obj.device) {
                                payload.device[devKey] = obj.device[devKey];
                            }
                        }
                    }
                };
                add(entity.options.homeassistant, true);
                if (entity.options.homeassistant[config.object_id] != null) {
                    add(entity.options.homeassistant[config.object_id], false);
                }
            }
            if (entity.isDevice()) {
                try {
                    entity.definition?.meta?.overrideHaDiscoveryPayload?.(payload);
                }
                catch (error) {
                    logger_1.default.error(`Failed to override HA discovery payload (${error.stack})`);
                }
            }
            const topic = this.getDiscoveryTopic(config, entity);
            const payloadStr = (0, json_stable_stringify_without_jsonify_1.default)(payload);
            newDiscoveredTopics.add(topic);
            // Only discover when not discovered yet
            const discoveredMessage = discovered.messages[topic];
            if (!discoveredMessage || discoveredMessage.payload !== payloadStr || !discoveredMessage.published) {
                discovered.messages[topic] = { payload: payloadStr, published: publish };
                if (publish) {
                    await this.mqtt.publish(topic, payloadStr, {
                        clientOptions: { retain: true, qos: 1 },
                        baseTopic: this.discoveryTopic,
                        skipReceive: false,
                    });
                }
            }
            else {
                logger_1.default.debug(`Skipping discovery of '${topic}', already discovered`);
            }
            if (config.mockProperties) {
                for (const mockProperty of config.mockProperties) {
                    discovered.mockProperties.add(mockProperty);
                }
            }
        }
        for (const topic of lastDiscoveredTopics) {
            const isDeviceAutomation = topic.match(this.discoveryRegexWoTopic)?.[1] === "device_automation";
            if (!newDiscoveredTopics.has(topic) && !isDeviceAutomation) {
                await this.mqtt.publish(topic, "", { clientOptions: { retain: true, qos: 1 }, baseTopic: this.discoveryTopic, skipReceive: false });
            }
        }
    }
    async onMQTTMessage(data) {
        const discoveryMatch = data.topic.match(this.discoveryRegex);
        const isDeviceAutomation = discoveryMatch && discoveryMatch[1] === "device_automation";
        if (discoveryMatch) {
            // Clear outdated discovery configs and remember already discovered device_automations
            let message;
            try {
                message = JSON.parse(data.message);
                const baseTopic = `${settings.get().mqtt.base_topic}/`;
                if (isDeviceAutomation && !message.topic?.startsWith(baseTopic)) {
                    return;
                }
                if (!isDeviceAutomation && !message.availability?.[0].topic.startsWith(baseTopic)) {
                    return;
                }
            }
            catch {
                return;
            }
            // Group discovery topic uses "ENCODEDBASETOPIC_GROUPID", device use ieeeAddr
            const ID = discoveryMatch[2].includes("_") ? discoveryMatch[2].split("_")[1] : discoveryMatch[2];
            const entity = ID === this.bridge.ID ? this.bridge : this.zigbee.resolveEntity(ID);
            let clear = !entity || (entity.isDevice() && !entity.definition);
            // Only save when topic matches otherwise config is not updated when renamed by editing configuration.yaml
            if (entity) {
                const key = `${discoveryMatch[3].substring(0, discoveryMatch[3].indexOf("_"))}`;
                const triggerTopic = `${settings.get().mqtt.base_topic}/${entity.name}/${key}`;
                if (isDeviceAutomation && message.topic === triggerTopic) {
                    this.getDiscovered(ID).triggers.add(discoveryMatch[3]);
                }
            }
            const topic = data.topic.substring(this.discoveryTopic.length + 1);
            if (!clear && !isDeviceAutomation && entity && !(topic in this.getDiscovered(entity).messages)) {
                clear = true;
            }
            // Device was flagged to be excluded from homeassistant discovery
            clear = clear || Boolean(entity && entity.options.homeassistant !== undefined && !entity.options.homeassistant);
            if (clear) {
                logger_1.default.debug(`Clearing outdated Home Assistant config '${data.topic}'`);
                await this.mqtt.publish(topic, "", { clientOptions: { retain: true, qos: 1 }, baseTopic: this.discoveryTopic, skipReceive: false });
            }
            else if (entity) {
                this.getDiscovered(entity).messages[topic] = { payload: (0, json_stable_stringify_without_jsonify_1.default)(message), published: true };
            }
        }
        else if (data.topic === this.statusTopic && data.message.toLowerCase() === "online") {
            const timer = setTimeout(async () => {
                // Publish all device states.
                for (const entity of this.zigbee.devicesAndGroupsIterator(utils_1.default.deviceNotCoordinator)) {
                    if (this.state.exists(entity)) {
                        await this.publishEntityState(entity, this.state.get(entity), "publishCached");
                    }
                }
                clearTimeout(timer);
            }, 30000);
        }
    }
    async onZigbeeEvent(data) {
        if (!this.getDiscovered(data.device).discovered) {
            await this.discover(data.device);
        }
    }
    async onScenesChanged(data) {
        // Re-trigger MQTT discovery of changed devices and groups, similar to bridge.ts
        // First, clear existing scene discovery topics
        logger_1.default.debug(`Clearing Home Assistant scene discovery for '${data.entity.name}'`);
        const discovered = this.getDiscovered(data.entity);
        for (const topic of Object.keys(discovered.messages)) {
            if (topic.startsWith("scene")) {
                await this.mqtt.publish(topic, "", { clientOptions: { retain: true, qos: 1 }, baseTopic: this.discoveryTopic, skipReceive: false });
                delete discovered.messages[topic];
            }
        }
        // Make sure Home Assistant deletes the old entity first otherwise another one (_2) is created
        // https://github.com/Koenkk/zigbee2mqtt/issues/12610
        logger_1.default.debug("Finished clearing scene discovery topics, waiting for Home Assistant.");
        await utils_1.default.sleep(2);
        // Re-discover entity (including any new scenes).
        logger_1.default.debug("Re-discovering entities with their scenes.");
        await this.discover(data.entity);
    }
    getDevicePayload(entity) {
        const identifierPostfix = entity.isGroup() ? `zigbee2mqtt_${this.getEncodedBaseTopic()}` : "zigbee2mqtt";
        // Allow device name to be overridden by homeassistant config
        let deviceName = entity.name;
        if (typeof entity.options.homeassistant?.name === "string") {
            deviceName = entity.options.homeassistant.name;
        }
        const payload = {
            identifiers: [`${identifierPostfix}_${entity.options.ID}`],
            name: deviceName,
            sw_version: `Zigbee2MQTT ${this.zigbee2MQTTVersion}`,
        };
        const url = settings.get().frontend?.url ?? "";
        // Since zigbee2mqtt-windfront support multiple instances the configuration URL contains the
        // instance ID. Since we don't know which instance it is we always point to 0.
        // https://github.com/Koenkk/zigbee2mqtt/issues/28936
        const urlEntityPostfix = settings.get().frontend.package === "zigbee2mqtt-windfront" ? "0/" : "";
        if (entity.isDevice()) {
            (0, node_assert_1.default)(entity.definition, `Cannot 'getDevicePayload' for unsupported device`);
            payload.model = entity.definition.description;
            payload.model_id = entity.definition.model;
            payload.manufacturer = entity.definition.vendor;
            payload.sw_version = entity.zh.softwareBuildID;
            payload.hw_version = entity.zh.hardwareVersion;
            payload.configuration_url = `${url}/#/device/${urlEntityPostfix}${entity.ieeeAddr}/info`;
        }
        else if (entity.isGroup()) {
            payload.model = "Group";
            payload.manufacturer = "Zigbee2MQTT";
            payload.configuration_url = `${url}/#/group/${urlEntityPostfix}${entity.ID}`;
        }
        else {
            payload.model = "Bridge";
            payload.manufacturer = "Zigbee2MQTT";
            payload.hw_version = `${entity.hardwareVersion} ${entity.firmwareVersion}`;
            payload.sw_version = this.zigbee2MQTTVersion;
            payload.configuration_url = `${url}/#/settings`;
        }
        if (!url) {
            delete payload.configuration_url;
        }
        // Link devices & groups to bridge.
        if (entity !== this.bridge) {
            payload.via_device = this.bridgeIdentifier;
        }
        return payload;
    }
    adjustMessageBeforePublish(entity, message) {
        for (const mockProperty of this.getDiscovered(entity).mockProperties) {
            if (message[mockProperty.property] === undefined) {
                message[mockProperty.property] = mockProperty.value;
            }
        }
        // Copy hue -> h, saturation -> s to make homeassistant happy
        if (message.color !== undefined) {
            if (message.color.hue !== undefined) {
                message.color.h = message.color.hue;
            }
            if (message.color.saturation !== undefined) {
                message.color.s = message.color.saturation;
            }
        }
        if (entity.isDevice() && entity.definition?.ota && message.update?.latest_version == null) {
            message.update = { ...message.update, installed_version: -1, latest_version: -1 };
        }
    }
    getEncodedBaseTopic() {
        return settings
            .get()
            .mqtt.base_topic.split("")
            .map((s) => s.charCodeAt(0).toString())
            .join("");
    }
    getDiscoveryTopic(config, entity) {
        const key = entity.isDevice() ? entity.ieeeAddr : `${this.getEncodedBaseTopic()}_${entity.ID}`;
        return `${config.type}/${key}/${config.object_id}/config`;
    }
    async publishDeviceTriggerDiscover(device, key, value, force = false) {
        const haConfig = device.options.homeassistant;
        if (device.options.homeassistant !== undefined &&
            (haConfig == null || (haConfig.device_automation !== undefined && typeof haConfig === "object" && haConfig.device_automation == null))) {
            return;
        }
        const discovered = this.getDiscovered(device);
        const discoveredKey = `${key}_${value}`;
        if (discovered.triggers.has(discoveredKey) && !force) {
            return;
        }
        const config = {
            type: "device_automation",
            object_id: `${key}_${value}`,
            mockProperties: [],
            discovery_payload: {
                automation_type: "trigger",
                type: key,
            },
        };
        const topic = this.getDiscoveryTopic(config, device);
        const payload = {
            ...config.discovery_payload,
            subtype: value,
            payload: value,
            topic: `${settings.get().mqtt.base_topic}/${device.name}/${key}`,
            device: this.getDevicePayload(device),
            origin: this.discoveryOrigin,
        };
        await this.mqtt.publish(topic, (0, json_stable_stringify_without_jsonify_1.default)(payload), {
            clientOptions: { retain: true, qos: 1 },
            baseTopic: this.discoveryTopic,
            skipReceive: false,
        });
        discovered.triggers.add(discoveredKey);
    }
    getBridgeEntity(coordinatorVersion) {
        const coordinatorIeeeAddress = this.zigbee.firstCoordinatorEndpoint().deviceIeeeAddress;
        const discovery = [];
        const bridge = new Bridge(coordinatorIeeeAddress, coordinatorVersion, discovery);
        const baseTopic = `${settings.get().mqtt.base_topic}/${bridge.name}`;
        discovery.push(
        // Binary sensors.
        {
            type: "binary_sensor",
            object_id: "connection_state",
            mockProperties: [],
            discovery_payload: {
                name: "Connection state",
                device_class: "connectivity",
                entity_category: "diagnostic",
                state_topic: true,
                state_topic_postfix: "state",
                value_template: "{{ value_json.state }}",
                payload_on: "online",
                payload_off: "offline",
                availability: false,
            },
        }, {
            type: "binary_sensor",
            object_id: "restart_required",
            mockProperties: [],
            discovery_payload: {
                name: "Restart required",
                device_class: "problem",
                entity_category: "diagnostic",
                enabled_by_default: false,
                state_topic: true,
                state_topic_postfix: "info",
                value_template: "{{ value_json.restart_required }}",
                payload_on: true,
                payload_off: false,
            },
        }, 
        // Buttons.
        {
            type: "button",
            object_id: "restart",
            mockProperties: [],
            discovery_payload: {
                name: "Restart",
                device_class: "restart",
                state_topic: false,
                command_topic: `${baseTopic}/request/restart`,
                payload_press: "",
            },
        }, 
        // Selects.
        {
            type: "select",
            object_id: "log_level",
            mockProperties: [],
            discovery_payload: {
                name: "Log level",
                entity_category: "config",
                state_topic: true,
                state_topic_postfix: "info",
                value_template: "{{ value_json.log_level | lower }}",
                command_topic: `${baseTopic}/request/options`,
                command_template: '{"options": {"advanced": {"log_level": "{{ value }}" } } }',
                options: settings.LOG_LEVELS,
            },
        }, 
        // Sensors:
        {
            type: "sensor",
            object_id: "version",
            mockProperties: [],
            discovery_payload: {
                name: "Version",
                icon: "mdi:zigbee",
                entity_category: "diagnostic",
                state_topic: true,
                state_topic_postfix: "info",
                value_template: "{{ value_json.version }}",
            },
        }, {
            type: "sensor",
            object_id: "coordinator_version",
            mockProperties: [],
            discovery_payload: {
                name: "Coordinator version",
                icon: "mdi:chip",
                entity_category: "diagnostic",
                enabled_by_default: false,
                state_topic: true,
                state_topic_postfix: "info",
                value_template: "{{ value_json.coordinator.meta.revision }}",
            },
        }, {
            type: "sensor",
            object_id: "network_map",
            mockProperties: [],
            discovery_payload: {
                name: "Network map",
                entity_category: "diagnostic",
                enabled_by_default: false,
                state_topic: true,
                state_topic_postfix: "response/networkmap",
                value_template: "{{ now().strftime('%Y-%m-%d %H:%M:%S') }}",
                json_attributes_topic: `${baseTopic}/response/networkmap`,
                json_attributes_template: "{{ value_json.data.value | tojson }}",
            },
        }, 
        // Switches.
        {
            type: "switch",
            object_id: "permit_join",
            mockProperties: [],
            discovery_payload: {
                name: "Permit join",
                icon: "mdi:human-greeting-proximity",
                state_topic: true,
                state_topic_postfix: "info",
                value_template: "{{ value_json.permit_join | lower }}",
                command_topic: `${baseTopic}/request/permit_join`,
                state_on: "true",
                state_off: "false",
                payload_on: '{"time": 254}',
                payload_off: '{"time": 0}',
            },
        });
        return bridge;
    }
    parseActionValue(action) {
        // Handle standard actions.
        for (const p of ACTION_PATTERNS) {
            const m = action.match(p);
            if (m?.groups?.action) {
                return this.buildAction(m.groups);
            }
        }
        // Handle wildcard actions.
        let m = action.match(/^(?<action>recall|scene)_\*(?:_(?<endpoint>e1|e2|s1|s2))?$/);
        if (m?.groups?.action) {
            logger_1.default.debug(`Found scene wildcard action ${m.groups.action}`);
            return this.buildAction(m.groups, { scene: "wildcard" });
        }
        m = action.match(/^(?<actionPrefix>region_)\*_(?<action>enter|leave|occupied|unoccupied)$/);
        if (m?.groups?.action) {
            logger_1.default.debug(`Found region wildcard action ${m.groups.action}`);
            return this.buildAction(m.groups, { region: "wildcard" });
        }
        // If nothing matches, keep the plain action value.
        return { action };
    }
    buildAction(groups, props = {}) {
        utils_1.default.removeNullPropertiesFromObject(groups);
        let a = groups.action;
        if (groups?.actionPrefix) {
            a = groups.actionPrefix + a;
            delete groups.actionPrefix;
        }
        return { ...groups, action: a, ...props };
    }
    prepareActionEventTypes(values) {
        return utils_1.default.arrayUnique(values.map((v) => this.parseActionValue(v.toString()).action).filter((v) => !v.includes("*")));
    }
    parseGroupsFromRegex(pattern) {
        return [...pattern.matchAll(/\(\?<([a-zA-Z]+)>/g)].map((v) => v[1]);
    }
    getActionValueTemplate() {
        // TODO: Implement parsing for all event types.
        const patterns = ACTION_PATTERNS.map((v) => {
            return `{"pattern": '${v.replaceAll(/\?<([a-zA-Z]+)>/g, "?P<$1>")}', "groups": [${this.parseGroupsFromRegex(v)
                .map((g) => `"${g}"`)
                .join(", ")}]}`;
        }).join(",\n");
        const value_template = `{% set patterns = [\n${patterns}\n] %}
{% set action_value = value_json.action|default('') %}
{% set ns = namespace(r=[('action', action_value)]) %}
{% for p in patterns %}
  {% set m = action_value|regex_findall(p.pattern) %}
  {% if m[0] is undefined %}{% continue %}{% endif %}
  {% for key, value in zip(p.groups, m[0]) %}
    {% set ns.r = ns.r|rejectattr(0, 'eq', key)|list + [(key, value)] %}
  {% endfor %}
{% endfor %}
{% if (ns.r|selectattr(0, 'eq', 'actionPrefix')|first) is defined %}
  {% set ns.r = ns.r|rejectattr(0, 'eq', 'action')|list + [('action', ns.r|selectattr(0, 'eq', 'actionPrefix')|map(attribute=1)|first + ns.r|selectattr(0, 'eq', 'action')|map(attribute=1)|first)] %}
{% endif %}
{% set ns.r = ns.r + [('event_type', ns.r|selectattr(0, 'eq', 'action')|map(attribute=1)|first)] %}
{{dict.from_keys(ns.r|rejectattr(0, 'in', ('action', 'actionPrefix'))|reject('eq', ('event_type', None))|reject('eq', ('event_type', '')))|to_json}}`;
        return value_template;
    }
}
exports.HomeAssistant = HomeAssistant;
__decorate([
    bind_decorator_1.default
], HomeAssistant.prototype, "onEntityRemoved", null);
__decorate([
    bind_decorator_1.default
], HomeAssistant.prototype, "onGroupMembersChanged", null);
__decorate([
    bind_decorator_1.default
], HomeAssistant.prototype, "onPublishEntityState", null);
__decorate([
    bind_decorator_1.default
], HomeAssistant.prototype, "onEntityRenamed", null);
__decorate([
    bind_decorator_1.default
], HomeAssistant.prototype, "onMQTTMessage", null);
__decorate([
    bind_decorator_1.default
], HomeAssistant.prototype, "onZigbeeEvent", null);
__decorate([
    bind_decorator_1.default
], HomeAssistant.prototype, "onScenesChanged", null);
exports.default = HomeAssistant;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG9tZWFzc2lzdGFudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi9leHRlbnNpb24vaG9tZWFzc2lzdGFudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSw4REFBaUM7QUFDakMsb0VBQWtDO0FBQ2xDLGtIQUE4RDtBQUc5RCw0REFBb0M7QUFDcEMsMkRBQTZDO0FBQzdDLHVEQUE4STtBQUM5SSw0REFBb0M7QUE2QnBDLE1BQU0sZUFBZSxHQUFhO0lBQzlCLDJFQUEyRTtJQUMzRSxxREFBcUQ7SUFDckQsMEZBQTBGO0lBQzFGLDRFQUE0RTtJQUM1RSx5REFBeUQ7Q0FDNUQsQ0FBQztBQUNGLE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQztBQUMzQixNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUM7QUFDekIsTUFBTSxxQkFBcUIsR0FBMEIsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQztBQUMxRixNQUFNLG9CQUFvQixHQUEwQixDQUFDLFNBQVMsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNuRyxNQUFNLG9CQUFvQixHQUEwQixDQUFDLFNBQVMsRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0FBQzdILE1BQU0sb0JBQW9CLEdBQTBCLENBQUMsU0FBUyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDM0YsTUFBTSxnQkFBZ0IsR0FBMEIsQ0FBQyxpQkFBaUIsRUFBRSxrQkFBa0IsRUFBRSxXQUFXLEVBQUUsV0FBVyxDQUFDLENBQUM7QUFDbEgsTUFBTSx1QkFBdUIsR0FBNEI7SUFDckQsc0JBQXNCLEVBQUUsRUFBQyxJQUFJLEVBQUUsWUFBWSxF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