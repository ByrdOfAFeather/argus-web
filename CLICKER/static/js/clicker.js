// TODO: Investigate getting frame rate manually
// TODO: Display Error:
/*
Media resource blob:http://127.0.0.1:5000/951b0a32-14df-4288-b3e5-cb0a61a32b2f could not be decoded. 127.0.0.1:5000
Media resource blob:http://127.0.0.1:5000/ee92756a-d549-4788-ad05-6eafbfa0ce16 could not be decoded. 127.0.0.1:5000
Media resource blob:http://127.0.0.1:5000/951b0a32-14df-4288-b3e5-cb0a61a32b2f could not be decoded, error: Error Code: NS_ERROR_DOM_MEDIA_FATAL_ERR (0x806e0005)
Details: mozilla::SupportChecker::AddMediaFormatChecker(const mozilla::TrackInfo&)::<lambda()>: Decoder may not have the capability to handle the requested video format with YUV444 chroma subsampling.
 */


// ------------- INTERFACE ------------- \\
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
let offsetTracker = {};

let locks = {
    "can_click": true,
    "init_frame_loaded": false,
    "resizing_mov": false,
};

let currentResizable = null;
let numberOfCameras = 0;

let clickedPoints = [];
let trackTracker = [];


function getOffset(frame, videoObject) {
    let offsets = offsetTracker[videoObject["index"]];
    if (offsets.length === 0) {
        return offsets[0];
    } else {
        let currentCalculation = NaN;
        let futureCalculation = 0;
        for (let offsetIndex = 0; offsetIndex < offsets.length; offsetIndex++) {
            if (offsetIndex === offsets.length - 1) {
                return offsets[offsetIndex].offset;
            }
            let currentOffsetFrame = offsets[offsetIndex].frame;
            let futureOffsetFrame = offsets[offsetIndex + 1].frame;
            if (isNaN(currentCalculation)) {
                currentCalculation = Math.abs(frame - currentOffsetFrame);
                futureCalculation = Math.abs(frame - futureOffsetFrame);

                if (currentCalculation < futureCalculation) {
                    return offsets[offsetIndex].offset;
                }
            } else {
                currentCalculation = futureCalculation;
                futureCalculation = Math.abs(frame - futureOffsetFrame);
                if (currentCalculation < futureCalculation) {
                    return offsets[offsetIndex].offset;
                }
            }
        }
    }
}

/// TRACK MANAGEMENT ///
function changeTracks(trackIndex) {
    trackTracker["currentTrack"] = trackIndex;
    for (let cameraIndex = 0; cameraIndex < numberOfCameras; cameraIndex++) {
        let localVideoObject = videoObjectSingletonFactory(cameraIndex);

        let pointCanvas = document.getElementById(localVideoObject["canvasID"]);
        let ctx = pointCanvas.getContext("2d");
        ctx.clearRect(0, 0, pointCanvas.width, pointCanvas.height);
        let localClickedPoints = clickedPoints[localVideoObject["index"]][trackIndex];
        if (localClickedPoints.length === 0) {
            return;
        }
        drawPoints(localClickedPoints, localVideoObject);
        drawLines(localClickedPoints, localVideoObject);
    }
}

function removeTrack(trackIndex) {
    for (let cameraIndex = 0; cameraIndex < numberOfCameras; cameraIndex++) {
        clickedPoints[cameraIndex].splice(trackIndex, 1);
    }
    if (trackTracker["tracks"][trackIndex].index === trackTracker["currentTrack"]) {
        changeTracks(0);
    }
    trackTracker["tracks"].splice(trackIndex, 1);
}

function addNewTrack(trackName) {
    let currentTrackIndex = trackTracker["tracks"].length;
    trackTracker["tracks"].push({"name": trackName, "index": currentTrackIndex, "color": COLORS[colorIndex]});
    colorIndex += 1;
    if (colorIndex === COLORS.length) {
        colorIndex = 0;
    }

    // Change the track for all videos
    for (let i = 0; i < numberOfCameras; i++) {
        let cur_videoObject = videoObjectSingletonFactory(i);
        clickedPoints[cur_videoObject["index"]][currentTrackIndex] = [];
        changeTracks(currentTrackIndex, cur_videoObject);
    }
}

/// END TRACK MANAGEMENT ///


