import { PmsRequestPaymentEvent, PmsRequestReservationEvent } from "./events";
import {
  column,
  row,
  level,
  ParkingSpaceStatus,
  AccountData,
  Reservation,
} from "../../types/data";

/**
 * State
 */
export enum PmsState {
  INIT = "INIT",
  IDLE = "IDLE",
  WAITING_FOR_ACS = "WAITING_FOR_ACS",
  PROCESS_ACCOUNT_DATA = "PROCESS_ACCOUNT_DATA",
  PREPARE_PAYMENT = "PREPARE_PAYMENT",
  WAITING_FOR_PSP = "WAITING_FOR_PSP",
  CLEAR_CACHE = "EMPTY_CACHE",
}

/**
 * Internal State
 */
export type PmsInternalState = {
  readonly size: { rows: number; columns: number; levels: number };
  parkingSpaceStatuses: {
    [column: column]: {
      [row: row]: {
        [level: level]: ParkingSpaceStatus;
      };
    };
  }; // dimension: columns, rows, levels
  cachedRequestReservationEvent?: PmsRequestReservationEvent<
    PmsPort.FROM_WS | PmsPort.FROM_SEC
  >;
  cachedRequestPaymentEvent?: PmsRequestPaymentEvent<PmsPort.FROM_SXC>;
  cachedAccountData?: AccountData;
  cachedReservation?: Reservation;
};

export enum PmsPort {
  FROM_PSS = "FROM_PSS",
  TO_PSS = "TO_PSS",
  TO_WS = "TO_WS",
  FROM_WS = "FROM_WS",
  TO_ACS = "TO_ACS",
  FROM_ACS = "FROM_ACS",
  FROM_SEC = "FROM_SEC",
  TO_SEC = "TO_SEC",
  FROM_SXC = "FROM_SXC",
  TO_SXC = "TO_SXC",
  FROM_PSP = "FROM_PSP",
  TO_PSP = "TO_PSP",
}

export enum PmsEventType {
  CHECK_FOR_RESERVATION = "CHECK_FOR_RESERVATION",
  RESOLVE_RESERVATION = "RESOLVE_RESERVATION",
  RESERVATION_DOES_NOT_EXIST = "RESERVATION_DOES_NOT_EXIST",
  CONFIRM_RESERVATION = "CONFIRM_RESERVATION",
  REJECT_RESERVATION = "REJECT_RESERVATION",
  REJECT_RESERVATION_WITH_ERROR = "REJECT_RESERVATION_WITH_ERROR",
  REQUEST_RESERVATION = "REQUEST_RESERVATION",
  REQUEST_CANCELLATION = "REQUEST_CANCELLATION",
  CONFIRM_CANCELLATION = "CONFIRM_CANCELLATION",
  REJECT_CANCELLATION = "REJECT_CANCELLATION",
  REQUEST_PAYMENT = "REQUEST_PAYMENT",
  CONFIRM_PAYMENT = "CONFIRM_PAYMENT",
  REJECT_PAYMENT = "REJECT_PAYMENT",
}
