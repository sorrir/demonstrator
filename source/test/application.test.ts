import {
  Configuration,
  ConfigurationState,
  configurationStep,
  createConnection,
} from "@sorrir/framework";
import {
  sec,
  secStartState,
} from "../components/smart-console/component_entry";
import { cs } from "../components/car-simulator/component";
import {
  prsStartState,
  prs,
} from "../components/plate-recognition-service/component";
import * as _ from "lodash";
import {
  pms,
  pmsStartStateGenerator,
} from "../components/parking-management-system/component";
import {
  pss,
  pssStartStateGenerator,
} from "../components/parking-space-sensor/component";
import {
  acs,
  acsStartStateGenerator,
} from "../components/accounting-service/component";
import { ws } from "../components/web-service/component";
import { bm } from "../components/barrier-module/component";
import { bmStartState } from "../components/barrier-module/component";
import { cm, cmStartState } from "../components/camera-module/component";
import {
  PmsEventType,
  PmsPort,
  PmsState,
} from "../components/parking-management-system/types";
import { WsPort } from "../components/web-service/types";
import { PssPort } from "../components/parking-space-sensor/types";
import { AcsEventType, AcsPort } from "../components/accounting-service/types";
import {
  PmsCancelReservationEvent,
  PmsRequestReservationEvent,
} from "../components/parking-management-system/events";
import {
  ScEventType,
  SecPort,
  SecState,
  SxcPort,
  SxcState,
} from "../components/smart-console/types";
import {
  PrsEventType,
  PrsPort,
} from "../components/plate-recognition-service/types";
import { CsEventType, CsPort } from "../components/car-simulator/types";
import { CmEventType, CmPort } from "../components/camera-module/types";
import { BmPort, BmState } from "../components/barrier-module/types";
import { UsRequestReservationSebEvent } from "../components/user-simulator/events";
import { UsEventType } from "../components/user-simulator/types";
import {
  ScCarDetectionEndedEvent,
  ScCarDetectionEvent,
} from "../components/smart-console/events";
import { CsFeedImageDataEvent } from "../components/car-simulator/events";
import {
  psp,
  pspStartState,
} from "../components/payment-service-provider/component";
import {
  PspEventType,
  PspPort,
} from "../components/payment-service-provider/types";
import { sxc, sxcStartState } from "../components/smart-console/component_exit";

