let videos = [];

let RGB = "grayscale(0%)";
let GREYSCALE = "grayscale(100%)";

class Video {
    constructor(videosIndex, videoName, offset, isEpipolarLocked, epipolarProjection) {
        this.index = videosIndex;
        this.name = videoName;
        this.offset = offset;
        this.video = document.getElementById(`video-${videosIndex}`);
        this.mouseTracker = {
            x: 0,
            y: 0,
            orgX: 0,
            orgY: 0,
        };

        this.canvas = document.getElementById(`canvas-${videosIndex}`);
        this.canvasContext = this.canvas.getContext("2d");
        this.videoCanvas = document.getElementById(`videoCanvas-${videosIndex}`);
        this.videoCanvasContext = this.videoCanvas.getContext("2d");

        this.epipolarCanvas = document.getElementById(`epipolarCanvas-${videosIndex}`);
        this.epipolarCanvasContext = this.epipolarCanvas.getContext("2d");

        this.subTrackCanvas = document.getElementById(`subtrackCanvas-${videosIndex}`);
        this.subTrackCanvasContext = this.subTrackCanvas.getContext('2d');

        this.zoomCanvas = document.getElementById(`zoomCanvas-${videosIndex}`);
        this.zoomCanvasContext = this.zoomCanvas.getContext("2d");
        this.zoomCanvas = $(this.zoomCanvas);

        this.zoomEpipolarCanvas = document.getElementById(`zoomEpipolarCanvas-${videosIndex}`);
        this.zoomEpipolarCanvasContext = this.zoomEpipolarCanvas.getContext("2d");
        this.zoomEpipolarCanvas = $(this.zoomEpipolarCanvas);

        this.zoomOffset = 10;

        this.currentBrightnessFilter = '';
        this.currentContrastFilter = '';
        this.currentSaturateFilter = '';
        this.currentColorspace = '';

        this.videoLabelID = `videoLabel-${videosIndex}`;

        this.lastFrame = (FRAME_RATE * this.video.duration);
        this.isDisplayingFocusedPoint = false;

        this.isEpipolarLocked = isEpipolarLocked;
        this.epipolarProjection = epipolarProjection;
    }

    createPointObject() {
        return {
            x: this.mouseTracker.x,
            y: this.mouseTracker.y,
            frame: frameTracker[this.index],
        };
    }

    redrawPoints(points, color = this.currentStrokeStyle, canvasContext = this.canvasContext, clearPoints = true) {
        if (clearPoints) {
            this.clearPoints(canvasContext);
        }
        this.drawPoints(points, canvasContext, color);
        this.drawLines(points, canvasContext, color);
    }

    drawEpipolarZoomWindow() {
        let startX = this.mouseTracker.x;
        let startY = this.mouseTracker.y;
        let width = parseFloat(this.zoomEpipolarCanvas.css("width"));
        let height = parseFloat(this.zoomEpipolarCanvas.css("height"));
        this.zoomEpipolarCanvasContext.clearRect(0, 0, width, height);

        this.zoomEpipolarCanvasContext.globalAlpha = 0.4;
        // Draw Epipolar lines
        this.zoomEpipolarCanvasContext.drawImage(
            this.epipolarCanvas,
            startX - this.zoomOffset,
            startY - this.zoomOffset,
            this.zoomOffset * 2,
            this.zoomOffset * 2, 0, 0, width, height); // startX, startY, endX, endY, 0, 0, endY, endX);
        this.zoomEpipolarCanvasContext.globalAlpha = 1;

    }

