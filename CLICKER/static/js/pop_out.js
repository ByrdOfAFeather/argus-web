let COLORS = ["rgb(228, 26, 28)", "rgb(55, 126, 184)", "rgb(77, 175, 74)", "rgb(152, 78, 163)",
    "rgb(255, 127, 0)", "rgb(255, 255, 51)", "rgb(166, 86, 40)", "rgb(247, 129, 191)"];
let colorIndex = 0;

let PINHOLE = 1;

let LINETYPE_EPIPOLAR = 1;
let LINETYPE_POINT_TO_POINT = 2;

let DEV_FRAME_RATE = 30;
let CAMERA_PROFILE = null;
let DLT_COEFFICIENTS = null;

let RGB = 0;
let GREYSCALE = 1;
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
let trackTracker = [];


let masterCommunicator = null;
let messageData = null;
let videoSource = null;
let clickedPoints = null;
let dltCoefficents = null;
let cameraProfile = null;
let videoID = null;
let globalVideoObject = {}
const communicator = new BroadcastChannel("unknown-video");

let initPost = false;

function changeHandler() {

}

function addNewPoint(event) {
}

function setMousePos() {
    if (e.target.id.startsWith("canvas")) {
        currentResizable = e.target;
    } else {
        e.target = currentResizable;
    }

    if (!locks["resizing_mov"]) {
        // Source : https://stackoverflow.com/a/17130415
        let bounds = e.target.getBoundingClientRect();
        let scaleX = e.target.width / bounds.width;   // relationship bitmap vs. element for X
        let scaleY = e.target.height / bounds.height;

        mouseTracker.x = (e.clientX - bounds.left) * scaleX;   // scale mouse coordinates after they have
        mouseTracker.y = (e.clientY - bounds.top) * scaleY;
        // drawZoomWindow(videoObject);
    } else {
        let bounds = e.target.getBoundingClientRect();

        mouseTracker.x = e.clientX - bounds.left;
        mouseTracker.y = e.clientY - bounds.top;
        let currentClickCanvas = $(e.target);

        currentClickCanvas.css("height", mouseTracker.y);
        currentClickCanvas.css("width", mouseTracker.x);

        let currentVideoCanvas = $(`#videoCanvas-${e.target.id.split("-")[1]}`);

        currentVideoCanvas.css("height", mouseTracker.y);
        currentVideoCanvas.css("width", mouseTracker.x);

        let currenEpipolarCanvas = $(`#epipolarCanvas-${e.target.id.split("-")[1]}`);
        currenEpipolarCanvas.css("height", mouseTracker.y);
        currenEpipolarCanvas.css("width", mouseTracker.x);

    }
}


function init_listener(message) {
    communicator.close();
    messageData = message["data"];
    videoSource = messageData["dataURL"];
    clickedPoints = messageData["clickedPoints"];
    dltCoefficents = messageData["dltCoefficents"];
    cameraProfile = messageData["cameraProfile"];
    document.title = messageData["videoTitle"];
    videoID = messageData["videoID"];

    loadVideosIntoDOM(videoSource, videoID, document.title);
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