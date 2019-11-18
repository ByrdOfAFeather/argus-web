// TODO: Investigate getting frame rate manually
// TODO: Display Error:
/*
Media resource blob:http://127.0.0.1:5000/951b0a32-14df-4288-b3e5-cb0a61a32b2f could not be decoded. 127.0.0.1:5000
Media resource blob:http://127.0.0.1:5000/ee92756a-d549-4788-ad05-6eafbfa0ce16 could not be decoded. 127.0.0.1:5000
Media resource blob:http://127.0.0.1:5000/951b0a32-14df-4288-b3e5-cb0a61a32b2f could not be decoded, error: Error Code: NS_ERROR_DOM_MEDIA_FATAL_ERR (0x806e0005)
Details: mozilla::SupportChecker::AddMediaFormatChecker(const mozilla::TrackInfo&)::<lambda()>: Decoder may not have the capability to handle the requested video format with YUV444 chroma subsampling.
 */


// ------------- INTERFACE ------------- \\


// A LIST OF COLORS THAT DEFINE TRACK COLORS IN ORDER
const COLORS = ["rgb(228, 26, 28)", "rgb(55, 126, 184)", "rgb(77, 175, 74)", "rgb(152, 78, 163)",
    "rgb(255, 127, 0)", "rgb(255, 255, 51)", "rgb(166, 86, 40)", "rgb(247, 129, 191)"];
let colorIndex = 0;

// DEBUGGING CONSTANTS
const PINHOLE = 1;
const DEV_FRAME_RATE = 30;

// GLOBALS FOR THE CAMERA PROFILE AND DLT COEFFICENTS
let CAMERA_PROFILE = null;
let DLT_COEFFICIENTS = null;

// COLORSPACE MANAGER
let COLORSPACE = "";

// MANAGER FOR POP OUT WINDOWS
let communicators = [];

// SETTINGS GLOBAL
// AUTO-ADVANCE: IF THIS IS TRUE, THE MOVIE WILL BE MOVED FORWARD ONE FRAME AFTER A CLICK
// SYNC: IF THIS IS TRUE, ALL VIDEOS WILL REMAIN IN THE SAME FRAME
let settings = {
    "auto-advance": true,
    "sync": true
};

// GLOBAL FOR TRACKING THE MOUSE FOR WHERE A POINT IS CLICKED
let mouseTracker = {
    x: 0,
    y: 0,
};

let fileObjects = [];

// TRACKS WHICH VIDEOS ARE IN WHICH FRAMES
// {videoIndex: frameNumber}
let frameTracker = {};

// MAKES SURE SOME THINGS CAN'T HAPPEN WHILE OTHERS ARE HAPPENING
let locks = {
    "can_click": true,
    "init_frame_loaded": false,
    "resizing_mov": false,
};

// KEEPS TRACK OF THE NUMBER OF CAMERAS
let NUMBER_OF_CAMERAS = 0;

// CURRENTLY NOT USEFUL
let currentResizable = null;

// KEEPS TRACK OF THE CLICKED POINTS
// [CAMERA INDEX][TRACK INDEX][POINT]
// POINT: {X: X VALUE, Y: Y_VALUE, FRAME: FRAME_VALUE}
let clickedPoints = [];

// KEEPS TRACK OF TRACKS, THEIR NAMES, THEIR COLOR AND THEIR INDEX
// {[ {name: TRACK_NAME, index: TRACK_INDEX, color: TRACK_COLOR} ], currentTrack: TRACK_VALUE}
let trackTracker = [];

// Global to be set by user.
let PROJECT_NAME = "";

