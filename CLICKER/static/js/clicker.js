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
let previewBrightness = "brightness(100%)";
let previewContrast = "contrast(100%)";
let previewSaturation = "saturate(100%)";
let previewCOLORSPACE = RGB;
let previewFRAMERATE = 30;
let previewPOINT_SIZE = 1;

// DEBUGGING CONSTANTS
const PINHOLE = 1;
let FRAME_RATE = null;

// GLOBALS FOR THE CAMERA PROFILE AND DLT COEFFICENTS
let CAMERA_PROFILE = null;
let DLT_COEFFICIENTS = null;
let AUTO_SAVE_INTERVAL_ID = null;

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
let trackTracker = new TrackManager();

// Global to be set by user.
let PROJECT_NAME = "";
let PROJECT_DESCRIPTION = "";
let PROJECT_ID = null;
let windowManager = null;

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

        $("#current-track-display").text(`Current Track: ${trackName}`);
        let curIndex = trackTracker["currentTrack"];
        let newDropdownItem = TrackDropDown.generateDropDownOption(trackName, deleteButton, curIndex);

        if (TrackDropDown.currentForcedDisplay !== null) {
            TrackDropDown.disableForcedDisplay();
        }

        TrackDropDown.currentForcedDisplay = newDropdownItem;

        secondaryTracksTracker.removeIndex(curIndex);

        let dropDownItemsContainer = TrackDropDown.dropDown.find("#track-dropdown");
        dropDownItemsContainer.append(newDropdownItem);
        dropDownItemsContainer.find($(`#track-${previousIndex}-disp`)).prop('checked', false);

        let displayOption = $(`#track-${curIndex}-disp`);
        displayOption.on("change", function () {
            if (displayOption.prop("checked") === true) {
                let message = messageCreator("updateSecondaryTracks", {"add": curIndex});
                let callback = () => {
                    secondaryTracksTracker.addIndex(curIndex);
                };
                updateAllLocalOrCommunicator(callback, message);
                secondaryTracksTracker.drawTracks();

            } else {
                let message = messageCreator("updateSecondaryTracks", {"remove": curIndex});
                let callback = () => {
                    secondaryTracksTracker.removeIndex(curIndex);
                };
                updateAllLocalOrCommunicator(callback, message);
                secondaryTracksTracker.drawTracks(true);
            }
        });

        // Defaults to true since a new track is automatically switched to
        displayOption.prop('checked', true);
    }
};

TrackDropDown.disableForcedDisplay = () => {
    let checkboxIndices = TrackDropDown.currentForcedDisplay.find('.checkbox');

    if (checkboxIndices.length !== 0) {
        checkboxIndices.prop("disabled", "");
        checkboxIndices.prop("checked", "");

        let id = parseInt(TrackDropDown.currentForcedDisplay.find(".checkbox")[0].id.split("-")[1], 10);
        secondaryTracksTracker.removeIndex(id);
        secondaryTracksTracker.drawTracks(true);
    }
};

TrackDropDown.enableForcedDisplay = () => {
    let checkboxIndices = TrackDropDown.currentForcedDisplay.find('.checkbox');
    if (checkboxIndices.length !== 0) {
        checkboxIndices.prop("disabled", "disabled");
        checkboxIndices.prop("checked", "checked");
    }
};


TrackDropDown.changeTracks = (trackID) => {
    $("#current-track-display").text(`Current Track: ${trackTracker["tracks"][trackTracker["currentTrack"]].name}`);
    TrackDropDown.disableForcedDisplay();
    TrackDropDown.currentForcedDisplay = $(`#track-${trackID}-disp`).parent();
    TrackDropDown.enableForcedDisplay();
};


function loadPoints(text) {
    // TODO : rework
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

function updatePopouts(message) {
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
            offset: windowManager.videos[i].offset
        };

        if (communicators.find((elem) => elem.index === i) !== undefined) {
            newVideo.poppedOut = true;
        } else {
            newVideo.poppedOut = false;
        }

        newVideo.name = Video.parseVideoLabel(
            document.getElementById(
                windowManager.videos[i].videoLabelID
            ).innerText
        ).TITLE;

        videoObjects.push(newVideo);
    }

    let date = new Date();
    let output_json = {
        videos: videoObjects,
        title: PROJECT_NAME,
        description: PROJECT_DESCRIPTION,
        dateSaved: date,
        points: windowManager.clickedPoints,
        frameTracker: frameTracker,
        trackTracker: windowManager.trackTracker,
        cameraProfile: CAMERA_PROFILE,
        dltCoefficents: DLT_COEFFICIENTS,
        settings: windowManager.settings,
        frameRate: FRAME_RATE,
        colorSpace: COLORSPACE
    };

    createNewSavedState(output_json, autoSaved, PROJECT_ID);
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
    PROJECT_DESCRIPTION = config.description;


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


function addTrackToDropDown(trackName, deleteButton = true) {

}


