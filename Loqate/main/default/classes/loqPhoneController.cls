public with sharing class loqPhoneController {
    public loqPhoneController() {

    }
    @AuraEnabled(cacheable=true)
    public static List<Country__c> getCountryList() {
        return [
            SELECT Id, Name, ISO2_Code__c,ISO3_Code__c 
            FROM Country__c
        ];
    }

    @AuraEnabled
        public static String loqUpdatePhone(String validphone, String ObjectName, String ObjId, String mapStr )
        {
            try {
                sObject queryRecord;
                  queryRecord=Schema.getGlobalDescribe().get(ObjectName).newSObject(ObjId);
                  queryRecord.put(mapstr, validPhone);
                  Upsert queryRecord;
                      //Return Success Message
                      return 'Record Updated Successfully ::'+ObjId;
                
            } catch (Exception e) {
                System.debug(String.valueOf(e));
                      //Return Exception as String
                    return 'Unable to update record.\n Please try manually updating the phone.\n Error:'+String.valueOf(e);
            }

        }

        


}