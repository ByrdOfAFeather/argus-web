// TODO: Generate .min.js that contains both clicker.js, video_api.js, and this file.
LABEL_STYLES = {DARK: "has-text-black", LIGHT: "has-text-white"};



function genericDropDownWidget(id, defaultSelection, dropdownOptions, allItemCallBack = undefined) {
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
    return itemNames.map((value) => dropDownItemWidget(value.toLowerCase().replace(".", "-"), value));
}

function colorSpaceDropDownWidget(colorSpaceIndex, redrawVideosFunction) {
    let items = generateDropDownItems(["RGB", "Grayscale"]);
    return genericDropDownWidget(`colorspace-${colorSpaceIndex}`, "RGB", items, function (e) {
        let container = $(`#colorspace-${colorSpaceIndex}-dropdown-container`);

        let newSelection = $(e.target).text();
        changeColorSpace(newSelection.toLowerCase() === "rgb" ? RGB : GREYSCALE);
        if (container.hasClass("is-active")) {
            container.removeClass("is-active");
        }

        $(`#colorspace-${colorSpaceIndex}-current-selection`).text(newSelection);
        redrawVideosFunction();
    });
}

function trackDropDownWidget() {
    let items = generateDropDownItems(["Track 0"]);
    return genericDropDownWidget("track", "Select Track", items,)
}


