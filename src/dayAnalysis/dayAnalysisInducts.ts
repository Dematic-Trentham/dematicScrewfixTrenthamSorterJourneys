const folderName = "./trace/today";

import * as fs from "fs";
import * as path from "path";
import { createCanvas, loadImage } from "canvas";

let inductArray = [] as Array<{ induct: string; OFFLV_ANALYZINGPK: Array<{ start: number; middle: number; end: number; total: number }> }>;
let cellArray = [] as Array<{ cell: string; OFFLV_ANALYZINGPK: Array<{ start: number; middle: number; end: number; total: number }> }>;

export async function runDayAnalysisInducts(folderPath: string, outputFolderPath: string) {
  //console.log(`Running day analysis inducts for folder: ${folderPath} and outputting to folder: ${outputFolderPath}`);

  //find all the files in the trace folder
  const files = fs.readdirSync(folderPath);

  let longestJourney = 0;

  let longestJourneyArr = {
    induct: "",
    startTime: "",
    cell: "",
    laps: 0,
    OFFLV_ANALYZINGPK: [] as Array<{ start: number; middle: number; end: number; total: number }>,
    laserLeft: [] as Array<number>,
    laserRight: [] as Array<number>,
    laserMod: 0 as number,
    lines: [] as Array<string>,
  };

  const laserModByInduct = {} as { [key: string]: { avg: number; count: number; values: Array<number>; total: number } };

  //read each file line by line
  files.forEach((file) => {
    const filePath = path.join(folderPath, file);

    //read file to array of lines
    let lines = fs.readFileSync(filePath, "utf-8").split("\n");

    console.log(`Reading file: ${file}`);
    for (let x = 0; x < lines.length; x++) {
      const line = lines[x];

      let lines2 = [] as Array<string>;

      let laps = 0;

      //start of a journey
      if (line != undefined && line.includes("LOADMGM") && line.includes("<test_loadshift> cell")) {
        // console.log(`Found first line: ${line}`);
        lines2.push(line);

        const cellParts = line.split("cell=");
        const cell = cellParts[1]?.split(" ")[0] ?? "";
        //console.log(`Cell: ${cell}`);

        const startTime = line.split("(")[1]?.split(")")[0] ?? "";
        //console.log(`Start Time: ${startTime}`);

        const induct = line.split("LOADMGM ")[1]?.split(":")[0] ?? "";
        //console.log(`Induct: ${induct}`);

        const ul = line.split("c_isc=<")[1]?.split(">")[0] ?? "";

        //read the file until we find the line that contains 'OFFLVER' and '<cellver_parcel_not_on_cell>' and 'cell=x'

        let OFFLV_ANALYZINGPK = [] as Array<{ device: string; start: number; middle: number; end: number; total: number }>;
        OFFLV_ANALYZINGPK = [] as Array<{ device: string; start: number; middle: number; end: number; total: number }>;

        let laserLeft = [] as Array<number>;
        let laserRight = [] as Array<number>;

        for (let y = x + 1; y < lines.length; y++) {
          const nextLine = lines[y];

          if (
            nextLine != undefined &&
            (nextLine.includes("cell=" + cell + " ") || nextLine.includes("Cell=" + cell + " ") || nextLine.includes("CELL=" + cell + " "))
          ) {
            // console.log(`Found line with cell: ${nextLine}`);
            lines2.push(nextLine);

            if (nextLine.includes("<cellver_parcel_on_cell>")) {
              // console.log(`Found line with <cellver_parcel_on_cell>: ${nextLine}`);
              laps = laps + 1;
            }

            if (nextLine.includes("<OFFLV_ANALYZING PK> cell=")) {
              // console.log(`Found line with <OFFLV_ANALYZING PK>: ${nextLine}`);
              //Found line with cell: (01:09:02.466)(07732)OFFLVER 1:<OFFLV_ANALYZING PK> cell=206 <______###########################__> parcel_cnt=27 tick_index=35 => item found
              //Found line with cell: (01:09:02.466)(07732)OFFLVER 1:<OFFLV_ANALYZING PK> cell=206 <______###########################> parcel_cnt=27 tick_index=35 => item found
              //Found line with cell: (01:09:02.466)(07732)OFFLVER 1:<OFFLV_ANALYZING PK> cell=206 <____##########################__> parcel_cnt=27 tick_index=35 => item found
              //count the number of # in the line

              const localLine = nextLine.split("<OFFLV_ANALYZING PK> cell=")[1] ?? "";

              const device = nextLine.split("OFFLVER ")[1]?.split(":")[0] ?? "";
              //console.log(`Found device: ${device} in line: ${nextLine}`);
              //console.log(`Device: ${device}`);

              const hashCount = (localLine.match(/#/g) || []).length;
              //  console.log(`Number of # in the line: ${hashCount}`);
              const middle = Math.floor(hashCount);

              //how many _ before the first #?
              const startB = localLine.indexOf("<") + 1;
              const firstHash = localLine.indexOf("#");
              const start = firstHash - startB;
              // console.log(`Number of _ before the first #: ${start}`);

              //how many _ after the last #?
              const lastHash = localLine.lastIndexOf("#");
              const endB = localLine.indexOf(">") - 1;
              const end = endB - lastHash;
              //console.log(`Number of _ after the last #: ${end}`);

              //total length of the string between < and >
              const totalLength = localLine.indexOf(">") - localLine.indexOf("<") - 1;
              //console.log(`Total length of the string between < and >: ${totalLength}`);

              //if (totalLength === 35) {
              OFFLV_ANALYZINGPK.push({ device, start, middle, end, total: totalLength });

              inductArray.push({ induct, OFFLV_ANALYZINGPK });
              cellArray.push({ cell, OFFLV_ANALYZINGPK });
              // }
            }

            if (nextLine.includes("LASERREC")) {
              // console.log(`Found line with LASERREC: ${nextLine}`);
              const localLine = nextLine.split("LASERREC ")[1] ?? "";

              const laserNumber = localLine.split(":")[0] ?? "";
              //console.log(`Laser Number: ${laserNumber}`);

              //check if the line contains Left or Right

              if (localLine.includes("Left") || localLine.includes("Right")) {
                //:<.._position_compute> Cell=115 Left values cnt=23 min=[358-360-360-361]

                // go to min=[358-360-360-361] and split by - and get the first value which is 358 and push it to the laserLeft array if the line contains Left and push it to the laserRight array if the line contains Right
                const values = localLine.split("min=[")[1]?.split("]")[0] ?? "";

                if (values != "") {
                  const valuesSplit = values.split("-");

                  if (localLine.includes("Left")) {
                    for (let i = 0; i < valuesSplit.length; i++) {
                      const value = parseInt(valuesSplit[i] ?? "");
                      if (!isNaN(value)) {
                        laserLeft.push(value);
                      }
                    }
                  } else if (localLine.includes("Right")) {
                    for (let i = 0; i < valuesSplit.length; i++) {
                      const value = parseInt(valuesSplit[i] ?? "");
                      if (!isNaN(value)) {
                        laserRight.push(value);
                      }
                    }
                  }
                }
              }
            }

            if (nextLine.includes("OFFLVER") && nextLine.includes("<cellver_parcel_not_on_cell>")) {
              // console.log(`Found line with OFFLVER and <cellver_parcel_not_on_cell>: ${nextLine}`);

              //  console.log(`OFFLV_ANALYZINGPK: ${JSON.stringify(OFFLV_ANALYZINGPK)}`);

              //average the laserLeft and laserRight arrays and add it to the object
              let laserLeftAvg = 0;
              let laserRightAvg = 0;
              let laserMod = Infinity;
              if (laserLeft.length > 0 && laserRight.length > 0) {
                if (laserLeft.length > 0) {
                  laserLeftAvg = laserLeft.reduce((a, b) => a + b, 0) / laserLeft.length;
                }

                if (laserRight.length > 0) {
                  laserRightAvg = laserRight.reduce((a, b) => a + b, 0) / laserRight.length;
                }

                //calculate the laserMod which is the left - right
                laserMod = (laserLeftAvg - laserRightAvg) / 2;

                //      console.log("Ul is: " + ul + " induct is: " + induct + " cell is: " + cell + " laserMod is: " + laserMod);

                if (laserModByInduct[induct] == undefined) {
                  laserModByInduct[induct] = { avg: laserMod, count: 1, values: [laserMod], total: laserMod };
                } else {
                  laserModByInduct[induct].count += 1;
                  laserModByInduct[induct].total = laserModByInduct[induct].total + laserMod;
                  laserModByInduct[induct].avg = laserModByInduct[induct].total / laserModByInduct[induct].count;

                  laserModByInduct[induct]?.values.push(laserMod);
                }
              }

              const obj = {
                ul,
                induct,
                cell,
                OFFLV_ANALYZINGPK,
                laserLeft,
                laserRight,
                lines: lines2,
                laps,
                startTime,
                laserMod,
                laserLeftAvg,
                laserRightAvg,
              };

              //console.log(obj);

              if (longestJourney < OFFLV_ANALYZINGPK.length) {
                longestJourney = OFFLV_ANALYZINGPK.length;
                longestJourneyArr = obj;
                //  console.log(`New longest journey found: ${longestJourney} with induct: ${induct} and cell: ${cell}`);
              }

              //write the object to a file called journey with the timestamp - induct - cell - laps as the filename in a folder called journeys

              //check if the journeys folder exists, if not create it
              const journeysFolder = path.join(outputFolderPath, "./journeys");
              if (!fs.existsSync(journeysFolder)) {
                fs.mkdirSync(journeysFolder);
              }

              //console.log("journeysFolder: " + journeysFolder);

              const fileName = `laps ${laps} - ${startTime.replace(/:/g, "-")}_${induct}_${cell}.json`;
              fs.writeFileSync(path.join(journeysFolder, fileName), JSON.stringify(obj, null, 2));

              break;
            }
          }

          //end of file
          if (y == lines.length - 1) {
            //console.log(`Reached end of file without finding line with cell: ${cell}`);
            // console.log(`OFFLV_ANALYZINGPK: ${JSON.stringify(OFFLV_ANALYZINGPK)}`);

            if (OFFLV_ANALYZINGPK.length != 0) {
              //process.exit(1);
            }
          }
        }
      }
    }
    console.log(`Finished reading file: ${file}`);

    console.log(`Laser Mod by Induct so far: ${JSON.stringify(laserModByInduct, null, 2)}`);
  });

  console.log(`Longest Journey: ${longestJourney}`);
  console.log(longestJourneyArr);

  //write the longest journey to a file called longest_journey.json
  fs.writeFileSync(path.join(outputFolderPath, "./longest_journey.json"), JSON.stringify(longestJourneyArr, null, 2));

  // console.log(`Induct Array: ${JSON.stringify(inductArray)}`);
  // console.log(`Cell Array: ${JSON.stringify(cellArray)}`);

  //write the induct array to a file called induct.json
  fs.writeFileSync(path.join(outputFolderPath, "./induct.json"), JSON.stringify(inductArray, null, 2));
  //write the cell array to a file called cell.json
  fs.writeFileSync(path.join(outputFolderPath, "./cell.json"), JSON.stringify(cellArray, null, 2));

  //write to a csv file with the induct, start, middle, end, total as columns
  let csv = "induct,start,middle,end,total\n";
  inductArray.forEach((item) => {
    item.OFFLV_ANALYZINGPK.forEach((pk) => {
      csv += `${item.induct},${pk.start},${pk.middle},${pk.end},${pk.total}\n`;
    });
  });
  fs.writeFileSync(path.join(outputFolderPath, "./induct.csv"), csv);

  //write to a csv file with the cell, start, middle, end, total as columns
  let csv2 = "cell,start,middle,end,total\n";
  cellArray.forEach((item) => {
    item.OFFLV_ANALYZINGPK.forEach((pk) => {
      csv2 += `${item.cell},${pk.start},${pk.middle},${pk.end},${pk.total}\n`;
    });
  });
  fs.writeFileSync(path.join(outputFolderPath, "./cell.csv"), csv2);

  //for each induct calculate the average
  let inductArray2 = {} as { [key: string]: { start: number; middle: number; end: number; total: number; count: number } };
  inductArray.forEach((item) => {
    if (inductArray2[item.induct] == undefined) {
      inductArray2[item.induct] = { start: 0, middle: 0, end: 0, total: 0, count: 0 };
    }
    item.OFFLV_ANALYZINGPK.forEach((pk) => {
      if (inductArray2[item.induct] == undefined) {
        inductArray2[item.induct] = { start: 0, middle: 0, end: 0, total: 0, count: 0 };
      }

      const entry = inductArray2[item.induct];
      if (entry) {
        entry.start += pk.start;
        entry.middle += pk.middle;
        entry.end += pk.end;
        entry.total += pk.total;
        entry.count += 1;
      }
    });
  });

  let newiductArray2 = {} as { [key: string]: { start: number; middle: number; end: number; total: number; count: number } };

  //write the average to a file called induct_average.json
  let inductAverage = [] as Array<{ induct: string; start: number; middle: number; end: number; total: number }>;
  for (const induct in inductArray2) {
    const entry = inductArray2[induct];
    if (entry) {
      inductAverage.push({
        induct,
        start: entry.start / entry.count,
        middle: entry.middle / entry.count,
        end: entry.end / entry.count,
        total: entry.total / entry.count,
      });

      newiductArray2[induct] = {
        start: entry.start / entry.count,
        middle: entry.middle / entry.count,
        end: entry.end / entry.count,
        total: entry.total / entry.count,
        count: entry.count,
      };
    }
  }
  fs.writeFileSync(path.join(outputFolderPath, "./induct_average.json"), JSON.stringify(inductAverage, null, 2));

  //for each cell calculate the average
  let cellArray2 = {} as { [key: string]: { start: number; middle: number; end: number; total: number; count: number } };
  cellArray.forEach((item) => {
    if (cellArray2[item.cell] == undefined) {
      cellArray2[item.cell] = { start: 0, middle: 0, end: 0, total: 0, count: 0 };
    }
    item.OFFLV_ANALYZINGPK.forEach((pk) => {
      if (cellArray2[item.cell] == undefined) {
        cellArray2[item.cell] = { start: 0, middle: 0, end: 0, total: 0, count: 0 };
      }
      const cell = cellArray2[item.cell];
      if (cell) {
        cell.start += pk.start;
        cell.middle += pk.middle;
        cell.end += pk.end;
        cell.total += pk.total;
        cell.count += 1;
      }
    });
  });

  //write the average to a file called cell_average.json
  let cellAverage = [] as Array<{ cell: string; start: number; middle: number; end: number; total: number }>;
  for (const cell in cellArray2) {
    const cellData = cellArray2[cell];
    if (cellData) {
      cellAverage.push({
        cell,
        start: cellData.start / cellData.count,
        middle: cellData.middle / cellData.count,
        end: cellData.end / cellData.count,
        total: cellData.total / cellData.count,
      });
    }
  }
  fs.writeFileSync(path.join(outputFolderPath, "/cell_average.json"), JSON.stringify(cellAverage, null, 2));

  let laserModByInduct2 = [] as Array<{ induct: string; avg: number; count: number; total: number }>;
  for (const induct in laserModByInduct) {
    const laserData = laserModByInduct[induct];
    if (laserData) {
      laserModByInduct2.push({
        induct,
        avg: laserData.avg,
        count: laserData.count,
        total: laserData.total,
      });
    }
  }

  console.log(`Laser Mod by Induct: ${JSON.stringify(laserModByInduct2, null, 2)}`);
  //write the laserModByInduct to a file called laser_mod_by_induct.json
  fs.writeFileSync(path.join(outputFolderPath, "./laser_mod_by_induct.json"), JSON.stringify(laserModByInduct2, null, 2));

  for (const induct in laserModByInduct) {
    const laser = laserModByInduct[induct];

    const inductData = newiductArray2[induct];

    createInductImage(induct, inductData?.start ?? 0, inductData?.middle ?? 0, inductData?.end ?? 0, laser?.avg ?? 0, outputFolderPath);
  }
}

function createInductImage(induct: string, front: number, middle: number, end: number, laserAvg: number, outputFolderPath: string) {
  const width = 1000;
  const height = 1400;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  //background white
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, width, height);

  //write the induct name on the top of the canvas
  ctx.fillStyle = "black";
  ctx.font = "30px Arial";
  ctx.fillText(induct, 400, 50);

  //arrow at bottom of cavas pointing to the right with the text direction of travel
  ctx.strokeStyle = "black";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 200, height - 100);
  ctx.lineTo(width / 2 + 200, height - 100);
  ctx.stroke();
  // Draw arrow head
  const bottomEndX = width / 2 + 200;
  const bottomEndY = height - 100;
  const bottomStartX = width / 2 - 200;
  const bottomStartY = height - 100;
  const bottomHeadlen = 20;
  const bottomAngle = Math.atan2(bottomEndY - bottomStartY, bottomEndX - bottomStartX);

  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.moveTo(bottomEndX, bottomEndY);
  ctx.lineTo(bottomEndX - bottomHeadlen * Math.cos(bottomAngle - Math.PI / 6), bottomEndY - bottomHeadlen * Math.sin(bottomAngle - Math.PI / 6));
  ctx.lineTo(bottomEndX - bottomHeadlen * Math.cos(bottomAngle + Math.PI / 6), bottomEndY - bottomHeadlen * Math.sin(bottomAngle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.font = "20px Arial";
  ctx.fillText("Direction of Travel", width / 2 - 90, height - 80);

  //make a black rectangle in the middle of the canvas with the size of 690x860
  ctx.fillStyle = "black";
  const cellWidth = 690;
  const cellHeight = 860;
  const rectX = (width - cellWidth) / 2;
  const rectY = (height - cellHeight) / 2;
  ctx.fillRect(rectX, rectY, cellWidth, cellHeight);

  //crossheir in the middle of the canvas
  ctx.strokeStyle = "grey";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2, rectY);
  ctx.lineTo(width / 2, rectY + cellHeight);
  ctx.moveTo(rectX, height / 2);
  ctx.lineTo(rectX + cellWidth, height / 2);
  ctx.stroke();

  //box is 600 by 450

  // postion top to  bottom with left and right

  ctx.fillStyle = "#8B7355";

  const boxWidth = 450;
  const boxHeight = 600;

  const freeSpace = cellWidth - boxWidth; //240

  //ratio of front to end
  const frontRatio = front / (front + end);
  const endRatio = end / (front + end);
  //console.log(`Front Ratio: ${frontRatio}, End Ratio: ${endRatio}`);
  const offset = (endRatio - frontRatio) * freeSpace;

  const leftX = (width - boxWidth) / 2 + offset / 2; //move left if front is higher, right if end is higher
  const topY = (height - boxHeight) / 2 + laserAvg;

  ctx.fillRect(leftX, topY, boxWidth, boxHeight);

  //make a box 10 pixels smaller than the previous box and darker
  ctx.fillStyle = "#5C4033";
  const boxWidth2 = boxWidth - 20;
  const boxHeight2 = boxHeight - 20;
  const leftX2 = leftX + 10;
  const topY2 = topY + 10;
  ctx.fillRect(leftX2, topY2, boxWidth2, boxHeight2);

  //draw a arrow from the middle of the box to the middle of the canvas
  ctx.strokeStyle = "red";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(leftX + boxWidth / 2, topY + boxHeight / 2);
  ctx.lineTo(width / 2, height / 2);
  ctx.stroke();

  // Draw arrow head
  const endX = width / 2;
  const endY = height / 2;
  const startX = leftX + boxWidth / 2;
  const startY = topY + boxHeight / 2;
  const headlen = 20;
  const angle = Math.atan2(endY - startY, endX - startX);

  ctx.fillStyle = "red";
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - headlen * Math.cos(angle - Math.PI / 6), endY - headlen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(endX - headlen * Math.cos(angle + Math.PI / 6), endY - headlen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();

  const buffer = canvas.toBuffer("image/png");
  //make a folder called induct_images if it doesn't exist
  const inductImagesFolder = path.join(outputFolderPath, "./induct_images");

  if (!fs.existsSync(inductImagesFolder)) {
    fs.mkdirSync(inductImagesFolder, { recursive: true });
  }

  fs.writeFileSync(path.join(inductImagesFolder, `induct_${induct}.png`), buffer);
}
