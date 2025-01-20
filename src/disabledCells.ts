import * as fs from "fs";
import db from "./db/db.js";

export async function checkForDisabledCells(path: string) {
  console.log(`Checking for disabled cells in ${path}`);

  //read the file
  const fileContents = await fs.promises.readFile(path, "utf-8");

  //read the file line by line
  const lines = fileContents.split("\n");

  //list of disabled cells
  const disabledCells: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("disabled cell")) {
      console.log(line);

      //get the cell number
      const cellNumber = line.split("cell=")[1].split(" ")[0];

      //add the cell to the list of disabled cells if it is not already there
      if (!disabledCells.includes(cellNumber)) {
        disabledCells.push(cellNumber);
      }
    }
  }

  //sort the list of disabled cells
  disabledCells.sort();

  console.log(disabledCells);

  //lets update the database with the list of disabled cells
  const sorterCellsDB = await db.sorterDisabledCells.findMany();

  //if this is the first time this has ran then the database will be empty, so we need to add all the cells
  if (sorterCellsDB.length === 0) {
    for (let i = 1; i <= 298; i++) {
      await db.sorterDisabledCells.create({
        data: {
          cellNumber: i,
          disabled: false,
          date: new Date(),
          dateChanged: new Date(),
        },
      });
    }
  }

  //for each cell in the database, check if it is in the list of disabled cells and update the database accordingly
  for (let i = 0; i < sorterCellsDB.length; i++) {
    const sorterCellDB = sorterCellsDB[i];
    const cellNumber = sorterCellDB.cellNumber.toString();

    //Cell is disabled in the database but not in the list of disabled cells
    if (sorterCellDB.disabled && !disabledCells.includes(cellNumber)) {
      await db.sorterDisabledCells.update({
        where: {
          id: sorterCellDB.id,
        },
        data: {
          disabled: false,
          dateChanged: new Date(),
        },
      });
    }

    //Cell is not disabled in the database but is in the list of disabled cells
    if (!sorterCellDB.disabled && disabledCells.includes(cellNumber)) {
      await db.sorterDisabledCells.update({
        where: {
          id: sorterCellDB.id,
        },
        data: {
          disabled: true,
          dateChanged: new Date(),
        },
      });
    }
  }
}
