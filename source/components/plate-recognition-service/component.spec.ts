import {
  Configuration,
  ConfigurationState,
  configurationStep,
} from "@sorrir/framework";
import * as _ from "lodash";
import { prs, prsStartState } from "./component";
import { PrsImageAnalysisRequestEvent } from "./events";
import { PrsEventType, PrsPort } from "./types";

describe("Image analysis request", () => {
  const startConfState: ConfigurationState = {
    componentState: new Map(<any>[[prs, prsStartState]]),
  };

  const config: Configuration = {
    components: [prs],
    connections: [],
  };

  const baseImageAnalysisRequestEvent: Omit<
    PrsImageAnalysisRequestEvent<PrsPort.FROM_SEC | PrsPort.FROM_SXC>,
    "param" | "port"
  > = {
    eventClass: "request",
    type: PrsEventType.REQUEST_IMAGE_ANALYSIS,
    id: "xxxx",
  };
  test("accept image with correct format", async () => {
    let confState = _.cloneDeep(startConfState);
    confState.componentState.get(prs)?.events.push({
      ...baseImageAnalysisRequestEvent,
      port: PrsPort.FROM_SEC,
      param: {
        imageData: "SO RR1",
      },
    });
    confState = configurationStep(config, confState, true);
    console.log(confState.componentState.get(prs));
    const events = _.remove(
      confState.componentState.get(prs)!.events,
      (event: any) => event.type === PrsEventType.SUCCESSFUL_IMAGE_ANALYSIS
    );
    expect(events.length).toBe(1);
    expect((<any>events[0]).param.licensePlate).toBe("SO-RR 1");
  });

  test("reject image with incorrect format", async () => {
    let confState = _.cloneDeep(startConfState);
    confState.componentState.get(prs)?.events.push({
      ...baseImageAnalysisRequestEvent,
      port: PrsPort.FROM_SEC,
      param: {
        imageData: "SO1 RR",
      },
    });
    confState = configurationStep(config, confState, true);
    console.log(confState.componentState.get(prs));
    const events = _.remove(
      confState.componentState.get(prs)!.events,
      (event: any) => event.type === PrsEventType.UNSUCCESSFUL_IMAGE_ANALYSIS
    );
    expect(events.length).toBe(1);
  });
});
