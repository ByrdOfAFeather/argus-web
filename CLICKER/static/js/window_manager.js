let EPIPOLAR_TYPES = {
    LINE: 0,
    POINT: 1,
    NONE: 2
};

let EPIPOLAR_COLOR = "rgb(75,156,211)";

class WindowManager {
    /*ABSTRACT CLASS representing a manager for a window
    This will be the base class for a MainWindowManager and a PopoutWindowManager
    It implements things that both windows need to be able to do, such as add points and communicate with
    each other. The specifics are left up to the base classes (such as how it adds points or how it handles
    keyboard inputs)
     */
    constructor() {
        this.trackManager = new TrackManager();
        this.videos = [];
        this.videosToSizes = {};
        this.clickedPointsManager = null; // Implement in subclasses
        this.locks = {
            "can_click": true,
            "init_frame_loaded": false,
            "resizing_mov": false,
            "can_pop_out": true,
        };
        this.settings = {
            "auto-advance": true,
            "sync": true,
            "movementOffset": 1,
        };
        this.defaultVideoSettings = {
            filter: {
                colorspace: RGB,
                contrastFilter: "",
                saturationFilter: "",
                brightnessFilter: "",
            },
            frameRate: 30,
            offset: -1,
            pointSize: 1
        };
        this.lastFocusedCanvas = 0; // This is used to re-sync the videos after it is turned off then on


        // Modified by subclasses
        this.videoFiles = [];
        this.videoFilesMemLocations = {};
        this.videosToSettings = {};
        this.curEpipolarInfo = {};
        this.communicatorsManager = null;
        this.scaleManager = {} // Default, TODO: Change set mouse pos to change based on number of videos (callbacks)
        this.focused = true;
        window.addEventListener('blur', () => {
            this.focused = false;
        })
        window.addEventListener('focus', () => {
            this.focused = true;
        })

    }

    drawDiamonds(videoIndex, result) {
        let currentPoint = reconstructUV(DLT_COEFFICIENTS[videoIndex], result[result.length - 1]);

        if (!checkCoordintes(currentPoint[0][0], currentPoint[0][1],
            this.videos[videoIndex].epipolarCanvas.height, this.videos[videoIndex].epipolarCanvas.width)) {
            generateError("Points that did not exist were calculated when locating the " +
                "point in 2D space, please check your DLT coefficients and camera profiles");
        }

        let callback = (i) => {
            this.videos[i].drawDiamond(
                currentPoint[0][0],
                currentPoint[1][0], 10, 10,
            );
        };
        let message = messageCreator("drawDiamond", {
            x: currentPoint[0][0],
            y: currentPoint[1][0],
        });
        this.communicatorsManager.updateLocalOrCommunicator(parseInt(videoIndex, 10), callback, message);
    }

    processEpipolarPoint(xyz, points) {
        for (let j = 0; j < points.length; j++) {
            let videoIndex = points[j].videoIndex;
            this.curEpipolarInfo[videoIndex] = {
                type: EPIPOLAR_TYPES.POINT,
                data: null
            };
            this.drawDiamonds(videoIndex, xyz);
        }
    }

