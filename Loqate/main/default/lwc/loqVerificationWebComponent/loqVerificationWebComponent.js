import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import loqUpdateAddress from '@salesforce/apex/loqAddressController.loqUpdateAddress';



export default class LoqVerificationWebComponent extends LightningElement {


    //Keyed in Search String
    searchKey = '';
    //Key for Loqate retrieve call
    retKey = '';
    //Store JSON from retrieve call
    jsonData = '';
    //Flag to enable Update button
    enableButton = false;
    //Variable to store the REST Fetch() call results from Loqate Find call
    @track loqAddresses;
    // To store the REST Fetch() call errors if any
    error;
    //API for Component Title
    @api loqComponentTitle;
    //API for Address Type
    @api loqAddressType;
    //API for Limiting Search Results
    @api loqLimitResult;
    //API for language
    @api loqLanguage;
    //API for Countries
    @api loqCountries;
    //API for API Key for Loqate
    @api loqAPIKey;
    //API for Loqate EndPoint
    @api loqEndPoint;
    //API for Retrieve Loqate EndPoint
    @api loqRetEndPoint;
    //API for Record update mapping
    @api loqRecUpdateSetup;
    //API for enabling Geolocation enabled
    @api loqGeoLocEnabled;
    //API for Geolocation Search EndPoint if GeoLocation is enabled
    @api loqGeoLocEndPoint;
    //API for Object to update
    @api objectApiName;
    //API for current record context
    @api recordId;
    //To store the part of the Loqate Retrieve JSON response to pass on to the Update Call
    jInp = '';
    //To Store the result from the update call
    updmessage = '';



    handleSearchKeyChange(event) {
        //Hiding the Update Button to avoid empty updates
        this.enableButton = false;
        //Initializing errors to blank
        this.error = '';
        //Setting Key value as it gets modified
        this.searchKey = event.target.value;
        //Fetch call to Loqate Find API to retrive set of Ids
        //Loqate cartridge LQT-50 SF CRM Build. LQT-134. Updated the logic for suppressing any call until the search field is not empty
        if (this.searchKey!='') {
            var cntnr='';
            this.fetchLoq_Find(cntnr);
        }
        //Loqate cartridge LQT-50 SF CRM Build LQT-144
        else{
        ////Setting the Address list to null to suppress the drop down values
        this.loqAddresses = null;
        }
    }

    handleOnSelect(evt) {
        //Initalizing the error to blank
        this.error = '';
        //Setting the Search Input box with what was selected
        //this.searchKey = evt.target.innerHTML;
        this.searchKey = evt.target.dataset.loqaddtext + ',' + evt.target.dataset.loqadddescr;
        //Setting the variable with the Id for the retrieve call
        this.retKey = evt.target.dataset.loqid;
        ////Setting the Address list to null to suppress the drop down values
        this.loqAddresses = null;
        // If Geo-Location search is enables, toggling back to enable a search again if needed after address selection
        if (this.loqGeoLocEnabled) {
            const checkbox = this.template.querySelector('lightning-input');
            checkbox.checked = false;
            //Loqate cartridge LQT-50 SF CRM Build.Enabling the Address Search field (No bug reported)
            const inpbox = this.template.querySelector('input');
            //inpbox.readOnly = false;
            inpbox.style.display = 'block';
        }

        //Loqate Retreieve Call
        if (evt.target.dataset.loqtype=='Address' && this.retKey!=null) {
            this.fetchLoq_Retrieve();
        }
        //Recurse a Find for other address types
        else
        {
            this.fetchLoq_Find(evt.target.dataset.loqid);
        }
    }

