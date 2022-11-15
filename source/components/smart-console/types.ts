import { AccountData } from "../../types/data";
import { ScCarDetectionEvent } from "./events";

// shared by all smart consoles

export enum ScEventType {
  CAR_DETECTED = "CAR_DETECTED",
  CAR_DETECTION_ENDED = "CAR_DETECTION_ENDED",
}

// sec only

export enum SecState {
  IDLE = "IDLE",
  WAITING_FOR_CM = "WAITING_FOR_CM",
  WAITING_FOR_PRS = "WAITING_FOR_PRS",
  WAITING_FOR_ACS = "WAITING_FOR_ACS",
  WAITING_FOR_PMS = "WAITING_FOR_PMS",
  WAITING_FOR_USER = "WAITING_FOR_USER",
  ARRIVAL_SUCCESSFUL = "ARRIVAL_COMPLETED",
  ARRIVAL_FAILED = "ARRIVAL_FAILED",
}

export type SecStateInternal = {
  cachedCarDetectionEvent?: ScCarDetectionEvent<SecPort.FROM_CS>;
  cachedAccountData?: AccountData;
};

export enum SecPort {
  TO_PRS = "TO_PRS",
  FROM_PRS = "FROM_PRS",
  FROM_CS = "FROM_CS",
  FROM_US = "FROM_US",
  TO_PMS = "TO_PMS",
  FROM_PMS = "FROM_PMS",
  TO_ACS = "TO_ACS",
  FROM_ACS = "FROM_ACS",
  TO_BM = "TO_BM",
  TO_CM = "TO_CM",
  FROM_CM = "FROM_CM",
}

// sxc only

export enum SxcState {
  IDLE = "IDLE",
  WAITING_FOR_CM = "WAITING_FOR_CM",
  WAITING_FOR_PRS = "WAITING_FOR_PRS",
  WAITING_FOR_ACS = "WAITING_FOR_ACS",
  WAITING_FOR_PMS = "WAITING_FOR_PMS",
  WAITING_FOR_USER = "WAITING_FOR_USER",
  LEAVING_SUCCESSFUL = "LEAVING_COMPLETED",
  LEAVING_FAILED = "LEAVING_FAILED",
}

export type SxcStateInternal = {
  cachedCarDetectionEvent?: ScCarDetectionEvent<SxcPort.FROM_CS>;
  cachedAccountData?: AccountData;
};

export enum SxcPort {
  TO_PRS = "TO_PRS",
  FROM_PRS = "FROM_PRS",
  FROM_CS = "FROM_CS",
  FROM_US = "FROM_US",
  TO_PMS = "TO_PMS",
  FROM_PMS = "FROM_PMS",
  TO_ACS = "TO_ACS",
  FROM_ACS = "FROM_ACS",
  TO_BM = "TO_BM",
  TO_CM = "TO_CM",
  FROM_CM = "FROM_CM",
}