    processEpipolarLine(videosToLines, ignoreIndices = {}, epipolarUnified = false) {
        for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
            if (ignoreIndices[i] !== undefined) {
                continue;
            }
            let linePoints = videosToLines[i];
            if ((linePoints === undefined || linePoints.length === 0) && !epipolarUnified) {
                this.curEpipolarInfo[i] = {
                    type: EPIPOLAR_TYPES.NONE
                };
                this.videos[i].drawEpipolarZoomWindow();
                continue;
            }
            this.curEpipolarInfo[i] = {
                type: EPIPOLAR_TYPES.LINE,
                data: linePoints
            };
            let callback = (index) => {
                this.videos[index].drawEpipolarLines(linePoints)
            };
            let message = messageCreator("drawEpipolarLine", {
                "lineInfo": linePoints
            });
            this.communicatorsManager.updateLocalOrCommunicator(i, callback, message);
        }
    }

    processEpipolarInfo(result) {
        if (result === null) {
            for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
                this.curEpipolarInfo[i] = {
                    type: EPIPOLAR_TYPES.NONE,
                }
                this.videos[i].drawEpipolarZoomWindow();
            }
            return;
        } else if (result.type === 'epipolar') {
            this.processEpipolarLine(result.result);
        } else if (result.type === 'unified') {
            this.processEpipolarPoint(result.result[0], result.result[1]);
        } else if (result.type === 'epipolar-unified') {
            let xyz = result.result[0];
            let lines = result.result[1];
            let points = result.result[2];
            let pointIndices = result.result[3];
            this.processEpipolarPoint(xyz, points);
            this.processEpipolarLine(lines, pointIndices, true);
        }
    }


    getEpipolarInfo(referenceVideo, frame) {
        let currentTrack = this.trackManager.currentTrack.absoluteIndex;
        let pointHelper = (videoIndex, track) => {
            return this.clickedPointsManager.getClickedPoints(videoIndex, track);
        };

        getEpipolarLinesOrUnifiedCoord(referenceVideo, frame, currentTrack, this.videosToSizes, pointHelper).then(
            (result) => this.processEpipolarInfo(result));
    }

    updateVideoObject(newSettings) {
        this.videos[newSettings.index].currentBrightnessFilter = newSettings.filter.brightnessFilter;
        this.videos[newSettings.index].currentContrastFilter = newSettings.filter.contrastFilter;
        this.videos[newSettings.index].currentSaturateFilter = newSettings.filter.saturationFilter;
        this.videos[newSettings.index].currentColorspace = VIDEO_TO_COLORSPACE[newSettings.index];
        if (VIDEO_TO_POINT_SIZE[newSettings.index] !== newSettings.pointSize) {
            VIDEO_TO_POINT_SIZE[newSettings.index] = newSettings.pointSize;
            this.drawAllPoints(newSettings.index);
        }
    }

    drawAllPoints(videoIndex) {
        let mainTrack = this.trackManager.currentTrack;
        let mainTrackPoints = this.clickedPointsManager.getClickedPointsFrameViewOffsetSensitive(videoIndex, mainTrack.absoluteIndex);
        this.videos[videoIndex].redrawPoints(mainTrackPoints, mainTrack.color);
        for (let i = 0; i < this.trackManager.subTracks.trackIndicies.length; i++) {
            let absoluteSubTrackIndex = this.trackManager.subTracks.trackIndicies[i];
            let subTrack = this.trackManager.tracks[absoluteSubTrackIndex];
            let subTrackPoints = this.clickedPointsManager.getClickedPointsFrameViewOffsetSensitive(videoIndex, subTrack.absoluteIndex);
            let clearPoints = i === 0;
            this.videos[videoIndex].redrawPoints(
                subTrackPoints,
                subTrack.color,
                this.videos[videoIndex].subTrackCanvasContext,
                clearPoints
            );
        }
    }

    emptyInputModal() {
        $("#modal-content-container").empty();
        $("#generic-input-modal").off();
    }

    slideInputModalIn(animationTime, direction = "right", onCompleteCallback = () => {
    }) {
        // This slides the modal in from the right, typically used in conjuction with
        // slideInputModalOut
        let modalContentContainer = $("#modal-content-container");
        modalContentContainer.hide();
        modalContentContainer.show("slide", {"direction": direction}, animationTime, onCompleteCallback);
    }

    fadeInputModalIn(animationTime, postAnimationCallback) {
        let modalContentContainer = $("#modal-content-container");
        modalContentContainer.hide();
        modalContentContainer.fadeIn(animationTime, postAnimationCallback);
    }

    slideInputModalOut(animationTime, postAnimationCallback) {
        // When sliding the modal out, we clean it off to make room for new content
        // Then whatever is supposed to happen next, happens next.
        let modalContentContainer = $("#modal-content-container");
        modalContentContainer.hide("slide", {direction: "left"}, animationTime, () => {
            this.emptyInputModal();
            postAnimationCallback();
        });
    }

    keepCanvasAspectRatio(initial) {
        let mainWindow = this;
        $("#canvases").find(".container").each(function () {
            let videoID = $(this).attr("id").split("-")[3];
            if (videoID === undefined) {
                return true;
            }
            let width = parseFloat($($(this).find("canvas").get(0)).css("width"));
            let height = width * mainWindow.videosToSizes[videoID].height / mainWindow.videosToSizes[videoID].width;
            $(this).css("height", `${height}px`);
            $(this).find("canvas").each(function () {
                if (initial) {
                    mainWindow.videos[videoID].goToFrame(frameTracker[videoID]);
                } else {
                    let currentTrack = mainWindow.trackManager.currentTrack
                    let points = mainWindow.clickedPointsManager.getClickedPointsFrameViewOffsetSensitive(videoID, currentTrack.absoluteIndex);
                    currentTrack.points = points;
                    mainWindow.videos[videoID].loadFrame(currentTrack);
                }
            });
        });
        $(".zoom-canvas").each(function () {
            let width = parseFloat($(this).css("width"));
            let height = width;
            $(this.parentElement).css("height", `${height}px`);
            $(this).attr("width", width);
            $(this).attr("height", height);
        });
        $(".zoom-epipolar-canvas").each(function () {
            let width = parseFloat($(this).css("width"));
            let height = width;
            $(this.parentElement).css("height", `${height}px`);
            $(this).attr("width", width);
            $(this).attr("height", height);
        });
        $(".zoom-focused-point-canvas").each(function () {
            let width = parseFloat($(this).css("width"));
            let height = width;
            $(this.parentElement).css("height", `${height}px`);
            $(this).attr("width", width);
            $(this).attr("height", height);
        })
    }

    getVideoSettings(context, initSettings) {
        // Resets global variables
        previewBrightness = initSettings.filter.brightnessFilter;
        previewContrast = initSettings.filter.contrastFilter;
        previewSaturation = initSettings.filter.saturationFilter;

        $(".blurrable").css("filter", "blur(10px)");

        // Setup in-place functions that will be later used to update the preview \\
        let drawPreviewPoint = (ctx, x, y) => {
            ctx.strokeStyle = "#FF0000"
            ctx.beginPath();
            ctx.arc(x, y, previewPOINT_SIZE, 0, Math.PI);
            ctx.arc(x, y, previewPOINT_SIZE, Math.PI, 2 * Math.PI);
            ctx.stroke();
        };


        let loadPreviewFrame = function () {
            let canvas = document.getElementById("current-settings-preview-canvas").getContext("2d");

            // Setup filters
            canvas.filter = previewCOLORSPACE;
            canvas.filter += " " + previewBrightness;
            canvas.filter += " " + previewContrast;
            canvas.filter += " " + previewSaturation;

            canvas.drawImage(document.getElementById(`video-${context.index}`), 0, 0, 300, 300);

            // draw nearby points
            drawPreviewPoint(canvas, 200, 150);
            drawPreviewPoint(canvas, 230, 150);
        };

        let verifiedLoadPreviewFrame = function () {
            // Firefox seems to not play nice with 'can play' and so a callback happens whenever
            // there are transparent features in the canvas. Typically, transparent features on a canvas will mean
            // that a video failed to draw.
            loadPreviewFrame();
            let currentImage = $("#current-settings-preview-canvas").get(0).getContext("2d").getImageData(0, 0, 400, 300);
            let data = currentImage.data;
            let isShowing = true;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] < 255) {
                    isShowing = false;
                }
            }
            if (!isShowing) {
                setTimeout(function () {
                    loadPreviewFrame();
                }, 570);
            }
        };


        // Builds a context for the input builder so that we don't have redundant inputs or inputs that
        // don't belong for a given video.
        let name = this.videoFiles[context.index].name;
        if (name.length > 250) {
            name = name.slice(0, 250);
            name += "...";
        }

        // Smooths animations
        $("#generic-input-modal-content").css("margin", "0");
        $("#modal-content-container").append(videoSettingsPopoutWidget(
                name,
                loadPreviewFrame,
                context,
                (parsedInputs, previous) => context.saveSettings(parsedInputs, previous),
                initSettings
            )
        );

        $("#generic-input-modal").addClass('is-active');
        $("#generic-input-modal").on("keydown", (e) => {
            if (e.keyCode === 13) {
                $("#save-init-settings-button").click();
            }
        })

        if (context.index === 0 || !context.initialization) {
            this.fadeInputModalIn(700, () => {
                $("#offset-input").focus()
            });
        } else {
            this.slideInputModalIn(400, "right", () => {
                $("#offset-input").focus()
            });
        }

        if (context.loadVideo) {
            // Gets the video into the page so that the canvas actually has something to draw from
            let memoryLocation = URL.createObjectURL(this.videoFiles[context.index]);
            this.videoFilesMemLocations[context.index] = memoryLocation;
            loadHiddenVideo(memoryLocation, context.index, verifiedLoadPreviewFrame);
        } else {
            loadPreviewFrame();
        }
    }


    onMouseUp(event) {
        this.scaleManager.mouseDown = false;
    }

    onMouseDown(event) {
        if (this.scaleManager.isActive) {
            this.scaleManager.mouseDown = true;

            let currentLocation = this.videos[0].createPointObject();
            if (!this.scaleManager.originSet) {
                let inOrigin = this.inPoint(currentLocation, this.scaleManager.originPoint, 15);
                this.scaleManager.moving = inOrigin ? "origin" : "none";
            } else {
                let inInitPoint = this.inPoint(currentLocation, this.scaleManager.initialPoint, 15);
                let inFinalPoint = this.inPoint(currentLocation, this.scaleManager.finalPoint, 15);
                if (inInitPoint) {
                    this.scaleManager.moving = "init";
                } else if (inFinalPoint) {
                    this.scaleManager.moving = "final";
                } else {
                    this.scaleManager.moving = "none";
                }
            }
            return {point: null};
        }
    }


    inPoint(clickLocation, point, pointRadius) {
        let xDist = clickLocation.x - point.x;
        let yDist = clickLocation.y - point.y;
        let totalDist = Math.sqrt(xDist ** 2 + yDist ** 2);
        return totalDist < pointRadius;
    }

    addNewPoint(event) {
        // Adds a new point through the following:
        // Checks if the user can even add a new point (if a frame is still being loaded they can't)
        // Checks if a point already exists at this frame
        // ------
        // If it does then redraw all of the points to reflect the new location
        // ------
        // Otherwise draw the new point (no need to redraw all points in this case!)
        // -----
        // Synchronize and auto-advance if necessary
        let index = event.target.id.split("-")[1];
        if (this.locks["can_click"]) {
            let point = this.videos[index].createPointObject();

            let pointIndexInfo = this.clickedPointsManager.addPoint(
                point,
                {
                    clickedVideo: index,
                    currentTrack: this.trackManager.currentTrack.absoluteIndex
                }
            );
            let mainTrack = this.trackManager.currentTrack;
            let localPoints = this.clickedPointsManager.getClickedPointsFrameViewOffsetSensitive(index, mainTrack.absoluteIndex);
            let override = pointIndexInfo.override;
            let canvasIdx = Math.floor(pointIndexInfo.index / 10000); // Defines how many points per point canvas
            // localPoints.slice(canvasIdx*10000, (canvasIdx+1)*10000);
            if (override) {
                this.videos[index].redrawPoints(localPoints, mainTrack.color);
            } else {
                if (this.clickedPointsManager.frameViewOffset !== -1) {
                    this.videos[index].redrawPoints(localPoints, mainTrack.color);
                } else {
                    // The only reason we reserve this else is that there is performance gain when not using
                    // the point offset. (e.g. we don't have to redraw points)
                    this.videos[index].drawNewPoint(point, localPoints, mainTrack.color);
                }
            }

            this.locks["can_click"] = !this.settings["auto-advance"];
            return {'point': point, 'pointIndexInfo': pointIndexInfo};
        }
        return {'point': null, 'pointIndexInfo': null};
    }

    projectMouseToEpipolar(videoID, baseX) {
        /*
         * Accepts either two lines, or the current bounds, scaleX, and video index of the reference video
         */
        let mouseTracker = this.videos[videoID].mouseTracker;

        let lines = this.curEpipolarInfo[videoID].data;
        if (lines === undefined || this.curEpipolarInfo[videoID].type === EPIPOLAR_TYPES.NONE ||
            this.curEpipolarInfo[videoID].type === EPIPOLAR_TYPES.POINT) {
            return {x: this.videos[videoID].mouseTracker.orgX, y: this.videos[videoID].mouseTracker.orgY};
        }
        let lineData1 = lines[0];
        if (lines[1] !== undefined) {
            let lineData2 = lines[1];
            let bias1 = lineData1[0][1];
            let slope1 = (lineData1[1][1] - lineData1[0][1]) / (lineData1[1][0]);
            let bias2 = lineData2[0][1];
            let slope2 = (lineData2[1][1] - lineData2[0][1]) / (lineData2[1][0])
            let x = (bias1 - bias2) / (slope2 - slope1);
            return {x: x, y: (slope1 * x) + bias1}
        } else if (lineData1 !== undefined) {
            let bias = lineData1[0][1];
            let slope = (lineData1[1][1] - lineData1[0][1]) / (lineData1[1][0]);
            //TODO: This is mostly camera profile sloppy testing
            if (lineData1.length > 2) {
                let x_1 = lineData1[0][0];
                let x_2 = lineData1[lineData1.length - 1][0];

                let y_1 = lineData1[0][1];
                let y_2 = lineData1[lineData1.length - 1][1];

                slope = (y_2 - y_1) / (x_2 - x_1);
                bias = y_2 - slope * x_2;
            }
            // end
            let a = (-bias / slope);
            let b = (this.videosToSizes[videoID].height - bias) / slope;
            let finalX = a + ((baseX * (b - a)) / this.videosToSizes[videoID].width);
            return {
                x: finalX,
                y: (slope * finalX) + bias
            }
        }
    }

    setMousePos(e) {
        $(e.target).focus();
        this.lastFocusedCanvas = e.target.id.split("-")[1];

        // Source : https://stackoverflow.com/a/17130415
        let bounds = e.target.getBoundingClientRect();
        let scaleX = e.target.width / bounds.width;   // relationship bitmap vs. element for X
        let scaleY = e.target.height / bounds.height;

        let video = e.target.id.split("-")[1];
        let baseX = (e.clientX - bounds.left) * scaleX;
        let baseY = (e.clientY - bounds.top) * scaleY;

        if (this.scaleManager.isActive && this.scaleManager.mouseDown && this.scaleManager.moving !== "none") {
            this.videos[0].clearPoints(this.videos[0].canvasContext);
            if (this.scaleManager.originSet === false) {
                if (this.scaleManager.moving === "origin") {
                    this.scaleManager.originPoint.x = baseX;
                    this.scaleManager.originPoint.y = baseY;
                    this.videos[0].drawScalePoint(this.scaleManager.originPoint, 15);
                    this.scaleManager.drawCrossAxis(this.scaleManager.originPoint);
                }
            } else {
                if (this.scaleManager.moving === "init") {
                    this.scaleManager.initialPoint.x = baseX;
                    this.scaleManager.initialPoint.y = baseY;
                    this.scaleManager.redrawScalePoint();
                } else if (this.scaleManager.moving === "final") {
                    this.scaleManager.finalPoint.x = baseX;
                    this.scaleManager.finalPoint.y = baseY;
                    this.scaleManager.redrawScalePoint();
                }
            }
        }


        if (this.videos[video].isEpipolarLocked && this.curEpipolarInfo[video].type === EPIPOLAR_TYPES.LINE) {
            let projectedMouseCoords = this.projectMouseToEpipolar(video, baseX);
            this.videos[video].mouseTracker.x = projectedMouseCoords.x;
            this.videos[video].mouseTracker.y = projectedMouseCoords.y;
        } else {
            this.videos[video].mouseTracker.x = baseX;   // scale coords
            this.videos[video].mouseTracker.y = baseY;
        }
        this.videos[video].mouseTracker.orgX = baseX;
        this.videos[video].mouseTracker.orgY = baseY;
        if (!this.focused) {
            // Keep the coordinates in mind, but don't update the zoom window
            return;
        }
        let currentColor = this.trackManager.currentTrack.color;
        this.videos[video].drawZoomWindows(currentColor);
    }

    goForwardFrames() {
    }

    goBackwardsAFrame() {
    }

    goToInputFrame(index) {
        let validate = (input) => {
            let frameToGoTo = parseInt(input, 10);
            if (isNaN(frameToGoTo) || frameToGoTo % 1 !== 0) {
                return {input: input, valid: false};
            } else {
                frameToGoTo += .001;
                return {input: frameToGoTo, valid: true};
            }
        };

        let callback = (parsedInput) => {
            if (this.settings["sync"]) {
                for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
                    frameTracker[i] = parsedInput;
                }

                let callBack = (i) => {
                    this.videos[i].goToFrame(parsedInput);
                };
                let message = messageCreator("goToFrame", {"frame": parsedInput});
                this.communicatorsManager.updateAllLocalOrCommunicator(callBack, message);
            } else {
                this.videos[index].goToFrame(parsedInput);
            }
            this.clearEpipolarCanvases();
            this.getEpipolarInfo(index, parsedInput);
            $("#canvas-0").focus();
        };

        let label = `What frame would you like to go to for ${this.videos[index].name}?`;
        let errorText = "You have to input a valid integer!";
        getGenericStringLikeInput(validate, callback, label, errorText);
    }

    generateSubTrackInfos(videoIndex) {
        let infos = [];
        for (let j = 0; j < this.trackManager.subTracks.length(); j++) {
            let currentIndex = this.trackManager.subTracks.trackIndicies[j];
            let currentTrack = this.trackManager.findTrack(currentIndex);
            let currentPoints = this.clickedPointsManager.getClickedPointsFrameViewOffsetSensitive(videoIndex, currentIndex);
            infos.push({"points": currentPoints, "color": currentTrack.color});
        }
        return infos;
    }

    removePoint(e) {
        e.preventDefault();
        let video = e.target.id.split("-")[1];
        let removedPoint = this.clickedPointsManager.removePoint(video, this.trackManager.currentTrack.absoluteIndex, frameTracker[video]);
        if (removedPoint == null) {
            return null;
        }
        let points = this.clickedPointsManager.getClickedPointsFrameViewOffsetSensitive(video, this.trackManager.currentTrack.absoluteIndex);
        this.videos[video].redrawPoints(points, this.trackManager.currentTrack.color);
        this.videos[video].clearFocusedPointCanvas();
        this.clearEpipolarCanvases();
        try {
            this.getEpipolarInfo(video, frameTracker[video]);
        } catch {
            // This happens when this function is called in the popout window
            // we simply ignore it in this case.
        }
        this.videos[video].drawZoomWindows(this.trackManager.currentTrack.color);
        return removedPoint;
    }

    removeKnownPoint(pointInfo) {
        this.clickedPointsManager.clickedPoints[pointInfo.video][pointInfo.track].splice(pointInfo.index, 1);

    }

    handleKeyboardInput(e) {
        let id;
        try {
            id = parseInt(e.target.id.split("-")[1], 10);
        } catch (e) {
            return;
        }

        let typeX = this.videos[id].isEpipolarLocked ? "orgX" : "x";
        let typeY = this.videos[id].isEpipolarLocked ? "orgY" : "y";
        let movementAmount = e.ctrlKey ? 15 : 1;
        movementAmount = e.altKey ? .05 : movementAmount;
        if (e.keyCode === 38) {
            // Up
            e.preventDefault();
            this.videos[id].mouseTracker[typeY] -= movementAmount;
        } else if (e.keyCode === 39) {
            // Right
            e.preventDefault();
            this.videos[id].mouseTracker[typeX] += movementAmount;
        } else if (e.keyCode === 40) {
            // Down
            e.preventDefault();
            this.videos[id].mouseTracker[typeY] += movementAmount;
        } else if (e.keyCode === 37) {
            // Left
            e.preventDefault();
            this.videos[id].mouseTracker[typeX] -= movementAmount;
        } else if (e.keyCode === 32 || e.keyCode === 13) {
            // Space bar
            e.preventDefault();
            if (e.shiftKey) {
                this.removePoint(e);
            } else {
                $(`#canvas-${id}`).click();
            }
        }
        if (this.videos[id].isEpipolarLocked) {
            let proj = this.projectMouseToEpipolar(id, this.videos[id].mouseTracker.orgX);
            this.videos[id].mouseTracker.x = proj.x;
            this.videos[id].mouseTracker.y = proj.y;
        }
        this.videos[id].drawZoomWindows(this.trackManager.currentTrack.color);

        if (String.fromCharCode(e.which) === "F") {
            this.goForwardFrames(id);
        } else if (String.fromCharCode(e.which) === "B") {
            this.goBackwardsAFrame(id);
        } else if (String.fromCharCode(e.which) === "G") {
            this.goToInputFrame(id);
        } else if (String.fromCharCode(e.which) === "Z") {
            this.videos[id].zoomInZoomWindow();
        } else if (String.fromCharCode(e.which) === "X") {
            this.videos[id].zoomOutZoomWindow();
        } else if (String.fromCharCode(e.which) === "L") {
            this.videos[id].inverseEpipolarLocked(this.trackManager.currentTrack.color);
        } else if (String.fromCharCode(e.which) === "P") {
            this.videos[id].inverseDrawZoomPoints(this.trackManager.currentTrack.color);
        } else if (String.fromCharCode(e.which) === "S") {
            $(`#openSettings-${id}`).click();
        }
    }

    redrawWindow(videoIndex) {
        // this.videos[videoIndex].clearPoints();
        let currentTrack = this.trackManager.currentTrack;
        let currentPoints = []
        if (!this.scaleManager.isActive) {
            currentPoints = this.clickedPointsManager.getClickedPointsFrameViewOffsetSensitive(videoIndex, currentTrack.absoluteIndex);
        }
        let mainTrackInfo = {"points": currentPoints, "color": currentTrack.color};
        this.videos[videoIndex].loadFrame(mainTrackInfo);
    }

    convertFilterToBarPosition(filter) {
        let parsedFilter = {};
        try {
            let brightnessBar = filter.brightnessFilter.split("(")[1];
            parsedFilter.brightnessBar = brightnessBar.substring(0, brightnessBar.length - 2);
        } catch (err) {
            parsedFilter.brightnessBar = "";
        }

        try {
            let saturateBar = filter.saturationFilter.split("(")[1];
            parsedFilter.saturateBar = saturateBar.substring(0, saturateBar.length - 2);
        } catch (err) {
            parsedFilter.saturateBar = "";
        }

        try {
            let contrastBar = filter.contrastFilter.split("(")[1];
            parsedFilter.contrastBar = contrastBar.substring(0, contrastBar.length - 2);
        } catch (err) {
            parsedFilter.contrastBar = "";
        }
        return parsedFilter;

    }

    saveSettings(parsedInputs, previous) {

        if (!previous) { // Previous gets used as the cancel button in this context!
            if (parsedInputs.index === 0) {
                FRAME_RATE = parsedInputs.frameRate;
            }
            VIDEO_TO_COLORSPACE[parsedInputs.index] = parsedInputs.filter.colorspace;
            this.videosToSettings[parsedInputs.index] = parsedInputs;
            this.updateVideoObject(parsedInputs);
            this.redrawWindow(parsedInputs.index);
        }
        this.emptyInputModal();
        $("#generic-input-modal").removeClass("is-active");
        $(".blurrable").css("filter", "");
    }

    createSettingsContext(initialization, saveSettings, index) {
        let context = {};
        context.loadVideo = initialization; // This gets changed depending on user input
        context.initialization = initialization; // This is constant after being set
        context.saveSettings = saveSettings
        if (!initialization) {
            context.nextButtonText = "Save";
            context.nextButton = true;
            context.previousButton = true;
            context.previousButtonText = "Cancel";
        }
        if (index === 0 && initialization) {
            context.previousButton = false;
            context.nextButtonText = "Next";
            context.nextButton = true;
        }
        if (index + 1 === NUMBER_OF_CAMERAS && initialization) {
            context.previousButton = true;
            context.previousButtonText = "Previous"
            context.nextButton = true;
            context.nextButtonText = "Finish";
        } else if (index !== 0 && initialization) {
            context.previousButton = true;
            context.previousButtonText = "Previous"
            context.nextButton = true;
            context.nextButtonText = "Next";
        }
        context.index = index;
        return context;
    }

    setVideoLabelText(preAppendWidget, videoIndex, labelInfo) {
        preAppendWidget.find(`#videoTitle-${videoIndex}`).text(`TITLE: ${labelInfo["title"]}`)
        preAppendWidget.find(`#videoFrame-${videoIndex}`).text(`FRAME: ${labelInfo["frame"]}`)
        preAppendWidget.find(`#videoOffset-${videoIndex}`).text(`OFFSET: ${labelInfo["offset"]}`)
    }

    createClickerWidget(currentVideoIndex, videoSettingsInfo) {
        let loadPreviewFrameFunction = (videoIndex) => {
            try {
                this.redrawWindow(videoIndex);
            } catch (e) {
                // this is the case where the video hasn't been created yet. TODO
            }
        };

        let updateVideoPropertyCallback = (property, propertyValue) => {
            this.videos[currentVideoIndex][property] = propertyValue;
        };

        let getSettings = () => {
            let saveSettings = (parsedInputs, previous) => {
                this.saveSettings(parsedInputs, previous)
            }
            let context = this.createSettingsContext(false, saveSettings, currentVideoIndex);
            this.getVideoSettings(context, this.videosToSettings[currentVideoIndex]);
        }
        let currentClickerWidget = clickerWidget(
            currentVideoIndex,
            this.videosToSizes[currentVideoIndex].width,
            this.videosToSizes[currentVideoIndex].height,
            updateVideoPropertyCallback,
            loadPreviewFrameFunction,
            (event) => this.handleKeyboardInput(event),
            (event) => this.addNewPoint(event),
            (event) => this.removePoint(event),
            (event) => this.setMousePos(event),
            {
                "brightness": videoSettingsInfo.brightness,
                'saturation': videoSettingsInfo.saturation,
                'contrast': videoSettingsInfo.contrast
            },
            () => getSettings(),
            () => this.keepCanvasAspectRatio(false)
        );
        this.setVideoLabelText(
            currentClickerWidget,
            currentVideoIndex,
            {
                'title': videoSettingsInfo.name,
                'frame': frameTracker[currentVideoIndex],
                'offset': videoSettingsInfo.offset
            }
        );
        $("#canvases").append(currentClickerWidget);
        // TODO: Note that at this point there is wasted time in calling a function that
        // draws the preview frame in the modal which is deleted at this point
        // I don't know the performance effects of this. The below code will also remove error
        // warnings and I'm not sure if that's such as good idea....
        // $(`#video-${currentIndex}`).off();

        $(`#video-${currentVideoIndex}`).on("canplay", () => {
            loadPreviewFrameFunction(currentVideoIndex);
            if (!this.scaleManager.isActive) {
                this.locks.can_click = true;
            }
        });
    }

    loadVideoIntoDOM(parsedInputs) {
        /* Based on provided video properties, loads a video in to DOM and creates video objects
        parsedInputs {
            index: integer representing the current video
            videoName: Required so that the video label can display the name of the video
            offset: float representing this video in relation to the user's desired starting point
            frameRate: can be included, but normally set elsewhere and not used in this function
        }

        Note that subclasses have to implement the following:
        clickedPoints = ClickedPoints manager
        addNewPoint = callback used whenever a clickable-canvas is clicked
        deletePoint = callback used whenever a clickable-canvas is rightClicked
         */
        let currentIndex = parsedInputs.index;
        frameTracker[currentIndex] = 0.001;
        let parsedFilter = this.convertFilterToBarPosition(parsedInputs.filter);
        parsedInputs.brightness = parsedFilter.brightnessBar;
        parsedInputs.contrast = parsedFilter.contrast;
        parsedInputs.saturation = parsedFilter.saturateBar;
        parsedInputs.name = parsedInputs.videoName; // TODO: done to line up with savedstate, need more consisting naming
        this.videosToSizes[currentIndex] = {
            'height': document.getElementById(`video-${currentIndex}`).videoHeight,
            'width': document.getElementById(`video-${currentIndex}`).videoWidth
        }; // This comes from the hidden video that should be created before this point.

        this.createClickerWidget(parsedInputs.index, parsedInputs)

        this.videos[currentIndex] = new Video(currentIndex, parsedInputs.videoName, parsedInputs.offset, false, (videoID, baseX) => this.projectMouseToEpipolar(videoID, baseX));
        this.videos[currentIndex].currentBrightnessFilter = parsedInputs.filter.brightnessFilter;
        this.videos[currentIndex].currentContrastFilter = parsedInputs.filter.contrastFilter;
        this.videos[currentIndex].currentSaturateFilter = parsedInputs.filter.saturationFilter;
        this.videos[currentIndex].currentColorspace = parsedInputs.filter.colorspace;

        // Forces an update so that the video will be guaranteed to draw at least once
        this.videos[currentIndex].goToFrame(0.001);
    }

    clearEpipolarCanvases(popOutIndex = null) {
        if (popOutIndex !== null) {
            this.videos[popOutIndex].epipolarCanvasContext.clearRect(
                0,
                0,
                this.videos[popOutIndex].epipolarCanvas.width,
                this.videos[popOutIndex].epipolarCanvas.width
            );
            return;
        }
        for (let cameraIndex = 0; cameraIndex < NUMBER_OF_CAMERAS; cameraIndex++) {
            let curVideo = this.videos[cameraIndex];
            if (curVideo === undefined) {
                continue;
            }

            curVideo.epipolarCanvasContext.clearRect(
                0,
                0,
                curVideo.epipolarCanvas.width,
                curVideo.epipolarCanvas.height);
        }
    }

    messageCreator(type, data) {
        return {"type": type, "data": data};
    }
}

