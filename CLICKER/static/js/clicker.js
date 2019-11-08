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
            let numberOfTracks = localPoints.length / (2 * numberOfCameras);
            for (let j = 0; j < numberOfTracks; j++) {
                let trackStartIndex = numberOfCameras * 2 * j;
                if (i === 0) {
                    let trackName = localPoints[trackStartIndex].split("_")[0];
                    if (j === 0) {
                        addTrackToDropDown(trackName, false);
                    } else {
                        addTrackToDropDown(trackName);
                    }
                } else {
                    for (let q = 0; q < numberOfCameras; q++) {
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
                let videoObject = videoObjectSingletonFactory(i);
                clearPoints(videoObject);
                drawPoints(currentClickedPoints, videoObject);
                drawLines(currentClickedPoints, videoObject);
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
    let currentCommunicator = communicators.find((elem) => elem.index === `${index}`);
    if (currentCommunicator === undefined) {
        localCallback(index);
    } else {
        currentCommunicator.communicator.postMessage(message);
    }
}

function exportConfig() {
    let videos = [];
    for (let i = 0; i < numberOfCameras; i++) {
        videos.push(document.getElementById(videoObjectSingletonFactory(i).videoID).src);
    }

    let output_json = {
        videos: videos,
        points: clickedPoints,
        frameTracker: frameTracker,
        trackTracker: trackTracker,
        offsetTracker: offsetTracker,
        cameraProfile: CAMERA_PROFILE,
        dltCoefficents: DLT_COEFFICIENTS,
        settings: settings
    };

    download("config.json", JSON.stringify(output_json));
}

function loadConfig(text) {
    let config = JSON.parse(text);
}

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


function removeTrackFromDropDown(trackIndex) {
    if (trackIndex === trackTracker["currentTrack"]) {
        $("#current-track-display").text(`Current Track: ${trackTracker["tracks"][0].name}`);
    }
    $(`#track-${trackTracker.tracks[trackIndex].index}`).parent().remove();
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
    for (let cameraIndex = 0; cameraIndex < numberOfCameras; cameraIndex++) {
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
            for (let i = 0; i < numberOfCameras; i++) {
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
                <div id=${trackName} class="dropdown-content">
                    <div id=track-${curIndex} class="dropdown-item">
                        ${trackName}
                    </div>
                </div>
            `);
        $("#track-dropdown").append(newDropdownItem);
        if (deleteButton) {
            $(`#${trackName}`).append(`<button id="track-${curIndex}-delete" class="dropdown-item-delete">Delete</button>`);
        }
    }
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

        // Special case for loading points
        if (clickedPoints[cur_videoObject["index"]] === undefined) {
            clickedPoints[cur_videoObject["index"]] = [];
        }

        clickedPoints[cur_videoObject["index"]][currentTrackIndex] = [];
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


function getEpipolarLinesOrUnifiedCoord(frameNumber, videoObject) {
    let videosWithTheSameFrame = Object.keys(frameTracker).filter(
        (videoIndex) => Math.floor(frameTracker[videoIndex]) === Math.floor(frameTracker[videoObject["index"]]));
    if (videosWithTheSameFrame.length > 1 && DLT_COEFFICIENTS !== null) {
        // TODO : Come back and rename variables
        let enoughPointsFor3DEstimation = [];
        let lines = [];
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
                enoughPointsFor3DEstimation.push({
                    videoIndex: videosWithTheSameFrame[videos],
                    pointIndex: indexOfPoints
                });
                lines.push(getEpipolarLines(videoObjectSingletonFactory(videos), DLT_COEFFICIENTS, indexOfPoints));
            }
        }
        if (enoughPointsFor3DEstimation.length === numberOfCameras) {
            let pointsToReconstruct = [];
            for (let i = 0; i < enoughPointsFor3DEstimation.length; i++) {
                let currentVideoIndex = enoughPointsFor3DEstimation[i].videoIndex;
                let currentPointIndex = enoughPointsFor3DEstimation[i].pointIndex;
                let currentTrack = trackTracker.currentTrack;
                pointsToReconstruct.push([clickedPoints[currentVideoIndex][currentTrack][currentPointIndex]]);
            }
            uvToXyz(pointsToReconstruct,
                null, DLT_COEFFICIENTS).then(
                (result) => {
                    for (let i = 0; i < 1; i++) {
                        for (let j = 0; j < enoughPointsFor3DEstimation.length; j++) {
                            // todo a little janky
                            let currentVideoIndex = enoughPointsFor3DEstimation[j].videoIndex;
                            let epipolarCanvas = document.getElementById(videoObjectSingletonFactory(currentVideoIndex)["epipolarCanvasID"]);
                            epipolarCanvas.getContext("2d").clearRect(0, 0, epipolarCanvas.width, epipolarCanvas.height);
                            let currentPoint = reconstructUV(DLT_COEFFICIENTS[currentVideoIndex], result[result.length - 1]);

                            if (!checkCoordintes(currentPoint[0][0], currentPoint[0][1],
                                epipolarCanvas.height, epipolarCanvas.width)) {
                                generateError("Points that did not exist were calculated when locating the " +
                                    "point in 2D space, please check your DLT coefficients and camera profiles");
                            }


                            let callback = function (i) {
                                drawDiamond(
                                    currentPoint[0][0],
                                    currentPoint[1][0], 10, 10,
                                    videoObjectSingletonFactory(i)
                                );
                            };
                            let message = messageCreator("drawDiamond", {
                                point1: currentPoint[0][0],
                                point2: currentPoint[1][0],
                            });
                            updateLocalOrCommunicator(currentVideoIndex, callback, message);
                        }
                    }
                }
            );
        } else {
            for (let i = 0; i < lines.length; i++) {
                let lineInformation = lines[i][0][0];
                let videoIndex = lines[i][0][1];
                let currentCommunicator = communicators.find((elem) => elem.index === `${videoIndex}`);
                if (currentCommunicator === undefined) {
                    drawEpipolarLine(lineInformation, videoObjectSingletonFactory(videoIndex));
                } else {
                    currentCommunicator.communicator.postMessage(messageCreator("drawEpipolarLine", {
                        "tmp": lineInformation
                    }));
                }
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

function handlePopoutDeath(data) {
    // rerender video
    let index = null;
    communicators.find(function (elm) {
        if (elm.index === `${data.videoID}`) {
            index = elm.index;
            return true;
        }
    });
    communicators.splice(index, 1);

    $(`#canvas-columns-${data.videoID}`).show();
    let videoObject = videoObjectSingletonFactory(data.videoID);
    let localClickedPoints = getClickedPoints(data.videoID, trackTracker.currentTrack);
    drawPoints(localClickedPoints, videoObject);
    drawLines(localClickedPoints, videoObject);
    goToFrame(frameTracker[data.videoID], videoObject);
}

function handlePopoutFrameChange(data) {
    frameTracker[data.videoID] = data.newFrame;
    if (settings["sync"]) {
        for (let i = 0; i < numberOfCameras; i++) {
            if (i === parseInt(data.videoID, 0)) {
                continue;
            }
            let currentCommunicator = communicators.find((elem) => elem.index === `${i}`);
            if (currentCommunicator === undefined) {
                goToFrame(data.newFrame, videoObjectSingletonFactory(i));
            } else {
                frameTracker[i] = data.newFrame;
                currentCommunicator.communicator.postMessage(messageCreator("goToFrame",
                    {"frame": data.newFrame}));
            }
        }
    }
    getEpipolarLinesOrUnifiedCoord(data.newFrame, videoObjectSingletonFactory(data.videoID));
}

function handlePopoutNewPoint(data) {
    let videoIndex = parseInt(data.videoID, 10);
    let pointData = data.point;
    let track = data.track;
    let currentFrame = data.currentFrame;
    let currentVideoObject = videoObjectSingletonFactory(videoIndex);

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
        drawPoint(pointData.x, pointData.y, 2, currentVideoObject);
    }

    frameTracker[videoIndex] = currentFrame;

    if (settings["sync"] === true) {
        for (let i = 0; i < numberOfCameras; i++) {
            let currentCommunicator = communicators.find((elem) => elem.index === `${i}`);

            if (currentCommunicator === undefined) {
                goToFrame(currentFrame, videoObjectSingletonFactory(i));
            } else if (i === videoIndex) {
                continue;
            } else {
                frameTracker[i] = currentFrame;
                currentCommunicator.communicator.postMessage(messageCreator("goToFrame", {"frame": currentFrame}));
            }
        }
    }

    getEpipolarLinesOrUnifiedCoord(currentFrame, currentVideoObject);
}

function handlePopoutChange(message) {
    let messageContent = message.data;
    if (messageContent.type === "newPoint") {
        handlePopoutNewPoint(messageContent.data);
    } else if (messageContent.type === "newFrame") {
        handlePopoutFrameChange(messageContent.data)
    } else if (messageContent.type === "popoutDeath") {
        handlePopoutDeath(messageContent.data);
    } else {

    }
}

function popOutvideo(event, videoURL) {
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
            ).TITLE,
            "clickedPoints": clickedPoints,
            "offset": offsetTracker[videoIndex][0]["offset"],
            "currentTracks": trackTracker,
            "initFrame": frameTracker[videoIndex]
        });
        init_communicator.close();
        let master_communicator = new BroadcastChannel(`${videoIndex}`);
        master_communicator.onmessage = handlePopoutChange;
        communicators.push({"communicator": master_communicator, "index": videoIndex});
    };

    $(`#canvas-columns-${videoIndex}`).hide();
    window.open("http://127.0.0.1:8000/clicker/popped_window", `${event.target.id}`,
        'location=yes,height=600,width=800,scrollbars=yes,status=yes');
}

