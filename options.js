// GDB TODO probably remove the "open_in_tab" from the manifest once everything is working happily again
// Setting key constants (populated in populateSettingKeys)
let SettingKeys = {};

// #region Event handlers
// Page load
document.addEventListener('DOMContentLoaded', async () =>
{
	await populateSettingKeys();
	await loadOptions();
});
// Save button click
document.querySelector("#btnSave").addEventListener("click", saveOptions);

// Pinned URL button clicks
document.querySelector("#btnPresetDefault").addEventListener("click", () => { presetButtonClicked("chrome://newtab/") });
document.querySelector("#btnPresetBlankLight").addEventListener("click", () => { presetButtonClicked(chrome.runtime.getURL("Resources/blankLight.html")) });
document.querySelector("#btnPresetBlankDark").addEventListener("click", () => { presetButtonClicked(chrome.runtime.getURL("Resources/blankDark.html")) });

// User changing pinned URL field value (doesn't fire when a button is clicked, so we trigger it manually in that case).
document.querySelector("#inptPinnedURL").addEventListener("input", boldSelectedButton);
// #endregion Event handlers

//gdbdoc
async function populateSettingKeys()
{
	const settings = await chrome.storage.session.get("SettingKeys");
	SettingKeys = settings["SettingKeys"];
}

//gdbdoc
async function loadOptions()
{
	const settings = await chrome.storage.sync.get([SettingKeys.PinnedURL, SettingKeys.NoFocusPinnedTab]);
	
	const pinnedURL = settings[SettingKeys.PinnedURL];
	document.getElementById("inptPinnedURL").value = pinnedURL;
	boldSelectedButton();
	
	const noFocusPinnedTab = settings[SettingKeys.NoFocusPinnedTab];
	document.getElementById("chkNoFocus").checked = noFocusPinnedTab;
}

//gdbdoc
function saveOptions()
{
	const pinnedURL = document.getElementById("inptPinnedURL").value;
	const noFocusPinnedTab = document.getElementById("chkNoFocus").checked;

	chrome.storage.sync.set({
		[SettingKeys.NoFocusPinnedTab]: noFocusPinnedTab,
		[SettingKeys.PinnedURL]: pinnedURL
	});
	
	var status = document.getElementById("status");
	status.innerHTML = "Options Saved.";
	setTimeout(
		function() {
			status.innerHTML = "";
		},
		750
	);
}

//gdbdoc
function presetButtonClicked(pinnedURL)
{
	document.getElementById("inptPinnedURL").value = pinnedURL;
	boldSelectedButton();
}

//gdbdoc
function boldSelectedButton() { 
	const newValue = document.querySelector("#inptPinnedURL").value;
	
	let buttonId = "";
	switch (newValue)
	{
		case "chrome://newtab/":
			buttonId = "btnPresetDefault";
			break;
		case chrome.runtime.getURL("Resources/blankLight.html"):
			buttonId = "btnPresetBlankLight"; // GDB TODO at the very least just calculate these URLs the once and store that off somewhere
			break;
		case chrome.runtime.getURL("Resources/blankDark.html"):
			buttonId = "btnPresetBlankDark";
			break;
	}

	// Clear any old boldings
	document.querySelectorAll("button[pinnedURLPreset").forEach(button => {
		button.classList.remove("selectedButton");
	});

	// Bold the new matching button
	if (buttonId)
	{ 
		const button = document.getElementById(buttonId);
		if (button)
		{ 
			button.classList.add("selectedButton");
		}
	}
};
