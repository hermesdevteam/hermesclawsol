import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "verified-users.json");

interface VerifiedUser {
  wallet: string;
  verifiedAt: string;
  chatId: string;
  inviteSent?: boolean;
}

type Store = Record<string, VerifiedUser>;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load(): Store {
  ensureDir();
  if (!fs.existsSync(STORE_PATH)) return {};
  return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
}

function save(data: Store) {
  ensureDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

export function getUser(telegramUserId: string | number): VerifiedUser | null {
  const data = load();
  return data[String(telegramUserId)] || null;
}

export function setUser(telegramUserId: string | number, wallet: string, chatId: string) {
  const data = load();
  data[String(telegramUserId)] = {
    wallet,
    verifiedAt: new Date().toISOString(),
    chatId,
  };
  save(data);
}

export function removeUser(telegramUserId: string | number) {
  const data = load();
  delete data[String(telegramUserId)];
  save(data);
}

export function getAllUsers(): Store {
  return load();
}

export function markInviteSent(telegramUserId: string | number) {
  const data = load();
  if (data[String(telegramUserId)]) {
    data[String(telegramUserId)].inviteSent = true;
    save(data);
  }
}
