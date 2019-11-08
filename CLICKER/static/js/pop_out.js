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

let killSelf = false;

let GLOBAL_VIDEO_OBJECT = null;

const communicator = new BroadcastChannel("unknown-video");

let initPost = false;

function setMousePos(e) {
}

function getOffset(frame, videoObject) {
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
    goToFrame(data.frame, GLOBAL_VIDEO_OBJECT);
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

function handleDrawEpipolarLine(data) {
    drawEpipolarLine(data.tmp, GLOBAL_VIDEO_OBJECT);
}

function handleDrawDiamond(data) {
    drawDiamond(data.point1, data.point2, 10, 10, GLOBAL_VIDEO_OBJECT);
}

function handleLoadPoints(data) {
    clearPoints(GLOBAL_VIDEO_OBJECT);
    drawPoints(data.points, GLOBAL_VIDEO_OBJECT);
    drawLines(data.points, GLOBAL_VIDEO_OBJECT);
}

function handleChange(message) {
    let messageContent = message.data;
    if (messageContent.type === "goToFrame") {
        handleGoToFrame(message.data.data);
    }
    else if (messageContent.type === "changeTrack") {
        handleChangeTrack(messageContent.data);
    }
    else if (messageContent.type === "addNewTrack") {
        handleAddTrack(messageContent.data);
    }
    else if (messageContent.type === "drawEpipolarLine") {
        handleDrawEpipolarLine(messageContent.data);
    }
    else if (messageContent.type === "drawDiamond") {
        handleDrawDiamond(messageContent.data);
    }
    else if (messageContent.type === "loadPoints") {
        handleLoadPoints(messageContent.data);
    }
    else if (messageContent.type === "mainWindowDeath") {
        killSelf = true;
        window.close();
    }
}

function afterLoad(initFrame) {

    let currentPoints = getClickedPoints(videoID, trackTracker["currentTrack"]);
    let videoObject = GLOBAL_VIDEO_OBJECT;
    drawPoints(currentPoints, videoObject);
    drawLines(currentPoints, videoObject);
    goToFrame(initFrame, videoObject);
}

function init_listener(message) {
    communicator.close();
    messageData = message["data"];
    videoSource = messageData["dataURL"];
    settings["autoAdvance"] = messageData["audo-advance"];
    dltCoefficents = messageData["dltCoefficents"];
    cameraProfile = messageData["cameraProfile"];
    document.title = messageData["videoTitle"];
    videoID = messageData["videoID"];
    offset = messageData["offset"];
    trackTracker = messageData["currentTracks"];
    let initFrame = messageData["initFrame"];


    GLOBAL_VIDEO_OBJECT = videoObjectSingletonFactory(videoID);


    loadVideosIntoDOM(videoSource, videoID, document.title,
        sendNewPoint, false, {"offset": offset},
        function () { afterLoad(initFrame) });

    clickedPoints = messageData["clickedPoints"];

    masterCommunicator = new BroadcastChannel(`${videoID}`);
    masterCommunicator.onmessage = handleChange;
}

function sendNewFrame(newFrame) {
    masterCommunicator.postMessage(
        messageCreator("newFrame",
            {
                "newFrame": newFrame,
                "videoID": videoID
            }
        )
    );
}


function sendDeathNotification() {
    // This means this window is dying but the webpage is still running.
    if (!killSelf) {
        masterCommunicator.postMessage(messageCreator(
            "popoutDeath",
            {
                "videoID": videoID,
            }
        ));
    }

    // Otherwise the user really wants to leave the page
}

function handleKeyboardInput(e) {
    if (String.fromCharCode(e.which) === "Q") {
        triggerResizeMode();
    } else if (String.fromCharCode(e.which) === "F") {
        moveToNextFrame(GLOBAL_VIDEO_OBJECT);
        sendNewFrame(frameTracker[videoID]);
    } else if (String.fromCharCode(e.which) === "B") {
        if (frameTracker[videoID] < 2) {
            return;
        } else {
            let frameNumber = frameTracker[videoID] - 1;
            goToFrame(frameNumber, GLOBAL_VIDEO_OBJECT);
            sendNewFrame(frameNumber);
        }
    } else if (String.fromCharCode(e.which) === "G") {
                let index = parseInt(e.target.id.split("-")[1], 10);
        let genericModal = $("#generic-input-modal");

        let validate = (_) => {
            let currentFrame = $("#generic-modal-input").val();
            let frameToGoTo = parseInt(currentFrame, 10);
            if (isNaN(frameToGoTo) || frameToGoTo % 1 !== 0) {
                generateError("Frame must be valid integer!");
            } else {
                frameToGoTo += .00001;
                goToFrame(frameToGoTo, videoObjectSingletonFactory(index));
                sendNewFrame(frameToGoTo);
                genericModal.removeClass("is-active");
            }
        };

        let close = (_) => {
            genericModal.removeClass("is-active");
        };


        let label = "What frame would you like to go to?";
        getGenericInput(label, validate, close);
    }
}


$(document).ready(function () {
    communicator.onmessage = init_listener;
    if (!initPost) {
        communicator.postMessage({"state": "ready!"});
    } else {
        initPost = true;
    }
    $(document).off();
    $(window).on('beforeunload', sendDeathNotification);
});

