document.getElementById("showRegister").addEventListener("click", function (e) {
    e.preventDefault();
    document.getElementById("loginCard").classList.add("hidden");
    document.getElementById("registerCard").classList.remove("hidden");
});

document.getElementById("showLogin").addEventListener("click", function (e) {
    e.preventDefault();
    document.getElementById("registerCard").classList.add("hidden");
    document.getElementById("loginCard").classList.remove("hidden");
});

document.getElementById("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    // TODO: connect to backend /login endpoint
    alert("Logging in...");
});

document.getElementById("registerForm").addEventListener("submit", function (e) {
    e.preventDefault();
    // TODO: connect to backend /register endpoint
    alert("Registering...");
});
