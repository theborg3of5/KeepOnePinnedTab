var pinnedTabURL = "";
var nextCreateTabTriggersKeep = false;



function startup() {
	chrome.storage.sync.get(
		[
			KOPT_Page,
			KOPT_CustomURL,
			KOPT_LegacyKey // Old
		],
		function(items) {
			pinnedTabURL = getPinnedURLFromStorage(items);
			
			chrome.windows.getAll(
				{
					"populate":    true, 
					"windowTypes": ["normal"]
				},
				function(windows){
					for(var i = 0; i < windows.length; i++)
						keepSpecialTabs(windows[i].id);
				}
			);
		}
	);	
}

function getPinnedURLFromStorage(items) {
	var pageToPin = items[KOPT_Page];
	
	// Old style of storage (remove eventually)
	var oldStyleURL = items[KOPT_LegacyKey];
	if( (oldStyleURL != undefined) && (oldStyleURL != "") )
		return oldStyleURL;
	
	return getURLFromPage(pageToPin);
}
function getURLFromPage(pageToPin) {
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

function keepSpecialTabs(targetWindowId) {
	if(!targetWindowId)
		return;
	
	chrome.windows.get(
		targetWindowId,
		{
			"populate":    true,
			"windowTypes": ["normal"]
		},
		function(targetWindow) {
			keepPinnedTab(targetWindow);
			keepAdditionalTab(targetWindow);
		}
	);
}

function keepPinnedTab(targetWindow) {
	if(pinnedTabURL == "")
		return;
	if(targetWindow.type != "normal")
		return;
	
	if(needPinnedTab(targetWindow))
		createPinnedTab(targetWindow);
}
function needPinnedTab(targetWindow) {
	if(targetWindow == undefined)
		return false;
	
	if(isOurTab(targetWindow.tabs[0])) // Our desired tab already exists.
		return false; 
	
	return true;
}
function isOurTab(tab, urlToCheck = pinnedTabURL) {
	if(!tab)
		return false;
	
	if(!tab.pinned)
		return false;
	
	if(tab.url.indexOf(urlToCheck) == -1)
		return false;
	
	return true;
}
function createPinnedTab(targetWindow) {
	// Spawn our special tab. Stick it at the beginning and pin it, but don't focus it.
	chrome.tabs.create(
		{
			"windowId": targetWindow.id,
			"url":      pinnedTabURL,
			"index":    0,
			"pinned":   true,
			"active":   false
		}
	);
}

function keepAdditionalTab(targetWindow) {
	if(targetWindow.type != "normal")
		return;
	
	if(needAdditionalTab(targetWindow))
		createAdditionalTab(targetWindow);
}
function needAdditionalTab(targetWindow) {
	if(targetWindow.tabs.length > 1)
		return false;
	
	return true;
}
function createAdditionalTab(targetWindow) {
	chrome.tabs.create(
		{
			"active": true
		}
	);
}


function windowCreated(newWindow) {
	nextCreateTabTriggersKeep = true;
}

function tabRemoved(tabId, removeInfo) {
	if(removeInfo.isWindowClosing)
		return;
	
	keepSpecialTabs(removeInfo.windowId);
}

function tabDetached(tabId, detachInfo) {
	chrome.windows.get(
		detachInfo.oldWindowId,
		{
			"populate": true
		},
		closeWindowOnDetachLastRealTab
	);
}
function closeWindowOnDetachLastRealTab(detachedWindow) {
	if(!detachedWindow)
		return;
	
	if(detachedWindow.tabs.length != 1)
		return;
		
	if(!isOurTab(detachedWindow.tabs[0]))
		return;
	
	chrome.windows.remove(detachedWindow.id);
}

function tabCreated(tab) {
	if(nextCreateTabTriggersKeep) {
		nextCreateTabTriggersKeep = false;
		keepSpecialTabs(tab.windowId);
	}
}

function storageChanged() {
	chrome.storage.sync.get(
		[
			KOPT_Page,
			KOPT_CustomURL,
			KOPT_LegacyKey // Old
		],
		function(items) {
			var oldPinnedURL = pinnedTabURL;
			pinnedTabURL = getPinnedURLFromStorage(items);
			
			if(oldPinnedURL == pinnedTabURL)
				return;
			
			convertAllWindows(oldPinnedURL, pinnedTabURL);
		}
	);
}
function convertAllWindows(oldPinnedURL, newPinnedURL) {
	chrome.windows.getAll(
		{
			"populate":    true, 
			"windowTypes": ["normal"]
		},
		function(windows){
			for(var i = 0; i < windows.length; i++) {
				convertWindow(windows[i], oldPinnedURL, newPinnedURL);
			}
		}
	);
}
function convertWindow(targetWindow, oldPinnedURL, newPinnedURL) {
	var firstTab = targetWindow.tabs[0];
	if(!isOurTab(firstTab, oldPinnedURL))
		return;
	
	chrome.tabs.update(
		firstTab.id,
		{
			"url": newPinnedURL
		}
	);
}



startup();



chrome.windows.onCreated.addListener(windowCreated);

// chrome.tabs.onActivated.addListener(tabActivated); // GDB TODO - implement to have setting, so that the tab in question shoves focus away from itself.
chrome.tabs.onCreated.addListener(tabCreated);
chrome.tabs.onDetached.addListener(tabDetached);
chrome.tabs.onRemoved.addListener(tabRemoved);

chrome.storage.onChanged.addListener(storageChanged);
















// function tabActivated(activeInfo)
	// {
	// if(typeof activeInfo.windowId != 'undefined') chrome.windows.get(activeInfo.windowId, { "populate": true },
		// function (window)
			// {
			// if(window.tabs[0].active == true)
				// {
				// if(newTab == true) chrome.tabs.create({"windowId": window.id, "url": "chrome://newtab", "active": true});
				// else chrome.tabs.update(window.tabs[1].id, {active: true});
				// }
			// });
	// }