    drawZoomWindow(color) {
        let startX = this.mouseTracker.x;
        let startY = this.mouseTracker.y;

        this.zoomCanvasContext.strokeStyle = color;

        let width = parseFloat(this.zoomCanvas.css("width"));
        let height = parseFloat(this.zoomCanvas.css("height"));

        // Draw Video
        this.zoomCanvasContext.clearRect(0, 0, width, height);
        // this.zoomEpipolarCanvasContext.clearRect(0, 0, width, height);
        this.zoomCanvasContext.drawImage(
            this.videoCanvas,
            startX - this.zoomOffset,
            startY - this.zoomOffset,
            this.zoomOffset * 2,
            this.zoomOffset * 2, 0, 0, width, height); // startX, startY, endX, endY, 0, 0, endY, endX);

        this.zoomCanvasContext.beginPath();
        this.zoomCanvasContext.moveTo(width / 2, 0);
        this.zoomCanvasContext.lineTo(width / 2, height);
        this.zoomCanvasContext.stroke();

        this.zoomCanvasContext.beginPath();
        this.zoomCanvasContext.moveTo(0, height / 2);
        this.zoomCanvasContext.lineTo(width, height / 2);
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


    drawNewPoint(point, localPoints) {
        let newIndex = localPoints.indexOf(point);
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
        this.drawPoint(point.x, point.y, this.canvasContext, this.currentStrokeStyle);
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
        /*
         * TODO: This function is broken in Vivaldi on Windows devices up to a point. For some reason using the base
         *  (converted new1.mp4) video, we end up having a situation where it won't start moving until it is pushed
         *  along to frame 4, at which points it moves normally. I'm certain this is a bug with the browser, as it does
         *  this with no other browser on no other platforms. This doesn't seem to be present on all videos. I can't
         *  figure out what is causing it for this specific video. It's possible this is a problem with my setup, however
         *  I have tried uninstalling and reinstalling the browser, clearing the cache and it still has the same outcome.
         *  I have also tried using a virtual machine on the same machine to see if it will break in linux - it won't.
         */
        let orgFrame = frameNumber;
        frameNumber -= this.offset;
        if (frameNumber >= this.lastFrame - 1) {
            return;
        }
        if (frameNumber <= 0) {
            this.videoCanvasContext.clearRect(0, 0, this.videoCanvas.width, this.videoCanvas.height);
        }

        this.video.currentTime = frameNumber / FRAME_RATE;

        frameTracker[this.index] = orgFrame;
        let parsedLabel = Video.parseVideoLabel(document.getElementById(this.videoLabelID).innerText);
        parsedLabel["FRAME"] = Math.floor(frameTracker[this.index]);
        document.getElementById(this.videoLabelID).innerText = Video.videoLabelDataToString(parsedLabel);
    }

    moveToNextFrame() {
        let newFrame = frameTracker[this.index] + 1;
        this.goToFrame(newFrame);
    }

    drawZoomWindows(color) {
        this.drawZoomWindow(color);
        this.drawEpipolarZoomWindow();
    }

    inverseEpipolarLocked(color) {
        if (!this.isEpipolarLocked) {
            let proj = this.epipolarProjection(this.index, this.mouseTracker.orgX);
            this.mouseTracker.x = proj.x;
            this.mouseTracker.y = proj.y;
            this.drawZoomWindows(color);
            this.isEpipolarLocked = true;
        } else {
            this.isEpipolarLocked = false;
        }
    }


    loadFrame(mainTrackInfo) {
        let canvasWidth;
        let canvasHeight;

        canvasHeight = this.canvas.height;
        canvasWidth = this.canvas.width;

        this.videoCanvasContext.filter = `${this.currentBrightnessFilter} ${this.currentContrastFilter} ${this.currentSaturateFilter} ${this.currentColorspace}`;
        this.videoCanvasContext.fillRect(0, 0, canvasWidth, canvasHeight);
        this.videoCanvasContext.drawImage(this.video, 0, 0, canvasWidth, canvasHeight);
        this.currentStrokeStyle = mainTrackInfo.color;
        if (!locks["can_click"]) {
            locks["can_click"] = true;
        }

        let points = mainTrackInfo.points;
        let pointIndex = Video.checkIfPointAlreadyExists(points, frameTracker[this.index]);
        if (pointIndex !== null) {
            if (this.isDisplayingFocusedPoint) {
                this.redrawPoints(points);
            }
            this.isDisplayingFocusedPoint = true;
            this.drawFocusedPoint(points[pointIndex].x, points[pointIndex].y, 20);
        } else {
            if (this.isDisplayingFocusedPoint === true) {
                this.redrawPoints(points);
            }
            this.isDisplayingFocusedPoint = false;
        }

        if (this.isEpipolarLocked) {
            let projectedCoords = this.epipolarProjection(this.index, this.mouseTracker.orgX);
            this.mouseTracker.x = projectedCoords.x;
            this.mouseTracker.y = projectedCoords.y;
        }
        this.drawZoomWindow(mainTrackInfo.color);
        this.drawEpipolarZoomWindow();
    }

    addSubTrack(subTrackInfo) {
        let currentPoints = subTrackInfo.points;
        let currentColor = subTrackInfo.color;
        this.drawSubTrack(currentPoints, currentColor);
    }

    resetSubtracks() {
        this.subTrackCanvasContext.clearRect(0, 0, this.subTrackCanvas.width, this.subTrackCanvas.height);
    }

    removeSubTrack(allSubTrackInfos) {
        this.subTrackCanvasContext.clearRect(0, 0, this.subTrackCanvas.width, this.subTrackCanvas.height);
        for (let i = 0; i < allSubTrackInfos.length; i++) {
            let currentPoints = allSubTrackInfos[i].points;
            let currentColor = allSubTrackInfos[i].color;
            this.drawSubTrack(currentPoints, currentColor);
        }
    }

    drawFocusedPoint(x, y) {
        this.canvasContext.strokeStyle = "rgb(0,190,57)";
        this.canvasContext.beginPath();
        this.canvasContext.arc(x, y, VIDEO_TO_POINT_SIZE[this.index], 0, Math.PI);
        this.canvasContext.stroke();

        this.canvasContext.strokeStyle = "rgb(0,18,190)";
        this.canvasContext.beginPath();
        this.canvasContext.arc(x, y, VIDEO_TO_POINT_SIZE[this.index], Math.PI, 2 * Math.PI);
        this.canvasContext.stroke();

    }

    drawLine(point1, point2, canvas = this.canvasContext, color = this.currentStrokeStyle) {
        canvas.strokeStyle = color;

        canvas.beginPath();
        canvas.moveTo(point1.x, point1.y);
        canvas.lineTo(point2.x, point2.y);
        canvas.stroke();
    }

    drawLines(points, canvas = this.canvasContext, color = this.currentStrokeStyle) {
        for (let i = 0; i < points.length - 1; i++) {
            let currentPoint = points[i];
            // Check if there is a point after this one
            if (points[i + 1] !== undefined) {
                // Check if consecutive
                if (Math.floor(currentPoint.frame) === Math.floor(points[i + 1].frame) - 1) {
                    this.drawLine(points[i], points[i + 1], canvas, color);
                }
            }
        }
    }

    drawPoints(points, canvas = this.canvasContext, color = this.currentStrokeStyle) {
        for (let i = 0; i < points.length; i++) {
            this.drawPoint(points[i].x, points[i].y, canvas, color);
        }
    }

    drawPoint(x, y, canvasContext, color) {
        canvasContext.strokeStyle = color;

        canvasContext.beginPath();
        canvasContext.arc(x, y, VIDEO_TO_POINT_SIZE[this.index], 0, 2 * Math.PI);
        canvasContext.stroke();
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

        this.drawEpipolarZoomWindow();
    }


    drawEpipolarLines(points) {
        for (let i = 0; i < points.length; i++) {
            this.drawLine(
                {
                    "x": points[i][0][0],
                    "y": points[i][0][1]
                },
                {
                    "x": points[i][1][0],
                    "y": points[i][1][1]
                }, this.epipolarCanvasContext, "rgb(75, 156, 211)");
        }
        this.drawEpipolarZoomWindow();
    }

    drawSubTrack(points, color) {
        if (points.length === 0) {
            return;
        }
        this.canvasContext.strokeStyle = color;

        this.drawPoints(points, this.subTrackCanvasContext, color);
        this.drawLines(points, this.subTrackCanvasContext, color);
    }

    changeTracks(newPoints, color) {
        this.clearPoints();
        this.currentStrokeStyle = color;

        if (newPoints.length === 0) {
            return;
        }

        this.canvasContext.strokeStyle = this.currentStrokeStyle;

        // Redraws points
        this.drawPoints(newPoints);
        this.drawLines(newPoints);
    }

    clearPoints(context = this.canvasContext) {
        context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }


    zoomInZoomWindow() {
        if (this.zoomOffset === 1) {
            return;
        } else if (this.zoomOffset === 10) {
            this.zoomOffset = 1;
        } else {
            this.zoomOffset -= 10;
            this.drawZoomWindow();
            this.drawEpipolarZoomWindow();
        }

    }

    zoomOutZoomWindow() {
        this.zoomOffset += 10;
        this.drawZoomWindow();
        this.drawEpipolarZoomWindow();
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

        if (optionalCustomClose !== null) {
            modalContentContainer.append($(`
                <div class="columns is-centered is-vcentered">
                    <div class="column has-text-centered">
                        <button id="generic-dismiss-button" onclick="" class="button">Dismiss</button>
                    </div>
                </div>
            `).on("click", optionalCustomClose));
        }
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


function videoLabelDataToString(videoLabelObject) {
    let keys = Object.keys(videoLabelObject);
    let returnString = "";
    for (let i = 0; i < keys.length; i++) {
        returnString += `${keys[i]}:${videoLabelObject[keys[i]]} `;
    }
    return returnString;
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

    let validateAndCallback = (_) => {
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


function loadHiddenVideo(objectURL, index, onCanPlay) {
    // Adds a video into the DOM that is hidden (0 width, 0 height, not able to mess up anything)
    // Returns a jquery object of that video

    // Object URL - This is gotten from the file the user inputs, as far as I understand,
    // the browser loads part of the video into memory and this URL points to that point in
    // memory, wow!

    // Index - Provides the number that allows for a unique ID
    // If this isn't a number in the sequence 0 - N videos, something is probably wrong!

    // onCanPlay: Function that is called whenever the video is ready in the DOM to be viewed (probably a draw function!)
    // onCanPlay() { called twice if the initial call fails to draw the video }
    let curVideo = $(`<video class="hidden-video" id="video-${index}" src="${objectURL}"></video>`);
    curVideo.on("error", function () {
        generateError(
            "The video could not be loaded! See our troubleshooting page for details",
            null,
            function () {
                location.reload(false);
            });
    });

    $("#videos").append(curVideo);
    curVideo.get(0).currentTime = 0.001;
    curVideo.one("loadeddata", onCanPlay);
    return curVideo;
}