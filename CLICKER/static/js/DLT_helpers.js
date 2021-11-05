function getVideosWithTheSameFrame(video) {
    return Object.keys(frameTracker).filter(
        (videoIndex) => Math.floor(frameTracker[videoIndex]) === Math.floor(frameTracker[video]));
}

function getPointsInFrame(videosWithTheSameFrame, frameNumber, currentTrack, videosToSizes, pointHelper) {
    let videosWithoutPoint = {};
    let relVideoIndexToPointIndex = {};
    let videosToLines = {};
    let possiblePoints = videosWithTheSameFrame.map((videoIndex) => {
        return {absoluteIndex: videoIndex, points: pointHelper(videoIndex, currentTrack)}
    });
    let points = possiblePoints.filter((pointList) => {
            let index = pointList.points.findIndex((point) => Math.floor(point.frame) === Math.floor(frameNumber));
            if (index !== -1) {
                relVideoIndexToPointIndex[pointList.absoluteIndex] = index;
                return true;
            } else {
                videosWithoutPoint[pointList.absoluteIndex] = true;
                return false;
            }
        }
    ).map((pointList) => {
        return {
            videoIndex: videosWithTheSameFrame[pointList.absoluteIndex],
            pointIndex: relVideoIndexToPointIndex[pointList.absoluteIndex]
        }
    });
    if (points.length === videosWithTheSameFrame.length) {
        return [points, null];
    } else {
        for (const videosWithoutPointKey in videosWithoutPoint) {
            videosToLines[videosWithoutPointKey] = [];
        }
        for (let i = 0; i < points.length; i++) {
            let curRelPoint = points[i];
            let localLines = getEpipolarLines(curRelPoint.videoIndex, DLT_COEFFICIENTS, curRelPoint.pointIndex, currentTrack, videosToSizes, pointHelper, videosWithoutPoint);
            localLines.forEach((line) => videosToLines[line.videoIndex].push(line.line));
        }
        return [points, videosToLines];
    }
}


