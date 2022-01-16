
export class RuntimeEventHandler {



    public async onInstalled(): Promise<void>  {
        const addToGroupContextMenuId = "1";
        const addToGroupContextMenuItem = { "title": "Add To Group", "id": addToGroupContextMenuId };
        const newGroupContextMenuItem = { "title": "New", "parentId": addToGroupContextMenuId, "id": "11" };
        
        chrome.contextMenus.removeAll();
    
        chrome.contextMenus.create(addToGroupContextMenuItem);
    
        chrome.contextMenus.create(newGroupContextMenuItem);
    
    }

}