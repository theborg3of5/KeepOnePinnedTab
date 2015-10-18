var creatingTab = false;
var loadedNewTabPage = false;
var newTabPage = "";

var newTabPageSyncKey = "KeepOnePinnedTab_NewTabPage";
var defaultNewTabPage = "chrome://newtab/";

// Main function that's run when tabs are opened/closed - acts as a switch that makes sure that we have newTabPage populated before calling keepSpecialPinned().
function updateTabs() {
	// If we already have the new tab page loaded from the chrome sync storage, we can just go.
	if(loadedNewTabPage) {
		keepSpecialPinned();
	
	// Otherwise, we have to asynchronously get the new tab page URL, then do our logic once we have it.
	} else {
		chrome.storage.sync.get(newTabPageSyncKey, function(items) {
			newTabPage = items[newTabPageSyncKey];

			// If not set (or key not defined), fall back on the default.
			if( (newTabPage == undefined) || (newTabPage == "") ) newTabPage = defaultNewTabPage
			
			keepSpecialPinned();
		});
	}
}

// If this is the correct kind of window (normal), make sure that there's a pinned tab with the given URL, plus at least one other tab.
function keepSpecialPinned() {
	// Bail if we're already opening a tab (to avoid infinite opening of tabs).
	if(creatingTab) return;
	
	// Get the current window, ignoring app and popup windows.
	chrome.windows.getLastFocused({populate: true, windowTypes: ["normal"]}, function(focusedWindow){
		// Bail if no suitable window is focused.
		if(focusedWindow == undefined) return;
		
		// Make sure we've got our special tab in place.
		var firstTab = focusedWindow.tabs[0];
		if(!firstTab.pinned || (firstTab.url.indexOf(newTabPage) == -1) ) {
			// Spawn our special tab. Stick it at the beginning, pin it, and don't focus it.
			creatingTab = true;
			chrome.tabs.create({"index": 0, "pinned": true, "active": false, "url": newTabPage}, function(tab) {
				creatingTab = false;
			});
		}
		
		// Ensure that there's at least one tab after our special one.
		if((focusedWindow.tabs.length == 1) && !creatingTab) {
			creatingTab = true;
			chrome.tabs.create({"active": true}, function(tab){
				creatingTab = false;
			});
		}
	});
}

// Boot it up and schedule functions for events.
updateTabs();
chrome.tabs.onCreated.addListener(updateTabs);
chrome.tabs.onRemoved.addListener(updateTabs);

