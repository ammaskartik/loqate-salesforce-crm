@isTest 
private class TestCases {
    static testMethod void testSetup() {
        SetupController controller = new SetupController ();
        
        controller.getSettings();
        controller.getAddresses();
        controller.Save();
        
        controller.setCountryCodes('');
        controller.setCountryCodes('IRL,GBR');
        controller.setCountryCodes('GBR,IRL');
        controller.setCountryCodes('GBR');       
        controller.getCountryCodes();
        controller.Save();
        
        controller.NewAddress();   
            
        List<PostcodeAnywhereAddresses__c> testAddresses;
        testAddresses = [select id from PostcodeAnywhereAddresses__c where Name = 'Test'];
        if (!testAddresses.isEmpty())
            controller.addressToDelete = testAddresses[0].Id;
        controller.DeleteAddress();     
        
        PostcodeAnywhereAddresses__c testAddress = new PostcodeAnywhereAddresses__c(Name='Test', Object__c='Test');
        upsert testAddress;
        
        testAddresses = [select id from PostcodeAnywhereAddresses__c where Name = 'Test'];
        if (!testAddresses.isEmpty())
            controller.addressToDelete = testAddresses[0].Id;
        controller.DeleteAddress();     
        
        controller.Save();
    }
    
    static testMethod void testAddresses() {
        PostcodeAnywhereAddresses__c testAddress = new PostcodeAnywhereAddresses__c(Name='Test', Object__c='Test');
        PostcodeAnywhereFields__c testField = new PostcodeAnywhereFields__c(Name='Test.Test__c', Field__c='Test__c', Address__c='Test');
        
        insert testAddress;
        insert testField;
        
        ApexPages.StandardController sc = new ApexPages.StandardController(testAddress);
        EditAddressExtension extension = new EditAddressExtension(sc);
        extension.getIsEdit();
        extension.EditMode();
        extension.getAllSObjects();
        extension.getFields();
        extension.NewField();
        extension.DeleteField();
        extension.Abort();
        extension.SaveEdit();
    }
    
    static testMethod void testFields() {
        PostcodeAnywhereAddresses__c testAddress = new PostcodeAnywhereAddresses__c(Name='Test', Object__c='Test');
        PostcodeAnywhereFields__c testField = new PostcodeAnywhereFields__c(Name='Test.Test__c', Field__c='Test__c', Address__c='Test');
        
        insert testAddress;
        insert testField;
        
        ApexPages.StandardController sc = new ApexPages.StandardController(testField);
        EditAddressFieldExtension extension = new EditAddressFieldExtension(sc);
        extension.getObjectName();
        extension.getAllFields();
        extension.SaveEdit();
        extension.Abort();
    }
    
    static testMethod void testAddressExtension() {
        PostcodeAnywhereSettings__c testSettings = new PostcodeAnywhereSettings__c (Key__c='AA11-AA11-AA11-AA11');
        PostcodeAnywhereAddresses__c testAddress = new PostcodeAnywhereAddresses__c(Name='Test', Object__c='Account');
        PostcodeAnywhereFields__c testField = new PostcodeAnywhereFields__c(Name='Test.Name', Field__c='Name', Address__c='Test');
        
        insert testSettings;
        insert testAddress;
        insert testField;

        AddressExtension extension = new AddressExtension();
        extension.getKey();
        extension.getCountryCodes();
        extension.getCountryByIP();
        extension.setAddressName('Test');
        extension.getAddressName();
        
        Account testAccount = new Account(Name='Test');
        extension.setSubjectRecord(testAccount);
        extension.getSubjectRecord();
        
        extension.getSortedFields();
        extension.UpdateAddressFields();
    }
}