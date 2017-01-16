var PinnedTabPage_Default    = "Default";
var PinnedTabPage_BlankLight = "BlankLight";
var PinnedTabPage_BlankDark  = "BlankDark";
var PinnedTabPage_Custom     = "Custom";

// Saves options to chrome sync storage.
function saveOptions() {
	var customURL;
	
	var pinnedTabPage = document.querySelector("input[name=PinnedTabPage]:checked").value;
	if(pinnedTabPage == PinnedTabPage_Custom)
		customURL = document.querySelector("#customURL").value;
	
	chrome.storage.sync.set({
		"KeepOnePinnedTab_PinnedTabPage": pinnedTabPage,
		"KeepOnePinnedTab_CustomPinnedTabURL": customURL,
		"KeepOnePinnedTab_NewTabPage": "" // Old style, clear it out when we save. Should have fixed it to new style in actual elements via loadOptions().
	});
	
	// Update status to let user know options were saved.
	var status = document.getElementById("status");
	status.innerHTML = "Options Saved.";
	setTimeout(function() {
		status.innerHTML = "";
	}, 750);
}

// Restores select box state to saved value from chrome sync storage.
function loadOptions() {
	chrome.storage.sync.get(
		[
			"KeepOnePinnedTab_PinnedTabPage",
			"KeepOnePinnedTab_CustomPinnedTabURL",
			"KeepOnePinnedTab_NewTabPage" // Old
		],
		function(items) {
			var pinnedTabPage = items["KeepOnePinnedTab_PinnedTabPage"];
			var customURL     = items["KeepOnePinnedTab_CustomPinnedTabURL"];
			
			// Old style of storage (remove eventually)
			var oldStyleURL = items["KeepOnePinnedTab_NewTabPage"];
			if((oldStyleURL != undefined) && (oldStyleURL != "")) {
				pinnedTabPage = PinnedTabPage_Custom;
				customURL = oldStyleURL;
			}
			
			// Default
			if( (pinnedTabPage == undefined) || (pinnedTabPage == "") )
				pinnedTabPage = PinnedTabPage_Default;
			
			var optionElement = document.querySelector("input[name=PinnedTabPage][value=" + pinnedTabPage + "]");
			if(optionElement)
				optionElement.checked = true;
			else
				alert("curses " + pinnedTabPage);
			
			if(pinnedTabPage == PinnedTabPage_Custom)
				document.getElementById("customURL").value = customURL;
		}
	);
}

// Add the events to load/save from this page.
document.addEventListener("DOMContentLoaded", loadOptions);
document.querySelector("#save").addEventListener("click", saveOptions);
