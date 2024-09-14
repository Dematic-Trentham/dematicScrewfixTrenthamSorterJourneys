//import node-cron
import cron from "node-cron";
import db from "./db/db.js";

let localProcessName = "";

//when the process starts, log the process name and the start time
async function startProcess(processName: string) {
  console.log(`${processName} started at ${new Date()}`);

  localProcessName = processName;

  //make timestamp for the start time
  const startTime = new Date();

  //convert the start time to a mysql timestamp
  const mysqlStartTime = startTime.toISOString().slice(0, 19).replace("T", " ");

  //update the database if the processName is in the database already, otherwise insert it

  const result = await db.dashboardSystemProcesses.findUnique({
    where: {
      processName: processName,
    },
  });

  if (result !== null) {
    //update the database
    const result = await db.dashboardSystemProcesses.update({
      where: {
        processName: processName,
      },
      data: {
        lastWatchdog: startTime,
      },
    });

    return;
  }

  await db.dashboardSystemProcesses.create({
    data: {
      processName: processName,
      lastWatchdog: startTime,
    },
  });
}

//every 5seconds, update the database with the current time
async function updateProcess() {
  //make timestamp for the start time
  const updateTime = new Date();

  //convert the start time to a mysql timestamp
  const mysqlUpdateTime = updateTime.toISOString().slice(0, 19).replace("T", " ");

  //update the database
  const result = await db.dashboardSystemProcesses.update({
    where: {
      processName: localProcessName,
    },
    data: {
      lastWatchdog: updateTime,
    },
  });
}

//capture crash events
async function crashProcess(err: Error) {
  console.log(`${localProcessName} crashed at ${new Date()}`);

  //make timestamp for the crash time
  const crashTime = new Date();

  //convert the crash time to a mysql timestamp
  const mysqlCrashTime = crashTime.toISOString().slice(0, 19).replace("T", " ");

  //get crash reason
  const crashReason = err.message;
  console.log("Crash reason: " + crashReason);

  //update the database
  const result = await db.dashboardSystemProcesses.update({
    where: {
      processName: localProcessName,
    },
    data: {
      lastCrash: crashTime,
      crashCount: {
        increment: 1,
      },
      lastCrashMessage: crashReason,
    },
  });

  process.exit(1);
  if (err) throw err;
  //console.log("ProcessTracker: " + result.affectedRows + " record(s) updated");
  //exit the process
  process.exit(1);
}

//every 5 seconds, update the process tracker
cron.schedule("*/5 * * * * *", async () => {
  updateProcess();
});

//capture crash events
process.on("uncaughtException", (err) => {
  crashProcess(err);
});

export default { startProcess };
