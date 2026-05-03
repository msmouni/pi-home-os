import type { DefinitionWithExtend } from "../lib/types";
export interface ElkoThermostatCluster {
    attributes: {
        elkoLoad: number;
        elkoDisplayText: string;
        elkoSensor: number;
        elkoRegulatorTime: number;
        elkoRegulatorMode: number;
        elkoPowerStatus: number;
        elkoDateTime: Buffer;
        elkoMeanPower: number;
        elkoExternalTemp: number;
        elkoNightSwitching: number;
        elkoFrostGuard: number;
        elkoChildLock: number;
        elkoMaxFloorTemp: number;
        elkoRelayState: number;
        elkoVersion: Buffer;
        elkoCalibration: number;
        elkoLastMessageId: number;
        elkoLastMessageStatus: number;
    };
    commands: never;
    commandResponses: never;
}
export declare const definitions: DefinitionWithExtend[];
//# sourceMappingURL=elko.d.ts.map