let DEV_FRAME_RATE = 30;
let currentFilter = "";

let currentFrameGlobal = 0;

let settings = {
    "auto-advance": true,
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
    return clickedPoints[index][trackIndex];
}

function setMousePos(e) {}
function handleKeyboardInput(e) {}

function getOffset(frame, videoObject){
    return offset;
}

function sendNewPoint(event) {
    let newPoint = addNewPoint(event);

    masterCommunicator.postMessage(
        messageCreator("newPoint",
            {
                "point": newPoint,
                "track": trackTracker["currentTrack"],
                "currentFrame": settings["auto-advance"] ? newPoint.frame + 1 : newPoint.frame,
                "videoID": videoID
            }
        )
    )
}

function handleGoToFrame(data) {
    goToFrame(data.frame, videoObjectSingletonFactory(videoID));
}

function handleChangeTrack(data) {
    let track = data.track;
    changeTracks(track, [videoID]);
}

function handleAddTrack(data) {
    trackTracker["tracks"][data.track.index] = data.track.track;
    trackTracker["currentTrack"] = data.track.index;
    clickedPoints[videoID].push([]);
    let track = {track: data.track.index};
    handleChangeTrack(track);
}

function handleChange(message) {
    console.log(message);
    let messageContent = message.data;
    if (messageContent.type === "goToFrame") {
        handleGoToFrame(message.data.data);
    }
    if (messageContent.type === "changeTrack") {
        handleChangeTrack(messageContent.data);
    }
    if (messageContent.type === "addNewTrack") {
        handleAddTrack(messageContent.data);
    }
}

function init_listener(message) {
    communicator.close();
    messageData = message["data"];
    videoSource = messageData["dataURL"];
    settings["autoAdvance"] = messageData["audo-advance"];
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