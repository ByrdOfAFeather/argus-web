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
        /*
        To have a communications manager, you only need the state information (one of two options)
        and the callbacks that will tell the communications manager how to handle changes.

        At the time of writing this POPOUT will need the following callbacks:
          goToFrame : What happens when the popout needs to change it's frame
          changeTrack: What happens when the popout needs to change the track it's writing to
          addNewTrack: What happens when the popout needs to add a track to it's state
          drawEpipolarline: What happens when the popout needs to draw a epipolar line
          etc etc etc

        To find out which callbacks need to be defined, look at handleMainWindowChange for POPOUTS
        and handlePopoutChange for MAIN WINDOW.

        Each callback should have clearly defined inputs in these functions, so it should be easy to add new ones
        and debug old ones.

        The callbacks are defined in the constructors of the windowManagers that own this communications
        manager. (ex. PopOutWindowManager will define it's callbacks in it's constructors)
         */

        this.callbacks = callbacks;
        this.communicators = [];
        this.curInitCommunicator = null;
        this.state = state
    }

    updateCommunicators(message) {
        /*
        * This is used by the PopOutWindowManager to go ahead and tell the main window about any changes
        * It's a bit misleading in that there's a forEach, this is mostly for debugging purposes and should
        * probably be changed to [0]. Popout will never have more than 1 communicator, and main window never
        * only notifies popouts of changes - as of writing this that is.
        */
        this.communicators.forEach((communicatorContext) => communicatorContext.communicator.postMessage(message));
    }

    removeCommunicator(index) {
        /*
        * This function removes a communicator based on an absolute index, (if communicator
        * 2 gets removed before 1 and 3, 3 will take the index of 2. We have to use absolute
        * indexes to make sure we are removing the right thing!)
        */
        this.communicators.find(function (elm, iterIndex) {
            if (elm.index === index) {
                index = iterIndex;
                return true;
            }
        });
        this.communicators.splice(index, 1);
    }

    handlePopoutChange(message) {
        /*
         * Responsible for binding callbacks to possible message types (used by MAIN WINDOW)
         */
        let context = message.data;
        if (context.type === 'goToFrame') {
            // context.data: {index: the index of the video sending the message,
            //                frame: the newFrame that the video updated to}
            this.callbacks['newFrame'](context.data);
        } else if (context.type === 'popoutDeath') {
            // context.data: {index: the index of the video sending the message}
            this.callbacks['popoutDeath'](context.data);
        } else if (context.type === 'newPoint') {
        } else if (context.type === 'initLoadFinished') {
        }
    }

    handleMainWindowChange(message) {
        let messageContent = message.data;
        if (messageContent.type === "goToFrame") {
            // As can be seen below, the message should have a frame value in it's data.
            this.callbacks['goToFrame'](messageContent.data.frame);
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
        /*
         * Checks if there exists a communicator for a video and updates it if so
         * Otherwise updates the video in the Main Window (note that the video is always in the
         * Main Window but if a communicator exists for it, it is also popped out and invisible)
         *
         * TODO: Is this part of this function ever actually used?
         * If this function is being called from a popped out window, we know that the video is in the DOM
         * but if we are updating a communicator, it must be the main window communicator
         */
        if (this.state === STATES.POP_OUT) {
            this.communicators[0].communicator.postMessage(message);
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
        /*
         * This is a part of the function of above. It finds a communicator and updates it
         * or updates the video that is local.
         */
        let currentCommunicator = this.communicators.find((elem) => elem.index === index);
        if (currentCommunicator === undefined) {
            localCallback(index);
        } else {
            currentCommunicator.communicator.postMessage(message);
        }
    }

    closeCurrentInitialization() {
        /*
         * This is called after a popout is initialized fully to reset the state.
         *
         * This is important because two popouts can't be initialized at the same time
         * Whenever a popout-button is pressed, this value gets checked and if it is
         * non-null, an error is displayed.
         */
        if (this.curInitCommunicator !== null) {
            this.curInitCommunicator.close();
        }
        this.curInitCommunicator = null;
    }

    initializePopoutWindow(videoIndex, initMessage) {
        /*
         * This function handles the initial handshake between the popout and the mainwindow.
         * First it creates a communicator on a generic channel ("unknown-video") and waits for the
         * pop-out window to connect and send something over that channel. It then knows that the
         * pop-out window is ready to receive the initialization data. It sends it, closes the channel
         * and starts a new channel based on the video name (as to not interfere with other pop-outs).
         * The initialization message is as follows:
         *  {
         *     dataURL: the memory location of the video
         *     index: the absolute index of the video (from which order it was loaded in)
         *     noOfCameras: The number of files originally selected
         *     videoTitle: The file name of the video (used for the title of the popout)
         *     clickedPoints: a list of clicked points (from ClickedPointsManager)
         *     offset: The offset of the video
         *     currentTracks: the attributes of the TrackManager object (everything except the functions)
         *     initFrame: The frame that the video should be loaded to
         *     currentColorSpace: Either RBG or Grayscale
         *     frameRate: The global frame rate
         *  }
         *  This message is passed from the MainWindowManager to this function. The PopOutManager never
         *  uses this function.
         */
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
        /*
         * This function registers a communicator and binds it to handlers based on state
         */
        let new_communicator = new BroadcastChannel(`${communicatorIndex}`);
        if (this.state === STATES.POP_OUT) {
            new_communicator.onmessage = (event) => {
                this.handleMainWindowChange(event);
            };
        } else if (this.state === STATES.MAIN_WINDOW) {
            new_communicator.onmessage = (event) => {
                this.handlePopoutChange(event);
            };
        }
        this.communicators.push({"communicator": new_communicator, "index": communicatorIndex});
    }
}