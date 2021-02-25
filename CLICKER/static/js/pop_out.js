let FRAME_RATE = null;
const COLORS = ["rgb(228, 26, 28)", "rgb(55, 126, 184)", "rgb(77, 175, 74)", "rgb(152, 78, 163)",
    "rgb(255, 127, 0)", "rgb(255, 255, 51)", "rgb(166, 86, 40)", "rgb(247, 129, 191)"];

let frameTracker = {};
let previewBrightness = "brightness(100%)";
let previewContrast = "contrast(100%)";
let previewSaturation = "saturate(100%)";
let previewCOLORSPACE = RGB;
let previewFRAMERATE = 30;
let previewPOINT_SIZE = 1;
let hasContinued = false;
// COLORSPACE MANAGER
let VIDEO_TO_COLORSPACE = {};
let colorspaceToText = (space) => {
    if (space === RGB) {
        return "RGB";
    } else if (space === GREYSCALE) {
        return "Grayscale";
    }
}

// Point Radius Manager
let VIDEO_TO_POINT_SIZE = {};


let locks = {
    "can_click": true,
    "init_frame_loaded": false,
    "resizing_mov": false,
};

// GLOBALS CORRESPONDING TO VIDEO_API
let NUMBER_OF_CAMERAS = 0;

// GLOBALS CORRESPONDING TO LOCAL API
let index = null;
let killSelf = false;
let windowManager = null;
const initCommunicator = new BroadcastChannel("unknown-video");
let initPost = false;


function setup(message) {
    message = message.data;
    console.log(message)

    index = message.index;
    initCommunicator.close();

    // Step 1: Create the window manager.
    windowManager = new PopOutWindowManager(
        message.noOfCameras,
        message.index,
        message.clickedPoints,
        message.currentTracks,
        message.settings
    );

    // This may seem odd to do it this way - otherwise we would have to add a parameter
    // to the constructor of the popout manager that only goes to the clickedpoints manager.
    // that seems just as odd.
    windowManager.clickedPointsManager.setFrameViewOffset(message.frameViewOffset);

    // Step 2 : Globals
    let videoSource = message["dataURL"];
    document.title = message["videoName"];
    FRAME_RATE = message["frameRate"];
    VIDEO_TO_POINT_SIZE = message["pointRadius"];
    clickedPoints = message["clickedPoints"];
    message.videoSettings.frame = message.initFrame;
    message.videoSettings.isEpipolarLocked = message.isEpipolarLocked;
    loadHiddenVideo(videoSource, message.index, () => {
        // Step 3: Load Video
        message.videoSettings.epipolarInfo = message.epipolarInfo;
        windowManager.loadVideoIntoDOM(message.videoSettings);
    });
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
    // return null;
    // Otherwise the user really wants to leave the page
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