    updateAddress(Updevt) {
        //Initializing Errors to blank
        this.error = '';
        //Imperative APEX Method call loqUpdateAddress from '@salesforce/apex/loqAddressController.loqUpdateAddress'
        //Returns a promise as result
        loqUpdateAddress(
            { jsonInput: Updevt.target.value, ObjectName: this.objectApiName, ObjId: this.recordId, mapStr: this.loqRecUpdateSetup }
        )
            //Processing the promise
            .then(result => {
                //Passing on the result from the function to a variable for display along with the toast message
                this.updmessage = result;
                //Initializing the Toast Message for Success
                const evt = new ShowToastEvent({
                    title: 'Loqate Address Update',
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

    //Fetch GoeLocation from Device
    loq_enableGeoLocationSearch(evt) {
        //Initializing errors to zero
        this.error = '';
        //Initializing Co-ordinates to blank
        var latitude = '';
        var longitude = '';
        // If Fetch Geo-Location is toggled to ACTIVE
        if (evt.target.checked) {
            //Loqate cartridge LQT-50 SF CRM Build.Hiding Address Search field (No bug reported)
            const inpbox = this.template.querySelector('input');
            //inpbox.readOnly = true;
            inpbox.style.display = 'none';
            //If device allows to fetch coordinates
            if (navigator.geolocation) {
                //Get current position in showPostion Object
                navigator.geolocation.getCurrentPosition((showPosition) => {
                    //Parsed Lattitude
                    latitude = showPosition.coords.latitude;
                    //Parsed Lattitude
                    longitude = showPosition.coords.longitude;
                    //Overiding Fetched values for testing, since India doesn't allow reverse geo-coding
                    //latitude = '51.523767';
                    //longitude = '-0.1607444';
                    //Displaying Co-ordinates in the Searchbox
                    this.searchKey = latitude + ',' + longitude;
                    //Making the Geo-Location Call
                    this.fetchLoq_GeoCodeFind( latitude,longitude );
                });
            }
            //If device doesn't support collecting location information. Showing a toats message
            else {
                //Setting up the Geo-Location toast message
                const evt = new ShowToastEvent({
                    title: 'Loqate Geo-Location Search',
                    message: 'Geolocation is not supported or allowed by this browser/device',
                    variant: 'error',
                });
                //Reseting the Search Input box to blank
                this.searchKey = '';
            }

        }
        // If Fetch Geo-Location is toggled to Inactive
        else {
            //Loqate cartridge LQT-50 SF CRM Build.Enable the Addrress Search field (No bug reported)
            const inpbox = this.template.querySelector('input');
            //inpbox.readOnly = false;
            inpbox.style.display = 'block';
            //Reseting the Search Input box to blank
            this.searchKey = '';
            //Hiding the update button
            this.enableButton = false;
            //Reseting any errors to blank
            this.error = '';
        }
    }

    //Loqate Capture Interactive Find Call
    fetchLoq_Find(cntnr){
        //Fetch call to Loqate Find API to retrive set of Ids
        fetch(this.loqEndPoint + '?Key=' + this.loqAPIKey + '&Text=' + this.searchKey + '&Countries=' + this.loqCountries + '&Limit=' + this.loqLimitResult + '&Language=' + this.loqLanguage +'&Container='+cntnr)
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
            //Loqate cartridge LQT-50 SF CRM Build. LQT-135. Handle empty response scenario
            //Checking for Undefined Response
            if (jsonResponse.Items[0] != undefined) {
                if (jsonResponse.Items[0].Error == null) {
                    //Assigning the values for the drop down
                    this.loqAddresses = jsonResponse;
                } else {
                    //Appending Errors from the Service to be displayed on the component as Loqate Excpetions
                    this.error = jsonResponse.Items[0].Error + ":" + jsonResponse.Items[0].Description + ":" + jsonResponse.Items[0].Cause;
                    //Setting the drop down to empty
                    this.loqAddresses = undefined;
                }
            }
            //Loqate cartridge LQT-50 SF CRM Build. LQT-135. Handle empty response scenario
            //Checking for Undefined Response
            else
            {
                this.error = 'No addresses returned. Please search again';
                this.loqAddresses = undefined;
            }
            })
            .catch(error => {
                //Appending Errors from the Service to be displayed on the component as Loqate Excpetions
                this.error = error;
                //Setting the drop down to empty
                this.loqAddresses = undefined;
            });
    };
    
    //Loqate Capture Interactive Retrieve Call
    fetchLoq_Retrieve(){
        //Loqate Retreieve Call
        fetch(this.loqRetEndPoint + '?Key=' + this.loqAPIKey + '&Id=' + this.retKey)
            //Collecting the response from the Retrieve Call and checking if it is valid
            .then(response => {
                // fetch isn't throwing an error if the request fails.
                // Therefore we have to check the ok property.
                if (!response.ok) {
                    this.error = response;
                }
                return response.json();
            })
            //Parsing the response in JSON from the Retrieve API call for success and error scenarios
            .then(jsonResponse => {
                //Checking for Undefined Response
                if (jsonResponse.Items[0] != undefined) {
                    //Check for Error in Response from Loqate.
                    if (jsonResponse.Items[0].Error == null) {
                        this.loqRetrieveAddresses = jsonResponse;
                        //Passing retrieved aaddress to the button to be updated onclick of the button
                        this.jInp = JSON.stringify(this.loqRetrieveAddresses.Items[0]);
                        //Enabling the button to true after the selecting the address
                        this.enableButton = true;
                    }
                    //Response from Retrieve is Error
                    else {
                        //Setting the Retrieve variable to null
                        this.loqRetrieveAddresses = null;
                        //Appending the error code and error description
                        this.error = jsonResponse.Items[0].Error + ":" + jsonResponse.Items[0].Description + ":" + jsonResponse.Items[0].Cause;
                        //Enable the Update address button
                        this.enableButton = false;
                    }
                    //Handling and undefined response from retrieve call
                } else {
                    this.loqRetrieveAddresses = null;
                    this.error = "Please refine your search";
                    this.enableButton = false;
                }
            })
            //Message Parsing errors from the Retrieve Call
            .catch(error => {
                this.error = error;
                this.loqRetrieveAddresses = null;
            });
    };

    //Capture Interactive GeoLocation
    fetchLoq_GeoCodeFind(latitude,longitude){
        //Making the Geo-Location Call
        fetch(this.loqGeoLocEndPoint + '?Key=' + this.loqAPIKey + '&Latitude=' + latitude + '&Longitude=' + longitude + '&Items=' + this.loqLimitResult)
        //Fetch Returns a promise.
        .then(response => {
            // fetch isn't throwing an error if the request fails.
            // Therefore we have to check the ok property.
            if (!response.ok) {
                this.error = response;
            }
            return response.json();
        })
        //The success response is converted to JSON and parsed
        .then(jsonResponse => {
        //Loqate cartridge LQT-50 SF CRM Build. LQT-135. Handle empty response scenario
        //Checking for Undefined Response
        if (jsonResponse.Items[0] != undefined) {
            //Checking for errors from the response. If no errors
            if (jsonResponse.Items[0].Error == null) {
                //Passing the response to display the drop down values
                this.loqAddresses = jsonResponse;
            } else {
                //Appending the error with the Errors from parsing
                this.error = jsonResponse.Items[0].Error + ":" + jsonResponse.Items[0].Description + ":" + jsonResponse.Items[0].Cause;
                //Setting the Address variable to null to reset the drop down
                this.loqAddresses = null;
            }
        }
        else
        {
            this.error = 'No addresses returned. Please search again';
            this.loqAddresses = undefined;
        }
            //Errors in the FETCH Call
        })
        .catch(error => {
            this.error = error;
            this.loqAddresses = undefined;
        });
    };
}