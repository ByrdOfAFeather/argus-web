// TODO: Generate .min.js that contains both clicker.js, video_api.js, and this file.
LABEL_STYLES = {DARK: "has-text-black", LIGHT: "has-text-white"};


function genericDropDownWidget(id, defaultSelection, dropdownOptions, allItemCallBack = undefined) {
    /*
     * Generates a drop down containing items that are passed and if a callback is passed, applies it to all items
     *
     * id: string, unique ID that will be used as a prefix to tag important drop down pieces
     *  In particular:
     *  The dropdown container (div that contains everything in the dropdown) id-dropdown-container
     *  The dropdown menu (div that contains all options for the dropdown) id-dropdown
     *  The dropdown selection (Whatever the current selection is for the dropdown) id-current-selection
     *
     * defaultSelection: string, represents the text of whatever the default option should be
     *
     * dropDownOptions: Array[JqueryObjects], all pre-defined objects that should be in the drop-down.
     *  see: generateDropDownItems
     *
     * allItemCallback: Optional function that is called whenever any item is clicked, this is helpful when you
     *  have a function that parses out what the action should be instead of multiple functions bound to indiv. items.
     *  If you want to use this but still have some individual callbacks, add .negate-all-callback class to the items
     *  you don't want to be included.
     * allItemCallback(event) { Parses the selection and decides what to do }
     */
    let triggerButton = $("<button>", {
        id: `${id}-trigger`,
        class: "button"
    }).attr("aria-haspopup", "true").attr("aria-controls", `${id}-dropdown`).append(
        $("<span>", {id: `${id}-current-selection`}).text(defaultSelection),
        $("<i>", {class: "fas fa-caret-down has-margin-left"})
    ).on("click", function (e) {
        let container = $(`#${id}-dropdown-container`);
        if (container.hasClass("is-active")) {
            container.removeClass("is-active");
        } else {
            container.addClass("is-active");
        }
        e.stopPropagation();
    });


    if (allItemCallBack === undefined) {
        return genericDivWidget("dropdown", `${id}-dropdown-container`).append(
            genericDivWidget("dropdown-trigger").append(
                triggerButton
            ),

            genericDivWidget("dropdown-menu", `${id}-dropdown`).attr("role", "menu").append(
                dropdownOptions
            )
        );
    } else {
        return genericDivWidget("dropdown", `${id}-dropdown-container`).append(
            genericDivWidget("dropdown-trigger").append(
                triggerButton
            ),

            genericDivWidget("dropdown-menu", `${id}-dropdown`).attr("role", "menu").append(
                dropdownOptions
            )
        ).on("click", ".dropdown-item:not(.negate-all-callback)", allItemCallBack);
    }
}


function dropDownItemWidget(id, itemText, perItemCallBack = undefined,) {
    /*
     * Generates a Jquery object representing a dropdown-item (see genericDropDownWidget)
     *
     * id: unique ID for this item, probably the name of the item!
     *
     * itemText: Text to be used that the user will see for an item. Definitely the name of the item!
     *
     * perItemCallback: Used whenever this particular item is clicked
     * perItemCallBack(event) { Does whatever needs to be done whenever this item is clicked }
     */
    if (perItemCallBack === undefined) {
        return genericDivWidget("dropdown-content").append(
            genericDivWidget("dropdown-item", id).append(
                itemText
            )
        );
    } else {
        return genericDivWidget("dropdown-content").append(
            genericDivWidget("dropdown-item negate-all-callback", id).append(
                itemText
            ).on("click", perItemCallBack)
        );
    }
}

function generateDropDownItems(itemNames) {
    /*
     * Maps a list of stings to dropDownItems without callbacks. Helpful when using a callback applied to all itmems
     *
     * itemNames: Array[String] a list of names that will become the ID and text (lowercase for ID)
     */
    return itemNames.map((value) => dropDownItemWidget(value.toLowerCase().replace(".", "-"), value));
}

function colorSpaceDropDownWidget(colorSpaceIndex, redrawVideosFunction, videoIndex, defaultValue = RGB) {
    /*
     * Generates a colorspace dropdown containing two items (RGB & GRAYSCALE)
     *
     * colorSpaceIndex: A unique ID, the colorspace is used in setup and settings, thus it needs to be able to have
     *  multiple IDs so they aren't canceling each other out.
     */
    let items = generateDropDownItems(["RGB", "Grayscale"]);
    return genericDropDownWidget(`colorspace-${colorSpaceIndex}`, colorspaceToText(defaultValue), items, function (e) {
        let container = $(`#colorspace-${colorSpaceIndex}-dropdown-container`);

        let newSelection = $(e.target).text();
        previewCOLORSPACE = newSelection.toLowerCase() === "rgb" ? RGB : GREYSCALE;
        if (container.hasClass("is-active")) {
            container.removeClass("is-active");
        }

        $(`#colorspace-${colorSpaceIndex}-current-selection`).text(newSelection);
        redrawVideosFunction();
    });
}


function generateTrackDropDownItem(parsedTrackName, trackIndex, includeDeleteButton) {
    let deleteButton = null;
    if (includeDeleteButton) {
        deleteButton = genericDivWidget('column is-narrow').append(
            $("<button>", {class: "dropdown-item-delete delete", id: `track-${trackIndex}-delete`}).text("Delete")
        );
    }
    return genericDivWidget('dropdown-content', `track-${trackIndex}-container`).append(
        genericDivWidget('container').append(
            genericDivWidget('level').append(
                genericDivWidget('level-left').append(
                    genericDivWidget('column is-narrow').append($("<label>", {class: 'label is-small'}).text("Disp.")),
                    // TODO: Curindex
                    genericDivWidget('column is-narrow').append($("<input>", {
                            id: `track-${trackIndex}-disp`,
                            type: "checkbox",
                            class: "checkbox track-display-box",
                            checked: "checked"
                        })
                    ),
                    genericDivWidget('dropdown-item has-text-centered', `track-${trackIndex}`).text(parsedTrackName)
                ),

                genericDivWidget('level-right').append(
                    deleteButton
                )
            )
        )
    );
}


function resetTrackDropDownDispSelections() {
    let dropdown = $("#track-dropdown");
    dropdown.find(".track-display-box").each(function () {
        $(this).removeClass("disabled");
        $(this).prop('checked', false)
    });
}


function addTrackToDropDown(parsedTrackName, index, deleteButton) {
    let widget = generateTrackDropDownItem(parsedTrackName, index, deleteButton);
    widget.find(`#track-${index}-disp`).addClass('disabled');
    $("#track-dropdown").append(widget);
}

function removeTrackFromDropDown(trackID) {
    $(`#track-${trackID}-container`).remove();
}


function trackDropDownWidget(onTrackClick, onTrackDisplay, onTrackDelete) {
    /*
     * TODO: When writing this documentation make sure to include the fact that display and delete need stop propagation lines
     */
    let items = generateTrackDropDownItem("Track 0", 0, false);
    let dropDown = genericDropDownWidget('track', 'Select Track', items, onTrackClick);

    dropDown.on('click', '.track-display-box', onTrackDisplay);
    dropDown.on('click', '.dropdown-item-delete', onTrackDelete);
    return dropDown;
}


