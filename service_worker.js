// #region Constants
const SettingKeys = {
	PinnedURL: 			"KeepOnePinnedTab_PinnedURL",
	NoFocusPinnedTab:	"KeepOnePinnedTab_NoFocusPinnedTab",

	// These are keys that were used only by older ways of storing our settings - they can be removed in a while.
	PinnedTabPage:	"KeepOnePinnedTab_PinnedTabPage",
	CustomURL:		"KeepOnePinnedTab_CustomPinnedTabURL",
	LegacyKey:		"KeepOnePinnedTab_NewTabPage",
};

let lastTabId = -1

// Stick these keys into session storage so the settings can grab them too.
chrome.storage.session.set({ "SettingKeys": SettingKeys });
// #endregion Constants

// #region Event Listeners
/**
 * Whenever a new tab is created, make sure its window has all of the tabs we need.
 * https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onCreated
 * @param {Tab} tab The tab that was created.
 */
chrome.tabs.onCreated.addListener((tab) =>
{
	keepNeededTabs(tab.windowId);
});

chrome.tabs.onUpdated.addListener((tab) =>
{
	console.log(tab)
})

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
 * When a tab is detached from a window, check that window - if all that's left
 * is our special pinned tab, close it to avoid leaving behind a useless window.
 * https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onDetached
 * @param {number} tabId ID of the tab that was detached (not used)
 * @param {object} detachInfo An object, we use these properties:
 * 					.oldWindowId - ID of the window that the tab was detached from.
 */
chrome.tabs.onDetached.addListener(async (tabId, detachInfo) =>
{
	const detachedWindow = await getWindow(detachInfo.oldWindowId);
	if (!detachedWindow)
		return;

	if (detachedWindow.tabs.length != 1) // Window has other tabs
		return;
	if (!isSpecialPinnedTab(detachedWindow.tabs[0], await getPinnedURL())) // Not our special pinned tab
		return;

	try
	{
		chrome.windows.remove(detachedWindow.id);
	}
	catch (error)
	{
		// The above sometimes fails on attaching a new tab to an existing window, because onDetached fires
		// on attaching (because it's getting detached from its temporary window, I guess?) - but we don't
		// care because that temporary window is already closed (which was our goal).
		console.log(error);
	}
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
	if (activeTab.index !== 0) { // Not the first tab
		lastTabId = activeInfo.tabId;
		return;
	}
	if (!isSpecialPinnedTab(activeTab, await getPinnedURL())) // Not our special pinned tab
		return;

	await unfocusTab(activeTab);
});

/**
 * Fires when the sync storage (where our settings live) changes, so we can update things as needed.
 * https://developer.chrome.com/docs/extensions/reference/api/storage#event-onChanged
 * @param {object} changes Contains all changed keys with oldValue/newValue inside.
 */
chrome.storage.onChanged.addListener(async (changes) =>
{
	// Only need to worry about updating things if something about the pinned tab URL changed.
	if (!changes[SettingKeys.PinnedURL])
		return;

	const { oldValue, newValue } = changes[SettingKeys.PinnedURL];
	const oldPinnedURL = oldValue;
	const newPinnedURL = newValue;

	const windows = await chrome.windows.getAll({ "populate": true, "windowTypes": ["normal"] });
	for (const window of windows) {
		convertWindow(window, oldPinnedURL, newPinnedURL);
	}
});

/**
 * Every .05m (3s), make sure all windows have the tabs they need
 * (handles stuff like detached tabs that don't reliably get it otherwise).
 */
