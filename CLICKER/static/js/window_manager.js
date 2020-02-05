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

    getVideoSettings(videos, index) {
        $("#blurrable").css("filter", "blur(10px)");
        let memoryLocation = URL.createObjectURL(videos[index]);
        let loadPreviewFrame = function () {
            let canvas = document.getElementById("current-init-settings-preview-canvas").getContext("2d");
            canvas.filter = COLORSPACE;
            canvas.drawImage(document.getElementById(`video-${index}`), 0, 0, 800, 600);
        };

        loadHiddenVideo(memoryLocation, index, loadPreviewFrame);
        $("#generic-input-modal-content").append(initialVideoPropertiesWidget(videos[index].name, loadPreviewFrame));
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