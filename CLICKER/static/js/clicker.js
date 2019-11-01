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


let DEV_FRAME_RATE = 30;
let CAMERA_PROFILE = null;
let DLT_COEFFICIENTS = null;

let RGB = 0;
let GREYSCALE = 1;
let currentFilter = "";

let currentFrameGlobal = 0;

let communicators = [];


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

/** @namespace */
function getOffset(frame, videoObject) {
    /**
     * Gets camera's frame offset from the offsetTracker global variable based on the frame and video.
     * @param {Number} frame Value representing the current frame
     * @param {Object} videoObject @see videoObjectSingletonFactory
     * @returns {Number} offset The offset given the current frame
     */

        // Gets a list of offset objects based on the passed video
    let offsets = offsetTracker[videoObject["index"]];

    // TODO: This doesn't actually do anything
    // If there are no offsets found for this video, return
    if (offsets.length === 0) {
        return offsets[0];
    } else {
        // Gets the frame closest to the passed one and reads its offset
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


/** @namespace */
function removeTrack(trackIndex) {
    /**
     * Removes a track from the trackTracker global variable
     * @param {Number} trackIndex The index of the track requested to be deleted
     * @returns {undefined}
     */
    for (let cameraIndex = 0; cameraIndex < numberOfCameras; cameraIndex++) {
        clickedPoints[cameraIndex].splice(trackIndex, 1);
    }
    if (trackTracker["tracks"][trackIndex].index === trackTracker["currentTrack"]) {
        let cameraIndex = [];
        for (let i=0; i<numberOfCameras; i++) {cameraIndex.push(i);}
        changeTracks(0, cameraIndex);
    }
    trackTracker["tracks"].splice(trackIndex, 1);
}

/** @namespace */
function addNewTrack(trackName) {
    /**
     * Adds a track to the trackTracker global variable
     * @param{trackNumber} trackNumber
     */
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
        changeTracks(currentTrackIndex);
    }

    communicators.forEach((communicator) => communicator.communicator.postMessage({
        "type": "addNewTrack",
        "data": {"track": {
            index: currentTrackIndex,
            track: {"name": trackName, "index": currentTrackIndex, "color": COLORS[colorIndex]}
            }
        }
    }));
}

/// END TRACK MANAGEMENT ///


/// DRAWING ///


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

function getClickedPoints(index, currentTrackIndex) {
    return clickedPoints[index][currentTrackIndex];
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

                            if (!checkCoordintes(currentPoint[0][0], currentPoint[0][1],
                                epipolarCanvas.height, epipolarCanvas.width)) {
                                generateError("Points that did not exist were calculated when locating the " +
                                    "point in 2D space, please check your DLT coefficients and camera profiles");
                            }

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
                generateError("Frame must be valid integer!");
            } else {
                invalidFrame = 0;
                frameToGoTo += .00001;
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

function handlePopoutNewPoint(data) {
    let videoIndex = parseInt(data.videoID, 10);
    let pointData = data.point;
    let track = data.track;
    let currentFrame = data.currentFrame;

    let indexOfAlreadyExisting = null;
    let localPoints = getClickedPoints(videoIndex, track);
    if (localPoints.some(function (point, curIndexs) {
        if (Math.floor(point.frame) === Math.floor(pointData.frame)) {
            indexOfAlreadyExisting = curIndexs;
            return true;
        } else {
            return false;
        }
    }) === true) {
        localPoints[indexOfAlreadyExisting] = pointData;
    } else {
        localPoints.push(pointData);
        localPoints.sort(sortByFrame);
        drawPoint(pointData.x, pointData.y, 2, videoObjectSingletonFactory(videoIndex));
    }

    if (settings["sync"] === true) {
        for (let i = 0; i < numberOfCameras; i++) {
            let currentCommunicator = communicators.find((elem) => elem.index === `${i}`);

            if (currentCommunicator === undefined) {
                goToFrame(currentFrame, videoObjectSingletonFactory(i));
            }

            if (i === videoIndex) {
                continue;
            } else {
                currentCommunicator.communicator.postMessage({type: "goToFrame", data: {"frame": currentFrame}});
            }
        }
    }
}

function handlePopoutChange(message) {
    let messageContent = message.data;
    if (messageContent.type === "newPoint") {
        handlePopoutNewPoint(messageContent.data);
    } else {

    }
}

function popVideoOut(event, videoURL) {
    // TODO this function will probably have to be defined in the template
    // TODO Needs to be locks so that a new video cannot be popped out until the current one has finished
    let init_communicator = new BroadcastChannel("unknown-video");
    let videoIndex = event.target.id.split("-")[2];
    init_communicator.onmessage = function (_) {
        init_communicator.postMessage({
            "dataURL": videoURL,
            "videoID": videoIndex,
            "videoTitle": parseVideoLabel(
                document.getElementById(
                    videoObjectSingletonFactory(videoIndex)["videoLabelID"]
                ).innerText
            ).title,
            "clickedPoints": clickedPoints[videoIndex],
            "offset": offsetTracker[videoIndex][0]["offset"],
            "currentTracks": trackTracker
        });
        init_communicator.close();
        let master_communicator = new BroadcastChannel(`${videoIndex}`);
        master_communicator.onmessage = handlePopoutChange;
        communicators.push({"communicator": master_communicator, "index": videoIndex});
    };

    $(`#container-for-canvas-${videoIndex}`).hide();
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
    for (let i = 0; i < loopText.length; i++) {
        loopText[i] = loopText[i].split(separator);
        for (let j = 0; j < numberOfCameras; j++) {
            returnVector[j].push(parseFloat(loopText[i][j]));
        }
    }
    return returnVector;
}

function parseCameraProfile(text, separator) {
    // NOTE: Only works with pinhole for now


    const profiles = text.split("\n").filter((value) => value !== "");
    const numberOfProfiles = profiles.length;

    if (numberOfProfiles !== numberOfCameras) {
        if (numberOfProfiles > numberOfCameras) {
            // TODO: PROD: Remake into a modal
            generateError(`I can't use ${numberOfProfiles} ${numberOfProfiles > 1 ? "profiles" : "profile"} 
            with only ${numberOfCameras} ${numberOfCameras > 1 ? "cameras" : "camera"} `);
        } else {

            // TODO: PROD: Remake into a modal
            generateError(`I can't use only ${numberOfProfiles} ${numberOfProfiles > 1 ? "profiles" : "profile"} 
            with ${numberOfCameras} ${numberOfCameras > 1 ? "cameras" : "camera"} `);
        }
    }

    let returnVector = [];
    for (let i = 0; i < numberOfCameras; i++) {
        returnVector[i] = [];
    }
    for (let i = 0; i < numberOfProfiles; i++) {
        let localProfile = profiles[i].split(separator).filter((value) => value !== "");
        for (let j = 0; j < localProfile.length; j++) {
            if (localProfile[j].match(/[a-z]/i)) {
                generateError(`ERROR PARSING CAMERA AT CAMERA ${i + 1} IN PARAMETER ${j + 1}.
                FOUND THE FOLLOW CHARACTERS: ${localProfile[j]}`);
            }
            returnVector[i].push(parseFloat(localProfile[j]));
        }
        // Remove Camera Index
        returnVector[i].splice(0, 1);
        // Remove the 2nd and 3rd values (width/height)
        returnVector[i].splice(1, 2);
        // Remove the sixth value
        returnVector[i].splice(3, 1);

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


function getIndexFromFrame(points, frame) {
    if (Math.floor(points[0].frame) > frame) {
        return null;
    }

    if (Math.floor(points[points.length - 1].frame) < frame) {
        return null;
    }

    let currentIndex = Math.floor(points.length / 2);
    let iterator = 0;
    if (Math.floor(points[currentIndex].frame) < frame) {
        iterator = 1;
    } else if (Math.floor(points[currentIndex].frame) > frame) {
        iterator = -1;
    } else {
        return currentIndex;
    }

    let continueSearch = true;
    while (continueSearch) {
        currentIndex += iterator;
        if (currentIndex < 0 || currentIndex >= points.length) {
            continueSearch = false;
            break;
        } else {
            if (Math.floor(points[currentIndex].frame) === frame) {
                return currentIndex;
            }
        }
    }
    return null;
}

function download(filename, text) {
    // Source: https://ourcodeworld.com/articles/read/189/how-to-create-a-file-and-generate-a-download-with-javascript-in-the-browser-without-a-server
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}


function exportPoints() {
    // TODO THIS ASSUMES IT IS SORTED
    let duration = document.getElementById(videoObjectSingletonFactory(0).videoID).duration;
    let frames = Math.floor(duration * DEV_FRAME_RATE);

    let exportablePoints = [];
    for (let i = 0; i < frames; i++) {
        let frameArray = [];
        for (let j = 0; j < numberOfCameras; j++) {
            for (let q = 0; q < trackTracker.tracks.length; q++) {
                let localPoints = getClickedPoints(j, q);
                let index = getIndexFromFrame(localPoints, i);
                if (index === null) {
                    frameArray.push(NaN);
                    frameArray.push(NaN);
                } else {
                    frameArray.push(localPoints[index].x);
                    frameArray.push(localPoints[index].y);
                }
            }
        }
        exportablePoints.push(frameArray.join(",") + ",\n");
    }

    download("clickedpoints.csv", exportablePoints.join(""));
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
            
            <div class="column has-text-centered">
                <button id="save-points-button" class="button">Save Points</button>
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
        let trackID = parseInt(event.target.id.split("-")[1], 10)
        changeTracks(trackID);
        if (communicators.length !== 0) {
            communicators.forEach((communicator) => communicator.communicator.postMessage({
                type: "changeTrack",
                data: {
                    "track": trackID
                }
            }))
        }


        $("#current-track-display").text(`Current Track: ${trackTracker["tracks"][trackTracker["currentTrack"]].name}`);
        if (track_container.hasClass("is-active")) {
            track_container.removeClass("is-active");
        }
    });

    $("#add-track-button").on("click", function (_) {
        let newTrack = $("#new-track-input").val();
        if (newTrack.length === 0) {
            generateError("Track name can't be empty!");
        } else if (trackTracker["tracks"].some((trackObject) => trackObject.name === newTrack)) {
            generateError("You can't add a track with the same name twice!");
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

    $("#save-points-button").on("click", exportPoints);
}


function mainWindowAddNewPoint(event) {
    let point = addNewPoint(event);
    if (communicators.length === 0) {
        return;
    } else {
        if (settings["auto-advance"]) {
            communicators.forEach((communicator) => communicator.communicator.postMessage({
                type: "goToFrame",
                data: {frame: point.frame + 1}
            })
        );
        }
    }
}


function loadVideos(files) {
    $("#file-input-section").remove();
    loadSettings();
    trackTracker = {"tracks": [{"name": "Track 1", "index": 0, "color": COLORS[colorIndex]}], "currentTrack": 0};
    colorIndex += 1;


    files.forEach((file, index) => {
        numberOfCameras += 1;
        let curURL = URL.createObjectURL(file);
        loadVideosIntoDOM(curURL, index, file.name, mainWindowAddNewPoint, true);
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


function redistortPoints(coordinatePair, cameraProfile) {
    // TODO: TAN DISTORTION UNTESTED
    // TODO: Vectorize
    let f = cameraProfile[0];
    let cx = cameraProfile[1];
    let cy = cameraProfile[2];

    let distorted = [];


    for (let i = 0; i < coordinatePair.length; i++) {
        let u_v_pair = coordinatePair[i];
        let u = u_v_pair[0];
        let v = u_v_pair[1];

        u = (u - cx) / f;
        v = (v - cy) / f;

        let r2 = u * u + v * v;
        let r4 = r2 ** 2;
        u = u * (1 + (cameraProfile[3] * r2) + (cameraProfile[4] * r4));
        v = v * (1 + (cameraProfile[3] * r2) + (cameraProfile[4] * r4));

        u = u + (2 * cameraProfile[5] * u * v + cameraProfile[6] * (r2 + 2 * u ** 2));
        v = v + (cameraProfile[5] * (r2 + (2 * v ** 2)) + 2 * cameraProfile[6] * u * v);

        u = u * f + cx;
        v = v * f + cy;
        distorted.push([u, v]);
    }

    return distorted;
}

function undistortPoints(coordinatePair, cameraProfile) {
    // TODO: TAN DISTORTION UNTESTED
    // TODO: Vectorize
    let f = cameraProfile[0];
    let cx = cameraProfile[1];
    let cy = cameraProfile[2];

    let iters = 3;

    let undistorted = [];

    for (let i = 0; i < coordinatePair.length; i++) {
        let u_v_pair = coordinatePair[i];
        let u = u_v_pair[0];
        let v = u_v_pair[1];

        let u_norm_org = (u - cx) / f;
        let v_norm_org = (v - cy) / f;

        let iter_norm_u = u_norm_org;
        let iter_norm_v = v_norm_org;
        for (let j = 1; j < iters; j++) {
            let r2 = iter_norm_u * iter_norm_u + iter_norm_v * iter_norm_v;
            let rad = 1 + (cameraProfile[3] * r2) + (cameraProfile[4] * r2 ** 2) + (cameraProfile[7]);
            let tan_u = 2 * cameraProfile[5] * iter_norm_u * iter_norm_v + cameraProfile[6] * (r2 + 2 * iter_norm_u ** 2);
            let tan_v = cameraProfile[5] * (r2 + 2 * iter_norm_v ** 2) + 2 * cameraProfile[6] * iter_norm_u * iter_norm_v;

            iter_norm_u = (u_norm_org - tan_u) / rad;
            iter_norm_v = (v_norm_org - tan_v) / rad;
        }

        let final_u = iter_norm_u * f + cx;
        let final_y = iter_norm_v * f + cy;
        undistorted.push([final_u, final_y]);
    }

    return undistorted;
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

function checkCoordintes(x, y, height, width) {
    // Ensures that x is between width and height and y is between width and height
    return 0 <= x <= width && 0 <= y <= height;
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
    coords.sort(
        (coordsA, coordsB) => Math.max(
            ...[coordsA[0], coordsA[1][0], coordsA[1][1]]
        ) - Math.max(
            ...[coordsB[0], coordsB[1][0], coordsB[1][1]]
        ));
    for (let i = 0; i < coords.length; i++) {
        let coord = coords[i];
        if (coord[0] !== parseInt(videoObject["index"], 10)) {
            let dltCoeff2 = DLTCoefficients[coord[0]];

            let xCoord = coord[1][0];
            let yCoord = coord[1][1];

            if (CAMERA_PROFILE) {
                let undistortPoints = undistortPoints([[xCoord, yCoord]], CAMERA_PROFILE[coord[0]][0]);
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

                let originalHeight = document.getElementById(videoObject["videoCanvasID"]).height;
                let originalWidth = document.getElementById(videoObject["videoCanvasID"]).width;

                if (!checkCoordintes(0, intercept, originalHeight, originalWidth)) {
                    generateError(
                        "When attempting to draw an epipolar line, a coordinate was produced that didn't fit in the " +
                        "video, please check your DLT coefficients and camera profiles!");
                    return CAMERA_PROFILE;
                }
                tmp.push([0, intercept]);

                let endYCoord = numeric.add(numeric.mul(slope, originalWidth), intercept);


                if (!checkCoordintes(originalWidth, endYCoord, originalHeight, originalWidth)) {
                    generateError(
                        "When attempting to draw an epipolar line, a coordinate was produced that didn't fit in the " +
                        "video, please check your DLT coefficients and camera profiles!");
                    return CAMERA_PROFILE;
                }

                tmp.push([originalWidth, numeric.add(numeric.mul(slope, originalWidth), intercept)])
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
