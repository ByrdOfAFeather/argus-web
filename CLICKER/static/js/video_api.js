let videoObjects = [];

let LINETYPE_EPIPOLAR = 1;
let LINETYPE_POINT_TO_POINT = 2;
let TEMP_MOVE_ZOOM = false;
let ZOOM_BEING_MOVED = null;

let videos = [];

let RGB = 0;
let GREYSCALE = 1;

class Video {
    constructor(videosIndex, offset) {
        this.index = videosIndex;
        this.offset = offset;
        this.video = document.getElementById(`video-${videosIndex}`);

        this.canvas = document.getElementById(`canvas-${videosIndex}`);
        this.canvasContext = this.canvas.getContext("2d");
        this.currentStrokeStyle = trackTracker.tracks[trackTracker.currentTrack].color;

        this.videoCanvas = document.getElementById(`videoCanvas-${videosIndex}`);
        this.videoCanvasContext = this.videoCanvas.getContext("2d");

        // this.zoomCanvas = document.getElementById(`zoomCanvas-${videosIndex}`);
        // this.zoomCanvasContext = this.zoomCanvas.getContext("2d");

        this.epipolarCanvas = document.getElementById(`epipolarCanvas-${videosIndex}`);
        this.epipolarCanvasContext = this.epipolarCanvas.getContext("2d");

        this.zoomCanvas = document.getElementById(`zoomCanvas-${videosIndex}`);
        this.zoomCanvasContext = this.zoomCanvas.getContext("2d");
        this.zoomOffset = 10;

        this.videoLabelID = `videoLabel-${videosIndex}`;

        this.popVideoID = `popVideo-${videosIndex}`;

        this.lastFrame = (FRAME_RATE * this.video.duration);
    }

    static createPointObject(index) {
        return {
            x: mouseTracker.x,
            y: mouseTracker.y,
            frame: frameTracker[index],
        };
    }

    redrawPoints(points) {
        this.drawPoints(points);
        this.drawLines(points);
    }

    drawZoomWindow() {
        let startX = mouseTracker.x;
        let startY = mouseTracker.y;

        this.zoomCanvasContext.strokeStyle = trackTracker.tracks[trackTracker.currentTrack].color;

        this.zoomCanvasContext.clearRect(0, 0, this.zoomCanvas.width, this.zoomCanvas.height);
        this.zoomCanvasContext.drawImage(
            this.videoCanvas,
            startX - this.zoomOffset,
            startY - this.zoomOffset,
            this.zoomOffset * 2,
            this.zoomOffset * 2, 0, 0, 400, 400); // startX, startY, endX, endY, 0, 0, endY, endX);

        this.zoomCanvasContext.beginPath();
        this.zoomCanvasContext.moveTo(200, 0);
        this.zoomCanvasContext.lineTo(200, 400);
        this.zoomCanvasContext.stroke();

        this.zoomCanvasContext.beginPath();
        this.zoomCanvasContext.moveTo(0, 200);
        this.zoomCanvasContext.lineTo(400, 200);
        this.zoomCanvasContext.stroke();
    }

    static checkIfPointAlreadyExists(localPoints, currentFrame) {
        let indexOfAlreadyExistingPoints = null;
        localPoints.some(function (point, curIndex) {
            if (Math.floor(point.frame) === Math.floor(currentFrame)) {
                indexOfAlreadyExistingPoints = curIndex;
                return true;
            } else {
                return false;
            }
        });
        return indexOfAlreadyExistingPoints;
    }


