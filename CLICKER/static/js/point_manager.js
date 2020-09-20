class ClickedPointsManager {
    constructor(numberOfCameras, initTracks = [0], clickedPoints = null) {
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
    }

    actionOnAllCameras(action) {
        for (let i = 0; i < this.NO_CAMERAS; i++) {
            action(i);
        }
    }

    removeTrack(absoluteTrackIndex) {
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

    addPoint(point, pointContext) {
        let localPoints = this.getClickedPoints(pointContext.clickedVideo, pointContext.currentTrack);


        // If there is already a point
        let indexOfAlreadyExistingPoints = Video.checkIfPointAlreadyExists(localPoints, point.frame);
        if (indexOfAlreadyExistingPoints !== null) {
            localPoints[indexOfAlreadyExistingPoints] = point;
            return {index: indexOfAlreadyExistingPoints, override: true};
        } else {
            localPoints.push(point);
            localPoints.sort(sortByFrame);
            return {index: localPoints.length - 1, override: false};
        }

        // // return the Index
        // if (indexOfAlreadyExistingPoints !== null) {
        //     return indexOfAlreadyExistingPoints;
        // } else {
        //     return localPoints.length - 1;
        // }
    }

    removePoint(video, track, frame) {
        let localPoints = this.getClickedPoints(video, track);
        let index = localPoints.findIndex((point) => Math.floor(point.frame) === Math.floor(frame));
        if (index === -1) {
            return;
        } else {
            localPoints.splice(index, 1);
        }
    }
}