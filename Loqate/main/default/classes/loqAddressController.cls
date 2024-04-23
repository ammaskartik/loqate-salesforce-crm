public with sharing class loqAddressController {
   
    public loqAddressController() {

    }
    @AuraEnabled
        public static String loqUpdateAddress(String jsonInput, String ObjectName, String ObjId, String mapStr ){
      
        System.debug('LOQATE ADDRESS CONTROLLER START');
        System.debug(jsonInput);
        //Map to process JSON
        Map<String, Object> m = (Map<String, Object>) JSON.deserializeUntyped(jsonInput.replace('\n', ' '));
        //Initializing a List for Loqate Address Mapping Setup
        List <PostcodeAnywhereFields__c> f;
        //Initializing object for Object agnostic update and query
        sObject sObj = Schema.getGlobalDescribe().get(ObjectName).newSObject() ;
        //Initializing a record SObject for Object agnostic update and query
        sObject queryRecord;
        //Field List from Loqate Setup
        List<string> fieldsList = new List<string>();
        //FETCHING THE Setup Values for Address and Response element mapping
        f=[SELECT id,Address__c,Field__c,Value__c FROM PostcodeAnywhereFields__c where Address__c =:mapStr order by id,Address__c,Field__c,Value__c];
        if (f.size()>0) {
            try {
              //SOQL To fetch the record to update
              String qstr='SELECT Id FROM '+ObjectName+ ' WHERE Id = \'' + ObjId + '\'';
              System.debug(qstr);
              queryRecord = Database.query(qstr);
                  //Loop through every address line setup based on mapStr- Address Mapping String eg. 'AccountBilling'
                  System.debug('Mapping String-->'+mapStr+' Rows Returned -->'+f.size());
                  for (PostcodeAnywhereFields__c s : f) {
                    //To handle the mapping with {Line1}\n{Line2}
                      String s2 = s.Value__c.substringBetween('{','}');
                      //Fetch the Response Value from the JSON Response
                      Object itObj = m.get(s2);
                      System.debug('Key-->'+s2+' Setting -->'+s.Field__c+' with -->'+String.valueOf(itObj));
                      //Assigning Values to record Object for each field as per setup
                      queryRecord.put(s.Field__c, String.valueOf(itObj));          
                  }
                  
                    //Execute DML Update
                      Upsert queryRecord;
                      //Return Success Message
                    return 'Record Updated Successfully ::'+ObjId;
                  } catch (Exception e) {
                    //Exception
                      System.debug(String.valueOf(e));
                      //Return Exception as String
                    return 'Unable to update record.\n Please try manually updating the address.\n Error:'+String.valueOf(e);
                  }
            }
        else {
              return '!!!No mapping found for: '+mapStr+'.Unable to update record.\n Please update the address manually. Please get in touch with your Admin';
            }
    }
}