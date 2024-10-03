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

const pc = new RTCPeerConnection(iceServers);
const ws = new WebSocket("ws://localhost:3000");

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

ws.onclose = () => {
  console.log("Disconnected from signaling server");
};

let receivedOffer = null;

ws.onmessage = async (event) => {
  const message = JSON.parse(event.data);
  // this is temporary, get-offer route will be created to get offer from server
  message.type === "get-offer" && (receivedOffer = message.offer);
  console.log("Message received: ", message);
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
    const callId = Math.random().toString();
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
        offer: { sqp: offerDescription.sdp, type: offerDescription.type },
      })
    );
  } catch (err) {
    console.log(err);
  }
};

//this is temporary, get-offer route will be created to get offer from server
const getOffer = async (callId) => {
  ws.send(
    JSON.stringify({
      type: "get-offer",
      callId: callId,
    })
  );
};
answerButton.onclick = async () => {
  const callId = callInput.value;
  //will be changed to get offer from http not ws
  const offer = await getOffer(callId);

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
  const offerDescription = new RTCSessionDescription(offer);
  await pc.setRemoteDescription(offerDescription);
  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  ws.send(
    JSON.stringify({
      type: "answer",
      callId: callId,
      offer: { sqp: offerDescription.sdp, type: offerDescription.type },
    })
  );
};
