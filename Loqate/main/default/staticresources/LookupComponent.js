var pca_Controls = pca_Controls || [];

var pca_CountryData = [
    { i2: "AF", i3: "AFG", n: "Afghanistan" },
    { i2: "AX", i3: "ALA", n: "Åland Islands" },
    { i2: "AL", i3: "ALB", n: "Albania" },
    { i2: "DZ", i3: "DZA", n: "Algeria" },
    { i2: "AS", i3: "ASM", n: "American Samoa" },
    { i2: "AD", i3: "AND", n: "Andorra" },
    { i2: "AO", i3: "AGO", n: "Angola" },
    { i2: "AI", i3: "AIA", n: "Anguilla" },
    { i2: "AQ", i3: "ATA", n: "Antarctica" },
    { i2: "AG", i3: "ATG", n: "Antigua and Barbuda" },
    { i2: "AR", i3: "ARG", n: "Argentina" },
    { i2: "AM", i3: "ARM", n: "Armenia" },
    { i2: "AW", i3: "ABW", n: "Aruba" },
    { i2: "AU", i3: "AUS", n: "Australia" },
    { i2: "AT", i3: "AUT", n: "Austria" },
    { i2: "AZ", i3: "AZE", n: "Azerbaijan" },
    { i2: "BS", i3: "BHS", n: "Bahamas" },
    { i2: "BH", i3: "BHR", n: "Bahrain" },
    { i2: "BD", i3: "BGD", n: "Bangladesh" },
    { i2: "BB", i3: "BRB", n: "Barbados" },
    { i2: "BY", i3: "BLR", n: "Belarus" },
    { i2: "BE", i3: "BEL", n: "Belgium" },
    { i2: "BZ", i3: "BLZ", n: "Belize" },
    { i2: "BJ", i3: "BEN", n: "Benin" },
    { i2: "BM", i3: "BMU", n: "Bermuda" },
    { i2: "BT", i3: "BTN", n: "Bhutan" },
    { i2: "BO", i3: "BOL", n: "Bolivia, Plurinational State Of" },
    { i2: "BQ", i3: "BES", n: "Bonaire, Saint Eustatius and Saba" },
    { i2: "BA", i3: "BIH", n: "Bosnia and Herzegovina" },
    { i2: "BW", i3: "BWA", n: "Botswana" },
    { i2: "BV", i3: "BVT", n: "Bouvet Island" },
    { i2: "BR", i3: "BRA", n: "Brazil" },
    { i2: "IO", i3: "IOT", n: "British Indian Ocean Territory" },
    { i2: "BN", i3: "BRN", n: "Brunei Darussalam" },
    { i2: "BG", i3: "BGR", n: "Bulgaria" },
    { i2: "BF", i3: "BFA", n: "Burkina Faso" },
    { i2: "BI", i3: "BDI", n: "Burundi" },
    { i2: "KH", i3: "KHM", n: "Cambodia" },
    { i2: "CM", i3: "CMR", n: "Cameroon" },
    { i2: "CA", i3: "CAN", n: "Canada" },
    { i2: "CV", i3: "CPV", n: "Cape Verde" },
    { i2: "KY", i3: "CYM", n: "Cayman Islands" },
    { i2: "CF", i3: "CAF", n: "Central African Republic" },
    { i2: "TD", i3: "TCD", n: "Chad" },
    { i2: "CL", i3: "CHL", n: "Chile" },
    { i2: "CN", i3: "CHN", n: "China" },
    { i2: "CX", i3: "CXR", n: "Christmas Island" },
    { i2: "CC", i3: "CCK", n: "Cocos (Keeling) Islands" },
    { i2: "CO", i3: "COL", n: "Colombia" },
    { i2: "KM", i3: "COM", n: "Comoros" },
    { i2: "CG", i3: "COG", n: "Congo" },
    { i2: "CD", i3: "COD", n: "Congo, the Democratic Republic of the" },
    { i2: "CK", i3: "COK", n: "Cook Islands" },
    { i2: "CR", i3: "CRI", n: "Costa Rica" },
    { i2: "CI", i3: "CIV", n: "Côte D\'ivoire" },
    { i2: "HR", i3: "HRV", n: "Croatia" },
    { i2: "CU", i3: "CUB", n: "Cuba" },
    { i2: "CW", i3: "CUW", n: "Curaçao" },
    { i2: "CY", i3: "CYP", n: "Cyprus" },
    { i2: "CZ", i3: "CZE", n: "Czech Republic" },
    { i2: "DK", i3: "DNK", n: "Denmark" },
    { i2: "DJ", i3: "DJI", n: "Djibouti" },
    { i2: "DM", i3: "DMA", n: "Dominica" },
    { i2: "DO", i3: "DOM", n: "Dominican Republic" },
    { i2: "EC", i3: "ECU", n: "Ecuador" },
    { i2: "EG", i3: "EGY", n: "Egypt" },
    { i2: "SV", i3: "SLV", n: "El Salvador" },
    { i2: "GQ", i3: "GNQ", n: "Equatorial Guinea" },
    { i2: "ER", i3: "ERI", n: "Eritrea" },
    { i2: "EE", i3: "EST", n: "Estonia" },
    { i2: "ET", i3: "ETH", n: "Ethiopia" },
    { i2: "FK", i3: "FLK", n: "Falkland Islands (Malvinas)" },
    { i2: "FO", i3: "FRO", n: "Faroe Islands" },
    { i2: "FJ", i3: "FJI", n: "Fiji" },
    { i2: "FI", i3: "FIN", n: "Finland" },
    { i2: "FR", i3: "FRA", n: "France" },
    { i2: "GF", i3: "GUF", n: "French Guiana" },
    { i2: "PF", i3: "PYF", n: "French Polynesia" },
    { i2: "TF", i3: "ATF", n: "French Southern Territories" },
    { i2: "GA", i3: "GAB", n: "Gabon" },
    { i2: "GM", i3: "GMB", n: "Gambia" },
    { i2: "GE", i3: "GEO", n: "Georgia" },
    { i2: "DE", i3: "DEU", n: "Germany" },
    { i2: "GH", i3: "GHA", n: "Ghana" },
    { i2: "GI", i3: "GIB", n: "Gibraltar" },
    { i2: "GR", i3: "GRC", n: "Greece" },
    { i2: "GL", i3: "GRL", n: "Greenland" },
    { i2: "GD", i3: "GRD", n: "Grenada" },
    { i2: "GP", i3: "GLP", n: "Guadeloupe" },
    { i2: "GU", i3: "GUM", n: "Guam" },
    { i2: "GT", i3: "GTM", n: "Guatemala" },
    { i2: "GG", i3: "GGY", n: "Guernsey" },
    { i2: "GN", i3: "GIN", n: "Guinea" },
    { i2: "GW", i3: "GNB", n: "Guinea-Bissau" },
    { i2: "GY", i3: "GUY", n: "Guyana" },
    { i2: "HT", i3: "HTI", n: "Haiti" },
    { i2: "HM", i3: "HMD", n: "Heard Island and Mcdonald Islands" },
    { i2: "VA", i3: "VAT", n: "Holy See (Vatican City State)" },
    { i2: "HN", i3: "HND", n: "Honduras" },
    { i2: "HK", i3: "HKG", n: "Hong Kong" },
    { i2: "HU", i3: "HUN", n: "Hungary" },
    { i2: "IS", i3: "ISL", n: "Iceland" },
    { i2: "IN", i3: "IND", n: "India" },
    { i2: "ID", i3: "IDN", n: "Indonesia" },
    { i2: "IR", i3: "IRN", n: "Iran, Islamic Republic Of" },
    { i2: "IQ", i3: "IRQ", n: "Iraq" },
    { i2: "IE", i3: "IRL", n: "Ireland" },
    { i2: "IM", i3: "IMN", n: "Isle of Man" },
    { i2: "IL", i3: "ISR", n: "Israel" },
    { i2: "IT", i3: "ITA", n: "Italy" },
    { i2: "JM", i3: "JAM", n: "Jamaica" },
    { i2: "JP", i3: "JPN", n: "Japan" },
    { i2: "JE", i3: "JEY", n: "Jersey" },
    { i2: "JO", i3: "JOR", n: "Jordan" },
    { i2: "KZ", i3: "KAZ", n: "Kazakhstan" },
    { i2: "KE", i3: "KEN", n: "Kenya" },
    { i2: "KI", i3: "KIR", n: "Kiribati" },
    { i2: "KP", i3: "PRK", n: "Korea, Democratic People\'s Republic of" },
    { i2: "KR", i3: "KOR", n: "Korea, Republic of" },
    { i2: "KW", i3: "KWT", n: "Kuwait" },
    { i2: "KG", i3: "KGZ", n: "Kyrgyzstan" },
    { i2: "LA", i3: "LAO", n: "Lao people\'s Democratic Republic" },
    { i2: "LV", i3: "LVA", n: "Latvia" },
    { i2: "LB", i3: "LBN", n: "Lebanon" },
    { i2: "LS", i3: "LSO", n: "Lesotho" },
    { i2: "LR", i3: "LBR", n: "Liberia" },
    { i2: "LY", i3: "LBY", n: "Libya" },
    { i2: "LI", i3: "LIE", n: "Liechtenstein" },
    { i2: "LT", i3: "LTU", n: "Lithuania" },
    { i2: "LU", i3: "LUX", n: "Luxembourg" },
    { i2: "MO", i3: "MAC", n: "Macao" },
    { i2: "MK", i3: "MKD", n: "Macedonia, the Former Yugoslav Republic of" },
    { i2: "MG", i3: "MDG", n: "Madagascar" },
    { i2: "MW", i3: "MWI", n: "Malawi" },
    { i2: "MY", i3: "MYS", n: "Malaysia" },
    { i2: "MV", i3: "MDV", n: "Maldives" },
    { i2: "ML", i3: "MLI", n: "Mali" },
    { i2: "MT", i3: "MLT", n: "Malta" },
    { i2: "MH", i3: "MHL", n: "Marshall Islands" },
    { i2: "MQ", i3: "MTQ", n: "Martinique" },
    { i2: "MR", i3: "MRT", n: "Mauritania" },
    { i2: "MU", i3: "MUS", n: "Mauritius" },
    { i2: "YT", i3: "MYT", n: "Mayotte" },
    { i2: "MX", i3: "MEX", n: "Mexico" },
    { i2: "FM", i3: "FSM", n: "Micronesia, Federated States of" },
    { i2: "MD", i3: "MDA", n: "Moldova, Republic of" },
    { i2: "MC", i3: "MCO", n: "Monaco" },
    { i2: "MN", i3: "MNG", n: "Mongolia" },
    { i2: "ME", i3: "MNE", n: "Montenegro" },
    { i2: "MS", i3: "MSR", n: "Montserrat" },
    { i2: "MA", i3: "MAR", n: "Morocco" },
    { i2: "MZ", i3: "MOZ", n: "Mozambique" },
    { i2: "MM", i3: "MMR", n: "Myanmar" },
    { i2: "NA", i3: "NAM", n: "Namibia" },
    { i2: "NR", i3: "NRU", n: "Nauru" },
    { i2: "NP", i3: "NPL", n: "Nepal" },
    { i2: "NL", i3: "NLD", n: "Netherlands" },
    { i2: "NC", i3: "NCL", n: "New Caledonia" },
    { i2: "NZ", i3: "NZL", n: "New Zealand" },
    { i2: "NI", i3: "NIC", n: "Nicaragua" },
    { i2: "NE", i3: "NER", n: "Niger" },
    { i2: "NG", i3: "NGA", n: "Nigeria" },
    { i2: "NU", i3: "NIU", n: "Niue" },
    { i2: "NF", i3: "NFK", n: "Norfolk Island" },
    { i2: "MP", i3: "MNP", n: "Northern Mariana Islands" },
    { i2: "NO", i3: "NOR", n: "Norway" },
    { i2: "OM", i3: "OMN", n: "Oman" },
    { i2: "PK", i3: "PAK", n: "Pakistan" },
    { i2: "PW", i3: "PLW", n: "Palau" },
    { i2: "PS", i3: "PSE", n: "Palestinian Territory, Occupied" },
    { i2: "PA", i3: "PAN", n: "Panama" },
    { i2: "PG", i3: "PNG", n: "Papua New Guinea" },
    { i2: "PY", i3: "PRY", n: "Paraguay" },
    { i2: "PE", i3: "PER", n: "Peru" },
    { i2: "PH", i3: "PHL", n: "Philippines" },
    { i2: "PN", i3: "PCN", n: "Pitcairn" },
    { i2: "PL", i3: "POL", n: "Poland" },
    { i2: "PT", i3: "PRT", n: "Portugal" },
    { i2: "PR", i3: "PRI", n: "Puerto Rico" },
    { i2: "QA", i3: "QAT", n: "Qatar" },
    { i2: "RE", i3: "REU", n: "Réunion" },
    { i2: "RO", i3: "ROU", n: "Romania" },
    { i2: "RU", i3: "RUS", n: "Russian Federation" },
    { i2: "RW", i3: "RWA", n: "Rwanda" },
    { i2: "BL", i3: "BLM", n: "Saint Barthélemy" },
    { i2: "SH", i3: "SHN", n: "Saint Helena, Ascension and Tristan da Cunha" },
    { i2: "KN", i3: "KNA", n: "Saint Kitts and Nevis" },
    { i2: "LC", i3: "LCA", n: "Saint Lucia" },
    { i2: "MF", i3: "MAF", n: "Saint Martin (French part)" },
    { i2: "PM", i3: "SPM", n: "Saint Pierre and Miquelon" },
    { i2: "VC", i3: "VCT", n: "Saint Vincent and the Grenadines" },
    { i2: "WS", i3: "WSM", n: "Samoa" },
    { i2: "SM", i3: "SMR", n: "San Marino" },
    { i2: "ST", i3: "STP", n: "Sao Tome and Principe" },
    { i2: "SA", i3: "SAU", n: "Saudi Arabia" },
    { i2: "SN", i3: "SEN", n: "Senegal" },
    { i2: "RS", i3: "SRB", n: "Serbia" },
    { i2: "SC", i3: "SYC", n: "Seychelles" },
    { i2: "SL", i3: "SLE", n: "Sierra Leone" },
    { i2: "SG", i3: "SGP", n: "Singapore" },
    { i2: "SX", i3: "SXM", n: "Sint Maarten (Dutch part)" },
    { i2: "SK", i3: "SVK", n: "Slovakia" },
    { i2: "SI", i3: "SVN", n: "Slovenia" },
    { i2: "SB", i3: "SLB", n: "Solomon Islands" },
    { i2: "SO", i3: "SOM", n: "Somalia" },
    { i2: "ZA", i3: "ZAF", n: "South Africa" },
    { i2: "GS", i3: "SGS", n: "South Georgia and the South Sandwich Islands" },
    { i2: "SS", i3: "SSD", n: "South Sudan" },
    { i2: "ES", i3: "ESP", n: "Spain" },
    { i2: "LK", i3: "LKA", n: "Sri Lanka" },
    { i2: "SD", i3: "SDN", n: "Sudan" },
    { i2: "SR", i3: "SUR", n: "Suriname" },
    { i2: "SJ", i3: "SJM", n: "Svalbard and Jan Mayen" },
    { i2: "SZ", i3: "SWZ", n: "Swaziland" },
    { i2: "SE", i3: "SWE", n: "Sweden" },
    { i2: "CH", i3: "CHE", n: "Switzerland" },
    { i2: "SY", i3: "SYR", n: "Syrian Arab Republic" },
    { i2: "TW", i3: "TWN", n: "Taiwan, Province Of China" },
    { i2: "TJ", i3: "TJK", n: "Tajikistan" },
    { i2: "TZ", i3: "TZA", n: "Tanzania, United Republic Of" },
    { i2: "TH", i3: "THA", n: "Thailand" },
    { i2: "TL", i3: "TLS", n: "Timor-Leste" },
    { i2: "TG", i3: "TGO", n: "Togo" },
    { i2: "TK", i3: "TKL", n: "Tokelau" },
    { i2: "TO", i3: "TON", n: "Tonga" },
    { i2: "TT", i3: "TTO", n: "Trinidad and Tobago" },
    { i2: "TN", i3: "TUN", n: "Tunisia" },
    { i2: "TR", i3: "TUR", n: "Turkey" },
    { i2: "TM", i3: "TKM", n: "Turkmenistan" },
    { i2: "TC", i3: "TCA", n: "Turks and Caicos Islands" },
    { i2: "TV", i3: "TUV", n: "Tuvalu" },
    { i2: "UG", i3: "UGA", n: "Uganda" },
    { i2: "UA", i3: "UKR", n: "Ukraine" },
    { i2: "AE", i3: "ARE", n: "United Arab Emirates", alt: ["UAE"] },
    { i2: "GB", i3: "GBR", n: "United Kingdom", alt: ["England", "Wales", "Scotland", "Northern Ireland", "Great Britain", "Britain", "UK"] },
    { i2: "US", i3: "USA", n: "United States", alt: ["United States of America", "America"] },
    { i2: "UM", i3: "UMI", n: "United States Minor Outlying Islands" },
    { i2: "UY", i3: "URY", n: "Uruguay" },
    { i2: "UZ", i3: "UZB", n: "Uzbekistan" },
    { i2: "VU", i3: "VUT", n: "Vanuatu" },
    { i2: "VE", i3: "VEN", n: "Venezuela, Bolivarian Republic Of" },
    { i2: "VN", i3: "VNM", n: "Viet Nam" },
    { i2: "VG", i3: "VGB", n: "Virgin Islands, British" },
    { i2: "VI", i3: "VIR", n: "Virgin Islands, U.S." },
    { i2: "WF", i3: "WLF", n: "Wallis and Futuna" },
    { i2: "EH", i3: "ESH", n: "Western Sahara" },
    { i2: "YE", i3: "YEM", n: "Yemen" },
    { i2: "ZM", i3: "ZMB", n: "Zambia" },
    { i2: "ZW", i3: "ZWE", n: "Zimbabwe" }
    ];

