
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
// Note: this needs to be last, children have ids++
const moveFromGroupContextMenuItem:     chrome.contextMenus.CreateProperties = { title: "Move to TabGroup", parentId: tabGroupContextMenuId, id: "100" };
const moveChildContextMenuItem:         chrome.contextMenus.CreateProperties = { title: "Move child", parentId: moveFromGroupContextMenuItem.id, id: undefined };

let tabs: TabCreationProperties[] = [];

//#endregion



//#region Listeners


chrome.contextMenus.onClicked.addListener(
    async (info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab | undefined) => 
        await EventHandler.onClickHandler(info, tab)
);

chrome.runtime.onInstalled.addListener(
    async (details: chrome.runtime.InstalledDetails) => {
        await init();
    }
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
    await addOptsToContextMenu(activeTab);
}

async function onActivate(activeInfo: (chrome.tabs.TabActiveInfo | undefined)) {
    if(activeInfo == undefined) return;
    console.log("activate", activeInfo);

    //
    //  This unfortunate mess is to get around the tab being locked 
    //  and un-queryable during the change/load event. 
    //  todo: Remove me / add retry error handling
    //
    setTimeout(async () => {
        var activeTab = await chrome.tabs.get(activeInfo.tabId);

        await addOptsToContextMenu(activeTab);
    }, onLoadDelay);

}




async function addOptsToContextMenu(activeTab: chrome.tabs.Tab) {
    tabs = [];
    const isInTabGroup = !(activeTab?.groupId === 0 || activeTab?.groupId === -1);

    console.log("setupContextMenu", activeTab, isInTabGroup);

    const tabGroup: (chrome.tabGroups.TabGroup | undefined) = isInTabGroup
        ? await chrome.tabGroups.get(activeTab.groupId)
        : undefined;


    console.log("clear down any previous extension context options", activeTab, isInTabGroup);
    chrome.contextMenus.removeAll();

    console.log("add top extension context option aka first option", activeTab, isInTabGroup);
    chrome.contextMenus.create(tabGroupContextMenuItem);
    tabs.push(tabGroupContextMenuItem as TabCreationProperties)




    /**
     * Gets current tabs open
     * Gets all groups 
     */
    const tabGroups = await ChromeClient.getCurrentWindowTabGroups(activeTab.windowId);

    if(tabGroups != undefined && tabGroups.length > 0) {
        console.log("add context option aka first option", activeTab, isInTabGroup);
        chrome.contextMenus.create(moveFromGroupContextMenuItem);
        tabs.push(moveFromGroupContextMenuItem as TabCreationProperties);

        let newTabId = Number(moveFromGroupContextMenuItem.id) + 1;
        console.log("tabgroups", tabGroups);

        tabGroups.forEach(tab => {
            // dont add yo'self to context options 
            if(tab.id == tabGroup?.id) return;  

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

            tabs.push(myMoveChild);
            
            newTabId++;
        });
    }



    if (isInTabGroup) {
        let removeItem = removeFromGroupContextMenuItem;
        const tabGroupTitle = tabGroup?.title == undefined || tabGroup.title.length == 0 
            ? `unnamed` 
            : tabGroup.title;
        removeItem.title = `${removeFromTitle} (${tabGroupTitle})`;
        // removeItem.title = `Remove From (${tabGroup?.title})`;
        chrome.contextMenus.create(removeItem);
        tabs.push(removeItem as TabCreationProperties);

    } else {
        chrome.contextMenus.create(newGroupContextMenuItem);
        tabs.push(newGroupContextMenuItem as TabCreationProperties);
    }
}

//#endregion

//#region Interfaces

interface TabCreationProperties extends chrome.contextMenus.CreateProperties {
    tabGroupId: number | undefined
}

//#endregion


//#region Classes


class EventHandler {

    public static async onClickHandler(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab | undefined) {
        if(tab == undefined) {
            console.error(`Tab is null yo.. `, info);
            return;
        }
    
        console.log("info", info);
        console.log("tab",tab);
        console.log("tabs",tabs);
        var clicked = tabs.find(x => x.id == info.menuItemId);
        console.log("clicked",clicked);
        
        try {
            const menuItemId = clicked?.id;
            switch(true)
            {
                case removeFromGroupContextMenuItem.id === menuItemId: {
                    var activeTab = await ChromeClient.getActiveTab(); 
                    if(activeTab.id == undefined) return;
                    
                    // await chrome.tabs.ungroup(activeTab.id)
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
                    
                    // await chrome.tabs.group({
                    //     tabIds: [ tab.id ], 
                    //     groupId: group?.id 
                    // } as chrome.tabs.GroupOptions)
                    if(tab.id == undefined) break;

                    await ChromeClient.addToGroup(tab.id, group?.id)

                    break;
                }
                case newGroupContextMenuItem.id == menuItemId: {
                    console.log("new click");

                    const activeTab = await ChromeClient.getActiveTab(); 
                    if(activeTab.id == undefined) return;

                    await ChromeClient.addToGroup(activeTab.id, undefined)
                    // await chrome.tabs.group({
                    //     tabIds: [ activeTab.id ]
                    // } as chrome.tabs.GroupOptions)
                    
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


//#endregion
