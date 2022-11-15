import { PssEventType, PssPort } from "./types";
import { PmsPort } from "../parking-management-system/types";
import { DistributiveOmit, OneWayEvent, ResolveEvent } from "@sorrir/framework";
import { ParkingSpaceLocation } from "../../types/data";

/**
 * Event for reporting status
 */
export type PssReportStatusEvent<
  PortType extends PssPort.TO_PMS | PmsPort.FROM_PSS
> = DistributiveOmit<
  | ResolveEvent<PssEventType.REPORT_STATUS, PortType>
  | OneWayEvent<PssEventType.REPORT_STATUS, PortType>,
  "param"
> & {
  param: { location: ParkingSpaceLocation; isOccupied: boolean };
  port: PortType;
};
