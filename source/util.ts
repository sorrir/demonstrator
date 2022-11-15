import {
  RaiseEventCallBack,
  ErrorEvent,
  RequestEvent,
} from "@sorrir/framework";
import _ = require("lodash");
import { ErrorEventType, ReturnCode } from "./types/misc";
import { v4 as uuidv4 } from "uuid";

export function getUniqueID(): string {
  return uuidv4();
}
