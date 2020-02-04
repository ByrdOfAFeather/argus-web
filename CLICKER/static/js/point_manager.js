class ClickedPointsManager {
    constructor(numberOfCameras, initTracks = [0]) {
        this.clickedPoints = [];
        this.NO_CAMERAS = numberOfCameras;
        for (let i = 0; i < numberOfCameras; i++) {
            this.clickedPoints.push({});
            for (let j = 0; j < initTracks.length; j++) {
                this.clickedPoints[i][j] = [];
            }
        }
    }

    actionOnAllVideos(action) {
        for (let i = 0; i < this.NO_CAMERAS; i++) {
            action(i);
        }
    }

    removeTrack(absoluteTrackIndex) {
        absoluteTrackIndex = absoluteTrackIndex.toString();
        let removeTrack = (cameraIndex) => delete this.clickedPoints[cameraIndex][absoluteTrackIndex];
        this.actionOnAllVideos(removeTrack);
    }

    addTrack(absoluteTrackIndex) {
        absoluteTrackIndex = absoluteTrackIndex.toString();
        let addTrack = (cameraIndex) => this.clickedPoints[cameraIndex][absoluteTrackIndex] = [];
        this.actionOnAllVideos(addTrack);
    }

    getClickedPoints(index, currentAbsoluteTrackIndex) {
        return this.clickedPoints[index][currentAbsoluteTrackIndex];
    }

    addPoint(point, pointContext) {
        let currentTrackIndex = pointContext.currentTrack;
        let localPoints = this.getClickedPoints(pointContext.clickedVideo, currentTrackIndex);


        // If there is already a point
        let indexOfAlreadyExistingPoints = Video.checkIfPointAlreadyExists(localPoints, point.frame);
        if (indexOfAlreadyExistingPoints !== null) {
            localPoints[indexOfAlreadyExistingPoints] = point;
            return true;
        } else {
            localPoints.push(point);
            localPoints.sort(sortByFrame);
            return false;
        }

        // // return the Index
        // if (indexOfAlreadyExistingPoints !== null) {
        //     return indexOfAlreadyExistingPoints;
        // } else {
        //     return localPoints.length - 1;
        // }
    }
}