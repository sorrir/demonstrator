import { getAppConfig } from "@sorrir/framework";
import { executeRunConfiguration } from "@sorrir/framework";
import * as sorrirLogger from "@sorrir/sorrir-logging";
import { setup } from "@sorrir/framework";

sorrirLogger.configLogger({ area: "execution" });
// Be polite and say hello
console.log("Hello Sorrir!");

const runConfig = setup();
const appConfig = getAppConfig();

async function main() {
  if (
    runConfig.toExecute &&
    runConfig.toExecute !== "" &&
    runConfig.hostConfiguration.hasOwnProperty(runConfig.toExecute)
  ) {
    await executeRunConfiguration(runConfig);
  } else if (
    runConfig.toExecute !== "" &&
    !runConfig.hostConfiguration.hasOwnProperty(runConfig.toExecute)
  ) {
    console.log(`unknown host "${runConfig.toExecute}`);
  } else {
    console.log("no container defined to execute");
  }
}

main().catch((e) => console.log(e));