function loadPoints(text) {
    colorIndex = 0;
    clickedPoints = [];
    let iterationLength = trackTracker.tracks.length - 1;
    for (let i = 0; i < iterationLength; i++) {
        removeTrackFromDropDown(1);
    }
    removeTrackFromDropDown(0);

    let reader = new FileReader();
    reader.onload = function () {
        let frameIndexed = reader.result.split("\n");
        for (let i = 0; i < frameIndexed.length; i++) {
            let localPoints = frameIndexed[i].split(",");
            localPoints.pop();
            let numberOfTracks = localPoints.length / (2 * NUMBER_OF_CAMERAS);
            for (let j = 0; j < numberOfTracks; j++) {
                let trackStartIndex = NUMBER_OF_CAMERAS * 2 * j;
                if (i === 0) {
                    let trackName = localPoints[trackStartIndex].split("_")[0];
                    if (j === 0) {
                        addTrackToDropDown(trackName, false);
                    } else {
                        addTrackToDropDown(trackName);
                    }
                } else {
                    for (let q = 0; q < NUMBER_OF_CAMERAS; q++) {
                        if (clickedPoints[q] === undefined) {
                            clickedPoints[q] = [];
                        }

                        if (clickedPoints[q][j] === undefined) {
                            clickedPoints[q][j] = [];
                        }

                        let pointStartIndex = trackStartIndex + (q * 2);
                        if (Number.isNaN(parseInt(localPoints[pointStartIndex]))) {
                            continue;
                        }
                        let point = {
                            x: parseFloat(localPoints[pointStartIndex]),
                            y: parseFloat(localPoints[pointStartIndex + 1]),
                            frame: i + .001,
                        };
                        clickedPoints[q][j].push(point);
                    }
                }
            }
        }
        clickedPoints.sort(sortByFrame);
        for (let i = 0; i < clickedPoints.length; i++) {
            let currentTrack = trackTracker.currentTrack;
            let currentClickedPoints = getClickedPoints(i, currentTrack);

            let callback = function (i) {
                videos[i].clearPoints();
                videos[i].drawPoints(currentClickedPoints);
                videos[i].drawLines(currentClickedPoints);
            };
            let message = messageCreator("loadPoints", {
                points: currentClickedPoints
            });
            updateLocalOrCommunicator(i, callback, message);
        }
    };

    reader.readAsText(text[0]);
}

function updateCommunicators(message) {
    communicators.forEach((communicator) => communicator.communicator.postMessage(message));
}


function updateLocalOrCommunicator(index, localCallback, message) {
    let currentCommunicator = communicators.find((elem) => elem.index === index);
    if (currentCommunicator === undefined) {
        localCallback(index);
    } else {
        currentCommunicator.communicator.postMessage(message);
    }
}

function updateAllLocalOrCommunicator(localCallback, message, ignoreParam = null) {
    for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
        if (ignoreParam !== null) {
            if (ignoreParam === i) {
                continue;
            }
        }
        updateLocalOrCommunicator(i, localCallback, message);
    }
}


function exportConfig(autoSaved=false) {
    let videoObjects = [];
    for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {

        let newVideo = {
            src: videos[i].video.src,
            offset: videos[i].offset
        };

        if (communicators.find((elem) => elem.index === i) !== undefined) {
            newVideo.poppedOut = true;
        } else {
            newVideo.poppedOut = false;
        }

        newVideo.name = Video.parseVideoLabel(
            document.getElementById(
                videos[i].videoLabelID
            ).innerText
        ).TITLE;

        videoObjects.push(newVideo);
    }

    let output_json = {
        videos: videoObjects,
        title: PROJECT_NAME,
        dateSaved: Date(),
        points: clickedPoints,
        frameTracker: frameTracker,
        trackTracker: trackTracker,
        cameraProfile: CAMERA_PROFILE,
        dltCoefficents: DLT_COEFFICIENTS,
        settings: settings
    };

    let csrftoken = $("[name=csrfmiddlewaretoken]").val();

    $.ajax({
        // TODO: Change url
        url: "http://127.0.0.1:8000/api/saved_states",
        method: "POST",
        data: {
            json: JSON.stringify(output_json),
            autosave: autoSaved === true ? "true": ""
        },
        headers: {
            "X-CSRFToken": csrftoken
        },

        success: function () {
            alert("Results Saved!");
        },
        error: function (error) {
        }
    });
}

