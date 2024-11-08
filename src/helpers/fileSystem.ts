//helper functions for file system operations in node.js
//Created by James Lyons
//Date 2024-05-27
//Last Modified 2024-05-27

import fs from "fs/promises";
import fsNormal, { stat } from "fs";
import path from "path";
import readline from "readline";

import { devLog, devError, log, logError } from "./logging.js";
import { updateStatusStep } from "./../runAnalysisOnRequestedUL.js";
import { request } from "https";

export async function checkIfFolderExists(path: string): Promise<boolean> {
  try {
    const stats = await fsNormal.promises.stat(path);
    return stats.isDirectory();
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return false; // Folder does not exist
    } else {
      throw error; // Other error occurred (e.g., permission issues)
    }
  }
}

export async function removeAFolder(localPath: string): Promise<void> {
  try {
    const files = await fs.readdir(localPath);

    if (files.length > 0) {
      for (const file of files) {
        const filePath = path.join(localPath, file);
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
          await removeAFolder(filePath); // Recursively remove subdirectories
        } else {
          await fs.unlink(filePath); // Delete files
        }
      }
    }

    await fs.rmdir(localPath); // Remove the empty directory or the directory with only subdirectories
    devLog("Directory removed successfully!");
  } catch (err) {
    logError("Error while removing directory:");
    throw err;
  }
}

export async function removeAFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
    console.log("File removed successfully!");
  } catch (err) {
    console.error("Error while removing file:", err);
    throw err;
  }
}

export async function mergeTraceFilesIntoArray(localPath: string, requestID?: string): Promise<string[]> {
  log("Merging trace files " + localPath);

  //does the folder exist
  const folderExists = await checkIfFolderExists(localPath);

  //if the folder does not exist then throw an error
  if (!folderExists) {
    throw new Error("Merging trace files - Folder does not exist");
  }

  //get the list of files in the folder
  let fileList = await fs.readdir(localPath);

  //if there are no files in the folder then throw an error
  if (fileList.length === 0) {
    throw new Error("Merging trace files - No files in the folder");
  }

  //create an array to hold the file contents
  let fileContents: string[] = [];

  //loop through the files
  for (const file of fileList) {
    if (requestID) {
      await updateStatusStep(requestID, `Merging Trace Files Into Array Reading file: ${file} - in folder: ${localPath}`);
    }
    //create a read stream for the file
    const fileStream = fsNormal.createReadStream(`${localPath}/${file}`, { encoding: "utf-8" });

    //create an interface to read the file line by line

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    //for each line in the file
    for await (const line of rl) {
      //if the line is not empty
      if (line.trim() !== "") {
        //add the line to the file contents array
        fileContents.push(line);
      }
    }

    devLog(`Finished reading file: ${file}`);
  }

  return fileContents;
}