/// DRAWING ///

function drawPoints(points, videoObject) {
    for (let i = 0; i < points.length; i++) {
        drawPoint(points[i].x, points[i].y, 2, videoObject);
    }
}

function drawPoint(x, y, r, videoObject) {
    let canvas = document.getElementById(videoObject["canvasID"]);
    let ctx = canvas.getContext("2d");
    ctx.strokeStyle = trackTracker["tracks"][trackTracker["currentTrack"]].color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.stroke();
}


function drawLines(points, videoObject) {
    for (let i = 0; i < points.length - 1; i++) {
        drawLine(points[i], points[i + 1], videoObject);
    }
}

function drawLine(point1, point2, videoObject, lineType = LINETYPE_POINT_TO_POINT) {
    let canvasToDraw;
    let ctx;
    if (lineType === LINETYPE_EPIPOLAR) {
        canvasToDraw = document.getElementById(videoObject["epipolarCanvasID"]);
        ctx = canvasToDraw.getContext('2d');
        ctx.clearRect(0, 0, canvasToDraw.width, canvasToDraw.height);
        ctx.strokeStyle = "#99badd"

    } else if (lineType === LINETYPE_POINT_TO_POINT) {
        canvasToDraw = document.getElementById(videoObject["canvasID"]);
        ctx = canvasToDraw.getContext("2d");
        ctx.strokeStyle = trackTracker["tracks"][trackTracker["currentTrack"]].color;
    }


    ctx.beginPath();
    ctx.moveTo(point1.x, point1.y);
    ctx.lineTo(point2.x, point2.y);
    ctx.stroke();
}

function drawDiamond(x, y, width, height, videoObject) {
    //SOURCE: http://www.java2s.com/Tutorials/Javascript/Canvas_How_to/Shape/Draw_Spade_Heart_Club_Diamond.htm
    let canvas = document.getElementById(videoObject["epipolarCanvasID"]);
    let context = canvas.getContext("2d");


    context.save();
    context.beginPath();
    let temp = y - height;
    context.moveTo(x, temp);

    // top left edge
    context.lineTo(x - width / 2, y);

    // bottom left edge
    context.lineTo(x, y + height);

    // bottom right edge
    context.lineTo(x + width / 2, y);

    // closing the path automatically creates
    // the top right edge
    context.closePath();

    context.lineWidth = 3;
    context.strokeStyle = "rgb(0,255,0)";
    context.stroke();
    context.restore();

}

function clearCanvasesBetweenFrames(videoObject) {
    for (let cameraIndex = 0; cameraIndex < numberOfCameras; cameraIndex++) {
        let epipolar = document.getElementById(videoObject["epipolarCanvasID"]);
        epipolar.getContext("2d").clearRect(0, 0, epipolar.width, epipolar.height);
    }
}

function attemptToDrawEpipolarLinesOrUnifedCoord(frameNumber, videoObject) {
    let videosWithTheSameFrame = Object.keys(frameTracker).filter(
        (videoIndex) => Math.floor(frameTracker[videoIndex]) === Math.floor(frameTracker[videoObject["index"]]));
    if (videosWithTheSameFrame.length > 1 && DLT_COEFFICIENTS !== null) {
        // TODO : Come back and rename variables
        let enoughPointsFor3DEstimation = 0;
        for (let videos = 0; videos < videosWithTheSameFrame.length; videos++) {
            let localPoints = clickedPoints[videosWithTheSameFrame[videos]][trackTracker["currentTrack"]];
            let indexOfPoints = 0;
            if (localPoints.filter(function (point, index) {
                if (Math.floor(point.frame) === Math.floor(frameNumber)) {
                    indexOfPoints = index;
                    return true;
                } else {
                    return false;
                }
            }).length !== 0) {
                enoughPointsFor3DEstimation += 1;
                getEpipolarLines(videoObjectSingletonFactory(videos), DLT_COEFFICIENTS, indexOfPoints);
            }
        }
        if (enoughPointsFor3DEstimation === numberOfCameras) {
            uvToXyz([clickedPoints[0][0], clickedPoints[1][0]],
                null, DLT_COEFFICIENTS).then(
                (result) => {
                    for (let i = 0; i < 1; i++) {
                        for (let j = 0; j < numberOfCameras; j++) {
                            // todo a little janky
                            let epipolarCanvas = document.getElementById(videoObjectSingletonFactory(j)["epipolarCanvasID"]);
                            epipolarCanvas.getContext("2d").clearRect(0, 0, epipolarCanvas.width, epipolarCanvas.height);
                            let currentPoint = reconstructUV(DLT_COEFFICIENTS[j], result[result.length - 1]);
                            drawDiamond(
                                currentPoint[0][0],
                                currentPoint[1][0], 10, 10,
                                videoObjectSingletonFactory(j)
                            );
                        }
                    }
                }
            );
        }
    }
}

