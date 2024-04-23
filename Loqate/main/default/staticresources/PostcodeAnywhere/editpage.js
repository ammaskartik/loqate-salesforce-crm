(function () {
    //namespace
    var pca = window.pca = window.pca || {};

    //salesforce edit page object
    pca.EditPage = function () {
        var editpage = new pca.Eventable(this);

        editpage.settings = window.pca_Settings || {};
        editpage.settings.addresses = window.pca_Addresses || {};
        editpage.settings.payments = window.pca_Payments || {};
        editpage.settings.emails = window.pca_Emails || {};
        editpage.settings.actions = window.pca_Actions || {};
        editpage.settings.user = window.pca_User || {};

        editpage.addressControls = {};
        editpage.addressControlsCount = 0;
        editpage.status = document.getElementById("pca_status");

        editpage.sfdc = null;
        editpage.ilePrefixes = ["acc17", "acc18", "con18", "con19", "lea16", "ctrc25", "PersonMailingAddress"];
        editpage.ileSuffix = "";
        editpage.ileSubmitButton = null;
        editpage.ileAddressControl = null;
        editpage.ileSelectedAddress = null;

        editpage.eventMap = {
            "PageStartup": "start",
            "ComponentStartup": "load",
            "ComponentLoaded": "loaded",
            "AddressSearch": "search",
            "AddressSelect": "select",
            "AddressCopy": "copy",
            "AddressClear": "clear",
            "FieldChange": "change",
            "CountryChange": "country",
            "ComponentError": "error"
        };

        editpage.load = function () {
            var addresses = editpage.settings.addresses;

            function createAddressControl(fields) {
                var control = new pca.Address([
                        { element: fields.Company, field: "Company", mode: (editpage.settings.DisableCompanySearch || existingBoundCompany(fields.Company) ? pca.fieldMode.POPULATE : pca.fieldMode.DEFAULT) | pca.fieldMode.PRESERVE },
                        { element: fields.Street, field: "Line1", mode: editpage.settings.DisableStreetSearch ? pca.fieldMode.NONE : pca.fieldMode.SEARCH },
                        { element: fields.City, field: "City", mode: editpage.settings.DisableCitySearch ? pca.fieldMode.POPULATE : pca.fieldMode.DEFAULT },
                        { element: fields.State, field: "Province", mode: editpage.settings.DisableStateSearch ? pca.fieldMode.POPULATE : pca.fieldMode.DEFAULT },
                        { element: fields.Postcode, field: "PostalCode", mode: editpage.settings.DisablePostcodeSearch ? pca.fieldMode.POPULATE : pca.fieldMode.DEFAULT },
                        { element: fields.Country, field: "CountryName", mode: pca.fieldMode.COUNTRY },
                        { element: fields.Area, field: "AdminAreaName", mode: pca.fieldMode.POPULATE },
                        { element: fields.Id, field: "Id", mode: pca.fieldMode.POPULATE },
                        { element: fields.Building, field: "BuildingNumber", mode: pca.fieldMode.POPULATE }
                    ],
                    {
                        key: editpage.settings.StandardKey,
                        source: "salesforce",
                        onlyInputs: true,
                        setCursor: false,
                        countries: {
                            codesList: editpage.settings.CountryList,
                            nameType: editpage.settings.CountryNameStyle == "3 Character ISO Code" ? pca.countryNameType.ISO3 : editpage.settings.CountryNameStyle == "2 Character ISO Code" ? pca.countryNameType.ISO2 : pca.countryNameType.NAME,
                            valueType: pca.countryNameType.ISO2,
                            defaultCode: editpage.settings.DefaultUserCountry ? editpage.settings.user.country : ""
                        }
                    }),
                    residentialField = pca.getElement(fields.Residential),
                    validationField = pca.getElement(fields.Validation);

                control.salesforce = {};
                control.salesforce.fields = fields;
                control.salesforce.valid = true;
                control.listen("error", pcaSidebarError);

                control.salesforce.fieldChanged = function () {
                    control.salesforce.valid = false;
                    if (pca.inputField(validationField) || pca.checkBox(validationField)) pca.setValue(validationField, control.salesforce.valid);
                    editpage.fire("change");
                }

                for (var a = 0; a < control.fields.length; a++) {
                    var elem = pca.getElement(control.fields[a].element)

                    if (elem) {
                        elem.autocomplete = "off";
                        pca.listen(elem, "change", control.salesforce.fieldChanged);
                    }
                }

                control.listen("country", function (country) {
                    editpage.fire("country", control, country);
                });

                control.listen("prepopulate", function (details) {
                    editpage.fire("search", control, details);
                });

                control.listen("populate", function (address) {
                    control.salesforce.valid = true;
                    pca.setValue(fields.Street, pca.tidy(pca.formatLine(address, "{Line1}\n{Line2}\n{Line3}\n{Line4}\n{Line5}"), "\n"));
                    if (pca.inputField(residentialField)) pca.setValue(residentialField, (residentialField.type && residentialField.type == "checkbox" ? address.Type == "Residential" : address.Type));
                    if (pca.inputField(validationField) || pca.checkBox(validationField)) pca.setValue(validationField, control.salesforce.valid);
                    editpage.fire("select", control, address);
                });

                if (fields.Street == "acc17street" || fields.Street == "con19street")
                    overrideCopyLink();

                control.listen("clear", function () { editpage.fire("clear", control); });
                control.listen("error", function (message) { editpage.fire("error", control, message); });

                editpage.fire("load", control);
                editpage.addressControlsCount++;

                return control;
            }

            function createEmailValidation(fields, inlineMode) {
                var emailField = pca.getElement(fields.Email),
                    statusImg = pca.create("img", { src: "/img/checkbox_unchecked.gif" }),
                    statusMessage = pca.create("span", { className: "errorMsg" }),
                    validationField = pca.getElement(fields.Validation);

                function populateField(id, value) {
                    inlineMode ? populateInlineEditField(id, value) : pca.setValue(id, value);
                }

                function validate() {
                    var email = pca.getValue(emailField);

                    function success(response) {
                        if (response.length) {
                            var errorMessage = "";

                            if (!response[0].FoundDnsRecord) errorMessage = "Could not find host";
                            if (!response[0].ValidFormat) errorMessage = "Incorrect format";

                            !errorMessage ? setValid() : setInvalid(errorMessage);
                        }
                    }

                    if (email)
                        pca.fetch("EmailValidation/Interactive/Validate/v1.10", { key: editpage.settings.StandardKey, email: email }, success, setInvalid);
                    else
                        setValid();
                }

                function setValid() {
                    populateField(fields.Validation, true);
                    showValid();
                }

                function showValid() {
                    statusImg.src = "/img/checkbox_checked.gif";
                    statusMessage.innerHTML = "";
                }

                function setInvalid(message) {
                    populateField(fields.Validation, false);
                    showInvalid(message);
                }

                function showInvalid(message) {
                    statusImg.src = "/img/checkbox_unchecked.gif";
                    statusMessage.innerHTML = message;
                }

                function reset() {
                    if (!inlineMode) setInvalid("");
                }

                if (validationField) {
                    validationField.style.display = "none";
                    validationField.parentNode.appendChild(statusImg);
                    validationField.parentNode.appendChild(statusMessage);

                    if (pca.checkBox(validationField) && validationField.checked)
                        showValid();
                    else if (inlineMode) {
                        var validImage = pca.getElement(fields.Validation + "_chkbox");

                        if (validImage && validImage.title == "Checked")
                            showValid();
                    }
                }
                else if (inlineMode) {
                    emailField.parentNode.parentNode.appendChild(statusImg);
                    emailField.parentNode.parentNode.appendChild(statusMessage);
                }
                else {
                    emailField.parentNode.appendChild(statusImg);
                    emailField.parentNode.appendChild(statusMessage);
                    emailField.style.cssFloat = "left";
                }

                pca.listen(emailField, "change", validate);
                pca.listen(emailField, "keyup", reset);
            }

            function createInlineEmailValidation(fields) {
                var emailIle = pca.getElement(fields.Email + "_ilecell"),
                    launched = false;

                function launchInlineEmailValidation() {
                    if (!editpage.sfdc.editMode)
                        editpage.sfdc.activateInlineEditMode();

                    if (!editpage.sfdc.inlineEditData.isCurrentField(editpage.sfdc.getFieldById(emailIle.id)))
                        editpage.sfdc.inlineEditData.openField(editpage.sfdc.getFieldById(emailIle.id));

                    if (!launched) {
                        launched = true;
                        createEmailValidation(fields, true);
                    }
                }

                //overwrite existing handlers
                if (emailIle) emailIle.ondblclick = launchInlineEmailValidation;
            }

            function createBankValidation(fields, inlineMode) {
                var sortcodeField = pca.getElement(fields.SortCode),
                    accountField = pca.getElement(fields.AccountNumber),
                    statusImg = pca.create("img", { src: "/img/checkbox_unchecked.gif" }),
                    statusMessage = pca.create("span", { className: "errorMsg" }),
                    validationField = pca.getElement(fields.Validation);

                function populateField(id, value) {
                    inlineMode ? populateInlineEditField(id, value) : pca.setValue(id, value);
                }

                function validate() {
                    var sortcode = pca.getValue(sortcodeField),
                        accountNumber = pca.getValue(accountField);

                    function success(response) {
                        populateField(fields.BankBIC, response[0].BankBIC);
                        populateField(fields.BankName, response[0].Bank);
                        populateField(fields.BranchBIC, response[0].BranchBIC);
                        populateField(fields.BranchName, response[0].Branch);
                        populateField(fields.ContactAddress, response[0].ContactAddressLine1 + "\n" + response[0].ContactAddressLine2);
                        populateField(fields.ContactCity, response[0].ContactPostTown);
                        populateField(fields.ContactPostcode, response[0].ContactPostcode);
                        populateField(fields.ContactPhone, response[0].ContactPhone);
                        populateField(fields.ContactFax, response[0].ContactFax);
                        populateField(fields.DirectDebit, response[0].IsDirectDebitCapable);
                        populateField(fields.CHAPS, response[0].CHAPSSupported);
                        populateField(fields.FasterPayments, response[0].FasterPaymentsSupported);

                        response[0].IsCorrect || !accountNumber ? setValid() : setInvalid(pca.formatCamel(response[0].StatusInformation));
                    }

                    if (!pca.inputField(sortcodeField) && inlineMode)
                        sortcode = pca.getValue(fields.SortCode + "_ileinner");

                    if (!pca.inputField(accountField) && inlineMode)
                        accountNumber = pca.getValue(fields.AccountNumber + "_ileinner");

                    if (sortcode)
                        pca.fetch("BankAccountValidation/Interactive/Validate/v2.00", { key: editpage.settings.StandardKey, sortcode: sortcode, accountnumber: accountNumber || "00000000" }, success, setInvalid);
                    else {
                        if (!accountNumber)
                            setValid();
                        else
                            setInvalid("SortCode Required");
                    }
                }

                function setValid() {
                    populateField(fields.Validation, true);
                    showValid();
                }

                function showValid() {
                    statusImg.src = "/img/checkbox_checked.gif";
                    statusMessage.innerHTML = "";
                }

                function setInvalid(message) {
                    populateField(fields.Validation, false);
                    showInvalid(message);
                }

                function showInvalid(message) {
                    statusImg.src = "/img/checkbox_unchecked.gif";
                    statusMessage.innerHTML = message;
                }

                function reset() {
                    if (!inlineMode) setInvalid("");
                }

                function bindAccountField() {
                    if (!inlineMode && pca.checkBox(validationField)) {
                        validationField.style.display = "none";
                        validationField.parentNode.appendChild(statusImg);
                        validationField.parentNode.appendChild(statusMessage);

                        if (validationField.checked) showValid();
                    }
                    else if (!inlineMode) {
                        accountField.parentNode.appendChild(statusImg);
                        accountField.parentNode.appendChild(statusMessage);
                        accountField.style.cssFloat = "left";
                    }
                    else addInlineValidationMessage();

                    pca.listen(accountField, "change", validate);
                    pca.listen(accountField, "keyup", reset);
                }

                function bindSortCodeField() {
                    pca.listen(sortcodeField, "change", validate);
                    pca.listen(sortcodeField, "keyup", reset);
                }

                function addInlineValidationMessage() {
                    if (validationField) {
                        var validationContainer = pca.getElement(fields.Validation + "_ileinner");
                        if (validationContainer) validationContainer.appendChild(statusMessage);
                    }
                    else if (pca.inputField(accountField)) {
                        accountField.parentNode.parentNode.appendChild(statusImg);
                        accountField.parentNode.parentNode.appendChild(statusMessage);
                    }
                    else {
                        var accountFieldContainer = pca.getElement(fields.AccountNumber + "_ileinner");
                        if (accountFieldContainer) {
                            accountFieldContainer.appendChild(statusImg);
                            accountFieldContainer.appendChild(statusMessage);
                        }
                    }
                }

                //fix for help text
                if (!pca.inputField(sortcodeField))
                    sortcodeField = pca.getElement(fields.SortCode + "_ilecell");

                if (!pca.inputField(accountField))
                    accountField = pca.getElement(fields.AccountNumber + "_ilecell");

                //bind fields
                if (pca.inputField(accountField))
                    bindAccountField();
                else if (inlineMode && accountField) {
                    accountField.ondblclick = function () {
                        if (!editpage.sfdc.inlineEditData.isCurrentField(editpage.sfdc.getFieldById(accountField.id)))
                            editpage.sfdc.inlineEditData.openField(editpage.sfdc.getFieldById(accountField.id));

                        accountField = pca.getElement(fields.AccountNumber);
                        bindAccountField();
                    }

                    addInlineValidationMessage();
                }

                if (pca.inputField(sortcodeField))
                    bindSortCodeField();
                else if (inlineMode && sortcodeField) {
                    sortcodeField.ondblclick = function () {
                        if (!editpage.sfdc.inlineEditData.isCurrentField(editpage.sfdc.getFieldById(sortcodeField.id)))
                            editpage.sfdc.inlineEditData.openField(editpage.sfdc.getFieldById(sortcodeField.id));

                        sortcodeField = pca.getElement(fields.SortCode);
                        bindSortCodeField();
                    }
                }
            }

            function createInlineBankValidation(fields) {
                var sortCodeIle = pca.getElement(fields.SortCode + "_ilecell"),
                    accountNumberIle = pca.getElement(fields.AccountNumber + "_ilecell"),
                    launched = false;

                function launchInlineBankSortcodeValidation() {
                    if (!editpage.sfdc.editMode)
                        editpage.sfdc.activateInlineEditMode();

                    if (!editpage.sfdc.inlineEditData.isCurrentField(editpage.sfdc.getFieldById(sortCodeIle.id)))
                        editpage.sfdc.inlineEditData.openField(editpage.sfdc.getFieldById(sortCodeIle.id));

                    if (!launched) {
                        launched = true;
                        createBankValidation(fields, true);
                    }
                }

                function launchInlineBankAccountValidation() {
                    if (!editpage.sfdc.editMode)
                        editpage.sfdc.activateInlineEditMode();

                    if (!editpage.sfdc.inlineEditData.isCurrentField(editpage.sfdc.getFieldById(accountNumberIle.id)))
                        editpage.sfdc.inlineEditData.openField(editpage.sfdc.getFieldById(accountNumberIle.id));

                    if (!launched) {
                        launched = true;
                        createBankValidation(fields, true);
                    }
                }

                //overwrite existing handlers
                if (sortCodeIle) sortCodeIle.ondblclick = launchInlineBankSortcodeValidation;
                if (accountNumberIle) accountNumberIle.ondblclick = launchInlineBankAccountValidation;
            }

            function checkStandardInlineEdit(prefix) {
                var ile = pca.getElement(prefix + editpage.ileSuffix + "_ilecell"),
                    streetId = prefix + "street";

                if (ile) {
                    ile.ondblclick = function () {
                        editpage.ileSelectedAddress = null;

                        function loadInlineAddressCapture() {
                            if (editpage.addressControls[streetId])
                                editpage.addressControls[streetId].destroy();

                            for (var a = 0; a < addresses.length; a++) {
                                if (addresses[a].Street == streetId && pca.getElement(addresses[a].Street.replace(prefix, prefix + editpage.ileSuffix))) {
                                    var fields = {};

                                    for (var i in addresses[a])
                                        fields[i] = addresses[a][i].replace(prefix, prefix + editpage.ileSuffix);

                                    var inlineControl = createAddressControl(fields);
                                        editpage.addressControls[streetId] = inlineControl;

                                    //store the selected address until commited
                                    inlineControl.listen("populate", function (address) {
                                        editpage.ileAddressControl = inlineControl;
                                        editpage.ileSelectedAddress = address;
                                    });

                                    if (!editpage.ileSubmitButton) {
                                        editpage.ileSubmitButton = pca.getElement("InlineEditDialog_buttons").firstChild;

                                        //when the ok button is clicked we need to populate other fields
                                        pca.listen(editpage.ileSubmitButton, "click", function () {
                                            populateCustomInlineEditFields(editpage.ileAddressControl);
                                        });
                                    }

                                    smashEvents();
                                }
                            }
                        }

                        if (!editpage.sfdc.editMode)
                            editpage.sfdc.activateInlineEditMode();

                        if (!editpage.sfdc.inlineEditData.isCurrentField(editpage.sfdc.getFieldById(ile.id))) {
                            var sfField = editpage.sfdc.getFieldById(ile.id);

                            //dynamic loading of country list required - duck punch callback
                            if (sfField.waitForLoad && !editpage.sfdc.inlineEditData.loadedDynamicData) {
                                var loadedFunction = editpage.sfdc.inlineEditData.dynamicDataLoaded.bind(editpage.sfdc.inlineEditData);

                                editpage.sfdc.inlineEditData.dynamicDataLoaded = function () {
                                    loadedFunction();
                                    loadInlineAddressCapture();
                                };

                                editpage.sfdc.inlineEditData.openField(sfField);
                            }
                            else {
                                editpage.sfdc.inlineEditData.openField(sfField);
                                loadInlineAddressCapture();
                            }
                        }
                    }
                }
            }

            function checkCustomInlineEdit(id) {
                var ile = pca.getElement(id + editpage.ileSuffix + "_ilecell");

                if (ile) {
                    ile.ondblclick = function () {
                        editpage.ileSelectedAddress = null;

                        if (!editpage.sfdc.editMode)
                            editpage.sfdc.activateInlineEditMode();

                        if (!editpage.sfdc.inlineEditData.isCurrentField(editpage.sfdc.getFieldById(ile.id)))
                            editpage.sfdc.inlineEditData.openField(editpage.sfdc.getFieldById(ile.id));

                        for (var a = 0; a < addresses.length; a++) {
                            for (var k in addresses[a]) {
                                if (addresses[a][k] == id) {
                                    var streetId = addresses[a].Street,
                                        fields = {};

                                    if (editpage.addressControls[streetId])
                                        editpage.addressControls[streetId].destroy();

                                    for (var i in addresses[a])
                                        fields[i] = addresses[a][i] ? addresses[a][i] + editpage.ileSuffix : "";

                                    var inlineControl = createAddressControl(fields);
                                    editpage.addressControls[streetId] = inlineControl;

                                    //store the selected address until commited
                                    inlineControl.listen("populate", function (address) {
                                        editpage.ileSelectedAddress = address;
                                        populateStandardInlineEditAddress(inlineControl);
                                        populateCustomInlineEditFields(inlineControl);
                                    });

                                    smashEvents();
                                }
                            }
                        }
                    }
                }
            }

            //populates a standard inline edit address dialogue
            function populateStandardInlineEditAddress(control) {
                if (!control || !editpage.ileSelectedAddress) return;

                var fields = control.salesforce.fields,
                    address = editpage.ileSelectedAddress,
                    prefix = "";

                for (var s = 0; s < editpage.ilePrefixes.length; s++) {
                    if (~fields.Street.indexOf(editpage.ilePrefixes[s])) {
                        prefix = editpage.ilePrefixes[s];
                        break;
                    }
                }

                if (!prefix) return;

                var ileFieldId = prefix + editpage.ileSuffix + "_ilecell",
                    ileField = editpage.sfdc.getFieldById(ileFieldId);

                if (ileField) {
                    editpage.sfdc.inlineEditData.openField(ileField);

                    function getStandardFieldId(id) {
                        return id.replace(editpage.ileSuffix, "").replace(prefix, prefix + editpage.ileSuffix);
                    }

                    pca.setValue(getStandardFieldId(fields.Street), pca.tidy(pca.formatLine(address, "{Line1}\n{Line2}\n{Line3}\n{Line4}\n{Line5}"), "\n"));
                    pca.setValue(getStandardFieldId(fields.City), address.City);
                    pca.setValue(getStandardFieldId(fields.State), address.Province);
                    pca.setValue(getStandardFieldId(fields.Postcode), address.PostalCode);
                    pca.setValue(getStandardFieldId(fields.Country), control.countrylist.getName());

                    if (editpage.sfdc.inlineEditData.closeCurrentField())
                        editpage.sfdc.getDialogById(ileFieldId).hide();
                }
            }

            //populates all single inline edit fields
            function populateCustomInlineEditFields(control) {
                if (!control) return;

                var fields = control.salesforce.fields;

                populateInlineEditField(fields.Validation, control.salesforce.valid);

                if (!editpage.ileSelectedAddress) return;

                var address = editpage.ileSelectedAddress;

                populateInlineEditField(fields.Residential, address.Type, false, "Residential");
                populateInlineEditField(fields.Company, address.Company, true); //preserve
                populateInlineEditField(fields.Id, address.Id);
                populateInlineEditField(fields.Building, address.BuildingNumber);
                populateInlineEditField(fields.Area, address.AdminAreaName);
                populateInlineEditField(fields.Street, pca.tidy(pca.formatLine(address, "{Line1}\n{Line2}\n{Line3}\n{Line4}\n{Line5}"), "\n"));
                populateInlineEditField(fields.City, address.City);
                populateInlineEditField(fields.State, address.Province);
                populateInlineEditField(fields.Postcode, address.PostalCode);
                populateInlineEditField(fields.Country, control.countrylist.getName());
            }

            //populates a field when in inline edit mode
            function populateInlineEditField(id, value, preserve, trueValue) {
                if (!id) return;

                var ileFieldId = id + "_ilecell",
                    ileField = editpage.sfdc.getFieldById(ileFieldId);

                if (typeof ileField != "undefined" && ileField) {
                    editpage.sfdc.inlineEditData.openField(ileField);

                    var field = pca.getElement(id);

                    if (!preserve || !pca.getValue(field)) {
                        if (pca.checkBox(field) && trueValue)
                            value = value == trueValue;

                        pca.setValue(field, value);
                    }

                    editpage.sfdc.inlineEditData.closeCurrentField();
                }
            }

            //returns true if this company field is already bound to another address control
            function existingBoundCompany(field) {
                for (var a in editpage.addressControls) {
                    for (var k = 0; k < editpage.addressControls[a].fields.length; k++) {
                        if (editpage.addressControls[a].fields[k].element == field)
                            return true;
                    }
                }

                return false;
            }

            //stop further event propagation
            function smashEvents() {
                for (var a in editpage.addressControls) {
                    var control = editpage.addressControls[a];

                    function smashEnterKey(event) {
                        var key = window.event ? window.event.keyCode : event.which;

                        if (key == 13 && (control.autocomplete.visible || control.countrylist.autocomplete.visible))
                            pca.smash(event);
                    }

                    pca.listen(document, "keydown", smashEnterKey, true);

                    pca.listen(control.autocomplete.element, "click", pca.smash);
                    pca.listen(control.countrylist.autocomplete.element, "click", pca.smash);

                    pca.listen(pca.getElement("InlineEditDialog"), "click", function () {
                        control.autocomplete.checkHide();
                        control.countrylist.autocomplete.checkHide();
                    });
                }
            }

            //adds pca copy functionallity to existing copy address link
            function overrideCopyLink() {
                var anchors = document.getElementsByTagName("a");

                for (var a = 0; a < anchors.length; a++) {
                    switch (anchors[a].innerText) {
                        case "Copy Billing Address to Shipping Address": anchors[a].href = "javascript:pca.editpage.copyAddress('acc17street','acc18street')"; break;
                        case "Copy Mailing Address to Other Address": anchors[a].href = "javascript:pca.editpage.copyAddress('con19street','con18street')"; break;
                    }
                }
            }

            if (typeof window.sfdcPage == 'undefined')
                return;

            //set base sfdcPage object
            editpage.sfdc = window.sfdcPage;
            
            editpage.setStatus("Loading");

            //check for Sarissa
            if (typeof Sarissa != 'undefined' && Sarissa.originalXMLHttpRequest)
                pca.XMLHttpRequest = Sarissa.originalXMLHttpRequest;

            //only fuzzy match input fields and divs
            pca.fuzzyTags = ["input", "select", "textarea", "td"];

            //custom code
            for (var c = 0; c < editpage.settings.actions.length; c++) {
                var action = editpage.settings.actions[c];
                if (editpage.eventMap[action.Event]) editpage.listen(editpage.eventMap[action.Event], action.Code);
            }

            editpage.fire("start");

            //address controls
            for (var g = 0; g < addresses.length; g++) {
                var streetFieldId = addresses[g].Street;

                if (pca.inputField(streetFieldId) && !editpage.addressControls[streetFieldId])
                    editpage.addressControls[streetFieldId] = createAddressControl(addresses[g]);
            }

            //check for inline enabled visual force
            if (editpage.sfdc.domSuffixes) {
                for (var d in editpage.sfdc.domSuffixes) {
                    if (editpage.sfdc.domSuffixes[d].inlineEditData) {
                        editpage.sfdc = editpage.sfdc.domSuffixes[d];
                        editpage.ileSuffix = editpage.sfdc.entityId ? editpage.sfdc.visualforce : "";
                        break;
                    }
                }
            }

            //inline edit mode
            if (editpage.sfdc.inlineEditData) {
                for (var l = 0; l < editpage.ilePrefixes.length; l++)
                    checkStandardInlineEdit(editpage.ilePrefixes[l]);

                for (var h = 0; h < addresses.length; h++) {
                    for (var f in addresses[h])
                        if (addresses[h][f]) checkCustomInlineEdit(addresses[h][f]);
                }
            }

            editpage.setStatus(editpage.addressControlsCount ? "Active" : "No address fields");
            editpage.fire("loaded");

            //email validation
            for (var e = 0; editpage.settings.UseEmail && e < editpage.settings.emails.length; e++) {
                if (pca.inputField(editpage.settings.emails[e].Email))
                    createEmailValidation(editpage.settings.emails[e], false);
                else if (editpage.sfdc.inlineEditData && pca.getElement(editpage.settings.emails[e].Email + "_ilecell"))
                    createInlineEmailValidation(editpage.settings.emails[e]);
            }

            //payment validation
            for (var p = 0; editpage.settings.UsePayment && p < editpage.settings.payments.length; p++) {
                if (pca.inputField(editpage.settings.payments[p].SortCode))
                    createBankValidation(editpage.settings.payments[p], false);
                else if (editpage.sfdc.inlineEditData && pca.getElement(editpage.settings.payments[p].SortCode + "_ilecell"))
                    createInlineBankValidation(editpage.settings.payments[p]);
            }

            if (editpage.settings.HideSidebarComponent && editpage.status)
                editpage.status.parentNode.parentNode.style.display = "none";
        }

        //copy address from one control to another - only on standard pages
        editpage.copyAddress = function (fromStreetId, toStreetId) {
            var addresses = editpage.settings.addresses,
                fromAddress = null, toAddress = null;

            for (var a = 0; a < addresses.length; a++) {
                if (fromStreetId == addresses[a].Street) fromAddress = addresses[a];
                if (toStreetId == addresses[a].Street) toAddress = addresses[a];

                if (fromAddress && toAddress) {
                    for (var f in toAddress)
                        pca.setValue(toAddress[f] || "", pca.getValue(fromAddress[f] || ""));

                    editpage.fire("copy", fromAddress, toAddress);
                    break;
                }
            }
        }

        editpage.setStatus = function (message) {
            pca.setValue(editpage.status, message);
        }

        editpage.load();
    }

    function pcaSidebarError(message) {
        var status = document.getElementById("pca_status");
        if (status) {
            status.style.color = "red";
            pca.setValue(status, "Error: " + message);
        }
        else throw message; //almost certain that the script has tried to run before the page has loaded
    }

    //load edit page when ready
    pca.ready(function () {
        try {
            pca.editpage = new pca.EditPage();
        }
        catch (err) {
            pcaSidebarError(err.message);
        }
    });
})();