describe("Off-site Reservation", () => {
  const startConfState: ConfigurationState = {
    componentState: new Map(<any>[
      [
        pms,
        pmsStartStateGenerator.generate({
          rows: 1,
          columns: 1,
          levels: 1,
          accessibilitySpaces: 1,
          eChargingSpaces: 0,
          accessibilityAndEChargingSpaces: 0,
        }),
      ],
      [pss, pssStartStateGenerator.generate({ row: 0, column: 0, level: 0 })],
      [acs, acsStartStateGenerator.generate({ numAccounts: 6 })],
    ]),
  };

  const config: Configuration = {
    components: [pms, pss, acs],
    connections: [
      createConnection(pms, PmsPort.TO_PSS, pss, PssPort.FROM_PMS),
      createConnection(ws, WsPort.TO_PMS, pms, PmsPort.FROM_WS),
      createConnection(pss, PssPort.TO_PMS, pms, PmsPort.FROM_PSS),
      createConnection(pms, PmsPort.TO_ACS, acs, AcsPort.FROM_PMS),
      createConnection(acs, AcsPort.TO_PMS, pms, PmsPort.FROM_ACS),
    ],
  };

  const baseReservationEvent: Omit<
    PmsRequestReservationEvent<PmsPort.FROM_WS>,
    "param"
  > = {
    eventClass: "request",
    type: PmsEventType.REQUEST_RESERVATION,
    id: "xxxx",
    port: PmsPort.FROM_WS,
  };
  const baseCancellationEvent: Omit<
    PmsCancelReservationEvent<PmsPort.FROM_WS>,
    "param"
  > = {
    eventClass: "request",
    type: PmsEventType.REQUEST_CANCELLATION,
    id: "xxxx",
    port: PmsPort.FROM_WS,
  };
  test("Allow simple reservation", async () => {
    let confState = _.cloneDeep(startConfState);
    confState.componentState.get(pms)?.events.push({
      ...baseReservationEvent,
      param: {
        accountID: "sorrir1",
        dateFrom: "2022-01-01T00:00Z",
        dateTo: "2022-01-01T01:00Z",
      },
    });
    confState = configurationStep(config, confState, true);
    expect(
      _.remove(
        confState.componentState.get(pms)!.events,
        (event: any) => event.type === PmsEventType.CONFIRM_RESERVATION
      ).length
    ).toBe(1);
    expect(
      confState.componentState.get(pms)!.state.my.parkingSpaceStatuses[0][0][0]
        .reservations.length
    ).toBe(1);
  });

  test("Allow consecutive reservations", async () => {
    let confState = _.cloneDeep(startConfState);
    confState.componentState.get(pms)?.events.push({
      ...baseReservationEvent,
      param: {
        accountID: "sorrir1",
        dateFrom: "2022-01-01T00:00Z",
        dateTo: "2022-01-01T01:00Z",
      },
    });
    confState = configurationStep(config, confState, true);
    _.remove(
      confState.componentState.get(pms)!.events,
      (event: any) => event.type === PmsEventType.CONFIRM_RESERVATION
    );

    // after
    confState.componentState.get(pms)?.events.push({
      ...baseReservationEvent,
      param: {
        accountID: "sorrir2",
        dateFrom: "2022-01-01T01:00Z",
        dateTo: "2022-01-01T02:00Z",
      },
    });
    confState = configurationStep(config, confState, true);
    expect(
      _.remove(
        confState.componentState.get(pms)!.events,
        (event: any) => event.type === PmsEventType.CONFIRM_RESERVATION
      ).length
    ).toBe(1);
    expect(
      confState.componentState.get(pms)!.state.my.parkingSpaceStatuses[0][0][0]
        .reservations.length
    ).toBe(2);

    // remove consecutive reservation
    confState.componentState
      .get(pms)!
      .state.my.parkingSpaceStatuses[0][0][0].reservations.pop();

    // before
    confState.componentState.get(pms)?.events.push({
      ...baseReservationEvent,
      param: {
        accountID: "sorrir3",
        dateFrom: "2021-12-31T23:00Z",
        dateTo: "2022-01-01T00:00Z",
      },
    });
    confState = configurationStep(config, confState, true);
    expect(
      _.remove(
        confState.componentState.get(pms)!.events,
        (event: any) => event.type === PmsEventType.CONFIRM_RESERVATION
      ).length
    ).toBe(1);
    expect(
      confState.componentState.get(pms)!.state.my.parkingSpaceStatuses[0][0][0]
        .reservations.length
    ).toBe(2);
  });

  test("Reject second reservation from same account", async () => {
    let confState = _.cloneDeep(startConfState);
    confState.componentState.get(pms)?.events.push({
      ...baseReservationEvent,
      param: {
        accountID: "sorrir1",
        dateFrom: "2022-01-01T00:00Z",
        dateTo: "2022-01-01T01:00Z",
      },
    });
    confState = configurationStep(config, confState, true);
    confState.componentState.get(pms)?.events.push({
      ...baseReservationEvent,
      param: {
        accountID: "sorrir1",
        dateFrom: "2022-02-01T00:00Z",
        dateTo: "2022-02-01T01:00Z",
      },
    });
    confState = configurationStep(config, confState, true);
    _.remove(
      confState.componentState.get(pms)!.events,
      (event: any) => event.type === PmsEventType.CONFIRM_RESERVATION
    ).length;
    expect(
      _.remove(
        confState.componentState.get(pms)!.events,
        (event: any) => event.type === PmsEventType.REJECT_RESERVATION
      ).length
    ).toBe(1);
    expect(
      confState.componentState.get(pms)!.state.my.parkingSpaceStatuses[0][0][0]
        .reservations.length
    ).toBe(1);
  });

  test("Reject reservation from non-existing account with error", async () => {
    let confState = _.cloneDeep(startConfState);
    confState.componentState.get(pms)?.events.push({
      ...baseReservationEvent,
      param: {
        accountID: "non-existent",
        dateFrom: "2022-01-01T00:00Z",
        dateTo: "2022-01-01T01:00Z",
      },
    });
    confState = configurationStep(config, confState, true);
    expect(
      _.remove(
        confState.componentState.get(pms)!.events,
        (event: any) =>
          event.type === PmsEventType.REJECT_RESERVATION_WITH_ERROR
      ).length
    ).toBe(1);
    expect(
      confState.componentState.get(pms)!.state.my.parkingSpaceStatuses[0][0][0]
        .reservations.length
    ).toBe(0);
  });

  test("Reject duplicate reservations", async () => {
    let confState = _.cloneDeep(startConfState);
    confState.componentState.get(pms)?.events.push({
      ...baseReservationEvent,
      param: {
        accountID: "sorrir1",
        dateFrom: "2022-01-01T00:00Z",
        dateTo: "2022-01-01T01:00Z",
      },
    });
    confState = configurationStep(config, confState, true);

    confState.componentState.get(pms)?.events.push({
      ...baseReservationEvent,
      param: {
        accountID: "sorrir2",
        dateFrom: "2022-01-01T00:00Z",
        dateTo: "2022-01-01T01:00Z",
      },
    });
    confState = configurationStep(config, confState, true);
    expect(
      _.remove(
        confState.componentState.get(pms)!.events,
        (event: any) => event.type === PmsEventType.REJECT_RESERVATION
      ).length
    ).toBe(1);
    expect(
      confState.componentState.get(pms)!.state.my.parkingSpaceStatuses[0][0][0]
        .reservations.length
    ).toBe(1);
  });

  test("Reject overlapping reservations", async () => {
    let confState = _.cloneDeep(startConfState);
    confState.componentState.get(pms)?.events.push({
      ...baseReservationEvent,
      param: {
        accountID: "sorrir1",
        dateFrom: "2022-01-01T00:00Z",
        dateTo: "2022-01-01T01:00Z",
      },
    });
    confState = configurationStep(config, confState, true);

    confState.componentState.get(pms)?.events.push({
      ...baseReservationEvent,
      param: {
        accountID: "sorrir2",
        dateFrom: "2022-01-01T00:30Z",
        dateTo: "2022-01-01T01:30Z",
      },
    });
    confState = configurationStep(config, confState, true);
    expect(
      _.remove(
        confState.componentState.get(pms)!.events,
        (event: any) => event.type === PmsEventType.REJECT_RESERVATION
      ).length
    ).toBe(1);
    expect(
      confState.componentState.get(pms)!.state.my.parkingSpaceStatuses[0][0][0]
        .reservations.length
    ).toBe(1);

    confState.componentState.get(pms)?.events.push({
      ...baseReservationEvent,
      param: {
        accountID: "sorrir3",
        dateFrom: "2021-12-31T23:30Z",
        dateTo: "2022-01-01T00:30Z",
      },
    });
    confState = configurationStep(config, confState, true);
    expect(
      _.remove(
        confState.componentState.get(pms)!.events,
        (event: any) => event.type === PmsEventType.REJECT_RESERVATION
      ).length
    ).toBe(1);
    expect(
      confState.componentState.get(pms)!.state.my.parkingSpaceStatuses[0][0][0]
        .reservations.length
    ).toBe(1);

    confState.componentState.get(pms)?.events.push({
      ...baseReservationEvent,
      param: {
        accountID: "sorrir4",
        dateFrom: "2021-01-01T00:00Z",
        dateTo: "2022-01-01T00:30Z",
      },
    });
    confState = configurationStep(config, confState, true);
    expect(
      _.remove(
        confState.componentState.get(pms)!.events,
        (event: any) => event.type === PmsEventType.REJECT_RESERVATION
      ).length
    ).toBe(1);
    expect(
      confState.componentState.get(pms)!.state.my.parkingSpaceStatuses[0][0][0]
        .reservations.length
    ).toBe(1);

    confState.componentState.get(pms)?.events.push({
      ...baseReservationEvent,
      param: {
        accountID: "sorrir5",
        dateFrom: "2021-01-01T00:30Z",
        dateTo: "2022-01-01T01:00Z",
      },
    });
    confState = configurationStep(config, confState, true);
    expect(
      _.remove(
        confState.componentState.get(pms)!.events,
        (event: any) => event.type === PmsEventType.REJECT_RESERVATION
      ).length
    ).toBe(1);
    expect(
      confState.componentState.get(pms)!.state.my.parkingSpaceStatuses[0][0][0]
        .reservations.length
    ).toBe(1);

    confState.componentState.get(pms)?.events.push({
      ...baseReservationEvent,
      param: {
        accountID: "sorrir6",
        dateFrom: "2021-01-01T00:15Z",
        dateTo: "2022-01-01T00:45Z",
      },
    });
    confState = configurationStep(config, confState, true);
    expect(
      _.remove(
        confState.componentState.get(pms)!.events,
        (event: any) => event.type === PmsEventType.REJECT_RESERVATION
      ).length
    ).toBe(1);
    expect(
      confState.componentState.get(pms)!.state.my.parkingSpaceStatuses[0][0][0]
        .reservations.length
    ).toBe(1);
  });

  test("Reservation with accessibility", async () => {
    let confState = _.cloneDeep(startConfState);
    confState.componentState.get(pms)?.events.push({
      ...baseReservationEvent,
      param: {
        accountID: "sorrir1",
        dateFrom: "2022-01-01T00:00Z",
        dateTo: "2022-01-01T01:00Z",
        accessibility: true,
      },
    });
    confState = configurationStep(config, confState, true);
    expect(
      _.remove(
        confState.componentState.get(pms)!.events,
        (event: any) => event.type === PmsEventType.CONFIRM_RESERVATION
      ).length
    ).toBe(1);
    expect(
      confState.componentState.get(pms)!.state.my.parkingSpaceStatuses[0][0][0]
        .reservations.length
    ).toBe(1);
  });

  test("Reservation with eCharging", async () => {
    let confState = _.cloneDeep(startConfState);
    confState.componentState.get(pms)?.events.push({
      ...baseReservationEvent,
      param: {
        accountID: "sorrir1",
        dateFrom: "2022-01-01T00:00Z",
        dateTo: "2022-01-01T01:00Z",
        eCharging: true,
      },
    });
    confState = configurationStep(config, confState, true);
    expect(
      _.remove(
        confState.componentState.get(pms)!.events,
        (event: any) => event.type === PmsEventType.REJECT_RESERVATION
      ).length
    ).toBe(1);
    expect(
      confState.componentState.get(pms)!.state.my.parkingSpaceStatuses[0][0][0]
        .reservations.length
    ).toBe(0);
  });

  test("Reservation with eCharging and accessibility", async () => {
    let confState = _.cloneDeep(startConfState);
    confState.componentState.get(pms)?.events.push({
      ...baseReservationEvent,
      param: {
        accountID: "sorrir1",
        dateFrom: "2022-01-01T00:00Z",
        dateTo: "2022-01-01T01:00Z",
        eCharging: true,
        accessibilty: true,
      },
    });
    confState = configurationStep(config, confState, true);
    expect(
      _.remove(
        confState.componentState.get(pms)!.events,
        (event: any) => event.type === PmsEventType.REJECT_RESERVATION
      ).length
    ).toBe(1);
    expect(
      confState.componentState.get(pms)!.state.my.parkingSpaceStatuses[0][0][0]
        .reservations.length
    ).toBe(0);

    confState.componentState.get(pms)?.events.push({
      ...baseReservationEvent,
      param: {
        accountID: "sorrir2",
        dateFrom: "2022-01-01T00:00Z",
        dateTo: "2022-01-01T01:00Z",
        eCharging: false,
        accessibilty: true,
      },
    });
    confState = configurationStep(config, confState, true);
    expect(
      _.remove(
        confState.componentState.get(pms)!.events,
        (event: any) => event.type === PmsEventType.CONFIRM_RESERVATION
      ).length
    ).toBe(1);
    expect(
      confState.componentState.get(pms)!.state.my.parkingSpaceStatuses[0][0][0]
        .reservations.length
    ).toBe(1);
  });

  test("Allow cancellation", async () => {
    let confState = _.cloneDeep(startConfState);
    confState.componentState.get(pms)?.events.push({
      ...baseReservationEvent,
      param: {
        accountID: "sorrir1",
        dateFrom: "2022-01-01T00:00Z",
        dateTo: "2022-01-01T01:00Z",
      },
    });
    confState = configurationStep(config, confState, true);
    expect(
      _.remove(
        confState.componentState.get(pms)!.events,
        (event: any) => event.type === PmsEventType.CONFIRM_RESERVATION
      ).length
    ).toBe(1);
    expect(
      confState.componentState.get(pms)!.state.my.parkingSpaceStatuses[0][0][0]
        .reservations.length
    ).toBe(1);
    confState.componentState.get(pms)?.events.push({
      ...baseCancellationEvent,
      param: {
        accountID: "sorrir1",
      },
    });
    confState = configurationStep(config, confState, true);
    expect(
      _.remove(
        confState.componentState.get(pms)!.events,
        (event: any) => event.type === PmsEventType.CONFIRM_CANCELLATION
      ).length
    ).toBe(1);
    expect(
      confState.componentState.get(pms)!.state.my.parkingSpaceStatuses[0][0][0]
        .reservations.length
    ).toBe(0);
  });

  test("Reject cancellation if no reservation for account exists", async () => {
    let confState = _.cloneDeep(startConfState);
    confState.componentState.get(pms)?.events.push({
      ...baseReservationEvent,
      param: {
        accountID: "sorrir1",
        dateFrom: "2022-01-01T00:00Z",
        dateTo: "2022-01-01T01:00Z",
      },
    });
    confState = configurationStep(config, confState, true);
    expect(
      _.remove(
        confState.componentState.get(pms)!.events,
        (event: any) => event.type === PmsEventType.CONFIRM_RESERVATION
      ).length
    ).toBe(1);
    expect(
      confState.componentState.get(pms)!.state.my.parkingSpaceStatuses[0][0][0]
        .reservations.length
    ).toBe(1);
    confState.componentState.get(pms)?.events.push({
      ...baseCancellationEvent,
      param: {
        accountID: "sorrir2",
      },
    });
    confState = configurationStep(config, confState, true);
    expect(
      _.remove(
        confState.componentState.get(pms)!.events,
        (event: any) => event.type === PmsEventType.REJECT_CANCELLATION
      ).length
    ).toBe(1);
    expect(
      confState.componentState.get(pms)!.state.my.parkingSpaceStatuses[0][0][0]
        .reservations.length
    ).toBe(1);
  });
});

