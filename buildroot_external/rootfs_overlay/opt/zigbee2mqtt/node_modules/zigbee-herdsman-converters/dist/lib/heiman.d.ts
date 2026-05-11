import { Zcl } from "zigbee-herdsman";
import type { ModernExtend } from "../lib/types";
export declare const manufacturerOptions: {
    manufacturerCode: Zcl.ManufacturerCode;
};
export interface HeimanSpecificAirQualityCluster {
    attributes: {
        language: number;
        unitOfMeasure: number;
        batteryState: number;
        pm10measuredValue: number;
        tvocMeasuredValue: number;
        aqiMeasuredValue: number;
        temperatureMeasuredMax: number;
        temperatureMeasuredMin: number;
        humidityMeasuredMax: number;
        humidityMeasuredMin: number;
        alarmEnable: number;
    };
    commands: {
        setLanguage: {
            languageCode: number;
        };
        setUnitOfTemperature: {
            unitsCode: number;
        };
        getTime: Record<string, never>;
    };
    commandResponses: never;
}
export interface HeimanSpecificAirQualityShortCluster {
    attributes: {
        batteryState: number;
        pm10measuredValue: number;
        aqiMeasuredValue: number;
    };
    commands: never;
    commandResponses: never;
}
export interface HeimanSpecificScenesCluster {
    attributes: never;
    commands: {
        cinema: Record<string, never>;
        atHome: Record<string, never>;
        sleep: Record<string, never>;
        goOut: Record<string, never>;
        repast: Record<string, never>;
    };
    commandResponses: never;
}
export interface HeimanSpecificInfraRedRemoteCluster {
    attributes: never;
    commands: {
        sendKey: {
            id: number;
            keyCode: number;
        };
        studyKey: {
            id: number;
            keyCode: number;
        };
        deleteKey: {
            id: number;
            keyCode: number;
        };
        createId: {
            modelType: number;
        };
        getIdAndKeyCodeList: Record<string, never>;
    };
    commandResponses: {
        studyKeyRsp: {
            id: number;
            keyCode: number;
            result: number;
        };
        createIdRsp: {
            id: number;
        };
        getIdAndKeyCodeListRsp: {
            packetsTotal: number;
            packetNumber: number;
            packetLength: number;
            learnedDevicesList: number[];
        };
    };
}
export declare function addCustomClusterHeimanSpecificAirQuality(): ModernExtend;
export declare function addCustomClusterHeimanSpecificAirQualityShort(): ModernExtend;
export declare function addCustomClusterHeimanSpecificScenes(): ModernExtend;
export declare function addCustomClusterHeimanSpecificInfraRedRemote(): ModernExtend;
//# sourceMappingURL=heiman.d.ts.map