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
const node_assert_1 = __importDefault(require("node:assert"));
const device_1 = require("zigbee-herdsman/dist/controller/model/device");
const zhc = __importStar(require("zigbee-herdsman-converters"));
const zigbee_herdsman_converters_1 = require("zigbee-herdsman-converters");
const logger_1 = __importDefault(require("../util/logger"));
const settings = __importStar(require("../util/settings"));
const LINKQUALITY = new zigbee_herdsman_converters_1.Numeric("linkquality", zigbee_herdsman_converters_1.access.STATE)
    .withUnit("lqi")
    .withDescription("Link quality (signal strength)")
    .withValueMin(0)
    .withValueMax(255)
    .withCategory("diagnostic");
class Device {
    zh;
    definition;
    _definitionModelID;
    get ieeeAddr() {
        return this.zh.ieeeAddr;
    }
    // biome-ignore lint/style/useNamingConvention: API
    get ID() {
        return this.zh.ieeeAddr;
    }
    get options() {
        const deviceOptions = settings.getDevice(this.ieeeAddr) ?? { friendly_name: this.ieeeAddr, ID: this.ieeeAddr };
        return { ...settings.get().device_options, ...deviceOptions };
    }
    get name() {
        return this.zh.type === "Coordinator" ? "Coordinator" : this.options?.friendly_name;
    }
    get isSupported() {
        return this.zh.type === "Coordinator" || Boolean(this.definition && !this.definition.generated);
    }
    get customClusters() {
        return this.zh.customClusters;
    }
    get otaExtraMetas() {
        return typeof this.definition?.ota === "object" ? this.definition.ota : {};
    }
    get interviewed() {
        return this.zh.interviewState === device_1.InterviewState.Successful || this.zh.interviewState === device_1.InterviewState.Failed;
    }
    constructor(device) {
        this.zh = device;
    }
    exposes() {
        const exposes = [];
        (0, node_assert_1.default)(this.definition, "Cannot retreive exposes before definition is resolved");
        if (typeof this.definition.exposes === "function") {
            const options = this.options;
            exposes.push(...this.definition.exposes(this.zh, options));
        }
        else {
            exposes.push(...this.definition.exposes);
        }
        exposes.push(LINKQUALITY);
        return exposes;
    }
    async resolveDefinition(ignoreCache = false) {
        if (this.interviewed && (!this.definition || this._definitionModelID !== this.zh.modelID || ignoreCache)) {
            this.definition = await zhc.findByDevice(this.zh, true);
            this._definitionModelID = this.zh.modelID;
        }
    }
    async reInterview(eventBus) {
        // logic follows that of receiving `deviceInterview` event from ZH layer
        logger_1.default.info(`Interviewing '${this.name}'`);
        eventBus.emitDeviceInterview({ status: "started", device: this });
        try {
            await this.zh.interview(true);
            // A re-interview can for example result in a different modelId, therefore reconsider the definition.
            await this.resolveDefinition(true);
            logger_1.default.info(`Successfully interviewed '${this.name}'`);
            eventBus.emitDeviceInterview({ status: "successful", device: this });
        }
        catch (error) {
            eventBus.emitDeviceInterview({ status: "failed", device: this });
            throw new Error(`Interview of '${this.name}' (${this.ieeeAddr}) failed: ${error}`);
        }
    }
    ensureInSettings() {
        if (this.zh.type !== "Coordinator" && !settings.getDevice(this.zh.ieeeAddr)) {
            settings.addDevice(this.zh.ieeeAddr);
        }
    }
    endpoint(key) {
        if (!key) {
            key = "default";
        }
        else if (!Number.isNaN(Number(key))) {
            return this.zh.getEndpoint(Number(key));
        }
        if (this.definition?.endpoint) {
            const ID = this.definition.endpoint(this.zh)[key];
            if (ID) {
                return this.zh.getEndpoint(ID);
            }
        }
        return key === "default" ? this.zh.endpoints[0] : undefined;
    }
    endpointName(endpoint) {
        let epName;
        if (this.definition?.endpoint) {
            const mapping = this.definition.endpoint(this.zh);
            for (const name in mapping) {
                if (mapping[name] === endpoint.ID) {
                    epName = name;
                    break;
                }
            }
        }
        /* v8 ignore next */
        return epName === "default" ? undefined : epName;
    }
    getEndpointNames() {
        const names = [];
        if (this.definition?.endpoint) {
            for (const name in this.definition.endpoint(this.zh)) {
                if (name !== "default") {
                    names.push(name);
                }
            }
        }
        return names;
    }
    isDevice() {
        return true;
    }
    isGroup() {
        return false;
    }
}
exports.default = Device;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL21vZGVsL2RldmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDhEQUFpQztBQUNqQyx5RUFBNEU7QUFHNUUsZ0VBQWtEO0FBQ2xELDJFQUEyRDtBQUMzRCw0REFBb0M7QUFDcEMsMkRBQTZDO0FBRTdDLE1BQU0sV0FBVyxHQUFHLElBQUksb0NBQU8sQ0FBQyxhQUFhLEVBQUUsbUNBQU0sQ0FBQyxLQUFLLENBQUM7S0FDdkQsUUFBUSxDQUFDLEtBQUssQ0FBQztLQUNmLGVBQWUsQ0FBQyxnQ0FBZ0MsQ0FBQztLQUNqRCxZQUFZLENBQUMsQ0FBQyxDQUFDO0tBQ2YsWUFBWSxDQUFDLEdBQUcsQ0FBQztLQUNqQixZQUFZLENBQUMsWUFBWSxDQUFDLENBQUM7QUFFaEMsTUFBcUIsTUFBTTtJQUNoQixFQUFFLENBQVk7SUFDZCxVQUFVLENBQWtCO0lBQzNCLGtCQUFrQixDQUFVO0lBRXBDLElBQUksUUFBUTtRQUNSLE9BQU8sSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUM7SUFDNUIsQ0FBQztJQUNELG1EQUFtRDtJQUNuRCxJQUFJLEVBQUU7UUFDRixPQUFPLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDO0lBQzVCLENBQUM7SUFDRCxJQUFJLE9BQU87UUFDUCxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLEVBQUUsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFDLENBQUM7UUFDN0csT0FBTyxFQUFDLEdBQUcsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLGNBQWMsRUFBRSxHQUFHLGFBQWEsRUFBQyxDQUFDO0lBQ2hFLENBQUM7SUFDRCxJQUFJLElBQUk7UUFDSixP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