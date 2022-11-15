import { OneWayEvent } from "@sorrir/framework";
import { SecPort, SxcPort } from "../smart-console/types";
import { BmEventType, BmPort } from "./types";

/**
 * Barrier Module open event
 */
export type BmOpenEvent<
  PortType extends BmPort.FROM_SC | SecPort.TO_BM | SxcPort.TO_BM
> = OneWayEvent<BmEventType.OPEN, PortType> & {
  port: PortType;
};

/**
 * Barrier Module close event
 */
export type BmCloseEvent<
  PortType extends BmPort.FROM_SC | SecPort.TO_BM | SxcPort.TO_BM
> = OneWayEvent<BmEventType.CLOSE, PortType> & {
  port: PortType;
};
