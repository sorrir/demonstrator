import { CsEventType, CsPort } from "./types";
import { CmPort } from "../camera-module/types";
import { OneWayEvent } from "@sorrir/framework";
import { LpImageData } from "../../types/data";

/**
 * Event to feed image data to a camera module
 */
export type CsFeedImageDataEvent<
  PortType extends CsPort.TO_CM | CmPort.FROM_CS
> = Omit<OneWayEvent<CsEventType.FEED_IMAGE_DATA, PortType>, "param"> & {
  port: PortType;
  param: {
    imageData: LpImageData;
  };
};