/// END TRACK MANAGEMENT ///


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
    let callback = () => {};
    let message = messageCreator("changeColorSpace", {colorSpace: colorSpace});
    updateAllLocalOrCommunicator(callback, message);
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
    // TODO: Only works with pinhole for now
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
    return null;
    let settingsBindings = {
        onDLTCoeffChange: null,
        onCameraProfileChange: null,
        savePoints: null,
        onLoadPointsChange: null,
        inverseSetting: null,
        onTrackClick: null,
        onTrackDisplay: null,
        onTrackDelete: null
    };
    let setupSettingsInput = settingsInputWidget(settingsBindings);
    $("#settingsInput").append(setupSettingsInput);
    $("#track-dropdown-container-column").append(TrackDropDown.dropDown);
    let track_trigger = $("#track-dropdown-trigger");
    let track_container = $("#track-dropdown-container");
    let track_dropdown = $("#track-dropdown");

    // let pointPreviewCanvas = document.getElementById("point-preview-canvas");
    // let ctx = pointPreviewCanvas.getContext("2d");
    // ctx.arc(50, 50, POINT_RADIUS, 0, Math.PI);
    // ctx.arc(50, 50, POINT_RADIUS, Math.PI, 2 * Math.PI);
    // ctx.stroke();

    track_trigger.on("click", function () {
        if (track_container.hasClass("is-active")) {
            track_container.removeClass("is-active");
        } else {
            track_container.addClass("is-active");
        }
    });


    track_dropdown.on("click", ".dropdown-item", function (event) {
        let trackID = parseInt(event.target.id.split("-")[1], 10);

        if (track_container.hasClass("is-active")) {
            track_container.removeClass("is-active");
        }

        let cameraIndex = [];
        for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
            cameraIndex.push(i);
        }
        // This change tracks changes the underlying representation ( trackTracker & drawings )
        changeTracks(trackID, cameraIndex);
        if (communicators.length !== 0) {
            updatePopouts({
                type: "changeTrack",
                data: {
                    "track": trackID
                }
            });
        }

        // This change tracks changes the dropdown display, including managing the display options
        TrackDropDown.changeTracks(trackID);
    });

    track_dropdown.on("click", ".dropdown-item-delete", function (event) {
        let curTrackIndex = parseInt(event.target.id.split("-")[1], 10);
        removeTrackFromDropDown(curTrackIndex);
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
            Video.clearEpipolarCanvases();
            getEpipolarLinesOrUnifiedCoord(index, frameTracker[index]);
        }
    }
}

function fadeInputModalIn(animationTime, postAnimationCallback) {
    let modalContentContainer = $("#modal-content-container");
    modalContentContainer.hide();
    modalContentContainer.fadeIn(animationTime, postAnimationCallback);
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

/// END LOAD FUNCTIONS ///

function sendKillNotification() {
    windowManager.communicationsManager.updateCommunicators(
        messageCreator(
            "mainWindowDeath",
            {"none": "none"}
        ));
}

function handleSavedStateDelete(event) {
    event.stopPropagation();
    deleteSavedState(event.target.id.split("-")[1]);
}


function generateDOMSavedState(result, index) {
    // TODO: RENDER WIDGETS .JS
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


function createNewProject() {
    let contentContainer = $("#modal-content-container");
    let modal = $("#generic-input-modal");

    let onSubmit = (selectedFiles) => {
        postValidProject(selectedFiles);
    };

    let cleanFunction = () => {
        genericInputCleanUp(contentContainer, modal);
    };
    let form = createProjectWidget(onSubmit, cleanFunction);

    $("#blurrable").css("filter", "blur(10px)");
    $("#footer").css("filter", "blur(10px)");
    contentContainer.append(form);
    fadeInputModalIn(500, function () {
        $("#project-name-input").focus()
    });

    modal.addClass("is-active");

    // modal.on("keydown", function (e) {
    //     let code = (e.keyCode ? e.keyCode : e.which);
    //     if (code === 13) {
    //         let valid = validate();
    //         if (valid) {
    //             postValidProject(loggedIn, removedFiles);
    //         }
    //     } else if (code === 27) {
    //         genericInputCleanUp(contentContainer, modal);
    //     }
    // });
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
        console.log(results[i]);
        parsedResults.push({
            "state_data": JSON.parse(results[i].state_data),
            "project_id": results[i].project_id,
            "state_id": results[i].state_id
        })
    }

    parsedResults.sort((a, b) => new Date(b.dateSaved) - new Date(a.dateSaved));
    for (let i = 0; i < parsedResults.length; i++) {
        let newState = generateDOMSavedState(parsedResults[i].state_data, parsedResults[i].state_id);
        section.append(newState);
        $(`#saved-states-${parsedResults[i].state_id}`).on("click", function () {
            $("#starter-menu").remove();
            $("#footer").remove();
            PROJECT_ID = parsedResults[i].project_id;
            loadSavedState(parsedResults[i].state_data);
        });
    }
    section.find(".card").css("box-shadow", "0px 0px");

    $("#saved-states-section").removeClass("no-display");

    if (currentPagination === 0) {
        for (let i = 0; i < parsedResults.length; i++) {
            $("#saved-states-columns").css("display", "");
            autoHeightAnimate($(`#saved-states-${parsedResults[i].state_id}`), 650 + (100 * i), function () {
                $(`#saved-states-${parsedResults[i].state_id}-card`).animate({boxShadow: "0 2px 3px rgba(10,10,10,.1), 0 0 0 1px rgba(10,10,10,.1)"}, function () {
                    $(`#saved-states-${parsedResults[i].state_id}-card`).removeAttr("style");
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


function loadNewlyCreatedProject(title, description, projectID, files) {
    PROJECT_NAME = title;
    PROJECT_DESCRIPTION = description;
    PROJECT_ID = projectID;
    windowManager = new MainWindowManager(title, description, projectID, files);
    windowManager.loadNewProject(files);
}


$(document).ready(async function () {
    $("#new-project-button").on("click", function () {
        createNewProject();
    });
    $("#continue-working-button").on("click", function (_) {
        displaySavedStates(0);
    });

    $(window).on('beforeunload', sendKillNotification);
});