import { ParkingSpaceLocation } from "../../types/data";

export enum PssState {
  OCCUPIED = "OCCUPIED",
  EMPTY = "EMPTY",
}

/**
 * Internal State
 */
export type PssInternalState = {
  readonly location: ParkingSpaceLocation;
};

export enum PssPort {
  FROM_PMS = "FROM_PMS",
  TO_PMS = "TO_PMS",
  FROM_CS = "FROM_CS",
}

/**
 * PSS
 */
export enum PssEventType {
  REPORT_STATUS = "REPORT_STATUS",
  REQUEST_STATUS = "REQUEST_STATUS",
  SET_OCCUPIED = "SET_OCCUPIED",
  SET_EMPTY = "SET_EMPTY",
}
