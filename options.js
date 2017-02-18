
function saveOptions() {
	var customURL;
	
	var noFocusPinnedTab = document.getElementById("NoFocusPinnedTab").checked;
	
	var pinnedTabPage = document.querySelector("input[name=PinnedTabPage]:checked").value;
	if(pinnedTabPage == PinnedTabPage_Custom)
		customURL = document.querySelector("#customURL").value;
	
	chrome.storage.sync.set(
		{
			[KOPT_NoFocusTab]: noFocusPinnedTab,
			[KOPT_Page]:       pinnedTabPage,
			[KOPT_CustomURL]:  customURL
		}
	);
	
	var status = document.getElementById("status");
	status.innerHTML = "Options Saved.";
	setTimeout(
		function() {
			status.innerHTML = "";
		},
		750
	);
}
function loadOptions() {
	chrome.storage.sync.get(
		[
			KOPT_NoFocusTab,
			KOPT_Page,
			KOPT_CustomURL,
		],
		function(items) {
			var noFocusPinnedTab = items[KOPT_NoFocusTab]
			var pinnedTabPage    = items[KOPT_Page];
			var customURL        = items[KOPT_CustomURL];
			
			document.getElementById("NoFocusPinnedTab").checked = noFocusPinnedTab;
			
			if(!pinnedTabPage) // Default if not set
				pinnedTabPage = PinnedTabPage_Default;
			var optionElement = document.querySelector(".PinnedTabPage[value=" + pinnedTabPage + "]");
			if(optionElement)
				optionElement.checked = true;
			
			if(pinnedTabPage == PinnedTabPage_Custom)
				document.getElementById("customURL").value = customURL;
			
			updateCustomWarning(pinnedTabPage);
		}
	);
}

function updateCustomWarningEvent(e) {
	updateCustomWarning(e.target.value);
}
function updateCustomWarning(pinnedTabPage) {
	if(pinnedTabPage == PinnedTabPage_Custom)
		document.getElementById("customWarning").style.display = "inline";
	else
		document.getElementById("customWarning").style.display = "none";
}


// Add the events to load/save from this page.
document.addEventListener("DOMContentLoaded", loadOptions);
document.querySelector("#save").addEventListener("click", saveOptions);

// Update whether custom warning is shown when different page options are selected.
var pinnedTabPageInputs = document.querySelectorAll(".PinnedTabPage")
for(var i = 0; i < pinnedTabPageInputs.length; i++)
	pinnedTabPageInputs[i].addEventListener("change", updateCustomWarningEvent);
