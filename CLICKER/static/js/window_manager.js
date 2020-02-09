class WindowManager {
    constructor() {
        this.trackManager = new TrackManager();
        this.videos = [];
        this.popoutCommunicators = [];
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
        $("#starter-menu").remove();
        $("#footer").remove();
        loadSettings();
    }


    saveSettings(settingsContext) {
        let index = settingsContext.index;
        videos[index].offset = settingsContext.offset;
        if (settingsContext.frameRate !== undefined) {
            FRAME_RATE = settingsContext.frameRate;
        }
        // TODO: seperate this out probably so it's easier to update
        videos[index].filter = settingsContext.filter;
    }

    getVideoSettings(videos, index) {
        $("#blurrable").css("filter", "blur(10px)");

        // Setup in-place functions that will be later used to update the preview
        let drawPreviewPoint = (ctx, x, y) => {
            ctx.drawImage(document.getElementById(`video-${index}`), 0, 0, 400, 300);
            ctx.beginPath();
            ctx.arc(x, y, POINT_RADIUS, 0, Math.PI);
            ctx.arc(200, 150, POINT_RADIUS, Math.PI, 2 * Math.PI);
            ctx.stroke();
        };


        let loadPreviewFrame = function () {
            let canvas = document.getElementById("current-init-settings-preview-canvas").getContext("2d");

            // Setup filters
            canvas.filter = COLORSPACE;
            canvas.filter += " " + previewBrightness;
            canvas.filter += " " + previewContrast;
            canvas.filter += " " + previewSaturation;

            // draw nearby points
            drawPreviewPoint(canvas, 200, 150);
            drawPreviewPoint(canvas, 230, 150);
        };

        // Gets the video into the page so that the canvas actually has something to draw from
        let memoryLocation = URL.createObjectURL(videos[index]);
        loadHiddenVideo(memoryLocation, index, loadPreviewFrame);

        let name = videos[index].name;
        if (name.length > 20) {
            name = name.slice(0, 20);
            name += ". . .";
        }

        let context = {"nextButton": true, "previousButton": true, "index": 0};
        if (index === videos.length - 1) {
            context.nextButton = false;
        }

        if (index === 0) {
            context.previousButton = false;
        }


        $("#modal-content-container").append(initialVideoPropertiesWidget(name, loadPreviewFrame, this.saveSettings, context));
        $("#generic-input-modal").addClass('is-active');
    }

    getVideosSettings(videos) {
        this.getVideoSettings(videos, 0)
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