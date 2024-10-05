const webSocket = require("ws");
//abstraction of redis operations
const redis = require("./redis");
//initialize the server and ws
const { server } = require("./http");
const wss = new webSocket.Server({ server });

// Set to store all connected clients
const clients = new Set();

wss.on("connection", (ws, req) => {
  //getting the ip and port of the client
  const ip = req.socket.remoteAddress;
  const port = req.socket.remotePort;
  //adding the client to the set, used to broadcast messages
  clients.add(ws);
  console.log(`new client connected from ${ip}:${port}`);

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);
      const { type, callId } = data;

      switch (type) {
        case "offer":
          console.log("caching offer");
          await redis.cacheOffer(callId, data.offer);
          break;
        case "ice":
          console.log("caching ice candidates");
          await redis.cacheCandidate(callId, data.candidate);
          clients.forEach((client) => {
            if (client !== ws && client.readyState === webSocket.OPEN) {
              client.send(JSON.stringify(data));
            }
          });
          break;
        case "answer":
          console.log("getting answer");
          await redis.cacheAnswer(callId, data.answer);
          console.log(data);
          clients.forEach((client) => {
            if (client !== ws && client.readyState === webSocket.OPEN) {
              client.send(JSON.stringify(data));
            }
          });
          break;
        default:
          console.warn(`Unknown message type: ${type}`);
          break;
      }
    } catch (error) {
      console.error(`Error handling message: ${error.message}`);
      ws.send(
        JSON.stringify({ error: "Invalid message format or internal error" })
      );
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`Client disconnected. Ready state: ${ws.readyState}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