    addNewPoint(point) {
        if (!locks["can_click"]) {
            return;
        }

        let currentTrackIndex = trackTracker.currentTrack;
        locks["can_click"] = !settings["auto-advance"];

        let localPoints = getClickedPoints(this.index, currentTrackIndex);


        // If there is already a point
        let indexOfAlreadyExistingPoints = Video.checkIfPointAlreadyExists(localPoints, point.frame);
        if (indexOfAlreadyExistingPoints !== null) {
            this.clearPoints();
            localPoints[indexOfAlreadyExistingPoints] = point;
            this.redrawPoints(localPoints);

        } else {
            localPoints.push(point);
            localPoints.sort(sortByFrame);
            let newIndex = localPoints.indexOf(point);

            let videoHeight = this.video.videoHeight;
            let videoWidth = this.video.videoWidth;
            let currentHeight = this.canvas.style.height;
            let currentWidth = this.canvas.style.width;

            let videoArea = parseInt(currentHeight, 10) * parseInt(currentWidth, 10);
            this.drawPoint(point.x, point.y, 20);


            if (localPoints.length > 1) {

                // Check if there is a point after this one
                if (localPoints[newIndex + 1] !== undefined) {
                    // Check if consecutive
                    if (Math.floor(point.frame) === Math.floor(localPoints[newIndex + 1].frame) - 1) {
                        this.drawLine(localPoints[newIndex], localPoints[newIndex + 1]);
                    }
                }
                // Check if there is a point before this one
                if (localPoints[newIndex - 1] !== undefined) {
                    // Check if consecutive
                    if (Math.floor(point.frame) === Math.floor(localPoints[newIndex - 1].frame) + 1) {
                        this.drawLine(localPoints[newIndex - 1], localPoints[newIndex]);
                    }
                }
            }
        }

        // return the Index
        if (indexOfAlreadyExistingPoints !== null) {
            return indexOfAlreadyExistingPoints;
        } else {
            return localPoints.length - 1;
        }
    }


    static parseVideoLabel(videoLabelText) {
        let parsedData = {};
        let splicedData = videoLabelText.split(" ");
        for (let i = 0; i < splicedData.length; i++) {
            let localSplice = splicedData[i].split(":");
            parsedData[localSplice[0]] = localSplice[1];
        }
        return parsedData;
    }

    static videoLabelDataToString(videoLabelObject) {
        let keys = Object.keys(videoLabelObject);
        let returnString = "";
        for (let i = 0; i < keys.length; i++) {
            returnString += `${keys[i]}:${videoLabelObject[keys[i]]} `;
        }
        return returnString;
    }


    goToFrame(frameNumber) {
        //TODO: NOTE THAT WHEN A USER INPUTS A FRAME NUMBER IT WILL EXTEND ITSELF WITH A .01
        let orgFrame = frameNumber;
        frameNumber -= this.offset;
        if (frameNumber >= this.lastFrame - 1) {
            return;
        }
        if (frameNumber <= 0) {
            this.videoCanvasContext.clearRect(0, 0, this.videoCanvas.width, this.videoCanvas.height);
        }

        Video.clearCanvases();
        let estimatedTime = frameNumber / FRAME_RATE;
        this.video.currentTime = estimatedTime;

        let parsedLabel = Video.parseVideoLabel(document.getElementById(this.videoLabelID).innerText);
        parsedLabel["FRAME"] = Math.floor(orgFrame + 1);
        document.getElementById(this.videoLabelID).innerText = Video.videoLabelDataToString(parsedLabel);
        frameTracker[this.index] = orgFrame;
    }

    moveToNextFrame() {
        let newFrame = frameTracker[this.index] + 1;
        this.goToFrame(newFrame);
    }


    loadFrame() {
        let videoWidth;
        let videoHeight;

        videoHeight = this.video.videoHeight;
        videoWidth = this.video.videoWidth;

        this.videoCanvasContext.filter = COLORSPACE;
        this.videoCanvasContext.fillRect(0, 0, videoWidth, videoHeight);
        this.videoCanvasContext.drawImage(this.video, 0, 0, videoWidth, videoHeight);

        this.drawZoomWindow();
        if (!locks["can_click"]) {
            locks["can_click"] = true;
        }
    }


    drawLine(point1, point2, lineType = LINETYPE_POINT_TO_POINT) {
        let ctx = lineType === LINETYPE_EPIPOLAR ? this.epipolarCanvasContext : this.canvasContext;
        this.canvasContext.strokeStyle = this.currentStrokeStyle;

        ctx.beginPath();
        ctx.moveTo(point1.x, point1.y);
        ctx.lineTo(point2.x, point2.y);
        ctx.stroke();
    }

    drawLines(points) {
        for (let i = 0; i < points.length - 1; i++) {
            let currentPoint = points[i];
            // Check if there is a point after this one
            if (points[i + 1] !== undefined) {
                // Check if consecutive
                if (Math.floor(currentPoint.frame) === Math.floor(points[i + 1].frame) - 1) {
                    this.drawLine(points[i], points[i + 1]);
                }
            }
        }
    }

    drawPoints(points) {
        for (let i = 0; i < points.length; i++) {
            this.drawPoint(points[i].x, points[i].y, 2);
        }
    }