function loadSavedState(config) {
    colorIndex = 0;
    clickedPoints = [];

    if (trackTracker.tracks !== undefined) {
        let iterationLength = trackTracker.tracks.length - 1;
        for (let i = 0; i < iterationLength; i++) {
            removeTrackFromDropDown(1);
        }
        removeTrackFromDropDown(0);
    } else {
        loadSettings();
    }

    clickedPoints = config.points;
    for (let i = 1; i < config.trackTracker.tracks.length; i++) {
        addTrackToDropDown(trackTracker.tracks[i].name);
    }

    let cameras = [];
    for (let i = 0; i < config.videos.length; i++) {
        cameras.push(i);
    }

    frameTracker = config.frameTracker;
    CAMERA_PROFILE = config.cameraProfile;
    DLT_COEFFICIENTS = config.dltCoefficents;
    settings = config.settings;

    for (let i = 0; i < config.videos.length; i++) {
        let currentVideo = config.videos[i];

        let callback = null;
        if (currentVideo.poppedOut === true) {
            callback = () => {
                popOutvideo({target: {id: `popVideo-${i}`}}, currentVideo.src);
            }
        } else {
            callback = () => {
                let points = getClickedPoints(i, trackTracker.currentTrack);
                videos[i].drawPoints(points);
                videos[i].drawLines(points);
                changeTracks(config.trackTracker.currentTrack, cameras);
            };
        }
        loadVideosIntoDOM(currentVideo.src, i, currentVideo.name, mainWindowAddNewPoint, true, null, callback);
    }
}

/// TRACK MANAGEMENT ///


function removeTrackFromDropDown(trackIndex) {
    if (trackIndex === trackTracker["currentTrack"]) {
        $("#current-track-display").text(`Current Track: ${trackTracker["tracks"][0].name}`);
    }
    $(`#track-${trackTracker.tracks[trackIndex].name.replace(/ /g, "-")}`).remove();
    removeTrack(trackIndex);
    // if (trackIndex.hasClass("is-active")) {
    //     trackIndex.removeClass("is-active");
    // }
}


/** @namespace */
function removeTrack(trackIndex) {
    /**
     * Removes a track from the trackTracker global variable
     * @param {Number} trackIndex The index of the track requested to be deleted
     * @returns {undefined}
     */
    for (let cameraIndex = 0; cameraIndex < NUMBER_OF_CAMERAS; cameraIndex++) {
        // Special case when loading points
        if (clickedPoints[cameraIndex] === undefined) {
            clickedPoints[cameraIndex] = [];
        } else {
            clickedPoints[cameraIndex].splice(trackIndex, 1);
        }
    }

    //TODO WHY DO I DO THIS?
    if (trackTracker["tracks"][trackIndex].index === trackTracker["currentTrack"]) {
        if (trackIndex !== 0) {
            let cameraIndex = [];
            for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
                cameraIndex.push(i);
                if (clickedPoints[cameraIndex] === undefined) {
                    clickedPoints[cameraIndex] = [];
                }
                if (clickedPoints[cameraIndex][0] === undefined) {
                    clickedPoints[cameraIndex][0] = [];
                }
            }
            changeTracks(0, cameraIndex);
        }
    }
    trackTracker["tracks"].splice(trackIndex, 1);
}

function addTrackToDropDown(trackName, deleteButton = true) {
    if (trackName.length === 0) {
        generateError("Track name can't be empty!");
    } else if (trackTracker["tracks"].some((trackObject) => trackObject.name === trackName)) {
        generateError("You can't add a track with the same name twice!");
    } else {
        addNewTrack(trackName);
        $("#current-track-display").text(`Current Track: ${trackName}`);
        let curIndex = trackTracker["currentTrack"];
        let newDropdownItem = $(`
                <div id=track-${trackName.replace(/ /g, "-")} class="dropdown-content">
                <div class="container">
                    <div class="columns is-vcentered">

                        <div class="column is-narrow">
                            <div id=track-${curIndex} class="dropdown-item has-text-centered">
                                ${trackName}
                            </div>
                        </div>
                        <div class="column"></div>
                        ${deleteButton === true ? `<div class="column is-narrow"><button id="track-${curIndex}-delete" class="dropdown-item-delete delete">Delete</button></div>` :
            ``
            }
                        
                        </div>
                    </div>
                    </div>
`);
        $("#track-dropdown").append(newDropdownItem);
    }
}


