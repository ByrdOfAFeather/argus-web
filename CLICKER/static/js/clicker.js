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
let FRAME_RATE = 30;

// GLOBALS FOR THE CAMERA PROFILE AND DLT COEFFICENTS
let CAMERA_PROFILE = null;
let DLT_COEFFICIENTS = null;
let AUTO_SAVE_INTERVAL_ID = null;

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
    "can_pop_out": true,
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
let PROJET_DESCRIPTION = "";

class TrackDropDown {
    // STATIC CLASS CONTAINER FOR VARIOUS FUNCTIONS RELATING TO THE TRACK MANAGER AND SECONDARY TRACK MANAGER
    constructor() {
    }
}

// TRACK DROP DOWN VARIABLES
TrackDropDown.dropDown = $(`
            <div class="columns is-centered is-vcentered">
                <div class="column">
                    <div id="track-dropdown-container" class="dropdown">
                        <div class="dropdown-trigger">
                            <button id="track-dropdown-trigger" class="button" aria-haspopup="true" 
                            aria-controls="track-dropdown">
                                <span>Select Track</span><i class="fas fa-caret-down has-margin-left"></i>
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
        `);

TrackDropDown.currentForcedDisplay = null;

// TRACK DROP DOWN FUNCTIONS
TrackDropDown.generateDropDownOption = (trackName, deleteButton, curIndex) =>
    $(`
        <div id=track-${trackName.replace(/ /g, "-")} class="dropdown-content">
        <div class="container">
            <div class="level">
                <div class="level-left">
                    <div class="column is-narrow"><label class="label is-small">Disp.</label></div>
                    <div class="column is-narrow"><input id="track-${curIndex}-disp" type="checkbox" class="checkbox" checked="checked" disabled></div>
                    <div id=track-${curIndex} class="dropdown-item has-text-centered">
                        ${trackName}
                    </div>
                </div>
                <!-- TODO: cleanup --> 
                <div class="level-right">
                ${deleteButton === true ? `<div class="column is-narrow"><button id="track-${curIndex}-delete" class="dropdown-item-delete delete">Delete</button></div>` :
        ``
    }</div>
                
                </div>
            </div>
            </div>
    `);


TrackDropDown.addTrack = (trackName, deleteButton = true) => {
    if (trackName.length === 0) {
        generateError("Track name can't be empty!");
    } else if (trackTracker["tracks"].some((trackObject) => trackObject.name === trackName)) {
        generateError("You can't add a track with the same name twice!");
    } else {
        let previousIndex = trackTracker.currentTrack;

        addNewTrack(trackName);
        $("#current-track-display").text(`Current Track: ${trackName}`);
        let curIndex = trackTracker["currentTrack"];
        let newDropdownItem = TrackDropDown.generateDropDownOption(trackName, deleteButton, curIndex);

        TrackDropDown.currentForcedDisplay = newDropdownItem;

        let dropDownItemsContainer = TrackDropDown.dropDown.find("#track-dropdown");
        dropDownItemsContainer.append(newDropdownItem);
        dropDownItemsContainer.find($(`#track-${previousIndex}-disp`)).prop('checked', false);

        let displayOption = $(`#track-${curIndex}-disp`);
        displayOption.on("change", function () {
            if (drawSecondaryTracksTracker.hasIndex(curIndex)) {
                drawSecondaryTracksTracker.removeIndex(curIndex);
                drawSecondaryTracksTracker.drawTracks(true);
            } else {
                drawSecondaryTracksTracker.addIndex(curIndex);
                drawSecondaryTracksTracker.drawTracks();
            }
        });

        // Defaults to true since a new track is automatically switched to
        displayOption.prop('checked', true);
    }
};

TrackDropDown.disableForcedDisplay = () => {
    TrackDropDown.currentForcedDisplay.find(".checkbox").prop("disabled", "");
    TrackDropDown.currentForcedDisplay.find(".checkbox").prop("checked", "");
};

TrackDropDown.enableForcedDisplay = () => {
    TrackDropDown.currentForcedDisplay.find(".checkbox").prop("disabled", "disabled");
    TrackDropDown.currentForcedDisplay.find(".checkbox").prop("checked", "checked");
};


TrackDropDown.changeTracks = (trackID) => {

    $("#current-track-display").text(`Current Track: ${trackTracker["tracks"][trackTracker["currentTrack"]].name}`);
    TrackDropDown.disableForcedDisplay();
    TrackDropDown.currentForcedDisplay = $(`#track-${trackID}-disp`).parent();
    TrackDropDown.enableForcedDisplay();
};


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


