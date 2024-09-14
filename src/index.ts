//Service for Dematic Dashboard Screwfix
//Created by: JWL
//Date: 2023/02/02 02:51:41
//Last modified: 2024/09/13 20:49:43
//Version: 1.0.9

//imports
import "dotenv/config";

import cron from "node-cron";
import fs from "fs";
import { downloadNewFilesFromSFTPHost, sftpClientSettings, getFilesInDirectory, downloadFileFromSFTPHost } from "./helpers/sftpDownloader.js";

import db from "./db/db.js";

import { runAnalysisOnRequestedUL } from "./runAnalysisOnRequestedUL.js";

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
ProcessTracker.startProcess("sorterJourneyTrace");

//reboot every day at 00:05
cron.schedule("5 0 * * *", () => {
  console.log("Rebooting service...");
  process.exit(0);
});

let inStartUp = true;
//delete old data every day at start of day
startUp();

async function startUp() {
  if (process.env.dev === "true") {
    //if the trace folder doesn't exist, create it
    if (!fs.existsSync("./trace")) {
      fs.mkdirSync("./trace");
    }

    //delete old trace folder /trace
    fs.rmdirSync("./trace", { recursive: true });
    fs.mkdirSync("./trace");
    console.log("Deleted old trace data");
  }

  if (!fs.existsSync("./trace")) {
    fs.mkdirSync("./trace");
  }

  //download all current journey traces

  await downloadNewFilesFromSFTPHost(hostConfig, "./trace", "/xb/lg/trace/current");

  console.log("Downloaded current journey traces");

  //const filesOn = await getFilesInDirectory(hostConfig, "/xb/lg/trace/current");
  //console.log(filesOn);

  inStartUp = false;

  cron1MinuteFunction();
}

let cron1MinuteIsRunning = false;
let cron5SecondIsRunning = false;
let cron1MinuteIsRunningTotal = 0;
let cronMidnightIsRunning = false;

//every minute
cron.schedule("* * * * *", async () => {
  cron1MinuteFunction();
});

//every 5 seconds
cron.schedule("*/5 * * * * *", async () => {
  cron5SecondFunction();
});

//midnight
cron.schedule("0 0 * * *", async () => {
  console.log("Deleting old data");

  cronMidnightIsRunning = true;

  //delete old trace folder /trace
  fs.rmdirSync("./trace", { recursive: true });
  fs.mkdirSync("./trace");

  console.log("Deleted old trace data");

  cronMidnightIsRunning = false;
});

async function cron1MinuteFunction() {
  //if in startup, don't do anything
  if (inStartUp || cron1MinuteIsRunning || cron5SecondIsRunning || cronMidnightIsRunning) {
    console.log("In startup or cron is running");

    cron1MinuteIsRunningTotal++;

    console.log(cron1MinuteIsRunningTotal);

    return;
  }

  console.log("Running cron 1 minute");

  cron1MinuteIsRunning = true;

  console.log("Downloading current journey traces");

  //connect to the sorter pc and get the current journey traces
  await downloadNewFilesFromSFTPHost(hostConfig, "./trace", "/xb/lg/trace/current");

  console.log("Downloaded current journey traces");

  cron1MinuteIsRunning = false;
}

async function cron5SecondFunction() {
  //console log the ram usage of this service
  const used = process.memoryUsage();
  for (let key in used) {
    const memoryKey = key as keyof NodeJS.MemoryUsage;
    console.log(`${memoryKey} ${Math.round((used[memoryKey] / 1024 / 1024) * 100) / 100} MB`);
  }

  //if in startup, don't do anything
  if (inStartUp || cron1MinuteIsRunning || cron5SecondIsRunning || cronMidnightIsRunning) {
    return;
  }

  cron5SecondIsRunning = true;

  //do we have a new request for a journey trace?
  const SorterJourneyRequests = await db.sorterJourneyRequests.findFirst({
    where: {
      status: "REQUESTED",
    },
  });

  console.log("SorterJourneyRequests ");

  if (SorterJourneyRequests === null) {
    cron5SecondIsRunning = false;
    console.log("No journey trace requests");

    return;
  }

  //we have a request  , lets process it
  const sorterJourneyRequest = await db.sorterJourneyRequests.update({
    where: {
      id: SorterJourneyRequests.id,
    },
    data: {
      status: "PROCESSING",
      journey: "",
      currentStatusStep: "Downloading latest trace file",
      processingStartedDate: new Date(),
    },
  });

  console.log("Processing journey trace request");

  //download the trace.lg file
  const traceFileResult = await downloadFileFromSFTPHost(hostConfig, "./trace/trace.lg", "/xb/lg/trace/current/trace.lg");

  console.log(traceFileResult);

  console.log("Downloaded trace file");

  //run analysis on the trace file
  await runAnalysisOnRequestedUL(sorterJourneyRequest.requestedUL, sorterJourneyRequest.id);

  cron5SecondIsRunning = false;
}