function drawEpipolarLine(points, videoObject) {
    for (let i = 0; i < points.length - 1; i++) {
        drawLine(
            {
                "x": points[i][0],
                "y": points[i][1]
            },
            {
                "x": points[i + 1][0],
                "y": points[i + 1][1]
            },
            videoObject, LINETYPE_EPIPOLAR);
    }
}


function drawZoomWindow(videoObject) {
    let startX = mouseTracker.x;
    let startY = mouseTracker.y;

    let videoCanvas = document.getElementById(videoObject["videoCanvasID"]);
    let zoomWindow = document.getElementById(videoObject["zoomCanvasID"]);

    let ctx = zoomWindow.getContext("2d");
    ctx.clearRect(0, 0, zoomWindow.width, zoomWindow.height);
    ctx.drawImage(videoCanvas, startX - 10, startY - 10, 20, 20, 0, 0, 400, 400); // startX, startY, endX, endY, 0, 0, endY, endX);

    ctx.beginPath();
    ctx.moveTo(200, 0);
    ctx.lineTo(200, 400);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 200);
    ctx.lineTo(400, 200);
    ctx.stroke();

}

/// END DRAWING ///

function goToFrame(frameNumber, videoObject) {
    //TODO: NOTE THAT WHEN A USER INPUTS A FRAME NUMBER IT WILL EXTEND ITSELF WITH A .01
    let vidOffset = getOffset(frameNumber, videoObject);
    frameNumber -= vidOffset;

    clearCanvasesBetweenFrames(videoObject);
    let video = document.getElementById(videoObject["videoID"]);


    let estimatedTime = frameNumber / DEV_FRAME_RATE;
    video.currentTime = estimatedTime;

    let parsedLabel = parseVideoLabel(document.getElementById(videoObject["videoLabelID"]).innerText);
    parsedLabel["frame"] = (estimatedTime * DEV_FRAME_RATE) + vidOffset;
    document.getElementById(videoObject["videoLabelID"]).innerText = videoLabelDataToString(parsedLabel);
    frameTracker[videoObject["index"]] = frameNumber;
    // loadFrame(videoObject);
    attemptToDrawEpipolarLinesOrUnifedCoord(frameNumber, videoObject);
}

