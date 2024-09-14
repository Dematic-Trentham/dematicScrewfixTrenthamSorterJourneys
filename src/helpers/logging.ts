//helper functions for logging in node.js
//Created by James Lyons
//Date 2024-05-27
//Last Modified 2024-05-27

export function devLog(message: string): void {
  //check to see if the environment is development
  if (process.env.DEV) {
    console.log(message);
  }
}
export function devError(message: string): void {
  //check to see if the environment is development
  if (process.env.DEV) {
    console.error("\x1b[31m%s\x1b[0m", message);
  }
}

export function devWarning(message: string): void {
  //check to see if the environment is development
  if (process.env.DEV) {
    console.error("\x1b[33m%s\x1b[0m", message);
  }
}

export function log(message: string): void {
  console.error(message);
}

export function logError(message: any): void {
  console.error("\x1b[31m%s\x1b[0m", message);
}

export function logWarning(message: any): void {
  console.error("\x1b[33m%s\x1b[0m", message);
}
