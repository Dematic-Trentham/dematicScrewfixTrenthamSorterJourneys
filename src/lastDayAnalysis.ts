import * as fs from "fs";
import { mergeTraceFilesIntoArray } from "./helpers/fileSystem.js";

type cellData = {
  cellNumber: number;
  badPositionsTotal: number;
  badPositionsForward: number;
  badPositionsBackward: number;
  recenteredTotal: number;
  recenteredLeft: number;
  recenteredRight: number;
  recirculatedTotal: number;
  totalInducts: number;
};

type inductData = {
  inductNumber: number;
  badPositionsTotal: number;
  badPositionsForward: number;
  badPositionsBackward: number;
  recenteredTotal: number;
  recenteredLeft: number;
  recenteredRight: number;
  recirculatedTotal: number;
  totalInducts: number;
};

type chuteData = {
  chuteNumber: number;
  badPositionsTotal: number;
  badPositionsForward: number;
  badPositionsBackward: number;
  recenteredTotal: number;
  recenteredLeft: number;
  recenteredRight: number;
  recirculatedTotal: number;
  totalInducts: number;
};

type recenterData = {
  recenterStation: number;
  recenteredTotal: number;
  recenteredLeft: number;
  recenteredRight: number;
};

// arrays to hold the data
let cellsArray: cellData[] = [];
let inductsArray: inductData[] = [];
let chutesArray: chuteData[] = [];
let recenterArray: recenterData[] = [];
let badPosArray: string[] = [];

export async function lastDayAnalysis() {
  const mergedData = await mergeTraceFilesIntoArray("./trace/1dayago");

  console.log("mergedData");

  const yesterday = new Date();
  const yesterdayString = yesterday.toISOString().split("T")[0];

  // arrays to hold the data
  cellsArray = [];
  inductsArray = [];
  chutesArray = [];
  recenterArray = [];

  let amountOfoffloads = 0;

  // loop through the data to find offloads ("ROUTING SC: TXED M_DSPARCRES sc=0")

  for (let x = 0; x < mergedData.length; x++) {
    const trace = mergedData[x];

    if (trace.includes("ROUTING SC: TXED M_DSPARCRES sc=")) {
      //analyze the journey
      await analysisJourney(mergedData, x, yesterdayString);
      amountOfoffloads++;
    }

    checkForBadPosition(trace);

    //every 10000 lines print the progress, in a nice format with the date and time , percentage and the amount of offloads
    if (x % 10000 === 0) {
      //time in the trace
      const time = mergedData[x].split(")")[0];

      console.log(
        new Date().toLocaleTimeString(),
        " | ",
        ((x / mergedData.length) * 100).toFixed(2),
        "%",
        " | ",
        amountOfoffloads,
        " offloads",
        " | ",
        time,
        ")"
      );
    }

    //break the loop if the amount of offloads is more than 5000 (for testing)
    if (amountOfoffloads > 5000) {
      break;
    }
  }

  console.log("badPosArray", badPosArray);

  //lets analysis badPosArray
  await analysisBadPosArray(badPosArray);

  //print the results
  // console.log("cellsArray", cellsArray);
  // console.log("inductsArray", inductsArray);
  // console.log("chutesArray", chutesArray);
  // console.log("recenterArray", recenterArray);

  console.log("finished");
  process.exit();
}