/** @namespace */
function addNewTrack(trackName) {
    /**
     * Adds a track to the trackTracker global variable
     * @param{trackNumber} trackNumber
     */
    let currentTrackIndex = trackTracker["tracks"].length;
    colorIndex += 1;
    trackTracker["tracks"].push({"name": trackName, "index": currentTrackIndex, "color": COLORS[colorIndex]});
    if (colorIndex === COLORS.length) {
        colorIndex = 0;
    }

    // Change the track for all videos
    for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
        // Special case for loading points
        if (clickedPoints[i] === undefined) {
            clickedPoints[i] = [];
        }

        clickedPoints[i][currentTrackIndex] = [];
        changeTracks(currentTrackIndex, [i]);
    }

    updateCommunicators({
        "type": "addNewTrack",
        "data": {
            "track": {
                index: currentTrackIndex,
                track: {"name": trackName, "index": currentTrackIndex, "color": COLORS[colorIndex]}
            }
        }
    });

}

/// END TRACK MANAGEMENT ///


/// DRAWING ///


function getVideosWithTheSameFrame(video) {
    return Object.keys(frameTracker).filter(
        (videoIndex) => Math.floor(frameTracker[videoIndex]) === Math.floor(frameTracker[video]));
}


function getPointsInFrame(videosWithTheSameFrame, frameNumber) {
    let points = [];
    let lines = [];
    for (let videoIndex = 0; videoIndex < videosWithTheSameFrame.length; videoIndex++) {
        let curVideoIndex = videosWithTheSameFrame[videoIndex];
        let localPoints = clickedPoints[curVideoIndex][trackTracker["currentTrack"]];
        let indexOfPoints = 0;
        if (localPoints.filter(function (point, index) {
            if (Math.floor(point.frame) === Math.floor(frameNumber)) {
                indexOfPoints = index;
                return true;
            } else {
                return false;
            }
        }).length !== 0) {
            points.push({
                videoIndex: videosWithTheSameFrame[videoIndex],
                pointIndex: indexOfPoints
            });
            lines.push(getEpipolarLines(curVideoIndex, DLT_COEFFICIENTS, indexOfPoints));
        }
    }
    return [points, lines];
}


function drawDiamonds(videoIndex, result) {
    // Video.clearCanvases();
    let currentPoint = reconstructUV(DLT_COEFFICIENTS[videoIndex], result[result.length - 1]);

    if (!checkCoordintes(currentPoint[0][0], currentPoint[0][1],
        videos[videoIndex].epipolarCanvas.height, videos[videoIndex].epipolarCanvas.width)) {
        generateError("Points that did not exist were calculated when locating the " +
            "point in 2D space, please check your DLT coefficients and camera profiles");
    }


    let callback = function (i) {
        videos[i].drawDiamond(
            currentPoint[0][0],
            currentPoint[1][0], 10, 10,
        );
    };
    let message = messageCreator("drawDiamond", {
        point1: currentPoint[0][0],
        point2: currentPoint[1][0],
    });
    updateLocalOrCommunicator(parseInt(videoIndex, 10), callback, message);
}

