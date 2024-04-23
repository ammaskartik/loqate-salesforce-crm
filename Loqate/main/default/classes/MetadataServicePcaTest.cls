@isTest
public class MetadataServicePcaTest {
    
    @isTest
    static void getLayoutsForObjectTest() {

        test.startTest();

        System.Test.setMock(WebServiceMock.class, new MetadataServicePcaMocks.WebServiceMockImpl());

        List<MetadataService.Layout> layouts = MetadataServicePca.getLayoutsForObject('Account');
        
        test.stopTest();

        System.assertEquals(1, layouts.size());
    }


    @isTest
    static void createApexPageFromLayoutTest() {

        test.startTest();

        System.Test.setMock(WebServiceMock.class, new MetadataServicePcaMocks.WebServiceMockImpl());

        List<MetadataService.Layout> layouts = MetadataServicePca.getLayoutsForObject('Account');

        MetadataService.Layout layout = layouts[0];
        MetadataService.ApexPage apexPage = MetadataServicePca.createApexPageFromLayout(layout);
        
        test.stopTest();

        System.assertEquals('Account_pca_clone', apexPage.fullName);
    }


    @isTest
    static void getApexPage_returns_apex_page() {

        test.startTest();

        System.Test.setMock(WebServiceMock.class, new MetadataServicePcaMocks.WebServiceMockImpl());

        MetadataService.ApexPage apexPage = MetadataServicePca.getApexPage('Account_pca_clone');
        //System.debug('::::: apexPage : ' + apexPage);
        test.stopTest();

        System.assertEquals('pca__Account_pca_clone', apexPage.fullName);
    }


    @isTest
    static void getApexPage_returns_null() {

        test.startTest();

        System.Test.setMock(WebServiceMock.class, new MetadataServicePcaMocks.WebServiceMockImpl());

        MetadataService.ApexPage apexPage = MetadataServicePca.getApexPage('this_does_not_exist');
        
        test.stopTest();

        System.assertEquals(null, apexPage);
    }


    @isTest
    static void getProfile_returns_profile() {

        test.startTest();

        System.Test.setMock(WebServiceMock.class, new MetadataServicePcaMocks.WebServiceMockImpl());

        MetadataService.Profile profile = MetadataServicePca.getProfile('Standard');

        test.stopTest();

        System.assertEquals('Standard', profile.fullName);
    }


    @isTest
    static void getProfile_returns_null() {

        test.startTest();

        System.Test.setMock(WebServiceMock.class, new MetadataServicePcaMocks.WebServiceMockImpl());

        MetadataService.Profile profile = MetadataServicePca.getProfile('not_the_mocked_out_profile');

        test.stopTest();

        System.assertEquals(null, profile);
    }


    @isTest
    static void setApexPagePermissionsOnProfilesTest() {

        MetadataService.ApexPage apexPage = new MetadataService.ApexPage();
        apexPage.fullName = 'Account_Account_Layout_pca_clone';

        MetadataService.ProfileApexPageAccess papa = new MetadataService.ProfileApexPageAccess();
        papa.apexPage = 'Account_Account_Layout_pca_clone';
        papa.enabled = false;
        
        List<MetadataService.Profile> profiles = new List<MetadataService.Profile>();
        for (Integer i=0; i<12; i++) {
            MetadataService.Profile p = new MetadataService.Profile();
            p.fullName = 'Standard' + i;
            p.pageAccesses = new List<MetadataService.ProfileApexPageAccess>();
            p.pageAccesses.add(papa);
        	profiles.add(p);
        }

        test.startTest();

        System.Test.setMock(WebServiceMock.class, new MetadataServicePcaMocks.WebServiceMockImpl());

        List<MetadataService.Profile> results = MetadataServicePca.setApexPagePermissionsOnProfiles(profiles, apexPage);

        test.stopTest();

        for (MetadataService.Profile profile : results) {
            for (MetadataService.ProfileApexPageAccess access : profile.pageAccesses) {
                System.assertEquals('Account_Account_Layout_pca_clone', access.apexPage);
                System.assertEquals(true, access.enabled);
            }
        }

    }


