// A LIST OF COLORS THAT DEFINE TRACK COLORS IN ORDER
const COLORS = ["rgb(228, 26, 28)", "rgb(55, 126, 184)", "rgb(77, 175, 74)", "rgb(152, 78, 163)",
    "rgb(255, 127, 0)", "rgb(255, 255, 51)", "rgb(166, 86, 40)", "rgb(247, 129, 191)"];

let previewBrightness = "brightness(100%)";
let previewContrast = "contrast(100%)";
let previewSaturation = "saturate(100%)";
let previewCOLORSPACE = RGB;
let previewFRAMERATE = 30;
let previewPOINT_SIZE = 1;
let hasContinued = false;

// DEBUGGING CONSTANTS
// const PINHOLE = 1;
let FRAME_RATE = null;

// GLOBALS FOR THE CAMERA PROFILE AND DLT COEFFICENTS
let CAMERA_PROFILE = null;
let DLT_COEFFICIENTS = null;
let AUTO_SAVE_INTERVAL_ID = null;

// COLORSPACE MANEGEMENT
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

// TRACKS WHICH VIDEOS ARE IN WHICH FRAMES
// {videoIndex: frameNumber}
let frameTracker = {};

// KEEPS TRACK OF THE NUMBER OF CAMERAS
let NUMBER_OF_CAMERAS = 0;

// Global to be set by user.
let PROJECT_NAME = "";
let PROJECT_DESCRIPTION = "";
let PROJECT_ID = null;
let windowManager = null;


function loadSavedState(config) {
    PROJECT_NAME = config.title;
    PROJECT_DESCRIPTION = config.description;
    PROJECT_ID = config.projectID;
    CAMERA_PROFILE = config.cameraProfile;
    DLT_COEFFICIENTS = config.dltCoefficents;
    FRAME_RATE = config.frameRate;
    VIDEO_TO_COLORSPACE = config.colorSpaces;
    VIDEO_TO_POINT_SIZE = config.pointSizes;
    NUMBER_OF_CAMERAS = config.videos.length;
    windowManager = new MainWindowManager(PROJECT_NAME, PROJECT_DESCRIPTION, PROJECT_ID);
    windowManager.loadSavedState(config);
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
        windowManager.getEpipolarInfo(0, frameTracker[0]);
    };
    reader.readAsText(file[0]);
}

function loadCameraProfile(file) {
    let reader = new FileReader();
    reader.onload = function () {
        CAMERA_PROFILE = parseCameraProfile(reader.result, " ");
        windowManager.getEpipolarInfo(0, frameTracker[0]);
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



function fadeInputModalIn(animationTime, postAnimationCallback) {
    let modalContentContainer = $("#modal-content-container");
    modalContentContainer.hide();
    modalContentContainer.fadeIn(animationTime, postAnimationCallback);
}


/// END LOAD FUNCTIONS ///

function sendKillNotification(e) {
    e.preventDefault();
    e.returnValue = '';
    windowManager.communicatorsManager.updateCommunicators(
        messageCreator(
            "mainWindowDeath",
            {"none": "none"}
        )
    );
    windowManager.killPoppedWindows();
    try {
        // TODO: Disabled for presentation
        // windowManager.saveProject(true);
    } catch (e) {
    }
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

    $(".blurrable").css("filter", "blur(10px)");
    $("#footer").css("filter", "blur(10px)");
    contentContainer.append(form);
    fadeInputModalIn(5, function () {
        $("#project-name-input").focus()
    });

    modal.addClass("is-active");

    modal.on("keydown", function (e) {
        let code = (e.keyCode ? e.keyCode : e.which);
        // if (code === 13) {
        //     let valid = validate();
        //     if (valid) {
        //         postValidProject(loggedIn, removedFiles);
        //     }
        // } else
        if (code === 27) {
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
    let projects = null;
    try {
        projects = await getSavedProjects();
    } catch (e) {
        return;
    }
    let section = $("#saved-states-section");
    section.removeClass("no-display");
    section.hide();
    if (projects.projects.length === 0) {
        section.append(`<h3 class="notification has-text-centered has-text-weight-bold is-warning">You don't have any saved projects! Try creating some!</h3>`);
        $('#new-project-button').addClass("float");
        section.show("slide", {"direction": "up"}, 750);
        // return
    }
    section.append(searchableProjectsWidget(projects, async (pagination) => {
        return await getSavedProjects(pagination);
    }, (config) => {
        loadSavedState(config)
    }, 0));
    section.show("slide", {"direction": "up"}, 750, ()=>{    $("#project-search").focus();});
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
        if (hasContinued) {
            return;
        } else {
            displaySavedStates(0);
            hasContinued = true;
        }
    });

    $(window).on('beforeunload', sendKillNotification);
});

function getWindowManagerForTesting() {
    return windowManager;
}

function getDLTCoefficientsForTesting() {
    return DLT_COEFFICIENTS;
}