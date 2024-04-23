public class EditAddressExtension {
    private Map<string, PostcodeAnywhereFields__c> fieldsMap;
    private List<PostcodeAnywhereFields__c> fields;
    private PostcodeAnywhereAddresses__c address;
    private Map<string, Schema.SobjectType> allObjectTypes;
    private ApexPages.StandardController standardController;
    private boolean editMode = false;
    
    public string fieldToDelete {get;set;}
    
    public EditAddressExtension(ApexPages.StandardController controller) {
        standardController = controller;
        address = (PostcodeAnywhereAddresses__c)standardController.getRecord();
        fieldsMap = PostcodeAnywhereFields__c.getAll();
        FilterFields();
        allObjectTypes = Schema.getGlobalDescribe();
        
        system.debug(allObjectTypes.size());
        
        editMode = address == null || address.Id == null;
    }
    
    public boolean getIsEdit() {
        return editMode;
    }
    
    public PageReference EditMode() {
        editMode = true;
        return null;
    }
    
    public string getAllSObjects() {
        List<string> allObjectNames = new List<string>();
        
        for (Schema.SobjectType objectType : allObjectTypes.values())
            allObjectNames.add(objectType.getDescribe().getName());
        
        return JSON.serialize(allObjectNames);
    }
    
    public void FilterFields() {
        fields = new List<PostcodeAnywhereFields__c>();
        
        for (PostcodeAnywhereFields__c field : fieldsMap.values()) {
            if (field.Address__c == address.Name)
                fields.add(field);
        }
    }
    
    public List<PostcodeAnywhereFields__c> getFields() {
        return fields;
    }
    
    public PageReference NewField() {
        PageReference newFieldPage = Page.EditAddressField;
        newFieldPage.getParameters().put('address', address.Name);
        return newFieldPage;
    }
    
    public PageReference DeleteField() {
        system.debug(fieldToDelete);
        delete [select id from PostcodeAnywhereFields__c where id = :fieldToDelete];
        fieldsMap = PostcodeAnywhereFields__c.getAll();
        FilterFields();
        return null;
    }
    
    public PageReference Abort() {
        PageReference setupPage = Page.Management;
        return setupPage;
    }
    
    public PageReference SaveEdit() {
        if (address.Name.contains(' ')) {
            address.Name.addError('The Address Name cannont contain spaces');
            return null;
        }
        
        standardController.save();
        editMode = false;
        return null;
    }
}