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
const node_assert_1 = __importDefault(require("node:assert"));
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const zigbee_herdsman_1 = require("zigbee-herdsman");
const device_1 = __importDefault(require("../model/device"));
const data_1 = __importDefault(require("../util/data"));
const logger_1 = __importDefault(require("../util/logger"));
const settings = __importStar(require("../util/settings"));
const utils_1 = __importDefault(require("../util/utils"));
const extension_1 = __importDefault(require("./extension"));
/**
 * Write to `dataDir` and return created path
 */
function writeFirmwareHexToDataDir(hex, fileName, deviceIeee) {
    if (!fileName) {
        fileName = `${deviceIeee}_${Date.now()}`;
    }
    const baseDir = data_1.default.joinPath("ota");
    if (!(0, node_fs_1.existsSync)(baseDir)) {
        (0, node_fs_1.mkdirSync)(baseDir, { recursive: true });
    }
    const filePath = (0, node_path_1.join)(baseDir, fileName);
    (0, node_fs_1.writeFileSync)(filePath, Buffer.from(hex, "hex"));
    return filePath;
}
class OTAUpdate extends extension_1.default {
    #topicRegex = new RegExp(`^${settings.get().mqtt.base_topic}/bridge/request/device/ota_update/(update|check|schedule|unschedule)/?(downgrade)?`, "i");
    #inProgress = new Set();
    #lastChecked = new Map();
    // biome-ignore lint/suspicious/useAwait: API
    async start() {
        this.eventBus.onMQTTMessage(this, this.onMQTTMessage);
        this.eventBus.onDeviceMessage(this, this.onZigbeeEvent);
        (0, zigbee_herdsman_1.setOtaConfiguration)(data_1.default.getPath(), settings.get().ota.zigbee_ota_override_index_location);
        // In case Zigbee2MQTT is restared during an update, progress and remaining values are still in state, remove them.
        for (const device of this.zigbee.devicesIterator(utils_1.default.deviceNotCoordinator)) {
            this.#removeProgressAndRemainingFromState(device);
            // Reset update state, e.g. when Z2M restarted during update.
            if (this.state.get(device).update?.state === "updating") {
                this.state.get(device).update.state = "idle";
            }
        }
    }
    // mostly intended for testing
    clearState() {
        this.#inProgress.clear();
        this.#lastChecked.clear();
    }
    #removeProgressAndRemainingFromState(device) {
        const deviceState = this.state.get(device);
        if (deviceState.update) {
            delete deviceState.update.progress;
            delete deviceState.update.remaining;
        }
    }
    async onZigbeeEvent(data) {
        if (data.type !== "commandQueryNextImageRequest" || !data.device.definition || this.#inProgress.has(data.device.ieeeAddr)) {
            return;
        }
        // `commandQueryNextImageRequest` check above should ensures this is valid but...
        (0, node_assert_1.default)(data.meta.zclTransactionSequenceNumber !== undefined, "Missing 'queryNextImageRequest' transaction sequence number (cannot match reply)");
        logger_1.default.debug(`Device '${data.device.name}' requested OTA`);
        if (data.device.zh.scheduledOta) {
            // allow custom source to override check for definition `ota`
            if (data.device.zh.scheduledOta?.url !== undefined || data.device.definition.ota) {
                this.#inProgress.add(data.device.ieeeAddr);
                logger_1.default.info(`Updating '${data.device.name}' to latest firmware`);
                try {
                    const otaSettings = settings.get().ota;
                    const [, toVersion] = await this.#update(undefined, // uses internally registered schedule
                    data.device, data.data, data.meta.zclTransactionSequenceNumber, {
                        // fallbacks are only to satisfy typing, should always be defined from settings defaults
                        requestTimeout: otaSettings.image_block_request_timeout ?? /* v8 ignore next */ 150000,
                        responseDelay: otaSettings.image_block_response_delay ?? /* v8 ignore next */ 250,
                        baseSize: otaSettings.default_maximum_data_size ?? /* v8 ignore next */ 50,
                    }, data.endpoint);
                    if (toVersion === undefined) {
                        logger_1.default.info(`No OTA image currently available for '${data.device.name}'. Unscheduled.`);
                    }
                }
                catch (e) {
                    logger_1.default.debug(`OTA update of '${data.device.name}' failed (${e}). Retry scheduled for next request.`);
                    this.#removeProgressAndRemainingFromState(data.device);
                    await this.publishEntityState(data.device, this.#getEntityPublishPayload(data.device, "scheduled"));
                }
                this.#inProgress.delete(data.device.ieeeAddr);
                return; // we're done
            }
        }
        if (data.device.definition.ota) {
            if (!data.device.options.disable_automatic_update_check && !settings.get().ota.disable_automatic_update_check) {
                // When a device does a next image request, it will usually do it a few times after each other
                // with only 10 - 60 seconds inbetween. It doesn't make sense to check for a new update
                // each time, so this interval can be set by the user. The default is 1,440 minutes (one day).
                const updateCheckInterval = settings.get().ota.update_check_interval * 1000 * 60;
                const deviceLastChecked = this.#lastChecked.get(data.device.ieeeAddr);
                const check = deviceLastChecked !== undefined ? Date.now() - deviceLastChecked > updateCheckInterval : true;
                if (!check) {
                    return;
                }
                this.#inProgress.add(data.device.ieeeAddr);
                this.#lastChecked.set(data.device.ieeeAddr, Date.now());
                let availableResult;
                try {
                    // auto-check defaults to zigbee-OTA + potential local index, and never `downgrade`
                    availableResult = await data.device.zh.checkOta({ downgrade: false }, data.data, data.device.otaExtraMetas, data.endpoint);
                }
                catch (error) {
                    logger_1.default.debug(`Failed to check if OTA update available for '${data.device.name}' (${error})`);
                }
                await this.publishEntityState(data.device, this.#getEntityPublishPayload(data.device, availableResult ?? "idle"));
                if (availableResult?.available) {
                    logger_1.default.info(`OTA update available for '${data.device.name}'`);
                }
            }
        }
        // Respond to stop the client from requesting OTAs
        await data.endpoint.commandResponse("genOta", "queryNextImageResponse", { status: zigbee_herdsman_1.Zcl.Status.NO_IMAGE_AVAILABLE }, undefined, data.meta.zclTransactionSequenceNumber);
        logger_1.default.debug(`Responded to OTA request of '${data.device.name}' with 'NO_IMAGE_AVAILABLE'`);
        this.#inProgress.delete(data.device.ieeeAddr);
    }
    async #readSoftwareBuildIDAndDateCode(device, sendPolicy) {
        try {
            const endpoint = device.zh.endpoints.find((e) => e.supportsInputCluster("genBasic"));
            (0, node_assert_1.default)(endpoint);
            const result = await endpoint.read("genBasic", ["dateCode", "swBuildId"], { sendPolicy });
            return { softwareBuildID: result.swBuildId, dateCode: result.dateCode };
        }
        catch {
            return undefined;
        }
    }
    #getEntityPublishPayload(device, state, progress, remaining) {
        const deviceUpdateState = this.state.get(device).update;
        const update = typeof state === "string"
            ? {
                state,
                installed_version: deviceUpdateState?.installed_version,
                latest_version: deviceUpdateState?.latest_version,
                latest_source: deviceUpdateState?.latest_source,
                latest_release_notes: deviceUpdateState?.latest_release_notes,
            }
            : {
                state: state.available ? "available" : "idle",
                installed_version: state.current.fileVersion,
                latest_version: state.availableMeta?.fileVersion ?? state.current.fileVersion,
                latest_source: state.availableMeta?.url || null,
                latest_release_notes: state.availableMeta?.releaseNotes || null,
            };
        if (progress !== undefined) {
            update.progress = progress;
        }
        if (remaining !== undefined) {
            update.remaining = Math.round(remaining);
        }
        return { update };
    }
    async onMQTTMessage(data) {
        const topicMatch = data.topic.match(this.#topicRegex);
        if (!topicMatch) {
            return;
        }
        const message = utils_1.default.parseJSON(data.message, data.message);
        // TODO: deprecated 3.0 should remove string payload, enforce object
        const messageObject = typeof message === "object";
        if (messageObject) {
            (0, node_assert_1.default)(message.id, "Invalid payload");
        }
        const ID = (messageObject ? message.id : message);
        const device = this.zigbee.resolveEntity(ID);
        const type = topicMatch[1];
        const downgrade = topicMatch[2] === "downgrade";
        let error;
        let errorStack;
        if (!(device instanceof device_1.default)) {
            error = `Device '${ID}' does not exist`;
        }
        else if (this.#inProgress.has(device.ieeeAddr)) {
            // also guards against scheduling while check/update op in progress that could result in undesired OTA state
            error = `OTA update or check for update already in progress for '${device.name}'`;
        }
        else {
            switch (type) {
                case "check": {
                    this.#inProgress.add(device.ieeeAddr);
                    const source = { downgrade };
                    if (messageObject) {
                        const payload = message;
                        if (payload.url) {
                            source.url = payload.url;
                        }
                        else if (!device.definition?.ota) {
                            error = `Device '${device.name}' does not support OTA updates`;
                            break;
                        }
                    }
                    else if (!device.definition?.ota) {
                        error = `Device '${device.name}' does not support OTA updates`;
                        break;
                    }
                    logger_1.default.info(`Checking if OTA update available for '${device.name}'`);
                    try {
                        const availableResult = await device.zh.checkOta(source, undefined, device.otaExtraMetas);
                        logger_1.default.info(`${availableResult.available ? "" : "No "}OTA update available for '${device.name}'`);
                        await this.publishEntityState(device, this.#getEntityPublishPayload(device, availableResult));
                        this.#lastChecked.set(device.ieeeAddr, Date.now());
                        const response = utils_1.default.getResponse(message, {
                            id: ID,
                            update_available: availableResult.available,
                            downgrade: source.downgrade,
                            source: availableResult.availableMeta?.url,
                            release_notes: availableResult.availableMeta?.releaseNotes,
                        });
                        await this.mqtt.publish("bridge/response/device/ota_update/check", (0, json_stable_stringify_without_jsonify_1.default)(response));
                    }
                    catch (e) {
                        error = `Failed to check if OTA update available for '${device.name}' (${e.message})`;
                        errorStack = e.stack;
                    }
                    break;
                }
                case "update": {
                    this.#inProgress.add(device.ieeeAddr);
                    const otaSettings = settings.get().ota;
                    const source = { downgrade };
                    const dataSettings = {
                        // fallbacks are only to satisfy typing, should always be defined from settings defaults
                        requestTimeout: otaSettings.image_block_request_timeout ?? /* v8 ignore next */ 150000,
                        responseDelay: otaSettings.image_block_response_delay ?? /* v8 ignore next */ 250,
                        baseSize: otaSettings.default_maximum_data_size ?? /* v8 ignore next */ 50,
                    };
                    if (messageObject) {
                        const payload = message;
                        if (payload.hex) {
                            (0, node_assert_1.default)(payload.hex.data);
                            // write to `dataDir` and pass created path as source URL
                            source.url = writeFirmwareHexToDataDir(payload.hex.data, payload.hex.file_name, device.ieeeAddr);
                        }
                        else if (payload.url) {
                            source.url = payload.url;
                        }
                        else if (!device.definition?.ota) {
                            error = `Device '${device.name}' does not support OTA updates`;
                            break;
                        }
                        if (payload.image_block_request_timeout) {
                            dataSettings.requestTimeout = payload.image_block_request_timeout;
                        }
                        if (payload.image_block_response_delay) {
                            dataSettings.responseDelay = payload.image_block_response_delay;
                        }
                        if (payload.default_maximum_data_size) {
                            dataSettings.baseSize = payload.default_maximum_data_size;
                        }
                    }
                    else if (!device.definition?.ota) {
                        error = `Device '${device.name}' does not support OTA updates`;
                        break;
                    }
                    logger_1.default.info(`OTA updating '${device.name}' to ${downgrade ? "previous" : "latest"} firmware`);
                    try {
                        const firmwareFrom = await this.#readSoftwareBuildIDAndDateCode(device, "immediate");
                        const [fromVersion, toVersion] = await this.#update(source, device, undefined, undefined, dataSettings);
                        if (toVersion === undefined) {
                            error = `Update of '${device.name}' failed (No image currently available)`;
                            break;
                        }
                        const firmwareTo = await this.#readSoftwareBuildIDAndDateCode(device);
                        const response = utils_1.default.getResponse(message, {
                            id: ID,
                            from: {
                                file_version: fromVersion,
                                software_build_id: firmwareFrom?.softwareBuildID,
                                date_code: firmwareFrom?.dateCode,
                            },
                            to: { file_version: toVersion, software_build_id: firmwareTo?.softwareBuildID, date_code: firmwareTo?.dateCode },
                        });
                        await this.mqtt.publish("bridge/response/device/ota_update/update", (0, json_stable_stringify_without_jsonify_1.default)(response));
                    }
                    catch (e) {
                        logger_1.default.debug(`OTA update of '${device.name}' failed (${e})`);
                        error = `OTA update of '${device.name}' failed (${e.message})`;
                        errorStack = e.stack;
                        this.#removeProgressAndRemainingFromState(device);
                        await this.publishEntityState(device, this.#getEntityPublishPayload(device, "available"));
                    }
                    break;
                }
                case "schedule": {
                    const source = { downgrade };
                    if (messageObject) {
                        const payload = message;
                        if (payload.hex) {
                            (0, node_assert_1.default)(payload.hex.data);
                            // write to `dataDir` and pass created path as source URL
                            source.url = writeFirmwareHexToDataDir(payload.hex.data, payload.hex.file_name, device.ieeeAddr);
                        }
                        else if (payload.url) {
                            source.url = payload.url;
                        }
                        else if (!device.definition?.ota) {
                            error = `Device '${device.name}' does not support OTA updates`;
                            break;
                        }
                    }
                    else if (!device.definition?.ota) {
                        error = `Device '${device.name}' does not support OTA updates`;
                        break;
                    }
                    device.zh.scheduleOta(source);
                    await this.publishEntityState(device, this.#getEntityPublishPayload(device, "scheduled"));
                    const response = utils_1.default.getResponse(message, { id: ID, url: source.url });
                    await this.mqtt.publish("bridge/response/device/ota_update/schedule", (0, json_stable_stringify_without_jsonify_1.default)(response));
                    break;
                }
                case "unschedule": {
                    if (device.zh.scheduledOta?.url?.startsWith(data_1.default.joinPath("ota"))) {
                        (0, node_fs_1.rmSync)(device.zh.scheduledOta.url, { force: true });
                    }
                    device.zh.unscheduleOta();
                    await this.publishEntityState(device, this.#getEntityPublishPayload(device, "idle"));
                    const response = utils_1.default.getResponse(message, {
                        id: ID,
                    });
                    await this.mqtt.publish("bridge/response/device/ota_update/unschedule", (0, json_stable_stringify_without_jsonify_1.default)(response));
                    break;
                }
            }
            this.#inProgress.delete(device.ieeeAddr);
        }
        if (error) {
            const response = utils_1.default.getResponse(message, {}, error);
            await this.mqtt.publish(`bridge/response/device/ota_update/${type}`, (0, json_stable_stringify_without_jsonify_1.default)(response));
            logger_1.default.error(error);
            if (errorStack) {
                logger_1.default.debug(errorStack);
            }
        }
    }
    /**
     * Do the bulk of the update work (hand over to zigbee-herdsman, then re-interview).
     *
     * `dataSettings` object may be mutated by zigbee-herdsman to fit request (e.g. known manuf quirk)
     */
    async #update(source, device, requestPayload, requestTsn, dataSettings, endpoint) {
        const [from, to] = await device.zh.updateOta(source, requestPayload, requestTsn, device.otaExtraMetas, async (progress, remaining) => {
            await this.publishEntityState(device, this.#getEntityPublishPayload(device, "updating", progress, remaining));
        }, dataSettings, endpoint);
        if (to === undefined) {
            this.#removeProgressAndRemainingFromState(device);
            await this.publishEntityState(device, this.#getEntityPublishPayload(device, { available: false, current: from }));
            return [from.fileVersion, undefined];
        }
        logger_1.default.info(`Finished update of '${device.name}'`);
        this.#removeProgressAndRemainingFromState(device);
        await this.publishEntityState(device, this.#getEntityPublishPayload(device, { available: false, current: to }));
        logger_1.default.info(() => `Device '${device.name}' was OTA updated from '${from.fileVersion}' to '${to.fileVersion}'`);
        // OTA update can bring new features & co, force full re-interview and re-configure, same as a "device joined"
        if (device.zh.meta.configured !== undefined) {
            delete device.zh.meta.configured;
            device.zh.save();
        }
        setTimeout(() => {
            device.reInterview(this.eventBus).catch((error) => {
                logger_1.default.error(`${error.message}. Re-try manually after some time.`);
            });
        }, 5000);
        return [from.fileVersion, to.fileVersion];
    }
}
exports.default = OTAUpdate;
__decorate([
    bind_decorator_1.default
], OTAUpdate.prototype, "onZigbeeEvent", null);
__decorate([
    bind_decorator_1.default
], OTAUpdate.prototype, "onMQTTMessage", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3RhVXBkYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL2V4dGVuc2lvbi9vdGFVcGRhdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSw4REFBaUM7QUFDakMscUNBQXFFO0FBQ3JFLHlDQUErQjtBQUMvQixvRUFBa0M7QUFDbEMsa0hBQThEO0FBQzlELHFEQUF5RDtBQUV6RCw2REFBcUM7QUFFckMsd0RBQW1DO0FBQ25DLDREQUFvQztBQUNwQywyREFBNkM7QUFDN0MsMERBQWtDO0FBQ2xDLDREQUFvQztBQWdCcEM7O0dBRUc7QUFDSCxTQUFTLHlCQUF5QixDQUFDLEdBQVcsRUFBRSxRQUE0QixFQUFFLFVBQWtCO0lBQzVGLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNaLFFBQVEsR0FBRyxHQUFHLFVBQVUsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQztJQUM3QyxDQUFDO0lBRUQsTUFBTSxPQUFPLEdBQUcsY0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUV4QyxJQUFJLENBQUMsSUFBQSxvQkFBVSxFQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7UUFDdkIsSUFBQSxtQkFBUyxFQUFDLE9BQU8sRUFBRSxFQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUMsQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFFRCxNQUFNLFFBQVEsR0FBRyxJQUFBLGdCQUFJLEVBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBRXpDLElBQUEsdUJBQWEsRUFBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUVqRCxPQUFPLFFBQVEsQ0FBQztBQUNwQixDQUFDO0FBRUQsTUFBcUIsU0FBVSxTQUFRLG1CQUFTO0lBQzVDLFdBQVcsR0FBRyxJQUFJLE1BQU0sQ0FD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