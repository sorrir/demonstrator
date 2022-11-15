/**
 * Smart Entrance Console (SEC)
 *
 * An enclosure mounted at the entry of each smart parking garage.
 * There could be multiple SECs at the entrance. It ensures that only authorised
 * cars are able to enter the parking garage. Further, it ensures that all cars
 * entering the garage are registered with timestamp, number plate and payment
 * information. The latter will only be necessary if the user does not have an
 * account with the SPG. The smart barrier has a touch screen for user interaction,
 * a sensor for detecting car arrivals and passing, and a card reader
 * to read payment or an ID card of the arriving user.
 *
 * Each SEC corresponds to a Camera Module (CM) to read license plates and a
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
import { AccountData } from "../../types/data";
import { ScCarDetectionEvent } from "./events";
import { ScEventType, SecPort, SecState, SecStateInternal } from "./types";
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
  PmsRequestReservationEvent,
} from "../parking-management-system/events";
import { BmCloseEvent, BmOpenEvent } from "../barrier-module/events";

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
  targetState: SecState.IDLE,
  event: <any>["oneway", ScEventType.CAR_DETECTION_ENDED, SecPort.FROM_CS],
  action: (internalState: SecStateInternal) => {
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
const sm: StateMachine<SecState, SecStateInternal, EventType, SecPort> = {
  transitions: [
    /**
     * Car detected while sec is idle.
     *
     * Request an image from camera module.
     */
    {
      sourceState: SecState.IDLE,
      targetState: SecState.WAITING_FOR_CM,
      event: ["oneway", ScEventType.CAR_DETECTED, SecPort.FROM_CS],
      action: (
        internalState: SecStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, SecPort>,
        event?: OneWayEvent<EventType, SecPort>
      ) => {
        // request image from cm
        const request: Omit<CmRequestImageEvent<SecPort.TO_CM>, "id"> = {
          eventClass: "request",
          type: CmEventType.REQUEST_IMAGE,
          port: SecPort.TO_CM,
        };
        raiseEvent(request);

        // cache car detection event
        internalState.cachedCarDetectionEvent =
          event! as ScCarDetectionEvent<SecPort.FROM_CS>;

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
      sourceState: SecState.WAITING_FOR_CM,
      targetState: SecState.WAITING_FOR_PRS,
      event: ["resolve", CmEventType.RESOLVE_IMAGE, SecPort.FROM_CM],
      action: (
        internalState: SecStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, SecPort>,
        event?: ResolveEvent<EventType, SecPort>
      ) => {
        // get image data from event
        const resolveImageDataEvent =
          event! as CmResolveImageEvent<SecPort.FROM_CM>;
        const { imageData } = resolveImageDataEvent.param;

        // request image analysis from prs
        const request: Omit<
          PrsImageAnalysisRequestEvent<SecPort.TO_PRS>,
          "id"
        > = {
          eventClass: "request",
          type: PrsEventType.REQUEST_IMAGE_ANALYSIS,
          param: {
            imageData: imageData,
          },
          port: SecPort.TO_PRS,
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
      sourceState: SecState.WAITING_FOR_PRS,
      targetState: SecState.WAITING_FOR_ACS,
      event: [
        "resolve",
        PrsEventType.SUCCESSFUL_IMAGE_ANALYSIS,
        SecPort.FROM_PRS,
      ],
      action: (
        internalState: SecStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, SecPort>,
        event?: ResolveEvent<EventType, SecPort>
      ) => {
        // get license plate from event
        const successfulImageAnalysisEvent =
          event! as PrsSuccessfulImageAnalysisEvent<SecPort.FROM_PRS>;
        const { licensePlate } = successfulImageAnalysisEvent.param;

        // request account data from acs
        const request: Omit<
          AcsRequestDataByLicensePlateEvent<SecPort.TO_ACS>,
          "id"
        > = {
          eventClass: "request",
          type: AcsEventType.REQUEST_ACCOUNT_DATA_BY_LICENSE_PLATE,
          param: {
            licensePlate: licensePlate,
          },
          port: SecPort.TO_ACS,
        };
        raiseEvent(request);

        // return internal state
        return internalState;
      },
    },
    /**
     * Error from prs in return to image analysis request.
     *
     * Arrival has failed.
     */
    {
      sourceState: SecState.WAITING_FOR_PRS,
      targetState: SecState.ARRIVAL_FAILED,
      event: [
        "error",
        PrsEventType.UNSUCCESSFUL_IMAGE_ANALYSIS,
        SecPort.FROM_PRS,
      ],
    },
    /**
     * Successful response from acs in return to account data request.
     *
     * Send request to pms for a reservation.
     */
    {
      sourceState: SecState.WAITING_FOR_ACS,
      targetState: SecState.WAITING_FOR_PMS,
      event: [
        "resolve",
        AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST,
        SecPort.FROM_ACS,
      ],
      action: (
        internalState: SecStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, SecPort>,
        event?: ResolveEvent<EventType, SecPort>
      ) => {
        // get license plate from event
        const resolveDataEvent =
          event! as AcsResolveDataEvent<SecPort.FROM_ACS>;
        const { accountData } = resolveDataEvent.param;

        // request reservation from pms
        const request: Omit<
          PmsCheckForReservationEvent<SecPort.TO_PMS>,
          "id"
        > = {
          eventClass: "request",
          type: PmsEventType.CHECK_FOR_RESERVATION,
          param: {
            accountID: accountData.accountID,
            timestamp: internalState.cachedCarDetectionEvent!.param.timestamp,
          },
          port: SecPort.TO_PMS,
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
     * Arrival has failed.
     */
    {
      sourceState: SecState.WAITING_FOR_ACS,
      targetState: SecState.ARRIVAL_FAILED,
      event: [
        "error",
        AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST,
        SecPort.FROM_ACS,
      ],
    },
    /**
     * Successful response from pms after checking
     * for a reservation.
     *
     * Reservation exists.
     *
     * Open the barrier.
     */
    {
      sourceState: SecState.WAITING_FOR_PMS,
      targetState: SecState.ARRIVAL_SUCCESSFUL,
      event: ["resolve", PmsEventType.RESOLVE_RESERVATION, SecPort.FROM_PMS],
      action: (
        internalState: SecStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, SecPort>
      ) => {
        // open barrier
        const event: Omit<BmOpenEvent<SecPort.TO_BM>, "id"> = {
          eventClass: "oneway",
          type: BmEventType.OPEN,
          port: SecPort.TO_BM,
        };
        raiseEvent(event);

        // return internal state
        return internalState;
      },
    },
    /**
     * Unsuccessful response from pms in return to reservation request.
     *
     * Reservation does not exist.
     *
     * Ask the user to reserve on site.
     */
    {
      sourceState: SecState.WAITING_FOR_PMS,
      targetState: SecState.WAITING_FOR_USER,
      event: [
        "error",
        PmsEventType.RESERVATION_DOES_NOT_EXIST,
        SecPort.FROM_PMS,
      ],
    },
    /**
     * Forward an incoming reservation request, done on-site, to PMS.
     *
     * Wait for a response by PMS if reservation can be done.
     */
    {
      sourceState: SecState.WAITING_FOR_USER,
      targetState: SecState.WAITING_FOR_PMS,
      event: ["request", UsEventType.REQUEST_RESERVATION, SecPort.FROM_US],
      action: (
        internalState: SecStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, SecPort>,
        event: RequestEvent<EventType, SecPort> | undefined
      ) => {
        // overwrite known values like account data
        const eventToForward = {
          ...event,
          id: undefined,
          param: {
            ...event?.param,
            dateFrom: internalState.cachedCarDetectionEvent!.param.timestamp,
            accountID: internalState.cachedAccountData?.accountID,
          },
          port: SecPort.TO_PMS,
          type: PmsEventType.REQUEST_RESERVATION,
        };
        raiseEvent(
          eventToForward as Omit<
            PmsRequestReservationEvent<SecPort.TO_PMS>,
            "id"
          >
        );

        // return internal state
        return internalState;
      },
    },
    /**
     * Successful response from pms in return to reservation request.
     *
     * On-site reservation successful.
     *
     * Open the barrier.
     */
    {
      sourceState: SecState.WAITING_FOR_PMS,
      targetState: SecState.ARRIVAL_SUCCESSFUL,
      event: ["resolve", PmsEventType.CONFIRM_RESERVATION, SecPort.FROM_PMS],
      action: (
        internalState: SecStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, SecPort>
      ) => {
        // open barrier
        const event: Omit<BmOpenEvent<SecPort.TO_BM>, "id"> = {
          eventClass: "oneway",
          type: BmEventType.OPEN,
          port: SecPort.TO_BM,
        };
        raiseEvent(event);

        // return internal state
        return internalState;
      },
    },
    /**
     * Unsuccessful response from pms in return to reservation request.
     *
     * On-site reservation successful.
     *
     * Let the user retry.
     */
    {
      sourceState: SecState.WAITING_FOR_PMS,
      targetState: SecState.WAITING_FOR_USER,
      event: ["resolve", PmsEventType.REJECT_RESERVATION, SecPort.FROM_PMS],
    },
    /**
     * Error while trying an on-site reservation.
     *
     * Arrival failed.
     */
    {
      sourceState: SecState.WAITING_FOR_PMS,
      targetState: SecState.ARRIVAL_FAILED,
      event: [
        "error",
        PmsEventType.REJECT_RESERVATION_WITH_ERROR,
        SecPort.FROM_PMS,
      ],
    },
    /**
     * Close the barrier after a car has driven through.
     *
     * Return to idle.
     */
    {
      sourceState: SecState.ARRIVAL_SUCCESSFUL,
      ...carDetectionEndedTransition,
      action: (
        internalState: SecStateInternal,
        raiseEvent: RaiseEventCallBack<EventType, SecPort>
      ) => {
        // close barrier
        const event: Omit<BmCloseEvent<SecPort.TO_BM>, "id"> = {
          eventClass: "oneway",
          type: BmEventType.CLOSE,
          port: SecPort.TO_BM,
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
     * A car drives away when user input is expected, the arrival fails.
     *
     * Return to idle.
     */
    {
      sourceState: SecState.WAITING_FOR_USER,
      ...carDetectionEndedTransition,
    },
    /**
     * A car drives away after the arrival failed.
     *
     * Return to idle.
     */
    {
      sourceState: SecState.ARRIVAL_FAILED,
      ...carDetectionEndedTransition,
    },
  ],
};

/**
 * Component for setup
 */
export const sec: AtomicComponent<EventType, SecPort> =
  createStatemachineComponent(
    [
      {
        name: SecPort.TO_PRS,
        eventTypes: [PrsEventType.REQUEST_IMAGE_ANALYSIS],
        direction: "out",
      },
      {
        name: SecPort.FROM_PRS,
        eventTypes: [
          PrsEventType.SUCCESSFUL_IMAGE_ANALYSIS,
          PrsEventType.UNSUCCESSFUL_IMAGE_ANALYSIS,
        ],
        direction: "in",
      },
      {
        name: SecPort.FROM_CS,
        eventTypes: [ScEventType.CAR_DETECTED, ScEventType.CAR_DETECTION_ENDED],
        direction: "in",
      },
      {
        name: SecPort.TO_PMS,
        eventTypes: [
          PmsEventType.CHECK_FOR_RESERVATION,
          PmsEventType.REQUEST_RESERVATION,
        ],
        direction: "out",
      },
      {
        name: SecPort.FROM_PMS,
        eventTypes: [
          PmsEventType.RESERVATION_DOES_NOT_EXIST,
          PmsEventType.RESOLVE_RESERVATION,
          PmsEventType.CONFIRM_RESERVATION,
        ],
        direction: "in",
      },
      {
        name: SecPort.TO_ACS,
        eventTypes: [AcsEventType.REQUEST_ACCOUNT_DATA_BY_LICENSE_PLATE],
        direction: "out",
      },
      {
        name: SecPort.FROM_ACS,
        eventTypes: [AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST],
        direction: "in",
      },
      {
        name: SecPort.TO_BM,
        eventTypes: [BmEventType.OPEN, BmEventType.CLOSE],
        direction: "out",
      },
      {
        name: SecPort.TO_CM,
        eventTypes: [CmEventType.REQUEST_IMAGE],
        direction: "out",
      },
      {
        name: SecPort.FROM_CM,
        eventTypes: [CmEventType.RESOLVE_IMAGE],
        direction: "in",
      },
      {
        name: SecPort.FROM_US,
        eventTypes: [UsEventType.REQUEST_RESERVATION],
        direction: "in",
      },
    ],
    sm,
    "sec"
  );

/**
 * Start state
 */
export const secStartState: StateMachineState<
  SecState,
  SecStateInternal,
  EventType,
  SecPort
> = {
  state: {
    fsm: SecState.IDLE,
    my: {},
  },
  events: [],
  tsType: "State",
};