function frameRateDropDownWidget(defaultValue = '30') {
    let COMMON_FRAME_RATES = [
        '29.97',
        '30',
        '50',
        '59.94',
        '60'
    ];

    let updateDropDownAndShowCustomForm = () => {
        let container = $(`#frame-rate-dropdown-container`);
        let dropdownSelection = $("#frame-rate-current-selection");
        let frameRateContainer = $("#custom-frame-rate-container");
        dropdownSelection.text("Custom");
        if (container.hasClass("is-active")) {
            container.removeClass("is-active");
        } else {
            container.addClass("is-active");
        }
        if (frameRateContainer.hasClass("is-not-display")) {
            frameRateContainer.removeClass("is-not-display");
            let frameRateInput = $("#frame-rate-input");
            frameRateInput.focus();
            let saveButton = $("#frame-rate-save-button");
            saveButton.on("click", function () {
                let input = frameRateInput.val();
                let parse = parseFloat(input);
                let warning = $("#modal-input-warning-frame-rate");
                if (!isNaN(parse)) {
                    previewFRAMERATE = parse;
                    dropdownSelection.text(input);
                    warning.addClass("is-not-display");
                    frameRateContainer.addClass("is-not-display");
                    saveButton.off();
                } else {
                    previewFRAMERATE = null;
                    if (warning.hasClass("is-not-display")) {
                        warning.removeClass("is-not-display");
                    }
                }
            });
            frameRateContainer.on("keydown", (e) => {
                e.stopPropagation();
                if (e.keyCode === 13) {
                    saveButton.click();
                }
            });
        }
    };

    let updateDropDown = (e) => {
        let container = $(`#frame-rate-dropdown-container`);
        $("#custom-frame-rate-container").addClass("is-not-display");
        let frameRate = parseFloat(e.target.id.replace("-", "."));
        $("#frame-rate-current-selection").text(frameRate);
        previewFRAMERATE = frameRate;
        if (container.hasClass("is-active")) {
            container.removeClass("is-active");
        } else {
            container.addClass("is-active");
        }
        e.stopPropagation();
    };

    let items = generateDropDownItems(COMMON_FRAME_RATES);
    items.push(dropDownItemWidget("frameRate-custom", "Custom", updateDropDownAndShowCustomForm));
    return genericDropDownWidget('frame-rate', defaultValue, items, updateDropDown).append(
        genericDivWidget("is-not-display", "custom-frame-rate-container").append(
            genericDivWidget("columns has-margin-left is-gapless").append(
                genericDivWidget("column is-4", "frame-rate-input-container").append(
                    $("<input>", {class: "input", type: "text", id: "frame-rate-input", placeholder: "Framerate"}),
                    $("<p>", {id: "modal-input-warning-frame-rate", class: "help is-danger is-not-display"}).text(
                        "Please input a valid framerate!"
                    )
                ),
                genericDivWidget("column is-narrow").append(
                    $("<button>", {class: "button", id: "frame-rate-save-button"}).text("Save")
                )
            )
        )
    );
}

function tooltipBuilder(helpText, multiline, style, direction) {
    return $("<button>", {
        class:
            `is-primary tooltip-button has-tooltip-${direction} ${multiline === true ? 'has-tooltip-multiline' : ''}`,
        tabindex: -1
    }).attr(
        'data-tooltip',
        `${helpText}`
    ).append(
        $("<i>", {
            class: `fas fa-question-circle is-primary ${style}`,
            tabindex: -1
        })
    )
}

function tooltipLabelWidget(labelText, labelStyle, tooltipText, direction) {
    return genericDivWidget("columns is-gapless").append(
        genericDivWidget("column is-narrow").append(
            $("<label>", {class: `label ${labelStyle}`}).text(labelText),
        ),
        genericDivWidget("column is-narrow").append(
            tooltipBuilder(tooltipText, true, labelStyle, direction)
        )
    );
}

function canvas(id, classType, style) {
    return $("<canvas>", {class: classType, id: id, style: style});
}

function popOutButtonWidget(videoIndex, videoURL, popOutFunction) {
    /*
    videoIndex: Integer represnting the current video index
    videoURL: String reprsenting the source for the video, this is required to load the video in a new window

    popOutFunction: Used whenever the pop-out button is pressed
    popOutFunction: (event: jquery event object, videoURL: str same as above) { handles popping a video into a new
    tab and adding it to the current communicators }
    */
    let
        popOutButton = $("<button>", {class: "button", id: `popVideo-${videoIndex}`}).append(
            $("<i>", {class: "fa fa-window-restore"}).attr("aria-hidden", "true")
        );
    popOutButton.on("click", function (_) {
        popOutFunction(videoIndex, videoURL)
    });
    return popOutButton
}

function _canvasWidthAndHeightManager(canvas, width, height) {
    return canvas.css("width", "100%").css("height", "100%").attr("height", height).attr("width", width);
}

function clickerCanvasWidget(videoIndex, videoWidth, videoHeight, onKeyboardInput, onClick, onRightClick, setMousePos) {
    /*
    videoIndex: integer value representing the index of the video

    onKeyboardInput: Callback whenever a key is pressed and the current canvas is focused
    onKeyboardInput (event) { finds a key bound to the input and performs the shortcut otherwise nothing happens }

    onClick: Callback whenever the clickable canvas is pressed
    onClick(event) { handles adding a new point and updating popouts if necessary }

    onRightClick: Callback whenever the clickable canvas is pressed with a right click
    onRightClick(event) { handles removing a point and updating popouts if necessary }

    setMousePos: Callback used whenever the mouse is moved over the canvas
    onMouseMove(event) { sets relative mouse coordinates & probably draws the zoom window }

    TODO: Video Canvas has class-type draggable, don't know for sure why this is
    I believe it is due to resizing which is a legacy feature.
     */

    let clickableCanvas = canvas(`canvas-${videoIndex}`, "clickable-canvas absolute", "z-index: 4;");
    clickableCanvas = _canvasWidthAndHeightManager(clickableCanvas, videoWidth, videoHeight);
    clickableCanvas.prop('tabindex', 1000);
    clickableCanvas.on('keydown', onKeyboardInput);

    let epipolarCanvas = canvas(`epipolarCanvas-${videoIndex}`, "epipolar-canvas absolute", "z-index: 2;");
    epipolarCanvas = _canvasWidthAndHeightManager(epipolarCanvas, videoWidth, videoHeight);

    let videoCanvas = canvas(`videoCanvas-${videoIndex}`, "video-canvas absolute", "z-index: 1;");
    videoCanvas = _canvasWidthAndHeightManager(videoCanvas, videoWidth, videoHeight);

    let subTrackCanvas = canvas(`subtrackCanvas-${videoIndex}`, 'sub-track absolute', 'z-index: 3;');
    subTrackCanvas = _canvasWidthAndHeightManager(subTrackCanvas, videoWidth, videoHeight);

    return genericDivWidget("container", `container-for-canvas-${videoIndex}`).append(
        clickableCanvas.on("click", onClick).on("contextmenu", onRightClick).on("mousemove", setMousePos),
        epipolarCanvas,
        videoCanvas,
        subTrackCanvas
    ).css("height", "100%");
}

