import { nanoid } from "nanoid";
import "./style.css";
//ice servers
const iceServers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

//initiate peer connection and websocket
// const ws_url = process.env.WS_URL || "ws://localhost:3000";
const ws_url = "ws://localhost:3000";
const pc = new RTCPeerConnection(iceServers);
let ws = new WebSocket(ws_url);

//local and remote stream
let localStream = null;
let remoteStream = null;

// HTML elements
const webcamButton = document.getElementById("webcamButton");
const webcamVideo = document.getElementById("webcamVideo");
const callButton = document.getElementById("callButton");
const callInput = document.getElementById("callInput");
const answerButton = document.getElementById("answerButton");
const remoteVideo = document.getElementById("remoteVideo");
const hangupButton = document.getElementById("hangupButton");

//websocket event listeners
ws.onopen = () => {
  console.log("Connected to the signaling server");
};
ws.onerror = (error) => {
  console.error("WebSocket error:", error);
  setTimeout(() => {
    console.log("Retrying connection...");
    ws = new WebSocket(ws_url);
  }, 5000); // Retry after 5 seconds
};
ws.onclose = () => {
  console.log("Disconnected from signaling server");
};

let candidateQueue = [];

ws.onmessage = async (event) => {
  const message = JSON.parse(event.data);
  switch (message.type) {
    case "answer":
      try {
        console.log("setting remote description");
        await pc.setRemoteDescription(
          new RTCSessionDescription(message.answer)
        );
        console.log("after setting remote description", pc.remoteDescription);
        console.log("applying buffered ICE candidates");
        candidateQueue.forEach(async (candidate) => {
          try {
            await pc.addIceCandidate(candidate);
            console.log("Buffered ICE candidate applied:", candidate);
          } catch (err) {
            console.error("Error applying buffered ICE candidate", err);
          }
        });
        candidateQueue = [];
      } catch (err) {
        console.error("Error adding answer", err);
      }
    case "ice":
      try {
        console.log(
          `Adding ICE candidates
           REMOTE DESC SET(${pc.remoteDescription ? true : false}) 
           CANDIDATE  SET(${message.candidate ? true : false}) 
          `
        );

        const candidate = new RTCIceCandidate(message.candidate);

        if (pc.remoteDescription && message.candidate) {
          await pc.addIceCandidate(candidate);
          console.log("ICE candidate added immediately:", candidate);
        } else if (candidate) {
          // Otherwise, buffer the candidate until remote description is set
          console.log("Remote description not set, buffering ICE candidate");
          candidateQueue.push(candidate);
        } else {
          console.log("Candidate is null");
        }
      } catch (err) {
        console.error("Error adding ICE candidates", err);
      }
      break;
    default:
      console.warn("Unknown message type", message.type);
      break;
  }
};

webcamButton.onclick = async () => {
  //getting permissions
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });

  remoteStream = new MediaStream();
  //add tracks to peer connection
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };
  //displaying local and remote stream
  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

  //frontend changes
  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
};

callButton.onclick = async () => {
  try {
    //generate call id
    const callId = nanoid();
    callInput.value = callId;

    //this will be triggered after creating offer
    pc.onicecandidate = (event) => {
      event.candidate &&
        ws.send(
          JSON.stringify({
            type: "ice",
            callId: callId,
            candidate: event.candidate,
          })
        );
    };

    //createing offer
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);
    ws.send(
      JSON.stringify({
        type: "offer",
        callId: callId,
        offer: { sdp: offerDescription.sdp, type: offerDescription.type },
      })
    );
  } catch (err) {
    console.log(err);
  }
};

const getOffer = async (callId) => {
  try {
    const response = await fetch(
      `http://localhost:3000/offer?call_id=${callId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const { offer } = await response.json();
    return offer;
  } catch (error) {
    alert("Error fetching offer");
    console.error("Error fetching offer:", error);
  }
};

answerButton.onclick = async () => {
  const callId = callInput.value;
  //will be changed to get offer from http not ws
  const offerDescription = await getOffer(callId);

  //this will be triggered after creating answer
  pc.onicecandidate = (event) => {
    event.candidate &&
      ws.send(
        JSON.stringify({
          type: "ice",
          callId: callId,
          candidate: event.candidate,
        })
      );
  };

  //getting offer and creating answer
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));
  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  ws.send(
    JSON.stringify({
      type: "answer",
      callId: callId,
      answer: { sdp: answerDescription.sdp, type: answerDescription.type },
    })
  );
};
