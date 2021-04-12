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


// The following two functions are helpful functions that are used exclusively during setup. This is mostly done so that
// if we ever wanted to change the style of labels and tooltips, we wouldn't have to change 10 anon. functions
// function setupLabelGenerator(labelText) {
//     return $("<label>", {class: `label ${LABEL_STYLES.LIGHT}`}).text(labelText);
// }

function labelLight(labelText) {
    return $("<label>", {class: `label ${LABEL_STYLES.LIGHT}`}).text(labelText);
}

function labelDark(labelText) {
    return $("<label>", {class: `label ${LABEL_STYLES.DARK}`}).text(labelText);
}

function setupTooltipPropertiesGenerator(tooltipText, direction, labelStyle) {
    labelStyle = {labelDark: LABEL_STYLES.DARK, labelLight: LABEL_STYLES.LIGHT}
    return {
        tooltipText: tooltipText,
        multiline: true,
        tooltipStyle: labelStyle,
        direction: direction
    };
}

// End line from comment above.

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

function tooltipDualColumnWidget(prevElement, options) {
    let tooltipText = options.tooltipText;
    let multiline = options.multiline;
    let tooltipStyle = options.tooltipStyle;
    let textDirection = options.direction;
    return genericDivWidget("columns is-gapless is-vcentered is-centered").append(
        genericDivWidget("column is-narrow").append(
            prevElement
        ),
        genericDivWidget("column is-narrow").append(
            tooltipBuilder(tooltipText, multiline, tooltipStyle, textDirection)
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
    let popOutButton = $("<i>", {class: "fa fa-window-restore clickable fade-on-hover fa-2x"}).attr("aria-hidden", "true")
    // popOutButton = $("<button>", {class: "button", id: `popVideo-${videoIndex}`}).append(

    // );
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
     */

    let clickableCanvas = canvas(`canvas-${videoIndex}`, "clickable-canvas absolute", "z-index: 5;");
    clickableCanvas = _canvasWidthAndHeightManager(clickableCanvas, videoWidth, videoHeight);
    clickableCanvas.prop('tabindex', 1000);
    clickableCanvas.on('keydown', onKeyboardInput);

    let epipolarCanvas = canvas(`epipolarCanvas-${videoIndex}`, "epipolar-canvas absolute", "z-index: 2;");
    epipolarCanvas = _canvasWidthAndHeightManager(epipolarCanvas, videoWidth, videoHeight);

    let videoCanvas = canvas(`videoCanvas-${videoIndex}`, "video-canvas absolute", "z-index: 1;");
    videoCanvas = _canvasWidthAndHeightManager(videoCanvas, videoWidth, videoHeight);

    let subTrackCanvas = canvas(`subtrackCanvas-${videoIndex}`, 'sub-track absolute', 'z-index: 3;');
    subTrackCanvas = _canvasWidthAndHeightManager(subTrackCanvas, videoWidth, videoHeight);

    let focusedPointCanvas = canvas(`focusedPointCanvas-${videoIndex}`, 'absolute', 'z-index: 4;');
    focusedPointCanvas = _canvasWidthAndHeightManager(focusedPointCanvas, videoWidth, videoHeight)

    return genericDivWidget("container", `container-for-canvas-${videoIndex}`).append(
        clickableCanvas.on("click", onClick).on("contextmenu", onRightClick).on("mousemove", setMousePos),
        epipolarCanvas,
        videoCanvas,
        subTrackCanvas,
        focusedPointCanvas
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

    let drawingPoints = true;
    let slideCol = $(`#slide-${videoIndex}`);
    let isUp = slideCol.css("display") === "none";
    let arrow = isUp ? "fa-arrow-down" : "fa-arrow-up";
    return genericDivWidget("column is-12", `masterColumn-${videoIndex}`).append(
        genericDivWidget("column is-12 video-label-container").append(
            genericDivWidget("level").append(
                genericDivWidget("level-left").append(
                    genericDivWidget("columns is-vcentered").append(
                        genericDivWidget("column is-narrow").append(
                            $('<p>', {class: "video-label render-unselectable", id: `videoTitle-${videoIndex}`})
                        ),
                        genericDivWidget("column is-narrow").append(
                            $('<p>', {class: "video-label render-unselectable", id: `videoFrame-${videoIndex}`})
                        ),
                        genericDivWidget("column is-narrow").append(
                            $('<p>', {class: "video-label render-unselectable", id: `videoOffset-${videoIndex}`})
                        ),
                    ),
                    // $('<p>', {class: "video-label render-unselectable", id: `videoLabel-${videoIndex}`})
                ),
                genericDivWidget("level-right").append(
                    genericDivWidget("columns is-vcentered").append(
                        genericDivWidget("column", `pop-out-${videoIndex}-placeholder`),
                        genericDivWidget("column").append(
                            // $("<button>", {class: "button", id: `openSettings-${videoIndex}`}).append(
                            $("<i>", {class: "fa fa-cog clickable fa-2x fade-on-hover"}).attr("aria-hidden", "true").on("click", displaySettings)
                            // )
                        ),
                        genericDivWidget("column").append(
                            $("<i>", {class: `fa ${arrow} clickable fa-2x fade-on-hover`, id:`arrow-icon-${videoIndex}`}).attr("aria-hidden", "true").on("click", () => {
                                    let slideCol = $(`#slide-${videoIndex}`);
                                    let isUp = slideCol.css("display") === "none";
                                    let arrow = isUp ? "fa-arrow-down" : "fa-arrow-up";
                                    isUp ? slideCol.slideDown() : slideCol.slideUp();
                                    $(`#arrow-icon-${videoIndex}`).removeClass(arrow);
                                    isUp = !isUp
                                    arrow = isUp ? "fa-arrow-down" : "fa-arrow-up";
                                    $(`#arrow-icon-${videoIndex}`).addClass(arrow)
                                    // TODO: Keep Aspect Ratio on resize
                                }
                            )
                        )
                    )
                )
            )
        ),
        genericDivWidget("column", `slide-${videoIndex}`).append(
            genericDivWidget("columns has-text-centered is-multiline", `canvas-columns-${videoIndex}`).append(
                genericDivWidget("column is-7").append(
                    clickerCanvasWidget(videoIndex, videoWidth, videoHeight, onKeyboardInput, onClick, onRightClick, setMousePos)
                ).css("padding", ".75rem 0 0 0"),
                genericDivWidget("column").append(
                    genericDivWidget("container", `zoom-text-${videoIndex}`).append(
                        genericDivWidget("container", `zoom-canvas-${videoIndex}`).append(
                            canvas(`zoomEpipolarCanvas-${videoIndex}`, "zoom-epipolar-canvas absolute", "z-index: 3;").css("height", "100%").css("width", "100%"),
                            canvas(`zoomFocusedPointCanvas-${videoIndex}`, "absolute zoom-focused-point-canvas", "z-index: 5;").css("height", "100%").css("width", "100%"),
                            canvas(`zoomPointCanvas-${videoIndex}`, "absolute zoom-focused-point-canvas", "z-index: 4;").css("height", "100%").css("width", "100%"),
                            canvas(`zoomCanvas-${videoIndex}`, "zoom-canvas absolute", "z-index: 2;").css("height", "100%").css("width", "100%"),
                        ),
                        genericDivWidget("columns").append(
                            genericDivWidget("column").append(
                                $("<p class='render-unselectable'>X = Zoom Out<br>Z = Zoom In<br></p>")),
                            genericDivWidget("column").append(
                                $("<p>", {
                                    class: "render-unselectable",
                                    id: `drawzoompoints-${videoIndex}`
                                }).text("P = Show Points [Disabled]")
                            ),
                            genericDivWidget("column").append(
                                $("<p>", {
                                    class: "render-unselectable",
                                    id: `epipolar-lock-${videoIndex}`
                                }).text("L = Lock To Epipolar [Disabled]"),
                            )
                        )
                    )
                ).css("padding", ".75rem 0 0 .75rem"),
            ))
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

    return [
        genericDivWidget("column is-12").append(
            tooltipDualColumnWidget(
                labelStyle("Brightness"),
                setupTooltipPropertiesGenerator(brightnessTooltipText, "up")
            ),
            sliderWidget(`${brightnessID}`, "0", "200", initValues.brightness, function () {
                updateVideoProperties(`${brightnessID}`);
            })
        ),
        genericDivWidget("column is-12").append(
            tooltipDualColumnWidget(
                labelStyle("Contrast"),
                setupTooltipPropertiesGenerator(contrastTooltipText, "up")
            ),
            sliderWidget(`${contrastID}`, '0', '100', initValues.contrast, function () {
                updateVideoProperties(`${contrastID}`)
            }),
        ),
        genericDivWidget("column is-12").append(
            tooltipDualColumnWidget(
                labelStyle("Saturation"),
                setupTooltipPropertiesGenerator(saturationTooltipText, "up")
            ),
            sliderWidget(`${saturationID}`, '0', '100', initValues.saturation, function () {
                updateVideoProperties(`${saturationID}`)
            }),
        )]
}

function videoSettingsPopoutWidget(videoTitle, loadPreviewFrameFunction, context, saveCallback, currentSettings) {
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


    let frameRateInput = genericDivWidget("column is-narrow", "framerate-column").append(
        tooltipDualColumnWidget(
            labelLight("Global Framerate"),
            setupTooltipPropertiesGenerator("Argus-web doesn't support multiple " +
                "framerates across videos, this value should be the framerate of all of the videos selected",
                "right")
        ),
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
            $("<h1>", {class: "has-julius has-text-white title"}).text(`Video Properties for ${videoTitle}`),
            genericDivWidget("", `test-video-${context.index}`)
        ),

        genericDivWidget("column").append(
            genericDivWidget("columns is-multiline is-mobile").append(
                genericDivWidget("column").append(
                    genericDivWidget("columns is-multiline is-mobile").append(
                        genericDivWidget("column").append(
                            genericDivWidget("field", "offset-field").append(
                                tooltipDualColumnWidget(
                                    labelLight("Offset"),
                                    setupTooltipPropertiesGenerator(
                                        "Your videos may start at different places, " +
                                        " the difference in starting points is the offset (in frames).",
                                        "right"
                                    )
                                ),
                                offsetField
                            ),
                        ),
                        frameRateInput
                    )
                ),

                genericDivWidget("column").append(
                    genericDivWidget("columns is-multiline is-vcentered is-mobile").append(
                        genericDivWidget("column").append(
                            tooltipDualColumnWidget(
                                labelLight("Colorspace"),
                                setupTooltipPropertiesGenerator("Your videos may be easier to see by swaping colorspace",
                                    "left")
                            ),
                            colorSpaceDropDown,
                        ),
                        genericDivWidget("column").append(
                            genericDivWidget("columns is-mobile").append(
                                genericDivWidget("column").append(
                                    tooltipDualColumnWidget(
                                        labelLight("Point Size"),
                                        setupTooltipPropertiesGenerator(
                                            "This controls the radius of your points, the larger it is, the easier it" +
                                            " will be to see. However, this will cause overlap with other points",
                                            "left")
                                    ),

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
                                            labelLight,
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

function iconButtonWidget(buttonClasses, buttonID, icon, iconID, onPressed) {
    return $("<button>", {
        class: `button ${buttonClasses}`,
        id: buttonID
    }).append(
        $("<i>", {
            class: `fas ${icon} icon`,
            id: iconID
        })
    ).on("click", onPressed);
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


function trackPaginationWidget(currentTrack, selectedTracks, allTracks, updateEvent, bindings, startIndex = 0, updateType = "none") {
    /*
     * currentTrack: track object obtained from the trackManager
     *  - name, absoluteIndex, color, and display are the keys that make up this object
     * selectedTracks: list of tracks that are set to display aside from the current track
     * allTracks: list of all track objects except the currentTrack
     * updateEvent: Updates the pagination widget on any event that requires it (adding/deleting/displaying/etc)
     * bindings: Callback that will be passed to the updateEvent that will update the tracks programmatically (add/delete/etc)
     *  - Required: onTrackClick (change tracks), onTrackDelete, onTrackDisplay, onTrackColorChange
     */
    let mod = (track, display) => {
        track.display = display;
        return track;
    }
    let tracksDisplay = [currentTrack];
    tracksDisplay.push(...selectedTracks);
    tracksDisplay = tracksDisplay.map((track) => mod(track, true));
    let paginateRequired = true;
    let downArrow = true;
    if (tracksDisplay.length < 4) {
        let tracksToPush = 4 - tracksDisplay.length;
        let setOfTracks = new Set();
        // Make sure not to list a selected track twice
        selectedTracks.map((track) => track.absoluteIndex).forEach(setOfTracks.add, setOfTracks)
        let localTracks = allTracks.filter((track) => !setOfTracks.has(track.absoluteIndex));
        localTracks = localTracks.map((track) => mod(track, false));
        if (localTracks.length <= startIndex + (3 - selectedTracks.length)) {
            downArrow = false;
        }
        tracksDisplay.push(...localTracks.splice(startIndex, tracksToPush));
    }
    let tracks = genericDivWidget("columns is-multiline");

    for (let i = 0; i < tracksDisplay.length; i++) {
        let firstTrack = i === 0;
        let trackName = tracksDisplay[i].name;
        if (trackName.length > 9) {
            trackName = `${trackName.substring(0, 9)}...`;
        }

        let displayingIcon = tracksDisplay[i].display ? "fa-eye-slash" : "fas fa-eye icon";

        let disabledClass = ""
        if (firstTrack) {
            disabledClass = "disabled";  // This is for the track currently being edited
        }
        let currentTrack = genericDivWidget("column is-12 has-vertical-borders").append(
            genericDivWidget("columns is-multiline").append(
                genericDivWidget("column is-12").append(
                    $(`<p>${trackName}</p>`)
                ),
                genericDivWidget("column").append(
                    // Edit track icon
                    iconButtonWidget(
                        disabledClass,
                        `track-${tracksDisplay[i].absoluteIndex}`,
                        "fa-edit",
                        `track-${tracksDisplay[i].absoluteIndex}-icon`,
                        (event) => updateEvent(bindings.onTrackClick, event)
                    )
                ),
                genericDivWidget("column").append(
                    // Display track icon
                    iconButtonWidget(
                        disabledClass,
                        `trackdisp-${tracksDisplay[i].absoluteIndex}`,
                        displayingIcon,
                        `trackdisp-${tracksDisplay[i].absoluteIndex}-icon`,
                        (event) => updateEvent(bindings.onTrackDisplay, event)
                    )
                ),
                genericDivWidget("column").append(
                    // Delete track icon
                    iconButtonWidget(
                        "",
                        `trackdelete-${tracksDisplay[i].absoluteIndex}`,
                        "fa-trash-alt",
                        `trackdelete-${tracksDisplay[i].absoluteIndex}-icon`,
                        (event) => updateEvent(bindings.onTrackDelete, event)
                    )
                ),
                genericDivWidget("column").append(
                    // Note that this is not an IconButton as it requires the spectrum call in order
                    // to function properly. Now one could add this as an option in the IconButton function,
                    // however, this is the only time it is used.
                    $("<button>", {
                        class: 'button',
                        id: `trackcolor-${tracksDisplay[i].absoluteIndex}`
                    }).append(
                        $("<i>", {
                            class: `fas fa-eye-dropper icon`,
                            id: `trackcolor-${tracksDisplay[i].absoluteIndex}-icon`
                        })
                    ).spectrum({
                        change: (color) => bindings.onTrackColorChange(tracksDisplay[i].absoluteIndex, color)
                    })
                )
            ),
        );

        if (firstTrack) {
            currentTrack.append($("<hr>"));
        }
        tracks.append(currentTrack);
        if (firstTrack && tracksDisplay.length === 1) {
            tracks.append(
                genericDivWidget("column has-text-centered").append(
                    $("<p>").text("New tracks will go here!")
                )
            );
        }
        if (i === 0 && paginateRequired && startIndex !== 0) {
            tracks.append(
                genericDivWidget("column is-12 has-text-centered").append(
                    iconButtonWidget("", "track-change-up", "fa-arrow-up", "track-change-up-icon", (event) => updateEvent(() => startIndex, event))
                )
            );
        }
    }
    if (paginateRequired && downArrow) {
        tracks.append(
            genericDivWidget("column is-12 has-text-centered").append(
                iconButtonWidget("", "track-change-down", "fa-arrow-down", "track-change-down-icon", (event) => updateEvent(() => startIndex, event))
            )
        );
    }
    return tracks;
}

function trackManagementWidgets(bindings) {
    let startIndex = 0;
    let updateEvent = (updateCallback, event) => {
        event.stopPropagation();
        updateCallback(event);
        let currentTrack = bindings.getCurrentTrack();
        let allTracks = bindings.getSelectableTracks();
        let selectedTracks = bindings.getSelectedTracks();
        let eventType = "";
        if (event.target.id === "track-change-up" || event.target.id === "track-change-up-icon") {
            eventType = "up";
            startIndex = updateCallback() - (3 - selectedTracks.length);
        } else if (event.target.id === "track-change-down" || event.target.id === "track-change-down-icon") {
            eventType = "down";
            startIndex = updateCallback() + (3 - selectedTracks.length);
        }
        let newPaginationWidget = trackPaginationWidget(currentTrack, selectedTracks, allTracks, updateEvent, bindings, startIndex, eventType);
        paginationWidget.replaceWith(newPaginationWidget);
        paginationWidget = newPaginationWidget;
    }

    // Lists the tracks along with current track
    let paginationWidget = trackPaginationWidget(bindings.getCurrentTrack(),
        bindings.getSelectedTracks(),
        bindings.getSelectableTracks(),
        updateEvent,
        bindings);


    return [
        paginationWidget,
        $("<hr>"),
        // This is how we add new tracks
        genericDivWidget("field").append(
            $("<label>", {class: "label"}).text("Add New Track: "),
            genericDivWidget("control has-text-centered").append(
                genericDivWidget("columns is-gapless").append(
                    genericDivWidget("column").append(
                        $("<input>", {id: "new-track-input", type: "text", class: "input"}).on("keypress", (e) => {
                            if (e.keyCode === 13) {
                                updateEvent(bindings.onTrackAdd, e);
                            }
                        }),
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
        ),
        genericDivWidget("field").append(
            $("<label>", {class: "label"}).text("Limit Points to frames within +/-: "),
            genericDivWidget("control has-text-centered").append(
                genericDivWidget("columns is-gapless").append(
                    genericDivWidget("column").append(
                        genericDivWidget("field").append(
                            $("<input>", {
                                id: "frame-view-offset-input",
                                type: "text",
                                class: "input"
                            }).on("change", (e) => {
                                let viewOffsetError = $("#frame-view-offset-error");
                                let frameViewInput = $(e.target);
                                let parsed = parseInt(frameViewInput.val(), 10);

                                if ((!isNaN(parsed) && parsed > 0) || frameViewInput.val() === "") {
                                    if (!viewOffsetError.hasClass("hidden")) {
                                        viewOffsetError.addClass("hidden");
                                    }
                                    if (frameViewInput.val() === "") {
                                        parsed = -1;
                                    } else {
                                        frameViewInput.val(parsed);
                                    }
                                    bindings.onFrameViewOffsetChange(parsed);
                                } else {
                                    viewOffsetError.removeClass("hidden");
                                    frameViewInput.val("");
                                    bindings.onFrameViewOffsetChange(-1);
                                }
                            }),
                            $("<p>", {
                                class: "help is-danger hidden",
                                id: "frame-view-offset-error"
                            }).text("Must be a positive integer!")
                        )
                    ),
                )
            )
        )
    ];
}

function frameMovementSettingsWidget(bindings) {
    let auto = bindings.get("auto-advance") ? "checked" : "";
    let sync = bindings.get("sync") ? "checked" : "";
    // Auto Advance Checkbox
    return [
        genericDivWidget("columns is-vcentered").append(
            genericDivWidget("column").append(
                $("<label>", {class: "label"}).text("Auto Advance:"),
            ),
            genericDivWidget("column").append(
                $("<input>", {
                    id: "auto-advance-setting",
                    type: "checkbox",
                    class: "checkbox",
                }).on("click", function () {
                    bindings.inverseSetting('auto-advance');
                }).prop("checked", auto),
            ),
            genericDivWidget("column").append(
                tooltipBuilder(
                    "This determines if a video will automatically go forward by the offset determined below after adding a point",
                    true,
                    LABEL_STYLES.DARK,
                    "up"
                )
            )
        ),
        genericDivWidget("columns is-vcentered").append(
            genericDivWidget("column").append($("<label>", {class: "label"}).text("Synchronize Videos:")),
            genericDivWidget("column").append(
                $("<input>", {
                    id: "sync-setting",
                    type: "checkbox",
                    class: "checkbox",
                }).on("click", function () {
                    bindings.inverseSetting('sync');
                }).prop("checked", sync)),
            genericDivWidget("column").append(
                tooltipBuilder(
                    "This determines if all videos will stay on the same frame at all times",
                    true,
                    LABEL_STYLES.DARK,
                    "up"
                )
            )
        )];
}

function changeForwardBackwardOffsetWidget(bindings) {
    return genericDivWidget("columns is-multiline is-vcentered").append(
        // tooltipLabelWidget(labelText, labelStyle, tooltipText, direction)

        genericDivWidget("column").append(
            $("<label>", {class: "label"}).text("Forwards/Backwards step size")
        ),

        genericDivWidget("column").append(
            $("<input>", {
                class: "input",
                id: "forward-frame-input"
            }).val(bindings["get"]("movementOffset")).on("change", (event) => bindings["onChange"](event)),
            $("<p>", {id: "forward-frame-input-error", class: "help is-danger"})
        ),
        genericDivWidget("column").append(
            tooltipBuilder(
                "This lets you change how many frames f/b moves the videos by. As well this will determine how much auto-advance will move the video by",
                true,
                LABEL_STYLES.DARK,
                "up"
            )
        )
    );
}

function saveProjectWidget(saveCallback) {
    return genericDivWidget("columns is-multiline is-vcentered").append(
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
        deleteProject(id);
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

let debouncer = (debouncee, debounceeArgs, time) => {
    let currentCallbackID = null;
    return function () {
        console.log("her1e");
        if (currentCallbackID === null) {
            console.log("here")
            debouncee(debounceeArgs);
            console.log("here")
            currentCallbackID = setTimeout(function () {
                currentCallbackID = null;
            }, time);
        }
    }
}

function searchableProjectsWidget(projects, paginateProjects, loadProjectCallback, paginationIndex) {
    let localColumns = genericDivWidget("columns is-multiline is-mobile is-centered is-vcentered", "searchable-projects-columns");
    let localProjectsWidgets = (projects) => {
        let localProjectCards = [];
        for (let i = 0; i < projects.length; i++) {
            let cur_project = projects[i];
            localProjectCards.push(
                savedProjectWidget(cur_project, loadProjectCallback)
            );
        }
        return localProjectCards;
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
                        if (value === "") {
                            localColumns.find("#project-columns-container").empty().append(
                                paginatedProjectsWidget(projects, paginateProjects, loadProjectCallback, paginationIndex)
                            );
                        } else {
                            let searchRes = await search(value);
                            localColumns.find("#project-columns").empty().append(
                                localProjectsWidgets(searchRes.projects)
                            );

                        }
                    }
                }).on("input", debouncer(async () => {
                        let value = $("#project-search").val();
                        if (value === "") {
                            localColumns.find("#project-columns-container").empty().append(
                                paginatedProjectsWidget(projects, paginateProjects, loadProjectCallback, paginationIndex)
                            )
                        }
                        let searchRes = await search(value);
                        localColumns.find("#project-columns").empty().append(localProjectsWidgets(searchRes.projects));
                    }, null, 500)
                ),
                $("<span>", {class: "icon is-small is-right"}).append(
                    $("<i>", {class: "fas fa-search fa-flip-horizontal"})
                )
            )
        )
    );
    localColumns.append(searchBar);
    localColumns.append(
        genericDivWidget("column", "project-columns-container").append(
            paginatedProjectsWidget(projects, paginateProjects, loadProjectCallback, paginationIndex)
        )
    );
    return localColumns;
}


function paginatedProjectsWidget(projects, paginateProjects, loadProjectCallback, paginationIndex) {
    let projectInfos = projects.projects;
    let endOfPagination = projects.endOfPagination;
    let localColumns = genericDivWidget("columns is-multiline is-mobile is-centered is-vcentered", "project-columns");

    let animationTime = 250;

    let paginateForward = async () => {
        let masterContainer = $("#project-columns-container");
        let nextProjects = await paginateProjects(paginationIndex + 5);
        masterContainer.hide("slide", {direction: "left"}, animationTime, () => {
            masterContainer.empty();
            masterContainer.append(paginatedProjectsWidget(nextProjects, paginateProjects,
                loadProjectCallback, paginationIndex + 5));
            masterContainer.show("slide", {direction: "right"}, animationTime);
        });
    };
    let paginateBackward = async () => {
        let masterContainer = $("#project-columns-container");
        let nextProjects = await paginateProjects(paginationIndex - 5);
        masterContainer.hide("slide", {direction: "right"}, animationTime, () => {
            masterContainer.empty();
            masterContainer.append(paginatedProjectsWidget(nextProjects, paginateProjects,
                loadProjectCallback, paginationIndex - 5));
            masterContainer.show("slide", {direction: "left"}, animationTime);
        });
    };

    let projectCards = [];
    let nextButton = null;
    let prevButton = null;
    if (!(paginationIndex === 0)) {
        prevButton = genericDivWidget("column is-narrow",).append(
            $("<button>", {id: "pagination-button", class: "rounded-button"}).append(
                $("<i>", {class: "fas fa-arrow-left fa-2x"})
            ).on("click", () => {
                paginateBackward();
            })
        )
    }
    if (!endOfPagination) {
        nextButton = genericDivWidget("column is-narrow",).append(
            $("<button>", {id: "pagination-button", class: "rounded-button"}).append(
                $("<i>", {class: "fas fa-arrow-right fa-2x"})
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
        $(".blurrable").css("filter", "");
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
    return genericDivWidget("columns is-multiline").append(
        genericDivWidget("column").append(
            genericDivWidget("columns is-multiline is-centered").append(
                genericDivWidget("column is-narrow").append(
                    tooltipDualColumnWidget(
                        fileInputWidget("Load DLT Coefficents", "loadDLTCoefficients", "any", (file) => loadDLTCoefficients(Array.from($("#loadDLTCoefficients").prop("files")))),
                        {
                            tooltipText: "This will allow you to load DLT coefficients. Once loaded this will allow for advanced features " +
                                "such as epipolar lines and 3D point recovery",
                            tooltipStyle: "has-text-black",
                            direction: "up",
                            multiline: true
                        }
                    )
                ),
                genericDivWidget("column is-narrow").append(
                    $("<button>", {
                        class: 'button',
                        id: 'epipolar-color'
                    }).append(
                        $("<i>", {
                            class: 'fas fa-eye-dropper icon',
                            id: 'epipolar-icon'
                        })
                    ).spectrum({
                        change: (color) => bindings.onEpipolarColorChange(color)
                    })
                )
            )
        ),
        genericDivWidget("column").append(
            tooltipDualColumnWidget(
                fileInputWidget("Load Camera Profile", "loadCameraProfile", "any", (file) => loadCameraProfile(Array.from($("#loadCameraProfile").prop("files")))),
                {
                    tooltipText: "If your camera has distortion, the camera profile will allow for 3D point recovery",
                    tooltipStyle: "has-text-black",
                    direction: "up",
                    multiline: true
                }
            )
        )
    );
}

function setScaleWidget(bindings) {
    return genericDivWidget("column is-three-fifths has-text-centered").append(
        genericDivWidget("box").append(
            $("<button>", {class: "button"}).text("Set Scale").on("click", bindings.setScaleBinding)
        )
    );
}

function setScaleSaveOriginWidget(bindings) {
    let errorMap = {
        unitRatio: "#units-error-message",
        unitName: "#unit-name-error-message"
    };
    let generateError = (errorType, errorText) => {
        let errorTag = $(errorMap[errorType]);
        errorTag.text(errorText);
    };
    return genericDivWidget("column is-12").append($("<button>", {
            class: "button",
            id: "TEMP_DELETE"
        }).text("Save origin").on("click", () => {
            $("#canvas-columns-0").append(
                genericDivWidget("column is-12", "scaleColumn").append(
                    genericDivWidget("columns").append(
                        genericDivWidget("column").append(
                            genericDivWidget("field").append(
                                $("<input>", {
                                    class: "input",
                                    id: "unitRatio",
                                    placeholder: "How many units?"
                                }),
                                $("<p>", {id: "units-error-message", class: "help is-danger"})
                            )
                        ),
                        genericDivWidget("column").append(
                            genericDivWidget("field").append(
                                $("<input>", {class: "input", id: "unitName", placeholder: "Unit name"}),
                                $("<p>", {id: "unit-name-error-message", class: "help is-danger"})
                            )),
                        genericDivWidget("column").append(
                            $("<button>", {class: "button"}).text("Save").on("click", () => bindings.saveScale(generateError))
                        )
                    ),
                ))

            bindings.cleanUpOrigin();
        })
    )
}


function exportPointsGUI(bindings) {
    // TODO: Implement
    return null;
}

function exportButtonWidget(text, bindings, tooltipOptions) {
    let button = $("<button>", {class: "button"}).on("click", bindings.exportFunction).text(text);
    if (tooltipOptions != null) {
        return tooltipDualColumnWidget(button, tooltipOptions);
    } else {
        return button;
    }
}

function loginWidget(onLogin) {
    // TODO: Implement
    return null;
}

// TODO: TEMP, Could be kept. Allows user to save/load without logging in
function loadSavedStateFromFileWidget() {
    let onChange = () => {
        let state = Array.from($("#saved-state-input").prop("files"))[0];
        let reader = new FileReader();
        reader.onload = () => {
            let state = JSON.parse(reader.result);
            state.autosave = false;
            state.projectID = 0;
            loadSavedState(state);
        };
        reader.readAsText(state);
    };
    return fileInputWidget('Saved State', "saved-state-input", "*.json", onChange).css("display", "none");
}


function projectInfoWidget(bindings, loadDLTButton) {
    let DLTButton = loadDLTButton ? loadCameraInfoWidget(bindings) : null;
    return genericDivWidget("column has-text-centered").append(
        genericDivWidget("box").append(
            $(`<p class="subtitle">Project Settings</p>`),
            $("<hr>"),
            $(`<p class="subtitle">Title: ${PROJECT_NAME}</p>`),
            DLTButton,
            saveProjectWidget(bindings.saveProjectBindings),
            exportButtonWidget("Export Points", bindings.exportPointBindings, {
                tooltipText: "This will export x,y points in ARGUS format. If DLT coefficients are loaded, this will also " +
                    "export recovered x,y,z points. If working with one video and the origin has been set, x_scaled and y_scaled will " +
                    "be exported as well.",
                multiline: true
            }),
            tooltipDualColumnWidget(
                fileInputWidget("Load Points", "loadPoints", "any", (file) => {
                    let reader = new FileReader();
                    reader.onload = function () {
                        bindings.loadPoints(reader.result.split("\n"));
                    };
                    reader.readAsText(Array.from($("#loadPoints").prop("files"))[0]);
                }), {
                    tooltipText: "If you have a project from a previous ARGUS version (Matlab/Python), you can load your " +
                        "data here",
                    tooltipStyle: "has-text-black",
                    direction: "up",
                    multiline: true
                })
        )
    );
}

function trackWidget(bindings) {
    return genericDivWidget("column is-12 has-text-centered", "track-management-widget").append(
        genericDivWidget("box").append(
            genericDivWidget("level").append(
                genericDivWidget("level-left").append(
                    $(`<p class="subtitle">Track Management</p>`),
                ),
                genericDivWidget("level-right").append(
                    $("<i>", {class: "fa fa-arrow-down clickable fa-2x fade-on-hover"}).attr("aria-hidden", "true").on("click", () => {
                            let slideCol = $(`#slide-0`);
                            slideCol.css("display") === "none" ? slideCol.slideDown() : slideCol.slideUp();
                            // TODO: Keep Aspect Ratio on resize
                        }
                    )
                )
            ),
            $("<hr>"),
            trackManagementWidgets(bindings),
        )
    )
}

function miscSettingsWidget(bindings) {
    return genericDivWidget("column is-12 has-text-centered").append(
        genericDivWidget("box").append(
            $(`<p class="subtitle">Control Settings</p>`),
            $("<hr>"),
            frameMovementSettingsWidget(bindings.frameMovementBindings),
            changeForwardBackwardOffsetWidget(bindings.forwardBackwardOffsetBindings)
        )
    )
}

function appendError(id, errorText) {
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
}

function removeError(id) {
    $(`#${id}-error`).remove();
}

function parseSettings(context) {
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
}

function getInitVideoSettingsVideoWidget(videoTitle, bindings) {
    // loadPreviewFrameFunction, context, saveCallback, currentSettings) {
    // TODO: This will be a new setup page where all videos are displayed on the same page
    // this will clean up the setup process and make it faster
    // let frameRateInput = genericDivWidget("column is-narrow", "framerate-column").append(
    //     tooltipDualColumnWidget(
    //         setupLabelGenerator("Global Framerate"),
    //         setupTooltipPropertiesGenerator("Argus-web doesn't support multiple " +
    //             "framerates across videos, this value should be the framerate of all of the videos selected",
    //             "right")
    //     ),
    //     frameRateDropDownWidget(currentSettings["frameRate"].toString())
    // );

    let localBrightness = "brightness(100%)";
    let localContrast = "contrast(100%)";
    let localSaturation = "saturate(100%)";

    let filterToBar = (value) => {
        let tempVal = value.split("(")[1];
        return tempVal.substring(0, tempVal.length);
    }

    let parsedFilter = {
        "brightnessBar": filterToBar(localBrightness),
        "contrastBar": filterToBar(localContrast),
        "saturationBar": filterToBar(localSaturation)
    };

    let offsetInput = genericDivWidget("controller", "offset-controller").append(
        $("<input>", {
            class: "input",
            id: "offset-input",
            placeholder: "In Frames",
            value: ""
        })
    );

    let updateVideoPropertiesGeneric = (inputID) => {
        let value = $(`#${inputID}`).val();
        switch (inputID) {
            case "preview-brightness": {
                localBrightness = `brightness(${value}%)`;
                bindings.setBrightness(localBrightness);
                break;
            }
            case 'preview-contrast': {
                localContrast = `contrast(${value}%)`;
                bindings.setContrast(localContrast);
                break;
            }
            case 'preview-saturation': {
                localSaturation = `saturate(${value}%)`;
                bindings.setSaturation(localSaturation);
                break;
            }
        }
        bindings.loadPreviewFrameFunction();
    };


    return genericDivWidget("columns is-vcentered is-centered is-desktop is-multiline").append(
        genericDivWidget("column is-narrow").append(
            genericDivWidget("column").append(
                $("<label>", {class: "label"}).text("Preview:"),
                $("<canvas>", {
                    // style: "height: 100%; width: 100%;",
                    id: "current-settings-preview-canvas"
                }).attr("height", 300).attr("width", 300)
            ),
        ),
        genericDivWidget("column is-narrow").append(
            genericDivWidget("columns is-multiline is-centered is-vcentered").append(
                genericDivWidget("column is-12 has-text-centered").append(
                    $("<p>", {class: "title"}).append(videoTitle)
                ),
                genericDivWidget("column is-6").append(
                    // TODO: Color space off set point
                    genericDivWidget("field", "offset-field").append(
                        tooltipDualColumnWidget(
                            labelDark("Offset"),
                            setupTooltipPropertiesGenerator(
                                "Your videos may start at different places, " +
                                " the difference in starting points is the offset (in frames).",
                                "right", LABEL_STYLES.DARK
                            )
                        ),
                        offsetInput
                    ),
                    genericDivWidget("columns is-multiline is-mobile").append(
                        videoPropertySlidersWidget(
                            "preview-brightness",
                            "preview-contrast",
                            "preview-saturation",
                            updateVideoPropertiesGeneric,
                            labelDark,
                            {
                                brightness: parsedFilter.brightnessBar,
                                contrast: parsedFilter.contrastBar,
                                saturateBar: parsedFilter.saturateBar
                            },
                        )
                    ),
                )
            )
        )
    )
}
