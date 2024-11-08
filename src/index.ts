//Service for Dematic Dashboard Screwfix
//Created by: JWL
//Date: 2023/02/02 02:51:41
//Last modified: 2024/09/23 16:03:51
//Version: 1.0.9

//imports
import "dotenv/config";

import fs from "fs";
import cron from "node-cron";
import { downloadFileFromSFTPHost, downloadNewFilesFromSFTPHost, sftpClientSettings } from "./helpers/sftpDownloader.js";

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
import { lastDayAnalysis } from "./lastDayAnalysis.js";
//ProcessTracker.startProcess("sorterJourneyTrace");

let inStartUp = true;
//delete old data every day at start of day
startUp();

async function startUp() {
  //pretend to last day analysis
  await lastDayAnalysis();

  mainProcessReporter("Starting up");

  if (!fs.existsSync("./trace")) {
    fs.mkdirSync("./trace");
  }

  if (!fs.existsSync("./trace/today")) {
    fs.mkdirSync("./trace/today");
  }

  //download all current journey traces
  mainProcessReporter("'Startup' - Downloading existing journey traces");

  await downloadNewFilesFromSFTPHost(hostConfig, "./trace/today", "/xb/lg/trace/current");

  console.log("Downloaded current journey traces");
  mainProcessReporter("'Startup' - Downloaded existing journey traces, waiting for new requests");

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
  cronMidnightIsRunning = true;

  console.log("Deleting/ moving old data");

  //delete old trace folder /7dayago
  if (fs.existsSync("./trace/7dayago")) {
    fs.rmdirSync("./trace/7dayago", { recursive: true });
  }

  //move 6dayago to 7dayago
  if (fs.existsSync("./trace/6dayago")) {
    fs.renameSync("./trace/6dayago", "./trace/7dayago");
  }

  //move 5dayago to 6dayago
  if (fs.existsSync("./trace/5dayago")) {
    fs.renameSync("./trace/5dayago", "./trace/6dayago");
  }

  //move 4dayago to 5dayago
  if (fs.existsSync("./trace/4dayago")) {
    fs.renameSync("./trace/4dayago", "./trace/5dayago");
  }

  //move 3dayago to 4dayago
  if (fs.existsSync("./trace/3dayago")) {
    fs.renameSync("./trace/3dayago", "./trace/4dayago");
  }

  //move 2dayago to 3dayago
  if (fs.existsSync("./trace/2dayago")) {
    fs.renameSync("./trace/2dayago", "./trace/3dayago");
  }

  //move 1dayago to 2dayago
  if (fs.existsSync("./trace/1dayago")) {
    fs.renameSync("./trace/1dayago", "./trace/2dayago");
  }

  //move today /trace/today to /trace/1dayago
  if (fs.existsSync("./trace/today")) {
    fs.renameSync("./trace/today", "./trace/1dayago");
  }

  //delete old trace folder /trace
  fs.mkdirSync("./trace/today", { recursive: true });

  console.log("Deleted old trace data/ moved to new folders");

  //run analysis for all the files in the 1dayago folder
  await lastDayAnalysis();

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
  mainProcessReporter("Downloading latest journey traces");

  //connect to the sorter pc and get the current journey traces
  await downloadNewFilesFromSFTPHost(hostConfig, "./trace/today", "/xb/lg/trace/current");

  console.log("Downloaded current journey traces");

  cron1MinuteIsRunning = false;
}

async function cron5SecondFunction() {
  //console log the ram usage of this service
  const used = process.memoryUsage();
  for (let key in used) {
    const memoryKey = key as keyof NodeJS.MemoryUsage;
    //   console.log(`${memoryKey} ${Math.round((used[memoryKey] / 1024 / 1024) * 100) / 100} MB`);
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
    mainProcessReporter("No journey trace requests");

    return;
  }

  mainProcessReporter("Processing journey trace request");

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
  const traceFileResult = await downloadFileFromSFTPHost(hostConfig, "./trace/today/trace.lg", "/xb/lg/trace/current/trace.lg");

  console.log(traceFileResult);

  console.log("Downloaded trace file");

  //run analysis on the trace file
  await runAnalysisOnRequestedUL(sorterJourneyRequest.requestedUL, sorterJourneyRequest.id, "./trace/today");

  cron5SecondIsRunning = false;
}

export async function mainProcessReporter(status: string) {
  //check if we already have a id of 1 - this is for the user to know that the service is running and what it is doing
  const sorterJourneyRequest = await db.sorterJourneyRequests.findFirst({
    where: {
      requestedUL: "master",
    },
  });

  //if we don't have a id of 1, create it and update the status
  if (sorterJourneyRequest === null) {
    await db.sorterJourneyRequests.create({
      data: {
        requestedUL: "master",
        status: status,
        journey: "",
        currentStatusStep: "",
        processingStartedDate: new Date(),
      },
    });
    return;
  }

  //if we do have a id of 1, update the status
  await db.sorterJourneyRequests.updateMany({
    where: {
      requestedUL: "master",
    },
    data: {
      status: status,
      journey: "",
      currentStatusStep: "Downloading latest trace file",
      processingStartedDate: new Date(),
    },
  });
}
