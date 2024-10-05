const http = require("http");
const url = require("url");
const redis = require("./redis");

/**
##################################################
##########          HANDLER       ################
##################################################
 **/
const getOffer = async (req, res, params) => {
  const { call_id } = params;
  if (!call_id) return res.status(400).json({ error: "CallId is required" });
  try {
    const offer = await redis.getOffer(call_id);
    //
    if (offer) {
      res.writeHead(200);
      res.end(JSON.stringify({ offer: offer }));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Offer not found" }));
    }
  } catch (error) {
    console.error(`Error retrieving offer for callId ${call_id}:`, error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: "Internal Server Error" }));
  }
};

/**
##################################################
##########       HTTP SERVE       ################
##################################################
 **/
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  const path = parsedUrl.pathname;

  res.setHeader("Access-Control-Allow-Origin", "*"); // Allow all origins
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET") {
    switch (path) {
      case "/":
        res.writeHead(200);
        res.end(JSON.stringify({ message: "Base" }));
        break;
      case "/offer":
        const params = parsedUrl.query;
        getOffer(req, res, params);
        break;
      default:
        res.writeHead(404);
        res.end(JSON.stringify({ error: "Not Found" }));
        break;
    }
  } else {
    res.writeHead(405);
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
  }
});

module.exports = { server };
