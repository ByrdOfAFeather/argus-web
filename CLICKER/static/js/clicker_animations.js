function runAnimations() {
    $($(".animated")[1]).slideDown(750, function () {
        $($(".animated")[2]).slideDown(750, function () {
             $($(".animated")[0]).slideDown(500, () => {
                              $("#get-started-button").focus();
             });
        });
    });

}