function exportConfig(autoSaved = false) {
    let videoObjects = [];
    for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
        let newVideo = {
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

    let date = new Date();
    let output_json = {
        videos: videoObjects,
        title: PROJECT_NAME,
        description: PROJET_DESCRIPTION,
        dateSaved: date,
        points: clickedPoints,
        frameTracker: frameTracker,
        trackTracker: trackTracker,
        cameraProfile: CAMERA_PROFILE,
        dltCoefficents: DLT_COEFFICIENTS,
        settings: settings,
        frameRate: FRAME_RATE,
        colorSpace: COLORSPACE
    };

    createNewSavedState(output_json, autoSaved);
}

function getSavedStateVideoPaths(videoConfigs, index, cameras, pointConfig, frameTrackerConfig) {
    let invalid = function (event) {
        generateError("You have to provide a path for this video!");
    };

    let validate = function (restorePoint) {
        let selectedFile = Array.from($("#generic-file-input").prop("files"));
        let curURL = URL.createObjectURL(selectedFile[0]);

        let callback = null;
        if (videoConfigs[index].poppedOut === true) {
            callback = () => {
                clickedPoints = pointConfig.slice(0);
                frameTracker = Object.assign({}, frameTrackerConfig);
                popOutVideo({target: {id: `popVideo-${index}`}}, curURL);
            }
        } else {
            callback = () => {
                clickedPoints = pointConfig.slice(0);
                frameTracker = Object.assign({}, frameTrackerConfig);
                videos[index].goToFrame(frameTracker[index]);
                let points = getClickedPoints(index, trackTracker.currentTrack);
                videos[index].drawPoints(points);
                videos[index].drawLines(points);
                getEpipolarLinesOrUnifiedCoord(index, frameTracker[index]);
                changeTracks(trackTracker.currentTrack, cameras);
            };
        }


        loadVideosIntoDOM(curURL, index, videoConfigs[index].name, mainWindowAddNewPoint, mainWindowDeletePoint, true,
            videoConfigs[index].offset, callback);
        let modalContent = $("#modal-content-container");
        modalContent.empty();
        modalContent.append(restorePoint);
        if (index + 1 < videoConfigs.length) {
            getSavedStateVideoPaths(videoConfigs, index + 1, cameras, pointConfig, frameTrackerConfig);
        } else {
            let modal = $("#generic-input-modal");
            modal.removeClass("is-active");
            clearInterval(AUTO_SAVE_INTERVAL_ID);
            AUTO_SAVE_INTERVAL_ID = setInterval(function () {
                    exportConfig(true)
                },
                600000);

        }
    };

    getGenericFileInput(`Remind me where ${videoConfigs[index].name} is`, validate, invalid);
}


function loadSavedState(config) {
    PROJECT_NAME = config.title;
    colorIndex = 0;
    clickedPoints = [];
    trackTracker = {tracks: [{name: "Track 1", color: COLORS[0], index: 0}], currentTrack: 0};
    NUMBER_OF_CAMERAS = config.videos.length;
    FRAME_RATE = config.frameRate;
    COLORSPACE = config.colorSpace;
    PROJET_DESCRIPTION = config.description;


    trackTracker.currentTrack = config.trackTracker.currentTrack;

    let cameras = [];
    for (let i = 0; i < config.videos.length; i++) {
        cameras.push(i);
    }

    CAMERA_PROFILE = config.cameraProfile;
    DLT_COEFFICIENTS = config.dltCoefficents;
    settings = config.settings;

    $("#saved-states-section").empty();
    loadSettings();


    for (let i = 1; i < config.trackTracker.tracks.length; i++) {
        addTrackToDropDown(config.trackTracker.tracks[i].name);
    }

    getSavedStateVideoPaths(config.videos, 0, cameras, config.points, config.frameTracker);
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
    $(videos[data.index].zoomCanvas).show();
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

function popOutVideo(event, videoURL) {
    if (!locks["can_pop_out"]) {
        generateError("Video is already being popped out, please wait!");
        return;
    }

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
            "frameRate": FRAME_RATE
        });
        init_communicator.close();
        setTimeout(function () {
            locks["can_pop_out"] = true;
        }, 750);

        let master_communicator = new BroadcastChannel(`${videoIndex}`);
        master_communicator.onmessage = handlePopoutChange;
        communicators.push({"communicator": master_communicator, "index": videoIndex});
    };

    let currentSection = $(`#canvas-columns-${videoIndex}`);
    currentSection.hide();
    $(videos[videoIndex].zoomCanvas).hide();
    let URL = generatePopOutURL();
    // `${event.target.id}`,
    let poppedOut = window.open(URL, "detab",
        `location=yes,height=${600},width=${800},scrollbars=yes,status=yes,detab=yes,toolbar=0`);
    if (!poppedOut || poppedOut.closed || typeof poppedOut.closed == 'undefined') {
        init_communicator.close();
        currentSection.show();
        generateError("Could not pop out video! Ensure that you have pop-ups enabled for this website!");
    } else {
        locks["can_pop_out"] = false;
    }

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
            generateError(`I can't use ${numberOfProfiles} ${numberOfProfiles > 1 ? "profiles" : "profile"} 
            with only ${NUMBER_OF_CAMERAS} ${NUMBER_OF_CAMERAS > 1 ? "cameras" : "camera"} `);
        } else {
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
    let frames = Math.floor(duration * FRAME_RATE);

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


function generateColorspaceDropdown(uniqueID) {
    return $(`
    <div class="buffer-div">
        <div id="rgb-dropdown-container-${uniqueID}" class="dropdown">
            <div class="dropdown-trigger">
                <button id="rgb-dropdown-trigger-${uniqueID}" class="button" aria-haspopup="true" aria-controls="rgb-dropdown">
                     <span id="current-colorspace-selection-${uniqueID}">RGB</span><i class="fas fa-caret-down has-margin-left"></i>
                </button>
            </div>
            <div class="dropdown-menu" id="rgb-dropdown-${uniqueID}" role="menu">
                <div class="dropdown-content">
                    <div id="rgb-${uniqueID}" class="dropdown-item">
                        RGB
                    </div>
                </div>
                <div class="dropdown-content">
                    <div id="greyscale-${uniqueID}" class="dropdown-item">
                        Greyscale
                    </div>                        
                </div>
            </div>
        </div>
    </div>
    `);
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
            
            <div id="track-dropdown-container-column" class="column">
            </div>
            
            <div class="column">
                <div class="columns is-multiline is-vcentered">
                    <div class="column is-12 has-text-centered">
                        ${generateColorspaceDropdown(0).html()}
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
    $("#track-dropdown-container-column").append(TrackDropDown.dropDown);
    let track_trigger = $("#track-dropdown-trigger");
    let color_trigger = $("#rgb-dropdown-trigger-0");
    let track_container = $("#track-dropdown-container");
    let color_container = $("#rgb-dropdown-container-0");
    let track_dropdown = $("#track-dropdown");
    let color_dropdown = $("#rgb-dropdown-0");


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


        TrackDropDown.changeTracks(trackID);
        if (track_container.hasClass("is-active")) {
            track_container.removeClass("is-active");
        }
    });

    $("#add-track-button").on("click", function (_) {
        let newTrack = $("#new-track-input").val();
        TrackDropDown.addTrack(newTrack);
    });

    track_dropdown.on("click", ".dropdown-item-delete", function (event) {
        let curTrackIndex = parseInt(event.target.id.split("-")[1], 10);
        removeTrackFromDropDown(curTrackIndex);
    });

    color_dropdown.on("click", ".dropdown-item", function (event) {
        changeColorSpace(event.target.id.split("-")[0] === "rgb" ? RGB : GREYSCALE);
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

function mainWindowDeletePoint(e) {
    e.preventDefault();
    let video = e.target.id.split("-")[1];
    let localPoints = getClickedPoints(video, trackTracker.currentTrack);
    let pointIndex = Video.checkIfPointAlreadyExists(localPoints, frameTracker[video]);
    if (pointIndex !== null) {
        localPoints.splice(pointIndex, 1);
        videos[video].clearPoints();
        videos[video].drawPoints(localPoints);
        videos[video].drawLines(localPoints);
    }

}


function generateIndex0SetupMenu(currentFile, frameRateMenu) {
    return $(`            
            <div class="columns is-centered is-multiline">
                <div class="column is-12 has-text-centered">
                   <h1 class="has-julius has-text-white">Video Properties for ${currentFile.name}</h1>
                </div>
                
                <div class="column">
                    <div class="columns is-multiline">
                        <div class="column is-narrow">
                            <div class="columns is-multiline">
                                <div class="column is-12">
                                    <div id="offset-controller" class="controller">
                                        <div class="label">
                                            <label class="has-text-white" id="offset-label">Offset for ${currentFile.name}</label>
                                        </div>
                                        <input id="offset-input" class="input small-input" type="text">
                                    </div>
                                </div>
                                
                                <div class="column is-12">
                                    <div class="controller">
                                        <div class="label"><label class="has-text-white">Frame Rate:</label></div>
                                    
                                        <div id="frame-rate-dropdown" class="dropdown">
                                            <div class="dropdown-trigger">
                                                <button id="frame-rate-dropdown-trigger" class="button" aria-haspopup="true" 
                                                aria-controls="frame-rate-dropdown">
                                                    <span id="drop-down-display">30</span> <i class="fas fa-caret-down has-margin-left"></i>
                                                </button>
                                            </div>
                                            <!-- Gone: Display: none --> 
                                            <div id="custom-frame-rate-container" class="is-not-display">
                                                <div class="columns has-margin-left is-gapless">
                                                    <!-- Why use is-4 and not small-input? columns will take up 
                                                    the same amount of space no matter if I only want 30% or 100% 
                                                    is-4 limits the input anyway -->
                                                    <div id="frame-rate-input-container" class="column is-4">
                                                        <input id="frame-rate-input" class="input" type="text" placeholder="Framerate">
                                                        <p id="modal-input-warning-frame-rate" class="help is-danger is-not-display">Please input a valid framerate!</p>
                                                    </div>
                                                    <div class="column is-narrow">
                                                        <button id="frame-rate-save-button" class="button">Save</button>
                                                    </div>
                                                </div>
                                            </div>
                                            ${frameRateMenu.html()}
                                        </div>
                                    </div>
                                </div>
                            </div>  
                        </div>
                            
                        <div class="column">
                            ${generateColorspaceDropdown(1).html()}
                        </div>
                        <div class="column is-12">
                            <label class="label has-text-white">Preview:</label>
                            <canvas id="current-preview"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `);
}


function loadVideo(files, index) {
    let currentFile = files[index];
    let curURL = URL.createObjectURL(currentFile);

    let COMMON_FRAME_RATES = [
        29.97,
        30,
        50,
        59.94,
        60
    ];

    let generateFrameRateMenuOption = (frameRate) => {

        let idableFrameRate = `${frameRate}`.replace(".", "DOT");
        let dropDownItem = $(`
            <div id="frameRate-${idableFrameRate}-container" class="dropdown-content narrow-content">
                <div id="frameRate-${idableFrameRate}" class="dropdown-item">
                    ${frameRate}
                </div>
            </div>
        `);

        $('body').on('click', `#frameRate-${idableFrameRate}`, function (e) {
            $("#custom-framerate-container").addClass("is-not-display");
            $("#drop-down-display").text(frameRate);
            FRAME_RATE = frameRate;
            e.stopPropagation();
        });
        return dropDownItem;
    };


    // Why do we have a buffer div? Since jquery doesn't use the html from the top element when it converts
    // a object to HTML, we need a buffer div to get the div we actually want later in this function!
    let frameRateMenu = $(`<div id="buffer-div"><div class="dropdown-menu horizontal-menu" id="frame-rate-dropdown" role="menu"></div></div>`);
    for (let i = 0; i < COMMON_FRAME_RATES.length; i++) {
        frameRateMenu.find("#frame-rate-dropdown").append(generateFrameRateMenuOption(COMMON_FRAME_RATES[i]));
    }
    frameRateMenu.find("#frame-rate-dropdown").append($(`
        <div id="frameRate-custom-container" class="dropdown-content narrow-content">
            <div id="frameRate-custom" class="dropdown-item">
                Custom
            </div>
        </div>
    `));


    let video = loadHiddenVideo(index, curURL);

    // THIS IS THE CASE WHERE WE ONLY NEED FRAME RATE
    if (index === 0) {
        let inputContent = generateIndex0SetupMenu(files[0], frameRateMenu);
        let modal = $("#generic-input-modal");
        let modalContentContainer = $("#modal-content-container");
        modalContentContainer.parent().css("width", "900px");

        let frameRateDropdown = inputContent.find("#frame-rate-dropdown");
        let frameRateDropdownTrigger = inputContent.find("#frame-rate-dropdown-trigger");

        frameRateDropdownTrigger.on("click", function (e) {
            if (frameRateDropdown.hasClass("is-active")) {
                frameRateDropdown.removeClass("is-active");
            } else {
                frameRateDropdown.addClass("is-active");
            }
            e.stopPropagation();
        });

        let addCustomFrameRate = () => {
            let dropdownSelection = $("#drop-down-display");
            let frameRateContainer = $("#custom-frame-rate-container");
            dropdownSelection.text("Custom");
            if (frameRateContainer.hasClass("is-not-display")) {
                frameRateContainer.removeClass("is-not-display");
                let frameRateInput = $("#frame-rate-input");
                let saveButton = $("#frame-rate-save-button");
                saveButton.on("click", function () {
                    let input = frameRateInput.val();
                    let parse = parseFloat(input);
                    let warning = $("#modal-input-warning-frame-rate");
                    if (!isNaN(parse)) {
                        FRAME_RATE = parse;
                        dropdownSelection.text(input);
                        warning.addClass("is-not-display");
                        frameRateContainer.addClass("is-not-display");
                        saveButton.off();
                    } else {
                        FRAME_RATE = null;
                        if (warning.hasClass("is-not-display")) {
                            warning.removeClass("is-not-display");
                        }
                    }
                });
            }
        };

        inputContent.on("click", "#frameRate-custom", addCustomFrameRate);

        $(modal).on("click", function () {
            if (frameRateDropdown.hasClass('is-active')) {
                frameRateDropdown.removeClass('is-active');
                modalContentContainer.css('height', '');
            }
        });

        let validate = (input) => {
            let offsetParse = parseInt(input[0]);
            let frameRateParse = parseFloat(input[1]);
            let returnValue = {};

            if (isNaN(offsetParse)) {
                returnValue["offsetInvalid"] = true
            }
            if (isNaN(frameRateParse)) {
                returnValue["frameRateInvalid"] = true;
            }
            if (returnValue["offsetInvalid"] !== true && returnValue["frameRateInvalid"] !== true) {
                returnValue["offset"] = offsetParse;
                returnValue["frameRate"] = frameRateParse;
                returnValue["valid"] = true;
                return returnValue;
            } else {
                returnValue["offset"] = null;
                returnValue["frameRate"] = null;
                returnValue["valid"] = false;
                return returnValue
            }
        };

        let callback = (parsedInput) => {
            FRAME_RATE = parsedInput.frameRate;
            let offset = parsedInput.offset;
            loadVideosIntoDOM(curURL, index, currentFile.name, mainWindowAddNewPoint, mainWindowDeletePoint, true, offset, function () {
                updateAllLocalOrCommunicator(function (i) {
                    videos[i].goToFrame(offset + 1.001)
                }, null);
            });

            if (index + 1 > files.length - 1) {
                clearInterval(AUTO_SAVE_INTERVAL_ID);
                AUTO_SAVE_INTERVAL_ID = setInterval(function () {
                    exportConfig(true)
                }, 600000);
            } else {
                loadVideo(files, index + 1);
            }
        };

        modalContentContainer.append(inputContent);

        let previewCanvas = $("#current-preview").get(0);
        previewCanvas.style.height = '100%';
        previewCanvas.style.width = '100%';

        let loadPreviewFrame = (videoWidth, videoHeight) => {
            let ctx = previewCanvas.getContext("2d");
            ctx.filter = COLORSPACE;
            ctx.drawImage(document.getElementById(`video-${index}`),
                0, 0, videoWidth, videoHeight);
        };


        let videoHeight = null;
        let videoWidth = null;

        let setupFunction = (jqueryVideo) => {
            let video = jqueryVideo.get(0);
            videoHeight = video.videoHeight;
            videoWidth = video.videoWidth;
            previewCanvas.height = videoHeight;
            previewCanvas.width = videoWidth;
            loadPreviewFrame(videoWidth, videoHeight);
        };

        video.currentTime = 1;

        let color_trigger = $("#rgb-dropdown-trigger-1");
        let color_container = $("#rgb-dropdown-container-1");
        let color_dropdown = $("#rgb-dropdown-1");

        color_trigger.on("click", function () {
            if (color_container.hasClass("is-active")) {
                color_container.removeClass("is-active");
            } else {
                color_container.addClass("is-active");
            }
        });

        color_dropdown.on("click", ".dropdown-item", function (event) {
            let colorspace = event.target.id.split("-")[0] === "rgb" ? RGB : GREYSCALE;
            COLORSPACE = colorspace === RGB ? "grayscale(0%)" : "grayscale(100%)";
            $(`#current-colorspace-selection-${1}`).text(colorspace === RGB ? "RGB" : "Greyscale");
            loadPreviewFrame(videoWidth, videoHeight);
            if (color_container.hasClass("is-active")) {
                color_container.removeClass("is-active");
            }
        });


        let confirmButton = $("#confirm-button");
        let offsetInput = $("#offset-input");

        // TODO: Come back and validate custom input (once that is implemented)

        let validateAndCallback = (e) => {
            let offsetInputVal = offsetInput.val();
            let parsedInput = validate([offsetInputVal, FRAME_RATE]);
            if (parsedInput.valid === true) {
                genericInputCleanUp(modalContentContainer, modal);
                callback(parsedInput);
            } else {
                if (parsedInput.offsetInvalid === true) {
                    offsetInput.addClass("is-danger");

                    if ($("#modal-input-warning-offset").length === 0) {
                        $("#offset-controller").append(`<p id='modal-input-warning-offset' class="help is-danger">This is not a valid integer!</p>`)
                    }
                }
                if (parsedInput.frameRateInvalid === true) {
                    frameRateInput.addClass("is-danger");
                    if ($("#modal-input-warning-frame-rate").length === 0) {
                        $("#frame-rate-controller").append(`<p id='modal-input-warning-frame-rate' class="help is-danger">This is not a valid integer!</p>`)
                    }
                }
            }
        };

        confirmButton.on("click", validateAndCallback);
        modal.on("keydown", function (e) {
            let code = (e.keyCode ? e.keyCode : e.which);
            if (code === 13) {
                validateAndCallback(e);
            }
        });

        modal.addClass("is-active");
        $("#blurrable").css("filter", "blur(5px)");
        animateGenericInput(500, function () {
            offsetInput.focus();
            setupFunction(video)
        });

    }

    // Here we only need offset (we do not support multi-framerate at the time of writing)
    else {
        let inputContent = $(`            
            <div class="columns is-centered is-multiline">
                <div class="column is-12">
                    <div id="offset-controller" class="controller">
                        <div class="label">
                            <label class="has-text-white" id="offset-label">Offset for ${files[index].name}</label>
                        </div>
                        <input id="offset-input" class="input" type="text">
                    </div>
                </div>

                <div class="column">
                    <button id="confirm-button" class="button">Ok</button>
                </div>
            </div>
        `);

        let validate = (input) => {
            let offsetParse = parseFloat(input[0]);
            let returnValue = {};

            if (isNaN(offsetParse)) {
                returnValue["offsetInvalid"] = true;
            }
            if (returnValue["offsetInvalid"] !== true) {
                returnValue["offset"] = offsetParse;
                returnValue["valid"] = true;
                return returnValue;
            } else {
                returnValue["offset"] = null;
                returnValue["valid"] = false;
                return returnValue
            }
        };

        let modal = $("#generic-input-modal");
        let modalContentContainer = $("#modal-content-container");

        let callback = (parsedInput) => {
            loadVideosIntoDOM(curURL, index, currentFile.name, mainWindowAddNewPoint, mainWindowDeletePoint, true, parsedInput.offset);

            if (index + 1 > files.length - 1) {
                clearInterval(AUTO_SAVE_INTERVAL_ID);
                AUTO_SAVE_INTERVAL_ID = setInterval(function () {
                    exportConfig(true)
                }, 600000);
            } else {
                loadVideo(files, index + 1);
            }
        };

        modalContentContainer.append(inputContent);
        let confirmButton = $("#confirm-button");
        let offsetInput = $("#offset-input");

        let validateAndCallback = (e) => {
            let offsetInputVal = offsetInput.val();
            let parsedInput = validate([offsetInputVal]);
            if (parsedInput.valid === true) {
                genericInputCleanUp(modalContentContainer, modal);
                callback(parsedInput);
            } else {
                if (parsedInput.offsetInvalid === true) {
                    offsetInput.addClass("is-danger");
                    if ($("#modal-input-warning-offset").length === 0) {
                        $("#offset-controller").append(`<p id='modal-input-warning-offset' class="help is-danger">This is not a valid integer!</p>`)
                    }
                }
            }
        };

        confirmButton.on("click", validateAndCallback);
        modal.on("keydown", function (e) {
            let code = (e.keyCode ? e.keyCode : e.which);
            if (code === 13) {
                validateAndCallback(e);
            }
        });

        modal.addClass("is-active");
        $("#blurrable").css("filter", "blur(5px)");
        animateGenericInput(function () {
            offsetInput.focus();
        });
    }
}


function loadVideos(files) {
    $("#starter-menu").remove();
    $("#footer").remove();
    loadSettings();
    trackTracker = {"tracks": [{"name": "Track 1", "index": 0, "color": COLORS[colorIndex]}], "currentTrack": 0};
    colorIndex += 1;
    NUMBER_OF_CAMERAS = files.length;
    loadVideo(files, 0);
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
    let validate = (input) => {
        let frameToGoTo = parseInt(input, 10);
        if (isNaN(frameToGoTo) || frameToGoTo % 1 !== 0) {
            return {input: input, valid: false};
        } else {
            frameToGoTo -= 1;
            frameToGoTo += .001;
            return {input: frameToGoTo, valid: true};
        }
    };

    let callback = (parsedInput) => {
        if (settings["sync"]) {
            for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
                frameTracker[i] = parsedInput;
            }

            let callBack = function (i) {
                videos[i].goToFrame(parsedInput);
            };
            let message = messageCreator("goToFrame", {"frame": parsedInput});
            updateAllLocalOrCommunicator(callBack, message);
        } else {
            videos[index].goToFrame(parsedInput);
        }
        getEpipolarLinesOrUnifiedCoord(index, parsedInput);
        $("#canvas-0").focus();
    };

    let label = "What frame would you like to go to?";
    let errorText = "You have to input a valid integer!";
    getGenericStringLikeInput(validate, callback, label, errorText);
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
        goForwardAFrame(id);
    } else if (String.fromCharCode(e.which) === "B") {
        goBackwardsAFrame(id);
    } else if (String.fromCharCode(e.which) === "G") {
        goToInputFrame(id);
    } else if (String.fromCharCode(e.which) === "Z") {
        zoomInZoomWindow(e.target.id.split("-")[1]);
    } else if (String.fromCharCode(e.which) === "X") {
        zoomOutZoomWindow(e.target.id.split("-")[1]);
    }
}


