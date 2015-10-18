// Saves options to chrome sync storage.
function saveOps() {
	chrome.storage.sync.set({
		"KeepOnePinnedTab_NewTabPage": document.getElementById("newTabPage").value
	});

	// Update status to let user know options were saved.
	var status = document.getElementById("status");
	status.innerHTML = "Options Saved.";
	setTimeout(function() {
		status.innerHTML = "";
	}, 750);
}

// Restores select box state to saved value from chrome sync storage.
function loadOps() {
	chrome.storage.sync.get(["KeepOnePinnedTab_NewTabPage"], 
		function(items) {
			document.getElementById("newTabPage").value = items["KeepOnePinnedTab_NewTabPage"];
		}
	);
}

// Add the events to load/save from this page.
document.addEventListener('DOMContentLoaded', loadOps);
document.querySelector('#save').addEventListener('click', saveOps);