class MainWindowManager extends WindowManager {

    constructor(projectTitle, projectDescription, projectID, files = []) {
        super();
        if (files.length !== 0) {
            this.clickedPointsManager = new ClickedPointsManager(files.length);
            NUMBER_OF_CAMERAS = files.length;
            this.videoFiles = files;
        }
        this.videoFilesMemLocations = {};
        this.videosToSettings = {}; // Used to save to the cloud / allows "previous" in setup
        this.poppedWindows = [];
        this.curEpipolarInfo = {};

        let communicationsCallbacks = {
            'newFrame': (context) => {
                frameTracker[context.index] = context.frame;
                if (this.settings['sync']) {
                    this.syncVideos(context, true);
                } else {
                    this.videos[context.index].goToFrame(context.frame);
                    this.clearEpipolarCanvases();
                    this.getEpipolarInfo(context.index, frameTracker[context.index]);
                }
            },
            'popoutDeath': (context) => {
                // rerender video
                this.videos[context.index].clearPoints();
                this.communicatorsManager.removeCommunicator(context.index);


                $(`#masterColumn-${context.index}`).css('display', '');
                this.keepCanvasAspectRatio(true); // Fixes the ratio and goes straight to the point

                // Load Points afterwards to remove jank
                let drawPoints = () => {
                    this.drawAllPoints(context.index);
                    $(this.videos[context.index].video).unbind("canplay", drawPoints);
                };
                $(this.videos[context.index].video).on("canplay", drawPoints);
                this.clearEpipolarCanvases();
                this.getEpipolarInfo(context.index, frameTracker[context.index]);

            },
            'newPoint': (context) => {
                let point = context.point;
                // TODO: Shouldn't this information already be known?
                let track = context.absoluteIndex;
                // END TODO
                let pointIndex = context.pointIndex;
                let videoIndex = context.index;
                let localPoints = this.clickedPointsManager.getClickedPoints(videoIndex, track);
                localPoints[pointIndex] = point;
                frameTracker[videoIndex] = point.frame;

                if (this.settings['auto-advance']) {
                    context['frame'] = point.frame; // required for autoAdvance & sync functions
                    this.autoAdvance(context, false);
                } else {
                    this.clearEpipolarCanvases();
                    this.getEpipolarInfo(context.index, frameTracker[context.index]);
                }
            },
            'removePoint': (pointInfo) => {
                this.removeKnownPoint(pointInfo);
                this.clearEpipolarCanvases();
                this.getEpipolarInfo(pointInfo.video, frameTracker[pointInfo.video]);
                this.videos[pointInfo.video].drawZoomWindows(this.trackManager.currentTrack.color);
            },
            'initLoadFinished': () => {

            },
            "updateSettings": (settings) => {
                this.settings = settings;
            },
            "updateVideoSettings": (settings) => {
                this.saveSettings(settings, false);
            }
        };
        this.communicatorsManager = new CommunicatorsManager(STATES.MAIN_WINDOW, communicationsCallbacks);
    }