async function analysisJourney(totalTraceArray: string[], lineNumber: number, dateString: string) {
  //get all the details of the line
  const line = totalTraceArray[lineNumber];

  const UL = line.split("code=<")[1].split(">")[0];
  const offloadTime = dateString + " " + line.split("(")[1].split(")")[0];
  const cellNumber = line.split("Cell=")[1].split(" ")[0];
  const inductNumber = line.split("is=")[1].split(" ")[0];
  const chuteNumber = line.split("ch=")[1].split(" ")[0];
  const weight = line.split("wg=")[1].split(" ")[0];
  const rejectReason = line.split("rr=")[1].split(" ")[0];

  let areaSensorLine = "";

  for (let x = lineNumber; x > 0; x--) {
    const currentLine = totalTraceArray[x];

    if (currentLine.includes("<send_loadreq_mex>") && currentLine.includes(`code=<${UL}>`)) {
      areaSensorLine = currentLine;
      break;
    }
  }

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
      currentLine.includes(`cell=${cellNumber}:`) ||
      currentLine.includes(`Cell=${cellNumber}:`) ||
      currentLine.includes(`cell ${cellNumber}:`) ||
      currentLine.includes(`Cell ${cellNumber}:`) ||
      currentLine.includes(`cell:${cellNumber}:`) ||
      currentLine.includes(`Cell:${cellNumber}:`) ||
      currentLine.includes(`code=<${UL}>`)
    ) {
      journeyLines.push(currentLine);

      if (currentLine.includes("LOADMGM") && currentLine.includes(`cell=${cellNumber}`)) {
        break;
      }
    }
  }
  journeyLines.push(areaSensorLine);

  //reverse lines
  journeyLines.reverse();

  //console.log(journeyLines);

  const cellIndex = parseInt(cellNumber);
  if (cellsArray[cellIndex] === undefined) {
    cellsArray[cellIndex] = {
      cellNumber: cellIndex,
      badPositionsTotal: 0,
      badPositionsForward: 0,
      badPositionsBackward: 0,
      recenteredTotal: 0,
      recenteredLeft: 0,
      recenteredRight: 0,
      recirculatedTotal: 0,
      totalInducts: 0,
    };
  }

  cellsArray[cellIndex].totalInducts++;

  //inducts
  const inductIndex = parseInt(inductNumber);
  if (inductsArray[inductIndex] === undefined) {
    inductsArray[inductIndex] = {
      inductNumber: inductIndex,
      badPositionsTotal: 0,
      badPositionsForward: 0,
      badPositionsBackward: 0,
      recenteredTotal: 0,
      recenteredLeft: 0,
      recenteredRight: 0,
      recirculatedTotal: 0,
      totalInducts: 0,
    };
  }

  inductsArray[inductIndex].totalInducts++;

  //chutes
  const chuteIndex = parseInt(chuteNumber);
  if (chutesArray[chuteIndex] === undefined) {
    chutesArray[chuteIndex] = {
      chuteNumber: chuteIndex,
      badPositionsTotal: 0,
      badPositionsForward: 0,
      badPositionsBackward: 0,
      recenteredTotal: 0,
      recenteredLeft: 0,
      recenteredRight: 0,
      recirculatedTotal: 0,
      totalInducts: 0,
    };
  }

  chutesArray[chuteIndex].totalInducts++;

  //save the journey as text file "journeyLines-" +offloadTime + "-" cellNumber + "-" + inductNumber + "-" + chuteNumber + ".txt"
  //await saveJourney(journeyLines, offloadTime, cellNumber, inductNumber, chuteNumber);

  //check for laser recenter
  for (let x = 0; x < journeyLines.length; x++) {
    const line = journeyLines[x];

    await checkForLaserRecenter(line, cellNumber, inductNumber, chuteNumber);
    await checkForOldRecenter(line, cellNumber, inductNumber, chuteNumber);
  }
}

async function saveJourney(journeyLines: string[], offloadTime: string, cellNumber: string, inductNumber: string, chuteNumber: string) {
  const fileName = `journeyLines-${offloadTime}-cell${cellNumber}-induct${inductNumber}-chute${chuteNumber}.txt`;

  let data = "";

  for (let x = 0; x < journeyLines.length; x++) {
    data += journeyLines[x] + "\n";
  }

  //make the folder if it does not exist
  if (!fs.existsSync("./journeys")) {
    fs.mkdirSync("./journeys");
  }

  //write the file

  //console.log("writing file", fileName);

  fs.writeFileSync(`./journeys/${fileName}`, data);
}

async function checkForLaserRecenter(line: string, cell: string, induct: string, chute: string) {
  //if the line does not contain "LASERREC" and "mov" then skip
  if (!line.includes("LASERREC")) {
    return;
  }

  if (!line.includes("mov=")) {
    return;
  }

  //get the mov value
  const mov = line.split("mov=")[1].split(" ")[0];

  //get the direction
  let direction = "";
  if (parseInt(mov) > 0) {
    direction = "right";
  } else if (parseInt(mov) < 0) {
    direction = "left";
  }

  //add to stats

  //Cell Stats
  const cellIndex = parseInt(cell);
  cellsArray[cellIndex].recenteredTotal++;

  if (direction === "left") {
    cellsArray[cellIndex].recenteredLeft++;
  } else if (direction === "right") {
    cellsArray[cellIndex].recenteredRight++;
  }

  //Induct Stats
  const inductIndex = parseInt(induct);
  inductsArray[inductIndex].recenteredTotal++;

  if (direction === "left") {
    inductsArray[inductIndex].recenteredLeft++;
  } else if (direction === "right") {
    inductsArray[inductIndex].recenteredRight++;
  }

  //Chute Stats
  const chuteIndex = parseInt(chute);
  chutesArray[chuteIndex].recenteredTotal++;

  if (direction === "left") {
    chutesArray[chuteIndex].recenteredLeft++;
  } else if (direction === "right") {
    chutesArray[chuteIndex].recenteredRight++;
  }

  //Recenter Stats
  //recenter stations
  const station = line.split("LASERREC ")[1].split(":")[0];
  const recenterStation = 50 + parseInt(station);
  if (recenterArray[recenterStation] === undefined) {
    recenterArray[recenterStation] = {
      recenterStation: recenterStation,
      recenteredTotal: 0,
      recenteredLeft: 0,
      recenteredRight: 0,
    };
  }

  if (direction === "left") {
    recenterArray[recenterStation].recenteredLeft++;
  } else if (direction === "right") {
    recenterArray[recenterStation].recenteredRight++;
  }
}

