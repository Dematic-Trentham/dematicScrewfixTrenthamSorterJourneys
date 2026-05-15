const folderName = "./trace/today";

import * as fs from "fs";
import * as path from "path";
import { createCanvas, loadImage } from "canvas";
import { sanitizeLine } from "../helpers/sanitizeLine.js";

const testingMode = process.env.TESTING_MODE === "true" || false;

let testFile = [] as Array<string>;

export async function runDayAnalysisInducts(folderPath: string, outputFolderPath: string) {
  //console.log(`Running day analysis inducts for folder: ${folderPath} and outputting to folder: ${outputFolderPath}`);

  //find all the files in the trace folder
  const files = fs.readdirSync(folderPath);

  let FileLimit = 20;

  let bigLines = [] as Array<string>;

  //read each file line by line
  files.forEach(async (file, index) => {
    //limit to 10 files for testing
    if (index >= FileLimit && testingMode) {
      return;
    }

    const filePath = path.join(folderPath, file);

    //read file to array of lines
    let lines = fs.readFileSync(filePath, "utf-8").split("\n");

    for (let x = 0; x < lines.length; x++) {
      const line = lines[x];

      bigLines.push(line);

      //  console.log(`Processed line ${x + 1} of ${lines.length} in file: ${file}`);
    }
  });

  for (let x = 0; x < bigLines.length; x++) {
    const line = bigLines[x];

    //every 10000 lines log progress
    if (x % 10000 === 0) {
      console.log(`Processed line ${x + 1} of ${bigLines.length}`);
    }

    //start of a journey
    if (line != undefined && line.includes("LOADMGM") && line.includes("<test_loadshift> cell=")) {
      //start of a journey
      await runDayAnalysisInductsForJourney(bigLines, x, outputFolderPath);
    }
  }
  console.log(`Finished processing all lines in all files for folder: ${folderPath}`);
  // console.log(testFile);

  //write the test file to a file
  if (testingMode) {
    const outputFilePath = path.join(outputFolderPath, `testFile.txt`);
    fs.writeFileSync(outputFilePath, JSON.stringify(testFile, null, 2));
  }
}

async function runDayAnalysisInductsForJourney(lines: string[], startIndex: number, outputFolderPath: string) {
  // console.log(`Running day analysis inducts for journey starting at line: ${startIndex}`);

  let journeyLines = [] as Array<string>;

  const cellParts = lines[startIndex].split("cell=");
  const cell = cellParts[1]?.split(" ")[0] ?? "";
  //console.log(`Cell: ${cell}`);

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    if (
      (line != undefined &&
        (line.includes("cell=" + cell + " ") ||
          line.includes("Cell=" + cell + " ") ||
          line.includes("CELL=" + cell + " ") ||
          line.includes("cell=" + cell + "\n") ||
          line.includes("Cell=" + cell + "\n") ||
          line.includes("CELL=" + cell + "\n"))) ||
      line.includes("cell=" + cell + ":") ||
      line.includes("Cell=" + cell + ":") ||
      line.includes("CELL=" + cell + ":")
    ) {
      journeyLines.push(sanitizeLine(line));
    }
  }

  const startTime = journeyLines[0].split("(")[1]?.split(")")[0] ?? "";
  //console.log(`Start Time: ${startTime}`);

  const induct = journeyLines[0].split("LOADMGM ")[1]?.split(":")[0] ?? "";
  //console.log(`Induct: ${induct}`);

  const ul = journeyLines[0].split("c_isc=<")[1]?.split(">")[0] ?? "";

  const chute = journeyLines[0].split("ch=")[1]?.split(" ")[0] ?? "";

  //get first 2 digits of the ul
  const ulFirst2Digits = ul.substring(0, 2);

  const stats = await runDayAnalysisInductsForJourneyComputeStats(journeyLines);

  //compute first postion for the UL
  const firstPosition = await runDayAnalysisInductsForJourneyComputeFirstPositionForUL(journeyLines, stats);

  //write the journey lines to a file
  const objectToWrite = {
    cell: cell,
    startTime: startTime,
    induct: induct,
    ul: ul,
    chute: chute,
    stats: stats,
    firstPosition: firstPosition,
    journeyLines: journeyLines,
  };

  fs.mkdirSync(path.join(outputFolderPath + "\\journeys\\"), { recursive: true });

  const outputFilePath = path.join(outputFolderPath + "\\journeys\\", `journey-${startTime.replace(/:/g, "-")}-${induct}-${ul}.txt`);
  fs.writeFileSync(outputFilePath, JSON.stringify(objectToWrite, null, 2));
}

async function runDayAnalysisInductsForJourneyComputeStats(journeyLines: string[]): Promise<{
  length: number;
  width: number;
  weight: number;
}> {
  for (let i = 0; i < journeyLines.length; i++) {
    const line = journeyLines[i];

    if (line.includes("RX DSCHUTEREQ Cell=")) {
      const localLine = line.split("RX DSCHUTEREQ Cell=")[1] ?? "";

      return {
        length: parseInt(localLine.split("l=")[1]?.split(" ")[0] ?? "0"),
        width: parseInt(localLine.split("w=")[1]?.split(" ")[0] ?? "0"),
        weight: parseInt(localLine.split("wg=")[1]?.split(" ")[0] ?? "0"),
      };
    }
  }

  return {
    length: 0,
    width: 0,
    weight: 0,
  };
}

let worstangle = 0;

async function runDayAnalysisInductsForJourneyComputeFirstPositionForUL(
  journeyLines: string[],
  stats: { length: number; width: number; weight: number },
): Promise<{
  compSum: { left: number; right: number };
  leftSplit: Array<number>;
  rightSplit: Array<number>;
}> {
  for (let i = 0; i < journeyLines.length; i++) {
    const line = journeyLines[i];

    //find the first time we go thought a recenter "PH1MGM" and also "<ph1_set_value_for_parcel_found>"

    if (line.includes("LASERREC") && line.includes("Left")) {
      const left = line;
      const right = journeyLines[i + 1] ?? "";
      const comp = journeyLines[i + 2] ?? "";

      const leftMin = left.split("min=[")[1]?.split("]")[0] ?? "";
      const rightMin = right.split("min=[")[1]?.split("]")[0] ?? "";
      const compSum = comp.split("sums=[")[1]?.split("]")[0] ?? "";

      const leftSplit = leftMin.split("-").map((s) => s.trim());
      const rightSplit = rightMin.split("-").map((s) => s.trim());

      const testString = ` Comp: ${compSum} (Left Split: ${leftSplit.join(", ")}, Right Split: ${rightSplit.join(", ")})`;

      testFile.push(testString);

      const angle = parseInt(leftSplit[0]) - parseInt(leftSplit[3]);
      if (Math.abs(angle) > Math.abs(worstangle)) {
        worstangle = angle;

        console.log(`New worst angle: ${worstangle} at line: ${line}`);
        console.log(`Left Split: ${leftSplit.join(", ")}, Right Split: ${rightSplit.join(", ")}`);
        console.log(`Stats for this journey: Length: ${stats.length}, Width: ${stats.width}, Weight: ${stats.weight}`);
      }

      return {
        compSum: {
          left: parseInt(compSum.split("l=")[1]?.split("-")[0] ?? "0"),
          right: parseInt(compSum.split("r=")[1]?.split(" ")[0] ?? "0"),
        },
        leftSplit: leftSplit.map((s) => parseInt(s)),
        rightSplit: rightSplit.map((s) => parseInt(s)),
      };
    }
  }

  return {
    compSum: { left: 0, right: 0 },
    leftSplit: [],
    rightSplit: [],
  };
}