function clickerWidget(videoIndex, videoWidth, videoHeight, updateVideoPropertyCallback, loadPreviewFrameFunction,
                       onKeyboardInput, onClick, onRightClick, setMousePos, initStyleValues, displaySettings) {
    /*
    videoIndex: Integer representing the video that this widget is being rendered for. There should be one
    canvas widget per video.

    videoManager: Video object for the current video index, used to bind filter changes to changes in the
    actual drawing of the frame

    loadPreviewFrameFunction: callback used whenever a setting is updated
    loadPreviewFrameFunction(videoIndex: integer) { returns nothing, reloads the current frame with new settings }

    onClick: Callback whenever the clickable canvas is pressed
    onClick(event) { handles adding a new point and updating popouts if necessary }

    onRightClick: Callback whenever the clickable canvas is pressed with a right click
    onRightClick(event) { handles removing a point and updating popouts if necessary }
    */

    let updateVideoProperties = (propertyID) => {
        let value = $(`#${propertyID}`).val();
        switch (propertyID) {
            case `brightness-${videoIndex}`: {
                updateVideoPropertyCallback('currentBrightnessFilter', `brightness(${value}%)`);
                break;
            }
            case `contrast-${videoIndex}`: {
                updateVideoPropertyCallback('currentContrastFilter', `contrast(${value}%)`);
                break;
            }
            case `saturation-${videoIndex}`: {
                updateVideoPropertyCallback('currentSaturateFilter', `saturate(${value}%)`);
                break;
            }
        }
        loadPreviewFrameFunction(videoIndex);
    };
    return genericDivWidget("column is-12", `masterColumn-${videoIndex}`).append(
        // genericDivWidget("container").append(
        genericDivWidget("columns has-text-centered is-multiline", `canvas-columns-${videoIndex}`).append(
            genericDivWidget("column is-12 video-label-container").append(
                genericDivWidget("level").append(
                    genericDivWidget("level-left").append(
                        $('<p>', {class: "video-label render-unselectable", id: `videoLabel-${videoIndex}`})
                    ),
                    genericDivWidget("level-right").append(
                        genericDivWidget("columns").append(
                            genericDivWidget("column", `pop-out-${videoIndex}-placeholder`),
                            genericDivWidget("column").append(
                                $("<button>", {class: "button"}).append(
                                    $("<i>", {class: "fa fa-cog"}).attr("aria-hidden", "true")
                                ).on("click", displaySettings)
                            )
                        )
                    )
                )
            ),

            genericDivWidget("column").append(
                genericDivWidget("columns", `misc-settings-${videoIndex}`).append(
                    genericDivWidget("column is-7").append(
                        clickerCanvasWidget(videoIndex, videoWidth, videoHeight, onKeyboardInput, onClick, onRightClick, setMousePos)
                    ),
                    genericDivWidget("column").append(
                        genericDivWidget("container", `zoom-text-${videoIndex}`).append(
                            genericDivWidget("container", `zoom-canvas-${videoIndex}`).append(
                                canvas(`zoomEpipolarCanvas-${videoIndex}`, "zoom-epipolar-canvas absolute", "z-index: 3;").css("height", "100%").css("width", "100%"),
                                canvas(`zoomCanvas-${videoIndex}`, "zoom-canvas absolute", "z-index: 2;").css("height", "100%").css("width", "100%"),
                            ),
                            $("<p class='render-unselectable'>X = Zoom Out<br>Z = Zoom In<br>L = Lock To Epipolar<br>P = Enter Precision Mode</p>")
                        )
                    ),
                ),
            )
        )
    );
}

function sliderWidget(id, min, max, initVal, onChange) {
    return $(`<input id="${id}" class="slider is-fullwidth" step="1" min="${min}" max="${max}" value="${initVal}" type="range">`).on('change', onChange);
}

function videoPropertySlidersWidget(brightnessID, contrastID, saturationID, updateVideoProperties, labelStyle,
                                    initValues = {
                                        brightness: '100', saturation: '100', 'contrast': '100'
                                    }) {
    /*
    brightnessID: String representing what the desired unique identifier is for the brightness slider
    contrastID: String representing what the desired unique identifier is for the contrast slider
    saturationID: String representing what the desired unique identifier is for the saturation slider

    updateVideoProperties: callback used whenever a specific slider is changed
    updateVideoProperties(propertyID: string, note: Does not include the #)
    { returns nothing, does whatever needs to be done to update the specific settings and redraw the current frame}
    */

    // LONG TOOLTIP TEXTS
    let brightnessTooltipText = "Controls how much intensity every element in a video has. When you raise this, every pixel will " +
        "get lighter.";
    let contrastTooltipText = 'Controls the difference between the darker and lighter elements, when this is set to 0 there' +
        ' is no difference and every element becomes the same!';
    let saturationTooltipText = 'Saturation can be thought of as: how colorful do I want my video? Which is exactly' +
        ' why this setting will have no effect in black & white settings';

    return [genericDivWidget("column is-12").append(
        tooltipLabelWidget("Brightness", labelStyle, `${brightnessTooltipText}`, "top"),
        sliderWidget(`${brightnessID}`, "0", "200", initValues.brightness, function () {
            updateVideoProperties(`${brightnessID}`);
        })),
        genericDivWidget("column is-12").append(
            tooltipLabelWidget("Contrast", labelStyle, `${contrastTooltipText}`, "top"),
            sliderWidget(`${contrastID}`, '0', '100', initValues.contrast, function () {
                updateVideoProperties(`${contrastID}`)
            }),
        ),
        genericDivWidget("column is-12").append(
            tooltipLabelWidget("Saturation", labelStyle, `${saturationTooltipText}`, "top"),
            sliderWidget(`${saturationID}`, '0', '100', initValues.saturation, function () {
                updateVideoProperties(`${saturationID}`)
            }),
        )]
}

