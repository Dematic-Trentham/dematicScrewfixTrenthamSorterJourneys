import db from "./db/db.js";
const cellLog: { disabled: boolean; dateChanged: Date; hasChanged: boolean }[] = [];

export async function checkForDisabledCellsStart() {
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

      cellLog[i - 1] = {
        disabled: false,
        dateChanged: new Date(),
        hasChanged: false,
      };
    }
  }

  //select all the cells from the database and put them in the cellLog
  for (const cell of sorterCellsDB) {
    cellLog[cell.cellNumber - 1] = {
      disabled: cell.disabled,
      dateChanged: cell.dateChanged,
      hasChanged: false,
    };
  }
}

export async function checkForDisabledCells(line: string, i: number, totalLines: number, filePath: string) {
  //does the cell contain a "cell"
  if (!line.includes("cell=")) {
    return;
  }

  //new test
  if (line.includes("<bk_offlver>") && line.includes("disabled cell")) {
    // console.log(`Found disabled cell in line ${i + 1}: ${line}`);

    const time = line.substring(1, 13);

    //turn the time into a date with todays date
    const date = new Date();
    const timeSplit = time.split(":");
    date.setHours(parseInt(timeSplit[0]));
    date.setMinutes(parseInt(timeSplit[1]));
    date.setSeconds(parseInt(timeSplit[2].split(".")[0]));
    date.setMilliseconds(parseInt(timeSplit[2].split(".")[1]));

    //get the cell number
    const cell = parseInt(line.split("cell=")[1].split(" ")[0]);

    if (cell) {
      await updateCell(date, cell, true);
    }
  } else if (line.includes("<offlver_result_free>")) {
    // console.log(`Found free cell in line ${i + 1}: ${line}`);

    const time = line.substring(1, 13);

    //turn the time into a date with todays date
    const date = new Date();
    const timeSplit = time.split(":");
    date.setHours(parseInt(timeSplit[0]));
    date.setMinutes(parseInt(timeSplit[1]));
    date.setSeconds(parseInt(timeSplit[2].split(".")[0]));
    date.setMilliseconds(parseInt(timeSplit[2].split(".")[1]));

    //get the cell number
    const cell = parseInt(line.split("cell=")[1].split(" ")[0]);

    if (cell) {
      await updateCell(date, cell, false);
    }
  }
}

export async function finalizeDisabledCellsCheck() {
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

  // push cellLog to the database
  for (let i = 0; i < cellLog.length; i++) {
    //has the cell changed?
    if (cellLog[i].hasChanged !== true) {
      continue;
    }

    //does this cell exist in the database?
    const cellInDB = await db.sorterDisabledCells.findFirst({
      where: {
        cellNumber: i + 1,
      },
    });

    if (cellInDB) {
      //update the cell in the database
      await db.sorterDisabledCells.update({
        where: {
          id: cellInDB.id,
        },
        data: {
          disabled: cellLog[i].disabled,
          dateChanged: cellLog[i].dateChanged,
          date: new Date(),
        },
      });
    } else {
      //create the cell in the database
      await db.sorterDisabledCells.create({
        data: {
          cellNumber: i + 1,
          disabled: cellLog[i].disabled,
          dateChanged: cellLog[i].dateChanged,
          date: new Date(),
        },
      });
    }

    //make a history log of the disabled cells for this run
    await db.sorterDisabledCellsHistory.create({
      data: {
        cellNumber: i + 1,
        disabled: cellLog[i].disabled,
        dateChanged: cellLog[i].dateChanged,
        date: new Date(),
      },
    });
  }
}

async function updateCell(date: Date, cell: number, disabled: boolean) {
  if (cellLog[cell - 1] == undefined) {
    cellLog[cell - 1] = {
      disabled: disabled,
      dateChanged: date,
      hasChanged: true,
    };
  }

  //has the disabled state changed?
  if (cellLog[cell - 1].disabled !== disabled) {
    cellLog[cell - 1].disabled = disabled;
    cellLog[cell - 1].dateChanged = date;
    cellLog[cell - 1].hasChanged = true;
  }
}
