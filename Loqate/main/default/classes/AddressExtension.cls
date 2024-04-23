public with sharing class AddressExtension {
    private final PostcodeAnywhereSettings__c settings;
    private final List<PostcodeAnywhereFields__c> fieldList;
    private final List<PostcodeAnywhereCountries__c> countryLists;  
    
    private string addressName;
    private sObject subjectRecord;
    private sObject queryRecord;
    private boolean fieldsQueried;
    
    public List<PostcodeAnywhereFields__c> Fields {get;set;}
    public Map<string, object> FieldValues { get;set; }
    
    public AddressExtension() {
        settings = PostcodeAnywhereSettings__c.getOrgDefaults();
        fieldList = PostcodeAnywhereFields__c.getAll().values();
        countryLists = PostcodeAnywhereCountries__c.getAll().values();
        addressName = '';
        fieldsQueried = false;
        
        FieldValues = new Map<string, object>();
    }
    
    public string getKey() {
        return settings.Key__c;
    }
    
    public string getCountryCodes() {
        List<string> codes = new List<string>();
        List<CountryIndex> countryIndexList = new List<CountryIndex>();
        
        for (PostcodeAnywhereCountries__c country : countryLists)
            countryIndexList.add(new CountryIndex(country));
            
        countryIndexList.sort();
        
        for (CountryIndex countryIndex : countryIndexList)
            codes.add(countryIndex.Country.Name);
        
        return string.join(codes, ',');
    }
    
    public boolean getCountryByIP() {
        return settings.CountryByIP__c;
    }
    
    public string getAddressName() {
        return addressName;
    }
    
    public void setAddressName(string input) {
        if (addressName == input)
            return;
        
        addressName = input;
       
        system.debug(addressName);
        
        FilterFields();
    } 
    
    public sObject getSubjectRecord() {
        return subjectRecord;
    }
    
    public String getSubjectRecordType() {
        return subjectRecord.getSObjectType().getDescribe().getName();
    }
    
    public void setSubjectRecord(sObject input) {
        if (subjectRecord != null && input != null && subjectRecord.Id == input.Id)
            return;
        
        subjectRecord = input;
        
        system.debug(subjectRecord);
        
        if (fieldsQueried || subjectRecord.Id == null)
            return;
        
        system.debug('Adding extra fields');
        
        List<string> fieldsList = new List<string>();
        
        for (PostcodeAnywhereFields__c field : Fields)
            fieldsList.add(Field.Field__c);
        
        string additionalFieldQuery = 'SELECT ' + string.join(fieldsList, ',') +  ' FROM ' + subjectRecord.getSObjectType().getDescribe().getName() + ' WHERE Id = \'' + subjectRecord.Id + '\'';
        
        system.debug(additionalFieldQuery);
        
        try {
            queryRecord = Database.query(additionalFieldQuery);
            
            system.debug(queryRecord);
      
            QueryFieldValues();            
        }
        catch (QueryException e) {
            system.debug(e);
            system.debug('Could not get existing field values');
        }
    }
    
    private void FilterFields() {
        Fields = new List<PostcodeAnywhereFields__c>();
        
        for (PostcodeAnywhereFields__c field : fieldList) {
            if (field.Address__c == addressName)
                Fields.add(field);
        }
        
        for (PostcodeAnywhereFields__c field : Fields) {
            if (!FieldValues.containsKey(field.Field__c))
                FieldValues.put(field.Field__c, '');
        }
        
        system.debug('Filter fields');
        system.debug(FieldValues);
    }
    
    public Map<String, PostcodeAnywhereFields__c> getSortedFields() {
        Map<String, PostcodeAnywhereFields__c> sortedList = new Map<String, PostcodeAnywhereFields__c>();
        List<AddressFieldIndex> addressFieldIndexList = new List<AddressFieldIndex>();
       
        for (PostcodeAnywhereFields__c field : Fields)
            addressFieldIndexList.add(new AddressFieldIndex(field));
            
        addressFieldIndexList.sort();
        
        Integer counter = 1;
        
        for (AddressFieldIndex addressFieldIndex : addressFieldIndexList)
        {
            String strCounter;
            if(counter < 10)
                strCounter = '0' + counter;
            else
                strCounter = '' + counter;
            sortedList.put(strCounter + '. ' + addressFieldIndex.Field, addressFieldIndex.Field);
            counter++;
        }
    
        return sortedList;
    }
    
    private void QueryFieldValues() {
        for (PostcodeAnywhereFields__c field : Fields) {
            object fieldValue = GetFieldValue(field.Field__c);
            FieldValues.put(field.Field__c, fieldValue != null ? fieldValue : '');
        }
        
        fieldsQueried = true;
        
        system.debug('Query fields');
        system.debug(FieldValues);
    }
    
    public pageReference UpdateAddressFields() {
        system.debug('Postcode Anywhere updating fields');

        system.debug(FieldValues);
        
        for (PostcodeAnywhereFields__c field : Fields) 
            SetFieldValue(field.Field__c, FieldValues.get(field.Field__c));
        
        return null;
    }
    
    private object GetFieldValue(string field) {
        try {
            return queryRecord.get(field);
        }
        catch (SObjectException e) {
            system.debug('Failed to get ' + field + ' value');
            system.debug(e);
            return null;
        }
    }  
    
    private void SetFieldValue(string field, object value) {
        system.debug('Postcode Anywhere updating ' + field + ' with value ' +  string.valueOf(value));
        
        try {
            subjectRecord.put(field, value);
        }
        catch (SObjectException e) {
            //try double for a lat long or number
            try {
                subjectRecord.put(field, double.valueOf(value));
            }
            catch (TypeException invalidDouble) {
                system.debug(string.valueOf(value) + ' is not a Lat/Long');
            }
            catch (SObjectException failed) {
                system.debug('Failed to set ' + field + ' with value ' +  string.valueOf(value));
            }
        }
    }
}