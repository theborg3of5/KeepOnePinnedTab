﻿// #region Constants
// GDB TODO figure out how to share these with the options page.
// Options for which sort of pinned tab we keep.
const PinnedTabPage_Default    = "Default";
const PinnedTabPage_BlankLight = "BlankLight";
const PinnedTabPage_BlankDark  = "BlankDark";
const PinnedTabPage_Custom     = "Custom";

// Keys that we use to index into the sync storage.
const KOPT_NoFocusTab = "KeepOnePinnedTab_NoFocusPinnedTab";
const KOPT_Page       = "KeepOnePinnedTab_PinnedTabPage";
const KOPT_CustomURL = "KeepOnePinnedTab_CustomPinnedTabURL";
const KOPT_PinnedURL = "KeepOnePinnedTab_PinnedURL";
// #endregion Constants

// #region Event Listeners
/** 
 * On window creation, make sure the new window gets all of the tabs we need.
 * https://developer.chrome.com/docs/extensions/reference/api/windows#event-onCreated
 * @param {Window} newWindow New window object, we use these properties:
 * 					.id - Window ID
 */
chrome.windows.onCreated.addListener((newWindow) => { 
	keepNeededTabs(newWindow.id);
});

/**
 * Whenever a tab is closed, make sure its window has all of the tabs we need.
 * https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onRemoved
 * @param {number} _tabId The ID of the tab that was closed (not used)
 * @param {object} removeInfo An object, we use these properties:
 * 						.windowId        - ID of the window that the closed tab was in
 * 						.isWindowClosing - true if the entire window is closing
 */
chrome.tabs.onRemoved.addListener((_tabId, removeInfo) => 
{
	// If the window is closing (as in the user is trying to close the whole window) then just let it happen.
	if (removeInfo.isWindowClosing)
		return;
	
	keepNeededTabs(removeInfo.windowId);
});

/**
 * Whenever a tab gets activated, check if it's our pinned tab and try to deactivate it if so.
 * https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onActivated
 * @param activeInfo An object, we use these properties:
 * 			.tabId - ID of the activated tab
 */
chrome.tabs.onActivated.addListener(async (activeInfo) =>
{ 
	// We only care about activations if we're trying to block activation of our pinned tab.
	if (!await shouldBlockPinnedTabFocus())
		return;
	
	const activeTab = await chrome.tabs.get(activeInfo.tabId);
	if (!activeTab || (activeTab == undefined))
		return;
	if (!activeTab.active) // Not active anymore
		return;
	if (activeTab.index !== 0) // Not the first tab
		return;
	if (!isSpecialPinnedTab(activeTab, await getPinnedURL())) // Not our special pinned tab
		return;
	
	await unfocusTab(activeTab);
});

/**
 * Fires when the sync storage (where our settings live) changes, so we can update things as needed.
 * https://developer.chrome.com/docs/extensions/reference/api/storage#event-onChanged
 * @param {object} changes Contains all changed keys with oldValue/newValue inside.
 */
chrome.storage.onChanged.addListener((changes) =>
{
	// Only need to worry about updating things if something about the pinned tab URL changed.
	if (!changes[KOPT_PinnedURL])
		return;

	const { oldValue, newValue } = changes[KOPT_PinnedURL]; // GDB TODO finish converting everything over (conversion and the like) to new simplified settings node
	const oldPinnedURL = oldValue;
	const newPinnedURL = newValue;

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
});

/** 
 * Every quarter-minute (15s), make sure all windows have the tabs they need 
 * (handles stuff like detached tabs that don't reliably get it otherwise). 
 */
chrome.alarms.create("windowCreateFinish", {
	periodInMinutes: .25,
	when: Date.now()
});
chrome.alarms.onAlarm.addListener(async () =>
{
	const windows = await chrome.windows.getAll({ "populate": true, "windowTypes": ["normal"] });
	windows.forEach(window => { keepNeededTabs(window.id) });
});
// #endregion Event Listeners


/**
 * Core logic: check the given window to make sure it has our special pinned tab and 
 * at least 1 additional tab.
 * @param {number} targetWindowId - ID of the window to check
 */
async function keepNeededTabs(targetWindowId) {
	if(!targetWindowId)
		return;
	
	const targetWindow = await getWindow(targetWindowId);
	if (!targetWindow || (targetWindow == undefined) )
		return

	const pinnedURL = await getPinnedURL();
	
	// Safety checks
	if(pinnedURL == "")
		return;
	if(targetWindow.type != "normal")
		return;
	
	// Make sure our special pinned tab is the first one in the window.
	if (!isSpecialPinnedTab(targetWindow.tabs[0], pinnedURL))
	{
		chrome.tabs.create({
			"windowId": targetWindow.id,
			"url":      pinnedURL,
			"index":    0,
			"pinned":   true,
			"active":   false
		});
		
		// Since new windows always have at least 1 tab to begin with, if we just added a pinned tab the
		// window is guaranteed to have 2 (so we won't need to add an additional tab below).
		return;
	}

	// Make sure we have at least 1 additional tab with our pinned tab (as a window with only our pinned
	// tab will close if the user tries to close that tab).
	if (targetWindow.tabs.length < 2)
	{ 
		chrome.tabs.create({
			"windowId": targetWindow.id,
			"active":   true
		});
	}
}