function getEpipolarLinesOrUnifiedCoord(videoCalledFrom, frameNumber) {
    let videosWithTheSameFrame = getVideosWithTheSameFrame(videoCalledFrom);
    if (videosWithTheSameFrame.length > 1 && DLT_COEFFICIENTS !== null) {
        // TODO : Come back and rename variables
        let pointsAndLines = getPointsInFrame(videosWithTheSameFrame, frameNumber);
        let points = pointsAndLines[0];
        let lines = pointsAndLines[1];

        if (points.length >= 2) {
            let pointsToReconstruct = [];
            for (let i = 0; i < points.length; i++) {
                let currentVideoIndex = points[i].videoIndex;
                let currentPointIndex = points[i].pointIndex;
                let currentTrack = trackTracker.currentTrack;
                pointsToReconstruct.push([clickedPoints[currentVideoIndex][currentTrack][currentPointIndex]]);
            }
            uvToXyz(pointsToReconstruct,
                null, DLT_COEFFICIENTS).then(
                (result) => {
                    for (let i = 0; i < 1; i++) {
                        for (let j = 0; j < points.length; j++) {
                            let videoIndex = points[j].videoIndex;
                            drawDiamonds(videoIndex, result);
                        }
                    }
                }
            );
        } else {
            for (let i = 0; i < lines.length; i++) {
                let lineInformation = lines[i][0][0];
                let videoIndex = lines[i][0][1];

                let callback = (i) => {
                    videos[i].drawEpipolarLine(lineInformation);
                };
                let message = messageCreator("drawEpipolarLine", {
                    "tmp": lineInformation
                });

                updateLocalOrCommunicator(videoIndex, callback, message);
            }
        }
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

function changeColorSpace(colorSpace) {
    COLORSPACE = colorSpace === RGB ? "grayscale(0%)" : "grayscale(100%)";
    let callback = (i) => {
        videos[i].loadFrame();
    };
    let message = messageCreator("changeColorSpace", {colorSpace: colorSpace});
    updateAllLocalOrCommunicator(callback, message);
}

function handlePopoutDeath(data) {
    // rerender video
    videos[data.index].clearPoints();
    let index = null;
    communicators.find(function (elm, iterIndex) {
        if (elm.index === data.index) {
            index = iterIndex;
            return true;
        }
    });
    communicators.splice(index, 1);

    $(`#canvas-columns-${data.index}`).show();
    let localClickedPoints = getClickedPoints(data.index, trackTracker.currentTrack);
    videos[data.index].goToFrame(frameTracker[data.index]);


    // Load Points afterwards to remove jank
    let drawPoints = function () {
        videos[data.index].drawPoints(localClickedPoints);
        videos[data.index].drawLines(localClickedPoints);
        $(videos[data.index].video).unbind("canplay", drawPoints);
    };
    $(videos[data.index].video).on("canplay", drawPoints);

    getEpipolarLinesOrUnifiedCoord(data.index, frameTracker[data.index]);
}

function handlePopoutFrameChange(data) {
    frameTracker[data.videoID] = data.newFrame;

    if (settings["sync"]) {
        for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
            frameTracker[i] = data.newFrame;
        }
        let callback = (i) => {
            videos[i].goToFrame(data.newFrame);
        };
        let message = messageCreator("goToFrame",
            {"frame": data.newFrame});
        updateAllLocalOrCommunicator(callback, message);
    }
    getEpipolarLinesOrUnifiedCoord(data.videoID, data.newFrame);
}

function handlePopoutNewPoint(data) {
    let videoIndex = parseInt(data.videoID, 10);
    let track = data.track;
    let currentFrame = data.point.frame;

    let localPoints = getClickedPoints(videoIndex, track);
    localPoints[data.index] = data.point;

    frameTracker[videoIndex] = currentFrame;

    if (settings["auto-advance"]) {
        currentFrame += 1;
        let message = messageCreator("goToFrame", {"frame": currentFrame});
        if (settings["sync"] === true) {
            for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
                frameTracker[i] = currentFrame;
            }
            let callback = (i) => {
                videos[i].goToFrame(currentFrame);
            };

            updateAllLocalOrCommunicator(callback, message);
        } else {
            let currentCommunicator = communicators.find((elem) => elem.index === index);
            currentCommunicator.postMessage(message);
        }
    }

    getEpipolarLinesOrUnifiedCoord(videoIndex, currentFrame);
}

function handlePopoutChange(message) {
    let messageContent = message.data;
    if (messageContent.type === "newPoint") {
        handlePopoutNewPoint(messageContent.data);
    } else if (messageContent.type === "newFrame") {
        handlePopoutFrameChange(messageContent.data)
    } else if (messageContent.type === "popoutDeath") {
        handlePopoutDeath(messageContent.data);
    } else if (messageContent.type === "initLoadFinished") {
        getEpipolarLinesOrUnifiedCoord(messageContent.data.index, frameTracker[messageContent.data.index]);
    }
}