function sendKillNotification() {
    updateCommunicators(messageCreator(
        "mainWindowDeath",
        {"none": "none"}
    ))
}

function handleSavedStateDelete(event) {
    event.stopPropagation();
    // deleteSavedState(event.target.id.split("-")[1]);
}


function generateDOMSavedState(result, index) {
    let date = new Date(result.dateSaved);
    let card = $(`
            <div id="saved-states-${index}" class="column hidden">
                <div id="saved-states-${index}-card" class="card">
                    <header class="card-header">
                        <div class="level">
                            <div class="level-left">
                                <p class="card-header-title level-left">
                                    ${result.title}
                                </p>
                            </div>
                            <div class="level-right">
                                <button id='savedState-${index}-delete' class="delete"></button>
                            </div>
                        </div>
                    </header>
                    <div class="card-content">
                        <div class="content">
                            <p>${result.description}</p>
                            <hr>
                            <p>${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}</p>
                            <p>${date.toLocaleTimeString()}</p>
                            <hr>
                            <p>Autosaved: ${result.autosaved === undefined ? "No" : "Yes"}</p>
<!--                            <hr>-->
<!--                            <button id="result-${index}" class="result button" id=result-${index}">Load</button>-->
                        </div>
                    </div>
                </div>
            </div>
    `);

    card.find(`#savedState-${index}-delete`).on('click', handleSavedStateDelete);
    return card;
}