function videoSettingsWidget(videoTitle, loadPreviewFrameFunction, context, saveCallback, currentSettings) {
    previewCOLORSPACE = currentSettings.filter.colorspace; // Default to RGB, also will just reassign
    previewFRAMERATE = currentSettings.frameRate;
    previewPOINT_SIZE = currentSettings.pointSize;
    let genericContainer = $("#generic-input-modal-content");
    genericContainer.css("width", "100%");
    genericContainer.css("max-height", "none");
    genericContainer.css("height", "100%");

    let colorSpaceDropDown = colorSpaceDropDownWidget(1, loadPreviewFrameFunction, context.index, currentSettings.filter.colorspace);

    // This lets the form look a little nicer by expanding the colorspace dropdown and its options to full width
    let triggerButton = colorSpaceDropDown.find("#colorspace-1-trigger");
    triggerButton.parent().css("width", "100%").parent().css("width", "100%");
    triggerButton.css("width", "100%");

    let optionMenu = colorSpaceDropDown.find("#colorspace-1-dropdown");
    optionMenu.addClass("has-text-centered");
    optionMenu.css("width", "100%");

    let parseSettings = (context) => {
        function validatePositiveFloatValue(stringValue, nonzero = false) {
            let parsedFloat = parseFloat(stringValue);
            if (!isNaN(parsedFloat) && !(parsedFloat === 0 && nonzero)) {
                return {"valid": true, value: parsedFloat};
            } else {
                return {"valid": false, value: null};
            }
        }

        // Returns if settings are valid and if not which ones are invalid
        let parsed = {};
        parsed["offset"] = validatePositiveFloatValue(context.offset);
        parsed["frameRate"] = validatePositiveFloatValue(context.frameRate, true);
        parsed["pointSize"] = validatePositiveFloatValue(context.pointSize);
        return parsed;
    };


    let frameRateInput = genericDivWidget("column is-narrow", "framerate-column").append(
        tooltipLabelWidget("Global Framerate", LABEL_STYLES.LIGHT,
            "Argus-web doesn't support multiple " +
            "framerates across videos, this value should be the framerate of all of the videos selected",
            "right"),
        frameRateDropDownWidget(currentSettings["frameRate"].toString())
    );

    // This is due to the fact that we only support global frame rates and thus we won't have frame rate input for
    // later videos
    if (context.index !== 0) {
        frameRateInput = null;
    }

    let updateVideoPropertiesGeneric = (inputID) => {
        let value = $(`#${inputID}`).val();
        switch (inputID) {
            case "preview-brightness": {
                previewBrightness = `brightness(${value}%)`;
                break;
            }
            case 'preview-contrast': {
                previewContrast = `contrast(${value}%)`;
                break;
            }
            case 'preview-saturation': {
                previewSaturation = `saturate(${value}%)`;
                break;
            }
        }
        loadPreviewFrameFunction();
    };

    let appendError = (id, errorText) => {
        // Don't show error more than once
        if ($(`#${id}-error`).get(0) !== undefined) {
            return;
        } else {
            $(`#${id}`).append(
                $("<p>", {id: `${id}-error`, class: "has-text-error"}).text(
                    errorText
                )
            );
        }
    };

    let removeError = (id) => {
        $(`#${id}-error`).remove();
    };

    let validateFormAndSubmit = (previous = false) => {
        let parsed = parseSettings({
            "frameRate": previewFRAMERATE,
            "offset": $("#offset-input").val(),
            "pointSize": $("#preview-point-size-input").val()
        });

        // Parsing
        let valid = true;
        if (context.index === 0) {
            if (!parsed["frameRate"]["valid"]) {
                valid = false;
                let frameRateErrorText = "Framerate must be a valid number!";
                appendError("framerate-column", frameRateErrorText);
            } else {
                removeError("framerate-column");
            }
        }
        if (!parsed['offset']['valid']) {
            valid = false;
            let offsetErrorText = "Offset must be a valid number!";
            appendError("offset-controller", offsetErrorText);
        } else {
            removeError("offset-controller");
        }

        if (valid) {
            parsed.filter = {
                "colorspace": previewCOLORSPACE,
                "brightnessFilter": previewBrightness,
                "contrastFilter": previewContrast,
                "saturationFilter": previewSaturation,
            };
            parsed.index = context.index;
            parsed.offset = parsed.offset.value;
            parsed.frameRate = parsed.frameRate.value;
            parsed.videoName = videoTitle;
            parsed.pointSize = previewPOINT_SIZE;
            saveCallback(parsed, previous);
        }
    }

    // Assign buttons if the context permits, otherwise, null.
    let previousButton = context.previousButton ?
        $("<button>", {class: "button", id: "preview-init-settings-button"}).text("Previous")
            .on("click", () => validateFormAndSubmit(true))
            .text(`${context.previousButtonText}`) :
        null;
    let nextButton = context.nextButton ?
        $("<button>", {class: "button", id: 'save-init-settings-button'})
            .on("click", function () {
                validateFormAndSubmit();
            })
            .text(`${context.nextButtonText}`) :
        null;

    let offsetField = genericDivWidget("controller", "offset-controller").append(
        $("<input>", {
            class: "input",
            id: "offset-input",
            placeholder: "In Frames",
            value: currentSettings["offset"] === -1 ? "" : currentSettings["offset"]
        }));
    if (currentSettings["offset"] !== -1) {
        offsetField.val(currentSettings["offset"]);
    }

    let parsedFilter = {};
    try {
        let brightnessBar = currentSettings.filter.brightnessFilter.split("(")[1];
        parsedFilter.brightnessBar = brightnessBar.substring(0, brightnessBar.length - 2);
    } catch (err) {
        parsedFilter.brightnessBar = "";
    }

    try {
        let saturateBar = currentSettings.filter.saturationFilter.split("(")[1];
        parsedFilter.saturateBar = saturateBar.substring(0, saturateBar.length - 2);
    } catch (err) {
        parsedFilter.saturateBar = "";
    }

    try {
        let contrastBar = currentSettings.filter.contrastFilter.split("(")[1];
        parsedFilter.contrastBar = contrastBar.substring(0, contrastBar.length - 2);
    } catch (err) {
        parsedFilter.contrastBar = "";
    }

    // The margin: 0 lets animation smoothly transition from one modal-state to the next ( if there are multiple ).
    return genericDivWidget("columns is-centered is-multiline is-mobile").css("margin", "0").append(
        genericDivWidget("column is-12 has-text-centered").append(
            $("<h1>", {class: "has-julius has-text-white title"}).text(`Video Properties for ${videoTitle}`)
        ),

        genericDivWidget("column").append(
            genericDivWidget("columns is-multiline is-mobile").append(
                genericDivWidget("column").append(
                    genericDivWidget("columns is-multiline is-mobile").append(
                        genericDivWidget("column").append(
                            genericDivWidget("field", "offset-field").append(
                                tooltipLabelWidget("Offset", LABEL_STYLES.LIGHT,
                                    "Your videos may start at different places, " +
                                    " the difference in starting points is the offset (in frames).",
                                    "right"),
                                offsetField
                            ),
                        ),
                        frameRateInput
                    )
                ),


                genericDivWidget("column").append(
                    genericDivWidget("columns is-multiline is-vcentered is-mobile").append(
                        genericDivWidget("column").append(
                            tooltipLabelWidget("Colorspace", LABEL_STYLES.LIGHT,
                                "Your videos may be easier to see by swaping colorspace",
                                "left"),
                            colorSpaceDropDown,
                        ),
                        genericDivWidget("column").append(
                            genericDivWidget("columns is-mobile").append(
                                genericDivWidget("column").append(
                                    tooltipLabelWidget("Point Size", LABEL_STYLES.LIGHT,
                                        "This controls the radius of your points, the larger it is, the easier it" +
                                        " will be to see. However, this will cause overlap with other points",
                                        "left"),

                                    $("<input>", {
                                        class: "input",
                                        type: "text",
                                        id: "preview-point-size-input",
                                        placeholder: "Set size",
                                        value: currentSettings.pointSize
                                    }).on("keyup", function () {
                                            previewPOINT_SIZE = parseFloat($("#preview-point-size-input").val());
                                            loadPreviewFrameFunction();
                                        }
                                    )
                                ),
                            )
                        ),
                    )),

                genericDivWidget("column").append(
                    genericDivWidget("columns is-multiline is-mobile").append(
                        genericDivWidget("column").append(
                            genericDivWidget("columns is-mobile").append(
                                genericDivWidget("column").append(
                                    $("<label>", {class: "label has-text-white"}).text("Preview:"),
                                    $("<canvas>", {
                                        // style: "height: 100%; width: 100%;",
                                        id: "current-settings-preview-canvas"
                                    }).attr("height", 300).attr("width", 300)
                                ),
                                genericDivWidget("column").append(
                                    genericDivWidget("columns is-multiline is-mobile").append(
                                        videoPropertySlidersWidget(
                                            "preview-brightness",
                                            "preview-contrast",
                                            "preview-saturation",
                                            updateVideoPropertiesGeneric,
                                            LABEL_STYLES.LIGHT,
                                            {
                                                brightness: parsedFilter.brightnessBar,
                                                contrast: parsedFilter.contrastBar,
                                                saturateBar: parsedFilter.saturateBar
                                            }
                                        )
                                    ),
                                ),
                            )
                        ),
                        genericDivWidget("column").append(
                            genericDivWidget("columns is-mobile").append(
                                genericDivWidget("column").append(
                                    previousButton,
                                ),
                                genericDivWidget("column").append(
                                    nextButton,
                                )),
                        )
                    ),
                ),
            )
        )
    );
}


function genericDivWidget(classType, id = "") {
    /*
    Returns a div with the specified classes and id

    classType: string, can contain one or multiple classes separated by spaces
    id: string, the desired id
     */
    if (id !== "") {
        return $(`<div>`, {class: classType, id: id});
    } else {
        return $(`<div>`, {class: classType});
    }

}

function fileInputWidget(labelText, inputID, acceptableFiles, onChangeCallback, multiFile = false, extraLabelClasses = '') {
    /*
    Creates a generic input menu for files of any type

    labelText: string, used for the label to help the user understand what they are selecting
    inputID: integer/string, used to allow multiple file inputs on the same page without having the same id
    acceptableFiles: string, a valid html attribute of accept [https://www.w3schools.com/tags/att_input_accept.asp]

    onChangeCallback: Called whenever a user chooses a new file
    onChangeCallback(event: Jquery event ) { Returns nothing and handles saving/parsing file selection }

    extraLabelClasses: string, a spot for extra classes besides the default to be provided
     */
    return genericDivWidget("centered-file-input file").append(
        $("<label>", {class: "file-label"}).append(
            $("<input>", {
                id: inputID,
                class: "file-input",
                accept: acceptableFiles,
                type: 'file'
            },).on("change", onChangeCallback).attr("multiple", multiFile),
            $("<span>", {class: "file-cta"}).append(
                $("<span>", {class: `file-label ${extraLabelClasses}`}).text(labelText)
            )
        )
    );
}

