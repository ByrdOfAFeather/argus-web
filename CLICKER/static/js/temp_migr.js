let videos = [];
let trackTracker = {
    tracks: [{name: "Track 1", color: COLORS[0], index: 0}],
    currentTrack: 0
};


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
        videos[index].changeTracks(trackIndex);
    }
}


class Video {
    constructor(videosIndex, offset) {
        this.index = videosIndex;
        this.offset = offset;
        this.currentFrame = 0;
        this.video = document.getElementById(`video-${videosIndex}`);

        this.canvas = document.getElementById(`canvas-${videosIndex}`);
        this.canvasContext = this.canvas.getContext("2d");

        this.videoCanvas = document.getElementById(`videoCanvas-${videosIndex}`);
        this.videoCanvasContext = this.videoCanvas.getContext("2d");

        // this.zoomCanvas = document.getElementById(`zoomCanvas-${videosIndex}`);
        // this.zoomCanvasContext = this.zoomCanvas.getContext("2d");

        this.epipolarCanvas = document.getElementById(`epipolarCanvas-${videosIndex}`);
        this.epipolarCanvasContext = this.epipolarCanvas.getContext("2d");
        this.epipolarCanvasContext.strokeStyle = "#99badd";

        this.videoLabelID = `videoLabel-${videosIndex}`;

        this.popVideoID = `popVideo-${videosIndex}`;
    }

    static createPointObject(index) {
        let video = document.getElementById(`video-${index}`).currentTime;
        return {
            x: mouseTracker.x,
            y: mouseTracker.y,
            frame: video.currentTime * DEV_FRAME_RATE,
        };
    }

