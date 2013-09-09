var creatingTab = false;

function keepSpecialPinned() {
	if(!creatingTab) {
		chrome.windows.getCurrent({populate: true}, function(window){
			// Make sure we've got our special tab in place.
			var firstTab = window.tabs[0];
			if(!firstTab.pinned || firstTab.url !== "chrome://newtab/") {
				// Make our special tab. Stick it at the beginning, pin it, and don't focus it.
				creatingTab = true;
				chrome.tabs.create({"index": 0, "pinned": true, "active": false}, function(tab) {
					creatingTab = false;
				});
			}
			
			// Ensure that there's at least one tab after our special one.
			if(window.tabs.length === 1) {
				chrome.tabs.create({"active": true});
			}
			
			// Close any new-page-tabs that are not the special one or the current one.
			chrome.tabs.getSelected(null, function(tab) {
				for(var i =  window.tabs.length - 1; i > 1; i--) {
					if(window.tabs[i].id !== tab.id && window.tabs[i].url === "chrome://newtab/") {
						chrome.tabs.remove(window.tabs[i].id);
					}
				}
			});
		});
	}
}

// If our special tab was the one activated, then switch away, not for you!
function tabActivated(activeInfo) {
	chrome.windows.getCurrent({populate: true}, function(window){
		if(!creatingTab && window.tabs[0].id === activeInfo.tabId && window.tabs[0].pinned && window.tabs[0].url === "chrome://newtab/") {
			chrome.tabs.update(window.tabs[1].id, {active: true});
		}
	});
}

// Boot it up and schedule functions for events.
keepSpecialPinned();
chrome.tabs.onCreated.addListener(keepSpecialPinned);
chrome.tabs.onRemoved.addListener(keepSpecialPinned);
chrome.tabs.onActivated.addListener(tabActivated);

