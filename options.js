// Saves options to chrome sync storage.
function saveOptions() {
	var customURL;
	
	var pinnedTabPage = document.querySelector("input[name=PinnedTabPage]:checked").value;
	if(pinnedTabPage == PinnedTabPage_Custom)
		customURL = document.querySelector("#customURL").value;
	
	chrome.storage.sync.set({
		KOPT_Page:      pinnedTabPage,
		KOPT_CustomURL: customURL,
		KOPT_LegacyKey: "" // Old style, clear it out when we save. Should have fixed it to new style in actual elements via loadOptions().
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
			KOPT_Page,
			KOPT_CustomURL,
			KOPT_LegacyKey // Old
		],
		function(items) {
			var pinnedTabPage = items[KOPT_Page];
			var customURL     = items[KOPT_CustomURL];
			
			// Old style of storage (remove eventually)
			var oldStyleURL = items[KOPT_LegacyKey];
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
			
			if(pinnedTabPage == PinnedTabPage_Custom)
				document.getElementById("customURL").value = customURL;
		}
	);
}

// Add the events to load/save from this page.
document.addEventListener("DOMContentLoaded", loadOptions);
document.querySelector("#save").addEventListener("click", saveOptions);
