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
        this.clickedPointsManager = null; // Implement in subclasses
        this.communicationsManager = null; // Implement in subclasses
        this.locks = {
            "can_click": true,
            "init_frame_loaded": false,
            "resizing_mov": false,
            "can_pop_out": true,
        };
        this.settings = {
            "auto-advance": true,
            "sync": true
        };
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
        if (this.locks["can_click"]) {
            let index = event.target.id.split("-")[1];
            let point = Video.createPointObject(index);

            let override = this.clickedPointsManager.addPoint(point,
                {clickedVideo: index, currentTrack: this.trackManager.currentTrack.absoluteIndex}
            );
            let localPoints = this.clickedPointsManager.getClickedPoints(index, this.trackManager.currentTrack.absoluteIndex);

            if (override) {
                this.videos[index].redrawPoints(localPoints);
            } else {
                this.videos[index].drawNewPoint(point, localPoints);
            }

            this.locks["can_click"] = !this.settings["auto-advance"];
            if (this.settings["auto-advance"]) {
                if (this.settings["sync"]) {
                    for (let i = 0; i < this.videos.length; i++) {
                        frameTracker[i] = point.frame;
                    }

                    let localCallback = (index) => {
                        this.videos[index].moveToNextFrame();
                    };

                    let message = this.messageCreator("goToFrame", {frame: point.frame + 1});

                    this.communicatorsManager.updateAllLocalOrCommunicator(localCallback, message);
                } else {
                    this.videos[index].moveToNextFrame();
                }
            } else {
                Video.clearEpipolarCanvases();
                getEpipolarLinesOrUnifiedCoord(index, frameTracker[index]);
            }
        }
    }

    setMousePos(e) {
        if (ZOOM_WINDOW_MOVING) {
            let zoom = ZOOM_BEING_MOVED;
            zoom.css("position", "absolute");
            mouseTracker.x = e.pageX - (parseInt(zoom.css("width"), 10) / 2);
            mouseTracker.y = e.pageY - (parseInt(zoom.css("height"), 10) / 2);


            for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
                let voidArea = $(`#${videos[i].canvas.id}`);
                let leftBorder = voidArea.offset().left;
                let rightBorder = leftBorder + voidArea.width();
                let heightStart = voidArea.offset().top;
                let heightEnd = heightStart + voidArea.height();

                if ((mouseTracker.x + 400 >= leftBorder && mouseTracker.x <= rightBorder) &&
                    (mouseTracker.y + 400 >= heightStart && mouseTracker.y <= heightEnd)) {
                    return;
                }
            }

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

                let currentColor = trackTracker.currentTrack.color;
                this.videos[e.target.id.split("-")[1]].drawZoomWindow(currentColor);
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

                let currentEpipolarCanvas = $(`#epipolarCanvas-${e.target.id.split("-")[1]}`);
                currentEpipolarCanvas.css("height", mouseTracker.y);
                currentEpipolarCanvas.css("width", mouseTracker.x);
            }
        }
    }

    goForwardAFrame() {
    }

    goBackwardsAFrame() {
    }

    goToInputFrame() {
    }

    handleKeyboardInput(e) {
        let id;
        try {
            id = parseInt(e.target.id.split("-")[1], 10);
        } catch (e) {
            return;
        }

        if (String.fromCharCode(e.which) === "Q") {
            triggerResizeMode();
        } else if (String.fromCharCode(e.which) === "F") {
            this.goForwardAFrame(id);
        } else if (String.fromCharCode(e.which) === "B") {
            this.goBackwardsAFrame(id);
        } else if (String.fromCharCode(e.which) === "G") {
            this.goToInputFrame(id);
        } else if (String.fromCharCode(e.which) === "Z") {
            this.videos[id].zoomInZoomWindow();
        } else if (String.fromCharCode(e.which) === "X") {
            this.videos[id].zoomOutZoomWindow();
        }
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
        frameTracker[currentIndex] = 1.001;
        let loadPreviewFrameFunction = (videoIndex) => {
            let pointsToDraw = this.clickedPointsManager.getClickedPoints(
                currentIndex,
                this.trackManager.currentTrack.absoluteIndex);
            this.videos[videoIndex].loadFrame(pointsToDraw, this.trackManager.currentTrack.color);
        };

        let updateVideoPropertyCallback = (property, propertyValue) => {
            this.videos[currentIndex][property] = propertyValue;
        };

        let currentClickerWidget = clickerWidget(
            parsedInputs.index,
            updateVideoPropertyCallback,
            loadPreviewFrameFunction,
            (event) => this.handleKeyboardInput(event),
            (event) => this.addNewPoint(event),
            (event) => this.deletePoint(event),
            (event) => this.setMousePos(event)
        );
        currentClickerWidget.find(`#videoLabel-${currentIndex}`).text(
            videoLabelDataToString({
                'title': parsedInputs.videoName,
                'frame': frameTracker[currentIndex],
                'offset': parsedInputs.offset
            })
        );
        $("#canvases").append(currentClickerWidget);
        this.videos[currentIndex] = new Video(currentIndex, parsedInputs.videoName, parsedInputs.offset);

        // Forces an update so that the video will be guaranteed to draw at least once
        let currentVideo = document.getElementById(`video-${currentIndex}`);
        currentVideo.currentTime = currentVideo.currentTime;

        // TODO: Note that at this point there is wasted time in calling a function that
        // draws the preview frame in the modal which is deleted at this point
        // I don't know the performance effects of this. The below code will also remove error
        // warnings and I'm not sure if that's such as good idea....
        // $(`#video-${currentIndex}`).off();

        $(`#video-${currentIndex}`).on("canplay", () => {
            loadPreviewFrameFunction(currentIndex);
            this.locks.can_click = true;
        });
    }

    messageCreator(type, data) {
        return {"type": type, "data": data};
    }
}

