STATES = {
    MAIN_WINDOW: 0,
    POP_OUT: 1,
};


class CommunicatorsManager {
    /*
    Master class for handling communication from the main window to pop out windows and
    handling pop out window communication to the main window.
     */


    constructor(state, callbacks) {
        this.callbacks = callbacks;
        this.communicators = [];
        this.curInitCommunicator = null;
        this.state = state
    }

    removeCommunicator(index) {
        this.communicators.find(function (elm, iterIndex) {
            if (elm.index === index) {
                index = iterIndex;
                return true;
            }
        });
        this.communicators.splice(index, 1);
    }

    handlePopoutChange(message) {
        let context = message.data;
        if (context.type === 'newFrame') {
        } else if (context.type === 'popoutDeath') {
            this.callbacks['popoutDeath'](context.data);
        } else if (context.type === 'newPoint') {
        } else if (context.type === 'initLoadFinished') {
        }
    }

    handleMainWindowChange(message) {
        let messageContent = message.data;
        if (messageContent.type === "goToFrame") {
        } else if (messageContent.type === "changeTrack") {
        } else if (messageContent.type === "addNewTrack") {
        } else if (messageContent.type === "drawEpipolarLine") {
        } else if (messageContent.type === "drawDiamond") {
        } else if (messageContent.type === "updateSecondaryTracks") {
        } else if (messageContent.type === "loadPoints") {
        } else if (messageContent.type === "changeColorSpace") {
        } else if (messageContent.type === "mainWindowDeath") {
        }
    }

    updateAllLocalOrCommunicator(localCallback, message, ignoreParam = null) {
        if (this.state === STATES.POP_OUT) {
            this.communicators[0].send(message);
        } else {
            for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
                if (ignoreParam !== null) {
                    if (ignoreParam === i) {
                        continue;
                    }
                }
                this.updateLocalOrCommunicator(i, localCallback, message);
            }
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

    initializePopoutWindow(videoIndex, initMessage) {
        if (this.curInitCommunicator !== null) {
            generateError("Can't pop out window while already popping out another window!");
        }
        this.curInitCommunicator = new BroadcastChannel("unknown-video");
        this.curInitCommunicator.onmessage = () => {
            this.curInitCommunicator.postMessage(initMessage);
            this.curInitCommunicator.close();
            this.curInitCommunicator = null;
        };
        this.registerCommunicator(videoIndex);
    }

    registerCommunicator(communicatorIndex) {
        let master_communicator = new BroadcastChannel(`${communicatorIndex}`);
        console.log(this.state);
        if (this.state === STATES.POP_OUT) {
            master_communicator.onmessage = (event) => {
                this.handleMainWindowChange(event);
            };
        } else if (this.state === STATES.MAIN_WINDOW) {
            master_communicator.onmessage = (event) => {
                this.handlePopoutChange(event);
            };
        }
        this.communicators.push({"communicator": master_communicator, "index": communicatorIndex});
    }
}