/**
 * Check whether the given tab is our special pinned one (a pinned tab with our specific URL).
 * @param {Tab} tab The tab to check
 * @param {string} urlToCheck The URL the tab should have
 * @returns true/false - is the given tab our special pinned one?
 */
function isSpecialPinnedTab(tab, urlToCheck) { // GDB TODO rename (honestly most of these functions)
	if (urlToCheck == "")
		return false;
	if(!tab || (tab == undefined) )
		return false;
	if(!tab.pinned)
		return false;
	
	// Make sure the tab has (or will have once it loads) our target URL.
	if ((tab.url.indexOf(urlToCheck) === -1) && (tab.pendingUrl.indexOf(urlToCheck) === -1))
		return false;
	
	return true;
}

/**
 * Try to "unfocus" the given tab (by trying to focus the second tab in the window).
 * @param {Tab} tab Tab object, we use these properties:
 * 					.windowId - The tab's parent window ID
 */
async function unfocusTab(tab)
{ 
	if (!tab || (tab == undefined))
		return;

	const window = await getWindow(tab.windowId);
	if (!window)
		return;

	// Safety check: make sure there should be a tab there to focus.
	if(window.tabs.length < 2)
		return;
	
	// Focus the following tab. // GDB TODO reword setting on settings page to just be about keyboard focus (because I can't block mouse focus for some reason)
	chrome.tabs.update(window.tabs[1].id, { active: true }); // GDB TODO figure out a way to mitigate (or at least suppress?) the error when clicking on the tab
}

/**
 * "Convert" a window over to a new pinned tab URL (replacing the old pinned tab with a new one).
 * Used when our settings change.
 * @param {Window} targetWindow The window object to convert
 * @param {string} oldPinnedURL The URL that we were previously using for our special pinned tabs
 * @param {string} newPinnedURL The URL that we now want to use for our special pinned tabs
 */
async function convertWindow(targetWindow, oldPinnedURL, newPinnedURL) {
	var firstTab = targetWindow.tabs[0];
	if(!isSpecialPinnedTab(firstTab, oldPinnedURL))
		return;
	
	chrome.tabs.update(
		firstTab.id,
		{
			"url": newPinnedURL
		}
	);
}

/**
 * Convenience wrapper for getting a window that just makes sure we return easy-to-deal-with values (null, not
 * undefined) in weird situations.
 * @param {number} windowId ID of the window to get
 * @returns Window object matching the given ID.
 */
async function getWindow(windowId)
{
	if (windowId == "")
		return null;

	const window = await chrome.windows.get(
		windowId,
		{
			"populate": true,
			"windowTypes": ["normal"]
		}
	);
	if (!window || (window == undefined))
		return null;

	return window;
}


// #region Settings getters
/**
 * Determine whether we should prevent our special pinned tab from getting focus (based on the user's settings).
 * @returns true/false - should we block the pinned tab getting focus?
 */
async function shouldBlockPinnedTabFocus()
{
	return new Promise(
		(resolve) =>
		{
			chrome.storage.sync.get(KOPT_NoFocusTab,
				(settings) =>
				{
					resolve(settings[KOPT_NoFocusTab] ?? false);
				}
			)
		}
	);
}

/**
 * Get the URL we should use for our special pinned tab.
 * @returns Promise that resolves into the URL we should use for our pinned tab.
 */
async function getPinnedURL() {
	return new Promise((resolve, reject) =>	{
		chrome.storage.sync.get([KOPT_Page, KOPT_CustomURL],
			(settings) => {
				resolve(calculatePinnedURL(settings));
			}
		)
	});
}

/**
 * Figure out what the pinned tab URL should be based on the give sync settings.
 * @param {object} settings Sync storage object with the KOPT_Page and KOPT_CustomURL items on it.
 * @returns The URL to use for our pinned tab.
 */
function calculatePinnedURL(settings) {
	switch (settings[KOPT_Page])
	{
		case PinnedTabPage_BlankLight:
			return chrome.runtime.getURL("Resources/blankLight.html");
		case PinnedTabPage_BlankDark:
			return chrome.runtime.getURL("Resources/blankDark.html");
		case PinnedTabPage_Custom:
			return settings[KOPT_CustomURL];
		case PinnedTabPage_Default:
		default:
			return "chrome://newtab/";
	}
}
// #endregion Settings getters