/// LOAD FILE FUNCTIONS ///

function parseDLTCoefficents(text, separator) {
    let loopText = text.split("\n").filter((value) => value !== "");
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
    let duration = document.getElementById(videoObjectSingletonFactory(0).videoID).duration;
    let frames = Math.floor(duration * DEV_FRAME_RATE);

    let exportablePoints = [];
    let header = [];
    for (let j = 0; j < trackTracker.tracks.length; j++) {
        for (let i = 0; i < numberOfCameras; i++) {
            header.push(`${trackTracker.tracks[j].name}_cam_${i + 1}_x`);
            header.push(`${trackTracker.tracks[j].name}_cam_${i + 1}_y`);
        }
    }
    exportablePoints.push(header.join(",") + ",\n");
    for (let i = 0; i < frames; i++) {
        let frameArray = [];
        for (let q = 0; q < trackTracker.tracks.length; q++) {
            for (let j = 0; j < numberOfCameras; j++) {
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
        <div class="columns is-multiline">
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
        </div>
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
        for (let i = 0; i < numberOfCameras; i++) {
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
    let point = addNewPoint(event);
    if (communicators.length === 0) {
        return;
    } else {
        if (settings["auto-advance"]) {
            updateCommunicators({
                type: "goToFrame",
                data: {frame: point.frame + 1}
            });
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

function handleKeyboardInput(e) {
    if (String.fromCharCode(e.which) === "Q") {
        triggerResizeMode();
    } else if (String.fromCharCode(e.which) === "F") {
        // TODO: Bug when spamming F (lock) [11-04-19: seems resolved]
        // TODO: Check for epipolar line momente in frame forward
        let id = parseInt(e.target.id.split("-")[1], 10);

        let frame = frameTracker[id] + 1;
        if (settings["sync"] === true) {
            let callback = function (i) {
                goToFrame(frame, videoObjectSingletonFactory(i));
            };
            let message = messageCreator("goToFrame", {frame: frame});
            for (let i = 0; i < numberOfCameras; i++) {
                updateLocalOrCommunicator(i, callback, message);
            }
        } else {
            moveToNextFrame(videoObjectSingletonFactory(id));
        }
        getEpipolarLinesOrUnifiedCoord(frame, videoObjectSingletonFactory(id));


    } else if (String.fromCharCode(e.which) === "B") {

        let id = parseInt(e.target.id.split("-")[1], 10);
        if (frameTracker[id] < 2) {
            return;
        }

        let frame = frameTracker[id] - 1;
        if (settings["sync"] === true) {
            let callback = function (i) {
                goToFrame(frame, videoObjectSingletonFactory(i));
            };
            let message = messageCreator("goToFrame", {frame: frame});

            for (let i = 0; i < numberOfCameras; i++) {
                updateLocalOrCommunicator(i, callback, message);
            }
        } else {
            goToFrame(frameTracker[id] - 1, videoObjectSingletonFactory(id));
        }
        getEpipolarLinesOrUnifiedCoord(frame, videoObjectSingletonFactory(id));

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
                if (settings["sync"]) {
                    for (let cameraIndex = 0; cameraIndex < numberOfCameras; cameraIndex++) {
                        let callBack = function () {
                            goToFrame(frameToGoTo, videoObjectSingletonFactory(cameraIndex));
                        };
                        let message = messageCreator("goToFrame", {"frame": frameToGoTo});
                        updateLocalOrCommunicator(cameraIndex, callBack, message);
                    }
                } else {
                    goToFrame(frameToGoTo, videoObjectSingletonFactory(index));
                }
                getEpipolarLinesOrUnifiedCoord(frameToGoTo, index);
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


function sendKillNotification() {
    updateCommunicators(messageCreator(
        "mainWindowDeath",
        {"none": "none"}
    ))
}

$(document).ready(function () {
    let fileInput = document.getElementById("video-file-input");
    fileInput.onchange = function (_) {
        let selectedFiles = Array.from(fileInput.files);
        loadVideos(selectedFiles);
    };

    $(window).on('beforeunload', sendKillNotification);
});