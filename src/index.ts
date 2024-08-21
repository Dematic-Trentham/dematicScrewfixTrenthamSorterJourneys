//Service for Dematic Dashboard Screwfix
//Created by: JWL
//Date: 2023/02/02 02:51:41
//Last modified: 2023/10/22 11:51:17
//Version: 1.0.9

//imports
import "dotenv/config";

import cron from "node-cron";
import fs from "fs";
import { downloadNewFilesFromSFTPHost, sftpClientSettings, getFilesInDirectory } from "./helpers/sftpDownloader.js";

//startup text
console.log("Dematic Dashboard Micro Service -");

//get config settings from environment variables
const hostConfig: sftpClientSettings = {
  host: process.env.SORTERPC_HOST || "",
  port: parseInt(process.env.SORTERPC_PORT || "22"),
  username: process.env.SORTERPC_USER || "",
  password: process.env.SORTERPC_PASSWORD || "",
};

//import process tracker and start the process
import ProcessTracker from "./processTracker.js";
//ProcessTracker.startProcess("sorterJourneyTrace");

//reboot every day at 00:05
cron.schedule("5 0 * * *", () => {
  console.log("Rebooting service...");
  process.exit(0);
});

let inStartUp = true;
//delete old data every day at start of day
startUp();

async function startUp() {
  //if the trace folder doesn't exist, create it
  if (!fs.existsSync("./trace")) {
    fs.mkdirSync("./trace");
  }

  //delete old trace folder /trace
  fs.rmdirSync("./trace", { recursive: true });
  fs.mkdirSync("./trace");
  console.log("Deleted old trace data");

  //download all current journey traces

  await downloadNewFilesFromSFTPHost(hostConfig, "./trace", "/xb/lg/trace/current");

  //const filesOn = await getFilesInDirectory(hostConfig, "/xb/lg/trace/current");
  //console.log(filesOn);

  inStartUp = false;
}

let cron1MinuteIsRunning = false;

//every minute
cron.schedule("* * * * *", async () => {
  //if in startup, don't do anything
  if (inStartUp || cron1MinuteIsRunning) {
    return;
  }

  cron1MinuteIsRunning = true;

  //connect to the sorter pc and get the current journey traces
  await downloadNewFilesFromSFTPHost(hostConfig, "./trace", "/xb/lg/trace/current");

  cron1MinuteIsRunning = false;
});