    @isTest
    static void overrideStandardButtonWithApexPageTest() {

        MetadataService.ApexPage apexPage = new MetadataService.ApexPage();
        apexPage.fullName = 'Account_Account_Layout_pca_clone';


        test.startTest();

        System.Test.setMock(WebServiceMock.class, new MetadataServicePcaMocks.WebServiceMockImpl());

        MetadataService.CustomObject cObj = MetadataServicePca.overrideStandardButtonWithApexPage('Account', apexPage);

        test.stopTest();

        System.assertNotEquals(null, cObj);

        System.assertNotEquals(null, cObj.actionOverrides);

        MetadataService.ActionOverride ao = null;
        for (Integer i = 0; i < cObj.actionOverrides.size(); i++) {
            if (cObj.actionOverrides[i].actionName == 'Edit') {
                ao = cObj.actionOverrides[i];
                break;
            }
        }

        System.assertEquals('visualforce', ao.type_x);
        System.assertEquals(apexPage.fullName, ao.content);
    }


    @isTest
    static void overrideStandardButtonWithApexPage_already_has_edit_override_Test() {

        MetadataService.ApexPage apexPage = new MetadataService.ApexPage();
        apexPage.fullName = 'Account_Account_Layout_pca_clone';


        test.startTest();

        System.Test.setMock(WebServiceMock.class, new MetadataServicePcaMocks.WebServiceMockImpl());

        // request a Contact object - the mock for this has an edit override already populated.
        MetadataService.CustomObject cObj = MetadataServicePca.overrideStandardButtonWithApexPage('Contact', apexPage);

        test.stopTest();

        System.assertNotEquals(null, cObj);

        System.assertNotEquals(null, cObj.actionOverrides);

        MetadataService.ActionOverride ao = null;
        for (Integer i = 0; i < cObj.actionOverrides.size(); i++) {
            if (cObj.actionOverrides[i].actionName == 'Edit') {
                ao = cObj.actionOverrides[i];
                break;
            }
        }

        System.assertEquals('visualforce', ao.type_x);
        System.assertEquals(apexPage.fullName, ao.content);
    }
    
    
    @isTest
    static void getAllProfiles_returns_profiles() {
        
        test.startTest();
        
        System.Test.setMock(WebServiceMock.class, new MetadataServicePcaMocks.WebServiceMockImpl());
        
        List<MetadataService.Profile> profiles = MetadataServicePca.getAllProfiles();
        
        test.stopTest();
        
        System.assertNotEquals(null, profiles);
        System.assertNotEquals(0, profiles.size());
    }
    
    
    @isTest
    static void getClonedPageNamesForType_returns_page_names() {
        
        test.startTest();
        
        System.Test.setMock(WebServiceMock.class, new MetadataServicePcaMocks.WebServiceMockImpl());
        
        List<String> pageNames = MetadataServicePca.getClonedPageNamesForType('Account');
        
        test.stopTest();
        
        System.assertNotEquals(null, pageNames);
        System.assertNotEquals(0, pageNames.size());
    }
    
    
    @isTest
    static void deleteClonedPage_returns_true() {
        
        test.startTest();
        
        System.Test.setMock(WebServiceMock.class, new MetadataServicePcaMocks.WebServiceMockImpl());
        
       	Boolean result = MetadataServicePca.deleteClonedPage('any_value_here');
        
        test.stopTest();
        
        System.assertEquals(true, result);
    }
    
    
    @isTest
    static void getPcaRemoteSiteSetting_returns_correct_setting() {
        
        test.startTest();
        
        System.Test.setMock(WebServiceMock.class, new MetadataServicePcaMocks.WebServiceMockImpl());
        
       	MetadataService.RemoteSiteSetting setting = MetadataServicePca.getPcaRemoteSiteSetting('PostcodeAnywhereServices');
        
        test.stopTest();
        
        System.assertEquals('pca__PostcodeAnywhereServices', setting.fullName);
    }
    
    
    @isTest
    static void getPcaRemoteSiteSetting_uses_default_setting_name() {
        
        test.startTest();
        
        System.Test.setMock(WebServiceMock.class, new MetadataServicePcaMocks.WebServiceMockImpl());
        
       	MetadataService.RemoteSiteSetting setting = MetadataServicePca.getPcaRemoteSiteSetting('');
        
        test.stopTest();
        
        System.assertEquals('pca__PostcodeAnywhereServices', setting.fullName);
    }
    
    
    @isTest
    static void getPcaRemoteSiteSetting_returns_null() {
        
        test.startTest();
        
        System.Test.setMock(WebServiceMock.class, new MetadataServicePcaMocks.WebServiceMockImpl());
        
       	MetadataService.RemoteSiteSetting setting = MetadataServicePca.getPcaRemoteSiteSetting('doesnt_exist');
        
        test.stopTest();
        
        System.assertEquals(null, setting);
    }
    
    
    @isTest
    static void addPcaRemoteSiteSetting_returns_true() {
        
        test.startTest();
        
        System.Test.setMock(WebServiceMock.class, new MetadataServicePcaMocks.WebServiceMockImpl());
        
       	Boolean result = MetadataServicePca.addPcaRemoteSiteSetting();
        
        test.stopTest();
        
        System.assertEquals(true, result);
    }
    
    
    @isTest
    static void getEditButtonOverrides_returns_overrides() {
        
        test.startTest();
        
        System.Test.setMock(WebServiceMock.class, new MetadataServicePcaMocks.WebServiceMockImpl());
        
       	List<MetadataService.ActionOverride> overrides = MetadataServicePca.getButtonOverrides('Contact'); //mock only returns overrides for contact object
        
        test.stopTest();
        
        System.assertNotEquals(null, overrides);
        System.assertNotEquals(0, overrides.size());
    }
    
    
    @isTest
    static void getEditButtonOverrides_returns_no_overrides() {
        
        test.startTest();
        
        System.Test.setMock(WebServiceMock.class, new MetadataServicePcaMocks.WebServiceMockImpl());
        
       	List<MetadataService.ActionOverride> overrides = MetadataServicePca.getButtonOverrides('Account'); //mock only returns overrides for contact object
        
        test.stopTest();
        
        System.assertNotEquals(null, overrides);
        System.assertEquals(0, overrides.size());
    }
    
    
    @isTest
    static void removeStandardEditButtonOverrideTest() {
        
        test.startTest();
        
        System.Test.setMock(WebServiceMock.class, new MetadataServicePcaMocks.WebServiceMockImpl());
        
       	MetadataServicePca.removeStandardButtonOverride('Contact');
        MetadataServicePca.removeStandardButtonOverride('Account');
        
        test.stopTest();        
    }
    
    
    @isTest
    static void AddJavascriptHeaderTest() {
        
        test.startTest();
        
        System.Test.setMock(WebServiceMock.class, new MetadataServicePcaMocks.WebServiceMockImpl());
        
       	String addressjs = MetadataServicePca.AddJavascriptHeader(HelperEnums.PCAProduct.Address);
        String emailjs = MetadataServicePca.AddJavascriptHeader(HelperEnums.PCAProduct.Email);
        String mobilejs = MetadataServicePca.AddJavascriptHeader(HelperEnums.PCAProduct.Mobile);
        
        test.stopTest(); 
        
        System.assertNotEquals('', addressjs);
        System.assertNotEquals('', emailjs);
        System.assertNotEquals('', mobilejs);
    }
    
    
    @isTest
    static void AddJavascriptMappingsTest() {
        
        Map<HelperEnums.PCAProduct, Map<String, String>> productFieldMappings = new Map<HelperEnums.PCAProduct, Map<String, String>>();
        String fieldName = 'testFieldName';
            
        test.startTest();
        
        System.Test.setMock(WebServiceMock.class, new MetadataServicePcaMocks.WebServiceMockImpl());
        
       	MetadataServicePca.AddJavascriptMappings(productFieldMappings, HelperEnums.PCAProduct.Address, fieldName);
        MetadataServicePca.AddJavascriptMappings(productFieldMappings, HelperEnums.PCAProduct.Email, fieldName);
        MetadataServicePca.AddJavascriptMappings(productFieldMappings, HelperEnums.PCAProduct.Mobile, fieldName);
        
        test.stopTest(); 
	}
}