import * as fromZigbee from "./converters/fromZigbee";
import * as toZigbee from "./converters/toZigbee";
import { access, Binary, Climate, Composite, Cover, Enum, Fan, Feature, Light, List, Lock, Numeric, Switch, Text } from "./lib/exposes";
import { Definition, DefinitionWithExtend, Expose, ExternalDefinitionWithExtend, type KeyValue, type OnEvent, Option, Tz, type Zh } from "./lib/types";
export { ACTIONS, MqttRawPayload } from "./converters/actions";
export { setLogger } from "./lib/logger";
export { clear as clearGlobalStore } from "./lib/store";
export { access, Binary, Climate, Composite, Cover, Definition, DefinitionWithExtend, Enum, Expose, ExternalDefinitionWithExtend, Fan, Feature, fromZigbee, Light, List, Lock, Numeric, type OnEvent, Option, Switch, Text, Tz, toZigbee, };
export declare const externalDefinitions: DefinitionWithExtend[];
export declare function removeExternalDefinitions(converterName?: string): void;
export declare function addExternalDefinition(definition: ExternalDefinitionWithExtend): void;
export declare function prepareDefinition(definition: DefinitionWithExtend): Definition;
export declare function postProcessConvertedFromZigbeeMessage(definition: Definition, payload: KeyValue, options: KeyValue, device: Zh.Device): void;
export declare function findByDevice(device: Zh.Device, generateForUnknown?: boolean): Promise<Definition | undefined>;
export declare function findDefinition(device: Zh.Device, generateForUnknown?: boolean): Promise<DefinitionWithExtend | undefined>;
export declare function generateExternalDefinitionSource(device: Zh.Device): Promise<string>;
export declare function generateExternalDefinition(device: Zh.Device): Promise<Definition>;
export declare function onEvent(event: OnEvent.Event): Promise<void>;
//# sourceMappingURL=index.d.ts.map