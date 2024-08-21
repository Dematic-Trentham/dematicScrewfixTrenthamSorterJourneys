//import the database
import db from "./db/mysqlConnection.js";

//import node-cron
import cron from "node-cron";

let localProcessName = "";

//when the process starts, log the process name and the start time
function startProcess(processName: string) {
  console.log(`${processName} started at ${new Date()}`);

  localProcessName = processName;

  //make timestamp for the start time
  const startTime = new Date();

  //convert the start time to a mysql timestamp
  const mysqlStartTime = startTime.toISOString().slice(0, 19).replace("T", " ");

  //update the database if the processName is in the database already, otherwise insert it
  const sql = `INSERT INTO processTracker (processName, lastRestart) VALUES ('${processName}', '${mysqlStartTime}') ON DUPLICATE KEY UPDATE lastRestart = '${mysqlStartTime}'`;

  //console.log(sql);
  //run the sql
  db.query(sql, (err: any, result: { affectedRows: string }) => {
    if (err) throw err;
    //console.log("ProcessTracker: " + result.affectedRows + " record(s) updated");
  });
}

//every 5seconds, update the database with the current time
function updateProcess() {
  //make timestamp for the start time
  const updateTime = new Date();

  //convert the start time to a mysql timestamp
  const mysqlUpdateTime = updateTime.toISOString().slice(0, 19).replace("T", " ");

  //update the database if the processName is in the database already, otherwise insert it
  const sql = `INSERT INTO processTracker (processName, lastWatchdog) VALUES ('${localProcessName}', '${mysqlUpdateTime}') ON DUPLICATE KEY UPDATE lastWatchdog = '${mysqlUpdateTime}'`;

  //console.log(sql);
  //run the sql
  db.query(sql, (err: any, result: { affectedRows: string }) => {
    if (err) throw err;
    //console.log("ProcessTracker: " + result.affectedRows + " record(s) updated");
  });
}

//capture crash events
function crashProcess(err: Error) {
  console.log(`${localProcessName} crashed at ${new Date()}`);

  //make timestamp for the crash time
  const crashTime = new Date();

  //convert the crash time to a mysql timestamp
  const mysqlCrashTime = crashTime.toISOString().slice(0, 19).replace("T", " ");

  //get crash reason
  const crashReason = err.message;
  console.log("Crash reason: " + crashReason);

  //update the database if the processName is in the database already, otherwise insert it, with the crash reason
  const sql = `INSERT INTO processTracker (processName, lastCrash, lastCrashReason) VALUES ('${localProcessName}', '${mysqlCrashTime}', '${crashReason}') ON DUPLICATE KEY UPDATE lastCrash = '${mysqlCrashTime}', lastCrashReason = '${crashReason}'`;

  console.log(sql);

  //run the sql
  db.query(sql, (err: any, result: { affectedRows: string }) => {



    process.exit(1);
    if (err) throw err;
    //console.log("ProcessTracker: " + result.affectedRows + " record(s) updated");
    //exit the process
    process.exit(1);
  });
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