class MainWindowManager extends WindowManager {
    constructor(projectTitle, projectDescription, projectID, files) {
        super();
        this.clickedPointsManager = new ClickedPointsManager(files.length);
        NUMBER_OF_CAMERAS = files.length;
        this.videoFiles = files;
        this.videoFilesMemLocations = {};

        let communicationsCallbacks = {
            'newFrame': (context) => {
                frameTracker[context.index] = context.frame;

                if (this.settings['sync']) {
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
                    this.communicatorsManager.updateAllLocalOrCommunicator(callback, message, context.index);
                }
            },
            'popoutDeath': (data) => {
                // rerender video
                this.videos[data.index].clearPoints();
                let index = null;
                this.communicatorsManager.removeCommunicator(index);


                $(`#canvas-columns-${data.index}`).show();
                $(this.videos[data.index].zoomCanvas).show();
                let localClickedPoints = this.clickedPointsManager.getClickedPoints(data.index, trackTracker.currentTrack.absoluteIndex);
                this.videos[data.index].goToFrame(frameTracker[data.index]);


                // Load Points afterwards to remove jank
                let drawPoints = () => {
                    this.videos[data.index].drawPoints(localClickedPoints);
                    this.videos[data.index].drawLines(localClickedPoints);
                    $(this.videos[data.index].video).unbind("canplay", drawPoints);
                };
                $(this.videos[data.index].video).on("canplay", drawPoints);

                // getEpipolarLinesOrUnifiedCoord(data.index, frameTracker[data.index]);
            },
            'newPoint': () => {

            },
            'initLoadFinished': () => {

            }
        };
        this.communicatorsManager = new CommunicatorsManager(STATES.MAIN_WINDOW, communicationsCallbacks);
    }


