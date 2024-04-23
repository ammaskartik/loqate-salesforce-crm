public with sharing class loqEmailController {
    public loqEmailController() {

    }

    @AuraEnabled
        public static String loqUpdateEmailAddress(String validemail, String ObjectName, String ObjId, String mapStr )
        {
            try {
                sObject queryRecord;
                  queryRecord=Schema.getGlobalDescribe().get(ObjectName).newSObject(ObjId);
                  queryRecord.put(mapstr, validemail);
                  Upsert queryRecord;
                      //Return Success Message
                      return 'Record Updated Successfully ::'+ObjId;
                
            } catch (Exception e) {
                System.debug(String.valueOf(e));
                      //Return Exception as String
                    return 'Unable to update record.\n Please try manually updating the email.\n Error:'+String.valueOf(e);
            }

        }
}