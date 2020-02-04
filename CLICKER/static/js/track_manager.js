class TrackManager {
    constructor(initTracks = null) {
        this.colorIndex = 0;
        if (initTracks !== null) {
            this.tracks = initTracks;
        } else {
            this.tracks = [
                {
                    name: "Track 0",
                    absoluteIndex: 0,
                    color: COLORS[this.colorIndex]
                }
            ];
        }


        this.colorIndex += 1;

        this.nextUnusedIndex = 1;
        this.currentTrack = this.tracks[0];
        this.subTracks = new SubTracksManager();
    }

    generateTrackObject(trackName) {
        return {
            name: trackName,
            index: this.nextUnusedIndex,
            color: COLORS[this.colorIndex]
        }
    }

    addTrack(name) {
        let newTrack = this.generateTrackObject(name);

        if (this.tracks.filter((track) => track.name.toLowerCase() === name.toLowerCase()).length !== 0) {
            generateError("You can't add a track with the same name twice!");
            return false;
        }
        this.tracks.push(newTrack);
        this.nextUnusedIndex += 1;

        if (COLORS.length - 1 === this.colorIndex) {
            this.colorIndex = 0;
        } else {
            this.colorIndex += 1;
        }

        updatePopouts({
            "type": "addNewTrack",
            "data": {
                "track": {
                    newTrack
                }
            }
        });
        return true;
    }

    removeTrack(index) {
        let indexToRemove = this.tracks.findIndex((track) => track.absoluteIndex === indexToRemove);
        if (indexToRemove < 0) {
            return false;
        } else {
            this.tracks.splice(indexToRemove, 1);
            this.subTracks.remove(index);

            updatePopouts({
                "type": "removeTrack",
                "data": {
                    "track": {
                        indexToRemove
                    }
                }
            });
            return true;
        }
    }

    addSubTrack(newSubTrack) {
        this.subTracks.addIndex(newSubTrack);
    }

    removeSubTrack(subTrackToRemove) {
        this.subTracks.removeIndex(subTrackToRemove);
    }

    changeCurrentTrack(newTrack) {
        this.subTracks.unstash();
        if (this.subTracks.hasIndex(newTrack)) {
            this.subTracks.stash(newTrack);
            this.subTracks.removeIndex(newTrack);
        }
        this.currentTrack = newTrack;
    }
}