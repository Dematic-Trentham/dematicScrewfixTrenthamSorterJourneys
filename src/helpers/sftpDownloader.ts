//helper functions for downloading from sftp server in node.js
//Created by James Lyons
//Date 2024-05-27
//Last Modified 2024-05-27

import ssh2SftpClient from "ssh2-sftp-client";
import fs from "fs";
import { mainProcessReporter } from "./../index.js";

export type sftpClientSettings = {
  host: string;
  port: number;
  username: string;
  password: string;
};

export async function downloadFileFromSFTPHost(clientSettings: sftpClientSettings, localDownloadPath: string, pathToDownload: string) {
  //console.log(`Downloading ${pathToDownload} to ${localDownloadPath}`);

  //create a new ftp client
  const ftp = new ssh2SftpClient();

  //config for the ftp client

  //connect to the sftp server
  await ftp.connect(clientSettings);

  //download the file to the local machine
  await ftp.get(pathToDownload, localDownloadPath);

  //disconnect from the sftp server
  await ftp.end();
}

export async function getFilesInDirectory(clientSettings: sftpClientSettings, pathToDirectory: string) {
  //create a new ftp client
  const ftp = new ssh2SftpClient();

  //config for the ftp client

  //connect to the sftp server
  await ftp.connect(clientSettings);

  //get the list of files in the directory
  const files = await ftp.list(pathToDirectory);

  //disconnect from the sftp server
  await ftp.end();

  return files;
}

//download all files in a directory
export async function downloadFilesFromSFTPHost(clientSettings: sftpClientSettings, localDownloadPath: string, pathToDownload: string) {
  //get the list of files in the directory
  const files = await getFilesInDirectory(clientSettings, pathToDownload);

  //download each file
  for (const file of files) {
    await downloadFileFromSFTPHost(clientSettings, `${localDownloadPath}/${file.name}`, `${pathToDownload}/${file.name}`);
  }
}

//download all files in a directory, that are not already in the local directory
export async function downloadNewFilesFromSFTPHost(clientSettings: sftpClientSettings, localDownloadPath: string, pathToDownload: string) {
  if (!fs.existsSync("./trace")) {
    fs.mkdirSync("./trace");
  }

  //get the list of files in the directory
  const files = await getFilesInDirectory(clientSettings, pathToDownload);

  const amountOfFiles = files.length;

  //download each file
  for (const file of files) {
    //check if the file already exists
    if (!fs.existsSync(`${localDownloadPath}/${file.name}`)) {
      await downloadFileFromSFTPHost(clientSettings, `${localDownloadPath}/${file.name}`, `${pathToDownload}/${file.name}`);

      console.log(`Downloaded ${file.name}`);

      mainProcessReporter("'Startup' - Downloading existing trace files currently downloading " + files.indexOf(file) + " of " + amountOfFiles);
    }
  }
}
