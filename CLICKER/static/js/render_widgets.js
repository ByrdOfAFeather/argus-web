// TODO: Generate .min.js that contains both clicker.js, video_api.js, and this file.

function genericDropDownWidget(id, defaultSelection, dropdownOptions, allItemCallBack = undefined) {
    let triggerButton = $("<button>", {
        id: `${id}-trigger`,
        class: "button"
    }).attr("aria-haspopup", "true").attr("aria-controls", `${id}-dropdown`).append(
        $("<span>", {id: `${id}-current-selection`}).text(defaultSelection),
        $("<i>", {class: "fas fa-caret-down has-margin-left"})
    ).on("click", function () {
        let container = $(`#${id}-dropdown-container`);

        if (container.hasClass("is-active")) {
            container.removeClass("is-active");
        } else {
            container.addClass("is-active");
        }
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
        ).on("click", ".dropdown-item", allItemCallBack);
    }
}


function dropDownItemWidget(id, itemText, perItemCallBack = undefined) {
    if (perItemCallBack === undefined) {
        return genericDivWidget("dropdown-content").append(
            genericDivWidget("dropdown-item", id).append(
                itemText
            )
        );
    } else {
        return genericDivWidget("dropdown-content").append(
            genericDivWidget("dropdown-item", id).append(
                itemText
            ).on("click", perItemCallBack)
        );
    }
}

function generateDropDownItems(itemNames) {
    return itemNames.map((value) => dropDownItemWidget(value.toLowerCase(), value));
}

function colorSpaceDropDownWidget(colorSpaceIndex) {
    let items = generateDropDownItems(["RGB", "Grayscale"]);
    return genericDropDownWidget(`colorspace-${colorSpaceIndex}`, "RGB", items, function (e) {
        let container = $(`#colorspace-${colorSpaceIndex}-dropdown-container`);

        let newSelection = $(e.target).text();
        changeColorSpace(newSelection.toLowerCase() === "rgb" ? RGB : GREYSCALE);
        if (container.hasClass("is-active")) {
            container.removeClass("is-active");
        }

        $(`#colorspace-${colorSpaceIndex}-current-selection`).text(newSelection);
    });
}

function trackDropDownWidget() {
    let items = generateDropDownItems(["Track 0"]);
    return genericDropDownWidget("track", "Select Track", items, )
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
                )
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


function secondRowOfSettingsWidget() {
    let drawPreview = () => {
        let pointPreviewCanvas = document.getElementById("point-preview-canvas");
        let ctx = pointPreviewCanvas.getContext("2d");

        let testRadius = $("#point-size-input").val();
        ctx.clearRect(0, 0, 100, 100);
        ctx.beginPath();
        ctx.arc(50, 50, testRadius, 0, Math.PI);
        ctx.arc(50, 50, testRadius, Math.PI, 2 * Math.PI);
        ctx.stroke();
    };

    let updatePointRaidus = () => {
        POINT_RADIUS = $("#point-size-input").val() * videos[0].canvas.width / 800;
        for (let i = 0; i < NUMBER_OF_CAMERAS; i++) {
            let points = getClickedPoints(i, trackTracker.currentTrack);
            videos[i].clearPoints();
            videos[i].redrawPoints(points);
        }
    };


    let widget = genericDivWidget("columns is-vcentered is-centered");
    widget.append(
        genericDivWidget("column is-narrow").append(
            genericDivWidget("field").append(
                $("<label>", {class: "label"}).text("Point Marker Size"),
                genericDivWidget("control").append(
                    $("<input>", {id: "point-size-input", class: "input small-input"}).on("keyup", drawPreview),
                    $("<input>", {id: "set-point-size-button", type: "button", class: "button", value: "SET"}).on(
                        "click", updatePointRaidus
                    )
                )
            )
        ),
        genericDivWidget("column").append(
            $("<label>", {class: "label"}).text("Preview"),
            $("<canvas>", {
                id: "point-preview-canvas",
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
                secondRowOfSettingsWidget()
            )
        ),
        $("<hr>"),
    );
}