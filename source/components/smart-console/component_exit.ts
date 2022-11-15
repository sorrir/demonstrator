/**
 * Smart Exit Console (SXC)
 *
 * An enclosure mounted at the exit of each smart parking garage.
 * There could be multiple SXCs at the exits. It ensures that cars are able to leave
 * the parking garage. Further, it ensures that all cars leaving the garage are
 * registered with timestamp and number plate. This information is the basis
 * for billing. The smart barrier has a screen for status
 * prompts, a sensor for detecting cars’ arrival and passing, and card reader to
 * read user’s credit or ID card. The latter is needed to identify users when the
 * licence plate cannot be identified.
 *
 * Each SXC corresponds to a Camera Module (CM) to read license plates and a
 * Barrier Module (BM) to control access.
 *
 * Interaction: ACS, PRS, CM, BM, PMS
 */

import {
  AtomicComponent,
  createStatemachineComponent,
  RaiseEventCallBack,
  RequestEvent,
  ResolveEvent,
  StateMachine,
  StateMachineState,
  OneWayEvent,
} from "@sorrir/framework";
import { ScEventType, SxcPort, SxcState, SxcStateInternal } from "./types";
import { PrsEventType } from "../plate-recognition-service/types";
import { PmsEventType } from "../parking-management-system/types";
import { BmEventType } from "../barrier-module/types";
import { CmEventType } from "../camera-module/types";
import { AcsEventType } from "../accounting-service/types";
import { UsEventType } from "../user-simulator/types";
import {
  CmRequestImageEvent,
  CmResolveImageEvent,
} from "../camera-module/events";
import {
  PrsImageAnalysisRequestEvent,
  PrsSuccessfulImageAnalysisEvent,
} from "../plate-recognition-service/events";
import {
  AcsRequestDataByLicensePlateEvent,
  AcsResolveDataEvent,
} from "../accounting-service/events";
import {
  PmsCheckForReservationEvent,
  PmsRequestPaymentEvent,
  PmsRequestReservationEvent,
  PmsResolveReservationEvent,
} from "../parking-management-system/events";
import { BmCloseEvent, BmOpenEvent } from "../barrier-module/events";
import { ScCarDetectionEvent } from "./events";

/**
 * Event Types
 */
type EventType =
  | ScEventType
  | PrsEventType
  | PmsEventType
  | BmEventType
  | CmEventType
  | AcsEventType.REQUEST_ACCOUNT_DATA_BY_LICENSE_PLATE
  | AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST
  | UsEventType.REQUEST_RESERVATION;

/**
 * Base transition when waiting for the car to drive away or
 * through the barrier.
 */
const carDetectionEndedTransition = {
  targetState: SxcState.IDLE,
  event: <any>["oneway", ScEventType.CAR_DETECTION_ENDED, SxcPort.FROM_CS],
  action: (internalState: SxcStateInternal) => {
    // remove cached data
    internalState.cachedCarDetectionEvent = undefined;
    internalState.cachedAccountData = undefined;

    // return internal state
    return internalState;
  },
};

/**
 * Statemachine
 */