function genericTextInputWithTooltipWidget(labelText, labelStyle, tooltipText, inputID, onInput, tabIndex = 0) {
    return genericDivWidget('field').append(
        genericDivWidget('level is-fake-label').append(
            genericDivWidget('level-left').append(
                $("<label>", {class: `label ${labelStyle}`}).text(labelText)
            ),
            genericDivWidget('level-right').append(
                tooltipBuilder(
                    tooltipText,
                    false,
                    labelStyle,
                    'left')
            )
        ),
        genericDivWidget('control').append(
            $('<input>', {class: 'input', id: inputID, 'tabindex': tabIndex}).on('input', onInput)
        )
    );
}


function createProjectWidget(onSubmit, cleanFunction) {
    /*
    Creates a form that contains all the inputs needed to create a project and binds their listeners

    TODO: notice that everytime get inputs is called, it is then calling or called by another function that uses
    get inputs, therefore, it needs reorganization. I don't like just returning the inputs with other information
    such as valid or not since that isn't a very nice way of doing things.

    onSubmit: Called whenever the "submit" button is clicked
    onSubmit (  ) { Handles passing the data to the server or saving locally }

    cleanFunction: Called when "cancel" is clicked, esc is pressed, or submit is successful
    cleanFunction() { Handles removing the form and cleaning up the page }
     */
    let removedFiles = new Set();

    let getInputs = () => {
        return {
            fileInput: $("#video-file-input"),
            descriptionInput: $("#description-Input"),
            titleInput: $("#project-name-input"),
            createButton: $("#submit-button"),
        }
    };

    let validate = () => {
        let inputs = getInputs();
        if (inputs.titleInput.val().length !== 0 || inputs.descriptionInput.val().length !== 0) {
            let selectedFiles = Array.from(inputs.fileInput.prop("files"));
            if (selectedFiles.length !== 0) {
                return true;
            }
        } else {
            return false;
        }
    };

    let parseFiles = (inputs) => {
        let files = Array.from(inputs.fileInput.prop("files"));
        removedFiles.forEach((removedIndex) => {
            files[removedIndex] = null;
        });
        files = files.filter((value) => value != null);
        return files;
    };

    let updateIfValid = () => {
        let valid = validate();
        let inputs = getInputs();
        if (valid) {
            inputs.createButton.off();
            inputs.createButton.removeClass("disabled");
            // Stored in the template file to have relative url
            inputs.createButton.on("click", function () {
                let parsedInputs = {
                    title: inputs.titleInput.val(),
                    description: inputs.descriptionInput.val(),
                    selectedFiles: parseFiles(inputs)
                };
                onSubmit(parsedInputs);
            });
        } else {
            inputs.createButton.off();
            inputs.createButton.addClass("disabled");
        }
    };

    let displaySelectedVideoTitles = () => {
        removedFiles = new Set();
        let inputs = getInputs();

        let selectedFilesContainer = $("#files-selected-container");
        selectedFilesContainer.empty();

        let selectedFiles = Array.from(inputs.fileInput.prop("files"));
        for (let i = 0; i < selectedFiles.length; i++) {
            let name = selectedFiles[i].name.toString();
            if (name.length > 20) {
                name = name.slice(0, 20);
                name += "...";
            }

            selectedFilesContainer.append(`
                <div id="selectedFile-${i}-container" class="column is-12">
                    <div class="level">
                        <div class="level-left">
                            <p class="has-text-white">${name}</p>
                        </div>
                        <div class="level-right">
                            <button id="deleteSelectedFile-${i}" class="delete delete-selected-file"></button>
                        </div>
                    </div>
                </div>
            `);
            selectedFilesContainer.find(`#deleteSelectedFile-${i}`).on("click", function (e) {
                $(`#selectedFile-${e.target.id.split('-')[1]}-container`).remove();
                removedFiles.add(i);
                if (removedFiles.size === selectedFiles.length) {
                    inputs.fileInput.val('');
                }
            })
        }

        updateIfValid();
    };


    let videoFileInput = fileInputWidget(
        'Select Videos',
        'video-file-input',
        'video/*',
        displaySelectedVideoTitles,
        true,
        'has-background-dark has-text-white is-size-5');

    videoFileInput.addClass('is-medium');
    $(videoFileInput.find('.file-cta')[0]).addClass('has-background-dark').css("border", "none");

    return genericDivWidget("columns is-centered is-multiline").append(
        genericDivWidget('column').append(
            $("<form>", {id: "create-project-form", class: "form"}).attr('onsubmit', 'return false;').append(
                genericDivWidget('columns is-centered is-vcentered is-multiline').append(
                    genericDivWidget('column is-12').append(
                        genericTextInputWithTooltipWidget(
                            'Project Name',
                            LABEL_STYLES.LIGHT,
                            'Give a name to your project!',
                            'project-name-input',
                            updateIfValid,
                            1
                        )
                    ),

                    genericDivWidget('column is-12').append(
                        genericTextInputWithTooltipWidget(
                            'Project Description',
                            LABEL_STYLES.LIGHT,
                            '(Optional) Describe your project!',
                            'description-input',
                            null,
                            0
                        )
                    ),

                    genericDivWidget('column is-12').append(
                        genericDivWidget('level').append(
                            genericDivWidget('level-left').append(
                                genericDivWidget('field').append(
                                    videoFileInput,
                                ),
                                // This is a placeholder so that text can display what files were just selected
                                genericDivWidget('columns is-multiline', 'files-selected-container')
                            ),

                            genericDivWidget('level-right').append(
                                genericDivWidget('columns').append(
                                    genericDivWidget('column is-narrow is-pulled-right').append(
                                        $("<button>", {
                                            id: 'cancel-button',
                                            class: 'button has-background-dark has-text-white is-size-5 fade-on-hover',
                                            style: 'border: none;'
                                        }).text("Cancel").on('click', cleanFunction)
                                    ),
                                    genericDivWidget('column is-narrow is-pulled-right').append(
                                        $("<button>", {
                                            id: 'submit-button',
                                            class: 'button disabled has-background-dark has-text-white is-size-5 fade-on-hover',
                                            style: 'border: none;'
                                        }).text("Submit")
                                    ),
                                )
                            )
                        )
                    )
                )
            )
        )
    );
}


function firstRowOfSettingsWidget(settingsBindings) {
    /* Documentation updated March 4th 10:52 AM
     * Creates the first row of settings. This row will include:
     * Loading DLT coefficents
     * Loading Camera Profiles
     * Add tracks
     * track dropdown to select and delete tracks
     * colorspace dropdown to select colorspace globally TODO: This needs to be switched to per-video basis
     * Save points
     * Load points
     *
     * settingsBindings: A object containing functions that map to updating settings
     *  REQUIRED:
     *  onDLTCoeffChange (event) { Loads the DLT coefficients into the DLT_COEFF global variable }
     *  onCameraProfileChange (event) { Loads the camera profile into the global CAMERA_PROFILE variable }
     *  savePoints (event) { Generates a .csv file with options specified by the user }
     *  onLoadPointsChange (event) { Loads points into the Clicked Points manager }
     *  inverseSetting (setting) { settings[setting] = !settings[setting] }
     *  TODO: these last three pieces of documentation could stand to be cleaned up
     *  onTrackClick (event) { handles what happens when the user is changing to a new track }
     *  onTrackDelete (event) { handles what happens when the user is deleteing a track }
     *  onTrackDisplay (event) { handles what happens when the user whants to display at track }
     *  onAddTrack (event) { handles what happens when the user adds a new track }
     */
    let widget = genericDivWidget("columns");
    widget.append(
        // Stacked DLT and Camera Profile Settings
        genericDivWidget("column").append(
            genericDivWidget("columns is-centered is-vcentered is-multiline").append(
                // DLT Coeff Input
                genericDivWidget("column is-12").append(
                    fileInputWidget("Load DLT Coefficients", "dlt-coeff-input", "text/csv", settingsBindings.onDLTCoeffChange)
                ),

                // Camera Profile Input
                genericDivWidget("column is-12").append(
                    fileInputWidget("Load Camera Profile", "camera-profile-input", "*.txt", settingsBindings.onCameraProfileChange)
                )
            ),
        ),

        // Add new track
        genericDivWidget("column").append(
        ),

        // Track Drop Down
        genericDivWidget("column", "track-dropdown-container-column").append(
            trackDropDownWidget(
                settingsBindings.onTrackClick,
                settingsBindings.onTrackDisplay,
                settingsBindings.onTrackDelete
            )
        ),


        // Save & load points
        genericDivWidget("column").append(
            genericDivWidget("columns is-multiline is-vcentered is-centered").append(
                genericDivWidget("column is-12").append(
                    genericDivWidget("column has-text-centered").append(
                        $("<button>", {
                            id: "save-points-button",
                            class: "button"
                        }).text("Save Points").on("click", settingsBindings.savePoints),
                    )
                ),

                genericDivWidget("column is-12").append(
                    fileInputWidget("Load Points", "load-points-button", "text/csv", settingsBindings.onLoadPointsChange)
                ),
            )
        ),
    );
    return widget;
}


