export function sanitizeLine(line: string): string {
  //removing \r \n from the line
  let sanitizedLine = line.replace(/\r/g, "").replace(/\n/g, "");

  //removing multiple spaces and replacing with single space
  sanitizedLine = sanitizedLine.replace(/\s+/g, " ");
  return sanitizedLine;
}