function createNewProject(loggedIn) {
    let contentContainer = $("#modal-content-container");
    let form = $(`
        <div class="columns is-centered is-multiline">
            <div class="column">
                <form id="create-project-form" class="form" onsubmit="return false; ">
                    <div class="columns is-centered is-vcentered is-multiline">
                        <div class="column is-12">
                            <div class="field">
                                <div class="level is-fake-label">
                                    <div class="level-left">
                                        <label class="label has-text-white">Project Name</label>    
                                    </div>
                                    <div class="level-right">
                                        ${toolTipBuilder("Give a name to your project!", false).html()}
                                    </div>
                                </div>
                                <div class="control">
                                    <input id="project-name-input" class="input">
                                </div>
                            </div>
                        </div>
                        
                        <div class="column is-12">
                            <div class="field">
                                <div class="level is-fake-label">
                                    <div class="level-left">
                                        <label class="label has-text-white">Project Description</label>
                                    </div>
                                    <div class="level-right">
                                        ${toolTipBuilder("(Optional) Describe your project!", false).html()}    
                                    </div>
                                </div>
                                <div class="control">
                                    <input id="description-input" class="input">
                                </div>
                            </div>
                        </div>
                        
                        
                        <!-- NOTE: THIS IS STRUCTURE FOR FUTURE IMPLEMENTATIONS NO FUNCTIONALITY TODO --> 
                        <div class="column is-12">
                            <div class="field">
                                <div class="columns"> 
                                    <div class="column is-narrow">
                                        <label class="label has-text-white">Public</label>
                                    </div>
                                    <div class="column is-narrow">
                                        <div class="control">
                                            <input id="public-input" class="checkbox large-checkbox" type="checkbox">
                                        </div>    
                                    </div>
                                    <div class="column is-narrow">
                                        ${toolTipBuilder("Checking this will allow others to help contribute to your project!", false, "right").html()}    
                                    </div>
                                </div>
                            </div>
                        </div>
                        <!-- NOTE: THIS IS STRUCTURE FOR FUTURE IMPLEMENTATIONS NO FUNCTIONALITY TODO --> 
                        
                        
                        <div class="column">
                            <div class="level">
                                <div class="level-left">
                                    <div class="field">
                                        <div id="file-input-container" class="file centered-file-input fade-on-hover">
                                            <label class="file-label">
                                                <input
                                                        id="video-file-input"
                                                        class="file-input is-expanded"
                                                        accept="video/*" type=file multiple
                                                >
                                                <span class="file-cta has-background-dark has-text-white is-size-5" style="border: none">
                                            <span class="file-label">Select Videos</span>
                                        </span>
                                            </label>
                                        </div>
                                    </div>
                                    
                                    <div class="columns is-multiline" id="files-selected-container">
                                    </div>
                                </div>
        
                                <div class="level-right">
                                    <div class="columns">
                                        <div class="column is-narrow is-pulled-right">
                                            <button id="cancel-button" class="button has-background-dark has-text-white is-size-5 fade-on-hover" style="border: none">Cancel</button>
                                        </div>
                                        <div class="column is-narrow is-pulled-right">
                                            <button id="create-button" class="button has-background-dark has-text-white is-size-5 fade-on-hover disabled" style="border: none">Create</button>
                                        </div>                                    
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `);
    $("#blurrable").css("filter", "blur(10px)");
    $("#footer").css("filter", "blur(10px)");
    contentContainer.append(form);
    animateGenericInput(500, function () {
        $("#project-name-input").focus()
    });
    let modal = $("#generic-input-modal");
    let createButton = $("#create-button");
    let titleInput = $("#project-name-input");
    let descriptionInput = $("#description-input");
    let fileInput = $("#video-file-input");

    let removedFiles = new Set();

    let validate = () => {
        if (titleInput.val().length !== 0 || descriptionInput.val().length !== 0) {
            let selectedFiles = Array.from(fileInput.prop("files"));
            if (selectedFiles.length !== 0) {
                return true;
            }
        } else {
            return false;
        }
    };

    let updateIfValid = () => {
        let valid = validate();
        if (valid) {
            createButton.off();
            createButton.removeClass("disabled");
            // Stored in the template file to have relative url
            createButton.on("click", function () {
                createValidProject(loggedIn, removedFiles)
            });
        } else {
            createButton.off();
            createButton.addClass("disabled");
        }
    };

    $("#cancel-button").on("click", function () {
        genericInputCleanUp(contentContainer, modal)
    });

    titleInput.on('input', updateIfValid);
    fileInput.on("change", function () {
        console.log("I've been changed");
        removedFiles = new Set();

        let selectedFilesContainer = $("#files-selected-container");
        selectedFilesContainer.empty();

        let selectedFiles = Array.from(fileInput.prop("files"));
        for (let i = 0; i < selectedFiles.length; i++) {
            let name = selectedFiles[i].name.toString();
            name = name.slice(0, 20);
            name += "...";
            selectedFilesContainer.append(`
                <div id="selectedFile-${i}-container" class="column is-12">
                    <div class="level">
                        <div class="level-left">
                            <p class="has-text-white">${name}</p>
                        </div>
                        <div class="level-right">
                            <button id="deleteSelectedFile-${i}" class="delete delete-selected-file"></button>
                        </div>
                    </div>
                </div>
            `);
            selectedFilesContainer.find(`#deleteSelectedFile-${i}`).on("click", function (e) {
                $(`#selectedFile-${e.target.id.split('-')[1]}-container`).remove();
                removedFiles.add(i);
                if (removedFiles.size === selectedFiles.length) {
                    fileInput.val('');
                }
            })
        }

        updateIfValid();
    });
    modal.addClass("is-active");

    modal.on("keydown", function (e) {
        let code = (e.keyCode ? e.keyCode : e.which);
        if (code === 13) {
            let valid = validate();
            if (valid) {
                createValidProject(loggedIn, removedFiles);
            }
        } else if (code === 27) {
            genericInputCleanUp(contentContainer, modal);
        }
    });
}


