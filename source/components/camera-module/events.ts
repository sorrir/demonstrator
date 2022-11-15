import { RequestEvent, ResolveEvent } from "@sorrir/framework";
import { LpImageData } from "../../types/data";
import { BmPort } from "../barrier-module/types";
import { SecPort, SxcPort } from "../smart-console/types";
import { CmEventType, CmPort } from "./types";

/**
 * Camera module events for requesting image.
 */
export type CmRequestImageEvent<
  PortType extends CmPort.FROM_SC | SecPort.TO_CM | SxcPort.TO_CM
> = RequestEvent<CmEventType.REQUEST_IMAGE, PortType> & {
  port: PortType;
};

/**
 * Camera module events for resolving image.
 */
export type CmResolveImageEvent<
  PortType extends CmPort.TO_SC | SecPort.FROM_CM | SxcPort.FROM_CM
> = Omit<ResolveEvent<CmEventType.RESOLVE_IMAGE, PortType>, "param"> & {
  port: PortType;
  param: {
    imageData: LpImageData;
  };
};
