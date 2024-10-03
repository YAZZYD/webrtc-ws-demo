const webSocket = require("ws");
const http = require("http");
//abstraction of redis operations
const redis = require("./redis");
//initialize the server and ws
const server = http.createServer();
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
    //parsing from bytes to json
    const data = JSON.parse(message);
    const { type, callId } = data;

    //switch case to handle different types of messages
    switch (type) {
      case "offer":
        console.log("caching offer");
        await redis.cacheOffer(callId, data.offer);
        break;
      case "ice":
        console.log("caching ice candidates");
        await redis.cacheCandidate(callId, data.candidate);
        break;
      //this will be changed to get offer route
      case "get-offer":
        console.log("getting offer");
        const returned_offer = await redis.getOffer(callId);
        clients.forEach(
          (client) =>
            client === ws &&
            ws.send(
              JSON.stringify({ type: "get-offer", offer: returned_offer })
            )
        );
      case "answer":
        console.log("getting answer");
        // Retrieve offer and candidates
        const offer = await redis.getOffer(callId);
        const candidates = await redis.getCandidates(callId);

        // Send offer and candidates to the answering peer
        if (offer) {
          ws.send(JSON.stringify({ type: "offer", callId, offer }));
        }
        candidates.forEach((candidate) => {
          ws.send(JSON.stringify({ type: "ice", callId, candidate }));
        });

        break;
    }
    //random operations to test the redis cache
    let candidates = await redis.getCandidates(data.callId);
    let offer = await redis.getOffer(data.callId);
    // Broadcast to other clients as before
    clients.forEach((client) => {
      //sending the message to all client even the sender
      //if we want to exclude the sender we can add a condition
      //if(client !== ws)
      if (client.readyState === webSocket.OPEN) {
        client.send(JSON.stringify({ offer: offer, candidates: candidates }));
      }
    });
  });

  ws.on("close", (ip, port) => {
    clients.delete(ws);
    console.log(`client from ${ip}:${port} DISCONNECTED`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
