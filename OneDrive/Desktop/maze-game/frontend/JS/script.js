window.onload = function () {

    setTimeout(function () {

        document.getElementById("splash").style.display = "none";
        document.getElementById("main").style.display = "flex";

    },3000);

};

document.getElementById("loginBtn").addEventListener("click", function () {

    window.location.href = "login.html";

});