function popOutvideo(event, videoURL) {
    // TODO this function will probably have to be defined in the template
    // TODO Needs to be locks so that a new video cannot be popped out until the current one has finished
    let init_communicator = new BroadcastChannel("unknown-video");
    let videoIndex = parseInt(event.target.id.split("-")[1], 10);
    init_communicator.onmessage = function (_) {
        init_communicator.postMessage({
            "dataURL": videoURL,
            "index": videoIndex,
            "videoTitle": parseVideoLabel(
                document.getElementById(
                    videos[videoIndex].videoLabelID
                ).innerText
            ).TITLE,
            "clickedPoints": clickedPoints,
            "offset": videos[videoIndex].offset,
            "currentTracks": trackTracker,
            "initFrame": frameTracker[videoIndex],
            "currentColorSpace": COLORSPACE,
        });
        init_communicator.close();
        let master_communicator = new BroadcastChannel(`${videoIndex}`);
        master_communicator.onmessage = handlePopoutChange;
        communicators.push({"communicator": master_communicator, "index": videoIndex});
    };

    let currentSection = $(`#canvas-columns-${videoIndex}`);
    let height = parseInt(currentSection.css("height"), 10);
    let width = parseInt(currentSection.css("width"), 10);
    currentSection.hide();
    window.open("http://127.0.0.1:8000/clicker/popped_window", `${event.target.id}`,
        `location=yes,height=${600},width=${800},scrollbars=yes,status=yes`);
}

/// LOAD FILE FUNCTIONS ///

function parseDLTCoefficents(text, separator) {
    let loopText = text.split("\n").filter((value) => value !== "");
    let returnVector = [];
    for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
        returnVector[i] = [];
    }
    for (let i = 0; i < loopText.length; i++) {
        loopText[i] = loopText[i].split(separator);
        for (let j = 0; j < NUMBER_OF_CAMERAS; j++) {
            returnVector[j].push(parseFloat(loopText[i][j]));
        }
    }
    return returnVector;
}

function parseCameraProfile(text, separator) {
    // NOTE: Only works with pinhole for now


    const profiles = text.split("\n").filter((value) => value !== "");
    const numberOfProfiles = profiles.length;

    if (numberOfProfiles !== NUMBER_OF_CAMERAS) {
        if (numberOfProfiles > NUMBER_OF_CAMERAS) {
            // TODO: PROD: Remake into a modal
            generateError(`I can't use ${numberOfProfiles} ${numberOfProfiles > 1 ? "profiles" : "profile"} 
            with only ${NUMBER_OF_CAMERAS} ${NUMBER_OF_CAMERAS > 1 ? "cameras" : "camera"} `);
        } else {

            // TODO: PROD: Remake into a modal
            generateError(`I can't use only ${numberOfProfiles} ${numberOfProfiles > 1 ? "profiles" : "profile"} 
            with ${NUMBER_OF_CAMERAS} ${NUMBER_OF_CAMERAS > 1 ? "cameras" : "camera"} `);
        }
    }

    let returnVector = [];
    for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
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
    if (points.length === 0) {
        return null;
    }

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
    let duration = videos[0].video.duration;
    let frames = Math.floor(duration * DEV_FRAME_RATE);

    let exportablePoints = [];
    let header = [];
    for (let j = 0; j < trackTracker.tracks.length; j++) {
        for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
            header.push(`${trackTracker.tracks[j].name}_cam_${i + 1}_x`);
            header.push(`${trackTracker.tracks[j].name}_cam_${i + 1}_y`);
        }
    }
    exportablePoints.push(header.join(",") + ",\n");
    for (let i = 0; i < frames; i++) {
        let frameArray = [];
        for (let q = 0; q < trackTracker.tracks.length; q++) {
            for (let j = 0; j < NUMBER_OF_CAMERAS; j++) {
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
<section class="section"> 
        <hr>
        <div class="columns is-multiline is-vcentered">
            <div class="column is-12 has-text-centered"><h1 class="title">SETTINGS</h1></div>
            <div class="column">
                <div class="columns is-centered is-vcentered is-multiline">
                    <div class="column is-12">
                        <div class="centered-file-input file">
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
                    <div class="column is-12">
                        <div class="centered-file-input file">
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
            </div>
                
            <div class="column">
                <div class="control">
                    <label class="label">Add New Track: </label>
                    <input id="new-track-input" type="text">
                    <input id="add-track-button" type="button" value="=>">
                </div>
            </div>
            
            <div class="columns is-centered is-vcentered">
                <div class="column">
                    <div id="track-dropdown-container" class="dropdown">
                        <div class="dropdown-trigger">
                            <button id="track-dropdown-trigger" class="button" aria-haspopup="true" 
                            aria-controls="track-dropdown">
                                <!-- TODO: ADD DOWN ARROW --> 
                                <span>Select Track</span>
                            </button>
                        </div>
                        <div class="dropdown-menu" id="track-dropdown" role="menu">
                            <div id="track-Track-1" class="dropdown-content">
                                <div id=track-0 class="dropdown-item has-text-centered">
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
            
            <div class="column">
                <div class="columns is-centered is-vcentered is-multiline">
                    <div class="column is-12">
                        <div class="column has-text-centered">
                            <button id="save-points-button" class="button">Save Points</button>
                        </div>  
                    </div>
                    
                    <div class="column is-12">
                        <div class="centered-file-input file">
                            <label class="file-label">
                                <input id="load-points-button" class="file-input" accept=".csv" type=file>
                                    <span class="file-cta">
                                        <span class="file-label">
                                            Load Points 
                                        </span>
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="column">
                <label class="label">Auto Advance:</label>
                <input id="auto-advance-setting" type="checkbox" class="checkbox" onclick="settings['auto-advance'] = !settings['auto-advance'];" checked="${settings["auto-advance"] ? "checked" : ""}">
                <label class="label">Sync:</label>
                <input id="sync-setting" type="checkbox" onclick="settings['sync'] = !settings['sync'];" class="checkbox" checked="${settings["sync"] ? "checked" : ""}">
            </div>
        </div>
        <hr>
</section>
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
        let trackID = parseInt(event.target.id.split("-")[1], 10);
        let cameraIndex = [];
        for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
            cameraIndex.push(i);
        }
        changeTracks(trackID, cameraIndex);
        if (communicators.length !== 0) {
            updateCommunicators({
                type: "changeTrack",
                data: {
                    "track": trackID
                }
            });
        }


        $("#current-track-display").text(`Current Track: ${trackTracker["tracks"][trackTracker["currentTrack"]].name}`);
        if (track_container.hasClass("is-active")) {
            track_container.removeClass("is-active");
        }
    });

    $("#add-track-button").on("click", function (_) {
        let newTrack = $("#new-track-input").val();
        addTrackToDropDown(newTrack);
    });

    track_dropdown.on("click", ".dropdown-item-delete", function (event) {
        let curTrackIndex = parseInt(event.target.id.split("-")[1], 10);
        removeTrackFromDropDown(curTrackIndex);
    });

    color_dropdown.on("click", ".dropdown-item", function (event) {
        changeColorSpace(event.target.id === "rgb" ? RGB : GREYSCALE);
        if (color_container.hasClass("is-active")) {
            color_container.removeClass("is-active");
        }
    });

    $("#save-points-button").on("click", exportPoints);
    $("#load-points-button").on("change", function (_) {
        let selectedFiles = Array.from($("#load-points-button").prop("files"));
        loadPoints(selectedFiles);
    });
}


