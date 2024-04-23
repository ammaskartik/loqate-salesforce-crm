import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import loqUpdatePhone from '@salesforce/apex/loqPhoneController.loqUpdatePhone';
import getCountryList from '@salesforce/apex/loqPhoneController.getCountryList';

export default class LoqPhoneVerificationWebComponent extends LightningElement {
     //Enable update button flag
    enableButton = false;
    //Initializing Search Key
    searchKey = '';
    @track iso2_country='';
    //@track value='';
    //API for Component Title
    @api loqComponentTitle;
    //API for Loqate Email Validation endpoint
    @api loqPhoneValidEndPoint;
    //API for Loqate APIKey
    @api loqAPIKey;
    //API for Loqate Email Field 
    @api loqPhoneField;
    //API for Object to update
    @api objectApiName;
    //API for current record context
    @api recordId;
    error;
    @track countries;
   
    get options() {
        getCountryList()
        .then(result => {
            this.countries= result;
        })
        .catch(error => {
            this.error = error;
        });
        //alert(JSON.stringify(this.countries));
        var country_opt= new Array();
        for (var i in this.countries)
        {
            var opt={"label":this.countries[i].Name,"value":this.countries[i].pca__ISO2_Code__c};
            //alert(this.opt);
            country_opt.push(opt);

        }
        //alert(JSON.stringify(country_opt));
      return  country_opt;
    }




    handleSearchKeyChange(event) {
        this.enableButton = false;
        //Initializing errors to blank
        this.error = '';
        //Setting Key value as it gets modified
        this.searchKey = event.target.value;
        //Enter Key search
        const isEnterKey = event.keyCode === 13;
        //Loqate cartridge LQT-50 SF CRM Build. Bug LQT-133. Check for  Zero and Plus
        var zerochk=false;
        var pluschk=false;
        switch (this.searchKey.charAt(0)) {
            case '0':
                zerochk=true;
                this.searchKey=this.searchKey.slice(1);
                break;
            case '+':
                pluschk=true;
                this.searchKey=this.searchKey.slice(1);
                break;
            default:
                break;
        }

        //Fetch call to Loqate Find API to retrive set of Ids
        //Loqate cartridge LQT-50 SF CRM Build. Bug LQT-136. updated the check for null to ''
        if(this.searchKey != '' && isEnterKey) {
            //FETCH call for email validation
            this.fetchLoq_PhoneValidate();
        }
    }


    handleISOCountryChange(event){
        //Initializing errors to blank
        this.error = '';
        this.enableButton = false;
        //Setting Key value as it gets modified
        //this.iso2_country = isoevt.target.value;
        //this.value = event.detail.value;
        this.iso2_country=event.detail.value;
    }

    

    //Loqate Fetch Country Code
    fetchLoq_ISOCountry(){
        //LOgic here
    }

    //Loqate Capture Interactive Find Call
    fetchLoq_PhoneValidate() {
        this.error='';
        //Fetch call to Loqate Find API to retrive set of Ids
        fetch(this.loqPhoneValidEndPoint + '?Key=' + this.loqAPIKey + '&Phone=' + this.searchKey + '&Country=' + this.iso2_country)
            //Getting the Response from FETCH and checking if it threw an error and then Passing it on for processing in the next then
            .then(response => {
                // fetch isn't throwing an error if the request fails.
                // Therefore we have to check the ok property.
                if (!response.ok) {
                    this.error = response;
                }
                return response.json();
            })
            //Parsing the response in JSON from the FETCH API call for success and error scenarios
            .then(jsonResponse => {
                //alert(jsonResponse);
                if (jsonResponse.Items[0].Error == null) {
                    if (!jsonResponse.Items[0].RequestProcessed || jsonResponse.Items[0].IsValid!='Yes'){
                    //if (jsonResponse.Items[0].ResponseCode != "Valid") {
                        this.enableButton = false;
                        var loqerror = 'Number is Not Valid.';
                        //Loqate cartridge LQT-50 SF CRM Build. Bug LQT-136. If the response code is not null then only appending the error with the response message
                        if (jsonResponse.Items[0].ResponseCode==null) {
                            loqerror=loqerror;
                        } else {
                            loqerror=loqerror+'Error:' + jsonResponse.Items[0].ResponseCode + ":" + jsonResponse.Items[0].ResponseMessage;
                        }
                        this.error = loqerror;
                    } else {
                        //Enable the Update Button
                        this.enableButton = true;
                        ////Loqate cartridge LQT-50 SF CRM Build. Bug LQT-133.Reseting Country drop-down
                        //Commenting. Loqate cartridge LQT-50 SF CRM Build. LQT-144. Observation to not reset the country dropdown
                        //this.iso2_country='';
                        this.searchKey=jsonResponse.Items[0].PhoneNumber;                    
                        this.error="";
                    }

                } else {
                    this.enableButton = false;
                    //Appending Errors from the Service to be displayed on the component as Loqate Excpetions
                    this.error = jsonResponse.Items[0].Error + ":" + jsonResponse.Items[0].Description + ":" + jsonResponse.Items[0].Cause;
                }
            })
            .catch(error => {
                this.enableButton = false;
                //Appending Errors from the Service to be displayed on the component as Loqate Excpetions
                this.error = error;
            });
            
    };

    updatePhone() {
        //Initializing Errors to blank
        this.error = '';
        //Imperative APEX Method call loqUpdateAddress from '@salesforce/apex/loqAddressController.loqUpdateAddress'
        //Returns a promise as result
        //alert(this.searchKey+": ObjectName: "+this.objectApiName+"ObjId: "+this.recordId+"mapStr: "+ this.loqPhoneField);
        loqUpdatePhone(
            { validphone: this.searchKey, ObjectName: this.objectApiName, ObjId: this.recordId, mapStr: this.loqPhoneField }
        )
            //Processing the promise
            .then(result => {
                //Passing on the result from the function to a variable for display along with the toast message
                this.updmessage = result;
                //Initializing the Toast Message for Success
                const evt = new ShowToastEvent({
                    title: 'Loqate Phone Update',
                    message: this.updmessage,
                    variant: 'success',
                });
                //Refreshing the record to show the updated values
                eval("$A.get('e.force:refreshView').fire();");
                //Dispatching the Toast Message - Success
                this.dispatchEvent(evt);
                // Disabling the button to avoid multiple updates
                this.enableButton = false;
                ////Loqate cartridge LQT-50 SF CRM Build. Bug LQT-133.Reseting country dropdown
                this.iso2_country='';

            })
            //Processing errors from the promise
            .catch((error) => {
                //Appending the error code and body of the error for display in a toast message
                this.updmessage = 'Error received: code' + error.errorCode + ', ' + 'message ' + error.body.message;
                //Initializing the Toast Message for Error
                const evt = new ShowToastEvent({
                    title: 'Loqate Address Update',
                    message: this.updmessage,
                    variant: 'error',
                });
                //Dispatching the Toast Message - Error
                this.dispatchEvent(evt);
            });
    }

}