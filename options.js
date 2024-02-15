// #region Globals
// Setting key constants
let SettingKeys = {};

// Mapping from URL to preset button ID (used to bold the matching button)
const urlToPresetButtonMap = {};
// #endregion Globals

// #region Event handlers
// Page load
document.addEventListener('DOMContentLoaded', async () =>
{
	await populateSettingKeys();
	await loadOptions();
	
	// Add (and add click handlers to) pinned URL preset buttons
	addPresetButton("btnPresetDefault", "Default", "chrome://newtab/");
	addPresetButton("btnPresetBlankLight", "Blank Light", chrome.runtime.getURL("Resources/blankLight.html"));
	addPresetButton("btnPresetBlankDark", "Blank Dark", chrome.runtime.getURL("Resources/blankDark.html"));
	boldSelectedButton();
});
// Save button click
document.querySelector("#btnSave").addEventListener("click", saveOptions);

// User changing pinned URL field value (preset buttons don't fire this).
document.querySelector("#inptPinnedURL").addEventListener("input", boldSelectedButton);
// #endregion Event handlers


/**
 * Grab our sync settings keys from the session storage (set by service_worker).
 */
async function populateSettingKeys()
{
	const settings = await chrome.storage.session.get("SettingKeys");
	SettingKeys = settings["SettingKeys"];
}

/**
 * Load the user's settings from sync storage and populate the fields with them.
 */
async function loadOptions()
{
	const settings = await chrome.storage.sync.get([SettingKeys.PinnedURL, SettingKeys.NoFocusPinnedTab]);
	
	const pinnedURL = settings[SettingKeys.PinnedURL];
	document.getElementById("inptPinnedURL").value = pinnedURL;
	
	const noFocusPinnedTab = settings[SettingKeys.NoFocusPinnedTab];
	document.getElementById("chkNoFocus").checked = noFocusPinnedTab;
}

/**
 * Save the current settings to sync storage.
 */
function saveOptions()
{
	const pinnedURL = document.getElementById("inptPinnedURL").value;
	const noFocusPinnedTab = document.getElementById("chkNoFocus").checked;

	chrome.storage.sync.set({
		[SettingKeys.NoFocusPinnedTab]: noFocusPinnedTab,
		[SettingKeys.PinnedURL]: pinnedURL
	});
	
	// Flash an indicator to let the user know we saved.
	const status = document.getElementById("divStatus");
	status.innerHTML = "Options Saved.";
	setTimeout(() => { status.innerHTML = ""; }, 750);
}

/**
 * Generate and add a preset button to the page, including its click handler.
 * Also adds to urlToPresetButtonMap.
 * @param {string} id ID for the new button
 * @param {string} caption Caption for the new button
 * @param {string} url Pinned URL that we should blow in when this button is clicked
 */
function addPresetButton(id, caption, url)
{ 
	// Create the button
	const button = document.createElement("button");
	button.id = id;
	button.innerText = caption;
	button.classList.add("pinnedURLPresetButton");

	// Add click handler
	button.addEventListener("click", () =>
	{ 
		document.getElementById("inptPinnedURL").value = url;
		boldSelectedButton();
	});

	// Add to presets container
	document.querySelector("#spnPresetButtons").appendChild(button);

	// Add URL-to-button-ID mapping
	urlToPresetButtonMap[url] = id;
}

/**
 * Bold the preset button (if any) that matches the current URL in the field.
 */
function boldSelectedButton() { 
	// Clear bold from all buttons
	document.querySelectorAll("button.pinnedURLPresetButton").forEach(button => {
		button.classList.remove("selectedButton");
	});
	
	// Bold the new matching button
	const newURL = document.querySelector("#inptPinnedURL").value;
	const buttonId = urlToPresetButtonMap[newURL];
	if (buttonId)
	{ 
		const button = document.getElementById(buttonId);
		if (button)
		{ 
			button.classList.add("selectedButton");
		}
	}
};
