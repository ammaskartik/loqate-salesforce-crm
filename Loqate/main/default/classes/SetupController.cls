public class SetupController {
    private final PostcodeAnywhereSettings__c settings;
    private Map<string, PostcodeAnywhereCountries__c> countryList;
    Map<string, PostcodeAnywhereCountries__c> newCountryList;
    private List<PostcodeAnywhereCountries__c> countryBinList;
    private Map<string, PostcodeAnywhereAddresses__c> addressList;
    
    public string addressToDelete {get;set;}
    
    public String Host {get;set;}
    public Boolean metadataAPIConnectionOkay {get; set;}
    public String objectType {get; set;}
    public String quickSetupResult {get; set;}
    public Boolean setupPollerEnabled {get; set;}
    
    public List<SelectOption> accountLayouts {get; set;}
    public List<SelectOption> contactLayouts {get; set;}
    public List<SelectOption> leadLayouts {get; set;}
    
    public List<String> accountLayoutFullNames {get; set;}
    public List<String> contactLayoutFullNames {get; set;}
    public List<String> leadLayoutFullNames {get; set;}
    
    public String selectedAccountLayout {get; set;}
    public String selectedContactLayout {get; set;}
    public String selectedLeadLayout {get; set;}
    
    public MetadataService.ApexPage accountClonedPage {get; set;}
    public MetadataService.ApexPage contactClonedPage {get; set;}
    public MetadataService.ApexPage leadClonedPage {get; set;}
    
    public String accountClonedPageName {get; set;}
    public String contactClonedPageName {get; set;}
    public String leadClonedPageName {get; set;}
    
    public Boolean accountCloned {get; set;}
    public Boolean contactCloned {get; set;}
    public Boolean leadCloned {get; set;}
    
    public Boolean accountOverridden {get; set;}
    public Boolean contactOverridden {get; set;}
    public Boolean leadOverridden {get; set;}
    
    
    /**
     * constructor for the SetupController
     */ 
    public SetupController() {
        Host = ApexPages.currentPage().getHeaders().get('Host');
        
        settings = PostcodeAnywhereSettings__c.getOrgDefaults();
        countryList = PostcodeAnywhereCountries__c.getAll();
        addressList = PostcodeAnywhereAddresses__c.getAll();
        
        accountLayoutFullNames = new List<String>();
        contactLayoutFullNames = new List<String>();
        leadLayoutFullNames = new List<String>();
        
        metadataAPIConnectionOkay = false;
        checkMetadataAPIConnection();

        accountCloned = false;
        contactCloned = false; 
        leadCloned = false;
        
        setupPollerEnabled = false;
        quickSetupResult = '';        
    }
    
    
    
    public PostcodeAnywhereSettings__c getSettings() {
        return settings;
    }
    
    
    
    public List<PostcodeAnywhereAddresses__c> getAddresses() {
        addressList.values().sort();
        return addressList.values();
    }
    
    
    
    public PageReference Save() {
        upsert settings;
        
        if (countryBinList != null && countryBinList.size() > 0)
            delete countryBinList;
        
        if (newCountryList != null && newCountryList.size() > 0)
            upsert newCountryList.values();
        
        countryList = PostcodeAnywhereCountries__c.getAll();     
        
        if (addressList.size() == 0)
            SetupInstall.SetupStandardAddressForms();       
        
        addressList = PostcodeAnywhereAddresses__c.getAll();
       
        return null;
    }
    
    
    
    public string getCountryCodes() {
        List<string> codes = new List<string>();
        List<CountryIndex> countryIndexList = new List<CountryIndex>();
        
        for (PostcodeAnywhereCountries__c country : countryList.values())
            countryIndexList.add(new CountryIndex(country));
            
        countryIndexList.sort();
        
        for (CountryIndex countryIndex : countryIndexList)
            codes.add(countryIndex.Country.Name);
        
        return string.join(codes, ',');
    }
    
    
    
    public void setCountryCodes(string codesInput) {
        List<string> codes = codesInput.split(',', 0);
        Set<string> codesCheck = new Set<string>(codes);
        
        newCountryList = new Map<string, PostcodeAnywhereCountries__c>();        
        countryBinList = new List<PostcodeAnywhereCountries__c>();
        
        //check which countries we're removing or keeping
        for (string country : countryList.keySet()) {
            if (!codesCheck.contains(country))
                countryBinList.add(countryList.get(country));
            else
                newCountryList.put(country, countryList.get(country));
        }
        
        //add new countries and update the sort index
        for (integer i = 0; i < codes.size(); i++) {
            if (codes[i] == '') continue;
            
            if (!newCountryList.containsKey(codes[i]))
                newCountryList.put(codes[i], new PostcodeAnywhereCountries__c(Name = codes[i], Index__c = i));
            else
                newCountryList.get(codes[i]).Index__c = i;
        }
    }
    
    
    
    public PageReference NewAddress() {
        return Page.EditAddress;
    }
    
    
    
    public PageReference DeleteAddress() {
        List<PostcodeAnywhereAddresses__c> addresses = [select id, name from PostcodeAnywhereAddresses__c where id = :addressToDelete];
        
        if (addresses.size() == 1) {
            string addressToDeleteName = addresses[0].Name;
            List<PostcodeAnywhereFields__c> fields = [select id from PostcodeAnywhereFields__c where Address__c = :addressToDeleteName];
            delete fields;
            delete addresses;
        }
        
        addressList = PostcodeAnywhereAddresses__c.getAll();
        return null;
    }
    
    
    public void setShowSplashOff() {
        settings.ShowSetupSplash__c = false;
        upsert settings;
    }
    
   	
    
    /**
     * initialises variables
     */ 
    public void init() {   
        refreshLayouts();
        updateClonedStatuses();
        updateStatuses();
    }
    
    
    
    /**
     * determines whether the pages have been cloned or not
     */ 
    public void updateClonedStatuses() {
        
        accountClonedPageName = getClonedPageName('Account');
        contactClonedPageName = getClonedPageName('Contact');
        leadClonedPageName = getClonedPageName('Lead');
        
        if (accountClonedPageName != '') {
            accountClonedPage = MetadataServicePca.getApexPage(accountClonedPageName);
        }
        
        if (contactClonedPageName != '') {
        	contactClonedPage = MetadataServicePca.getApexPage(contactClonedPageName);
        }
        
        if (leadClonedPageName != '') {
        	leadClonedPage = MetadataServicePca.getApexPage(leadClonedPageName);
        }
        
        accountCloned = false;
        contactCloned = false; 
        leadCloned = false;
        
        if (accountClonedPageName != '') accountCloned = true;
        if (contactClonedPageName != '') contactCloned = true;
        if (leadClonedPageName != '') leadCloned = true;
    }
    
    
    public void refreshLayouts() {
        accountLayouts = getLayouts('Account');
        accountLayouts.sort();
        contactLayouts = getLayouts('Contact');
        contactLayouts.sort();
        leadLayouts = getLayouts('Lead');
        leadLayouts.sort();
    }
    
    
    
    /**
     * determines which layouts have been used for cloned pages
     */ 
    public void updateSelectedLayouts() {
        if (accountCloned) {
         	MetadataService.ApexPage accountClonedPage = MetadataServicePca.getApexPage(accountClonedPageName);
            if (accountClonedPage != null && accountClonedPage.Description != null) {
                selectedAccountLayout = accountClonedPage.Description.substringAfter(':');
            }
        }
        if (contactCloned) {
            MetadataService.ApexPage contactPage = MetadataServicePca.getApexPage(contactClonedPageName);
            if (contactClonedPage != null && contactClonedPage.Description != null) {
                selectedContactLayout = contactClonedPage.Description.substringAfter(':');
            }
        }
        if (leadCloned) {
            MetadataService.ApexPage leadPage = MetadataServicePca.getApexPage(leadClonedPageName);
            if (leadClonedPage != null && leadClonedPage.Description != null) {
                selectedLeadLayout = leadClonedPage.Description.substringAfter(':');
            }
        }
    }
    
    
    
    /**
     * checks whether the standard edit button has been overridden for cloned pages
     */ 
    public void updateOverriddenStatuses() {
        accountOverridden = false;        
        contactOverridden = false;
        leadOverridden = false;
        if (hasEditButtonOverridePageName('Account')) accountOverridden = true;
        if (hasEditButtonOverridePageName('Contact')) contactOverridden = true;
        if (hasEditButtonOverridePageName('Lead')) leadOverridden = true;
    }
    
    
    
    /**
     * updates some status variables
     */ 
    public void updateStatuses() {        
        //updateClonedStatuses();
        updateSelectedLayouts();
        updateOverriddenStatuses();
    }
    
    
    
    /**
     * gets all the valid layouts for the specified object type
     * @param objectType	name of the object type (eg 'Account')
     * @returns list of SelectOptions with the layouts
     */ 
    private List<SelectOption> getLayouts(String objectType) {
        System.debug('*############ GETTING LAYOUTS');
        try{    
            List<SelectOption> layoutOptions = new List<SelectOption>();
            if (objectType == 'Account') {
                accountLayoutFullNames.clear();
            }
            else if (objectType == 'Contact') {          
                contactLayoutFullNames.clear();
            }
            else if (objectType == 'Lead') {          
                leadLayoutFullNames.clear();
            }
            List<MetadataService.Layout> layouts = MetadataServicePca.getLayoutsForObject(objectType);
            for(MetadataService.Layout layout : layouts) {
                
                String name = EncodingUtil.urlDecode(layout.fullName.substringAfter('__'), 'UTF-8');
                if (name.contains('__')) {
                    name = name.substringAfter('__');
                }
                layoutOptions.add(new SelectOption(name, name));
                if (objectType == 'Account') {
                    accountLayoutFullNames.add(layout.fullName);
                }
                else if (objectType == 'Contact') {          
                    contactLayoutFullNames.add(layout.fullName);
                }
                else if (objectType == 'Lead') {          
                    leadLayoutFullNames.add(layout.fullName);
                }
            }        
            return layoutOptions;   
        }
        catch(Exception e)
        {
            List<String> vals = new List<String>();
            vals.add(String.valueOf(e.getLineNumber()));
            vals.add(e.getMessage());
            vals.add(e.getStackTraceString());
            String allStrings = '';
            for(String val : vals)
            {
                allStrings = allStrings + val +  '\n' ;
            }
            //Might be due to more than 10 page layouts
            System.debug('******* error : MORE THAN 10 ::' + allStrings);
        }
        return new List<SelectOption>();
    }
    

    
    /**
     * determines if the edit button is overridden for the specified object type
     * @param objectType	name of the object type (eg 'Account')
     * @returns true if the edit button is overridden; otherwise false
     */ 
    public Boolean hasEditButtonOverridePageName(String objectType) {
        Boolean result = false;
        List<MetadataService.ActionOverride> overrides = MetadataServicePca.getButtonOverrides(objectType);
        for (MetadataService.ActionOverride ovrd : overrides) {
            System.debug('***** override : ' + ovrd);
            if (ovrd != null && ovrd.content != null && ovrd.content.contains('pca__')) {
                result = true;
            }
        }
        return result;
    }
    
    
    /**
     * gets the name  of the cloned page for the specified object type
     * @param objectType	name of the object type (eg 'Account')
     * @returns name of the cloned page
     */ 
    public String getClonedPageName(String objectType) {
		String result = '';        
        List<String> pages = MetadataServicePca.getClonedPageNamesForType(objectType);
        //System.debug('#### pages : ' + objectType + ' : ' + pages);
        for (String page : pages) {
            if (page.contains('_pca_clone')) {
                result = page;
                break;
            }
        }
        return result;
    }
    
    
    
    /**
     * performs the page cloning
     */ 
    public void doQuickSetup() {
		
        setupPollerEnabled = true;
        quickSetupResult = '';       
        
        String selectedLayoutName = '';
        if (objectType == 'Account') {
            selectedLayoutName = selectedAccountLayout;
        }
        else if (objectType == 'Contact') {          
            selectedLayoutName = selectedContactLayout;
        }
        else if (objectType == 'Lead') {          
            selectedLayoutName = selectedLeadLayout;
        }
        
        //System.debug('*** selectedLayoutName : ' + selectedLayoutName);
		        
        String resultString = 'Failed!';
        try {
            List<MetadataService.Layout> layouts = MetadataServicePca.getLayoutsForObject(objectType);
            MetadataService.Layout selectedLayout = null;
            for(MetadataService.Layout layout : layouts) {
                //System.debug('***** layout.fullName : ' + layout.fullName);
                if (layout.fullName != null && EncodingUtil.urlDecode(layout.fullName, 'UTF-8').contains(selectedLayoutName)) {
                    selectedLayout = layout;
                    break;
                }
            }
            if (selectedLayout != null) {
                quickSetupResult = 'Cloning page...';
                MetadataService.ApexPage apexPage = MetadataServicePca.createApexPageFromLayout(selectedLayout);
                if (objectType == 'Account') {
                    accountClonedPage = apexPage;
                }
                else if (objectType == 'Contact') {          
                    contactClonedPage = apexPage;
                }
                else if (objectType == 'Lead') {          
                    leadClonedPage = apexPage;
                }
                quickSetupResult = 'Success!';
            }
        }
        catch (Exception e) {
            resultString = 'An error occurred : ' + e.getMessage();
            //System.debug('******* error : ' + JSON.serialize(e));
        }
        
        quickSetupResult = resultString;
   
    }
    
    
    /**
     * sets permissions on the cloned page
     */ 
    public void setPermissions() {
        quickSetupResult = '';       
        
        String selectedLayoutName = '';
        MetadataService.ApexPage apexPage = null;
        if (objectType == 'Account') {
            selectedLayoutName = selectedAccountLayout;
            apexPage = accountClonedPage;
        }
        else if (objectType == 'Contact') {          
            selectedLayoutName = selectedContactLayout;
            apexPage = contactClonedPage;
        }
        else if (objectType == 'Lead') {          
            selectedLayoutName = selectedLeadLayout;
            apexPage = leadClonedPage;
        }
        
        //System.debug('*** selectedLayoutName : ' + selectedLayoutName);
		        
        String resultString = 'Failed!';
        try {
            if (apexPage != null) {
                resultString = 'Setting permissions...';
                MetadataServicePca.setProfilePermissions(apexPage.fullName);
                //List<MetadataService.Profile> allProfiles = MetadataServicePca.getAllProfiles();
                //MetadataServicePca.setApexPagePermissionsOnProfiles(allProfiles, apexPage);
                resultString = 'Success!';
            }
        }
        catch (Exception e) {
            resultString = 'An error occurred : ' + e.getMessage();
            //System.debug('******* error : ' + JSON.serialize(e));
        }
        
        quickSetupResult = resultString;
        
        updateClonedStatuses();
        updateStatuses();
    }
    
    
    /**
     * overrides the edit button of the object type (defined as the public variable 'objectType')
     */ 
    public void overrideButton() {
        String resultString = 'Success!';
        try {
            String apexPageName = '';
            MetadataService.ApexPage apexPage = null;
            
            if (objectType == 'Account') {
                apexPage = accountClonedPage;
            }
            if (objectType == 'Contact') {
                apexPage = contactClonedPage;
            }
            if (objectType == 'Lead') {
                apexPage = leadClonedPage;
            }
            
            if (apexPage != null) {
                if (apexPage != null) {
                	MetadataServicePca.overrideStandardButtonWithApexPage(objectType, apexPage);
                }
                else {
                    resultString = 'An error occurred : problem reading cloned page';
                }
            }
            else {
                resultString = 'An error occurred : page not cloned';
            }
        }
        catch(Exception e) {
            resultString = 'An error occurred : ' + e.getMessage();
            //System.debug('******* error : ' + JSON.serialize(e));
        }
        quickSetupResult = resultString;
        
        updateStatuses();
    }
    
    public PageReference getSetupStatus() {
        return null;
    }    
    
    
    public void resetButton() {
        String resultString = 'Success!';
        try {
            String apexPageName = '';
            //MetadataService.ApexPage apexPage = null;
            
            if (objectType == 'Account') {
                apexPageName = accountClonedPageName;
            }
            if (objectType == 'Contact') {
                apexPageName = contactClonedPageName;
            }
            if (objectType == 'Lead') {
                apexPageName = leadClonedPageName;
            }
            
            if (apexPageName != '') {
                MetadataServicePca.removeStandardButtonOverride(objectType);
                MetadataServicePca.deleteClonedPage(apexPageName);
            }
        }
        catch(Exception e) {
            resultString = 'An error occurred : ' + e.getMessage();
        }        
        quickSetupResult = resultString;
        
        updateClonedStatuses();
        updateStatuses();
    }
    
    
    /**
     * checks to see if there is a connection to the metadata api
     */ 
    public void checkMetadataAPIConnection() {
        Boolean result = false;
        try {
            MetadataService.MetadataPort service = new MetadataService.MetadataPort();
            service.SessionHeader = new MetadataService.SessionHeader_element();
            service.SessionHeader.sessionId = UserInfo.getSessionId();
            List<MetadataService.ListMetadataQuery> queries = new List<MetadataService.ListMetadataQuery>();
            MetadataService.ListMetadataQuery remoteSites = new MetadataService.ListMetadataQuery();
            remoteSites.type_x = 'RemoteSiteSetting';
            queries.add(remoteSites);
            service.listMetadata(queries, 28);
            result = true;
        } catch (Exception e) {
            result = false;
        }
        metadataAPIConnectionOkay = result;
    }
}