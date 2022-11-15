import { RequestEvent, ResolveEvent } from "@sorrir/framework";
import { LpImageData } from "../../types/data";
import { SecPort, SxcPort } from "../smart-console/types";
import { PrsEventType, PrsPort } from "./types";

/**
 * Event for image analysis request
 */
export type PrsImageAnalysisRequestEvent<
  PortType extends
    | PrsPort.FROM_SEC
    | PrsPort.FROM_SXC
    | SecPort.TO_PRS
    | SxcPort.TO_PRS
> = Omit<
  RequestEvent<PrsEventType.REQUEST_IMAGE_ANALYSIS, PortType>,
  "param" | "type"
> & {
  type: PrsEventType.REQUEST_IMAGE_ANALYSIS;
  param: {
    imageData: LpImageData;
  };
  port: PortType;
};

/**
 * Event for successful image analysis response
 */
export type PrsSuccessfulImageAnalysisEvent<
  PortType extends
    | PrsPort.TO_SEC
    | PrsPort.TO_SXC
    | SecPort.FROM_PRS
    | SxcPort.FROM_PRS
> = Omit<
  ResolveEvent<PrsEventType.REQUEST_IMAGE_ANALYSIS, PortType>,
  "param" | "type"
> & {
  type: PrsEventType.SUCCESSFUL_IMAGE_ANALYSIS;
  param: {
    licensePlate: string; //has the format AA-BB1234
  };
  port: PortType;
};
