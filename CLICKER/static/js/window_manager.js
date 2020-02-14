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
        this.settings = {
            "auto-advance": true,
            "sync": true
        };
    }

    messageCreator(type, data) {
        return {"type": type, "data": data};
    }
}

class MainWindowManager extends WindowManager {
    constructor(projectTitle, projectDescription, projectID, files) {
        super();
        this.clickedPoints = new ClickedPointsManager(files.length);
        NUMBER_OF_CAMERAS = files.length;
        this.videoFiles = files;
        this.videoFilesMemLocations = {};
        this.communicatorsManager = new CommunicatorsManager();
    }

    changeTrack(newTrack) {
        this.trackManager.changeCurrentTrack(newTrack);
        let videoChangeTrack = (videoObj) => {
            videoObj.changeTrack(this.trackManager);
        };

        let message = this.messageCreator("changeTrack", {track: newTrack});
        this.communicatorsManager.updateAllLocalOrCommunicator(videoChangeTrack, message);
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
            "videoTitle": "TODO", // TODO
            "clickedPoints": this.clickedPoints,
            "offset": this.videos[videoIndex].offset,
            "currentTracks": this.trackManager,
            "initFrame": null, // TODO
            "currentColorSpace": COLORSPACE,
            "frameRate": FRAME_RATE
        };

        // Open a communication channel that awaits a message from the pop out
        this.communicatorsManager.registerCommunicator(videoIndex, videoURL, message);

        // Hide Videos
        let currentSection = $(`#canvas-columns-${videoIndex}`);
        currentSection.hide();
        $(this.videos[videoIndex].zoomCanvas).hide();

        // Create the popout window
        let URL = generatePopOutURL();
        let poppedOut = window.open(URL, "detab",
            `location=yes,height=${600},width=${800},scrollbars=yes,status=yes,detab=yes,toolbar=0`);

        // Check for popout failure
        if (!poppedOut || poppedOut.closed || typeof poppedOut.closed == 'undefined') {
            this.communicatorsManager.closeCurrentInitialization();
            currentSection.show();
            generateError("Could not pop out video! Ensure that you have pop-ups enabled for this website!");
        }
    }

    loadVideoIntoDOM(parsedInputs) {
        let currentIndex = parsedInputs.index;
        frameTracker[currentIndex] = 2.001;
        let loadPreviewFrameFunction = (videoIndex) => {
            this.videos[videoIndex].loadFrame();
        };
        let currentClickerWidget = clickerWidget(
            parsedInputs.index,
            this.videos[currentIndex],
            loadPreviewFrameFunction,
            (event) => this.addNewPoint(event),
            (event) => this.deletePoint(event)
        );
        $("#canvases").append(currentClickerWidget);
        let popOutButton = popOutButtonWidget(
            currentIndex,
            this.videoFilesMemLocations[currentIndex],
            (videoIndex, videoURL) => this.popOutVideo(videoIndex, videoURL)
        );
        $(`#pop-out-${currentIndex}-placeholder`).append(popOutButton);
        this.videos[currentIndex] = new Video(currentIndex, parsedInputs.offset.value);

        $("#video-0").on("canplay", () => {
            this.videos[currentIndex].loadFrame();
        });
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
        if (this.locks["can_click"]) {
            let index = event.target.id.split("-")[1];
            let point = Video.createPointObject(index);

            let override = this.clickedPoints.addPoint(point,
                {clickedVideo: index, currentTrack: this.trackManager.currentTrack.absoluteIndex}
            );
            let localPoints = this.clickedPoints.getClickedPoints(index, this.trackManager.currentTrack.absoluteIndex);

            if (override) {
                this.videos[index].redrawPoints(localPoints);
            } else {
                this.videos[index].drawNewPoint(point, localPoints);
            }

            locks["can_click"] = !settings["auto-advance"];
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


    deletePoint(event) {
    }
}

class PopOutWindowManager extends WindowManager {

}