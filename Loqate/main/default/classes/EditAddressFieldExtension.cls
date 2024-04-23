public class EditAddressFieldExtension {
    private PostcodeAnywhereFields__c field;
    private PostcodeAnywhereAddresses__c address;
    Map<string,Schema.SObjectField> allFields;
    ApexPages.StandardController standardController;
    private integer fieldCount;
    
    public EditAddressFieldExtension(ApexPages.StandardController controller) {
        standardController = controller;
        field = (PostcodeAnywhereFields__c)controller.getRecord();
        fieldCount = PostcodeAnywhereFields__c.getAll().size();
        
        string addressName = field.Address__c;
        
        if (addressName == null)
            addressName = ApexPages.currentPage().getParameters().get('address');
        
        Map<string, PostcodeAnywhereAddresses__c> addresses = PostcodeAnywhereAddresses__c.getAll();
        
        for (PostcodeAnywhereAddresses__c a : addresses.values()) {
            if (a.Name == addressName) {
                address = a;
                break;
            }
        }
        
        if (address != null && address.Object__c != null) {
            Schema.SobjectType objectType = Schema.getGlobalDescribe().get(address.Object__c);
            
            if (objectType != null)
                allFields = objectType.getDescribe().fields.getMap();
        }
    }
    
    public string getObjectName() {
        if (address != null && address.Object__c != null)
            return address.Object__c;
        
        return '';
    }
    
    public string getAllFields() {
        List<string> fields = new List<string>();
        
        if (allFields == null) return '[]';
        
        for (Schema.SObjectField f : allFields.values())
            fields.add(f.getDescribe().getName());
        
        return JSON.serialize(fields);
    }
    
    private string MakeNewCustomFieldName() {
       string prefix = 'Custom_';
       integer suffixNumber = 1;
       
       PostcodeAnywhereSettings__c currentSettings = PostcodeAnywhereSettings__c.getOrgDefaults();
       
       if (currentSettings != null && currentSettings.CustomFieldNumber__c != null)
           suffixNumber = integer.valueOf(currentSettings.CustomFieldNumber__c) + 1;
       
       currentSettings.CustomFieldNumber__c = suffixNumber;
       update currentSettings;
       
       return prefix + string.valueOf(suffixNumber);
    }
    
    public PageReference SaveEdit() {
        if (field.Name == null)
            field.Name = MakeNewCustomFieldName();
        
        standardController.save();
        
        if (address != null && address.Object__c != null) {
            PageReference editAddressPage = Page.EditAddress;
            editAddressPage.getParameters().put('id', address.Id);   
            return editAddressPage;            
        }

        return ReturnAddress();
    }
    
    public PageReference Abort() {
        return ReturnAddress();
    }
    
    private PageReference ReturnAddress() {
        if (address != null && address.Object__c != null) {
            PageReference editAddressPage = Page.EditAddress;
            editAddressPage.getParameters().put('id', address.Id);   
            return editAddressPage;            
        }

        return Page.Management;
    }
}