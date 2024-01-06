let KOPT = {};

document.addEventListener('DOMContentLoaded', async () =>
{
	const val = (await chrome.storage.session.get("testyglobaly"))["testyglobaly"];
	console.log(val);
	KOPT.asdf = "ooh!"
});

// GDB TODO consider adding listeners directly for load/save like they do here: https://developer.chrome.com/docs/extensions/develop/ui/options-page
// GDB TODO probably remove the "open_in_tab" from the manifest once everything is working happily again

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

function calculatePinnedURL(page, customURL) { // GDB TODO try to pull this from a central spot instead of copying it here
	switch (page)
	{
		case PinnedTabPage_BlankLight:
			return chrome.runtime.getURL("Resources/blankLight.html");
		case PinnedTabPage_BlankDark:
			return chrome.runtime.getURL("Resources/blankDark.html");
		case PinnedTabPage_Custom:
			return customURL;
		case PinnedTabPage_Default:
		default:
			return "chrome://newtab/";
	}
}

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
			[KOPT_CustomURL]: customURL,
			[KOPT_PinnedURL]: calculatePinnedURL(pinnedTabPage, customURL) // GDB TODO probably switch to just having this value (though I'll need some sort of legacy conversion handling to switch over)
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
document.addEventListener("DOMContentLoaded", loadOptions); // GDB TODO consider embedding these with () => {} stuff
document.querySelector("#save").addEventListener("click", saveOptions);

// Update whether custom warning is shown when different page options are selected.
var pinnedTabPageInputs = document.querySelectorAll(".PinnedTabPage")
for(var i = 0; i < pinnedTabPageInputs.length; i++)
	pinnedTabPageInputs[i].addEventListener("change", updateCustomWarningEvent);
