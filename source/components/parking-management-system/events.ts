import { RequestEvent, ResolveEvent, ErrorEvent } from "@sorrir/framework";
import { ParkingSpaceLocation, Reservation } from "../../types/data";
import { ReturnCode } from "../../types/misc";
import { SecPort, SxcPort } from "../smart-console/types";
import { WsPort } from "../web-service/types";
import { PmsEventType, PmsPort } from "./types";

/**
 * Event to confirm reservation to external user
 */
export type PmsConfirmReservationEvent<
  PortType extends
    | PmsPort.TO_WS
    | WsPort.FROM_PMS
    | PmsPort.TO_SEC
    | SecPort.FROM_PMS
> = Omit<ResolveEvent<PmsEventType.CONFIRM_RESERVATION, PortType>, "param"> & {
  param: { location: ParkingSpaceLocation; dateFrom: string; dateTo: string };
  port: PortType;
};

/**
 * Event to request a reservation
 */
export type PmsRequestReservationEvent<
  PortType extends
    | PmsPort.FROM_WS
    | WsPort.TO_PMS
    | PmsPort.FROM_SEC
    | SecPort.TO_PMS
    | PmsPort.FROM_SXC
    | SxcPort.TO_PMS
> = Omit<RequestEvent<PmsEventType.REQUEST_RESERVATION, PortType>, "param"> & {
  param: {
    accountID: string;
    dateFrom: string;
    dateTo: string;
    eCharging?: boolean;
    accessibility?: boolean;
  };
  port: PortType;
};

/**
 * Event to check for a reservation of a given account
 */
export type PmsCheckForReservationEvent<
  PortType extends
    | PmsPort.FROM_SEC
    | SecPort.TO_PMS
    | PmsPort.FROM_SXC
    | SxcPort.TO_PMS
> = Omit<
  RequestEvent<PmsEventType.CHECK_FOR_RESERVATION, PortType>,
  "param"
> & {
  param: {
    accountID: string;
    timestamp?: string;
  };
  port: PortType;
};

/**
 * Event to check for a reservation of a given account
 */
export type PmsResolveReservationEvent<
  PortType extends
    | PmsPort.TO_SEC
    | SecPort.FROM_PMS
    | PmsPort.TO_SXC
    | SxcPort.FROM_PMS
> = Omit<ResolveEvent<PmsEventType.RESOLVE_RESERVATION, PortType>, "param"> & {
  param: {
    reservation: Reservation;
  };
  port: PortType;
};

/**
 * Event to cancel a reservation
 */
export type PmsCancelReservationEvent<
  PortType extends PmsPort.FROM_WS | WsPort.TO_PMS
> = Omit<RequestEvent<PmsEventType.REQUEST_CANCELLATION, PortType>, "param"> & {
  param: {
    accountID: string;
  };
  port: PortType;
};

/**
 * Event to pay for a reservation when the client
 * leaves the smart parking garage
 */
export type PmsRequestPaymentEvent<
  PortType extends PmsPort.FROM_SXC | SxcPort.TO_PMS
> = Omit<RequestEvent<PmsEventType.REQUEST_PAYMENT, PortType>, "param"> & {
  param: {
    reservationID: string;
    accountID: string;
    timestamp: string;
  };
  port: PortType;
};

/**
 * Event to confirm payment for a reservation when the client
 * leaves the smart parking garage
 */
export type PmsConfirmPaymentEvent<
  PortType extends PmsPort.TO_SXC | SxcPort.FROM_PMS
> = Omit<ResolveEvent<PmsEventType.CONFIRM_PAYMENT, PortType>, "param"> & {
  param: {
    amount: number;
  };
  port: PortType;
  rc: ReturnCode.OK;
};

/**
 * Event to reject payment for a reservation when the client
 * leaves the smart parking garage
 */
export type PmsRejectPaymentEvent<
  PortType extends PmsPort.TO_SXC | SxcPort.FROM_PMS
> = ErrorEvent<PmsEventType.REJECT_PAYMENT, PortType> & {
  port: PortType;
  rc: ReturnCode.GENERIC_ERROR;
};
