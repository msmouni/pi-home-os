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
exports.onboard = onboard;
const node_fs_1 = require("node:fs");
const node_http_1 = require("node:http");
const node_path_1 = __importDefault(require("node:path"));
const express_static_gzip_1 = __importDefault(require("express-static-gzip"));
const finalhandler_1 = __importDefault(require("finalhandler"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const jszip_1 = __importDefault(require("jszip"));
const adapterDiscovery_1 = require("zigbee-herdsman/dist/adapter/adapterDiscovery");
const data_1 = __importDefault(require("./data"));
const settings = __importStar(require("./settings"));
const yaml_1 = require("./yaml");
/** same as extension/frontend */
const FILE_SERVER_OPTIONS = {
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
function getServerUrl() {
    return new URL(process.env.Z2M_ONBOARD_URL ?? "http://0.0.0.0:8080");
}
function getZipEntryTargetPath(entryName) {
    const normalizedEntry = entryName.replace(/\\/g, "/");
    if (!normalizedEntry || normalizedEntry.startsWith("/") || normalizedEntry.includes("\0")) {
        throw new Error(`Invalid ZIP entry path '${entryName}'`);
    }
    const basePath = node_path_1.default.resolve(data_1.default.getPath());
    const targetPath = node_path_1.default.resolve(basePath, normalizedEntry);
    const relativePath = node_path_1.default.relative(basePath, targetPath);
    if (relativePath.startsWith("..") || node_path_1.default.isAbsolute(relativePath)) {
        throw new Error(`Unsafe ZIP entry path '${entryName}'`);
    }
    return targetPath;
}
async function extractZipDataToDataPath(zipContent) {
    const zip = await jszip_1.default.loadAsync(zipContent);
    for (const key in zip.files) {
        const entry = zip.files[key];
        const targetPath = getZipEntryTargetPath(entry.name);
        if (entry.dir) {
            (0, node_fs_1.mkdirSync)(targetPath, { recursive: true });
            continue;
        }
        (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(targetPath), { recursive: true });
        (0, node_fs_1.writeFileSync)(targetPath, await entry.async("nodebuffer"));
    }
}
async function startOnboardingServer() {
    const currentSettings = settings.get();
    const serverUrl = getServerUrl();
    let server;
    const fileServer = (0, express_static_gzip_1.default)((await import("zigbee2mqtt-windfront")).default.getOnboardingPath(), FILE_SERVER_OPTIONS);
    const success = await new Promise((resolve) => {
        server = (0, node_http_1.createServer)(async (req, res) => {
            const pathname = new URL(req.url /* v8 ignore next */ ?? "/", serverUrl).pathname;
            if (req.method === "GET" && pathname === "/data") {
                const payload = {
                    page: "form",
                    settings: currentSettings,
                    settingsSchema: settings.schemaJson,
                    devices: await (0, adapterDiscovery_1.findAllDevices)(),
                };
                res.setHeader("Content-Type", "application/json");
                res.writeHead(200);
                res.end((0, json_stable_stringify_without_jsonify_1.default)(payload));
                return;
            }
            if (req.method === "POST") {
                if (pathname === "/submit") {
                    let body = "";
                    req.on("data", (chunk) => {
                        body += chunk;
                    });
                    req.on("end", () => {
                        try {
                            const result = (body ? JSON.parse(body) : {});
                            settings.apply(result);
                            const appliedSettings = settings.get();
                            const redirect = !process.env.Z2M_ONBOARD_NO_REDIRECT &&
                                appliedSettings.frontend.enabled &&
                                !appliedSettings.frontend.host?.startsWith("/");
                            const protocol = appliedSettings.frontend.ssl_cert && appliedSettings.frontend.ssl_key ? "https" : "http";
                            const frontendUrl = redirect
                                ? `${protocol}://${appliedSettings.frontend.host ?? "localhost"}:${appliedSettings.frontend.port}${appliedSettings.frontend.base_url}`
                                : null;
                            const payload = { success: true, frontendUrl };
                            res.setHeader("Content-Type", "application/json");
                            res.writeHead(200);
                            res.end((0, json_stable_stringify_without_jsonify_1.default)(payload), () => {
                                resolve(true);
                            });
                        }
                        catch (error) {
                            console.error(`Failed to apply configuration: ${error.message}`);
                            const payload = { success: false, error: error.message };
                            res.setHeader("Content-Type", "application/json");
                            res.writeHead(406);
                            res.end((0, json_stable_stringify_without_jsonify_1.default)(payload));
                        }
                    });
                    req.on("error", (error) => {
                        console.error(`Failed to parse request body: ${error.message}`);
                        const payload = { success: false, error: error.message };
                        res.setHeader("Content-Type", "application/json");
                        res.writeHead(406);
                        res.end((0, json_stable_stringify_without_jsonify_1.default)(payload));
                    });
                    return;
                }
                if (pathname === "/submit-zip") {
                    let body = "";
                    req.on("data", (chunk) => {
                        body += chunk;
                    });
                    req.on("end", async () => {
                        try {
                            if (!body) {
                                throw new Error("Invalid ZIP payload: missing content");
                            }
                            const zipContent = Buffer.from(body, "base64");
                            await extractZipDataToDataPath(zipContent);
                            const payload = { success: true, frontendUrl: null };
                            res.setHeader("Content-Type", "application/json");
                            res.writeHead(200);
                            res.end((0, json_stable_stringify_without_jsonify_1.default)(payload), () => {
                                resolve(true);
                            });
                        }
                        catch (error) {
                            console.error(`Failed to apply ZIP data: ${error.message}`);
                            const payload = { success: false, error: error.message };
                            res.setHeader("Content-Type", "application/json");
                            res.writeHead(406);
                            res.end((0, json_stable_stringify_without_jsonify_1.default)(payload));
                        }
                    });
                    req.on("error", (error) => {
                        console.error(`Failed to parse ZIP request body: ${error.message}`);
                        const payload = { success: false, error: error.message };
                        res.setHeader("Content-Type", "application/json");
                        res.writeHead(406);
                        res.end((0, json_stable_stringify_without_jsonify_1.default)(payload));
                    });
                    return;
                }
            }
            const next = (0, finalhandler_1.default)(req, res);
            fileServer(req, res, next);
        });
        server.on("error", (error) => {
            console.error("Failed to start onboarding server", error);
            resolve(false);
        });
        server.listen(Number.parseInt(serverUrl.port, 10), serverUrl.hostname, () => {
            console.log(`Onboarding page is available at ${serverUrl.href}`);
        });
    });
    await new Promise((resolve) => server?.close(resolve));
    return success;
}
async function startFailureServer(errors) {
    const serverUrl = getServerUrl();
    let server;
    const fileServer = (0, express_static_gzip_1.default)((await import("zigbee2mqtt-windfront")).default.getOnboardingPath(), FILE_SERVER_OPTIONS);
    await new Promise((resolve) => {
        server = (0, node_http_1.createServer)((req, res) => {
            const pathname = new URL(req.url /* v8 ignore next */ ?? "/", serverUrl).pathname;
            if (req.method === "GET" && pathname === "/data") {
                const payload = { page: "failure", errors };
                res.setHeader("Content-Type", "application/json");
                res.writeHead(200);
                res.end((0, json_stable_stringify_without_jsonify_1.default)(payload));
                return;
            }
            if (req.method === "POST" && pathname === "/submit") {
                res.writeHead(200);
                res.end(() => {
                    resolve();
                });
                return;
            }
            const next = (0, finalhandler_1.default)(req, res);
            fileServer(req, res, next);
        });
        server.listen(Number.parseInt(serverUrl.port, 10), serverUrl.hostname, () => {
            console.error(`Failure page is available at ${serverUrl.href}`);
        });
    });
    await new Promise((resolve) => server?.close(resolve));
}
async function onSettingsErrors(errors) {
    console.error("\n\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.error("            READ THIS CAREFULLY\n");
    console.error("Refusing to start because configuration is not valid, found the following errors:");
    for (const error of errors) {
        console.error(`- ${error}`);
    }
    console.error("\nIf you don't know how to solve this, read https://www.zigbee2mqtt.io/guide/configuration");
    console.error("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n\n");
    if (!process.env.Z2M_ONBOARD_NO_SERVER && !process.env.Z2M_ONBOARD_NO_FAILURE_PAGE) {
        await startFailureServer(errors);
    }
}
async function onboard() {
    if (!(0, node_fs_1.existsSync)(data_1.default.getPath())) {
        (0, node_fs_1.mkdirSync)(data_1.default.getPath(), { recursive: true });
    }
    const confExists = (0, node_fs_1.existsSync)(data_1.default.joinPath("configuration.yaml"));
    if (confExists) {
        // initial caching, ensure file is valid yaml first
        try {
            settings.getPersistedSettings();
        }
        catch (error) {
            await onSettingsErrors(error instanceof yaml_1.YAMLFileException
                ? [`Your configuration file: '${error.file}' is invalid (use https://jsonformatter.org/yaml-validator to find and fix the issue)`]
                : [`${error}`]);
            return false;
        }
        // migrate first
        const { migrateIfNecessary } = await import("./settingsMigration.js");
        migrateIfNecessary();
        // make sure existing settings are valid before applying envs
        const errors = settings.validateNonRequired();
        if (errors.length > 0) {
            await onSettingsErrors(errors);
            return false;
        }
        // trigger initial writing of `ZIGBEE2MQTT_CONFIG_*` ENVs
        settings.write();
    }
    else {
        settings.writeMinimalDefaults();
    }
    // use `configuration.yaml` file to detect "brand new install"
    // env allows to re-run onboard even with existing install
    if (!process.env.Z2M_ONBOARD_NO_SERVER && (process.env.Z2M_ONBOARD_FORCE_RUN || !confExists || settings.get().onboarding)) {
        settings.setOnboarding(true);
        const success = await startOnboardingServer();
        if (!success) {
            return false;
        }
    }
    settings.reRead();
    const errors = settings.validate();
    if (errors.length > 0) {
        await onSettingsErrors(errors);
        return false;
    }
    return true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib25ib2FyZGluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi91dGlsL29uYm9hcmRpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFrUkEsMEJBZ0VDO0FBbFZELHFDQUE2RDtBQUU3RCx5Q0FBdUM7QUFDdkMsMERBQTZCO0FBQzdCLDhFQUFvRDtBQUNwRCxnRUFBd0M7QUFDeEMsa0hBQThEO0FBQzlELGtEQUEwQjtBQUMxQixvRkFBNkU7QUFFN0Usa0RBQTBCO0FBQzFCLHFEQUF1QztBQUN2QyxpQ0FBeUM7QUFFekMsaUNBQWlDO0FBQ2pDLE1BQU0sbUJBQW1CLEdBQStDO0lBQ3BFLFlBQVksRUFBRSxJQUFJO0lBQ2xCLFdBQVcsRUFBRTtRQUNULHFCQUFxQjtRQUNyQixVQUFVLEVBQUUsQ0FBQyxHQUFtQixFQUFFLElBQVksRUFBUSxFQUFFO1lBQ3BELElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO2dCQUM5QixHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsRUFBRSxVQUFVLENBQUMsQ0FBQztZQUMvQyxDQUFDO1FBQ0wsQ0FBQztRQUNELG9CQUFvQjtLQUN2QjtDQUNKLENBQUM7QUFFRixTQUFTLFlBQVk7SUFDakIsT0FBTyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsSUFBSSxxQkFBcUIsQ0FBQyxDQUFDO0FBQ3pFLENBQUM7QUFFRCxTQUFTLHFCQUFxQixDQUFDLFNBQWlCO0lBQzVDLE1BQU0sZUFBZSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBRXRELElBQUksQ0FBQyxlQUFlLElBQUksZUFBZSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxlQUFlLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7UUFDeEYsTUFB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