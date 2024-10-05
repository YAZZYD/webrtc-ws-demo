const Redis = require("redis");

const redis = Redis.createClient({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
});

const CACHE_EXPIRATION = 300;

redis.on("error", (err) => {
  console.log("Redis error: ", err);
});

// Connect to Redis
redis.connect().catch(console.error);

/**
##################################################
##########          OFFER         ################
##################################################
 * */

const cacheOffer = async (callId, offer) => {
  const key = `offer:${callId}`;
  await redis.set(key, JSON.stringify(offer), {
    EX: CACHE_EXPIRATION,
  });
};

const getOffer = async (callId) => {
  const key = `offer:${callId}`;
  const offer = await redis.get(key);
  return offer ? JSON.parse(offer) : null;
};
/**
##################################################
##########          CANDIDATES    ################
##################################################
 **/

const cacheCandidate = async (callId, candidate) => {
  const key = `candidate:${callId}`;
  let candidates = JSON.parse((await redis.get(key)) || "[]");
  candidates.push(candidate);
  await redis.set(key, JSON.stringify(candidates), {
    EX: CACHE_EXPIRATION,
  });
};

const getCandidates = async (callId) => {
  const key = `candidate:${callId}`;
  const candidates = await redis.get(key);
  return candidates ? JSON.parse(candidates) : [];
};

/**
##################################################
##########          ANSWER        ################
##################################################
 **/

const cacheAnswer = async (callId, answer) => {
  const key = `answer:${callId}`;
  await redis.set(key, JSON.stringify(answer), {
    EX: CACHE_EXPIRATION,
  });
};

const getAnswer = async (callId) => {
  const key = `answer:${callId}`;
  const offer = await redis.get(key);
  return offer ? JSON.parse(offer) : null;
};

module.exports = {
  cacheOffer,
  cacheCandidate,
  cacheAnswer,
  getOffer,
  getCandidates,
  getAnswer,
};
