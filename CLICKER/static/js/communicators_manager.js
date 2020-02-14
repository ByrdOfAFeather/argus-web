class CommunicatorsManager {
    constructor() {
        this.communicators = [];
    }

    handlePopoutChange() {

    }

    updateAllLocalOrCommunicator(localCallback, message, ignoreParam = null) {
        for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
            if (ignoreParam !== null) {
                if (ignoreParam === i) {
                    continue;
                }
            }
            this.updateLocalOrCommunicator(i, localCallback, message);
        }
    }

    updateLocalOrCommunicator(index, localCallback, message) {
        let currentCommunicator = this.communicators.find((elem) => elem.index === index);
        if (currentCommunicator === undefined) {
            localCallback(index);
        } else {
            currentCommunicator.communicator.postMessage(message);
        }
    }

    closeCurrentInitialization() {
        if (this.curInitCommunicator !== null) {
            this.curInitCommunicator.close();
        }
        this.curInitCommunicator = null;
    }

    registerCommunicator(videoIndex, videoURL, message) {
        if (this.curInitCommunicator !== null) {
            generateError("Can't pop out window while already popping out another window!");
        }
        this.curInitCommunicator = new BroadcastChannel("unknown-video");
        this.curInitCommunicator.onmessage = () => {
            this.curInitCommunicator.postMessage(message);
            this.curInitCommunicator.close();
            this.curInitCommunicator = null;
        };
        let master_communicator = new BroadcastChannel(`${videoIndex}`);
        master_communicator.onmessage = this.handlePopoutChange;
        this.communicators.push({"communicator": master_communicator, "index": videoIndex});
    }
}