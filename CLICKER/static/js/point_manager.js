class ClickedPointsManager {
    constructor(numberOfCameras, initTracks = [0], clickedPoints = null, frameViewOffset = null) {
        this.NO_CAMERAS = numberOfCameras;
        if (clickedPoints !== null) {
            this.clickedPoints = clickedPoints;
        } else {
            this.clickedPoints = [];
            for (let i = 0; i < numberOfCameras; i++) {
                this.clickedPoints.push({});
                for (let j = 0; j < initTracks.length; j++) {
                    this.clickedPoints[i][j] = [];
                }
            }
        }

        if (frameViewOffset === null) {
            this.frameViewOffset = -1;
        } else {
            this.frameViewOffset = frameViewOffset;
        }
    }

    setFrameViewOffset(newOffset) {
        this.frameViewOffset = newOffset;
    }

    actionOnAllCameras(action) {
        for (let i = 0; i < this.NO_CAMERAS; i++) {
            action(i);
        }
    }

    removeTrack(absoluteTrackIndex) {
        if (absoluteTrackIndex == 0) {
            let removeTrack = (cameraIndex) => this.clickedPoints[cameraIndex][0] = [];
            this.actionOnAllCameras(removeTrack);
            return;
        }
        absoluteTrackIndex = absoluteTrackIndex.toString();
        let removeTrack = (cameraIndex) => delete this.clickedPoints[cameraIndex][absoluteTrackIndex];
        this.actionOnAllCameras(removeTrack);
    }

    addTrack(absoluteTrackIndex) {
        absoluteTrackIndex = absoluteTrackIndex.toString();
        let addTrack = (cameraIndex) => this.clickedPoints[cameraIndex][absoluteTrackIndex] = [];
        this.actionOnAllCameras(addTrack);
    }

    getClickedPoints(index, currentAbsoluteTrackIndex) {
        return this.clickedPoints[index][currentAbsoluteTrackIndex];
    }

    getClickedPointsFrameViewOffsetSensitive(index, currentAbsoluteTrackIndex) {
        let localPoints = this.clickedPoints[index][currentAbsoluteTrackIndex];
        if (this.frameViewOffset === -1) {
            return localPoints;
        }
        localPoints = localPoints.filter((point) => frameTracker[index] - this.frameViewOffset <= point.frame && point.frame <= frameTracker[index] + this.frameViewOffset);
        return localPoints
    }

    addPoint(point, pointContext) {
        let localPoints = this.getClickedPoints(pointContext.clickedVideo, pointContext.currentTrack);


        // If there is already a point
        let indexOfAlreadyExistingPoints = Video.checkIfPointAlreadyExists(localPoints, point.frame);
        if (indexOfAlreadyExistingPoints !== null) {
            localPoints[indexOfAlreadyExistingPoints] = point;
            return {index: indexOfAlreadyExistingPoints, override: true};
        } else {
            localPoints.push(point);
            return {index: localPoints.length - 1, override: false};
        }
    }

    removePoint(video, track, frame) {
        let localPoints = this.getClickedPoints(video, track);
        let index = localPoints.findIndex((point) => Math.floor(point.frame) === Math.floor(frame));
        if (index === -1) {
            return null;
        } else {
            localPoints.splice(index, 1);
            return {
                "video": video,
                "track": track,
                "frame": frame,
                "index": index
            };
        }
    }
}