import { RequestEvent, ResolveEvent } from "@sorrir/framework";
import { AccountData } from "../../types/data";
import { PmsPort } from "../parking-management-system/types";
import { SecPort, SxcPort } from "../smart-console/types";
import { AcsEventType, AcsPort } from "./types";

/**
 * ACS event for requesting data by id
 */
export type AcsRequestDataByIdEvent<
  PortType extends AcsPort.FROM_PMS | PmsPort.TO_ACS
> = Omit<
  RequestEvent<AcsEventType.REQUEST_ACCOUNT_DATA_BY_ID, PortType>,
  "param"
> & {
  param: { accountID: string };
  port: PortType;
};

/**
 * ACS event for requesting data by license plate
 */
export type AcsRequestDataByLicensePlateEvent<
  PortType extends
    | AcsPort.FROM_PMS
    | PmsPort.TO_ACS
    | AcsPort.FROM_SEC
    | SecPort.TO_ACS
    | AcsPort.FROM_SXC
    | SxcPort.TO_ACS
> = Omit<
  RequestEvent<AcsEventType.REQUEST_ACCOUNT_DATA_BY_LICENSE_PLATE, PortType>,
  "param"
> & {
  param: { licensePlate: string };
  port: PortType;
};

/**
 * ACS event for returning data
 */
export type AcsResolveDataEvent<
  PortType extends
    | AcsPort.TO_PMS
    | PmsPort.FROM_ACS
    | AcsPort.TO_SEC
    | SecPort.FROM_ACS
    | AcsPort.TO_SXC
    | SxcPort.FROM_ACS
> = Omit<
  ResolveEvent<AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST, PortType>,
  "param"
> & {
  param: { accountData: AccountData };
  port: PortType;
};