    redrawPoints(points) {
        this.drawPoints(points);
        this.drawLines(points);
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

        let indexOfAlreadyExistingPoints = null;
        let localPoints = getClickedPoints(this.index, currentTrackIndex);


        // If there is already a point
        if (Video.checkIfPointAlreadyExists(localPoints) !== null) {
            this.clearPoints();
            localPoints[indexOfAlreadyExistingPoints] = point;
            this.redrawPoints();

        } else {
            localPoints.push(point);
            localPoints.sort(sortByFrame);
            let newIndex = localPoints.indexOf(point);

            let videoHeight = this.video.videoHeight;
            let videoWidth = this.video.videoWidth;
            let currentHeight = this.canvas.style.height;
            let currentWidth = this.canvas.style.width;

            let videoArea = parseInt(currentHeight, 10) * parseInt(currentWidth, 10);
            this.drawPoint(point.x, point.y, (videoHeight * videoWidth * 5) / videoArea);


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
        frameNumber -= this.offset;
        if (frameNumber <= 0) {
            this.videoCanvasContext.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        Video.clearCanvases();

        let estimatedTime = frameNumber / DEV_FRAME_RATE;
        this.video.currentTime = estimatedTime;

        let parsedLabel = Video.parseVideoLabel(document.getElementById(this.videoLabelID).innerText);
        parsedLabel["FRAME"] = (estimatedTime * DEV_FRAME_RATE) + this.offset;
        document.getElementById(this.videoLabelID).innerText = Video.videoLabelDataToString(parsedLabel);
        frameTracker[this.index] = frameNumber;
    }

    moveToNextFrame() {
        let newFrame = (this.video.currentTime * DEV_FRAME_RATE) + 1;
        this.goToFrame(newFrame);
    }


    loadFrame() {
        let videoWidth;
        let videoHeight;

        videoHeight = this.video.videoHeight;
        videoWidth = this.video.videoWidth;

        this.canvasContext.filter = currentFilter;
        this.canvasContext.fillRect(0, 0, videoWidth, videoHeight);
        this.canvasContext.drawImage(this.video, 0, 0, videoWidth, videoHeight);
    }


    drawLine(point1, point2, lineType = LINETYPE_POINT_TO_POINT) {
        let ctx = lineType === LINETYPE_EPIPOLAR ? this.epipolarCanvasContext : this.canvasContext;

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
        this.canvasContext.beginPath();
        this.canvasContext.arc(x, y, r, 0, 2 * Math.PI);
        this.canvasContext.stroke();
    }

    drawDiamond(x, y, width, height) {
        //SOURCE: http://www.java2s.com/Tutorials/Javascript/Canvas_How_to/Shape/Draw_Spade_Heart_Club_Diamond.htm
        this.epipolarCanvasContext.beginPath();
        let temp = y - height;
        this.epipolarCanvasContext.context.moveTo(x, temp);

        // top left edge
        this.epipolarCanvasContext.context.lineTo(x - width / 2, y);

        // bottom left edge
        this.epipolarCanvasContext.context.lineTo(x, y + height);

        // bottom right edge
        this.epipolarCanvasContext.context.lineTo(x + width / 2, y);

        // closing the path automatically creates
        // the top right edge
        this.epipolarCanvasContext.context.closePath();

        this.epipolarCanvasContext.context.lineWidth = 3;
        this.epipolarCanvasContext.context.strokeStyle = "rgb(0,255,0)";
        this.epipolarCanvasContext.context.stroke();
        this.epipolarCanvasContext.context.restore();
    }

    drawEpipolarLine(points) {
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
        if (localClickedPoints.length === 0) {
            return;
        }
        this.canvasContext.strokeStyle = trackTracker["tracks"][trackTracker["currentTrack"]].color;


        // Redraws points
        this.drawPoints(localClickedPoints);
        this.drawLines(localClickedPoints);
    }

    clearPoints() {
        this.canvasContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }


    static clearCanvases() {
        for (let cameraIndex = 0; cameraIndex < numberOfCameras; cameraIndex++) {
            let curVideo = videos[cameraIndex];
            videos[cameraIndex].epipolarCanvasContext.clearRect(
                0,
                0,
                curVideo.epipolarCanvas.width,
                curVideo.epipolarCanvas.height);
        }
    }
}


/// TODO: MOVE TO RESPECTIVE AREAS


function updateAllLocalOrCommunicator(localCallback, message) {
    for (let i = 0; i < numberOfCameras; i++) {
        updateLocalOrCommunicator(i, localCallback, message);
    }
}


function mainWindowAddNewPoint(event) {
    let index = event.id.split("-")[1];
    let point = Video.createPointObject(event.id.split("-")[1]);
    videos[index].addNewPoint(point);

    if (settings["auto-advance"]) {
        videos[index].moveToNextFrame();

        if (settings["sync"]) {

            let localCallback = (index) => {
                videos[index].goToFrame(point.frame + 1);
            };

            let message = messageCreator("goToFrame", {frame: point.frame + 1});

            updateAllLocalOrCommunicator(localCallback, message);
        }
    }
}


function loadVideosIntoDOM(curURL, index, name, canvasOnClick, isMainWindow, popUpArgs,
                           videoFinishedLoadingCallback = null) {
    // popUpArgs - {"offset": offset for the video being loaded}
    let curCanvases = $(`
            <div class="section">

              <div class="container">
              <div id="canvas-columns-${index}" class="columns has-text-centered is-multiline">
                    <div class="column is-12 video-label-container">
                    <p class="video-label" id="videoLabel-${index}"></p>
                    </div>
                    <div class="column">
                      <div id="container-for-canvas-${index}" class="container-for-canvas">
                        <canvas class="clickable-canvas" id="canvas-${index}" style="z-index: 3;"></canvas>
                        <canvas class="epipolar-canvas" id="epipolarCanvas-${index}" style="z-index: 2;"></canvas>
                        <canvas class="video-canvas" id="videoCanvas-${index}" style="z-index: 1;" "></canvas>
                        <canvas class="zoom-canvas" id="zoomCanvas-${index}" style="z-index: 2;"></canvas>
                      </div>
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
    $(document.body).find(`#canvas-columns-${index}`).append($(`
                        <div class="column">
                           <button id="popVideo-${index}" class="button">Pop into new Window</button>
                        </div>`));


    curCanvases.tabIndex = 1000;
    curCanvases.addEventListener("keydown",
        handleKeyboardInput,
        false);
    curCanvases = $(curCanvases);
    curCanvases.on("click", canvasOnClick);
    curCanvases.on("mousemove", setMousePos);
    curCanvases.on("scroll", setMousePos);

    curVideo.on("error", function () {
        generateError(`${name} could not be loaded, see troubleshooting for more details!`);
        location.reload(false);
        // reloadInitState
    });

    curVideo.on('canplay', function () {
        videos.push(new Video(index, 0));

        if (!locks[`initFrameLoaded ${index}`]) {
            // Get Offsets
            if (isMainWindow) {
                if (index !== 0) {
                    let label = `Offset for video ${name}`;

                    let invalid = function (event) {
                        generateError("You must provide an offset! (It can be 0!)");
                    };

                    let validate = function (event) {
                        let offset = $("#generic-modal-input").val();
                        let curOffset = parseInt(offset, 10);
                        if (isNaN(curOffset)) {
                            generateError("Offset must be a valid integer!");
                        } else {
                            videos[index].offset = curOffset;
                            let originalText = document.getElementById(videos[index].videoLabelID);
                            let label = Video.parseVideoLabel(originalText.innerText);
                            label.OFFSET = curOffset;
                            originalText.innerText = Video.videoLabelDataToString(label);

                            videos[index].goToFrame(frameTracker[index]);
                            $("#generic-input-modal").removeClass("is-active");
                        }
                    };

                    getGenericInput(label, validate, invalid);
                }
            }


            $(`#${videos[index].popVideoID}`).on("click", function (event) {
                popOutvideo(event, curURL)
            });

            let video = videos[index].video;

            let clickCanvas = videos[index].canvas;
            let videoCanvas = videos[index].videoCanvas;
            let epipolarCanvas = videos[index].epiPolarcanvas;


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
            // let zoomCanvas = document.getElementById(videoObject["zoomCanvasID"]);
            // zoomCanvas.height = 400;
            // zoomCanvas.width = 400;
            // zoomCanvas.style.height = "400px";
            // zoomCanvas.style.width = "400px";
            // zoomCanvas.style.top = (parseInt(clickCanvas.style.top, 10) + clickCanvas.height - zoomCanvas.height) + "px";
            // zoomCanvas.style.left = (clickCanvas.width - zoomCanvas.width) + "px";

            let videoLabel = document.getElementById(videos[index].videoLabelID);
            let offset = 0;
            if (!isMainWindow) {
                offset = popUpArgs["offset"];
            }

            let data = {
                "title": name,
                "frame": 0,
                "offset": index === 0 ? "n/a" : offset,
            };

            videoLabel.innerText = videoLabelDataToString(data);

            videos[index].goToFrame(1.001);
            videos[index].loadFrame();

            locks[`initFrameLoaded ${index}`] = true;
            if (videoFinishedLoadingCallback !== null) {
                videoFinishedLoadingCallback();
            }
        }
        if (!locks["can_click"]) {
            locks["can_click"] = true;
        }
        videos[index].loadFrame();
    });
}
