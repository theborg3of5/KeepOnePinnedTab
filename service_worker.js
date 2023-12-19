// #region Constants
// Options for which sort of pinned tab we keep.
var PinnedTabPage_Default    = "Default";
var PinnedTabPage_BlankLight = "BlankLight";
var PinnedTabPage_BlankDark  = "BlankDark";
var PinnedTabPage_Custom     = "Custom";

// Actual URLs for the non-custom pinned tab options.
var PinnedTabURL_Default    = "chrome://newtab/";
var PinnedTabURL_BlankLight = chrome.runtime.getURL("Resources/blankLight.html");
var PinnedTabURL_BlankDark  = chrome.runtime.getURL("Resources/blankDark.html");

// Keys that we use to index into the sync storage.
var KOPT_NoFocusTab = "KeepOnePinnedTab_NoFocusPinnedTab";
var KOPT_Page       = "KeepOnePinnedTab_PinnedTabPage";
var KOPT_CustomURL  = "KeepOnePinnedTab_CustomPinnedTabURL";
// #endregion Constants


var NoFocusPinnedTab        = false;
var PinnedTabURL            = "";
var NextCreateTriggersKeep  = false;


function startup() {
	chrome.storage.sync.get(
		[
			KOPT_NoFocusTab,
			KOPT_Page,
			KOPT_CustomURL,
		],
		function(items) {
			updateSettings(items);
			updateAllWindows();
		}
	);
}

function updateSettings(items) {
	PinnedTabURL = getPinnedURL(items);
	NoFocusPinnedTab = items[KOPT_NoFocusTab];
}
function getPinnedURL(items) {
	var pageToPin = items[KOPT_Page];
	
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

function updateAllWindows() {
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
			if(!keepPinnedTab(targetWindow)) // Only check for the additional tab if we didn't just create a pinned one.
				keepAdditionalTab(targetWindow);
		}
	);
}

function keepPinnedTab(targetWindow) {
	if(PinnedTabURL == "")
		return false;
	if(targetWindow.type != "normal")
		return false;
	
	if(needPinnedTab(targetWindow)) {
		createPinnedTab(targetWindow);
		return true; // Created a new pinned tab
	}
	
	return false;
}
function needPinnedTab(targetWindow) {
	if(targetWindow == undefined)
		return false;
	if(isOurTab(targetWindow.tabs[0])) // Our desired tab already exists.
		return false; 
	
	return true;
}
function isOurTab(tab, urlToCheck = PinnedTabURL) {
	if(!tab)
		return false;
	if(!tab.pinned)
		return false;
	if((tab.url.indexOf(urlToCheck) === -1) && (tab.pendingUrl.indexOf(urlToCheck) === -1))
		return false;
	
	return true;
}
function createPinnedTab(targetWindow) {
	chrome.tabs.create(
		{
			"windowId": targetWindow.id,
			"url":      PinnedTabURL,
			"index":    0,
			"pinned":   true,
			"active":   false
		},
		catchTabCreateError
	);
}
function catchTabCreateError(tab) {
	if(!tab) // Most likely, the window doesn't exist anymore (because last tab was closed).
		var lastError = chrome.runtime.lastError; // check lastError so Chrome doesn't output anything to the console.
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
			"windowId": targetWindow.id,
			"active":   true
		},
		catchTabCreateError
	);
}

/**
 * GDBTODO
 * https://developer.chrome.com/docs/extensions/reference/api/windows#event-onCreated
 * @param {gdbtodo} newWindow gdbtodo
 */
function windowCreated(newWindow) {
	NextCreateTriggersKeep = true;
}

/**
 * gdbtodo
 * https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onActivated
 * @param gdbtodo activeInfo gdbtodo
 */
function tabActivated(activeInfo) {
	if(NoFocusPinnedTab)
		chrome.windows.get(
			activeInfo.windowId,
			{
				"populate":    true,
				"windowTypes": ["normal"]
			},
			function(targetWindow) {
				if(ourTabIsFocused(targetWindow))
					unfocusPinnedTab(targetWindow);
			}
		);
}
function ourTabIsFocused(targetWindow) {
	var firstTab = targetWindow.tabs[0];
	
	if(!targetWindow)
		return false;
	if(!isOurTab(firstTab))
		return false;
	if(!firstTab.active)
		return false;
	
	return true;
}
function unfocusPinnedTab(targetWindow) {
	if(targetWindow.tabs.length < 2)
		return;
	
	chrome.tabs.update(
		targetWindow.tabs[1].id,
		{
			active: true
		}
	);
}

/**
 * gdbtodo
 * https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onCreated
 * @param gdbtodo tab 
 */
function tabCreated(tab) {
	if(NextCreateTriggersKeep) {
		NextCreateTriggersKeep = false;
		keepSpecialTabs(tab.windowId);
	}
}

/**
 * gdbtodo
 * https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onDetached
 * @param gdbtodo tabId gdbtodo
 * @param gdbtodo detachInfo gdbtodo
 */
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

/**
 * Fires whenever a tab is closed.
 * https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onRemoved
 * @param {number} _tabId The ID of the tab that was closed (not used)
 * @param {object} removeInfo An object with a .windowId property containing the window ID.
 */
function tabRemoved(_tabId, removeInfo) {
	if(removeInfo.isWindowClosing)
		return;
	
	keepSpecialTabs(removeInfo.windowId);
}

/**
 * Fires when the local storage (where our settings are kept) change.
 * https://developer.chrome.com/docs/extensions/reference/api/storage#event-onChanged
 */
function storageChanged() {
	chrome.storage.sync.get(
		[
			KOPT_NoFocusTab,
			KOPT_Page,
			KOPT_CustomURL,
		],
		function(items) {
			var oldPinnedURL = PinnedTabURL;
			
			updateSettings(items);
			
			if(oldPinnedURL == PinnedTabURL)
				return;
			
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
	);
}

/**
 * 
 * @param {Window} targetWindow The window object to convert
 * @param {string} oldPinnedURL The URL that we were previously using for our special pinned tabs
 * @param {string} newPinnedURL The URL that we now want to use for our special pinned tabs
 */
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
chrome.tabs.onActivated.addListener(tabActivated);
chrome.tabs.onCreated.addListener(tabCreated);
chrome.tabs.onDetached.addListener(tabDetached);
chrome.tabs.onRemoved.addListener(tabRemoved);
chrome.storage.onChanged.addListener(storageChanged);
