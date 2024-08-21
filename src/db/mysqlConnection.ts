//Service for Dematic Dashboard Screwfix trentham to collect data
//Created by: JWL
//Date: 2022-12-30
//Last modified: 2023/08/05 18:25:18
//Version: 0.0.1

import * as mysql from "mysql";
import fs from "fs";

const requiredEnvVariables = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_DATABASE"];

// Validate environment variables
const missingEnvVariables = requiredEnvVariables.filter((variable) => !process.env[variable]);

//is docker
if (isDocker()) {
  if (missingEnvVariables.length > 0) {
    throw new Error(`The following required environment variables are missing: ${missingEnvVariables.join(", ")}`);
  }
} else {
  console.log("Not Docker - using local config for db");
}

const pool = mysql.createPool({
  connectionLimit: 5,
  host: process.env.DB_HOST || "10.4.5.227",
  user: process.env.DB_USER || "nodeUser",
  password: process.env.DB_PASSWORD || "nodeuser",
  database: process.env.DB_DATABASE || "dematic_dashboard",
  debug: false,
});

console.log("DB Connection Pool Created");

//function to query the DB
export function query(sql: any, args?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    pool.query(sql, args, (err: any, rows: any) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function isDocker() {
  try {
    return fs.existsSync("/proc/self/cgroup");
  } catch (err) {
    return false;
  }
}

function escapedInput(userInput: string) {
  return mysql.escape(userInput);
}
function escapedInputNoQuotes(userInput: string) {
  return mysql.escape(userInput).replace(/'/g, "");
}

function sanitizeInput(userInput: string) {
  return userInput.replace(/\\/g, "").replace(/\\n/g, "");
}

function allInput(userInput: string) {
  return mysql.escape(userInput).replace(/'/g, "").replace(/\\/g, "").replace(/\\n/g, "");
}

//export the functions
export default {
  query,
};
