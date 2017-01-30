// Options for which sort of pinned tab we keep.
var PinnedTabPage_Default    = "Default";
var PinnedTabPage_BlankLight = "BlankLight";
var PinnedTabPage_BlankDark  = "BlankDark";
var PinnedTabPage_Custom     = "Custom";

// Actual URLs for the non-custom pinned tab options.
var PinnedTabURL_Default    = "chrome://newtab/";
var PinnedTabURL_BlankLight = chrome.extension.getURL("Resources/blankLight.html");
var PinnedTabURL_BlankDark  = chrome.extension.getURL("Resources/blankDark.html");

// Keys that we use to index into the sync storage.
var KOPT_Page      = "KeepOnePinnedTab_PinnedTabPage";
var KOPT_CustomURL = "KeepOnePinnedTab_CustomPinnedTabURL";
var KOPT_LegacyKey = "KeepOnePinnedTab_NewTabPage"; // Legacy way of storing settings - should be removed after a bit.

var pinnedTabURL = "";

// Main function that's run when tabs are opened/closed - acts as a switch that makes sure that we have pinnedTabURL populated before calling keepSpecialPinnedTab().
function updateTabs() {
	// Asynchronously get the new tab page URL, then do our logic once we have it.
	chrome.storage.sync.get(
		[
			KOPT_Page,
			KOPT_CustomURL,
			KOPT_LegacyKey // Old
		],
		function(items) {
			pinnedTabURL = calculatePinnedURL(items);
			keepSpecialPinnedTab(pinnedTabURL);
		}
	);
}

// Figures out the URL that should be kept always pinned, based on Chrome sync storage.
function calculatePinnedURL(items) {
	var pageToPin = items[KOPT_Page];
	
	// Old style of storage (remove eventually)
	var oldStyleURL = items[KOPT_LegacyKey];
	if( (oldStyleURL != undefined) && (oldStyleURL != "") )
		return oldStyleURL;
	
	if(pageToPin == PinnedTabPage_Default)
		return PinnedTabURL_Default;
	if(pageToPin == PinnedTabPage_BlankLight)
		return PinnedTabURL_BlankLight;
	if(pageToPin == PinnedTabPage_BlankDark)
		return PinnedTabURL_BlankDark;
	if(pageToPin == PinnedTabPage_Custom)
		return items[KOPT_CustomURL];
	
	return PinnedTabURL_Default;
}

// If this is the correct kind of window (normal), make sure that there's a pinned tab with the given URL, plus at least one other tab.
function keepSpecialPinnedTab(urlToPin) {
	// Get the current window, ignoring app and popup windows.
	chrome.windows.getLastFocused({populate: true, windowTypes: ["normal"]}, function(focusedWindow){
		// Bail if no suitable window is focused.
		if(focusedWindow == undefined)
			return;
		
		// Make sure we've got our special tab in place.
		var firstTab = focusedWindow.tabs[0];
		if(!firstTab.pinned || (firstTab.url.indexOf(urlToPin) == -1) ) {
			// Spawn our special tab. Stick it at the beginning, pin it, and don't focus it.
			chrome.tabs.create({
				"index":  0, 
				"pinned": true, 
				"active": false, 
				"url":    urlToPin
			});
		}
		
		// Ensure that there's at least one tab after our special one.
		if(focusedWindow.tabs.length == 1)
			chrome.tabs.create({"active": true});
	});
}