const sm: StateMachine<SxcState, SxcStateInternal, EventType, SxcPort> = {
  transitions: [
    /**
     * Car detected while sxc is idle.
     *
     * Request an image from camera module.
     */
    {
      sourceState: SxcState.IDLE,
      targetState: SxcState.WAITING_FOR_CM,
      event: ["oneway", ScEventType.CAR_DETECTED, SxcPort.FROM_CS],
      action: (
        internalState: SxcStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, SxcPort>,
        event?: OneWayEvent<EventType, SxcPort>
      ) => {
        // request image from cm
        const request: Omit<CmRequestImageEvent<SxcPort.TO_CM>, "id"> = {
          eventClass: "request",
          type: CmEventType.REQUEST_IMAGE,
          port: SxcPort.TO_CM,
        };
        raiseEvent(request);

        // cache car detection event
        internalState.cachedCarDetectionEvent =
          event! as ScCarDetectionEvent<SxcPort.FROM_CS>;

        // return internal state
        return internalState;
      },
    },
    /**
     * Received image from camera module.
     *
     * Send image recognition request to PRS.
     */
    {
      sourceState: SxcState.WAITING_FOR_CM,
      targetState: SxcState.WAITING_FOR_PRS,
      event: ["resolve", CmEventType.RESOLVE_IMAGE, SxcPort.FROM_CM],
      action: (
        internalState: SxcStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, SxcPort>,
        event?: ResolveEvent<EventType, SxcPort>
      ) => {
        // get image data from event
        const resolveImageDataEvent =
          event! as CmResolveImageEvent<SxcPort.FROM_CM>;
        const { imageData } = resolveImageDataEvent.param;

        // request image analysis from prs
        const request: Omit<
          PrsImageAnalysisRequestEvent<SxcPort.TO_PRS>,
          "id"
        > = {
          eventClass: "request",
          type: PrsEventType.REQUEST_IMAGE_ANALYSIS,
          param: {
            imageData: imageData,
          },
          port: SxcPort.TO_PRS,
        };
        raiseEvent(request);

        // return internal state
        return internalState;
      },
    },
    /**
     * Successful response from prs in return to image analysis request.
     *
     * Send request matching account data for license plate from ACS.
     */
    {
      sourceState: SxcState.WAITING_FOR_PRS,
      targetState: SxcState.WAITING_FOR_ACS,
      event: [
        "resolve",
        PrsEventType.SUCCESSFUL_IMAGE_ANALYSIS,
        SxcPort.FROM_PRS,
      ],
      action: (
        internalState: SxcStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, SxcPort>,
        event?: ResolveEvent<EventType, SxcPort>
      ) => {
        // get license plate from event
        const successfulImageAnalysisEvent =
          event! as PrsSuccessfulImageAnalysisEvent<SxcPort.FROM_PRS>;
        const { licensePlate } = successfulImageAnalysisEvent.param;

        // request account data from acs
        const request: Omit<
          AcsRequestDataByLicensePlateEvent<SxcPort.TO_ACS>,
          "id"
        > = {
          eventClass: "request",
          type: AcsEventType.REQUEST_ACCOUNT_DATA_BY_LICENSE_PLATE,
          param: {
            licensePlate: licensePlate,
          },
          port: SxcPort.TO_ACS,
        };
        raiseEvent(request);

        // return internal state
        return internalState;
      },
    },
    /**
     * Error from prs in return to image analysis request.
     *
     * Leaving has failed.
     */
    {
      sourceState: SxcState.WAITING_FOR_PRS,
      targetState: SxcState.LEAVING_FAILED,
      event: [
        "error",
        PrsEventType.UNSUCCESSFUL_IMAGE_ANALYSIS,
        SxcPort.FROM_PRS,
      ],
    },
    /**
     * Successful response from acs in return to account data request.
     *
     * Send request for reservation to pms.
     */
    {
      sourceState: SxcState.WAITING_FOR_ACS,
      targetState: SxcState.WAITING_FOR_PMS,
      event: [
        "resolve",
        AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST,
        SxcPort.FROM_ACS,
      ],
      action: (
        internalState: SxcStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, SxcPort>,
        event?: ResolveEvent<EventType, SxcPort>
      ) => {
        // get license plate from event
        const resolveDataEvent =
          event! as AcsResolveDataEvent<SxcPort.FROM_ACS>;
        const { accountData } = resolveDataEvent.param;

        // request reservation from pms
        const request: Omit<
          PmsCheckForReservationEvent<SxcPort.TO_PMS>,
          "id"
        > = {
          eventClass: "request",
          type: PmsEventType.CHECK_FOR_RESERVATION,
          param: {
            accountID: accountData.accountID,
            // no timestamp here, since the timestamp shall be ignored for this request
            // the PMS is supposed to handle overdue fees etc.
          },
          port: SxcPort.TO_PMS,
        };
        raiseEvent(request);

        // cache account data
        internalState.cachedAccountData = resolveDataEvent.param.accountData;

        // return internal state
        return internalState;
      },
    },
    /**
     * Error from acs in return to account data request.
     *
     * Leaving has failed.
     */
    {
      sourceState: SxcState.WAITING_FOR_ACS,
      targetState: SxcState.LEAVING_FAILED,
      event: [
        "error",
        AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST,
        SxcPort.FROM_ACS,
      ],
    },
    /**
     * Successful response from pms after checking
     * for a reservation.
     *
     * Reservation exists.
     *
     * Request payment for that reservation.
     */
    {
      sourceState: SxcState.WAITING_FOR_PMS,
      targetState: SxcState.WAITING_FOR_PMS,
      event: ["resolve", PmsEventType.RESOLVE_RESERVATION, SxcPort.FROM_PMS],
      action: (
        internalState: SxcStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, SxcPort>,
        event?: ResolveEvent<any, SxcPort>
      ) => {
        // get data from event
        const resolveEvent =
          event! as PmsResolveReservationEvent<SxcPort.FROM_PMS>;
        const { reservation } = resolveEvent.param;

        // send request
        const outEvent: Omit<PmsRequestPaymentEvent<SxcPort.TO_PMS>, "id"> = {
          eventClass: "request",
          type: PmsEventType.REQUEST_PAYMENT,
          port: SxcPort.TO_PMS,
          param: {
            accountID: internalState.cachedAccountData!.accountID,
            reservationID: reservation.id,
            timestamp: internalState.cachedCarDetectionEvent!.param.timestamp,
          },
        };
        raiseEvent(outEvent);

        // return internal state
        return internalState;
      },
    },
    /**
     * Unsuccessful response from pms in return to reservation request.
     *
     * Reservation does not exist.
     *
     * Ask the user for input.
     */
    {
      sourceState: SxcState.WAITING_FOR_PMS,
      targetState: SxcState.WAITING_FOR_USER,
      event: [
        "error",
        PmsEventType.RESERVATION_DOES_NOT_EXIST,
        SxcPort.FROM_PMS,
      ],
    },
    /**
     * Successful response from pms after requesting payment.
     *
     * Reservation is paid.
     *
     * Open the barrier.
     */
    {
      sourceState: SxcState.WAITING_FOR_PMS,
      targetState: SxcState.LEAVING_SUCCESSFUL,
      event: ["resolve", PmsEventType.CONFIRM_PAYMENT, SxcPort.FROM_PMS],
      action: (
        internalState: SxcStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, SxcPort>
      ) => {
        // open barrier
        const event: Omit<BmOpenEvent<SxcPort.TO_BM>, "id"> = {
          eventClass: "oneway",
          type: BmEventType.OPEN,
          port: SxcPort.TO_BM,
        };
        raiseEvent(event);

        // return internal state
        return internalState;
      },
    },
    /**
     * Unsuccessful response from pms after requesting payment.
     *
     * Something went wrong.
     *
     * Ask the user for input.
     *
     * TODO: handle different error-causes
     */
    {
      sourceState: SxcState.WAITING_FOR_PMS,
      targetState: SxcState.WAITING_FOR_USER,
      event: ["error", PmsEventType.REJECT_PAYMENT, SxcPort.FROM_PMS],
    },
    /**
     * Close the barrier after a car has driven through.
     *
     * Return to idle.
     */
    {
      sourceState: SxcState.LEAVING_SUCCESSFUL,
      ...carDetectionEndedTransition,
      action: (
        internalState: SxcStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, SxcPort>
      ) => {
        // close barrier
        const event: Omit<BmCloseEvent<SxcPort.TO_BM>, "id"> = {
          eventClass: "oneway",
          type: BmEventType.CLOSE,
          port: SxcPort.TO_BM,
        };
        raiseEvent(event);

        // clear cache
        internalState.cachedAccountData = undefined;
        internalState.cachedCarDetectionEvent = undefined;

        // return internal state
        return internalState;
      },
    },
    /**
     * A car drives away when user input is expected, the leaving fails.
     *
     * Return to idle.
     */
    {
      sourceState: SxcState.WAITING_FOR_USER,
      ...carDetectionEndedTransition,
    },
    /**
     * A car drives away after the leaving failed.
     *
     * Return to idle.
     */
    {
      sourceState: SxcState.LEAVING_FAILED,
      ...carDetectionEndedTransition,
    },
  ],
};

