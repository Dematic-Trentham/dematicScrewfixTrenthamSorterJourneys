import * as fs from "fs";
import { checkForDisabledCells, checkForDisabledCellsStart, finalizeDisabledCellsCheck } from "./disabledCells.js";
import { checkForHasNotSeenEnd, checkForHasNotSeenStart, readEncoderLineByLine } from "./lineReaderEncoder.js";

export async function readFileLineByLine(path: string) {
  console.log(`Reading file line by line: ${path}`);

  //read the file
  const fileContents = await fs.promises.readFile(path, "utf-8");

  //read the file line by line
  const lines = fileContents.split("\n");
  console.log(`Found ${lines.length} lines`);

  //start timer
  const startTime = Date.now();

  await checkForDisabledCellsStart();
  await checkForHasNotSeenStart();

  for (let i = 1; i < lines.length; i++) {
    await checkForDisabledCells(lines[i], i, lines.length, path);
    await readEncoderLineByLine(lines[i], i, lines.length, path);

    //every 10000 lines, log progress
    if (i % 10000 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const linesPerSecond = (i / elapsed).toFixed(2);
      console.log(
        `Read ${i} of ${lines.length} lines (${((i / lines.length) * 100).toFixed(2)}%) for file ${path} in ${Date.now() - startTime}ms (${linesPerSecond} lines/sec)`,
      );
    }
  }
  console.log("Finished reading file line by line " + path + " in " + (Date.now() - startTime) + "ms");

  await finalizeDisabledCellsCheck();
  await checkForHasNotSeenEnd();
}
