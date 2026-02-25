//

import db from "./db/db.js";

export async function readEncoderLineByLine(line: string, i: number, totalLines: number, filePath: string) {
  //if we do not have "ENCMGN" in the line, ignore it
  if (line.includes("ENCMGM") == false) {
    return;
  }

  checkForHasNotSeen(line, i, totalLines, filePath);
}

async function checkForHasNotSeen(line: string, i: number, totalLines: number, filePath: string) {
  //if we do not have "has not seen" in the line, ignore it
  if (line.includes("has not seen") == false) {
    return;
  }

  console.log(`Found encoder has not seen in line ${i + 1}: ${line}`);

  const time = line.substring(1, 13);
  //turn the time into a date with todays date
  const date = new Date();
  const timeSplit = time.split(":");
  date.setHours(parseInt(timeSplit[0]));
  date.setMinutes(parseInt(timeSplit[1]));
  date.setSeconds(parseInt(timeSplit[2].split(".")[0]));
  date.setMilliseconds(parseInt(timeSplit[2].split(".")[1]));

  //get the encoder photocell number
  const encoderPhotoCell = parseInt(line.split("ph=")[1].split(" ")[0]);

  //get the cell number
  const cell = parseInt(line.split("cell=")[1]);

  //show to user
  console.log(`Encoder photocell ${encoderPhotoCell} has not seen cell ${cell} at ${date.toISOString()}`);

  //increment counter for cell
  if (counterCells.has(cell)) {
    counterCells.set(cell, counterCells.get(cell)! + 1);
  } else {
    counterCells.set(cell, 1);
  }

  //increment counter for photocell
  if (counterPhotoCells.has(encoderPhotoCell)) {
    counterPhotoCells.set(encoderPhotoCell, counterPhotoCells.get(encoderPhotoCell)! + 1);
  } else {
    counterPhotoCells.set(encoderPhotoCell, 1);
  }
}

let counterCells = new Map<number, number>();
let counterPhotoCells = new Map<number, number>();

export async function checkForHasNotSeenStart() {
  //reset counters
  counterCells.clear();
  counterPhotoCells.clear();
}

export async function checkForHasNotSeenEnd() {
  console.log("Encoder has not seen summary:");
  for (const [cell, count] of counterCells) {
    console.log(`Cell ${cell} was not seen ${count} times`);
  }
  for (const [photoCell, count] of counterPhotoCells) {
    console.log(`Photocell ${photoCell} did not see its cell ${count} times`);
  }

  //insert into database
  for (const [cell, count] of counterCells) {
    await db.sorterEncoderHasNotSeenCell.create({
      data: {
        createdAt: new Date(),
        cell: cell - 1,
        countPerHour: count,
      },
    });
  }

  for (const [photoCell, count] of counterPhotoCells) {
    await db.sorterEncoderHasSeenPhotoCell.create({
      data: {
        createdAt: new Date(),
        photoCell: photoCell,
        countPerHour: count,
      },
    });
  }
}