function slideSavedStates(savedStatesLength, direction) {
    $("#saved-states-columns").show("slide", {direction: direction}, 250, function () {
        for (let i = 0; i < savedStatesLength; i++) {
            $(`#saved-states-${i}-card`).animate({boxShadow: "0 2px 3px rgba(10,10,10,.1), 0 0 0 1px rgba(10,10,10,.1)"}, function () {
                $(`#saved-states-${i}-card`).removeAttr("style");
            });
        }
    });
}

function savedStatePaginationHandler(newPagination, type) {
    let direction;
    let oppisiteDirection;
    if (type === 'forwards') {
        direction = 'left';
        oppisiteDirection = 'right';
    } else {
        direction = 'right';
        oppisiteDirection = 'left';
    }
    $("#saved-states-columns").hide("slide", {direction: direction}, 250, function () {
        $("#saved-states-columns").empty();
        // $("#saved-states-columns").css("display", "");
        displaySavedStates(newPagination, oppisiteDirection);
    });
}


async function displaySavedStates(currentPagination, direction = null) {
    let response = await getSavedStates(currentPagination);
    let endOfPagination = response.endOfPagination;
    let results = response.results;

    let section = $("#saved-states-columns");

    if (results.length === 0) {
        section.append(`<h3 class="notification has-text-weight-bold is-warning">You don't have any saved projects! Try creating some!</h3>`);
        $("#continue-working-button").slideUp(750);
        $('#new-project-button').addClass("float");
    }

    let parsedResults = [];

    for (let i = 0; i < results.length; i++) {
        parsedResults.push(JSON.parse(results[i]))
    }
    parsedResults.sort((a, b) => new Date(b.dateSaved) - new Date(a.dateSaved));
    for (let i = 0; i < parsedResults.length; i++) {
        let newState = generateDOMSavedState(parsedResults[i], i);
        section.append(newState);
        $(`#saved-states-${i}`).on("click", function () {
            $("#starter-menu").remove();
            $("#footer").remove();
            loadSavedState(parsedResults[i]);
        });
    }
    section.find(".card").css("box-shadow", "0px 0px");

    $("#saved-states-section").removeClass("no-display");

    if (currentPagination === 0) {
        for (let i = 0; i < parsedResults.length; i++) {
            $("#saved-states-columns").css("display", "");
            autoHeightAnimate($(`#saved-states-${i}`), 650 + (100 * i), function () {
                $(`#saved-states-${i}-card`).animate({boxShadow: "0 2px 3px rgba(10,10,10,.1), 0 0 0 1px rgba(10,10,10,.1)"}, function () {
                    $(`#saved-states-${i}-card`).removeAttr("style");
                });
            });
        }
    } else {
        $(".column, .hidden").removeClass("hidden");
        slideSavedStates(parsedResults.length, direction);
    }


    $("#continue-working-button").off();


    if (!endOfPagination) {
        let forwardPaginationButton = $(`
                             <div class="column is-narrow" id="button-column">
                                 <button id="pagination-button" class="rounded-button">
                                    <span class='icon'>
                                        <i class="fas fa-arrow-right"></i>
                                    </span>
                                </button>
                            </div>`);

        forwardPaginationButton.find("#pagination-button").on('click', function () {
            savedStatePaginationHandler(currentPagination + 5, 'forwards');
        });
        $('#saved-states-columns').append(forwardPaginationButton);
    }

    if (!(currentPagination === 0)) {
        let backwardPaginationButton = $(`
                             <div class="column is-narrow" id="button-column">
                                 <button id="pagination-button" class="rounded-button">
                                    <span class='icon'>
                                        <i class="fas fa-arrow-left"></i>
                                    </span>
                                </button>
                            </div>`);

        backwardPaginationButton.find("#pagination-button").on('click', function () {
            savedStatePaginationHandler(currentPagination - 5, 'backwards');
        });
        $('#saved-states-columns').prepend(backwardPaginationButton);
    }
}


function loadNewlyCreatedProject(title, description, files) {
    PROJECT_NAME = title;
    PROJET_DESCRIPTION = description;
    loadVideos(files);
}


$(document).ready(async function () {
    let loggedIn = await testLoggedIn();
    $("#new-project-button").on("click", function () {
        createNewProject(loggedIn);
    });
    $("#continue-working-button").on("click", function (_) {
        displaySavedStates(0);
    });

    $(window).on('beforeunload', sendKillNotification);
});