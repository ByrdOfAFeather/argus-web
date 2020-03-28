class SubTracksManager {
    // Stores IDs of tracks to draw alongside the current track
    constructor() {
        this.track_indicies = [];
        this.currentTrackStash = null;
    }

    removeIndex(indexToRemove) {
        let index = this.track_indicies.indexOf(indexToRemove);
        if (index >= 0) {
            this.track_indicies.splice(index, 1);
        }
    }

    addIndex(indexToAdd) {
        let index = this.track_indicies.indexOf(indexToAdd);
        if (index < 0) {
            this.track_indicies.push(indexToAdd);
        }
    }

    hasIndex(indexToCheckFor) {
        let test = this.track_indicies.indexOf(indexToCheckFor);
        return test >= 0;
    }

    stash(indexToStash) {
        this.currentTrackStash = indexToStash;
        this.removeIndex(indexToStash);
    }

    unstash() {
        if (this.currentTrackStash == null) {
            return false;
        }
        this.track_indicies.push(this.currentTrackStash);
        this.currentTrackStash = null;
        return true;
    }

    length() { return this.track_indicies.length };
}


class TrackManager {
    constructor(initTracks = null) {
        this.colorIndex = 0;
        if (initTracks !== null) {
            this.tracks = initTracks.tracks;
            this.colorIndex = initTracks.colorIndex;
            this.nextUnusedIndex = initTracks.nextUnusedIndex;
            this.currentTrack = initTracks.currentTrack;
        } else {
            this.tracks = [
                {
                    name: "Track 0",
                    absoluteIndex: 0,
                    color: COLORS[this.colorIndex]
                }
            ];
            this.colorIndex += 1;
            this.nextUnusedIndex = 1;
            this.currentTrack = this.tracks[0];
        }

        this.subTracks = new SubTracksManager();
    }

    generateTrackObject(trackName) {
        return {
            name: trackName,
            absoluteIndex: this.nextUnusedIndex,
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

        return true;
    }

    removeTrack(index) {
        let indexToRemove = this.tracks.findIndex((track) => track.absoluteIndex === index);
        if (indexToRemove < 0) {
            return false;
        } else {
            this.tracks.splice(indexToRemove, 1);
            this.subTracks.remove(index);
            return true;
        }
    }

    addSubTrack(newSubTrack) {
        this.subTracks.addIndex(newSubTrack);
    }

    removeSubTrack(subTrackToRemove) {
        this.subTracks.removeIndex(subTrackToRemove);
    }

    hasSubTrack(index) {
        return this.subTracks.hasIndex(index);
    }

    stashSubtrack(index) {
        this.subTracks.stash(index);
    }

    unstashSubtrack() {
        return this.subTracks.unstash();
    }

    resetSubtracks() {
        this.subTracks = new SubTracksManager();
    }

    findTrack(absoluteIndex) {
        return this.tracks.filter((value) => value.absoluteIndex == absoluteIndex)[0];
    }

    changeCurrentTrack(absoluteIndex) {
        /*
         * Note that absoluteIndex is not the index of this internal list
         */
        this.subTracks.unstash();
        if (this.subTracks.hasIndex(absoluteIndex)) {
            this.subTracks.stash(absoluteIndex);
            this.subTracks.removeIndex(absoluteIndex);
        }
        this.currentTrack = this.findTrack(absoluteIndex);
    }
}