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
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const mqtt_1 = require("mqtt");
const logger_1 = __importDefault(require("./util/logger"));
const settings = __importStar(require("./util/settings"));
const utils_1 = __importDefault(require("./util/utils"));
const NS = "z2m:mqtt";
class Mqtt {
    publishedTopics = new Set();
    connectionTimer;
    client;
    eventBus;
    republishRetainedTimer;
    defaultPublishOptions;
    retainedMessages = {};
    get info() {
        return {
            version: this.client.options.protocolVersion,
            server: `${this.client.options.protocol}://${this.client.options.host}:${this.client.options.port}`,
        };
    }
    get stats() {
        return {
            connected: this.isConnected(),
            queued: this.client.queue.length,
        };
    }
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.defaultPublishOptions = {
            clientOptions: {},
            baseTopic: settings.get().mqtt.base_topic,
            skipLog: false,
            skipReceive: true,
            meta: {},
        };
    }
    async connect() {
        const mqttSettings = settings.get().mqtt;
        logger_1.default.info(`Connecting to MQTT server at ${mqttSettings.server}`);
        const options = {
            will: {
                topic: `${settings.get().mqtt.base_topic}/bridge/state`,
                payload: Buffer.from(JSON.stringify({ state: "offline" })),
                retain: !settings.get().mqtt.force_disable_retain,
                qos: 1,
            },
            properties: { maximumPacketSize: mqttSettings.maximum_packet_size },
        };
        if (mqttSettings.version) {
            options.protocolVersion = mqttSettings.version;
        }
        if (mqttSettings.keepalive) {
            logger_1.default.debug(`Using MQTT keepalive: ${mqttSettings.keepalive}`);
            options.keepalive = mqttSettings.keepalive;
        }
        if (mqttSettings.ca) {
            logger_1.default.debug(`MQTT SSL/TLS: Path to CA certificate = ${mqttSettings.ca}`);
            options.ca = node_fs_1.default.readFileSync(mqttSettings.ca);
        }
        if (mqttSettings.key && mqttSettings.cert) {
            logger_1.default.debug(`MQTT SSL/TLS: Path to client key = ${mqttSettings.key}`);
            logger_1.default.debug(`MQTT SSL/TLS: Path to client certificate = ${mqttSettings.cert}`);
            options.key = node_fs_1.default.readFileSync(mqttSettings.key);
            options.cert = node_fs_1.default.readFileSync(mqttSettings.cert);
        }
        if (mqttSettings.user && mqttSettings.password) {
            logger_1.default.debug(`Using MQTT login with username: ${mqttSettings.user}`);
            options.username = mqttSettings.user;
            options.password = mqttSettings.password;
        }
        else if (mqttSettings.user) {
            logger_1.default.debug(`Using MQTT login with username only: ${mqttSettings.user}`);
            options.username = mqttSettings.user;
        }
        else {
            logger_1.default.debug("Using MQTT anonymous login");
        }
        if (mqttSettings.client_id) {
            logger_1.default.debug(`Using MQTT client ID: '${mqttSettings.client_id}'`);
            options.clientId = mqttSettings.client_id;
        }
        if (mqttSettings.reject_unauthorized !== undefined && !mqttSettings.reject_unauthorized) {
            logger_1.default.debug("MQTT reject_unauthorized set false, ignoring certificate warnings.");
            options.rejectUnauthorized = false;
        }
        this.client = await (0, mqtt_1.connectAsync)(mqttSettings.server, options);
        // https://github.com/Koenkk/zigbee2mqtt/issues/9822
        this.client.stream.setMaxListeners(0);
        this.client.on("error", (err) => {
            logger_1.default.error(`MQTT error: ${err.message}`);
        });
        if (mqttSettings.version != null && mqttSettings.version >= 5) {
            this.client.on("disconnect", (packet) => {
                logger_1.default.error(`MQTT disconnect: reason ${packet.reasonCode} (${packet.properties?.reasonString})`);
            });
        }
        this.client.on("message", this.onMessage);
        await this.onConnect();
        this.client.on("connect", this.onConnect);
        this.republishRetainedTimer = setTimeout(async () => {
            // Republish retained messages in case MQTT broker does not persist them.
            // https://github.com/Koenkk/zigbee2mqtt/issues/9629
            for (const msg of Object.values(this.retainedMessages)) {
                await this.publish(msg.topic, msg.payload, msg.options);
            }
        }, 2000);
        // Set timer at interval to check if connected to MQTT server.
        this.connectionTimer = setInterval(() => {
            if (!this.isConnected()) {
                logger_1.default.error("Not connected to MQTT server!");
            }
        }, utils_1.default.seconds(10));
    }
    async disconnect() {
        clearTimeout(this.connectionTimer);
        clearTimeout(this.republishRetainedTimer);
        const stateData = { state: "offline" };
        // prevent undesirable error when receiving SIGTERM/SIGINT during startup
        if (this.client) {
            await this.publish("bridge/state", JSON.stringify(stateData), { clientOptions: { retain: true } });
        }
        this.eventBus.removeListeners(this);
        logger_1.default.info("Disconnecting from MQTT server");
        await this.client?.endAsync();
    }
    async subscribe(topic) {
        await this.client.subscribeAsync(topic);
    }
    async unsubscribe(topic) {
        await this.client.unsubscribeAsync(topic);
    }
    async onConnect() {
        logger_1.default.info("Connected to MQTT server");
        const stateData = { state: "online" };
        await this.publish("bridge/state", JSON.stringify(stateData), { clientOptions: { retain: true, qos: 1 } });
        await this.subscribe(`${settings.get().mqtt.base_topic}/#`);
    }
    onMessage(topic, message) {
        // Since we subscribe to zigbee2mqtt/# we also receive the message we send ourselves, skip these.
        if (!this.publishedTopics.has(topic)) {
            logger_1.default.debug(() => `Received MQTT message on '${topic}' with data '${message.toString()}'`, NS);
            this.eventBus.emitMQTTMessage({ topic, message: message.toString() });
        }
        if (this.republishRetainedTimer && topic === `${settings.get().mqtt.base_topic}/bridge/info`) {
            clearTimeout(this.republishRetainedTimer);
            this.republishRetainedTimer = undefined;
        }
    }
    isConnected() {
        return this.client && !this.client.reconnecting && !this.client.disconnecting && !this.client.disconnected;
    }
    async publish(topic, payload, options = {}) {
        // TODO: add `options.validateTopic: boolean` to bypass these checks when topic is "controlled"
        if (topic.includes("+") || topic.includes("#")) {
            // https://github.com/Koenkk/zigbee2mqtt/issues/26939#issuecomment-2772309646
            logger_1.default.error(`Topic '${topic}' includes wildcard characters, skipping publish.`);
            return;
        }
        const finalOptions = { ...this.defaultPublishOptions, ...options };
        topic = `${finalOptions.baseTopic}/${topic}`;
        if (finalOptions.skipReceive) {
            this.publishedTopics.add(topic);
        }
        if (finalOptions.clientOptions.retain) {
            if (payload) {
                this.retainedMessages[topic] = { payload, options: finalOptions, topic: topic.substring(finalOptions.baseTopic.length + 1) };
            }
            else {
                delete this.retainedMessages[topic];
            }
        }
        this.eventBus.emitMQTTMessagePublished({ topic, payload, options: finalOptions });
        if (!this.isConnected()) {
            if (!finalOptions.skipLog) {
                logger_1.default.error("Not connected to MQTT server!");
                logger_1.default.error(`Cannot send message: topic: '${topic}', payload: '${payload}`);
            }
            return;
        }
        let clientOptions = finalOptions.clientOptions;
        if (settings.get().mqtt.force_disable_retain) {
            clientOptions = { ...finalOptions.clientOptions, retain: false };
        }
        if (!finalOptions.skipLog) {
            logger_1.default.info(() => `MQTT publish: topic '${topic}', payload '${payload}'`, NS);
        }
        try {
            await this.client.publishAsync(topic, payload, clientOptions);
        }
        catch (error) {
            if (!finalOptions.skipLog) {
                logger_1.default.error(`MQTT server error: ${error.message}`);
                logger_1.default.error(`Could not send message: topic: '${topic}', payload: '${payload}`);
            }
        }
    }
}
exports.default = Mqtt;
__decorate([
    bind_decorator_1.default
], Mqtt.prototype, "onConnect", null);
__decorate([
    bind_decorator_1.default
], Mqtt.prototype, "onMessage", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXF0dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL2xpYi9tcXR0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsc0RBQXlCO0FBQ3pCLG9FQUFrQztBQUVsQywrQkFBa0M7QUFHbEMsMkRBQW1DO0FBQ25DLDBEQUE0QztBQUM1Qyx5REFBaUM7QUFFakMsTUFBTSxFQUFFLEdBQUcsVUFBVSxDQUFDO0FBVXRCLE1BQXFCLElBQUk7SUFDYixlQUFlLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztJQUNwQyxlQUFlLENBQWtCO0lBQ2pDLE1BQU0sQ0FBYztJQUNwQixRQUFRLENBQVc7SUFDbkIsc0JBQXNCLENBQWtCO0lBQ3hDLHFCQUFxQixDQUFxQjtJQUMzQyxnQkFBZ0IsR0FBaUYsRUFBRSxDQUFDO0lBRTNHLElBQUksSUFBSTtRQUNKLE9BQU87WUFDSCxPQUFPLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsZUFBZTtZQUM1QyxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxRQUFRLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRTtTQUN0RyxDQUFDO0lBQ04sQ0FBQztJQUVELElBQUksS0FBSztRQUNMLE9BQU87WUFDSCxTQUFTLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBRTtZQUM3QixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTTtTQUNuQyxDQUFDO0lBQ04sQ0FBQztJQUVELFlBQVksUUFBa0I7UUFDMUIsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDekIsSUFBSSxDQUFDLHFCQUFxQixHQUFHO1lBQ3pCLGFBQWEsRUFBRSxFQUFFO1lBQ2pCLFNBQVMs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