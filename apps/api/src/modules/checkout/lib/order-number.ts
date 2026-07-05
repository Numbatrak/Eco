import { randomInt } from "node:crypto";

// Excludes visually ambiguous characters (0/O, 1/I/L).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const LENGTH = 8;

export function generateOrderNumber(): string {
  let result = "";
  for (let i = 0; i < LENGTH; i++) {
    result += ALPHABET[randomInt(ALPHABET.length)];
  }
  return result;
}