describe("Arrival", () => {
  let startConfState: ConfigurationState = {
    componentState: new Map(<any>[
      [
        pms,
        pmsStartStateGenerator.generate({
          rows: 1,
          columns: 1,
          levels: 1,
          accessibilitySpaces: 1,
          eChargingSpaces: 0,
          accessibilityAndEChargingSpaces: 0,
        }),
      ],
      [pss, pssStartStateGenerator.generate({ row: 0, column: 0, level: 0 })],
      [acs, acsStartStateGenerator.generate({ numAccounts: 6 })],
      [prs, prsStartState],
      [sec, secStartState],
      [bm, bmStartState],
      [cm, cmStartState],
    ]),
  };

  const config: Configuration = {
    components: [pms, pss, acs, prs, sec, bm, cm],
    connections: [
      createConnection(pms, PmsPort.TO_PSS, pss, PssPort.FROM_PMS),
      createConnection(ws, WsPort.TO_PMS, pms, PmsPort.FROM_WS),
      createConnection(pss, PssPort.TO_PMS, pms, PmsPort.FROM_PSS),
      createConnection(pms, PmsPort.TO_ACS, acs, AcsPort.FROM_PMS),
      createConnection(acs, AcsPort.TO_PMS, pms, PmsPort.FROM_ACS),
      createConnection(sec, SecPort.TO_PRS, prs, PrsPort.FROM_SEC),
      createConnection(prs, PrsPort.TO_SEC, sec, SecPort.FROM_PRS),
      createConnection(cs, CsPort.TO_SEC, sec, SecPort.FROM_CS),
      //createConnection(userSimulator, UserSimulatorPort.TO_SEB, seb, SebPort.FROM_USER_SIM),
      createConnection(sec, SecPort.TO_PMS, pms, PmsPort.FROM_SEC),
      createConnection(pms, PmsPort.TO_SEC, sec, SecPort.FROM_PMS),
      createConnection(sec, SecPort.TO_ACS, acs, AcsPort.FROM_SEC),
      createConnection(acs, AcsPort.TO_SEC, sec, SecPort.FROM_ACS),
      createConnection(sec, SecPort.TO_BM, bm, BmPort.FROM_SC),
      createConnection(sec, SecPort.TO_CM, cm, CmPort.FROM_SC),
      createConnection(cm, CmPort.TO_SC, sec, SecPort.FROM_CM),
    ],
  };

  const baseReservationWsEvent: Omit<
    PmsRequestReservationEvent<PmsPort.FROM_WS>,
    "param"
  > = {
    eventClass: "request",
    type: PmsEventType.REQUEST_RESERVATION,
    id: "xxxx",
    port: PmsPort.FROM_WS,
  };
  const baseReservationUsEvent: Omit<
    UsRequestReservationSebEvent<SecPort.FROM_US>,
    "param"
  > = {
    eventClass: "request",
    type: UsEventType.REQUEST_RESERVATION,
    id: "xxxx",
    port: SecPort.FROM_US,
  };
  const baseCarDetectionEvent: Omit<
    ScCarDetectionEvent<SecPort.FROM_CS>,
    "param"
  > = {
    eventClass: "oneway",
    type: ScEventType.CAR_DETECTED,
    id: "xxxx",
    port: SecPort.FROM_CS,
  };
  const carDetectionEndedEvent: ScCarDetectionEndedEvent<SecPort.FROM_CS> = {
    eventClass: "oneway",
    type: ScEventType.CAR_DETECTION_ENDED,
    id: "xxxx",
    port: SecPort.FROM_CS,
  };
  const baseFeedImageDataEvent: Omit<
    CsFeedImageDataEvent<CmPort.FROM_CS>,
    "param"
  > = {
    eventClass: "oneway",
    type: CsEventType.FEED_IMAGE_DATA,
    id: "xxxx",
    port: CmPort.FROM_CS,
  };

  // place reservation in start state
  startConfState.componentState.get(pms)?.events.push({
    ...baseReservationWsEvent,
    param: {
      accountID: "sorrir1",
      dateFrom: "2022-01-01T00:00Z",
      dateTo: "2022-01-01T01:00Z",
    },
  });
  startConfState = configurationStep(config, startConfState, true);
  expect(
    _.remove(
      startConfState.componentState.get(pms)!.events,
      (event: any) => event.type === PmsEventType.CONFIRM_RESERVATION
    ).length
  ).toBe(1);
  expect(
    startConfState.componentState.get(pms)!.state.my
      .parkingSpaceStatuses[0][0][0].reservations.length
  ).toBe(1);

  test("Successful with reservation", async () => {
    let confState = _.cloneDeep(startConfState);
    confState.componentState.get(sec)?.events.push({
      ...baseCarDetectionEvent,
      param: {
        timestamp: "2022-01-01T00:00Z",
      },
    });
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.WAITING_FOR_CM
    );
    confState = configurationStep(config, confState, false);
    confState.componentState.get(cm)?.events.push({
      ...baseFeedImageDataEvent,
      param: {
        imageData: "SO-RR1",
      },
    });
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.events[0]?.type).toBe(
      CmEventType.RESOLVE_IMAGE
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.WAITING_FOR_PRS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.events[0]?.type).toBe(
      PrsEventType.SUCCESSFUL_IMAGE_ANALYSIS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.WAITING_FOR_ACS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.events[0]?.type).toBe(
      AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.WAITING_FOR_PMS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.events[0]?.type).toBe(
      PmsEventType.RESOLVE_RESERVATION
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.ARRIVAL_SUCCESSFUL
    );
    expect(confState.componentState.get(bm)!.state.fsm as BmState).toBe(
      BmState.CLOSED
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(bm)!.state.fsm as BmState).toBe(
      BmState.OPEN
    );

    // car drives through
    confState.componentState.get(sec)?.events.push({
      ...carDetectionEndedEvent,
    });
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.IDLE
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(bm)!.state.fsm as BmState).toBe(
      BmState.CLOSED
    );
  });

  test("Unreadable license plate", async () => {
    let confState = _.cloneDeep(startConfState);
    confState.componentState.get(sec)?.events.push({
      ...baseCarDetectionEvent,
      param: {
        timestamp: "2022-01-01T00:00Z",
      },
    });
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.WAITING_FOR_CM
    );
    confState = configurationStep(config, confState, false);
    confState.componentState.get(cm)?.events.push({
      ...baseFeedImageDataEvent,
      param: {
        imageData: "SOxRRasd1",
      },
    });
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.events[0]?.type).toBe(
      CmEventType.RESOLVE_IMAGE
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.WAITING_FOR_PRS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.events[0]?.type).toBe(
      PrsEventType.UNSUCCESSFUL_IMAGE_ANALYSIS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.ARRIVAL_FAILED
    );
    expect(confState.componentState.get(bm)!.state.fsm as BmState).toBe(
      BmState.CLOSED
    );

    // car drives away
    confState.componentState.get(sec)?.events.push({
      ...carDetectionEndedEvent,
    });
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.IDLE
    );
    expect(confState.componentState.get(bm)!.state.fsm as BmState).toBe(
      BmState.CLOSED
    );
  });

  test("No account", async () => {
    let confState = _.cloneDeep(startConfState);
    confState.componentState.get(sec)?.events.push({
      ...baseCarDetectionEvent,
      param: {
        timestamp: "2022-01-01T00:00Z",
      },
    });
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.WAITING_FOR_CM
    );
    confState = configurationStep(config, confState, false);
    confState.componentState.get(cm)?.events.push({
      ...baseFeedImageDataEvent,
      param: {
        imageData: "NE-RD 1337",
      },
    });
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.events[0]?.type).toBe(
      CmEventType.RESOLVE_IMAGE
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.WAITING_FOR_PRS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.events[0]?.type).toBe(
      PrsEventType.SUCCESSFUL_IMAGE_ANALYSIS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.WAITING_FOR_ACS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.events[0]?.type).toBe(
      AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.ARRIVAL_FAILED
    );
    expect(confState.componentState.get(bm)!.state.fsm as BmState).toBe(
      BmState.CLOSED
    );

    // car drives away
    confState.componentState.get(sec)?.events.push({
      ...carDetectionEndedEvent,
    });
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.IDLE
    );
    expect(confState.componentState.get(bm)!.state.fsm as BmState).toBe(
      BmState.CLOSED
    );
  });

  test("No reservation --> on-site reservation", async () => {
    let confState = _.cloneDeep(startConfState);
    confState.componentState.get(sec)?.events.push({
      ...baseCarDetectionEvent,
      param: {
        timestamp: "2022-01-02T00:00Z",
      },
    });
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.WAITING_FOR_CM
    );
    confState = configurationStep(config, confState, false);
    confState.componentState.get(cm)?.events.push({
      ...baseFeedImageDataEvent,
      param: {
        imageData: "SO-RR2",
      },
    });
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.events[0]?.type).toBe(
      CmEventType.RESOLVE_IMAGE
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.WAITING_FOR_PRS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.events[0]?.type).toBe(
      PrsEventType.SUCCESSFUL_IMAGE_ANALYSIS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.WAITING_FOR_ACS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.events[0]?.type).toBe(
      AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.WAITING_FOR_PMS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.events[0]?.type).toBe(
      PmsEventType.RESERVATION_DOES_NOT_EXIST
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.WAITING_FOR_USER
    );

    // user completes on-site reservation
    confState.componentState.get(sec)?.events.push({
      ...baseReservationUsEvent,
      param: {
        dateTo: "2022-01-02T01:00Z",
      },
    });
    confState = configurationStep(config, confState, false);

    // confirm the event has been sent to pms
    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.WAITING_FOR_PMS
    );
    expect(confState.componentState.get(sec)!.events.length).toBe(0);

    // let pms do its thing
    confState = configurationStep(config, confState, true);

    expect(confState.componentState.get(sec)!.state.fsm as SecState).toBe(
      SecState.ARRIVAL_SUCCESSFUL
    );
  });
});