    saveProject(autoSaved) {
        let videoObjects = [];
        for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
            let newVideo = {
                offset: this.videos[i].offset
            };

            newVideo.index = i;

            if (this.communicatorsManager.communicators.find((elem) => elem.index === i) !== undefined) {
                newVideo.poppedOut = true;
            } else {
                newVideo.poppedOut = false;
            }

            newVideo.name = windowManager.videos[i].parseVideoLabel().TITLE;

            newVideo.brightness = this.videos[i].currentBrightnessFilter;
            newVideo.contrast = this.videos[i].currentContrastFilter;
            newVideo.saturation = this.videos[i].currentSaturateFilter;
            newVideo.isEpipolarLocked = this.videos[i].isEpipolarLocked;

            newVideo.orgSize = this.videosToSizes[i];

            videoObjects.push(newVideo);
        }
        let date = new Date();
        let output_json = {
            videos: videoObjects,
            title: PROJECT_NAME,
            description: PROJECT_DESCRIPTION,
            dateSaved: date,
            pointsManager: this.clickedPointsManager,
            frameTracker: frameTracker,
            trackManager: this.trackManager,
            cameraProfile: CAMERA_PROFILE,
            dltCoefficents: DLT_COEFFICIENTS,
            settings: this.settings,
            frameRate: FRAME_RATE,
            colorSpaces: VIDEO_TO_COLORSPACE,
            pointSizes: VIDEO_TO_POINT_SIZE,
            videoSettings: this.videosToSettings,
            scaleMode: this.scaleMode,
            epipolarColor: EPIPOLAR_COLOR,
            frameViewOffset: this.clickedPointsManager.frameViewOffset
        };
        createNewSavedState(output_json, autoSaved, PROJECT_ID);
    }

    loadSavedStateVideos(videos) {
        this.emptyInputModal();
        $("#generic-input-modal").removeClass("is-active");
        $("#starter-menu").remove();
        $("#footer").remove();
        $(".blurrable").css("filter", "");

        for (let i = 0; i < videos.length; i++) {
            this.videosToSizes[videos[i].index] = videos[i].orgSize;
            this.videoFiles[videos[i].index] = videos[i].file;
            let memoryLocation = URL.createObjectURL(this.videoFiles[videos[i].index]);
            this.videoFilesMemLocations[videos[i].index] = memoryLocation;
            loadHiddenVideo(memoryLocation, videos[i].index, () => {
            });
            this.createClickerWidget(videos[i].index, videos[i]);
            this.createPopoutWidget(videos[i].index);
            this.videos.push(new Video(videos[i].index, videos[i].name, videos[i].offset, videos[i].isEpipolarLocked, (videoID, baseX) => this.projectMouseToEpipolar(videoID, baseX)));
            this.videos[videos[i].index].currentBrightnessFilter = videos[videos[i].index].brightness;
            this.videos[videos[i].index].currentContrastFilter = videos[videos[i].index].contrast;
            this.videos[videos[i].index].currentSaturateFilter = videos[videos[i].index].saturation;
            this.videos[videos[i].index].currentColorspace = VIDEO_TO_COLORSPACE[videos[i].index];

            // Forces an update so that the video will be guaranteed to draw at least once
            this.videos[videos[i].index].goToFrame(frameTracker[videos[i].index]);

            if (videos[i].poppedOut) {
                setTimeout(() => {
                    this.popOutVideo(videos[i].index, memoryLocation);
                }, 900 * (videos[i].index + 1))
            } else {
                this.drawAllPoints(i);
            }
        }
        this.getEpipolarInfo(0, frameTracker[0]);
        this.keepCanvasAspectRatio(true); // A little wasteful as I resize previous videos that don't need it
        $(window).on("resize", () => this.keepCanvasAspectRatio(false));
        this.loadSettings();

        // Smooth scrolls if the window is considered mobile via bulma's framework
        if ($(window).width() <= 768) {
            window.scroll({
                top: $("#canvas-0").get(0).getBoundingClientRect().y,
                behavior: 'smooth'
            });
        }
    }

    loadSavedState(state) {
        // TODO: Check state version
        this.trackManager = new TrackManager(state.trackManager);
        let trackIndicies = this.trackManager.tracks;
        trackIndicies.map((track) => track.absoluteIndex);
        this.clickedPointsManager = new ClickedPointsManager(NUMBER_OF_CAMERAS, trackIndicies, state.pointsManager.clickedPoints, state.frameViewOffset);
        frameTracker = state.frameTracker;
        this.settings = state.settings;
        this.videosToSettings = state.videoSettings;
        EPIPOLAR_COLOR = state.epipolarColor;
        if (NUMBER_OF_CAMERAS === 1) {
            // To preserve functions in case a change of origin is in order
            // TODO: Remake to work with new ScaleManager
            this.scaleMode = Object.assign({}, this.scaleMode, state.scaleMode);
        }
        let videoGetter = loadSavedStateWidget(state.videos, (videos) => this.loadSavedStateVideos(videos));
        let modal = $("#generic-input-modal");
        $("#modal-content-container").append(videoGetter);
        $(".blurrable").css("filter", "blur(10px)");
        this.fadeInputModalIn(700);
        modal.addClass("is-active");
    }


    // Settings Module
    drawTrack(trackID, redrawSubTracks) {
        let callback = (videoIndex) => {
            let localPoints = this.clickedPointsManager.getClickedPointsFrameViewOffsetSensitive(videoIndex, trackID);
            this.videos[videoIndex].changeTracks(localPoints, this.trackManager.currentTrack.color);
            if (redrawSubTracks) {
                let infos = this.generateSubTrackInfos(videoIndex);
                this.videos[videoIndex].removeSubTrack(infos);
            }
        };
        let message = messageCreator("changeTrack", {track: trackID});
        this.communicatorsManager.updateAllLocalOrCommunicator(callback, message);
        this.getEpipolarInfo(0, frameTracker[0]);
    }


    updateCheckboxesOnChangeTrack(oldIndex, newIndex, trackUnstashed) {
        let oldTrackCheckbox = $(`#track-${oldIndex}-disp`);
        if (!trackUnstashed) {
            oldTrackCheckbox.prop("checked", false);
        }
        oldTrackCheckbox.removeClass('disabled');

        let newTrackCheckbox = $(`#track-${newIndex}-disp`);
        newTrackCheckbox.prop("checked", true);
        newTrackCheckbox.addClass('disabled');
    }


    onTrackClick(event) {
        let trackID = event.target.id.split('-')[1];
        let oldTrack = this.trackManager.currentTrack.absoluteIndex;
        if (trackID == oldTrack) {
            return;
        }
        this.clearEpipolarCanvases();
        // If there is a track that was previously selected as a subtrack, later transitioned to the
        // main track, it will now be put back into the subtrack.
        let redrawSubTracks = this.trackManager.unstashSubtrack();

        // If the track we are changing to is currently a subtrack, save it so that it can return
        // to being a subtrack later.
        if (this.trackManager.hasSubTrack(trackID)) {
            this.trackManager.stashSubtrack(trackID);
        }

        this.trackManager.changeCurrentTrack(trackID);
        this.updateCheckboxesOnChangeTrack(oldTrack, trackID, redrawSubTracks);

        this.drawTrack(trackID, redrawSubTracks);
    };

    onTrackDisplay(event) {
        event.stopPropagation();
        let trackID = event.target.id.split('-')[1];
        let isActive = $(`#trackdisp-${trackID}-icon`).get(0).classList.contains("fa-eye");
        if (isActive) {
            this.trackManager.addSubTrack(trackID);
            let callback = (videoIndex) => {
                let track = this.trackManager.findTrack(trackID);
                let points = this.clickedPointsManager.getClickedPointsFrameViewOffsetSensitive(videoIndex, trackID);
                this.videos[videoIndex].addSubTrack({"points": points, "color": track.color});
            };
            let message = messageCreator("addSubTrack", {track: trackID});
            this.communicatorsManager.updateAllLocalOrCommunicator(callback, message);
        } else {
            this.trackManager.removeSubTrack(trackID);
            let callback = (videoIndex) => {
                let infos = this.generateSubTrackInfos(videoIndex);
                this.videos[videoIndex].removeSubTrack(infos);
            };
            let message = messageCreator("removeSubTrack", {track: trackID});
            this.communicatorsManager.updateAllLocalOrCommunicator(callback, message);
        }
    }

    onTrackDelete(event) {
        event.stopPropagation();
        let trackID = event.target.id.split('-')[1];
        // change to default track (can't be deleted)
        if (this.trackManager.currentTrack.absoluteIndex === trackID) {
            this.trackManager.changeCurrentTrack(0);
        }
        this.trackManager.removeTrack(trackID);
        this.clickedPointsManager.removeTrack(trackID);
        let callback = (i) => {
            // Gets the default track
            let points = this.clickedPointsManager.getClickedPointsFrameViewOffsetSensitive(i, this.trackManager.currentTrack.absoluteIndex);
            let track = this.trackManager.currentTrack;
            this.videos[i].changeTracks(points, track.color);
            // let infos = this.generateSubTrackInfos(i); // TODO: I'm not sure what the heck this pattern is used for or what exactly does as I would use this terminology to describe the for loop below
            // TODO: This pattern has been implemented in this.drawAllPoints, but it also draws the current main track as well, hmmmmm
            // Perhaps this is fine .... . . . . . . . . . .
            this.videos[i].clearPoints(this.videos[i].subTrackCanvasContext);
            for (let j = 0; j < this.trackManager.subTracks.length(); j++) {
                let absoluteSubTrackIndex = this.trackManager.subTracks.trackIndicies[j];
                let subTrack = this.trackManager.findTrack(absoluteSubTrackIndex);
                let subTrackPoints = this.clickedPointsManager.getClickedPointsFrameViewOffsetSensitive(i, subTrack.absoluteIndex);
                this.videos[i].redrawPoints(
                    subTrackPoints,
                    subTrack.color,
                    this.videos[i].subTrackCanvasContext,
                    false
                );
            }
        };
        let message = messageCreator("removeTrack", {track: trackID});
        this.communicatorsManager.updateAllLocalOrCommunicator(callback, message);
        this.getEpipolarInfo(0, frameTracker[0]);
    }

    onTrackAdd(_) {
        /*
         * The expected behavior is for all subtracks to be reset and have a blank canvas
         */
        let currentInput = $(`#new-track-input`).val();
        let added = this.trackManager.addTrack(currentInput);
        if (added) {
            let indexOfLastAdded = this.trackManager.nextUnusedIndex - 1;
            this.clickedPointsManager.addTrack(indexOfLastAdded);
            this.trackManager.changeCurrentTrack(indexOfLastAdded);
            this.trackManager.resetSubtracks();

            resetTrackDropDownDispSelections();
            addTrackToDropDown(currentInput, indexOfLastAdded, true);


            let callback = (i) => {
                let points = this.clickedPointsManager.getClickedPointsFrameViewOffsetSensitive(i, indexOfLastAdded);
                let track = this.trackManager.currentTrack;
                this.clearEpipolarCanvases();
                this.videos[i].changeTracks(points, track.color);
                this.videos[i].resetSubtracks();
            };
            let message = messageCreator("addNewTrack", {name: currentInput});
            this.communicatorsManager.updateAllLocalOrCommunicator(callback, message);
        }
    }

    onTrackColorChange(trackID, color) {
        this.trackManager.findTrack(trackID).color = `rgb(${color._r}, ${color._g}, ${color._b})`;
        let isCurrentTrack = this.trackManager.hasSubTrack(trackID);
        let redrawPoints = isCurrentTrack || this.trackManager.currentTrack.absoluteIndex === trackID;
        if (redrawPoints) {
            let localCallback = (i) => {
                // if (isCurrentTrack) {
                //     this.videos[i].currentStrokeStyle.co
                // }
                this.drawAllPoints(i);
                if (this.trackManager.currentTrack.absoluteIndex === trackID) {
                    this.videos[i].drawZoomWindows(this.trackManager.findTrack(trackID).color);
                }
            };

            let message = messageCreator("trackColorChange", {
                trackID: trackID,
                color: color
            });
            this.communicatorsManager.updateAllLocalOrCommunicator(localCallback, message);
        }
    }

    // getReprojectionErrors(uvPoint, xyzPoint) {
    //     let errors = [];
    //     let undistortPoints = undistortPoints(uvPoint, CAMERA_PROFILE);
    //     let reconstructPoints = reconstructUV(DLT_COEFFICIENTS[0], xyzPoint);
    // }

    async exportPoints(options) {
        // Puts all points in ARGUS format
        let zip = new JSZip();

        let duration = this.videos[0].video.duration;
        let frames = Math.floor(duration * FRAME_RATE);

        let exportablePointsOriginal = [];
        let headerOriginal = [];
        let exportablePointsScale = [];
        let headerScale = [];
        for (let j = 0; j < this.trackManager.tracks.length; j++) {
            for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
                if (NUMBER_OF_CAMERAS === 1) {
                    headerScale.push(`${this.trackManager.tracks[j].name}_cam${i + 1}_x_rel`);
                    headerScale.push(`${this.trackManager.tracks[j].name}_cam${i + 1}_y_rel`);
                    // addon = "_org";
                }
                headerOriginal.push(`${this.trackManager.tracks[j].name}_cam${i + 1}_x`);
                headerOriginal.push(`${this.trackManager.tracks[j].name}_cam${i + 1}_y`);
            }
        }
        exportablePointsOriginal.push(headerOriginal.join(",") + "\n");
        if (NUMBER_OF_CAMERAS === 1) {
            exportablePointsScale.push(headerScale.join(",") + "\n")
        }
        let masterFrameArray = [];
        for (let i = 0; i < frames; i++) {
            let frameArray = [];
            let scaleArray = [];
            for (let q = 0; q < this.trackManager.tracks.length; q++) {
                for (let j = 0; j < NUMBER_OF_CAMERAS; j++) {
                    let trackIndex = this.trackManager.tracks[q].absoluteIndex;
                    let localPoints = this.clickedPointsManager.getClickedPoints(j, trackIndex);
                    let index = getIndexFromFrame(localPoints, i); // TODO: Global function
                    if (index === null) {
                        frameArray.push(NaN);
                        frameArray.push(NaN);
                    } else {
                        if (NUMBER_OF_CAMERAS === 1) {
                            if (this.scaleManager.unitRatio !== undefined) {
                                let yDist = Math.abs(this.scaleManager.initialPoint.y - this.scaleManager.finalPoint.y);
                                yDist = yDist === 0 ? 1 : yDist;
                                let xDist = Math.abs(this.scaleManager.initialPoint.x - this.scaleManager.finalPoint.x);
                                xDist = xDist === 0 ? 1 : xDist;
                                let dxunits = (parseFloat(this.scaleManager.unitRatio) * (xDist)) / this.distanceBetweenPoints(this.scaleManager.initialPoint, this.scaleManager.finalPoint);
                                let dyunits = (parseFloat(this.scaleManager.unitRatio) * (yDist)) / this.distanceBetweenPoints(this.scaleManager.initialPoint, this.scaleManager.finalPoint);
                                let scaledX = (dxunits * (localPoints[index].x - this.scaleManager.originPoint.x)) / (xDist);
                                let scaledY = (dyunits * (this.scaleManager.originPoint.y - localPoints[index].y)) / (yDist);
                                scaleArray.push(scaledX);
                                scaleArray.push(scaledY);
                            }
                            frameArray.push(localPoints[index].x);
                            if (options.flipped) {
                                frameArray.push(this.videosToSizes[j].height - localPoints[index].y);
                            } else {
                                frameArray.push(localPoints[index].y);
                            }
                        } else {
                            frameArray.push(localPoints[index].x);
                            frameArray.push(localPoints[index].y);
                        }
                    }
                }
            }
            exportablePointsOriginal.push(frameArray.join(",") + "\n");
            if (this.scaleManager.unitRatio !== undefined) {
                exportablePointsScale.push(scaleArray.join(",") + "\n");
            }
            masterFrameArray.push(frameArray);
        }
        zip.file("xy_coordinates.csv", exportablePointsOriginal.join(""));
        if (this.scaleManager.unitRatio !== undefined) {
            zip.file("xy_scaled.csv", exportablePointsScale.join(""));
        }
        if (NUMBER_OF_CAMERAS === 1 && this.scaleManager.unitRatio !== undefined) {
            zip.file("origin_system.json", JSON.stringify({
                origin: this.scaleManager.originPoint,
                point1: this.scaleManager.initialPoint,
                point2: this.scaleManager.finalPoint,
                units: this.scaleManager.unitRatio,
                unitName: this.scaleManager.unitName
            }));
        }

        if (DLT_COEFFICIENTS !== null) {
            let exportableXYZPoints = []
            let header = [];
            for (let j = 0; j < this.trackManager.tracks.length; j++) {
                header.push(`${this.trackManager.tracks[j].name}_x`);
                header.push(`${this.trackManager.tracks[j].name}_y`);
                header.push(`${this.trackManager.tracks[j].name}_z`);
            }
            exportableXYZPoints.push(header.join(",") + "\n");
            for (let i = 0; i < masterFrameArray.length; i++) {
                let local_xyzs = [];
                for (let j = 0; j < this.trackManager.tracks.length; j++) {
                    let frame = i;
                    let pointHelper = (videoIndex, trackIndex) => this.clickedPointsManager.getClickedPoints(videoIndex, trackIndex)

                    let coord = await getEpipolarLinesOrUnifiedCoord(0, frame, this.trackManager.tracks[j].absoluteIndex, this.videosToSizes, pointHelper, true)
                    if (coord.type === "unified") {
                        let xyz = coord.result[0];
                        local_xyzs.push(xyz[0][0]);
                        local_xyzs.push(xyz[0][1]);
                        local_xyzs.push(xyz[0][2]);
                    } else {
                        local_xyzs.push(NaN);
                        local_xyzs.push(NaN);
                        local_xyzs.push(NaN);
                    }
                }
                exportableXYZPoints.push(local_xyzs.join(",") + "\n");
            }
            zip.file("xyz_points.csv", exportableXYZPoints.join(""));
        }
        zip.generateAsync({type: "blob"})
            .then(function (content) {
                // see FileSaver.js
                let curDate = new Date();
                let month = "";
                if (curDate.getMonth() + 1 <= 9) {
                    month = `0${curDate.getMonth() + 1}`;
                } else {
                    month = curDate.getMonth();
                }
                saveAs(content, `${PROJECT_NAME}_${curDate.getFullYear()}-${month}-${curDate.getDate()}T${curDate.getTime()}.zip`);
            });
    }

    loadDLTCoefficients(file) {
        let reader = new FileReader();
        reader.onload = function () {
            DLT_COEFFICIENTS = parseDLTCoefficents(reader.result, ",");
            windowManager.getEpipolarInfo(0, frameTracker[0]);
        };
        reader.readAsText(file[0]);
    }

    importPoints(textLines, options) {
        /*
         * Header should be in the format track1_camera_x, track1_camera_y, track1_camera2_x, track1_camera2_y, etc..
         */
        let header = textLines[0];
        let headerSplit = header.split(",");
        const trackSet = new Set();
        const cameraSet = new Set();
        for (let i = 0; i < headerSplit.length; i++) {
            let currentHeader = headerSplit[i].split("_");
            let currentTrackName = currentHeader[0];
            let currentCamera = currentHeader[1];
            cameraSet.add(currentCamera);
            trackSet.add(currentTrackName);
        }
        if (cameraSet.size !== NUMBER_OF_CAMERAS) {
            generateError(`The file you are attempting to load has ${cameraSet.size} videos, you have loaded ${NUMBER_OF_CAMERAS} videos! ` +
                "If you want to load this file you must select only the videos relating to this project.");
            return;
        }
        let initTrackIndexes = [];
        for (let i = 0; i < trackSet.size; i++) {
            initTrackIndexes.push(i);
        }
        let localTrackManager = new TrackManager();
        let localClickedPointsManager = new ClickedPointsManager(cameraSet.size, initTrackIndexes);

        // Note that we can't initialize the track manager w/ tracks since color, etc is not contained in point sets
        // So we have to add them after the fact
        let track0Present = false;
        trackSet.forEach((trackName) => {
            if (trackName !== "Track 0") {
                localTrackManager.addTrack(trackName);
            } else {
                track0Present = true;
            }
        });
        let columnDict = {};
        for (let i = 1; i < textLines.length; i++) {
            let currentLine = textLines[i].split(",");
            let currentCameraIndex = 0;
            for (let j = 0; j < currentLine.length; j++) {
                if (isNaN(currentLine[j])) {
                    if (columnDict[j] === undefined) {
                        columnDict[j] = [];
                    }
                    continue;
                }

                if ((j + 2) % 2 === 0) {
                    // The mathematics here is a bit hard to see but write it out and you will understand
                    // J will be even in this case due to the above statement, when j is odd, the previous
                    // camera index follows since even-odd == x-y pairs
                    currentCameraIndex = (j / 2 + cameraSet.size) % cameraSet.size;
                }
                let factor = (j + 2) % 2 === 0 ? (600 / this.videosToSizes[currentCameraIndex].height) : (800 / this.videosToSizes[currentCameraIndex].width);

                if ((j + 2) % 2 !== 0) {
                    if (options.flipped) {
                        currentLine[j] = this.videosToSizes[currentCameraIndex].height - currentLine[j];
                    }
                }
                let newVal = currentLine[j] * factor;
                try {
                    columnDict[j].push(newVal);
                } catch (e) {
                    columnDict[j] = [];
                    columnDict[j].push(newVal);
                }
            }
        }

        let points = localClickedPointsManager.clickedPoints;
        let trackIndex = trackSet.has("Track 0") ? 0 : 1; // If Track 0 is not present, simply skip track 0.
        for (let i = 0; i < headerSplit.length / 2; i++) {
            let localRef = columnDict[i * 2 + 1];
            let cameraIndex = (i + cameraSet.size) % cameraSet.size;
            if (cameraIndex === 0 && i !== 0) {
                trackIndex += 1;
            }
            points[cameraIndex][trackIndex] = columnDict[i * 2].map((xval, idx) => {
                return {"x": xval, "y": localRef[idx], "frame": idx}
            });
        }

        windowManager.clickedPointsManager = localClickedPointsManager;
        windowManager.trackManager = localTrackManager;

        this.clickedPointsManager = localClickedPointsManager;
        this.trackManager = localTrackManager;

        let message = messageCreator("loadPoints", {
            newPoints: this.clickedPointsManager.clickedPoints
        });
        this.communicatorsManager.updateCommunicators(message);
        // Forces track manager update
        if (!track0Present) {
            // In this case, the user had no tracks named track 0. We are going to use the first track not
            // named track 0, which will correspond to track-1.
            // track-1-icon won't exist until we force an update. Since this is a cheap operation, it matters not
            $("#track-0-icon").click();
            $("#track-1-icon").click();
        } else {
            $("#track-0-icon").click();
            if (trackSet.size === 1) {
                this.drawTrack(0, false);
            } // Draws the default track
        }
    }

    onFrameViewOffsetChange(newOffset) {
        this.clickedPointsManager.setFrameViewOffset(newOffset);
        for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
            this.drawAllPoints(i);
        }
    }

    onEpipolarColorChange(color) {
        EPIPOLAR_COLOR = `rgb(${color._r}, ${color._g}, ${color._b})`;
        this.getEpipolarInfo(0, frameTracker[0]);
        let message = messageCreator("epipolarColorChange", {color: color});
        this.communicatorsManager.updateCommunicators(message);
    }


    loadSettings() {
        let allSettings = genericDivWidget("columns is-multiline is-centered is-mobile");
        let saveBinding = () => this.saveProject(false);
        let exportPointsBindings = {
            exportFunction: (options) => this.exportPoints(options)
        };
        let projectInfoBindings = {
            saveProjectBindings: saveBinding,
            exportPointBindings: exportPointsBindings,
            loadPoints: (file, options) => this.importPoints(file, options),
            onEpipolarColorChange: (color) => this.onEpipolarColorChange(color),
            keepAspectRatio: () => this.keepCanvasAspectRatio(false),
            loadDLTCoefficients: (file) => this.loadDLTCoefficients(file)
        };

        let trackBindings = {
            onTrackClick: (event) => this.onTrackClick(event),
            onTrackDisplay: (event) => this.onTrackDisplay(event),
            onTrackDelete: (event) => this.onTrackDelete(event),
            onTrackAdd: (event) => this.onTrackAdd(event),
            onTrackColorChange: (trackID, color) => this.onTrackColorChange(trackID, color),
            onFrameViewOffsetChange: (newOffset) => {
                this.onFrameViewOffsetChange(newOffset)
            },
            getCurrentTrack: () => this.trackManager.currentTrack,
            getSelectableTracks: () => this.trackManager.tracks.filter((track) => track.absoluteIndex !== this.trackManager.currentTrack.absoluteIndex),
            getSelectedTracks: () => this.trackManager.subTracks.trackIndicies.map((index) => this.trackManager.findTrack(index))
        };
        let trackWidgets = trackWidget(trackBindings);
        allSettings.append(trackWidgets);

        let loadDLTButton = NUMBER_OF_CAMERAS > 1;
        let projectInfo = projectInfoWidget(projectInfoBindings, loadDLTButton);
        allSettings.append(projectInfo);

        let frameMovementSettingsBindings = {
            inverseSetting: (setting) => {
                this.settings[setting] = !this.settings[setting];
                if (this.settings["sync"] && setting === "sync") {
                    for (let i = 0; i < this.videos.length; i++) {
                        this.videos[i].goToFrame(frameTracker[this.lastFocusedCanvas]);
                    }
                }
            },
            get: (setting) => this.settings[setting]
        }

        let forwardBackwardsBindings = {
            onChange: (event) => {
                let errorBox = $("#forward-frame-input-error");
                let newOffset = parseInt($("#" + event.target.id).val());
                if (!isNaN(newOffset)) {
                    this.settings["movementOffset"] = newOffset;
                    errorBox.text("");
                    this.communicatorsManager.updateCommunicators(this.messageCreator("updateSettings", {"settings": this.settings}));

                } else {
                    errorBox.text("Must be a valid integer");
                }
            },
            get: (initValue) => {
                return this.settings[initValue];
            }
        }

        let miscSettingsBindings = {
            "frameMovementBindings": frameMovementSettingsBindings,
            "forwardBackwardOffsetBindings": forwardBackwardsBindings
        };
        allSettings.append(miscSettingsWidget(miscSettingsBindings));

        if (NUMBER_OF_CAMERAS === 1) {
            this.scaleManager = new ScaleManager(this.videos[0], this.videosToSizes[0], this.trackManager);
            let scaleBindings = {
                scaleMode: () => {
                    this.locks.can_click = false;
                    this.TEMP_SCALE_CALLBACK_UP = () => this.onMouseUp();
                    this.TEMP_SCALE_CALLBACK_DOWN = () => this.onMouseDown();
                    $(document).on("mouseup", this.TEMP_SCALE_CALLBACK_UP);
                    $(document).on("mousedown", this.TEMP_SCALE_CALLBACK_DOWN);
                },
                disableScaleMode: () => {
                    this.locks.can_click = true;
                    this.drawAllPoints(0);
                }
            };
            allSettings.append(scaleWidget(this.scaleManager, scaleBindings));
        }

        $("#settings").append(allSettings);
    }


    distanceBetweenPoints(point1, point2) {
        let distRel = Math.sqrt((point1.x - point2.x) ** 2 + (point1.y - point2.y) ** 2);
        return distRel
    }

    loadCameraProfile(event) {
        let selectedFiles = Array.from($(`#${event.target.id}`).prop("files"));
        let reader = new FileReader();
        reader.onload = function () {
            CAMERA_PROFILE = parseCameraProfile(reader.result, " ");
        };
        reader.readAsText(selectedFiles[0]);
    }

    loadDLTCoefficents(event) {
        let selectedFiles = Array.from($(`#${event.target.id}`).prop("files"));
        let reader = new FileReader();
        reader.onload = () => {
            // TODO: Not sure why there is a separator here, was I supposed to ask the user what separator they use?
            DLT_COEFFICIENTS = parseDLTCoefficents(reader.result, ",");
            this.getEpipolarInfo(0, frameTracker[0]);
        };
        reader.readAsText(selectedFiles[0]);
    }

