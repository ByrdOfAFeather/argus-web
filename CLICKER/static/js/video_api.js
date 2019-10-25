let videoObjects = [];

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

function goToFrame(frameNumber, videoObject) {
    //TODO: NOTE THAT WHEN A USER INPUTS A FRAME NUMBER IT WILL EXTEND ITSELF WITH A .01
    let vidOffset = getOffset(frameNumber, videoObject);
    frameNumber -= vidOffset;

    clearCanvasesBetweenFrames(videoObject);
    let video = document.getElementById(videoObject["videoID"]);


    let estimatedTime = frameNumber / DEV_FRAME_RATE;
    video.currentTime = estimatedTime;

    let parsedLabel = parseVideoLabel(document.getElementById(videoObject["videoLabelID"]).innerText);
    parsedLabel["frame"] = (estimatedTime * DEV_FRAME_RATE) + vidOffset;
    document.getElementById(videoObject["videoLabelID"]).innerText = videoLabelDataToString(parsedLabel);
    frameTracker[videoObject["index"]] = frameNumber;
    // loadFrame(videoObject);
    // attemptToDrawEpipolarLinesOrUnifedCoord(frameNumber, videoObject);
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
        localPoints[indexOfAlreadyExisting] = {
            "x": mouseAtClickX,
            "y": mouseAtClickY,
            "frame": video.currentTime * DEV_FRAME_RATE,
        };
        drawPoints(localPoints, videoObject);
        drawLines(localPoints, videoObject);

    } else {
        localPoints.push({
            "x": mouseAtClickX,
            "y": mouseAtClickY,
            "frame": video.currentTime * DEV_FRAME_RATE,
        });
        let videoArea = parseInt(event.target.style.height, 10) * parseInt(event.target.style.width, 10);
        console.log(.01 * videoArea);
        console.log(videoArea);
        // TODO: Change to original height * original width
        drawPoint(mouseAtClickX, mouseAtClickY, (2704 * 2028 * 5) / videoArea, videoObject);
        if (localPoints.length > 1) {
            drawLine(localPoints[localPoints.length - 2],
                localPoints[localPoints.length - 1], videoObject);
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

    attemptToDrawEpipolarLinesOrUnifedCoord(currentFrame, videoObject);
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



function loadVideosIntoDOM(curURL, index, name, canvasOnClick, isMainWindow, popUpArgs) {
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
            let invalidOffset = 1;
            while (invalidOffset) {
                let curOffset = parseInt(window.prompt(`What is the offset for ${name}`), 10);
                if (isNaN(curOffset)) {
                    alert("Offset must be a valid integer!");
                } else {
                    offsetTracker[index] = [];
                    offsetTracker[index].push({"offset": curOffset, "frame": 1});
                    invalidOffset = 0;
                }
            }
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


    curVideo.on('canplay', function () {
        if (!locks[`initFrameLoaded ${index}`]) {
            let videoObject = videoObjectSingletonFactory(index);

            $(`#${videoObject["popVideoID"]}`).on("click", function (event) {
                popVideoOut(event, curURL)
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
            }
            else {
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
        }
        if (!locks["can_click"]) {
            locks["can_click"] = true;
        }
        loadFrame(videoObjectSingletonFactory(index));
    });
}

