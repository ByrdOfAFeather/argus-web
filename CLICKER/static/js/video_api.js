let videoObjects = [];

let LINETYPE_EPIPOLAR = 1;
let LINETYPE_POINT_TO_POINT = 2;


function getClickedPoints(index, currentTrackIndex) {
    return clickedPoints[index][currentTrackIndex];
}

function drawDiamond(x, y, width, height, videoObject) {
    //SOURCE: http://www.java2s.com/Tutorials/Javascript/Canvas_How_to/Shape/Draw_Spade_Heart_Club_Diamond.htm
    let canvas = document.getElementById(videoObject["epipolarCanvasID"]);
    let context = canvas.getContext("2d");


    context.save();
    context.beginPath();
    let temp = y - height;
    context.moveTo(x, temp);

    // top left edge
    context.lineTo(x - width / 2, y);

    // bottom left edge
    context.lineTo(x, y + height);

    // bottom right edge
    context.lineTo(x + width / 2, y);

    // closing the path automatically creates
    // the top right edge
    context.closePath();

    context.lineWidth = 3;
    context.strokeStyle = "rgb(0,255,0)";
    context.stroke();
    context.restore();

}

function clearPoints(videoObject) {
    let pointCanvas = document.getElementById(videoObject.canvasID);
    let ctx = pointCanvas.getContext("2d");
    ctx.clearRect(0, 0, pointCanvas.width, pointCanvas.height);
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
        let cameraIndex = cameras[index];
        let localVideoObject = videoObjectSingletonFactory(cameraIndex);

        let pointCanvas = document.getElementById(localVideoObject["canvasID"]);
        let ctx = pointCanvas.getContext("2d");

        ctx.clearRect(0, 0, pointCanvas.width, pointCanvas.height);
        let localClickedPoints = clickedPoints[localVideoObject["index"]][trackIndex];
        if (localClickedPoints.length === 0) {
            return;
        }

        // Redraws points
        drawPoints(localClickedPoints, localVideoObject);
        drawLines(localClickedPoints, localVideoObject);
    }
}