// End Settings Module

    autoAdvance(context, ignoreIndex) {
        frameTracker[context.index] += this.settings["movementOffset"];
        if (this.settings['sync']) {
            this.syncVideos({frame: frameTracker[context.index], index: context.index}, ignoreIndex);
        } else {
            let message = messageCreator("goToFrame", {"frame": frameTracker[context.index]});
            this.communicatorsManager.updateLocalOrCommunicator(context.index, message);
        }
    }


    syncVideos(context, ignoreindex) {
        for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
            // Yes technically we would update this twice
            // but it isn't that big of a deal and writing a
            // statement to check against this would just make
            // the code super confusing.
            frameTracker[i] = context.frame;
        }
        let callback = (index) => {
            this.videos[index].goToFrame(context.frame);
        };
        let message = messageCreator("goToFrame", {"frame": context.frame});
        let doNotUpdate = ignoreindex === true ? context.index : null;
        this.communicatorsManager.updateAllLocalOrCommunicator(callback, message, doNotUpdate);
        this.clearEpipolarCanvases();
        this.getEpipolarInfo(context.index, frameTracker[context.index]);
    }

    goToFrame(id, frame) {
        if (this.settings["sync"] === true) {
            // This has to happen first, otherwise there could be issues when considering the redrawWindow
            // callback + frameViewOffsets
            for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
                frameTracker[i] = frame;
            }

            let callback = (i) => {
                this.videos[i].goToFrame(frame);
            };
            let message = messageCreator("goToFrame", {frame: frame});
            this.communicatorsManager.updateAllLocalOrCommunicator(callback, message);
        } else {
            this.videos[id].goToFrame(frame);
        }
        this.clearEpipolarCanvases();
        this.getEpipolarInfo(id, frame);
    }

