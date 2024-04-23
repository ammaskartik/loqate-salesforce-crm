global with sharing class SettingsController {
    public Setting__c Settings {get;private set;}
    private List<Action__c> CustomActions;
    private final string SettingsMaster = 'Master';
    private boolean NewRecord = false;
    
    global SettingsController(){
        List<Setting__c> SettingsList = [Select Id, Click_License__c, User_License__c, Country_Name_Style__c, Country_List__c, Use_International_Data__c, Use_Royal_Mail_UK_Data__c, Use_Business_Data__c, Use_USPS_Data__c, Royal_Mail_Company__c, Royal_Mail_Reverse__c, USPS_Reverse__c, BACS_Validation__c, Email_Validation__c, Disable_Field_Rearrange__c, Disable_Country_List__c, Disable_Other_Country_Option__c, Hide_Sidebar_Component__c, Default_User_Country__c, Disable_Company_Search__c, Disable_Street_Search__c, Disable_City_Search__c, Disable_State_Search__c, Disable_Postcode_Search__c from Setting__c where Name = :SettingsMaster];
        
        if (SettingsList != null && SettingsList.size() > 0)
            Settings = SettingsList[0];
        else {
            Settings = new Setting__c();
            Settings.Name = SettingsMaster;
            NewRecord = true;
        }
    }
    
    public PageReference UpdateSettings() {
        upsert Settings;
        
        if (NewRecord) {
            SetupStandardIntegrations();
            NewRecord = false;
        }
        
        return null;
    }
    
    public List<Address__c> GetAddressIntegrations() {
        return [select Street_Field__c, City_Field__c, State_Field__c, Postalcode_Field__c, Country_Field__c, Company_Field__c, Admin_Area_Field__c, Id_Field__c, Building_Field__c, Validation_Field__c, Type_Field__c from Address__c where Setting__c = :Settings.Id];
    }
    
    public List<Email_Integration__c> GetEmailIntegrations() {
        return [select Email_Field__c, Validation_Field__c from Email_Integration__c where Setting__c = :Settings.Id];
    }
    
    public List<Payment_Integration__c> GetPaymentIntegrations() {
        return [select Account_Number_Field__c, Bank_BIC_Field__c, Bank_Name_Field__c, Branch_BIC_Field__c, Branch_Name_Field__c, CHAPS_Field__c, Contact_Address_Field__c, Contact_City_Field__c, Contact_Fax_Field__c, Contact_Phone_Field__c, Contact_Postalcode_Field__c, Direct_Debit_Field__c, Faster_Payments_Field__c, Sort_Code_Field__c, Status_Field__c from Payment_Integration__c where Setting__c = :Settings.Id];
    }
    
    public List<Action__c> GetCustomActions() {
        return [select Event__c, Event_Select__c, Code__c from Action__c where Setting__c = :Settings.Id];
    }
    
    global string GetSettingsToJson() {
        String json = '{';

        json += 'StandardKey: "' + Settings.Click_License__c + '"';
        json += ', ';
        json += 'RoyalmailKey: "' + Settings.User_License__c + '"';
        json += ', ';
        json += 'CountryNameStyle: "' + Settings.Country_Name_Style__c + '"';
        json += ', ';
        json += 'CountryList: "' + Settings.Country_List__c + '"';
        json += ', ';
        json += 'UseInternational: ' + Settings.Use_International_Data__c;
        json += ', ';
        json += 'UseRoyalmail: ' + Settings.Use_Royal_Mail_UK_Data__c;
        json += ', ';
        json += 'RoyalmailCompany: ' + Settings.Royal_Mail_Company__c;
        json += ', ';
        json += 'RoyalmailReverse: ' + Settings.Royal_Mail_Reverse__c;
        json += ', ';
        json += 'UseUSPS: ' + Settings.Use_USPS_Data__c;
        json += ', ';
        json += 'USPSReverse: ' + Settings.USPS_Reverse__c;
        json += ', ';
        json += 'UseBusiness: ' + Settings.Use_Business_Data__c;
        json += ', ';
        json += 'UsePayment: ' + Settings.BACS_Validation__c;
        json += ', ';
        json += 'UseEmail: ' + Settings.Email_Validation__c;
        json += ', ';
        json += 'DisableFieldRearrange: ' + Settings.Disable_Field_Rearrange__c;
        json += ', ';
        json += 'DisableCountryList: ' + Settings.Disable_Country_List__c;
        json += ', ';
        json += 'DisableOtherCountryOption: ' + Settings.Disable_Other_Country_Option__c;
        json += ', ';
        json += 'HideSidebarComponent: ' + Settings.Hide_Sidebar_Component__c;
        json += ', ';
        json += 'DefaultUserCountry: ' + Settings.Default_User_Country__c;
        json += ', ';
        json += 'DisableCompanySearch: ' + Settings.Disable_Company_Search__c;
        json += ', ';
        json += 'DisableStreetSearch: ' + Settings.Disable_Street_Search__c;
        json += ', ';
        json += 'DisableCitySearch: ' + Settings.Disable_City_Search__c;
        json += ', ';
        json += 'DisableStateSearch: ' + Settings.Disable_State_Search__c;
        json += ', ';
        json += 'DisablePostcodeSearch: ' + Settings.Disable_Postcode_Search__c;
        json += '}';
        
        return json.replace('"null"', '""');
    }
    
    global string GetAddressIntegrationsToJson() {
        String json = '[';
        
        for (Address__c a :GetAddressIntegrations()) {
            if (json != '[') json += ', ';
        
            json += '{';
            json += 'Street: "' + a.Street_Field__c + '"';
            json += ', ';
            json += 'City: "' + a.City_Field__c + '"';
            json += ', ';
            json += 'State: "' + a.State_Field__c + '"';
            json += ', ';
            json += 'Postcode: "' + a.Postalcode_Field__c + '"';
            json += ', ';
            json += 'Country: "' + a.Country_Field__c + '"';
            json += ', ';
            json += 'Company: "' + a.Company_Field__c + '"';
            json += ', ';
            json += 'Area: "' + a.Admin_Area_Field__c + '"';
            json += ', ';
            json += 'Id: "' + a.Id_Field__c + '"';
            json += ', ';
            json += 'Building: "' + a.Building_Field__c + '"';
            json += ', ';
            json += 'Validation: "' + a.Validation_Field__c + '"';
            json += ', ';
            json += 'Residential: "' + a.Type_Field__c + '"';
            json += '}';
        }
        
        json += ']';
    
        return json.replace('"null"', '""');
    }
    
    //deprecated
    global string GetBusinessIntegrationsToJson() {
        return '[]';
    }
    
    global string GetPaymentIntegrationsToJson() {
        String json = '[';
    
        for (Payment_Integration__c p :GetPaymentIntegrations()) {
            if (json != '[') json += ', ';
        
            json += '{';
            json += 'AccountNumber: "' + p.Account_Number_Field__c + '"';
            json += ', ';
            json += 'SortCode: "' + p.Sort_Code_Field__c + '"';
            json += ', ';
            json += 'BankBIC: "' + p.Bank_BIC_Field__c + '"';
            json += ', ';
            json += 'BankName: "' + p.Bank_Name_Field__c + '"';
            json += ', ';
            json += 'BranchBIC: "' + p.Branch_BIC_Field__c + '"';
            json += ', ';
            json += 'BranchName: "' + p.Branch_Name_Field__c + '"';
            json += ', ';
            json += 'CHAPS: "' + p.CHAPS_Field__c + '"';
            json += ', ';
            json += 'ContactAddress: "' + p.Contact_Address_Field__c + '"';
            json += ', ';
            json += 'ContactCity: "' + p.Contact_City_Field__c + '"';
            json += ', ';
            json += 'ContactFax: "' + p.Contact_Fax_Field__c + '"';
            json += ', ';
            json += 'ContactPhone: "' + p.Contact_Phone_Field__c + '"';
            json += ', ';
            json += 'ContactPostcode: "' + p.Contact_Postalcode_Field__c + '"';
            json += ', ';
            json += 'DirectDebit: "' + p.Direct_Debit_Field__c + '"';
            json += ', ';
            json += 'FasterPayments: "' + p.Faster_Payments_Field__c + '"';
            json += ', ';
            json += 'Validation: "' + p.Status_Field__c + '"';
            json += '}';
        }
        
        json += ']';
    
        return json.replace('"null"', '""');
    }
    
    global string GetEmailIntegrationsToJson() {
        String json = '[';
    
        for (Email_Integration__c e :GetEmailIntegrations()) {
            if (json != '[') json += ', ';
        
            json += '{';
            json += 'Email: "' + e.Email_Field__c + '"';
            json += ', ';
            json += 'Validation: "' + e.Validation_Field__c + '"';
            json += '}';
        }
    
        json += ']';
    
        return json.replace('"null"', '""');
    }
    
    global string GetCustomActionsToJson() {
        String json = '[';
    
        for (Action__c a :GetCustomActions()) {
            if (json != '[') json += ', ';
        
            json += '{';
            json += 'Event: "' + a.Event_Select__c + '"';
            json += ', ';
            json += 'Code: ' + a.Code__c;
            json += '}';
        }
   
        json += ']';
    
        return json.replace('"null"', '""');
    }
    
    public void SetupStandardIntegrations() {
    
        Address__c AccountBilling = new Address__c();
        AccountBilling.Setting__c = Settings.Id;
        AccountBilling.Name = 'Account Billing';
        AccountBilling.Street_Field__c = 'acc17street';
        AccountBilling.City_Field__c = 'acc17city';
        AccountBilling.State_Field__c = 'acc17state';
        AccountBilling.PostalCode_Field__c = 'acc17zip';
        AccountBilling.Country_Field__c = 'acc17country';
        AccountBilling.Company_Field__c = 'acc2';
        insert AccountBilling;
        
        Address__c AccountShipping = new Address__c();
        AccountShipping.Setting__c = Settings.Id;
        AccountShipping.Name = 'Account Shipping';
        AccountShipping.Street_Field__c = 'acc18street';
        AccountShipping.City_Field__c = 'acc18city';
        AccountShipping.State_Field__c = 'acc18state';
        AccountShipping.PostalCode_Field__c = 'acc18zip';
        AccountShipping.Country_Field__c = 'acc18country';
        AccountShipping.Company_Field__c = 'acc2';
        insert AccountShipping;
        
        Address__c ContactMailing = new Address__c();
        ContactMailing.Setting__c = Settings.Id;
        ContactMailing.Name = 'Contact Mailing';
        ContactMailing.Street_Field__c = 'con19street';
        ContactMailing.City_Field__c = 'con19city';
        ContactMailing.State_Field__c = 'con19state';
        ContactMailing.PostalCode_Field__c = 'con19zip';
        ContactMailing.Country_Field__c = 'con19country';
        ContactMailing.Company_Field__c = 'con4';
        insert ContactMailing;
        
        Address__c ContactOther = new Address__c();
        ContactOther.Setting__c = Settings.Id;
        ContactOther.Name = 'Contact Other';
        ContactOther.Street_Field__c = 'con18street';
        ContactOther.City_Field__c = 'con18city';
        ContactOther.State_Field__c = 'con18state';
        ContactOther.PostalCode_Field__c = 'con18zip';
        ContactOther.Country_Field__c = 'con18country';
        ContactOther.Company_Field__c = 'con4';
        insert ContactOther;
        
        Address__c LeadAddress = new Address__c();
        LeadAddress.Setting__c = Settings.Id;
        LeadAddress.Name = 'Lead Address';
        LeadAddress.Street_Field__c = 'lea16street';
        LeadAddress.City_Field__c = 'lea16city';
        LeadAddress.State_Field__c = 'lea16state';
        LeadAddress.PostalCode_Field__c = 'lea16zip';
        LeadAddress.Country_Field__c = 'lea16country';
        LeadAddress.Company_Field__c = 'lea3';
        insert LeadAddress;
        
        Address__c PersonMailing = new Address__c();
        PersonMailing.Setting__c = Settings.Id;
        PersonMailing.Name = 'Person Mailing';
        PersonMailing.Street_Field__c = 'PersonMailingAddressstreet';
        PersonMailing.City_Field__c = 'PersonMailingAddresscity';
        PersonMailing.State_Field__c = 'PersonMailingAddressstate';
        PersonMailing.PostalCode_Field__c = 'PersonMailingAddresszip';
        PersonMailing.Country_Field__c = 'PersonMailingAddresscountry';
        PersonMailing.Company_Field__c = 'acc2';
        insert PersonMailing;
        
        Address__c PersonOther = new Address__c();
        PersonOther.Setting__c = Settings.Id;
        PersonOther.Name = 'Person Other';
        PersonOther.Street_Field__c = 'PersonOtherAddressstreet';
        PersonOther.City_Field__c = 'PersonOtherAddresscity';
        PersonOther.State_Field__c = 'PersonOtherAddressstate';
        PersonOther.PostalCode_Field__c = 'PersonOtherAddresszip';
        PersonOther.Country_Field__c = 'PersonOtherAddresscountry';
        insert PersonOther;
        
        Address__c ContractBilling = new Address__c();
        ContractBilling.Setting__c = Settings.Id;
        ContractBilling.Name = 'Contract Billing';
        ContractBilling.Street_Field__c = 'ctrc25street';
        ContractBilling.City_Field__c = 'ctrc25city';
        ContractBilling.State_Field__c = 'ctrc25state';
        ContractBilling.PostalCode_Field__c = 'ctrc25zip';
        ContractBilling.Country_Field__c = 'ctrc25country';
        ContractBilling.Company_Field__c = 'ctrc7';
        insert ContractBilling;
        
        Email_Integration__c LeadEmail = new Email_Integration__c();
        LeadEmail.Setting__c = Settings.Id;
        LeadEmail.Name = 'Lead';
        LeadEmail.Email_Field__c = 'lea11';
        insert LeadEmail;
        
        Email_Integration__c ContactEmail = new Email_Integration__c();
        ContactEmail.Setting__c = Settings.Id;
        ContactEmail.Name = 'Contact';
        ContactEmail.Email_Field__c = 'con15';
        insert ContactEmail;
        
        Email_Integration__c PersonAccountEmail = new Email_Integration__c();
        PersonAccountEmail.Setting__c = Settings.Id;
        PersonAccountEmail.Name = 'Person Account';
        PersonAccountEmail.Email_Field__c = 'PersonEmail';
        insert PersonAccountEmail;
    }
    
    static testMethod void testSettingsController() {
        SettingsController newMaster = new SettingsController();
        newMaster.Settings.Click_License__c = 'AA11-AA11-AA11-AA11';
        newMaster.UpdateSettings();
        
        SettingsController master = new SettingsController();
        System.AssertEquals(master.Settings.Click_License__c, 'AA11-AA11-AA11-AA11');
        
        master.GetSettingsToJson();
        master.GetAddressIntegrationsToJson();
        master.GetBusinessIntegrationsToJson();
        master.GetPaymentIntegrationsToJson();
        master.GetEmailIntegrationsToJson();
        master.GetCustomActionsToJson();
        master.SetupStandardIntegrations();
    }
}