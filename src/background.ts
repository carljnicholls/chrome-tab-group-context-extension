
//#region Interfaces

interface TabCreationProperties extends chrome.contextMenus.CreateProperties {
    tabGroupId: number | undefined
}

//#endregion

//#region Classes

class EventHandler {

    /**
     * Triggered when user clicks on the context menu
     * @param info 
     * @param tab 
     * @returns 
     */
    public static async onClickHandler(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab | undefined) {
        if(tab == undefined) {
            console.error(`Tab is null yo.. `, info);
            return;
        }
        
        console.log("info", info);
        console.log("tab",tab);
        console.log("tabs",state.getTabs());
        var clicked = state.getTabs().find(x => x.id == info.menuItemId);
        console.log("clicked",clicked);
        
        try {
            const menuItemId = clicked?.id;
            switch(true)
            {
                case removeFromGroupContextMenuItem.id === menuItemId: {
                    var activeTab = await ChromeClient.getActiveTab(); 
                    if(activeTab.id == undefined) return;
                    
                    ChromeClient.removeFromGroup(activeTab.id);
                    
                    await init();
                    
                    break;
                }
                case tabGroupContextMenuItem.id === menuItemId
                        || addToGroupContextMenuItem.id === menuItemId
                        || moveFromGroupContextMenuItem.id === menuItemId:
                    break;
                case Number(moveFromGroupContextMenuItem.id) < Number(menuItemId):
                {
                    console.log("move", info, tab);
                    
                    const tabGroups = await ChromeClient.getCurrentWindowTabGroups(tab.windowId);
                    const group = tabGroups.find(x => x.title == clicked?.title);
                    console.log("group", group);
                    
                    if(tab.id == undefined) break;

                    await ChromeClient.addToGroup(tab.id, group?.id)

                    break;
                }
                case newGroupContextMenuItem.id == menuItemId: {
                    console.log("new click");

                    const activeTab = await ChromeClient.getActiveTab(); 
                    if(activeTab.id == undefined) return;

                    await ChromeClient.addToGroup(activeTab.id, undefined)
                    
                    break;
                }
                default: 
                    break;
            }
    
            await init();
    
        } catch (error) {
            console.error(error);
        }
    }
}


/**
 * Wrapper class for chrome api calls
 */
class ChromeClient {
    private static readonly classname = 'ChromeClient';

    public static async getActiveTab(): Promise<chrome.tabs.Tab> {
        const methodName = `${this.classname}.getActiveTab()`;
        try {
            var currentTab = await chrome.tabs.query({active: true});
            console.log(`${methodName}`, currentTab);
    
            if(currentTab == undefined || currentTab.length === 0) throw new Error("Current Tab is undefined");
            if(currentTab[0].id === -1) throw new Error("Current tab not valid -1");
    
            return currentTab[0];
    
        } catch (error) {
            console.error(`${methodName} ${error}`, error);
            throw error;
        }
    }

    public static async getCurrentWindowTabGroups(windowId: number): Promise<chrome.tabGroups.TabGroup[]> {
        return await chrome.tabGroups.query({
            windowId: windowId
        } as chrome.tabGroups.QueryInfo);
    }

    public static async addToGroup(tabId: number, groupId: number | undefined): Promise<void> {
        await chrome.tabs.group({
            tabIds: [ tabId ], 
            groupId: groupId
        } as chrome.tabs.GroupOptions)
    }

    public static async removeFromGroup(tabId: number): Promise<void> {
        await chrome.tabs.ungroup(tabId);
    }
}

class StateManager {
    private tabs: TabCreationProperties[] = [];

    getTabs(): TabCreationProperties[] {
        return this.tabs;
    }
    
    addTab(tabGroupContextMenuItem: chrome.contextMenus.CreateProperties): void {
        if(this.tabs == undefined) this.tabs = [];

        this.tabs.push(tabGroupContextMenuItem as TabCreationProperties);
    }
    
}

class ContextMenuManager {
    