async function checkForOldRecenter(line: string, cell: string, induct: string, chute: string) {
  //if the line does not contain "LASERREC" and "mov" then skip
  if (!line.includes("RECNEW")) {
    return;
  }

  if (!line.includes("<set_recnew_move>")) {
    return;
  }

  if (!line.includes("(c=")) {
    return;
  }

  //get the mov value
  const mov = line.split("(c=")[1].split(" ")[0];

  //get the direction
  let direction = "";
  if (parseInt(mov) > 0) {
    direction = "right";
  } else if (parseInt(mov) < 0) {
    direction = "left";
  }

  //add to stats

  //Cell Stats
  const cellIndex = parseInt(cell);
  cellsArray[cellIndex].recenteredTotal++;

  if (direction === "left") {
    cellsArray[cellIndex].recenteredLeft++;
  } else if (direction === "right") {
    cellsArray[cellIndex].recenteredRight++;
  }

  //Induct Stats
  const inductIndex = parseInt(induct);
  inductsArray[inductIndex].recenteredTotal++;

  if (direction === "left") {
    inductsArray[inductIndex].recenteredLeft++;
  } else if (direction === "right") {
    inductsArray[inductIndex].recenteredRight++;
  }

  //Chute Stats
  const chuteIndex = parseInt(chute);
  chutesArray[chuteIndex].recenteredTotal++;

  if (direction === "left") {
    chutesArray[chuteIndex].recenteredLeft++;
  } else if (direction === "right") {
    chutesArray[chuteIndex].recenteredRight++;
  }

  //Recenter Stats
  //recenter stations
  const station = line.split("RECNEW ")[1].split(":")[0];
  const recenterStation = parseInt(station);
  if (recenterArray[recenterStation] === undefined) {
    recenterArray[recenterStation] = {
      recenterStation: recenterStation,
      recenteredTotal: 0,
      recenteredLeft: 0,
      recenteredRight: 0,
    };
  }

  if (direction === "left") {
    recenterArray[recenterStation].recenteredLeft++;
  } else if (direction === "right") {
    recenterArray[recenterStation].recenteredRight++;
  }
}

async function checkForBadPosition(line: string) {
  if (!line.includes("ph1_test_if_parcel_is_good")) return;

  if (!line.includes("Dis for no light")) return;

  badPosArray.push(line);
}

async function analysisBadPosArray(badPosArray: string[]) {
  //analyze the badPosArray in pairs of 2 , to see if the cell number is one more or one less than each other

  for (let x = 0; x < badPosArray.length; x = x + 1) {
    //if we are at the end of the array then break
    if (x === badPosArray.length - 1) {
      break;
    }

    const line = badPosArray[x];
    const nextLine = badPosArray[x + 1];

    const cell = line.split("Cell=")[1].split(" ")[0];
    const nextCell = nextLine.split("Cell=")[1].split(" ")[0];

    const induct = line.split("IS=")[1].split(" ")[0];
    const nextInduct = nextLine.split("IS=")[1].split(" ")[0];

    console.log("cell", cell, "nextCell", nextCell + " | induct", induct, "nextInduct", nextInduct);

    if (parseInt(cell) === parseInt(nextCell) - 1) {
      //forward
      const cellIndex = parseInt(cell);
      cellsArray[cellIndex].badPositionsForward++;

      console.log("forward");
    } else if (parseInt(cell) === parseInt(nextCell) + 1) {
      //backward
      const cellIndex = parseInt(cell);
      cellsArray[cellIndex].badPositionsBackward++;

      console.log("backward");
    }
  }
}