function frameRateDropDownWidget() {
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
            let saveButton = $("#frame-rate-save-button");
            saveButton.on("click", function () {
                let input = frameRateInput.val();
                let parse = parseFloat(input);
                let warning = $("#modal-input-warning-frame-rate");
                if (!isNaN(parse)) {
                    FRAME_RATE = parse;
                    dropdownSelection.text(input);
                    warning.addClass("is-not-display");
                    frameRateContainer.addClass("is-not-display");
                    saveButton.off();
                } else {
                    FRAME_RATE = null;
                    if (warning.hasClass("is-not-display")) {
                        warning.removeClass("is-not-display");
                    }
                }
            });
        }
    };

    let updateDropDown = (e) => {
        let container = $(`#frame-rate-dropdown-container`);
        $("#custom-frame-rate-container").addClass("is-not-display");
        let frameRate = parseFloat(e.target.id.replace("-", "."));
        $("#frame-rate-current-selection").text(frameRate);
        FRAME_RATE = frameRate;
        if (container.hasClass("is-active")) {
            container.removeClass("is-active");
        } else {
            container.addClass("is-active");
        }
        e.stopPropagation();
    };

    let items = generateDropDownItems(COMMON_FRAME_RATES);
    items.push(dropDownItemWidget("frameRate-custom", "Custom", updateDropDownAndShowCustomForm));
    return genericDropDownWidget('frame-rate', 'Select Framerate', items, updateDropDown).append(
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

function tooltipLabelWidget(labelText, labelStyle, tooltipText, direction) {
    return genericDivWidget("columns is-gapless").append(
        genericDivWidget("column is-narrow").append(
            $("<label>", {class: `label ${labelStyle}`}).text(labelText),
        ),
        genericDivWidget("column is-narrow").append(
            toolTipBuilder(tooltipText, true, labelStyle, direction)
        )
    );
}

function canvas(id, classType, style) {
    return $("<canvas>", {class: classType, id: id, style: style});
}

function popOutButtonWidget(videoIndex, videoURL, popOutFunction) {
    // videoIndex: Integer represnting the current video index
    // videoURL: String reprsenting the source for the video, this is required to load the video in a new window

    // popOutFunction: Used whenever the pop-out button is pressed
    // popOutFunction: (event: jquery event object, videoURL: str same as above) { handles popping a video into a new
    // tab and adding it to the current communicators }
    let popOutButton = $("<button>", {class: "button", id: `popVideo-${videoIndex}`}).text("pop-out video");
    popOutButton.on("click", function (_) {
        popOutFunction(videoIndex, videoURL)
    });
    return popOutButton
}

function _canvasWidthAndHeightManager(canvas, width, height) {
    return canvas.attr("height", height).attr("width", width).css("height", height + "px").css("width", width + "px");
}

function clickerCanvasWidget(videoIndex, onClick, onRightClick) {
    // videoIndex: integer value representing the index of the video

    // onClick: Callback whenever the clickable canvas is pressed
    // onClick(event) { handles adding a new point and updating popouts if necessary }

    // onRightClick: Callback whenever the clickable canvas is pressed with a right click
    // onRightClick(event) { handles removing a point and updating popouts if necessary }

    // TODO: Video Canvas has class-type draggable, don't know for sure why this is
    // I believe it is due to resizing which is a legacy feature.

    let clickableCanvas = canvas(`canvas-${videoIndex}`, "clickable-canvas absolute", "z-index: 3;");
    clickableCanvas = _canvasWidthAndHeightManager(clickableCanvas, 800, 600);

    let epipolarCanvas = canvas(`epipolarCanvas-${videoIndex}`, "epipolar-canvas absolute", "z-index: 2;");
    epipolarCanvas = _canvasWidthAndHeightManager(epipolarCanvas, 800, 600);

    let videoCanvas = canvas(`videoCanvas-${videoIndex}`, "video-canvas absolute draggable", "z-index: 1;");
    videoCanvas = _canvasWidthAndHeightManager(videoCanvas, 800, 600);

    return genericDivWidget("container-for-canvas", `container-for-canvas-${videoIndex}`).append(
        clickableCanvas.on("click", onClick).on("contextmenu", onRightClick).on("mousemove", setMousePos),
        epipolarCanvas,
        videoCanvas,
    ).css("width", "800px").css("height", "600px");
}

function clickerWidget(videoIndex, videoManager, loadPreviewFrameFunction, onClick, onRightClick) {
    // videoIndex: Integer representing the video that this widget is being rendered for. There should be one
    // canvas widget per video.

    // videoManager: Video object for the current video index, used to bind filter changes to changes in the
    // actual drawing of the frame

    // loadPreviewFrameFunction: callback used whenever a setting is updated
    // loadPreviewFrameFunction(videoIndex: integer) { returns nothing, reloads the current frame with new settings }

    // onClick: Callback whenever the clickable canvas is pressed
    // onClick(event) { handles adding a new point and updating popouts if necessary }

    // onRightClick: Callback whenever the clickable canvas is pressed with a right click
    // onRightClick(event) { handles removing a point and updating popouts if necessary }
    let updateVideoProperties = (propertyID) => {
        let value = $(`#${propertyID}`).val();
        switch (propertyID) {
            case `brightness-${videoIndex}`: {
                videoManager.currentBrightnessFilter = `brightness(${value}%)`;
                break;
            }
            case 'preview-contrast': {
                videoManager.currentContrastFilter = `contrast(${value}%)`;
                break;
            }
            case 'preview-saturation': {
                videoManager.currentSatruateFilter = `saturate(${value}%)`;
                break;
            }
        }
        loadPreviewFrameFunction(videoIndex);
    };
    return genericDivWidget("section").append(
        genericDivWidget("container").append(
            genericDivWidget("columns has-text-centered is-multiline", `canvas-columns-${videoIndex}`).append(
                genericDivWidget("column is-12 video-label-container").append(
                    genericDivWidget("level").append(
                        genericDivWidget("level-left").append(
                            $('<p>', {class: "video-label render-unselectable", id: `videoLabel-${videoIndex}`})
                        ),
                        genericDivWidget("level-right", `pop-out-${videoIndex}-placeholder`)
                    )
                ),

                genericDivWidget("column").append(
                    clickerCanvasWidget(videoIndex, onClick, onRightClick)
                ),

                genericDivWidget("column").append(
                    genericDivWidget("columns is-multiline", `misc-settings-${videoIndex}`).append(
                        videoPropertySlidersWidget(
                            `brightness-${videoIndex}`,
                            `contrast-${videoIndex}`,
                            `saturation-${videoIndex}`,
                            updateVideoProperties,
                            LABEL_STYLES.DARK
                        ),
                        genericDivWidget('column').append(
                            canvas(`zoomCanvas-${videoIndex}`, "zoom-canvas", "z-index: 2;")
                        )
                    )
                )
            )
        )
    );
}

function sliderWidget(id, min, max, initVal, onChange) {
    return $(`<input id="${id}" class="slider is-fullwidth" step="1" min="${min}" max="${max}" value="${initVal}" type="range">`).on('change', onChange);
}

function videoPropertySlidersWidget(brightnessID, contrastID, saturationID, updateVideoProperties, labelStyle) {
    // brightnessID: String representing what the desired unique identifier is for the brightness slider
    // contrastID: String representing what the desired unique identifier is for the contrast slider
    // saturationID: String representing what the desired unique identifier is for the saturation slider

    // updateVideoProperties: callback used whenever a specific slider is changed
    // updateVideoProperties(propertyID: string, note: Does not include the #)
    // { returns nothing, does whatever needs to be done to update the specific settings and redraw the current frame}


    // LONG TOOLTIP TEXTS
    let brightnessTooltipText = "Controls how much intensity every element in a video has. When you raise this, every pixel will " +
        "get lighter.";
    let contrastTooltipText = 'Controls the difference between the darker and lighter elements, when this is set to 0 there' +
        ' is no difference and every element becomes the same!';
    let saturationTooltipText = 'Saturation can be thought of as: how colorful do I want my video? Which is exactly' +
        ' why this setting will have no effect in black & white settings';

    return [genericDivWidget("column is-12").append(
        tooltipLabelWidget("Brightness", labelStyle, `${brightnessTooltipText}`, "top"),
        sliderWidget(`${brightnessID}`, "0", "200", "100", function () {
            updateVideoProperties('preview-brightness');
        })),
        genericDivWidget("column is-12").append(
            tooltipLabelWidget("Contrast", labelStyle, `${contrastTooltipText}`, "top"),
            sliderWidget(`${contrastID}`, '0', '100', '100', function () {
                updateVideoProperties('preview-contrast')
            }),
        ),
        genericDivWidget("column is-12").append(
            tooltipLabelWidget("Saturation", labelStyle, `${saturationTooltipText}`, "top"),
            sliderWidget(`${saturationID}`, '0', '100', '100', function () {
                updateVideoProperties('preview-saturation')
            }),
        )]
}

function initialVideoPropertiesWidget(videoTitle, loadPreviewFrameFunction, saveCallback, context) {
    // TODO : Clean Up

    let colorSpaceDropDown = colorSpaceDropDownWidget(1, loadPreviewFrameFunction);

    // This lets the form look a little nicer by expanding the colorspace dropdown and its options to full width
    let triggerButton = colorSpaceDropDown.find("#colorspace-1-trigger");
    triggerButton.parent().css("width", "100%").parent().css("width", "100%");
    triggerButton.css("width", "100%");

    let optionMenu = colorSpaceDropDown.find("#colorspace-1-dropdown");
    optionMenu.addClass("has-text-centered");
    optionMenu.css("width", "100%");

    let parseSetings = (context) => {
        function validateFloatValue(stringValue) {
            let parsedFloat = parseFloat(stringValue);
            if (!isNaN(parsedFloat)) {
                return {"valid": true, value: parsedFloat};
            } else {
                return {"valid": false, value: null};
            }
        }

        // Returns if settings are valid and if not which ones are invalid
        let parsed = {};
        parsed["offset"] = validateFloatValue(context.offset);
        parsed["frameRate"] = validateFloatValue(context.frameRate);
        parsed["pointSize"] = validateFloatValue(context.pointSize);
        return parsed;
    };


    let frameRateInput = genericDivWidget("column is-narrow", "framerate-column").append(
        tooltipLabelWidget("Global Framerate", LABEL_STYLES.LIGHT,
            "Argus-web doesn't support multiple " +
            "framerates across videos, this value should be the framerate of all of the videos selected",
            "right"),
        frameRateDropDownWidget()
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

    let previousButton = $("<button>", {class: "button", id: "preview-init-settings-button"}).text("Previous");
    if (!context.previousButton) {
        previousButton = null;
    }

    // The margin: 0 lets animation smoothly transition from one modal-state to the next ( if there are multiple ).
    return genericDivWidget("columns is-centered is-multiline").css("margin", "0").append(
        genericDivWidget("column is-12 has-text-centered").append(
            $("<h1>", {class: "has-julius has-text-white title"}).text(`Video Properties for ${videoTitle}`)
        ),

        genericDivWidget("column").append(
            genericDivWidget("columns is-multiline").append(
                genericDivWidget("column").append(
                    genericDivWidget("columns is-multiline").append(
                        genericDivWidget("column is-12").append(
                            genericDivWidget("field", "offset-field").append(
                                tooltipLabelWidget("Offset", LABEL_STYLES.LIGHT,
                                    "Your videos may start at different places, " +
                                    " the difference in starting points is the offset (in frames).",
                                    "right"),
                                genericDivWidget("controller", "offset-controller").append(
                                    $("<input>", {class: "input", id: "offset-input", placeholder: "In Frames"})
                                )
                            ),
                        ),
                        frameRateInput
                    )
                ),


                genericDivWidget("column").append(
                    genericDivWidget("columns is-multiline is-vcentered").append(
                        genericDivWidget("column is-12").append(
                            tooltipLabelWidget("Colorspace", LABEL_STYLES.LIGHT,
                                "Your videos may be easier to see by swaping colorspace",
                                "left"),
                            colorSpaceDropDown,
                        ),
                        genericDivWidget("column is-narrow").append(
                            tooltipLabelWidget("Point Size", LABEL_STYLES.LIGHT,
                                "This controls the radius of your points, the larger it is, the easier it" +
                                " will be to see. However, this will cause overlap with other points",
                                "left"),

                            $("<input>", {
                                class: "input",
                                type: "text",
                                id: "preview-point-size-input",
                                placeholder: "Set size"
                            }).on("keyup", function () {
                                POINT_RADIUS = parseFloat($("#preview-point-size-input").val()) / 2;
                                loadPreviewFrameFunction();
                            })
                        )
                    ),
                ),

                genericDivWidget("column is-12").append(
                    genericDivWidget("columns is-multiline").append(
                        genericDivWidget("column").append(
                            genericDivWidget("columns").append(
                                genericDivWidget("column is-narrow").append(
                                    $("<label>", {class: "label has-text-white"}).text("Preview:"),
                                    $("<canvas>", {
                                        // style: "height: 100%; width: 100%;",
                                        id: "current-init-settings-preview-canvas"
                                    }).attr("height", 300).attr("width", 400)
                                ),
                                genericDivWidget("column").append(
                                    genericDivWidget("columns is-multiline").append(
                                        videoPropertySlidersWidget(
                                            "preview-brightness",
                                            "preview-contrast",
                                            "preview-saturation",
                                            updateVideoPropertiesGeneric,
                                            LABEL_STYLES.LIGHT
                                        )
                                    ),
                                ),
                            )
                        ),


                        genericDivWidget("column is-12").append(
                            genericDivWidget("level").append(
                                genericDivWidget("level-left").append(
                                    previousButton,
                                ),
                                genericDivWidget("level-right").append(
                                    $("<button>", {
                                        class: "button",
                                        id: 'save-init-settings-button'
                                    }).on("click", function () {
                                        let parsed = parseSetings({
                                            "frameRate": FRAME_RATE,
                                            "offset": $("#offset-input").val(),
                                            "pointSize": $("#preview-point-size-input").val()
                                        });

                                        if (context.index !== 0) {
                                            let valid = true;
                                            if (valid) {
                                                parsed.index = context.index;
                                                saveCallback(parsed);
                                            }
                                        } else {
                                            let valid = true;
                                            if (!parsed["frameRate"]["valid"]) {
                                                valid = false;
                                                let frameRateErrorText = "Framerate must be a valid number!";
                                                appendError("framerate-column", frameRateErrorText);
                                            } else {
                                                removeError("framerate-column");
                                            }
                                            if (!parsed['offset']['valid']) {
                                                valid = false;
                                                let offsetErrorText = "Offset must be a valid number!";
                                                appendError("offset-controller", offsetErrorText);
                                            } else {
                                                removeError("offset-controller");
                                            }
                                            // if (!parsed['pointSize']['valid']) {
                                            //     valid = false;
                                            // } else {
                                            // }

                                            if (valid) {
                                                parsed.index = context.index;
                                                saveCallback(parsed);
                                            }
                                        }
                                    }).text(`${context.nextButton}`),
                                )
                            )
                        )
                    ),
                ),
            )
        )
    );
}


function genericDivWidget(classType, id = "") {
    // Return an ID-less div
    if (id !== "") {
        return $(`<div>`, {class: classType, id: id});
    } else {
        return $(`<div>`, {class: classType});
    }

}

function fileInputWidget(inputText, inputID, acceptableFiles, onChangeCallback) {
    return genericDivWidget("centered-file-input file").append(
        $("<label>", {class: "file-label"}).append(
            $("<input>", {
                id: inputID,
                class: "file-input",
                accept: acceptableFiles,
                type: "file"
            },).on("change", onChangeCallback),
            $("<span>", {class: "file-cta"}).append(
                $("<span>", {class: "file-label"}).text(inputText)
            )
        )
    );
}


function firstRowOfSettingsWidget() {
    let widget = genericDivWidget("columns");
    widget.append(
        // Stacked DLT and Camera Profile Settings
        genericDivWidget("column").append(
            genericDivWidget("columns is-centered is-vcentered is-multiline").append(
                // DLT Coeff Input
                genericDivWidget("column is-12").append(
                    fileInputWidget("Load DLT Coefficients", "dlt-coeff-input", "text/csv", function () {
                        let selectedFiles = Array.from($("#dlt-coeff-input").prop("files"));
                        loadDLTCoefficients(selectedFiles);
                    })
                ),

                // Camera Profile Input
                genericDivWidget("column is-12").append(
                    fileInputWidget("Load Camera Profile", "camera-profile-input", "*.txt", function () {
                        let selectedFiles = Array.from($("#camera-profile-input").prop("files"));
                        loadCameraProfile(selectedFiles);
                    },)
                )
            ),
        ),

        // Add new track
        genericDivWidget("column").append(
            genericDivWidget("field").append(
                $("<label>", {class: "label"}).text("Add New Track: "),
                genericDivWidget("control").append(
                    $("<input>", {id: "new-track-input", type: "text", class: "input small-input"}),
                    $("<input>", {
                        id: "add-track-button",
                        type: "button",
                        class: "button",
                        value: "=>"
                    }).on("click", function () {
                        let newTrack = $("#new-track-input").val();
                        trackManager.addTrack(newTrack);
                        TrackDropDown.addTrack(newTrack);
                    }),
                )
            )
        ),

        // Track Drop Down
        genericDivWidget("column", "track-dropdown-container-column"),

        // Colorspace drop down
        genericDivWidget("column").append(
            genericDivWidget("columns is-multiline is-vcentered").append(
                genericDivWidget("column is-12 has-text-centered").append(
                    colorSpaceDropDownWidget(0)
                ),
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
                        }).text("Save Points").on("click", exportPoints),
                    )
                ),

                genericDivWidget("column is-12").append(
                    fileInputWidget("Load Points", "load-points-button", "text/csv", function () {
                        let selectedFiles = Array.from($("#load-points-button").prop("files"));
                        loadPoints(selectedFiles);
                    },)
                ),
            )
        ),

        genericDivWidget("column").append(
            // Auto Advance Checkbox
            $("<label>", {class: "label"}).text("Auto Advance:"),
            $("<input>", {
                id: "auto-advance-setting",
                type: "checkbox",
                class: "checkbox",
                checked: settings["auto-advance"] ? "checked" : ""
            }).on("click", function () {
                settings['auto-advance'] = !settings['auto-advance'];
            }),

            // Sync Check box
            $("<label>", {class: "label"}).text("Snyc:"),
            $("<input>", {
                id: "sync-setting",
                type: "checkbox",
                class: "checkbox",
                checked: settings["sync"] ? "checked" : ""
            }).on("click", function () {
                settings['sync'] = !settings['sync'];
            }),
        )
    );
    return widget;
}


function pointSizeSelectorWidget(index) {
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
        POINT_RADIUS = $("#point-size-input").val() * videos[0].canvas.width / 800;
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


function settingsInputWidget() {
    return $("<section>", {class: "section"}).append(
        $("<hr>"),
        genericDivWidget("columns is-multiline is-vcentered").append(
            genericDivWidget("column is-12 has-text-centered").append(
                $("<h1>", {class: "title"}).text("SETTINGS")
            ),

            genericDivWidget("column is-12").append(
                firstRowOfSettingsWidget()
            ),

            genericDivWidget("column is-12").append(
                pointSizeSelectorWidget(0)
            )
        ),
        $("<hr>"),
    );
}