function setMousePos(e) {
    // TODO: Error When Scrolling and not moving
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

// TODO This might be way to inefficient for the benefit in modifying string data
function parseVideoLabel(videoLabelText) {
    let parsedData = {};
    let splicedData = videoLabelText.split(" ");
    for (let i = 0; i < splicedData.length; i++) {
        let localSplice = splicedData[i].split(":");
        parsedData[localSplice[0]] = localSplice[1];
    }
    return parsedData;
}

function videoLabelDataToString(videoLabelObject) {
    let keys = Object.keys(videoLabelObject);
    let returnString = "";
    for (let i = 0; i < keys.length; i++) {
        returnString += `${keys[i]}:${videoLabelObject[keys[i]]} `;
    }
    return returnString;
}

function moveToNextFrame(videoObject) {
    let video = document.getElementById(videoObject["videoID"]);
    let newFrame = (video.currentTime * DEV_FRAME_RATE) + 1;
    goToFrame(newFrame, videoObject);
}





function setCanvasSizes(canvas, video, index) {
    canvas.height = video.videoHeight;
    canvas.width = video.videoWidth;
    if (video.videoWidth > 800 || video.videoHeight > 600) {
        canvas.style.height = "600px";
        canvas.style.width = "800px";
    } else {
        canvas.style.height = video.videoHeight + "px";
        canvas.style.width = video.videoWidth + "px";
    }
}

function triggerResizeMode() {
    let canvases = $(".clickable-canvas");
    if (locks["resizing_mov"]) {
        locks["resizing_mov"] = false;
        canvases.off("mousedown");
        canvases.off("mouseup");
        $(document).off("mousemove");
        canvases.css("border", "none");
    } else {
        locks["resizing_mov"] = true;
        $(document).on("mousemove", setMousePos);
        canvases.css("border", "1px solid black");
    }
}

function handleKeyboardInput(e) {
    if (String.fromCharCode(e.which) === "Q") {
        triggerResizeMode();
    } else if (String.fromCharCode(e.which) === "F") {
        // TODO: Bug when spamming N (lock)
        if (settings["sync"] === true) {
            for (let i = 0; i < numberOfCameras; i++) {
                moveToNextFrame(videoObjectSingletonFactory(i));
            }
        } else {
            let id = parseInt(e.target.id.split("-")[1], 10);
            moveToNextFrame(videoObjectSingletonFactory(id));
        }

    } else if (String.fromCharCode(e.which) === "B") {

        let index = parseInt(e.target.id.split("-")[1], 10);
        if (frameTracker[index] < 2) {
            return;
        }
        if (settings["sync"] === true) {
            for (let i = 0; i < numberOfCameras; i++) {
                goToFrame(frameTracker[i] - 1, videoObjectSingletonFactory(i));
            }
        } else {
            goToFrame(frameTracker[index] - 1, videoObjectSingletonFactory(index));
        }
    } else if (String.fromCharCode(e.which) === "G") {
        let invalidFrame = 1;
        let index = parseInt(e.target.id.split("-")[1], 10);
        while (invalidFrame) {
            let currentFrame = window.prompt("What frame would you like to go to?");

            // User clicks cancel
            if (currentFrame === null) {
                invalidFrame = 0;
            }

            let frameToGoTo = parseInt(currentFrame, 10);
            if (isNaN(frameToGoTo) || frameToGoTo % 1 !== 0) {
                alert("Frame must be a valid integer!");
            } else {
                invalidFrame = 0;
                if (settings["sync"]) {
                    for (let cameraIndex = 0; cameraIndex < numberOfCameras; cameraIndex++) {
                        goToFrame(frameToGoTo, videoObjectSingletonFactory(cameraIndex));
                    }
                } else {
                    goToFrame(frameToGoTo, videoObjectSingletonFactory(index));
                }
            }
        }
    }
}

function changeColorSpace(colorSpace) {
    if (colorSpace === RGB) {
        for (let cameraIndex = 0; cameraIndex < numberOfCameras; cameraIndex++) {
            currentFilter = "grayscale(0%)";
            loadFrame(videoObjectSingletonFactory(cameraIndex));
        }
    } else {
        for (let cameraIndex = 0; cameraIndex < numberOfCameras; cameraIndex++) {
            currentFilter = "grayscale(100%)";
            loadFrame(videoObjectSingletonFactory(cameraIndex));
        }
    }

}

function popVideoOut(event, videoURL) {
    // TODO this function will probably have to be defined in the template
    // TODO Needs to be locks so that a new video cannot be popped out until the current one has finished
    let init_communicator = new BroadcastChannel("unknown-video");
    init_communicator.onmessage = function (_) {
        console.log(_);
        init_communicator.postMessage({
            "dataURL": videoURL
        });
        init_communicator.close();
        let master_communicator = new BroadcastChannel("0");

    };
    window.open("http://127.0.0.1:8000/clicker/popped_window", `${event.target.id}`,
        'location=yes,height=600,width=800,scrollbars=yes,status=yes');
}

/// LOAD FILE FUNCTIONS ///

function parseDLTCoefficents(text, separator) {
    let loopText = text.split("\n").filter((value) => value !== "");
    console.log(separator);
    let returnVector = [];
    for (let i = 0; i < numberOfCameras; i++) {
        returnVector[i] = [];
    }
    for (let i = 0; i < loopText.length - 1; i++) {
        loopText[i] = loopText[i].split(separator);
        for (let j = 0; j < numberOfCameras; j++) {
            returnVector[j].push(parseFloat(loopText[i][j]));
        }
    }
    return returnVector;
}

function parseCameraProfile(text, separator) {
    // NOTE: Only works with pinhole for now


    let loopText = text.split("\n").filter((value) => value !== "");
    console.log(separator);
    let returnVector = [];
    for (let i = 0; i < numberOfCameras; i++) {
        returnVector[i] = [];
    }
    for (let i = 0; i < loopText.length; i++) {
        let localLoopText = loopText[i].split(separator).filter((value) => value !== "");
        for (let j = 0; j < localLoopText.length; j++) {
            returnVector[i].push(parseFloat(localLoopText[j]));
        }
        // Remove Camera Index
        returnVector[i].splice(0, 1);
        // Remove the 2nd and 3rd values (width/height)
        returnVector[i].splice(2, 2);
        // Remove the sixth value
        returnVector[i].splice(6, 0);
    }
    return returnVector;
}


function loadDLTCoefficients(file) {
    let reader = new FileReader();
    reader.onload = function () {
        DLT_COEFFICIENTS = parseDLTCoefficents(reader.result, ",");
    };
    reader.readAsText(file[0]);
}

function loadCameraProfile(file) {
    let reader = new FileReader();
    reader.onload = function () {
        CAMERA_PROFILE = parseCameraProfile(reader.result, " ");
    };
    reader.readAsText(file[0]);
}


function loadSettings() {
    let setupSettingsInput = $(`
        <div class="columns is-multiline">
            <div class="columns is-centered is-vcentered is-multiline">
                <div class="column">
                    <div class="file">
                        <label class="file-label">
                            <input id="dlt-coeff-input" class="file-input" accept="text/csv" type=file>
                            <span class="file-cta">
                              <span class="file-label">
                                Load DLT Coefficients 
                              </span>
                            </span>
                        </label>
                    </div>
                </div>
                <div class="column">
                    <div class="file">
                        <label class="file-label">
                            <input id="camera-profile-input" class="file-input" accept=".txt" type=file>
                            <span class="file-cta">
                              <span class="file-label">
                                Load Camera Profile 
                              </span>
                            </span>
                        </label>
                    </div>
                </div>
            </div>
                
            <div class="column">
                <div class="control">
                    <label class="label">Add New Track: </label>
                    <input id="new-track-input" type="text">
                    <input id="add-track-button" type="button">
                </div>
            </div>
            
            <div class="columns is-centered is-vcentered">
                <div class="column">
                    <div id="track-dropdown-container" class="dropdown">
                        <div class="dropdown-trigger">
                            <button id="track-dropdown-trigger" class="button" aria-haspopup="true" aria-controls="track-dropdown">
                                <!-- TODO: ADD DOWN ARROW --> 
                                <span>Select Track</span>
                            </button>
                        </div>
                        <div class="dropdown-menu" id="track-dropdown" role="menu">
                            <div class="dropdown-content">
                                <div id=track-0 class="dropdown-item">
                                    Track 1
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="column">
                    <p id="current-track-display">Current Track: Track 1</p>
                </div>
            </div>
            
            <div class="column has-text-centered">
                <div id="rgb-dropdown-container" class="dropdown">
                    <div class="dropdown-trigger">
                        <button id="rgb-dropdown-trigger" class="button" aria-haspopup="true" aria-controls="rgb-dropdown">
                            <!-- TODO: ADD DOWN ARROW --> 
                             <span>Select Colorspace</span>
                        </button>
                    </div>
                    <div class="dropdown-menu" id="rgb-dropdown" role="menu">
                        <div class="dropdown-content">
                            <div id=rgb class="dropdown-item">
                                RGB
                            </div>
                        </div>
                        <div class="dropdown-content">
                            <div id=greyscale class="dropdown-item">
                                Greyscale
                            </div>                        
                        </div>
                    </div>
                </div>
            </div>
        </div>
`);
    $("#settingsInput").append(setupSettingsInput);
    let track_trigger = $("#track-dropdown-trigger");
    let color_trigger = $("#rgb-dropdown-trigger");
    let track_container = $("#track-dropdown-container");
    let color_container = $("#rgb-dropdown-container");
    let track_dropdown = $("#track-dropdown");
    let color_dropdown = $("#rgb-dropdown");

    track_trigger.on("click", function () {
        if (track_container.hasClass("is-active")) {
            track_container.removeClass("is-active");
        } else {
            track_container.addClass("is-active");
        }
    });

    color_trigger.on("click", function () {
        if (color_container.hasClass("is-active")) {
            color_container.removeClass("is-active");
        } else {
            color_container.addClass("is-active");
        }
    });

    // TODO: GET the actual file input [Edit: not sure what was meant by this]
    $("#dlt-coeff-input").on("change", function (_) {
        let selectedFiles = Array.from($("#dlt-coeff-input").prop("files"));
        loadDLTCoefficients(selectedFiles);
    });

    $("#camera-profile-input").on("change", function (_) {
        let selectedFiles = Array.from($("#camera-profile-input").prop("files"));
        loadCameraProfile(selectedFiles);
    });

    track_dropdown.on("click", ".dropdown-item", function (event) {
        changeTracks(parseInt(event.target.id.split("-")[1], 10));
        $("#current-track-display").text(`Current Track: ${trackTracker["tracks"][trackTracker["currentTrack"]].name}`);
        if (track_container.hasClass("is-active")) {
            track_container.removeClass("is-active");
        }
    });

    $("#add-track-button").on("click", function (_) {
        let newTrack = $("#new-track-input").val();
        if (newTrack.length === 0) {
            alert("Track name can't be empty!");
        }
        // TODO Check if Track name already exists
        else if (false) {
        } else {
            addNewTrack(newTrack);
            $("#current-track-display").text(`Current Track: ${newTrack}`);
            let curIndex = trackTracker["currentTrack"];
            let newDropdownItem = $(`
                <div class="dropdown-content">
                    <div id=track-${curIndex} class="dropdown-item">
                        ${newTrack}
                    </div>
                    <button id="track-${curIndex}-delete" class="dropdown-item-delete">Delete</button>
                </div>
            `);
            $("#track-dropdown").append(newDropdownItem);
        }
    });

    track_dropdown.on("click", ".dropdown-item-delete", function (event) {
        let curTrackIndex = parseInt(event.target.id.split("-")[1], 10);
        if (curTrackIndex === trackTracker["currentTrack"]) {
            $("#current-track-display").text(`Current Track: ${trackTracker["tracks"][0].name}`);
        }
        removeTrack(curTrackIndex);
        $(`#track-${curTrackIndex}`).parent().remove();
        if (track_container.hasClass("is-active")) {
            track_container.removeClass("is-active");
        }
    });

    color_dropdown.on("click", ".dropdown-item", function (event) {
        changeColorSpace(event.target.id === "rgb" ? RGB : GREYSCALE);
        if (color_container.hasClass("is-active")) {
            color_container.removeClass("is-active");
        }
    });
}


function loadVideos(files) {
    $("#file-input-section").remove();
    loadSettings();
    trackTracker = {"tracks": [{"name": "Track 1", "index": 0, "color": COLORS[colorIndex]}], "currentTrack": 0};
    colorIndex += 1;


    files.forEach((file, index) => {
        numberOfCameras += 1;
        let curURL = URL.createObjectURL(file);
        loadVideosIntoDOM(curURL, index, file.name);
    });
}

/// END LOAD FUNCTIONS ///

$(document).ready(function () {
    let fileInput = document.getElementById("video-file-input");
    fileInput.onchange = function (_) {
        let selectedFiles = Array.from(fileInput.files);
        loadVideos(selectedFiles);
    };
});

// ----- UNDERLYING MATHEMATICS ----- \\


function undistortPoints(coordinatePair, cameraProfile) {

}

function reconstructUV(dltCoeff2, coordinateTriplet) {
    if (dltCoeff2.length !== 11) {
        return [null, "There must be exaclty 11 DLT coefficients in a 1d array or list"];
    }
    let u = numeric.div(
        numeric.add(
            numeric.dot(
                [dltCoeff2[0], dltCoeff2[1], dltCoeff2[2]],
                coordinateTriplet
            ),
            dltCoeff2[3]),
        numeric.add(
            numeric.dot(
                [dltCoeff2[8], dltCoeff2[9], dltCoeff2[10]],
                coordinateTriplet),
            1)
    );

    let v = numeric.div(
        numeric.add(
            numeric.dot(
                [dltCoeff2[4], dltCoeff2[5], dltCoeff2[6]],
                coordinateTriplet
            ),
            dltCoeff2[7]),
        numeric.add(
            numeric.dot(
                [dltCoeff2[8], dltCoeff2[9], dltCoeff2[10]],
                coordinateTriplet),
            1)
    );
    return [u, v];
}

function getDLTLine(xCoord, yCoord, dlcCoeff1, dltCoeff2) {
    let z = [500, -500];
    let y = [0, 0];
    let x = [0, 0];
    for (let i = 0; i < z.length; i++) {
        let Z = z[i];

        y[i] = -(
            xCoord * dlcCoeff1[8] * dlcCoeff1[6] * Z
            + xCoord * dlcCoeff1[8] * dlcCoeff1[7]
            - xCoord * dlcCoeff1[10] * Z * dlcCoeff1[4]
            - xCoord * dlcCoeff1[4]
            + dlcCoeff1[0] * yCoord * dlcCoeff1[10] * Z
            + dlcCoeff1[0] * yCoord
            - dlcCoeff1[0] * dlcCoeff1[6] * Z
            - dlcCoeff1[0] * dlcCoeff1[7]
            - dlcCoeff1[2] * Z * yCoord * dlcCoeff1[8]
            + dlcCoeff1[2] * Z * dlcCoeff1[4]
            - dlcCoeff1[3] * yCoord * dlcCoeff1[8]
            + dlcCoeff1[3] * dlcCoeff1[4])
            /
            (
                xCoord * dlcCoeff1[8] * dlcCoeff1[5]
                - xCoord * dlcCoeff1[9] * dlcCoeff1[4]
                + dlcCoeff1[0] * yCoord * dlcCoeff1[9]
                - dlcCoeff1[0] * dlcCoeff1[5]
                - dlcCoeff1[1] * yCoord * dlcCoeff1[8]
                + dlcCoeff1[1] * dlcCoeff1[4]);
        let Y = y[i];

        x[i] = -(
            yCoord * dlcCoeff1[9] * Y
            + yCoord * dlcCoeff1[10] * Z
            + yCoord - dlcCoeff1[5] * Y
            - dlcCoeff1[6] * Z
            - dlcCoeff1[7])
            /
            (yCoord * dlcCoeff1[8]
                - dlcCoeff1[4]);

    }

    let xy = [[0, 0], [0, 0]];
    for (let i = 0; i < 2; i++) {
        let temp_xy = reconstructUV(dltCoeff2, [x[i], y[i], z[i]]);
        xy[i][0] = temp_xy[0];
        xy[i][1] = temp_xy[1];
    }

    let m = numeric.div(numeric.sub(xy[1][1], xy[0][1]), numeric.sub(xy[1][0], xy[0][0]));
    let b = numeric.sub(xy[0][1], numeric.mul(m, xy[0][0]));
    return [m, b];
}

function redistortPoints(points, cameraProfile, type = PINHOLE) {
    if (type === PINHOLE) {
        if (cameraProfile.length === 8) {
            let rotationVector = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
            let translationVector = [0, 0, 0];
            let cameraMatrix = [
                [cameraProfile[0], 0, cameraProfile[1]],
                [0, cameraProfile[0], cameraProfile[2]],
                [0, 0, 1]];
            // TODO: finish implementation
        }
    } else {
        return numeric.transpose(cameraProfile.distortPoints(numeric.transpose(points)))
    }
}

function getBezierCurve(slope, intercept, cameraProfile, videoObject) {
    let originalVideoWidth = document.getElementById(videoObject["videoCanvasID"]).width;
    let bezierPoints = [];
    for (let k = -10; k < 60; k++) {
        bezierPoints.push([originalVideoWidth / 49, slope * (originalVideoWidth / 49) + intercept]);
    }

    let redistortedPoints = tf.Tensor(redistortPoints(bezierPoints, cameraProfile));
    redistortedPoints.reshape([bezierPoints.length, 2]);
    return redistortedPoints
}

function getEpipolarLines(videoObject, DLTCoefficients, pointsIndex) {
    let coords = [];
    let tmp = [];
    let dlcCoeff1 = DLTCoefficients[videoObject["index"]];
    let currentTrack = trackTracker["currentTrack"];

    let localPoints = clickedPoints[videoObject["index"]][currentTrack];
    for (let cameraIndex = 0; cameraIndex < numberOfCameras; cameraIndex++) {
        coords.push([
                cameraIndex,
                [
                    localPoints[pointsIndex].x,
                    localPoints[pointsIndex].y
                ]
            ]
        );
    }
    coords.sort();
    for (let i = 0; i < coords.length; i++) {
        let coord = coords[i];
        if (coord[0] !== parseInt(videoObject["index"], 10)) {
            let dltCoeff2 = DLTCoefficients[coord[0]];

            let xCoord = coord[1][0];
            let yCoord = coord[1][1];

            if (CAMERA_PROFILE) {
                let undistortPoints = undistortPoints([xCoord, yCoord], CAMERA_PROFILE[coord[0]][0]);
                xCoord = undistortPoints[0];
                yCoord = undistortPoints[1];

                let slopeAndIntercept = getDLTLine(xCoord, yCoord, dlcCoeff1, dltCoeff2);
                let slope = slopeAndIntercept[0];
                let intercept = slopeAndIntercept[1];

                tmp = getBezierCurve(slope, intercept, CAMERA_PROFILE[coord[0]]);
            } else {
                let slopeAndIntercept = getDLTLine(xCoord, yCoord, dlcCoeff1, dltCoeff2);
                let slope = slopeAndIntercept[0];
                let intercept = slopeAndIntercept[1];
                tmp.push([0, intercept]);
                let original_width = document.getElementById(videoObject["videoCanvasID"]).width;
                tmp.push([original_width, numeric.add(numeric.mul(slope, original_width), intercept)])
            }

            let currentObject = videoObjectSingletonFactory(i);

            drawEpipolarLine(tmp, currentObject);
        }
    }
}

async function uvToXyz(points, profiles, dltCoefficents) {
    /*
    * param: points - [[camera_1_points], [camera_2_points], [camera_n_points]]
     */
    //TODO: Remove points that are NaN (are there ever any?)
    let xyzs = [];

    let uvs = [];
    for (let pointIndex = 0; pointIndex < points[0].length; pointIndex++) {
        uvs = [];
        for (let cameraIndex = 0; cameraIndex < points.length; cameraIndex++) {
            let currentPoint = points[cameraIndex][pointIndex];
            // TODO: These are supposed to be undistorted
            uvs.push([[currentPoint.x, currentPoint.y], cameraIndex]);
        }

        if (uvs.length > 1) {
            let x = [];

            for (let pointIndex = 0; pointIndex < uvs.length; pointIndex++) {
                let currentIndex = pointIndex === 0 ? 0 : pointIndex + 1;
                let currentIndex2 = currentIndex + 1;

                x[currentIndex] = [uvs[pointIndex][0][0] * dltCoefficents[uvs[pointIndex][1]][8] - dltCoefficents[uvs[pointIndex][1]][0],
                    uvs[pointIndex][0][0] * dltCoefficents[uvs[pointIndex][1]][9] - dltCoefficents[uvs[pointIndex][1]][1],
                    uvs[pointIndex][0][0] * dltCoefficents[uvs[pointIndex][1]][10] - dltCoefficents[uvs[pointIndex][1]][2]];

                x[currentIndex2] = [uvs[pointIndex][0][1] * dltCoefficents[uvs[pointIndex][1]][8] - dltCoefficents[uvs[pointIndex][1]][4],
                    uvs[pointIndex][0][1] * dltCoefficents[uvs[pointIndex][1]][9] - dltCoefficents[uvs[pointIndex][1]][5],
                    uvs[pointIndex][0][1] * dltCoefficents[uvs[pointIndex][1]][10] - dltCoefficents[uvs[pointIndex][1]][6]];
            }

            let y = [];
            for (let pointIndex = 0; pointIndex < uvs.length; pointIndex++) {
                let currentIndex = pointIndex === 0 ? 0 : pointIndex + 1;
                let currentIndex2 = currentIndex + 1;
                y[currentIndex] = [dltCoefficents[uvs[pointIndex][1]][3] - uvs[pointIndex][0][0]];
                y[currentIndex2] = [dltCoefficents[uvs[pointIndex][1]][7] - uvs[pointIndex][0][1]];
            }


            y = tf.tensor(y);
            x = tf.tensor(x);
            let mediary = await x.transpose().matMul(x).array();
            let inverse = tf.tensor(math.inv(mediary));
            let mediary2 = x.transpose().matMul(y);
            let final = inverse.matMul(mediary2);
            xyzs.push(await final.array());
        }
    }
    return xyzs
}
