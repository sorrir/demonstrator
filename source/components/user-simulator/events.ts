import { RequestEvent } from "@sorrir/framework";
import { SecPort } from "../smart-console/types";
import { WsPort } from "../web-service/types";
import { UsEventType } from "./types";
import { UsPort } from "./types";

/**
 * Event to request a reservation via Web-Service
 */
export type UsRequestReservationWsEvent<
  PortType extends WsPort.FROM_US | UsPort.TO_WS
> = Omit<RequestEvent<UsEventType.REQUEST_RESERVATION, PortType>, "param"> & {
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
 * Event to request a cancellation via Web-Service
 */
export type UsRequestCancellationWsEvent<
  PortType extends WsPort.FROM_US | UsPort.TO_WS
> = Omit<RequestEvent<UsEventType.REQUEST_CANCELLATION, PortType>, "param"> & {
  param: {
    accountID: string;
  };
  port: PortType;
};

/**
 * Event to request a reservation via Smart Entrance Barrier
 */
export type UsRequestReservationSebEvent<
  PortType extends SecPort.FROM_US | UsPort.TO_SEC
> = Omit<RequestEvent<UsEventType.REQUEST_RESERVATION, PortType>, "param"> & {
  param: {
    dateTo: string;
    eCharging?: boolean;
    accessibility?: boolean;
  };
  port: PortType;
};
