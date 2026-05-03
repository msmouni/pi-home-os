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
const node_crypto_1 = require("node:crypto");
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const zigbee_herdsman_1 = require("zigbee-herdsman");
const device_1 = __importDefault(require("./model/device"));
const group_1 = __importDefault(require("./model/group"));
const data_1 = __importDefault(require("./util/data"));
const logger_1 = __importDefault(require("./util/logger"));
const settings = __importStar(require("./util/settings"));
const utils_1 = __importDefault(require("./util/utils"));
const entityIDRegex = /^(.+?)(?:\/([^/]+))?$/;
class Zigbee {
    #herdsman;
    eventBus;
    groupLookup = new Map();
    deviceLookup = new Map();
    coordinatorIeeeAddr;
    constructor(eventBus) {
        this.eventBus = eventBus;
    }
    get zhController() {
        return this.#herdsman;
    }
    async start(abortSignal) {
        const infoHerdsman = await utils_1.default.getDependencyVersion("zigbee-herdsman");
        logger_1.default.info(`Starting zigbee-herdsman (${infoHerdsman.version})`);
        const panId = settings.get().advanced.pan_id;
        const extPanId = settings.get().advanced.ext_pan_id;
        const networkKey = settings.get().advanced.network_key;
        const herdsmanSettings = {
            network: {
                panID: panId === "GENERATE" ? this.generatePanID() : panId,
                extendedPanID: extPanId === "GENERATE" ? this.generateExtPanID() : extPanId,
                channelList: [settings.get().advanced.channel],
                networkKey: networkKey === "GENERATE" ? this.generateNetworkKey() : networkKey,
            },
            databasePath: data_1.default.joinPath("database.db"),
            databaseBackupPath: data_1.default.joinPath("database.db.backup"),
            backupPath: data_1.default.joinPath("coordinator_backup.json"),
            serialPort: {
                baudRate: settings.get().serial.baudrate,
                rtscts: settings.get().serial.rtscts,
                path: settings.get().serial.port,
                adapter: settings.get().serial.adapter,
            },
            adapter: {
                concurrent: settings.get().advanced.adapter_concurrent,
                delay: settings.get().advanced.adapter_delay,
                disableLED: settings.get().serial.disable_led,
                transmitPower: settings.get().advanced.transmit_power,
            },
            acceptJoiningDeviceHandler: this.acceptJoiningDeviceHandler,
        };
        logger_1.default.debug(() => `Using zigbee-herdsman with settings: '${(0, json_stable_stringify_without_jsonify_1.default)(JSON.stringify(herdsmanSettings).replaceAll(JSON.stringify(herdsmanSettings.network.networkKey), '"HIDDEN"'))}'`);
        let startResult;
        try {
            this.#herdsman = new zigbee_herdsman_1.Controller(herdsmanSettings);
            startResult = await this.#herdsman.start(abortSignal);
        }
        catch (error) {
            logger_1.default.error("Error while starting zigbee-herdsman");
            throw error;
        }
        this.coordinatorIeeeAddr = this.#herdsman.getDevicesByType("Coordinator")[0].ieeeAddr;
        await this.resolveDevicesDefinitions(false, abortSignal);
        if (abortSignal.aborted) {
            return false;
        }
        this.#herdsman.on("adapterDisconnected", () => this.eventBus.emitAdapterDisconnected());
        this.#herdsman.on("lastSeenChanged", (data) => {
            // biome-ignore lint/style/noNonNullAssertion: assumed valid
            this.eventBus.emitLastSeenChanged({ device: this.resolveDevice(data.device.ieeeAddr), reason: data.reason });
        });
        this.#herdsman.on("permitJoinChanged", (data) => {
            this.eventBus.emitPermitJoinChanged(data);
        });
        this.#herdsman.on("deviceNetworkAddressChanged", (data) => {
            // biome-ignore lint/style/noNonNullAssertion: assumed valid
            const device = this.resolveDevice(data.device.ieeeAddr);
            logger_1.default.debug(`Device '${device.name}' changed network address`);
            this.eventBus.emitDeviceNetworkAddressChanged({ device });
        });
        this.#herdsman.on("deviceAnnounce", (data) => {
            // biome-ignore lint/style/noNonNullAssertion: assumed valid
            const device = this.resolveDevice(data.device.ieeeAddr);
            logger_1.default.debug(`Device '${device.name}' announced itself`);
            this.eventBus.emitDeviceAnnounce({ device });
        });
        this.#herdsman.on("deviceInterview", async (data) => {
            const device = this.resolveDevice(data.device.ieeeAddr);
            /* v8 ignore next */ if (!device)
                return; // Prevent potential race
            await device.resolveDefinition();
            const d = { device, status: data.status };
            this.logDeviceInterview(d);
            this.eventBus.emitDeviceInterview(d);
        });
        this.#herdsman.on("deviceJoined", async (data) => {
            const device = this.resolveDevice(data.device.ieeeAddr);
            /* v8 ignore next */ if (!device)
                return; // Prevent potential race
            await device.resolveDefinition();
            logger_1.default.info(`Device '${device.name}' joined`);
            this.eventBus.emitDeviceJoined({ device });
        });
        this.#herdsman.on("deviceLeave", (data) => {
            const name = settings.getDevice(data.ieeeAddr)?.friendly_name || data.ieeeAddr;
            logger_1.default.warning(`Device '${name}' left the network`);
            this.eventBus.emitDeviceLeave({ ieeeAddr: data.ieeeAddr, name, device: this.deviceLookup.get(data.ieeeAddr) });
        });
        this.#herdsman.on("message", async (data) => {
            // biome-ignore lint/style/noNonNullAssertion: assumed valid
            const device = this.resolveDevice(data.device.ieeeAddr);
            await device.resolveDefinition();
            logger_1.default.debug(() => {
                const groupId = data.groupID !== undefined ? ` with groupID ${data.groupID}` : "";
                const fromCoord = device.zh.type === "Coordinator" ? ", ignoring since it is from coordinator" : "";
                return `Received Zigbee message from '${device.name}', type '${data.type}', cluster '${data.cluster}', data '${(0, json_stable_stringify_without_jsonify_1.default)(data.data)}' from endpoint ${data.endpoint.ID}${groupId}${fromCoord}`;
            });
            if (device.zh.type === "Coordinator")
                return;
            this.eventBus.emitDeviceMessage({ ...data, device });
        });
        logger_1.default.info(`zigbee-herdsman started (${startResult})`);
        logger_1.default.info(`Coordinator firmware version: '${(0, json_stable_stringify_without_jsonify_1.default)(await this.getCoordinatorVersion())}'`);
        logger_1.default.debug(`Zigbee network parameters: ${(0, json_stable_stringify_without_jsonify_1.default)(await this.#herdsman.getNetworkParameters())}`);
        if (abortSignal.aborted) {
            return false;
        }
        const remove = async (device) => {
            try {
                await device.zh.removeFromNetwork();
            }
            catch (error) {
                logger_1.default.error(`Failed to remove '${device.ieeeAddr}' (${error.message})`);
            }
        };
        // If a passlist is used, all other device will be removed from the network.
        const passlist = settings.get().passlist;
        if (passlist.length > 0) {
            for (const device of this.devicesIterator(utils_1.default.deviceNotCoordinator)) {
                if (!passlist.includes(device.ieeeAddr)) {
                    logger_1.default.warning(`Device not on passlist currently on the network (${device.ieeeAddr}), removing...`);
                    await remove(device);
                    if (abortSignal.aborted) {
                        return false;
                    }
                }
            }
        }
        else {
            for (const ieee of settings.get().blocklist) {
                const device = this.resolveDevice(ieee);
                if (device) {
                    if (device.zh.type === "Coordinator") {
                        continue;
                    }
                    logger_1.default.warning(`Device on blocklist currently on the network (${device.ieeeAddr}), removing...`);
                    await remove(device);
                    if (abortSignal.aborted) {
                        return false;
                    }
                }
                else {
                    logger_1.default.debug(`Ignoring blocklist device ${ieee}, not currently on the network`);
                }
            }
        }
        return true;
    }
    logDeviceInterview(data) {
        const name = data.device.name;
        if (data.status === "successful") {
            logger_1.default.info(`Successfully interviewed '${name}', device has successfully been paired`);
            if (data.device.isSupported) {
                // biome-ignore lint/style/noNonNullAssertion: valid from `isSupported`
                const { vendor, description, model } = data.device.definition;
                logger_1.default.info(`Device '${name}' is supported, identified as: ${vendor} ${description} (${model})`);
            }
            else {
                logger_1.default.warning(`Device '${name}' with Zigbee model '${data.device.zh.modelID}' and manufacturer name '${data.device.zh.manufacturerName}' is NOT supported, please follow https://www.zigbee2mqtt.io/advanced/support-new-devices/01_support_new_devices.html`);
            }
        }
        else if (data.status === "failed") {
            logger_1.default.error(`Failed to interview '${name}', device has not successfully been paired`);
        }
        else {
            // data.status === 'started'
            logger_1.default.info(`Starting interview of '${name}'`);
        }
    }
    generateNetworkKey() {
        const key = Array.from({ length: 16 }, () => (0, node_crypto_1.randomInt)(256));
        settings.set(["advanced", "network_key"], key);
        return key;
    }
    generateExtPanID() {
        const key = Array.from({ length: 8 }, () => (0, node_crypto_1.randomInt)(256));
        settings.set(["advanced", "ext_pan_id"], key);
        return key;
    }
    generatePanID() {
        const panID = (0, node_crypto_1.randomInt)(1, 0xffff - 1);
        settings.set(["advanced", "pan_id"], panID);
        return panID;
    }
    async getCoordinatorVersion() {
        return await this.#herdsman.getCoordinatorVersion();
    }
    isStopping() {
        return this.#herdsman.isStopping();
    }
    async backup() {
        return await this.#herdsman.backup();
    }
    async coordinatorCheck() {
        const check = await this.#herdsman.coordinatorCheck();
        // biome-ignore lint/style/noNonNullAssertion: assumed valid
        return { missingRouters: check.missingRouters.map((d) => this.resolveDevice(d.ieeeAddr)) };
    }
    async getNetworkParameters() {
        return await this.#herdsman.getNetworkParameters();
    }
    async stop() {
        logger_1.default.info("Stopping zigbee-herdsman...");
        await this.#herdsman?.stop(); // could be undefined if this is called during startup (abort)
        logger_1.default.info("Stopped zigbee-herdsman");
    }
    getPermitJoin() {
        return this.#herdsman.getPermitJoin();
    }
    getPermitJoinEnd() {
        return this.#herdsman.getPermitJoinEnd();
    }
    async permitJoin(time, device) {
        if (time > 0) {
            logger_1.default.info(`Zigbee: allowing new devices to join${device ? ` via ${device.name}` : ""}.`);
        }
        else {
            logger_1.default.info("Zigbee: disabling joining new devices.");
        }
        await this.#herdsman.permitJoin(time, device?.zh);
    }
    async resolveDevicesDefinitions(ignoreCache = false, abortSignal = undefined) {
        for (const device of this.devicesIterator(utils_1.default.deviceNotCoordinator)) {
            await device.resolveDefinition(ignoreCache);
            if (abortSignal?.aborted) {
                return;
            }
        }
    }
    resolveDevice(ieeeAddr) {
        if (!this.deviceLookup.has(ieeeAddr)) {
            const device = this.#herdsman.getDeviceByIeeeAddr(ieeeAddr);
            if (device) {
                this.deviceLookup.set(ieeeAddr, new device_1.default(device));
            }
        }
        const device = this.deviceLookup.get(ieeeAddr);
        if (device && !device.zh.isDeleted) {
            device.ensureInSettings();
            return device;
        }
    }
    resolveGroup(groupID) {
        if (!this.groupLookup.has(groupID)) {
            const group = this.#herdsman.getGroupByID(groupID);
            if (group) {
                this.groupLookup.set(groupID, new group_1.default(group, this.resolveDevice));
            }
        }
        const group = this.groupLookup.get(groupID);
        if (group) {
            group.ensureInSettings();
            return group;
        }
    }
    resolveEntity(key) {
        if (typeof key === "object") {
            return this.resolveDevice(key.ieeeAddr);
        }
        if (typeof key === "string" && (key.toLowerCase() === "coordinator" || key === this.coordinatorIeeeAddr)) {
            return this.resolveDevice(this.coordinatorIeeeAddr);
        }
        const settingsDevice = settings.getDevice(key.toString());
        if (settingsDevice) {
            return this.resolveDevice(settingsDevice.ID);
        }
        const groupSettings = settings.getGroup(key);
        if (groupSettings) {
            const group = this.resolveGroup(groupSettings.ID);
            // If group does not exist, create it (since it's already in configuration.yaml)
            return group ? group : this.createGroup(groupSettings.ID);
        }
    }
    resolveEntityAndEndpoint(id) {
        // This function matches the following entity formats:
        // device_name          (just device name)
        // device_name/ep_name  (device name and endpoint numeric ID or name)
        // device/name          (device name with slashes)
        // device/name/ep_name  (device name with slashes, and endpoint numeric ID or name)
        // The function tries to find an exact match first
        let entityName = id;
        let deviceOrGroup = this.resolveEntity(id);
        let endpointNameOrID;
        // If exact match did not happen, try matching a device_name/endpoint pattern
        if (!deviceOrGroup) {
            // First split the input token by the latest slash
            const match = id.match(entityIDRegex);
            if (match) {
                // Get the resulting IDs from the match
                entityName = match[1];
                deviceOrGroup = this.resolveEntity(entityName);
                endpointNameOrID = match[2];
            }
        }
        // If the function returns non-null endpoint name, but the endpoint field is null, then
        // it means that endpoint was not matched because there is no such endpoint on the device
        // (or the entity is a group)
        const endpoint = deviceOrGroup?.isDevice() ? deviceOrGroup.endpoint(endpointNameOrID) : undefined;
        return { ID: entityName, entity: deviceOrGroup, endpointID: endpointNameOrID, endpoint };
    }
    firstCoordinatorEndpoint() {
        return this.#herdsman.getDevicesByType("Coordinator")[0].endpoints[0];
    }
    *devicesAndGroupsIterator(devicePredicate, groupPredicate) {
        for (const device of this.#herdsman.getDevicesIterator(devicePredicate)) {
            // biome-ignore lint/style/noNonNullAssertion: assumed valid
            yield this.resolveDevice(device.ieeeAddr);
        }
        for (const group of this.#herdsman.getGroupsIterator(groupPredicate)) {
            // biome-ignore lint/style/noNonNullAssertion: assumed valid
            yield this.resolveGroup(group.groupID);
        }
    }
    *groupsIterator(predicate) {
        for (const group of this.#herdsman.getGroupsIterator(predicate)) {
            // biome-ignore lint/style/noNonNullAssertion: assumed valid
            yield this.resolveGroup(group.groupID);
        }
    }
    *devicesIterator(predicate) {
        for (const device of this.#herdsman.getDevicesIterator(predicate)) {
            // biome-ignore lint/style/noNonNullAssertion: assumed valid
            yield this.resolveDevice(device.ieeeAddr);
        }
    }
    // biome-ignore lint/suspicious/useAwait: API
    async acceptJoiningDeviceHandler(ieeeAddr) {
        // If passlist is set, all devices not on passlist will be rejected to join the network
        const passlist = settings.get().passlist;
        const blocklist = settings.get().blocklist;
        if (passlist.length > 0) {
            if (passlist.includes(ieeeAddr)) {
                logger_1.default.info(`Accepting joining device which is on passlist '${ieeeAddr}'`);
                return true;
            }
            logger_1.default.info(`Rejecting joining not in passlist device '${ieeeAddr}'`);
            return false;
        }
        if (blocklist.length > 0) {
            if (blocklist.includes(ieeeAddr)) {
                logger_1.default.info(`Rejecting joining device which is on blocklist '${ieeeAddr}'`);
                return false;
            }
            logger_1.default.info(`Accepting joining not in blocklist device '${ieeeAddr}'`);
        }
        return true;
    }
    async touchlinkFactoryResetFirst() {
        return await this.#herdsman.touchlink.factoryResetFirst();
    }
    async touchlinkFactoryReset(ieeeAddr, channel) {
        return await this.#herdsman.touchlink.factoryReset(ieeeAddr, channel);
    }
    async addInstallCode(installCode) {
        await this.#herdsman.addInstallCode(installCode);
    }
    async touchlinkIdentify(ieeeAddr, channel) {
        await this.#herdsman.touchlink.identify(ieeeAddr, channel);
    }
    async touchlinkScan() {
        return await this.#herdsman.touchlink.scan();
    }
    createGroup(id) {
        this.#herdsman.createGroup(id);
        // biome-ignore lint/style/noNonNullAssertion: just created
        return this.resolveGroup(id);
    }
    deviceByNetworkAddress(networkAddress) {
        const device = this.#herdsman.getDeviceByNetworkAddress(networkAddress);
        return device && this.resolveDevice(device.ieeeAddr);
    }
    groupByID(id) {
        return this.resolveGroup(id);
    }
    removeGroupFromLookup(id) {
        this.groupLookup.delete(id);
    }
}
exports.default = Zigbee;
__decorate([
    bind_decorator_1.default
], Zigbee.prototype, "resolveDevice", null);
__decorate([
    bind_decorator_1.default
], Zigbee.prototype, "acceptJoiningDeviceHandler", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiemlnYmVlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vbGliL3ppZ2JlZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDZDQUFzQztBQUN0QyxvRUFBa0M7QUFDbEMsa0hBQThEO0FBRTlELHFEQUEyQztBQUUzQyw0REFBb0M7QUFDcEMsMERBQWtDO0FBQ2xDLHVEQUErQjtBQUMvQiwyREFBbUM7QUFDbkMsMERBQTRDO0FBQzVDLHlEQUFpQztBQUVqQyxNQUFNLGFBQWEsR0FBRyx1QkFBdUIsQ0FBQztBQUU5QyxNQUFxQixNQUFNO0lBQ3ZCLFNBQVMsQ0FBYztJQUNmLFFBQVEsQ0FBVztJQUNuQixXQUFXLEdBQUcsSUFBSSxHQUFHLEVBQWdDLENBQUM7SUFDdEQsWUFBWSxHQUFHLElBQUksR0FBRyxFQUFxQyxDQUFDO0lBQzVELG1CQUFtQixDQUFVO0lBRXJDLFlBQVksUUFBa0I7UUFDMUIsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7SUFDN0IsQ0FBQztJQUVELElBQUksWUFBWTtRQUNaLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQztJQUMxQixDQUFDO0lBRUQsS0FBSyxDQUFDLEtBQUssQ0FBQyxXQUF3QjtRQUNoQyxNQUFNLFlBQVksR0FBRyxNQUFNLGVBQUssQ0FBQyxvQkFBb0IsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ3pFLGdCQUFNLENBQUMsSUFBSSxDQUFDLDZCQUE2QixZQUFZLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQztRQUNsRSxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQztRQUM3QyxNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQztRQUNwRCxNQUFNLFVBQVUsR0FBRyxRQUFRLENBQUMsR0FBRyxFQUFF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