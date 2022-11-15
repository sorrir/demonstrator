import { OneWayEvent } from "@sorrir/framework";
import { CsPort } from "../car-simulator/types";
import { ScEventType, SecPort, SxcPort } from "./types";

/**
 * Event when a car is detected.
 */
export type ScCarDetectionEvent<
  PortType extends
    | SecPort.FROM_CS
    | CsPort.TO_SEC
    | SxcPort.FROM_CS
    | CsPort.TO_SXC
> = Omit<OneWayEvent<ScEventType.CAR_DETECTED, PortType>, "param"> & {
  port: PortType;
  param: {
    timestamp: string;
  };
};

/**
 * Event when no car is detected anymore.
 */
export type ScCarDetectionEndedEvent<
  PortType extends SecPort.FROM_CS | CsPort.TO_SEC
> = OneWayEvent<ScEventType.CAR_DETECTION_ENDED, PortType>;