function pca_AddressControl(country, postcode, street, city, key, options) {
    var _this = this,
        _null = null,
        _true = true,
        _false = false,
        _options = options || {},
        _document = _options.document || window.document,
        _window = _document.defaultView || window;

    _window.pca_Controls = _window.pca_Controls || [];
    _this.uid = _window.pca_Controls.length;
    _window.pca_Controls.push(_this);

    _this.countries = pca_CountryData;
    _this.version = "A1.00";
    _this.standardkey = key;
    _this.royalmailkey = key;
    _this.username = "";
    _this.company;
    _this.building;
    _this.street;
    _this.city;
    _this.state;
    _this.area;
    _this.postcode;
    _this.country;
    _this.udprn;
    _this.validation;
    _this.validimg;
    _this.dropdown;
    _this.style = 1;
    _this.freetext = _true;
    _this.teleatlas = _true;
    _this.royalmail = _false;
    _this.usps = _false;
    _this.rmcompany = _false;
    _this.rmreverse = _false;
    _this.usreverse = _false;
    _this.disableotheroption = _false;
    _this.suppresserrors = _false;
    _this.bbs = ["AND", "CAN", "FRA", "GBR", "JEY", "GGY", "IMN", "LUX", "USA", "AUS", "NZL"];
    _this.rmc = ["GBR", "JEY", "GGY", "IMN"];
    _this.ust = ["USA", "ASM", "FSM", "GUM", "MHL", "MNP", "VIR", "PRI", "PLW"];
    _this.services = "https://services.postcodeanywhere.co.uk";
    _this.data = { loaded: _false, source: _null, streets: _null, addresses: _null, item: _null, before: _null, reverse: _false };
    _this.last = { search: "", line1: "", line2: "" };
    _this.autocomplete = { anchor: _null, content: _null, items: 0, draw: _null, hide: _null };
    _this.canreverse = _false;
    _this.valid = _true;

    _this.onload = function () { };
    _this.onsearch = function () { };
    _this.onselect = function () { };
    _this.onclear = function () { };
    _this.oncopy = function () { };
    _this.onchange = function () { };
    _this.oncountrychange = function () { };
    _this.onreverseavailable = function () { };
    _this.onreverseunavailable = function () { };
    _this.onerror = function (error, critial) {
        if (critial) throw error;
        else if (!_this.suppresserrors) alert(error);
    }

    _this.browser = {
        IE: !!(window.attachEvent &&
            navigator.userAgent.indexOf('Opera') === -1),
        Opera: navigator.userAgent.indexOf('Opera') > -1,
        WebKit: navigator.userAgent.indexOf('AppleWebKit/') > -1,
        Gecko: navigator.userAgent.indexOf('Gecko') > -1 &&
            navigator.userAgent.indexOf('KHTML') === -1,
        MobileSafari: !!navigator.userAgent.match(/Apple.*Mobile.*Safari/)
    }

    //listens to an event with standard DOM event handling
    _this.listen = function (target, event, action) {
        if (window.addEventListener)
            target.addEventListener(event, action);
        else
            target.attachEvent('on' + event, action);
    }

    _this.findField = function (elem) {
        if (!elem || elem == "")
            return null;

        var _tags = ['input', 'textarea', 'select'],
            _matches = [];

        for (var t = 0; t < _tags.length; t++) {
            var _fields = _document.getElementsByTagName(_tags[t]);

            for (var f in _fields) {
                var _id = _fields[f].id || "",
                    _name = _fields[f].name || "";

                if (_fields[f] == elem)
                    return _fields[f];
                else if (typeof (elem) == 'string' && _id) {
                    if (_id == elem)
                        return _fields[f];

                    if (_id.indexOf(elem) > 0)
                        _matches.push(_fields[f]);
                }
                else if (typeof (elem) == 'string' && _name) {
                    if (_name == elem)
                        return _fields[f];
                }
            }
        }

        if (_matches.length > 0)
            return _matches[0];
        else
            return null;
    }

    _this.getValue = function (field) {
        var _value = "";

        if (field) {
            if (field.tagName == "INPUT" || field.tagName == "TEXTAREA") {
                if (field.type == "text" || field.type == "textarea")
                    _value = field.value;
                if (field.type == "checkbox")
                    _value = field.checked;
            }
            if (field.tagName == "SELECT")
                _value = field.options[field.selectedIndex].value;
        }

        return _value;
    }

    _this.setValue = function (field, value) {
        if (field) {
            if (field.tagName == "INPUT" || field.tagName == "TEXTAREA") {
                if (field.type == "text" || field.type == "textarea")
                    field.value = value;
                if (field.type == "checkbox")
                    field.checked = ((typeof (value) == "boolean" && value) || value == "True");
            }
            if (field.tagName == "SELECT") {
                for (var s = 0; s < field.options.length; s++) {
                    if (field.options[s].value == value || field.options[s].text == value) {
                        field.selectedIndex = s;
                        break;
                    }
                }
            }
        }
    }

    _this.setValid = function (valid) {
        _this.valid = valid;
        _this.setValue(_this.validation, valid);
        if (_this.validimg)
            _this.validimg.src = (_this.valid ? "/img/checkbox_checked.gif" : "/img/checkbox_unchecked.gif");
    }

    _this.bind = function () {
        _this.street = _this.findField(street);
        _this.city = _this.findField(city);
        _this.postcode = _this.findField(postcode);
        _this.country = _this.findField(country);

        _this.building = _this.findField(_options.Building || "");
        _this.state = _this.findField(_options.State || "");
        _this.area = _this.findField(_options.Area || "");
        _this.udprn = _this.findField(_options.Id || "");
        _this.validation = _this.findField(_options.Validation || "");

        _this.listen(_this.street, "focus", _this.lookup);
        _this.listen(_this.street, "keyup", function () { _this.filter(_false) });
        _this.listen(_this.street, "click", function () { _this.filter(_true) });
        _this.listen(_this.street, "blur", function () { if (!_this.autocomplete.mouseOver) _this.autocomplete.hide() });
        _this.listen(_this.street, "change", function () { _this.setValid(_false); _this.onchange(); });

        _this.listen(_this.city, "change", function () { _this.setValid(_false); _this.onchange(); });
        _this.listen(_this.postcode, "focus", function () { _this.autocomplete.hide() });
        _this.listen(_this.postcode, "change", function () { _this.setValid(_false); _this.onchange(); });
        _this.listen(_this.country, "change", function () { _this.setValid(_false); _this.onchange(); });

        if (_this.state) _this.listen(_this.state, "change", function () { _this.setValid(_false); _this.onchange(); });
        if (_this.area) _this.listen(_this.area, "change", function () { _this.setValid(_false); _this.onchange(); });
        if (_this.udprn) _this.listen(_this.udprn, "change", function () { _this.setValid(_false); _this.onchange(); });

        if (_this.validation) {
            _this.valid = !!_this.getValue(_this.validation);
            _this.validation.style.display = "none";

            _this.validimg = _document.createElement("img");
            _this.validimg.title = (_this.valid ? "Valid" : "Requires validation");
            _this.validimg.src = (_this.valid ? "/img/checkbox_checked.gif" : "/img/checkbox_unchecked.gif");
            _this.validation.parentNode.appendChild(_this.validimg);
        }
    }

    _this.setupCountryList = function (selection) {
        _this.country.style.display = "none";
        _this.dropdown = _document.createElement("select");
        _this.dropdown.id = _this.country.id + "List";
        if (_this.country.offsetWidth)
            _this.dropdown.style.width = _this.country.offsetWidth + "px";
        _this.country.parentNode.insertBefore(_this.dropdown, _this.country);

        if (selection || selection == "") {
            if (typeof (selection) != "string")
                _this.onerror("Options for country list setup must be a comma seperated string", _true);

            selection = selection.split(",");

            for (var s = 0; s < selection.length; s++) {
                var _sel = selection[s].replace(/^\s+/, '')

                for (var i = 0; i < _this.countries.length; i++) {
                    if (_sel == _this.countries[i].i2 || _sel == _this.countries[i].i3 || _sel == _this.countries[i].n)
                        _this.dropdown.options[_this.dropdown.length] = new Option(_this.countries[i].n, _this.countries[i].i3);
                }
            }
        }
        else {
            for (var i = 0; i < _this.countries.length; i++)
                _this.dropdown.options[_this.dropdown.length] = new Option(_this.countries[i].n, _this.countries[i].i3);
        }

        if (!_this.disableotheroption)
            _this.dropdown.options[_this.dropdown.length] = new Option("Other", "");

        _this.dropdown.onchange = _this.changeCountry;

        _this.freetext = _false;
        _this.countryFromFreetext();
        _this.reverseAvailable();
    }

    _this.setupAutoComplete = function () {
        var _autocomplete = _this.autocomplete,
            _anchor = _document.createElement("table"),
            _content = _document.createElement("div");

        _autocomplete.mouseOver = _false;
        _autocomplete.closeOnMouseOut = _false;

        _this.street.parentNode.appendChild(_anchor);

        _content.style.cssText = "position:absolute;height:200px;z-index:100;width:150px;display:none";
        if (_this.street.offsetWidth) _content.style.width = _this.street.offsetWidth + "px"

        _this.listen(_content, "click", function () { _autocomplete.closeOnMouseOut = _true; });
        _this.listen(_content, "mouseover", function () { _autocomplete.mouseOver = _true; });
        _this.listen(_content, "mouseout", function () { _autocomplete.mouseOver = _false; if (_autocomplete.closeOnMouseOut) _autocomplete.hide(); });

        _anchor.cellSpacing = 0;
        _anchor.cellPadding = 0;
        _anchor.insertRow(0);
        _anchor.rows[0].insertCell(0);
        _anchor.insertRow(1);
        _anchor.rows[1].insertCell(0);
        _anchor.rows[0].cells[0].appendChild(_this.street);
        _anchor.rows[1].cells[0].appendChild(_content);

        _autocomplete.anchor = _anchor;
        _autocomplete.content = _content;

        _autocomplete.draw = function (html) {
            _content.innerHTML = html;
            _content.style.display = "";
        }

        _autocomplete.hide = function () {
            _content.style.display = "none";
            _autocomplete.closeOnMouseOut = _false;
        }
    }

    _this.changeCountry = function () {
        if (_this.getValue(_this.dropdown) == "")
            _this.freetextCountry();
        else
            _this.setValue(_this.country, _this.selectedCountry());

        _this.setValid(_false);
        _this.onchange();
        _this.oncountrychange();
        _this.reverseAvailable();
    }

    _this.reverseAvailable = function () {
        if ((_this.royalmail && _this.rmreverse && _this.countryInList(_this.rmc)) || (_this.usps && _this.usreverse && _this.countryInList(_this.ust))) {
            _this.canreverse = _true;
            _this.onreverseavailable();
        }
        else {
            _this.canreverse = _false;
            _this.onreverseunavailable();
        }
    }

    _this.selectedCountry = function () {
        var _name = _this.countryFromCode(_this.selectedCode());
        return _name != "" ? _name : _this.getValue(_this.country);
    }

    _this.selectedCode = function () {
        return _this.freetext ? _this.codeFromFreetext() : _this.getValue(_this.dropdown);
    }

    _this.countryFromCode = function (code) {
        for (var i = 0; i < _this.countries.length; i++) {
            if (_this.countries[i].i3 == code) {
                switch (_this.style) {
                    case 1: return _this.countries[i].n;
                    case 2: return _this.countries[i].i2;
                    case 3: return _this.countries[i].i3;
                }
                break;
            }
        }
        return _null;
    }

    _this.codeFromFreetext = function () {
        var _code = _this.getValue(_this.country);

        for (var i = 0; i < _this.countries.length; i++) {
            if ((_code.toUpperCase() == _this.countries[i].n.toUpperCase()) ||
                (_code.toUpperCase() == _this.countries[i].i2.toUpperCase()) ||
                (_code.toUpperCase() == _this.countries[i].i3.toUpperCase())) {
                _code = _this.countries[i].i3;
                break;
            }
            else if (_this.countries[i].alt) {
                var _found = false;

                for (var a = 0; a < _this.countries[i].alt.length; a++) {
                    if (_code.toUpperCase() == _this.countries[i].alt[a].toUpperCase()) {
                        _code = _this.countries[i].i3;
                        _found = true;
                        break;
                    }

                    if (_found) break;
                }
            }
        }
        return _code;
    }

    _this.countryFromFreetext = function () {
        var _found = _false,
            _code = _this.codeFromFreetext();

        if (_code != "" && _this.dropdown) {
            for (var i = 0; i < _this.dropdown.length && !_found; i++) {
                if (_this.dropdown.options[i].value.toUpperCase() == _code) {
                    _this.resetDropdown();
                    _this.dropdown.selectedIndex = i;
                    _found = _true;
                }
            }
        }

        if ((_code != "" && !_found) || _this.getValue(_this.dropdown) == "")
            _this.freetextCountry();
    }

    _this.freetextCountry = function () {
        if (_this.dropdown) {
            _this.dropdown.style.display = "none";
            _this.country.style.display = "";
        }
        _this.freetext = _true;
    }

    _this.resetDropdown = function () {
        if (_this.dropdown) {
            _this.dropdown.style.display = "";
            _this.dropdown.selectedIndex = 0;
            _this.country.style.display = "none";
        }
        _this.freetext = _false;

        if (_this.getValue(_this.dropdown) == "")
            _this.freetextCountry();

        _this.oncountrychange();
        _this.reverseAvailable();
    }

    _this.countryInList = function (list) {
        var _found = _false,
            _country = _this.selectedCode();

        for (var i = 0; i < list.length; i++) {
            if (_country == list[i])
                _found = _true;
        }

        return _found
    }

    _this.diacritics = function (input) {
        var _result = "",
            _map = [
                { f: "ÀÁÂÃàáâã", t: "A" },
                { f: "Åå", t: "AA" },
                { f: "ÆæÄä", t: "AE" },
                { f: "Çç", t: "C" },
                { f: "Čč", t: "CH" },
                { f: "đĐ", t: "DJ" },
                { f: "ÈÉÊËèéêë", t: "E" },
                { f: "ÌÍÏìíîï", t: "I" },
                { f: "Ññ", t: "N" },
                { f: "ÒÓÔÕOòóôõo", t: "O" },
                { f: "ŒœØøÖö", t: "OE" },
                { f: "Šš", t: "SH" },
                { f: "ß", t: "SS" },
                { f: "ÙÚÛUùúûu", t: "U" },
                { f: "Üü", t: "UE" },
                { f: "Üü", t: "Y" },
                { f: "ŸÝýÿ", t: "ZH" },
                { f: "-", t: " " },
                { f: ".,", t: "" }
            ];

        for (var i = 0; i < input.length; i++) {
            var _char = input.charAt(i).toUpperCase(),
                _found = _false;

            for (var j = 0; j < _map.length && !_found; j++) {
                if (_map[j].f.indexOf(_char) >= 0) {
                    _result += _map[j].t;
                    _found = _true;
                }
            }

            if (!_found)
                _result += _char;
        }

        return _result;
    }

    _this.synonym = function (input) {
        var _res = " " + input.toUpperCase(),
        _map = [
            { r: " N ", w: " NORTH " },
            { r: " NE ", w: " NORTH EAST " },
            { r: " NORTHEAST ", w: " NORTH EAST " },
            { r: " NW ", w: " NORTH WEST " },
            { r: " NORTHWEST ", w: " NORTH WEST " },
            { r: " S ", w: " SOUTH " },
            { r: " SE ", w: " SOUTH EAST " },
            { r: " SOUTHEAST ", w: " SOUTH EAST " },
            { r: " SW ", w: " SOUTH WEST " },
            { r: " SOUTHWEST ", w: " SOUTH WEST " },
            { r: " E ", w: " EAST " },
            { r: " W ", w: " WEST " },
            { r: " ST ", w: " SAINT " }
        ];

        for (var i = 0; i < _map.length; i++)
            _res = _res.replace(_map[i].r, _map[i].w);

        return _res;
    }

    _this.getBuilding = function (line) {
        if (_this.countryInList(_this.bbs)) {
            var _numbers = "0123456789.-/",
                _numeric = _true;

            if (line.indexOf(" ") > 0)
                line = line.substring(0, line.indexOf(" "));

            for (var i = 0; i < line.length && _numeric; i++) {
                var _char = line.charAt(i);
                if (_numbers.indexOf(_char) == -1)
                    _numeric = _false;
            }

            if (_numeric) return line;
        }

        return "";
    }

    _this.hasMultiResults = function (response) {
        var _city = response[0].City || response[0].PostTown,
            _result = _false;

        for (var c = 0; c < response.length; c++) {
            if (_city != (response[c].City || response[c].PostTown)) {
                _result = _true;
                break;
            }
        }

        return _result;
    }

    _this.clear = function () {
        _this.setValue(_this.street, "");
        _this.setValue(_this.postcode, "");
        _this.setValue(_this.city, "");
        _this.setValue(_this.country, "");

        _this.setValue(_this.state, "");
        _this.setValue(_this.area, "");
        _this.setValue(_this.udprn, "");
        _this.setValue(_this.building, "");

        _this.resetDropdown();
        _this.last.search = "";
        _this.data.loaded = _false;
        _this.autocomplete.hide();
        _this.setValid(_true);
        _this.onchange();
        _this.onclear();
    }

    _this.populate = function (street, city, state, postcode, country) {
        _this.setValue(_this.street, street);
        _this.setValue(_this.city, city);
        _this.setValue(_this.postcode, postcode);
        _this.setValue(_this.country, country);
        _this.setValue(_this.state, state);

        _this.countryFromFreetext();
        _this.onchange();
    }

    _this.lookup = function () {
        var _request = _null;

        //Prepoplate the country incase no results are returned
        _this.setValue(_this.country, _this.selectedCountry());

        if (_this.getValue(_this.postcode) != "" && _this.selectedCode() != "") {
            if (_this.last.search != (_this.getValue(_this.postcode) + _this.selectedCode()).toUpperCase()) {
                _this.last.search = (_this.getValue(_this.postcode) + _this.selectedCode()).toUpperCase();

                if (_this.royalmail && _this.countryInList(_this.rmc)) {
                    _request = "/PostcodeAnywhere/Interactive/RetrieveByPostcodeAndBuilding/v1.30/json2.ws?";
                    _request += "Key=" + encodeURI(_this.royalmailkey);
                    _request += "&Postcode=" + encodeURI(_this.getValue(_this.postcode));
                    if (_this.username)
                        _request += "&UserName=" + encodeURI(_this.username);
                    _request += "&CallbackFunction=pca_Controls[" + _this.uid + "].rmcb";
                    _this.fetch(_request);
                }
                else if (_this.usps && _this.countryInList(_this.ust) && _this.getValue(_this.postcode).length == 10) {
                    _request = "/PostcodeAnywhereInternational/InteractiveUSA/RetrieveByZip4/v1.00/json2.ws?";
                    _request += "&Key=" + encodeURI(_this.standardkey);
                    _request += "&Zip4=" + encodeURI(_this.getValue(_this.postcode));
                    _request += "&CallbackFunction=pca_Controls[" + _this.uid + "].uscb";
                    _this.fetch(_request);
                }
                else if (_this.teleatlas) {
                    _request = "/PostcodeAnywhereInternational/Interactive/RetrieveByPostalCode/v2.10/json2.ws?";
                    _request += "&Key=" + encodeURI(_this.standardkey);
                    _request += "&Country=" + encodeURI(_this.selectedCode());
                    _request += "&Postalcode=" + encodeURI(_this.getValue(_this.postcode));
                    _request += "&CallbackFunction=pca_Controls[" + _this.uid + "].tacb";
                    _this.fetch(_request);
                }
            }
            else
                _this.filter(_true);
        }
    }

    _this.reverse = function () {
        var _search = [];
        
        _this.last.search = "";

        if (_this.getValue(_this.company)) _search.push(_this.getValue(_this.company).replace(/,/g, ""));
        if (_this.getValue(_this.street)) _search.push(_this.getValue(_this.street).replace(/,/g, ""));
        if (_this.getValue(_this.city)) _search.push(_this.getValue(_this.city));
        if (_this.getValue(_this.state)) _search.push(_this.getValue(_this.state));
        if (_this.getValue(_this.postcode)) {
            if (_this.usps && _this.usreverse && _this.countryInList(_this.ust) && _this.getValue(_this.postcode).length > 5) _search.push(_this.getValue(_this.postcode).substring(0, 5));
            else _search.push(_this.getValue(_this.postcode));
        }

        if (_this.royalmail && _this.rmreverse && _this.countryInList(_this.rmc)) {
            _request = "/CleansePlus/Interactive/Cleanse/v1.00/json2.ws?";
            _request += "Key=" + encodeURI(_this.royalmailkey);
            _request += "&Address=" + encodeURI(_search.join(","));
            if (_this.username)
                _request += "&UserName=" + encodeURI(_this.username);
            _request += "&CallbackFunction=pca_Controls[" + _this.uid + "].rmcb";
            _this.fetch(_request);
        }
        else if (_this.usps && _this.usreverse && _this.countryInList(_this.ust)) {
            _request = "/PostcodeAnywhereInternational/InteractiveUSA/RetrieveByAddress/v1.00/json2.ws?";
            _request += "&Key=" + encodeURI(_this.standardkey);
            _request += "&Address=" + encodeURI(_search.join(","));
            if (_this.getValue(_this.company))
                _request += "&Company=" + encodeURI(_this.getValue(_this.company));
            _request += "&CallbackFunction=pca_Controls[" + _this.uid + "].uscb";
            _this.fetch(_request);
        }
    }

    _this.fetch = function (request) {
        var _script = _document.createElement("script"),
            _head = _document.getElementsByTagName("head")[0];

        _this.data.loaded = _false;

        _script.src = _this.services + request;

        _script.onload = _script.onreadystatechange = function () {
            if (!this.readyState || this.readyState === "loaded" || this.readyState === "complete") {
                _script.onload = _script.onreadystatechange = null;
                if (_head && _script.parentNode)
                    _head.removeChild(_script);
            }
        }

        _head.insertBefore(_script, _head.firstChild);
    }

    _this.tacb = function (response) {
        _this.load(response, 0);
    }

    _this.rmcb = function (response) {
        _this.load(response, 1);
    }

    _this.uscb = function (response) {
        _this.load(response, 2);
    }

    _this.load = function (response, source) {
        if (response.length == 1 && typeof (response[0].Error) != 'undefined') {
            _this.onerror(response[0].Description, _false);
        }
        else {
            if (response.length == 0) {
                _this.onerror("Sorry, no matching addresses found", _false);
            }
            else {
                var _prepopulate = !_this.getValue(_this.city) && !_this.hasMultiResults(response);

                _this.data.streets = new Array();

                if (source == 0) {
                    for (var i = 0; i < response.length; i++)
                        _this.data.streets.push(_this.synonym(_this.diacritics(response[i].Street)).toUpperCase());

                    if (_prepopulate) {
                        _this.setValue(_this.city, response[0].City);
                        _this.setValue(_this.state, response[0].State);
                        _this.setValue(_this.area, response[0].AdminArea);
                    }
                    _this.setValue(_this.postcode, _this.postcode.value.toUpperCase());
                    if (_this.freetext) {
                        _this.setValue(_this.country, _this.countryFromCode(response[0].CountryCode));
                        _this.countryFromFreetext();
                    }
                    else _this.setValue(_this.country, _this.selectedCountry());
                }
                else if (source == 1) {
                    //Check for street level paf
                    if (response[0].Udprn == '0') source = 3;

                    for (var i = 0; i < response.length; i++)
                        _this.data.streets.push(response[i].Company.toUpperCase() + " " + response[i].Line1.toUpperCase());

                    if (_this.getValue(_this.postcode)) {
                        if (_prepopulate) {
                            _this.setValue(_this.city, response[0].PostTown);
                            _this.setValue(_this.state, response[0].County);
                        }
                        _this.setValue(_this.postcode, response[0].Postcode);
                        _this.setValue(_this.country, _this.selectedCountry());
                        _this.countryFromFreetext();
                    }
                }
                else if (source == 2) {
                    for (var i = 0; i < response.length; i++)
                        _this.data.streets.push(response[i].Company.toUpperCase() + " " + _this.synonym(_this.diacritics(response[i].Line1.toUpperCase())));

                    if (_prepopulate) {
                        _this.setValue(_this.city, response[0].City);
                        _this.setValue(_this.state, response[0].StateCode);
                    }
                    _this.setValue(_this.postcode, response[0].Zip);
                    _this.setValue(_this.country, _this.selectedCountry());
                    _this.countryFromFreetext();
                }

                _this.data.addresses = response;
                _this.data.source = source;
                _this.data.loaded = _true;
                _this.data.item = _null;
                _this.filter(_true, _true);
                _this.onchange();
                _this.onsearch();
            }
        }

        _this.suppresserrors = _false;
    }

    _this.filter = function (all, autoselect) {
        var _lines = _this.street.value.split("\n"),
            _filter = "";

        if (typeof (all) == 'undefined')
            all = _false;

        if (typeof (autoselect) == 'undefined' || _this.data.source == 0 || _this.data.source == 3)
            autoselect = _false;

        _this.data.before = "";

        if (_lines.length <= 1 || _lines[1] == _this.last.line2) {
            if (_this.data.source == 0 || _this.data.source == 3) {
                _this.data.before = _this.getBuilding(_lines[0]);
                _filter = _lines[0].substring(_this.data.before.length, _lines[0].length);
            }
            else
                _filter = _lines[0];
        }
        else if (_lines.length >= 2 && _lines[1] != _this.last.line2) {
            if (_this.data.source == 0 || _this.data.source == 3) {
                _this.data.before = _this.getBuilding(_lines[1]);
                _filter = _lines[1].substring(_this.data.before.length, _lines[1].length);
                _this.data.before = _lines[0] + "\n" + _this.data.before;
            }
            else
                _filter = _lines[1];
        }

        _this.last.line1 = _lines[0];
        _this.last.line2 = _lines[1];

        _filter = _this.synonym(_this.diacritics(_filter)).replace(/^\s+/, '');

        if (_filter == "" && (_this.data.source == 0 || _this.data.source == 3))
            all = _true;

        if (_filter == "" && !all)
            return;

        if (_this.data.loaded) {
            var _html = "",
                _items = 0;

            _html = "<div style='height:179px;overflow:auto;border-left:solid 1px #aaaaaa; border-right:solid 1px #aaaaaa; background-color:#fafafa'>";

            for (var i = 0; i < _this.data.addresses.length; i++) {
                if ((_filter != "" && _this.data.streets[i].indexOf(_filter) >= 0) || (all && _this.data.streets.length >= 0)) {
                    var _loc = [],
                        _addr = _this.data.addresses[i];

                    _html += "<div style='padding:5px; border-bottom:solid 1px #aaaaaa; background-color:#fafafa' onmouseover=\"this.style.backgroundColor='#f0f0f0';\" onmouseout=\"this.style.backgroundColor='#fafafa';\">";
                    _html += "<a style='font-family:arial;font-size:9pt;color:#000000' href='javascript:pca_Controls[" + _this.uid + "].select(" + i + ")'>";

                    if (_this.data.source == 0) {
                        _html += "<b>" + _addr.Street + "</b><br>";

                        if (_addr.District != "") _loc.push(_addr.District);
                        if (_addr.City != "") _loc.push(_addr.City);
                        if (_addr.State != "") _loc.push(_addr.State);
                    }
                    else if (_this.data.source == 1 || _this.data.source == 3) {
                        _html += (_addr.Company ? "<b>" + _addr.Company + "<br/>" + _addr.Line1 + "</b>" : _addr.SubBuilding ? "<b>" + _addr.Line1 + "<br/>" + _addr.Line2 + "</b>" : "<b>" + _addr.Line1 + "</b>") + "<br/>";

                        if (_addr.DoubleDependentLocality != "") _loc.push(_addr.DoubleDependentLocality);
                        if (_addr.DependentLocality != "") _loc.push(_addr.DependentLocality);
                        if (_addr.PostTown != "") _loc.push(_addr.PostTown);
                    }
                    else if (_this.data.source == 2) {
                        if (_addr.Company == "") _html += "<b>" + _addr.Line1 + "</b><br>";
                        else _html += "<b>" + _addr.Company + "<br>" + _addr.Line1 + "</b><br>";

                        if (_addr.Line2 != "") _loc.push(_addr.Line2);
                        if (_addr.City != "") _loc.push(_addr.City);
                        if (_addr.StateCode != "") _loc.push(_addr.StateCode);
                    }

                    _html += _loc.join(", ");
                    _html += "</a></div>";
                    _items++;
                }
            }

            _html += "</div><div style='height:20px;font-family:arial;font-size:7pt;color:#aaaaaa;border:solid 1px #aaaaaa; background-color:#ffffff;'>";
            _html += "<div style='float:left;padding-left:5px;padding-top:4px;'>" + _items + " item(s)</div>";
            _html += "<div style='float:right;padding-right:5px;padding-top:4px;color:darkblue'><b>Postcode</b>Anywhere</div></div>";

            _this.autocomplete.items = _items;

            if (_this.data.addresses.length == 1 && autoselect)
                _this.select(0);
            else if (_items > 0)
                _this.autocomplete.draw(_html);
            else
                _this.autocomplete.hide();
        }
    }

    _this.select = function (item) {
        var _addr = _this.data.addresses[item];

        _this.data.item = item;

        if (_this.data.source == 0) {
            if (_this.data.before) {
                _this.setValue(_this.street, _this.data.before);
                var _lines = _this.getValue(_this.street).split("\n");
                if (_this.countryInList(_this.bbs) && _lines[_lines.length - 1] != "") _this.street.value += " ";
                _this.street.value += _addr.Street;
            }
            else _this.setValue(_this.street, _addr.Street);
            if (_addr.District) _this.street.value += "\n" + _addr.District;
            _this.setValue(_this.city, _addr.City);
            _this.setValue(_this.state, _addr.State);
            _this.setValue(_this.area, _addr.AdminArea);
            if (_this.usreverse) {
                _this.suppresserrors = _true;
                _this.reverse();
            }
        }
        else if (_this.data.source == 1) {
            _this.setValue(_this.street, _addr.Line1);
            if (_addr.Line2) _this.street.value += "\n" + _addr.Line2;
            if (_addr.Line3) _this.street.value += "\n" + _addr.Line3;
            if (_addr.Line4) _this.street.value += "\n" + _addr.Line4;
            if (_addr.Line5) _this.street.value += "\n" + _addr.Line5;
            _this.setValue(_this.city, _addr.PostTown);
            _this.setValue(_this.state, _addr.County);
            _this.setValue(_this.udprn, _addr.Udprn);
            _this.setValue(_this.postcode, _addr.Postcode);
            _this.setValue(_this.building, (_addr.SubBuilding ? _addr.SubBuilding + (_addr.BuildingName || _addr.BuildingNumber ? ", " : "") : "") + (_addr.BuildingNumber ? _addr.BuildingNumber + (_addr.BuildingName ? " " : "") : "") + (_addr.BuildingName ? _addr.BuildingName : ""));
            if (_this.rmcompany && _addr.Company != "") _this.setValue(_this.company, _addr.Company);
            _this.setValid(_true);
        }
        else if (_this.data.source == 2) {
            _this.setValue(_this.street, _addr.Line1);
            if (_addr.Line2 != "") _this.street.value += "\n" + _addr.Line2;
            _this.setValue(_this.city, _addr.City);
            _this.setValue(_this.state, _addr.StateCode);
            _this.setValue(_this.area, _addr.CountyName);
            _this.setValue(_this.udprn, _addr.Id);
            _this.setValue(_this.building, parseInt(_addr.Line1));
            _this.setValid(_true);
        }
        else if (_this.data.source == 3) {
            if (_addr.Udprn == "0" && _this.data.before) {
                _this.setValue(_this.street, _this.data.before);
                var _lines = _this.getValue(_this.street).split("\n");
                if (_lines[_lines.length - 1] != "") _this.street.value += " ";
                _this.street.value += _addr.Line1;
            }
            else
                _this.setValue(_this.street, _addr.Line1);

            if (_addr.Line2 != "") _this.street.value += "\n" + _addr.Line2;
            if (_addr.Line3 != "") _this.street.value += "\n" + _addr.Line3;
            if (_addr.Line4 != "") _this.street.value += "\n" + _addr.Line4;
            if (_addr.Line5 != "") _this.street.value += "\n" + _addr.Line5;
            _this.setValue(_this.city, _addr.PostTown);
            _this.setValue(_this.state, _addr.County);
            _this.setValue(_this.postcode, _addr.Postcode);
        }

        _this.autocomplete.hide();
        _this.onselect();
        _this.onchange();
    }

    _this.bind();
    _this.setupAutoComplete();
    _this.onload();
}