function pointSizeSelectorWidget(index) {
    /*
    Creates a widget that allows a user to set the size of points being clicked.
    TODO: Currently only works at a global scale while the project initialization menus imply it works at a local scale

    index: string or integer that uniquly identifies the pointSizeSelectorWidget
    used to allow this to create multiple widgets of this type on the same page
    */

    let drawPreview = () => {
        let pointPreviewCanvas = document.getElementById(`point-preview-canvas-${index}`);
        let ctx = pointPreviewCanvas.getContext("2d");

        let testRadius = $(`#point-size-input-${index}`).val();
        ctx.clearRect(0, 0, 100, 100);
        ctx.beginPath();
        ctx.arc(50, 50, testRadius, 0, Math.PI);
        ctx.arc(50, 50, testRadius, Math.PI, 2 * Math.PI);
        ctx.stroke();
    };

    let updatePointRaidus = () => {
        VIDEO_TO_POINT_SIZE[null] = $("#point-size-input").val() * videos[0].canvas.width / 800;
    };


    let widget = genericDivWidget("columns is-vcentered is-centered");
    widget.append(
        genericDivWidget("column is-narrow").append(
            genericDivWidget("field").append(
                $("<label>", {class: "label"}).text("Point Marker Size"),
                genericDivWidget("control").append(
                    $("<input>", {
                        id: `point-size-input-${index}`,
                        class: "input small-input"
                    }).on("keyup", drawPreview),
                    $("<input>", {
                        id: `set-point-size-button-${index}`,
                        type: "button",
                        class: "button",
                        value: "SET"
                    }).on(
                        "click", updatePointRaidus
                    )
                )
            )
        ),
        genericDivWidget("column").append(
            $("<label>", {class: "label"}).text("Preview"),
            $("<canvas>", {
                id: `point-preview-canvas-${index}`,
                style: "height: 100px; width: 100px;"
            }).attr("height", 100).attr("width", 100)
        )
    );
    return widget;
}


function settingsInputWidget(settingsBindings) {
    // TODO: Settings needs a beautification
    return $("<section>", {class: "section"}).append(
        $("<hr>"),
        genericDivWidget("columns is-multiline is-vcentered").append(
            genericDivWidget("column is-12 has-text-centered").append(
                $("<h1>", {class: "title"}).text("SETTINGS")
            ),

            genericDivWidget("column is-12").append(
                firstRowOfSettingsWidget(settingsBindings)
            ),

            genericDivWidget("column is-12").append(
                genericDivWidget("columns is-centered is-vcentered").append(
                    genericDivWidget("column has-text-centered").append(
                        $("<p id='auto-save-placeholder'>Last Saved: Never!</p>")
                    ),
                )
            )
        ),
        $("<hr>"),
    );
}

function trackPaginationWidget(currentTrack, selectedTracks, allTracks, updateEvent, bindings) {
    let mod = (track, display) => {
        track.display = display;
        return track;
    }
    let tracksDisplay = [currentTrack];
    tracksDisplay.push(...selectedTracks);
    tracksDisplay = tracksDisplay.map((track) => mod(track, true));
    if (tracksDisplay.length < 5) {
        let tracksToPush = 5 - tracksDisplay.length;
        let setOfTracks = new Set();
        // Make sure not to list a selected track twice
        selectedTracks.map((track) => track.absoluteIndex).forEach(setOfTracks.add, setOfTracks)
        let localTracks = allTracks.filter((track) => !setOfTracks.has(track.absoluteIndex));
        localTracks = localTracks.map((track) => mod(track, false));
        tracksDisplay.push(...localTracks.splice(0, tracksToPush));
    }
    let tracks = genericDivWidget("columns is-multiline");
    for (let i = 0; i < tracksDisplay.length; i++) {
        let trackName = tracksDisplay[i].name;
        if (trackName.length > 9) {
            trackName = `${trackName.substring(0, 9)}...`;
        }

        let displayingIcon = tracksDisplay[i].display ? $("<i>", {
            class: "fas fa-eye-slash icon",
            id: `trackdisp-${tracksDisplay[i].absoluteIndex}-icon`
        }) : $("<i>", {
            class: "fas fa-eye icon",
            id: `trackdisp-${tracksDisplay[i].absoluteIndex}-icon`
        });
        let disabledClass = ""
        if (i === 0) {
            disabledClass = "disabled";  // This is for the track currently being edited
        }
        let deleteDisabled = "";
        if (tracksDisplay[i].absoluteIndex === 0) {
            deleteDisabled = "disabled";
        }
        let currentTrack = genericDivWidget("column is-12").append(
            genericDivWidget("columns is-multiline").append(
                genericDivWidget("column").append(
                    $(`<p>${trackName}</p>`)
                ),
                genericDivWidget("column").append(
                    $("<button>", {
                        class: `button ${disabledClass}`,
                        id: `track-${tracksDisplay[i].absoluteIndex}`
                    }).append(
                        $("<i>", {
                            class: "fas fa-edit icon",
                            id: `track-${tracksDisplay[i].absoluteIndex}-icon`
                        })
                    ).on("click", (event) => updateEvent(bindings.onTrackClick, event)))
                ,
                genericDivWidget("column").append(
                    $("<button>", {
                        class: `button ${disabledClass}`,
                        id: `trackdisp-${tracksDisplay[i].absoluteIndex}`
                    }).append(
                        displayingIcon
                    ).on("click", (event) => updateEvent(bindings.onTrackDisplay, event))
                ),
                genericDivWidget("column").append(
                    $("<button>", {
                        class: `button ${deleteDisabled}`,
                        id: `trackdelete-${tracksDisplay[i].absoluteIndex}`
                    }).append(
                        $("<i>", {
                            class: `fas fa-trash-alt icon`,
                            id: `trackdelete-${tracksDisplay[i].absoluteIndex}-icon`
                        })
                    ).on("click", (event) => updateEvent(bindings.onTrackDelete, event))
                )
            ));
        if (i === 0) {
            currentTrack.append($("<hr>"));
        }
        tracks.append(currentTrack);
    }
    return tracks;
}

function trackManagementWidgets(bindings) {
    let updateEvent = (updateCallback, event) => {
        event.stopPropagation();
        updateCallback(event);
        let currentTrack = bindings.getCurrentTrack();
        let allTracks = bindings.getSelectableTracks();
        let selectedTracks = bindings.getSelectedTracks();
        let newPaginationWidget = trackPaginationWidget(currentTrack, selectedTracks, allTracks, updateEvent, bindings);
        paginationWidget.replaceWith(newPaginationWidget);
        paginationWidget = newPaginationWidget;
    }

    let paginationWidget = trackPaginationWidget(bindings.getCurrentTrack(),
        bindings.getSelectedTracks(),
        bindings.getSelectableTracks(),
        updateEvent,
        bindings);


    return [genericDivWidget("column is-three-fifths has-text-centered", "track-input").append(
        genericDivWidget("box").append(
            genericDivWidget("field").append(
                $("<label>", {class: "label"}).text("Add New Track: "),
                genericDivWidget("control has-text-centered").append(
                    genericDivWidget("columns is-gapless").append(
                        genericDivWidget("column").append(
                            $("<input>", {id: "new-track-input", type: "text", class: "input"}),
                        ),
                        genericDivWidget("column").append(
                            $("<button>", {class: "button"}).append($("<i>", {
                                id: "add-track-button",
                                type: "button",
                                class: "fas fa-plus",
                            })).on("click", (event) => updateEvent(bindings.onTrackAdd, event))
                        )
                    )
                )
            )
        )
    ),
        genericDivWidget("column is-three-fifths", "currently-viewing-tracks").append(
            genericDivWidget("box").append(
                paginationWidget
            )
        )];
}

