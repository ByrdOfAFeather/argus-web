class WindowManager {
    constructor() {
        this.trackManager = new TrackManager();
        this.videos = [];
        this.popoutCommunicators = [];
        this.locks = {
            "can_click": true,
            "init_frame_loaded": false,
            "resizing_mov": false,
            "can_pop_out": true,
        };
    }

    messageCreator(type, data) {
        return {"type": type, "data": data};
    }

    updateLocalOrCommunicator(index, localCallback, message) {
        let currentCommunicator = this.popoutCommunicators.find((elem) => elem.index === index);
        if (currentCommunicator === undefined) {
            localCallback(index);
        } else {
            currentCommunicator.communicator.postMessage(message);
        }
    }


    changeTrack(newTrack) {
        this.trackManager.changeCurrentTrack(newTrack);
        let videoChangeTrack = (videoObj) => {
            videoObj.changeTrack(this.trackManager);
        };

        let message = this.messageCreator("changeTrack", {track: newTrack});
        this.updateAllLocalOrCommunicator(videoChangeTrack, message);
    }
}

class MainWindowManager extends WindowManager {
    constructor(projectTitle, projectDescription, projectID, files) {
        super();
        this.clickedPoints = new ClickedPointsManager(files.length);
        this.NUMBER_OF_CAMERAS = files.length;
        this.videoFiles = files;
        this.videoFilesMemLocations = {};
    }

    loadNewProject() {
        $("#starter-menu").remove();
        $("#footer").remove();
        this.getVideoSettings(0);
    }

    handlePopoutChange() {

    }

    popOutVideo(videoIndex, videoURL) {
        let init_communicator = new BroadcastChannel("unknown-video");
        init_communicator.onmessage(() => {
            init_communicator.postMessage({
                "dataURL": videoURL,
                "index": videoIndex,
                "videoTitle": "TODO", // TODO
                "clickedPoints": this.clickedPoints,
                "offset": this.videos[index].offset,
                "currentTracks": this.trackManager,
                "initFrame": null, // TODO
                "currentColorSpace": COLORSPACE,
                "frameRate": FRAME_RATE
            });
            init_communicator.close();
        });
        let master_communicator = new BroadcastChannel(`${videoIndex}`);
        master_communicator.onmessage = this.handlePopoutChange;
        this.popoutCommunicators.push({"communicator": master_communicator, "index": videoIndex});
    }

    canvasOnRightClick() {
    }

    loadVideoIntoDOM(parsedInputs) {
        let currentIndex = parsedInputs.index;
        let loadPreviewFrameFunction = (videoIndex) => {
            this.videos[videoIndex].loadFrame();
        };
        let currentClickerWidget = clickerWidget(
            parsedInputs.index,
            loadPreviewFrameFunction,
            (event) => this.addNewPoint(event),
        );
        $("#canvases").append(currentClickerWidget);
        let popOutButton = popOutButtonWidget(
            currentIndex,
            this.videoFilesMemLocations[currentIndex],
            (videoIndex, videoURL) => this.popOutVideo(videoIndex, videoURL)
        );
        $(`#pop-out-${currentIndex}-placeholder`).append(popOutButton);
        this.videos[currentIndex] = new Video(currentIndex, parsedInputs.offset);
    }

    saveSettings(parsedInputs) {
        let index = parsedInputs.index;
        this.loadVideoIntoDOM(parsedInputs);
        // this.videos[index] = new Video(index, parsedInputs.offset);

        // TODO: seperate this out probably so it's easier to update
        // videos[index].filter = parsedInputs.filter;

        if (index === this.NUMBER_OF_CAMERAS) {
            loadSettings();
            // TODO Start main process;
        } else {
            index += 1;
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


        // Builds a context for the input builder so that we don't have redundant inputs or inputs that
        // don't belong for a given video.
        let name = this.videoFiles[index].name;
        if (name.length > 20) {
            name = name.slice(0, 20);
            name += ". . .";
        }

        let context = {"nextButton": true, "previousButton": true, "index": index};

        if (index === this.NUMBER_OF_CAMERAS) {
            context.nextButton = false;
        }

        if (index === 0) {
            context.previousButton = false;
        }

        $("#modal-content-container").append(initialVideoPropertiesWidget(name, loadPreviewFrame,
            (parsedInputs) => this.saveSettings(parsedInputs), context));

        $("#generic-input-modal").addClass('is-active');

        if (index === 0) {
            this.fadeInputModalIn(700);
        } else {
            this.slideInputModalIn();
        }

        // Gets the video into the page so that the canvas actually has something to draw from
        let memoryLocation = URL.createObjectURL(this.videoFiles[index]);
        this.videoFilesMemLocations[index] = memoryLocation;
        loadHiddenVideo(memoryLocation, index, loadPreviewFrame);
    }


    updateAllLocalOrCommunicator(localCallback, message, ignoreParam = null) {
        for (let i = 0; i < this.videos.length; i++) {
            if (ignoreParam !== null) {
                if (ignoreParam === i) {
                    continue;
                }
            }
            this.updateLocalOrCommunicator(i, localCallback, message);
        }
    }

    addNewPoint(event) {
        if (this.locks["can_click"]) {
            let index = event.target.id.split("-")[1];
            let point = Video.createPointObject(index);

            let override = this.clickedPoints.addPoint(point,
                {clickedVideo: index, track: this.trackManager.currentTrack}
            );
            let localPoints = this.clickedPoints.getClickedPoints(index, this.trackManager.currentTrack);

            if (override) {
                this.videos[index].redrawPoints(localPoints);
            } else {
                this.videos[index].drawNewPoint(point);
            }

            locks["can_click"] = !settings["auto-advance"];
            if (this.settings["auto-advance"]) {
                if (this.settings["sync"]) {
                    for (let i = 0; i < this.videos.length; i++) {
                        frameTracker[i] = point.frame;
                    }

                    let localCallback = (index) => {
                        videos[index].moveToNextFrame();
                    };

                    let message = this.messageCreator("goToFrame", {frame: point.frame + 1});

                    this.updateAllLocalOrCommunicator(localCallback, message);
                } else {
                    videos[index].moveToNextFrame();
                }
            } else {
                Video.clearEpipolarCanvases();
                getEpipolarLinesOrUnifiedCoord(index, frameTracker[index]);
            }
        }
    }
}

class PopOutWindowManager extends WindowManager {
    updateAllLocalOrCommunicator(localCallback, message, ignoreParam = null) {
        localCallback(this.videos[0]);
    }
}