import fs from "fs/promises";
import fsNormal, { stat } from "fs";
import path from "path";

import { devLog, devError, log, logError } from "./helpers/logging";
import { mergeTraceFilesIntoArray } from "./helpers/fileSystem.js";
import db from "./db/db.js";
import { mainProcessReporter } from "./index.js";

export async function runAnalysisOnRequestedUL(requestedUL: string, requestID: string, requestedDay: string) {
  mainProcessReporter("Processing a request");

  console.log(`111 Running analysis on ${requestedUL} for request ${requestID} for ${requestedDay}`);

  await updateStatusStep(requestID, "Merging Trace Files Into Array");

  //lets read in all the files in the trace directory
  const totalTraceArray = await mergeTraceFilesIntoArray(requestedDay, requestID);

  const dateString = totalTraceArray[1].split("New day: ")[1];

  //change mm/dd/yyyy to yyyy-mmm-dd
  const dateArray = dateString.split("/");
  const newDateString = dateArray[2] + "-" + dateArray[0] + "-" + dateArray[1];

  await updateStatusStep(requestID, "Finding Offloads for parcel");

  //lets find the last time that the requested UL was offloaded
  let offloadLines = [];

  let journeyArray = [];

  for (let x = 0; x < totalTraceArray.length; x++) {
    const trace = totalTraceArray[x];

    if (trace.includes("ROUTING SC: TXED M_DSPARCRES") && trace.includes(requestedUL)) {
      console.log(`Found offload for ${requestedUL} at line ${x}`);
      offloadLines.push({ lineNumber: x, line: trace });
    }
  }
  console.log(offloadLines);

  if (offloadLines.length === 0) {
    console.log("222 No offloads found for parcel for requested day" + requestedDay);

    await updateStatusStep(requestID, "No offloads found for parcel for requested day" + requestedDay);

    //check what has been requested "requestedDay" ,  try the previous day
    let previousDay = "";

    if (requestedDay === "./trace/today") {
      previousDay = "1dayago";
    } else if (requestedDay === "./trace/1dayago") {
      previousDay = "2daysago";
    } else if (requestedDay === "./trace/2daysago") {
      previousDay = "3daysago";
    } else if (requestedDay === "./trace/3daysago") {
      previousDay = "4daysago";
    } else if (requestedDay === "./trace/4daysago") {
      previousDay = "5daysago";
    } else if (requestedDay === "./trace/5daysago") {
      previousDay = "6daysago";
    } else if (requestedDay === "./trace/6daysago") {
      previousDay = "7daysago";
    } else {
      console.log(`333 Checking previous day ${previousDay} ` + "7 days checked");

      await updateStatusStep(requestID, "No offloads found for parcel for requested day" + requestedDay + " last 7 days checked");

      await db.sorterJourneyRequests.update({
        where: {
          id: requestID,
        },
        data: {
          status: "COMPLETED",
          journey: "[]",
          processingCompletedDate: new Date(),
          currentStatusStep: "Completed",
        },
      });

      return;
    }
    await updateStatusStep(requestID, "Checking previous day " + previousDay);
    console.log(`Checking previous day ${previousDay}`);

    await runAnalysisOnRequestedUL(requestedUL, requestID, "./trace/" + previousDay);

    return;
  }

  //process for each offload line
  for (let x = 0; x < offloadLines.length; x++) {
    const offloadLine = offloadLines[x];

    console.log(`Processing offload line ${x + 1} of ${offloadLines.length}`);
    await updateStatusStep(requestID, `Processing offload line ${x + 1} of ${offloadLines.length}`);

    const journey = await analysisTraceLine(totalTraceArray, offloadLine.lineNumber, newDateString);

    journeyArray.push(journey);
  }

  try {
    const journeyString = JSON.stringify(journeyArray);

    await db.sorterJourneyRequests.update({
      where: {
        id: requestID,
      },
      data: {
        status: "COMPLETED",
        journey: journeyString,
        processingCompletedDate: new Date(),
        currentStatusStep: "Completed",
      },
    });
  } catch (e) {
    console.log("Prisma 1 error");
    console.log(e);
  }

  mainProcessReporter("Completed a request");
}

async function analysisTraceLine(totalTraceArray: string[], lineNumber: number, dateString: string) {
  console.log(`Analyzing trace line ${lineNumber}`);

  //get all the details of the line
  const line = totalTraceArray[lineNumber];

  //console.log(`Line: ${line}`);

  const UL = line.split("code=<")[1].split(">")[0];

  const offloadTime = dateString + " " + line.split("(")[1].split(")")[0];

  const cellNumber = line.split("Cell=")[1].split(" ")[0];
  const inductNumber = line.split("is=")[1].split(" ")[0];
  const chuteNumber = line.split("ch=")[1].split(" ")[0];
  const weight = line.split("wg=")[1].split(" ")[0];
  const rejectReason = line.split("rr=")[1].split(" ")[0];

  //lets loop back from the offload line to find the induction line

  //console.log(`code=<${UL}>`);
  //find areasensor line
  let areaSensorLine = "";

  console.log("Finding area sensor line");
  for (let x = lineNumber; x > 0; x--) {
    const currentLine = totalTraceArray[x];

    if (currentLine.includes("<send_loadreq_mex>") && currentLine.includes(`code=<${UL}>`)) {
      console.log("Found area sensor line");

      areaSensorLine = currentLine;
      break;
    }
  }
  // console.log("test:" + areaSensorLine);

  let journeyLines = [];

  for (let x = lineNumber; x > 0; x--) {
    const currentLine = totalTraceArray[x];

    if (
      currentLine.includes(`cell=${cellNumber} `) ||
      currentLine.includes(`Cell=${cellNumber} `) ||
      currentLine.includes(`cell ${cellNumber} `) ||
      currentLine.includes(`Cell ${cellNumber} `) ||
      currentLine.includes(`cell:${cellNumber} `) ||
      currentLine.includes(`Cell:${cellNumber} `) ||
      currentLine.includes(`code=<${UL}>`)
    ) {
      journeyLines.push(currentLine);
      //console.log(currentLine);

      if (currentLine.includes("LOADMGM") && currentLine.includes(`cell=${cellNumber}`)) {
        break;
      }
    }
  }

  //reverse lines
  journeyLines.reverse();
  return { UL, offloadTime, cellNumber, inductNumber, chuteNumber, weight, rejectReason, areaSensorLine, journeyLines };

  // console.log(journeyLines);
}

export async function updateStatusStep(requestID: string, status: string) {
  //console.log(`Updating status of request ${requestID} to ${status}`);

  const result = await db.sorterJourneyRequests.update({
    where: {
      id: requestID,
    },
    data: {
      currentStatusStep: status,
    },
  });

  //console.log(result);
}