let videoObjects = [];

let LINETYPE_EPIPOLAR = 1;
let LINETYPE_POINT_TO_POINT = 2;
let videos = [];

let RGB = 0;
let GREYSCALE = 1;

class Video {
    constructor(videosIndex, offset) {
        this.index = videosIndex;
        this.offset = offset;
        this.currentFrame = 0;
        this.video = document.getElementById(`video-${videosIndex}`);

        this.canvas = document.getElementById(`canvas-${videosIndex}`);
        this.canvasContext = this.canvas.getContext("2d");
        this.currentStrokeStyle = "#FF0000";

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
        frameNumber -= this.offset;
        if (frameNumber <= 0) {
            this.videoCanvasContext.clearRect(0, 0, this.videoCanvas.width, this.videoCanvas.height);
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
        videos[index].changeTracks(trackIndex);
    }
}


function setMousePos(e) {
    // TODO: Error When Scrolling and not moving
    if (e.target.id.startsWith("canvas")) {
        currentResizable = e.target;
    } else {
        e.target = currentResizable;
    }

    if (!locks["resizing_mov"]) {
        // Source : https://stackoverflow.com/a/17130415
        let bounds = e.target.getBoundingClientRect();
        let scaleX = e.target.width / bounds.width;   // relationship bitmap vs. element for X
        let scaleY = e.target.height / bounds.height;

        mouseTracker.x = (e.clientX - bounds.left) * scaleX;   // scale mouse coordinates after they have
        mouseTracker.y = (e.clientY - bounds.top) * scaleY;
        // drawZoomWindow(videoObject);
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


function generateError(errorMessage) {
    alert(errorMessage);
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


function getGenericInput(inputLabel, callbackOkay, callbackCancel) {
    let cancelButton = $("#generic-input-modal-cancel");
    let okButton = $("#generic-input-modal-ok");
    let modal = $("#generic-input-modal");


    cancelButton.off();
    okButton.off();
    modal.off();

    modal.on("keydown", function (e) {
        let code = (e.keyCode ? e.keyCode : e.which);
        if (code === 13) {
            callbackOkay(e);
        }
    });

    $("#generic-input-label").text(inputLabel);
    $("#modal-content-container").hide();
    modal.addClass("is-active");

    let input = $("#generic-modal-input");
    input.val(" ");

    $("#modal-content-container").fadeIn(300, function () {
        input.focus();
    });

    cancelButton.on("click", callbackCancel);
    okButton.on("click", callbackOkay);

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
    curCanvases.tabIndex = 1000;
    curCanvases.addEventListener("keydown",
        handleKeyboardInput,
        false);
    curCanvases = $(curCanvases);
    curCanvases.on("click", canvasOnClick);
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
                           <button id="goToFrame-${index}" class="button">Pop into new Window</button>
                        </div>`));

    curVideo.on("error", function () {
        generateError(`${name} could not be loaded, see troubleshooting for more details!`);
        location.reload(false);
        // reloadInitState
    });

    curVideo.on('canplay', function () {
        if (!locks[`initFrameLoaded ${index}`]) {
            videos[index] = new Video(index, 0);
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

            locks[`initFrameLoaded ${index}`] = true;
            if (videoFinishedLoadingCallback !== null) {
                videoFinishedLoadingCallback();
            }
        }

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

function getEpipolarLines(videoObject, DLTCoefficients, pointsIndex) {
    let coords = [];
    let tmp = [];
    let dlcCoeff1 = DLTCoefficients[videoObject["index"]];
    let currentTrack = trackTracker["currentTrack"];

    let localPoints = clickedPoints[videoObject["index"]][currentTrack];
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
        if (coord[0] !== parseInt(videoObject["index"], 10)) {
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

                let originalHeight = document.getElementById(videoObject["videoCanvasID"]).height;
                let originalWidth = document.getElementById(videoObject["videoCanvasID"]).width;

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
    //TODO: Remove points that are NaN (are there ever any?)
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