// Keyboard Inputs \\
    goForwardFrames(id) {
        let frame = frameTracker[id] + this.settings["movementOffset"];
        this.goToFrame(id, frame);
    }

    goBackwardsAFrame(id) {
        if (frameTracker[id] - this.settings["movementOffset"] < 0) {
            return;
        }

        let frame = frameTracker[id] - this.settings["movementOffset"];
        this.goToFrame(id, frame);
    }

// Keyboard Inputs End \\

    changeTrack(newTrack) {
        this.trackManager.changeCurrentTrack(newTrack);
        let videoChangeTrack = (videoObj) => {
            videoObj.changeTrack(this.trackManager);
        };

        let message = this.messageCreator("changeTrack", {track: newTrack});
        this.communicatorsManager.updateAllLocalOrCommunicator(videoChangeTrack, message);
    }

    removeVideoFromDOM(index) {
        $(`#masterColumn-${index}`).remove();
    }

    createPopoutWidget(currentIndex) {
        let popOutButton = popOutButtonWidget(
            currentIndex,
            this.videoFilesMemLocations[currentIndex],
            (videoIndex, videoURL) => this.popOutVideo(videoIndex, videoURL)
        );
        $(`#pop-out-${currentIndex}-placeholder`).append(popOutButton);
    }

    loadVideoIntoDOM(parsedInputs) {
        super.loadVideoIntoDOM(parsedInputs);
        this.createPopoutWidget(parsedInputs.index);
        this.keepCanvasAspectRatio(true); // A little wasteful as I resize previous videos that don't need it
    }


    loadNewProject() {
        $("#starter-menu").remove();
        $("#footer").remove();
        let saveSettings = (parsedInputs, previous) => this.initializationSaveSettings(parsedInputs, previous);
        let context = this.createSettingsContext(true, saveSettings, 0);
        this.getVideoSettings(context, this.defaultVideoSettings);
    }


    async popOutVideo(videoIndex, videoURL) {
        // Pops a video into a new window for easier viewing.
        // videoIndex: integer, index of the current video
        // videoURL: a data url that is used as the src= attribute of the video tag in the popout.
        let pointHelper = (vI, tI) => {
            return this.clickedPointsManager.getClickedPointsFrameViewOffsetSensitive(vI, tI);
        };
        let curEpipolarInfo = await getEpipolarLinesOrUnifiedCoord(videoIndex, frameTracker[videoIndex],
            this.trackManager.currentTrack.absoluteIndex, this.videosToSizes, pointHelper);
        let currentInfo = undefined;
        let currentInfoType = undefined;
        if (curEpipolarInfo !== null) {
            if (curEpipolarInfo.type === "unified") {
                let xyz = curEpipolarInfo.result[0];
                let currentPoint = reconstructUV(DLT_COEFFICIENTS[videoIndex], xyz[xyz.length - 1]);
                currentInfo = {x: currentPoint[0][0], y: currentPoint[1][0]};
                currentInfoType = "unified";
            } else {
                // TODO: Okay so obviously curEpipolarInfo returns to many different things.
                // curEpipolarInfo can be the following:
                // undefined: there is already a point in the video for the frame
                // list with length 0: there COULD be two lines in a video, but this video has no lines
                // non-empty list.
                if (curEpipolarInfo.result[videoIndex] === undefined) {
                    currentInfo = undefined;
                    currentInfoType = undefined;
                } else if (curEpipolarInfo.result[videoIndex].length === 0) {
                    currentInfo = undefined;
                    currentInfoType = undefined;
                } else {
                    currentInfo = curEpipolarInfo.result[videoIndex];
                    currentInfoType = "epipolar";
                }
            }
        }

        let message = {
            "dataURL": videoURL,
            "index": videoIndex,
            'noOfCameras': NUMBER_OF_CAMERAS,
            "videoName": this.videos[videoIndex].name,
            "clickedPoints": this.clickedPointsManager.clickedPoints,
            "frameViewOffset": this.clickedPointsManager.frameViewOffset,
            "offset": this.videos[videoIndex].offset,
            "currentTracks": this.trackManager,
            "initFrame": frameTracker[videoIndex],
            "currentColorSpace": VIDEO_TO_COLORSPACE,
            "frameRate": FRAME_RATE,
            "pointRadius": VIDEO_TO_POINT_SIZE,
            "videoSettings": this.videosToSettings[videoIndex],
            "settings": this.settings,
            "isEpipolarLocked": this.videos[videoIndex].isEpipolarLocked,
            "epipolarInfo": {
                isEpipolar: currentInfo !== undefined,
                info: currentInfo,
                infoType: currentInfoType
            }
        };

        // Hide Videos
        let currentSection = $(`#masterColumn-${videoIndex}`);
        currentSection.css('display', 'none');
        // Open a communication channel that awaits a message from the pop out
        let openedChannel = this.communicatorsManager.initializePopoutWindow(videoIndex, message);

        if (!openedChannel) {
            currentSection.css('display', '');
            generateError("Can't pop out window while already popping out another window!");
            return;
        }

        // Create the popout window
        let URL = generatePopOutURL();
        let poppedOut = window.open(URL, `${videoIndex}`,
            `location=yes,height=${600},width=${800},scrollbars=yes,status=yes,detab=yes,toolbar=0`);

        this.poppedWindows.push(poppedOut);

        // Check for popout failure
        if (!poppedOut || poppedOut.closed || typeof poppedOut.closed == 'undefined') {
            this.communicatorsManager.closeCurrentInitialization();
            currentSection.css('display', '');
            generateError("Could not pop out video! Ensure that you have pop-ups enabled for this website!");
        }
    }

    killPoppedWindows() {
        this.poppedWindows.forEach((poppedWindow) => {
            try {
                poppedWindow.close();
            } catch (e) {
                // Popped window no longer exists.
            }
        });
    }

    initializationSaveSettings(parsedInputs, previous = false) {
        let index = parsedInputs.index;
        this.videosToSettings[index] = parsedInputs
        if (parsedInputs.index === 0) {
            FRAME_RATE = parsedInputs.frameRate;
        }
        VIDEO_TO_COLORSPACE[parsedInputs.index] = parsedInputs.filter.colorspace;
        VIDEO_TO_POINT_SIZE[parsedInputs.index] = parsedInputs.pointSize;

        // TODO: separate this out probably so it's easier to update
        let saveSettings = (parsedInputs, previous) => this.initializationSaveSettings(
            parsedInputs, previous
        );
        if (previous === true) {
            index -= 1;
            let context = this.createSettingsContext(true, saveSettings, index);
            this.removeVideoFromDOM(index);
            context.loadVideo = false;
            this.loadVideoIntoDOM(parsedInputs);
            this.slideInputModalOut(700, () => this.getVideoSettings(context, this.videosToSettings[index]));
        } else {
            index += 1;
            let context = this.createSettingsContext(true, saveSettings, index);
            if ($(`#masterColumn-${index}`).get(0) !== undefined) {
                context.loadVideo = false;
                this.removeVideoFromDOM(index);
            }
            if (index === NUMBER_OF_CAMERAS) {
                this.loadVideoIntoDOM(parsedInputs);
                this.loadSettings();
                this.emptyInputModal();
                $("#generic-input-modal").removeClass("is-active");
                $(".blurrable").css("filter", "");
                // TODO: Disabled for presentation
                // AUTO_SAVE_INTERVAL_ID = setInterval(() => {
                //         this.saveProject(true)
                //     },
                //     60000);
                $(window).on("resize", () => this.keepCanvasAspectRatio(false));

                // Smooth scrolls if the window is considered mobile via bulma's framework
                if ($(window).width() <= 768) {
                    window.scroll({
                        top: $("#canvas-0").get(0).getBoundingClientRect().y,
                        behavior: 'smooth'
                    });
                }
            } else {
                this.loadVideoIntoDOM(parsedInputs);
                if (this.videosToSettings[index] === undefined) {
                    this.slideInputModalOut(700, () => this.getVideoSettings(context, this.defaultVideoSettings));
                } else {
                    this.slideInputModalOut(700, () => this.getVideoSettings(context, this.videosToSettings[index]));
                }
            }
        }
    }

    addNewPoint(event) {
        let point = super.addNewPoint(event).point;
        if (point == null) {
            return;
        } // This is the case where the video has not loaded/reloaded
        if (this.settings["auto-advance"]) {
            if (this.settings["sync"]) {
                for (let i = 0; i < this.videos.length; i++) {
                    frameTracker[i] = point.frame;
                }

                let localCallback = (index) => {
                    this.videos[index].goToFrame(frameTracker[index] + this.settings["movementOffset"]);
                    this.clearEpipolarCanvases();
                    this.getEpipolarInfo(index, frameTracker[index]);
                };

                let message = this.messageCreator("goToFrame", {frame: point.frame + this.settings["movementOffset"]});

                this.communicatorsManager.updateAllLocalOrCommunicator(localCallback, message);
            } else {
                let index = event.target.id.split("-")[1];
                this.videos[index].goToFrame(point.frame + this.settings["movementOffset"]);
                this.clearEpipolarCanvases();
                this.getEpipolarInfo(index, frameTracker[index]);
            }
        } else {
            let index = event.target.id.split("-")[1];
            this.clearEpipolarCanvases();
            this.getEpipolarInfo(index, frameTracker[index]);
            // We know there is a focused point that has to be drawn in this case
            // but normally this check is only preformed on a frame change, thus, we need to manually trigger it
            // and redraw the zoom window to reflect this
            this.videos[index].clearFocusedPointCanvas();
            this.videos[index].drawFocusedPoint(point.x, point.y);
            this.videos[index].isDisplayingFocusedPoint = true;
            this.videos[index].drawZoomWindows(this.trackManager.currentTrack.color);
        }
    }

    removePoint(e) {
        let message = messageCreator("clearEpipolarCanvas");
        this.communicatorsManager.updateCommunicators(message);
        super.removePoint(e);

    }
}