chrome.alarms.create("KOPT_MainLoop", {
	periodInMinutes: .05,
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
async function keepNeededTabs(targetWindowId)
{
	if (!targetWindowId)
		return;

	const targetWindow = await getWindow(targetWindowId);
	if (!targetWindow)
		return

	// Safety check to make sure we're not creating infinite tabs
	if (targetWindow.tabs.length > 50)
		return;

	const pinnedURL = await getPinnedURL();

	// Safety checks
	if (pinnedURL == "")
		return;
	if (targetWindow.type != "normal")
		return;

	// Make sure our special pinned tab is the first one in the window.
	if (!isSpecialPinnedTab(targetWindow.tabs[0], pinnedURL))
	{
		try
		{
			chrome.tabs.create({
				"windowId": targetWindow.id,
				"url": pinnedURL,
				"index": 0,
				"pinned": true,
				"active": false
			});
		}
		catch (error)
		{
			// The above can sometimes fail if the user is actively dragging a tab, but we'll run this whole thing
			// again shortly so we can just fail silently.
			return;
		}

		// Since new windows always have at least 1 tab to begin with, if we just added a pinned tab the
		// window is guaranteed to have 2 (so we won't need to add an additional tab below).
		return;
	}

	// Make sure we have at least 1 additional tab with our pinned tab (as a window with only our pinned
	// tab will close if the user tries to close that tab). Ignore tabs collapsed in a group so we're not
	// forcing those groups to uncollapse if we're unfocusing the pinned tab.
	const visibleTabs = await getVisibleTabs(targetWindow);
	if (visibleTabs.length < 2)
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
function isSpecialPinnedTab(tab, urlToCheck)
{
	if (!urlToCheck)
		return true; // Treat no URL at all (which really shouldn't happen) as if it's our special tab to avoid infinite tab creation.
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
 * Get an array of all of the "visible" tabs in the given window.
 * Here, "visible" means that the tab is not inside a collapsed group.
 * @param {Window} window The window to get tabs from
 * @returns Array of all "visible" tabs.
 */
async function getVisibleTabs(window)
{
	if (!window || (window == undefined))
		return null;

	const visibleTabs = [];
	for (const tab of window.tabs) {
		if(await isTabVisible(tab))
			visibleTabs.push(tab);
	}

	return visibleTabs;
}

/**
 * Check whether a tab is "visible" (i.e. not inside a collapsed group).
 * @param {Tab} tab Tab to check
 * @returns true/false - is the tab "visible"?
 */
async function isTabVisible(tab)
{
	if (!tab || (tab == undefined))
		return false;

	// No group - tab can't be collapsed inside of one, so it must be "visible".
	if (tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE)
		return true;

	const group = await getGroup(tab.groupId);
	if (!group)
		return true;

	return !group.collapsed;
}

/**
 * Try to "unfocus" the given tab (which is assumed to be our special pinned tab),
 * by trying to focus the next tab in the window.
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

	// We want to ape Ctrl+Tab, jumping to the next tab that's NOT inside a collapsed group -
	// focusing a tab in a collapsed group forces that group to uncollapse, which is probably
	// not what the user wants.
	const visibleTabs = await getVisibleTabs(window);
	if (visibleTabs.length >= 2)
	{
		// We have at least 1 uncollapsed tab (beyond our special pinned one) to focus - use that.
		// If lastTab is same as the next tab to switch, switch to the last tab in list
		const nextTab = (visibleTabs[1].id == lastTabId ? visibleTabs[visibleTabs.length-1] : visibleTabs[1]).id
		tryFocusTab(nextTab, 20); // We're assuming index 0 is our special pinned tab.
	}
	else
	{
		// If we don't have another uncollapsed tab, get one created instead.
		keepNeededTabs(window.id);
	}
}

/**
 * Try to focus the specified tab.
 * @param {string} tabId The ID of the tab to focus.
 * @param {number} retriesToAllow How many times we can try (if we fail each time)
 * @param {number} retriesSoFar How many times we've retried so far (only called by this function)
 */
async function tryFocusTab(tabId, retriesToAllow = 0, retriesSoFar = 0) {
	// Make sure the tab still exists - if not, give up.
	const tab = await chrome.tabs.get(tabId);
	if (!tab || (tab === undefined))
		return;

	// Try to focus the tab.
	try
	{
		await chrome.tabs.update(tabId, { active: true });
	}
	catch (error)
	{
		// Give up after about 2 seconds.
		if (retriesSoFar > retriesToAllow)
			return;

		// Sometimes this fails if the user doesn't let go of the button quick enough - try again.
		setTimeout(() =>
		{
			tryFocusTab(tabId, retriesToAllow, retriesSoFar + 1);
		}, 100);
	}
}

/**
 * "Convert" a window over to a new pinned tab URL (replacing the old pinned tab with a new one).
 * Used when our settings change.
 * @param {Window} targetWindow The window object to convert
 * @param {string} oldPinnedURL The URL that we were previously using for our special pinned tabs
 * @param {string} newPinnedURL The URL that we now want to use for our special pinned tabs
 */
async function convertWindow(targetWindow, oldPinnedURL, newPinnedURL) {
	const firstTab = targetWindow.tabs[0];
	if(!isSpecialPinnedTab(firstTab, oldPinnedURL))
		return;

	chrome.tabs.update(
		firstTab.id,
		{
			"url": newPinnedURL
		}
	);
}


// #region Chrome object getters
/**
 * Convenience wrapper for getting a window that handles bad (generally just-closed) window IDs without
 * throwing extension-level errors. Callers are expected to handle the returned null value appropriately instead.
 * @param {number} windowId ID of the window to get
 * @returns Window object matching the given ID.
 */
async function getWindow(windowId)
{
	if ((windowId == "") || (windowId == undefined))
		return null;

	try
	{
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
	catch (error)
	{
		console.log("Failed to get window with ID: " + windowId.toString());
		return null;
	}
}

/**
 * Convenience wrapper for getting a tab group that handles bad (generally just-closed) group IDs without
 * throwing extension-level errors. Callers are expected to handle the returned null value appropriately instead.
 * @param {number} groupId ID of the group to get
 * @returns TabGroup object matching the given ID.
 */
async function getGroup(groupId)
{
	if ((groupId == "") || (groupId == undefined))
		return null;

	try
	{
		const group = await chrome.tabGroups.get(groupId);
		if (!group || (group == undefined))
			return null;

		return group;
	}
	catch (error)
	{
		console.log("Failed to get group with ID: " + groupId.toString());
		return null;
	}

}
// #endregion Chrome object getters

// #region Settings getters
/**
 * Determine whether we should prevent our special pinned tab from getting focus (based on the user's settings).
 * @returns true/false - should we block the pinned tab getting focus?
 */
async function shouldBlockPinnedTabFocus()
{
	return getSingleSyncSetting(SettingKeys.NoFocusPinnedTab);
}

/**
 * Get the URL we should use for our special pinned tab, handling older settings and a default value.
 * @returns The URL we should use for our pinned tab.
 */
async function getPinnedURL()
{
	// First, see if it's already populated.
	let pinnedURL = await getSingleSyncSetting(SettingKeys.PinnedURL);
	if (pinnedURL) // Setting populated, good to go!
		return pinnedURL;

	// Next, try generating it from the older version of our settings.
	if (await convertFromLegacySettings())
		return await getSingleSyncSetting(SettingKeys.PinnedURL); // Settings should have been updated by the conversion.

	// Finally, fall back to our default.
	return "chrome://newtab/";
}

/**
 * Try to convert older versions of our settings (where page and custom URL were stored separately)
 * to our new one (where the URL is a single setting).
 * @returns true if we successfully converted old settings to new ones, false otherwise.
 */
async function convertFromLegacySettings()
{
	const settings = await chrome.storage.sync.get([SettingKeys.PinnedTabPage, SettingKeys.CustomURL]);
	if (!settings[SettingKeys.PinnedTabPage] && !settings[SettingKeys.CustomURL])
		return false; // Nothing stored at all, probably a brand-new installation.

	// Determine simple URL from the previous combination of settings.
	let pinnedURL = "";
	switch (settings[SettingKeys.PinnedTabPage])
	{
		case "Default":
			pinnedURL = "chrome://newtab/";
			break;
		case "BlankLight":
			pinnedURL = chrome.runtime.getURL("Resources/blankLight.html");
			break;
		case "BlankDark":
			pinnedURL = chrome.runtime.getURL("Resources/blankDark.html");
			break;
		case "Custom":
			pinnedURL = settings[SettingKeys.CustomURL];
			break;
	}

	// Something went wrong, don't touch the settings and use the default value instead.
	if (!pinnedURL)
		return false;

	// Save the new setting to storage, and get rid of the old ones.
	await chrome.storage.sync.set({ [SettingKeys.PinnedURL]: pinnedURL });
	await chrome.storage.sync.remove([SettingKeys.PinnedTabPage, SettingKeys.CustomURL]);
	await chrome.storage.sync.remove(SettingKeys.LegacyKey); // Can remove soon - this is just to make sure this gets removed as we didn't do that in previous conversions.

	return true;
}

/**
 * Convenience wrapper that just retrieves a single setting from sync storage.
 * @param {string} settingKey Sync key for the setting you want.
 * @returns Value for the requested setting
 */
async function getSingleSyncSetting(settingKey)
{
	if (settingKey == "")
		return null;

	const settings = await chrome.storage.sync.get(settingKey);
	return settings[settingKey];
}
// #endregion Settings getters
