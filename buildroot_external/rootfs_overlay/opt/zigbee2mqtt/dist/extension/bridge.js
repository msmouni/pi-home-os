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
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const jszip_1 = __importDefault(require("jszip"));
const object_assign_deep_1 = __importDefault(require("object-assign-deep"));
const winston_transport_1 = __importDefault(require("winston-transport"));
const zigbee_herdsman_1 = require("zigbee-herdsman");
const device_1 = require("zigbee-herdsman/dist/controller/model/device");
const zhc = __importStar(require("zigbee-herdsman-converters"));
const device_2 = __importDefault(require("../model/device"));
const data_1 = __importDefault(require("../util/data"));
const logger_1 = __importDefault(require("../util/logger"));
const settings = __importStar(require("../util/settings"));
const utils_1 = __importStar(require("../util/utils"));
const extension_1 = __importDefault(require("./extension"));
class Bridge extends extension_1.default {
    #requestRegex = new RegExp(`${settings.get().mqtt.base_topic}/bridge/request/(.*)`);
    // set on `start`
    #osInfo;
    zigbee2mqttVersion;
    zigbeeHerdsmanVersion;
    zigbeeHerdsmanConvertersVersion;
    coordinatorVersion;
    restartRequired = false;
    lastJoinedDeviceIeeeAddr;
    lastBridgeLoggingPayload;
    logTransport;
    requestLookup = {
        "device/options": this.deviceOptions,
        /** @deprecated 3.0 */
        "device/configure_reporting": this.deviceReportingConfigure,
        "device/reporting/configure": this.deviceReportingConfigure,
        "device/reporting/read": this.deviceReportingRead,
        "device/remove": this.deviceRemove,
        "device/interview": this.deviceInterview,
        "device/generate_external_definition": this.deviceGenerateExternalDefinition,
        "device/rename": this.deviceRename,
        "group/add": this.groupAdd,
        "group/options": this.groupOptions,
        "group/remove": this.groupRemove,
        "group/rename": this.groupRename,
        permit_join: this.permitJoin,
        restart: this.restart,
        backup: this.backup,
        "touchlink/factory_reset": this.touchlinkFactoryReset,
        "touchlink/identify": this.touchlinkIdentify,
        "install_code/add": this.installCodeAdd,
        "touchlink/scan": this.touchlinkScan,
        health_check: this.healthCheck,
        coordinator_check: this.coordinatorCheck,
        options: this.bridgeOptions,
        action: this.action,
    };
    async start() {
        const debugToMQTTFrontend = settings.get().advanced.log_debug_to_mqtt_frontend;
        const bridgeLogging = (message, level, namespace) => {
            const payload = (0, json_stable_stringify_without_jsonify_1.default)({ message, level, namespace });
            if (payload !== this.lastBridgeLoggingPayload) {
                this.lastBridgeLoggingPayload = payload;
                void this.mqtt.publish("bridge/logging", payload, { skipLog: true });
            }
        };
        if (debugToMQTTFrontend) {
            class DebugEventTransport extends winston_transport_1.default {
                log(info, next) {
                    bridgeLogging(info.message, info.level, info.namespace);
                    next();
                }
            }
            this.logTransport = new DebugEventTransport();
        }
        else {
            class EventTransport extends winston_transport_1.default {
                log(info, next) {
                    if (info.level !== "debug") {
                        bridgeLogging(info.message, info.level, info.namespace);
                    }
                    next();
                }
            }
            this.logTransport = new EventTransport();
        }
        logger_1.default.addTransport(this.logTransport);
        const os = await import("node:os");
        const process = await import("node:process");
        const logicalCpuCores = os.cpus();
        this.#osInfo = {
            version: `${os.version()} - ${os.release()} - ${os.arch()}`,
            node_version: process.version,
            cpus: `${[...new Set(logicalCpuCores.map((cpu) => cpu.model))].join(" | ")} (x${logicalCpuCores.length})`,
            memory_mb: Math.round(os.totalmem() / 1024 / 1024),
        };
        this.zigbee2mqttVersion = await utils_1.default.getZigbee2MQTTVersion();
        this.zigbeeHerdsmanVersion = await utils_1.default.getDependencyVersion("zigbee-herdsman");
        this.zigbeeHerdsmanConvertersVersion = await utils_1.default.getDependencyVersion("zigbee-herdsman-converters");
        this.coordinatorVersion = await this.zigbee.getCoordinatorVersion();
        this.eventBus.onEntityRenamed(this, async () => {
            await this.publishInfo();
        });
        this.eventBus.onGroupMembersChanged(this, async () => {
            await this.publishGroups();
        });
        this.eventBus.onDevicesChanged(this, async () => {
            await this.publishDevices();
            await this.publishInfo();
            await this.publishDefinitions();
        });
        this.eventBus.onPermitJoinChanged(this, async () => {
            if (!this.zigbee.isStopping()) {
                await this.publishInfo();
            }
        });
        this.eventBus.onScenesChanged(this, async () => {
            await this.publishDevices();
            await this.publishGroups();
        });
        // Zigbee events
        this.eventBus.onDeviceJoined(this, async (data) => {
            this.lastJoinedDeviceIeeeAddr = data.device.ieeeAddr;
            await this.publishDevices();
            const payload = {
                type: "device_joined",
                data: { friendly_name: data.device.name, ieee_address: data.device.ieeeAddr },
            };
            await this.mqtt.publish("bridge/event", (0, json_stable_stringify_without_jsonify_1.default)(payload));
        });
        this.eventBus.onDeviceLeave(this, async (data) => {
            await this.publishDevices();
            await this.publishDefinitions();
            const payload = { type: "device_leave", data: { ieee_address: data.ieeeAddr, friendly_name: data.name } };
            await this.mqtt.publish("bridge/event", (0, json_stable_stringify_without_jsonify_1.default)(payload));
        });
        this.eventBus.onDeviceNetworkAddressChanged(this, async () => {
            await this.publishDevices();
        });
        this.eventBus.onDeviceInterview(this, async (data) => {
            await this.publishDevices();
            let payload;
            if (data.status === "successful") {
                payload = {
                    type: "device_interview",
                    data: {
                        friendly_name: data.device.name,
                        status: data.status,
                        ieee_address: data.device.ieeeAddr,
                        supported: data.device.isSupported,
                        definition: this.getDefinitionPayload(data.device),
                    },
                };
            }
            else {
                payload = {
                    type: "device_interview",
                    data: { friendly_name: data.device.name, status: data.status, ieee_address: data.device.ieeeAddr },
                };
            }
            await this.mqtt.publish("bridge/event", (0, json_stable_stringify_without_jsonify_1.default)(payload));
        });
        this.eventBus.onDeviceAnnounce(this, async (data) => {
            await this.publishDevices();
            const payload = {
                type: "device_announce",
                data: { friendly_name: data.device.name, ieee_address: data.device.ieeeAddr },
            };
            await this.mqtt.publish("bridge/event", (0, json_stable_stringify_without_jsonify_1.default)(payload));
        });
        await this.publishInfo();
        await this.publishDevices();
        await this.publishGroups();
        await this.publishDefinitions();
        this.eventBus.onMQTTMessage(this, this.onMQTTMessage);
    }
    async stop() {
        await super.stop();
        logger_1.default.removeTransport(this.logTransport);
    }
    async onMQTTMessage(data) {
        const match = data.topic.match(this.#requestRegex);
        if (!match) {
            return;
        }
        const key = match[1].toLowerCase();
        if (key in this.requestLookup) {
            const message = utils_1.default.parseJSON(data.message, data.message);
            try {
                const response = await this.requestLookup[key](message);
                await this.mqtt.publish(`bridge/response/${match[1]}`, (0, json_stable_stringify_without_jsonify_1.default)(response));
            }
            catch (error) {
                logger_1.default.error(`Request '${data.topic}' failed with error: '${error.message}'`);
                // biome-ignore lint/style/noNonNullAssertion: always using Error
                logger_1.default.debug(error.stack);
                const response = utils_1.default.getResponse(message, {}, error.message);
                await this.mqtt.publish(`bridge/response/${match[1]}`, (0, json_stable_stringify_without_jsonify_1.default)(response));
            }
        }
    }
    /**
     * Requests
     */
    async deviceOptions(message) {
        return await this.changeEntityOptions("device", message);
    }
    async groupOptions(message) {
        return await this.changeEntityOptions("group", message);
    }
    async bridgeOptions(message) {
        if (typeof message !== "object" || typeof message.options !== "object") {
            throw new Error("Invalid payload");
        }
        const newSettings = message.options;
        this.restartRequired = settings.apply(newSettings);
        // Apply some settings on-the-fly.
        if (newSettings.homeassistant) {
            await this.enableDisableExtension(settings.get().homeassistant.enabled, "HomeAssistant");
        }
        if (newSettings.advanced?.log_level != null) {
            logger_1.default.setLevel(settings.get().advanced.log_level);
        }
        if (newSettings.advanced?.log_namespaced_levels != null) {
            logger_1.default.setNamespacedLevels(settings.get().advanced.log_namespaced_levels);
        }
        if (newSettings.advanced?.log_debug_namespace_ignore != null) {
            logger_1.default.setDebugNamespaceIgnore(settings.get().advanced.log_debug_namespace_ignore);
        }
        logger_1.default.info("Successfully changed options");
        await this.publishInfo();
        return utils_1.default.getResponse(message, { restart_required: this.restartRequired });
    }
    async deviceRemove(message) {
        return await this.removeEntity("device", message);
    }
    async groupRemove(message) {
        return await this.removeEntity("group", message);
    }
    // biome-ignore lint/suspicious/useAwait: API
    async healthCheck(message) {
        return utils_1.default.getResponse(message, { healthy: true });
    }
    async coordinatorCheck(message) {
        const result = await this.zigbee.coordinatorCheck();
        const missingRouters = result.missingRouters.map((d) => {
            return { ieee_address: d.ieeeAddr, friendly_name: d.name };
        });
        return utils_1.default.getResponse(message, { missing_routers: missingRouters });
    }
    async groupAdd(message) {
        if (typeof message === "object" && message.friendly_name === undefined) {
            throw new Error("Invalid payload");
        }
        const friendlyName = typeof message === "object" ? message.friendly_name : message;
        const ID = typeof message === "object" && message.id !== undefined ? message.id : null;
        const group = settings.addGroup(friendlyName, ID);
        this.zigbee.createGroup(group.ID);
        await this.publishGroups();
        return utils_1.default.getResponse(message, { friendly_name: group.friendly_name, id: group.ID });
    }
    async deviceRename(message) {
        return await this.renameEntity("device", message);
    }
    async groupRename(message) {
        return await this.renameEntity("group", message);
    }
    // biome-ignore lint/suspicious/useAwait: API
    async restart(message) {
        // Wait 500 ms before restarting so response can be send.
        setTimeout(this.restartCallback, 500);
        logger_1.default.info("Restarting Zigbee2MQTT");
        return utils_1.default.getResponse(message, {});
    }
    async backup(message) {
        await this.zigbee.backup();
        const dataPath = data_1.default.getPath();
        const files = utils_1.default.getAllFiles(dataPath);
        const zip = new jszip_1.default();
        const logDir = `log${node_path_1.default.sep}`;
        const otaDir = `ota${node_path_1.default.sep}`;
        for (const f of files) {
            const name = f.slice(dataPath.length + 1);
            // XXX: `log` could technically be something else depending on `log_directory` setting
            if (!name.startsWith(logDir) && !name.startsWith(otaDir)) {
                zip.file(name, node_fs_1.default.readFileSync(f));
            }
        }
        const base64Zip = await zip.generateAsync({ type: "base64" });
        return utils_1.default.getResponse(message, { zip: base64Zip });
    }
    async installCodeAdd(message) {
        if (typeof message === "object" && message.value === undefined) {
            throw new Error("Invalid payload");
        }
        const value = typeof message === "object" ? message.value : message;
        await this.zigbee.addInstallCode(value);
        logger_1.default.info("Successfully added new install code");
        return utils_1.default.getResponse(message, { value });
    }
    async permitJoin(message) {
        let time;
        let device;
        if (typeof message === "object") {
            if (message.time === undefined) {
                throw new Error("Invalid payload");
            }
            time = Number.parseInt(message.time, 10);
            if (message.device) {
                const resolved = this.zigbee.resolveEntity(message.device);
                if (resolved instanceof device_2.default) {
                    device = resolved;
                }
                else {
                    throw new Error(`Device '${message.device}' does not exist`);
                }
            }
        }
        else {
            time = Number.parseInt(message, 10);
        }
        await this.zigbee.permitJoin(time, device);
        const response = { time };
        if (device) {
            response.device = device.name;
        }
        return utils_1.default.getResponse(message, response);
    }
    async touchlinkIdentify(message) {
        if (typeof message !== "object" || message.ieee_address === undefined || message.channel === undefined) {
            throw new Error("Invalid payload");
        }
        logger_1.default.info(`Start Touchlink identify of '${message.ieee_address}' on channel ${message.channel}`);
        await this.zigbee.touchlinkIdentify(message.ieee_address, message.channel);
        return utils_1.default.getResponse(message, { ieee_address: message.ieee_address, channel: message.channel });
    }
    async touchlinkFactoryReset(message) {
        let result = false;
        let payload = {};
        if (typeof message === "object" && message.ieee_address !== undefined && message.channel !== undefined) {
            logger_1.default.info(`Start Touchlink factory reset of '${message.ieee_address}' on channel ${message.channel}`);
            result = await this.zigbee.touchlinkFactoryReset(message.ieee_address, message.channel);
            payload = {
                ieee_address: message.ieee_address,
                channel: message.channel,
            };
        }
        else {
            logger_1.default.info("Start Touchlink factory reset of first found device");
            result = await this.zigbee.touchlinkFactoryResetFirst();
        }
        if (result) {
            logger_1.default.info("Successfully factory reset device through Touchlink");
            return utils_1.default.getResponse(message, payload);
        }
        logger_1.default.error("Failed to factory reset device through Touchlink");
        throw new Error("Failed to factory reset device through Touchlink");
    }
    async touchlinkScan(message) {
        logger_1.default.info("Start Touchlink scan");
        const result = await this.zigbee.touchlinkScan();
        const found = result.map((r) => {
            return { ieee_address: r.ieeeAddr, channel: r.channel };
        });
        logger_1.default.info("Finished Touchlink scan");
        return utils_1.default.getResponse(message, { found });
    }
    /**
     * Utils
     */
    async changeEntityOptions(entityType, message) {
        if (typeof message !== "object" || message.id === undefined || message.options === undefined) {
            throw new Error("Invalid payload");
        }
        const cleanup = (o) => {
            delete o.friendlyName;
            delete o.friendly_name;
            delete o.ID;
            delete o.type;
            delete o.devices;
            return o;
        };
        const ID = message.id;
        const entity = this.getEntity(entityType, ID);
        const oldOptions = (0, object_assign_deep_1.default)({}, cleanup(entity.options));
        if (message.options.icon) {
            const base64Match = utils_1.default.matchBase64File(message.options.icon);
            if (base64Match) {
                const fileSettings = utils_1.default.saveBase64DeviceIcon(base64Match);
                message.options.icon = fileSettings;
                logger_1.default.debug(`Saved base64 image as file to '${fileSettings}'`);
            }
        }
        const restartRequired = settings.changeEntityOptions(ID, message.options);
        if (restartRequired)
            this.restartRequired = true;
        const newOptions = cleanup(entity.options);
        await this.publishInfo();
        logger_1.default.info(`Changed config for ${entityType} ${ID}`);
        this.eventBus.emitEntityOptionsChanged({ from: oldOptions, to: newOptions, entity });
        return utils_1.default.getResponse(message, { from: oldOptions, to: newOptions, id: ID, restart_required: this.restartRequired });
    }
    async deviceReportingConfigure(message) {
        if (typeof message !== "object" ||
            message.id === undefined ||
            message.endpoint === undefined ||
            message.cluster === undefined ||
            message.attribute === undefined ||
            typeof message.maximum_report_interval !== "number" ||
            typeof message.minimum_report_interval !== "number" ||
            (message.reportable_change !== undefined && typeof message.reportable_change !== "number")) {
            throw new Error("Invalid payload");
        }
        const device = this.getEntity("device", message.id);
        const endpoint = device.endpoint(message.endpoint);
        if (!endpoint) {
            throw new Error(`Device '${device.ID}' does not have endpoint '${message.endpoint}'`);
        }
        const coordinatorEndpoint = this.zigbee.firstCoordinatorEndpoint();
        await endpoint.bind(message.cluster, coordinatorEndpoint);
        await endpoint.configureReporting(message.cluster, [
            {
                attribute: message.attribute,
                minimumReportInterval: message.minimum_report_interval,
                maximumReportInterval: message.maximum_report_interval,
                reportableChange: message.reportable_change,
            },
        ], message.options);
        await this.publishDevices();
        logger_1.default.info(`Configured reporting for '${message.id}', '${message.cluster}.${message.attribute}'`);
        return utils_1.default.getResponse(message, {
            id: message.id,
            endpoint: message.endpoint,
            cluster: message.cluster,
            maximum_report_interval: message.maximum_report_interval,
            minimum_report_interval: message.minimum_report_interval,
            reportable_change: message.reportable_change,
            attribute: message.attribute,
        });
    }
    async deviceReportingRead(message) {
        if (typeof message !== "object" ||
            message.id === undefined ||
            message.endpoint === undefined ||
            message.cluster === undefined ||
            message.configs === undefined) {
            throw new Error("Invalid payload");
        }
        const device = this.getEntity("device", message.id);
        const endpoint = device.endpoint(message.endpoint);
        if (!endpoint) {
            throw new Error(`Device '${device.ID}' does not have endpoint '${message.endpoint}'`);
        }
        const response = await endpoint.readReportingConfig(message.cluster, message.configs, message.manufacturer_code ? { manufacturerCode: message.manufacturer_code } : {});
        await this.publishDevices();
        const responseData = {
            id: message.id,
            endpoint: message.endpoint,
            cluster: message.cluster,
            configs: response,
        };
        if (message.manufacturer_code) {
            responseData.manufacturer_code = message.manufacturer_code;
        }
        return utils_1.default.getResponse(message, responseData);
    }
    async deviceInterview(message) {
        if (typeof message !== "object" || message.id === undefined) {
            throw new Error("Invalid payload");
        }
        const device = this.getEntity("device", message.id);
        await device.reInterview(this.eventBus);
        return utils_1.default.getResponse(message, { id: message.id });
    }
    async deviceGenerateExternalDefinition(message) {
        if (typeof message !== "object" || message.id === undefined) {
            throw new Error("Invalid payload");
        }
        const device = this.getEntity("device", message.id);
        const source = await zhc.generateExternalDefinitionSource(device.zh);
        return utils_1.default.getResponse(message, { id: message.id, source });
    }
    async action(message) {
        if (typeof message !== "object" || !message.action) {
            throw new Error("Invalid payload");
        }
        const action = zhc.ACTIONS[message.action];
        if (action === undefined) {
            throw new Error("Invalid action");
        }
        const response = await action(this.zigbee.zhController, message.params ?? {});
        return utils_1.default.getResponse(message, response);
    }
    async renameEntity(entityType, message) {
        const deviceAndHasLast = entityType === "device" && typeof message === "object" && message.last === true;
        if (typeof message !== "object" || (message.from === undefined && !deviceAndHasLast) || message.to === undefined) {
            throw new Error("Invalid payload");
        }
        if (deviceAndHasLast && !this.lastJoinedDeviceIeeeAddr) {
            throw new Error("No device has joined since start");
        }
        const from = deviceAndHasLast ? this.lastJoinedDeviceIeeeAddr : message.from;
        (0, utils_1.assertString)(message.to, "to");
        const to = message.to.trim();
        const homeAssisantRename = message.homeassistant_rename !== undefined ? message.homeassistant_rename : false;
        const entity = this.getEntity(entityType, from);
        const oldFriendlyName = entity.options.friendly_name;
        settings.changeFriendlyName(from, to);
        // Clear retained messages
        await this.mqtt.publish(oldFriendlyName, "", { clientOptions: { retain: true } });
        this.eventBus.emitEntityRenamed({ entity: entity, homeAssisantRename, from: oldFriendlyName, to });
        if (entity instanceof device_2.default) {
            await this.publishDevices();
        }
        else {
            await this.publishGroups();
            await this.publishInfo();
        }
        // Republish entity state
        await this.publishEntityState(entity, {});
        return utils_1.default.getResponse(message, { from: oldFriendlyName, to, homeassistant_rename: homeAssisantRename });
    }
    async removeEntity(entityType, message) {
        const ID = typeof message === "object" ? message.id : message.trim();
        const entity = this.getEntity(entityType, ID);
        // note: entity.name is dynamically retrieved, will change once device is removed (friendly => ieee)
        const friendlyName = entity.name;
        let block = false;
        let force = false;
        let blockForceLog = "";
        if (entityType === "device" && typeof message === "object") {
            block = !!message.block;
            force = !!message.force;
            blockForceLog = ` (block: ${block}, force: ${force})`;
        }
        else if (entityType === "group" && typeof message === "object") {
            force = !!message.force;
            blockForceLog = ` (force: ${force})`;
        }
        try {
            logger_1.default.info(`Removing ${entityType} '${friendlyName}'${blockForceLog}`);
            if (entity instanceof device_2.default) {
                if (block) {
                    settings.blockDevice(entity.ieeeAddr);
                }
                if (force) {
                    entity.zh.removeFromDatabase();
                }
                else {
                    await entity.zh.removeFromNetwork();
                }
                settings.removeDevice(entity.ID);
            }
            else {
                if (force) {
                    entity.zh.removeFromDatabase();
                }
                else {
                    await entity.zh.removeFromNetwork();
                }
                this.zigbee.removeGroupFromLookup(entity.ID);
                settings.removeGroup(entity.ID);
            }
            this.eventBus.emitEntityRemoved({ entity, name: friendlyName });
            // Remove from state
            this.state.remove(entity.ID);
            // Clear any retained messages
            await this.mqtt.publish(friendlyName, "", { clientOptions: { retain: true } });
            logger_1.default.info(`Successfully removed ${entityType} '${friendlyName}'${blockForceLog}`);
            if (entity instanceof device_2.default) {
                await this.publishGroups();
                await this.publishDevices();
                // Refresh Cluster definition
                await this.publishDefinitions();
                const responseData = { id: ID, block, force };
                return utils_1.default.getResponse(message, responseData);
            }
            await this.publishGroups();
            const responseData = { id: ID, force };
            return utils_1.default.getResponse(message, 
            // @ts-expect-error typing infer does not work here
            responseData);
        }
        catch (error) {
            throw new Error(`Failed to remove ${entityType} '${friendlyName}'${blockForceLog} (${error})`);
        }
    }
    getEntity(type, id) {
        const entity = this.zigbee.resolveEntity(id);
        if (!entity || entity.constructor.name.toLowerCase() !== type) {
            throw new Error(`${utils_1.default.capitalize(type)} '${id}' does not exist`);
        }
        return entity;
    }
    async publishInfo() {
        const config = (0, object_assign_deep_1.default)({}, settings.get());
        // @ts-expect-error hidden from publish
        delete config.advanced.network_key;
        delete config.mqtt.password;
        delete config.frontend.auth_token;
        const networkParams = await this.zigbee.getNetworkParameters();
        const payload = {
            os: this.#osInfo,
            mqtt: this.mqtt.info,
            version: this.zigbee2mqttVersion.version,
            commit: this.zigbee2mqttVersion.commitHash,
            zigbee_herdsman_converters: this.zigbeeHerdsmanConvertersVersion,
            zigbee_herdsman: this.zigbeeHerdsmanVersion,
            coordinator: {
                ieee_address: this.zigbee.firstCoordinatorEndpoint().deviceIeeeAddress,
                ...this.coordinatorVersion,
            },
            network: {
                pan_id: networkParams.panID,
                extended_pan_id: networkParams.extendedPanID,
                channel: networkParams.channel,
            },
            log_level: logger_1.default.getLevel(),
            permit_join: this.zigbee.getPermitJoin(),
            permit_join_end: this.zigbee.getPermitJoinEnd(),
            restart_required: this.restartRequired,
            config,
            config_schema: settings.schemaJson,
        };
        await this.mqtt.publish("bridge/info", (0, json_stable_stringify_without_jsonify_1.default)(payload), { clientOptions: { retain: true }, skipLog: true });
    }
    async publishDevices() {
        const devices = [];
        for (const device of this.zigbee.devicesIterator()) {
            const endpoints = {};
            for (const endpoint of device.zh.endpoints) {
                const data = {
                    name: device.endpointName(endpoint),
                    scenes: utils_1.default.getScenes(endpoint),
                    bindings: [],
                    configured_reportings: [],
                    clusters: {
                        input: endpoint.getInputClusters().map((c) => c.name),
                        output: endpoint.getOutputClusters().map((c) => c.name),
                    },
                };
                for (const bind of endpoint.binds) {
                    const target = utils_1.default.isZHEndpoint(bind.target)
                        ? { type: "endpoint", ieee_address: bind.target.deviceIeeeAddress, endpoint: bind.target.ID }
                        : { type: "group", id: bind.target.groupID };
                    data.bindings.push({ cluster: bind.cluster.name, target });
                }
                for (const configuredReporting of endpoint.configuredReportings) {
                    data.configured_reportings.push({
                        cluster: configuredReporting.cluster.name,
                        attribute: configuredReporting.attribute.name || configuredReporting.attribute.ID,
                        minimum_report_interval: configuredReporting.minimumReportInterval,
                        maximum_report_interval: configuredReporting.maximumReportInterval,
                        reportable_change: configuredReporting.reportableChange,
                    });
                }
                endpoints[endpoint.ID] = data;
            }
            devices.push({
                ieee_address: device.ieeeAddr,
                type: device.zh.type,
                network_address: device.zh.networkAddress,
                supported: device.isSupported,
                friendly_name: device.name,
                disabled: !!device.options.disabled,
                description: device.options.description,
                definition: this.getDefinitionPayload(device),
                power_source: device.zh.powerSource,
                software_build_id: device.zh.softwareBuildID,
                date_code: device.zh.dateCode,
                model_id: device.zh.modelID,
                /** @deprecated interviewing and interview_completed are superceded by interview_state */
                interviewing: device.zh.interviewState === device_1.InterviewState.InProgress,
                interview_completed: device.zh.interviewState === device_1.InterviewState.Successful,
                interview_state: device.zh.interviewState,
                manufacturer: device.zh.manufacturerName,
                endpoints,
            });
        }
        await this.mqtt.publish("bridge/devices", (0, json_stable_stringify_without_jsonify_1.default)(devices), { clientOptions: { retain: true }, skipLog: true });
    }
    async publishGroups() {
        const groups = [];
        for (const group of this.zigbee.groupsIterator()) {
            const members = [];
            for (const member of group.zh.members) {
                members.push({ ieee_address: member.deviceIeeeAddress, endpoint: member.ID });
            }
            groups.push({
                id: group.ID,
                friendly_name: group.ID === utils_1.DEFAULT_BIND_GROUP_ID ? "default_bind_group" : group.name,
                description: group.options.description,
                scenes: utils_1.default.getScenes(group.zh),
                members,
            });
        }
        await this.mqtt.publish("bridge/groups", (0, json_stable_stringify_without_jsonify_1.default)(groups), { clientOptions: { retain: true }, skipLog: true });
    }
    async publishDefinitions() {
        const data = {
            clusters: zigbee_herdsman_1.Zcl.Clusters,
            custom_clusters: {},
            actions: Object.keys(zhc.ACTIONS),
        };
        for (const device of this.zigbee.devicesIterator((d) => !utils_1.default.objectIsEmpty(d.customClusters))) {
            data.custom_clusters[device.ieeeAddr] = device.customClusters;
        }
        await this.mqtt.publish("bridge/definitions", (0, json_stable_stringify_without_jsonify_1.default)(data), { clientOptions: { retain: true }, skipLog: true });
    }
    getDefinitionPayload(device) {
        if (!device.definition) {
            return undefined;
        }
        // TODO: better typing to avoid @ts-expect-error
        // @ts-expect-error icon is valid for external definitions
        const definitionIcon = device.definition.icon;
        let icon = device.options.icon ?? definitionIcon;
        if (icon) {
            /* v8 ignore next */
            icon = icon.replace("$zigbeeModel", utils_1.default.sanitizeImageParameter(device.zh.modelID ?? ""));
            icon = icon.replace("$model", utils_1.default.sanitizeImageParameter(device.definition.model));
        }
        const payload = {
            source: device.definition.externalConverterName ? "external" : device.definition.generated ? "generated" : "native",
            model: device.definition.model,
            vendor: device.definition.vendor,
            description: device.definition.description,
            exposes: device.exposes(),
            supports_ota: !!device.definition.ota,
            options: device.definition.options ?? [],
            version: device.definition.version,
            icon,
        };
        return payload;
    }
}
exports.default = Bridge;
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "onMQTTMessage", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "deviceOptions", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "groupOptions", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "bridgeOptions", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "deviceRemove", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "groupRemove", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "healthCheck", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "coordinatorCheck", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "groupAdd", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "deviceRename", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "groupRename", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "restart", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "backup", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "installCodeAdd", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "permitJoin", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "touchlinkIdentify", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "touchlinkFactoryReset", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "touchlinkScan", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "deviceReportingConfigure", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "deviceReportingRead", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "deviceInterview", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "deviceGenerateExternalDefinition", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "action", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJpZGdlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL2V4dGVuc2lvbi9icmlkZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxzREFBeUI7QUFDekIsMERBQTZCO0FBQzdCLG9FQUFrQztBQUNsQyxrSEFBOEQ7QUFDOUQsa0RBQTBCO0FBQzFCLDRFQUFrRDtBQUVsRCwwRUFBMEM7QUFDMUMscURBQW9DO0FBQ3BDLHlFQUE0RTtBQUM1RSxnRUFBa0Q7QUFDbEQsNkRBQXFDO0FBR3JDLHdEQUFnQztBQUNoQyw0REFBb0M7QUFDcEMsMkRBQTZDO0FBQzdDLHVEQUF5RTtBQUN6RSw0REFBb0M7QUFFcEMsTUFBcUIsTUFBTyxTQUFRLG1CQUFTO0lBQ3pDLGFBQWEsR0FBRyxJQUFJLE1BQU0sQ0FBQyxHQUFHLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxzQkFBc0IsQ0FBQyxDQUFDO0lBQ3BGLGlCQUFpQjtJQUNqQixPQUFPLENBQXVDO0lBQ3RDLGtCQUFrQixDQUEwQztJQUM1RCxxQkFBcUIsQ0FBcUI7SUFDMUMsK0JBQStCLENBQXFCO0lBQ3BELGtCQUFrQixDQUF5QjtJQUMzQyxlQUFlLEdBQUcsS0FBSyxDQUFDO0lBQ3hCLHdCQUF3QixDQUFVO0lBQ2xDLHdCQUF3QixDQUFVO0lBQ2xDLFlBQVksQ0FBcUI7SUFDakMsYUFBYSxHQUFnSDtRQUNqSSxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsYUFBYTtRQUNwQyxzQkFBc0I7UUFDdEIsNEJBQTRCLEVBQUUsSUFBSSxDQUFDLHdCQUF3QjtRQUMzRCw0QkFBNEIsRUFBRSxJQUFJLENBQUMsd0JBQXdCO1FBQzNELHVCQUF1QixFQUFFLElBQUksQ0FBQyxtQkFBbUI7UUFDakQsZUFBZSxFQUFFLElBQUksQ0FBQyxZQUFZO1FBQ2xDLGtCQUFrQixFQUFFLElBQUksQ0FBQyxl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