function frameMovementSettingsWidget(bindings) {
    let auto = bindings.get("auto-advance") ? "checked" : "";
    let sync = bindings.get("sync") ? "checked" : "";
    return genericDivWidget("column  is-three-fifths").append(
        genericDivWidget("box").append(
            // Auto Advance Checkbox
            $("<label>", {class: "label"}).text("Auto Advance:"),
            $("<input>", {
                id: "auto-advance-setting",
                type: "checkbox",
                class: "checkbox",
            }).on("click", function () {
                bindings.inverseSetting('auto-advance');
            }).prop("checked", auto),

            // Sync Check box
            $("<label>", {class: "label"}).text("Snyc:"),
            $("<input>", {
                id: "sync-setting",
                type: "checkbox",
                class: "checkbox",
            }).on("click", function () {
                bindings.inverseSetting('sync');
            }).prop("checked", sync),
        )
    );
}

function changeForwardBackwardOffsetWidget(bindings) {
    return genericDivWidget("column is-three-fifths").append(
        genericDivWidget("box").append(
            genericDivWidget("columns is-multiline").append(
                genericDivWidget("column").append(
                    $("<label>", {class: 'label'}).text("Forward Movement (f): ")
                ),
                genericDivWidget("column").append(
                    $("<input>", {
                        class: "input",
                        id: "forward-frame-input"
                    }).val(bindings["get"]("forwardMove")).on("change", (event) => bindings["onChange"](event))
                ),


                genericDivWidget("column").append(
                    $("<label>", {class: 'label'}).text("Backwards Movement (f): ")
                ),
                genericDivWidget("column").append(
                    $("<input>", {
                        class: "input",
                        id: "backward-frame-input"
                    }).val(bindings["get"]("backwardsMove")).on("change", (event) => bindings["onChange"](event))
                )
            )
        )
    );
}

function saveProjectWidget(saveCallback) {
    return genericDivWidget("column has-text-centered is-three-fifths").append(
        genericDivWidget("box").append(
            genericDivWidget("columns is-multiline").append(
                genericDivWidget("column").append(
                    $("<button>", {
                        class: "button",
                    }).append(
                        $("<i>", {class: "fas fa-save"})
                    ).on("click", saveCallback)
                ),
                genericDivWidget("column").append(
                    $("<p>", {id: "auto-save-placeholder"}).text("Last Saved: Never!")
                )
            )
        )
    );
}

function savedStateWidget(savedState, loadProjectCallback) {
    savedState.data.projectID = savedState.projectID;
    let dateObj = new Date(savedState.data.dateSaved);
    console.log(dateObj);
    let am = "AM";
    if (dateObj.getHours() >= 12) {
        am = "PM";
    }

    let hour = dateObj.getHours();
    if (am === "PM") {
        hour = hour - 12;
    }
    let minutes = dateObj.getMinutes();
    if (minutes.toString().length === 1) {
        minutes = `0${minutes}`;
    }
    let seconds = dateObj.getSeconds();
    if (seconds.toString().length === 1) {
        seconds = `0${seconds}`;
    }

    let autosaved = savedState.autosave ? "Autosaved" : "Manual Save"
    return genericDivWidget("column is-12").append(
        genericDivWidget("box").append(
            genericDivWidget("columns").append(
                genericDivWidget("column").append(
                    genericDivWidget("columns is-multiline").append(
                        genericDivWidget("column is-12").append(
                            $("<p>",).text(`${dateObj.getMonth()}/${dateObj.getUTCDate()}/${dateObj.getFullYear()}`)
                        ),
                        genericDivWidget("column is-12").append(
                            $("<p>").text(`${autosaved}`)
                        ),
                        genericDivWidget("column is-12").append(
                            $("<p>",).text(`${hour}:${minutes}:${seconds} ${am}`)
                        )
                    )
                ),
                genericDivWidget("column is-narrow").append(
                    $("<button>", {class: "button"}).append(
                        $("<i>", {class: "fas fa-save"})
                    ).on("click", (event) => {
                        console.log("Got clicked but uh");
                        loadProjectCallback(savedState.data)
                    })
                )
            )
        )
    )
}

function generateSavedStateWidgetsAndSort(projectObject, loadProjectCallback) {
    return projectObject.savedStates.map((state) => {
        return {
            "data": JSON.parse(state.saveData),
            "autosave": state.autosave,
            "projectID": projectObject.projectID
        }
    }).sort((statex, statey) => {
        let datex = new Date(statex.data.dateSaved);
        let datey = new Date(statey.data.dateSaved);
        if (statex.autosave) {
            return -1;
        } else {
            if (datex > datey) {
                return -1;
            } else {
                return 1;
            }
        }
    }).map((state) => savedStateWidget(state, loadProjectCallback));
}

function savedProjectWidget(projectObject, loadProjectCallback) {
    let projectStateWidgets = generateSavedStateWidgetsAndSort(projectObject, loadProjectCallback);
    let state = false;

    let projectClickCallback = (event) => {
        event.stopPropagation();
        let projectStates = genericDivWidget("column is-12").append(
            genericDivWidget("columns is-multiline is-centered is-vcentered no-display", `projectstates-${projectObject.projectID}`).append(
                projectStateWidgets,
            ));

        let id = event.target.id.split("-")[1];
        let icon = $("#" + "projecticon-" + id);
        let projectStatesDisplayColumn = projectStates.find(`#projectstates-${id}`);
        let cardContent = $("#" + "cardContent-" + id);
        if (!state) {
            if (projectObject.savedStates.length !== 0) {
                projectStatesDisplayColumn.removeClass("no-display");
                projectStatesDisplayColumn.hide();
                cardContent.addClass("card-content").append(
                    genericDivWidget("content").append(projectStates)
                ); // TODO: animate? "slide", {"direction": "down"}, 750)
                let initHeight = $(`#card-${id}`).css("height");
                projectStatesDisplayColumn.show();
                autoHeightAnimate($(`#card-${id}`), 200, () => {
                }, initHeight);

            }
            state = true;
            icon.removeClass("fa-arrow-down").addClass("fa-arrow-up");
        } else {
            icon.removeClass("fa-arrow-up").addClass("fa-arrow-down");
            $("#" + "projectstates-" + id).addClass("no-display");
            cardContent.removeClass("card-content").empty();
            let initHeight = $(`#card-${id}`).css("height");

            autoHeightAnimate($(`#card-${id}`), 200, () => {
            }, initHeight);
            state = false;
        }
    }


    let deleteProjectCallback = (event) => {
        // event.stopPropagation();
        let id = event.target.id.split("-")[1];
        deleteSavedState(id); // TODO : basically this is correct except we want to delete projects not saved states
    }

    return genericDivWidget("column",).append(
        genericDivWidget("card not-clickable", `card-${projectObject.projectID}`).append(
            $("<header>", {class: "card-header"}).append(
                $("<p>", {
                    class: "card-header-title",
                    id: `projectName-${projectObject.projectID}`
                }).text(projectObject.projectName),

                $("<a>", {class: "card-header-icon no-decoration"}).append(
                    $("<span>", {
                        id: `projectButton-${projectObject.projectID}`,
                        class: "icon"
                    }).append(
                        $("<i>", {class: "fas fa-trash-alt", id: `projecticonDelete-${projectObject.projectID}`})
                    ).on("click", deleteProjectCallback),
                )
            ),
            genericDivWidget("", `cardContent-${projectObject.projectID}`).append(
            ),
            $("<footer>", {
                class: "card-footer",
                id: `cardFooter-${projectObject.projectID}`
            }).append($("<a>", {
                class: "card-footer-item has-text-centered no-decoration",
                id: `test-${projectObject.projectID}`
            }).append(
                $("<span>", {
                    class: "icon",
                    id: `projectbutton-${projectObject.projectID}`
                }).append(
                    $("<i>", {class: "fas fa-arrow-down", id: `projecticon-${projectObject.projectID}`})
                )
            ).on("click", projectClickCallback))
        )
    );
}