describe("Leaving", () => {
  let startConfState: ConfigurationState = {
    componentState: new Map(<any>[
      [
        pms,
        pmsStartStateGenerator.generate({
          rows: 1,
          columns: 1,
          levels: 1,
          accessibilitySpaces: 1,
          eChargingSpaces: 0,
          accessibilityAndEChargingSpaces: 0,
        }),
      ],
      [pss, pssStartStateGenerator.generate({ row: 0, column: 0, level: 0 })],
      [acs, acsStartStateGenerator.generate({ numAccounts: 6 })],
      [prs, prsStartState],
      [sec, secStartState],
      [sxc, sxcStartState],
      [psp, pspStartState],
      [bm, bmStartState],
      [cm, cmStartState],
    ]),
  };

  const config: Configuration = {
    components: [pms, pss, acs, prs, sec, bm, cm, psp, sxc],
    connections: [
      createConnection(pms, PmsPort.TO_PSS, pss, PssPort.FROM_PMS),
      createConnection(ws, WsPort.TO_PMS, pms, PmsPort.FROM_WS),
      createConnection(pss, PssPort.TO_PMS, pms, PmsPort.FROM_PSS),
      createConnection(pms, PmsPort.TO_ACS, acs, AcsPort.FROM_PMS),
      createConnection(acs, AcsPort.TO_PMS, pms, PmsPort.FROM_ACS),
      createConnection(sec, SecPort.TO_PRS, prs, PrsPort.FROM_SEC),
      createConnection(prs, PrsPort.TO_SEC, sec, SecPort.FROM_PRS),
      createConnection(cs, CsPort.TO_SEC, sec, SecPort.FROM_CS),
      createConnection(sec, SecPort.TO_PMS, pms, PmsPort.FROM_SEC),
      createConnection(pms, PmsPort.TO_SEC, sec, SecPort.FROM_PMS),
      createConnection(sec, SecPort.TO_ACS, acs, AcsPort.FROM_SEC),
      createConnection(acs, AcsPort.TO_SEC, sec, SecPort.FROM_ACS),
      createConnection(sec, SecPort.TO_BM, bm, BmPort.FROM_SC),
      createConnection(sec, SecPort.TO_CM, cm, CmPort.FROM_SC),
      createConnection(cm, CmPort.TO_SC, sec, SecPort.FROM_CM),
      createConnection(psp, PspPort.TO_PMS, pms, PmsPort.FROM_PSP),
      createConnection(pms, PmsPort.TO_PSP, psp, PspPort.FROM_PMS),
      // sxc stuff
      createConnection(sxc, SxcPort.TO_PRS, prs, PrsPort.FROM_SXC),
      createConnection(prs, PrsPort.TO_SXC, sxc, SxcPort.FROM_PRS),
      createConnection(cs, CsPort.TO_SXC, sxc, SxcPort.FROM_CS),
      createConnection(sxc, SxcPort.TO_PMS, pms, PmsPort.FROM_SXC),
      createConnection(pms, PmsPort.TO_SXC, sxc, SxcPort.FROM_PMS),
      createConnection(sxc, SxcPort.TO_ACS, acs, AcsPort.FROM_SXC),
      createConnection(acs, AcsPort.TO_SXC, sxc, SxcPort.FROM_ACS),
      createConnection(sxc, SxcPort.TO_BM, bm, BmPort.FROM_SC),
      createConnection(sxc, SxcPort.TO_CM, cm, CmPort.FROM_SC),
      createConnection(cm, CmPort.TO_SC, sxc, SxcPort.FROM_CM),
    ],
  };

  const baseReservationWsEvent: Omit<
    PmsRequestReservationEvent<PmsPort.FROM_WS>,
    "param"
  > = {
    eventClass: "request",
    type: PmsEventType.REQUEST_RESERVATION,
    id: "xxxx",
    port: PmsPort.FROM_WS,
  };
  const baseReservationUsEvent: Omit<
    UsRequestReservationSebEvent<SecPort.FROM_US>,
    "param"
  > = {
    eventClass: "request",
    type: UsEventType.REQUEST_RESERVATION,
    id: "xxxx",
    port: SecPort.FROM_US,
  };
  const baseCarDetectionEvent: Omit<
    ScCarDetectionEvent<SecPort.FROM_CS>,
    "param"
  > = {
    eventClass: "oneway",
    type: ScEventType.CAR_DETECTED,
    id: "xxxx",
    port: SecPort.FROM_CS,
  };
  const carDetectionEndedEvent: ScCarDetectionEndedEvent<SecPort.FROM_CS> = {
    eventClass: "oneway",
    type: ScEventType.CAR_DETECTION_ENDED,
    id: "xxxx",
    port: SecPort.FROM_CS,
  };
  const baseFeedImageDataEvent: Omit<
    CsFeedImageDataEvent<CmPort.FROM_CS>,
    "param"
  > = {
    eventClass: "oneway",
    type: CsEventType.FEED_IMAGE_DATA,
    id: "xxxx",
    port: CmPort.FROM_CS,
  };

  // place reservation in start state
  startConfState.componentState.get(pms)?.events.push({
    ...baseReservationWsEvent,
    param: {
      accountID: "sorrir1",
      dateFrom: "2022-01-01T00:00Z",
      dateTo: "2022-01-01T01:00Z",
    },
  });
  startConfState = configurationStep(config, startConfState, true);
  expect(
    _.remove(
      startConfState.componentState.get(pms)!.events,
      (event: any) => event.type === PmsEventType.CONFIRM_RESERVATION
    ).length
  ).toBe(1);
  expect(
    startConfState.componentState.get(pms)!.state.my
      .parkingSpaceStatuses[0][0][0].reservations.length
  ).toBe(1);

  test("Successful with reservation", async () => {
    let confState = _.cloneDeep(startConfState);
    confState.componentState.get(sxc)?.events.push({
      ...baseCarDetectionEvent,
      param: {
        timestamp: "2022-01-01T01:00Z",
      },
    });
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.state.fsm as SxcState).toBe(
      SxcState.WAITING_FOR_CM
    );
    confState = configurationStep(config, confState, false);
    confState.componentState.get(cm)?.events.push({
      ...baseFeedImageDataEvent,
      param: {
        imageData: "SO-RR1",
      },
    });
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.events[0]?.type).toBe(
      CmEventType.RESOLVE_IMAGE
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.state.fsm as SxcState).toBe(
      SxcState.WAITING_FOR_PRS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.events[0]?.type).toBe(
      PrsEventType.SUCCESSFUL_IMAGE_ANALYSIS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.state.fsm as SxcState).toBe(
      SxcState.WAITING_FOR_ACS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.events[0]?.type).toBe(
      AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.state.fsm as SxcState).toBe(
      SxcState.WAITING_FOR_PMS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.events[0]?.type).toBe(
      PmsEventType.RESOLVE_RESERVATION
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.state.fsm).toBe(
      SxcState.WAITING_FOR_PMS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(pms)!.state.fsm as PmsState).toBe(
      PmsState.WAITING_FOR_ACS
    );
    confState = configurationStep(config, confState, false);
    expect(
      _.map(confState.componentState.get(pms)!.events!, (e) => e.type)
    ).toStrictEqual([
      "HANDLE_PAYMENT",
      AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST,
    ]);
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(pms)!.state.fsm as PmsState).toBe(
      PmsState.PROCESS_ACCOUNT_DATA
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(pms)!.state.fsm as PmsState).toBe(
      PmsState.PREPARE_PAYMENT
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(pms)!.state.fsm as PmsState).toBe(
      PmsState.WAITING_FOR_PSP
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(pms)!.events[0]?.type).toBe(
      PspEventType.RESOLVE_PAYMENT
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.events[0]?.type).toBe(
      PmsEventType.CONFIRM_PAYMENT
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.state.fsm as SxcState).toBe(
      SxcState.LEAVING_SUCCESSFUL
    );

    // car drives through
    confState.componentState.get(sxc)?.events.push({
      ...carDetectionEndedEvent,
    });
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.state.fsm as SxcState).toBe(
      SxcState.IDLE
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(bm)!.state.fsm as BmState).toBe(
      BmState.CLOSED
    );
  });

  test("Unreadable license plate", async () => {
    let confState = _.cloneDeep(startConfState);
    confState.componentState.get(sxc)?.events.push({
      ...baseCarDetectionEvent,
      param: {
        timestamp: "2022-01-01T00:00Z",
      },
    });
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.state.fsm as SxcState).toBe(
      SxcState.WAITING_FOR_CM
    );
    confState = configurationStep(config, confState, false);
    confState.componentState.get(cm)?.events.push({
      ...baseFeedImageDataEvent,
      param: {
        imageData: "SOxRRasd1",
      },
    });
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.events[0]?.type).toBe(
      CmEventType.RESOLVE_IMAGE
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.state.fsm as SxcState).toBe(
      SxcState.WAITING_FOR_PRS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.events[0]?.type).toBe(
      PrsEventType.UNSUCCESSFUL_IMAGE_ANALYSIS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.state.fsm as SxcState).toBe(
      SxcState.LEAVING_FAILED
    );
    expect(confState.componentState.get(bm)!.state.fsm as BmState).toBe(
      BmState.CLOSED
    );

    // car drives away
    confState.componentState.get(sxc)?.events.push({
      ...carDetectionEndedEvent,
    });
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.state.fsm as SxcState).toBe(
      SxcState.IDLE
    );
    expect(confState.componentState.get(bm)!.state.fsm as BmState).toBe(
      BmState.CLOSED
    );
  });

  test("No account", async () => {
    let confState = _.cloneDeep(startConfState);
    confState.componentState.get(sxc)?.events.push({
      ...baseCarDetectionEvent,
      param: {
        timestamp: "2022-01-01T00:00Z",
      },
    });
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.state.fsm as SxcState).toBe(
      SxcState.WAITING_FOR_CM
    );
    confState = configurationStep(config, confState, false);
    confState.componentState.get(cm)?.events.push({
      ...baseFeedImageDataEvent,
      param: {
        imageData: "NE-RD 1337",
      },
    });
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.events[0]?.type).toBe(
      CmEventType.RESOLVE_IMAGE
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.state.fsm as SxcState).toBe(
      SxcState.WAITING_FOR_PRS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.events[0]?.type).toBe(
      PrsEventType.SUCCESSFUL_IMAGE_ANALYSIS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.state.fsm as SxcState).toBe(
      SxcState.WAITING_FOR_ACS
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.events[0]?.type).toBe(
      AcsEventType.ANSWER_TO_ACCOUNT_DATA_REQUEST
    );
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.state.fsm as SxcState).toBe(
      SxcState.LEAVING_FAILED
    );
    expect(confState.componentState.get(bm)!.state.fsm as BmState).toBe(
      BmState.CLOSED
    );

    // car drives away
    confState.componentState.get(sxc)?.events.push({
      ...carDetectionEndedEvent,
    });
    confState = configurationStep(config, confState, false);
    expect(confState.componentState.get(sxc)!.state.fsm as SxcState).toBe(
      SxcState.IDLE
    );
    expect(confState.componentState.get(bm)!.state.fsm as BmState).toBe(
      BmState.CLOSED
    );
  });
});
