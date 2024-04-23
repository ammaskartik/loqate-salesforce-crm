global class CountryIndex implements Comparable {

    public PostcodeAnywhereCountries__c Country;
    
    public CountryIndex(PostcodeAnywhereCountries__c country) {
        this.Country = country;
    }
    
    global Integer compareTo(Object compareTo) {
        CountryIndex compare = (CountryIndex)compareTo;
        
        if (this.Country.Index__c > compare.Country.Index__c)
            return 1;
        
        if (this.Country.Index__c < compare.Country.Index__c)
            return - 1;
        
        return 0;      
    }
}