function paginatedProjectsWidget(projects, paginateProjects, loadProjectCallback, paginationIndex) {
    let projectInfos = projects.projects;
    let endOfPagination = projects.endOfPagination;
    let localColumns = genericDivWidget("columns is-multiline is-mobile is-centered is-vcentered", "saved-state-columns");

    let animationTime = 250;

    let paginateForward = async () => {
        let masterContainer = $("#saved-states-section");
        let nextProjects = await paginateProjects(paginationIndex + 5);
        masterContainer.hide("slide", {direction: "left"}, animationTime, () => {
            masterContainer.empty();
            masterContainer.append(paginatedProjectsWidget(nextProjects, paginateProjects,
                loadProjectCallback, paginationIndex + 5));
            masterContainer.show("slide", {direction: "right"}, animationTime);
        });
    };
    let paginateBackward = async () => {
        let masterContainer = $("#saved-states-section");
        let nextProjects = await paginateProjects(paginationIndex - 5);
        masterContainer.hide("slide", {direction: "right"}, animationTime, () => {
            masterContainer.empty();
            masterContainer.append(paginatedProjectsWidget(nextProjects, paginateProjects,
                loadProjectCallback, paginationIndex - 5));
            masterContainer.show("slide", {direction: "left"}, animationTime);
        });
    };

    let displaySearchedProjects = (projects) => {
        let localProjectCards = [];
        for (let i = 0; i < projects.length; i++) {
            let cur_project = projects[i];
            localProjectCards.push(
                savedProjectWidget(cur_project, loadProjectCallback)
            );
        }
        let searchBar = genericDivWidget("column is-12").append(
            genericDivWidget("field").append(
                $("<p>", {class: "control has-icons-right"}).append(
                    $("<input>", {
                        class: "input",
                        id: "project-search",
                        placeholder: "Search Projects"
                    }).on("keydown", async (e) => {
                        if (e.keyCode === 13) {
                            let value = $("#project-search").val();
                            if (value != null) {
                                let searchRes = await search(value);
                                displaySearchedProjects(searchRes.projects);
                            }
                        }
                    }),
                    $("<span>", {class: "icon is-small is-right"}).append(
                        $("<i>", {class: "fas fa-search fa-flip-horizontal"})
                    )
                )
            )
        );
        localColumns.empty();
        localColumns.append(searchBar);
        localColumns.append(localProjectCards);
    }

    let searchBar = genericDivWidget("column is-12").append(
        genericDivWidget("field").append(
            $("<p>", {class: "control has-icons-right"}).append(
                $("<input>", {
                    class: "input",
                    id: "project-search",
                    placeholder: "Search Projects"
                }).on("keydown", async (e) => {
                    if (e.keyCode === 13) {
                        let value = $("#project-search").val();
                        if (value != null) {
                            let searchRes = await search(value);
                            console.log(searchRes.projects);
                            displaySearchedProjects(searchRes.projects);
                        }
                    }
                }),
                $("<span>", {class: "icon is-small is-right"}).append(
                    $("<i>", {class: "fas fa-search fa-flip-horizontal"})
                )
            )
        )
    );


    localColumns.append(
        searchBar
    )
    let projectCards = [];
    let nextButton = null;
    let prevButton = null;
    if (!(paginationIndex === 0)) {
        prevButton = genericDivWidget("column is-narrow",).append(
            $("<button>", {id: "pagination-button", class: "rounded-button"}).append(
                $("<i>", {class: "fas fa-arrow-left"})
            ).on("click", () => {
                paginateBackward();
            })
        )
    }
    if (!endOfPagination) {
        nextButton = genericDivWidget("column is-narrow",).append(
            $("<button>", {id: "pagination-button", class: "rounded-button"}).append(
                $("<i>", {class: "fas fa-arrow-right"})
            ).on("click", () => {
                paginateForward();
            })
        )
    }
    for (let i = 0; i < projectInfos.length; i++) {
        let cur_project = projectInfos[i];
        projectCards.push(
            savedProjectWidget(cur_project, loadProjectCallback)
        );
    }
    localColumns.append(prevButton);
    localColumns.append(projectCards);
    localColumns.append(nextButton);
    return localColumns
}

function loadSavedStateWidget(videos, onValidSubmit) {
    let genericContainer = $("#generic-input-modal-content");
    genericContainer.css("width", "100%");
    genericContainer.css("max-height", "none");
    genericContainer.css("height", "100%");
    let onVideoChange = (event) => {
        let id = event.target.id;
        let selectedFiles = Array.from($(event.target).prop("files"));
        if (selectedFiles.length === 0) {
            return;
        }
        videos[id].file = selectedFiles[0];
        let name = selectedFiles[0].name.toString();
        if (name.length > 20) {
            name = name.slice(0, 20);
            name += "...";
        }
        $(`#video-file-${id}`).text(`Current File: ${name}`);
    }

    let cleanUpModel = () => {
        $("#modal-content-container").empty();
        $("#generic-input-modal").off();
        $("#generic-input-modal").removeClass("is-active");
        $("#blurrable").css("filter", "");
        genericContainer.css("width", "");
        genericContainer.css("max-height", "");
        genericContainer.css("height", "");
    };


    let videoWidgets = videos.map((video) => {
        return genericDivWidget("column").append(
            genericDivWidget("box").append(
                genericDivWidget("columns is-multiline").append(
                    genericDivWidget("column is-7").append(
                        $("<h1>").text(`${video.name}`),
                    ),
                    genericDivWidget("column is-6").append(
                        fileInputWidget(`Load File`, `${video.index}`, "video/*", onVideoChange, false),
                    ),
                    genericDivWidget("column").append(
                        $("<p>", {id: `video-file-${video.index}`})
                    )
                )
            )
        )
    });

    return genericDivWidget("columns is-multiline is-centered").append(
        genericDivWidget("column has-text-centered has-text-white subtitle-has-julius is-12").append(
            $("<h1>").text("Please reselect the following files")
        ),
        videoWidgets,
        genericDivWidget("column is-12").append(
            genericDivWidget("level").append(
                genericDivWidget("level-left").append(
                    $("<button>", {class: "button"}).text("Cancel").on("click", (event) => cleanUpModel())
                ),
                genericDivWidget("level-right").append(
                    $("<button>", {class: "button"}).text("Next").on("click", (event) => onValidSubmit(videos))
                )
            )
        )
    );
}

function loadCameraInfoWidget(bindings) {
    // TODO: Make this more inline with how everything else works. Right now it calls a global variable
    return genericDivWidget("column is-three-fifths").append(
        genericDivWidget("box").append(
            genericDivWidget("columns is-multiline").append(
                genericDivWidget("column").append(
                    fileInputWidget("Load DLT Coefficents", "loadDLTCoefficients", "any", (file) => loadDLTCoefficients(Array.from($("#loadDLTCoefficients").prop("files"))))
                )
            )
        ).css("overflow", "hidden") // TODO: This is dumb. I'm not sure how to make the button work though.
    )
}

function loginWidget(onLogin) {
    return genericDivWidget("columns").append(

    )
}