let FRAME_RATE = null;
let COLORSPACE = "";
let settings = {"auto-advance": false};
const COLORS = ["rgb(228, 26, 28)", "rgb(55, 126, 184)", "rgb(77, 175, 74)", "rgb(152, 78, 163)",
    "rgb(255, 127, 0)", "rgb(255, 255, 51)", "rgb(166, 86, 40)", "rgb(247, 129, 191)"];

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


// GLOBALS CORRESPONDING TO VIDEO_API
let currentResizable = null;
let clickedPoints = [];
let trackTracker = null;
let NUMBER_OF_CAMERAS = 1;


// GLOBALS CORRESPONDING TO LOCAL API
let masterCommunicator = null;
let index = null;
let killSelf = false;
let video = null;
let windowManager = null;

const initCommunicator = new BroadcastChannel("unknown-video");

let initPost = false;


function getOffset(frame, videoObject) {
    return offset;
}

function sendNewPoint(event) {
    let id = parseInt(event.target.id.split("-")[1], 10);
    let newPoint = Video.createPointObject(id);
    let index = video.addNewPoint(newPoint);

    windowManager.communicatorsManager.communicators[0].communicator.postMessage(
        messageCreator("newPoint",
            {
                "point": newPoint,
                "track": trackTracker["currentTrack"],
                "videoID": id,
                "index": index,
            }
        )
    )
}

function handleGoToFrame(data) {
    video.goToFrame(data.frame);
}

function handleChangeTrack(data) {
    let track = data.track;
    changeTracks(track, [index]);
}

function handleAddTrack(data) {
    trackTracker["tracks"][data.track.index] = data.track.track;
    trackTracker["currentTrack"] = data.track.index;
    clickedPoints[index].push([]);
    let track = {track: data.track.index};
    handleChangeTrack(track);
}

function handleDrawEpipolarLine(data) {
    video.drawEpipolarLine(data.tmp);
}

function handleDrawDiamond(data) {
    video.drawDiamond(data.point1, data.point2, 10, 10);
}

function handleLoadPoints(data) {
    video.clearPoints();
    video.drawPoints(data.points);
    video.drawLines(data.points);
}

function handleColorSpaceChange(data) {
    COLORSPACE = data.colorSpace === RGB ? "grayscale(0%)" : "grayscale(100%)";
    video.loadFrame();
}

function handleSecondaryTrackChange(data) {
    if (data["add"] !== undefined) {
        secondaryTracksTracker.addIndex(data["add"]);
        secondaryTracksTracker.drawTracks();
    } else {
        secondaryTracksTracker.removeIndex(data["remove"]);
        secondaryTracksTracker.drawTracks(true);
    }
}

function handleChange(message) {
    let messageContent = message.data;
    if (messageContent.type === "goToFrame") {
        handleGoToFrame(messageContent.data);
    } else if (messageContent.type === "changeTrack") {
        handleChangeTrack(messageContent.data);
    } else if (messageContent.type === "addNewTrack") {
        handleAddTrack(messageContent.data);
    } else if (messageContent.type === "drawEpipolarLine") {
        handleDrawEpipolarLine(messageContent.data);
    } else if (messageContent.type === "drawDiamond") {
        handleDrawDiamond(messageContent.data);
    } else if (messageContent.type === "updateSecondaryTracks") {
        handleSecondaryTrackChange(messageContent.data);
    } else if (messageContent.type === "loadPoints") {
        handleLoadPoints(messageContent.data);
    } else if (messageContent.type === "changeColorSpace") {
        handleColorSpaceChange(messageContent.data);
    } else if (messageContent.type === "mainWindowDeath") {
        killSelf = true;
        window.close();
    }
}

function afterLoad(initFrame) {
    let currentPoints = getClickedPoints(index, trackTracker["currentTrack"]);
    video = videos[index];
    video.drawPoints(currentPoints);
    video.drawLines(currentPoints);
    video.goToFrame(initFrame);
    masterCommunicator.postMessage(messageCreator("initLoadFinished", {index: index}));
}

function deletePoint() {

}

function setup(message) {
    console.log(message);
    message = message.data;
    initCommunicator.close();

    // Step 1: Create the window manager.
    windowManager = new PopOutWindowManager(
        message.noOfCameras,
        message.index,
        message.clickedPoints,
        message.currentTracks
    );


    let videoSource = message["dataURL"];
    document.title = message["videoName"];
    trackTracker = message["currentTracks"];
    COLORSPACE = message["currentColorSpace"];
    FRAME_RATE = message["frameRate"];
    POINT_RADIUS_TO_VIDEO = message["pointRadius"];
    let offset = message["offset"];
    let initFrame = message["initFrame"];

    index = message["index"];

    clickedPoints = message["clickedPoints"];
    // windowManager = new PopOutWindowManager(3, index, clickedPoints.clickedPoints.clickedPoints);
    let parsed = {
        index: message.index,
        offset: offset,
        frame: initFrame,
        filter: {
            "brightness": "",
            "saturate": "",
            "contrast": ""
        }
    };

    loadHiddenVideo(videoSource, message.index, () => {
    });
    windowManager.loadVideoIntoDOM(parsed);
}

function sendNewFrame(newFrame) {
    this.communicationsManager.updateCommunicators(
        messageCreator("newFrame",
            {
                "frame": newFrame,
                "index": video.index
            }
        )
    );
}


function sendDeathNotification() {
    // This means this window is dying but the webpage is still running.
    if (!killSelf) {
        windowManager.communicatorsManager.communicators[0].communicator.postMessage(messageCreator(
            "popoutDeath",
            {
                "index": index,
            }
        ));
    }
    return null;
    // Otherwise the user really wants to leave the page
}

function handleKeyboardInput(e) {
    if (String.fromCharCode(e.which) === "Q") {
        triggerResizeMode();
    } else if (String.fromCharCode(e.which) === "F") {
        video.moveToNextFrame();
        sendNewFrame(frameTracker[video.index]);
    } else if (String.fromCharCode(e.which) === "B") {
        if (frameTracker[video.index] < 2) {
            return;
        } else {
            let frameNumber = frameTracker[video.index] - 1;
            video.goToFrame(frameNumber);
            sendNewFrame(frameNumber);
        }
    } else if (String.fromCharCode(e.which) === "G") {
        let validate = (input) => {
            let frameToGoTo = parseInt(input, 10);
            if (isNaN(frameToGoTo) || frameToGoTo % 1 !== 0) {
                return {input: null, valid: false};
            } else {
                frameToGoTo += .001;
                return {input: frameToGoTo, valid: true};
            }
        };

        let callback = (parseInput) => {
            video.goToFrame(parseInput);
            sendNewFrame(parseInput);
        };

        let label = "What frame would you like to go to?";
        let errorText = "You must input a valid integer!";
        getGenericStringLikeInput(validate, callback, label, errorText);
    } else if (String.fromCharCode(e.which) === "Z") {
        zoomInZoomWindow(e.target.id.split("-")[1]);
    } else if (String.fromCharCode(e.which) === "X") {
        zoomOutZoomWindow(e.target.id.split("-")[1]);
    }
}


$(document).ready(function () {
    initCommunicator.onmessage = setup;
    if (!initPost) {
        initCommunicator.postMessage({"state": "ready!"});
    } else {
        initPost = true;
    }
    $(document).off();
    $(window).on('beforeunload', sendDeathNotification);
});

