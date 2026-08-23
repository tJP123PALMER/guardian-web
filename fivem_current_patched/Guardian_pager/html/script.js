window.addEventListener("message", function(event) {

    console.log("NUI MESSAGE", event.data);

    if (event.data.action === "show") {

        document.getElementById("pager").style.display = "block";

        document.getElementById("type").innerText = event.data.type;
        document.getElementById("address").innerText = event.data.address;
        document.getElementById("priority").innerText = event.data.priority;

        const tone = document.getElementById("tone");

tone.load();
tone.currentTime = 0;

tone.play().then(() => {
    console.log("Pager sound playing");
}).catch(err => {
    console.error("Pager sound failed:", err);
});
    }

    if (event.data.action === "hide") {
        document.getElementById("pager").style.display = "none";
    }

});

// The pager has NUI focus, so handle ENTER inside the NUI.
// Do not rely on GTA control 191 while NUI focus is active.
document.addEventListener("keydown", function(event) {
    if (event.key === "Enter" || event.code === "NumpadEnter") {
        const pager = document.getElementById("pager");
        if (!pager || pager.style.display === "none") return;

        event.preventDefault();
        event.stopPropagation();

        fetch(`https://${GetParentResourceName()}/closePager`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}"
        });
    }
});