/**
 * Component for setup
 */
export const sxc: AtomicComponent<EventType, SxcPort> =
  createStatemachineComponent(
    [
      {
        name: SxcPort.TO_PRS,
        eventTypes: [PrsEventType.REQUEST_IMAGE_ANALYSIS],
        direction: "out",
      },
      {
        name: SxcPort.FROM_PRS,
        eventTypes: [
          PrsEventType.SUCCESSFUL_IMAGE_ANALYSIS,
          PrsEventType.UNSUCCESSFUL_IMAGE_ANALYSIS,
        ],
        direction: "in",
      },
      {
        name: SxcPort.FROM_US,
        eventTypes: [],
        direction: "in",
      },
      {
        name: SxcPort.FROM_CS,
        eventTypes: [ScEventType.CAR_DETECTED, ScEventType.CAR_DETECTION_ENDED],
        direction: "in",
      },
      {
        name: SxcPort.TO_PMS,
        eventTypes: [PmsEventType.CHECK_FOR_RESERVATION],
        direction: "out",
      },
      {
        name: SxcPort.FROM_PMS,
        eventTypes: [
          PmsEventType.RESERVATION_DOES_NOT_EXIST,
          PmsEventType.RESOLVE_RESERVATION,
        ],
        direction: "in",
      },
      {
        name: SxcPort.TO_ACS,
        eventTypes: [AcsEventType.REQUEST_ACCOUNT_DATA_BY_LICENSE_PLATE],
        direction: "out",
      },
      {
        name: SxcPort.FROM_ACS,
        eventTypes: [AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST],
        direction: "in",
      },
      {
        name: SxcPort.TO_BM,
        eventTypes: [BmEventType.OPEN, BmEventType.CLOSE],
        direction: "out",
      },
      {
        name: SxcPort.TO_CM,
        eventTypes: [CmEventType.REQUEST_IMAGE],
        direction: "out",
      },
      {
        name: SxcPort.FROM_CM,
        eventTypes: [CmEventType.RESOLVE_IMAGE],
        direction: "in",
      },
    ],
    sm,
    "sxc"
  );

/**
 * Start state
 */
export const sxcStartState: StateMachineState<
  SxcState,
  SxcStateInternal,
  EventType,
  SxcPort
> = {
  state: {
    fsm: SxcState.IDLE,
    my: {},
  },
  events: [],
  tsType: "State",
};
