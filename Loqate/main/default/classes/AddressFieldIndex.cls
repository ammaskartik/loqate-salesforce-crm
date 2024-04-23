global class AddressFieldIndex implements Comparable {

    public PostcodeAnywhereFields__c Field;
  
    private List<string> addressFieldTypes = new List<string> { 
    'Company',
'BuildingNumber',
'BuildingName',
'Building',
'SubBuilding',
'Street',
'SecondaryStreet',
'Block',
'Line1',
'Line2',
'Line3',
'Line4',
'Line',
'Neighbourhood',
'City',
'District',
'Province',
'ProvinceName',
'ProvinceCode',
'PostalCode',
'CountryName',
'CountryIso2',
'CountryIso3',
'CountryIsoNumber',
'Department',
'Language',
'Latitude',
'Longitude',
'AdminAreaName',
'AdminAreaCode',
'Id',
'DomesticId'
    };
    
    public AddressFieldIndex(PostcodeAnywhereFields__c field) {
        this.Field = field;
    }
    
    private Integer getIndex(string valueFormat) {
        for (integer i = 0; i < addressFieldTypes.size(); i++) {
            if (valueFormat.contains(addressFieldTypes.get(i)))
                return addressFieldTypes.size() - i;
        }
        
        return -1;
    }
    
    global Integer compareTo(Object compareTo) {
        AddressFieldIndex compare = (AddressFieldIndex)compareTo;
        
        if (getIndex(this.Field.Value__c) == -1)
            return 1;
        
        if (getIndex(this.Field.Value__c) > getIndex(compare.Field.Value__c))
            return -1;
        
        if (getIndex(this.Field.Value__c) < getIndex(compare.Field.Value__c))
            return 1;
        
        return 0;      
    }
}