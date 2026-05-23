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
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const device_1 = __importDefault(require("../model/device"));
const logger_1 = __importDefault(require("../util/logger"));
const settings = __importStar(require("../util/settings"));
const utils_1 = __importDefault(require("../util/utils"));
const extension_1 = __importDefault(require("./extension"));
/**
 * This extension calls the zigbee-herdsman-converters definition configure() method
 */
class Configure extends extension_1.default {
    configuring = new Set();
    attempts = new Map();
    topic = `${settings.get().mqtt.base_topic}/bridge/request/device/configure`;
    async onReconfigure(data) {
        // Disabling reporting unbinds some cluster which could be bound by configure, re-setup.
        if (data.device.zh.meta?.configured !== undefined) {
            delete data.device.zh.meta.configured;
            data.device.zh.save();
        }
        await this.configure(data.device, "reporting_disabled");
    }
    async onMQTTMessage(data) {
        if (data.topic === this.topic) {
            const message = utils_1.default.parseJSON(data.message, data.message);
            const ID = typeof message === "object" ? message.id : message;
            let error;
            if (ID === undefined) {
                error = "Invalid payload";
            }
            else {
                const device = this.zigbee.resolveEntity(ID);
                if (!device || !(device instanceof device_1.default)) {
                    error = `Device '${ID}' does not exist`;
                }
                else if (!device.definition?.configure) {
                    error = `Device '${device.name}' cannot be configured`;
                }
                else {
                    try {
                        await this.configure(device, "mqtt_message", true, true);
                    }
                    catch (e) {
                        error = `Failed to configure (${e.message})`;
                    }
                }
            }
            const response = utils_1.default.getResponse(message, { id: ID }, error);
            await this.mqtt.publish("bridge/response/device/configure", (0, json_stable_stringify_without_jsonify_1.default)(response));
        }
    }
    start() {
        setImmediate(async () => {
            // Only configure routers on startup, end devices are likely sleeping and
            // will reconfigure once they send a message
            for (const device of this.zigbee.devicesIterator((d) => d.type === "Router")) {
                // Sleep 10 seconds between configuring on startup to not DDoS the coordinator when many devices have to be configured.
                await utils_1.default.sleep(10);
                await this.configure(device, "started");
            }
        });
        this.eventBus.onDeviceJoined(this, async (data) => {
            if (data.device.zh.meta.configured !== undefined) {
                delete data.device.zh.meta.configured;
                data.device.zh.save();
            }
            await this.configure(data.device, "zigbee_event");
        });
        // TODO: this is triggering for any `data.status`, but should only for `successful`? (relies on `device.definition?` early-return?)
        this.eventBus.onDeviceInterview(this, (data) => this.configure(data.device, "zigbee_event"));
        this.eventBus.onLastSeenChanged(this, (data) => this.configure(data.device, "zigbee_event"));
        this.eventBus.onMQTTMessage(this, this.onMQTTMessage);
        this.eventBus.onReconfigure(this, this.onReconfigure);
        return Promise.resolve();
    }
    async configure(device, event, force = false, throwError = false) {
        if (!device.definition?.configure) {
            return;
        }
        const definitionVersion = device.definition.version;
        if (!force) {
            if (device.options.disabled || !device.interviewed) {
                return;
            }
            // Only configure end devices when it is active, otherwise it will likely fails as they are sleeping.
            if (device.zh.type === "EndDevice" && event !== "zigbee_event") {
                return;
            }
            const shouldReconfigure = 
            // Should always reconfigure when not configured before
            device.zh.meta?.configured === undefined ||
                // Or should reconfigure when definition.version is not '0.0.0' and differs from last `meta.configured`.
                // In older Z2M versions the stored `meta.configured` was the hash of the configure function.
                // Since we don't want to reconfigure all devices, we don't re-configure when the definition has the default version of '0.0.0'.
                (definitionVersion !== "0.0.0" && device.zh.meta?.configured !== definitionVersion);
            if (!shouldReconfigure) {
                return;
            }
        }
        if (this.configuring.has(device.ieeeAddr)) {
            return;
        }
        const attempts = this.attempts.get(device.ieeeAddr) ?? 0;
        if (attempts >= 3 && !force) {
            return;
        }
        this.configuring.add(device.ieeeAddr);
        logger_1.default.info(`Configuring '${device.name}'`);
        try {
            await device.definition.configure(device.zh, this.zigbee.firstCoordinatorEndpoint(), device.definition);
            this.attempts.delete(device.ieeeAddr);
            logger_1.default.info(`Successfully configured '${device.name}' (definition v${definitionVersion})`);
            device.zh.meta.configured = definitionVersion;
            device.zh.save();
            this.eventBus.emitDevicesChanged();
        }
        catch (error) {
            const newAttempts = attempts + 1;
            this.attempts.set(device.ieeeAddr, newAttempts);
            const msg = `Failed to configure '${device.name}', attempt ${newAttempts} (${error.stack})`;
            logger_1.default.error(msg);
            if (throwError) {
                throw error;
            }
        }
        finally {
            this.configuring.delete(device.ieeeAddr);
        }
    }
}
exports.default = Configure;
__decorate([
    bind_decorator_1.default
], Configure.prototype, "onReconfigure", null);
__decorate([
    bind_decorator_1.default
], Configure.prototype, "onMQTTMessage", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlndXJlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL2V4dGVuc2lvbi9jb25maWd1cmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxvRUFBa0M7QUFDbEMsa0hBQThEO0FBQzlELDZEQUFxQztBQUVyQyw0REFBb0M7QUFDcEMsMkRBQTZDO0FBQzdDLDBEQUFrQztBQUNsQyw0REFBb0M7QUFFcEM7O0dBRUc7QUFDSCxNQUFxQixTQUFVLFNBQVEsbUJBQVM7SUFDcEMsV0FBVyxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7SUFDaEMsUUFBUSxHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO0lBQ3JDLEtBQUssR0FBRyxHQUFHLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxrQ0FBa0MsQ0FBQztJQUVoRSxBQUFOLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBMkI7UUFDekQsd0ZBQXdGO1FBQ3hGLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLFVBQVUsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUNoRCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7WUFDdEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDMUIsQ0FBQztRQUVELE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLG9CQUFvQixDQUFDLENBQUM7SUFDNUQsQ0FBQztJQUVtQixBQUFOLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBMkI7UUFDekQsSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUM1QixNQUFNLE9BQU8sR0FBRyxlQUFLLENBQUMsU0FBUyxDQUFD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