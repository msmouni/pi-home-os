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
const logger_1 = __importDefault(require("../util/logger"));
const settings = __importStar(require("../util/settings"));
const utils_1 = __importDefault(require("../util/utils"));
const extension_1 = __importDefault(require("./extension"));
const SUPPORTED_FORMATS = ["raw", "graphviz", "plantuml"];
/**
 * This extension creates a network map
 */
class NetworkMap extends extension_1.default {
    #topic = `${settings.get().mqtt.base_topic}/bridge/request/networkmap`;
    // biome-ignore lint/suspicious/useAwait: API
    async start() {
        this.eventBus.onMQTTMessage(this, this.onMQTTMessage);
    }
    async onMQTTMessage(data) {
        if (data.topic === this.#topic) {
            const message = utils_1.default.parseJSON(data.message, data.message);
            try {
                const type = typeof message === "object" ? message.type : message;
                if (!SUPPORTED_FORMATS.includes(type)) {
                    throw new Error(`Type '${type}' not supported, allowed are: ${SUPPORTED_FORMATS.join(",")}`);
                }
                const routes = typeof message === "object" && message.routes;
                const topology = await this.networkScan(routes);
                let responseData;
                switch (type) {
                    case "raw": {
                        responseData = { type, routes, value: this.raw(topology) };
                        break;
                    }
                    case "graphviz": {
                        responseData = { type, routes, value: this.graphviz(topology) };
                        break;
                    }
                    case "plantuml": {
                        responseData = { type, routes, value: this.plantuml(topology) };
                        break;
                    }
                }
                await this.mqtt.publish("bridge/response/networkmap", (0, json_stable_stringify_without_jsonify_1.default)(utils_1.default.getResponse(message, responseData)));
            }
            catch (error) {
                await this.mqtt.publish("bridge/response/networkmap", (0, json_stable_stringify_without_jsonify_1.default)(utils_1.default.getResponse(message, {}, error.message)));
            }
        }
    }
    raw(topology) {
        return topology;
    }
    graphviz(topology) {
        const colors = settings.get().map_options.graphviz.colors;
        let text = "digraph G {\nnode[shape=record];\n";
        let style = "";
        for (const node of topology.nodes) {
            const labels = [];
            // Add friendly name
            labels.push(`${node.friendlyName}`);
            // Add the device short network address, ieeaddr and scan note (if any)
            labels.push(`${node.ieeeAddr} (${utils_1.default.toNetworkAddressHex(node.networkAddress)})${node.failed?.length ? `failed: ${node.failed.join(",")}` : ""}`);
            // Add the device model
            if (node.type !== "Coordinator") {
                labels.push(`${node.definition?.vendor} ${node.definition?.description} (${node.definition?.model})`);
            }
            // Add the device last_seen timestamp
            let lastSeen = "unknown";
            const date = node.type === "Coordinator" ? Date.now() : node.lastSeen;
            if (date) {
                lastSeen = utils_1.default.formatDate(date, "relative");
            }
            labels.push(lastSeen);
            // Escape backslashes and double-quotes to avoid breaking Graphviz .dot files.
            const escapedLabels = labels.map((label) => label.replace(/\\/g, "\\\\").replace(/"/g, '\\"'));
            // Shape the record according to device type
            if (node.type === "Coordinator") {
                style = `style="bold, filled", fillcolor="${colors.fill.coordinator}", fontcolor="${colors.font.coordinator}"`;
            }
            else if (node.type === "Router") {
                style = `style="rounded, filled", fillcolor="${colors.fill.router}", fontcolor="${colors.font.router}"`;
            }
            else {
                style = `style="rounded, dashed, filled", fillcolor="${colors.fill.enddevice}", fontcolor="${colors.font.enddevice}"`;
            }
            // Add the device with its labels to the graph as a node.
            text += `  "${node.ieeeAddr}" [${style}, label="{${escapedLabels.join("|")}}"];\n`;
            /**
             * Add an edge between the device and its child to the graph
             * NOTE: There are situations where a device is NOT in the topology, this can be e.g.
             * due to not responded to the lqi scan. In that case we do not add an edge for this device.
             */
            for (const link of topology.links) {
                if (link.source.ieeeAddr === node.ieeeAddr) {
                    const lineStyle = node.type === "EndDevice" ? "penwidth=1, " : !link.routes.length ? "penwidth=0.5, " : "penwidth=2, ";
                    const lineWeight = !link.routes.length
                        ? `weight=0, color="${colors.line.inactive}", `
                        : `weight=1, color="${colors.line.active}", `;
                    const textRoutes = link.routes.map((r) => utils_1.default.toNetworkAddressHex(r.destinationAddress));
                    const lineLabels = !link.routes.length
                        ? `label="${link.linkquality}"`
                        : `label="${link.linkquality} (routes: ${textRoutes.join(",")})"`;
                    text += `  "${node.ieeeAddr}" -> "${link.target.ieeeAddr}"`;
                    text += ` [${lineStyle}${lineWeight}${lineLabels}]\n`;
                }
            }
        }
        text += "}";
        return text.replace(/\0/g, "");
    }
    plantuml(topology) {
        const text = [];
        text.push(`' paste into: https://www.planttext.com/`);
        text.push("");
        text.push("@startuml");
        for (const node of topology.nodes.sort((a, b) => a.friendlyName.localeCompare(b.friendlyName))) {
            // Add friendly name
            text.push(`card ${node.ieeeAddr} [`);
            text.push(`${node.friendlyName}`);
            text.push("---");
            // Add the device short network address, ieeaddr and scan note (if any)
            text.push(`${node.ieeeAddr} (${utils_1.default.toNetworkAddressHex(node.networkAddress)})${node.failed?.length ? ` failed: ${node.failed.join(",")}` : ""}`);
            // Add the device model
            if (node.type !== "Coordinator") {
                text.push("---");
                const definition = this.zigbee.resolveEntity(node.ieeeAddr).definition;
                text.push(`${definition?.vendor} ${definition?.description} (${definition?.model})`);
            }
            // Add the device last_seen timestamp
            let lastSeen = "unknown";
            const date = node.type === "Coordinator" ? Date.now() : node.lastSeen;
            if (date) {
                lastSeen = utils_1.default.formatDate(date, "relative");
            }
            text.push("---");
            text.push(lastSeen);
            text.push("]");
            text.push("");
        }
        /**
         * Add edges between the devices
         * NOTE: There are situations where a device is NOT in the topology, this can be e.g.
         * due to not responded to the lqi scan. In that case we do not add an edge for this device.
         */
        for (const link of topology.links) {
            text.push(`${link.sourceIeeeAddr} --> ${link.targetIeeeAddr}: ${link.lqi}`);
        }
        text.push("");
        text.push("@enduml");
        return text.join("\n");
    }
    async networkScan(includeRoutes) {
        logger_1.default.info(`Starting network scan (includeRoutes '${includeRoutes}')`);
        const lqis = new Map();
        const routingTables = new Map();
        const failed = new Map();
        const requestWithRetry = async (request) => {
            try {
                const result = await request();
                return result;
            }
            catch {
                // Network is possibly congested, sleep 5 seconds to let the network settle.
                await utils_1.default.sleep(5);
                return await request();
            }
        };
        for (const device of this.zigbee.devicesIterator((d) => d.type !== "GreenPower" && d.type !== "EndDevice")) {
            if (device.options.disabled) {
                continue;
            }
            const deviceFailures = [];
            failed.set(device, deviceFailures);
            await utils_1.default.sleep(1); // sleep 1 second between each scan to reduce stress on network.
            try {
                const result = await requestWithRetry(async () => await device.zh.lqi());
                lqis.set(device, result);
                logger_1.default.debug(`LQI succeeded for '${device.name}'`);
            }
            catch (error) {
                deviceFailures.push("lqi"); // set above
                logger_1.default.error(`Failed to execute LQI for '${device.name}'`);
                // biome-ignore lint/style/noNonNullAssertion: always Error
                logger_1.default.debug(error.stack);
            }
            if (includeRoutes) {
                try {
                    const result = await requestWithRetry(async () => await device.zh.routingTable());
                    routingTables.set(device, result);
                    logger_1.default.debug(`Routing table succeeded for '${device.name}'`);
                }
                catch (error) {
                    deviceFailures.push("routingTable"); // set above
                    logger_1.default.error(`Failed to execute routing table for '${device.name}'`);
                    // biome-ignore lint/style/noNonNullAssertion: always Error
                    logger_1.default.debug(error.stack);
                }
            }
        }
        logger_1.default.info("Network scan finished");
        const topology = { nodes: [], links: [] };
        // XXX: display GP/disabled devices in the map, better feedback than just hiding them?
        for (const device of this.zigbee.devicesIterator((d) => d.type !== "GreenPower")) {
            if (device.options.disabled) {
                continue;
            }
            // Add nodes
            const definition = device.definition
                ? {
                    model: device.definition.model,
                    vendor: device.definition.vendor,
                    description: device.definition.description,
                    supports: Array.from(new Set(device.exposes().map((e) => {
                        return e.name ?? `${e.type} (${e.features?.map((f) => f.name).join(", ")})`;
                    }))).join(", "),
                }
                : undefined;
            topology.nodes.push({
                ieeeAddr: device.ieeeAddr,
                friendlyName: device.name,
                type: device.zh.type,
                networkAddress: device.zh.networkAddress,
                manufacturerName: device.zh.manufacturerName,
                modelID: device.zh.modelID,
                failed: failed.get(device),
                lastSeen: device.zh.lastSeen,
                definition,
            });
        }
        // Add links
        for (const [device, table] of lqis) {
            for (const neighbor of table) {
                if (neighbor.relationship > 3) {
                    // Relationship is not active, skip it
                    continue;
                }
                let neighborEui64 = neighbor.eui64;
                // Some Xiaomi devices return 0x00 as the neighbor ieeeAddr (obviously not correct).
                // Determine the correct ieeeAddr based on the networkAddress.
                if (neighborEui64 === "0x0000000000000000") {
                    const neighborDevice = this.zigbee.deviceByNetworkAddress(neighbor.nwkAddress);
                    if (neighborDevice) {
                        neighborEui64 = neighborDevice.ieeeAddr;
                    }
                }
                const link = {
                    source: { ieeeAddr: neighborEui64, networkAddress: neighbor.nwkAddress },
                    target: { ieeeAddr: device.ieeeAddr, networkAddress: device.zh.networkAddress },
                    deviceType: neighbor.deviceType,
                    rxOnWhenIdle: neighbor.rxOnWhenIdle,
                    relationship: neighbor.relationship,
                    permitJoining: neighbor.permitJoining,
                    depth: neighbor.depth,
                    lqi: neighbor.lqi,
                    routes: [],
                    // below are @deprecated
                    sourceIeeeAddr: neighborEui64,
                    targetIeeeAddr: device.ieeeAddr,
                    sourceNwkAddr: neighbor.nwkAddress,
                    linkquality: neighbor.lqi,
                };
                const routingTable = routingTables.get(device);
                if (routingTable) {
                    for (const entry of routingTable) {
                        if (entry.nextHopAddress === neighbor.nwkAddress) {
                            link.routes.push(entry);
                        }
                    }
                }
                topology.links.push(link);
            }
        }
        return topology;
    }
}
exports.default = NetworkMap;
__decorate([
    bind_decorator_1.default
], NetworkMap.prototype, "onMQTTMessage", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV0d29ya01hcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi9leHRlbnNpb24vbmV0d29ya01hcC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLG9FQUFrQztBQUNsQyxrSEFBOEQ7QUFJOUQsNERBQW9DO0FBQ3BDLDJEQUE2QztBQUM3QywwREFBa0M7QUFDbEMsNERBQW9DO0FBRXBDLE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxLQUFLLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBRTFEOztHQUVHO0FBQ0gsTUFBcUIsVUFBVyxTQUFRLG1CQUFTO0lBQzdDLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSw0QkFBNEIsQ0FBQztJQUV2RSw2Q0FBNkM7SUFDcEMsS0FBSyxDQUFDLEtBQUs7UUFDaEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUMxRCxDQUFDO0lBRVcsQUFBTixLQUFLLENBQUMsYUFBYSxDQUFDLElBQTJCO1FBQ2pELElBQUksSUFBSSxDQUFDLEtBQUssS0FBSyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDN0IsTUFBTSxPQUFPLEdBQUcsZUFBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQWdELENBQUM7WUFFM0csSUFBSSxDQUFDO2dCQUNELE1BQU0sSUFBSSxHQUFHLE9BQU8sT0FBTyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO2dCQUVsRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7b0JBQ3BDLE1BQU0sSUFB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