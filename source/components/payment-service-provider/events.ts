import { RequestEvent, ResolveEvent, ErrorEvent } from "@sorrir/framework";
import { LpImageData } from "../../types/data";
import { BmPort } from "../barrier-module/types";
import { PmsPort } from "../parking-management-system/types";
import { PspEventType, PspPort } from "./types";

/**
 * Event for requesting payment.
 */
export type PspRequestPaymentEvent<
  PortType extends PspPort.FROM_PMS | PmsPort.TO_PSP
> = Omit<RequestEvent<PspEventType.REQUEST_PAYMENT, PortType>, "param"> & {
  port: PortType;
  param: {
    billingInfo: string;
    amount: number;
  };
};

/**
 * Event for resolving payment.
 */
export type PspResolvePaymentEvent<
  PortType extends PspPort.TO_PMS | PmsPort.FROM_PSP
> = Omit<ResolveEvent<PspEventType.RESOLVE_PAYMENT, PortType>, "param"> & {
  port: PortType;
  param: {
    amount: number;
  };
};

/**
 * Event for rejecting payment
 */
export type PspRejectPaymentEvent<
  PortType extends PspPort.TO_PMS | PmsPort.FROM_PSP
> = ErrorEvent<PspEventType.RESOLVE_PAYMENT, PortType> & {
  port: PortType;
};
