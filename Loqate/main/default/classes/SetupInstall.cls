global class SetupInstall implements InstallHandler {
    global void onInstall(InstallContext context) {
        SetupStandardAddressForms();
    }
    
    public static void SetupStandardAddressForms() {
        List<PostcodeAnywhereAddresses__c> standardAddresses = new List<PostcodeAnywhereAddresses__c>();
        standardAddresses.add(new PostcodeAnywhereAddresses__c(Name='AccountBilling', Object__c='Account'));
        standardAddresses.add(new PostcodeAnywhereAddresses__c(Name='AccountShipping', Object__c='Account'));
        standardAddresses.add(new PostcodeAnywhereAddresses__c(Name='PersonAccountMailing', Object__c='Account'));
        standardAddresses.add(new PostcodeAnywhereAddresses__c(Name='ContactMailing', Object__c='Contact'));
        standardAddresses.add(new PostcodeAnywhereAddresses__c(Name='ContactOther', Object__c='Contact'));
        standardAddresses.add(new PostcodeAnywhereAddresses__c(Name='Lead', Object__c='Lead'));
        insert standardAddresses;
        
        List<PostcodeAnywhereFields__c> standardFields = new List<PostcodeAnywhereFields__c>();
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='AccountBilling', Field__c='BillingStreet', Name='AccountBilling.BillingStreet', Value__c='{Line1}{\\n{Line2}}{\\n{Line3}}{\\n{Line4}}{\\n{Line5}}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='AccountBilling', Field__c='BillingCity', Name='AccountBilling.BillingCity', Value__c='{City}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='AccountBilling', Field__c='BillingState', Name='AccountBilling.BillingState', Value__c='{Province}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='AccountBilling', Field__c='BillingPostalCode', Name='AccountBilling.BillingPostalCode', Value__c='{PostalCode}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='AccountBilling', Field__c='BillingCountry', Name='AccountBilling.BillingCountry', Value__c='{CountryName}'));
        
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='AccountShipping', Field__c='ShippingStreet', Name='AccountShipping.ShippingStreet', Value__c='{Line1}{\\n{Line2}}{\\n{Line3}}{\\n{Line4}}{\\n{Line5}}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='AccountShipping', Field__c='ShippingCity', Name='AccountShipping.ShippingCity', Value__c='{City}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='AccountShipping', Field__c='ShippingState', Name='AccountShipping.ShippingState', Value__c='{Province}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='AccountShipping', Field__c='ShippingPostalCode', Name='AccountShipping.ShippingPostalCode', Value__c='{PostalCode}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='AccountShipping', Field__c='ShippingCountry', Name='AccountShipping.ShippingCountry', Value__c='{CountryName}'));
        
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='PersonAccountMailing', Field__c='PersonMailingStreet', Name='PersonAccountMailing.Street', Value__c='{Line1}{\\n{Line2}}{\\n{Line3}}{\\n{Line4}}{\\n{Line5}}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='PersonAccountMailing', Field__c='PersonMailingCity', Name='PersonAccountMailing.City', Value__c='{City}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='PersonAccountMailing', Field__c='PersonMailingState', Name='PersonAccountMailing.State', Value__c='{Province}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='PersonAccountMailing', Field__c='PersonMailingPostalCode', Name='PersonAccountMailing.PostalCode', Value__c='{PostalCode}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='PersonAccountMailing', Field__c='PersonMailingCountry', Name='PersonAccountMailing.Country', Value__c='{CountryName}'));
        
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='ContactMailing', Field__c='MailingStreet', Name='ContactMailing.MailingStreet', Value__c='{Line1}{\\n{Line2}}{\\n{Line3}}{\\n{Line4}}{\\n{Line5}}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='ContactMailing', Field__c='MailingCity', Name='ContactMailing.MailingCity', Value__c='{City}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='ContactMailing', Field__c='MailingState', Name='ContactMailing.MailingState', Value__c='{Province}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='ContactMailing', Field__c='MailingPostalCode', Name='ContactMailing.MailingPostalCode', Value__c='{PostalCode}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='ContactMailing', Field__c='MailingCountry', Name='ContactMailing.MailingCountry', Value__c='{CountryName}'));
        
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='ContactOther', Field__c='OtherStreet', Name='ContactOther.OtherStreet', Value__c='{Line1}{\\n{Line2}}{\\n{Line3}}{\\n{Line4}}{\\n{Line5}}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='ContactOther', Field__c='OtherCity', Name='ContactOther.OtherCity', Value__c='{City}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='ContactOther', Field__c='OtherState', Name='ContactOther.OtherState', Value__c='{Province}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='ContactOther', Field__c='OtherPostalCode', Name='ContactOther.OtherPostalCode', Value__c='{PostalCode}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='ContactOther', Field__c='OtherCountry', Name='ContactOther.OtherCountry', Value__c='{CountryName}'));
        
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='Lead', Field__c='Street', Name='Lead.Street', Value__c='{Line1}{\\n{Line2}}{\\n{Line3}}{\\n{Line4}}{\\n{Line5}}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='Lead', Field__c='City', Name='Lead.City', Value__c='{City}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='Lead', Field__c='State', Name='Lead.State', Value__c='{Province}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='Lead', Field__c='PostalCode', Name='Lead.PostalCode', Value__c='{PostalCode}'));
        standardFields.add(new PostcodeAnywhereFields__c(Address__c='Lead', Field__c='Country', Name='Lead.Country', Value__c='{CountryName}'));
        insert standardFields;
    }
}