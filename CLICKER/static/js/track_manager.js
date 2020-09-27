class SubTracksManager {
    // Stores IDs of tracks to draw alongside the current track
    constructor(initSubTracks = null) {
        if (initSubTracks !== null) {
            this.trackIndicies = initSubTracks.trackIndicies;
            this.currentTrackStash = initSubTracks.currentTrackStash;
        } else {
            this.trackIndicies = [];
            this.currentTrackStash = null;
        }
    }

    removeIndex(indexToRemove) {
        let index = this.trackIndicies.findIndex((idx) => idx == indexToRemove);
        if (index === -1) {
            return;
        } else {
            this.trackIndicies.splice(index, 1);
        }
    }

    addIndex(indexToAdd) {
        let index = this.trackIndicies.indexOf(indexToAdd);
        if (index < 0) {
            this.trackIndicies.push(indexToAdd);
        }
    }

    hasIndex(indexToCheckFor) {
        let test = this.trackIndicies.findIndex((idx) => idx == indexToCheckFor);
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
        this.trackIndicies.push(this.currentTrackStash);
        this.currentTrackStash = null;
        return true;
    }

    length() {
        return this.trackIndicies.length
    };
}


class TrackManager {
    constructor(initTracks = null) {
        this.colorIndex = 0;
        if (initTracks !== null) {
            this.tracks = initTracks.tracks;
            this.colorIndex = initTracks.colorIndex;
            this.nextUnusedIndex = initTracks.nextUnusedIndex;
            this.currentTrack = initTracks.currentTrack;
            this.subTracks = new SubTracksManager(initTracks.subTracks)
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
            this.subTracks = new SubTracksManager();
        }
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
        if (index == 0) {
            return;
        }
        let indexToRemove = this.tracks.findIndex((track) => track.absoluteIndex == index);
        if (indexToRemove < 0) {
            return false;
        } else {
            this.tracks.splice(indexToRemove, 1);
            this.subTracks.removeIndex(index);
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