    // Keyboard Inputs \\
    goForwardAFrame(id) {
        let frame = frameTracker[id] + 1;
        if (settings["sync"] === true) {

            let callback = (i) => {
                this.videos[i].moveToNextFrame();
            };
            let message = messageCreator("goToFrame", {frame: frame});

            this.communicatorsManager.updateAllLocalOrCommunicator(callback, message);
            for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
                frameTracker[i] = frame;
            }

        } else {
            this.videos[id].moveToNextFrame();
        }
        // getEpipolarLinesOrUnifiedCoord(id, frame);
    }

    goBackwardsAFrame(id) {
        if (frameTracker[id] < 2) {
            return;
        }

        let frame = frameTracker[id] - 1;
        if (settings["sync"] === true) {
            let callback = (i) => {
                this.videos[i].goToFrame(frame);
            };
            let message = messageCreator("goToFrame", {frame: frame});

            this.communicatorsManager.updateAllLocalOrCommunicator(callback, message);
            for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
                frameTracker[i] = frame;
            }

        } else {
            this.videos[id].goToFrame(frameTracker[id] - 1);
        }
        // getEpipolarLinesOrUnifiedCoord(id, frame);
    }

    goToInputFrame(index) {
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

                let callBack = (i) => {
                    this.videos[i].goToFrame(parsedInput);
                };
                let message = messageCreator("goToFrame", {"frame": parsedInput});
                this.communicatorsManager.updateAllLocalOrCommunicator(callBack, message);
            } else {
                this.videos[index].goToFrame(parsedInput);
            }
            getEpipolarLinesOrUnifiedCoord(index, parsedInput);
            $("#canvas-0").focus();
        };

        let label = "What frame would you like to go to?";
        let errorText = "You have to input a valid integer!";
        getGenericStringLikeInput(validate, callback, label, errorText);
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

    loadVideoIntoDOM(parsedInputs) {
        super.loadVideoIntoDOM(parsedInputs);
        let currentIndex = parsedInputs.index;
        let popOutButton = popOutButtonWidget(
            currentIndex,
            this.videoFilesMemLocations[currentIndex],
            (videoIndex, videoURL) => this.popOutVideo(videoIndex, videoURL)
        );
        $(`#pop-out-${currentIndex}-placeholder`).append(popOutButton);
    }

    loadNewProject() {
        $("#starter-menu").remove();
        $("#footer").remove();
        this.getVideoSettings(0);
    }


    popOutVideo(videoIndex, videoURL) {
        // Pops a video into a new window for easier viewing.
        // videoIndex: integer, index of the current video
        // videoURL: a data url that is used as the src= attribute of the video tag in the popout.

        let message = {
            "dataURL": videoURL,
            "index": videoIndex,
            'noOfCameras': NUMBER_OF_CAMERAS,
            "videoTitle": "TODO", // TODO
            "clickedPoints": this.clickedPointsManager.clickedPoints,
            "offset": this.videos[videoIndex].offset,
            "currentTracks": this.trackManager,
            "initFrame": frameTracker[videoIndex],
            "currentColorSpace": COLORSPACE,
            "frameRate": FRAME_RATE
        };

        console.log(message);

        // Open a communication channel that awaits a message from the pop out
        this.communicatorsManager.initializePopoutWindow(videoIndex, message);

        // Hide Videos
        let currentSection = $(`#canvas-columns-${videoIndex}`);
        currentSection.hide();
        $(this.videos[videoIndex].zoomCanvas).hide();

        // Create the popout window
        let URL = generatePopOutURL();
        let poppedOut = window.open(URL, `${videoIndex}`,
            `location=yes,height=${600},width=${800},scrollbars=yes,status=yes,detab=yes,toolbar=0`);

        // Check for popout failure
        if (!poppedOut || poppedOut.closed || typeof poppedOut.closed == 'undefined') {
            this.communicatorsManager.closeCurrentInitialization();
            currentSection.show();
            generateError("Could not pop out video! Ensure that you have pop-ups enabled for this website!");
        }
    }

    saveSettings(parsedInputs) {
        let index = parsedInputs.index;
        // this.videos[index] = new Video(index, parsedInputs.offset);

        // TODO: seperate this out probably so it's easier to update
        // videos[index].filter = parsedInputs.filter;

        index += 1;
        if (index === NUMBER_OF_CAMERAS) {
            loadSettings();
            this.emptyInputModal();
            $("#generic-input-modal").removeClass("is-active");
            $("#blurrable").css("filter", "");
            this.loadVideoIntoDOM(parsedInputs);
        } else {
            this.loadVideoIntoDOM(parsedInputs);
            this.slideInputModalOut(700, () => this.getVideoSettings(index));
        }
    }

    emptyInputModal() {
        $("#modal-content-container").empty();
    }

    slideInputModalIn(animationTime) {
        // This slides the modal in from the right, typically used in conjuction with
        // slideInputModalOut
        let modalContentContainer = $("#modal-content-container");
        modalContentContainer.hide();
        modalContentContainer.show("slide", {direction: "right"}, animationTime);
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

    fadeInputModalIn(animationTime, postAnimationCallback) {
        let modalContentContainer = $("#modal-content-container");
        modalContentContainer.hide();
        modalContentContainer.fadeIn(animationTime, postAnimationCallback);
    }

    getVideoSettings(index) {
        $("#blurrable").css("filter", "blur(10px)");

        // Setup in-place functions that will be later used to update the preview \\
        let drawPreviewPoint = (ctx, x, y) => {
            ctx.beginPath();
            ctx.arc(x, y, POINT_RADIUS, 0, Math.PI);
            ctx.arc(x, y, POINT_RADIUS, Math.PI, 2 * Math.PI);
            ctx.stroke();
        };


        let loadPreviewFrame = function () {
            let canvas = document.getElementById("current-init-settings-preview-canvas").getContext("2d");

            // Setup filters
            canvas.filter = COLORSPACE;
            canvas.filter += " " + previewBrightness;
            canvas.filter += " " + previewContrast;
            canvas.filter += " " + previewSaturation;

            canvas.drawImage(document.getElementById(`video-${index}`), 0, 0, 400, 300);

            // draw nearby points
            drawPreviewPoint(canvas, 200, 150);
            drawPreviewPoint(canvas, 230, 150);
        };

        let verifiedLoadPreviewFrame = function () {
            // Firefox seems to not play nice with 'can play' and so a callback happens whenever
            // there are transparent features in the canvas. Typically, transparent features on a canvas will mean
            // that a video failed to draw.
            loadPreviewFrame();
            let currentImage = $("#current-init-settings-preview-canvas").get(0).getContext("2d").getImageData(0, 0, 400, 300);
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
        let name = this.videoFiles[index].name;
        if (name.length > 20) {
            name = name.slice(0, 20);
            name += ". . .";
        }

        let context = {"nextButton": "Next", "previousButton": true, "index": index};

        if (index + 1 === NUMBER_OF_CAMERAS) {
            context.nextButton = "Finish";
        }

        if (index === 0) {
            context.previousButton = false;
        }


        // Smooths animations
        $("#generic-input-modal-content").css("margin", "0");
        $("#modal-content-container").append(initialVideoPropertiesWidget(name, loadPreviewFrame,
            (parsedInputs) => this.saveSettings(parsedInputs), context));

        $("#generic-input-modal").addClass('is-active');

        if (index === 0) {
            this.fadeInputModalIn(700)
        } else {
            this.slideInputModalIn();
        }

        // Gets the video into the page so that the canvas actually has something to draw from
        let memoryLocation = URL.createObjectURL(this.videoFiles[index]);
        this.videoFilesMemLocations[index] = memoryLocation;
        loadHiddenVideo(memoryLocation, index, verifiedLoadPreviewFrame);
    }

    addNewPoint(event) {
        super.addNewPoint(event);
    }

    deletePoint(event) {
    }
}

class PopOutWindowManager extends WindowManager {
    constructor(numberOfVideos, currentVideo, clickedPoints, tracks) {
        super();
        this.clickedPointsManager = new ClickedPointsManager(numberOfVideos, null, clickedPoints);
        this.trackManager = new TrackManager(tracks);

        let callbacks = {
            "goToFrame": (frame) => {
                this.videos[currentVideo].goToFrame(frame);
            },
            "changeTrack": (newTrackAbsoluteIndex) => {
                this.trackManager.changeCurrentTrack(newTrackAbsoluteIndex);
                this.videos[currentVideo].changeTrack(newTrackAbsoluteIndex);
            },
            "addNewTrack": (newTrackName) => {
                // TODO: NEEDS WORK
                this.trackManager.addTrack(newTrackName);
                let newTrackIndex = this.trackManager.nextUnusedIndex - 1;
                this.trackManager.changeCurrentTrack(newTrackIndex);
                this.clickedPointsManager.addTrack(newTrackIndex);
                this.videos[currentVideo].changeTracks(newTrackIndex);
            },
            "drawEpipolarLine": () => {
                // TODO
            },
            "drawDiamond": () => {
                // TODO
            },
            "updateSecondaryTracks": () => {
                // TODO
            },
            "loadPoints": () => {
                // TODO
            },
            "changeColorSpace": () => {
                // TODO
            },
            "mainWindowDeath": () => {
                killSelf = true;
                window.close();
            },
        };
        this.communicatorsManager = new CommunicatorsManager(STATES.POP_OUT, callbacks);
        this.communicatorsManager.registerCommunicator(currentVideo);
    }

    goForwardAFrame(id) {
        this.videos[id].moveToNextFrame();

        // TODO: not sure if frameTracker exists in the pop out or if it does
        // if there is a reason for it to.
        let frame = frameTracker[id];

        if (settings["sync"] === true) {
            let message = messageCreator("goToFrame", {frame: frame, index: id});
            this.communicatorsManager.updateCommunicators(message);
        }
    }

    goBackwardsAFrame(id) {
        if (frameTracker[id] < 2) {
            return;
        }

        let frame = frameTracker[id] - 1;
        if (settings["sync"] === true) {
            let callback = (i) => {
                this.videos[i].goToFrame(frame);
            };
            let message = messageCreator("goToFrame", {frame: frame});

            this.communicatorsManager.updateAllLocalOrCommunicator(callback, message);
            for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
                frameTracker[i] = frame;
            }

        } else {
            this.videos[id].goToFrame(frameTracker[id] - 1);
        }
        // getEpipolarLinesOrUnifiedCoord(id, frame);
    }

    goToInputFrame(index) {
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

                let callBack = (i) => {
                    this.videos[i].goToFrame(parsedInput);
                };
                let message = messageCreator("goToFrame", {"frame": parsedInput});
                this.communicatorsManager.updateAllLocalOrCommunicator(callBack, message);
            } else {
                this.videos[index].goToFrame(parsedInput);
            }
            getEpipolarLinesOrUnifiedCoord(index, parsedInput);
            $("#canvas-0").focus();
        };

        let label = "What frame would you like to go to?";
        let errorText = "You have to input a valid integer!";
        getGenericStringLikeInput(validate, callback, label, errorText);
    }

    // addNewPoint(event) {
    //     if (this.locks['can_click']) {
    //         let index = event.target.id.split('-')[1];
    //         let point = Video.createPointObject(index);
    //
    //     }
    // }

    deletePoint() {
    }
}