async function getEpipolarLinesOrUnifiedCoord(videoCalledFrom, frameNumber, currentTrack,
                                              videosToSizes, pointHelper, exportingPoints=false) {
    /*
     */
    let videosWithTheSameFrame = getVideosWithTheSameFrame(videoCalledFrom);
    if (videosWithTheSameFrame.length > 1 && DLT_COEFFICIENTS !== null) {
        let pointsAndLines = getPointsInFrame(videosWithTheSameFrame, frameNumber, currentTrack, videosToSizes, pointHelper);
        let points = pointsAndLines[0];
        let lines = pointsAndLines[1];
        if (points.length >= 2) {
            if (points.length < NUMBER_OF_CAMERAS) {
                let pointsToReconstruct = {};
                let pointIndices = {};
                for (let i = 0; i < points.length; i++) {
                    pointIndices[points[i].videoIndex] = true;
                    let currentVideoIndex = points[i].videoIndex;
                    let currentPointIndex = points[i].pointIndex;
                    pointsToReconstruct[parseInt(currentVideoIndex)] = [pointHelper(currentVideoIndex, currentTrack)[currentPointIndex]];
                }
                for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
                    if (pointIndices[i] !== undefined) {
                        continue;
                    }
                    let lineData1 = lines[i][0];
                    let lineData2 = lines[i][1];
                    let bias1 = lineData1[0][1];
                    let slope1 = (lineData1[1][1] - lineData1[0][1]) / (lineData1[1][0]);
                    let bias2 = lineData2[0][1];
                    let slope2 = (lineData2[1][1] - lineData2[0][1]) / (lineData2[1][0])
                    let x = (bias1 - bias2) / (slope2 - slope1);
                    pointsToReconstruct[i] = [{x: x, y: (slope1 * x) + bias1}];
                }
                let xyz = await uvToXyz(pointsToReconstruct,
                    null, DLT_COEFFICIENTS);
                if (exportingPoints) {
                    return {
                        "type": "unified",
                        "result": [xyz, points]
                    };
                }
                return {
                    "type": 'epipolar-unified',
                    'result': [xyz, lines, points, pointIndices]
                };
            } else {
                let pointsToReconstruct = [];
                for (let i = 0; i < points.length; i++) {
                    let currentVideoIndex = points[i].videoIndex;
                    let currentPointIndex = points[i].pointIndex;
                    pointsToReconstruct.push([pointHelper(currentVideoIndex, currentTrack)[currentPointIndex]]);
                }
                let xyz = await uvToXyz(pointsToReconstruct,
                    null, DLT_COEFFICIENTS);
                return {
                    'type': 'unified',
                    'result': [xyz, points]
                };
            }
        } else {
            return {
                'type': 'epipolar',
                'result': lines
            };
        }
    } else {
        return null;
    }
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
    if (cameraProfile === undefined) {
        return coordinatePair;
    }

    // TODO: Vectorize
    let f = cameraProfile[0];
    let cx = cameraProfile[1];
    let cy = cameraProfile[2];

    let undistorted = [];
    let u, v, u_v_pair;
    let u_norm_org, v_norm_org;
    for (let i = 0; i < coordinatePair.length; i++) {
        u_v_pair = coordinatePair[i];
        u = u_v_pair[0];
        v = u_v_pair[1];

        u_norm_org = (u - cx) / f;
        v_norm_org = (v - cy) / f;

        let r2 = u_norm_org ** 2 + v_norm_org ** 2;
        let rad = 1 + (cameraProfile[3] * r2) + (cameraProfile[4] * r2 ** 2) + (cameraProfile[6] * r2 ** 4);
        let tanDistX = 2*cameraProfile[4]*u_norm_org*v_norm_org + cameraProfile[5] * (r2 + 2*u_norm_org**2);
        let tanDistY = cameraProfile[4]*(r2 * 2*v_norm_org**2) + 2*cameraProfile[5]*u_norm_org*v_norm_org;

        u_norm_org = u_norm_org * rad + tanDistX;
        v_norm_org = v_norm_org * rad + tanDistY;

        let final_u = u_norm_org * f + cx;
        let final_y = v_norm_org * f + cy;
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


function getBezierCurve(slope, intercept, cameraProfile, videoID) {
    let originalVideoWidth = document.getElementById(`canvas-${videoID}`).width;
    let bezierPoints = [];
    for (let k = -10; k < 60; k++) {
        bezierPoints.push([originalVideoWidth*k / 49, slope * (originalVideoWidth*k / 49) + intercept]);
    }
    return redistortPoints(bezierPoints, cameraProfile);
}

function checkCoordintes(x, y, height, width) {
    // Ensures that x is between width and height and y is between width and height
    return 0 <= x <= width && 0 <= y <= height;
}

function getEpipolarLines(videoIndex, DLTCoefficients, pointsIndex, currentTrack, videosToSizes, pointHelper, videosWithoutPoint) {
    let coords = [];
    let dlcCoeff1 = DLTCoefficients[videoIndex];

    let localPoints = pointHelper(videoIndex, currentTrack);
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
    let points = [];
    for (let i = 0; i < coords.length; i++) {
        let tmp = [];
        let coord = coords[i];
        if (coord[0] !== parseInt(videoIndex, 10) && videosWithoutPoint[coord[0]] !== undefined) {
            let dltCoeff2 = DLTCoefficients[coord[0]];
            let xCoord = coord[1][0];
            let yCoord = coord[1][1];

            if (CAMERA_PROFILE) {
                let undistortedPoints = undistortPoints([[xCoord, yCoord]], CAMERA_PROFILE[coord[0]]);
                xCoord = undistortedPoints[0][0];
                yCoord = undistortedPoints[0][1];

                let slopeAndIntercept = getDLTLine(xCoord, yCoord, dlcCoeff1, dltCoeff2);
                let slope = slopeAndIntercept[0];
                let intercept = slopeAndIntercept[1];

                tmp = getBezierCurve(slope, intercept, CAMERA_PROFILE[coord[0]], coord[0]);
                points.push({
                        'videoIndex': coord[0],
                        'line': tmp
                });
            } else {
                let slopeAndIntercept = getDLTLine(xCoord, yCoord, dlcCoeff1, dltCoeff2);
                let slope = slopeAndIntercept[0];
                let intercept = slopeAndIntercept[1];

                let originalHeight = videosToSizes[coord[0]].height;
                let originalWidth = videosToSizes[coord[0]].width;

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

                tmp.push([originalWidth, numeric.add(numeric.mul(slope, originalWidth), intercept)]);
                points.push({
                        'videoIndex': coord[0],
                        'line': tmp
                    }
                );
            }
        }
    }
    return points;
}

async function uvToXyz(points, profiles, dltCoefficents) {
    /*
    * param: points - [[camera_1_points], [camera_2_points], [camera_n_points]]
     */
    let xyzs = [];

    let uvs = [];
    for (let pointIndex = 0; pointIndex < points[0].length; pointIndex++) {
        uvs = [];
        for (let cameraIndex = 0; cameraIndex < NUMBER_OF_CAMERAS; cameraIndex++) {
            let currentPoint = points[cameraIndex][pointIndex];
            let profile;
            try {
                profile = profiles[cameraIndex];
            } catch (e) {
                // In this case the profiles is undefined
            }
            uvs.push([undistortPoints([currentPoint.x, currentPoint.y], profile), cameraIndex]);
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