function mainWindowAddNewPoint(event) {
    if (locks["can_click"]) {
        let index = event.target.id.split("-")[1];
        let point = Video.createPointObject(index);
        videos[index].addNewPoint(point);

        if (settings["auto-advance"]) {
            if (settings["sync"]) {
                for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
                    frameTracker[i] = point.frame;
                }

                let localCallback = (index) => {
                    videos[index].moveToNextFrame();
                };

                let message = messageCreator("goToFrame", {frame: point.frame + 1});

                updateAllLocalOrCommunicator(localCallback, message);
            } else {
                videos[index].moveToNextFrame();
            }
        } else {
            Video.clearCanvases();
            getEpipolarLinesOrUnifiedCoord(index, frameTracker[index]);
        }
    }
}


function loadVideos(files) {
    $("#starter-menu").remove();
    loadSettings();
    trackTracker = {"tracks": [{"name": "Track 1", "index": 0, "color": COLORS[colorIndex]}], "currentTrack": 0};
    colorIndex += 1;


    files.forEach((file, index) => {
        window.localStorage.setItem("test", file);
        NUMBER_OF_CAMERAS += 1;
        let curURL = URL.createObjectURL(file);
        loadVideosIntoDOM(curURL, index, file.name, mainWindowAddNewPoint, true);
    });
}

/// END LOAD FUNCTIONS ///