    drawPoint(x, y, r) {
        this.canvasContext.strokeStyle = this.currentStrokeStyle;

        this.canvasContext.beginPath();
        this.canvasContext.arc(x, y, r, 0, 2 * Math.PI);
        this.canvasContext.stroke();
    }

    drawDiamond(x, y, width, height) {
        //SOURCE: http://www.java2s.com/Tutorials/Javascript/Canvas_How_to/Shape/Draw_Spade_Heart_Club_Diamond.htm
        this.epipolarCanvasContext.beginPath();
        let temp = y - height;
        this.epipolarCanvasContext.moveTo(x, temp);

        // top left edge
        this.epipolarCanvasContext.lineTo(x - width / 2, y);

        // bottom left edge
        this.epipolarCanvasContext.lineTo(x, y + height);

        // bottom right edge
        this.epipolarCanvasContext.lineTo(x + width / 2, y);

        // closing the path automatically creates
        // the top right edge
        this.epipolarCanvasContext.closePath();

        this.epipolarCanvasContext.lineWidth = 3;
        this.epipolarCanvasContext.strokeStyle = "rgb(0,255,0)";
        this.epipolarCanvasContext.stroke();
        this.epipolarCanvasContext.restore();
    }

    drawEpipolarLine(points) {
        this.epipolarCanvasContext.strokeStyle = "#99badd";
        for (let i = 0; i < points.length - 1; i++) {
            this.drawLine(
                {
                    "x": points[i][0],
                    "y": points[i][1]
                },
                {
                    "x": points[i + 1][0],
                    "y": points[i + 1][1]
                }, LINETYPE_EPIPOLAR);
        }
    }

    changeTracks(trackIndex) {
        this.clearPoints();
        let localClickedPoints = clickedPoints[this.index][trackIndex];
        this.currentStrokeStyle = trackTracker["tracks"][trackIndex].color;

        if (localClickedPoints.length === 0) {
            return;
        }

        this.canvasContext.strokeStyle = this.currentStrokeStyle;

        // Redraws points
        this.drawPoints(localClickedPoints);
        this.drawLines(localClickedPoints);
    }

    clearPoints() {
        this.canvasContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }


    static clearCanvases() {
        for (let cameraIndex = 0; cameraIndex < videos.length; cameraIndex++) {
            let curVideo = videos[cameraIndex];
            if (curVideo === undefined) {
                continue;
            }

            videos[cameraIndex].epipolarCanvasContext.clearRect(
                0,
                0,
                curVideo.epipolarCanvas.width,
                curVideo.epipolarCanvas.height);
        }
    }
}


function getClickedPoints(index, currentTrackIndex) {
    return clickedPoints[index][currentTrackIndex];
}


/** @namespace */
function changeTracks(trackIndex, cameras) {
    /**
     * Changes the track based on the passed trackIndex
     * @param {Number} trackIndex The index of the requested track
     * @returns {undefined}
     */
    trackTracker["currentTrack"] = trackIndex;

    // Changes all cameras to the requested track
    for (let index = 0; index < cameras.length; index++) {
        if (videos[cameras[index]] !== undefined) {
            videos[cameras[index]].changeTracks(trackIndex);
        }
    }
}