    static async addOptions(activeTab: chrome.tabs.Tab) {
        const isInTabGroup = !(activeTab?.groupId === 0 || activeTab?.groupId === -1);

        console.log("setupContextMenu", activeTab, isInTabGroup);

        const tabGroup: (chrome.tabGroups.TabGroup | undefined) = isInTabGroup
            ? await chrome.tabGroups.get(activeTab.groupId)
            : undefined;

        console.log("clear down any previous extension context options", activeTab, isInTabGroup);
        chrome.contextMenus.removeAll();

        console.log("add top extension context option aka first option", activeTab, isInTabGroup);
        chrome.contextMenus.create(tabGroupContextMenuItem);
        state.addTab(tabGroupContextMenuItem);



        /**
         * Gets current tabs open
         * Gets all groups 
         */
        const tabGroups = await ChromeClient.getCurrentWindowTabGroups(activeTab.windowId);

        if(tabGroups != undefined && tabGroups.length > 0) {
            console.log("add context option aka first option", activeTab, isInTabGroup);
            chrome.contextMenus.create(moveFromGroupContextMenuItem);
            state.addTab(moveFromGroupContextMenuItem);

            let newTabId = Number(moveFromGroupContextMenuItem.id) + 1;
            console.log("tabgroups", tabGroups);

            tabGroups.forEach(tab => {
                // dont add yo'self to context options 
                if(tab.id == tabGroup?.id) return;  

                const childContextOption = ContextMenuManager.createChildContextOption(tab, newTabId);

                state.addTab(childContextOption);
                newTabId++;
            });
        }

        if (isInTabGroup) {
            let removeItem = removeFromGroupContextMenuItem;
            const tabGroupTitle = tabGroup?.title == undefined || tabGroup.title.length == 0 
                ? `unnamed` 
                : tabGroup.title;
            removeItem.title = `${removeFromTitle} (${tabGroupTitle})`;
            chrome.contextMenus.create(removeItem);
            state.addTab(removeItem);

        } else {
            chrome.contextMenus.create(newGroupContextMenuItem);
            state.addTab(newGroupContextMenuItem);
        }
    }

    private static createChildContextOption(tab: chrome.tabGroups.TabGroup, newTabId: number): TabCreationProperties {
        const moveChild = moveChildContextMenuItem;
        moveChild.title = tab.title ?? moveChild.title;
        moveChild.id = newTabId.toString();

        chrome.contextMenus.create(moveChild);

        const myMoveChild = {
            tabGroupId: tab.id,
            title: moveChild.title,
            parentId: moveChild.parentId,
            id: moveChild.id
        } as TabCreationProperties;
        myMoveChild.tabGroupId = tab.id;

        return myMoveChild;
    }
}

//#endregion



//#region variables

const onLoadDelay = 100;

const tabGroupContextMenuId = "1";
// todo: extract title, id to enums

const tabGroupContextMenuItem:          chrome.contextMenus.CreateProperties = { title: "Tab Group", id: tabGroupContextMenuId };
const newGroupContextMenuItem:          chrome.contextMenus.CreateProperties = { 
    title: "New TabGroup", 
    parentId: tabGroupContextMenuId, 
    id: "11", 
};
const addToGroupContextMenuItem:        chrome.contextMenus.CreateProperties = { title: "Add to TabGroup", parentId: tabGroupContextMenuId, id: "21" };
const removeFromTitle = "Remove from";
const removeFromGroupContextMenuItem:   chrome.contextMenus.CreateProperties = { title: removeFromTitle, parentId: tabGroupContextMenuId, id: "31" };

const moveFromGroupContextMenuItem:     chrome.contextMenus.CreateProperties = { title: "Move to TabGroup", parentId: tabGroupContextMenuId, id: "100" };
// Note: this needs to be last, children context options have ids++
const moveChildContextMenuItem:         chrome.contextMenus.CreateProperties = { title: "Move child", parentId: moveFromGroupContextMenuItem.id, id: undefined };

const state = new StateManager();

//#endregion



//#region Event Listeners

/**
 * General Entry points to the applications. 
 * Lifecycle: 
 * Browser Open finished == onInstalled
 * On Tab Change == onActivated
 * Context Menu Click == onClicked
 */

chrome.runtime.onInstalled.addListener(
    async (details: chrome.runtime.InstalledDetails) => {
        await init();
    }
);

chrome.contextMenus.onClicked.addListener(
    async (info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab | undefined) => 
        await EventHandler.onClickHandler(info, tab)
);

chrome.tabs.onActivated.addListener(
    async (activeInfo: chrome.tabs.TabActiveInfo) => {
        await onActivate(activeInfo);
    }
); 

//#endregion



//#region public functions 

async function init() {
    var activeTab = await ChromeClient.getActiveTab(); 
    console.log("init");
    await ContextMenuManager.addOptions(activeTab);
}

async function onActivate(activeInfo: (chrome.tabs.TabActiveInfo | undefined)) {
    if(activeInfo == undefined) return;
    console.log("onActivate", activeInfo);

    //
    //  This unfortunate mess is to get around the tab being locked 
    //  and un-queryable during the change/load event. 
    //  todo: Remove me / add retry error handling
    //
    setTimeout(async () => {
        var activeTab = await chrome.tabs.get(activeInfo.tabId);
        await ContextMenuManager.addOptions(activeTab);
    }, onLoadDelay);
}

//#endregion
