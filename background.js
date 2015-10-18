var creatingTab = false;

function keepSpecialPinned() {
	if(!creatingTab) {
		chrome.windows.getAll({populate: true}, function(windows){
			// Snag the current window from the masses.
			var window;
			for(var i = 0; i < windows.length; i++) {
				if(windows[i].focused) {
					window = windows[i];
					break;
				}
			}
			
			// Don't check the tabs of apps and popups.
			if(window.type === "normal") {
				// Make sure we've got our special tab in place.
				var firstTab = window.tabs[0];
				if(!firstTab.pinned || (firstTab.url.indexOf("chrome://newtab/") == -1) ) {
					
					// Spawn our special tab. Stick it at the beginning, pin it, and don't focus it.
					creatingTab = true;
					chrome.tabs.create({"index": 0, "pinned": true, "active": false}, function(tab) {
						creatingTab = false;
					});
					
				}
				
				// Ensure that there's at least one tab after our special one.
				if(getTotalNumberOfTabs(windows) === 1) {
					creatingTab = true;
					chrome.tabs.create({"active": true}, function(tab){
						creatingTab = false;
					});
				}
			}
		});
	}
}

function getTotalNumberOfTabs(windows) {
	var tab_count = 0;
	for (var i = 0;  i < windows.length; i++) {
		tab_count += windows[i].tabs.length;
	}
	
	return tab_count;
}

// Boot it up and schedule functions for events.
keepSpecialPinned();
chrome.tabs.onCreated.addListener(keepSpecialPinned);
chrome.tabs.onRemoved.addListener(keepSpecialPinned);
chrome.tabs.onUpdated.addListener(tabUpdated);

