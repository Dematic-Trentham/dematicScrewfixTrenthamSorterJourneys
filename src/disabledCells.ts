import * as fs from "fs";
import db from "./db/db.js";

export async function checkForDisabledCells(path: string) {
  console.log(`Checking for disabled cells in ${path}`);

  //read the file
  const fileContents = await fs.promises.readFile(path, "utf-8");

  //read the file line by line
  const lines = fileContents.split("\n");

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

  //cell 0 is always disabled but the sorter does not have a cell 0, this will the last update timestamp for this function
  //do we need to add a cell 0 to the database?
  const cell0 = await db.sorterDisabledCells.findFirst({
    where: {
      cellNumber: 0,
    },
  });

  if (!cell0) {
    await db.sorterDisabledCells.create({
      data: {
        cellNumber: 0,
        disabled: true,
        date: new Date(),
        dateChanged: new Date(),
      },
    });
  } else {
    await db.sorterDisabledCells.update({
      where: {
        id: cell0.id,
      },
      data: {
        dateChanged: new Date(),
      },
    });
  }

  //loop through the lines and update the database
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].split("\n");

    //does the line contain "DEVICE = 2," and "DEVICE DISABLED" or "DEVICE ENABLED"?
    if (line[0].includes("DEVICE =  2, ")) {
      //time is the first part of the line "(hh:mm:ss.mmm)"
      const time = line[0].substring(1, 13);

      //turn the time into a date with todays date
      const date = new Date();
      const timeSplit = time.split(":");
      date.setHours(parseInt(timeSplit[0]));
      date.setMinutes(parseInt(timeSplit[1]));
      date.setSeconds(parseInt(timeSplit[2]));
      date.setMilliseconds(parseInt(timeSplit[3]));

      //get the cell number "ID_Device = xxx,"
      const cell = parseInt(line[0].split("ID_Device = ")[1].split(",")[0]);

      //is the cell disabled or enabled?
      const disabled = line[0].includes("DEVICE DISABLED");
      const enabled = line[0].includes("DEVICE ENABLED");

      if (disabled) {
        console.log(`Cell ${cell} is disabled`);
        await updateCell(date, cell, true);
      } else if (enabled) {
        console.log(`Cell ${cell} is enabled`);
        await updateCell(date, cell, false);
      }
    }
  }

  console.log("Finished checking for disabled cells");
}

async function updateCell(date: Date, cell: number, disabled: boolean) {
  console.log(`Updating cell ${cell} to ${disabled} at ${date}`);

  const cellDB = await db.sorterDisabledCells.findFirst({
    where: {
      cellNumber: cell,
    },
  });

  //if the cell is already in the database then update it
  if (cellDB) {
    await db.sorterDisabledCells.update({
      where: {
        id: cellDB.id,
      },
      data: {
        disabled: disabled,
        dateChanged: date,
      },
    });
  } else {
    await db.sorterDisabledCells.create({
      data: {
        cellNumber: cell,
        disabled: disabled,
        date: date,
        dateChanged: date,
      },
    });
  }

  // make history of changes
  await db.sorterDisabledCellsHistory.create({
    data: {
      cellNumber: cell,
      disabled: disabled,
      date: date,
      dateChanged: date,
    },
  });
}
