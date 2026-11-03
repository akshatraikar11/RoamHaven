const crypto = require("crypto");
const { createClient } = require("redis");

const REDIS_URL = process.env.REDIS_URL;
const memoryStore = new Map();
const memoryVersions = new Map();

let redisClient = null;
let redisReady = false;

async function initCache() {
  if (!REDIS_URL || redisClient) return;

  try {
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on("error", (err) => {
      redisReady = false;
      console.warn("Redis cache disabled:", err.message);
    });
    redisClient.on("ready", () => {
      redisReady = true;
      console.log("Redis cache connected");
    });
    await redisClient.connect();
    redisReady = true;
  } catch (err) {
    redisClient = null;
    redisReady = false;
    console.warn("Falling back to in-memory cache:", err.message);
  }
}

function makeHashedKey(prefix, raw) {
  const hash = crypto.createHash("sha1").update(raw).digest("hex");
  return `${prefix}:${hash}`;
}

async function getNamespaceVersion(namespace) {
  if (redisReady && redisClient) {
    const key = `cache:version:${namespace}`;
    const value = await redisClient.get(key);
    if (!value) {
      await redisClient.set(key, "1");
      return 1;
    }
    return Number(value);
  }

  if (!memoryVersions.has(namespace)) memoryVersions.set(namespace, 1);
  return memoryVersions.get(namespace);
}

async function bumpNamespaceVersion(namespace) {
  if (redisReady && redisClient) {
    const key = `cache:version:${namespace}`;
    const value = await redisClient.incr(key);
    return Number(value);
  }

  const nextValue = (memoryVersions.get(namespace) || 1) + 1;
  memoryVersions.set(namespace, nextValue);
  return nextValue;
}

async function getJSON(key) {
  if (redisReady && redisClient) {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  }

  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

async function setJSON(key, value, ttlSeconds = 60) {
  if (redisReady && redisClient) {
    await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
    return;
  }

  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

module.exports = {
  initCache,
  makeHashedKey,
  getNamespaceVersion,
  bumpNamespaceVersion,
  getJSON,
  setJSON,
};

