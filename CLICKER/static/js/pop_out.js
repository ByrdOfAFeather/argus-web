let DEV_FRAME_RATE = 30;
let currentFilter = "";

let currentFrameGlobal = 0;

let settings = {
    "auto-advance": true,
    "sync": true
};

let mouseTracker = {
    x: 0,
    y: 0,
};
let frameTracker = {};

let locks = {
    "can_click": true,
    "init_frame_loaded": false,
    "resizing_mov": false,
};

let currentResizable = null;
let clickedPoints = [];
let trackTracker = null;
let numberOfCameras = 1;
let masterCommunicator = null;
let messageData = null;
let videoSource = null;
let dltCoefficents = null;
let cameraProfile = null;
let videoID = null;
let offset = 0;

const communicator = new BroadcastChannel("unknown-video");

let initPost = false;

function messageCreator(type, data) {
    return {"type": type, "data": data};
}

function changeHandler() {}

function getClickedPoints(index, trackIndex) {
    return clickedPoints[trackIndex];
}

function setMousePos(e) {}
function handleKeyboardInput(e) {}

function getOffset(frame, videoObject){
    return offset;
}

function sendNewPoint(event) {
    addNewPoint(event);

    masterCommunicator.postMessage(
        messageCreator("newPoint",
            {
                "point": clickedPoints[clickedPoints.length - 1],
                "track": trackTracker["currentTrack"],
                "videoID": videoID
            }
        )
    )
}

function handleChange(message) {

}

function init_listener(message) {
    communicator.close();
    messageData = message["data"];
    videoSource = messageData["dataURL"];
    // clickedPoints = messageData["clickedPoints"];
    dltCoefficents = messageData["dltCoefficents"];
    cameraProfile = messageData["cameraProfile"];
    document.title = messageData["videoTitle"];
    videoID = messageData["videoID"];
    offset = messageData["offset"];
    trackTracker = messageData["currentTracks"];

    console.log(message);
    loadVideosIntoDOM(videoSource, videoID, document.title,
        sendNewPoint, false, {"offset": offset});
    masterCommunicator = new BroadcastChannel(`${videoID}`);
    masterCommunicator.onmessage = handleChange;
}


$(document).ready(function () {
    communicator.onmessage = init_listener;
    if (!initPost) {
        communicator.postMessage({"state": "ready!"});
    } else {
        initPost = true;
    }
    $(document).off();
});