function goToFrame(frameNumber, videoObject) {
    //TODO: NOTE THAT WHEN A USER INPUTS A FRAME NUMBER IT WILL EXTEND ITSELF WITH A .01
    let vidOffset = getOffset(frameNumber, videoObject);
    frameNumber -= vidOffset;
    if (frameNumber <= 0) {
        let canvas = document.getElementById(videoObject.videoCanvasID);
        let ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    clearCanvasesBetweenFrames(videoObject);
    let video = document.getElementById(videoObject["videoID"]);


    let estimatedTime = frameNumber / DEV_FRAME_RATE;
    video.currentTime = estimatedTime;

    let parsedLabel = parseVideoLabel(document.getElementById(videoObject["videoLabelID"]).innerText);
    parsedLabel["FRAME"] = (estimatedTime * DEV_FRAME_RATE) + vidOffset;
    document.getElementById(videoObject["videoLabelID"]).innerText = videoLabelDataToString(parsedLabel);
    frameTracker[videoObject["index"]] = frameNumber;
    // loadFrame(videoObject);
    // attemptToDrawEpipolarLinesOrUnifedCoord(frameNumber, videoObject);
}

function moveToNextFrame(videoObject) {
    let video = document.getElementById(videoObject["videoID"]);
    let newFrame = (video.currentTime * DEV_FRAME_RATE) + 1;
    goToFrame(newFrame, videoObject);
}


function drawLines(points, videoObject) {
    for (let i = 0; i < points.length - 1; i++) {
        let currentPoint = points[i];
        // Check if there is a point after this one
        if (points[i + 1] !== undefined) {
            // Check if consecutive
            if (Math.floor(currentPoint.frame) === Math.floor(points[i + 1].frame) - 1) {
                drawLine(points[i], points[i + 1], videoObject);
            }
        }
    }
}

function drawLine(point1, point2, videoObject, lineType = LINETYPE_POINT_TO_POINT) {
    let canvasToDraw;
    let ctx;
    if (lineType === LINETYPE_EPIPOLAR) {
        canvasToDraw = document.getElementById(videoObject["epipolarCanvasID"]);
        ctx = canvasToDraw.getContext('2d');
        ctx.clearRect(0, 0, canvasToDraw.width, canvasToDraw.height);
        ctx.strokeStyle = "#99badd"

    } else if (lineType === LINETYPE_POINT_TO_POINT) {
        canvasToDraw = document.getElementById(videoObject["canvasID"]);
        ctx = canvasToDraw.getContext("2d");
        ctx.strokeStyle = trackTracker["tracks"][trackTracker["currentTrack"]].color;
    }


    ctx.beginPath();
    ctx.moveTo(point1.x, point1.y);
    ctx.lineTo(point2.x, point2.y);
    ctx.stroke();
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


function drawPoints(points, videoObject) {
    for (let i = 0; i < points.length; i++) {
        drawPoint(points[i].x, points[i].y, 2, videoObject);
    }
}

function drawPoint(x, y, r, videoObject) {
    let canvas = document.getElementById(videoObject["canvasID"]);
    let ctx = canvas.getContext("2d");
    ctx.strokeStyle = trackTracker["tracks"][trackTracker["currentTrack"]].color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.stroke();
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

function clearCanvasesBetweenFrames(videoObject) {
    for (let cameraIndex = 0; cameraIndex < numberOfCameras; cameraIndex++) {
        let epipolar = document.getElementById(videoObject["epipolarCanvasID"]);
        epipolar.getContext("2d").clearRect(0, 0, epipolar.width, epipolar.height);
    }
}

function loadFrame(videoObject) {
    let video = document.getElementById(videoObject["videoID"]);
    let videoWidth;
    let videoHeight;

    videoHeight = video.videoHeight;
    videoWidth = video.videoWidth;

    let canvas = document.getElementById(videoObject["videoCanvasID"]);
    let ctx = canvas.getContext("2d");

    ctx.filter = currentFilter;
    ctx.fillRect(0, 0, videoWidth, videoHeight);
    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
    // drawZoomWindow(videoObject);
}

function drawEpipolarLine(points, videoObject) {
    for (let i = 0; i < points.length - 1; i++) {
        drawLine(
            {
                "x": points[i][0],
                "y": points[i][1]
            },
            {
                "x": points[i + 1][0],
                "y": points[i + 1][1]
            },
            videoObject, LINETYPE_EPIPOLAR);
    }
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

function addNewPoint(event) {
    if (!locks["can_click"]) {
        return;
    }
    let domIndex = event.target.id.split("-")[1];
    let videoObject = videoObjectSingletonFactory(domIndex);
    locks["can_click"] = !settings["auto-advance"];

    let video = document.getElementById(videoObject["videoID"]);
    let mouseAtClickX = mouseTracker.x;
    let mouseAtClickY = mouseTracker.y;
    let currentTrackIndex = trackTracker["currentTrack"];
    let currentFrame = video.currentTime * DEV_FRAME_RATE;


    let indexOfAlreadyExisting = null;
    let localPoints = getClickedPoints(videoObject["index"], currentTrackIndex);
    let newPoint = null;
    if (localPoints.some(function (point, curIndexs) {
        if (Math.floor(point.frame) === Math.floor(currentFrame)) {
            indexOfAlreadyExisting = curIndexs;
            return true;
        } else {
            return false;
        }
    }) === true) {
        let drawCanvas = document.getElementById(videoObject["canvasID"]);
        let ctx = drawCanvas.getContext("2d");
        ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        newPoint = {
            "x": mouseAtClickX,
            "y": mouseAtClickY,
            "frame": video.currentTime * DEV_FRAME_RATE,
        };
        localPoints[indexOfAlreadyExisting] = newPoint;
        drawPoints(localPoints, videoObject);
        drawLines(localPoints, videoObject);

    } else {
        newPoint = {
            "x": mouseAtClickX,
            "y": mouseAtClickY,
            "frame": video.currentTime * DEV_FRAME_RATE,
        };
        localPoints.push(newPoint);
        localPoints.sort(sortByFrame);
        let newIndex = localPoints.indexOf(newPoint);

        let videoArea = parseInt(event.target.style.height, 10) * parseInt(event.target.style.width, 10);
        // TODO: Change to original height * original width
        drawPoint(mouseAtClickX, mouseAtClickY, (2704 * 2028 * 5) / videoArea, videoObject);
        if (localPoints.length > 1) {

            // Check if there is a point after this one
            if (localPoints[newIndex + 1] !== undefined) {
                // Check if consecutive
                if (Math.floor(newPoint.frame) === Math.floor(localPoints[newIndex + 1].frame) - 1) {
                    drawLine(localPoints[newIndex], localPoints[newIndex + 1], videoObject);
                }
            }
            // Check if there is a point before this one
            if (localPoints[newIndex - 1] !== undefined) {
                // Check if consecutive
                if (Math.floor(newPoint.frame) === Math.floor(localPoints[newIndex - 1].frame) + 1) {
                    drawLine(localPoints[newIndex - 1], localPoints[newIndex], videoObject);
                }
            }
        }
    }

    if (settings["auto-advance"]) {
        currentFrameGlobal += 1;
        moveToNextFrame(videoObject);
        if (settings["sync"] === true) {
            for (let i = 0; i < numberOfCameras; i++) {
                if (i === videoObject["index"]) {
                    continue;
                } else {
                    moveToNextFrame(videoObjectSingletonFactory(i));
                }
            }
        }
    }

    return newPoint;
}


function videoObjectSingletonFactory(index) {
    if (typeof videoObjects[index] === "undefined") {
        videoObjects[index] = {
            "videoID": `video-${index}`,
            "canvasID": `canvas-${index}`,
            "videoCanvasID": `videoCanvas-${index}`,
            "zoomCanvasID": `zoomCanvas-${index}`,
            "videoLabelID": `videoLabel-${index}`,
            "epipolarCanvasID": `epipolarCanvas-${index}`,
            "popVideoID": `pop-video-${index}`,
            "index": index,
        };
    }
    return videoObjects[index];
}


function getGenericInput(inputLabel, callbackOkay, callbackCancel) {
    let cancelButton = $("#generic-input-modal-cancel");
    let okButton = $("#generic-input-modal-ok");
    let modal = $("#generic-input-modal");
        // curCanvas.tabIndex = 1000;


    cancelButton.off();
    okButton.off();
    modal.off();
    // modal[0].removeEventListener("keydown");

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

    $("#modal-content-container").slideDown(500, function () {
        input.focus();
    });

    cancelButton.on("click", callbackCancel);
    okButton.on("click", callbackOkay);


}


function loadVideosIntoDOM(curURL, index, name, canvasOnClick, isMainWindow, popUpArgs,
                           videoFinishedLoadingCallback = null) {
    // popUpArgs - {"offset": offset for the video being loaded}
    let curCanvas = $(`
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

    if (isMainWindow) {
        if (index !== 0) {
            offsetTracker[index] = [];
            offsetTracker[index].push({"offset": 0, "frame": 1});


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
                    offsetTracker[index] = [];
                    offsetTracker[index].push({"offset": curOffset, "frame": 1});
                    let videoObject = videoObjectSingletonFactory(index);


                    let label = document.getElementById(videoObject.videoLabelID);
                    let parsed = parseVideoLabel(label.innerText);
                    parsed.OFFSET = curOffset;
                    label.innerText = videoLabelDataToString(parsed);

                    goToFrame(frameTracker[0], videoObject);
                    $("#generic-input-modal").removeClass("is-active");
                }
            };

            getGenericInput(label, validate, invalid);

        } else {
            offsetTracker[index] = [];
            offsetTracker[index].push({"offset": 0, "frame": 1});
        }
        curCanvas.find(`#canvas-columns-${index}`).append($(`

        <div class="column">
            <button id="pop-video-${index}" class="button">Pop into new Window</button>
        </div>`))
    }

    $("#canvases").append(curCanvas);
    let curVideo = $(`<video class="hidden-video" id="video-${index}" src="${curURL}"></video>`);
    $("#videos").append(curVideo);
    clickedPoints[index] = [];
    clickedPoints[index][0] = [];
    curCanvas = document.getElementById(`canvas-${index}`);
    curCanvas.tabIndex = 1000;
    curCanvas.addEventListener("keydown",
        handleKeyboardInput,
        false);
    curCanvas = $(curCanvas);
    curCanvas.on("click", canvasOnClick);
    curCanvas.on("mousemove", setMousePos);
    curCanvas.on("scroll", setMousePos);

    curVideo.on("error", function () {
        generateError(`${name} could not be loaded, see troubleshooting for more details!`);
        // TODO: Implementation
        // reloadInitState
    });

    curVideo.on('canplay', function () {
        if (!locks[`initFrameLoaded ${index}`]) {
            let videoObject = videoObjectSingletonFactory(index);

            $(`#${videoObject["popVideoID"]}`).on("click", function (event) {
                popOutvideo(event, curURL)
            });

            let video = document.getElementById(videoObject["videoID"]);

            let clickCanvas = document.getElementById(videoObject["canvasID"]);
            let videoCanvas = document.getElementById(videoObject["videoCanvasID"]);
            let epipolarCanvas = document.getElementById(videoObject["epipolarCanvasID"]);

            //TODO COME BACK AND RENAME VARIABLES
            let currentCanvasContainer = document.getElementById(`container-for-canvas-${videoObject["index"]}`);
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

            let zoomCanvas = document.getElementById(videoObject["zoomCanvasID"]);
            zoomCanvas.height = 400;
            zoomCanvas.width = 400;
            zoomCanvas.style.height = "400px";
            zoomCanvas.style.width = "400px";
            zoomCanvas.style.top = (parseInt(clickCanvas.style.top, 10) + clickCanvas.height - zoomCanvas.height) + "px";
            zoomCanvas.style.left = (clickCanvas.width - zoomCanvas.width) + "px";

            let videoLabel = document.getElementById(videoObject["videoLabelID"]);
            let offset = 0;
            if (isMainWindow) {
                offset = offsetTracker[videoObject["index"]][0]["offset"];
            } else {
                offset = popUpArgs["offset"];
            }
            let data = {
                "title": name,
                "frame": 0,
                "offset": index === 0 ? "n/a" : offset,
            };
            videoLabel.innerText = videoLabelDataToString(data);

            goToFrame(1.001, videoObject);
            loadFrame(videoObject);

            locks[`initFrameLoaded ${index}`] = true;
            if (videoFinishedLoadingCallback !== null) {
                videoFinishedLoadingCallback();
            }
        }
        if (!locks["can_click"]) {
            locks["can_click"] = true;
        }
        loadFrame(videoObjectSingletonFactory(index));
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
    for (let cameraIndex = 0; cameraIndex < numberOfCameras; cameraIndex++) {
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
