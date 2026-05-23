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
exports.Frontend = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const node_fs_1 = require("node:fs");
const node_http_1 = require("node:http");
const node_https_1 = require("node:https");
const node_path_1 = require("node:path");
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const express_static_gzip_1 = __importDefault(require("express-static-gzip"));
const finalhandler_1 = __importDefault(require("finalhandler"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const ws_1 = __importDefault(require("ws"));
const data_1 = __importDefault(require("../util/data"));
const logger_1 = __importDefault(require("../util/logger"));
const settings = __importStar(require("../util/settings"));
const utils_1 = __importDefault(require("../util/utils"));
const extension_1 = __importDefault(require("./extension"));
/**
 * This extension servers the frontend
 */
class Frontend extends extension_1.default {
    mqttBaseTopic;
    server;
    wss;
    baseUrl;
    constructor(zigbee, mqtt, state, publishEntityState, eventBus, enableDisableExtension, restartCallback, addExtension) {
        super(zigbee, mqtt, state, publishEntityState, eventBus, enableDisableExtension, restartCallback, addExtension);
        const frontendSettings = settings.get().frontend;
        (0, node_assert_1.default)(frontendSettings.enabled, `Frontend extension created with setting 'enabled: false'`);
        this.baseUrl = frontendSettings.base_url;
        this.mqttBaseTopic = settings.get().mqtt.base_topic;
    }
    async start() {
        if (settings.get().frontend.disable_ui_serving) {
            const { host, port } = settings.get().frontend;
            this.wss = new ws_1.default.Server({ port, host, path: node_path_1.posix.join(this.baseUrl, "api") });
            logger_1.default.info(
            /* v8 ignore next */
            `Frontend UI serving is disabled. WebSocket at: ${this.wss.options.host ?? "0.0.0.0"}:${this.wss.options.port}${this.wss.options.path}`);
        }
        else {
            const { host, port, ssl_key: sslKey, ssl_cert: sslCert } = settings.get().frontend;
            const hasSSL = (val, key) => {
                if (val) {
                    if ((0, node_fs_1.existsSync)(val)) {
                        return true;
                    }
                    logger_1.default.error(`Defined ${key} '${val}' file path does not exists, server won't be secured.`);
                }
                return false;
            };
            const options = {
                enableBrotli: true,
                serveStatic: {
                    /* v8 ignore start */
                    setHeaders: (res, path) => {
                        if (path.endsWith("index.html")) {
                            res.setHeader("Cache-Control", "no-store");
                        }
                    },
                    /* v8 ignore stop */
                },
            };
            const frontend = (await import(settings.get().frontend.package));
            const fileServer = (0, express_static_gzip_1.default)(frontend.default.getPath(), options);
            const deviceIconsFileServer = (0, express_static_gzip_1.default)(data_1.default.joinPath("device_icons"), options);
            const onRequest = (request, response) => {
                const next = (0, finalhandler_1.default)(request, response);
                // biome-ignore lint/style/noNonNullAssertion: `Only valid for request obtained from Server`
                const newUrl = node_path_1.posix.relative(this.baseUrl, request.url);
                // The request url is not within the frontend base url, so the relative path starts with '..'
                if (newUrl.startsWith(".")) {
                    next();
                    return;
                }
                // Attach originalUrl so that static-server can perform a redirect to '/' when serving the root directory.
                // This is necessary for the browser to resolve relative assets paths correctly.
                request.originalUrl = request.url;
                request.url = `/${newUrl}`;
                request.path = request.url;
                if (newUrl.startsWith("device_icons/")) {
                    request.path = request.path.replace("device_icons/", "");
                    request.url = request.url.replace("/device_icons", "");
                    deviceIconsFileServer(request, response, next);
                }
                else {
                    fileServer(request, response, next);
                }
            };
            if (hasSSL(sslKey, "ssl_key") && hasSSL(sslCert, "ssl_cert")) {
                const serverOptions = { key: (0, node_fs_1.readFileSync)(sslKey), cert: (0, node_fs_1.readFileSync)(sslCert) };
                this.server = (0, node_https_1.createServer)(serverOptions, onRequest);
            }
            else {
                this.server = (0, node_http_1.createServer)(onRequest);
            }
            this.server.on("upgrade", this.onUpgrade);
            if (!host) {
                this.server.listen(port);
                logger_1.default.info(`Started frontend on port ${port}`);
            }
            else if (host.startsWith("/")) {
                this.server.listen(host);
                logger_1.default.info(`Started frontend on socket ${host}`);
            }
            else {
                this.server.listen(port, host);
                logger_1.default.info(`Started frontend on port ${host}:${port}`);
            }
            this.wss = new ws_1.default.Server({ noServer: true, path: node_path_1.posix.join(this.baseUrl, "api") });
        }
        this.wss.on("connection", this.onWebSocketConnection);
        this.eventBus.onMQTTMessagePublished(this, this.onMQTTPublishMessageOrEntityState);
        this.eventBus.onPublishEntityState(this, this.onMQTTPublishMessageOrEntityState);
    }
    async stop() {
        await super.stop();
        if (this.wss) {
            for (const client of this.wss.clients) {
                client.send((0, json_stable_stringify_without_jsonify_1.default)({ topic: "bridge/state", payload: { state: "offline" } }));
                client.terminate();
            }
            this.wss.close();
        }
        await new Promise((resolve) => (this.server ? this.server.close(resolve) : resolve(undefined)));
    }
    onUpgrade(request, socket, head) {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
            // biome-ignore lint/style/noNonNullAssertion: `Only valid for request obtained from Server`
            const { searchParams } = new URL(request.url, "http://localhost"); // dummy base, may not be absolute
            const authToken = settings.get().frontend.auth_token;
            if (!authToken || authToken === searchParams.get("token")) {
                this.wss.emit("connection", ws, request);
            }
            else {
                ws.close(4401, "Unauthorized");
            }
        });
    }
    onWebSocketConnection(ws) {
        ws.on("error", (msg) => logger_1.default.error(`WebSocket error: ${msg.message}`));
        ws.on("message", (data, isBinary) => {
            if (!isBinary && data) {
                const message = data.toString();
                const { topic, payload } = JSON.parse(message);
                this.mqtt.onMessage(`${this.mqttBaseTopic}/${topic}`, Buffer.from((0, json_stable_stringify_without_jsonify_1.default)(payload)));
            }
        });
        for (const [topic, payload] of Object.entries(this.mqtt.retainedMessages)) {
            if (topic.startsWith(`${this.mqttBaseTopic}/`)) {
                ws.send((0, json_stable_stringify_without_jsonify_1.default)({
                    // Send topic without base_topic
                    topic: topic.substring(this.mqttBaseTopic.length + 1),
                    payload: utils_1.default.parseJSON(payload.payload, payload.payload),
                }));
            }
        }
        for (const device of this.zigbee.devicesIterator(utils_1.default.deviceNotCoordinator)) {
            const payload = this.state.get(device);
            const lastSeen = settings.get().advanced.last_seen;
            if (lastSeen !== "disable") {
                payload.last_seen = utils_1.default.formatDate(device.zh.lastSeen ?? /* v8 ignore next */ 0, lastSeen);
            }
            if (device.zh.linkquality !== undefined) {
                payload.linkquality = device.zh.linkquality;
            }
            ws.send((0, json_stable_stringify_without_jsonify_1.default)({ topic: device.name, payload }));
        }
    }
    onMQTTPublishMessageOrEntityState(data) {
        let topic;
        let payload;
        if ("topic" in data) {
            // MQTTMessagePublished
            if (data.options.meta.isEntityState || !data.topic.startsWith(`${this.mqttBaseTopic}/`)) {
                // Don't send entity state to frontend on `MQTTMessagePublished` event, this is handled by
                // `PublishEntityState` instead. Reason for this is to skip attribute messages when `output` is
                // set to `attribute` or `attribute_and_json`, we only want to send JSON entity states to the
                // frontend.
                return;
            }
            // Send topic without base_topic
            topic = data.topic.substring(this.mqttBaseTopic.length + 1);
            payload = utils_1.default.parseJSON(data.payload, data.payload);
        }
        else {
            // PublishEntityState
            topic = data.entity.name;
            payload = data.message;
        }
        for (const client of this.wss.clients) {
            if (client.readyState === ws_1.default.OPEN) {
                client.send((0, json_stable_stringify_without_jsonify_1.default)({ topic, payload }));
            }
        }
    }
}
exports.Frontend = Frontend;
__decorate([
    bind_decorator_1.default
], Frontend.prototype, "onUpgrade", null);
__decorate([
    bind_decorator_1.default
], Frontend.prototype, "onWebSocketConnection", null);
__decorate([
    bind_decorator_1.default
], Frontend.prototype, "onMQTTPublishMessageOrEntityState", null);
exports.default = Frontend;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnJvbnRlbmQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvZXh0ZW5zaW9uL2Zyb250ZW5kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDhEQUFpQztBQUNqQyxxQ0FBaUQ7QUFFakQseUNBQXVDO0FBQ3ZDLDJDQUE4RDtBQUU5RCx5Q0FBZ0M7QUFDaEMsb0VBQWtDO0FBQ2xDLDhFQUFvRDtBQUNwRCxnRUFBd0M7QUFDeEMsa0hBQThEO0FBQzlELDRDQUEyQjtBQUUzQix3REFBZ0M7QUFDaEMsNERBQW9DO0FBQ3BDLDJEQUE2QztBQUM3QywwREFBa0M7QUFDbEMsNERBQW9DO0FBRXBDOztHQUVHO0FBQ0gsTUFBYSxRQUFTLFNBQVEsbUJBQVM7SUFDM0IsYUFBYSxDQUFTO0lBQ3RCLE1BQU0sQ0FBcUI7SUFDM0IsR0FBRyxDQUFvQjtJQUN2QixPQUFPLENBQVM7SUFFeEIsWUFDSSxNQUFjLEVBQ2QsSUFBVSxFQUNWLEtBQVksRUFDWixrQkFBc0MsRUFDdEMsUUFBa0IsRUFDbEIsc0JBQXdFLEVBQ3hFLGVBQW9DLEVBQ3BDLFlBQXFEO1FBRXJELEtBQUssQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxrQkFBa0IsRUFBRSxRQUFRLEVBQUUsc0JBQXNCLEVBQUUsZUFBZSxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBRWhILE1BQU0sZ0JBQWdCLEdBQUcsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLFFBQVEsQ0FBQztRQUNqRCxJQUFBLHFCQUFNLEVBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLDBEQUEwRCxDQUFDLENBQUM7UUFDN0YsSUFBSSxDQUFDLE9BQU8sR0FBRyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUM7UUFDekMsSUFBSSxDQUFDLGFBQWEsR0FBRyxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FB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