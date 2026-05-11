// This file is responsible for running the day analysis, which includes various analyses such as inducts, etc.

import { runDayAnalysisInducts } from "./dayAnalysisInducts.js";

import fs from "fs";

export async function runYesterdayDayAnalysis() {
  console.log("Running day analysis");

  const folderPath = "./trace/1dayago";

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateString = yesterday.toISOString().split("T")[0];

  const outputFolderPath = "./trace/output/" + dateString;

  fs.mkdirSync(outputFolderPath, { recursive: true });

  await runDayAnalysisInducts(folderPath, outputFolderPath);
}

export async function runTodayDayAnalysis() {
  console.log("Running day analysis");

  const folderPath = "./trace/today";

  const today = new Date();
  const dateString = today.toISOString().split("T")[0];

  const outputFolderPath = ".trace/output/" + dateString;

  fs.mkdirSync(outputFolderPath, { recursive: true });

  await runDayAnalysisInducts(folderPath, outputFolderPath);
}