class PopOutWindowManager extends WindowManager {
    constructor(numberOfVideos, currentVideo, clickedPoints, tracks, settings) {
        super();
        this.clickedPointsManager = new ClickedPointsManager(numberOfVideos, null, clickedPoints);
        this.trackManager = new TrackManager(tracks);
        this.settings = settings;
        this.absoluteIndex = currentVideo;
        this.curEpipolarInfo = [];
        this.curEpipolarInfo[this.absoluteIndex] = {type: EPIPOLAR_TYPES.NONE};

        let callbacks = {
            "goToFrame": (frame) => {
                this.curEpipolarInfo[this.absoluteIndex] = {type: EPIPOLAR_TYPES.NONE};
                this.videos[currentVideo].goToFrame(frame);
                this.clearEpipolarCanvases(this.absoluteIndex);
            },
            "changeTrack": (newTrackAbsoluteIndex) => {
                this.trackManager.changeCurrentTrack(newTrackAbsoluteIndex);
                let points = this.clickedPointsManager.getClickedPointsFrameViewOffsetSensitive(currentVideo, newTrackAbsoluteIndex);
                let color = this.trackManager.currentTrack.color;
                this.clearEpipolarCanvases(this.absoluteIndex);
                this.videos[currentVideo].changeTracks(points, color);
            },
            "addNewTrack": (newTrackName) => {
                this.trackManager.addTrack(newTrackName);
                let newTrackIndex = this.trackManager.nextUnusedIndex - 1;
                this.trackManager.changeCurrentTrack(newTrackIndex);
                this.clickedPointsManager.addTrack(newTrackIndex);
                this.clearEpipolarCanvases(this.absoluteIndex);
                this.videos[currentVideo].changeTracks(newTrackIndex);
            },
            "removeTrack": (trackIndex) => {
                if (this.trackManager.currentTrack.absoluteIndex == trackIndex) {
                    this.trackManager.changeCurrentTrack(0);
                }
                this.trackManager.removeTrack(trackIndex);
                let track = this.trackManager.currentTrack;
                let points = this.clickedPointsManager.getClickedPointsFrameViewOffsetSensitive(this.absoluteIndex, track.absoluteIndex);
                this.videos[this.absoluteIndex].changeTracks(points, track.color);
                this.videos[this.absoluteIndex].clearPoints(this.videos[this.absoluteIndex].subTrackCanvasContext);
                for (let j = 0; j < this.trackManager.subTracks.length(); j++) {
                    let absoluteSubTrackIndex = this.trackManager.subTracks.trackIndicies[j];
                    let subTrack = this.trackManager.findTrack(absoluteSubTrackIndex);
                    let subTrackPoints = this.clickedPointsManager.getClickedPointsFrameViewOffsetSensitive(this.absoluteIndex, subTrack.absoluteIndex);
                    this.videos[this.absoluteIndex].redrawPoints(
                        subTrackPoints,
                        subTrack.color,
                        this.videos[this.absoluteIndex].subTrackCanvasContext,
                        false
                    );
                }
            },
            "trackColorChange": (trackID, color) => {
                this.trackManager.findTrack(trackID).color = `rgb(${color._r}, ${color._g}, ${color._b})`;
                let redrawPoints = this.trackManager.hasSubTrack(trackID) || this.trackManager.currentTrack.absoluteIndex === trackID;
                if (redrawPoints) {
                    this.drawAllPoints(this.absoluteIndex);
                    if (this.trackManager.currentTrack.absoluteIndex === trackID) {
                        this.videos[this.absoluteIndex].drawZoomWindows(this.trackManager.findTrack(trackID).color);
                    }
                }
            },
            "epipolarColorchange": (color) => {
                EPIPOLAR_COLOR = `rgb(${color._r}, ${color._g}, ${color._b})`;
                this.clearEpipolarCanvases(this.absoluteIndex);
                this.videos[currentVideo].drawEpipolarLines(this.curEpipolarInfo[this.absoluteIndex].data);
            },
            "addSubTrack": (subTrackID) => {
                this.trackManager.addSubTrack(subTrackID);
                let track = this.trackManager.findTrack(subTrackID);
                let points = this.clickedPointsManager.getClickedPointsFrameViewOffsetSensitive(currentVideo, subTrackID);
                this.videos[currentVideo].addSubTrack({"points": points, "color": track.color});
            },
            "removeSubTrack": (subTrackID) => {
                this.trackManager.removeSubTrack(subTrackID);
                let infos = this.generateSubTrackInfos(currentVideo);
                this.videos[currentVideo].removeSubTrack(infos);
            },
            "clearEpipolarCanvas": () => {
                // Used for remove point
                this.clearEpipolarCanvases(this.absoluteIndex);
            },
            "drawEpipolarLine": (lineInfo) => {
                this.clearEpipolarCanvases(this.absoluteIndex);
                this.curEpipolarInfo[this.absoluteIndex] = {type: EPIPOLAR_TYPES.LINE, data: lineInfo};
                this.videos[currentVideo].drawEpipolarLines(lineInfo);
            },
            "drawDiamond": (x, y) => {
                this.clearEpipolarCanvases(this.absoluteIndex);
                this.curEpipolarInfo[this.absoluteIndex] = {type: EPIPOLAR_TYPES.POINT};
                this.videos[currentVideo].drawDiamond(x, y, 10, 10);
            },
            "loadPoints": (newPoints) => {
                this.clickedPointsManager.clickedPoints = newPoints;
            },
            "mainWindowDeath": () => {
                killSelf = true;
            },
            "updateSettings": (settings) => {
                this.settings = settings;
            },
        };
        this.communicatorsManager = new CommunicatorsManager(STATES.POP_OUT, callbacks);
        this.communicatorsManager.registerCommunicator(currentVideo);
    }

