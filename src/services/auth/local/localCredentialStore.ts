import { developmentUsers } from "../../../database/seeds/userSeed";
import { derivePasswordBytes, hasWebCrypto } from "./passwordKdf";

const CREDENTIAL_KEY = "coop_sys_local_credentials";
const USER_KEY = "coop_sys_user_access";
const ITERATIONS = 210_000;
const LAN_FALLBACK_ITERATIONS = 60_000;
export const DEVELOPMENT_TEMPORARY_PASSWORD = "ChangeMe123!";
let initializationPromise: Promise<void> | null = null;

type LocalCredential = {
  userId: string;
  salt: string;
  hash: string;
  iterations: number;
  mustChangePassword: boolean;
};

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function readCredentials(): LocalCredential[] {
  const raw = localStorage.getItem(CREDENTIAL_KEY);
  return raw ? JSON.parse(raw) as LocalCredential[] : [];
}

function writeCredentials(credentials: LocalCredential[]) {
  localStorage.setItem(CREDENTIAL_KEY, JSON.stringify(credentials));
}

export async function setLocalCredential(userId: string, password: string, mustChangePassword: boolean) {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iterations = hasWebCrypto() ? ITERATIONS : LAN_FALLBACK_ITERATIONS;
  const hash = await derivePasswordBytes(password, salt, iterations);
  const credential: LocalCredential = { userId, salt: bytesToBase64(salt), hash: bytesToBase64(hash), iterations, mustChangePassword };
  writeCredentials([...readCredentials().filter((item) => item.userId !== userId), credential]);
}

async function initializeDevelopmentCredentials() {
  if (!localStorage.getItem(USER_KEY)) localStorage.setItem(USER_KEY, JSON.stringify(developmentUsers));
  const credentials = readCredentials();
  const configuredUserIds = new Set(credentials.map((credential) => credential.userId));
  const missingUsers = developmentUsers.filter((item) => !configuredUserIds.has(item.id));
  if (!missingUsers.length) return;
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iterations = hasWebCrypto() ? ITERATIONS : LAN_FALLBACK_ITERATIONS;
  const hash = await derivePasswordBytes(DEVELOPMENT_TEMPORARY_PASSWORD, salt, iterations);
  const shared = { salt: bytesToBase64(salt), hash: bytesToBase64(hash), iterations, mustChangePassword: true };
  writeCredentials([...credentials, ...missingUsers.map((user) => ({ userId: user.id, ...shared }))]);
}

export function ensureDevelopmentCredentials() {
  initializationPromise ??= initializeDevelopmentCredentials();
  return initializationPromise;
}

export async function verifyLocalCredential(userId: string, password: string) {
  const credential = readCredentials().find((item) => item.userId === userId);
  if (!credential) return null;
  const actual = await derivePasswordBytes(password, base64ToBytes(credential.salt), credential.iterations);
  const expected = base64ToBytes(credential.hash);
  if (actual.length !== expected.length) return null;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0 ? credential : null;
}

export function localCredentialFor(userId: string) {
  return readCredentials().find((item) => item.userId === userId) ?? null;
}
