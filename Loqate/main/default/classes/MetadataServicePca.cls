public class MetadataServicePca {
    
    public static final String PCA_REMOTE_SITE_NAME = 'PostcodeAnywhereServices';
    public static final String PCA_REMOTE_SITE_URL = 'https://services.postcodeanywhere.co.uk';
    
    public static String OrganisationalNamespace = getOrgNameSpace();
    
    /**
     * gets the organisational namespace
     */ 
    public static String getOrgNameSpace() {
        String nspace = '';
        Double val = 35.0;
        MetadataService.MetadataPort service = createService(); 
        MetadataService.DescribeMetadataResult r = service.describeMetadata(val);
        System.debug('### r : ' + r);
        if (r != null) {
            nspace = r.organizationNamespace;
        }
		System.debug('### namespace : ' + nspace);
        return nspace + '__';
    }
    
    /**
     * Gets all the page layouts for a certain object
     * @param  objectName [description]
     * @return            [description]
     */
    public static List<MetadataService.Layout> getLayoutsForObject(String objectName) {
      System.debug('##### 1 : ');
        MetadataService.MetadataPort service = createService(); 
        List<MetadataService.Layout> layouts = new List<MetadataService.Layout>(); 

        List<MetadataService.ListMetadataQuery> queries = new List<MetadataService.ListMetadataQuery>();
        MetadataService.ListMetadataQuery queryLayouts = new MetadataService.ListMetadataQuery();
        queryLayouts.type_x = 'Layout';
        queries.add(queryLayouts);

        List<MetadataService.FileProperties> fileProperties = service.listMetadata(queries, 25);
        	
        List<String> fullNames = new List<String>();
        for(MetadataService.FileProperties fileProperty : fileProperties) {
            if (fileProperty.fullName.substringBefore('-') == objectName) {
                fullNames.add(fileProperty.fullName.substringBefore('-') + '-' + OrganisationalNamespace + fileProperty.fullName.substringAfter('-'));
            }
        }
        System.debug('##### 2 : ');
        //fullNames = new String[] { 'Account-pca__Account Layout' };
        
        System.debug('##### fullNames : (' + fullNames.size() + ')' + JSON.serialize(fullNames));
        
        if(fullNames.size() > 10){
            Integer chunks = Math.ceil(fullNames.size() / 10).intValue();
            System.debug('#### CHUNKS : ' + String.valueOf(chunks));
            for(Integer i = 0; i <= chunks; i++){
                Integer a = i*10;
  				Integer b = (i+1)*10;
                List<String> nameSubset = slice(fullNames, a, b);
                List<MetadataService.Layout> lyts = (List<MetadataService.Layout>) service.readMetadata('Layout', nameSubset).getRecords();
                System.debug('##### lyts : ' + JSON.serialize(lyts));
                for (MetadataService.Layout layout : lyts) {
                    if (layout.fullName != null) {
                        layouts.add(layout);
                    } 
                }
            }
        }else{
        
            List<MetadataService.Layout> lyts = (List<MetadataService.Layout>) service.readMetadata('Layout', fullNames).getRecords();
            //System.debug('##### lyts : ' + JSON.serialize(lyts));
        //System.debug('##### YYYYYY : ');
            for (MetadataService.Layout layout : lyts) {
                if (layout.fullName != null) {
                    layouts.add(layout);
                } 
            }
        }
        System.debug('##### 3 : ');
        return layouts;
    }
    
    public static List<String> slice(List<String> input, Integer ge, Integer l)
    {
        List<String> output = input.clone();
        for (Integer i = 0; i < ge; i++) output.remove(0);
        Integer elements = l - ge;
        while (output.size() > elements) output.remove(elements);
        return output;
    }

    /**
     * creates or updates page based on layout
     * @param  layout [description]
     * @return        [description]
     */
    public static MetadataService.ApexPage createApexPageFromLayout(MetadataService.Layout layout) {

        MetadataService.MetadataPort service = createService();  

        String newPageName = layout.fullName.substringBefore('-') + '_pca_clone';

        String objectName = layout.fullName.substringBefore('-'); // 'Account'; 
        MetadataService.ApexPage apexPage = new MetadataService.ApexPage();
        apexPage.apiVersion = 25;
        apexPage.Description = 'Using layout:' + EncodingUtil.urlDecode(layout.fullName.substringAfter('__'), 'UTF-8');
        apexPage.fullName = newPageName;
        apexPage.label = objectName + ' PCA Clone';

        //OUTPUT page header
        String output = '<apex:page standardController="' + objectName + '">\r\n';
        //output += '    <apex:include pageName="pca__Component" />\r\n';
        output += '    <apex:sectionHeader title="' + objectName + '" subtitle="{!' + objectName.toLowerCase() + '.name}" />\r\n';
        output += '    <apex:form>\r\n';
        output += '        <apex:pageBlock mode="edit" title="' + objectName + ' New/Edit">\r\n';
        output += '            <apex:pageblockbuttons >\r\n';
        output += '                <apex:commandbutton value="Save" action="{!Save}" />\r\n';
        output += '                <apex:commandbutton value="Cancel" action="{!Cancel}" />\r\n';
        output += '            </apex:pageblockbuttons>\r\n';
        //OUTPUT page header

        Map<HelperEnums.PCAProduct, Map<String, String>> productFieldMappings = new Map<HelperEnums.PCAProduct, Map<String, String>>();
        //PHONE, {Phone, elements} {Mobile, elements}
		
        //The fields that we want to create javascript field mappings for
        productFieldMappings.put(HelperEnums.PCAProduct.Address, new Map<String, String>());
        productFieldMappings.put(HelperEnums.PCAProduct.Email, new Map<String, String>());
        productFieldMappings.put(HelperEnums.PCAProduct.Mobile, new Map<String, String>());
        
        for (MetadataService.LayoutSection els : layout.layoutSections) {

            Integer columns = els.layoutColumns.size();
            List<List<String>> columnsOutput = layoutSectionToColumnsOutput(els, objectName, productFieldMappings);

            //OUTPUT pageBlockSection
            output += '            <apex:pageBlockSection title="' + els.label + '" columns="' + columns + '"';
            String pageBlockSectionOutput = '';
            if (columns == 1 && columnsOutput.size() == 1)
            {
                for (String columnOutput : columnsOutput.get(0))
                {
                    pageBlockSectionOutput += columnOutput;
                }
            }
            else
            {
                pageBlockSectionOutput += columnsOutputToOutput(columnsOutput);
            }
            if(pageBlockSectionOutput == '')
            {
                output += ' showHeader="false">\r\n';
            }
            else
            {
                output += ' showHeader="' + els.editHeading + '">\r\n';
                output += pageBlockSectionOutput;
            }
            output += '            </apex:pageBlockSection>\r\n';
            //OUTPUT pageBlockSection
        }
        
        //OUTPUT javascript
        output += '            \r\n';
        output += '            <apex:includeScript value="{!URLFOR($Resource.pca__PostcodeAnywhere, \'connection.js\')}" />\r\n';
		output += '            <apex:includeScript value="/soap/ajax/24.0/apex.js"/>\r\n';
        output += '            <apex:includeScript value="{!URLFOR($Resource.pca__PostcodeAnywhere, \'sensor.js\')}" />\r\n';
        output += '            <apex:stylesheet value="{!URLFOR($Resource.pca__PostcodeAnywhere, \'platformcaptureplus-2.00.min.css\')}" />\r\n';
        output += '            <apex:includeScript value="{!URLFOR($Resource.pca__PostcodeAnywhere, \'platformcaptureplus-2.00.min.js\')}" />\r\n';
        output += '            <apex:stylesheet value="{!URLFOR($Resource.pca__PostcodeAnywhere, \'platformemailvalidation-1.10.min.css\')}" />\r\n';
        output += '            <apex:includeScript value="{!URLFOR($Resource.pca__PostcodeAnywhere, \'platformemailvalidation-1.10.min.js\')}" />\r\n';
        output += '            <apex:stylesheet value="{!URLFOR($Resource.pca__PostcodeAnywhere, \'platformmobilevalidation-1.10.min.css\')}" />\r\n';
        output += '            <apex:includeScript value="{!URLFOR($Resource.pca__PostcodeAnywhere, \'platformmobilevalidation-1.10.min.js\')}" />\r\n';
        
        output += '            <script type="text/javascript">\r\n';
        output += '            (function() {\r\n';
        output += '                /*___  ___   _      ___       _   _             \r\n';
        output += '                 | _ \\/ __| /_\\    / _ \\ _ __| |_(_)___ _ _  ___\r\n';
        output += '                 |  _/ (__ / _ \\  | (_) | \'_ \\  _| / _ \\ \' \\(_-<\r\n';
        output += '                 |_|  \\___/_/ \\_\\  \\___/| .__/\\__|_\\___/_||_/__/\r\n';
        output += '                                        |_|                     */\r\n';       
        output += '                var getCountries = function() {\r\n';
        output += '                    var countries = [];\r\n';
        output += '                    try{\r\n';
        output += '                        sforce.connection.sessionId = "{!$Api.Session_ID}"; \r\n';
        output += '                        var countryRecords = (sforce.connection.query("SELECT Name, pca__Index__c FROM pca__PostcodeAnywhereCountries__c")).getArray("records");\r\n';
        output += '                        for(var i=0;i< countryRecords.length;i++){ countries.push(countryRecords[i].Name); }\r\n';
        output += '                    }\r\n';
        output += '                    catch(e){ \r\n';
        output += '                        countries = [];\r\n';
        output += '                    }\r\n';
        output += '                    return countries;\r\n';
        output += '               }\r\n';
        output += '               \r\n';
        output += '               var countries = getCountries();\r\n';
        output += '               var originCountry =  "{!JSENCODE($User.Country)}";\r\n';
        output += '               var key = "{!JSENCODE($Setup.pca__PostcodeAnywhereSettings__c.pca__Key__c)}";\r\n';
        output += '                  \r\n';
        output += '                //Options Address\r\n';
        output += '                var optionsAddress = {\r\n';
        output += '                    "key": key,\r\n';
        output += '                    "countries": { defaultCode: originCountry },\r\n';
        output += '                    "search": { countries: countries.join(","), language: "ENG" }\r\n';
        output += '                    \r\n';
        output += '                };\r\n';
        output += '                //Options Email\r\n';
        output += '                var optionsEmail = {\r\n';
        output += '                     "International_BoundCountry": "",\r\n';
        output += '                     "key": key,\r\n';
        output += '                     "minimal": "false",\r\n';
        output += '                     "setCssClassInvalid": "validation-no",\r\n';
        output += '                     "setCssClassValid": "validation-yes"\r\n';
        output += '                };\r\n';
        output += '                //Options Mobile\r\n';
        output += '                var optionsMobile = {\r\n';
        output += '                      "countryCodeDefaultValue": "GB",\r\n';
        output += '                      "International_BoundCountry": "",\r\n';
        output += '                      "key": key,\r\n';
        output += '                      "minimal": "false",\r\n';
        output += '                      "setCssClassInvalid": "",\r\n';
        output += '                      "setCssClassValid": "",\r\n';
        output += '                      "phoneDisplayMode": "vertical"\r\n';
        output += '                };\r\n';
        
        for (HelperEnums.PCAProduct product: productFieldMappings.keySet()) {
            Map<String, String> mappings = productFieldMappings.get(product);
            Boolean header = true;
            for(String fieldName: mappings.keySet())
            {
                if(header)
                {
                    output += '' + AddJavascriptHeader(product) + '\r\n\r\n';
                    output += '                if({!$Setup.pca__PostcodeAnywhereSettings__c.pca__' + product + '_Validation__c}) { //pca setting for ' + product;
                    header = false;
                }
				output += '\r\n' + mappings.get(fieldName);
            }
            if(!header)
                output += '                } //end of pca setting for ' + product + '\r\n\r\n';
        }

        output += '             })();\r\n';
        output += '            </script>\r\n';
        //OUTPUT javascript
        //OUTPUT page footer
        output += '        </apex:pageBlock>\r\n';
        output += '    </apex:form>\r\n';
        output += '</apex:page>\r\n';
        //OUTPUT page footer

        apexPage.content = EncodingUtil.base64Encode(Blob.valueOf(output));

        List<MetadataService.UpsertResult> results = service.upsertMetadata(new MetadataService.Metadata[] { apexPage });
        MetadataServiceExamples.handleUpsertResults(results[0]);
        
        //System.debug('******** createApexPageResult : ' + results[0]);

        return apexPage;
    }
    
    public static String AddJavascriptHeader(HelperEnums.PCAProduct product)
    {
        String output = '';
        if(product == HelperEnums.PCAProduct.Address)
        {
            output += '                 /*___  ___   _       _   ___  ___  ___ ___ ___ ___ \r\n';
            output += '                  | _ \\/ __| /_\\     /_\\ |   \\|   \\| _ \\ __/ __/ __|\r\n';
            output += '                  |  _/ (__ / _ \\   / _ \\| |) | |) |   / _|\\__ \\__ \\\r\n';
            output += '                  |_|  \\___/_/ \\_\\ /_/ \\_\\___/|___/|_|_\\___|___/___/*/\r\n';
        } else if(product == HelperEnums.PCAProduct.Email) {
            output += '                 /*___  ___   _     ___ __  __   _   ___ _    \r\n';
            output += '                  | _ \\/ __| /_\\   | __|  \\/  | /_\\ |_ _| |   \r\n';
            output += '                  |  _/ (__ / _ \\  | _|| |\\/| |/ _ \\ | || |__ \r\n';
            output += '                  |_|  \\___/_/ \\_\\ |___|_|  |_/_/ \\_\\___|____|*/\r\n';
        } else if(product == HelperEnums.PCAProduct.Mobile) {
            output += '                 /*___  ___   _     __  __  ___  ___ ___ _    ___ \r\n';
            output += '                  | _ \\/ __| /_\\   |  \\/  |/ _ \\| _ )_ _| |  | __|\r\n';
            output += '                  |  _/ (__ / _ \\  | |\\/| | (_) | _ \\| || |__| _| \r\n';
            output += '                  |_|  \\___/_/ \\_\\ |_|  |_|\\___/|___/___|____|___|*/\r\n';
        }
        
        return output;
    }
    
    /**
    * Generates a list of columns from the layout section
    * @param  els [The layout section to get the column and fields from]
    * @param  productFieldMappings Field mappings for Javascript
    * @return        [A List of columns containing output apex markup]
    */
    private static List<List<String>> layoutSectionToColumnsOutput(MetadataService.LayoutSection els, String objectName, Map<HelperEnums.PCAProduct, Map<String, String>> productFieldMappings)
    {
        List<List<String>> columnsOutput = new List<List<String>>();

        //System.Debug('** pageBlockSection: ' + els.label);

        for (MetadataService.LayoutColumn lc : els.layoutColumns) {
            //System.Debug('*** layoutColumns: ' + lc.layoutItems);
            List<String> thisColumnOutput = new List<String>();

            if (lc.layoutItems != null) {
                for (MetadataService.LayoutItem li : lc.layoutItems) {
                    if (li.field != null) {
                        if (li.behavior != 'Readonly') {
                            String fieldRequired = li.behavior == 'Required' ? 'true' : 'false';
                            if ((li.field == 'Address' || li.field == 'MailingAddress' || li.field == 'OtherAddress' || li.field == 'BillingAddress' || li.field == 'ShippingAddress')) { //Address
                                thisColumnOutput.add('                    <apex:inputField id="' + li.field +'_pca_street" value="{!' + objectName + '.' + li.field.remove('Address') + 'Street}" required="' + fieldRequired + '" />\r\n');
                                thisColumnOutput.add('                    <apex:inputField id="' + li.field +'_pca_city" value="{!' + objectName + '.' + li.field.remove('Address') + 'City}" required="' + fieldRequired + '" />\r\n');
                                thisColumnOutput.add('                    <apex:inputField id="' + li.field +'_pca_state" value="{!' + objectName + '.' + li.field.remove('Address') + 'State}" required="' + fieldRequired + '" />\r\n');
                                thisColumnOutput.add('                    <apex:inputField id="' + li.field +'_pca_postcode" value="{!' + objectName + '.' + li.field.remove('Address') + 'PostalCode}" required="' + fieldRequired + '" />\r\n');
                                thisColumnOutput.add('                    <apex:inputField id="' + li.field +'_pca_country" value="{!' + objectName + '.' + li.field.remove('Address') + 'Country}" required="' + fieldRequired + '" />\r\n');  
                                
                                AddJavascriptMappings(productFieldMappings, HelperEnums.PCAProduct.Address, li.field);
                            }
                            else if(li.field == 'MobilePhone') { //Mobile
                                thisColumnOutput.add('                    <apex:selectList id="' + li.field +'_pca_country" label="Mobile Country" size="1" rendered="{!$Setup.pca__PostcodeAnywhereSettings__c.pca__mobile_Validation__c}"></apex:selectList>\r\n');
                                thisColumnOutput.add('                    <apex:inputField id="' + li.field +'_pca_mobile" value="{!' + objectName + '.' + li.field + '}" required="' + fieldRequired + '" />\r\n');
                                
                                AddJavascriptMappings(productFieldMappings, HelperEnums.PCAProduct.Mobile, li.field);
                            }
                            else if(li.field == 'Email') { //Email
                                thisColumnOutput.add('                    <apex:inputField id="' + li.field +'_pca_email" value="{!' + objectName + '.' + li.field + '}" required="' + fieldRequired + '" />\r\n'); 
                                
                                AddJavascriptMappings(productFieldMappings, HelperEnums.PCAProduct.Email, li.field);
                            }
                            else if (li.field != 'CampaignId') { // All other fields
                                thisColumnOutput.add('                    <apex:inputField value="{!' + objectName + '.' + li.field + '}" required="' + fieldRequired + '" />\r\n');
                            }
                        } //if readonly then -- thisColumnOutput.add('                <apex:outputField value="{!' + objectName + '.' + li.field + '}" />\r\n');
                        
                    }
                    else
                    {
                        thisColumnOutput.add('                    <apex:pageBlockSectionItem/>\r\n');
                    }
                }
            }
            columnsOutput.add(thisColumnOutput);
        }
        return columnsOutput;
    }

    /**
     * Adds the field mappings for a certain product to the productFieldMappings collection
     * @param  productFieldMappings [collection to add to ]
     * @param  product [mappings to add to] 
     * @param  fieldName [field to map ]
     */
    public static void AddJavascriptMappings(Map<HelperEnums.PCAProduct, Map<String, String>> productFieldMappings, HelperEnums.PCAProduct product, String fieldName)
    {
        String fieldMappingsElements = '';
        
        if(product == HelperEnums.PCAProduct.Mobile)
        {
            fieldMappingsElements += '                    //PCA populate country field\r\n';
            fieldMappingsElements += '                    var cce = pca.getElement("' + fieldName + '_pca_country");\r\n';
            fieldMappingsElements += '                    var countries = pca.getAllCountries();\r\n';
            fieldMappingsElements += '                    var defaultCountryName = "{!JSENCODE($User.Country)}";\r\n';
            fieldMappingsElements += '                    var defaultCountryIso = "GB";\r\n';
            fieldMappingsElements += '                    for (var c = 0; c < countries.length; c++) {\r\n';
            fieldMappingsElements += '                        var countryModel = countries[c];\r\n';
            fieldMappingsElements += '                        var option = pca.create("option", { value: countryModel.iso2, text: countryModel.name ,selected: ((defaultCountryName === "") ? countryModel.iso2 == defaultCountryIso : countryModel.name == defaultCountryName )});\r\n';
            fieldMappingsElements += '                        cce.appendChild(option);\r\n';
            fieldMappingsElements += '                    }       \r\n';    
        }
        
        fieldMappingsElements += '                   //field mappings for ' + fieldName + '\r\n';
        fieldMappingsElements += '                   var fields' + fieldName + ' = [\r\n';   
        
        if(product == HelperEnums.PCAProduct.Address)
        {
            fieldMappingsElements += '                      { element: "' + fieldName +'_pca_street", field: "{Line1}" },\r\n';
            fieldMappingsElements += '                      { element: "' + fieldName +'_pca_city", field: "{City}", mode: pca.fieldMode.POPULATE },\r\n';
            fieldMappingsElements += '                      { element: "' + fieldName +'_pca_state", field: "{Province}", mode: pca.fieldMode.POPULATE },\r\n';
            fieldMappingsElements += '                      { element: "' + fieldName +'_pca_postcode", field: "{PostalCode}" },\r\n';
            fieldMappingsElements += '                      { element: "' + fieldName +'_pca_country", field: "{Country}", mode: pca.fieldMode.COUNTRY }\r\n';            
        }
        else if(product == HelperEnums.PCAProduct.Mobile)
        {
            //TODO: Add javascript for country field
            fieldMappingsElements += '                      { element: "' + fieldName +'_pca_mobile", field: "{Phone}", mode: 32 },\r\n';               
            fieldMappingsElements += '                      { element: "' + fieldName + '_pca_country", field: "{CountrySource}"}\r\n';
        }
        else if(product == HelperEnums.PCAProduct.Email)
        {
            fieldMappingsElements += '                      { element: "' + fieldName +'_pca_email", field: "{Email}"}\r\n';   
        }
        
        fieldMappingsElements += '                   ];\r\n';
        fieldMappingsElements += '                   //control for '+ fieldName + ' (' + product + 'service)\r\n';
        fieldMappingsElements += '                   var control' + fieldName + ' = new pca.' + product + '(fields' + fieldName + ', options' + product + ');\r\n\r\n\r\n';
        //fieldMappingsElements += '                   control' + fieldName + '.load();';
        
        //Add to the javascript map
        Map<String, String> mappings = new Map<String, String>();
        
        if(productFieldMappings.containsKey(product)) {
            mappings = productFieldMappings.get(product);
        }
        
        mappings.put(fieldName, fieldMappingsElements);
        productFieldMappings.put(product, mappings);
    }
    
    /**
    * Merges two lists of fields so that they are side by side
    * @param  columnsOutput [A List of columns containing output apex markup]
    * @return        [Page markup generated from the column output]
    */
    private static String columnsOutputToOutput(List<List<String>> columnsOutput)
    {
        //System.debug('**** columnsOutputToOutput : Size ' + columnsOutput.size());
        String output = '';
        if(columnsOutput.size() > 1) //This only merges two lists of fields as that is the max of standard page layouts
        {
            Integer columnsOutputOneSize = columnsOutput.get(0).size();
            Integer columnsOutputTwoSize = columnsOutput.get(1).size();
            //System.debug('***** columnsOutputOneSize : Size ' + columnsOutputOneSize);
            //System.debug('***** columnsOutputTwoSize : Size ' + columnsOutputTwoSize);
            //Add breaks into lists so we are ready for the merge
            if (columnsOutputOneSize < columnsOutputTwoSize) {
                //add blanks to columnsOutputOneSize
                //System.debug('****** columnsOutputTwoSize bigger than columnsOutputOneSize');
                List<String> columnsOutputTemp = columnsOutput.get(0);
                for (Integer i = columnsOutputOneSize; i < columnsOutputTwoSize; i++)
                {
                    columnsOutputTemp.add('                    <apex:pageBlockSectionItem/>\r\n');
                }
                columnsOutput.set(0, columnsOutputTemp);
            }
            else if (columnsOutputOneSize > columnsOutputTwoSize) {
                //add blanks to columnsOutputTwoSize
                //System.debug('****** columnsOutputOneSize bigger than columnsOutputTwoSize');
                List<String> columnsOutputTemp = columnsOutput.get(1);
                for (Integer i = columnsOutputTwoSize; i < columnsOutputOneSize; i++)
                {
                    columnsOutputTemp.add('                    <apex:pageBlockSectionItem/>\r\n');
                }
                columnsOutput.set(1, columnsOutputTemp);
            }
            List<String> columnsOutputOne = columnsOutput.get(0);
            List<String> columnsOutputTwo = columnsOutput.get(1);

            //System.debug('***** columnsOutputOneSize : ' + columnsOutputOne.size());
            //System.debug('***** columnsOutputTwoSize : ' + columnsOutputTwo.size());

            //merge
            for (Integer i = 0; i < columnsOutput.get(0).size(); i++)
            {
                output += columnsOutputOne[i];
                output += columnsOutputTwo[i];
            }

        }
        //If we have got two then we need to add blanks and merge the fields

        //System.debug('***** output : ' + output.length());

        return output;
    }
    

    /**
     * Gives all profiles permission to view page in question
     * @param  profiles [description]
     * @param  apexPage [description]
     * @return          [description]
     */
    public static List<MetadataService.Profile> setApexPagePermissionsOnProfiles(List<MetadataService.Profile> profiles, MetadataService.ApexPage apexPage) {

        MetadataService.MetadataPort service = createService(); 
        List<MetadataService.Metadata> updateProfiles = new List<MetadataService.Metadata>();
        
        for (MetadataService.Profile profile : profiles) {
            //System.debug('**** pageAccesses : ' + profile.pageAccesses);
            for (MetadataService.ProfileApexPageAccess papa : profile.pageAccesses) {
                if (papa.apexPage == apexPage.fullName) {
                    papa.enabled = true;
                    updateProfiles.add(profile);
                    //System.debug('**** papa.enabled : ' + papa.apexPage); 
                    if (updateProfiles.size() == 5) {
                        List<MetadataService.SaveResult> results = service.updateMetadata( updateProfiles );
        				MetadataServiceExamples.handleSaveResults(results[0]);
                        updateProfiles.clear();
                    }
                    break;
                }
            }
        }
        
        if (updateProfiles.size() > 0) {
            List<MetadataService.SaveResult> results = service.updateMetadata( updateProfiles );
            MetadataServiceExamples.handleSaveResults(results[0]);
        }

        return profiles;
    }
    

    /**
     * [overrideStandardButtonWithApexPage description]
     * @param apexPage [description]
     */
    public static MetadataService.CustomObject overrideStandardButtonWithApexPage(String objectName, MetadataService.ApexPage apexPage) {
        
        MetadataService.MetadataPort service = createService();

        MetadataService.CustomObject customObject = (MetadataService.CustomObject) service.readMetadata('CustomObject', new String[] { objectName }).getRecords()[0];

        if ( customObject.actionOverrides == null ) {
            customObject.actionOverrides = new List<MetadataService.ActionOverride>();
        }

        String actionName = '';
        for (Integer i = 0; i < customObject.actionOverrides.size(); i++) {
            if (customObject.actionOverrides[i].actionName == 'Edit' || customObject.actionOverrides[i].actionName == 'edit' ||
               customObject.actionOverrides[i].actionName == 'New' || customObject.actionOverrides[i].actionName == ('New' + objectName) || customObject.actionOverrides[i].actionName == 'new') {
                customObject.actionOverrides.remove(i);
            }
        }

        MetadataService.ActionOverride newOverride = new MetadataService.ActionOverride();
        newOverride.actionName = 'New' + (objectName == 'Contact' ? 'Contact' : '');
        newOverride.content = apexPage.fullName;
        newOverride.type_x = 'visualforce';
        newOverride.skipRecordTypeSelect = false;
        newOverride.comment = 'Overridden by PCA Predict';
        
        MetadataService.ActionOverride editOverride = new MetadataService.ActionOverride();
        editOverride.actionName = 'Edit';
        editOverride.content = apexPage.fullName;
        editOverride.type_x = 'visualforce';
        editOverride.skipRecordTypeSelect = false;
        editOverride.comment = 'Overridden by PCA Predict';
        
        customObject.actionOverrides.add(editOverride);
        customObject.actionOverrides.add(newOverride);
        
        List<MetadataService.SaveResult> results = service.updateMetadata(new MetadataService.Metadata[] { customObject });
        MetadataServiceExamples.handleSaveResults(results[0]);

        return customObject;
    }
    
    
    /**
     * removes the override from the specified page
     */ 
    public static void removeStandardButtonOverride(String objectName) {

        MetadataService.MetadataPort service = createService();

        MetadataService.CustomObject customObject = (MetadataService.CustomObject) service.readMetadata('CustomObject', new String[] { objectName }).getRecords()[0];

        if ( customObject.actionOverrides == null ) {
            customObject.actionOverrides = new List<MetadataService.ActionOverride>();
        }

        for (Integer i = 0; i < customObject.actionOverrides.size(); i++) {
            if (customObject.actionOverrides[i].actionName == 'Edit' || 
                customObject.actionOverrides[i].actionName == 'edit' || 
                customObject.actionOverrides[i].actionName == 'New' || 
                customObject.actionOverrides[i].actionName == ('New' + objectName) || 
                customObject.actionOverrides[i].actionName == 'new') {
                customObject.actionOverrides.remove(i);
            }
        }
        
        MetadataService.ActionOverride editOverride = new MetadataService.ActionOverride();
        editOverride.actionName = 'Edit';
        editOverride.type_x = 'Default';
        editOverride.skipRecordTypeSelect = false;
        
        MetadataService.ActionOverride newOverride = new MetadataService.ActionOverride();
        newOverride.actionName = 'New' + (objectName == 'Contact' ? 'Contact' : '');
        newOverride.type_x = 'Default';
        newOverride.skipRecordTypeSelect = false;
        
        customObject.actionOverrides.add(newOverride);
        customObject.actionOverrides.add(editOverride);
		
        List<MetadataService.SaveResult> results = service.updateMetadata(new MetadataService.Metadata[] { customObject });
        MetadataServiceExamples.handleSaveResults(results[0]);

    }
    
    
    /**
     * [getEditButtonOverride description]
     * @param  objectName [description]
     * @return            [description]
     */
    public static List<MetadataService.ActionOverride> getButtonOverrides(String objectName) {

        List<MetadataService.ActionOverride> results = new List<MetadataService.ActionOverride>();

        MetadataService.MetadataPort service = createService();

        MetadataService.CustomObject customObject = (MetadataService.CustomObject) service.readMetadata('CustomObject', new String[] { objectName }).getRecords()[0];

        if ( customObject.actionOverrides == null ) {
            customObject.actionOverrides = new List<MetadataService.ActionOverride>();
        }

        for (Integer i = 0; i < customObject.actionOverrides.size(); i++) {
            if (customObject.actionOverrides[i].actionName == 'Edit' || customObject.actionOverrides[i].actionName == 'edit' ||
               customObject.actionOverrides[i].actionName == 'New' || customObject.actionOverrides[i].actionName == ('New' + objectName) || customObject.actionOverrides[i].actionName == 'new') {
                results.add(customObject.actionOverrides[i]);
            }
        }

        return results;
    }


    /**
     * [getProfile description]
     * @param  profileName [description]
     * @return             [description]
     */
    public static MetadataService.Profile getProfile(String profileName) {
    
        MetadataService.MetadataPort service = createService();

        List<MetadataService.ListMetadataQuery> queries = new List<MetadataService.ListMetadataQuery>();
        MetadataService.ListMetadataQuery queryProfile = new MetadataService.ListMetadataQuery();
        queryProfile.type_x = 'Profile';
        queries.add(queryProfile);

        MetadataService.FileProperties[] fileProperties = service.listMetadata(queries, 25);

        for(MetadataService.FileProperties fileProperty : fileProperties) {
            
            if (fileProperty.fullName == profileName) {
                MetadataService.Profile p = (MetadataService.Profile) service.readMetadata('Profile', new String[] { fileProperty.fullName }).getRecords()[0];
                if (p.fullName != null) {
                    return p;
                }               
            }            
        }
        
        return null;
    }
    
    
    /**
     * [getAllProfiles description]
     * @return	[description]
     */
    public static List<MetadataService.Profile> getAllProfiles() {
        
        MetadataService.MetadataPort service = createService();
	
        List<MetadataService.Profile> profiles = new List<MetadataService.Profile>();
        List<MetadataService.ListMetadataQuery> queries = new List<MetadataService.ListMetadataQuery>();
        MetadataService.ListMetadataQuery queryProfile = new MetadataService.ListMetadataQuery();
        queryProfile.type_x = 'Profile';
        queries.add(queryProfile);

        MetadataService.FileProperties[] fileProperties = service.listMetadata(queries, 25);
		List<String> fullNames = new List<String>();
        
        for(MetadataService.FileProperties fileProperty : fileProperties) { 
            fullNames.add(fileProperty.fullName);  
            if (fullNames.size() == 1) {
                List<MetadataService.Profile> ps = (List<MetadataService.Profile>) service.readMetadata('Profile', fullNames).getRecords();
                for (MetadataService.Profile p : ps) {
                    if (p.fullName != null) {
                        profiles.add(p);
                    }  
                }
                fullNames.clear();
            }
        }
        
        if (fullNames.size() > 0) {
            List<MetadataService.Profile> ps = (List<MetadataService.Profile>) service.readMetadata('Profile', fullNames).getRecords();
            for (MetadataService.Profile p : ps) {
                if (p.fullName != null) {
                    profiles.add(p);
                }  
            }
        }
        
        return profiles;
    }
    
    
    public static void setProfilePermissions(String apexPageName) {
        
        MetadataService.MetadataPort service = createService();
        
        /*
        List<MetadataService.Profile> profiles = new List<MetadataService.Profile>();
        List<MetadataService.ListMetadataQuery> queries = new List<MetadataService.ListMetadataQuery>();
        MetadataService.ListMetadataQuery queryProfile = new MetadataService.ListMetadataQuery();
        queryProfile.type_x = 'Profile';
        queries.add(queryProfile);

        MetadataService.FileProperties[] fileProperties = service.listMetadata(queries, 35);
		List<String> fullNames = new List<String>();        
        */
        
        List<MetadataService.Metadata> updateProfiles = new List<MetadataService.Metadata>();
        Map<String, String> profileNameMappings = new Map<String, String>();
        profileNameMappings.put('System Administrator','Admin');
        profileNameMappings.put('Standard User','Standard');
        profileNameMappings.put('Marketing User','MarketingProfile');
        profileNameMappings.put('Contract Manager','ContractManager');
        profileNameMappings.put('Solution Manager','SolutionManager');
        profileNameMappings.put('Read Only','ReadOnly');
        profileNameMappings.put('Customer Portal Manager','CustomerManager');
        profileNameMappings.put('Customer Portal User','CustomerUser');
        profileNameMappings.put('High Volume Customer Portal','HighVolumePortal');
        profileNameMappings.put('Partner User','Partner');
        profileNameMappings.put('Authenticated Website','PlatformPortal');
        profileNameMappings.put('Standard Platform User','StandardAul');
        
        List<String> profileNames = new List<String>();
        
        List<Profile> profiles = [SELECT Name FROM Profile];
        
        for (Profile p : profiles) {
        
            if(profileNameMappings.containsKey(p.Name))
            {
                profileNames.add(profileNameMappings.get(p.Name));
            }
            else
            {
                profileNames.add(p.Name);
            }
        }
        profiles.clear();
        
        //for(MetadataService.FileProperties fileProperty : fileProperties) { 
        for (String pName : profileNames) {
            MetadataService.Profile p = new MetadataService.Profile();
            p.fullName = pName;
            MetadataService.ProfileApexPageAccess papa = new MetadataService.ProfileApexPageAccess();
            papa.apexPage = apexPageName;
            papa.enabled = true;
            p.pageAccesses = new MetadataService.ProfileApexPageAccess[1];
            p.pageAccesses[0] = papa;
            updateProfiles.add(p);
            if (updateProfiles.size() == 10) {
                List<MetadataService.SaveResult> results = service.updateMetadata( updateProfiles );
                MetadataServiceExamples.handleSaveResults(results[0]);
                updateProfiles.clear();
            }          
        }
        if (updateProfiles.size() > 0) {
            List<MetadataService.SaveResult> results = service.updateMetadata( updateProfiles );
            MetadataServiceExamples.handleSaveResults(results[0]);
        }        
    }


    /**
     * [getApexPage description]
     * @param  pageName [description]
     * @return          [description]
     */
    public static MetadataService.ApexPage getApexPage(String pageName) {
      
        MetadataService.MetadataPort service = createService();
		String nameWithNamespace = OrganisationalNamespace + pageName;
        List<MetadataService.ApexPage> apexPages = (List<MetadataService.ApexPage>) service.readMetadata('ApexPage', new String[] { nameWithNamespace }).getRecords();
        System.debug('::::: apexPages : ' + apexPages);
        for (MetadataService.ApexPage apexPage : apexPages) {
            if (apexPage.fullName == nameWithNamespace) {
                return apexPage;
            }
        }

        return null;
    }
    
    
    /**
     * deletes the specified apex page
     * @param	pageName	name of the page to delete
     */ 
    public static Boolean deleteClonedPage(String pageName) {
        
        MetadataService.MetadataPort service = createService();
        String nameWithNamespace = OrganisationalNamespace + pageName;
        List<MetadataService.DeleteResult> results = service.deleteMetadata('ApexPage', new String[] { nameWithNamespace });
        return results[0].success;
    }
    
    
    public static List<String> getClonedPageNamesForType(String objectType) {
        
        MetadataService.MetadataPort service = createService();
		
        List<MetadataService.ListMetadataQuery> queries = new List<MetadataService.ListMetadataQuery>();
        MetadataService.ListMetadataQuery queryProfile = new MetadataService.ListMetadataQuery();
        queryProfile.type_x = 'ApexPage';
        queries.add(queryProfile);

        MetadataService.FileProperties[] fileProperties = service.listMetadata(queries, 25);
		List<String> fullNames = new List<String>();
        for(MetadataService.FileProperties fileProperty : fileProperties) {  
            if (fileProperty.fullName.startsWith(objectType) && fileProperty.fullName.contains('_pca_clone')) {
         		fullNames.add(fileProperty.fullName);
            }
        }
        
        return fullNames;
    }


    /**
     * creates a service on which to perform metadata api operations
     * @return new MetadataService.MetadataPort object with session data
     */
    public static MetadataService.MetadataPort createService() {

        MetadataService.MetadataPort service = new MetadataService.MetadataPort();
        service.SessionHeader = new MetadataService.SessionHeader_element();
        service.SessionHeader.sessionId = UserInfo.getSessionId();
        service.timeout_x = 60000;

        return service;
    }
    
    
    /**
     * gets the remote setting with the supplied name.
     * @param  settingName the name of the setting to get. If null or empty string, then the value specified by the const PCA_REMOTE_SITE_NAME is used
     * @return             The requested MetadataService.RemoteSiteSetting object if the setting exists; otherwise null
     */
    public static MetadataService.RemoteSiteSetting getPcaRemoteSiteSetting(String settingName) {

        MetadataService.MetadataPort service = createService();

        String settingToGet = settingName;
        if (settingName == null || settingName == '') {
            settingToGet = PCA_REMOTE_SITE_NAME;
        }

        String nameWithNamespace = OrganisationalNamespace + settingToGet;
        MetadataService.RemoteSiteSetting setting = (MetadataService.RemoteSiteSetting) service.readMetadata('RemoteSiteSetting', new String[] { nameWithNamespace }).getRecords()[0];
        System.debug('***** setting : ' + setting.fullName);
        if (setting.fullName == nameWithNamespace) {
            return setting;
        }

        return null;
    }



    /**
     * adds a remote site setting to enable pca services
     * @return true if successful; otherwise false
     */
    public static Boolean addPcaRemoteSiteSetting() {

        MetadataService.MetadataPort service = createService();

        MetadataService.RemoteSiteSetting remoteSetting = new MetadataService.RemoteSiteSetting();
        remoteSetting.fullName = PCA_REMOTE_SITE_NAME;
        remoteSetting.url = PCA_REMOTE_SITE_URL;
        remoteSetting.description = 'Remote site setting to enable PCA Predict services';
        remoteSetting.isActive = true;
        remoteSetting.disableProtocolSecurity = false;

        List<MetadataService.SaveResult> results = service.createMetadata(new MetadataService.Metadata[] { remoteSetting });
        MetadataServiceExamples.handleSaveResults(results[0]);

        return results[0].success;

    }
    
}