    goToInputFrame(index) {
        this.curEpipolarInfo[index] = {type: EPIPOLAR_TYPES.NONE};
        return super.goToInputFrame(index);
    }

    saveSettings(parsedInputs, previous) {
        super.saveSettings(parsedInputs, previous);
        if (previous) {
            return;
        }
        let message = messageCreator("updateVideoSettings", {videoSettings: parsedInputs});
        this.communicatorsManager.updateCommunicators(message);
    }

    goToFrame(id, frame) {
        this.clearEpipolarCanvases(this.absoluteIndex);
        this.curEpipolarInfo[id] = {type: EPIPOLAR_TYPES.NONE};
        this.videos[id].goToFrame(frame);
        let message = messageCreator("goToFrame", {frame: frame, index: id});
        this.communicatorsManager.updateCommunicators(message);
    }

    goForwardFrames(id) {
        let frame = frameTracker[id] + this.settings["movementOffset"];
        this.goToFrame(id, frame);
    }

    goBackwardsAFrame(id) {
        let frame = frameTracker[id] - this.settings["movementOffset"];
        if (frame < 0) {
            return;
        }
        this.goToFrame(id, frame);
    }

    loadVideoIntoDOM(parsedInputs) {
        /*
         * For main documentation see: WindowManager -> loadVideoIntoDOM
         * Changes:
         *   parsedInputs now requires "frame" attribute. This represents
         *   the frame the video should load to. (see: pop_out.js -> setup())
         */
        let videoTag = $(`#video-${parsedInputs.index}`);
        super.loadVideoIntoDOM(parsedInputs);
        this.videos[parsedInputs.index].isEpipolarLocked = parsedInputs.isEpipolarLocked;
        this.videos[parsedInputs.index].goToFrame(parsedInputs.frame);
        this.videosToSettings[parsedInputs.index] = parsedInputs; // extra info, but removed on update/works.
        this.videoFiles[this.absoluteIndex] = {name: parsedInputs.name};
        videoTag.one("canplay", () => {
            this.drawAllPoints(parsedInputs.index);
            if (parsedInputs.epipolarInfo.isEpipolar) {
                if (parsedInputs.epipolarInfo.infoType === "epipolar") {
                    this.clearEpipolarCanvases(this.absoluteIndex);
                    this.curEpipolarInfo[this.absoluteIndex] = {
                        type: EPIPOLAR_TYPES.LINE,
                        data: parsedInputs.epipolarInfo.info
                    };
                    this.videos[parsedInputs.index].drawEpipolarLines(parsedInputs.epipolarInfo.info);
                } else {
                    this.clearEpipolarCanvases(this.absoluteIndex);
                    this.curEpipolarInfo[this.absoluteIndex] = {type: EPIPOLAR_TYPES.POINT};
                    this.videos[parsedInputs.index].drawDiamond(
                        parsedInputs.epipolarInfo.info.x,
                        parsedInputs.epipolarInfo.info.y,
                        10,
                        10
                    );
                }
            }
        });
        this.keepCanvasAspectRatio(true);
        $(window).on("resize", () => this.keepCanvasAspectRatio(false));
    }

    addNewPoint(event) {
        let point = super.addNewPoint(event);
        if (point.point === null) {
            return;
        }
        let index = event.target.id.split('-')[1];
        let message = messageCreator("newPoint", {
            "point": point.point,
            "absoluteIndex": this.trackManager.currentTrack.absoluteIndex,
            "index": index,
            "pointIndex": point.pointIndexInfo.index
        });

        this.communicatorsManager.updateCommunicators(message);
    }

    removePoint(event) {
        let pointInfo = super.removePoint(event);
        let message = messageCreator("removePoint", pointInfo);
        this.communicatorsManager.updateCommunicators(message);
    }
}

class ScaleManager {
    constructor(video, videoSize, trackManagerReference) {
        this.video = video;
        this.videoSize = videoSize;
        this.trackManagerReference = trackManagerReference;
        this.originPoint = {
            x: videoSize.width / 2,
            y: videoSize.height / 2
        };
        this.initialPoint = {};
        this.finalPoint = {};
        this.isActive = false;
        this.originSet = false;
    }

    drawCrossAxis(centerPoint) {
        this.video.drawLine(
            {x: 0, y: centerPoint.y},
            {x: this.videoSize.width, y: centerPoint.y},
            this.video.canvasContext,
            this.trackManagerReference.currentTrack.color
        );
        this.video.drawLine(
            {x: centerPoint.x, y: 0},
            {x: centerPoint.x, y: this.videoSize.height},
            this.video.canvasContext,
            this.trackManagerReference.currentTrack.color
        );
    }

    redrawScalePoint() {
        this.video.drawScalePoint(this.initialPoint, 15);
        this.video.drawScalePoint(this.finalPoint, 15);
        this.video.drawLine(this.initialPoint, this.finalPoint, this.video.canvasContext, COLORS[5]);
    }

    startScaleSet(onMouseUpCallback, onMouseDownCallback) {
        $("#set-scale-button").prop("disabled", true);
        this.video.isDisplayingFocusedPointStore = this.video.isDisplayingFocusedPoint;
        this.video.isDisplayingFocusedPoint = false;
        this.video.clearPoints(this.video.canvasContext);
        this.video.clearPoints(this.video.subTrackCanvasContext);

        this.video.drawScalePoint(this.originPoint, 20);
        this.drawCrossAxis(this.originPoint);

        this.originSet = false;
        this.isActive = true;
    }

    cleanUpOrigin() {
        this.video.clearPoints(this.video.canvasContext);
        this.originSet = true;
        this.initialPoint = {
            x: (this.videoSize.width / 2) - (this.videoSize.width / 3),
            y: this.videoSize.height / 2
        };
        this.finalPoint = {
            x: (this.videoSize.width / 2) + (this.videoSize.width / 3),
            y: (this.videoSize.height / 2)
        };
        this.redrawScalePoint();
    }

    saveScale(unitName, unitRatio) {
            if (isNaN(parseFloat(unitRatio))) {
                return "unitRatio";
            }

            if (unitName.length === 0) {
                return "unitName";
            }

            // this.locks.can_click = true;
            // this.drawAllPoints(0);
            this.isActive = false;
            this.unitRatio = $("#unitRatio").val();
            this.unitName = $("#unitName").val();
            this.video.isDisplayingFocusedPoint = this.video.isDisplayingFocusedPointStore;
            return "";
    }
}