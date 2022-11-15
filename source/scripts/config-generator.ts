import baseSetup from "./setup-base.json";
import baseDeployment from "./deployment-base.json";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import * as _ from "lodash";
import fs from "fs";
import { first, forEach } from "lodash";

// get process argv
const argv: any = yargs(hideBin(process.argv)).argv;

// read parameters
const rows = argv.rows ?? 1;
const levels = argv.levels ?? 1;
const columns = argv.columns ?? 1;
const accessibilitySpaces = argv.accessibilitySpaces ?? 0;
const eChargingSpaces = argv.eChargingSpaces ?? 0;
const accessibilityAndEChargingSpaces =
  argv.accessibilityAndEChargingSpaces ?? 0;
const outPath =
  typeof argv.outPath === "string"
    ? argv.outPath + (argv.outPath.endsWith("/") ? "" : "/")
    : "./config/";
const env = argv.env ?? "production";
const merge = argv.merge ?? false;
const log = argv.log ?? false;
const doSetup = argv.setup ?? false;
const doDeployment = argv.deployment ?? false;

// find out necessary decimal places for consistent naming
const places = Math.max(
  Math.floor(Math.log(levels)),
  Math.floor(Math.log(columns)),
  Math.floor(Math.log(rows))
);

// function to generate pss name
const getPssName = (level: number, row: number, column: number) =>
  `pss_${String(level).padStart(places, "0")}_${String(row).padStart(
    places,
    "0"
  )}_${String(column).padStart(places, "0")}`;

function doSetupConfig() {
  // import existing configs
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  let existingSetup: any;
  try {
    existingSetup = require(`${process.cwd()}/${outPath.replace(
      /^\.?\/?/,
      ""
    )}setup.json`);
  } catch (e) {
    existingSetup = {};
  }

  // merge config if argv.merge is enabled
  const setup: typeof baseSetup = !merge
    ? baseSetup
    : _.merge(baseSetup, existingSetup);

  // get all names of pss instances in base setup
  const pssNames = _.map(
    setup.componentInstances.pss,
    (instance) => instance.name
  );

  // clear all connections related to pss instances
  _.remove(
    setup.connections,
    (connection) =>
      pssNames.includes(connection.sourceComponent) ||
      pssNames.includes(connection.targetComponent)
  );

  // clear pss component instances from base setup
  setup.componentInstances.pss = [];

  // generate variable number of parking space sensor instances
  // and necessary connections
  for (let level = 0; level < levels; level++) {
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const pssName = getPssName(level, row, column);
        setup.componentInstances.pss.push({
          name: pssName,
          startStateGenerator: "pssStartStateGenerator",
          startStateArgs: {
            row: row,
            column: column,
            level: level,
          },
        });
        setup.connections.push({
          sourceComponent: pssName,
          sourcePort: "TO_PMS",
          targetComponent: "pms",
          targetPort: "FROM_PSS",
        });
        setup.connections.push({
          sourceComponent: "pms",
          sourcePort: "TO_PSS",
          targetComponent: pssName,
          targetPort: "FROM_PMS",
        });
        setup.connections.push({
          sourceComponent: "cs",
          sourcePort: "TO_PSS",
          targetComponent: pssName,
          targetPort: "FROM_CS",
        });
      }
    }
  }

  // set the correct dimensions and space info for pms
  setup.componentInstances.pms = [
    {
      name: "pms",
      startStateGenerator: "pmsStartStateGenerator",
      startStateArgs: {
        rows: rows,
        columns: columns,
        levels: levels,
        accessibilitySpaces: accessibilitySpaces,
        eChargingSpaces: eChargingSpaces,
        accessibilityAndEChargingSpaces: accessibilityAndEChargingSpaces,
      },
    },
  ];

  // generate output and log it
  const out = JSON.stringify(setup, undefined, 2);
  if (log) console.log(out);

  // write setup.json
  fs.writeFileSync(`${outPath}setup.json`, out);
}

function doDeploymentConfig() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  let existingDeployment: any;
  try {
    existingDeployment = require(`${process.cwd()}/${outPath.replace(
      /^\.?\/?/,
      ""
    )}${env}.json`);
  } catch (e) {
    existingDeployment = {};
  }

  // clear dummy connections of baseDeployment
  baseDeployment.CommunicationConfiguration.connectionTechs = [];

  const deployment: typeof baseDeployment = !merge
    ? baseDeployment
    : _.merge(baseDeployment, existingDeployment);

  // clear all pss instances
  Object.values(deployment.DeploymentConfiguration).forEach((unit) =>
    _.remove(unit.components, (component) => component.startsWith("pss_"))
  );

  // clear all connections related to pss instances
  _.remove(
    deployment.CommunicationConfiguration.connectionTechs,
    (connection) =>
      connection.sourceComponent.startsWith("pss_") ||
      connection.targetComponent.startsWith("pss_")
  );

  // generate variable number of parking space sensor instances
  // and necessary connections
  // will add all instances to the first unit
  const firstUnitName = Object.keys(deployment.DeploymentConfiguration)[0];
  const pmsUnitName = (_.find(
    Object.entries(deployment.DeploymentConfiguration),
    ([key, unit]) => (unit.components as string[]).includes("pms")
  ) ?? [firstUnitName])[0];
  for (let level = 0; level < levels; level++) {
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const pssName = getPssName(level, row, column);
        (
          deployment.DeploymentConfiguration[firstUnitName]
            .components as string[]
        ).push(pssName);

        // if pms unit is different to pss unit, create connections
        if (pmsUnitName !== firstUnitName) {
          deployment.CommunicationConfiguration.connectionTechs.push({
            sourceContainer: firstUnitName,
            sourceComponent: pssName,
            sourcePort: "TO_PMS",
            targetComponent: "pms",
            targetPort: "FROM_PSS",
            targetContainer: pmsUnitName,
            commOption: "REST",
          });
          deployment.CommunicationConfiguration.connectionTechs.push({
            targetContainer: firstUnitName,
            targetComponent: pssName,
            targetPort: "FROM_PMS",
            sourceComponent: "pms",
            sourcePort: "TO_PSS",
            sourceContainer: pmsUnitName,
            commOption: "REST",
          });
        }
      }
    }
  }

  // generate output and log it
  const out = JSON.stringify(deployment, undefined, 2);
  if (log) console.log(out);

  // write setup.json
  fs.writeFileSync(`${outPath}${env}.json`, out);
}

if (doSetup) {
  doSetupConfig();
}
if (doDeployment) {
  doDeploymentConfig();
}
