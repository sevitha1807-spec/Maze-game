window.onload = function () {

    setTimeout(function () {

        document.getElementById("splash").style.display = "none";

        document.getElementById("main").style.display = "flex";

    }, 3000);

};

document.getElementById("startBtn").addEventListener("click", function () {

    alert("Game Starting...");

    // Later you can redirect:
    // window.location.href = "maze.html";

});