function goForwardAFrame(id) {
    let frame = frameTracker[id] + 1;
    if (settings["sync"] === true) {

        let callback = function (i) {
            videos[i].moveToNextFrame();
        };
        let message = messageCreator("goToFrame", {frame: frame});

        updateAllLocalOrCommunicator(callback, message);
        for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
            frameTracker[i] = frame;
        }

    } else {
        videos[id].moveToNextFrame();
    }
    getEpipolarLinesOrUnifiedCoord(id, frame);
}

function goBackwardsAFrame(id) {
    if (frameTracker[id] < 2) {
        return;
    }

    let frame = frameTracker[id] - 1;
    if (settings["sync"] === true) {
        let callback = function (i) {
            videos[i].goToFrame(frame);
        };
        let message = messageCreator("goToFrame", {frame: frame});

        updateAllLocalOrCommunicator(callback, message);
        for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
            frameTracker[i] = frame;
        }

    } else {
        videos[id].goToFrame(frameTracker[id] - 1);
    }
    getEpipolarLinesOrUnifiedCoord(id, frame);
}

function goToInputFrame(index) {
    let genericModal = $("#generic-input-modal");

    let validate = (_) => {
        let currentFrame = $("#generic-modal-input").val();
        let frameToGoTo = parseInt(currentFrame, 10);
        if (isNaN(frameToGoTo) || frameToGoTo % 1 !== 0) {
            generateError("Frame must be valid integer!");
        } else {
            frameToGoTo += .001;
            if (settings["sync"]) {
                for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
                    frameTracker[i] = frameToGoTo;
                }

                let callBack = function (i) {
                    videos[i].goToFrame(frameToGoTo);
                };
                let message = messageCreator("goToFrame", {"frame": frameToGoTo});
                updateAllLocalOrCommunicator(callBack, message);
            } else {
                videos[index].goToFrame(frameToGoTo);
            }
            getEpipolarLinesOrUnifiedCoord(index, frameToGoTo);
            genericModal.removeClass("is-active");
            $("#canvas-0").focus();
        }
    };

    let close = (_) => {
        genericModal.removeClass("is-active");
    };

    let label = "What frame would you like to go to?";
    getGenericInput(label, validate, close);

}

function handleKeyboardInput(e) {
    let id;
    try {
        id = parseInt(e.target.id.split("-")[1], 10);
    } catch (e) {
        return;
    }


    if (String.fromCharCode(e.which) === "Q") {
        triggerResizeMode();
    } else if (String.fromCharCode(e.which) === "F") {
        // TODO: Bug when spamming F (lock) [11-04-19: seems resolved]
        goForwardAFrame(id);
    } else if (String.fromCharCode(e.which) === "B") {
        goBackwardsAFrame(id);
    } else if (String.fromCharCode(e.which) === "G") {
        goToInputFrame(id);
    }
}


function sendKillNotification() {
    updateCommunicators(messageCreator(
        "mainWindowDeath",
        {"none": "none"}
    ))
}

function generateSavedState(result, results, index) {
    return $(`
                <div class="container">
                    <p>${result.projectName}</p>
                    <p>${result.savedDate}</p>
                    <button class="result button" id=result-${index}">Load ${index}</button>
                </div>
    `)
}

function displaySavedStates(results) {
    $("#starter-menu").remove();
    let section = $("#saved-states-section");
    for (let i = 0; i < results.length; i++) {
        section.append(generateSavedState(results[i], results, i));
        $(`.section`).on("click", ".result", function () {
            loadSavedState(results[i])
        });
    }
}


function handleContinueWorking() {
    //TODO Change url
    $.ajax({
            url: "http://127.0.0.1:8000/api/saved_states",
            method: "GET",
            success: (result) => {
                displaySavedStates(result.states);
            },
            error: (error) => {
                if (error.status === 401) {
                    generateError("You have to login before you can access this feature!",
                        $(`<button onclick="goToLogin()">Login</button>`));
                }
            }
        }
    )
}


$(document).ready(function () {

    runAnimations();

    let fileInput = document.getElementById("video-file-input");
    fileInput.onchange = function (_) {
        let selectedFiles = Array.from(fileInput.files);
        loadVideos(selectedFiles);
    };

    $("#continue-working-button").on("click", handleContinueWorking);

    $(window).on('beforeunload', sendKillNotification);

    setInterval(function() {exportConfig(true)},
        600000);
});