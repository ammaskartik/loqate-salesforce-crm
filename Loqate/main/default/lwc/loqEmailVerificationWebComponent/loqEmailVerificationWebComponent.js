import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import loqUpdateEmailAddress from '@salesforce/apex/loqEmailController.loqUpdateEmailAddress';

export default class LoqEmailVerificationWebComponent extends LightningElement {

    //Enable update button flag
    enableButton = false;
    //Initializing Search Key
    searchKey = '';
    //@track value='';
    //API for Component Title
    @api loqComponentTitle;
    //API for Loqate Email Validation endpoint
    @api loqEmailValidEndPoint;
    //API for Loqate Email Validation timeout
    @api loqEmailValidTimeout;
    //API for Loqate APIKey
    @api loqAPIKey;
    //API for Loqate Timeout
    @api loqTimeOut;
    //API for Loqate Email Field 
    @api loqEmailField;
    //API for Object to update
    @api objectApiName;
    //API for current record context
    @api recordId;
    error;


    handleSearchKeyChange(event) {
        //Loqate cartridge LQT-50 SF CRM Build LQT-138. Hide the button on change of the email text when cleared
        this.enableButton = false;
        //Initializing errors to blank
        this.error = '';
        //Setting Key value as it gets modified
        this.searchKey = event.target.value;
        //Enter Key search
        const isEnterKey = event.keyCode === 13;
        //Fetch call to Loqate Find API to retrive set of Ids
        //Loqate cartridge LQT-50 SF CRM Build LQT-138. Changing the logic to only enable the search when the email field is not empty
        if(this.searchKey != '' && isEnterKey) {
            //FETCH call for email validation
            this.fetchLoq_EmailValidate();
        }
    }


    //Loqate Capture Interactive Find Call
    fetchLoq_EmailValidate() {
        this.error='';
        //Fetch call to Loqate Find API to retrive set of Ids
        fetch(this.loqEmailValidEndPoint + '?Key=' + this.loqAPIKey + '&Email=' + this.searchKey + '&Timeout=' + this.loqTimeOut)
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
                    if (jsonResponse.Items[0].ResponseCode == "Invalid") {
                        this.enableButton = false;
                        var loqerror = 'Email is not valid.';
                        if (jsonResponse.Items[0].ResponseCode==null) {
                            loqerror=loqerror;
                        } else {
                            loqerror=loqerror+'Error:' + jsonResponse.Items[0].ResponseCode + ":" + jsonResponse.Items[0].ResponseMessage;
                        }
                        this.error = loqerror;
                    }
                    //Loqate cartridge LQT-50 SF CRM Build. Bug LQT-137. Enabling the update to be enabled for Valid_CatchAll
                    else if(jsonResponse.Items[0].ResponseCode == "Valid_CatchAll"){
                        //Enable the Update Button
                        this.enableButton = true;
                        var loqerror = 'Use discretion.';
                        if (jsonResponse.Items[0].ResponseCode==null) {
                            loqerror=loqerror;
                        } else {
                            loqerror=loqerror+ jsonResponse.Items[0].ResponseCode + ":" + jsonResponse.Items[0].ResponseMessage;
                        }                    
                        this.error=loqerror;
                    }
                    else {
                        //Enable the Update Button
                        this.enableButton = true;                      
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

    updateEmail() {
        //Initializing Errors to blank
        this.error = '';
        //Imperative APEX Method call loqUpdateAddress from '@salesforce/apex/loqAddressController.loqUpdateAddress'
        //Returns a promise as result
        //alert(this.searchKey+": ObjectName: "+this.objectApiName+"ObjId: "+this.recordId+"mapStr: "+ this.loqEmailField);
        loqUpdateEmailAddress(
            { validemail: this.searchKey, ObjectName: this.objectApiName, ObjId: this.recordId, mapStr: this.loqEmailField }
        )
            //Processing the promise
            .then(result => {
                //Passing on the result from the function to a variable for display along with the toast message
                this.updmessage = result;
                //Initializing the Toast Message for Success
                const evt = new ShowToastEvent({
                    title: 'Loqate Email Address Update',
                    message: this.updmessage,
                    variant: 'success',
                });
                //Refreshing the record to show the updated values
                eval("$A.get('e.force:refreshView').fire();");
                //Dispatching the Toast Message - Success
                this.dispatchEvent(evt);
                // Disabling the button to avoid multiple updates
                this.enableButton = false;

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