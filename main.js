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









// Main function that's run when tabs are opened/closed - acts as a switch that makes sure that we have pinnedTabURL populated before calling keepPinnedTab().
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
			keepPinnedTab(pinnedTabURL);
		}
	);
}

// If this is the correct kind of window (normal), make sure that there's a pinned tab with the given URL, plus at least one other tab.
function keepPinnedTab(urlToPin) {
	// Get the current window, ignoring app and popup windows.
	chrome.windows.getLastFocused(
		{
			"populate":    true, 
			"windowTypes": ["normal"]
		},
		function(focusedWindow){
			pinSpecialTab(focusedWindow, urlToPin);
		}
	);
}

// Make sure we've got our special tab in place.
function pinSpecialTab(targetWindow, urlToPin) {
	if(targetWindow == undefined)
		return;
	
	var windowId = targetWindow.id;
	var firstTab = targetWindow.tabs[0];
	if(firstTab.pinned && (firstTab.url.indexOf(urlToPin) != -1)) {
		openAdditionalTab(windowId);
		return; // Our desired tab already exists.
	}
	
	// Spawn our special tab. Stick it at the beginning and pin it, but don't focus it.
	chrome.tabs.create(
		{
			"index":  0, 
			"pinned": true, 
			"active": false, 
			"url":    urlToPin
		},
		function(tab) {
			openAdditionalTab(windowId); // Must be fired only once the new tab is created, so that our tab count later is accurate.
		}
	);
}

function openAdditionalTab(windowId) {
	// Get a new reference to the window, since the number of tabs will have changed after opening the special tab.
	chrome.windows.get(
		windowId,
		{
			"populate": true
		},
		function(targetWindow) {
			openAdditionalTabInWindow(targetWindow);
		}
	);
}

function openAdditionalTabInWindow(targetWindow) {
	if(targetWindow == undefined)
		return;
	
	if(targetWindow.tabs.length > 1)
		return;
	
	chrome.tabs.create(
		{
			"active": true
		}
	);
}