function setMousePos(e) {
    if (TEMP_MOVE_ZOOM) {
        let zoom = ZOOM_BEING_MOVED;
        zoom.css("position", "absolute");
        mouseTracker.x = e.pageX - (parseInt(zoom.css("width"), 10) / 2);
        mouseTracker.y = e.pageY - (parseInt(zoom.css("height"), 10) / 2);

        // TODO: EFFICENT WAY OF MAKING SURE IT ISN'T PLACE ONTO ANOTHER CANVAS
        zoom.css("left", mouseTracker.x + "px");
        zoom.css("top", mouseTracker.y + "px");
    } else {
        if (e.target.id.startsWith("canvas")) {
            currentResizable = e.target;
        } else {
            e.target = currentResizable;
        }

        if (!locks["resizing_mov"]) {
            $(e.target).focus();

            // Source : https://stackoverflow.com/a/17130415
            let bounds = e.target.getBoundingClientRect();
            let scaleX = e.target.width / bounds.width;   // relationship bitmap vs. element for X
            let scaleY = e.target.height / bounds.height;

            mouseTracker.x = (e.clientX - bounds.left) * scaleX;   // scale mouse coordinates after they have
            mouseTracker.y = (e.clientY - bounds.top) * scaleY;

            videos[e.target.id.split("-")[1]].drawZoomWindow();


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


}

let closeModal = () => {
    let modal = $("#generic-input-modal");
    let modalContentContainer = $("#modal-content-container");
    genericInputCleanUp(modalContentContainer, modal);
};

function generateError(errorMessage, optionalComponent = null, optionalCustomClose = null) {
    let modal = $("#generic-input-modal");
    let modalContentContainer = $("#modal-content-container");

    if (modal.has("#error-message").length !== 0) {
        return;
    }

    let error = $(`<section class="section" id="error-container"><p id="error-message" class="notification is-danger has-text-weight-bold has-text-white has-text-centered">${errorMessage}</p></section>`);
    if (modal.hasClass("is-active")) {
        modalContentContainer.append(error);
    } else {
        modalContentContainer.append(error);
        if (optionalComponent !== null) {
            modalContentContainer.append(optionalComponent);
        } else {
            modalContentContainer.append($(`
                <div class="columns is-centered is-vcentered">
                    <div class="column has-text-centered">
                        <button id="generic-dismiss-button" onclick="" class="button">Dismiss</button>
                    </div>
                </div>
            `));
            modalContentContainer.on("click", "#generic-dismiss-button", function () {
                if (optionalCustomClose != null) {
                    optionalCustomClose();
                } else {
                    closeModal();
                }

            })
        }
        modal.addClass("is-active");
    }
}

function messageCreator(type, data) {
    return {"type": type, "data": data};
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

function sortByFrame(aPoint, bPoint) {
    return aPoint.frame - bPoint.frame;
}

function genericInputCleanUp(modalContentContainer, modal) {
    modalContentContainer.empty();
    modal.removeClass("is-active");
    $("#blurrable").css("filter", "blur(0px)");
    // Removes any previous keyboard bindings prevent calling the function multiple times
    modal.off();
}

function animateGenericInput(animationTime, postAnimationCallback) {
    let modalContentContainer = $("#modal-content-container");
    modalContentContainer.hide();
    modalContentContainer.fadeIn(animationTime, postAnimationCallback);
}


function getGenericStringLikeInput(validate, callback, label, errorText, hasCancel = true) {
    let inputContent = $(`            
            <div class="columns is-centered is-multiline">
                <div class="column is-12">
                    <div class="controller">
                        <div class="label">
                            <label style="color: white;" id="generic-input-label"></label>
                        </div>
                        <input id="generic-modal-input" class="input" type="text">
                    </div>
                </div>

                <div class="column">
                    ${hasCancel === true ? '<button id="generic-input-modal-cancel" class="button">Cancel</button>' : ""}
                    <button id="generic-input-modal-ok" class="button">Ok</button>
                </div>
            </div>
    `);

    let modalContentContainer = $("#modal-content-container");
    modalContentContainer.append(inputContent);
    modalContentContainer.hide();

    $("#generic-input-label").text(label);
    let cancelButton = $("#generic-input-modal-cancel");
    let okButton = $("#generic-input-modal-ok");

    let modal = $("#generic-input-modal");

    let input = $("#generic-modal-input");
    input.val(" ");

    modal.addClass("is-active");
    $("#blurrable").css("filter", "blur(5px)");

    modalContentContainer.fadeIn(300, function () {
        input.focus();
    });

    let validateAndCallback = (e) => {
        let input = $("#generic-modal-input").val();
        let parsedInput = validate(input);
        if (parsedInput.valid === true) {
            genericInputCleanUp(modalContentContainer, modal);
            callback(parsedInput.input);
        } else {
            generateError(errorText);
        }
    };

    if (hasCancel) {
        let cancelCallback = (_) => {
            genericInputCleanUp(modalContentContainer, modal);
        };
        cancelButton.on("click", cancelCallback);
    }

    okButton.on("click", validateAndCallback);
    modal.on("keydown", function (e) {
        let code = (e.keyCode ? e.keyCode : e.which);
        if (code === 13) {
            validateAndCallback(e);
        } else if (code === 27) {
            genericInputCleanUp(modalContentContainer, modal);
        }
    });
}

function getGenericFileInput(inputLabel, callBackOkay, callBackCancel) {
    let modalContent = $("#modal-content-container");
    let restorePoint = $(modalContent.children()[0]).clone();
    let modal = $("#generic-input-modal");
    modal.addClass("is-active");

    modalContent.empty();

    let fileInput = $(
        `                    
        <div class="file centered-file-input">
            <label class="file-label">
                <input
                        id="generic-file-input"
                        class="file-input is-expanded"
                        accept="video/*" type=file
                >
                <span class="file-cta has-background-dark has-text-white is-size-4">
                      <span class="file-label">
                        ${inputLabel}
                      </span>
                </span>
            </label>
        </div>`
    );

    fileInput.find("#generic-file-input").on("change",
        function (_) {
            callBackOkay(restorePoint)
        });
    modalContent.append(fileInput);

}


function loadVideoOnPlay(video) {

}

function startMovingZoomWindow(zoomCanvas) {
    let index = zoomCanvas.id.split("-")[1];

    let rect = zoomCanvas.getBoundingClientRect();
    zoomCanvas = $(zoomCanvas);

    let x = rect.left + window.pageXOffset;
    let y = rect.top + window.pageYOffset;

    let newZoom = zoomCanvas.clone();
    newZoom.css("position", "absolute");
    newZoom.css("left", x);
    newZoom.css("top", y);
    zoomCanvas.remove();
    $(document.body).append(newZoom);
    newZoom.on("mousedown", function () {
        startMovingZoomWindow(document.getElementById(newZoom.attr("id")));
    });

    videos[index].zoomCanvas = document.getElementById(newZoom.attr("id"));
    videos[index].zoomCanvasContext = videos[index].zoomCanvas.getContext("2d");

    TEMP_MOVE_ZOOM = true;
    $(document).on("mousemove", setMousePos);
    $(document).on("mouseup", function () {
        stopMovingZoomWindow(zoomCanvas)
    });
    ZOOM_BEING_MOVED = newZoom;

}

function stopMovingZoomWindow(zoomCanvas) {
    TEMP_MOVE_ZOOM = false;
    $(document).off();
}

function zoomInZoomWindow(index) {
    if (videos[index].zoomOffset === 1) {
        return;
    } else if (videos[index].zoomOffset === 10) {
        videos[index].zoomOffset = 1;
    } else {
        videos[index].zoomOffset -= 10;
        videos[index].drawZoomWindow();
    }

}

function zoomOutZoomWindow(index) {
    videos[index].zoomOffset += 10;
    videos[index].drawZoomWindow();
}


function loadVideosIntoDOM(curURL, index, name, canvasOnClick, canvasOnRightClick, isMainWindow, offsetArg = 0,
                           videoFinishedLoadingCallback = null) {
    // offsetArg - {"offset": offset for the video being loaded, "askForOffset": If it is the main window, should it
    // ask for an offset? If not, it will expect "offset" to be set}
    let curCanvases = $(`
            <div class="section">
              <div class="container">
              <div id="canvas-columns-${index}" class="columns has-text-centered is-multiline">
                    <div class="column is-12 video-label-container">
                    <p class="video-label" id="videoLabel-${index}"></p>
                    </div>
                    <div class="column is-12">
                      <div id="container-for-canvas-${index}" class="container-for-canvas">
                        <canvas class="clickable-canvas absolute" id="canvas-${index}" style="z-index: 3;"></canvas>
                        <canvas class="epipolar-canvas absolute" id="epipolarCanvas-${index}" style="z-index: 2;"></canvas>
                        <canvas class="video-canvas absolute draggable" id="videoCanvas-${index}" style="z-index: 1;" "></canvas>
                      </div>
                    </div>
                    <div class="column">
                        <canvas class="zoom-canvas" id="zoomCanvas-${index}" style="z-index: 2;"></canvas>
                    </div>
                </div>
                </div>
              </div>
            </div>
        `);

    $("#canvases").append(curCanvases);
    let curVideo = $(`<video class="hidden-video" id="video-${index}" src="${curURL}"></video>`);
    $("#videos").append(curVideo);
    clickedPoints[index] = [];
    clickedPoints[index][0] = [];
    curCanvases = document.getElementById(`canvas-${index}`);
    curCanvases.tabIndex = 1000;
    curCanvases.addEventListener("keydown",
        handleKeyboardInput,
        false);
    curCanvases = $(curCanvases);
    curCanvases.on("click", canvasOnClick);
    curCanvases.on("contextmenu", canvasOnRightClick);
    curCanvases.on("mousemove", setMousePos);
    curCanvases.on("scroll", setMousePos);
    if (isMainWindow) {
        $(document.body).find(`#canvas-columns-${index}`).append($(`
                        <div class="column">
                           <button id="popVideo-${index}" class="button">Pop into new Window</button>
                        </div>`));
    }

    // TODO
    $(document.body).find(`#canvas-columns-${index}`).append($(`
                        <div class="column">
                           <label class="label">Go To Frame</label>
                           <input class="input" type="text">
                           <button class="button">Go</button>
                        </div>`));


    curVideo.on("error", function () {
        genericInputCleanUp($("#modal-content-container"), $("#generic-input-modal"));
        generateError(`${name} could not be loaded, see troubleshooting for more details!`, null,
            function () {
                location.reload(false);
            });
        // reloadInitState
    });


    let setupFunction = () => {
        console.log("I got here");
        videos[index] = new Video(index, offsetArg);
        let originalText = document.getElementById(videos[index].videoLabelID);
        let label = Video.parseVideoLabel(originalText.innerText);
        label.OFFSET = offsetArg;
        originalText.innerText = Video.videoLabelDataToString(label);


        if (isMainWindow) {
            $(`#${videos[index].popVideoID}`).on("click", function (event) {
                popOutVideo(event, curURL)
            });
        }


        // TODO
        $(`#goToFrame-${index}`).on("click", function (event) {

        });

        let video = videos[index].video;

        let clickCanvas = videos[index].canvas;
        let videoCanvas = videos[index].videoCanvas;
        let epipolarCanvas = videos[index].epipolarCanvas;


        let currentCanvasContainer = document.getElementById(
            `container-for-canvas-${index}`
        );

        if (video.videoWidth > 800 || video.videoHeight > 600) {
            currentCanvasContainer.style.height = "600px";
            currentCanvasContainer.style.width = "800px";
        } else {
            currentCanvasContainer.style.height = video.videoHeight + "px";
            currentCanvasContainer.style.width = video.videoWidth + "px";
        }

        setCanvasSizes(clickCanvas, video);
        setCanvasSizes(videoCanvas, video);
        setCanvasSizes(epipolarCanvas, video);


        // Zoom Canvas is currently not supported
        let zoomCanvas = videos[index].zoomCanvas;
        zoomCanvas.height = 400;
        zoomCanvas.width = 400;
        zoomCanvas.style.height = "400px";
        zoomCanvas.style.width = "400px";
        zoomCanvas.style.top = (parseInt(clickCanvas.style.top, 10) + clickCanvas.height - zoomCanvas.height) + "px";
        zoomCanvas.style.left = (clickCanvas.width - zoomCanvas.width) + "px";

        $(zoomCanvas).on("mousedown", function () {
            startMovingZoomWindow(zoomCanvas)
        });


        let videoLabel = document.getElementById(videos[index].videoLabelID);
        let offset = 0;
        if (!isMainWindow) {
            offset = offsetArg["offset"];
        } else {
            offset = offsetArg;
        }

        let data = {
            "title": name,
            "frame": 0,
            "offset": offset,
        };

        videoLabel.innerText = videoLabelDataToString(data);

        videos[index].goToFrame(1.001);

        locks[`initFrameLoaded ${index}`] = true;
        if (videoFinishedLoadingCallback !== null) {
            videoFinishedLoadingCallback();
        }
    };


    curVideo.one('canplay', setupFunction);

    curVideo.on('canplay', function () {
        videos[index].loadFrame();
    });
}

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

function getEpipolarLines(videoIndex, DLTCoefficients, pointsIndex) {
    let coords = [];
    let tmp = [];
    let dlcCoeff1 = DLTCoefficients[videoIndex];
    let currentTrack = trackTracker["currentTrack"];

    let localPoints = clickedPoints[videoIndex][currentTrack];
    for (let cameraIndex = 0; cameraIndex < NUMBER_OF_CAMERAS; cameraIndex++) {
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
    let returnObjects = [];
    for (let i = 0; i < coords.length; i++) {
        let coord = coords[i];
        if (coord[0] !== parseInt(videoIndex, 10)) {
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

                let originalHeight = videos[videoIndex].video.videoHeight;
                let originalWidth = videos[videoIndex].video.videoWidth;

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
            returnObjects.push([tmp, i]);
        }
    }
    return returnObjects;
}

async function uvToXyz(points, profiles, dltCoefficents) {
    /*
    * param: points - [[camera_1_points], [camera_2_points], [camera_n_points]]
     */
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
