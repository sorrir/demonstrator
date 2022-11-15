/**
 * Plate-Recognition Service (PRS)
 *
 * PRS receives raw images from cameras and uses OCR or similar
 * techniques to extract the number plate shown in the image. This information is
 * used by entry and exit barriers to identify cars.
 *
 * Interaction: SEB, SXB
 */

import {
  AtomicComponent,
  createStatemachineComponent,
  RaiseEventCallBack,
  RequestEvent,
  ResolveEvent,
  ErrorEvent,
  StateMachine,
  StateMachineState,
} from "@sorrir/framework";
import { ReturnCode } from "../../types/misc";
import { LpImageData } from "../../types/data";
import {
  PrsImageAnalysisRequestEvent,
  PrsSuccessfulImageAnalysisEvent,
} from "./events";
import { PrsEventType, PrsPort } from "./types";

/**
 * Creates a transition for image analysis requests
 *
 * @param target sxb or seb
 * @returns the transition
 */
function getImageAnalysisRequestTransition(target: "sxc" | "sec") {
  const sourcePort = target === "sec" ? PrsPort.FROM_SEC : PrsPort.FROM_SXC;
  const targetPort = target === "sec" ? PrsPort.TO_SEC : PrsPort.TO_SXC;
  return {
    sourceState: undefined,
    targetState: undefined,
    event: <any>["request", PrsEventType.REQUEST_IMAGE_ANALYSIS, sourcePort],
    action: (
      currentState: undefined,
      raiseEvent: RaiseEventCallBack<PrsEventType, PrsPort>,
      event: RequestEvent<PrsEventType, PrsPort> | undefined
    ) => {
      // get data from request
      const requestEvent = event! as PrsImageAnalysisRequestEvent<
        typeof sourcePort
      >;
      const { imageData } = requestEvent.param;

      // mock OCR functionality via regex
      const regex =
        /(\p{Letter}{1,3})[ -]+=?(\p{Letter}{1,2})[ -]*=?([0-9]{1,4})/u;
      const ocrData = imageData.match(regex);
      let licensePlate: string | undefined;
      if (ocrData !== null && ocrData.length === 4) {
        licensePlate = `${ocrData[1]}-${ocrData[2]} ${ocrData[3]}`; // format: SO-RR 1234
      }

      // resolve request or raise error
      if (licensePlate !== undefined) {
        const responseEvent: Omit<
          PrsSuccessfulImageAnalysisEvent<typeof targetPort>,
          "id"
        > = {
          eventClass: "resolve",
          type: PrsEventType.SUCCESSFUL_IMAGE_ANALYSIS,
          param: {
            licensePlate: licensePlate,
          },
          port: targetPort,
          answerToRequestID: requestEvent.id,
          rc: ReturnCode.OK,
        };
        raiseEvent(responseEvent);
      } else {
        const errorEvent: Omit<ErrorEvent<PrsEventType, PrsPort>, "id"> = {
          rc: ReturnCode.GENERIC_ERROR,
          answerToRequestID: requestEvent.id,
          error: "No license plate detected",
          eventClass: "error",
          type: PrsEventType.UNSUCCESSFUL_IMAGE_ANALYSIS,
          layer: "ApplicationLayer",
          port: targetPort,
        };
        raiseEvent(errorEvent);
      }

      // return state
      return currentState;
    },
  };
}

/**
 * Statemachine
 */
const sm: StateMachine<undefined, undefined, PrsEventType, PrsPort> = {
  transitions: [
    /**
     * Handle image analysis requests
     */
    getImageAnalysisRequestTransition("sec"),
    getImageAnalysisRequestTransition("sxc"),
  ],
};

/**
 * Component for setup
 */
export const prs: AtomicComponent<PrsEventType, PrsPort> =
  createStatemachineComponent(
    [
      {
        name: PrsPort.FROM_SEC,
        eventTypes: [PrsEventType.REQUEST_IMAGE_ANALYSIS],
        direction: "in",
      },
      {
        name: PrsPort.FROM_SXC,
        eventTypes: [PrsEventType.REQUEST_IMAGE_ANALYSIS],
        direction: "in",
      },
      {
        name: PrsPort.TO_SEC,
        eventTypes: [
          PrsEventType.SUCCESSFUL_IMAGE_ANALYSIS,
          PrsEventType.UNSUCCESSFUL_IMAGE_ANALYSIS,
        ],
        direction: "out",
      },
      {
        name: PrsPort.TO_SXC,
        eventTypes: [
          PrsEventType.SUCCESSFUL_IMAGE_ANALYSIS,
          PrsEventType.UNSUCCESSFUL_IMAGE_ANALYSIS,
        ],
        direction: "out",
      },
    ],
    sm,
    "prs"
  );

/**
 * Start states
 */
export const prsStartState: StateMachineState<
  undefined,
  undefined,
  PrsEventType,
  PrsPort
> = {
  state: {
    fsm: undefined,
    my: undefined,
  },
  events: [],
  tsType: "State",
};
