/*! Copyright © 2009-2016 Postcode Anywhere (Holdings) Ltd. (http://www.postcodeanywhere.co.uk)
 *
 * PlatformMobileValidation v1.10
 * Mobile validation for the web.
 *
 * WEB-1-3 05/05/2016 10:19:36
 */
/** @namespace pca */
(function (window, undefined) {
    var pca = window.pca = window.pca || {},
        document = window.document,
        PCA_REQUEST_HEADER = 'SalesforceApp-Auto-v1.0.0';

    //Service target information
    pca.protocol = (window.location || document.location).protocol === "https:" ? "https:" : "http:";
    pca.host = "services.postcodeanywhere.co.uk";
    pca.endpoint = "json3ex.ws";
    pca.limit = 2000;

    //Synonyms for list filtering.
    //Only need to replace things at the start of item text.
    pca.synonyms = [
        { r: /\bN(?=\s)/, w: "NORTH" },
        { r: /\b(?:NE|NORTHEAST)(?=\s)/, w: "NORTH EAST" },
        { r: /\b(?:NW|NORTHWEST)(?=\s)/, w: "NORTH WEST" },
        { r: /\bS(?=\s)/, w: "SOUTH" },
        { r: /\b(?:SE|SOUTHEAST)(?=\s)/, w: "SOUTH EAST" },
        { r: /\b(?:SW|SOUTHWEST)(?=\s)/, w: "SOUTH WEST" },
        { r: /\bE(?=\s)/, w: "EAST" },
        { r: /\bW(?=\s)/, w: "WEST" },
        { r: /\bST(?=\s)/, w: "SAINT" }
    ];

    //Basic diacritic replacements.
    pca.diacritics = [
        { r: /[ÀÁÂÃ]/gi, w: "A" },
        { r: /Å/gi, w: "AA" },
        { r: /[ÆæÄ]/gi, w: "AE" },
        { r: /Ç/gi, w: "C" },
        { r: /Ð/gi, w: "DJ" },
        { r: /[ÈÉÊË]/gi, w: "E" },
        { r: /[ÌÍÏ]/gi, w: "I" },
        { r: /Ñ/gi, w: "N" },
        { r: /[ÒÓÔÕ]/gi, w: "O" },
        { r: /[ŒØÖ]/gi, w: "OE" },
        { r: /Š/gi, w: "SH" },
        { r: /ß/gi, w: "SS" },
        { r: /[ÙÚÛ]/gi, w: "U" },
        { r: /Ü/gi, w: "UE" },
        { r: /[ŸÝ]/gi, w: "ZH" },
        { r: /-/gi, w: " " },
        { r: /[.,]/gi, w: "" }
    ];

    //HTML encoded character replacements.
    pca.hypertext = [
        { r: /&/g, w: "&amp;" },
        { r: /"/g, w: "&quot;" },
        { r: /'/g, w: "&#39;" },
        { r: /</g, w: "&lt;" },
        { r: />/g, w: "&gt;" }
    ];

    //Current service requests.
    //pca.requests = [];
    pca.requestQueue = [];
    pca.requestCache = {};
    pca.scriptRequests = [];
    pca.waitingRequest = false;
    pca.blockRequests = false;

    //Current style fixes.
    pca.styleFixes = [];
    pca.agent = (navigator && navigator.userAgent) || "";
    //mousedown issue with older galaxy devices with stock browser
    pca.galaxyFix = ((/Safari\/534.30/).test(pca.agent) && (/GT-I8190|GT-I9100|GT-I9305|GT-P3110/).test(pca.agent));

    //Container for page elements.
    pca.container = null;

    //store local reference to XHR
    pca.XMLHttpRequest = window.XMLHttpRequest;

    //Ready state.
    var ready = false,
        readyList = [];

    /** Allows regex matching on field IDs.
    * @memberof pca */
    pca.fuzzyMatch = true;
    /** HTML element tag types to check when fuzzy matching.
    * @memberof pca */
    pca.fuzzyTags = ["*"];

    /** Called when document is ready.
    * @memberof pca
    * @param {function} delegate - a function to call when the document is ready. */
    pca.ready = function (delegate) {
        if (ready) {
            //process waiting handlers first
            if (readyList.length) {
                var handlers = readyList;

                readyList = [];

                for (var i = 0; i < handlers.length; i++)
                    handlers[i]();
            }

            if (delegate) delegate();
        }
        else if (typeof delegate == 'function')
            readyList.push(delegate);
    }

    //Checks document load.
    function documentLoaded() {
        if (document.addEventListener) {
            pca.ignore(document, "DOMContentLoaded", documentLoaded);
            ready = true;
            pca.ready();
        }
        else if (document.readyState === "complete") {
            pca.ignore(document, "onreadystatechange", documentLoaded);
            ready = true;
            pca.ready();
        }
    }

    //Listen for document load.
    function checkDocumentLoad() {
        if (document.readyState === "complete") {
            ready = true;
            pca.ready();
        }
        else {
            if (document.addEventListener) pca.listen(document, "DOMContentLoaded", documentLoaded);
            else pca.listen(document, "onreadystatechange", documentLoaded);
            pca.listen(window, "load", documentLoaded);
        }
    }

    /** Provides methods for event handling.
    * @memberof pca
    * @constructor
    * @mixin
    * @param {Object} [source] - The base object to inherit from. */
    pca.Eventable = function (source) {
        /** @lends pca.Eventable.prototype */
        var obj = source || this;

        /** The list of listener for the object. */
        obj.listeners = {};

        /** Listen to a PCA event.
        * @param {string} event - The name of the even to listen for.
        * @param {pca.Eventable~eventHandler} action - The handler to add.
        */
        obj.listen = function (event, action) {
            obj.listeners[event] = obj.listeners[event] || [];
            obj.listeners[event].push(action);
        }

        /** Ignore a PCA event.
        * @param {string} event - The name of the even to ignore.
        * @param {pca.Eventable~eventHandler} action - The handler to remove.
        */
        obj.ignore = function (event, action) {
            if (obj.listeners[event]) {
                for (var i = 0; i < obj.listeners[event].length; i++) {
                    if (obj.listeners[event][i] === action) {
                        obj.listeners[event].splice(i, 1);
                        break;
                    }
                }
            }
        }

        /** Fire a PCA event. Can take any number of additional parameters and pass them on to the listeners.
        * @param {string} event - The name of the event to fire.
        * @param {...*} data - The detail of the event. */
        obj.fire = function (event, data) {
            if (obj.listeners[event]) {
                for (var i = 0; i < obj.listeners[event].length; i++) {
                    var args = [data];

                    for (var a = 2; a < arguments.length; a++)
                        args.push(arguments[a]);

                    obj.listeners[event][i].apply(obj, args);
                }
            }
        }

        return obj;

        /** Callback for a successful request.
        * @callback pca.Eventable~eventHandler
        * @param {...*} data - The detail of the event. */
    }

    ///Makes a service request using a XMLHttpRequest POST method.
    function postRequestXHR(request) {
        var xhr = new pca.XMLHttpRequest();

        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200)
                request.callback(pca.parseJSON(xhr.responseText));
        }

        if (request.credentials)
            xhr.withCredentials = request.credentials;

        xhr.onerror = request.serviceError;
        xhr.ontimeout = request.timeoutError;
        xhr.open("POST", request.destination, true);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.setRequestHeader('pca-source', PCA_REQUEST_HEADER);
        xhr.send(request.query);
    }

    //Makes a service request using a form POST method.
    function postRequestForm(request) {
        var form = document.createElement("form"),
            iframe = document.createElement("iframe"),
            loaded = false;

        function addParameter(name, value) {
            var field = document.createElement("input");
            field.name = name;
            field.value = value;
            form.appendChild(field);
        }

        form.method = "POST";
        form.action = pca.protocol + "//" + pca.host + "/" + request.service + "/json.ws";

        for (var key in request.data)
            addParameter(key, request.data[key]);

        addParameter("CallbackVariable", "window.name");
        addParameter("CallbackWithScriptTags", "true");

        iframe.onload = function () {
            if (!loaded) {
                loaded = true;
                iframe.contentWindow.location = "about:blank";
            }
            else {
                request.callback({ Items: pca.parseJSON(iframe.contentWindow.name) });
                document.body.removeChild(iframe);
            }
        }

        iframe.style.display = "none";
        document.body.appendChild(iframe);

        var doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.body ? doc.body.appendChild(form) : doc.appendChild(form);
        form.submit();
    }

    //Makes a POST request using best method available.
    //Security must be bypassed in Internet Explorer up to version 10
    function postRequest(request) {
        navigator.appName === "Microsoft Internet Explorer" ? postRequestForm(request) : postRequestXHR(request);
    }

    //Makes a service request using a XMLHttpRequest GET method.
    function getRequestXHR(request) {
        var xhr = new pca.XMLHttpRequest();

        //if the URL length is long and likely to cause problems with URL limits, so we should make a POST request
        if (request.url.length > pca.limit) {
            request.post = true;
            postRequest(request);
        }
        else {
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4 && xhr.status === 200)
                    request.callback(pca.parseJSON(xhr.responseText));
            }

            if (request.credentials)
                xhr.withCredentials = request.credentials;

            xhr.onerror = request.serviceError;
            xhr.ontimeout = request.timeoutError;
            xhr.open("GET", request.url, true);
            xhr.setRequestHeader('pca-source', PCA_REQUEST_HEADER);
            xhr.send();
        }
    }

    //Makes a service request using a script GET method.
    function getRequestScript(request) {
        var script = pca.create("script", { type: "text/javascript", async: "async" }),
            head = document.getElementsByTagName("head")[0];

        //set a callback point
        request.position = pca.scriptRequests.push(request);
        script.src = request.url + "&callback=pca.scriptRequests[" + (request.position - 1) + "].callback";

        script.onload = script.onreadystatechange = function () {
            if (!this.readyState || this.readyState === "loaded" || this.readyState === "complete") {
                script.onload = script.onreadystatechange = null;
                if (head && script.parentNode)
                    head.removeChild(script);
            }
        }

        //if the src length is long and likely to cause problems with url limits we should make a POST request
        if (script.src.length > pca.limit) {
            request.post = true;
            postRequest(request);
        }
        else
            head.insertBefore(script, head.firstChild);
    }

    //Makes a GET request using best method available.
    //Security must be bypassed in Internet Explorer up to version 10.
    function getRequest(request) {
        navigator.appName === "Microsoft Internet Explorer" ? getRequestScript(request) : getRequestXHR(request);
    }

    //Decide what to do with the request.
    function processRequest(request) {

        //block requests if the flag is set, ignore all but the last request in this state
        if (pca.blockRequests && pca.waitingRequest) {
            pca.requestQueue = [request];
            return;
        }

        if (request.block)
            pca.blockRequests = true;

        //queue the request if flag is set
        if (request.queue && pca.waitingRequest) {
            pca.requestQueue.push(request);
            return;
        }

        pca.waitingRequest = true;

        //check the cache if the flag is set
        if (request.cache && pca.requestCache[request.url]) {
            function ayncCallback() {
                request.callback(pca.requestCache[request.url].response);
            }

            window.setImmediate ? window.setImmediate(ayncCallback) : window.setTimeout(ayncCallback, 1);
            return;
        }

        //make the request
        request.post ? postRequest(request) : getRequest(request);
    }

    //Receives and processes the service response.
    function processResponse(request) {
        pca.waitingRequest = false;

        if (request.block)
            pca.blockRequests = false;

        if (request.response.Items.length === 1 && request.response.Items[0].Error !== undefined)
            request.error(request.response.Items[0].Description);
        else
            request.success(request.response.Items, request.response);

        if (request.cache)
            pca.requestCache[request.url] = request;

        if (request.position)
            pca.scriptRequests[request.position - 1] = null;

        if (pca.requestQueue.length)
            processRequest(pca.requestQueue.shift());
    }

    /** Represents a service request
    * @memberof pca
    * @constructor
    * @mixes Eventable
    * @param {string} service - The service name. e.g. CapturePlus/Interactive/Find/v1.00
    * @param {Object} [data] - An object containing request parameters, such as key.
    * @param {boolean} [data.$cache=false] - The request will be cached.
    * @param {boolean} [data.$queue=false] - Queue other quests and make them once a response is received.
    * @param {boolean} [data.$block=false] - Ignore other requests until a response is received.
    * @param {boolean} [data.$post=false] - Make a POST request.
    * @param {boolean} [data.$credentials=false] - Send credentials with request.
    * @param {pca.Request~successCallback} [success] - A callback function for successful requests.
    * @param {pca.Request~errorCallback} [error] - A callback function for errors. */
    pca.Request = function (service, data, success, error) {
        /** @lends pca.Request.prototype */
        var request = new pca.Eventable(this);

        request.service = service || "";
        request.data = data || {};
        request.success = success || function () {};
        request.error = error || function () {};
        request.response = null;

        request.cache = !!request.data.$cache; //request will not be deleted, other requests for the same data will return this response
        request.queue = !!request.data.$queue; //queue this request until other request is finished
        request.block = !!request.data.$block; //other requests will be blocked until this request is finished, only the last request will be queued
        request.post = !!request.data.$post; //force the request to be made using a HTTP POST
        request.credentials = !!request.data.$credentials; //send request credentials such as cookies

        //build the basic request url
        request.destination = ~request.service.indexOf("//") ? request.service : pca.protocol + "//" + pca.host + "/" + request.service + "/" + pca.endpoint;
        request.query = "";

        for (var p in request.data)
            request.query += (request.query ? "&" : "") + p + "=" + encodeURIComponent(request.data[p]);

        request.url = request.destination + "?" + request.query;

        request.callback = function (response) {
            request.response = response;
            processResponse(request);
        }

        request.serviceError = function (event) {
            request.error(event && event.currentTarget && event.currentTarget.statusText ? "Webservice request error: " + event.currentTarget.statusText : "Webservice request failed.");
        }

        request.timeoutError = function () {
            request.error("Webservice request timed out.");
        }

        request.process = function () {
            pca.process(request);
        }

        /** Callback for a successful request.
        * @callback pca.Request~successCallback
        * @param {Object} items - The items returned in the response.
        * @param {Object} response - The raw response including additional fields. */

        /** Callback for a failed request.
        * @callback pca.Request~errorCallback
        * @param {string} message - The error text. */
    }

    /** Processes a webservice request
    * @memberof pca
    * @param {pca.Request} request - The request to process */
    pca.process = function (request) {
        processRequest(request);
    }

    /** Simple method for making a Postcode Anywhere service request and processing it
    * @memberof pca
    * @param {string} service - The service name. e.g. CapturePlus/Interactive/Find/v1.00
    * @param {Object} [data] - An object containing request parameters, such as key.
    * @param {boolean} [data.$cache] - The request will be cached.
    * @param {boolean} [data.$queue] - Queue other quests and make them once a response is received.
    * @param {boolean} [data.$block] - Ignore other requests until a response is received.
    * @param {boolean} [data.$post] - Make a POST request.
    * @param {pca.Request~successCallback} [success] - A callback function for successful requests.
    * @param {pca.Request~errorCallback} [error] - A callback function for errors. */
    pca.fetch = function (service, data, success, error) {
        processRequest(new pca.Request(service, data, success, error));
    }

    /** Clears blocking requests */
    pca.clearBlockingRequests = function () {
        pca.waitingRequest = false;
        pca.blockRequests = false;
    }

    /** Dynamically load an additional script.
    * @memberof pca
    * @param {string} name - the name of the script to load.
    * @param {function} [callback] - a function to call once the script has loaded.
    * @param {HTMLDocument} [doc=document] - The document element in which to append the script. */
    pca.loadScript = function (name, callback, doc) {
        var script = pca.create("script", { type: "text/javascript" }),
            head = (doc || document).getElementsByTagName("head")[0];

        script.onload = script.onreadystatechange = function () {
            if (!this.readyState || this.readyState === "loaded" || this.readyState === "complete") {
                script.onload = script.onreadystatechange = null;
                (callback || function () { })();
            }
        }

        script.src = (~name.indexOf("/") ? "" : pca.protocol + "//" + pca.host + "/js/") + name;
        head.insertBefore(script, head.firstChild);
    }

    /** Dynamically load an additional style sheet.
    * @memberof pca
    * @param {string} name - the name of the style sheet to load.
    * @param {function} [callback] - a function to call once the style sheet has loaded.
    * @param {HTMLDocument} [doc=document] - The document element in which to append the script. */
    pca.loadStyle = function (name, callback, doc) {
        var style = pca.create("link", { type: "text/css", rel: "stylesheet" }),
            head = (doc || document).getElementsByTagName("head")[0];

        style.onload = style.onreadystatechange = function () {
            if (!this.readyState || this.readyState === "loaded" || this.readyState === "complete") {
                style.onload = style.onreadystatechange = null;
                (callback || function () { })();
            }
        }

        style.href = (~name.indexOf("/") ? "" : pca.protocol + "//" + pca.host + "/css/") + name;
        head.insertBefore(style, head.firstChild);
    }

    /** Represents an item of data with a HTML element.
    * @memberof pca
    * @constructor
    * @mixes Eventable
    * @param {Object} data - An object containing the data for the item.
    * @param {string} format - The template string to format the item label with. */
    pca.Item = function (data, format) {
        /** @lends pca.Item.prototype */
        var item = new pca.Eventable(this),
            highlightClass = "pcaselected";

        /** The original data for the item. */
        item.data = data;
        /** The original formatter for the item. */
        item.format = format;
        item.html = pca.formatLine(data, format);
        item.title = data.title || pca.removeHtml(item.html);
        item.tag = pca.formatTag(data.tag || item.html);
        /** The HTML element for the item. */
        item.element = pca.create("div", { className: "pcaitem", innerHTML: item.html, title: item.title });
        item.visible = true;

        /** Applies the highlight style.
        * @fires highlight */
        item.highlight = function () {
            pca.addClass(item.element, highlightClass);
            item.fire("highlight");

            return item;
        }

        /** Removes the highlight style.
        * @fires lowlight */
        item.lowlight = function () {
            pca.removeClass(item.element, highlightClass);
            item.fire("lowlight");

            return item;
        }

        /** The user is hovering over the item.
        * @fires mouseover */
        item.mouseover = function () {
            item.fire("mouseover");
        }

        /** The user has left the item.
        * @fires mouseout */
        item.mouseout = function () {
            item.fire("mouseout");
        }

        /** The user is pressed down on the item.
        * @fires mousedown */
        item.mousedown = function () {
            item.fire("mousedown");
        }

        /** The user released the item.
        * @fires mouseup */
        item.mouseup = function () {
            item.fire("mouseup");

            if (pca.galaxyFix) item.select();
        }

        /** The user has clicked the item.
        * @fires click */
        item.click = function () {
            item.fire("click");

            if (pca.galaxyFix) return;

            item.select();
        }

        /** Selects the item.
        * @fires select */
        item.select = function () {
            item.fire("select", item.data);

            return item;
        }

        /** Makes the item invisible.
        * @fires hide */
        item.hide = function () {
            item.visible = false;
            item.element.style.display = "none";
            item.fire("hide");

            return item;
        }

        /** Makes the item visible.
        * @fires show */
        item.show = function () {
            item.visible = true;
            item.element.style.display = "";
            item.fire("show");

            return item;
        }

        pca.listen(item.element, "mouseover", item.mouseover);
        pca.listen(item.element, "mouseout", item.mouseout);
        pca.listen(item.element, "mousedown", item.mousedown);
        pca.listen(item.element, "mouseup", item.mouseup);
        pca.listen(item.element, "click", item.click);

        return item;
    }

    /** Represents a collection of items.
    * @memberof pca
    * @constructor
    * @mixes Eventable */
    pca.Collection = function () {
        /** @lends pca.Collection.prototype */
        var collection = new pca.Eventable(this);

        /** The list of items.
        * @type {Array.<pca.Item>} */
        collection.items = [];
        /** The index of the current highlighted item.
        * @type {number} */
        collection.highlighted = -1;
        /** The number of visible items.
        * @type {number} */
        collection.count = 0;
        collection.firstItem = null;
        collection.lastItem = null;
        collection.firstVisibleItem = null;
        collection.lastVisibleItem = null;

        /** Populates the collection with new items.
        * @param {Array.<Object>|Object} data - Data objects to add e.g. a response array from a service.
        * @param {string} format - A template string to format the label of the item.
        * @param {pca.Collection~itemCallback} callback - A callback function when the item is selected.
        * @fires add */
        collection.add = function (data, format, callback) {
            var additions = [];

            callback = callback || function () { };

            function createItem(attributes) {
                var item = new pca.Item(attributes, format);
                item.listen("mouseover", function () { collection.highlight(item); });

                item.listen("select", function (selectedItem) {
                    collection.fire("select", selectedItem);
                    callback(selectedItem);
                });

                collection.items.push(item);
                additions.push(item);
                return item;
            }

            if (data.length) {
                for (var i = 0; i < data.length; i++)
                    createItem(data[i]);
            }
            else createItem(data);

            collection.count += data.length;
            collection.firstVisibleItem = collection.firstItem = collection.items[0];
            collection.lastVisibleItem = collection.lastItem = collection.items[collection.items.length - 1];
            collection.fire("add", additions);

            return collection;
        }

        /** Sort the items in the collection.
        * @param {string} [field] - The name of the property of the item to compare.
        * @fires sort */
        collection.sort = function (field) {
            collection.items.sort(function (a, b) {
                return field ? (a.data[field] > b.data[field] ? 1 : -1) : (a.tag > b.tag ? 1 : -1);
            });

            collection.fire("sort");

            return collection;
        }

        /** Reverse the order of the items.
        * @fires reverse */
        collection.reverse = function () {
            collection.items.reverse();

            collection.fire("reverse");

            return collection;
        }

        /** Filters the items in the collection and hides all items that do not contain the term.
        * @param {string} term - The term which each item should contain.
        * @fires filter */
        collection.filter = function (term) {
            var tag = pca.formatTag(term),
                count = collection.count;

            collection.count = 0;
            collection.firstVisibleItem = null;
            collection.lastVisibleItem = null;

            collection.all(function (item) {
                if (~item.tag.indexOf(tag)) {
                    item.show();
                    collection.count++;

                    collection.firstVisibleItem = collection.firstVisibleItem || item;
                    collection.lastVisibleItem = item;
                }
                else
                    item.hide();
            });

            if (count !== collection.count)
                collection.fire("filter");

            return collection;
        }

        /** Returns the items which match the search term.
        * @param {string} term - The term which each item should contain.
        * @returns {Array.<pca.Item>} The items matching the search term. */
        collection.match = function (term) {
            var tag = pca.formatTag(term),
                matches = [];

            collection.all(function (item) {
                if (~item.tag.indexOf(tag))
                    matches.push(item);
            });

            return matches;
        }

        /** Remove all items from the collection.
        * @fires clear */
        collection.clear = function () {
            collection.items = [];
            collection.count = 0;
            collection.highlighted = -1;
            collection.firstItem = null;
            collection.lastItem = null;
            collection.firstVisibleItem = null;
            collection.lastVisibleItem = null;

            collection.fire("clear");

            return collection;
        }

        /** Runs a function for every item in the list or until false is returned.
        * @param {pca.Collection~itemDelegate} delegate - The delegate function to handle each item. */
        collection.all = function (delegate) {
            for (var i = 0; i < collection.items.length; i++) {
                if (delegate(collection.items[i], i) === false)
                    break;
            }

            return collection;
        }

        /** Sets the current highlighted item.
        * @param {pca.Item} item - The item to highlight.
        * @fires highlight */
        collection.highlight = function (item) {
            if (~collection.highlighted) collection.items[collection.highlighted].lowlight();
            collection.highlighted = collection.index(item);
            if (~collection.highlighted) collection.items[collection.highlighted].highlight();

            collection.fire("highlight", item);

            return collection;
        }

        /** Gets the index of an item.
        * @param {pca.Item} item - The item search for.
        * @returns {number} The index of the item or -1.*/
        collection.index = function (item) {
            for (var i = 0; i < collection.items.length; i++) {
                if (collection.items[i] === item)
                    return i;
            }

            return -1;
        }

        /** Returns the first matching item.
        * @param {pca.Collection~itemMatcher} [matcher] - The matcher function to handle each item.
        * @returns {pca.Item} The item found or null. */
        collection.first = function (matcher) {
            for (var i = 0; i < collection.items.length; i++) {
                if (!matcher ? collection.items[i].visible : matcher(collection.items[i]))
                    return collection.items[i];
            }

            return null;
        }

        /** Returns the last matching item.
        * @param {pca.Collection~itemMatcher} [matcher] - The matcher function to handle each item.
        * @returns {pca.Item} The item found or null. */
        collection.last = function (matcher) {
            for (var i = collection.items.length - 1; i >= 0; i--) {
                if (!matcher ? collection.items[i].visible : matcher(collection.items[i]))
                    return collection.items[i];
            }

            return null;
        }

        /** Returns the next matching item from the current selection.
        * @param {pca.Collection~itemMatcher} [matcher] - The matcher function to handle each item.
        * @returns {pca.Item} The item found or the first item. */
        collection.next = function (matcher) {
            for (var i = collection.highlighted + 1; i < collection.items.length; i++) {
                if (!matcher ? collection.items[i].visible : matcher(collection.items[i]))
                    return collection.items[i];
            }

            return collection.first();
        }

        /** Returns the previous matching item to the current selection.
        * @param {pca.Collection~itemMatcher} [matcher] - The matcher function to handle each item.
        * @returns {pca.Item} The item found or the last item. */
        collection.previous = function (matcher) {
            for (var i = collection.highlighted - 1; i >= 0; i--) {
                if (!matcher ? collection.items[i].visible : matcher(collection.items[i]))
                    return collection.items[i];
            }

            return collection.last();
        }

        /** Returns all items that are visible in the list.
        * @returns {Array.<pca.Item>} The items that are visible. */
        collection.visibleItems = function () {
            var visible = [];

            collection.all(function (item) {
                if (item.visible)
                    visible.push(item);
            });

            return visible;
        }

        return collection;

        /** Callback function for item selection.
        * @callback pca.Collection~itemCallback
        * @param {Object} data - The original data of the item. */

        /** Delegate function to handle an item.
        * @callback pca.Collection~itemDelegate
        * @param {pca.Item} item - The current item.
        * @param {number} index - The index of the current item in the collection.
        * @returns {boolean} Returns a response of false to stop the operation. */

        /** Delegate function to compare an item.
        * @callback pca.Collection~itemMatcher
        * @param {pca.Item} item - The current item.
        * @returns {boolean} Returns a response of true for a matching item. */
    }

    /**
    * List options.
    * @typedef {Object} pca.List.Options
    * @property {string} [name] - A reference for the list used an Id for ARIA.
    * @property {number} [minItems] - The minimum number of items to show in the list.
    * @property {number} [maxItems] - The maximum number of items to show in the list.
    * @property {boolean} [allowTab] - Allow the tab key to cycle through items in the list.
    */

    /** A HTML list to display items.
    * @memberof pca
    * @constructor
    * @mixes Eventable
    * @param {pca.List.Options} [options] - Additional options to apply to the list. */
    pca.List = function (options) {
        /** @lends pca.List.prototype */
        var list = new pca.Eventable(this);

        list.options = options || {};
        /** The HTML parent element of the list */
        list.element = pca.create("div", { className: "pca pcalist" });
        /** The collection of items in the list
        * @type {pca.Collection} */
        list.collection = new pca.Collection();
        list.visible = true;
        list.scroll = {
            held: false,
            moved: false,
            origin: 0,
            position: 0,
            x: 0,
            y: 0,
            dx: 0,
            dy: 0
        }
        list.highlightedItem = null;
        /** An item that will always be displayed first in the list.
        * @type {pca.Item} */
        list.headerItem = null;
        /** An item that will always be displayed last in the list.
        * @type {pca.Item} */
        list.footerItem = null;
        list.firstItem = null;
        list.lastItem = null;
        list.firstItemClass = "pcafirstitem";
        list.lastItemClass = "pcalastitem";

        list.options.minItems = list.options.minItems || 0;
        list.options.maxItems = list.options.maxItems || 10;
        list.options.allowTab = list.options.allowTab || false;

        /** Shows the list.
        * @fires show */
        list.show = function () {
            list.visible = true;
            list.element.style.display = "";
            list.fire("show");
            list.resize();

            return list;
        }

        /** Hides the list.
        * @fires hide */
        list.hide = function () {
            list.visible = false;
            list.element.style.display = "none";
            list.fire("hide");

            return list;
        }

        /** Redraws the list by removing all children and adding them again.
        * @fires draw */
        list.draw = function () {
            list.destroy();

            if (list.headerItem)
                list.element.appendChild(list.headerItem.element);

            list.collection.all(function (item) {
                list.element.appendChild(item.element);
            });

            if (list.footerItem)
                list.element.appendChild(list.footerItem.element);

            list.resize();
            list.fire("draw");

            return list;
        }

        /** Marks the first and last items in the list with a CSS class */
        list.markItems = function () {
            if (list.firstItem) pca.removeClass(list.firstItem.element, list.firstItemClass);
            if (list.lastItem) pca.removeClass(list.lastItem.element, list.lastItemClass);

            if (list.collection.count) {
                list.firstItem = list.headerItem || list.collection.firstVisibleItem;
                list.lastItem = list.footerItem || list.collection.lastVisibleItem;
                pca.addClass(list.firstItem.element, list.firstItemClass);
                pca.addClass(list.lastItem.element, list.lastItemClass);
            }
        }

        /** Adds items to the list collection.
        * @param {Array.<Object>} array - An array of data objects to add e.g. a response array from a service.
        * @param {string} format - A template string to format the label of the item.
        * @param {pca.Collection~itemCallback} callback - A callback function when the item is selected.
        * @fires add */
        list.add = function (array, format, callback) {
            list.collection.add(array, format, callback);
            list.draw();

            return list;
        }

        /** Destroys all items in the list. */
        list.destroy = function () {
            while (list.element.childNodes && list.element.childNodes.length)
                list.element.removeChild(list.element.childNodes[0]);

            return list;
        }

        /** Clears all items from the list
        * @fires clear */
        list.clear = function () {
            list.collection.clear();
            list.destroy();
            list.fire("clear");

            return list;
        }

        /** Sets the scroll position of the list.
        * @param {number} position - The top scroll position in pixels.
        * @fires scroll */
        list.setScroll = function (position) {
            list.element.scrollTop = position;
            list.fire("scroll");

            return list;
        }

        /** Enables touch input for list scrolling.
        * Most mobile browsers will handle scrolling without this. */
        list.enableTouch = function () {
            //touch events
            function touchStart(event) {
                event = event || window.event;
                list.scroll.held = true;
                list.scroll.moved = false;
                list.scroll.origin = parseInt(list.scrollTop);
                list.scroll.y = parseInt(event.touches[0].pageY);
            }

            function touchEnd() {
                list.scroll.held = false;
            }

            function touchCancel() {
                list.scroll.held = false;
            }

            function touchMove(event) {
                if (list.scroll.held) {
                    event = event || window.event;

                    //Disable Gecko and Webkit image drag
                    pca.smash(event);

                    list.scroll.dy = list.scroll.y - parseInt(event.touches[0].pageY);
                    list.scroll.position = list.scroll.origin + list.scroll.dy;
                    list.setScroll(list.scroll.position);
                    list.scroll.moved = true;
                }
            }

            pca.listen(list.element, "touchstart", touchStart);
            pca.listen(list.element, "touchmove", touchMove);
            pca.listen(list.element, "touchend", touchEnd);
            pca.listen(list.element, "touchcancel", touchCancel);

            return list;
        }

        /** Moves to an item in the list */
        list.move = function (item) {
            if (item) {
                list.collection.highlight(item);

                if (item === list.headerItem || item === list.footerItem)
                    item.highlight();

                list.scrollToItem(item);
            }

            return list;
        }

        /** Moves to the next item in the list. */
        list.next = function () {
            return list.move(list.nextItem());
        }

        /** Moves to the previous item in the list */
        list.previous = function () {
            return list.move(list.previousItem());
        }

        /** Moves to the first item in the list. */
        list.first = function () {
            return list.move(list.firstItem);
        }

        /** Moves to the last item in the list. */
        list.last = function () {
            return list.move(list.lastItem);
        }

        /** Returns the next item.
        * @returns {pca.Item} The next item. */
        list.nextItem = function () {
            if (!list.highlightedItem) return list.firstItem;

            if (list.highlightedItem === list.collection.lastVisibleItem && (list.footerItem || list.headerItem))
                return list.footerItem || list.headerItem;

            if (list.footerItem && list.headerItem && list.highlightedItem === list.footerItem)
                return list.headerItem;

            return list.collection.next();
        }

        /** Returns the previous item.
        * @returns {pca.Item} The previous item. */
        list.previousItem = function () {
            if (!list.highlightedItem) return list.lastItem;

            if (list.highlightedItem === list.collection.firstVisibleItem && (list.footerItem || list.headerItem))
                return list.headerItem || list.footerItem;

            if (list.footerItem && list.headerItem && list.highlightedItem === list.headerItem)
                return list.footerItem;

            return list.collection.previous();
        }

        /** Returns the current item.
        * @returns {pca.Item} The current item. */
        list.currentItem = function () {
            return list.highlightedItem;
        }

        /** Returns true if the current item is selectable.
        * @returns {boolean} True if the current item is selectable. */
        list.selectable = function () {
            return list.visible && !!list.currentItem();
        }

        /** Calls the select function for the current item */
        list.select = function () {
            if (list.selectable())
                list.currentItem().select();

            return list;
        }

        /** Handles list navigation based upon a key code
        * @param {number} key - The keyboard key code.
        * @returns {boolean} True if the list handled the key code. */
        list.navigate = function (key) {
            switch (key) {
                case 40: //down
                    list.next();
                    return true;
                case 38: //up
                    list.previous();
                    return true;
                case 13: //enter/return
                    if (list.selectable()) {
                        list.select();
                        return true;
                    }
                case 9: //tab
                    if (list.options.allowTab) {
                        list.next();
                        return true;
                    }
            }

            return false;
        }

        /** Scrolls the list to show an item.
        * @param {pca.Item} item - The item to scroll to. */
        list.scrollToItem = function (item) {
            list.scroll.position = list.element.scrollTop;

            if (item.element.offsetTop < list.scroll.position) {
                list.scroll.position = item.element.offsetTop;
                list.setScroll(list.scroll.position);
            }
            else {
                if (item.element.offsetTop + item.element.offsetHeight > list.scroll.position + list.element.offsetHeight) {
                    list.scroll.position = item.element.offsetTop + item.element.offsetHeight - list.element.offsetHeight;
                    list.setScroll(list.scroll.position);
                }
            }

            return list;
        }

        /** Filters the list item collection.
        * @param {string} term - The term to filter the items on.
        * @fires filter */
        list.filter = function (term) {
            var current = list.collection.count;

            list.collection.filter(term);
            list.markItems();

            if (current !== list.collection.count)
                list.fire("filter", term);

            return list;
        }

        /** Calculates the height of the based on minItems, maxItems and item size.
        * @returns {number} The height required in pixels. */
        list.getHeight = function () {
            var visibleItems = list.collection.visibleItems(),
                headerItemHeight = list.headerItem ? pca.getSize(list.headerItem.element).height : 0,
                footerItemHeight = list.footerItem ? pca.getSize(list.footerItem.element).height : 0,
                lastItemHeight = 0,
                itemsHeight = 0;

            //count the height of items in the list
            for (var i = 0; i < visibleItems.length && i < list.options.maxItems; i++) {
                lastItemHeight = pca.getSize(visibleItems[i].element).height;
                itemsHeight += lastItemHeight;
            }

            //calculate the height of blank space required to keep the list height - assumes the last item has no bottom border
            if (visibleItems.length < list.options.minItems)
                itemsHeight += (lastItemHeight + 1) * (list.options.minItems - visibleItems.length);

            return itemsHeight + headerItemHeight + footerItemHeight;
        }

        /** Sizes the list based upon the maximum number of items. */
        list.resize = function () {
            var height = list.getHeight();

            if (height > 0)
                list.element.style.height = height + "px";
        }

        //Create an item for the list which is not in the main collection
        function createListItem(data, format, callback) {
            var item = new pca.Item(data, format);

            item.listen("mouseover", function () {
                list.collection.highlight(item);
                item.highlight();
            });

            list.collection.listen("highlight", item.lowlight);

            item.listen("select", function (selectedItem) {
                list.collection.fire("select", selectedItem);
                callback(selectedItem);
            });

            return item;
        }

        /** Adds an item to the list which will always appear at the bottom. */
        list.setHeaderItem = function (data, format, callback) {
            list.headerItem = createListItem(data, format, callback);
            pca.addClass(list.footerItem.element, "pcaheaderitem");
            list.markItems();
            return list;
        }

        /** Adds an item to the list which will always appear at the bottom. */
        list.setFooterItem = function (data, format, callback) {
            list.footerItem = createListItem(data, format, callback);
            pca.addClass(list.footerItem.element, "pcafooteritem");
            list.markItems();
            return list;
        }

        //store the current highlighted item
        list.collection.listen("highlight", function (item) {
            list.highlightedItem = item;
        });

        //Map collection events
        list.collection.listen("add", function (additions) {
            list.markItems();
            list.fire("add", additions);
        });

        //ARIA support
        if (list.options.name) {
            pca.setAttributes(list.element, { id: list.options.name, role: "listbox", "aria-activedescendant": "" });

            list.collection.listen("add", function (additions) {
                function listenHighlightChange(item) {
                    item.listen("highlight", function () {
                        pca.setAttributes(list.element, { "aria-activedescendant": item.id });
                    });
                }

                for (var i = 0; i < additions.length; i++)
                    listenHighlightChange(additions[i]);

                list.collection.all(function (item, index) {
                    item.element.id = item.id = list.options.name + "_item" + index;
                    pca.setAttributes(item.element, { role: "option" });
                });
            });
        }

        return list;
    }

    /**
    * Autocomplete list options.
    * @typedef {Object} pca.AutoComplete.Options
    * @property {string} [name] - A reference for the list used an Id for ARIA.
    * @property {string} [className] - An additional class to add to the autocomplete.
    * @property {boolean} [force] - Forces the list to bind to the fields.
    * @property {boolean} [onlyDown] - Force the list to only open downwards.
    * @property {number|string} [width] - Fixes the width to the specified number of pixels.
    * @property {number|string} [height] - Fixes the height to the specified number of pixels.
    * @property {number|string} [left] - Shifts the list left by the specified number of pixels.
    * @property {number|string} [top] - Shifts the list left by the specified number of pixels.
    * @property {string} [emptyMessage] - When set an empty list will show this message rather than hiding after a filter.
    */

    /** Creates an autocomplete list which is bound to a field.
    * @memberof pca
    * @constructor
    * @mixes Eventable
    * @param {Array.<HTMLElement>} fields - A list of input elements to bind to.
    * @param {pca.AutoComplete.Options} [options] - Additional options to apply to the autocomplete list. */
    pca.AutoComplete = function (fields, options) {
        /** @lends pca.AutoComplete.prototype */
        var autocomplete = new pca.Eventable(this);

        autocomplete.options = options || {};
        autocomplete.options.force = autocomplete.options.force || false;
        autocomplete.options.allowTab = autocomplete.options.allowTab || false;
        autocomplete.options.onlyDown = autocomplete.options.onlyDown || false;
        /** The parent HTML element for the autocomplete list. */
        autocomplete.element = pca.create("div", { className: "pcaautocomplete pcatext" });
        autocomplete.anchors = [];
        /** The parent list object.
        * @type {pca.List} */
        autocomplete.list = new pca.List(autocomplete.options);
        autocomplete.fieldListeners = [];
        /** The current field that the autocomplete is bound to. */
        autocomplete.field = null;
        autocomplete.positionField = null;
        /** The visibility state of the autocomplete list.
        * @type {boolean} */
        autocomplete.visible = true;
        autocomplete.hover = false;
        autocomplete.focused = false;
        autocomplete.upwards = false;
        autocomplete.controlDown = false;
        /** The disabled state of the autocomplete list.
        * @type {boolean} */
        autocomplete.disabled = false;
        autocomplete.fixedWidth = false;
        /** When set an empty list will show this message rather than hiding after a filter.
        * @type {string} */
        autocomplete.emptyMessage = autocomplete.options.emptyMessage || "";
        /** When enabled list will not redraw as the user types, but filter events will still be raised.
        * @type {boolean} */
        autocomplete.skipFilter = false;
        /** Won't show the list, but it will continue to fire events in the same way. */
        autocomplete.stealth = false;

        function documentClicked() {
            autocomplete.checkHide();
        }

        function windowResized() {
            autocomplete.resize();
        }

        /** Header element. */
        autocomplete.header = {
            element: pca.create("div", { className: "pcaheader" }),
            headerText: pca.create("div", { className: "pcamessage" }),

            init: function () {
                this.hide();
            },

            setContent: function (content) {
                content = content || "";
                typeof content == 'string' ? this.element.innerHTML = content : this.element.appendChild(content);
                autocomplete.fire("header");
                return this;
            },

            setText: function (text) {
                text = text || "";
                this.element.appendChild(this.headerText);

                if (typeof text == 'string') {
                    pca.clear(this.headerText);
                    this.headerText.appendChild(pca.create("span", { className: "pcamessageicon" }));
                    this.headerText.appendChild(pca.create("span", { innerHTML: text }));
                }
                else this.headerText.appendChild(text);

                autocomplete.fire("header");
                return this;
            },

            clear: function () {
                this.setContent();
                autocomplete.fire("header");
                return this;
            },

            show: function () {
                this.element.style.display = "";
                autocomplete.fire("header");
                return this;
            },

            hide: function () {
                this.element.style.display = "none";
                autocomplete.fire("header");
                return this;
            }
        }

        /** Footer element. */
        autocomplete.footer = {
            element: pca.create("div", { className: "pcafooter" }),

            init: function () {
                this.hide();
            },

            setContent: function (content) {
                content = content || "";
                typeof content == 'string' ? this.element.innerHTML = content : this.element.appendChild(content);
                autocomplete.fire("footer");
                return this;
            },

            show: function () {
                this.element.style.display = "";
                autocomplete.fire("footer");
                return this;
            },

            hide: function () {
                this.element.style.display = "none";
                autocomplete.fire("footer");
                return this;
            }
        }

        /** Attaches the list to field or list of fields provided. */
        autocomplete.load = function () {

            if (fields.length && fields.constructor === Array) {
                for (var i = 0; i < fields.length; i++)
                    autocomplete.attach(pca.getElement(fields[i]));
            }
            else
                autocomplete.attach(pca.getElement(fields));

            pca.listen(autocomplete.element, "mouseover", function () { autocomplete.hover = true; });
            pca.listen(autocomplete.element, "mouseout", function () { autocomplete.hover = false; });

            //page events
            pca.listen(document, "click", documentClicked);
            pca.listen(window, "resize", windowResized);

            if ((document.documentMode && document.documentMode <= 7) || (/\bMSIE\s(7|6)/).test(pca.agent))
                autocomplete.setWidth(280);

            if (document.documentMode && document.documentMode <= 5) {
                pca.applyStyleFixes(".pca .pcafooter", { fontSize: "0pt" });
                pca.applyStyleFixes(".pca .pcaflag", { fontSize: "0pt" });
            }

            return autocomplete;
        }

        /** Attaches the list to a field.
        * @param {HTMLElement} field - The field to attach to. */
        autocomplete.attach = function (field) {

            function bindFieldEvent(f, event, action) {
                pca.listen(f, event, action);
                autocomplete.fieldListeners.push({ field: f, event: event, action: action });
            }

            function anchorToField(f) {
                var anchor = pca.create("table", { className: "pca pcaanchor", cellPadding: 0, cellSpacing: 0 }),
                    chain = [anchor.insertRow(0).insertCell(0), anchor.insertRow(1).insertCell(0)],
                    link = pca.create("div", { className: "pcachain" });

                function focus() {
                    link.appendChild(autocomplete.element);
                    autocomplete.focus(f);
                }

                //check the field
                if (!f || !f.tagName) {
                    pca.append(autocomplete.element);
                    return;
                }

                f.parentNode.insertBefore(anchor, f);
                chain[0].appendChild(f);
                chain[1].appendChild(link);
                autocomplete.anchors.push(anchor);

                if (pca.inputField(f)) {
                    bindFieldEvent(f, "keyup", autocomplete.keyup);
                    bindFieldEvent(f, "keydown", autocomplete.keydown);
                    bindFieldEvent(f, "focus", focus);
                    bindFieldEvent(f, "blur", autocomplete.blur);
                    bindFieldEvent(f, "keypress", autocomplete.keypress);
                    bindFieldEvent(f, "paste", autocomplete.paste);

                    // ReSharper disable once ConditionIsAlwaysConst
                    // IE9 bug when running within iframe
                    if (typeof document.activeElement != "unknown" && f === document.activeElement) focus();
                }

                bindFieldEvent(f, "click", function () { autocomplete.click(f); });
                bindFieldEvent(f, "dblclick", function () { autocomplete.dblclick(f); });
                bindFieldEvent(f, "change", function () { autocomplete.change(f); });
            }

            function positionAdjacentField(f) {
                function focus() {
                    autocomplete.focus(f);
                }

                pca.append(autocomplete.element);

                //check the field
                if (!f || !f.tagName) return;

                if (pca.inputField(f)) {
                    bindFieldEvent(f, "keyup", autocomplete.keyup);
                    bindFieldEvent(f, "keydown", autocomplete.keydown);
                    bindFieldEvent(f, "focus", focus);
                    bindFieldEvent(f, "blur", autocomplete.blur);
                    bindFieldEvent(f, "keypress", autocomplete.keypress);
                    bindFieldEvent(f, "paste", autocomplete.paste);

                    // ReSharper disable once ConditionIsAlwaysConst
                    // IE9 bug when running within iframe
                    if (typeof document.activeElement != "unknown" && f === document.activeElement) focus();
                }

                bindFieldEvent(f, "click", function () { autocomplete.click(f); });
                bindFieldEvent(f, "dblclick", function () { autocomplete.dblclick(f); });
                bindFieldEvent(f, "change", function () { autocomplete.change(f); });
            }

            autocomplete.options.force ? anchorToField(field) : positionAdjacentField(field);
        }

        /** Positions the autocomplete.
        * @param {HTMLElement} field - The field to position the list under. */
        autocomplete.position = function (field) {
            var fieldPosition = pca.getPosition(field),
                fieldSize = pca.getSize(field),
                topParent = pca.getTopOffsetParent(field),
                parentScroll = pca.getParentScroll(field),
                listSize = pca.getSize(autocomplete.element),
                windowSize = pca.getSize(window),
                windowScroll = pca.getScroll(window),
                fixed = !pca.isPage(topParent);

            //check where there is space to open the list
            var hasSpaceBelow = (fieldPosition.top + listSize.height - (fixed ? 0 : windowScroll.top)) < windowSize.height,
                hasSpaceAbove = (fieldPosition.top - (fixed ? 0 : windowScroll.top)) > listSize.height;

            //should the popup open upwards
            autocomplete.upwards = !hasSpaceBelow && hasSpaceAbove && !autocomplete.options.onlyDown;

            if (autocomplete.upwards) {
                if (autocomplete.options.force) {
                    autocomplete.element.style.top = -(listSize.height + fieldSize.height + 2) + "px";
                }
                else {
                    autocomplete.element.style.top = (fieldPosition.top - parentScroll.top - listSize.height) + (fixed ? windowScroll.top : 0) + "px";
                    autocomplete.element.style.left = (fieldPosition.left - parentScroll.left) + (fixed ? windowScroll.left : 0) + "px";
                }
            }
            else {
                if (autocomplete.options.force)
                    autocomplete.element.style.top = "auto";
                else {
                    autocomplete.element.style.top = ((fieldPosition.top - parentScroll.top) + fieldSize.height + 1) + (fixed ? windowScroll.top : 0) + "px";
                    autocomplete.element.style.left = (fieldPosition.left - parentScroll.left) + (fixed ? windowScroll.left : 0) + "px";
                }
            }

            if (autocomplete.options.left) autocomplete.element.style.left = (parseInt(autocomplete.element.style.left) + parseInt(autocomplete.options.left)) + "px";
            if (autocomplete.options.top) autocomplete.element.style.top = (parseInt(autocomplete.element.style.top) + parseInt(autocomplete.options.top)) + "px";

            var ownBorderWidth = (parseInt(pca.getStyle(autocomplete.element, "borderLeftWidth")) + parseInt(pca.getStyle(autocomplete.element, "borderRightWidth"))) || 0,
                preferredWidth = Math.max((pca.getSize(field).width - ownBorderWidth), 0);

            //set minimum width for field
            if (!autocomplete.fixedWidth)
                autocomplete.element.style.minWidth = preferredWidth + "px";

            //fix the size when there is no support for minimum width
            if ((document.documentMode && document.documentMode <= 7) || (/\bMSIE\s(7|6)/).test(pca.agent)) {
                autocomplete.setWidth(Math.max(preferredWidth, 280));
                autocomplete.element.style.left = ((parseInt(autocomplete.element.style.left) || 0) - 2) + "px";
                autocomplete.element.style.top = ((parseInt(autocomplete.element.style.top) || 0) - 2) + "px";
            }

            autocomplete.positionField = field;
            autocomplete.fire("move");

            return autocomplete;
        }

        /** Positions the list under the last field it was positioned to. */
        autocomplete.reposition = function () {
            if (autocomplete.positionField) autocomplete.position(autocomplete.positionField);
            return autocomplete;
        }

        /** Sets the value of input field to prompt the user.
        * @param {string} text - The text to show.
        * @param {number} [position] - The index at which to set the carat. */
        autocomplete.prompt = function (text, position) {
            if (typeof position == "number") {
                //insert space
                if (position === 0)
                    text = " " + text;
                else if (position >= text.length) {
                    text = text + " ";
                    position++;
                }
                else {
                    text = text.substring(0, position) + "  " + text.substring(position, text.length);
                    position++;
                }

                pca.setValue(autocomplete.field, text);

                if (autocomplete.field.setSelectionRange) {
                    autocomplete.field.focus();
                    autocomplete.field.setSelectionRange(position, position);
                }
                else if (autocomplete.field.createTextRange) {
                    var range = autocomplete.field.createTextRange();
                    range.move('character', position);
                    range.select();
                }
            }
            else
                pca.setValue(autocomplete.field, text);

            return autocomplete;
        }

        /** Shows the autocomplete.
        * @fires show */
        autocomplete.show = function () {
            if (!autocomplete.disabled && !autocomplete.stealth) {
                autocomplete.visible = true;
                autocomplete.element.style.display = "";

                //deal with empty list
                if (!autocomplete.list.collection.count) {
                    if (autocomplete.options.emptyMessage)
                        autocomplete.header.setText(autocomplete.options.emptyMessage).show();

                    autocomplete.list.hide();
                }
                else {
                    if (autocomplete.options.emptyMessage)
                        autocomplete.header.clear().hide();

                    autocomplete.list.show();
                }

                autocomplete.setScroll(0);
                autocomplete.reposition();
                autocomplete.fire("show");
            }
            return autocomplete;
        }

        /** Shows the autocomplete and all items without a filter. */
        autocomplete.showAll = function () {
            autocomplete.list.filter("");
            autocomplete.show();
        }

        /** Hides the autocomplete.
        * @fires hide */
        autocomplete.hide = function () {
            autocomplete.visible = false;
            autocomplete.element.style.display = "none";
            autocomplete.fire("hide");

            return autocomplete;
        }

        /** Shows the autocomplete list under a field.
        * @param {HTMLElement} field - The field to show the list under.
        * @fires focus */
        autocomplete.focus = function (field) {
            autocomplete.field = field;
            autocomplete.focused = true;
            autocomplete.show();
            autocomplete.position(field);

            autocomplete.fire("focus");
        }

        /** Handles the field blur event to hide the list unless it has focus.
        * @fires blur */
        autocomplete.blur = function () {
            autocomplete.focused = false;
            autocomplete.checkHide();

            autocomplete.fire("blur");
        }

        /** Hides the list unless it has field or mouse focus */
        autocomplete.checkHide = function () {
            if (autocomplete.visible && !autocomplete.focused && !autocomplete.hover)
                autocomplete.hide();

            return autocomplete;
        }

        /** Handles a keyboard key.
        * @param {number} key - The keyboard key code to handle.
        * @param {Event} [event] - The original event to cancel if required.
        * @fires keyup */
        autocomplete.handleKey = function (key, event) {
            if (key === 27) { //escape
                autocomplete.hide();
                autocomplete.fire("escape");
            }
            else if (key === 17) //ctrl
                autocomplete.controlDown = false;
            else if (key === 8 || key === 46) { //del or backspace
                autocomplete.filter();
                autocomplete.fire("delete");
            }
            else if (key !== 0 && key <= 46 && key !== 32) { //recognised non-character key
                if (autocomplete.visible && autocomplete.list.navigate(key)) {
                    if (event) pca.smash(event); //keys handled by the list, stop other events
                }
                else if (key === 38 || key === 40) //up or down when list is hidden
                    autocomplete.filter();
            }
            else if (autocomplete.visible) //normal key press when list is visible
                autocomplete.filter();

            autocomplete.fire("keyup", key);
        }

        //keydown event handler
        autocomplete.keydown = function (event) {
            event = event || window.event;
            var key = event.which || event.keyCode;

            if (key === 17)
                autocomplete.controlDown = true;

            if (key === 9 && autocomplete.options.allowTab)
                pca.smash(event);
        }

        //keyup event handler
        autocomplete.keyup = function (event) {
            event = event || window.event;
            var key = event.which || event.keyCode;
            autocomplete.handleKey(key, event);
        }

        //keypress event handler
        autocomplete.keypress = function (event) {
            var key = window.event ? window.event.keyCode : event.which;

            if (autocomplete.visible && key === 13 && autocomplete.list.selectable())
                pca.smash(event);
        }

        //paste event handler
        autocomplete.paste = function () {
            window.setTimeout(function () {
                autocomplete.filter();
                autocomplete.fire("paste");
            }, 0);
        }

        /** Handles user clicks on field.
        * @fires click */
        autocomplete.click = function (f) {
            autocomplete.fire("click", f);
        }

        /** Handles user double clicks on the field.
        * @fires dblclick */
        autocomplete.dblclick = function (f) {
            autocomplete.fire("dblclick", f);
        }

        /** Handles field value change.
        * @fires change */
        autocomplete.change = function (f) {
            autocomplete.fire("change", f);
        }

        /** Handles page resize.
        * @fires change */
        autocomplete.resize = function () {
            if (autocomplete.visible) autocomplete.reposition();
        }

        /** Add items to the autocomplete list.
        * @param {Array.<Object>} array - An array of data objects to add as items.
        * @param {string} format - A format string to display items.
        * @param {function} callback - A callback function for item select. */
        autocomplete.add = function (array, format, callback) {
            autocomplete.list.add(array, format, callback);

            return autocomplete;
        }

        /** Clears the autocomplete list. */
        autocomplete.clear = function () {
            autocomplete.list.clear();

            return autocomplete;
        }

        /** Sets the scroll position of the autocomplete list. */
        autocomplete.setScroll = function (position) {
            autocomplete.list.setScroll(position);

            return autocomplete;
        }

        /** Sets the width of the autocomplete list.
        * @param {number|string} width - The width in pixels for the list. */
        autocomplete.setWidth = function (width) {
            if (typeof width == "number") {
                width = Math.max(width, 220);
                autocomplete.element.style.width = width + "px";
                if (document.documentMode && document.documentMode <= 5) width -= 2;
                autocomplete.list.element.style.width = width + "px";
            } else {
                autocomplete.element.style.width = width;
                autocomplete.list.element.style.width = width;
            }

            autocomplete.fixedWidth = (width !== "auto");
            autocomplete.element.style.minWidth = 0;

            return autocomplete;
        }

        /** Sets the height of the autocomplete list.
        * @param {number|string} height - The height in pixels for the list. */
        autocomplete.setHeight = function (height) {
            if (typeof height == "number")
                autocomplete.list.element.style.height = height + "px";
            else
                autocomplete.list.element.style.height = height;

            return autocomplete;
        }

        /** Filters the autocomplete list for items matching the supplied term.
        * @param {string} term - The term to search for. Case insensitive.
        * @fires filter */
        autocomplete.filter = function (term) {
            term = term || pca.getValue(autocomplete.field);

            if (autocomplete.skipFilter) {
                if (autocomplete.list.collection.match(term).length < autocomplete.list.collection.count)
                    autocomplete.list.fire("filter");
            }
            else {
                autocomplete.list.filter(term, autocomplete.skipFilter);
                term && !autocomplete.list.collection.count && !autocomplete.skipFilter && !autocomplete.options.emptyMessage ? autocomplete.hide() : autocomplete.show();
            }

            autocomplete.fire("filter", term);

            return autocomplete;
        }

        /** Disables the autocomplete. */
        autocomplete.disable = function () {
            autocomplete.disabled = true;

            return autocomplete;
        }

        /** Enables the autocomplete when disabled. */
        autocomplete.enable = function () {
            autocomplete.disabled = false;

            return autocomplete;
        }

        /** Removes the autocomplete elements and event listeners from the page. */
        autocomplete.destroy = function () {
            pca.remove(autocomplete.element);

            //stop listening to page events
            pca.ignore(document, "click", documentClicked);
            pca.ignore(window, "resize", windowResized);

            for (var i = 0; i < autocomplete.fieldListeners.length; i++)
                pca.ignore(autocomplete.fieldListeners[i].field, autocomplete.fieldListeners[i].event, autocomplete.fieldListeners[i].action);
        }

        autocomplete.element.appendChild(autocomplete.header.element);
        autocomplete.element.appendChild(autocomplete.list.element);
        autocomplete.element.appendChild(autocomplete.footer.element);
        autocomplete.header.init();
        autocomplete.footer.init();

        if (fields) autocomplete.load(fields);
        if (autocomplete.options.width) autocomplete.setWidth(autocomplete.options.width);
        if (autocomplete.options.height) autocomplete.setHeight(autocomplete.options.height);
        if (autocomplete.options.className) pca.addClass(autocomplete.element, autocomplete.options.className);

        if (!autocomplete.field)
            autocomplete.hide();

        return autocomplete;
    }

    /**
    * Modal window options.
    * @typedef {Object} pca.Modal.Options
    * @property {string} [title] - The title text for the window.
    * @property {string} [titleStyle] - The CSS text to apply to the title.
    */

    /** Creates a modal popup window.
    * @memberof pca
    * @constructor
    * @mixes Eventable
    * @param {pca.Modal.Options} [options] - Additional options to apply to the modal window. */
    pca.Modal = function (options) {
        /** @lends pca.Modal.prototype */
        var modal = new pca.Eventable(this);

        modal.options = options || {};

        /** The parent HTML element of the modal window */
        modal.element = pca.create("div", { className: "pcamodal" });
        modal.border = pca.create("div", { className: "pcaborder" });
        modal.frame = pca.create("div", { className: "pcaframe" });
        modal.content = pca.create("div", { className: "pcacontent pcatext" });
        modal.mask = pca.create("div", { className: "pcafullscreen pcamask" });
        modal.form = [];

        /** Header element. */
        modal.header = {
            element: pca.create("div", { className: "pcaheader" }),
            headerText: pca.create("div", { className: "pcatitle" }, modal.options.titleStyle || ""),

            init: function () {
                this.setText(modal.options.title || "");
            },

            setContent: function (content) {
                content = content || "";
                typeof content == 'string' ? this.element.innerHTML = content : this.element.appendChild(content);
                modal.fire("header");
                return this;
            },

            setText: function (text) {
                text = text || "";
                this.element.appendChild(this.headerText);
                typeof text == 'string' ? this.headerText.innerHTML = text : this.headerText.appendChild(text);
                modal.fire("header");
                return this;
            },

            show: function () {
                this.element.style.display = "";
                modal.fire("header");
                return this;
            },

            hide: function () {
                this.element.style.display = "none";
                modal.fire("header");
                return this;
            }
        }

        /** Footer element */
        modal.footer = {
            element: pca.create("div", { className: "pcafooter" }),

            setContent: function (content) {
                content = content || "";
                typeof content == 'string' ? this.element.innerHTML = content : this.element.appendChild(content);
                modal.fire("footer");
                return this;
            },

            show: function () {
                this.element.style.display = "";
                modal.fire("header");
                return this;
            },

            hide: function () {
                this.element.style.display = "none";
                modal.fire("header");
                return this;
            }
        }

        /** Shortcut to set the content of the modal title and show it.
        * @param {string|HTMLElement} content - The content to set in the title. */
        modal.setTitle = function (content) {
            modal.header.setText(content).show();
        }

        /** Sets the content of the modal window.
        * @param {string|HTMLElement} content - The content to set in the body of the modal.
        * @fires change */
        modal.setContent = function (content) {
            typeof content == 'string' ? modal.content.innerHTML = content : modal.content.appendChild(content);
            modal.fire("change");

            return modal;
        }

        //sets defaults for a field
        function defaultProperties(properties) {
            properties = properties || {};
            properties.type = properties.type || "text";
            return properties;
        }

        /** Adds a new field to the modal content.
        * @param {string} labelText - The text for the field label.
        * @param {Object} [properties] - Properties to set on the input field.
        * @param {Object} [properties.tag=input] - Changes the type of element to create.
        * @param {HTMLElement} The HTML field created. */
        modal.addField = function (labelText, properties) {
            properties = defaultProperties(properties);

            var row = pca.create("div", { className: "pcainputrow" }),
                input = pca.create(properties.tag || "input", properties),
                label = pca.create("label", { htmlFor: input.id || "", innerHTML: labelText || "" });

            row.appendChild(label);
            row.appendChild(input);
            modal.setContent(row);

            modal.form.push({ label: labelText, element: input });

            return input;
        }

        /** Adds two half width fields to the modal content.
        * @param {string} labelText - The text for the field label.
        * @param {Object} [firstProperties] - Properties to set on the first (left) input field.
        * @param {Object} [firstProperties.tag] - Changes the type of element to create.
        * @param {Object} [secondProperties] - Properties to set on the second (right) input field.
        * @param {Object} [secondProperties.tag] - Changes the type of element to create.
        * @return {Array.<HTMLElement>} The two HTML fields created. */
        modal.addHalfFields = function (labelText, firstProperties, secondProperties) {
            firstProperties = defaultProperties(firstProperties);
            secondProperties = defaultProperties(secondProperties);

            var row = pca.create("div", { className: "pcainputrow" }),
                firstInput = pca.create(firstProperties.tag || "input", firstProperties),
                secondInput = pca.create(secondProperties.tag || "input", secondProperties),
                label = pca.create("label", { htmlFor: firstInput.id || "", innerHTML: labelText || "" });

            pca.addClass(firstInput, "pcahalf");
            pca.addClass(secondInput, "pcahalf");

            row.appendChild(label);
            row.appendChild(firstInput);
            row.appendChild(secondInput);
            modal.setContent(row);

            modal.form.push({ label: "First " + labelText, element: firstInput });
            modal.form.push({ label: "Second " + labelText, element: secondInput });

            return [firstInput, secondInput];
        }

        /** Adds a button to the modal footer.
        * @param {string} labelText - The text for the field label.
        * @param {function} callback - A callback function which handles the button click.
        * @param {boolean} floatRight - Sets float:right on the button. Ignored by versions of IE older than 8.
        * @returns {HTMLElement} The HTML input element created. */
        modal.addButton = function (labelText, callback, floatRight) {
            var button = pca.create("input", { type: "button", value: labelText, className: "pcabutton" });

            callback = callback || function () { };

            //call the callback function with the form details
            function click() {
                var details = {};

                for (var i = 0; i < modal.form.length; i++)
                    details[modal.form[i].label] = pca.getValue(modal.form[i].element);

                callback(details);
            }

            if (floatRight && !(document.documentMode && document.documentMode <= 7))
                button.style.cssFloat = "right";

            pca.listen(button, "click", click);
            modal.footer.setContent(button);

            return button;
        }

        /** Centres the modal in the browser window */
        modal.centre = function () {
            var modalSize = pca.getSize(modal.element);

            modal.element.style.marginTop = -(modalSize.height / 2) + "px";
            modal.element.style.marginLeft = -(modalSize.width / 2) + "px";

            return modal;
        }

        /** Shows the modal window.
        * @fires show */
        modal.show = function () {
            //not supported in quirks mode or ie6 currently
            if (!(document.documentMode && document.documentMode <= 5) && !(/\bMSIE\s6/).test(pca.agent)) {
                modal.element.style.display = "";
                modal.mask.style.display = "";
                modal.centre();
                modal.fire("show");
            }

            return modal;
        }

        /** Hides the modal window.
        * @fires hide */
        modal.hide = function () {
            modal.element.style.display = "none";
            modal.mask.style.display = "none";
            modal.fire("hide");

            return modal;
        }

        /** Clears the content and buttons of the modal window.
        * @fires clear */
        modal.clear = function () {
            while (modal.content.childNodes.length)
                modal.content.removeChild(modal.content.childNodes[0]);

            while (modal.footer.element.childNodes.length)
                modal.footer.element.removeChild(modal.footer.element.childNodes[0]);

            modal.form = [];
            modal.fire("clear");

            return modal;
        }

        pca.listen(modal.mask, "click", modal.hide);

        modal.element.appendChild(modal.border);
        modal.element.appendChild(modal.frame);
        modal.frame.appendChild(modal.header.element);
        modal.frame.appendChild(modal.content);
        modal.frame.appendChild(modal.footer.element);
        modal.header.init();

        pca.append(modal.mask);
        pca.append(modal.element);

        modal.hide();

        return modal;
    }

    /** Creates a helpful tooltip when hovering over an element.
    * @memberof pca
    * @constructor
    * @mixes Eventable
    * @param {HTMLElement} element - The element to bind to.
    * @param {string} message - The text to show. */
    pca.Tooltip = function (element, message) {
        /** @lends pca.Tooltip.prototype */
        var tooltip = new pca.Eventable(this);

        /** The parent HTML element for the tooltip. */
        tooltip.element = pca.create("div", { className: "pcatooltip" });
        tooltip.background = pca.create("div", { className: "pcabackground" });
        tooltip.message = pca.create("div", { className: "pcamessage", innerText: message });

        /** Shows the tooltip.
        * @fires show */
        tooltip.show = function () {
            tooltip.element.style.display = "";
            tooltip.position();
            tooltip.fire("show");
            return tooltip;
        }

        /** Hides the tooltip.
        * @fires hide */
        tooltip.hide = function () {
            tooltip.element.style.display = "none";
            tooltip.fire("hide");
            return tooltip;
        }

        /** Sets the text for the tooltip.
        * @param {string} text - The text to set. */
        tooltip.setMessage = function (text) {
            pca.setValue(tooltip.message, text);
        }

        /** Positions the tooltip centrally above the element. */
        tooltip.position = function () {
            var parentPosition = pca.getPosition(element),
                parentSize = pca.getSize(element),
                topParent = pca.getTopOffsetParent(element),
                messageSize = pca.getSize(tooltip.message),
                windowSize = pca.getSize(window),
                windowScroll = pca.getScroll(window),
                fixed = !pca.isPage(topParent);

            var top = (parentPosition.top - messageSize.height - 5) + (fixed ? windowScroll.top : 0),
                left = (parentPosition.left + (parentSize.width / 2) - (messageSize.width / 2)) + (fixed ? windowScroll.left : 0);

            top = Math.min(top, (windowSize.height + windowScroll.top) - messageSize.height);
            top = Math.max(top, 0);

            left = Math.min(left, (windowSize.width + windowScroll.left) - messageSize.width);
            left = Math.max(left, 0);

            tooltip.element.style.top = top + "px";
            tooltip.element.style.left = left + "px";
        }

        if (element = pca.getElement(element)) {
            pca.listen(element, "mouseover", tooltip.show);
            pca.listen(element, "mouseout", tooltip.hide);
        }

        tooltip.element.appendChild(tooltip.background);
        tooltip.element.appendChild(tooltip.message);
        tooltip.setMessage(message);

        pca.append(tooltip.element);

        tooltip.hide();

        return tooltip;
    }

    /** Formats a line by replacing tags in the form {Property} with the corresponding property value or method result from the item object.
    * @memberof pca
    * @param {Object} item - An object to format the parameters of.
    * @param {string} format - A template format string.
    * @returns {string} The formatted text.
    * @example pca.formatLine({"line1": "Line One", "line2": "Line Two"}, "{line1}{, {line2}}");
    * @returns "Line One, Line Two" */
    pca.formatLine = function (item, format) {
        function property(c, t) {
            var val = (typeof item[c] == "function" ? item[c]() : item[c]) || "";
            return t === "!" ? val.toUpperCase() : val;
        }

        //replace properties with conditional formatting e.g. hello{ {name}!}
        format = format.replace(/\{([^\}]*\{(\w+)([^\}\w])?\}[^\}]*)\}/g, function (m, f, c, t) {
            var val = property(c, t);
            return val ? f.replace(/\{(\w+)([^\}\w])?\}/g, val) : "";
        });

        return format.replace(/\{(\w+)([^\}\w])?\}/g, function (m, c, t) { return property(c, t); });
    }

    /** Formats a line into a simplified tag for filtering.
    * @memberof pca
    * @param {string} line - The text to format.
    * @returns {string} The formatted tag. */
    pca.formatTag = function (line) {
        return line ? pca.replaceList(pca.replaceList(pca.removeHtml(line.toUpperCase()), pca.diacritics), pca.synonyms) : "";
    }

    /** Formats a line into a tag and then separate words.
    * @memberof pca
    * @param {string} line - The text to format.
    * @returns {Array.<string>} The formatted tag words. */
    pca.formatTagWords = function (line) {
        return pca.formatTag(line).split(" ");
    }

    /** Formats camaelcase text by inserting a separator string.
    * @memberof pca
    * @param {string} line - The text to format.
    * @param {string} [separator= ] - A string used to join the parts.
    * @returns {string} The formatted text. */
    pca.formatCamel = function (line, separator) {
        separator = separator || " ";

        function separate(m, b, a) {
            return b + separator + a;
        }

        line = line.replace(/([a-z])([A-Z0-9])/g, separate); //before an upperase letter or number
        line = line.replace(/([0-9])([A-Z])/g, separate); //before an uppercase letter after a number
        line = line.replace(/([A-Z])([A-Z][a-z])/g, separate); //after multiple capital letters

        return line;
    }

    /** Performs all replacements in a list.
    * @memberof pca
    * @param {string} line - The text to format.
    * @param {Array.<Object>} list - The list of replacements.
    * @returns {string} The formatted text. */
    pca.replaceList = function (line, list) {
        for (var i = 0; i < list.length; i++)
            line = line.toString().replace(list[i].r, list[i].w);
        return line;
    }

    /** Removes HTML tags from a string.
    * @memberof pca
    * @param {string} line - The text to format.
    * @returns {string} The formatted text. */
    pca.removeHtml = function (line) {
        return line.replace(/<(?:.|\s)*?>+/g, "");
    }

    /** Converts a html string for display.
    * @memberof pca
    * @param {string} line - The text to format.
    * @returns {string} The formatted text. */
    pca.escapeHtml = function (line) {
        return pca.replaceList(line, pca.hypertext);
    }

    /** Returns only the valid characters for a DOM id.
    * @memberof pca
    * @param {string} line - The text to format.
    * @returns {string} The formatted text. */
    pca.validId = function (line) {
        return /[a-z0-9\-_:\.\[\]]+/gi.exec(line);
    }

    /** Removes unnecessary spaces.
    * @memberof pca
    * @param {string} line - The text to format.
    * @returns {string} The formatted text. */
    pca.trimSpaces = function (line) {
        return line.replace(/^\s+|\s(?=\s)|\s$/g, "");
    }

    /** Removes unnecessary duplicated characters.
    * @memberof pca
    * @param {string} line - The text to format.
    * @param {string} symbol - The text to remove duplicates of.
    * @returns {string} The formatted text. */
    pca.tidy = function (line, symbol) {
        symbol = symbol.replace("\\", "\\\\");
        var rx = new RegExp("^" + symbol + "+|" + symbol + "(?=" + symbol + ")|" + symbol + "$", "gi");
        return line.replace(rx, "");
    }

    /** Gets the first words from a string.
    * @memberof pca
    * @param {string} line - The text to format.
    * @returns {string} The text. */
    pca.getText = function (line) {
        return /[a-zA-Z][a-zA-Z\s]+[a-zA-Z]/.exec(line);
    }

    /** Gets the first number from a string.
    * @memberof pca
    * @param {string} line - The text to format.
    * @returns {string} The number. */
    pca.getNumber = function (line) {
        return /\d+/.exec(line);
    }

    /** parse a JSON string if it's safe and return an object. This has a preference for the native parser.
    * @memberof pca
    * @param {string} text - The JSON text to parse.
    * @returns {Object} The object based on the JSON. */
    pca.parseJSON = function (text) {
        if (text && (/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
                .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
                .replace(/(?:^|:|,)(?:\s*\[)+/g, ''))))
            return (typeof JSON != 'undefined' ? JSON.parse(text) : eval(text));

        return {};
    }

    /** Parse a formatted JSON date.
    * @memberof pca
    * @param {string|number} text - The date in milliseconds.
    * @returns {Date} The date object. */
    pca.parseJSONDate = function (text) {
        return new Date(parseInt(pca.getNumber(text)));
    }

    /** Checks if a string contains a word.
    * @memberof pca
    * @param {string} text - The text to test.
    * @param {string} word - The word to test for.
    * @returns {boolean} True if the text contains the word. */
    pca.containsWord = function (text, word) {
        var rx = new RegExp("\\b" + word + "\\b", "gi");
        return rx.test(text);
    }

    /** Removes a word from a string.
    * @memberof pca
    * @param {string} text - The text to format.
    * @param {string} word - The word to replace.
    * @returns {string} The text with the word replaced. */
    pca.removeWord = function (text, word) {
        var rx = new RegExp("\\s?\\b" + word + "\\b", "gi");
        return text.replace(rx, "");
    }

    /** Merges one objects properties into another
    * @memberof pca
    * @param {Object} source - The object to take properties from.
    * @param {Object} destination - The object to add properties to.
    * @returns {Object} The destination object. */
    pca.merge = function (source, destination) {
        for (var i in source)
            if (!destination[i]) destination[i] = source[i];

        return destination;
    }

    /** Find a DOM element by id, name, or partial id.
    * @memberof pca
    * @param {string|HTMLElement} reference - The id, name or element to find.
    * @param {string|HTMLElement} [base=document] - The id, name or parent element to search from.
    * @returns {?HTMLElement} The first element found or null. */
    pca.getElement = function (reference, base) {
        if (!reference)
            return null;

        if (typeof reference.nodeType == "number") //Is a HTML DOM Node
            return reference;

        if (typeof reference == "string") {
            base = pca.getElement(base) || document;

            var byId = base.getElementById ? base.getElementById(reference) : null;
            if (byId) return byId;

            var byName = base.getElementsByName ? base.getElementsByName(reference) : null;
            if (byName.length) return byName[0];
        }

        //try a regex match if allowed
        return pca.fuzzyMatch ? pca.getElementByRegex(reference, base) : null;
    }

    /** Retrieves a DOM element using RegEx matching on the id.
    * @memberof pca
    * @param {Regex|string} regex - The RegExp to test search element id for.
    * @param {string|HTMLElement} base - The id, name or parent element to search from.
    * @returns {HTMLElement} The first element found or null. */
    pca.getElementByRegex = function (regex, base) {
        //compile and check regex strings
        if (typeof regex == 'string') {
            try { regex = new RegExp(regex); }
            catch (e) { return null; }
        }

        //make sure its a RegExp
        if (regex && typeof regex == "object" && regex.constructor === RegExp) {
            base = pca.getElement(base) || document;

            for (var t = 0; t < pca.fuzzyTags.length; t++) {
                var elements = base.getElementsByTagName(pca.fuzzyTags[t]);

                for (var i = 0; i < elements.length; i++) {
                    var elem = elements[i];
                    if (elem.id && regex.test(elem.id))
                        return elem;
                }
            }
        }

        return null;
    }

    /** Get the value of a DOM element.
    * @memberof pca
    * @param {string|HTMLElement} element - The element to get the value of.
    * @returns {string} The value of the element. */
    pca.getValue = function (element) {
        if (element = pca.getElement(element)) {
            if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
                if (element.type === "checkbox")
                    return element.checked;
                else if (element.type === "radio") {
                    var group = document.getElementsByName(element.name);
                    for (var r = 0; r < group.length; r++) {
                        if (group[r].checked)
                            return group[r].value;
                    }
                }
                else
                    return element.value;
            }
            if (element.tagName === "SELECT") {
                if (element.selectedIndex < 0) return "";
                var selectedOption = element.options[element.selectedIndex];
                return selectedOption.value || selectedOption.text || "";
            }
            if (element.tagName === "DIV" || element.tagName === "SPAN" || element.tagName === "TD" || element.tagName === "LABEL")
                return element.innerHTML;
        }

        return "";
    }

    /** Set the value of a DOM element.
    * @memberof pca
    * @param {string|HTMLElement} element - The element to set the value of.
    * @param {*} value - The value to set. */
    pca.setValue = function (element, value) {
        if ((value || value === "") && (element = pca.getElement(element))) {
            var valueText = value.toString(),
                valueTextMatch = pca.formatTag(valueText);

            if (element.tagName === "INPUT") {
                if (element.type === "checkbox")
                    element.checked = ((typeof (value) == "boolean" && value) || valueTextMatch === "TRUE");
                else if (element.type === "radio") {
                    var group = document.getElementsByName(element.name);
                    for (var r = 0; r < group.length; r++) {
                        if (pca.formatTag(group[r].value) === valueTextMatch) {
                            group[r].checked = true;
                            return;
                        }
                    }
                }
                else
                    element.value = pca.tidy(valueText.replace(/\\n|\n/gi, ", "), ", ");
            }
            else if (element.tagName === "TEXTAREA")
                element.value = valueText.replace(/\\n|\n/gi, "\n");
            else if (element.tagName === "SELECT") {
                for (var s = 0; s < element.options.length; s++) {
                    if (pca.formatTag(element.options[s].value) === valueTextMatch || pca.formatTag(element.options[s].text) === valueTextMatch) {
                        element.selectedIndex = s;
                        return;
                    }
                }
            }
            else if (element.tagName === "DIV" || element.tagName === "SPAN" || element.tagName === "TD" || element.tagName === "LABEL")
                element.innerHTML = valueText.replace(/\\n|\n/gi, "<br/>");
        }
    }

    /** Returns true if the element is a text input field.
    * @memberof pca
    * @param {string|HTMLElement} element - The element to check.
    * @returns {boolean} True if the element supports text input. */
    pca.inputField = function (element) {
        if (element = pca.getElement(element))
            return (element.tagName && (element.tagName === "INPUT" || element.tagName === "TEXTAREA") && element.type && (element.type === "text" || element.type === "search" || element.type === "email" || element.type === "textarea"));

        return false;
    }

    /** Returns true if the element is a select list field.
    * @memberof pca
    * @param {string|HTMLElement} element - The element to check.
    * @returns {boolean} True if the element in a select list field. */
    pca.selectList = function (element) {
        if (element = pca.getElement(element))
            return (element.tagName && element.tagName === "SELECT");

        return false;
    }

    /** Returns the current selected item of a select list field.
    * @memberof pca
    * @param {string|HTMLElement} element - The element to check.
    * @returns {HTMLOptionElement} The current selected item. */
    pca.getSelectedItem = function (element) {
        if ((element = pca.getElement(element)) && element.tagName === "SELECT" && element.selectedIndex >= 0)
            return element.options[element.selectedIndex];

        return null;
    }

    /** Returns true if the element is a checkbox.
    * @memberof pca
    * @param {string|HTMLElement} element - The element to check.
    * @returns {boolean} True if the element in a checkbox. */
    pca.checkBox = function (element) {
        if (element = pca.getElement(element))
            return (element.tagName && element.tagName === "INPUT" && element.type && element.type === "checkbox");

        return false;
    }

    /** Shortcut to clear the value of a DOM element.
    * @memberof pca
    * @param {string|HTMLElement} element - The element to clear. */
    pca.clear = function (element) {
        pca.setValue(element, "");
        return pca;
    }

    /** Get the position of a DOM element.
    * @memberof pca
    * @param {string|HTMLElement} element - The element to get the position of.
    * @returns {Object} The top and left of the position. */
    pca.getPosition = function (element) {
        var empty = { left: 0, top: 0 };

        if (element = pca.getElement(element)) {
            if (!element.tagName) return empty;

            if (typeof element.getBoundingClientRect != 'undefined') {
                var bb = element.getBoundingClientRect(),
                    fixed = !pca.isPage(pca.getTopOffsetParent(element)),
                    pageScroll = pca.getScroll(window),
                    parentScroll = pca.getParentScroll(element);
                return { left: bb.left + parentScroll.left + (fixed ? 0 : pageScroll.left), top: bb.top + parentScroll.top + (fixed ? 0 : pageScroll.top) };
            }

            var x = 0, y = 0;

            do {
                x += element.offsetLeft;
                y += element.offsetTop;
            } while (element = element.offsetParent);

            return { left: x, top: y };
        }

        return empty;
    }

    //Is the element the document or window.
    pca.isPage = function(element) {
        return element === window || element === document || element === document.body;
    }

    /** Gets the scroll values from an elements top offset parent.
    * @memberof pca
    * @param {HTMLElement} element - The element to get the scroll of.
    * @returns {Object} The top and left of the scroll. */
    pca.getScroll = function (element) {
        return {
            left: parseInt(element.scrollX || element.scrollLeft, 10) || (pca.isPage(element) ? parseInt(document.documentElement.scrollLeft) || 0 : 0),
            top: parseInt(element.scrollY || element.scrollTop, 10) || (pca.isPage(element) ? parseInt(document.documentElement.scrollTop) || 0 : 0)
        };
    }

    /** Get the height and width of a DOM element.
    * @memberof pca
    * @param {HTMLElement} element - The element to get the size of.
    * @returns {Object} The height and width of the element. */
    pca.getSize = function (element) {
        return {
            height: (element.offsetHeight || element.innerHeight || (pca.isPage(element) ? (document.documentElement.clientHeight || document.body.clientHeight) : 0)),
            width: (element.offsetWidth || element.innerWidth || (pca.isPage(element) ? (document.documentElement.clientWidth || document.body.clientWidth) : 0))
        };
    }

    /** Get the scroll value for all parent elements.
    * @memberof pca
    * @param {HTMLElement|string} element - The child element to begin from.
    * @returns {Object} The top and left of the scroll. */
    pca.getParentScroll = function (element) {
        var empty = { left: 0, top: 0 };

        if (element = pca.getElement(element)) {
            if (!element.tagName) return empty;
            if (!(element = element.parentNode)) return empty;

            var x = 0, y = 0;

            do {
                if (pca.isPage(element)) break;
                x += parseInt(element.scrollLeft) || 0;
                y += parseInt(element.scrollTop) || 0;
            } while (element = element.parentNode);

            return { left: x, top: y };
        }

        return empty;
    }

    /** Get the element which an element is positioned relative to.
    * @memberof pca
    * @param {HTMLElement} element - The child element to begin from.
    * @returns {HTMLElement} The element controlling the relative position. */
    pca.getTopOffsetParent = function (element) {
        while (element.offsetParent) {
            element = element.offsetParent;

            //fix for Firefox
            if (pca.getStyle(element, "position") === "fixed")
                break;
        }

        return element;
    }

    /** Gets the current value of a style property of an element.
    * @memberof pca
    * @param {HTMLElement} element - The element to get the style property of.
    * @param {string} property - The name of the style property to query.
    * @returns {string} The value of the style property. */
    pca.getStyle = function (element, property) {
        return ((window.getComputedStyle ? window.getComputedStyle(element) : element.currentStyle) || {})[property] || "";
    }

    /** Adds a CSS class to an element.
    * @memberof pca
    * @param {HTMLElement|string} element - The element to add the style class to.
    * @param {string} className - The name of the style class to add. */
    pca.addClass = function (element, className) {
        if (element = pca.getElement(element)) {
            if (!pca.containsWord(element.className || "", className))
                element.className += (element.className ? " " : "") + className;
        }
    }

    /** Removes a CSS class from an element.
    * @memberof pca
    * @param {HTMLElement|string} element - The element to remove the style class from.
    * @param {string} className - The name of the style class to remove. */
    pca.removeClass = function (element, className) {
        if (element = pca.getElement(element))
            element.className = pca.removeWord(element.className, className);
    }

    /** Sets an attribute of an element.
    * @memberof pca
    * @param {HTMLElement|string} element - The element to set the attribute of.
    * @param {string} attribute - The element attribute to set.
    * @param {Object} attribute - The value to set. */
    pca.setAttribute = function (element, attribute, value) {
        if (element = pca.getElement(element))
            element.setAttribute(attribute, value);
    }

    /** Sets multiple attributes of an element.
    * @memberof pca
    * @param {HTMLElement|string} element - The element to set the attributes of.
    * @param {Object} attributes - The element attributes and values to set. */
    pca.setAttributes = function (element, attributes) {
        if (element = pca.getElement(element)) {
            for (var i in attributes)
                element.setAttribute(i, attributes[i]);
        }
    }

    /** Applies fixes to a style sheet.
    * This will add them to the fixes list for pca.reapplyStyleFixes.
    * @memberof pca
    * @param {string} selectorText - The full CSS selector text for the rule as it appears in the style sheet.
    * @param {Object} fixes - An object with JavaScript style property name and value. */
    pca.applyStyleFixes = function (selectorText, fixes) {
        for (var s = 0; s < document.styleSheets.length; s++) {
            var sheet = document.styleSheets[s],
                rules = [];

            try {
                rules = sheet.rules || sheet.cssRules || []; //possible denial of access if script and css are hosted separately
            } catch (e) { };

            for (var r = 0; r < rules.length; r++) {
                var rule = rules[r];

                if (rule.selectorText.toLowerCase() === selectorText) {
                    for (var f in fixes)
                        rule.style[f] = fixes[f];
                }
            }
        }

        pca.styleFixes.push({ selectorText: selectorText, fixes: fixes });
    }

    /** Reapplies all fixes to style sheets added by pca.applyStyleFixes.
    * @memberof pca */
    pca.reapplyStyleFixes = function () {
        var fixesList = pca.styleFixes;

        pca.styleFixes = [];

        for (var i = 0; i < fixesList.length; i++)
            pca.applyStyleFixes(fixesList[i].selectorText, fixesList[i].fixes);
    }

    /** Creates a style sheet from cssText.
    * @memberof pca
    * @param {string} cssText - The CSS text for the body of the style sheet. */
    pca.createStyleSheet = function (cssText) {
        if (document.createStyleSheet)
            document.createStyleSheet().cssText = cssText;
        else
            document.head.appendChild(pca.create("style", { type: "text/css", innerHTML: cssText }));
    }

    /** Simple short function to create an element.
    * @memberof pca
    * @param {string} tag - The HTML tag for the element.
    * @param {Object} properties - The properties to set in JavaScript form.
    * @param {string} cssText - Any CSS to add the style property.
    * @returns {HTMLElement} The created element. */
    pca.create = function (tag, properties, cssText) {
        var elem = document.createElement(tag);
        for (var i in properties || {})
            elem[i] = properties[i];
        if (cssText) elem.style.cssText = cssText;
        return elem;
    }

    /** Adds an element to the pca container on the page.
    * If the container does not exist it is created.
    * @memberof pca
    * @param {HTMLElement} element - The element to add to the container. */
    pca.append = function (element) {
        if (!pca.container) {
            pca.container = pca.create("div", { className: "pca" });
            document.body.appendChild(pca.container);
        }

        pca.container.appendChild(element);
    }

    /** Removes an element from the container on the page.
    * @memberof pca
    * @param {HTMLElement} element - The element to remove from the container. */
    pca.remove = function (element) {
        if (element && element.parentNode && element.parentNode === pca.container)
            pca.container.removeChild(element);
    }

    /** Listens to an event with standard DOM event handling.
    * @memberof pca
    * @param {HTMLElement} target - The element to listen to.
    * @param {string} event - The name of the event to listen for, e.g. "click".
    * @param {pca.Eventable~eventHandler} action - The callback for this event.
    * @param {boolean} capture - Use event capturing. */
    pca.listen = function (target, event, action, capture) {
        if (window.addEventListener)
            target.addEventListener(event, action, capture);
        else
            target.attachEvent("on" + event, action);
    }

    /** Creates and fires a standard DOM event.
    * @memberof pca
    * @param {HTMLElement} target - The element to trigger the event for.
    * @param {string} event - The name of the event, e.g. "click".
    * @returns {boolean} False is the event was stopped by any of its handlers. */
    pca.fire = function (target, event) {
        if (document.createEvent) {
            var e = document.createEvent("HTMLEvents");
            e.initEvent(event, true, true);
            return !target.dispatchEvent(e);
        }
        else
            return target.fireEvent("on" + event, document.createEventObject());
    }

    /** Removes listeners for an event with standard DOM event handling.
    * @memberof pca
    * @param {HTMLElement} target - The element.
    * @param {string} event - The name of the event, e.g. "click".
    * @param {pca.Eventable~eventHandler} action - The callback to remove for this event. */
    pca.ignore = function (target, event, action) {
        if (window.removeEventListener)
            target.removeEventListener(event, action);
        else
            target.detachEvent("on" + event, action);
    }

    /** Stops other actions of an event.
    * @memberof pca
    * @param {Event} event - The event to stop. */
    pca.smash = function (event) {
        var e = event || window.event;
        e.stopPropagation ? e.stopPropagation() : e.cancelBubble = true;
        e.preventDefault ? e.preventDefault() : e.returnValue = false;
    }

    /** Debug messages to the console.
    * @memberof pca
    * @param {string} message - The debug message text. */
    pca.debug = function (message) {
        if (typeof console != "undefined" && console.debug) console.debug(message);
    }

    /** Creates and returns are new debounced version of the passed function, which will postpone
    * its execution until after the 'delay' milliseconds have elapsed since this last time the function was
    * invoked. (-- PORT FROM underscore.js with some tweaks to support IE8 events--)
    * @memberof pca
    * @param {function} func - The funcion to call when the timeout has elapsed.
    * @param {integer} wait - The number of milliseconds to wait between calling the function.
    * @param {integer} immediate - An ovveride to call the function immediately. */
    pca.debounce = function (func, wait, immediate) {
        var timeout;
        return function () {
            var context = this;

            var args = arguments;

            if (arguments && arguments.length > 0) {
                args = [{ target: (arguments[0].target || arguments[0].srcElement) }];
            }

            var later = function () {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    };

    /** Returns whether or not a particular function is undefined.
    * @memberof pca
    * @param {function} fn - The function to check */
    pca.fnDefined = function (fn) {
        return typeof (fn) == "function";
    };

    /** Returns the label element for a given DOM element.
    * @memberof pca
    * @param {string} elementNameOrId - The name or ID of the DOM element. */
    pca.getLabel = function (elementNameOrId) {
        var labels = document.getElementsByTagName("LABEL");
        for (var i = 0; i < labels.length; i++) {
            if (labels[i].htmlFor !== "") {
                var elem = pca.getElement(labels[i].htmlFor);

                if (elem && (elem.name === elementNameOrId) || (elem.id === elementNameOrId))
                    return labels[i];
            }
        }
        return null;
    };

    //get some reference to an element that we can use later
    pca.getReferenceToElement = function (element) {
        return typeof element == "string" ? element : element ? (element.id || element.name || "") : "";
    }

    /**
     * Extends one object into another, any number of objects can be supplied
     * To create a new object supply an empty object as the first argument
     * @returns {} 
     */
    pca.extend = function() {
        for (var i = 1; i < arguments.length; i++)
            for (var key in arguments[i])
                if (arguments[i].hasOwnProperty(key))
                    arguments[0][key] = arguments[i][key];
        return arguments[0];
    };

    /**
     * Gets even inherited styles from element
     * @param {} element - The element to get the style for
     * @param {} styleProperty - The style property to be got, in the original css form
     * @returns {} 
     */
    pca.getStyle = function(element, styleProperty) {
        var camelize = function(str) {
            return str.replace(/\-(\w)/g, function(str, letter) {
                return letter.toUpperCase();
            });
        };

        if (element.currentStyle) {
            return element.currentStyle[camelize(styleProperty)];
        } else if (document.defaultView && document.defaultView.getComputedStyle) {
            return document.defaultView.getComputedStyle(element, null)
                .getPropertyValue(styleProperty);
        } else {
            return element.style[camelize(styleProperty)];
        }
    };

    checkDocumentLoad();
})(window);
(function () {
    //Phone format implementation.
})();var COMPILED = !0, goog = goog || {};
goog.global = this;
goog.isDef = function(a) {
  return void 0 !== a;
};
goog.exportPath_ = function(a, b, c) {
  a = a.split(".");
  c = c || goog.global;
  a[0] in c || !c.execScript || c.execScript("var " + a[0]);
  for (var d;a.length && (d = a.shift());) {
    !a.length && goog.isDef(b) ? c[d] = b : c = c[d] ? c[d] : c[d] = {};
  }
};
goog.define = function(a, b) {
  var c = b;
  COMPILED || (goog.global.CLOSURE_UNCOMPILED_DEFINES && Object.prototype.hasOwnProperty.call(goog.global.CLOSURE_UNCOMPILED_DEFINES, a) ? c = goog.global.CLOSURE_UNCOMPILED_DEFINES[a] : goog.global.CLOSURE_DEFINES && Object.prototype.hasOwnProperty.call(goog.global.CLOSURE_DEFINES, a) && (c = goog.global.CLOSURE_DEFINES[a]));
  goog.exportPath_(a, c);
};
goog.DEBUG = !0;
goog.LOCALE = "en";
goog.TRUSTED_SITE = !0;
goog.STRICT_MODE_COMPATIBLE = !1;
goog.DISALLOW_TEST_ONLY_CODE = COMPILED && !goog.DEBUG;
goog.ENABLE_CHROME_APP_SAFE_SCRIPT_LOADING = !1;
goog.provide = function(a) {
  if (!COMPILED && goog.isProvided_(a)) {
    throw Error('Namespace "' + a + '" already declared.');
  }
  goog.constructNamespace_(a);
};
goog.constructNamespace_ = function(a, b) {
  if (!COMPILED) {
    delete goog.implicitNamespaces_[a];
    for (var c = a;(c = c.substring(0, c.lastIndexOf("."))) && !goog.getObjectByName(c);) {
      goog.implicitNamespaces_[c] = !0;
    }
  }
  goog.exportPath_(a, b);
};
goog.VALID_MODULE_RE_ = /^[a-zA-Z_$][a-zA-Z0-9._$]*$/;
goog.module = function(a) {
  if (!goog.isString(a) || !a || -1 == a.search(goog.VALID_MODULE_RE_)) {
    throw Error("Invalid module identifier");
  }
  if (!goog.isInModuleLoader_()) {
    throw Error("Module " + a + " has been loaded incorrectly.");
  }
  if (goog.moduleLoaderState_.moduleName) {
    throw Error("goog.module may only be called once per module.");
  }
  goog.moduleLoaderState_.moduleName = a;
  if (!COMPILED) {
    if (goog.isProvided_(a)) {
      throw Error('Namespace "' + a + '" already declared.');
    }
    delete goog.implicitNamespaces_[a];
  }
};
goog.module.get = function(a) {
  return goog.module.getInternal_(a);
};
goog.module.getInternal_ = function(a) {
  if (!COMPILED) {
    return goog.isProvided_(a) ? a in goog.loadedModules_ ? goog.loadedModules_[a] : goog.getObjectByName(a) : null;
  }
};
goog.moduleLoaderState_ = null;
goog.isInModuleLoader_ = function() {
  return null != goog.moduleLoaderState_;
};
goog.module.declareLegacyNamespace = function() {
  if (!COMPILED && !goog.isInModuleLoader_()) {
    throw Error("goog.module.declareLegacyNamespace must be called from within a goog.module");
  }
  if (!COMPILED && !goog.moduleLoaderState_.moduleName) {
    throw Error("goog.module must be called prior to goog.module.declareLegacyNamespace.");
  }
  goog.moduleLoaderState_.declareLegacyNamespace = !0;
};
goog.setTestOnly = function(a) {
  if (goog.DISALLOW_TEST_ONLY_CODE) {
    throw a = a || "", Error("Importing test-only code into non-debug environment" + (a ? ": " + a : "."));
  }
};
goog.forwardDeclare = function(a) {
};
COMPILED || (goog.isProvided_ = function(a) {
  return a in goog.loadedModules_ || !goog.implicitNamespaces_[a] && goog.isDefAndNotNull(goog.getObjectByName(a));
}, goog.implicitNamespaces_ = {"goog.module":!0});
goog.getObjectByName = function(a, b) {
  for (var c = a.split("."), d = b || goog.global, e;e = c.shift();) {
    if (goog.isDefAndNotNull(d[e])) {
      d = d[e];
    } else {
      return null;
    }
  }
  return d;
};
goog.globalize = function(a, b) {
  var c = b || goog.global, d;
  for (d in a) {
    c[d] = a[d];
  }
};
goog.addDependency = function(a, b, c, d) {
  if (goog.DEPENDENCIES_ENABLED) {
    var e;
    a = a.replace(/\\/g, "/");
    for (var f = goog.dependencies_, g = 0;e = b[g];g++) {
      f.nameToPath[e] = a, f.pathIsModule[a] = !!d;
    }
    for (d = 0;b = c[d];d++) {
      a in f.requires || (f.requires[a] = {}), f.requires[a][b] = !0;
    }
  }
};
goog.ENABLE_DEBUG_LOADER = !0;
goog.logToConsole_ = function(a) {
  goog.global.console && goog.global.console.error(a);
};
goog.require = function(a) {
  if (!COMPILED) {
    goog.ENABLE_DEBUG_LOADER && goog.IS_OLD_IE_ && goog.maybeProcessDeferredDep_(a);
    if (goog.isProvided_(a)) {
      return goog.isInModuleLoader_() ? goog.module.getInternal_(a) : null;
    }
    if (goog.ENABLE_DEBUG_LOADER) {
      var b = goog.getPathFromDeps_(a);
      if (b) {
        return goog.writeScripts_(b), null;
      }
    }
    a = "goog.require could not find: " + a;
    goog.logToConsole_(a);
    throw Error(a);
  }
};
goog.basePath = "";
goog.nullFunction = function() {
};
goog.abstractMethod = function() {
  throw Error("unimplemented abstract method");
};
goog.addSingletonGetter = function(a) {
  a.getInstance = function() {
    if (a.instance_) {
      return a.instance_;
    }
    goog.DEBUG && (goog.instantiatedSingletons_[goog.instantiatedSingletons_.length] = a);
    return a.instance_ = new a;
  };
};
goog.instantiatedSingletons_ = [];
goog.LOAD_MODULE_USING_EVAL = !0;
goog.SEAL_MODULE_EXPORTS = goog.DEBUG;
goog.loadedModules_ = {};
goog.DEPENDENCIES_ENABLED = !COMPILED && goog.ENABLE_DEBUG_LOADER;
goog.DEPENDENCIES_ENABLED && (goog.dependencies_ = {pathIsModule:{}, nameToPath:{}, requires:{}, visited:{}, written:{}, deferred:{}}, goog.inHtmlDocument_ = function() {
  var a = goog.global.document;
  return null != a && "write" in a;
}, goog.findBasePath_ = function() {
  if (goog.isDef(goog.global.CLOSURE_BASE_PATH)) {
    goog.basePath = goog.global.CLOSURE_BASE_PATH;
  } else {
    if (goog.inHtmlDocument_()) {
      for (var a = goog.global.document.getElementsByTagName("SCRIPT"), b = a.length - 1;0 <= b;--b) {
        var c = a[b].src, d = c.lastIndexOf("?"), d = -1 == d ? c.length : d;
        if ("base.js" == c.substr(d - 7, 7)) {
          goog.basePath = c.substr(0, d - 7);
          break;
        }
      }
    }
  }
}, goog.importScript_ = function(a, b) {
  (goog.global.CLOSURE_IMPORT_SCRIPT || goog.writeScriptTag_)(a, b) && (goog.dependencies_.written[a] = !0);
}, goog.IS_OLD_IE_ = !(goog.global.atob || !goog.global.document || !goog.global.document.all), goog.importModule_ = function(a) {
  goog.importScript_("", 'goog.retrieveAndExecModule_("' + a + '");') && (goog.dependencies_.written[a] = !0);
}, goog.queuedModules_ = [], goog.wrapModule_ = function(a, b) {
  return goog.LOAD_MODULE_USING_EVAL && goog.isDef(goog.global.JSON) ? "goog.loadModule(" + goog.global.JSON.stringify(b + "\n//# sourceURL=" + a + "\n") + ");" : 'goog.loadModule(function(exports) {"use strict";' + b + "\n;return exports});\n//# sourceURL=" + a + "\n";
}, goog.loadQueuedModules_ = function() {
  var a = goog.queuedModules_.length;
  if (0 < a) {
    var b = goog.queuedModules_;
    goog.queuedModules_ = [];
    for (var c = 0;c < a;c++) {
      goog.maybeProcessDeferredPath_(b[c]);
    }
  }
}, goog.maybeProcessDeferredDep_ = function(a) {
  goog.isDeferredModule_(a) && goog.allDepsAreAvailable_(a) && (a = goog.getPathFromDeps_(a), goog.maybeProcessDeferredPath_(goog.basePath + a));
}, goog.isDeferredModule_ = function(a) {
  return (a = goog.getPathFromDeps_(a)) && goog.dependencies_.pathIsModule[a] ? goog.basePath + a in goog.dependencies_.deferred : !1;
}, goog.allDepsAreAvailable_ = function(a) {
  if ((a = goog.getPathFromDeps_(a)) && a in goog.dependencies_.requires) {
    for (var b in goog.dependencies_.requires[a]) {
      if (!goog.isProvided_(b) && !goog.isDeferredModule_(b)) {
        return !1;
      }
    }
  }
  return !0;
}, goog.maybeProcessDeferredPath_ = function(a) {
  if (a in goog.dependencies_.deferred) {
    var b = goog.dependencies_.deferred[a];
    delete goog.dependencies_.deferred[a];
    goog.globalEval(b);
  }
}, goog.loadModuleFromUrl = function(a) {
  goog.retrieveAndExecModule_(a);
}, goog.loadModule = function(a) {
  var b = goog.moduleLoaderState_;
  try {
    goog.moduleLoaderState_ = {moduleName:void 0, declareLegacyNamespace:!1};
    var c;
    if (goog.isFunction(a)) {
      c = a.call(goog.global, {});
    } else {
      if (goog.isString(a)) {
        c = goog.loadModuleFromSource_.call(goog.global, a);
      } else {
        throw Error("Invalid module definition");
      }
    }
    var d = goog.moduleLoaderState_.moduleName;
    if (!goog.isString(d) || !d) {
      throw Error('Invalid module name "' + d + '"');
    }
    goog.moduleLoaderState_.declareLegacyNamespace ? goog.constructNamespace_(d, c) : goog.SEAL_MODULE_EXPORTS && Object.seal && Object.seal(c);
    goog.loadedModules_[d] = c;
  } finally {
    goog.moduleLoaderState_ = b;
  }
}, goog.loadModuleFromSource_ = function(a) {
  eval(a);
  return {};
}, goog.writeScriptSrcNode_ = function(a) {
  goog.global.document.write('<script type="text/javascript" src="' + a + '">\x3c/script>');
}, goog.appendScriptSrcNode_ = function(a) {
  var b = goog.global.document, c = b.createElement("script");
  c.type = "text/javascript";
  c.src = a;
  c.defer = !1;
  c.async = !1;
  b.head.appendChild(c);
}, goog.writeScriptTag_ = function(a, b) {
  if (goog.inHtmlDocument_()) {
    var c = goog.global.document;
    if (!goog.ENABLE_CHROME_APP_SAFE_SCRIPT_LOADING && "complete" == c.readyState) {
      if (/\bdeps.js$/.test(a)) {
        return !1;
      }
      throw Error('Cannot write "' + a + '" after document load');
    }
    var d = goog.IS_OLD_IE_;
    void 0 === b ? d ? (d = " onreadystatechange='goog.onScriptLoad_(this, " + ++goog.lastNonModuleScriptIndex_ + ")' ", c.write('<script type="text/javascript" src="' + a + '"' + d + ">\x3c/script>")) : goog.ENABLE_CHROME_APP_SAFE_SCRIPT_LOADING ? goog.appendScriptSrcNode_(a) : goog.writeScriptSrcNode_(a) : c.write('<script type="text/javascript">' + b + "\x3c/script>");
    return !0;
  }
  return !1;
}, goog.lastNonModuleScriptIndex_ = 0, goog.onScriptLoad_ = function(a, b) {
  "complete" == a.readyState && goog.lastNonModuleScriptIndex_ == b && goog.loadQueuedModules_();
  return !0;
}, goog.writeScripts_ = function(a) {
  function b(a) {
    if (!(a in e.written || a in e.visited)) {
      e.visited[a] = !0;
      if (a in e.requires) {
        for (var f in e.requires[a]) {
          if (!goog.isProvided_(f)) {
            if (f in e.nameToPath) {
              b(e.nameToPath[f]);
            } else {
              throw Error("Undefined nameToPath for " + f);
            }
          }
        }
      }
      a in d || (d[a] = !0, c.push(a));
    }
  }
  var c = [], d = {}, e = goog.dependencies_;
  b(a);
  for (a = 0;a < c.length;a++) {
    var f = c[a];
    goog.dependencies_.written[f] = !0;
  }
  var g = goog.moduleLoaderState_;
  goog.moduleLoaderState_ = null;
  for (a = 0;a < c.length;a++) {
    if (f = c[a]) {
      e.pathIsModule[f] ? goog.importModule_(goog.basePath + f) : goog.importScript_(goog.basePath + f);
    } else {
      throw goog.moduleLoaderState_ = g, Error("Undefined script input");
    }
  }
  goog.moduleLoaderState_ = g;
}, goog.getPathFromDeps_ = function(a) {
  return a in goog.dependencies_.nameToPath ? goog.dependencies_.nameToPath[a] : null;
}, goog.findBasePath_(), goog.global.CLOSURE_NO_DEPS || goog.importScript_(goog.basePath + "deps.js"));
goog.normalizePath_ = function(a) {
  a = a.split("/");
  for (var b = 0;b < a.length;) {
    "." == a[b] ? a.splice(b, 1) : b && ".." == a[b] && a[b - 1] && ".." != a[b - 1] ? a.splice(--b, 2) : b++;
  }
  return a.join("/");
};
goog.loadFileSync_ = function(a) {
  if (goog.global.CLOSURE_LOAD_FILE_SYNC) {
    return goog.global.CLOSURE_LOAD_FILE_SYNC(a);
  }
  var b = new goog.global.XMLHttpRequest;
  b.open("get", a, !1);
  b.send();
  return b.responseText;
};
goog.retrieveAndExecModule_ = function(a) {
  if (!COMPILED) {
    var b = a;
    a = goog.normalizePath_(a);
    var c = goog.global.CLOSURE_IMPORT_SCRIPT || goog.writeScriptTag_, d = goog.loadFileSync_(a);
    if (null != d) {
      d = goog.wrapModule_(a, d), goog.IS_OLD_IE_ ? (goog.dependencies_.deferred[b] = d, goog.queuedModules_.push(b)) : c(a, d);
    } else {
      throw Error("load of " + a + "failed");
    }
  }
};
goog.typeOf = function(a) {
  var b = typeof a;
  if ("object" == b) {
    if (a) {
      if (a instanceof Array) {
        return "array";
      }
      if (a instanceof Object) {
        return b;
      }
      var c = Object.prototype.toString.call(a);
      if ("[object Window]" == c) {
        return "object";
      }
      if ("[object Array]" == c || "number" == typeof a.length && "undefined" != typeof a.splice && "undefined" != typeof a.propertyIsEnumerable && !a.propertyIsEnumerable("splice")) {
        return "array";
      }
      if ("[object Function]" == c || "undefined" != typeof a.call && "undefined" != typeof a.propertyIsEnumerable && !a.propertyIsEnumerable("call")) {
        return "function";
      }
    } else {
      return "null";
    }
  } else {
    if ("function" == b && "undefined" == typeof a.call) {
      return "object";
    }
  }
  return b;
};
goog.isNull = function(a) {
  return null === a;
};
goog.isDefAndNotNull = function(a) {
  return null != a;
};
goog.isArray = function(a) {
  return "array" == goog.typeOf(a);
};
goog.isArrayLike = function(a) {
  var b = goog.typeOf(a);
  return "array" == b || "object" == b && "number" == typeof a.length;
};
goog.isDateLike = function(a) {
  return goog.isObject(a) && "function" == typeof a.getFullYear;
};
goog.isString = function(a) {
  return "string" == typeof a;
};
goog.isBoolean = function(a) {
  return "boolean" == typeof a;
};
goog.isNumber = function(a) {
  return "number" == typeof a;
};
goog.isFunction = function(a) {
  return "function" == goog.typeOf(a);
};
goog.isObject = function(a) {
  var b = typeof a;
  return "object" == b && null != a || "function" == b;
};
goog.getUid = function(a) {
  return a[goog.UID_PROPERTY_] || (a[goog.UID_PROPERTY_] = ++goog.uidCounter_);
};
goog.hasUid = function(a) {
  return !!a[goog.UID_PROPERTY_];
};
goog.removeUid = function(a) {
  "removeAttribute" in a && a.removeAttribute(goog.UID_PROPERTY_);
  try {
    delete a[goog.UID_PROPERTY_];
  } catch (b) {
  }
};
goog.UID_PROPERTY_ = "closure_uid_" + (1E9 * Math.random() >>> 0);
goog.uidCounter_ = 0;
goog.getHashCode = goog.getUid;
goog.removeHashCode = goog.removeUid;
goog.cloneObject = function(a) {
  var b = goog.typeOf(a);
  if ("object" == b || "array" == b) {
    if (a.clone) {
      return a.clone();
    }
    var b = "array" == b ? [] : {}, c;
    for (c in a) {
      b[c] = goog.cloneObject(a[c]);
    }
    return b;
  }
  return a;
};
goog.bindNative_ = function(a, b, c) {
  return a.call.apply(a.bind, arguments);
};
goog.bindJs_ = function(a, b, c) {
  if (!a) {
    throw Error();
  }
  if (2 < arguments.length) {
    var d = Array.prototype.slice.call(arguments, 2);
    return function() {
      var c = Array.prototype.slice.call(arguments);
      Array.prototype.unshift.apply(c, d);
      return a.apply(b, c);
    };
  }
  return function() {
    return a.apply(b, arguments);
  };
};
goog.bind = function(a, b, c) {
  Function.prototype.bind && -1 != Function.prototype.bind.toString().indexOf("native code") ? goog.bind = goog.bindNative_ : goog.bind = goog.bindJs_;
  return goog.bind.apply(null, arguments);
};
goog.partial = function(a, b) {
  var c = Array.prototype.slice.call(arguments, 1);
  return function() {
    var b = c.slice();
    b.push.apply(b, arguments);
    return a.apply(this, b);
  };
};
goog.mixin = function(a, b) {
  for (var c in b) {
    a[c] = b[c];
  }
};
goog.now = goog.TRUSTED_SITE && Date.now || function() {
  return +new Date;
};
goog.globalEval = function(a) {
  if (goog.global.execScript) {
    goog.global.execScript(a, "JavaScript");
  } else {
    if (goog.global.eval) {
      if (null == goog.evalWorksForGlobals_) {
        if (goog.global.eval("var _evalTest_ = 1;"), "undefined" != typeof goog.global._evalTest_) {
          try {
            delete goog.global._evalTest_;
          } catch (d) {
          }
          goog.evalWorksForGlobals_ = !0;
        } else {
          goog.evalWorksForGlobals_ = !1;
        }
      }
      if (goog.evalWorksForGlobals_) {
        goog.global.eval(a);
      } else {
        var b = goog.global.document, c = b.createElement("SCRIPT");
        c.type = "text/javascript";
        c.defer = !1;
        c.appendChild(b.createTextNode(a));
        b.body.appendChild(c);
        b.body.removeChild(c);
      }
    } else {
      throw Error("goog.globalEval not available");
    }
  }
};
goog.evalWorksForGlobals_ = null;
goog.getCssName = function(a, b) {
  var c = function(a) {
    return goog.cssNameMapping_[a] || a;
  }, d = function(a) {
    a = a.split("-");
    for (var b = [], d = 0;d < a.length;d++) {
      b.push(c(a[d]));
    }
    return b.join("-");
  }, d = goog.cssNameMapping_ ? "BY_WHOLE" == goog.cssNameMappingStyle_ ? c : d : function(a) {
    return a;
  };
  return b ? a + "-" + d(b) : d(a);
};
goog.setCssNameMapping = function(a, b) {
  goog.cssNameMapping_ = a;
  goog.cssNameMappingStyle_ = b;
};
!COMPILED && goog.global.CLOSURE_CSS_NAME_MAPPING && (goog.cssNameMapping_ = goog.global.CLOSURE_CSS_NAME_MAPPING);
goog.getMsg = function(a, b) {
  b && (a = a.replace(/\{\$([^}]+)}/g, function(a, d) {
    return null != b && d in b ? b[d] : a;
  }));
  return a;
};
goog.getMsgWithFallback = function(a, b) {
  return a;
};
goog.exportSymbol = function(a, b, c) {
  goog.exportPath_(a, b, c);
};
goog.exportProperty = function(a, b, c) {
  a[b] = c;
};
goog.inherits = function(a, b) {
  function c() {
  }
  c.prototype = b.prototype;
  a.superClass_ = b.prototype;
  a.prototype = new c;
  a.prototype.constructor = a;
  a.base = function(a, c, f) {
    for (var g = Array(arguments.length - 2), h = 2;h < arguments.length;h++) {
      g[h - 2] = arguments[h];
    }
    return b.prototype[c].apply(a, g);
  };
};
goog.base = function(a, b, c) {
  var d = arguments.callee.caller;
  if (goog.STRICT_MODE_COMPATIBLE || goog.DEBUG && !d) {
    throw Error("arguments.caller not defined.  goog.base() cannot be used with strict mode code. See http://www.ecma-international.org/ecma-262/5.1/#sec-C");
  }
  if (d.superClass_) {
    for (var e = Array(arguments.length - 1), f = 1;f < arguments.length;f++) {
      e[f - 1] = arguments[f];
    }
    return d.superClass_.constructor.apply(a, e);
  }
  e = Array(arguments.length - 2);
  for (f = 2;f < arguments.length;f++) {
    e[f - 2] = arguments[f];
  }
  for (var f = !1, g = a.constructor;g;g = g.superClass_ && g.superClass_.constructor) {
    if (g.prototype[b] === d) {
      f = !0;
    } else {
      if (f) {
        return g.prototype[b].apply(a, e);
      }
    }
  }
  if (a[b] === d) {
    return a.constructor.prototype[b].apply(a, e);
  }
  throw Error("goog.base called from a method of one name to a method of a different name");
};
goog.scope = function(a) {
  a.call(goog.global);
};
COMPILED || (goog.global.COMPILED = COMPILED);
goog.defineClass = function(a, b) {
  var c = b.constructor, d = b.statics;
  c && c != Object.prototype.constructor || (c = function() {
    throw Error("cannot instantiate an interface (no constructor defined).");
  });
  c = goog.defineClass.createSealingConstructor_(c, a);
  a && goog.inherits(c, a);
  delete b.constructor;
  delete b.statics;
  goog.defineClass.applyProperties_(c.prototype, b);
  null != d && (d instanceof Function ? d(c) : goog.defineClass.applyProperties_(c, d));
  return c;
};
goog.defineClass.SEAL_CLASS_INSTANCES = goog.DEBUG;
goog.defineClass.createSealingConstructor_ = function(a, b) {
  if (goog.defineClass.SEAL_CLASS_INSTANCES && Object.seal instanceof Function) {
    if (b && b.prototype && b.prototype[goog.UNSEALABLE_CONSTRUCTOR_PROPERTY_]) {
      return a;
    }
    var c = function() {
      var b = a.apply(this, arguments) || this;
      b[goog.UID_PROPERTY_] = b[goog.UID_PROPERTY_];
      this.constructor === c && Object.seal(b);
      return b;
    };
    return c;
  }
  return a;
};
goog.defineClass.OBJECT_PROTOTYPE_FIELDS_ = "constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");
goog.defineClass.applyProperties_ = function(a, b) {
  for (var c in b) {
    Object.prototype.hasOwnProperty.call(b, c) && (a[c] = b[c]);
  }
  for (var d = 0;d < goog.defineClass.OBJECT_PROTOTYPE_FIELDS_.length;d++) {
    c = goog.defineClass.OBJECT_PROTOTYPE_FIELDS_[d], Object.prototype.hasOwnProperty.call(b, c) && (a[c] = b[c]);
  }
};
goog.tagUnsealableClass = function(a) {
  !COMPILED && goog.defineClass.SEAL_CLASS_INSTANCES && (a.prototype[goog.UNSEALABLE_CONSTRUCTOR_PROPERTY_] = !0);
};
goog.UNSEALABLE_CONSTRUCTOR_PROPERTY_ = "goog_defineClass_legacy_unsealable";
goog.string = {};
goog.string.StringBuffer = function(a, b) {
  null != a && this.append.apply(this, arguments);
};
goog.string.StringBuffer.prototype.buffer_ = "";
goog.string.StringBuffer.prototype.set = function(a) {
  this.buffer_ = "" + a;
};
goog.string.StringBuffer.prototype.append = function(a, b, c) {
  this.buffer_ += a;
  if (null != b) {
    for (var d = 1;d < arguments.length;d++) {
      this.buffer_ += arguments[d];
    }
  }
  return this;
};
goog.string.StringBuffer.prototype.clear = function() {
  this.buffer_ = "";
};
goog.string.StringBuffer.prototype.getLength = function() {
  return this.buffer_.length;
};
goog.string.StringBuffer.prototype.toString = function() {
  return this.buffer_;
};
goog.debug = {};
goog.debug.Error = function(a) {
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, goog.debug.Error);
  } else {
    var b = Error().stack;
    b && (this.stack = b);
  }
  a && (this.message = String(a));
  this.reportErrorToServer = !0;
};
goog.inherits(goog.debug.Error, Error);
goog.debug.Error.prototype.name = "CustomError";
goog.dom = {};
goog.dom.NodeType = {ELEMENT:1, ATTRIBUTE:2, TEXT:3, CDATA_SECTION:4, ENTITY_REFERENCE:5, ENTITY:6, PROCESSING_INSTRUCTION:7, COMMENT:8, DOCUMENT:9, DOCUMENT_TYPE:10, DOCUMENT_FRAGMENT:11, NOTATION:12};
goog.string.DETECT_DOUBLE_ESCAPING = !1;
goog.string.FORCE_NON_DOM_HTML_UNESCAPING = !1;
goog.string.Unicode = {NBSP:"\u00a0"};
goog.string.startsWith = function(a, b) {
  return 0 == a.lastIndexOf(b, 0);
};
goog.string.endsWith = function(a, b) {
  var c = a.length - b.length;
  return 0 <= c && a.indexOf(b, c) == c;
};
goog.string.caseInsensitiveStartsWith = function(a, b) {
  return 0 == goog.string.caseInsensitiveCompare(b, a.substr(0, b.length));
};
goog.string.caseInsensitiveEndsWith = function(a, b) {
  return 0 == goog.string.caseInsensitiveCompare(b, a.substr(a.length - b.length, b.length));
};
goog.string.caseInsensitiveEquals = function(a, b) {
  return a.toLowerCase() == b.toLowerCase();
};
goog.string.subs = function(a, b) {
  for (var c = a.split("%s"), d = "", e = Array.prototype.slice.call(arguments, 1);e.length && 1 < c.length;) {
    d += c.shift() + e.shift();
  }
  return d + c.join("%s");
};
goog.string.collapseWhitespace = function(a) {
  return a.replace(/[\s\xa0]+/g, " ").replace(/^\s+|\s+$/g, "");
};
goog.string.isEmptyOrWhitespace = function(a) {
  return /^[\s\xa0]*$/.test(a);
};
goog.string.isEmptyString = function(a) {
  return 0 == a.length;
};
goog.string.isEmpty = goog.string.isEmptyOrWhitespace;
goog.string.isEmptyOrWhitespaceSafe = function(a) {
  return goog.string.isEmptyOrWhitespace(goog.string.makeSafe(a));
};
goog.string.isEmptySafe = goog.string.isEmptyOrWhitespaceSafe;
goog.string.isBreakingWhitespace = function(a) {
  return !/[^\t\n\r ]/.test(a);
};
goog.string.isAlpha = function(a) {
  return !/[^a-zA-Z]/.test(a);
};
goog.string.isNumeric = function(a) {
  return !/[^0-9]/.test(a);
};
goog.string.isAlphaNumeric = function(a) {
  return !/[^a-zA-Z0-9]/.test(a);
};
goog.string.isSpace = function(a) {
  return " " == a;
};
goog.string.isUnicodeChar = function(a) {
  return 1 == a.length && " " <= a && "~" >= a || "\u0080" <= a && "\ufffd" >= a;
};
goog.string.stripNewlines = function(a) {
  return a.replace(/(\r\n|\r|\n)+/g, " ");
};
goog.string.canonicalizeNewlines = function(a) {
  return a.replace(/(\r\n|\r|\n)/g, "\n");
};
goog.string.normalizeWhitespace = function(a) {
  return a.replace(/\xa0|\s/g, " ");
};
goog.string.normalizeSpaces = function(a) {
  return a.replace(/\xa0|[ \t]+/g, " ");
};
goog.string.collapseBreakingSpaces = function(a) {
  return a.replace(/[\t\r\n ]+/g, " ").replace(/^[\t\r\n ]+|[\t\r\n ]+$/g, "");
};
goog.string.trim = goog.TRUSTED_SITE && String.prototype.trim ? function(a) {
  return a.trim();
} : function(a) {
  return a.replace(/^[\s\xa0]+|[\s\xa0]+$/g, "");
};
goog.string.trimLeft = function(a) {
  return a.replace(/^[\s\xa0]+/, "");
};
goog.string.trimRight = function(a) {
  return a.replace(/[\s\xa0]+$/, "");
};
goog.string.caseInsensitiveCompare = function(a, b) {
  var c = String(a).toLowerCase(), d = String(b).toLowerCase();
  return c < d ? -1 : c == d ? 0 : 1;
};
goog.string.numberAwareCompare_ = function(a, b, c) {
  if (a == b) {
    return 0;
  }
  if (!a) {
    return -1;
  }
  if (!b) {
    return 1;
  }
  for (var d = a.toLowerCase().match(c), e = b.toLowerCase().match(c), f = Math.min(d.length, e.length), g = 0;g < f;g++) {
    c = d[g];
    var h = e[g];
    if (c != h) {
      return a = parseInt(c, 10), !isNaN(a) && (b = parseInt(h, 10), !isNaN(b) && a - b) ? a - b : c < h ? -1 : 1;
    }
  }
  return d.length != e.length ? d.length - e.length : a < b ? -1 : 1;
};
goog.string.intAwareCompare = function(a, b) {
  return goog.string.numberAwareCompare_(a, b, /\d+|\D+/g);
};
goog.string.floatAwareCompare = function(a, b) {
  return goog.string.numberAwareCompare_(a, b, /\d+|\.\d+|\D+/g);
};
goog.string.numerateCompare = goog.string.floatAwareCompare;
goog.string.urlEncode = function(a) {
  return encodeURIComponent(String(a));
};
goog.string.urlDecode = function(a) {
  return decodeURIComponent(a.replace(/\+/g, " "));
};
goog.string.newLineToBr = function(a, b) {
  return a.replace(/(\r\n|\r|\n)/g, b ? "<br />" : "<br>");
};
goog.string.htmlEscape = function(a, b) {
  if (b) {
    a = a.replace(goog.string.AMP_RE_, "&amp;").replace(goog.string.LT_RE_, "&lt;").replace(goog.string.GT_RE_, "&gt;").replace(goog.string.QUOT_RE_, "&quot;").replace(goog.string.SINGLE_QUOTE_RE_, "&#39;").replace(goog.string.NULL_RE_, "&#0;"), goog.string.DETECT_DOUBLE_ESCAPING && (a = a.replace(goog.string.E_RE_, "&#101;"));
  } else {
    if (!goog.string.ALL_RE_.test(a)) {
      return a;
    }
    -1 != a.indexOf("&") && (a = a.replace(goog.string.AMP_RE_, "&amp;"));
    -1 != a.indexOf("<") && (a = a.replace(goog.string.LT_RE_, "&lt;"));
    -1 != a.indexOf(">") && (a = a.replace(goog.string.GT_RE_, "&gt;"));
    -1 != a.indexOf('"') && (a = a.replace(goog.string.QUOT_RE_, "&quot;"));
    -1 != a.indexOf("'") && (a = a.replace(goog.string.SINGLE_QUOTE_RE_, "&#39;"));
    -1 != a.indexOf("\x00") && (a = a.replace(goog.string.NULL_RE_, "&#0;"));
    goog.string.DETECT_DOUBLE_ESCAPING && -1 != a.indexOf("e") && (a = a.replace(goog.string.E_RE_, "&#101;"));
  }
  return a;
};
goog.string.AMP_RE_ = /&/g;
goog.string.LT_RE_ = /</g;
goog.string.GT_RE_ = />/g;
goog.string.QUOT_RE_ = /"/g;
goog.string.SINGLE_QUOTE_RE_ = /'/g;
goog.string.NULL_RE_ = /\x00/g;
goog.string.E_RE_ = /e/g;
goog.string.ALL_RE_ = goog.string.DETECT_DOUBLE_ESCAPING ? /[\x00&<>"'e]/ : /[\x00&<>"']/;
goog.string.unescapeEntities = function(a) {
  return goog.string.contains(a, "&") ? !goog.string.FORCE_NON_DOM_HTML_UNESCAPING && "document" in goog.global ? goog.string.unescapeEntitiesUsingDom_(a) : goog.string.unescapePureXmlEntities_(a) : a;
};
goog.string.unescapeEntitiesWithDocument = function(a, b) {
  return goog.string.contains(a, "&") ? goog.string.unescapeEntitiesUsingDom_(a, b) : a;
};
goog.string.unescapeEntitiesUsingDom_ = function(a, b) {
  var c = {"&amp;":"&", "&lt;":"<", "&gt;":">", "&quot;":'"'}, d;
  d = b ? b.createElement("div") : goog.global.document.createElement("div");
  return a.replace(goog.string.HTML_ENTITY_PATTERN_, function(a, b) {
    var g = c[a];
    if (g) {
      return g;
    }
    if ("#" == b.charAt(0)) {
      var h = Number("0" + b.substr(1));
      isNaN(h) || (g = String.fromCharCode(h));
    }
    g || (d.innerHTML = a + " ", g = d.firstChild.nodeValue.slice(0, -1));
    return c[a] = g;
  });
};
goog.string.unescapePureXmlEntities_ = function(a) {
  return a.replace(/&([^;]+);/g, function(a, c) {
    switch(c) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      default:
        if ("#" == c.charAt(0)) {
          var d = Number("0" + c.substr(1));
          if (!isNaN(d)) {
            return String.fromCharCode(d);
          }
        }
        return a;
    }
  });
};
goog.string.HTML_ENTITY_PATTERN_ = /&([^;\s<&]+);?/g;
goog.string.whitespaceEscape = function(a, b) {
  return goog.string.newLineToBr(a.replace(/  /g, " &#160;"), b);
};
goog.string.preserveSpaces = function(a) {
  return a.replace(/(^|[\n ]) /g, "$1" + goog.string.Unicode.NBSP);
};
goog.string.stripQuotes = function(a, b) {
  for (var c = b.length, d = 0;d < c;d++) {
    var e = 1 == c ? b : b.charAt(d);
    if (a.charAt(0) == e && a.charAt(a.length - 1) == e) {
      return a.substring(1, a.length - 1);
    }
  }
  return a;
};
goog.string.truncate = function(a, b, c) {
  c && (a = goog.string.unescapeEntities(a));
  a.length > b && (a = a.substring(0, b - 3) + "...");
  c && (a = goog.string.htmlEscape(a));
  return a;
};
goog.string.truncateMiddle = function(a, b, c, d) {
  c && (a = goog.string.unescapeEntities(a));
  if (d && a.length > b) {
    d > b && (d = b);
    var e = a.length - d;
    a = a.substring(0, b - d) + "..." + a.substring(e);
  } else {
    a.length > b && (d = Math.floor(b / 2), e = a.length - d, a = a.substring(0, d + b % 2) + "..." + a.substring(e));
  }
  c && (a = goog.string.htmlEscape(a));
  return a;
};
goog.string.specialEscapeChars_ = {"\x00":"\\0", "\b":"\\b", "\f":"\\f", "\n":"\\n", "\r":"\\r", "\t":"\\t", "\x0B":"\\x0B", '"':'\\"', "\\":"\\\\"};
goog.string.jsEscapeCache_ = {"'":"\\'"};
goog.string.quote = function(a) {
  a = String(a);
  if (a.quote) {
    return a.quote();
  }
  for (var b = ['"'], c = 0;c < a.length;c++) {
    var d = a.charAt(c), e = d.charCodeAt(0);
    b[c + 1] = goog.string.specialEscapeChars_[d] || (31 < e && 127 > e ? d : goog.string.escapeChar(d));
  }
  b.push('"');
  return b.join("");
};
goog.string.escapeString = function(a) {
  for (var b = [], c = 0;c < a.length;c++) {
    b[c] = goog.string.escapeChar(a.charAt(c));
  }
  return b.join("");
};
goog.string.escapeChar = function(a) {
  if (a in goog.string.jsEscapeCache_) {
    return goog.string.jsEscapeCache_[a];
  }
  if (a in goog.string.specialEscapeChars_) {
    return goog.string.jsEscapeCache_[a] = goog.string.specialEscapeChars_[a];
  }
  var b = a, c = a.charCodeAt(0);
  if (31 < c && 127 > c) {
    b = a;
  } else {
    if (256 > c) {
      if (b = "\\x", 16 > c || 256 < c) {
        b += "0";
      }
    } else {
      b = "\\u", 4096 > c && (b += "0");
    }
    b += c.toString(16).toUpperCase();
  }
  return goog.string.jsEscapeCache_[a] = b;
};
goog.string.contains = function(a, b) {
  return -1 != a.indexOf(b);
};
goog.string.caseInsensitiveContains = function(a, b) {
  return goog.string.contains(a.toLowerCase(), b.toLowerCase());
};
goog.string.countOf = function(a, b) {
  return a && b ? a.split(b).length - 1 : 0;
};
goog.string.removeAt = function(a, b, c) {
  var d = a;
  0 <= b && b < a.length && 0 < c && (d = a.substr(0, b) + a.substr(b + c, a.length - b - c));
  return d;
};
goog.string.remove = function(a, b) {
  var c = new RegExp(goog.string.regExpEscape(b), "");
  return a.replace(c, "");
};
goog.string.removeAll = function(a, b) {
  var c = new RegExp(goog.string.regExpEscape(b), "g");
  return a.replace(c, "");
};
goog.string.regExpEscape = function(a) {
  return String(a).replace(/([-()\[\]{}+?*.$\^|,:#<!\\])/g, "\\$1").replace(/\x08/g, "\\x08");
};
goog.string.repeat = String.prototype.repeat ? function(a, b) {
  return a.repeat(b);
} : function(a, b) {
  return Array(b + 1).join(a);
};
goog.string.padNumber = function(a, b, c) {
  a = goog.isDef(c) ? a.toFixed(c) : String(a);
  c = a.indexOf(".");
  -1 == c && (c = a.length);
  return goog.string.repeat("0", Math.max(0, b - c)) + a;
};
goog.string.makeSafe = function(a) {
  return null == a ? "" : String(a);
};
goog.string.buildString = function(a) {
  return Array.prototype.join.call(arguments, "");
};
goog.string.getRandomString = function() {
  return Math.floor(2147483648 * Math.random()).toString(36) + Math.abs(Math.floor(2147483648 * Math.random()) ^ goog.now()).toString(36);
};
goog.string.compareVersions = function(a, b) {
  for (var c = 0, d = goog.string.trim(String(a)).split("."), e = goog.string.trim(String(b)).split("."), f = Math.max(d.length, e.length), g = 0;0 == c && g < f;g++) {
    var h = d[g] || "", k = e[g] || "", l = RegExp("(\\d*)(\\D*)", "g"), p = RegExp("(\\d*)(\\D*)", "g");
    do {
      var m = l.exec(h) || ["", "", ""], n = p.exec(k) || ["", "", ""];
      if (0 == m[0].length && 0 == n[0].length) {
        break;
      }
      var c = 0 == m[1].length ? 0 : parseInt(m[1], 10), q = 0 == n[1].length ? 0 : parseInt(n[1], 10), c = goog.string.compareElements_(c, q) || goog.string.compareElements_(0 == m[2].length, 0 == n[2].length) || goog.string.compareElements_(m[2], n[2]);
    } while (0 == c);
  }
  return c;
};
goog.string.compareElements_ = function(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
};
goog.string.hashCode = function(a) {
  for (var b = 0, c = 0;c < a.length;++c) {
    b = 31 * b + a.charCodeAt(c) >>> 0;
  }
  return b;
};
goog.string.uniqueStringCounter_ = 2147483648 * Math.random() | 0;
goog.string.createUniqueString = function() {
  return "goog_" + goog.string.uniqueStringCounter_++;
};
goog.string.toNumber = function(a) {
  var b = Number(a);
  return 0 == b && goog.string.isEmptyOrWhitespace(a) ? NaN : b;
};
goog.string.isLowerCamelCase = function(a) {
  return /^[a-z]+([A-Z][a-z]*)*$/.test(a);
};
goog.string.isUpperCamelCase = function(a) {
  return /^([A-Z][a-z]*)+$/.test(a);
};
goog.string.toCamelCase = function(a) {
  return String(a).replace(/\-([a-z])/g, function(a, c) {
    return c.toUpperCase();
  });
};
goog.string.toSelectorCase = function(a) {
  return String(a).replace(/([A-Z])/g, "-$1").toLowerCase();
};
goog.string.toTitleCase = function(a, b) {
  var c = goog.isString(b) ? goog.string.regExpEscape(b) : "\\s";
  return a.replace(new RegExp("(^" + (c ? "|[" + c + "]+" : "") + ")([a-z])", "g"), function(a, b, c) {
    return b + c.toUpperCase();
  });
};
goog.string.capitalize = function(a) {
  return String(a.charAt(0)).toUpperCase() + String(a.substr(1)).toLowerCase();
};
goog.string.parseInt = function(a) {
  isFinite(a) && (a = String(a));
  return goog.isString(a) ? /^\s*-?0x/i.test(a) ? parseInt(a, 16) : parseInt(a, 10) : NaN;
};
goog.string.splitLimit = function(a, b, c) {
  a = a.split(b);
  for (var d = [];0 < c && a.length;) {
    d.push(a.shift()), c--;
  }
  a.length && d.push(a.join(b));
  return d;
};
goog.string.editDistance = function(a, b) {
  var c = [], d = [];
  if (a == b) {
    return 0;
  }
  if (!a.length || !b.length) {
    return Math.max(a.length, b.length);
  }
  for (var e = 0;e < b.length + 1;e++) {
    c[e] = e;
  }
  for (e = 0;e < a.length;e++) {
    d[0] = e + 1;
    for (var f = 0;f < b.length;f++) {
      d[f + 1] = Math.min(d[f] + 1, c[f + 1] + 1, c[f] + (a[e] != b[f]));
    }
    for (f = 0;f < c.length;f++) {
      c[f] = d[f];
    }
  }
  return d[b.length];
};
goog.asserts = {};
goog.asserts.ENABLE_ASSERTS = goog.DEBUG;
goog.asserts.AssertionError = function(a, b) {
  b.unshift(a);
  goog.debug.Error.call(this, goog.string.subs.apply(null, b));
  b.shift();
  this.messagePattern = a;
};
goog.inherits(goog.asserts.AssertionError, goog.debug.Error);
goog.asserts.AssertionError.prototype.name = "AssertionError";
goog.asserts.DEFAULT_ERROR_HANDLER = function(a) {
  throw a;
};
goog.asserts.errorHandler_ = goog.asserts.DEFAULT_ERROR_HANDLER;
goog.asserts.doAssertFailure_ = function(a, b, c, d) {
  var e = "Assertion failed";
  if (c) {
    var e = e + (": " + c), f = d
  } else {
    a && (e += ": " + a, f = b);
  }
  a = new goog.asserts.AssertionError("" + e, f || []);
  goog.asserts.errorHandler_(a);
};
goog.asserts.setErrorHandler = function(a) {
  goog.asserts.ENABLE_ASSERTS && (goog.asserts.errorHandler_ = a);
};
goog.asserts.assert = function(a, b, c) {
  goog.asserts.ENABLE_ASSERTS && !a && goog.asserts.doAssertFailure_("", null, b, Array.prototype.slice.call(arguments, 2));
  return a;
};
goog.asserts.fail = function(a, b) {
  goog.asserts.ENABLE_ASSERTS && goog.asserts.errorHandler_(new goog.asserts.AssertionError("Failure" + (a ? ": " + a : ""), Array.prototype.slice.call(arguments, 1)));
};
goog.asserts.assertNumber = function(a, b, c) {
  goog.asserts.ENABLE_ASSERTS && !goog.isNumber(a) && goog.asserts.doAssertFailure_("Expected number but got %s: %s.", [goog.typeOf(a), a], b, Array.prototype.slice.call(arguments, 2));
  return a;
};
goog.asserts.assertString = function(a, b, c) {
  goog.asserts.ENABLE_ASSERTS && !goog.isString(a) && goog.asserts.doAssertFailure_("Expected string but got %s: %s.", [goog.typeOf(a), a], b, Array.prototype.slice.call(arguments, 2));
  return a;
};
goog.asserts.assertFunction = function(a, b, c) {
  goog.asserts.ENABLE_ASSERTS && !goog.isFunction(a) && goog.asserts.doAssertFailure_("Expected function but got %s: %s.", [goog.typeOf(a), a], b, Array.prototype.slice.call(arguments, 2));
  return a;
};
goog.asserts.assertObject = function(a, b, c) {
  goog.asserts.ENABLE_ASSERTS && !goog.isObject(a) && goog.asserts.doAssertFailure_("Expected object but got %s: %s.", [goog.typeOf(a), a], b, Array.prototype.slice.call(arguments, 2));
  return a;
};
goog.asserts.assertArray = function(a, b, c) {
  goog.asserts.ENABLE_ASSERTS && !goog.isArray(a) && goog.asserts.doAssertFailure_("Expected array but got %s: %s.", [goog.typeOf(a), a], b, Array.prototype.slice.call(arguments, 2));
  return a;
};
goog.asserts.assertBoolean = function(a, b, c) {
  goog.asserts.ENABLE_ASSERTS && !goog.isBoolean(a) && goog.asserts.doAssertFailure_("Expected boolean but got %s: %s.", [goog.typeOf(a), a], b, Array.prototype.slice.call(arguments, 2));
  return a;
};
goog.asserts.assertElement = function(a, b, c) {
  !goog.asserts.ENABLE_ASSERTS || goog.isObject(a) && a.nodeType == goog.dom.NodeType.ELEMENT || goog.asserts.doAssertFailure_("Expected Element but got %s: %s.", [goog.typeOf(a), a], b, Array.prototype.slice.call(arguments, 2));
  return a;
};
goog.asserts.assertInstanceof = function(a, b, c, d) {
  !goog.asserts.ENABLE_ASSERTS || a instanceof b || goog.asserts.doAssertFailure_("Expected instanceof %s but got %s.", [goog.asserts.getType_(b), goog.asserts.getType_(a)], c, Array.prototype.slice.call(arguments, 3));
  return a;
};
goog.asserts.assertObjectPrototypeIsIntact = function() {
  for (var a in Object.prototype) {
    goog.asserts.fail(a + " should not be enumerable in Object.prototype.");
  }
};
goog.asserts.getType_ = function(a) {
  return a instanceof Function ? a.displayName || a.name || "unknown type name" : a instanceof Object ? a.constructor.displayName || a.constructor.name || Object.prototype.toString.call(a) : null === a ? "null" : typeof a;
};
goog.array = {};
goog.NATIVE_ARRAY_PROTOTYPES = goog.TRUSTED_SITE;
goog.array.ASSUME_NATIVE_FUNCTIONS = !1;
goog.array.peek = function(a) {
  return a[a.length - 1];
};
goog.array.last = goog.array.peek;
goog.array.ARRAY_PROTOTYPE_ = Array.prototype;
goog.array.indexOf = goog.NATIVE_ARRAY_PROTOTYPES && (goog.array.ASSUME_NATIVE_FUNCTIONS || goog.array.ARRAY_PROTOTYPE_.indexOf) ? function(a, b, c) {
  goog.asserts.assert(null != a.length);
  return goog.array.ARRAY_PROTOTYPE_.indexOf.call(a, b, c);
} : function(a, b, c) {
  c = null == c ? 0 : 0 > c ? Math.max(0, a.length + c) : c;
  if (goog.isString(a)) {
    return goog.isString(b) && 1 == b.length ? a.indexOf(b, c) : -1;
  }
  for (;c < a.length;c++) {
    if (c in a && a[c] === b) {
      return c;
    }
  }
  return -1;
};
goog.array.lastIndexOf = goog.NATIVE_ARRAY_PROTOTYPES && (goog.array.ASSUME_NATIVE_FUNCTIONS || goog.array.ARRAY_PROTOTYPE_.lastIndexOf) ? function(a, b, c) {
  goog.asserts.assert(null != a.length);
  return goog.array.ARRAY_PROTOTYPE_.lastIndexOf.call(a, b, null == c ? a.length - 1 : c);
} : function(a, b, c) {
  c = null == c ? a.length - 1 : c;
  0 > c && (c = Math.max(0, a.length + c));
  if (goog.isString(a)) {
    return goog.isString(b) && 1 == b.length ? a.lastIndexOf(b, c) : -1;
  }
  for (;0 <= c;c--) {
    if (c in a && a[c] === b) {
      return c;
    }
  }
  return -1;
};
goog.array.forEach = goog.NATIVE_ARRAY_PROTOTYPES && (goog.array.ASSUME_NATIVE_FUNCTIONS || goog.array.ARRAY_PROTOTYPE_.forEach) ? function(a, b, c) {
  goog.asserts.assert(null != a.length);
  goog.array.ARRAY_PROTOTYPE_.forEach.call(a, b, c);
} : function(a, b, c) {
  for (var d = a.length, e = goog.isString(a) ? a.split("") : a, f = 0;f < d;f++) {
    f in e && b.call(c, e[f], f, a);
  }
};
goog.array.forEachRight = function(a, b, c) {
  for (var d = a.length, e = goog.isString(a) ? a.split("") : a, d = d - 1;0 <= d;--d) {
    d in e && b.call(c, e[d], d, a);
  }
};
goog.array.filter = goog.NATIVE_ARRAY_PROTOTYPES && (goog.array.ASSUME_NATIVE_FUNCTIONS || goog.array.ARRAY_PROTOTYPE_.filter) ? function(a, b, c) {
  goog.asserts.assert(null != a.length);
  return goog.array.ARRAY_PROTOTYPE_.filter.call(a, b, c);
} : function(a, b, c) {
  for (var d = a.length, e = [], f = 0, g = goog.isString(a) ? a.split("") : a, h = 0;h < d;h++) {
    if (h in g) {
      var k = g[h];
      b.call(c, k, h, a) && (e[f++] = k);
    }
  }
  return e;
};
goog.array.map = goog.NATIVE_ARRAY_PROTOTYPES && (goog.array.ASSUME_NATIVE_FUNCTIONS || goog.array.ARRAY_PROTOTYPE_.map) ? function(a, b, c) {
  goog.asserts.assert(null != a.length);
  return goog.array.ARRAY_PROTOTYPE_.map.call(a, b, c);
} : function(a, b, c) {
  for (var d = a.length, e = Array(d), f = goog.isString(a) ? a.split("") : a, g = 0;g < d;g++) {
    g in f && (e[g] = b.call(c, f[g], g, a));
  }
  return e;
};
goog.array.reduce = goog.NATIVE_ARRAY_PROTOTYPES && (goog.array.ASSUME_NATIVE_FUNCTIONS || goog.array.ARRAY_PROTOTYPE_.reduce) ? function(a, b, c, d) {
  goog.asserts.assert(null != a.length);
  d && (b = goog.bind(b, d));
  return goog.array.ARRAY_PROTOTYPE_.reduce.call(a, b, c);
} : function(a, b, c, d) {
  var e = c;
  goog.array.forEach(a, function(c, g) {
    e = b.call(d, e, c, g, a);
  });
  return e;
};
goog.array.reduceRight = goog.NATIVE_ARRAY_PROTOTYPES && (goog.array.ASSUME_NATIVE_FUNCTIONS || goog.array.ARRAY_PROTOTYPE_.reduceRight) ? function(a, b, c, d) {
  goog.asserts.assert(null != a.length);
  d && (b = goog.bind(b, d));
  return goog.array.ARRAY_PROTOTYPE_.reduceRight.call(a, b, c);
} : function(a, b, c, d) {
  var e = c;
  goog.array.forEachRight(a, function(c, g) {
    e = b.call(d, e, c, g, a);
  });
  return e;
};
goog.array.some = goog.NATIVE_ARRAY_PROTOTYPES && (goog.array.ASSUME_NATIVE_FUNCTIONS || goog.array.ARRAY_PROTOTYPE_.some) ? function(a, b, c) {
  goog.asserts.assert(null != a.length);
  return goog.array.ARRAY_PROTOTYPE_.some.call(a, b, c);
} : function(a, b, c) {
  for (var d = a.length, e = goog.isString(a) ? a.split("") : a, f = 0;f < d;f++) {
    if (f in e && b.call(c, e[f], f, a)) {
      return !0;
    }
  }
  return !1;
};
goog.array.every = goog.NATIVE_ARRAY_PROTOTYPES && (goog.array.ASSUME_NATIVE_FUNCTIONS || goog.array.ARRAY_PROTOTYPE_.every) ? function(a, b, c) {
  goog.asserts.assert(null != a.length);
  return goog.array.ARRAY_PROTOTYPE_.every.call(a, b, c);
} : function(a, b, c) {
  for (var d = a.length, e = goog.isString(a) ? a.split("") : a, f = 0;f < d;f++) {
    if (f in e && !b.call(c, e[f], f, a)) {
      return !1;
    }
  }
  return !0;
};
goog.array.count = function(a, b, c) {
  var d = 0;
  goog.array.forEach(a, function(a, f, g) {
    b.call(c, a, f, g) && ++d;
  }, c);
  return d;
};
goog.array.find = function(a, b, c) {
  b = goog.array.findIndex(a, b, c);
  return 0 > b ? null : goog.isString(a) ? a.charAt(b) : a[b];
};
goog.array.findIndex = function(a, b, c) {
  for (var d = a.length, e = goog.isString(a) ? a.split("") : a, f = 0;f < d;f++) {
    if (f in e && b.call(c, e[f], f, a)) {
      return f;
    }
  }
  return -1;
};
goog.array.findRight = function(a, b, c) {
  b = goog.array.findIndexRight(a, b, c);
  return 0 > b ? null : goog.isString(a) ? a.charAt(b) : a[b];
};
goog.array.findIndexRight = function(a, b, c) {
  for (var d = a.length, e = goog.isString(a) ? a.split("") : a, d = d - 1;0 <= d;d--) {
    if (d in e && b.call(c, e[d], d, a)) {
      return d;
    }
  }
  return -1;
};
goog.array.contains = function(a, b) {
  return 0 <= goog.array.indexOf(a, b);
};
goog.array.isEmpty = function(a) {
  return 0 == a.length;
};
goog.array.clear = function(a) {
  if (!goog.isArray(a)) {
    for (var b = a.length - 1;0 <= b;b--) {
      delete a[b];
    }
  }
  a.length = 0;
};
goog.array.insert = function(a, b) {
  goog.array.contains(a, b) || a.push(b);
};
goog.array.insertAt = function(a, b, c) {
  goog.array.splice(a, c, 0, b);
};
goog.array.insertArrayAt = function(a, b, c) {
  goog.partial(goog.array.splice, a, c, 0).apply(null, b);
};
goog.array.insertBefore = function(a, b, c) {
  var d;
  2 == arguments.length || 0 > (d = goog.array.indexOf(a, c)) ? a.push(b) : goog.array.insertAt(a, b, d);
};
goog.array.remove = function(a, b) {
  var c = goog.array.indexOf(a, b), d;
  (d = 0 <= c) && goog.array.removeAt(a, c);
  return d;
};
goog.array.removeAt = function(a, b) {
  goog.asserts.assert(null != a.length);
  return 1 == goog.array.ARRAY_PROTOTYPE_.splice.call(a, b, 1).length;
};
goog.array.removeIf = function(a, b, c) {
  b = goog.array.findIndex(a, b, c);
  return 0 <= b ? (goog.array.removeAt(a, b), !0) : !1;
};
goog.array.removeAllIf = function(a, b, c) {
  var d = 0;
  goog.array.forEachRight(a, function(e, f) {
    b.call(c, e, f, a) && goog.array.removeAt(a, f) && d++;
  });
  return d;
};
goog.array.concat = function(a) {
  return goog.array.ARRAY_PROTOTYPE_.concat.apply(goog.array.ARRAY_PROTOTYPE_, arguments);
};
goog.array.join = function(a) {
  return goog.array.ARRAY_PROTOTYPE_.concat.apply(goog.array.ARRAY_PROTOTYPE_, arguments);
};
goog.array.toArray = function(a) {
  var b = a.length;
  if (0 < b) {
    for (var c = Array(b), d = 0;d < b;d++) {
      c[d] = a[d];
    }
    return c;
  }
  return [];
};
goog.array.clone = goog.array.toArray;
goog.array.extend = function(a, b) {
  for (var c = 1;c < arguments.length;c++) {
    var d = arguments[c];
    if (goog.isArrayLike(d)) {
      var e = a.length || 0, f = d.length || 0;
      a.length = e + f;
      for (var g = 0;g < f;g++) {
        a[e + g] = d[g];
      }
    } else {
      a.push(d);
    }
  }
};
goog.array.splice = function(a, b, c, d) {
  goog.asserts.assert(null != a.length);
  return goog.array.ARRAY_PROTOTYPE_.splice.apply(a, goog.array.slice(arguments, 1));
};
goog.array.slice = function(a, b, c) {
  goog.asserts.assert(null != a.length);
  return 2 >= arguments.length ? goog.array.ARRAY_PROTOTYPE_.slice.call(a, b) : goog.array.ARRAY_PROTOTYPE_.slice.call(a, b, c);
};
goog.array.removeDuplicates = function(a, b, c) {
  b = b || a;
  var d = function(a) {
    return goog.isObject(a) ? "o" + goog.getUid(a) : (typeof a).charAt(0) + a;
  };
  c = c || d;
  for (var d = {}, e = 0, f = 0;f < a.length;) {
    var g = a[f++], h = c(g);
    Object.prototype.hasOwnProperty.call(d, h) || (d[h] = !0, b[e++] = g);
  }
  b.length = e;
};
goog.array.binarySearch = function(a, b, c) {
  return goog.array.binarySearch_(a, c || goog.array.defaultCompare, !1, b);
};
goog.array.binarySelect = function(a, b, c) {
  return goog.array.binarySearch_(a, b, !0, void 0, c);
};
goog.array.binarySearch_ = function(a, b, c, d, e) {
  for (var f = 0, g = a.length, h;f < g;) {
    var k = f + g >> 1, l;
    l = c ? b.call(e, a[k], k, a) : b(d, a[k]);
    0 < l ? f = k + 1 : (g = k, h = !l);
  }
  return h ? f : ~f;
};
goog.array.sort = function(a, b) {
  a.sort(b || goog.array.defaultCompare);
};
goog.array.stableSort = function(a, b) {
  for (var c = 0;c < a.length;c++) {
    a[c] = {index:c, value:a[c]};
  }
  var d = b || goog.array.defaultCompare;
  goog.array.sort(a, function(a, b) {
    return d(a.value, b.value) || a.index - b.index;
  });
  for (c = 0;c < a.length;c++) {
    a[c] = a[c].value;
  }
};
goog.array.sortByKey = function(a, b, c) {
  var d = c || goog.array.defaultCompare;
  goog.array.sort(a, function(a, c) {
    return d(b(a), b(c));
  });
};
goog.array.sortObjectsByKey = function(a, b, c) {
  goog.array.sortByKey(a, function(a) {
    return a[b];
  }, c);
};
goog.array.isSorted = function(a, b, c) {
  b = b || goog.array.defaultCompare;
  for (var d = 1;d < a.length;d++) {
    var e = b(a[d - 1], a[d]);
    if (0 < e || 0 == e && c) {
      return !1;
    }
  }
  return !0;
};
goog.array.equals = function(a, b, c) {
  if (!goog.isArrayLike(a) || !goog.isArrayLike(b) || a.length != b.length) {
    return !1;
  }
  var d = a.length;
  c = c || goog.array.defaultCompareEquality;
  for (var e = 0;e < d;e++) {
    if (!c(a[e], b[e])) {
      return !1;
    }
  }
  return !0;
};
goog.array.compare3 = function(a, b, c) {
  c = c || goog.array.defaultCompare;
  for (var d = Math.min(a.length, b.length), e = 0;e < d;e++) {
    var f = c(a[e], b[e]);
    if (0 != f) {
      return f;
    }
  }
  return goog.array.defaultCompare(a.length, b.length);
};
goog.array.defaultCompare = function(a, b) {
  return a > b ? 1 : a < b ? -1 : 0;
};
goog.array.inverseDefaultCompare = function(a, b) {
  return -goog.array.defaultCompare(a, b);
};
goog.array.defaultCompareEquality = function(a, b) {
  return a === b;
};
goog.array.binaryInsert = function(a, b, c) {
  c = goog.array.binarySearch(a, b, c);
  return 0 > c ? (goog.array.insertAt(a, b, -(c + 1)), !0) : !1;
};
goog.array.binaryRemove = function(a, b, c) {
  b = goog.array.binarySearch(a, b, c);
  return 0 <= b ? goog.array.removeAt(a, b) : !1;
};
goog.array.bucket = function(a, b, c) {
  for (var d = {}, e = 0;e < a.length;e++) {
    var f = a[e], g = b.call(c, f, e, a);
    goog.isDef(g) && (d[g] || (d[g] = [])).push(f);
  }
  return d;
};
goog.array.toObject = function(a, b, c) {
  var d = {};
  goog.array.forEach(a, function(e, f) {
    d[b.call(c, e, f, a)] = e;
  });
  return d;
};
goog.array.range = function(a, b, c) {
  var d = [], e = 0, f = a;
  c = c || 1;
  void 0 !== b && (e = a, f = b);
  if (0 > c * (f - e)) {
    return [];
  }
  if (0 < c) {
    for (a = e;a < f;a += c) {
      d.push(a);
    }
  } else {
    for (a = e;a > f;a += c) {
      d.push(a);
    }
  }
  return d;
};
goog.array.repeat = function(a, b) {
  for (var c = [], d = 0;d < b;d++) {
    c[d] = a;
  }
  return c;
};
goog.array.flatten = function(a) {
  for (var b = [], c = 0;c < arguments.length;c++) {
    var d = arguments[c];
    if (goog.isArray(d)) {
      for (var e = 0;e < d.length;e += 8192) {
        for (var f = goog.array.slice(d, e, e + 8192), f = goog.array.flatten.apply(null, f), g = 0;g < f.length;g++) {
          b.push(f[g]);
        }
      }
    } else {
      b.push(d);
    }
  }
  return b;
};
goog.array.rotate = function(a, b) {
  goog.asserts.assert(null != a.length);
  a.length && (b %= a.length, 0 < b ? goog.array.ARRAY_PROTOTYPE_.unshift.apply(a, a.splice(-b, b)) : 0 > b && goog.array.ARRAY_PROTOTYPE_.push.apply(a, a.splice(0, -b)));
  return a;
};
goog.array.moveItem = function(a, b, c) {
  goog.asserts.assert(0 <= b && b < a.length);
  goog.asserts.assert(0 <= c && c < a.length);
  b = goog.array.ARRAY_PROTOTYPE_.splice.call(a, b, 1);
  goog.array.ARRAY_PROTOTYPE_.splice.call(a, c, 0, b[0]);
};
goog.array.zip = function(a) {
  if (!arguments.length) {
    return [];
  }
  for (var b = [], c = arguments[0].length, d = 1;d < arguments.length;d++) {
    arguments[d].length < c && (c = arguments[d].length);
  }
  for (d = 0;d < c;d++) {
    for (var e = [], f = 0;f < arguments.length;f++) {
      e.push(arguments[f][d]);
    }
    b.push(e);
  }
  return b;
};
goog.array.shuffle = function(a, b) {
  for (var c = b || Math.random, d = a.length - 1;0 < d;d--) {
    var e = Math.floor(c() * (d + 1)), f = a[d];
    a[d] = a[e];
    a[e] = f;
  }
};
goog.array.copyByIndex = function(a, b) {
  var c = [];
  goog.array.forEach(b, function(b) {
    c.push(a[b]);
  });
  return c;
};
goog.proto2 = {};
goog.proto2.FieldDescriptor = function(a, b, c) {
  this.parent_ = a;
  goog.asserts.assert(goog.string.isNumeric(b));
  this.tag_ = b;
  this.name_ = c.name;
  this.isPacked_ = !!c.packed;
  this.isRepeated_ = !!c.repeated;
  this.isRequired_ = !!c.required;
  this.fieldType_ = c.fieldType;
  this.nativeType_ = c.type;
  this.deserializationConversionPermitted_ = !1;
  switch(this.fieldType_) {
    case goog.proto2.FieldDescriptor.FieldType.INT64:
    ;
    case goog.proto2.FieldDescriptor.FieldType.UINT64:
    ;
    case goog.proto2.FieldDescriptor.FieldType.FIXED64:
    ;
    case goog.proto2.FieldDescriptor.FieldType.SFIXED64:
    ;
    case goog.proto2.FieldDescriptor.FieldType.SINT64:
    ;
    case goog.proto2.FieldDescriptor.FieldType.FLOAT:
    ;
    case goog.proto2.FieldDescriptor.FieldType.DOUBLE:
      this.deserializationConversionPermitted_ = !0;
  }
  this.defaultValue_ = c.defaultValue;
};
goog.proto2.FieldDescriptor.FieldType = {DOUBLE:1, FLOAT:2, INT64:3, UINT64:4, INT32:5, FIXED64:6, FIXED32:7, BOOL:8, STRING:9, GROUP:10, MESSAGE:11, BYTES:12, UINT32:13, ENUM:14, SFIXED32:15, SFIXED64:16, SINT32:17, SINT64:18};
goog.proto2.FieldDescriptor.prototype.getTag = function() {
  return this.tag_;
};
goog.proto2.FieldDescriptor.prototype.getContainingType = function() {
  return this.parent_.prototype.getDescriptor();
};
goog.proto2.FieldDescriptor.prototype.getName = function() {
  return this.name_;
};
goog.proto2.FieldDescriptor.prototype.getDefaultValue = function() {
  if (void 0 === this.defaultValue_) {
    var a = this.nativeType_;
    if (a === Boolean) {
      this.defaultValue_ = !1;
    } else {
      if (a === Number) {
        this.defaultValue_ = 0;
      } else {
        if (a === String) {
          this.defaultValue_ = this.deserializationConversionPermitted_ ? "0" : "";
        } else {
          return new a;
        }
      }
    }
  }
  return this.defaultValue_;
};
goog.proto2.FieldDescriptor.prototype.getFieldType = function() {
  return this.fieldType_;
};
goog.proto2.FieldDescriptor.prototype.getNativeType = function() {
  return this.nativeType_;
};
goog.proto2.FieldDescriptor.prototype.deserializationConversionPermitted = function() {
  return this.deserializationConversionPermitted_;
};
goog.proto2.FieldDescriptor.prototype.getFieldMessageType = function() {
  return this.nativeType_.prototype.getDescriptor();
};
goog.proto2.FieldDescriptor.prototype.isCompositeType = function() {
  return this.fieldType_ == goog.proto2.FieldDescriptor.FieldType.MESSAGE || this.fieldType_ == goog.proto2.FieldDescriptor.FieldType.GROUP;
};
goog.proto2.FieldDescriptor.prototype.isPacked = function() {
  return this.isPacked_;
};
goog.proto2.FieldDescriptor.prototype.isRepeated = function() {
  return this.isRepeated_;
};
goog.proto2.FieldDescriptor.prototype.isRequired = function() {
  return this.isRequired_;
};
goog.proto2.FieldDescriptor.prototype.isOptional = function() {
  return !this.isRepeated_ && !this.isRequired_;
};
goog.object = {};
goog.object.forEach = function(a, b, c) {
  for (var d in a) {
    b.call(c, a[d], d, a);
  }
};
goog.object.filter = function(a, b, c) {
  var d = {}, e;
  for (e in a) {
    b.call(c, a[e], e, a) && (d[e] = a[e]);
  }
  return d;
};
goog.object.map = function(a, b, c) {
  var d = {}, e;
  for (e in a) {
    d[e] = b.call(c, a[e], e, a);
  }
  return d;
};
goog.object.some = function(a, b, c) {
  for (var d in a) {
    if (b.call(c, a[d], d, a)) {
      return !0;
    }
  }
  return !1;
};
goog.object.every = function(a, b, c) {
  for (var d in a) {
    if (!b.call(c, a[d], d, a)) {
      return !1;
    }
  }
  return !0;
};
goog.object.getCount = function(a) {
  var b = 0, c;
  for (c in a) {
    b++;
  }
  return b;
};
goog.object.getAnyKey = function(a) {
  for (var b in a) {
    return b;
  }
};
goog.object.getAnyValue = function(a) {
  for (var b in a) {
    return a[b];
  }
};
goog.object.contains = function(a, b) {
  return goog.object.containsValue(a, b);
};
goog.object.getValues = function(a) {
  var b = [], c = 0, d;
  for (d in a) {
    b[c++] = a[d];
  }
  return b;
};
goog.object.getKeys = function(a) {
  var b = [], c = 0, d;
  for (d in a) {
    b[c++] = d;
  }
  return b;
};
goog.object.getValueByKeys = function(a, b) {
  for (var c = goog.isArrayLike(b), d = c ? b : arguments, c = c ? 0 : 1;c < d.length && (a = a[d[c]], goog.isDef(a));c++) {
  }
  return a;
};
goog.object.containsKey = function(a, b) {
  return null !== a && b in a;
};
goog.object.containsValue = function(a, b) {
  for (var c in a) {
    if (a[c] == b) {
      return !0;
    }
  }
  return !1;
};
goog.object.findKey = function(a, b, c) {
  for (var d in a) {
    if (b.call(c, a[d], d, a)) {
      return d;
    }
  }
};
goog.object.findValue = function(a, b, c) {
  return (b = goog.object.findKey(a, b, c)) && a[b];
};
goog.object.isEmpty = function(a) {
  for (var b in a) {
    return !1;
  }
  return !0;
};
goog.object.clear = function(a) {
  for (var b in a) {
    delete a[b];
  }
};
goog.object.remove = function(a, b) {
  var c;
  (c = b in a) && delete a[b];
  return c;
};
goog.object.add = function(a, b, c) {
  if (null !== a && b in a) {
    throw Error('The object already contains the key "' + b + '"');
  }
  goog.object.set(a, b, c);
};
goog.object.get = function(a, b, c) {
  return null !== a && b in a ? a[b] : c;
};
goog.object.set = function(a, b, c) {
  a[b] = c;
};
goog.object.setIfUndefined = function(a, b, c) {
  return b in a ? a[b] : a[b] = c;
};
goog.object.setWithReturnValueIfNotSet = function(a, b, c) {
  if (b in a) {
    return a[b];
  }
  c = c();
  return a[b] = c;
};
goog.object.equals = function(a, b) {
  for (var c in a) {
    if (!(c in b) || a[c] !== b[c]) {
      return !1;
    }
  }
  for (c in b) {
    if (!(c in a)) {
      return !1;
    }
  }
  return !0;
};
goog.object.clone = function(a) {
  var b = {}, c;
  for (c in a) {
    b[c] = a[c];
  }
  return b;
};
goog.object.unsafeClone = function(a) {
  var b = goog.typeOf(a);
  if ("object" == b || "array" == b) {
    if (goog.isFunction(a.clone)) {
      return a.clone();
    }
    var b = "array" == b ? [] : {}, c;
    for (c in a) {
      b[c] = goog.object.unsafeClone(a[c]);
    }
    return b;
  }
  return a;
};
goog.object.transpose = function(a) {
  var b = {}, c;
  for (c in a) {
    b[a[c]] = c;
  }
  return b;
};
goog.object.PROTOTYPE_FIELDS_ = "constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");
goog.object.extend = function(a, b) {
  for (var c, d, e = 1;e < arguments.length;e++) {
    d = arguments[e];
    for (c in d) {
      a[c] = d[c];
    }
    for (var f = 0;f < goog.object.PROTOTYPE_FIELDS_.length;f++) {
      c = goog.object.PROTOTYPE_FIELDS_[f], Object.prototype.hasOwnProperty.call(d, c) && (a[c] = d[c]);
    }
  }
};
goog.object.create = function(a) {
  var b = arguments.length;
  if (1 == b && goog.isArray(arguments[0])) {
    return goog.object.create.apply(null, arguments[0]);
  }
  if (b % 2) {
    throw Error("Uneven number of arguments");
  }
  for (var c = {}, d = 0;d < b;d += 2) {
    c[arguments[d]] = arguments[d + 1];
  }
  return c;
};
goog.object.createSet = function(a) {
  var b = arguments.length;
  if (1 == b && goog.isArray(arguments[0])) {
    return goog.object.createSet.apply(null, arguments[0]);
  }
  for (var c = {}, d = 0;d < b;d++) {
    c[arguments[d]] = !0;
  }
  return c;
};
goog.object.createImmutableView = function(a) {
  var b = a;
  Object.isFrozen && !Object.isFrozen(a) && (b = Object.create(a), Object.freeze(b));
  return b;
};
goog.object.isImmutableView = function(a) {
  return !!Object.isFrozen && Object.isFrozen(a);
};
goog.proto2.Descriptor = function(a, b, c) {
  this.messageType_ = a;
  this.name_ = b.name || null;
  this.fullName_ = b.fullName || null;
  this.containingType_ = b.containingType;
  this.fields_ = {};
  for (a = 0;a < c.length;a++) {
    b = c[a], this.fields_[b.getTag()] = b;
  }
};
goog.proto2.Descriptor.prototype.getName = function() {
  return this.name_;
};
goog.proto2.Descriptor.prototype.getFullName = function() {
  return this.fullName_;
};
goog.proto2.Descriptor.prototype.getContainingType = function() {
  return this.containingType_ ? this.containingType_.getDescriptor() : null;
};
goog.proto2.Descriptor.prototype.getFields = function() {
  var a = goog.object.getValues(this.fields_);
  goog.array.sort(a, function(a, c) {
    return a.getTag() - c.getTag();
  });
  return a;
};
goog.proto2.Descriptor.prototype.getFieldsMap = function() {
  return this.fields_;
};
goog.proto2.Descriptor.prototype.findFieldByName = function(a) {
  return goog.object.findValue(this.fields_, function(b, c, d) {
    return b.getName() == a;
  }) || null;
};
goog.proto2.Descriptor.prototype.findFieldByTag = function(a) {
  goog.asserts.assert(goog.string.isNumeric(a));
  return this.fields_[parseInt(a, 10)] || null;
};
goog.proto2.Descriptor.prototype.createMessageInstance = function() {
  return new this.messageType_;
};
goog.proto2.Message = function() {
  this.values_ = {};
  this.fields_ = this.getDescriptor().getFieldsMap();
  this.deserializedFields_ = this.lazyDeserializer_ = null;
};
goog.proto2.Message.FieldType = {DOUBLE:1, FLOAT:2, INT64:3, UINT64:4, INT32:5, FIXED64:6, FIXED32:7, BOOL:8, STRING:9, GROUP:10, MESSAGE:11, BYTES:12, UINT32:13, ENUM:14, SFIXED32:15, SFIXED64:16, SINT32:17, SINT64:18};
goog.proto2.Message.prototype.initializeForLazyDeserializer = function(a, b) {
  this.lazyDeserializer_ = a;
  this.values_ = b;
  this.deserializedFields_ = {};
};
goog.proto2.Message.prototype.setUnknown = function(a, b) {
  goog.asserts.assert(!this.fields_[a], "Field is not unknown in this message");
  goog.asserts.assert(1 <= a, "Tag is not valid");
  goog.asserts.assert(null !== b, "Value cannot be null");
  this.values_[a] = b;
  this.deserializedFields_ && delete this.deserializedFields_[a];
};
goog.proto2.Message.prototype.forEachUnknown = function(a, b) {
  var c = b || this, d;
  for (d in this.values_) {
    var e = Number(d);
    this.fields_[e] || a.call(c, e, this.values_[d]);
  }
};
goog.proto2.Message.prototype.has = function(a) {
  goog.asserts.assert(a.getContainingType() == this.getDescriptor(), "The current message does not contain the given field");
  return this.has$Value(a.getTag());
};
goog.proto2.Message.prototype.arrayOf = function(a) {
  goog.asserts.assert(a.getContainingType() == this.getDescriptor(), "The current message does not contain the given field");
  return this.array$Values(a.getTag());
};
goog.proto2.Message.prototype.countOf = function(a) {
  goog.asserts.assert(a.getContainingType() == this.getDescriptor(), "The current message does not contain the given field");
  return this.count$Values(a.getTag());
};
goog.proto2.Message.prototype.get = function(a, b) {
  goog.asserts.assert(a.getContainingType() == this.getDescriptor(), "The current message does not contain the given field");
  return this.get$Value(a.getTag(), b);
};
goog.proto2.Message.prototype.getOrDefault = function(a, b) {
  goog.asserts.assert(a.getContainingType() == this.getDescriptor(), "The current message does not contain the given field");
  return this.get$ValueOrDefault(a.getTag(), b);
};
goog.proto2.Message.prototype.set = function(a, b) {
  goog.asserts.assert(a.getContainingType() == this.getDescriptor(), "The current message does not contain the given field");
  this.set$Value(a.getTag(), b);
};
goog.proto2.Message.prototype.add = function(a, b) {
  goog.asserts.assert(a.getContainingType() == this.getDescriptor(), "The current message does not contain the given field");
  this.add$Value(a.getTag(), b);
};
goog.proto2.Message.prototype.clear = function(a) {
  goog.asserts.assert(a.getContainingType() == this.getDescriptor(), "The current message does not contain the given field");
  this.clear$Field(a.getTag());
};
goog.proto2.Message.prototype.equals = function(a) {
  if (!a || this.constructor != a.constructor) {
    return !1;
  }
  for (var b = this.getDescriptor().getFields(), c = 0;c < b.length;c++) {
    var d = b[c], e = d.getTag();
    if (this.has$Value(e) != a.has$Value(e)) {
      return !1;
    }
    if (this.has$Value(e)) {
      var f = d.isCompositeType(), g = this.getValueForTag_(e), e = a.getValueForTag_(e);
      if (d.isRepeated()) {
        if (g.length != e.length) {
          return !1;
        }
        for (d = 0;d < g.length;d++) {
          var h = g[d], k = e[d];
          if (f ? !h.equals(k) : h != k) {
            return !1;
          }
        }
      } else {
        if (f ? !g.equals(e) : g != e) {
          return !1;
        }
      }
    }
  }
  return !0;
};
goog.proto2.Message.prototype.copyFrom = function(a) {
  goog.asserts.assert(this.constructor == a.constructor, "The source message must have the same type.");
  this != a && (this.values_ = {}, this.deserializedFields_ && (this.deserializedFields_ = {}), this.mergeFrom(a));
};
goog.proto2.Message.prototype.mergeFrom = function(a) {
  goog.asserts.assert(this.constructor == a.constructor, "The source message must have the same type.");
  for (var b = this.getDescriptor().getFields(), c = 0;c < b.length;c++) {
    var d = b[c], e = d.getTag();
    if (a.has$Value(e)) {
      this.deserializedFields_ && delete this.deserializedFields_[d.getTag()];
      var f = d.isCompositeType();
      if (d.isRepeated()) {
        for (var d = a.array$Values(e), g = 0;g < d.length;g++) {
          this.add$Value(e, f ? d[g].clone() : d[g]);
        }
      } else {
        d = a.getValueForTag_(e), f ? (f = this.getValueForTag_(e)) ? f.mergeFrom(d) : this.set$Value(e, d.clone()) : this.set$Value(e, d);
      }
    }
  }
};
goog.proto2.Message.prototype.clone = function() {
  var a = new this.constructor;
  a.copyFrom(this);
  return a;
};
goog.proto2.Message.prototype.initDefaults = function(a) {
  for (var b = this.getDescriptor().getFields(), c = 0;c < b.length;c++) {
    var d = b[c], e = d.getTag(), f = d.isCompositeType();
    this.has$Value(e) || d.isRepeated() || (f ? this.values_[e] = new (d.getNativeType()) : a && (this.values_[e] = d.getDefaultValue()));
    if (f) {
      if (d.isRepeated()) {
        for (d = this.array$Values(e), e = 0;e < d.length;e++) {
          d[e].initDefaults(a);
        }
      } else {
        this.get$Value(e).initDefaults(a);
      }
    }
  }
};
goog.proto2.Message.prototype.has$Value = function(a) {
  return null != this.values_[a];
};
goog.proto2.Message.prototype.getValueForTag_ = function(a) {
  var b = this.values_[a];
  return goog.isDefAndNotNull(b) ? this.lazyDeserializer_ ? a in this.deserializedFields_ ? this.deserializedFields_[a] : (b = this.lazyDeserializer_.deserializeField(this, this.fields_[a], b), this.deserializedFields_[a] = b) : b : null;
};
goog.proto2.Message.prototype.get$Value = function(a, b) {
  var c = this.getValueForTag_(a);
  if (this.fields_[a].isRepeated()) {
    var d = b || 0;
    goog.asserts.assert(0 <= d && d < c.length, "Given index %s is out of bounds.  Repeated field length: %s", d, c.length);
    return c[d];
  }
  return c;
};
goog.proto2.Message.prototype.get$ValueOrDefault = function(a, b) {
  return this.has$Value(a) ? this.get$Value(a, b) : this.fields_[a].getDefaultValue();
};
goog.proto2.Message.prototype.array$Values = function(a) {
  return this.getValueForTag_(a) || [];
};
goog.proto2.Message.prototype.count$Values = function(a) {
  return this.fields_[a].isRepeated() ? this.has$Value(a) ? this.values_[a].length : 0 : this.has$Value(a) ? 1 : 0;
};
goog.proto2.Message.prototype.set$Value = function(a, b) {
  goog.asserts.ENABLE_ASSERTS && this.checkFieldType_(this.fields_[a], b);
  this.values_[a] = b;
  this.deserializedFields_ && (this.deserializedFields_[a] = b);
};
goog.proto2.Message.prototype.add$Value = function(a, b) {
  goog.asserts.ENABLE_ASSERTS && this.checkFieldType_(this.fields_[a], b);
  this.values_[a] || (this.values_[a] = []);
  this.values_[a].push(b);
  this.deserializedFields_ && delete this.deserializedFields_[a];
};
goog.proto2.Message.prototype.checkFieldType_ = function(a, b) {
  a.getFieldType() == goog.proto2.FieldDescriptor.FieldType.ENUM ? goog.asserts.assertNumber(b) : goog.asserts.assert(b.constructor == a.getNativeType());
};
goog.proto2.Message.prototype.clear$Field = function(a) {
  delete this.values_[a];
  this.deserializedFields_ && delete this.deserializedFields_[a];
};
goog.proto2.Message.createDescriptor = function(a, b) {
  var c = [], d = b[0], e;
  for (e in b) {
    0 != e && c.push(new goog.proto2.FieldDescriptor(a, e, b[e]));
  }
  return new goog.proto2.Descriptor(a, d, c);
};
goog.proto2.Serializer = function() {
};
goog.proto2.Serializer.DECODE_SYMBOLIC_ENUMS = !1;
goog.proto2.Serializer.prototype.getSerializedValue = function(a, b) {
  return a.isCompositeType() ? this.serialize(b) : goog.isNumber(b) && !isFinite(b) ? b.toString() : b;
};
goog.proto2.Serializer.prototype.deserialize = function(a, b) {
  var c = a.createMessageInstance();
  this.deserializeTo(c, b);
  goog.asserts.assert(c instanceof goog.proto2.Message);
  return c;
};
goog.proto2.Serializer.prototype.getDeserializedValue = function(a, b) {
  if (a.isCompositeType()) {
    return b instanceof goog.proto2.Message ? b : this.deserialize(a.getFieldMessageType(), b);
  }
  if (a.getFieldType() == goog.proto2.FieldDescriptor.FieldType.ENUM) {
    if (goog.proto2.Serializer.DECODE_SYMBOLIC_ENUMS && goog.isString(b)) {
      var c = a.getNativeType();
      if (c.hasOwnProperty(b)) {
        return c[b];
      }
    }
    return b;
  }
  if (!a.deserializationConversionPermitted()) {
    return b;
  }
  c = a.getNativeType();
  if (c === String) {
    if (goog.isNumber(b)) {
      return String(b);
    }
  } else {
    if (c === Number && goog.isString(b) && ("Infinity" === b || "-Infinity" === b || "NaN" === b || /^-?[0-9]+$/.test(b))) {
      return Number(b);
    }
  }
  return b;
};
goog.proto2.LazyDeserializer = function() {
};
goog.inherits(goog.proto2.LazyDeserializer, goog.proto2.Serializer);
goog.proto2.LazyDeserializer.prototype.deserialize = function(a, b) {
  var c = a.createMessageInstance();
  c.initializeForLazyDeserializer(this, b);
  goog.asserts.assert(c instanceof goog.proto2.Message);
  return c;
};
goog.proto2.LazyDeserializer.prototype.deserializeTo = function(a, b) {
  throw Error("Unimplemented");
};
goog.proto2.PbLiteSerializer = function() {
};
goog.inherits(goog.proto2.PbLiteSerializer, goog.proto2.LazyDeserializer);
goog.proto2.PbLiteSerializer.prototype.zeroIndexing_ = !1;
goog.proto2.PbLiteSerializer.prototype.setZeroIndexed = function(a) {
  this.zeroIndexing_ = a;
};
goog.proto2.PbLiteSerializer.prototype.serialize = function(a) {
  for (var b = a.getDescriptor().getFields(), c = [], d = this.zeroIndexing_, e = 0;e < b.length;e++) {
    var f = b[e];
    if (a.has(f)) {
      var g = f.getTag(), g = d ? g - 1 : g;
      if (f.isRepeated()) {
        c[g] = [];
        for (var h = 0;h < a.countOf(f);h++) {
          c[g][h] = this.getSerializedValue(f, a.get(f, h));
        }
      } else {
        c[g] = this.getSerializedValue(f, a.get(f));
      }
    }
  }
  a.forEachUnknown(function(a, b) {
    c[d ? a - 1 : a] = b;
  });
  return c;
};
goog.proto2.PbLiteSerializer.prototype.deserializeField = function(a, b, c) {
  if (null == c) {
    return c;
  }
  if (b.isRepeated()) {
    a = [];
    goog.asserts.assert(goog.isArray(c), "Value must be array: %s", c);
    for (var d = 0;d < c.length;d++) {
      a[d] = this.getDeserializedValue(b, c[d]);
    }
    return a;
  }
  return this.getDeserializedValue(b, c);
};
goog.proto2.PbLiteSerializer.prototype.getSerializedValue = function(a, b) {
  return a.getFieldType() == goog.proto2.FieldDescriptor.FieldType.BOOL ? b ? 1 : 0 : goog.proto2.Serializer.prototype.getSerializedValue.apply(this, arguments);
};
goog.proto2.PbLiteSerializer.prototype.getDeserializedValue = function(a, b) {
  return a.getFieldType() == goog.proto2.FieldDescriptor.FieldType.BOOL ? (goog.asserts.assert(goog.isNumber(b) || goog.isBoolean(b), "Value is expected to be a number or boolean"), !!b) : goog.proto2.Serializer.prototype.getDeserializedValue.apply(this, arguments);
};
goog.proto2.PbLiteSerializer.prototype.deserialize = function(a, b) {
  var c = b;
  if (this.zeroIndexing_) {
    var c = [], d;
    for (d in b) {
      c[parseInt(d, 10) + 1] = b[d];
    }
  }
  return goog.proto2.PbLiteSerializer.superClass_.deserialize.call(this, a, c);
};
goog.labs = {};
goog.labs.userAgent = {};
goog.labs.userAgent.util = {};
goog.labs.userAgent.util.getNativeUserAgentString_ = function() {
  var a = goog.labs.userAgent.util.getNavigator_();
  return a && (a = a.userAgent) ? a : "";
};
goog.labs.userAgent.util.getNavigator_ = function() {
  return goog.global.navigator;
};
goog.labs.userAgent.util.userAgent_ = goog.labs.userAgent.util.getNativeUserAgentString_();
goog.labs.userAgent.util.setUserAgent = function(a) {
  goog.labs.userAgent.util.userAgent_ = a || goog.labs.userAgent.util.getNativeUserAgentString_();
};
goog.labs.userAgent.util.getUserAgent = function() {
  return goog.labs.userAgent.util.userAgent_;
};
goog.labs.userAgent.util.matchUserAgent = function(a) {
  var b = goog.labs.userAgent.util.getUserAgent();
  return goog.string.contains(b, a);
};
goog.labs.userAgent.util.matchUserAgentIgnoreCase = function(a) {
  var b = goog.labs.userAgent.util.getUserAgent();
  return goog.string.caseInsensitiveContains(b, a);
};
goog.labs.userAgent.util.extractVersionTuples = function(a) {
  for (var b = RegExp("(\\w[\\w ]+)/([^\\s]+)\\s*(?:\\((.*?)\\))?", "g"), c = [], d;d = b.exec(a);) {
    c.push([d[1], d[2], d[3] || void 0]);
  }
  return c;
};
goog.labs.userAgent.browser = {};
goog.labs.userAgent.browser.matchOpera_ = function() {
  return goog.labs.userAgent.util.matchUserAgent("Opera") || goog.labs.userAgent.util.matchUserAgent("OPR");
};
goog.labs.userAgent.browser.matchIE_ = function() {
  return goog.labs.userAgent.util.matchUserAgent("Trident") || goog.labs.userAgent.util.matchUserAgent("MSIE");
};
goog.labs.userAgent.browser.matchEdge_ = function() {
  return goog.labs.userAgent.util.matchUserAgent("Edge");
};
goog.labs.userAgent.browser.matchFirefox_ = function() {
  return goog.labs.userAgent.util.matchUserAgent("Firefox");
};
goog.labs.userAgent.browser.matchSafari_ = function() {
  return goog.labs.userAgent.util.matchUserAgent("Safari") && !(goog.labs.userAgent.browser.matchChrome_() || goog.labs.userAgent.browser.matchCoast_() || goog.labs.userAgent.browser.matchOpera_() || goog.labs.userAgent.browser.matchEdge_() || goog.labs.userAgent.browser.isSilk() || goog.labs.userAgent.util.matchUserAgent("Android"));
};
goog.labs.userAgent.browser.matchCoast_ = function() {
  return goog.labs.userAgent.util.matchUserAgent("Coast");
};
goog.labs.userAgent.browser.matchIosWebview_ = function() {
  return (goog.labs.userAgent.util.matchUserAgent("iPad") || goog.labs.userAgent.util.matchUserAgent("iPhone")) && !goog.labs.userAgent.browser.matchSafari_() && !goog.labs.userAgent.browser.matchChrome_() && !goog.labs.userAgent.browser.matchCoast_() && goog.labs.userAgent.util.matchUserAgent("AppleWebKit");
};
goog.labs.userAgent.browser.matchChrome_ = function() {
  return (goog.labs.userAgent.util.matchUserAgent("Chrome") || goog.labs.userAgent.util.matchUserAgent("CriOS")) && !goog.labs.userAgent.browser.matchOpera_() && !goog.labs.userAgent.browser.matchEdge_();
};
goog.labs.userAgent.browser.matchAndroidBrowser_ = function() {
  return goog.labs.userAgent.util.matchUserAgent("Android") && !(goog.labs.userAgent.browser.isChrome() || goog.labs.userAgent.browser.isFirefox() || goog.labs.userAgent.browser.isOpera() || goog.labs.userAgent.browser.isSilk());
};
goog.labs.userAgent.browser.isOpera = goog.labs.userAgent.browser.matchOpera_;
goog.labs.userAgent.browser.isIE = goog.labs.userAgent.browser.matchIE_;
goog.labs.userAgent.browser.isEdge = goog.labs.userAgent.browser.matchEdge_;
goog.labs.userAgent.browser.isFirefox = goog.labs.userAgent.browser.matchFirefox_;
goog.labs.userAgent.browser.isSafari = goog.labs.userAgent.browser.matchSafari_;
goog.labs.userAgent.browser.isCoast = goog.labs.userAgent.browser.matchCoast_;
goog.labs.userAgent.browser.isIosWebview = goog.labs.userAgent.browser.matchIosWebview_;
goog.labs.userAgent.browser.isChrome = goog.labs.userAgent.browser.matchChrome_;
goog.labs.userAgent.browser.isAndroidBrowser = goog.labs.userAgent.browser.matchAndroidBrowser_;
goog.labs.userAgent.browser.isSilk = function() {
  return goog.labs.userAgent.util.matchUserAgent("Silk");
};
goog.labs.userAgent.browser.getVersion = function() {
  function a(a) {
    a = goog.array.find(a, d);
    return c[a] || "";
  }
  var b = goog.labs.userAgent.util.getUserAgent();
  if (goog.labs.userAgent.browser.isIE()) {
    return goog.labs.userAgent.browser.getIEVersion_(b);
  }
  var b = goog.labs.userAgent.util.extractVersionTuples(b), c = {};
  goog.array.forEach(b, function(a) {
    c[a[0]] = a[1];
  });
  var d = goog.partial(goog.object.containsKey, c);
  return goog.labs.userAgent.browser.isOpera() ? a(["Version", "Opera", "OPR"]) : goog.labs.userAgent.browser.isEdge() ? a(["Edge"]) : goog.labs.userAgent.browser.isChrome() ? a(["Chrome", "CriOS"]) : (b = b[2]) && b[1] || "";
};
goog.labs.userAgent.browser.isVersionOrHigher = function(a) {
  return 0 <= goog.string.compareVersions(goog.labs.userAgent.browser.getVersion(), a);
};
goog.labs.userAgent.browser.getIEVersion_ = function(a) {
  var b = /rv: *([\d\.]*)/.exec(a);
  if (b && b[1]) {
    return b[1];
  }
  var b = "", c = /MSIE +([\d\.]+)/.exec(a);
  if (c && c[1]) {
    if (a = /Trident\/(\d.\d)/.exec(a), "7.0" == c[1]) {
      if (a && a[1]) {
        switch(a[1]) {
          case "4.0":
            b = "8.0";
            break;
          case "5.0":
            b = "9.0";
            break;
          case "6.0":
            b = "10.0";
            break;
          case "7.0":
            b = "11.0";
        }
      } else {
        b = "7.0";
      }
    } else {
      b = c[1];
    }
  }
  return b;
};
goog.labs.userAgent.engine = {};
goog.labs.userAgent.engine.isPresto = function() {
  return goog.labs.userAgent.util.matchUserAgent("Presto");
};
goog.labs.userAgent.engine.isTrident = function() {
  return goog.labs.userAgent.util.matchUserAgent("Trident") || goog.labs.userAgent.util.matchUserAgent("MSIE");
};
goog.labs.userAgent.engine.isEdge = function() {
  return goog.labs.userAgent.util.matchUserAgent("Edge");
};
goog.labs.userAgent.engine.isWebKit = function() {
  return goog.labs.userAgent.util.matchUserAgentIgnoreCase("WebKit") && !goog.labs.userAgent.engine.isEdge();
};
goog.labs.userAgent.engine.isGecko = function() {
  return goog.labs.userAgent.util.matchUserAgent("Gecko") && !goog.labs.userAgent.engine.isWebKit() && !goog.labs.userAgent.engine.isTrident() && !goog.labs.userAgent.engine.isEdge();
};
goog.labs.userAgent.engine.getVersion = function() {
  var a = goog.labs.userAgent.util.getUserAgent();
  if (a) {
    var a = goog.labs.userAgent.util.extractVersionTuples(a), b = goog.labs.userAgent.engine.getEngineTuple_(a);
    if (b) {
      return "Gecko" == b[0] ? goog.labs.userAgent.engine.getVersionForKey_(a, "Firefox") : b[1];
    }
    var a = a[0], c;
    if (a && (c = a[2]) && (c = /Trident\/([^\s;]+)/.exec(c))) {
      return c[1];
    }
  }
  return "";
};
goog.labs.userAgent.engine.getEngineTuple_ = function(a) {
  if (!goog.labs.userAgent.engine.isEdge()) {
    return a[1];
  }
  for (var b = 0;b < a.length;b++) {
    var c = a[b];
    if ("Edge" == c[0]) {
      return c;
    }
  }
};
goog.labs.userAgent.engine.isVersionOrHigher = function(a) {
  return 0 <= goog.string.compareVersions(goog.labs.userAgent.engine.getVersion(), a);
};
goog.labs.userAgent.engine.getVersionForKey_ = function(a, b) {
  var c = goog.array.find(a, function(a) {
    return b == a[0];
  });
  return c && c[1] || "";
};
goog.labs.userAgent.platform = {};
goog.labs.userAgent.platform.isAndroid = function() {
  return goog.labs.userAgent.util.matchUserAgent("Android");
};
goog.labs.userAgent.platform.isIpod = function() {
  return goog.labs.userAgent.util.matchUserAgent("iPod");
};
goog.labs.userAgent.platform.isIphone = function() {
  return goog.labs.userAgent.util.matchUserAgent("iPhone") && !goog.labs.userAgent.util.matchUserAgent("iPod") && !goog.labs.userAgent.util.matchUserAgent("iPad");
};
goog.labs.userAgent.platform.isIpad = function() {
  return goog.labs.userAgent.util.matchUserAgent("iPad");
};
goog.labs.userAgent.platform.isIos = function() {
  return goog.labs.userAgent.platform.isIphone() || goog.labs.userAgent.platform.isIpad() || goog.labs.userAgent.platform.isIpod();
};
goog.labs.userAgent.platform.isMacintosh = function() {
  return goog.labs.userAgent.util.matchUserAgent("Macintosh");
};
goog.labs.userAgent.platform.isLinux = function() {
  return goog.labs.userAgent.util.matchUserAgent("Linux");
};
goog.labs.userAgent.platform.isWindows = function() {
  return goog.labs.userAgent.util.matchUserAgent("Windows");
};
goog.labs.userAgent.platform.isChromeOS = function() {
  return goog.labs.userAgent.util.matchUserAgent("CrOS");
};
goog.labs.userAgent.platform.getVersion = function() {
  var a = goog.labs.userAgent.util.getUserAgent(), b = "";
  goog.labs.userAgent.platform.isWindows() ? (b = /Windows (?:NT|Phone) ([0-9.]+)/, b = (a = b.exec(a)) ? a[1] : "0.0") : goog.labs.userAgent.platform.isIos() ? (b = /(?:iPhone|iPod|iPad|CPU)\s+OS\s+(\S+)/, b = (a = b.exec(a)) && a[1].replace(/_/g, ".")) : goog.labs.userAgent.platform.isMacintosh() ? (b = /Mac OS X ([0-9_.]+)/, b = (a = b.exec(a)) ? a[1].replace(/_/g, ".") : "10") : goog.labs.userAgent.platform.isAndroid() ? (b = /Android\s+([^\);]+)(\)|;)/, b = (a = b.exec(a)) && a[1]) : goog.labs.userAgent.platform.isChromeOS() &&
  (b = /(?:CrOS\s+(?:i686|x86_64)\s+([0-9.]+))/, b = (a = b.exec(a)) && a[1]);
  return b || "";
};
goog.labs.userAgent.platform.isVersionOrHigher = function(a) {
  return 0 <= goog.string.compareVersions(goog.labs.userAgent.platform.getVersion(), a);
};
goog.userAgent = {};
goog.userAgent.ASSUME_IE = !1;
goog.userAgent.ASSUME_EDGE = !1;
goog.userAgent.ASSUME_GECKO = !1;
goog.userAgent.ASSUME_WEBKIT = !1;
goog.userAgent.ASSUME_MOBILE_WEBKIT = !1;
goog.userAgent.ASSUME_OPERA = !1;
goog.userAgent.ASSUME_ANY_VERSION = !1;
goog.userAgent.BROWSER_KNOWN_ = goog.userAgent.ASSUME_IE || goog.userAgent.ASSUME_EDGE || goog.userAgent.ASSUME_GECKO || goog.userAgent.ASSUME_MOBILE_WEBKIT || goog.userAgent.ASSUME_WEBKIT || goog.userAgent.ASSUME_OPERA;
goog.userAgent.getUserAgentString = function() {
  return goog.labs.userAgent.util.getUserAgent();
};
goog.userAgent.getNavigator = function() {
  return goog.global.navigator || null;
};
goog.userAgent.OPERA = goog.userAgent.BROWSER_KNOWN_ ? goog.userAgent.ASSUME_OPERA : goog.labs.userAgent.browser.isOpera();
goog.userAgent.IE = goog.userAgent.BROWSER_KNOWN_ ? goog.userAgent.ASSUME_IE : goog.labs.userAgent.browser.isIE();
goog.userAgent.EDGE = goog.userAgent.BROWSER_KNOWN_ ? goog.userAgent.ASSUME_EDGE : goog.labs.userAgent.engine.isEdge();
goog.userAgent.EDGE_OR_IE = goog.userAgent.EDGE || goog.userAgent.IE;
goog.userAgent.GECKO = goog.userAgent.BROWSER_KNOWN_ ? goog.userAgent.ASSUME_GECKO : goog.labs.userAgent.engine.isGecko();
goog.userAgent.WEBKIT = goog.userAgent.BROWSER_KNOWN_ ? goog.userAgent.ASSUME_WEBKIT || goog.userAgent.ASSUME_MOBILE_WEBKIT : goog.labs.userAgent.engine.isWebKit();
goog.userAgent.isMobile_ = function() {
  return goog.userAgent.WEBKIT && goog.labs.userAgent.util.matchUserAgent("Mobile");
};
goog.userAgent.MOBILE = goog.userAgent.ASSUME_MOBILE_WEBKIT || goog.userAgent.isMobile_();
goog.userAgent.SAFARI = goog.userAgent.WEBKIT;
goog.userAgent.determinePlatform_ = function() {
  var a = goog.userAgent.getNavigator();
  return a && a.platform || "";
};
goog.userAgent.PLATFORM = goog.userAgent.determinePlatform_();
goog.userAgent.ASSUME_MAC = !1;
goog.userAgent.ASSUME_WINDOWS = !1;
goog.userAgent.ASSUME_LINUX = !1;
goog.userAgent.ASSUME_X11 = !1;
goog.userAgent.ASSUME_ANDROID = !1;
goog.userAgent.ASSUME_IPHONE = !1;
goog.userAgent.ASSUME_IPAD = !1;
goog.userAgent.PLATFORM_KNOWN_ = goog.userAgent.ASSUME_MAC || goog.userAgent.ASSUME_WINDOWS || goog.userAgent.ASSUME_LINUX || goog.userAgent.ASSUME_X11 || goog.userAgent.ASSUME_ANDROID || goog.userAgent.ASSUME_IPHONE || goog.userAgent.ASSUME_IPAD;
goog.userAgent.MAC = goog.userAgent.PLATFORM_KNOWN_ ? goog.userAgent.ASSUME_MAC : goog.labs.userAgent.platform.isMacintosh();
goog.userAgent.WINDOWS = goog.userAgent.PLATFORM_KNOWN_ ? goog.userAgent.ASSUME_WINDOWS : goog.labs.userAgent.platform.isWindows();
goog.userAgent.isLegacyLinux_ = function() {
  return goog.labs.userAgent.platform.isLinux() || goog.labs.userAgent.platform.isChromeOS();
};
goog.userAgent.LINUX = goog.userAgent.PLATFORM_KNOWN_ ? goog.userAgent.ASSUME_LINUX : goog.userAgent.isLegacyLinux_();
goog.userAgent.isX11_ = function() {
  var a = goog.userAgent.getNavigator();
  return !!a && goog.string.contains(a.appVersion || "", "X11");
};
goog.userAgent.X11 = goog.userAgent.PLATFORM_KNOWN_ ? goog.userAgent.ASSUME_X11 : goog.userAgent.isX11_();
goog.userAgent.ANDROID = goog.userAgent.PLATFORM_KNOWN_ ? goog.userAgent.ASSUME_ANDROID : goog.labs.userAgent.platform.isAndroid();
goog.userAgent.IPHONE = goog.userAgent.PLATFORM_KNOWN_ ? goog.userAgent.ASSUME_IPHONE : goog.labs.userAgent.platform.isIphone();
goog.userAgent.IPAD = goog.userAgent.PLATFORM_KNOWN_ ? goog.userAgent.ASSUME_IPAD : goog.labs.userAgent.platform.isIpad();
goog.userAgent.operaVersion_ = function() {
  var a = goog.global.opera.version;
  try {
    return a();
  } catch (b) {
    return a;
  }
};
goog.userAgent.determineVersion_ = function() {
  if (goog.userAgent.OPERA && goog.global.opera) {
    return goog.userAgent.operaVersion_();
  }
  var a = "", b = goog.userAgent.getVersionRegexResult_();
  b && (a = b ? b[1] : "");
  return goog.userAgent.IE && (b = goog.userAgent.getDocumentMode_(), b > parseFloat(a)) ? String(b) : a;
};
goog.userAgent.getVersionRegexResult_ = function() {
  var a = goog.userAgent.getUserAgentString();
  if (goog.userAgent.GECKO) {
    return /rv\:([^\);]+)(\)|;)/.exec(a);
  }
  if (goog.userAgent.EDGE) {
    return /Edge\/([\d\.]+)/.exec(a);
  }
  if (goog.userAgent.IE) {
    return /\b(?:MSIE|rv)[: ]([^\);]+)(\)|;)/.exec(a);
  }
  if (goog.userAgent.WEBKIT) {
    return /WebKit\/(\S+)/.exec(a);
  }
};
goog.userAgent.getDocumentMode_ = function() {
  var a = goog.global.document;
  return a ? a.documentMode : void 0;
};
goog.userAgent.VERSION = goog.userAgent.determineVersion_();
goog.userAgent.compare = function(a, b) {
  return goog.string.compareVersions(a, b);
};
goog.userAgent.isVersionOrHigherCache_ = {};
goog.userAgent.isVersionOrHigher = function(a) {
  return goog.userAgent.ASSUME_ANY_VERSION || goog.userAgent.isVersionOrHigherCache_[a] || (goog.userAgent.isVersionOrHigherCache_[a] = 0 <= goog.string.compareVersions(goog.userAgent.VERSION, a));
};
goog.userAgent.isVersion = goog.userAgent.isVersionOrHigher;
goog.userAgent.isDocumentModeOrHigher = function(a) {
  return goog.userAgent.DOCUMENT_MODE >= a;
};
goog.userAgent.isDocumentMode = goog.userAgent.isDocumentModeOrHigher;
goog.userAgent.DOCUMENT_MODE = function() {
  var a = goog.global.document, b = goog.userAgent.getDocumentMode_();
  return a && goog.userAgent.IE ? b || ("CSS1Compat" == a.compatMode ? parseInt(goog.userAgent.VERSION, 10) : 5) : void 0;
}();
goog.dom.BrowserFeature = {CAN_ADD_NAME_OR_TYPE_ATTRIBUTES:!goog.userAgent.IE || goog.userAgent.isDocumentModeOrHigher(9), CAN_USE_CHILDREN_ATTRIBUTE:!goog.userAgent.GECKO && !goog.userAgent.IE || goog.userAgent.IE && goog.userAgent.isDocumentModeOrHigher(9) || goog.userAgent.GECKO && goog.userAgent.isVersionOrHigher("1.9.1"), CAN_USE_INNER_TEXT:goog.userAgent.IE && !goog.userAgent.isVersionOrHigher("9"), CAN_USE_PARENT_ELEMENT_PROPERTY:goog.userAgent.IE || goog.userAgent.OPERA || goog.userAgent.WEBKIT,
INNER_HTML_NEEDS_SCOPED_ELEMENT:goog.userAgent.IE, LEGACY_IE_RANGES:goog.userAgent.IE && !goog.userAgent.isDocumentModeOrHigher(9)};
goog.dom.TagName = {A:"A", ABBR:"ABBR", ACRONYM:"ACRONYM", ADDRESS:"ADDRESS", APPLET:"APPLET", AREA:"AREA", ARTICLE:"ARTICLE", ASIDE:"ASIDE", AUDIO:"AUDIO", B:"B", BASE:"BASE", BASEFONT:"BASEFONT", BDI:"BDI", BDO:"BDO", BIG:"BIG", BLOCKQUOTE:"BLOCKQUOTE", BODY:"BODY", BR:"BR", BUTTON:"BUTTON", CANVAS:"CANVAS", CAPTION:"CAPTION", CENTER:"CENTER", CITE:"CITE", CODE:"CODE", COL:"COL", COLGROUP:"COLGROUP", COMMAND:"COMMAND", DATA:"DATA", DATALIST:"DATALIST", DD:"DD", DEL:"DEL", DETAILS:"DETAILS", DFN:"DFN",
DIALOG:"DIALOG", DIR:"DIR", DIV:"DIV", DL:"DL", DT:"DT", EM:"EM", EMBED:"EMBED", FIELDSET:"FIELDSET", FIGCAPTION:"FIGCAPTION", FIGURE:"FIGURE", FONT:"FONT", FOOTER:"FOOTER", FORM:"FORM", FRAME:"FRAME", FRAMESET:"FRAMESET", H1:"H1", H2:"H2", H3:"H3", H4:"H4", H5:"H5", H6:"H6", HEAD:"HEAD", HEADER:"HEADER", HGROUP:"HGROUP", HR:"HR", HTML:"HTML", I:"I", IFRAME:"IFRAME", IMG:"IMG", INPUT:"INPUT", INS:"INS", ISINDEX:"ISINDEX", KBD:"KBD", KEYGEN:"KEYGEN", LABEL:"LABEL", LEGEND:"LEGEND", LI:"LI", LINK:"LINK",
MAP:"MAP", MARK:"MARK", MATH:"MATH", MENU:"MENU", META:"META", METER:"METER", NAV:"NAV", NOFRAMES:"NOFRAMES", NOSCRIPT:"NOSCRIPT", OBJECT:"OBJECT", OL:"OL", OPTGROUP:"OPTGROUP", OPTION:"OPTION", OUTPUT:"OUTPUT", P:"P", PARAM:"PARAM", PRE:"PRE", PROGRESS:"PROGRESS", Q:"Q", RP:"RP", RT:"RT", RUBY:"RUBY", S:"S", SAMP:"SAMP", SCRIPT:"SCRIPT", SECTION:"SECTION", SELECT:"SELECT", SMALL:"SMALL", SOURCE:"SOURCE", SPAN:"SPAN", STRIKE:"STRIKE", STRONG:"STRONG", STYLE:"STYLE", SUB:"SUB", SUMMARY:"SUMMARY",
SUP:"SUP", SVG:"SVG", TABLE:"TABLE", TBODY:"TBODY", TD:"TD", TEMPLATE:"TEMPLATE", TEXTAREA:"TEXTAREA", TFOOT:"TFOOT", TH:"TH", THEAD:"THEAD", TIME:"TIME", TITLE:"TITLE", TR:"TR", TRACK:"TRACK", TT:"TT", U:"U", UL:"UL", VAR:"VAR", VIDEO:"VIDEO", WBR:"WBR"};
goog.dom.tags = {};
goog.dom.tags.VOID_TAGS_ = {area:!0, base:!0, br:!0, col:!0, command:!0, embed:!0, hr:!0, img:!0, input:!0, keygen:!0, link:!0, meta:!0, param:!0, source:!0, track:!0, wbr:!0};
goog.dom.tags.isVoidTag = function(a) {
  return !0 === goog.dom.tags.VOID_TAGS_[a];
};
goog.string.TypedString = function() {
};
goog.string.Const = function() {
  this.stringConstValueWithSecurityContract__googStringSecurityPrivate_ = "";
  this.STRING_CONST_TYPE_MARKER__GOOG_STRING_SECURITY_PRIVATE_ = goog.string.Const.TYPE_MARKER_;
};
goog.string.Const.prototype.implementsGoogStringTypedString = !0;
goog.string.Const.prototype.getTypedStringValue = function() {
  return this.stringConstValueWithSecurityContract__googStringSecurityPrivate_;
};
goog.string.Const.prototype.toString = function() {
  return "Const{" + this.stringConstValueWithSecurityContract__googStringSecurityPrivate_ + "}";
};
goog.string.Const.unwrap = function(a) {
  if (a instanceof goog.string.Const && a.constructor === goog.string.Const && a.STRING_CONST_TYPE_MARKER__GOOG_STRING_SECURITY_PRIVATE_ === goog.string.Const.TYPE_MARKER_) {
    return a.stringConstValueWithSecurityContract__googStringSecurityPrivate_;
  }
  goog.asserts.fail("expected object of type Const, got '" + a + "'");
  return "type_error:Const";
};
goog.string.Const.from = function(a) {
  return goog.string.Const.create__googStringSecurityPrivate_(a);
};
goog.string.Const.TYPE_MARKER_ = {};
goog.string.Const.create__googStringSecurityPrivate_ = function(a) {
  var b = new goog.string.Const;
  b.stringConstValueWithSecurityContract__googStringSecurityPrivate_ = a;
  return b;
};
goog.html = {};
goog.html.SafeStyle = function() {
  this.privateDoNotAccessOrElseSafeStyleWrappedValue_ = "";
  this.SAFE_STYLE_TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_ = goog.html.SafeStyle.TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_;
};
goog.html.SafeStyle.prototype.implementsGoogStringTypedString = !0;
goog.html.SafeStyle.TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_ = {};
goog.html.SafeStyle.fromConstant = function(a) {
  a = goog.string.Const.unwrap(a);
  if (0 === a.length) {
    return goog.html.SafeStyle.EMPTY;
  }
  goog.html.SafeStyle.checkStyle_(a);
  goog.asserts.assert(goog.string.endsWith(a, ";"), "Last character of style string is not ';': " + a);
  goog.asserts.assert(goog.string.contains(a, ":"), "Style string must contain at least one ':', to specify a \"name: value\" pair: " + a);
  return goog.html.SafeStyle.createSafeStyleSecurityPrivateDoNotAccessOrElse(a);
};
goog.html.SafeStyle.checkStyle_ = function(a) {
  goog.asserts.assert(!/[<>]/.test(a), "Forbidden characters in style string: " + a);
};
goog.html.SafeStyle.prototype.getTypedStringValue = function() {
  return this.privateDoNotAccessOrElseSafeStyleWrappedValue_;
};
goog.DEBUG && (goog.html.SafeStyle.prototype.toString = function() {
  return "SafeStyle{" + this.privateDoNotAccessOrElseSafeStyleWrappedValue_ + "}";
});
goog.html.SafeStyle.unwrap = function(a) {
  if (a instanceof goog.html.SafeStyle && a.constructor === goog.html.SafeStyle && a.SAFE_STYLE_TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_ === goog.html.SafeStyle.TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_) {
    return a.privateDoNotAccessOrElseSafeStyleWrappedValue_;
  }
  goog.asserts.fail("expected object of type SafeStyle, got '" + a + "'");
  return "type_error:SafeStyle";
};
goog.html.SafeStyle.createSafeStyleSecurityPrivateDoNotAccessOrElse = function(a) {
  return (new goog.html.SafeStyle).initSecurityPrivateDoNotAccessOrElse_(a);
};
goog.html.SafeStyle.prototype.initSecurityPrivateDoNotAccessOrElse_ = function(a) {
  this.privateDoNotAccessOrElseSafeStyleWrappedValue_ = a;
  return this;
};
goog.html.SafeStyle.EMPTY = goog.html.SafeStyle.createSafeStyleSecurityPrivateDoNotAccessOrElse("");
goog.html.SafeStyle.INNOCUOUS_STRING = "zClosurez";
goog.html.SafeStyle.create = function(a) {
  var b = "", c;
  for (c in a) {
    if (!/^[-_a-zA-Z0-9]+$/.test(c)) {
      throw Error("Name allows only [-_a-zA-Z0-9], got: " + c);
    }
    var d = a[c];
    null != d && (d instanceof goog.string.Const ? (d = goog.string.Const.unwrap(d), goog.asserts.assert(!/[{;}]/.test(d), "Value does not allow [{;}].")) : goog.html.SafeStyle.VALUE_RE_.test(d) ? goog.html.SafeStyle.hasBalancedQuotes_(d) || (goog.asserts.fail("String value requires balanced quotes, got: " + d), d = goog.html.SafeStyle.INNOCUOUS_STRING) : (goog.asserts.fail("String value allows only [-,.\"'%_!# a-zA-Z0-9], got: " + d), d = goog.html.SafeStyle.INNOCUOUS_STRING), b += c + ":" + d +
    ";");
  }
  if (!b) {
    return goog.html.SafeStyle.EMPTY;
  }
  goog.html.SafeStyle.checkStyle_(b);
  return goog.html.SafeStyle.createSafeStyleSecurityPrivateDoNotAccessOrElse(b);
};
goog.html.SafeStyle.hasBalancedQuotes_ = function(a) {
  for (var b = !0, c = !0, d = 0;d < a.length;d++) {
    var e = a.charAt(d);
    "'" == e && c ? b = !b : '"' == e && b && (c = !c);
  }
  return b && c;
};
goog.html.SafeStyle.VALUE_RE_ = /^[-,."'%_!# a-zA-Z0-9]+$/;
goog.html.SafeStyle.concat = function(a) {
  var b = "", c = function(a) {
    goog.isArray(a) ? goog.array.forEach(a, c) : b += goog.html.SafeStyle.unwrap(a);
  };
  goog.array.forEach(arguments, c);
  return b ? goog.html.SafeStyle.createSafeStyleSecurityPrivateDoNotAccessOrElse(b) : goog.html.SafeStyle.EMPTY;
};
goog.html.SafeStyleSheet = function() {
  this.privateDoNotAccessOrElseSafeStyleSheetWrappedValue_ = "";
  this.SAFE_SCRIPT_TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_ = goog.html.SafeStyleSheet.TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_;
};
goog.html.SafeStyleSheet.prototype.implementsGoogStringTypedString = !0;
goog.html.SafeStyleSheet.TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_ = {};
goog.html.SafeStyleSheet.concat = function(a) {
  var b = "", c = function(a) {
    goog.isArray(a) ? goog.array.forEach(a, c) : b += goog.html.SafeStyleSheet.unwrap(a);
  };
  goog.array.forEach(arguments, c);
  return goog.html.SafeStyleSheet.createSafeStyleSheetSecurityPrivateDoNotAccessOrElse(b);
};
goog.html.SafeStyleSheet.fromConstant = function(a) {
  a = goog.string.Const.unwrap(a);
  if (0 === a.length) {
    return goog.html.SafeStyleSheet.EMPTY;
  }
  goog.asserts.assert(!goog.string.contains(a, "<"), "Forbidden '<' character in style sheet string: " + a);
  return goog.html.SafeStyleSheet.createSafeStyleSheetSecurityPrivateDoNotAccessOrElse(a);
};
goog.html.SafeStyleSheet.prototype.getTypedStringValue = function() {
  return this.privateDoNotAccessOrElseSafeStyleSheetWrappedValue_;
};
goog.DEBUG && (goog.html.SafeStyleSheet.prototype.toString = function() {
  return "SafeStyleSheet{" + this.privateDoNotAccessOrElseSafeStyleSheetWrappedValue_ + "}";
});
goog.html.SafeStyleSheet.unwrap = function(a) {
  if (a instanceof goog.html.SafeStyleSheet && a.constructor === goog.html.SafeStyleSheet && a.SAFE_SCRIPT_TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_ === goog.html.SafeStyleSheet.TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_) {
    return a.privateDoNotAccessOrElseSafeStyleSheetWrappedValue_;
  }
  goog.asserts.fail("expected object of type SafeStyleSheet, got '" + a + "'");
  return "type_error:SafeStyleSheet";
};
goog.html.SafeStyleSheet.createSafeStyleSheetSecurityPrivateDoNotAccessOrElse = function(a) {
  return (new goog.html.SafeStyleSheet).initSecurityPrivateDoNotAccessOrElse_(a);
};
goog.html.SafeStyleSheet.prototype.initSecurityPrivateDoNotAccessOrElse_ = function(a) {
  this.privateDoNotAccessOrElseSafeStyleSheetWrappedValue_ = a;
  return this;
};
goog.html.SafeStyleSheet.EMPTY = goog.html.SafeStyleSheet.createSafeStyleSheetSecurityPrivateDoNotAccessOrElse("");
goog.fs = {};
goog.fs.url = {};
goog.fs.url.createObjectUrl = function(a) {
  return goog.fs.url.getUrlObject_().createObjectURL(a);
};
goog.fs.url.revokeObjectUrl = function(a) {
  goog.fs.url.getUrlObject_().revokeObjectURL(a);
};
goog.fs.url.getUrlObject_ = function() {
  var a = goog.fs.url.findUrlObject_();
  if (null != a) {
    return a;
  }
  throw Error("This browser doesn't seem to support blob URLs");
};
goog.fs.url.findUrlObject_ = function() {
  return goog.isDef(goog.global.URL) && goog.isDef(goog.global.URL.createObjectURL) ? goog.global.URL : goog.isDef(goog.global.webkitURL) && goog.isDef(goog.global.webkitURL.createObjectURL) ? goog.global.webkitURL : goog.isDef(goog.global.createObjectURL) ? goog.global : null;
};
goog.fs.url.browserSupportsObjectUrls = function() {
  return null != goog.fs.url.findUrlObject_();
};
goog.i18n = {};
goog.i18n.bidi = {};
goog.i18n.bidi.FORCE_RTL = !1;
goog.i18n.bidi.IS_RTL = goog.i18n.bidi.FORCE_RTL || ("ar" == goog.LOCALE.substring(0, 2).toLowerCase() || "fa" == goog.LOCALE.substring(0, 2).toLowerCase() || "he" == goog.LOCALE.substring(0, 2).toLowerCase() || "iw" == goog.LOCALE.substring(0, 2).toLowerCase() || "ps" == goog.LOCALE.substring(0, 2).toLowerCase() || "sd" == goog.LOCALE.substring(0, 2).toLowerCase() || "ug" == goog.LOCALE.substring(0, 2).toLowerCase() || "ur" == goog.LOCALE.substring(0, 2).toLowerCase() || "yi" == goog.LOCALE.substring(0,
2).toLowerCase()) && (2 == goog.LOCALE.length || "-" == goog.LOCALE.substring(2, 3) || "_" == goog.LOCALE.substring(2, 3)) || 3 <= goog.LOCALE.length && "ckb" == goog.LOCALE.substring(0, 3).toLowerCase() && (3 == goog.LOCALE.length || "-" == goog.LOCALE.substring(3, 4) || "_" == goog.LOCALE.substring(3, 4));
goog.i18n.bidi.Format = {LRE:"\u202a", RLE:"\u202b", PDF:"\u202c", LRM:"\u200e", RLM:"\u200f"};
goog.i18n.bidi.Dir = {LTR:1, RTL:-1, NEUTRAL:0};
goog.i18n.bidi.RIGHT = "right";
goog.i18n.bidi.LEFT = "left";
goog.i18n.bidi.I18N_RIGHT = goog.i18n.bidi.IS_RTL ? goog.i18n.bidi.LEFT : goog.i18n.bidi.RIGHT;
goog.i18n.bidi.I18N_LEFT = goog.i18n.bidi.IS_RTL ? goog.i18n.bidi.RIGHT : goog.i18n.bidi.LEFT;
goog.i18n.bidi.toDir = function(a, b) {
  return "number" == typeof a ? 0 < a ? goog.i18n.bidi.Dir.LTR : 0 > a ? goog.i18n.bidi.Dir.RTL : b ? null : goog.i18n.bidi.Dir.NEUTRAL : null == a ? null : a ? goog.i18n.bidi.Dir.RTL : goog.i18n.bidi.Dir.LTR;
};
goog.i18n.bidi.ltrChars_ = "A-Za-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02b8\u0300-\u0590\u0800-\u1fff\u200e\u2c00-\ufb1c\ufe00-\ufe6f\ufefd-\uffff";
goog.i18n.bidi.rtlChars_ = "\u0591-\u06ef\u06fa-\u07ff\u200f\ufb1d-\ufdff\ufe70-\ufefc";
goog.i18n.bidi.htmlSkipReg_ = /<[^>]*>|&[^;]+;/g;
goog.i18n.bidi.stripHtmlIfNeeded_ = function(a, b) {
  return b ? a.replace(goog.i18n.bidi.htmlSkipReg_, "") : a;
};
goog.i18n.bidi.rtlCharReg_ = new RegExp("[" + goog.i18n.bidi.rtlChars_ + "]");
goog.i18n.bidi.ltrCharReg_ = new RegExp("[" + goog.i18n.bidi.ltrChars_ + "]");
goog.i18n.bidi.hasAnyRtl = function(a, b) {
  return goog.i18n.bidi.rtlCharReg_.test(goog.i18n.bidi.stripHtmlIfNeeded_(a, b));
};
goog.i18n.bidi.hasRtlChar = goog.i18n.bidi.hasAnyRtl;
goog.i18n.bidi.hasAnyLtr = function(a, b) {
  return goog.i18n.bidi.ltrCharReg_.test(goog.i18n.bidi.stripHtmlIfNeeded_(a, b));
};
goog.i18n.bidi.ltrRe_ = new RegExp("^[" + goog.i18n.bidi.ltrChars_ + "]");
goog.i18n.bidi.rtlRe_ = new RegExp("^[" + goog.i18n.bidi.rtlChars_ + "]");
goog.i18n.bidi.isRtlChar = function(a) {
  return goog.i18n.bidi.rtlRe_.test(a);
};
goog.i18n.bidi.isLtrChar = function(a) {
  return goog.i18n.bidi.ltrRe_.test(a);
};
goog.i18n.bidi.isNeutralChar = function(a) {
  return !goog.i18n.bidi.isLtrChar(a) && !goog.i18n.bidi.isRtlChar(a);
};
goog.i18n.bidi.ltrDirCheckRe_ = new RegExp("^[^" + goog.i18n.bidi.rtlChars_ + "]*[" + goog.i18n.bidi.ltrChars_ + "]");
goog.i18n.bidi.rtlDirCheckRe_ = new RegExp("^[^" + goog.i18n.bidi.ltrChars_ + "]*[" + goog.i18n.bidi.rtlChars_ + "]");
goog.i18n.bidi.startsWithRtl = function(a, b) {
  return goog.i18n.bidi.rtlDirCheckRe_.test(goog.i18n.bidi.stripHtmlIfNeeded_(a, b));
};
goog.i18n.bidi.isRtlText = goog.i18n.bidi.startsWithRtl;
goog.i18n.bidi.startsWithLtr = function(a, b) {
  return goog.i18n.bidi.ltrDirCheckRe_.test(goog.i18n.bidi.stripHtmlIfNeeded_(a, b));
};
goog.i18n.bidi.isLtrText = goog.i18n.bidi.startsWithLtr;
goog.i18n.bidi.isRequiredLtrRe_ = /^http:\/\/.*/;
goog.i18n.bidi.isNeutralText = function(a, b) {
  a = goog.i18n.bidi.stripHtmlIfNeeded_(a, b);
  return goog.i18n.bidi.isRequiredLtrRe_.test(a) || !goog.i18n.bidi.hasAnyLtr(a) && !goog.i18n.bidi.hasAnyRtl(a);
};
goog.i18n.bidi.ltrExitDirCheckRe_ = new RegExp("[" + goog.i18n.bidi.ltrChars_ + "][^" + goog.i18n.bidi.rtlChars_ + "]*$");
goog.i18n.bidi.rtlExitDirCheckRe_ = new RegExp("[" + goog.i18n.bidi.rtlChars_ + "][^" + goog.i18n.bidi.ltrChars_ + "]*$");
goog.i18n.bidi.endsWithLtr = function(a, b) {
  return goog.i18n.bidi.ltrExitDirCheckRe_.test(goog.i18n.bidi.stripHtmlIfNeeded_(a, b));
};
goog.i18n.bidi.isLtrExitText = goog.i18n.bidi.endsWithLtr;
goog.i18n.bidi.endsWithRtl = function(a, b) {
  return goog.i18n.bidi.rtlExitDirCheckRe_.test(goog.i18n.bidi.stripHtmlIfNeeded_(a, b));
};
goog.i18n.bidi.isRtlExitText = goog.i18n.bidi.endsWithRtl;
goog.i18n.bidi.rtlLocalesRe_ = /^(ar|ckb|dv|he|iw|fa|nqo|ps|sd|ug|ur|yi|.*[-_](Arab|Hebr|Thaa|Nkoo|Tfng))(?!.*[-_](Latn|Cyrl)($|-|_))($|-|_)/i;
goog.i18n.bidi.isRtlLanguage = function(a) {
  return goog.i18n.bidi.rtlLocalesRe_.test(a);
};
goog.i18n.bidi.bracketGuardHtmlRe_ = /(\(.*?\)+)|(\[.*?\]+)|(\{.*?\}+)|(&lt;.*?(&gt;)+)/g;
goog.i18n.bidi.bracketGuardTextRe_ = /(\(.*?\)+)|(\[.*?\]+)|(\{.*?\}+)|(<.*?>+)/g;
goog.i18n.bidi.guardBracketInHtml = function(a, b) {
  return (void 0 === b ? goog.i18n.bidi.hasAnyRtl(a) : b) ? a.replace(goog.i18n.bidi.bracketGuardHtmlRe_, "<span dir=rtl>$&</span>") : a.replace(goog.i18n.bidi.bracketGuardHtmlRe_, "<span dir=ltr>$&</span>");
};
goog.i18n.bidi.guardBracketInText = function(a, b) {
  var c = (void 0 === b ? goog.i18n.bidi.hasAnyRtl(a) : b) ? goog.i18n.bidi.Format.RLM : goog.i18n.bidi.Format.LRM;
  return a.replace(goog.i18n.bidi.bracketGuardTextRe_, c + "$&" + c);
};
goog.i18n.bidi.enforceRtlInHtml = function(a) {
  return "<" == a.charAt(0) ? a.replace(/<\w+/, "$& dir=rtl") : "\n<span dir=rtl>" + a + "</span>";
};
goog.i18n.bidi.enforceRtlInText = function(a) {
  return goog.i18n.bidi.Format.RLE + a + goog.i18n.bidi.Format.PDF;
};
goog.i18n.bidi.enforceLtrInHtml = function(a) {
  return "<" == a.charAt(0) ? a.replace(/<\w+/, "$& dir=ltr") : "\n<span dir=ltr>" + a + "</span>";
};
goog.i18n.bidi.enforceLtrInText = function(a) {
  return goog.i18n.bidi.Format.LRE + a + goog.i18n.bidi.Format.PDF;
};
goog.i18n.bidi.dimensionsRe_ = /:\s*([.\d][.\w]*)\s+([.\d][.\w]*)\s+([.\d][.\w]*)\s+([.\d][.\w]*)/g;
goog.i18n.bidi.leftRe_ = /left/gi;
goog.i18n.bidi.rightRe_ = /right/gi;
goog.i18n.bidi.tempRe_ = /%%%%/g;
goog.i18n.bidi.mirrorCSS = function(a) {
  return a.replace(goog.i18n.bidi.dimensionsRe_, ":$1 $4 $3 $2").replace(goog.i18n.bidi.leftRe_, "%%%%").replace(goog.i18n.bidi.rightRe_, goog.i18n.bidi.LEFT).replace(goog.i18n.bidi.tempRe_, goog.i18n.bidi.RIGHT);
};
goog.i18n.bidi.doubleQuoteSubstituteRe_ = /([\u0591-\u05f2])"/g;
goog.i18n.bidi.singleQuoteSubstituteRe_ = /([\u0591-\u05f2])'/g;
goog.i18n.bidi.normalizeHebrewQuote = function(a) {
  return a.replace(goog.i18n.bidi.doubleQuoteSubstituteRe_, "$1\u05f4").replace(goog.i18n.bidi.singleQuoteSubstituteRe_, "$1\u05f3");
};
goog.i18n.bidi.wordSeparatorRe_ = /\s+/;
goog.i18n.bidi.hasNumeralsRe_ = /[\d\u06f0-\u06f9]/;
goog.i18n.bidi.rtlDetectionThreshold_ = .4;
goog.i18n.bidi.estimateDirection = function(a, b) {
  for (var c = 0, d = 0, e = !1, f = goog.i18n.bidi.stripHtmlIfNeeded_(a, b).split(goog.i18n.bidi.wordSeparatorRe_), g = 0;g < f.length;g++) {
    var h = f[g];
    goog.i18n.bidi.startsWithRtl(h) ? (c++, d++) : goog.i18n.bidi.isRequiredLtrRe_.test(h) ? e = !0 : goog.i18n.bidi.hasAnyLtr(h) ? d++ : goog.i18n.bidi.hasNumeralsRe_.test(h) && (e = !0);
  }
  return 0 == d ? e ? goog.i18n.bidi.Dir.LTR : goog.i18n.bidi.Dir.NEUTRAL : c / d > goog.i18n.bidi.rtlDetectionThreshold_ ? goog.i18n.bidi.Dir.RTL : goog.i18n.bidi.Dir.LTR;
};
goog.i18n.bidi.detectRtlDirectionality = function(a, b) {
  return goog.i18n.bidi.estimateDirection(a, b) == goog.i18n.bidi.Dir.RTL;
};
goog.i18n.bidi.setElementDirAndAlign = function(a, b) {
  a && (b = goog.i18n.bidi.toDir(b)) && (a.style.textAlign = b == goog.i18n.bidi.Dir.RTL ? goog.i18n.bidi.RIGHT : goog.i18n.bidi.LEFT, a.dir = b == goog.i18n.bidi.Dir.RTL ? "rtl" : "ltr");
};
goog.i18n.bidi.setElementDirByTextDirectionality = function(a, b) {
  switch(goog.i18n.bidi.estimateDirection(b)) {
    case goog.i18n.bidi.Dir.LTR:
      a.dir = "ltr";
      break;
    case goog.i18n.bidi.Dir.RTL:
      a.dir = "rtl";
      break;
    default:
      a.removeAttribute("dir");
  }
};
goog.i18n.bidi.DirectionalString = function() {
};
goog.html.SafeUrl = function() {
  this.privateDoNotAccessOrElseSafeHtmlWrappedValue_ = "";
  this.SAFE_URL_TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_ = goog.html.SafeUrl.TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_;
};
goog.html.SafeUrl.INNOCUOUS_STRING = "about:invalid#zClosurez";
goog.html.SafeUrl.prototype.implementsGoogStringTypedString = !0;
goog.html.SafeUrl.prototype.getTypedStringValue = function() {
  return this.privateDoNotAccessOrElseSafeHtmlWrappedValue_;
};
goog.html.SafeUrl.prototype.implementsGoogI18nBidiDirectionalString = !0;
goog.html.SafeUrl.prototype.getDirection = function() {
  return goog.i18n.bidi.Dir.LTR;
};
goog.DEBUG && (goog.html.SafeUrl.prototype.toString = function() {
  return "SafeUrl{" + this.privateDoNotAccessOrElseSafeHtmlWrappedValue_ + "}";
});
goog.html.SafeUrl.unwrap = function(a) {
  if (a instanceof goog.html.SafeUrl && a.constructor === goog.html.SafeUrl && a.SAFE_URL_TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_ === goog.html.SafeUrl.TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_) {
    return a.privateDoNotAccessOrElseSafeHtmlWrappedValue_;
  }
  goog.asserts.fail("expected object of type SafeUrl, got '" + a + "'");
  return "type_error:SafeUrl";
};
goog.html.SafeUrl.fromConstant = function(a) {
  return goog.html.SafeUrl.createSafeUrlSecurityPrivateDoNotAccessOrElse(goog.string.Const.unwrap(a));
};
goog.html.SAFE_MIME_TYPE_PATTERN_ = /^(?:image\/(?:bmp|gif|jpeg|jpg|png|tiff|webp)|video\/(?:mpeg|mp4|ogg|webm))$/i;
goog.html.SafeUrl.fromBlob = function(a) {
  a = goog.html.SAFE_MIME_TYPE_PATTERN_.test(a.type) ? goog.fs.url.createObjectUrl(a) : goog.html.SafeUrl.INNOCUOUS_STRING;
  return goog.html.SafeUrl.createSafeUrlSecurityPrivateDoNotAccessOrElse(a);
};
goog.html.DATA_URL_PATTERN_ = /^data:([^;,]*);base64,[a-z0-9+\/]+=*$/i;
goog.html.SafeUrl.fromDataUrl = function(a) {
  var b = a.match(goog.html.DATA_URL_PATTERN_), b = b && goog.html.SAFE_MIME_TYPE_PATTERN_.test(b[1]);
  return goog.html.SafeUrl.createSafeUrlSecurityPrivateDoNotAccessOrElse(b ? a : goog.html.SafeUrl.INNOCUOUS_STRING);
};
goog.html.SAFE_URL_PATTERN_ = /^(?:(?:https?|mailto|ftp):|[^&:/?#]*(?:[/?#]|$))/i;
goog.html.SafeUrl.sanitize = function(a) {
  if (a instanceof goog.html.SafeUrl) {
    return a;
  }
  a = a.implementsGoogStringTypedString ? a.getTypedStringValue() : String(a);
  goog.html.SAFE_URL_PATTERN_.test(a) || (a = goog.html.SafeUrl.INNOCUOUS_STRING);
  return goog.html.SafeUrl.createSafeUrlSecurityPrivateDoNotAccessOrElse(a);
};
goog.html.SafeUrl.TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_ = {};
goog.html.SafeUrl.createSafeUrlSecurityPrivateDoNotAccessOrElse = function(a) {
  var b = new goog.html.SafeUrl;
  b.privateDoNotAccessOrElseSafeHtmlWrappedValue_ = a;
  return b;
};
goog.html.TrustedResourceUrl = function() {
  this.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue_ = "";
  this.TRUSTED_RESOURCE_URL_TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_ = goog.html.TrustedResourceUrl.TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_;
};
goog.html.TrustedResourceUrl.prototype.implementsGoogStringTypedString = !0;
goog.html.TrustedResourceUrl.prototype.getTypedStringValue = function() {
  return this.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue_;
};
goog.html.TrustedResourceUrl.prototype.implementsGoogI18nBidiDirectionalString = !0;
goog.html.TrustedResourceUrl.prototype.getDirection = function() {
  return goog.i18n.bidi.Dir.LTR;
};
goog.DEBUG && (goog.html.TrustedResourceUrl.prototype.toString = function() {
  return "TrustedResourceUrl{" + this.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue_ + "}";
});
goog.html.TrustedResourceUrl.unwrap = function(a) {
  if (a instanceof goog.html.TrustedResourceUrl && a.constructor === goog.html.TrustedResourceUrl && a.TRUSTED_RESOURCE_URL_TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_ === goog.html.TrustedResourceUrl.TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_) {
    return a.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue_;
  }
  goog.asserts.fail("expected object of type TrustedResourceUrl, got '" + a + "'");
  return "type_error:TrustedResourceUrl";
};
goog.html.TrustedResourceUrl.fromConstant = function(a) {
  return goog.html.TrustedResourceUrl.createTrustedResourceUrlSecurityPrivateDoNotAccessOrElse(goog.string.Const.unwrap(a));
};
goog.html.TrustedResourceUrl.TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_ = {};
goog.html.TrustedResourceUrl.createTrustedResourceUrlSecurityPrivateDoNotAccessOrElse = function(a) {
  var b = new goog.html.TrustedResourceUrl;
  b.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue_ = a;
  return b;
};
goog.html.SafeHtml = function() {
  this.privateDoNotAccessOrElseSafeHtmlWrappedValue_ = "";
  this.SAFE_HTML_TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_ = goog.html.SafeHtml.TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_;
  this.dir_ = null;
};
goog.html.SafeHtml.prototype.implementsGoogI18nBidiDirectionalString = !0;
goog.html.SafeHtml.prototype.getDirection = function() {
  return this.dir_;
};
goog.html.SafeHtml.prototype.implementsGoogStringTypedString = !0;
goog.html.SafeHtml.prototype.getTypedStringValue = function() {
  return this.privateDoNotAccessOrElseSafeHtmlWrappedValue_;
};
goog.DEBUG && (goog.html.SafeHtml.prototype.toString = function() {
  return "SafeHtml{" + this.privateDoNotAccessOrElseSafeHtmlWrappedValue_ + "}";
});
goog.html.SafeHtml.unwrap = function(a) {
  if (a instanceof goog.html.SafeHtml && a.constructor === goog.html.SafeHtml && a.SAFE_HTML_TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_ === goog.html.SafeHtml.TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_) {
    return a.privateDoNotAccessOrElseSafeHtmlWrappedValue_;
  }
  goog.asserts.fail("expected object of type SafeHtml, got '" + a + "'");
  return "type_error:SafeHtml";
};
goog.html.SafeHtml.htmlEscape = function(a) {
  if (a instanceof goog.html.SafeHtml) {
    return a;
  }
  var b = null;
  a.implementsGoogI18nBidiDirectionalString && (b = a.getDirection());
  a = a.implementsGoogStringTypedString ? a.getTypedStringValue() : String(a);
  return goog.html.SafeHtml.createSafeHtmlSecurityPrivateDoNotAccessOrElse(goog.string.htmlEscape(a), b);
};
goog.html.SafeHtml.htmlEscapePreservingNewlines = function(a) {
  if (a instanceof goog.html.SafeHtml) {
    return a;
  }
  a = goog.html.SafeHtml.htmlEscape(a);
  return goog.html.SafeHtml.createSafeHtmlSecurityPrivateDoNotAccessOrElse(goog.string.newLineToBr(goog.html.SafeHtml.unwrap(a)), a.getDirection());
};
goog.html.SafeHtml.htmlEscapePreservingNewlinesAndSpaces = function(a) {
  if (a instanceof goog.html.SafeHtml) {
    return a;
  }
  a = goog.html.SafeHtml.htmlEscape(a);
  return goog.html.SafeHtml.createSafeHtmlSecurityPrivateDoNotAccessOrElse(goog.string.whitespaceEscape(goog.html.SafeHtml.unwrap(a)), a.getDirection());
};
goog.html.SafeHtml.from = goog.html.SafeHtml.htmlEscape;
goog.html.SafeHtml.VALID_NAMES_IN_TAG_ = /^[a-zA-Z0-9-]+$/;
goog.html.SafeHtml.URL_ATTRIBUTES_ = {action:!0, cite:!0, data:!0, formaction:!0, href:!0, manifest:!0, poster:!0, src:!0};
goog.html.SafeHtml.NOT_ALLOWED_TAG_NAMES_ = goog.object.createSet(goog.dom.TagName.EMBED, goog.dom.TagName.IFRAME, goog.dom.TagName.LINK, goog.dom.TagName.OBJECT, goog.dom.TagName.SCRIPT, goog.dom.TagName.STYLE, goog.dom.TagName.TEMPLATE);
goog.html.SafeHtml.create = function(a, b, c) {
  if (!goog.html.SafeHtml.VALID_NAMES_IN_TAG_.test(a)) {
    throw Error("Invalid tag name <" + a + ">.");
  }
  if (a.toUpperCase() in goog.html.SafeHtml.NOT_ALLOWED_TAG_NAMES_) {
    throw Error("Tag name <" + a + "> is not allowed for SafeHtml.");
  }
  return goog.html.SafeHtml.createSafeHtmlTagSecurityPrivateDoNotAccessOrElse(a, b, c);
};
goog.html.SafeHtml.createIframe = function(a, b, c, d) {
  var e = {};
  e.src = a || null;
  e.srcdoc = b || null;
  a = goog.html.SafeHtml.combineAttributes(e, {sandbox:""}, c);
  return goog.html.SafeHtml.createSafeHtmlTagSecurityPrivateDoNotAccessOrElse("iframe", a, d);
};
goog.html.SafeHtml.createStyle = function(a, b) {
  var c = goog.html.SafeHtml.combineAttributes({type:"text/css"}, {}, b), d = "";
  a = goog.array.concat(a);
  for (var e = 0;e < a.length;e++) {
    d += goog.html.SafeStyleSheet.unwrap(a[e]);
  }
  d = goog.html.SafeHtml.createSafeHtmlSecurityPrivateDoNotAccessOrElse(d, goog.i18n.bidi.Dir.NEUTRAL);
  return goog.html.SafeHtml.createSafeHtmlTagSecurityPrivateDoNotAccessOrElse("style", c, d);
};
goog.html.SafeHtml.getAttrNameAndValue_ = function(a, b, c) {
  if (c instanceof goog.string.Const) {
    c = goog.string.Const.unwrap(c);
  } else {
    if ("style" == b.toLowerCase()) {
      c = goog.html.SafeHtml.getStyleValue_(c);
    } else {
      if (/^on/i.test(b)) {
        throw Error('Attribute "' + b + '" requires goog.string.Const value, "' + c + '" given.');
      }
      if (b.toLowerCase() in goog.html.SafeHtml.URL_ATTRIBUTES_) {
        if (c instanceof goog.html.TrustedResourceUrl) {
          c = goog.html.TrustedResourceUrl.unwrap(c);
        } else {
          if (c instanceof goog.html.SafeUrl) {
            c = goog.html.SafeUrl.unwrap(c);
          } else {
            if (goog.isString(c)) {
              c = goog.html.SafeUrl.sanitize(c).getTypedStringValue();
            } else {
              throw Error('Attribute "' + b + '" on tag "' + a + '" requires goog.html.SafeUrl, goog.string.Const, or string, value "' + c + '" given.');
            }
          }
        }
      }
    }
  }
  c.implementsGoogStringTypedString && (c = c.getTypedStringValue());
  goog.asserts.assert(goog.isString(c) || goog.isNumber(c), "String or number value expected, got " + typeof c + " with value: " + c);
  return b + '="' + goog.string.htmlEscape(String(c)) + '"';
};
goog.html.SafeHtml.getStyleValue_ = function(a) {
  if (!goog.isObject(a)) {
    throw Error('The "style" attribute requires goog.html.SafeStyle or map of style properties, ' + typeof a + " given: " + a);
  }
  a instanceof goog.html.SafeStyle || (a = goog.html.SafeStyle.create(a));
  return goog.html.SafeStyle.unwrap(a);
};
goog.html.SafeHtml.createWithDir = function(a, b, c, d) {
  b = goog.html.SafeHtml.create(b, c, d);
  b.dir_ = a;
  return b;
};
goog.html.SafeHtml.concat = function(a) {
  var b = goog.i18n.bidi.Dir.NEUTRAL, c = "", d = function(a) {
    goog.isArray(a) ? goog.array.forEach(a, d) : (a = goog.html.SafeHtml.htmlEscape(a), c += goog.html.SafeHtml.unwrap(a), a = a.getDirection(), b == goog.i18n.bidi.Dir.NEUTRAL ? b = a : a != goog.i18n.bidi.Dir.NEUTRAL && b != a && (b = null));
  };
  goog.array.forEach(arguments, d);
  return goog.html.SafeHtml.createSafeHtmlSecurityPrivateDoNotAccessOrElse(c, b);
};
goog.html.SafeHtml.concatWithDir = function(a, b) {
  var c = goog.html.SafeHtml.concat(goog.array.slice(arguments, 1));
  c.dir_ = a;
  return c;
};
goog.html.SafeHtml.TYPE_MARKER_GOOG_HTML_SECURITY_PRIVATE_ = {};
goog.html.SafeHtml.createSafeHtmlSecurityPrivateDoNotAccessOrElse = function(a, b) {
  return (new goog.html.SafeHtml).initSecurityPrivateDoNotAccessOrElse_(a, b);
};
goog.html.SafeHtml.prototype.initSecurityPrivateDoNotAccessOrElse_ = function(a, b) {
  this.privateDoNotAccessOrElseSafeHtmlWrappedValue_ = a;
  this.dir_ = b;
  return this;
};
goog.html.SafeHtml.createSafeHtmlTagSecurityPrivateDoNotAccessOrElse = function(a, b, c) {
  var d = null, e = "<" + a;
  if (b) {
    for (var f in b) {
      if (!goog.html.SafeHtml.VALID_NAMES_IN_TAG_.test(f)) {
        throw Error('Invalid attribute name "' + f + '".');
      }
      var g = b[f];
      goog.isDefAndNotNull(g) && (e += " " + goog.html.SafeHtml.getAttrNameAndValue_(a, f, g));
    }
  }
  goog.isDefAndNotNull(c) ? goog.isArray(c) || (c = [c]) : c = [];
  goog.dom.tags.isVoidTag(a.toLowerCase()) ? (goog.asserts.assert(!c.length, "Void tag <" + a + "> does not allow content."), e += ">") : (d = goog.html.SafeHtml.concat(c), e += ">" + goog.html.SafeHtml.unwrap(d) + "</" + a + ">", d = d.getDirection());
  (a = b && b.dir) && (d = /^(ltr|rtl|auto)$/i.test(a) ? goog.i18n.bidi.Dir.NEUTRAL : null);
  return goog.html.SafeHtml.createSafeHtmlSecurityPrivateDoNotAccessOrElse(e, d);
};
goog.html.SafeHtml.combineAttributes = function(a, b, c) {
  var d = {}, e;
  for (e in a) {
    goog.asserts.assert(e.toLowerCase() == e, "Must be lower case"), d[e] = a[e];
  }
  for (e in b) {
    goog.asserts.assert(e.toLowerCase() == e, "Must be lower case"), d[e] = b[e];
  }
  for (e in c) {
    var f = e.toLowerCase();
    if (f in a) {
      throw Error('Cannot override "' + f + '" attribute, got "' + e + '" with value "' + c[e] + '"');
    }
    f in b && delete d[f];
    d[e] = c[e];
  }
  return d;
};
goog.html.SafeHtml.DOCTYPE_HTML = goog.html.SafeHtml.createSafeHtmlSecurityPrivateDoNotAccessOrElse("<!DOCTYPE html>", goog.i18n.bidi.Dir.NEUTRAL);
goog.html.SafeHtml.EMPTY = goog.html.SafeHtml.createSafeHtmlSecurityPrivateDoNotAccessOrElse("", goog.i18n.bidi.Dir.NEUTRAL);
goog.dom.safe = {};
goog.dom.safe.InsertAdjacentHtmlPosition = {AFTERBEGIN:"afterbegin", AFTEREND:"afterend", BEFOREBEGIN:"beforebegin", BEFOREEND:"beforeend"};
goog.dom.safe.insertAdjacentHtml = function(a, b, c) {
  a.insertAdjacentHTML(b, goog.html.SafeHtml.unwrap(c));
};
goog.dom.safe.setInnerHtml = function(a, b) {
  a.innerHTML = goog.html.SafeHtml.unwrap(b);
};
goog.dom.safe.setOuterHtml = function(a, b) {
  a.outerHTML = goog.html.SafeHtml.unwrap(b);
};
goog.dom.safe.documentWrite = function(a, b) {
  a.write(goog.html.SafeHtml.unwrap(b));
};
goog.dom.safe.setAnchorHref = function(a, b) {
  var c;
  c = b instanceof goog.html.SafeUrl ? b : goog.html.SafeUrl.sanitize(b);
  a.href = goog.html.SafeUrl.unwrap(c);
};
goog.dom.safe.setEmbedSrc = function(a, b) {
  a.src = goog.html.TrustedResourceUrl.unwrap(b);
};
goog.dom.safe.setFrameSrc = function(a, b) {
  a.src = goog.html.TrustedResourceUrl.unwrap(b);
};
goog.dom.safe.setIframeSrc = function(a, b) {
  a.src = goog.html.TrustedResourceUrl.unwrap(b);
};
goog.dom.safe.setLinkHrefAndRel = function(a, b, c) {
  a.rel = c;
  goog.string.caseInsensitiveContains(c, "stylesheet") ? (goog.asserts.assert(b instanceof goog.html.TrustedResourceUrl, 'URL must be TrustedResourceUrl because "rel" contains "stylesheet"'), a.href = goog.html.TrustedResourceUrl.unwrap(b)) : a.href = b instanceof goog.html.TrustedResourceUrl ? goog.html.TrustedResourceUrl.unwrap(b) : b instanceof goog.html.SafeUrl ? goog.html.SafeUrl.unwrap(b) : goog.html.SafeUrl.sanitize(b).getTypedStringValue();
};
goog.dom.safe.setObjectData = function(a, b) {
  a.data = goog.html.TrustedResourceUrl.unwrap(b);
};
goog.dom.safe.setScriptSrc = function(a, b) {
  a.src = goog.html.TrustedResourceUrl.unwrap(b);
};
goog.dom.safe.setLocationHref = function(a, b) {
  var c;
  c = b instanceof goog.html.SafeUrl ? b : goog.html.SafeUrl.sanitize(b);
  a.href = goog.html.SafeUrl.unwrap(c);
};
goog.dom.safe.openInWindow = function(a, b, c, d, e) {
  a = a instanceof goog.html.SafeUrl ? a : goog.html.SafeUrl.sanitize(a);
  return (b || window).open(goog.html.SafeUrl.unwrap(a), c ? goog.string.Const.unwrap(c) : "", d, e);
};
goog.math = {};
goog.math.randomInt = function(a) {
  return Math.floor(Math.random() * a);
};
goog.math.uniformRandom = function(a, b) {
  return a + Math.random() * (b - a);
};
goog.math.clamp = function(a, b, c) {
  return Math.min(Math.max(a, b), c);
};
goog.math.modulo = function(a, b) {
  var c = a % b;
  return 0 > c * b ? c + b : c;
};
goog.math.lerp = function(a, b, c) {
  return a + c * (b - a);
};
goog.math.nearlyEquals = function(a, b, c) {
  return Math.abs(a - b) <= (c || 1E-6);
};
goog.math.standardAngle = function(a) {
  return goog.math.modulo(a, 360);
};
goog.math.standardAngleInRadians = function(a) {
  return goog.math.modulo(a, 2 * Math.PI);
};
goog.math.toRadians = function(a) {
  return a * Math.PI / 180;
};
goog.math.toDegrees = function(a) {
  return 180 * a / Math.PI;
};
goog.math.angleDx = function(a, b) {
  return b * Math.cos(goog.math.toRadians(a));
};
goog.math.angleDy = function(a, b) {
  return b * Math.sin(goog.math.toRadians(a));
};
goog.math.angle = function(a, b, c, d) {
  return goog.math.standardAngle(goog.math.toDegrees(Math.atan2(d - b, c - a)));
};
goog.math.angleDifference = function(a, b) {
  var c = goog.math.standardAngle(b) - goog.math.standardAngle(a);
  180 < c ? c -= 360 : -180 >= c && (c = 360 + c);
  return c;
};
goog.math.sign = Math.sign || function(a) {
  return 0 < a ? 1 : 0 > a ? -1 : a;
};
goog.math.longestCommonSubsequence = function(a, b, c, d) {
  c = c || function(a, b) {
    return a == b;
  };
  d = d || function(b, c) {
    return a[b];
  };
  for (var e = a.length, f = b.length, g = [], h = 0;h < e + 1;h++) {
    g[h] = [], g[h][0] = 0;
  }
  for (var k = 0;k < f + 1;k++) {
    g[0][k] = 0;
  }
  for (h = 1;h <= e;h++) {
    for (k = 1;k <= f;k++) {
      c(a[h - 1], b[k - 1]) ? g[h][k] = g[h - 1][k - 1] + 1 : g[h][k] = Math.max(g[h - 1][k], g[h][k - 1]);
    }
  }
  for (var l = [], h = e, k = f;0 < h && 0 < k;) {
    c(a[h - 1], b[k - 1]) ? (l.unshift(d(h - 1, k - 1)), h--, k--) : g[h - 1][k] > g[h][k - 1] ? h-- : k--;
  }
  return l;
};
goog.math.sum = function(a) {
  return goog.array.reduce(arguments, function(a, c) {
    return a + c;
  }, 0);
};
goog.math.average = function(a) {
  return goog.math.sum.apply(null, arguments) / arguments.length;
};
goog.math.sampleVariance = function(a) {
  var b = arguments.length;
  if (2 > b) {
    return 0;
  }
  var c = goog.math.average.apply(null, arguments);
  return goog.math.sum.apply(null, goog.array.map(arguments, function(a) {
    return Math.pow(a - c, 2);
  })) / (b - 1);
};
goog.math.standardDeviation = function(a) {
  return Math.sqrt(goog.math.sampleVariance.apply(null, arguments));
};
goog.math.isInt = function(a) {
  return isFinite(a) && 0 == a % 1;
};
goog.math.isFiniteNumber = function(a) {
  return isFinite(a) && !isNaN(a);
};
goog.math.isNegativeZero = function(a) {
  return 0 == a && 0 > 1 / a;
};
goog.math.log10Floor = function(a) {
  if (0 < a) {
    var b = Math.round(Math.log(a) * Math.LOG10E);
    return b - (parseFloat("1e" + b) > a ? 1 : 0);
  }
  return 0 == a ? -Infinity : NaN;
};
goog.math.safeFloor = function(a, b) {
  goog.asserts.assert(!goog.isDef(b) || 0 < b);
  return Math.floor(a + (b || 2E-15));
};
goog.math.safeCeil = function(a, b) {
  goog.asserts.assert(!goog.isDef(b) || 0 < b);
  return Math.ceil(a - (b || 2E-15));
};
goog.math.Coordinate = function(a, b) {
  this.x = goog.isDef(a) ? a : 0;
  this.y = goog.isDef(b) ? b : 0;
};
goog.math.Coordinate.prototype.clone = function() {
  return new goog.math.Coordinate(this.x, this.y);
};
goog.DEBUG && (goog.math.Coordinate.prototype.toString = function() {
  return "(" + this.x + ", " + this.y + ")";
});
goog.math.Coordinate.equals = function(a, b) {
  return a == b ? !0 : a && b ? a.x == b.x && a.y == b.y : !1;
};
goog.math.Coordinate.distance = function(a, b) {
  var c = a.x - b.x, d = a.y - b.y;
  return Math.sqrt(c * c + d * d);
};
goog.math.Coordinate.magnitude = function(a) {
  return Math.sqrt(a.x * a.x + a.y * a.y);
};
goog.math.Coordinate.azimuth = function(a) {
  return goog.math.angle(0, 0, a.x, a.y);
};
goog.math.Coordinate.squaredDistance = function(a, b) {
  var c = a.x - b.x, d = a.y - b.y;
  return c * c + d * d;
};
goog.math.Coordinate.difference = function(a, b) {
  return new goog.math.Coordinate(a.x - b.x, a.y - b.y);
};
goog.math.Coordinate.sum = function(a, b) {
  return new goog.math.Coordinate(a.x + b.x, a.y + b.y);
};
goog.math.Coordinate.prototype.ceil = function() {
  this.x = Math.ceil(this.x);
  this.y = Math.ceil(this.y);
  return this;
};
goog.math.Coordinate.prototype.floor = function() {
  this.x = Math.floor(this.x);
  this.y = Math.floor(this.y);
  return this;
};
goog.math.Coordinate.prototype.round = function() {
  this.x = Math.round(this.x);
  this.y = Math.round(this.y);
  return this;
};
goog.math.Coordinate.prototype.translate = function(a, b) {
  a instanceof goog.math.Coordinate ? (this.x += a.x, this.y += a.y) : (this.x += a, goog.isNumber(b) && (this.y += b));
  return this;
};
goog.math.Coordinate.prototype.scale = function(a, b) {
  var c = goog.isNumber(b) ? b : a;
  this.x *= a;
  this.y *= c;
  return this;
};
goog.math.Coordinate.prototype.rotateRadians = function(a, b) {
  var c = b || new goog.math.Coordinate(0, 0), d = this.x, e = this.y, f = Math.cos(a), g = Math.sin(a);
  this.x = (d - c.x) * f - (e - c.y) * g + c.x;
  this.y = (d - c.x) * g + (e - c.y) * f + c.y;
};
goog.math.Coordinate.prototype.rotateDegrees = function(a, b) {
  this.rotateRadians(goog.math.toRadians(a), b);
};
goog.math.Size = function(a, b) {
  this.width = a;
  this.height = b;
};
goog.math.Size.equals = function(a, b) {
  return a == b ? !0 : a && b ? a.width == b.width && a.height == b.height : !1;
};
goog.math.Size.prototype.clone = function() {
  return new goog.math.Size(this.width, this.height);
};
goog.DEBUG && (goog.math.Size.prototype.toString = function() {
  return "(" + this.width + " x " + this.height + ")";
});
goog.math.Size.prototype.getLongest = function() {
  return Math.max(this.width, this.height);
};
goog.math.Size.prototype.getShortest = function() {
  return Math.min(this.width, this.height);
};
goog.math.Size.prototype.area = function() {
  return this.width * this.height;
};
goog.math.Size.prototype.perimeter = function() {
  return 2 * (this.width + this.height);
};
goog.math.Size.prototype.aspectRatio = function() {
  return this.width / this.height;
};
goog.math.Size.prototype.isEmpty = function() {
  return !this.area();
};
goog.math.Size.prototype.ceil = function() {
  this.width = Math.ceil(this.width);
  this.height = Math.ceil(this.height);
  return this;
};
goog.math.Size.prototype.fitsInside = function(a) {
  return this.width <= a.width && this.height <= a.height;
};
goog.math.Size.prototype.floor = function() {
  this.width = Math.floor(this.width);
  this.height = Math.floor(this.height);
  return this;
};
goog.math.Size.prototype.round = function() {
  this.width = Math.round(this.width);
  this.height = Math.round(this.height);
  return this;
};
goog.math.Size.prototype.scale = function(a, b) {
  var c = goog.isNumber(b) ? b : a;
  this.width *= a;
  this.height *= c;
  return this;
};
goog.math.Size.prototype.scaleToCover = function(a) {
  a = this.aspectRatio() <= a.aspectRatio() ? a.width / this.width : a.height / this.height;
  return this.scale(a);
};
goog.math.Size.prototype.scaleToFit = function(a) {
  a = this.aspectRatio() > a.aspectRatio() ? a.width / this.width : a.height / this.height;
  return this.scale(a);
};
goog.dom.ASSUME_QUIRKS_MODE = !1;
goog.dom.ASSUME_STANDARDS_MODE = !1;
goog.dom.COMPAT_MODE_KNOWN_ = goog.dom.ASSUME_QUIRKS_MODE || goog.dom.ASSUME_STANDARDS_MODE;
goog.dom.getDomHelper = function(a) {
  return a ? new goog.dom.DomHelper(goog.dom.getOwnerDocument(a)) : goog.dom.defaultDomHelper_ || (goog.dom.defaultDomHelper_ = new goog.dom.DomHelper);
};
goog.dom.getDocument = function() {
  return document;
};
goog.dom.getElement = function(a) {
  return goog.dom.getElementHelper_(document, a);
};
goog.dom.getElementHelper_ = function(a, b) {
  return goog.isString(b) ? a.getElementById(b) : b;
};
goog.dom.getRequiredElement = function(a) {
  return goog.dom.getRequiredElementHelper_(document, a);
};
goog.dom.getRequiredElementHelper_ = function(a, b) {
  goog.asserts.assertString(b);
  var c = goog.dom.getElementHelper_(a, b);
  return c = goog.asserts.assertElement(c, "No element found with id: " + b);
};
goog.dom.$ = goog.dom.getElement;
goog.dom.getElementsByTagNameAndClass = function(a, b, c) {
  return goog.dom.getElementsByTagNameAndClass_(document, a, b, c);
};
goog.dom.getElementsByClass = function(a, b) {
  var c = b || document;
  return goog.dom.canUseQuerySelector_(c) ? c.querySelectorAll("." + a) : goog.dom.getElementsByTagNameAndClass_(document, "*", a, b);
};
goog.dom.getElementByClass = function(a, b) {
  var c = b || document, d = null;
  return (d = c.getElementsByClassName ? c.getElementsByClassName(a)[0] : goog.dom.canUseQuerySelector_(c) ? c.querySelector("." + a) : goog.dom.getElementsByTagNameAndClass_(document, "*", a, b)[0]) || null;
};
goog.dom.getRequiredElementByClass = function(a, b) {
  var c = goog.dom.getElementByClass(a, b);
  return goog.asserts.assert(c, "No element found with className: " + a);
};
goog.dom.canUseQuerySelector_ = function(a) {
  return !(!a.querySelectorAll || !a.querySelector);
};
goog.dom.getElementsByTagNameAndClass_ = function(a, b, c, d) {
  a = d || a;
  b = b && "*" != b ? b.toUpperCase() : "";
  if (goog.dom.canUseQuerySelector_(a) && (b || c)) {
    return a.querySelectorAll(b + (c ? "." + c : ""));
  }
  if (c && a.getElementsByClassName) {
    a = a.getElementsByClassName(c);
    if (b) {
      d = {};
      for (var e = 0, f = 0, g;g = a[f];f++) {
        b == g.nodeName && (d[e++] = g);
      }
      d.length = e;
      return d;
    }
    return a;
  }
  a = a.getElementsByTagName(b || "*");
  if (c) {
    d = {};
    for (f = e = 0;g = a[f];f++) {
      b = g.className, "function" == typeof b.split && goog.array.contains(b.split(/\s+/), c) && (d[e++] = g);
    }
    d.length = e;
    return d;
  }
  return a;
};
goog.dom.$$ = goog.dom.getElementsByTagNameAndClass;
goog.dom.setProperties = function(a, b) {
  goog.object.forEach(b, function(b, d) {
    "style" == d ? a.style.cssText = b : "class" == d ? a.className = b : "for" == d ? a.htmlFor = b : goog.dom.DIRECT_ATTRIBUTE_MAP_.hasOwnProperty(d) ? a.setAttribute(goog.dom.DIRECT_ATTRIBUTE_MAP_[d], b) : goog.string.startsWith(d, "aria-") || goog.string.startsWith(d, "data-") ? a.setAttribute(d, b) : a[d] = b;
  });
};
goog.dom.DIRECT_ATTRIBUTE_MAP_ = {cellpadding:"cellPadding", cellspacing:"cellSpacing", colspan:"colSpan", frameborder:"frameBorder", height:"height", maxlength:"maxLength", role:"role", rowspan:"rowSpan", type:"type", usemap:"useMap", valign:"vAlign", width:"width"};
goog.dom.getViewportSize = function(a) {
  return goog.dom.getViewportSize_(a || window);
};
goog.dom.getViewportSize_ = function(a) {
  a = a.document;
  a = goog.dom.isCss1CompatMode_(a) ? a.documentElement : a.body;
  return new goog.math.Size(a.clientWidth, a.clientHeight);
};
goog.dom.getDocumentHeight = function() {
  return goog.dom.getDocumentHeight_(window);
};
goog.dom.getDocumentHeight_ = function(a) {
  var b = a.document, c = 0;
  if (b) {
    var c = b.body, d = b.documentElement;
    if (!d || !c) {
      return 0;
    }
    a = goog.dom.getViewportSize_(a).height;
    if (goog.dom.isCss1CompatMode_(b) && d.scrollHeight) {
      c = d.scrollHeight != a ? d.scrollHeight : d.offsetHeight;
    } else {
      var b = d.scrollHeight, e = d.offsetHeight;
      d.clientHeight != e && (b = c.scrollHeight, e = c.offsetHeight);
      c = b > a ? b > e ? b : e : b < e ? b : e;
    }
  }
  return c;
};
goog.dom.getPageScroll = function(a) {
  return goog.dom.getDomHelper((a || goog.global || window).document).getDocumentScroll();
};
goog.dom.getDocumentScroll = function() {
  return goog.dom.getDocumentScroll_(document);
};
goog.dom.getDocumentScroll_ = function(a) {
  var b = goog.dom.getDocumentScrollElement_(a);
  a = goog.dom.getWindow_(a);
  return goog.userAgent.IE && goog.userAgent.isVersionOrHigher("10") && a.pageYOffset != b.scrollTop ? new goog.math.Coordinate(b.scrollLeft, b.scrollTop) : new goog.math.Coordinate(a.pageXOffset || b.scrollLeft, a.pageYOffset || b.scrollTop);
};
goog.dom.getDocumentScrollElement = function() {
  return goog.dom.getDocumentScrollElement_(document);
};
goog.dom.getDocumentScrollElement_ = function(a) {
  return a.scrollingElement ? a.scrollingElement : !goog.userAgent.WEBKIT && goog.dom.isCss1CompatMode_(a) ? a.documentElement : a.body || a.documentElement;
};
goog.dom.getWindow = function(a) {
  return a ? goog.dom.getWindow_(a) : window;
};
goog.dom.getWindow_ = function(a) {
  return a.parentWindow || a.defaultView;
};
goog.dom.createDom = function(a, b, c) {
  return goog.dom.createDom_(document, arguments);
};
goog.dom.createDom_ = function(a, b) {
  var c = b[0], d = b[1];
  if (!goog.dom.BrowserFeature.CAN_ADD_NAME_OR_TYPE_ATTRIBUTES && d && (d.name || d.type)) {
    c = ["<", c];
    d.name && c.push(' name="', goog.string.htmlEscape(d.name), '"');
    if (d.type) {
      c.push(' type="', goog.string.htmlEscape(d.type), '"');
      var e = {};
      goog.object.extend(e, d);
      delete e.type;
      d = e;
    }
    c.push(">");
    c = c.join("");
  }
  c = a.createElement(c);
  d && (goog.isString(d) ? c.className = d : goog.isArray(d) ? c.className = d.join(" ") : goog.dom.setProperties(c, d));
  2 < b.length && goog.dom.append_(a, c, b, 2);
  return c;
};
goog.dom.append_ = function(a, b, c, d) {
  function e(c) {
    c && b.appendChild(goog.isString(c) ? a.createTextNode(c) : c);
  }
  for (;d < c.length;d++) {
    var f = c[d];
    goog.isArrayLike(f) && !goog.dom.isNodeLike(f) ? goog.array.forEach(goog.dom.isNodeList(f) ? goog.array.toArray(f) : f, e) : e(f);
  }
};
goog.dom.$dom = goog.dom.createDom;
goog.dom.createElement = function(a) {
  return document.createElement(a);
};
goog.dom.createTextNode = function(a) {
  return document.createTextNode(String(a));
};
goog.dom.createTable = function(a, b, c) {
  return goog.dom.createTable_(document, a, b, !!c);
};
goog.dom.createTable_ = function(a, b, c, d) {
  for (var e = a.createElement(goog.dom.TagName.TABLE), f = e.appendChild(a.createElement(goog.dom.TagName.TBODY)), g = 0;g < b;g++) {
    for (var h = a.createElement(goog.dom.TagName.TR), k = 0;k < c;k++) {
      var l = a.createElement(goog.dom.TagName.TD);
      d && goog.dom.setTextContent(l, goog.string.Unicode.NBSP);
      h.appendChild(l);
    }
    f.appendChild(h);
  }
  return e;
};
goog.dom.safeHtmlToNode = function(a) {
  return goog.dom.safeHtmlToNode_(document, a);
};
goog.dom.safeHtmlToNode_ = function(a, b) {
  var c = a.createElement(goog.dom.TagName.DIV);
  goog.dom.BrowserFeature.INNER_HTML_NEEDS_SCOPED_ELEMENT ? (goog.dom.safe.setInnerHtml(c, goog.html.SafeHtml.concat(goog.html.SafeHtml.create("br"), b)), c.removeChild(c.firstChild)) : goog.dom.safe.setInnerHtml(c, b);
  return goog.dom.childrenToNode_(a, c);
};
goog.dom.htmlToDocumentFragment = function(a) {
  return goog.dom.htmlToDocumentFragment_(document, a);
};
goog.dom.htmlToDocumentFragment_ = function(a, b) {
  var c = a.createElement(goog.dom.TagName.DIV);
  goog.dom.BrowserFeature.INNER_HTML_NEEDS_SCOPED_ELEMENT ? (c.innerHTML = "<br>" + b, c.removeChild(c.firstChild)) : c.innerHTML = b;
  return goog.dom.childrenToNode_(a, c);
};
goog.dom.childrenToNode_ = function(a, b) {
  if (1 == b.childNodes.length) {
    return b.removeChild(b.firstChild);
  }
  for (var c = a.createDocumentFragment();b.firstChild;) {
    c.appendChild(b.firstChild);
  }
  return c;
};
goog.dom.isCss1CompatMode = function() {
  return goog.dom.isCss1CompatMode_(document);
};
goog.dom.isCss1CompatMode_ = function(a) {
  return goog.dom.COMPAT_MODE_KNOWN_ ? goog.dom.ASSUME_STANDARDS_MODE : "CSS1Compat" == a.compatMode;
};
goog.dom.canHaveChildren = function(a) {
  if (a.nodeType != goog.dom.NodeType.ELEMENT) {
    return !1;
  }
  switch(a.tagName) {
    case goog.dom.TagName.APPLET:
    ;
    case goog.dom.TagName.AREA:
    ;
    case goog.dom.TagName.BASE:
    ;
    case goog.dom.TagName.BR:
    ;
    case goog.dom.TagName.COL:
    ;
    case goog.dom.TagName.COMMAND:
    ;
    case goog.dom.TagName.EMBED:
    ;
    case goog.dom.TagName.FRAME:
    ;
    case goog.dom.TagName.HR:
    ;
    case goog.dom.TagName.IMG:
    ;
    case goog.dom.TagName.INPUT:
    ;
    case goog.dom.TagName.IFRAME:
    ;
    case goog.dom.TagName.ISINDEX:
    ;
    case goog.dom.TagName.KEYGEN:
    ;
    case goog.dom.TagName.LINK:
    ;
    case goog.dom.TagName.NOFRAMES:
    ;
    case goog.dom.TagName.NOSCRIPT:
    ;
    case goog.dom.TagName.META:
    ;
    case goog.dom.TagName.OBJECT:
    ;
    case goog.dom.TagName.PARAM:
    ;
    case goog.dom.TagName.SCRIPT:
    ;
    case goog.dom.TagName.SOURCE:
    ;
    case goog.dom.TagName.STYLE:
    ;
    case goog.dom.TagName.TRACK:
    ;
    case goog.dom.TagName.WBR:
      return !1;
  }
  return !0;
};
goog.dom.appendChild = function(a, b) {
  a.appendChild(b);
};
goog.dom.append = function(a, b) {
  goog.dom.append_(goog.dom.getOwnerDocument(a), a, arguments, 1);
};
goog.dom.removeChildren = function(a) {
  for (var b;b = a.firstChild;) {
    a.removeChild(b);
  }
};
goog.dom.insertSiblingBefore = function(a, b) {
  b.parentNode && b.parentNode.insertBefore(a, b);
};
goog.dom.insertSiblingAfter = function(a, b) {
  b.parentNode && b.parentNode.insertBefore(a, b.nextSibling);
};
goog.dom.insertChildAt = function(a, b, c) {
  a.insertBefore(b, a.childNodes[c] || null);
};
goog.dom.removeNode = function(a) {
  return a && a.parentNode ? a.parentNode.removeChild(a) : null;
};
goog.dom.replaceNode = function(a, b) {
  var c = b.parentNode;
  c && c.replaceChild(a, b);
};
goog.dom.flattenElement = function(a) {
  var b, c = a.parentNode;
  if (c && c.nodeType != goog.dom.NodeType.DOCUMENT_FRAGMENT) {
    if (a.removeNode) {
      return a.removeNode(!1);
    }
    for (;b = a.firstChild;) {
      c.insertBefore(b, a);
    }
    return goog.dom.removeNode(a);
  }
};
goog.dom.getChildren = function(a) {
  return goog.dom.BrowserFeature.CAN_USE_CHILDREN_ATTRIBUTE && void 0 != a.children ? a.children : goog.array.filter(a.childNodes, function(a) {
    return a.nodeType == goog.dom.NodeType.ELEMENT;
  });
};
goog.dom.getFirstElementChild = function(a) {
  return goog.isDef(a.firstElementChild) ? a.firstElementChild : goog.dom.getNextElementNode_(a.firstChild, !0);
};
goog.dom.getLastElementChild = function(a) {
  return goog.isDef(a.lastElementChild) ? a.lastElementChild : goog.dom.getNextElementNode_(a.lastChild, !1);
};
goog.dom.getNextElementSibling = function(a) {
  return goog.isDef(a.nextElementSibling) ? a.nextElementSibling : goog.dom.getNextElementNode_(a.nextSibling, !0);
};
goog.dom.getPreviousElementSibling = function(a) {
  return goog.isDef(a.previousElementSibling) ? a.previousElementSibling : goog.dom.getNextElementNode_(a.previousSibling, !1);
};
goog.dom.getNextElementNode_ = function(a, b) {
  for (;a && a.nodeType != goog.dom.NodeType.ELEMENT;) {
    a = b ? a.nextSibling : a.previousSibling;
  }
  return a;
};
goog.dom.getNextNode = function(a) {
  if (!a) {
    return null;
  }
  if (a.firstChild) {
    return a.firstChild;
  }
  for (;a && !a.nextSibling;) {
    a = a.parentNode;
  }
  return a ? a.nextSibling : null;
};
goog.dom.getPreviousNode = function(a) {
  if (!a) {
    return null;
  }
  if (!a.previousSibling) {
    return a.parentNode;
  }
  for (a = a.previousSibling;a && a.lastChild;) {
    a = a.lastChild;
  }
  return a;
};
goog.dom.isNodeLike = function(a) {
  return goog.isObject(a) && 0 < a.nodeType;
};
goog.dom.isElement = function(a) {
  return goog.isObject(a) && a.nodeType == goog.dom.NodeType.ELEMENT;
};
goog.dom.isWindow = function(a) {
  return goog.isObject(a) && a.window == a;
};
goog.dom.getParentElement = function(a) {
  var b;
  if (goog.dom.BrowserFeature.CAN_USE_PARENT_ELEMENT_PROPERTY && !(goog.userAgent.IE && goog.userAgent.isVersionOrHigher("9") && !goog.userAgent.isVersionOrHigher("10") && goog.global.SVGElement && a instanceof goog.global.SVGElement) && (b = a.parentElement)) {
    return b;
  }
  b = a.parentNode;
  return goog.dom.isElement(b) ? b : null;
};
goog.dom.contains = function(a, b) {
  if (a.contains && b.nodeType == goog.dom.NodeType.ELEMENT) {
    return a == b || a.contains(b);
  }
  if ("undefined" != typeof a.compareDocumentPosition) {
    return a == b || Boolean(a.compareDocumentPosition(b) & 16);
  }
  for (;b && a != b;) {
    b = b.parentNode;
  }
  return b == a;
};
goog.dom.compareNodeOrder = function(a, b) {
  if (a == b) {
    return 0;
  }
  if (a.compareDocumentPosition) {
    return a.compareDocumentPosition(b) & 2 ? 1 : -1;
  }
  if (goog.userAgent.IE && !goog.userAgent.isDocumentModeOrHigher(9)) {
    if (a.nodeType == goog.dom.NodeType.DOCUMENT) {
      return -1;
    }
    if (b.nodeType == goog.dom.NodeType.DOCUMENT) {
      return 1;
    }
  }
  if ("sourceIndex" in a || a.parentNode && "sourceIndex" in a.parentNode) {
    var c = a.nodeType == goog.dom.NodeType.ELEMENT, d = b.nodeType == goog.dom.NodeType.ELEMENT;
    if (c && d) {
      return a.sourceIndex - b.sourceIndex;
    }
    var e = a.parentNode, f = b.parentNode;
    return e == f ? goog.dom.compareSiblingOrder_(a, b) : !c && goog.dom.contains(e, b) ? -1 * goog.dom.compareParentsDescendantNodeIe_(a, b) : !d && goog.dom.contains(f, a) ? goog.dom.compareParentsDescendantNodeIe_(b, a) : (c ? a.sourceIndex : e.sourceIndex) - (d ? b.sourceIndex : f.sourceIndex);
  }
  d = goog.dom.getOwnerDocument(a);
  c = d.createRange();
  c.selectNode(a);
  c.collapse(!0);
  d = d.createRange();
  d.selectNode(b);
  d.collapse(!0);
  return c.compareBoundaryPoints(goog.global.Range.START_TO_END, d);
};
goog.dom.compareParentsDescendantNodeIe_ = function(a, b) {
  var c = a.parentNode;
  if (c == b) {
    return -1;
  }
  for (var d = b;d.parentNode != c;) {
    d = d.parentNode;
  }
  return goog.dom.compareSiblingOrder_(d, a);
};
goog.dom.compareSiblingOrder_ = function(a, b) {
  for (var c = b;c = c.previousSibling;) {
    if (c == a) {
      return -1;
    }
  }
  return 1;
};
goog.dom.findCommonAncestor = function(a) {
  var b, c = arguments.length;
  if (!c) {
    return null;
  }
  if (1 == c) {
    return arguments[0];
  }
  var d = [], e = Infinity;
  for (b = 0;b < c;b++) {
    for (var f = [], g = arguments[b];g;) {
      f.unshift(g), g = g.parentNode;
    }
    d.push(f);
    e = Math.min(e, f.length);
  }
  f = null;
  for (b = 0;b < e;b++) {
    for (var g = d[0][b], h = 1;h < c;h++) {
      if (g != d[h][b]) {
        return f;
      }
    }
    f = g;
  }
  return f;
};
goog.dom.getOwnerDocument = function(a) {
  goog.asserts.assert(a, "Node cannot be null or undefined.");
  return a.nodeType == goog.dom.NodeType.DOCUMENT ? a : a.ownerDocument || a.document;
};
goog.dom.getFrameContentDocument = function(a) {
  return a.contentDocument || a.contentWindow.document;
};
goog.dom.getFrameContentWindow = function(a) {
  return a.contentWindow || goog.dom.getWindow(goog.dom.getFrameContentDocument(a));
};
goog.dom.setTextContent = function(a, b) {
  goog.asserts.assert(null != a, "goog.dom.setTextContent expects a non-null value for node");
  if ("textContent" in a) {
    a.textContent = b;
  } else {
    if (a.nodeType == goog.dom.NodeType.TEXT) {
      a.data = b;
    } else {
      if (a.firstChild && a.firstChild.nodeType == goog.dom.NodeType.TEXT) {
        for (;a.lastChild != a.firstChild;) {
          a.removeChild(a.lastChild);
        }
        a.firstChild.data = b;
      } else {
        goog.dom.removeChildren(a);
        var c = goog.dom.getOwnerDocument(a);
        a.appendChild(c.createTextNode(String(b)));
      }
    }
  }
};
goog.dom.getOuterHtml = function(a) {
  if ("outerHTML" in a) {
    return a.outerHTML;
  }
  var b = goog.dom.getOwnerDocument(a).createElement(goog.dom.TagName.DIV);
  b.appendChild(a.cloneNode(!0));
  return b.innerHTML;
};
goog.dom.findNode = function(a, b) {
  var c = [];
  return goog.dom.findNodes_(a, b, c, !0) ? c[0] : void 0;
};
goog.dom.findNodes = function(a, b) {
  var c = [];
  goog.dom.findNodes_(a, b, c, !1);
  return c;
};
goog.dom.findNodes_ = function(a, b, c, d) {
  if (null != a) {
    for (a = a.firstChild;a;) {
      if (b(a) && (c.push(a), d) || goog.dom.findNodes_(a, b, c, d)) {
        return !0;
      }
      a = a.nextSibling;
    }
  }
  return !1;
};
goog.dom.TAGS_TO_IGNORE_ = {SCRIPT:1, STYLE:1, HEAD:1, IFRAME:1, OBJECT:1};
goog.dom.PREDEFINED_TAG_VALUES_ = {IMG:" ", BR:"\n"};
goog.dom.isFocusableTabIndex = function(a) {
  return goog.dom.hasSpecifiedTabIndex_(a) && goog.dom.isTabIndexFocusable_(a);
};
goog.dom.setFocusableTabIndex = function(a, b) {
  b ? a.tabIndex = 0 : (a.tabIndex = -1, a.removeAttribute("tabIndex"));
};
goog.dom.isFocusable = function(a) {
  var b;
  return (b = goog.dom.nativelySupportsFocus_(a) ? !a.disabled && (!goog.dom.hasSpecifiedTabIndex_(a) || goog.dom.isTabIndexFocusable_(a)) : goog.dom.isFocusableTabIndex(a)) && goog.userAgent.IE ? goog.dom.hasNonZeroBoundingRect_(a) : b;
};
goog.dom.hasSpecifiedTabIndex_ = function(a) {
  a = a.getAttributeNode("tabindex");
  return goog.isDefAndNotNull(a) && a.specified;
};
goog.dom.isTabIndexFocusable_ = function(a) {
  a = a.tabIndex;
  return goog.isNumber(a) && 0 <= a && 32768 > a;
};
goog.dom.nativelySupportsFocus_ = function(a) {
  return a.tagName == goog.dom.TagName.A || a.tagName == goog.dom.TagName.INPUT || a.tagName == goog.dom.TagName.TEXTAREA || a.tagName == goog.dom.TagName.SELECT || a.tagName == goog.dom.TagName.BUTTON;
};
goog.dom.hasNonZeroBoundingRect_ = function(a) {
  a = goog.isFunction(a.getBoundingClientRect) ? a.getBoundingClientRect() : {height:a.offsetHeight, width:a.offsetWidth};
  return goog.isDefAndNotNull(a) && 0 < a.height && 0 < a.width;
};
goog.dom.getTextContent = function(a) {
  if (goog.dom.BrowserFeature.CAN_USE_INNER_TEXT && "innerText" in a) {
    a = goog.string.canonicalizeNewlines(a.innerText);
  } else {
    var b = [];
    goog.dom.getTextContent_(a, b, !0);
    a = b.join("");
  }
  a = a.replace(/ \xAD /g, " ").replace(/\xAD/g, "");
  a = a.replace(/\u200B/g, "");
  goog.dom.BrowserFeature.CAN_USE_INNER_TEXT || (a = a.replace(/ +/g, " "));
  " " != a && (a = a.replace(/^\s*/, ""));
  return a;
};
goog.dom.getRawTextContent = function(a) {
  var b = [];
  goog.dom.getTextContent_(a, b, !1);
  return b.join("");
};
goog.dom.getTextContent_ = function(a, b, c) {
  if (!(a.nodeName in goog.dom.TAGS_TO_IGNORE_)) {
    if (a.nodeType == goog.dom.NodeType.TEXT) {
      c ? b.push(String(a.nodeValue).replace(/(\r\n|\r|\n)/g, "")) : b.push(a.nodeValue);
    } else {
      if (a.nodeName in goog.dom.PREDEFINED_TAG_VALUES_) {
        b.push(goog.dom.PREDEFINED_TAG_VALUES_[a.nodeName]);
      } else {
        for (a = a.firstChild;a;) {
          goog.dom.getTextContent_(a, b, c), a = a.nextSibling;
        }
      }
    }
  }
};
goog.dom.getNodeTextLength = function(a) {
  return goog.dom.getTextContent(a).length;
};
goog.dom.getNodeTextOffset = function(a, b) {
  for (var c = b || goog.dom.getOwnerDocument(a).body, d = [];a && a != c;) {
    for (var e = a;e = e.previousSibling;) {
      d.unshift(goog.dom.getTextContent(e));
    }
    a = a.parentNode;
  }
  return goog.string.trimLeft(d.join("")).replace(/ +/g, " ").length;
};
goog.dom.getNodeAtOffset = function(a, b, c) {
  a = [a];
  for (var d = 0, e = null;0 < a.length && d < b;) {
    if (e = a.pop(), !(e.nodeName in goog.dom.TAGS_TO_IGNORE_)) {
      if (e.nodeType == goog.dom.NodeType.TEXT) {
        var f = e.nodeValue.replace(/(\r\n|\r|\n)/g, "").replace(/ +/g, " "), d = d + f.length
      } else {
        if (e.nodeName in goog.dom.PREDEFINED_TAG_VALUES_) {
          d += goog.dom.PREDEFINED_TAG_VALUES_[e.nodeName].length;
        } else {
          for (f = e.childNodes.length - 1;0 <= f;f--) {
            a.push(e.childNodes[f]);
          }
        }
      }
    }
  }
  goog.isObject(c) && (c.remainder = e ? e.nodeValue.length + b - d - 1 : 0, c.node = e);
  return e;
};
goog.dom.isNodeList = function(a) {
  if (a && "number" == typeof a.length) {
    if (goog.isObject(a)) {
      return "function" == typeof a.item || "string" == typeof a.item;
    }
    if (goog.isFunction(a)) {
      return "function" == typeof a.item;
    }
  }
  return !1;
};
goog.dom.getAncestorByTagNameAndClass = function(a, b, c, d) {
  if (!b && !c) {
    return null;
  }
  var e = b ? b.toUpperCase() : null;
  return goog.dom.getAncestor(a, function(a) {
    return (!e || a.nodeName == e) && (!c || goog.isString(a.className) && goog.array.contains(a.className.split(/\s+/), c));
  }, !0, d);
};
goog.dom.getAncestorByClass = function(a, b, c) {
  return goog.dom.getAncestorByTagNameAndClass(a, null, b, c);
};
goog.dom.getAncestor = function(a, b, c, d) {
  c || (a = a.parentNode);
  c = null == d;
  for (var e = 0;a && (c || e <= d);) {
    goog.asserts.assert("parentNode" != a.name);
    if (b(a)) {
      return a;
    }
    a = a.parentNode;
    e++;
  }
  return null;
};
goog.dom.getActiveElement = function(a) {
  try {
    return a && a.activeElement;
  } catch (b) {
  }
  return null;
};
goog.dom.getPixelRatio = function() {
  var a = goog.dom.getWindow();
  return goog.isDef(a.devicePixelRatio) ? a.devicePixelRatio : a.matchMedia ? goog.dom.matchesPixelRatio_(.75) || goog.dom.matchesPixelRatio_(1.5) || goog.dom.matchesPixelRatio_(2) || goog.dom.matchesPixelRatio_(3) || 1 : 1;
};
goog.dom.matchesPixelRatio_ = function(a) {
  return goog.dom.getWindow().matchMedia("(-webkit-min-device-pixel-ratio: " + a + "),(min--moz-device-pixel-ratio: " + a + "),(min-resolution: " + a + "dppx)").matches ? a : 0;
};
goog.dom.DomHelper = function(a) {
  this.document_ = a || goog.global.document || document;
};
goog.dom.DomHelper.prototype.getDomHelper = goog.dom.getDomHelper;
goog.dom.DomHelper.prototype.setDocument = function(a) {
  this.document_ = a;
};
goog.dom.DomHelper.prototype.getDocument = function() {
  return this.document_;
};
goog.dom.DomHelper.prototype.getElement = function(a) {
  return goog.dom.getElementHelper_(this.document_, a);
};
goog.dom.DomHelper.prototype.getRequiredElement = function(a) {
  return goog.dom.getRequiredElementHelper_(this.document_, a);
};
goog.dom.DomHelper.prototype.$ = goog.dom.DomHelper.prototype.getElement;
goog.dom.DomHelper.prototype.getElementsByTagNameAndClass = function(a, b, c) {
  return goog.dom.getElementsByTagNameAndClass_(this.document_, a, b, c);
};
goog.dom.DomHelper.prototype.getElementsByClass = function(a, b) {
  return goog.dom.getElementsByClass(a, b || this.document_);
};
goog.dom.DomHelper.prototype.getElementByClass = function(a, b) {
  return goog.dom.getElementByClass(a, b || this.document_);
};
goog.dom.DomHelper.prototype.getRequiredElementByClass = function(a, b) {
  return goog.dom.getRequiredElementByClass(a, b || this.document_);
};
goog.dom.DomHelper.prototype.$$ = goog.dom.DomHelper.prototype.getElementsByTagNameAndClass;
goog.dom.DomHelper.prototype.setProperties = goog.dom.setProperties;
goog.dom.DomHelper.prototype.getViewportSize = function(a) {
  return goog.dom.getViewportSize(a || this.getWindow());
};
goog.dom.DomHelper.prototype.getDocumentHeight = function() {
  return goog.dom.getDocumentHeight_(this.getWindow());
};
goog.dom.DomHelper.prototype.createDom = function(a, b, c) {
  return goog.dom.createDom_(this.document_, arguments);
};
goog.dom.DomHelper.prototype.$dom = goog.dom.DomHelper.prototype.createDom;
goog.dom.DomHelper.prototype.createElement = function(a) {
  return this.document_.createElement(a);
};
goog.dom.DomHelper.prototype.createTextNode = function(a) {
  return this.document_.createTextNode(String(a));
};
goog.dom.DomHelper.prototype.createTable = function(a, b, c) {
  return goog.dom.createTable_(this.document_, a, b, !!c);
};
goog.dom.DomHelper.prototype.safeHtmlToNode = function(a) {
  return goog.dom.safeHtmlToNode_(this.document_, a);
};
goog.dom.DomHelper.prototype.htmlToDocumentFragment = function(a) {
  return goog.dom.htmlToDocumentFragment_(this.document_, a);
};
goog.dom.DomHelper.prototype.isCss1CompatMode = function() {
  return goog.dom.isCss1CompatMode_(this.document_);
};
goog.dom.DomHelper.prototype.getWindow = function() {
  return goog.dom.getWindow_(this.document_);
};
goog.dom.DomHelper.prototype.getDocumentScrollElement = function() {
  return goog.dom.getDocumentScrollElement_(this.document_);
};
goog.dom.DomHelper.prototype.getDocumentScroll = function() {
  return goog.dom.getDocumentScroll_(this.document_);
};
goog.dom.DomHelper.prototype.getActiveElement = function(a) {
  return goog.dom.getActiveElement(a || this.document_);
};
goog.dom.DomHelper.prototype.appendChild = goog.dom.appendChild;
goog.dom.DomHelper.prototype.append = goog.dom.append;
goog.dom.DomHelper.prototype.canHaveChildren = goog.dom.canHaveChildren;
goog.dom.DomHelper.prototype.removeChildren = goog.dom.removeChildren;
goog.dom.DomHelper.prototype.insertSiblingBefore = goog.dom.insertSiblingBefore;
goog.dom.DomHelper.prototype.insertSiblingAfter = goog.dom.insertSiblingAfter;
goog.dom.DomHelper.prototype.insertChildAt = goog.dom.insertChildAt;
goog.dom.DomHelper.prototype.removeNode = goog.dom.removeNode;
goog.dom.DomHelper.prototype.replaceNode = goog.dom.replaceNode;
goog.dom.DomHelper.prototype.flattenElement = goog.dom.flattenElement;
goog.dom.DomHelper.prototype.getChildren = goog.dom.getChildren;
goog.dom.DomHelper.prototype.getFirstElementChild = goog.dom.getFirstElementChild;
goog.dom.DomHelper.prototype.getLastElementChild = goog.dom.getLastElementChild;
goog.dom.DomHelper.prototype.getNextElementSibling = goog.dom.getNextElementSibling;
goog.dom.DomHelper.prototype.getPreviousElementSibling = goog.dom.getPreviousElementSibling;
goog.dom.DomHelper.prototype.getNextNode = goog.dom.getNextNode;
goog.dom.DomHelper.prototype.getPreviousNode = goog.dom.getPreviousNode;
goog.dom.DomHelper.prototype.isNodeLike = goog.dom.isNodeLike;
goog.dom.DomHelper.prototype.isElement = goog.dom.isElement;
goog.dom.DomHelper.prototype.isWindow = goog.dom.isWindow;
goog.dom.DomHelper.prototype.getParentElement = goog.dom.getParentElement;
goog.dom.DomHelper.prototype.contains = goog.dom.contains;
goog.dom.DomHelper.prototype.compareNodeOrder = goog.dom.compareNodeOrder;
goog.dom.DomHelper.prototype.findCommonAncestor = goog.dom.findCommonAncestor;
goog.dom.DomHelper.prototype.getOwnerDocument = goog.dom.getOwnerDocument;
goog.dom.DomHelper.prototype.getFrameContentDocument = goog.dom.getFrameContentDocument;
goog.dom.DomHelper.prototype.getFrameContentWindow = goog.dom.getFrameContentWindow;
goog.dom.DomHelper.prototype.setTextContent = goog.dom.setTextContent;
goog.dom.DomHelper.prototype.getOuterHtml = goog.dom.getOuterHtml;
goog.dom.DomHelper.prototype.findNode = goog.dom.findNode;
goog.dom.DomHelper.prototype.findNodes = goog.dom.findNodes;
goog.dom.DomHelper.prototype.isFocusableTabIndex = goog.dom.isFocusableTabIndex;
goog.dom.DomHelper.prototype.setFocusableTabIndex = goog.dom.setFocusableTabIndex;
goog.dom.DomHelper.prototype.isFocusable = goog.dom.isFocusable;
goog.dom.DomHelper.prototype.getTextContent = goog.dom.getTextContent;
goog.dom.DomHelper.prototype.getNodeTextLength = goog.dom.getNodeTextLength;
goog.dom.DomHelper.prototype.getNodeTextOffset = goog.dom.getNodeTextOffset;
goog.dom.DomHelper.prototype.getNodeAtOffset = goog.dom.getNodeAtOffset;
goog.dom.DomHelper.prototype.isNodeList = goog.dom.isNodeList;
goog.dom.DomHelper.prototype.getAncestorByTagNameAndClass = goog.dom.getAncestorByTagNameAndClass;
goog.dom.DomHelper.prototype.getAncestorByClass = goog.dom.getAncestorByClass;
goog.dom.DomHelper.prototype.getAncestor = goog.dom.getAncestor;
goog.json = {};
goog.json.USE_NATIVE_JSON = !1;
goog.json.isValid = function(a) {
  return /^\s*$/.test(a) ? !1 : /^[\],:{}\s\u2028\u2029]*$/.test(a.replace(/\\["\\\/bfnrtu]/g, "@").replace(/"[^"\\\n\r\u2028\u2029\x00-\x08\x0a-\x1f]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, "]").replace(/(?:^|:|,)(?:[\s\u2028\u2029]*\[)+/g, ""));
};
goog.json.parse = goog.json.USE_NATIVE_JSON ? goog.global.JSON.parse : function(a) {
  a = String(a);
  if (goog.json.isValid(a)) {
    try {
      return eval("(" + a + ")");
    } catch (b) {
    }
  }
  throw Error("Invalid JSON string: " + a);
};
goog.json.unsafeParse = goog.json.USE_NATIVE_JSON ? goog.global.JSON.parse : function(a) {
  return eval("(" + a + ")");
};
goog.json.serialize = goog.json.USE_NATIVE_JSON ? goog.global.JSON.stringify : function(a, b) {
  return (new goog.json.Serializer(b)).serialize(a);
};
goog.json.Serializer = function(a) {
  this.replacer_ = a;
};
goog.json.Serializer.prototype.serialize = function(a) {
  var b = [];
  this.serializeInternal(a, b);
  return b.join("");
};
goog.json.Serializer.prototype.serializeInternal = function(a, b) {
  if (null == a) {
    b.push("null");
  } else {
    if ("object" == typeof a) {
      if (goog.isArray(a)) {
        this.serializeArray(a, b);
        return;
      }
      if (a instanceof String || a instanceof Number || a instanceof Boolean) {
        a = a.valueOf();
      } else {
        this.serializeObject_(a, b);
        return;
      }
    }
    switch(typeof a) {
      case "string":
        this.serializeString_(a, b);
        break;
      case "number":
        this.serializeNumber_(a, b);
        break;
      case "boolean":
        b.push(a);
        break;
      case "function":
        b.push("null");
        break;
      default:
        throw Error("Unknown type: " + typeof a);;
    }
  }
};
goog.json.Serializer.charToJsonCharCache_ = {'"':'\\"', "\\":"\\\\", "/":"\\/", "\b":"\\b", "\f":"\\f", "\n":"\\n", "\r":"\\r", "\t":"\\t", "\x0B":"\\u000b"};
goog.json.Serializer.charsToReplace_ = /\uffff/.test("\uffff") ? /[\\\"\x00-\x1f\x7f-\uffff]/g : /[\\\"\x00-\x1f\x7f-\xff]/g;
goog.json.Serializer.prototype.serializeString_ = function(a, b) {
  b.push('"', a.replace(goog.json.Serializer.charsToReplace_, function(a) {
    var b = goog.json.Serializer.charToJsonCharCache_[a];
    b || (b = "\\u" + (a.charCodeAt(0) | 65536).toString(16).substr(1), goog.json.Serializer.charToJsonCharCache_[a] = b);
    return b;
  }), '"');
};
goog.json.Serializer.prototype.serializeNumber_ = function(a, b) {
  b.push(isFinite(a) && !isNaN(a) ? a : "null");
};
goog.json.Serializer.prototype.serializeArray = function(a, b) {
  var c = a.length;
  b.push("[");
  for (var d = "", e = 0;e < c;e++) {
    b.push(d), d = a[e], this.serializeInternal(this.replacer_ ? this.replacer_.call(a, String(e), d) : d, b), d = ",";
  }
  b.push("]");
};
goog.json.Serializer.prototype.serializeObject_ = function(a, b) {
  b.push("{");
  var c = "", d;
  for (d in a) {
    if (Object.prototype.hasOwnProperty.call(a, d)) {
      var e = a[d];
      "function" != typeof e && (b.push(c), this.serializeString_(d, b), b.push(":"), this.serializeInternal(this.replacer_ ? this.replacer_.call(a, d, e) : e, b), c = ",");
    }
  }
  b.push("}");
};
goog.proto2.ObjectSerializer = function(a) {
  this.keyOption_ = a;
};
goog.inherits(goog.proto2.ObjectSerializer, goog.proto2.Serializer);
goog.proto2.ObjectSerializer.KeyOption = {TAG:0, NAME:1};
goog.proto2.ObjectSerializer.prototype.serialize = function(a) {
  for (var b = a.getDescriptor().getFields(), c = {}, d = 0;d < b.length;d++) {
    var e = b[d], f = this.keyOption_ == goog.proto2.ObjectSerializer.KeyOption.NAME ? e.getName() : e.getTag();
    if (a.has(e)) {
      if (e.isRepeated()) {
        var g = [];
        c[f] = g;
        for (f = 0;f < a.countOf(e);f++) {
          g.push(this.getSerializedValue(e, a.get(e, f)));
        }
      } else {
        c[f] = this.getSerializedValue(e, a.get(e));
      }
    }
  }
  a.forEachUnknown(function(a, b) {
    c[a] = b;
  });
  return c;
};
goog.proto2.ObjectSerializer.prototype.getDeserializedValue = function(a, b) {
  return a.getFieldType() == goog.proto2.FieldDescriptor.FieldType.BOOL && goog.isNumber(b) ? Boolean(b) : goog.proto2.ObjectSerializer.superClass_.getDeserializedValue.call(this, a, b);
};
goog.proto2.ObjectSerializer.prototype.deserializeTo = function(a, b) {
  var c = a.getDescriptor(), d;
  for (d in b) {
    var e, f = b[d], g = goog.string.isNumeric(d);
    g ? e = c.findFieldByTag(d) : (goog.asserts.assert(this.keyOption_ == goog.proto2.ObjectSerializer.KeyOption.NAME), e = c.findFieldByName(d));
    if (e) {
      if (e.isRepeated()) {
        for (goog.asserts.assert(goog.isArray(f)), g = 0;g < f.length;g++) {
          a.add(e, this.getDeserializedValue(e, f[g]));
        }
      } else {
        goog.asserts.assert(!goog.isArray(f)), a.set(e, this.getDeserializedValue(e, f));
      }
    } else {
      g ? a.setUnknown(Number(d), f) : goog.asserts.fail("Failed to find field: " + e);
    }
  }
};
/*

 Copyright (C) 2011 The Libphonenumber Authors.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/
var i18n = {phonenumbers:{}};
i18n.phonenumbers.RegionCode = {UN001:"001", AD:"AD", AE:"AE", AO:"AO", AQ:"AQ", AR:"AR", AU:"AU", BB:"BB", BR:"BR", BS:"BS", BY:"BY", CA:"CA", CH:"CH", CN:"CN", CS:"CS", CX:"CX", DE:"DE", GB:"GB", HU:"HU", IT:"IT", JP:"JP", KR:"KR", MX:"MX", NZ:"NZ", PL:"PL", RE:"RE", SE:"SE", SG:"SG", US:"US", YT:"YT", ZW:"ZW", ZZ:"ZZ"};
/*

 Protocol Buffer 2 Copyright 2008 Google Inc.
 All other code copyright its respective owners.
 Copyright (C) 2010 The Libphonenumber Authors

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/
i18n.phonenumbers.NumberFormat = function() {
  goog.proto2.Message.call(this);
};
goog.inherits(i18n.phonenumbers.NumberFormat, goog.proto2.Message);
i18n.phonenumbers.NumberFormat.prototype.getPattern = function() {
  return this.get$Value(1);
};
i18n.phonenumbers.NumberFormat.prototype.getPatternOrDefault = function() {
  return this.get$ValueOrDefault(1);
};
i18n.phonenumbers.NumberFormat.prototype.setPattern = function(a) {
  this.set$Value(1, a);
};
i18n.phonenumbers.NumberFormat.prototype.hasPattern = function() {
  return this.has$Value(1);
};
i18n.phonenumbers.NumberFormat.prototype.patternCount = function() {
  return this.count$Values(1);
};
i18n.phonenumbers.NumberFormat.prototype.clearPattern = function() {
  this.clear$Field(1);
};
i18n.phonenumbers.NumberFormat.prototype.getFormat = function() {
  return this.get$Value(2);
};
i18n.phonenumbers.NumberFormat.prototype.getFormatOrDefault = function() {
  return this.get$ValueOrDefault(2);
};
i18n.phonenumbers.NumberFormat.prototype.setFormat = function(a) {
  this.set$Value(2, a);
};
i18n.phonenumbers.NumberFormat.prototype.hasFormat = function() {
  return this.has$Value(2);
};
i18n.phonenumbers.NumberFormat.prototype.formatCount = function() {
  return this.count$Values(2);
};
i18n.phonenumbers.NumberFormat.prototype.clearFormat = function() {
  this.clear$Field(2);
};
i18n.phonenumbers.NumberFormat.prototype.getLeadingDigitsPattern = function(a) {
  return this.get$Value(3, a);
};
i18n.phonenumbers.NumberFormat.prototype.getLeadingDigitsPatternOrDefault = function(a) {
  return this.get$ValueOrDefault(3, a);
};
i18n.phonenumbers.NumberFormat.prototype.addLeadingDigitsPattern = function(a) {
  this.add$Value(3, a);
};
i18n.phonenumbers.NumberFormat.prototype.leadingDigitsPatternArray = function() {
  return this.array$Values(3);
};
i18n.phonenumbers.NumberFormat.prototype.hasLeadingDigitsPattern = function() {
  return this.has$Value(3);
};
i18n.phonenumbers.NumberFormat.prototype.leadingDigitsPatternCount = function() {
  return this.count$Values(3);
};
i18n.phonenumbers.NumberFormat.prototype.clearLeadingDigitsPattern = function() {
  this.clear$Field(3);
};
i18n.phonenumbers.NumberFormat.prototype.getNationalPrefixFormattingRule = function() {
  return this.get$Value(4);
};
i18n.phonenumbers.NumberFormat.prototype.getNationalPrefixFormattingRuleOrDefault = function() {
  return this.get$ValueOrDefault(4);
};
i18n.phonenumbers.NumberFormat.prototype.setNationalPrefixFormattingRule = function(a) {
  this.set$Value(4, a);
};
i18n.phonenumbers.NumberFormat.prototype.hasNationalPrefixFormattingRule = function() {
  return this.has$Value(4);
};
i18n.phonenumbers.NumberFormat.prototype.nationalPrefixFormattingRuleCount = function() {
  return this.count$Values(4);
};
i18n.phonenumbers.NumberFormat.prototype.clearNationalPrefixFormattingRule = function() {
  this.clear$Field(4);
};
i18n.phonenumbers.NumberFormat.prototype.getNationalPrefixOptionalWhenFormatting = function() {
  return this.get$Value(6);
};
i18n.phonenumbers.NumberFormat.prototype.getNationalPrefixOptionalWhenFormattingOrDefault = function() {
  return this.get$ValueOrDefault(6);
};
i18n.phonenumbers.NumberFormat.prototype.setNationalPrefixOptionalWhenFormatting = function(a) {
  this.set$Value(6, a);
};
i18n.phonenumbers.NumberFormat.prototype.hasNationalPrefixOptionalWhenFormatting = function() {
  return this.has$Value(6);
};
i18n.phonenumbers.NumberFormat.prototype.nationalPrefixOptionalWhenFormattingCount = function() {
  return this.count$Values(6);
};
i18n.phonenumbers.NumberFormat.prototype.clearNationalPrefixOptionalWhenFormatting = function() {
  this.clear$Field(6);
};
i18n.phonenumbers.NumberFormat.prototype.getDomesticCarrierCodeFormattingRule = function() {
  return this.get$Value(5);
};
i18n.phonenumbers.NumberFormat.prototype.getDomesticCarrierCodeFormattingRuleOrDefault = function() {
  return this.get$ValueOrDefault(5);
};
i18n.phonenumbers.NumberFormat.prototype.setDomesticCarrierCodeFormattingRule = function(a) {
  this.set$Value(5, a);
};
i18n.phonenumbers.NumberFormat.prototype.hasDomesticCarrierCodeFormattingRule = function() {
  return this.has$Value(5);
};
i18n.phonenumbers.NumberFormat.prototype.domesticCarrierCodeFormattingRuleCount = function() {
  return this.count$Values(5);
};
i18n.phonenumbers.NumberFormat.prototype.clearDomesticCarrierCodeFormattingRule = function() {
  this.clear$Field(5);
};
i18n.phonenumbers.PhoneNumberDesc = function() {
  goog.proto2.Message.call(this);
};
goog.inherits(i18n.phonenumbers.PhoneNumberDesc, goog.proto2.Message);
i18n.phonenumbers.PhoneNumberDesc.prototype.getNationalNumberPattern = function() {
  return this.get$Value(2);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.getNationalNumberPatternOrDefault = function() {
  return this.get$ValueOrDefault(2);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.setNationalNumberPattern = function(a) {
  this.set$Value(2, a);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.hasNationalNumberPattern = function() {
  return this.has$Value(2);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.nationalNumberPatternCount = function() {
  return this.count$Values(2);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.clearNationalNumberPattern = function() {
  this.clear$Field(2);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.getPossibleNumberPattern = function() {
  return this.get$Value(3);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.getPossibleNumberPatternOrDefault = function() {
  return this.get$ValueOrDefault(3);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.setPossibleNumberPattern = function(a) {
  this.set$Value(3, a);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.hasPossibleNumberPattern = function() {
  return this.has$Value(3);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.possibleNumberPatternCount = function() {
  return this.count$Values(3);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.clearPossibleNumberPattern = function() {
  this.clear$Field(3);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.getExampleNumber = function() {
  return this.get$Value(6);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.getExampleNumberOrDefault = function() {
  return this.get$ValueOrDefault(6);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.setExampleNumber = function(a) {
  this.set$Value(6, a);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.hasExampleNumber = function() {
  return this.has$Value(6);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.exampleNumberCount = function() {
  return this.count$Values(6);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.clearExampleNumber = function() {
  this.clear$Field(6);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.getNationalNumberMatcherData = function() {
  return this.get$Value(7);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.getNationalNumberMatcherDataOrDefault = function() {
  return this.get$ValueOrDefault(7);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.setNationalNumberMatcherData = function(a) {
  this.set$Value(7, a);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.hasNationalNumberMatcherData = function() {
  return this.has$Value(7);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.nationalNumberMatcherDataCount = function() {
  return this.count$Values(7);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.clearNationalNumberMatcherData = function() {
  this.clear$Field(7);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.getPossibleNumberMatcherData = function() {
  return this.get$Value(8);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.getPossibleNumberMatcherDataOrDefault = function() {
  return this.get$ValueOrDefault(8);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.setPossibleNumberMatcherData = function(a) {
  this.set$Value(8, a);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.hasPossibleNumberMatcherData = function() {
  return this.has$Value(8);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.possibleNumberMatcherDataCount = function() {
  return this.count$Values(8);
};
i18n.phonenumbers.PhoneNumberDesc.prototype.clearPossibleNumberMatcherData = function() {
  this.clear$Field(8);
};
i18n.phonenumbers.PhoneMetadata = function() {
  goog.proto2.Message.call(this);
};
goog.inherits(i18n.phonenumbers.PhoneMetadata, goog.proto2.Message);
i18n.phonenumbers.PhoneMetadata.prototype.getGeneralDesc = function() {
  return this.get$Value(1);
};
i18n.phonenumbers.PhoneMetadata.prototype.getGeneralDescOrDefault = function() {
  return this.get$ValueOrDefault(1);
};
i18n.phonenumbers.PhoneMetadata.prototype.setGeneralDesc = function(a) {
  this.set$Value(1, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasGeneralDesc = function() {
  return this.has$Value(1);
};
i18n.phonenumbers.PhoneMetadata.prototype.generalDescCount = function() {
  return this.count$Values(1);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearGeneralDesc = function() {
  this.clear$Field(1);
};
i18n.phonenumbers.PhoneMetadata.prototype.getFixedLine = function() {
  return this.get$Value(2);
};
i18n.phonenumbers.PhoneMetadata.prototype.getFixedLineOrDefault = function() {
  return this.get$ValueOrDefault(2);
};
i18n.phonenumbers.PhoneMetadata.prototype.setFixedLine = function(a) {
  this.set$Value(2, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasFixedLine = function() {
  return this.has$Value(2);
};
i18n.phonenumbers.PhoneMetadata.prototype.fixedLineCount = function() {
  return this.count$Values(2);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearFixedLine = function() {
  this.clear$Field(2);
};
i18n.phonenumbers.PhoneMetadata.prototype.getMobile = function() {
  return this.get$Value(3);
};
i18n.phonenumbers.PhoneMetadata.prototype.getMobileOrDefault = function() {
  return this.get$ValueOrDefault(3);
};
i18n.phonenumbers.PhoneMetadata.prototype.setMobile = function(a) {
  this.set$Value(3, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasMobile = function() {
  return this.has$Value(3);
};
i18n.phonenumbers.PhoneMetadata.prototype.mobileCount = function() {
  return this.count$Values(3);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearMobile = function() {
  this.clear$Field(3);
};
i18n.phonenumbers.PhoneMetadata.prototype.getTollFree = function() {
  return this.get$Value(4);
};
i18n.phonenumbers.PhoneMetadata.prototype.getTollFreeOrDefault = function() {
  return this.get$ValueOrDefault(4);
};
i18n.phonenumbers.PhoneMetadata.prototype.setTollFree = function(a) {
  this.set$Value(4, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasTollFree = function() {
  return this.has$Value(4);
};
i18n.phonenumbers.PhoneMetadata.prototype.tollFreeCount = function() {
  return this.count$Values(4);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearTollFree = function() {
  this.clear$Field(4);
};
i18n.phonenumbers.PhoneMetadata.prototype.getPremiumRate = function() {
  return this.get$Value(5);
};
i18n.phonenumbers.PhoneMetadata.prototype.getPremiumRateOrDefault = function() {
  return this.get$ValueOrDefault(5);
};
i18n.phonenumbers.PhoneMetadata.prototype.setPremiumRate = function(a) {
  this.set$Value(5, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasPremiumRate = function() {
  return this.has$Value(5);
};
i18n.phonenumbers.PhoneMetadata.prototype.premiumRateCount = function() {
  return this.count$Values(5);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearPremiumRate = function() {
  this.clear$Field(5);
};
i18n.phonenumbers.PhoneMetadata.prototype.getSharedCost = function() {
  return this.get$Value(6);
};
i18n.phonenumbers.PhoneMetadata.prototype.getSharedCostOrDefault = function() {
  return this.get$ValueOrDefault(6);
};
i18n.phonenumbers.PhoneMetadata.prototype.setSharedCost = function(a) {
  this.set$Value(6, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasSharedCost = function() {
  return this.has$Value(6);
};
i18n.phonenumbers.PhoneMetadata.prototype.sharedCostCount = function() {
  return this.count$Values(6);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearSharedCost = function() {
  this.clear$Field(6);
};
i18n.phonenumbers.PhoneMetadata.prototype.getPersonalNumber = function() {
  return this.get$Value(7);
};
i18n.phonenumbers.PhoneMetadata.prototype.getPersonalNumberOrDefault = function() {
  return this.get$ValueOrDefault(7);
};
i18n.phonenumbers.PhoneMetadata.prototype.setPersonalNumber = function(a) {
  this.set$Value(7, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasPersonalNumber = function() {
  return this.has$Value(7);
};
i18n.phonenumbers.PhoneMetadata.prototype.personalNumberCount = function() {
  return this.count$Values(7);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearPersonalNumber = function() {
  this.clear$Field(7);
};
i18n.phonenumbers.PhoneMetadata.prototype.getVoip = function() {
  return this.get$Value(8);
};
i18n.phonenumbers.PhoneMetadata.prototype.getVoipOrDefault = function() {
  return this.get$ValueOrDefault(8);
};
i18n.phonenumbers.PhoneMetadata.prototype.setVoip = function(a) {
  this.set$Value(8, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasVoip = function() {
  return this.has$Value(8);
};
i18n.phonenumbers.PhoneMetadata.prototype.voipCount = function() {
  return this.count$Values(8);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearVoip = function() {
  this.clear$Field(8);
};
i18n.phonenumbers.PhoneMetadata.prototype.getPager = function() {
  return this.get$Value(21);
};
i18n.phonenumbers.PhoneMetadata.prototype.getPagerOrDefault = function() {
  return this.get$ValueOrDefault(21);
};
i18n.phonenumbers.PhoneMetadata.prototype.setPager = function(a) {
  this.set$Value(21, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasPager = function() {
  return this.has$Value(21);
};
i18n.phonenumbers.PhoneMetadata.prototype.pagerCount = function() {
  return this.count$Values(21);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearPager = function() {
  this.clear$Field(21);
};
i18n.phonenumbers.PhoneMetadata.prototype.getUan = function() {
  return this.get$Value(25);
};
i18n.phonenumbers.PhoneMetadata.prototype.getUanOrDefault = function() {
  return this.get$ValueOrDefault(25);
};
i18n.phonenumbers.PhoneMetadata.prototype.setUan = function(a) {
  this.set$Value(25, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasUan = function() {
  return this.has$Value(25);
};
i18n.phonenumbers.PhoneMetadata.prototype.uanCount = function() {
  return this.count$Values(25);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearUan = function() {
  this.clear$Field(25);
};
i18n.phonenumbers.PhoneMetadata.prototype.getEmergency = function() {
  return this.get$Value(27);
};
i18n.phonenumbers.PhoneMetadata.prototype.getEmergencyOrDefault = function() {
  return this.get$ValueOrDefault(27);
};
i18n.phonenumbers.PhoneMetadata.prototype.setEmergency = function(a) {
  this.set$Value(27, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasEmergency = function() {
  return this.has$Value(27);
};
i18n.phonenumbers.PhoneMetadata.prototype.emergencyCount = function() {
  return this.count$Values(27);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearEmergency = function() {
  this.clear$Field(27);
};
i18n.phonenumbers.PhoneMetadata.prototype.getVoicemail = function() {
  return this.get$Value(28);
};
i18n.phonenumbers.PhoneMetadata.prototype.getVoicemailOrDefault = function() {
  return this.get$ValueOrDefault(28);
};
i18n.phonenumbers.PhoneMetadata.prototype.setVoicemail = function(a) {
  this.set$Value(28, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasVoicemail = function() {
  return this.has$Value(28);
};
i18n.phonenumbers.PhoneMetadata.prototype.voicemailCount = function() {
  return this.count$Values(28);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearVoicemail = function() {
  this.clear$Field(28);
};
i18n.phonenumbers.PhoneMetadata.prototype.getNoInternationalDialling = function() {
  return this.get$Value(24);
};
i18n.phonenumbers.PhoneMetadata.prototype.getNoInternationalDiallingOrDefault = function() {
  return this.get$ValueOrDefault(24);
};
i18n.phonenumbers.PhoneMetadata.prototype.setNoInternationalDialling = function(a) {
  this.set$Value(24, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasNoInternationalDialling = function() {
  return this.has$Value(24);
};
i18n.phonenumbers.PhoneMetadata.prototype.noInternationalDiallingCount = function() {
  return this.count$Values(24);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearNoInternationalDialling = function() {
  this.clear$Field(24);
};
i18n.phonenumbers.PhoneMetadata.prototype.getId = function() {
  return this.get$Value(9);
};
i18n.phonenumbers.PhoneMetadata.prototype.getIdOrDefault = function() {
  return this.get$ValueOrDefault(9);
};
i18n.phonenumbers.PhoneMetadata.prototype.setId = function(a) {
  this.set$Value(9, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasId = function() {
  return this.has$Value(9);
};
i18n.phonenumbers.PhoneMetadata.prototype.idCount = function() {
  return this.count$Values(9);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearId = function() {
  this.clear$Field(9);
};
i18n.phonenumbers.PhoneMetadata.prototype.getCountryCode = function() {
  return this.get$Value(10);
};
i18n.phonenumbers.PhoneMetadata.prototype.getCountryCodeOrDefault = function() {
  return this.get$ValueOrDefault(10);
};
i18n.phonenumbers.PhoneMetadata.prototype.setCountryCode = function(a) {
  this.set$Value(10, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasCountryCode = function() {
  return this.has$Value(10);
};
i18n.phonenumbers.PhoneMetadata.prototype.countryCodeCount = function() {
  return this.count$Values(10);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearCountryCode = function() {
  this.clear$Field(10);
};
i18n.phonenumbers.PhoneMetadata.prototype.getInternationalPrefix = function() {
  return this.get$Value(11);
};
i18n.phonenumbers.PhoneMetadata.prototype.getInternationalPrefixOrDefault = function() {
  return this.get$ValueOrDefault(11);
};
i18n.phonenumbers.PhoneMetadata.prototype.setInternationalPrefix = function(a) {
  this.set$Value(11, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasInternationalPrefix = function() {
  return this.has$Value(11);
};
i18n.phonenumbers.PhoneMetadata.prototype.internationalPrefixCount = function() {
  return this.count$Values(11);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearInternationalPrefix = function() {
  this.clear$Field(11);
};
i18n.phonenumbers.PhoneMetadata.prototype.getPreferredInternationalPrefix = function() {
  return this.get$Value(17);
};
i18n.phonenumbers.PhoneMetadata.prototype.getPreferredInternationalPrefixOrDefault = function() {
  return this.get$ValueOrDefault(17);
};
i18n.phonenumbers.PhoneMetadata.prototype.setPreferredInternationalPrefix = function(a) {
  this.set$Value(17, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasPreferredInternationalPrefix = function() {
  return this.has$Value(17);
};
i18n.phonenumbers.PhoneMetadata.prototype.preferredInternationalPrefixCount = function() {
  return this.count$Values(17);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearPreferredInternationalPrefix = function() {
  this.clear$Field(17);
};
i18n.phonenumbers.PhoneMetadata.prototype.getNationalPrefix = function() {
  return this.get$Value(12);
};
i18n.phonenumbers.PhoneMetadata.prototype.getNationalPrefixOrDefault = function() {
  return this.get$ValueOrDefault(12);
};
i18n.phonenumbers.PhoneMetadata.prototype.setNationalPrefix = function(a) {
  this.set$Value(12, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasNationalPrefix = function() {
  return this.has$Value(12);
};
i18n.phonenumbers.PhoneMetadata.prototype.nationalPrefixCount = function() {
  return this.count$Values(12);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearNationalPrefix = function() {
  this.clear$Field(12);
};
i18n.phonenumbers.PhoneMetadata.prototype.getPreferredExtnPrefix = function() {
  return this.get$Value(13);
};
i18n.phonenumbers.PhoneMetadata.prototype.getPreferredExtnPrefixOrDefault = function() {
  return this.get$ValueOrDefault(13);
};
i18n.phonenumbers.PhoneMetadata.prototype.setPreferredExtnPrefix = function(a) {
  this.set$Value(13, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasPreferredExtnPrefix = function() {
  return this.has$Value(13);
};
i18n.phonenumbers.PhoneMetadata.prototype.preferredExtnPrefixCount = function() {
  return this.count$Values(13);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearPreferredExtnPrefix = function() {
  this.clear$Field(13);
};
i18n.phonenumbers.PhoneMetadata.prototype.getNationalPrefixForParsing = function() {
  return this.get$Value(15);
};
i18n.phonenumbers.PhoneMetadata.prototype.getNationalPrefixForParsingOrDefault = function() {
  return this.get$ValueOrDefault(15);
};
i18n.phonenumbers.PhoneMetadata.prototype.setNationalPrefixForParsing = function(a) {
  this.set$Value(15, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasNationalPrefixForParsing = function() {
  return this.has$Value(15);
};
i18n.phonenumbers.PhoneMetadata.prototype.nationalPrefixForParsingCount = function() {
  return this.count$Values(15);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearNationalPrefixForParsing = function() {
  this.clear$Field(15);
};
i18n.phonenumbers.PhoneMetadata.prototype.getNationalPrefixTransformRule = function() {
  return this.get$Value(16);
};
i18n.phonenumbers.PhoneMetadata.prototype.getNationalPrefixTransformRuleOrDefault = function() {
  return this.get$ValueOrDefault(16);
};
i18n.phonenumbers.PhoneMetadata.prototype.setNationalPrefixTransformRule = function(a) {
  this.set$Value(16, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasNationalPrefixTransformRule = function() {
  return this.has$Value(16);
};
i18n.phonenumbers.PhoneMetadata.prototype.nationalPrefixTransformRuleCount = function() {
  return this.count$Values(16);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearNationalPrefixTransformRule = function() {
  this.clear$Field(16);
};
i18n.phonenumbers.PhoneMetadata.prototype.getSameMobileAndFixedLinePattern = function() {
  return this.get$Value(18);
};
i18n.phonenumbers.PhoneMetadata.prototype.getSameMobileAndFixedLinePatternOrDefault = function() {
  return this.get$ValueOrDefault(18);
};
i18n.phonenumbers.PhoneMetadata.prototype.setSameMobileAndFixedLinePattern = function(a) {
  this.set$Value(18, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasSameMobileAndFixedLinePattern = function() {
  return this.has$Value(18);
};
i18n.phonenumbers.PhoneMetadata.prototype.sameMobileAndFixedLinePatternCount = function() {
  return this.count$Values(18);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearSameMobileAndFixedLinePattern = function() {
  this.clear$Field(18);
};
i18n.phonenumbers.PhoneMetadata.prototype.getNumberFormat = function(a) {
  return this.get$Value(19, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.getNumberFormatOrDefault = function(a) {
  return this.get$ValueOrDefault(19, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.addNumberFormat = function(a) {
  this.add$Value(19, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.numberFormatArray = function() {
  return this.array$Values(19);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasNumberFormat = function() {
  return this.has$Value(19);
};
i18n.phonenumbers.PhoneMetadata.prototype.numberFormatCount = function() {
  return this.count$Values(19);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearNumberFormat = function() {
  this.clear$Field(19);
};
i18n.phonenumbers.PhoneMetadata.prototype.getIntlNumberFormat = function(a) {
  return this.get$Value(20, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.getIntlNumberFormatOrDefault = function(a) {
  return this.get$ValueOrDefault(20, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.addIntlNumberFormat = function(a) {
  this.add$Value(20, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.intlNumberFormatArray = function() {
  return this.array$Values(20);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasIntlNumberFormat = function() {
  return this.has$Value(20);
};
i18n.phonenumbers.PhoneMetadata.prototype.intlNumberFormatCount = function() {
  return this.count$Values(20);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearIntlNumberFormat = function() {
  this.clear$Field(20);
};
i18n.phonenumbers.PhoneMetadata.prototype.getMainCountryForCode = function() {
  return this.get$Value(22);
};
i18n.phonenumbers.PhoneMetadata.prototype.getMainCountryForCodeOrDefault = function() {
  return this.get$ValueOrDefault(22);
};
i18n.phonenumbers.PhoneMetadata.prototype.setMainCountryForCode = function(a) {
  this.set$Value(22, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasMainCountryForCode = function() {
  return this.has$Value(22);
};
i18n.phonenumbers.PhoneMetadata.prototype.mainCountryForCodeCount = function() {
  return this.count$Values(22);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearMainCountryForCode = function() {
  this.clear$Field(22);
};
i18n.phonenumbers.PhoneMetadata.prototype.getLeadingDigits = function() {
  return this.get$Value(23);
};
i18n.phonenumbers.PhoneMetadata.prototype.getLeadingDigitsOrDefault = function() {
  return this.get$ValueOrDefault(23);
};
i18n.phonenumbers.PhoneMetadata.prototype.setLeadingDigits = function(a) {
  this.set$Value(23, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasLeadingDigits = function() {
  return this.has$Value(23);
};
i18n.phonenumbers.PhoneMetadata.prototype.leadingDigitsCount = function() {
  return this.count$Values(23);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearLeadingDigits = function() {
  this.clear$Field(23);
};
i18n.phonenumbers.PhoneMetadata.prototype.getLeadingZeroPossible = function() {
  return this.get$Value(26);
};
i18n.phonenumbers.PhoneMetadata.prototype.getLeadingZeroPossibleOrDefault = function() {
  return this.get$ValueOrDefault(26);
};
i18n.phonenumbers.PhoneMetadata.prototype.setLeadingZeroPossible = function(a) {
  this.set$Value(26, a);
};
i18n.phonenumbers.PhoneMetadata.prototype.hasLeadingZeroPossible = function() {
  return this.has$Value(26);
};
i18n.phonenumbers.PhoneMetadata.prototype.leadingZeroPossibleCount = function() {
  return this.count$Values(26);
};
i18n.phonenumbers.PhoneMetadata.prototype.clearLeadingZeroPossible = function() {
  this.clear$Field(26);
};
i18n.phonenumbers.PhoneMetadataCollection = function() {
  goog.proto2.Message.call(this);
};
goog.inherits(i18n.phonenumbers.PhoneMetadataCollection, goog.proto2.Message);
i18n.phonenumbers.PhoneMetadataCollection.prototype.getMetadata = function(a) {
  return this.get$Value(1, a);
};
i18n.phonenumbers.PhoneMetadataCollection.prototype.getMetadataOrDefault = function(a) {
  return this.get$ValueOrDefault(1, a);
};
i18n.phonenumbers.PhoneMetadataCollection.prototype.addMetadata = function(a) {
  this.add$Value(1, a);
};
i18n.phonenumbers.PhoneMetadataCollection.prototype.metadataArray = function() {
  return this.array$Values(1);
};
i18n.phonenumbers.PhoneMetadataCollection.prototype.hasMetadata = function() {
  return this.has$Value(1);
};
i18n.phonenumbers.PhoneMetadataCollection.prototype.metadataCount = function() {
  return this.count$Values(1);
};
i18n.phonenumbers.PhoneMetadataCollection.prototype.clearMetadata = function() {
  this.clear$Field(1);
};
i18n.phonenumbers.NumberFormat.prototype.getDescriptor = function() {
  i18n.phonenumbers.NumberFormat.descriptor_ || (i18n.phonenumbers.NumberFormat.descriptor_ = goog.proto2.Message.createDescriptor(i18n.phonenumbers.NumberFormat, {0:{name:"NumberFormat", fullName:"i18n.phonenumbers.NumberFormat"}, 1:{name:"pattern", required:!0, fieldType:goog.proto2.Message.FieldType.STRING, type:String}, 2:{name:"format", required:!0, fieldType:goog.proto2.Message.FieldType.STRING, type:String}, 3:{name:"leading_digits_pattern", repeated:!0, fieldType:goog.proto2.Message.FieldType.STRING,
  type:String}, 4:{name:"national_prefix_formatting_rule", fieldType:goog.proto2.Message.FieldType.STRING, type:String}, 6:{name:"national_prefix_optional_when_formatting", fieldType:goog.proto2.Message.FieldType.BOOL, type:Boolean}, 5:{name:"domestic_carrier_code_formatting_rule", fieldType:goog.proto2.Message.FieldType.STRING, type:String}}));
  return i18n.phonenumbers.NumberFormat.descriptor_;
};
i18n.phonenumbers.NumberFormat.ctor = i18n.phonenumbers.NumberFormat;
i18n.phonenumbers.NumberFormat.ctor.getDescriptor = i18n.phonenumbers.NumberFormat.prototype.getDescriptor;
i18n.phonenumbers.PhoneNumberDesc.prototype.getDescriptor = function() {
  i18n.phonenumbers.PhoneNumberDesc.descriptor_ || (i18n.phonenumbers.PhoneNumberDesc.descriptor_ = goog.proto2.Message.createDescriptor(i18n.phonenumbers.PhoneNumberDesc, {0:{name:"PhoneNumberDesc", fullName:"i18n.phonenumbers.PhoneNumberDesc"}, 2:{name:"national_number_pattern", fieldType:goog.proto2.Message.FieldType.STRING, type:String}, 3:{name:"possible_number_pattern", fieldType:goog.proto2.Message.FieldType.STRING, type:String}, 6:{name:"example_number", fieldType:goog.proto2.Message.FieldType.STRING,
  type:String}, 7:{name:"national_number_matcher_data", fieldType:goog.proto2.Message.FieldType.BYTES, type:String}, 8:{name:"possible_number_matcher_data", fieldType:goog.proto2.Message.FieldType.BYTES, type:String}}));
  return i18n.phonenumbers.PhoneNumberDesc.descriptor_;
};
i18n.phonenumbers.PhoneNumberDesc.ctor = i18n.phonenumbers.PhoneNumberDesc;
i18n.phonenumbers.PhoneNumberDesc.ctor.getDescriptor = i18n.phonenumbers.PhoneNumberDesc.prototype.getDescriptor;
i18n.phonenumbers.PhoneMetadata.prototype.getDescriptor = function() {
  i18n.phonenumbers.PhoneMetadata.descriptor_ || (i18n.phonenumbers.PhoneMetadata.descriptor_ = goog.proto2.Message.createDescriptor(i18n.phonenumbers.PhoneMetadata, {0:{name:"PhoneMetadata", fullName:"i18n.phonenumbers.PhoneMetadata"}, 1:{name:"general_desc", fieldType:goog.proto2.Message.FieldType.MESSAGE, type:i18n.phonenumbers.PhoneNumberDesc}, 2:{name:"fixed_line", fieldType:goog.proto2.Message.FieldType.MESSAGE, type:i18n.phonenumbers.PhoneNumberDesc}, 3:{name:"mobile", fieldType:goog.proto2.Message.FieldType.MESSAGE,
  type:i18n.phonenumbers.PhoneNumberDesc}, 4:{name:"toll_free", fieldType:goog.proto2.Message.FieldType.MESSAGE, type:i18n.phonenumbers.PhoneNumberDesc}, 5:{name:"premium_rate", fieldType:goog.proto2.Message.FieldType.MESSAGE, type:i18n.phonenumbers.PhoneNumberDesc}, 6:{name:"shared_cost", fieldType:goog.proto2.Message.FieldType.MESSAGE, type:i18n.phonenumbers.PhoneNumberDesc}, 7:{name:"personal_number", fieldType:goog.proto2.Message.FieldType.MESSAGE, type:i18n.phonenumbers.PhoneNumberDesc}, 8:{name:"voip",
  fieldType:goog.proto2.Message.FieldType.MESSAGE, type:i18n.phonenumbers.PhoneNumberDesc}, 21:{name:"pager", fieldType:goog.proto2.Message.FieldType.MESSAGE, type:i18n.phonenumbers.PhoneNumberDesc}, 25:{name:"uan", fieldType:goog.proto2.Message.FieldType.MESSAGE, type:i18n.phonenumbers.PhoneNumberDesc}, 27:{name:"emergency", fieldType:goog.proto2.Message.FieldType.MESSAGE, type:i18n.phonenumbers.PhoneNumberDesc}, 28:{name:"voicemail", fieldType:goog.proto2.Message.FieldType.MESSAGE, type:i18n.phonenumbers.PhoneNumberDesc},
  24:{name:"no_international_dialling", fieldType:goog.proto2.Message.FieldType.MESSAGE, type:i18n.phonenumbers.PhoneNumberDesc}, 9:{name:"id", required:!0, fieldType:goog.proto2.Message.FieldType.STRING, type:String}, 10:{name:"country_code", fieldType:goog.proto2.Message.FieldType.INT32, type:Number}, 11:{name:"international_prefix", fieldType:goog.proto2.Message.FieldType.STRING, type:String}, 17:{name:"preferred_international_prefix", fieldType:goog.proto2.Message.FieldType.STRING, type:String},
  12:{name:"national_prefix", fieldType:goog.proto2.Message.FieldType.STRING, type:String}, 13:{name:"preferred_extn_prefix", fieldType:goog.proto2.Message.FieldType.STRING, type:String}, 15:{name:"national_prefix_for_parsing", fieldType:goog.proto2.Message.FieldType.STRING, type:String}, 16:{name:"national_prefix_transform_rule", fieldType:goog.proto2.Message.FieldType.STRING, type:String}, 18:{name:"same_mobile_and_fixed_line_pattern", fieldType:goog.proto2.Message.FieldType.BOOL, defaultValue:!1,
  type:Boolean}, 19:{name:"number_format", repeated:!0, fieldType:goog.proto2.Message.FieldType.MESSAGE, type:i18n.phonenumbers.NumberFormat}, 20:{name:"intl_number_format", repeated:!0, fieldType:goog.proto2.Message.FieldType.MESSAGE, type:i18n.phonenumbers.NumberFormat}, 22:{name:"main_country_for_code", fieldType:goog.proto2.Message.FieldType.BOOL, defaultValue:!1, type:Boolean}, 23:{name:"leading_digits", fieldType:goog.proto2.Message.FieldType.STRING, type:String}, 26:{name:"leading_zero_possible",
  fieldType:goog.proto2.Message.FieldType.BOOL, defaultValue:!1, type:Boolean}}));
  return i18n.phonenumbers.PhoneMetadata.descriptor_;
};
i18n.phonenumbers.PhoneMetadata.ctor = i18n.phonenumbers.PhoneMetadata;
i18n.phonenumbers.PhoneMetadata.ctor.getDescriptor = i18n.phonenumbers.PhoneMetadata.prototype.getDescriptor;
i18n.phonenumbers.PhoneMetadataCollection.prototype.getDescriptor = function() {
  i18n.phonenumbers.PhoneMetadataCollection.descriptor_ || (i18n.phonenumbers.PhoneMetadataCollection.descriptor_ = goog.proto2.Message.createDescriptor(i18n.phonenumbers.PhoneMetadataCollection, {0:{name:"PhoneMetadataCollection", fullName:"i18n.phonenumbers.PhoneMetadataCollection"}, 1:{name:"metadata", repeated:!0, fieldType:goog.proto2.Message.FieldType.MESSAGE, type:i18n.phonenumbers.PhoneMetadata}}));
  return i18n.phonenumbers.PhoneMetadataCollection.descriptor_;
};
i18n.phonenumbers.PhoneMetadataCollection.ctor = i18n.phonenumbers.PhoneMetadataCollection;
i18n.phonenumbers.PhoneMetadataCollection.ctor.getDescriptor = i18n.phonenumbers.PhoneMetadataCollection.prototype.getDescriptor;
/*

 Copyright (C) 2010 The Libphonenumber Authors

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/
i18n.phonenumbers.metadata = {};
i18n.phonenumbers.metadata.countryCodeToRegionCodeMap = {1:"US AG AI AS BB BM BS CA DM DO GD GU JM KN KY LC MP MS PR SX TC TT VC VG VI".split(" "), 7:["RU", "KZ"], 20:["EG"], 27:["ZA"], 30:["GR"], 31:["NL"], 32:["BE"], 33:["FR"], 34:["ES"], 36:["HU"], 39:["IT", "VA"], 40:["RO"], 41:["CH"], 43:["AT"], 44:["GB", "GG", "IM", "JE"], 45:["DK"], 46:["SE"], 47:["NO", "SJ"], 48:["PL"], 49:["DE"], 51:["PE"], 52:["MX"], 53:["CU"], 54:["AR"], 55:["BR"], 56:["CL"], 57:["CO"], 58:["VE"], 60:["MY"], 61:["AU",
"CC", "CX"], 62:["ID"], 63:["PH"], 64:["NZ"], 65:["SG"], 66:["TH"], 81:["JP"], 82:["KR"], 84:["VN"], 86:["CN"], 90:["TR"], 91:["IN"], 92:["PK"], 93:["AF"], 94:["LK"], 95:["MM"], 98:["IR"], 211:["SS"], 212:["MA", "EH"], 213:["DZ"], 216:["TN"], 218:["LY"], 220:["GM"], 221:["SN"], 222:["MR"], 223:["ML"], 224:["GN"], 225:["CI"], 226:["BF"], 227:["NE"], 228:["TG"], 229:["BJ"], 230:["MU"], 231:["LR"], 232:["SL"], 233:["GH"], 234:["NG"], 235:["TD"], 236:["CF"], 237:["CM"], 238:["CV"], 239:["ST"], 240:["GQ"],
241:["GA"], 242:["CG"], 243:["CD"], 244:["AO"], 245:["GW"], 246:["IO"], 247:["AC"], 248:["SC"], 249:["SD"], 250:["RW"], 251:["ET"], 252:["SO"], 253:["DJ"], 254:["KE"], 255:["TZ"], 256:["UG"], 257:["BI"], 258:["MZ"], 260:["ZM"], 261:["MG"], 262:["RE", "YT"], 263:["ZW"], 264:["NA"], 265:["MW"], 266:["LS"], 267:["BW"], 268:["SZ"], 269:["KM"], 290:["SH", "TA"], 291:["ER"], 297:["AW"], 298:["FO"], 299:["GL"], 350:["GI"], 351:["PT"], 352:["LU"], 353:["IE"], 354:["IS"], 355:["AL"], 356:["MT"], 357:["CY"],
358:["FI", "AX"], 359:["BG"], 370:["LT"], 371:["LV"], 372:["EE"], 373:["MD"], 374:["AM"], 375:["BY"], 376:["AD"], 377:["MC"], 378:["SM"], 380:["UA"], 381:["RS"], 382:["ME"], 385:["HR"], 386:["SI"], 387:["BA"], 389:["MK"], 420:["CZ"], 421:["SK"], 423:["LI"], 500:["FK"], 501:["BZ"], 502:["GT"], 503:["SV"], 504:["HN"], 505:["NI"], 506:["CR"], 507:["PA"], 508:["PM"], 509:["HT"], 590:["GP", "BL", "MF"], 591:["BO"], 592:["GY"], 593:["EC"], 594:["GF"], 595:["PY"], 596:["MQ"], 597:["SR"], 598:["UY"], 599:["CW",
"BQ"], 670:["TL"], 672:["NF"], 673:["BN"], 674:["NR"], 675:["PG"], 676:["TO"], 677:["SB"], 678:["VU"], 679:["FJ"], 680:["PW"], 681:["WF"], 682:["CK"], 683:["NU"], 685:["WS"], 686:["KI"], 687:["NC"], 688:["TV"], 689:["PF"], 690:["TK"], 691:["FM"], 692:["MH"], 800:["001"], 808:["001"], 850:["KP"], 852:["HK"], 853:["MO"], 855:["KH"], 856:["LA"], 870:["001"], 878:["001"], 880:["BD"], 881:["001"], 882:["001"], 883:["001"], 886:["TW"], 888:["001"], 960:["MV"], 961:["LB"], 962:["JO"], 963:["SY"], 964:["IQ"],
965:["KW"], 966:["SA"], 967:["YE"], 968:["OM"], 970:["PS"], 971:["AE"], 972:["IL"], 973:["BH"], 974:["QA"], 975:["BT"], 976:["MN"], 977:["NP"], 979:["001"], 992:["TJ"], 993:["TM"], 994:["AZ"], 995:["GE"], 996:["KG"], 998:["UZ"]};
i18n.phonenumbers.metadata.countryToMetadata = {AC:[, [, , "[46]\\d{4}|[01589]\\d{5}", "\\d{5,6}"], [, , "6[2-467]\\d{3}", "\\d{5}", , , "62889"], [, , "4\\d{4}", "\\d{5}", , , "40123"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "AC", 247, "00", , , , , , , , , , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "[01589]\\d{5}", "\\d{6}", , , "542011"], , , [, , "NA", "NA"]], AD:[, [, , "(?:[346-9]|180)\\d{5}", "\\d{6,8}"], [, , "[78]\\d{5}", "\\d{6}", ,
, "712345"], [, , "[346]\\d{5}", "\\d{6}", , , "312345"], [, , "180[02]\\d{4}", "\\d{8}", , , "18001234"], [, , "9\\d{5}", "\\d{6}", , , "912345"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "AD", 376, "00", , , , , , , , [[, "(\\d{3})(\\d{3})", "$1 $2", ["[346-9]"], "", "", 0], [, "(180[02])(\\d{4})", "$1 $2", ["1"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], AE:[, [, , "[2-79]\\d{7,8}|800\\d{2,9}", "\\d{5,12}"], [, , "[2-4679][2-8]\\d{6}",
"\\d{7,8}", , , "22345678"], [, , "5[0256]\\d{7}", "\\d{9}", , , "501234567"], [, , "400\\d{6}|800\\d{2,9}", "\\d{5,12}", , , "800123456"], [, , "900[02]\\d{5}", "\\d{9}", , , "900234567"], [, , "700[05]\\d{5}", "\\d{9}", , , "700012345"], [, , "NA", "NA"], [, , "NA", "NA"], "AE", 971, "00", "0", , , "0", , , , [[, "([2-4679])(\\d{3})(\\d{4})", "$1 $2 $3", ["[2-4679][2-8]"], "0$1", "", 0], [, "(5[0256])(\\d{3})(\\d{4})", "$1 $2 $3", ["5"], "0$1", "", 0], [, "([479]00)(\\d)(\\d{5})", "$1 $2 $3", ["[479]0"],
"$1", "", 0], [, "([68]00)(\\d{2,9})", "$1 $2", ["60|8"], "$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "600[25]\\d{5}", "\\d{9}", , , "600212345"], , , [, , "NA", "NA"]], AF:[, [, , "[2-7]\\d{8}", "\\d{7,9}"], [, , "(?:[25][0-8]|[34][0-4]|6[0-5])[2-9]\\d{6}", "\\d{7,9}", , , "234567890"], [, , "7(?:[014-9]\\d{7}|2[89]\\d{6})", "\\d{9}", , , "701234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "AF", 93, "00", "0", , , "0", , , , [[,
"([2-7]\\d)(\\d{3})(\\d{4})", "$1 $2 $3", ["[2-7]"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], AG:[, [, , "[2589]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "268(?:4(?:6[0-38]|84)|56[0-2])\\d{4}", "\\d{7}(?:\\d{3})?", , , "2684601234"], [, , "268(?:464|7(?:2[0-9]|64|7[0-689]|8[02-68]))\\d{4}", "\\d{10}", , , "2684641234"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002123456"], [, , "900[2-9]\\d{6}", "\\d{10}", , , "9002123456"], [,
, "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "26848[01]\\d{4}", "\\d{10}", , , "2684801234"], "AG", 1, "011", "1", , , "1", , , , , , [, , "26840[69]\\d{4}", "\\d{10}", , , "2684061234"], , "268", [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], AI:[, [, , "[2589]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "2644(?:6[12]|9[78])\\d{4}", "\\d{7}(?:\\d{3})?", , , "2644612345"], [, , "264(?:235|476|5(?:3[6-9]|8[1-4])|7(?:29|72))\\d{4}", "\\d{10}", , , "2642351234"],
[, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002123456"], [, , "900[2-9]\\d{6}", "\\d{10}", , , "9002123456"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "NA", "NA"], "AI", 1, "011", "1", , , "1", , , , , , [, , "NA", "NA"], , "264", [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], AL:[, [, , "[2-57]\\d{7}|6\\d{8}|8\\d{5,7}|9\\d{5}", "\\d{5,9}"], [, , "(?:2(?:[168][1-9]|[247]\\d|9[1-7])|3(?:1[1-3]|[2-6]\\d|[79][1-8]|8[1-9])|4\\d{2}|5(?:1[1-4]|[2-578]\\d|6[1-5]|9[1-7])|8(?:[19][1-5]|[2-6]\\d|[78][1-7]))\\d{5}",
"\\d{5,8}", , , "22345678"], [, , "6[6-9]\\d{7}", "\\d{9}", , , "661234567"], [, , "800\\d{4}", "\\d{7}", , , "8001234"], [, , "900\\d{3}", "\\d{6}", , , "900123"], [, , "808\\d{3}", "\\d{6}", , , "808123"], [, , "700\\d{5}", "\\d{8}", , , "70012345"], [, , "NA", "NA"], "AL", 355, "00", "0", , , "0", , , , [[, "(4)(\\d{3})(\\d{4})", "$1 $2 $3", ["4[0-6]"], "0$1", "", 0], [, "(6[6-9])(\\d{3})(\\d{4})", "$1 $2 $3", ["6"], "0$1", "", 0], [, "(\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["[2358][2-5]|4[7-9]"],
"0$1", "", 0], [, "(\\d{3})(\\d{3,5})", "$1 $2", ["[235][16-9]|8[016-9]|[79]"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], AM:[, [, , "[1-9]\\d{7}", "\\d{5,8}"], [, , "(?:1[01]\\d|2(?:2[2-46]|3[1-8]|4[2-69]|5[2-7]|6[1-9]|8[1-7])|3[12]2|47\\d)\\d{5}", "\\d{5,8}", , , "10123456"], [, , "(?:4[139]|55|77|9[1-9])\\d{6}", "\\d{8}", , , "77123456"], [, , "800\\d{5}", "\\d{8}", , , "80012345"], [, , "90[016]\\d{5}", "\\d{8}", , , "90012345"], [, , "80[1-4]\\d{5}",
"\\d{8}", , , "80112345"], [, , "NA", "NA"], [, , "60[2-6]\\d{5}", "\\d{8}", , , "60271234"], "AM", 374, "00", "0", , , "0", , , , [[, "(\\d{2})(\\d{6})", "$1 $2", ["1|47"], "(0$1)", "", 0], [, "(\\d{2})(\\d{6})", "$1 $2", ["4[139]|[5-7]|9[1-9]"], "0$1", "", 0], [, "(\\d{3})(\\d{5})", "$1 $2", ["[23]"], "(0$1)", "", 0], [, "(\\d{3})(\\d{2})(\\d{3})", "$1 $2 $3", ["8|90"], "0 $1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], AO:[, [, , "[29]\\d{8}", "\\d{9}"],
[, , "2\\d(?:[26-9]\\d|\\d[26-9])\\d{5}", "\\d{9}", , , "222123456"], [, , "9[1-49]\\d{7}", "\\d{9}", , , "923123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "AO", 244, "00", , , , , , , , [[, "(\\d{3})(\\d{3})(\\d{3})", "$1 $2 $3", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], AR:[, [, , "11\\d{8}|[2368]\\d{9}|9\\d{10}", "\\d{6,11}"], [, , "11\\d{8}|(?:2(?:2(?:[013]\\d|2[13-79]|4[1-6]|5[2457]|6[124-8]|7[1-4]|8[13-6]|9[1267])|3(?:1[467]|2[03-6]|3[13-8]|[49][2-6]|5[2-8]|[067]\\d)|4(?:7[3-8]|9\\d)|6(?:[01346]\\d|2[24-6]|5[15-8])|80\\d|9(?:[0124789]\\d|3[1-6]|5[234]|6[2-46]))|3(?:3(?:2[79]|6\\d|8[2578])|4(?:[78]\\d|0[0124-9]|[1-35]\\d|4[24-7]|6[02-9]|9[123678])|5(?:[138]\\d|2[1245]|4[1-9]|6[2-4]|7[1-6])|6[24]\\d|7(?:[0469]\\d|1[1568]|2[013-9]|3[145]|5[14-8]|7[2-57]|8[0-24-9])|8(?:[013578]\\d|2[15-7]|4[13-6]|6[1-357-9]|9[124]))|670\\d)\\d{6}",
"\\d{6,10}", , , "1123456789"], [, , "675\\d{7}|9(?:11[2-9]\\d{7}|(?:2(?:2[013]|3[067]|49|6[01346]|80|9[147-9])|3(?:36|4[12358]|5[138]|6[24]|7[069]|8[013578]))[2-9]\\d{6}|\\d{4}[2-9]\\d{5})", "\\d{6,11}", , , "91123456789"], [, , "800\\d{7}", "\\d{10}", , , "8001234567"], [, , "60[04579]\\d{7}", "\\d{10}", , , "6001234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "AR", 54, "00", "0", , , "0?(?:(11|2(?:2(?:02?|[13]|2[13-79]|4[1-6]|5[2457]|6[124-8]|7[1-4]|8[13-6]|9[1267])|3(?:02?|1[467]|2[03-6]|3[13-8]|[49][2-6]|5[2-8]|[67])|4(?:7[3-578]|9)|6(?:[0136]|2[24-6]|4[6-8]?|5[15-8])|80|9(?:0[1-3]|[19]|2\\d|3[1-6]|4[02568]?|5[2-4]|6[2-46]|72?|8[23]?))|3(?:3(?:2[79]|6|8[2578])|4(?:0[0-24-9]|[12]|3[5-8]?|4[24-7]|5[4-68]?|6[02-9]|7[126]|8[2379]?|9[1-36-8])|5(?:1|2[1245]|3[237]?|4[1-46-9]|6[2-4]|7[1-6]|8[2-5]?)|6[24]|7(?:[069]|1[1568]|2[15]|3[145]|4[13]|5[14-8]|7[2-57]|8[126])|8(?:[01]|2[15-7]|3[2578]?|4[13-6]|5[4-8]?|6[1-357-9]|7[36-8]?|8[5-8]?|9[124])))?15)?",
"9$1", , , [[, "([68]\\d{2})(\\d{3})(\\d{4})", "$1-$2-$3", ["[68]"], "0$1", "", 0], [, "(\\d{2})(\\d{4})", "$1-$2", ["[2-9]"], "$1", "", 0], [, "(\\d{3})(\\d{4})", "$1-$2", ["[2-9]"], "$1", "", 0], [, "(\\d{4})(\\d{4})", "$1-$2", ["[2-9]"], "$1", "", 0], [, "(9)(11)(\\d{4})(\\d{4})", "$2 15-$3-$4", ["911"], "0$1", "", 0], [, "(9)(\\d{3})(\\d{3})(\\d{4})", "$2 15-$3-$4", ["9(?:2[234689]|3[3-8])", "9(?:2(?:2[013]|3[067]|49|6[01346]|80|9[147-9])|3(?:36|4[1-358]|5[138]|6[24]|7[069]|8[013578]))", "9(?:2(?:2(?:0[013-9]|[13])|3(?:0[013-9]|[67])|49|6(?:[0136]|4[0-59])|8|9(?:[19]|44|7[013-9]|8[14]))|3(?:36|4(?:[12]|3[456]|[58]4)|5(?:1|3[0-24-689]|8[46])|6|7[069]|8(?:[01]|34|[578][45])))",
"9(?:2(?:2(?:0[013-9]|[13])|3(?:0[013-9]|[67])|49|6(?:[0136]|4[0-59])|8|9(?:[19]|44|7[013-9]|8[14]))|3(?:36|4(?:[12]|3(?:4|5[014]|6[1239])|[58]4)|5(?:1|3[0-24-689]|8[46])|6|7[069]|8(?:[01]|34|[578][45])))"], "0$1", "", 0], [, "(9)(\\d{4})(\\d{2})(\\d{4})", "$2 15-$3-$4", ["9[23]"], "0$1", "", 0], [, "(11)(\\d{4})(\\d{4})", "$1 $2-$3", ["1"], "0$1", "", 1], [, "(\\d{3})(\\d{3})(\\d{4})", "$1 $2-$3", ["2(?:2[013]|3[067]|49|6[01346]|80|9[147-9])|3(?:36|4[1-358]|5[138]|6[24]|7[069]|8[013578])", "2(?:2(?:0[013-9]|[13])|3(?:0[013-9]|[67])|49|6(?:[0136]|4[0-59])|8|9(?:[19]|44|7[013-9]|8[14]))|3(?:36|4(?:[12]|3[456]|[58]4)|5(?:1|3[0-24-689]|8[46])|6|7[069]|8(?:[01]|34|[578][45]))",
"2(?:2(?:0[013-9]|[13])|3(?:0[013-9]|[67])|49|6(?:[0136]|4[0-59])|8|9(?:[19]|44|7[013-9]|8[14]))|3(?:36|4(?:[12]|3(?:4|5[014]|6[1239])|[58]4)|5(?:1|3[0-24-689]|8[46])|6|7[069]|8(?:[01]|34|[578][45]))"], "0$1", "", 1], [, "(\\d{4})(\\d{2})(\\d{4})", "$1 $2-$3", ["[23]"], "0$1", "", 1], [, "(\\d{3})", "$1", ["1[012]|911"], "$1", "", 0]], [[, "([68]\\d{2})(\\d{3})(\\d{4})", "$1-$2-$3", ["[68]"], "0$1", "", 0], [, "(9)(11)(\\d{4})(\\d{4})", "$1 $2 $3-$4", ["911"]], [, "(9)(\\d{3})(\\d{3})(\\d{4})", "$1 $2 $3-$4",
["9(?:2[234689]|3[3-8])", "9(?:2(?:2[013]|3[067]|49|6[01346]|80|9[147-9])|3(?:36|4[1-358]|5[138]|6[24]|7[069]|8[013578]))", "9(?:2(?:2(?:0[013-9]|[13])|3(?:0[013-9]|[67])|49|6(?:[0136]|4[0-59])|8|9(?:[19]|44|7[013-9]|8[14]))|3(?:36|4(?:[12]|3[456]|[58]4)|5(?:1|3[0-24-689]|8[46])|6|7[069]|8(?:[01]|34|[578][45])))", "9(?:2(?:2(?:0[013-9]|[13])|3(?:0[013-9]|[67])|49|6(?:[0136]|4[0-59])|8|9(?:[19]|44|7[013-9]|8[14]))|3(?:36|4(?:[12]|3(?:4|5[014]|6[1239])|[58]4)|5(?:1|3[0-24-689]|8[46])|6|7[069]|8(?:[01]|34|[578][45])))"]],
[, "(9)(\\d{4})(\\d{2})(\\d{4})", "$1 $2 $3-$4", ["9[23]"]], [, "(11)(\\d{4})(\\d{4})", "$1 $2-$3", ["1"], "0$1", "", 1], [, "(\\d{3})(\\d{3})(\\d{4})", "$1 $2-$3", ["2(?:2[013]|3[067]|49|6[01346]|80|9[147-9])|3(?:36|4[1-358]|5[138]|6[24]|7[069]|8[013578])", "2(?:2(?:0[013-9]|[13])|3(?:0[013-9]|[67])|49|6(?:[0136]|4[0-59])|8|9(?:[19]|44|7[013-9]|8[14]))|3(?:36|4(?:[12]|3[456]|[58]4)|5(?:1|3[0-24-689]|8[46])|6|7[069]|8(?:[01]|34|[578][45]))", "2(?:2(?:0[013-9]|[13])|3(?:0[013-9]|[67])|49|6(?:[0136]|4[0-59])|8|9(?:[19]|44|7[013-9]|8[14]))|3(?:36|4(?:[12]|3(?:4|5[014]|6[1239])|[58]4)|5(?:1|3[0-24-689]|8[46])|6|7[069]|8(?:[01]|34|[578][45]))"],
"0$1", "", 1], [, "(\\d{4})(\\d{2})(\\d{4})", "$1 $2-$3", ["[23]"], "0$1", "", 1]], [, , "NA", "NA"], , , [, , "810\\d{7}", "\\d{10}", , , "8101234567"], [, , "810\\d{7}", "\\d{10}", , , "8101234567"], , , [, , "NA", "NA"]], AS:[, [, , "[5689]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "6846(?:22|33|44|55|77|88|9[19])\\d{4}", "\\d{7}(?:\\d{3})?", , , "6846221234"], [, , "684(?:2(?:5[2468]|72)|7(?:3[13]|70))\\d{4}", "\\d{10}", , , "6847331234"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002123456"],
[, , "900[2-9]\\d{6}", "\\d{10}", , , "9002123456"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "NA", "NA"], "AS", 1, "011", "1", , , "1", , , , , , [, , "NA", "NA"], , "684", [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], AT:[, [, , "[1-9]\\d{3,12}", "\\d{3,13}"], [, , "1\\d{3,12}|(?:2(?:1[467]|2[13-8]|5[2357]|6[1-46-8]|7[1-8]|8[124-7]|9[1458])|3(?:1[1-8]|3[23568]|4[5-7]|5[1378]|6[1-38]|8[3-68])|4(?:2[1-8]|35|63|7[1368]|8[2457])|5(?:12|2[1-8]|3[357]|4[147]|5[12578]|6[37])|6(?:13|2[1-47]|4[1-35-8]|5[468]|62)|7(?:2[1-8]|3[25]|4[13478]|5[68]|6[16-8]|7[1-6]|9[45]))\\d{3,10}",
"\\d{3,13}", , , "1234567890"], [, , "6(?:44|5[0-3579]|6[013-9]|[7-9]\\d)\\d{4,10}", "\\d{7,13}", , , "644123456"], [, , "80[02]\\d{6,10}", "\\d{9,13}", , , "800123456"], [, , "(?:711|9(?:0[01]|3[019]))\\d{6,10}", "\\d{9,13}", , , "900123456"], [, , "8(?:10|2[018])\\d{6,10}", "\\d{9,13}", , , "810123456"], [, , "NA", "NA"], [, , "780\\d{6,10}", "\\d{9,13}", , , "780123456"], "AT", 43, "00", "0", , , "0", , , , [[, "(1)(\\d{3,12})", "$1 $2", ["1"], "0$1", "", 0], [, "(5\\d)(\\d{3,5})", "$1 $2", ["5[079]"],
"0$1", "", 0], [, "(5\\d)(\\d{3})(\\d{3,4})", "$1 $2 $3", ["5[079]"], "0$1", "", 0], [, "(5\\d)(\\d{4})(\\d{4,7})", "$1 $2 $3", ["5[079]"], "0$1", "", 0], [, "(\\d{3})(\\d{3,10})", "$1 $2", ["316|46|51|732|6(?:44|5[0-3579]|[6-9])|7(?:1|[28]0)|[89]"], "0$1", "", 0], [, "(\\d{4})(\\d{3,9})", "$1 $2", ["2|3(?:1[1-578]|[3-8])|4[2378]|5[2-6]|6(?:[12]|4[1-35-9]|5[468])|7(?:2[1-8]|35|4[1-8]|[5-79])"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "5(?:(?:0[1-9]|17)\\d{2,10}|[79]\\d{3,11})|720\\d{6,10}",
"\\d{5,13}", , , "50123"], , , [, , "NA", "NA"]], AU:[, [, , "[1-578]\\d{5,9}", "\\d{6,10}"], [, , "[237]\\d{8}|8(?:[68]\\d{3}|7[0-69]\\d{2}|9(?:[02-9]\\d{2}|1(?:[0-57-9]\\d|6[0135-9])))\\d{4}", "\\d{8,9}", , , "212345678"], [, , "14(?:5\\d|71)\\d{5}|4(?:[0-2]\\d|3[0-57-9]|4[47-9]|5[0-25-9]|6[6-9]|7[03-9]|8[147-9]|9[017-9])\\d{6}", "\\d{9}", , , "412345678"], [, , "180(?:0\\d{3}|2)\\d{3}", "\\d{7,10}", , , "1800123456"], [, , "190[0126]\\d{6}", "\\d{10}", , , "1900123456"], [, , "13(?:00\\d{2})?\\d{4}",
"\\d{6,10}", , , "1300123456"], [, , "500\\d{6}", "\\d{9}", , , "500123456"], [, , "550\\d{6}", "\\d{9}", , , "550123456"], "AU", 61, "(?:14(?:1[14]|34|4[17]|[56]6|7[47]|88))?001[14-689]", "0", , , "0", , "0011", , [[, "([2378])(\\d{4})(\\d{4})", "$1 $2 $3", ["[2378]"], "(0$1)", "", 0], [, "(\\d{3})(\\d{3})(\\d{3})", "$1 $2 $3", ["[45]|14"], "0$1", "", 0], [, "(16)(\\d{3})(\\d{2,4})", "$1 $2 $3", ["16"], "0$1", "", 0], [, "(1[389]\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["1(?:[38]0|90)", "1(?:[38]00|90)"],
"$1", "", 0], [, "(180)(2\\d{3})", "$1 $2", ["180", "1802"], "$1", "", 0], [, "(19\\d)(\\d{3})", "$1 $2", ["19[13]"], "$1", "", 0], [, "(19\\d{2})(\\d{4})", "$1 $2", ["19[67]"], "$1", "", 0], [, "(13)(\\d{2})(\\d{2})", "$1 $2 $3", ["13[1-9]"], "$1", "", 0]], , [, , "16\\d{3,7}", "\\d{5,9}", , , "1612345"], 1, , [, , "1(?:3(?:\\d{4}|00\\d{6})|80(?:0\\d{6}|2\\d{3}))", "\\d{6,10}", , , "1300123456"], [, , "NA", "NA"], , , [, , "NA", "NA"]], AW:[, [, , "[25-9]\\d{6}", "\\d{7}"], [, , "5(?:2\\d|8[1-9])\\d{4}",
"\\d{7}", , , "5212345"], [, , "(?:5(?:6\\d|9[2-478])|6(?:[039]0|22|4[01]|6[0-2])|7[34]\\d|9(?:6[45]|9[4-8]))\\d{4}", "\\d{7}", , , "5601234"], [, , "800\\d{4}", "\\d{7}", , , "8001234"], [, , "900\\d{4}", "\\d{7}", , , "9001234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "28\\d{5}|501\\d{4}", "\\d{7}", , , "5011234"], "AW", 297, "00", , , , , , , , [[, "(\\d{3})(\\d{4})", "$1 $2", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], AX:[, [, , "[135]\\d{5,9}|[27]\\d{4,9}|4\\d{5,10}|6\\d{7,8}|8\\d{6,9}",
"\\d{5,12}"], [, , "18[1-8]\\d{3,9}", "\\d{6,12}", , , "1812345678"], [, , "4\\d{5,10}|50\\d{4,8}", "\\d{6,11}", , , "412345678"], [, , "800\\d{4,7}", "\\d{7,10}", , , "8001234567"], [, , "[67]00\\d{5,6}", "\\d{8,9}", , , "600123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "AX", 358, "00|99[049]", "0", , , "0", , , , , , [, , "NA", "NA"], , , [, , "[13]00\\d{3,7}|2(?:0(?:0\\d{3,7}|2[023]\\d{1,6}|9[89]\\d{1,6}))|60(?:[12]\\d{5,6}|6\\d{7})|7(?:1\\d{7}|3\\d{8}|5[03-9]\\d{2,7})", "\\d{5,10}",
, , "100123"], [, , "[13]0\\d{4,8}|2(?:0(?:[016-8]\\d{3,7}|[2-59]\\d{2,7})|9\\d{4,8})|60(?:[12]\\d{5,6}|6\\d{7})|7(?:1\\d{7}|3\\d{8}|5[03-9]\\d{2,7})", "\\d{5,10}", , , "10112345"], , , [, , "NA", "NA"]], AZ:[, [, , "[1-9]\\d{8}", "\\d{7,9}"], [, , "(?:1[28]\\d|2(?:02|1[24]|2[2-4]|33|[45]2|6[23])|365)\\d{6}", "\\d{7,9}", , , "123123456"], [, , "(?:4[04]|5[015]|60|7[07])\\d{7}", "\\d{9}", , , "401234567"], [, , "88\\d{7}", "\\d{9}", , , "881234567"], [, , "900200\\d{3}", "\\d{9}", , , "900200123"],
[, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "AZ", 994, "00", "0", , , "0", , , , [[, "(\\d{2})(\\d{3})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["(?:1[28]|2(?:[45]2|[0-36])|365)"], "(0$1)", "", 0], [, "(\\d{2})(\\d{3})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["[4-8]"], "0$1", "", 0], [, "(\\d{3})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["9"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], BA:[, [, , "[3-9]\\d{7,8}", "\\d{6,9}"], [, , "(?:[35]\\d|49)\\d{6}",
"\\d{6,8}", , , "30123456"], [, , "6(?:03|44|71|[1-356])\\d{6}", "\\d{8,9}", , , "61123456"], [, , "8[08]\\d{6}", "\\d{8}", , , "80123456"], [, , "9[0246]\\d{6}", "\\d{8}", , , "90123456"], [, , "8[12]\\d{6}", "\\d{8}", , , "82123456"], [, , "NA", "NA"], [, , "NA", "NA"], "BA", 387, "00", "0", , , "0", , , , [[, "(\\d{2})(\\d{3})(\\d{3})", "$1 $2-$3", ["[3-5]"], "0$1", "", 0], [, "(\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["6[1-356]|[7-9]"], "0$1", "", 0], [, "(\\d{2})(\\d{2})(\\d{2})(\\d{3})", "$1 $2 $3 $4",
["6[047]"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "70[23]\\d{5}", "\\d{8}", , , "70223456"], , , [, , "NA", "NA"]], BB:[, [, , "[2589]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "246[2-9]\\d{6}", "\\d{7}(?:\\d{3})?", , , "2462345678"], [, , "246(?:(?:2[346]|45|82)\\d|25[0-46])\\d{4}", "\\d{10}", , , "2462501234"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002123456"], [, , "900[2-9]\\d{6}", "\\d{10}", , , "9002123456"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}",
"\\d{10}", , , "5002345678"], [, , "NA", "NA"], "BB", 1, "011", "1", , , "1", , , , , , [, , "NA", "NA"], , "246", [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], BD:[, [, , "[2-79]\\d{5,9}|1\\d{9}|8[0-7]\\d{4,8}", "\\d{6,10}"], [, , "2(?:7(?:1[0-267]|2[0-289]|3[0-29]|[46][01]|5[1-3]|7[017]|91)|8(?:0[125]|[139][1-6]|2[0157-9]|6[1-35]|7[1-5]|8[1-8])|9(?:0[0-2]|1[0-4]|2[568]|3[3-6]|5[5-7]|6[0167]|7[15]|8[0146-8]))\\d{4}|3(?:12?[5-7]\\d{2}|0(?:2(?:[025-79]\\d|[348]\\d{1,2})|3(?:[2-4]\\d|[56]\\d?))|2(?:1\\d{2}|2(?:[12]\\d|[35]\\d{1,2}|4\\d?))|3(?:1\\d{2}|2(?:[2356]\\d|4\\d{1,2}))|4(?:1\\d{2}|2(?:2\\d{1,2}|[47]|5\\d{2}))|5(?:1\\d{2}|29)|[67]1\\d{2}|8(?:1\\d{2}|2(?:2\\d{2}|3|4\\d)))\\d{3}|4(?:0(?:2(?:[09]\\d|7)|33\\d{2})|1\\d{3}|2(?:1\\d{2}|2(?:[25]\\d?|[348]\\d|[67]\\d{1,2}))|3(?:1\\d{2}(?:\\d{2})?|2(?:[045]\\d|[236-9]\\d{1,2})|32\\d{2})|4(?:[18]\\d{2}|2(?:[2-46]\\d{2}|3)|5[25]\\d{2})|5(?:1\\d{2}|2(?:3\\d|5))|6(?:[18]\\d{2}|2(?:3(?:\\d{2})?|[46]\\d{1,2}|5\\d{2}|7\\d)|5(?:3\\d?|4\\d|[57]\\d{1,2}|6\\d{2}|8))|71\\d{2}|8(?:[18]\\d{2}|23\\d{2}|54\\d{2})|9(?:[18]\\d{2}|2[2-5]\\d{2}|53\\d{1,2}))\\d{3}|5(?:02[03489]\\d{2}|1\\d{2}|2(?:1\\d{2}|2(?:2(?:\\d{2})?|[457]\\d{2}))|3(?:1\\d{2}|2(?:[37](?:\\d{2})?|[569]\\d{2}))|4(?:1\\d{2}|2[46]\\d{2})|5(?:1\\d{2}|26\\d{1,2})|6(?:[18]\\d{2}|2|53\\d{2})|7(?:1|24)\\d{2}|8(?:1|26)\\d{2}|91\\d{2})\\d{3}|6(?:0(?:1\\d{2}|2(?:3\\d{2}|4\\d{1,2}))|2(?:2[2-5]\\d{2}|5(?:[3-5]\\d{2}|7)|8\\d{2})|3(?:1|2[3478])\\d{2}|4(?:1|2[34])\\d{2}|5(?:1|2[47])\\d{2}|6(?:[18]\\d{2}|6(?:2(?:2\\d|[34]\\d{2})|5(?:[24]\\d{2}|3\\d|5\\d{1,2})))|72[2-5]\\d{2}|8(?:1\\d{2}|2[2-5]\\d{2})|9(?:1\\d{2}|2[2-6]\\d{2}))\\d{3}|7(?:(?:02|[3-589]1|6[12]|72[24])\\d{2}|21\\d{3}|32)\\d{3}|8(?:(?:4[12]|[5-7]2|1\\d?)|(?:0|3[12]|[5-7]1|217)\\d)\\d{4}|9(?:[35]1|(?:[024]2|81)\\d|(?:1|[24]1)\\d{2})\\d{3}",
"\\d{6,9}", , , "27111234"], [, , "(?:1[13-9]\\d|(?:3[78]|44)[02-9]|6(?:44|6[02-9]))\\d{7}", "\\d{10}", , , "1812345678"], [, , "80[03]\\d{7}", "\\d{10}", , , "8001234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "96(?:0[49]|1[0-4]|6[69])\\d{6}", "\\d{10}", , , "9604123456"], "BD", 880, "00[12]?", "0", , , "0", , "00", , [[, "(2)(\\d{7})", "$1-$2", ["2"], "0$1", "", 0], [, "(\\d{2})(\\d{4,6})", "$1-$2", ["[3-79]1"], "0$1", "", 0], [, "(\\d{4})(\\d{3,6})", "$1-$2", ["1|3(?:0|[2-58]2)|4(?:0|[25]2|3[23]|[4689][25])|5(?:[02-578]2|6[25])|6(?:[0347-9]2|[26][25])|7[02-9]2|8(?:[023][23]|[4-7]2)|9(?:[02][23]|[458]2|6[016])"],
"0$1", "", 0], [, "(\\d{3})(\\d{3,7})", "$1-$2", ["[3-79][2-9]|8"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], BE:[, [, , "[1-9]\\d{7,8}", "\\d{8,9}"], [, , "(?:1[0-69]|[23][2-8]|4[23]|5\\d|6[013-57-9]|71|8[1-79]|9[2-4])\\d{6}|80[2-8]\\d{5}", "\\d{8}", , , "12345678"], [, , "4(?:6[0135-8]|[79]\\d|8[3-9])\\d{6}", "\\d{9}", , , "470123456"], [, , "800\\d{5}", "\\d{8}", , , "80012345"], [, , "(?:70[2-467]|90[0-79])\\d{5}", "\\d{8}", , , "90123456"],
[, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "BE", 32, "00", "0", , , "0", , , , [[, "(\\d{3})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["4[6-9]"], "0$1", "", 0], [, "(\\d)(\\d{3})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["[23]|4[23]|9[2-4]"], "0$1", "", 0], [, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["[156]|7[018]|8(?:0[1-9]|[1-79])"], "0$1", "", 0], [, "(\\d{3})(\\d{2})(\\d{3})", "$1 $2 $3", ["(?:80|9)0"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "78\\d{6}", "\\d{8}",
, , "78123456"], , , [, , "NA", "NA"]], BF:[, [, , "[267]\\d{7}", "\\d{8}"], [, , "2(?:0(?:49|5[23]|9[016-9])|4(?:4[569]|5[4-6]|7[0179])|5(?:[34]\\d|50))\\d{4}", "\\d{8}", , , "20491234"], [, , "6(?:[0-689]\\d|7[0-5])\\d{5}|7\\d{7}", "\\d{8}", , , "70123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "BF", 226, "00", , , , , , , , [[, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA",
"NA"], , , [, , "NA", "NA"]], BG:[, [, , "[23567]\\d{5,7}|[489]\\d{6,8}", "\\d{5,9}"], [, , "2(?:[0-8]\\d{5,6}|9\\d{4,6})|(?:[36]\\d|5[1-9]|8[1-6]|9[1-7])\\d{5,6}|(?:4(?:[124-7]\\d|3[1-6])|7(?:0[1-9]|[1-9]\\d))\\d{4,5}", "\\d{5,8}", , , "2123456"], [, , "(?:8[7-9]\\d|9(?:8\\d|99))\\d{6}|4(?:3[0789]|8\\d)\\d{5}", "\\d{8,9}", , , "48123456"], [, , "800\\d{5}", "\\d{8}", , , "80012345"], [, , "90\\d{6}", "\\d{8}", , , "90123456"], [, , "NA", "NA"], [, , "700\\d{5}", "\\d{5,9}", , , "70012345"], [, ,
"NA", "NA"], "BG", 359, "00", "0", , , "0", , , , [[, "(2)(\\d{5})", "$1 $2", ["29"], "0$1", "", 0], [, "(2)(\\d{3})(\\d{3,4})", "$1 $2 $3", ["2"], "0$1", "", 0], [, "(\\d{3})(\\d{4})", "$1 $2", ["43[124-7]|70[1-9]"], "0$1", "", 0], [, "(\\d{3})(\\d{3})(\\d{2})", "$1 $2 $3", ["43[124-7]|70[1-9]"], "0$1", "", 0], [, "(\\d{3})(\\d{2})(\\d{3})", "$1 $2 $3", ["[78]00"], "0$1", "", 0], [, "(\\d{3})(\\d{3})(\\d{3})", "$1 $2 $3", ["999"], "0$1", "", 0], [, "(\\d{2})(\\d{3})(\\d{2,3})", "$1 $2 $3", ["[356]|4[124-7]|7[1-9]|8[1-6]|9[1-7]"],
"0$1", "", 0], [, "(\\d{2})(\\d{3})(\\d{3,4})", "$1 $2 $3", ["48|8[7-9]|9[08]"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], BH:[, [, , "[136-9]\\d{7}", "\\d{8}"], [, , "(?:1(?:3[1356]|6[0156]|7\\d)\\d|6(?:1[16]\\d|500|6(?:0\\d|3[12]|44|7[7-9])|9[69][69])|7(?:1(?:11|78)|7\\d{2}))\\d{4}", "\\d{8}", , , "17001234"], [, , "(?:3(?:[1-4679]\\d|5[013569]|8[0-47-9])\\d|6(?:3(?:00|33|6[16])|6(?:[69]\\d|3[03-9]|7[0-6])))\\d{4}", "\\d{8}", , , "36001234"],
[, , "80\\d{6}", "\\d{8}", , , "80123456"], [, , "(?:87|9[014578])\\d{6}", "\\d{8}", , , "90123456"], [, , "84\\d{6}", "\\d{8}", , , "84123456"], [, , "NA", "NA"], [, , "NA", "NA"], "BH", 973, "00", , , , , , , , [[, "(\\d{4})(\\d{4})", "$1 $2", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], BI:[, [, , "[267]\\d{7}", "\\d{8}"], [, , "22(?:2[0-7]|[3-5]0)\\d{4}", "\\d{8}", , , "22201234"], [, , "(?:[26]9|7[14-9])\\d{6}", "\\d{8}", , , "79561234"],
[, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "BI", 257, "00", , , , , , , , [[, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], BJ:[, [, , "[2689]\\d{7}|7\\d{3}", "\\d{4,8}"], [, , "2(?:02|1[037]|2[45]|3[68])\\d{5}", "\\d{8}", , , "20211234"], [, , "(?:6[146-8]|9[03-9])\\d{6}", "\\d{8}", , , "90011234"], [, , "7[3-5]\\d{2}", "\\d{4}", , , "7312"], [, ,
"NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "857[58]\\d{4}", "\\d{8}", , , "85751234"], "BJ", 229, "00", , , , , , , , [[, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "81\\d{6}", "\\d{8}", , , "81123456"], , , [, , "NA", "NA"]], BL:[, [, , "[56]\\d{8}", "\\d{9}"], [, , "590(?:2[7-9]|5[12]|87)\\d{4}", "\\d{9}", , , "590271234"], [, , "690(?:0[0-7]|[1-9]\\d)\\d{4}", "\\d{9}", , , "690301234"], [, , "NA", "NA"], [, , "NA",
"NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "BL", 590, "00", "0", , , "0", , , , , , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], BM:[, [, , "[4589]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "441(?:2(?:02|23|61|[3479]\\d)|[46]\\d{2}|5(?:4\\d|60|89)|824)\\d{4}", "\\d{7}(?:\\d{3})?", , , "4412345678"], [, , "441(?:[37]\\d|5[0-39])\\d{5}", "\\d{10}", , , "4413701234"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002123456"], [, , "900[2-9]\\d{6}",
"\\d{10}", , , "9002123456"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "NA", "NA"], "BM", 1, "011", "1", , , "1", , , , , , [, , "NA", "NA"], , "441", [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], BN:[, [, , "[2-578]\\d{6}", "\\d{7}"], [, , "2(?:[013-9]\\d|2[0-7])\\d{4}|[3-5]\\d{6}", "\\d{7}", , , "2345678"], [, , "22[89]\\d{4}|[78]\\d{6}", "\\d{7}", , , "7123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"],
[, , "NA", "NA"], "BN", 673, "00", , , , , , , , [[, "([2-578]\\d{2})(\\d{4})", "$1 $2", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], BO:[, [, , "[23467]\\d{7}", "\\d{7,8}"], [, , "(?:2(?:2\\d{2}|5(?:11|[258]\\d|9[67])|6(?:12|2\\d|9[34])|8(?:2[34]|39|62))|3(?:3\\d{2}|4(?:6\\d|8[24])|8(?:25|42|5[257]|86|9[25])|9(?:2\\d|3[234]|4[248]|5[24]|6[2-6]|7\\d))|4(?:4\\d{2}|6(?:11|[24689]\\d|72)))\\d{4}", "\\d{7,8}", , , "22123456"], [, , "[67]\\d{7}", "\\d{8}",
, , "71234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "BO", 591, "00(1\\d)?", "0", , , "0(1\\d)?", , , , [[, "([234])(\\d{7})", "$1 $2", ["[234]"], "", "0$CC $1", 0], [, "([67]\\d{7})", "$1", ["[67]"], "", "0$CC $1", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], BQ:[, [, , "[347]\\d{6}", "\\d{7}"], [, , "(?:318[023]|416[023]|7(?:1[578]|50)\\d)\\d{3}", "\\d{7}", , , "7151234"], [, , "(?:318[14-68]|416[15-9]|7(?:0[01]|7[07]|[89]\\d)\\d)\\d{3}",
"\\d{7}", , , "3181234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "BQ", 599, "00", , , , , , , , , , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], BR:[, [, , "[1-46-9]\\d{7,10}|5\\d{8,9}", "\\d{8,11}"], [, , "1[1-9][2-5]\\d{7}|(?:[4689][1-9]|2[12478]|3[1-578]|5[1-5]|7[13-579])[2-5]\\d{7}", "\\d{8,11}", , , "1123456789"], [, , "(?:1[1-9]|2[12478]|[89][1-9])(?:7|9\\d)\\d{7}|(?:3[1-578]|7[13-579])9?[6-9]\\d{7}|(?:[46][1-9]|5[1-5])[6-9]\\d{7}",
"\\d{10,11}", , , "11961234567"], [, , "800\\d{6,7}", "\\d{8,11}", , , "800123456"], [, , "[359]00\\d{6,7}", "\\d{8,11}", , , "300123456"], [, , "[34]00\\d{5}", "\\d{8}", , , "40041234"], [, , "NA", "NA"], [, , "NA", "NA"], "BR", 55, "00(?:1[45]|2[135]|31|4[13])", "0", , , "0(?:(1[245]|2[135]|31|4[13])(\\d{10,11}))?", "$2", , , [[, "(\\d{4})(\\d{4})", "$1-$2", ["[2-9](?:[1-9]|0[1-9])"], "$1", "", 0], [, "(\\d{5})(\\d{4})", "$1-$2", ["9(?:[1-9]|0[1-9])"], "$1", "", 0], [, "(\\d{3,5})", "$1", ["1[125689]"],
"$1", "", 0], [, "(\\d{2})(\\d{5})(\\d{4})", "$1 $2-$3", ["(?:[189][1-9]|2[12478]|3[1-578]|7[13-579])9"], "($1)", "0 $CC ($1)", 0], [, "(\\d{2})(\\d{4})(\\d{4})", "$1 $2-$3", ["[1-9][1-9]"], "($1)", "0 $CC ($1)", 0], [, "([34]00\\d)(\\d{4})", "$1-$2", ["[34]00"], "", "", 0], [, "([3589]00)(\\d{2,3})(\\d{4})", "$1 $2 $3", ["[3589]00"], "0$1", "", 0]], [[, "(\\d{2})(\\d{5})(\\d{4})", "$1 $2-$3", ["(?:[189][1-9]|2[12478]|3[1-578]|7[13-579])9"], "($1)", "0 $CC ($1)", 0], [, "(\\d{2})(\\d{4})(\\d{4})",
"$1 $2-$3", ["[1-9][1-9]"], "($1)", "0 $CC ($1)", 0], [, "([34]00\\d)(\\d{4})", "$1-$2", ["[34]00"], "", "", 0], [, "([3589]00)(\\d{2,3})(\\d{4})", "$1 $2 $3", ["[3589]00"], "0$1", "", 0]], [, , "NA", "NA"], , , [, , "[34]00\\d{5}", "\\d{8}", , , "40041234"], [, , "NA", "NA"], , , [, , "NA", "NA"]], BS:[, [, , "[2589]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "242(?:3(?:02|[236][1-9]|4[0-24-9]|5[0-68]|7[3467]|8[0-4]|9[2-467])|461|502|6(?:0[1-3]|12|7[67]|8[78]|9[89])|7(?:02|88))\\d{4}", "\\d{7}(?:\\d{3})?",
, , "2423456789"], [, , "242(?:3(?:5[79]|[79]5)|4(?:[2-4][1-9]|5[1-8]|6[2-8]|7\\d|81)|5(?:2[45]|3[35]|44|5[1-9]|65|77)|6[34]6|727)\\d{4}", "\\d{10}", , , "2423591234"], [, , "242300\\d{4}|8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002123456"], [, , "900[2-9]\\d{6}", "\\d{10}", , , "9002123456"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "NA", "NA"], "BS", 1, "011", "1", , , "1", , , , , , [, , "NA", "NA"], , "242", [, , "NA", "NA"], [, ,
"NA", "NA"], , , [, , "NA", "NA"]], BT:[, [, , "[1-8]\\d{6,7}", "\\d{6,8}"], [, , "(?:2[3-6]|[34][5-7]|5[236]|6[2-46]|7[246]|8[2-4])\\d{5}", "\\d{6,7}", , , "2345678"], [, , "[17]7\\d{6}", "\\d{8}", , , "17123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "BT", 975, "00", , , , , , , , [[, "([17]7)(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["1|77"], "", "", 0], [, "([2-8])(\\d{3})(\\d{3})", "$1 $2 $3", ["[2-68]|7[246]"], "", "", 0]], , [, , "NA", "NA"],
, , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], BW:[, [, , "[2-79]\\d{6,7}", "\\d{7,8}"], [, , "(?:2(?:4[0-48]|6[0-24]|9[0578])|3(?:1[0235-9]|55|6\\d|7[01]|9[0-57])|4(?:6[03]|7[1267]|9[0-5])|5(?:3[0389]|4[0489]|7[1-47]|88|9[0-49])|6(?:2[1-35]|5[149]|8[067]))\\d{4}", "\\d{7}", , , "2401234"], [, , "7(?:[1-6]\\d|7[014-8])\\d{5}", "\\d{8}", , , "71123456"], [, , "NA", "NA"], [, , "90\\d{5}", "\\d{7}", , , "9012345"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "79[12][01]\\d{4}", "\\d{8}",
, , "79101234"], "BW", 267, "00", , , , , , , , [[, "(\\d{3})(\\d{4})", "$1 $2", ["[2-6]"], "", "", 0], [, "(7\\d)(\\d{3})(\\d{3})", "$1 $2 $3", ["7"], "", "", 0], [, "(90)(\\d{5})", "$1 $2", ["9"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], BY:[, [, , "[1-4]\\d{8}|800\\d{3,7}|[89]\\d{9,10}", "\\d{6,11}"], [, , "(?:1(?:5(?:1[1-5]|[24]\\d|6[2-4]|9[1-7])|6(?:[235]\\d|4[1-7])|7\\d{2})|2(?:1(?:[246]\\d|3[0-35-9]|5[1-9])|2(?:[235]\\d|4[0-8])|3(?:[26]\\d|3[02-79]|4[024-7]|5[03-7])))\\d{5}",
"\\d{6,11}", , , "152450911"], [, , "(?:2(?:5[5679]|9[1-9])|33\\d|44\\d)\\d{6}", "\\d{9}", , , "294911911"], [, , "8(?:0[13]|20\\d)\\d{7}|800\\d{3,7}", "\\d{6,11}", , , "8011234567"], [, , "(?:810|902)\\d{7}", "\\d{10}", , , "9021234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "249\\d{6}", "\\d{9}", , , "249123456"], "BY", 375, "810", "8", , , "8?0?", , "8~10", , [[, "(\\d{2})(\\d{3})(\\d{2})(\\d{2})", "$1 $2-$3-$4", ["17[0-3589]|2[4-9]|[34]", "17(?:[02358]|1[0-2]|9[0189])|2[4-9]|[34]"], "8 0$1",
"", 0], [, "(\\d{3})(\\d{2})(\\d{2})(\\d{2})", "$1 $2-$3-$4", ["1(?:5[24]|6[235]|7[467])|2(?:1[246]|2[25]|3[26])", "1(?:5[24]|6(?:2|3[04-9]|5[0346-9])|7(?:[46]|7[37-9]))|2(?:1[246]|2[25]|3[26])"], "8 0$1", "", 0], [, "(\\d{4})(\\d{2})(\\d{3})", "$1 $2-$3", ["1(?:5[169]|6[3-5]|7[179])|2(?:1[35]|2[34]|3[3-5])", "1(?:5[169]|6(?:3[1-3]|4|5[125])|7(?:1[3-9]|7[0-24-6]|9[2-7]))|2(?:1[35]|2[34]|3[3-5])"], "8 0$1", "", 0], [, "([89]\\d{2})(\\d{3})(\\d{4})", "$1 $2 $3", ["8[01]|9"], "8 $1", "", 0], [, "(82\\d)(\\d{4})(\\d{4})",
"$1 $2 $3", ["82"], "8 $1", "", 0], [, "(800)(\\d{3})", "$1 $2", ["800"], "8 $1", "", 0], [, "(800)(\\d{2})(\\d{2,4})", "$1 $2 $3", ["800"], "8 $1", "", 0]], , [, , "NA", "NA"], , , [, , "8(?:[013]|[12]0)\\d{8}|800\\d{3,7}|902\\d{7}", "\\d{6,11}", , , "82012345678"], [, , "NA", "NA"], , , [, , "NA", "NA"]], BZ:[, [, , "[2-8]\\d{6}|0\\d{10}", "\\d{7}(?:\\d{4})?"], [, , "[234578][02]\\d{5}", "\\d{7}", , , "2221234"], [, , "6[0-367]\\d{5}", "\\d{7}", , , "6221234"], [, , "0800\\d{7}", "\\d{11}", , ,
"08001234123"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "BZ", 501, "00", , , , , , , , [[, "(\\d{3})(\\d{4})", "$1-$2", ["[2-8]"], "", "", 0], [, "(0)(800)(\\d{4})(\\d{3})", "$1-$2-$3-$4", ["0"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], 1, , [, , "NA", "NA"]], CA:[, [, , "[2-9]\\d{9}|3\\d{6}", "\\d{7}(?:\\d{3})?"], [, , "(?:2(?:04|[23]6|[48]9|50)|3(?:06|43|65)|4(?:03|1[68]|3[178]|50)|5(?:06|1[49]|48|79|8[17])|6(?:0[04]|13|22|39|47)|7(?:0[59]|78|8[02])|8(?:[06]7|19|73)|90[25])[2-9]\\d{6}|310\\d{4}",
"\\d{7}(?:\\d{3})?", , , "2042345678"], [, , "(?:2(?:04|[23]6|[48]9|50)|3(?:06|43|65)|4(?:03|1[68]|3[178]|50)|5(?:06|1[49]|48|79|8[17])|6(?:0[04]|13|22|39|47)|7(?:0[59]|78|8[02])|8(?:[06]7|19|73)|90[25])[2-9]\\d{6}", "\\d{7}(?:\\d{3})?", , , "2042345678"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}|310\\d{4}", "\\d{7}(?:\\d{3})?", , , "8002123456"], [, , "900[2-9]\\d{6}", "\\d{10}", , , "9002123456"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "NA", "NA"],
"CA", 1, "011", "1", , , "1", , , , , , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], CC:[, [, , "[1458]\\d{5,9}", "\\d{6,10}"], [, , "89162\\d{4}", "\\d{8,9}", , , "891621234"], [, , "14(?:5\\d|71)\\d{5}|4(?:[0-2]\\d|3[0-57-9]|4[47-9]|5[0-25-9]|6[6-9]|7[03-9]|8[17-9]|9[017-9])\\d{6}", "\\d{9}", , , "412345678"], [, , "1(?:80(?:0\\d{2})?|3(?:00\\d{2})?)\\d{4}", "\\d{6,10}", , , "1800123456"], [, , "190[0126]\\d{6}", "\\d{10}", , , "1900123456"], [, , "NA", "NA"],
[, , "500\\d{6}", "\\d{9}", , , "500123456"], [, , "550\\d{6}", "\\d{9}", , , "550123456"], "CC", 61, "(?:14(?:1[14]|34|4[17]|[56]6|7[47]|88))?001[14-689]", "0", , , "0", , "0011", , , , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], CD:[, [, , "[2-6]\\d{6}|[18]\\d{6,8}|9\\d{8}", "\\d{7,9}"], [, , "1(?:2\\d{7}|\\d{6})|[2-6]\\d{6}", "\\d{7,9}", , , "1234567"], [, , "8(?:[0-2459]\\d{2}|8)\\d{5}|9[7-9]\\d{7}", "\\d{7,9}", , , "991234567"], [, , "NA", "NA"], [, , "NA",
"NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "CD", 243, "00", "0", , , "0", , , , [[, "(\\d{2})(\\d{3})(\\d{4})", "$1 $2 $3", ["12"], "0$1", "", 0], [, "([89]\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["8[0-2459]|9"], "0$1", "", 0], [, "(\\d{2})(\\d{2})(\\d{3})", "$1 $2 $3", ["88"], "0$1", "", 0], [, "(\\d{2})(\\d{5})", "$1 $2", ["[1-6]"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], CF:[, [, , "[278]\\d{7}", "\\d{8}"], [, , "2[12]\\d{6}",
"\\d{8}", , , "21612345"], [, , "7[0257]\\d{6}", "\\d{8}", , , "70012345"], [, , "NA", "NA"], [, , "8776\\d{4}", "\\d{8}", , , "87761234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "CF", 236, "00", , , , , , , , [[, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], CG:[, [, , "[028]\\d{8}", "\\d{9}"], [, , "222[1-589]\\d{5}", "\\d{9}", , , "222123456"], [, , "0[14-6]\\d{7}", "\\d{9}", ,
, "061234567"], [, , "NA", "NA"], [, , "800\\d{6}", "\\d{9}", , , "800123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "CG", 242, "00", , , , , , , , [[, "(\\d{2})(\\d{3})(\\d{4})", "$1 $2 $3", ["[02]"], "", "", 0], [, "(\\d)(\\d{4})(\\d{4})", "$1 $2 $3", ["8"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], 1, , [, , "NA", "NA"]], CH:[, [, , "[2-9]\\d{8}|860\\d{9}", "\\d{9}(?:\\d{3})?"], [, , "(?:2[12467]|3[1-4]|4[134]|5[256]|6[12]|[7-9]1)\\d{7}", "\\d{9}",
, , "212345678"], [, , "7[5-9]\\d{7}", "\\d{9}", , , "781234567"], [, , "800\\d{6}", "\\d{9}", , , "800123456"], [, , "90[016]\\d{6}", "\\d{9}", , , "900123456"], [, , "84[0248]\\d{6}", "\\d{9}", , , "840123456"], [, , "878\\d{6}", "\\d{9}", , , "878123456"], [, , "NA", "NA"], "CH", 41, "00", "0", , , "0", , , , [[, "([2-9]\\d)(\\d{3})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["[2-7]|[89]1"], "0$1", "", 0], [, "([89]\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["8[047]|90"], "0$1", "", 0], [, "(\\d{3})(\\d{2})(\\d{3})(\\d{2})(\\d{2})",
"$1 $2 $3 $4 $5", ["860"], "0$1", "", 0]], , [, , "74[0248]\\d{6}", "\\d{9}", , , "740123456"], , , [, , "NA", "NA"], [, , "5[18]\\d{7}", "\\d{9}", , , "581234567"], , , [, , "860\\d{9}", "\\d{12}", , , "860123456789"]], CI:[, [, , "[02-7]\\d{7}", "\\d{8}"], [, , "(?:2(?:0[023]|1[02357]|[23][045]|4[03-5])|3(?:0[06]|1[069]|[2-4][07]|5[09]|6[08]))\\d{5}", "\\d{8}", , , "21234567"], [, , "(?:0[1-9]|4\\d|5[4-9]|6[015-79]|7[578])\\d{6}", "\\d{8}", , , "01234567"], [, , "NA", "NA"], [, , "NA", "NA"], [,
, "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "CI", 225, "00", , , , , , , , [[, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], 1, , [, , "NA", "NA"]], CK:[, [, , "[2-57]\\d{4}", "\\d{5}"], [, , "(?:2\\d|3[13-7]|4[1-5])\\d{3}", "\\d{5}", , , "21234"], [, , "(?:5[0-68]|7\\d)\\d{3}", "\\d{5}", , , "71234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "CK", 682, "00", , ,
, , , , , [[, "(\\d{2})(\\d{3})", "$1 $2", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], CL:[, [, , "(?:[2-9]|600|123)\\d{7,8}", "\\d{7,11}"], [, , "2(?:2\\d{7}|3(?:20|22)\\d{5}|1962\\d{4})|(?:3[2-5]|[47][1-35]|5[1-3578]|6[13-57])\\d{7}", "\\d{7,9}", , , "221234567"], [, , "9[4-9]\\d{7}", "\\d{8,9}", , , "961234567"], [, , "800\\d{6}|1230\\d{7}", "\\d{9,11}", , , "800123456"], [, , "NA", "NA"], [, , "600\\d{7,8}", "\\d{10,11}", , , "6001234567"],
[, , "NA", "NA"], [, , "44\\d{7}", "\\d{9}", , , "441234567"], "CL", 56, "(?:0|1(?:1[0-69]|2[0-57]|5[13-58]|69|7[0167]|8[018]))0", "0", , , "0|(1(?:1[0-69]|2[0-57]|5[13-58]|69|7[0167]|8[018]))", , , , [[, "(\\d)(\\d{4})(\\d{4})", "$1 $2 $3", ["2[23]"], "($1)", "$CC ($1)", 0], [, "(\\d{2})(\\d{3})(\\d{4})", "$1 $2 $3", ["[357]|4[1-35]|6[13-57]"], "($1)", "$CC ($1)", 0], [, "(9)(\\d{4})(\\d{4})", "$1 $2 $3", ["9"], "0$1", "", 0], [, "(44)(\\d{3})(\\d{4})", "$1 $2 $3", ["44"], "0$1", "", 0], [, "([68]00)(\\d{3})(\\d{3,4})",
"$1 $2 $3", ["60|8"], "$1", "", 0], [, "(600)(\\d{3})(\\d{2})(\\d{3})", "$1 $2 $3 $4", ["60"], "$1", "", 0], [, "(1230)(\\d{3})(\\d{4})", "$1 $2 $3", ["1"], "$1", "", 0], [, "(\\d{5})(\\d{4})", "$1 $2", ["219"], "($1)", "$CC ($1)", 0], [, "(\\d{4,5})", "$1", ["[1-9]"], "$1", "", 0]], [[, "(\\d)(\\d{4})(\\d{4})", "$1 $2 $3", ["2[23]"], "($1)", "$CC ($1)", 0], [, "(\\d{2})(\\d{3})(\\d{4})", "$1 $2 $3", ["[357]|4[1-35]|6[13-57]"], "($1)", "$CC ($1)", 0], [, "(9)(\\d{4})(\\d{4})", "$1 $2 $3", ["9"],
"0$1", "", 0], [, "(44)(\\d{3})(\\d{4})", "$1 $2 $3", ["44"], "0$1", "", 0], [, "([68]00)(\\d{3})(\\d{3,4})", "$1 $2 $3", ["60|8"], "$1", "", 0], [, "(600)(\\d{3})(\\d{2})(\\d{3})", "$1 $2 $3 $4", ["60"], "$1", "", 0], [, "(1230)(\\d{3})(\\d{4})", "$1 $2 $3", ["1"], "$1", "", 0], [, "(\\d{5})(\\d{4})", "$1 $2", ["219"], "($1)", "$CC ($1)", 0]], [, , "NA", "NA"], , , [, , "600\\d{7,8}", "\\d{10,11}", , , "6001234567"], [, , "NA", "NA"], , , [, , "NA", "NA"]], CM:[, [, , "[2368]\\d{7,8}", "\\d{8,9}"],
[, , "2(?:22|33|4[23])\\d{6}", "\\d{9}", , , "222123456"], [, , "6[5-9]\\d{7}", "\\d{9}", , , "671234567"], [, , "800\\d{5}", "\\d{8}", , , "80012345"], [, , "88\\d{6}", "\\d{8}", , , "88012345"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "CM", 237, "00", , , , , , , , [[, "([26])(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4 $5", ["[26]"], "", "", 0], [, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["[23]|88"], "", "", 0], [, "(800)(\\d{2})(\\d{3})", "$1 $2 $3", ["80"], "", "",
0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], CN:[, [, , "[1-7]\\d{6,11}|8[0-357-9]\\d{6,9}|9\\d{7,10}", "\\d{4,12}"], [, , "21(?:100\\d{2}|95\\d{3,4}|\\d{8,10})|(?:10|2[02-57-9]|3(?:11|7[179])|4(?:[15]1|3[12])|5(?:1\\d|2[37]|3[12]|51|7[13-79]|9[15])|7(?:31|5[457]|6[09]|91)|8(?:[57]1|98))(?:100\\d{2}|95\\d{3,4}|\\d{8})|(?:3(?:1[02-9]|35|49|5\\d|7[02-68]|9[1-68])|4(?:1[02-9]|2[179]|3[3-9]|5[2-9]|6[4789]|7\\d|8[23])|5(?:3[03-9]|4[36]|5[02-9]|6[1-46]|7[028]|80|9[2-46-9])|6(?:3[1-5]|6[0238]|9[12])|7(?:01|[17]\\d|2[248]|3[04-9]|4[3-6]|5[0-3689]|6[2368]|9[02-9])|8(?:1[236-8]|2[5-7]|3\\d|5[4-9]|7[02-9]|8[3678]|9[1-7])|9(?:0[1-3689]|1[1-79]|[379]\\d|4[13]|5[1-5]))(?:100\\d{2}|95\\d{3,4}|\\d{7})|80(?:29|6[03578]|7[018]|81)\\d{4}",
"\\d{4,12}", , , "1012345678"], [, , "1(?:[38]\\d|4[57]|5[0-35-9]|7[06-8])\\d{8}", "\\d{11}", , , "13123456789"], [, , "(?:10)?800\\d{7}", "\\d{10,12}", , , "8001234567"], [, , "16[08]\\d{5}", "\\d{8}", , , "16812345"], [, , "400\\d{7}|950\\d{7,8}|(?:10|2[0-57-9]|3(?:[157]\\d|35|49|9[1-68])|4(?:[17]\\d|2[179]|[35][1-9]|6[4789]|8[23])|5(?:[1357]\\d|2[37]|4[36]|6[1-46]|80|9[1-9])|6(?:3[1-5]|6[0238]|9[12])|7(?:01|[1579]\\d|2[248]|3[014-9]|4[3-6]|6[023689])|8(?:1[236-8]|2[5-7]|[37]\\d|5[14-9]|8[3678]|9[1-8])|9(?:0[1-3689]|1[1-79]|[379]\\d|4[13]|5[1-5]))96\\d{3,4}",
"\\d{7,11}", , , "4001234567"], [, , "NA", "NA"], [, , "NA", "NA"], "CN", 86, "(1(?:[129]\\d{3}|79\\d{2}))?00", "0", , , "(1(?:[129]\\d{3}|79\\d{2}))|0", , "00", , [[, "(80\\d{2})(\\d{4})", "$1 $2", ["80[2678]"], "0$1", "$CC $1", 1], [, "([48]00)(\\d{3})(\\d{4})", "$1 $2 $3", ["[48]00"], "", "", 0], [, "(\\d{5,6})", "$1", ["100|95"], "", "", 0], [, "(\\d{2})(\\d{5,6})", "$1 $2", ["(?:10|2\\d)[19]", "(?:10|2\\d)(?:10|9[56])", "(?:10|2\\d)(?:100|9[56])"], "0$1", "$CC $1", 0], [, "(\\d{3})(\\d{5,6})",
"$1 $2", ["[3-9]", "[3-9]\\d{2}[19]", "[3-9]\\d{2}(?:10|9[56])"], "0$1", "$CC $1", 0], [, "(\\d{3,4})(\\d{4})", "$1 $2", ["[2-9]"], "", "", 0], [, "(21)(\\d{4})(\\d{4,6})", "$1 $2 $3", ["21"], "0$1", "$CC $1", 1], [, "([12]\\d)(\\d{4})(\\d{4})", "$1 $2 $3", ["10[1-9]|2[02-9]", "10[1-9]|2[02-9]", "10(?:[1-79]|8(?:[1-9]|0[1-9]))|2[02-9]"], "0$1", "$CC $1", 1], [, "(\\d{3})(\\d{4})(\\d{4})", "$1 $2 $3", ["3(?:11|7[179])|4(?:[15]1|3[12])|5(?:1|2[37]|3[12]|51|7[13-79]|9[15])|7(?:31|5[457]|6[09]|91)|8(?:[57]1|98)"],
"0$1", "$CC $1", 1], [, "(\\d{3})(\\d{3})(\\d{4})", "$1 $2 $3", ["3(?:1[02-9]|35|49|5|7[02-68]|9[1-68])|4(?:1[02-9]|2[179]|[35][2-9]|6[4789]|7\\d|8[23])|5(?:3[03-9]|4[36]|5[02-9]|6[1-46]|7[028]|80|9[2-46-9])|6(?:3[1-5]|6[0238]|9[12])|7(?:01|[1579]|2[248]|3[04-9]|4[3-6]|6[2368])|8(?:1[236-8]|2[5-7]|3|5[4-9]|7[02-9]|8[3678]|9[1-7])|9(?:0[1-3689]|1[1-79]|[379]|4[13]|5[1-5])"], "0$1", "$CC $1", 1], [, "(\\d{3})(\\d{4})(\\d{4})", "$1 $2 $3", ["1[3-578]"], "", "$CC $1", 0], [, "(10800)(\\d{3})(\\d{4})",
"$1 $2 $3", ["108", "1080", "10800"], "", "", 0], [, "(\\d{3})(\\d{7,8})", "$1 $2", ["950"], "", "", 0]], [[, "(80\\d{2})(\\d{4})", "$1 $2", ["80[2678]"], "0$1", "$CC $1", 1], [, "([48]00)(\\d{3})(\\d{4})", "$1 $2 $3", ["[48]00"], "", "", 0], [, "(\\d{2})(\\d{5,6})", "$1 $2", ["(?:10|2\\d)[19]", "(?:10|2\\d)(?:10|9[56])", "(?:10|2\\d)(?:100|9[56])"], "0$1", "$CC $1", 0], [, "(\\d{3})(\\d{5,6})", "$1 $2", ["[3-9]", "[3-9]\\d{2}[19]", "[3-9]\\d{2}(?:10|9[56])"], "0$1", "$CC $1", 0], [, "(21)(\\d{4})(\\d{4,6})",
"$1 $2 $3", ["21"], "0$1", "$CC $1", 1], [, "([12]\\d)(\\d{4})(\\d{4})", "$1 $2 $3", ["10[1-9]|2[02-9]", "10[1-9]|2[02-9]", "10(?:[1-79]|8(?:[1-9]|0[1-9]))|2[02-9]"], "0$1", "$CC $1", 1], [, "(\\d{3})(\\d{4})(\\d{4})", "$1 $2 $3", ["3(?:11|7[179])|4(?:[15]1|3[12])|5(?:1|2[37]|3[12]|51|7[13-79]|9[15])|7(?:31|5[457]|6[09]|91)|8(?:[57]1|98)"], "0$1", "$CC $1", 1], [, "(\\d{3})(\\d{3})(\\d{4})", "$1 $2 $3", ["3(?:1[02-9]|35|49|5|7[02-68]|9[1-68])|4(?:1[02-9]|2[179]|[35][2-9]|6[4789]|7\\d|8[23])|5(?:3[03-9]|4[36]|5[02-9]|6[1-46]|7[028]|80|9[2-46-9])|6(?:3[1-5]|6[0238]|9[12])|7(?:01|[1579]|2[248]|3[04-9]|4[3-6]|6[2368])|8(?:1[236-8]|2[5-7]|3|5[4-9]|7[02-9]|8[3678]|9[1-7])|9(?:0[1-3689]|1[1-79]|[379]|4[13]|5[1-5])"],
"0$1", "$CC $1", 1], [, "(\\d{3})(\\d{4})(\\d{4})", "$1 $2 $3", ["1[3-578]"], "", "$CC $1", 0], [, "(10800)(\\d{3})(\\d{4})", "$1 $2 $3", ["108", "1080", "10800"], "", "", 0], [, "(\\d{3})(\\d{7,8})", "$1 $2", ["950"], "", "", 0]], [, , "NA", "NA"], , , [, , "(?:4|(?:10)?8)00\\d{7}|950\\d{7,8}", "\\d{10,12}", , , "4001234567"], [, , "NA", "NA"], , , [, , "NA", "NA"]], CO:[, [, , "(?:[13]\\d{0,3}|[24-8])\\d{7}", "\\d{7,11}"], [, , "[124-8][2-9]\\d{6}", "\\d{8}", , , "12345678"], [, , "3(?:0[0-5]|1\\d|2[0-2]|5[01])\\d{7}",
"\\d{10}", , , "3211234567"], [, , "1800\\d{7}", "\\d{11}", , , "18001234567"], [, , "19(?:0[01]|4[78])\\d{7}", "\\d{11}", , , "19001234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "CO", 57, "00(?:4(?:[14]4|56)|[579])", "0", , , "0([3579]|4(?:44|56))?", , , , [[, "(\\d)(\\d{7})", "$1 $2", ["1(?:8[2-9]|9[0-3]|[2-7])|[24-8]", "1(?:8[2-9]|9(?:09|[1-3])|[2-7])|[24-8]"], "($1)", "0$CC $1", 0], [, "(\\d{3})(\\d{7})", "$1 $2", ["3"], "", "0$CC $1", 0], [, "(1)(\\d{3})(\\d{7})", "$1-$2-$3",
["1(?:80|9[04])", "1(?:800|9(?:0[01]|4[78]))"], "0$1", "", 0]], [[, "(\\d)(\\d{7})", "$1 $2", ["1(?:8[2-9]|9[0-3]|[2-7])|[24-8]", "1(?:8[2-9]|9(?:09|[1-3])|[2-7])|[24-8]"], "($1)", "0$CC $1", 0], [, "(\\d{3})(\\d{7})", "$1 $2", ["3"], "", "0$CC $1", 0], [, "(1)(\\d{3})(\\d{7})", "$1 $2 $3", ["1(?:80|9[04])", "1(?:800|9(?:0[01]|4[78]))"]]], [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], CR:[, [, , "[24-9]\\d{7,9}", "\\d{8,10}"], [, , "2[0-24-7]\\d{6}", "\\d{8}", ,
, "22123456"], [, , "5(?:0[01]|7[0-3])\\d{5}|6(?:[0-2]\\d|30)\\d{5}|7[0-3]\\d{6}|8[3-9]\\d{6}", "\\d{8}", , , "83123456"], [, , "800\\d{7}", "\\d{10}", , , "8001234567"], [, , "90[059]\\d{7}", "\\d{10}", , , "9001234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "210[0-6]\\d{4}|4\\d{7}|5100\\d{4}", "\\d{8}", , , "40001234"], "CR", 506, "00", , , , "(19(?:0[012468]|1[09]|20|66|77|99))", , , , [[, "(\\d{4})(\\d{4})", "$1 $2", ["[24-7]|8[3-9]"], "", "$CC $1", 0], [, "(\\d{3})(\\d{3})(\\d{4})", "$1-$2-$3",
["[89]0"], "", "$CC $1", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], CU:[, [, , "[2-57]\\d{5,7}", "\\d{4,8}"], [, , "2[1-4]\\d{5,6}|3(?:1\\d{6}|[23]\\d{4,6})|4(?:[125]\\d{5,6}|[36]\\d{6}|[78]\\d{4,6})|7\\d{6,7}", "\\d{4,8}", , , "71234567"], [, , "5\\d{7}", "\\d{8}", , , "51234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "CU", 53, "119", "0", , , "0", , , , [[, "(\\d)(\\d{6,7})", "$1 $2", ["7"], "(0$1)",
"", 0], [, "(\\d{2})(\\d{4,6})", "$1 $2", ["[2-4]"], "(0$1)", "", 0], [, "(\\d)(\\d{7})", "$1 $2", ["5"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], CV:[, [, , "[259]\\d{6}", "\\d{7}"], [, , "2(?:2[1-7]|3[0-8]|4[12]|5[1256]|6\\d|7[1-3]|8[1-5])\\d{4}", "\\d{7}", , , "2211234"], [, , "(?:9\\d|59)\\d{5}", "\\d{7}", , , "9911234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "CV", 238, "0", , , , , ,
, , [[, "(\\d{3})(\\d{2})(\\d{2})", "$1 $2 $3", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], CW:[, [, , "[169]\\d{6,7}", "\\d{7,8}"], [, , "9(?:[48]\\d{2}|50\\d|7(?:2[0-24]|[34]\\d|6[35-7]|77|8[7-9]))\\d{4}", "\\d{7,8}", , , "94151234"], [, , "9(?:5(?:[1246]\\d|3[01])|6(?:[16-9]\\d|3[01]))\\d{4}", "\\d{7,8}", , , "95181234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "(?:10|69)\\d{5}", "\\d{7}", , , "1011234"], [, , "NA", "NA"], [, , "NA", "NA"],
"CW", 599, "00", , , , , , , , [[, "(\\d{3})(\\d{4})", "$1 $2", ["[13-7]"], "", "", 0], [, "(9)(\\d{3})(\\d{4})", "$1 $2 $3", ["9"], "", "", 0]], , [, , "955\\d{5}", "\\d{7,8}", , , "95581234"], 1, , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], CX:[, [, , "[1458]\\d{5,9}", "\\d{6,10}"], [, , "89164\\d{4}", "\\d{8,9}", , , "891641234"], [, , "14(?:5\\d|71)\\d{5}|4(?:[0-2]\\d|3[0-57-9]|4[47-9]|5[0-25-9]|6[6-9]|7[03-9]|8[17-9]|9[017-9])\\d{6}", "\\d{9}", , , "412345678"], [, , "1(?:80(?:0\\d{2})?|3(?:00\\d{2})?)\\d{4}",
"\\d{6,10}", , , "1800123456"], [, , "190[0126]\\d{6}", "\\d{10}", , , "1900123456"], [, , "NA", "NA"], [, , "500\\d{6}", "\\d{9}", , , "500123456"], [, , "550\\d{6}", "\\d{9}", , , "550123456"], "CX", 61, "(?:14(?:1[14]|34|4[17]|[56]6|7[47]|88))?001[14-689]", "0", , , "0", , "0011", , , , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], CY:[, [, , "[257-9]\\d{7}", "\\d{8}"], [, , "2[2-6]\\d{6}", "\\d{8}", , , "22345678"], [, , "9[5-79]\\d{6}", "\\d{8}", , , "96123456"],
[, , "800\\d{5}", "\\d{8}", , , "80001234"], [, , "90[09]\\d{5}", "\\d{8}", , , "90012345"], [, , "80[1-9]\\d{5}", "\\d{8}", , , "80112345"], [, , "700\\d{5}", "\\d{8}", , , "70012345"], [, , "NA", "NA"], "CY", 357, "00", , , , , , , , [[, "(\\d{2})(\\d{6})", "$1 $2", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "(?:50|77)\\d{6}", "\\d{8}", , , "77123456"], , , [, , "NA", "NA"]], CZ:[, [, , "[2-8]\\d{8}|9\\d{8,11}", "\\d{9,12}"], [, , "2\\d{8}|(?:3[1257-9]|4[16-9]|5[13-9])\\d{7}",
"\\d{9,12}", , , "212345678"], [, , "(?:60[1-8]|7(?:0[2-5]|[2379]\\d))\\d{6}", "\\d{9,12}", , , "601123456"], [, , "800\\d{6}", "\\d{9,12}", , , "800123456"], [, , "9(?:0[05689]|76)\\d{6}", "\\d{9,12}", , , "900123456"], [, , "8[134]\\d{7}", "\\d{9,12}", , , "811234567"], [, , "70[01]\\d{6}", "\\d{9,12}", , , "700123456"], [, , "9[17]0\\d{6}", "\\d{9,12}", , , "910123456"], "CZ", 420, "00", , , , , , , , [[, "([2-9]\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["[2-8]|9[015-7]"], "", "", 0], [, "(96\\d)(\\d{3})(\\d{3})(\\d{3})",
"$1 $2 $3 $4", ["96"], "", "", 0], [, "(9\\d)(\\d{3})(\\d{3})(\\d{3})", "$1 $2 $3 $4", ["9[36]"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "9(?:5\\d|7[234])\\d{6}", "\\d{9,12}", , , "972123456"], , , [, , "9(?:3\\d{9}|6\\d{7,10})", "\\d{9,12}", , , "93123456789"]], DE:[, [, , "[1-35-9]\\d{3,14}|4(?:[0-8]\\d{4,12}|9(?:[0-37]\\d|4(?:[1-35-8]|4\\d?)|5\\d{1,2}|6[1-8]\\d?)\\d{2,8})", "\\d{2,15}"], [, , "[246]\\d{5,13}|3(?:0\\d{3,13}|2\\d{9}|[3-9]\\d{4,13})|5(?:0[2-8]|[1256]\\d|[38][0-8]|4\\d{0,2}|[79][0-7])\\d{3,11}|7(?:0[2-8]|[1-9]\\d)\\d{3,10}|8(?:0[2-9]|[1-9]\\d)\\d{3,10}|9(?:0[6-9]\\d{3,10}|1\\d{4,12}|[2-9]\\d{4,11})",
"\\d{2,15}", , , "30123456"], [, , "1(?:5[0-25-9]\\d{8}|6[023]\\d{7,8}|7(?:[0-57-9]\\d?|6\\d)\\d{7})", "\\d{10,11}", , , "15123456789"], [, , "800\\d{7,12}", "\\d{10,15}", , , "8001234567890"], [, , "137[7-9]\\d{6}|900(?:[135]\\d{6}|9\\d{7})", "\\d{10,11}", , , "9001234567"], [, , "1(?:3(?:7[1-6]\\d{6}|8\\d{4})|80\\d{5,11})", "\\d{7,14}", , , "18012345"], [, , "700\\d{8}", "\\d{11}", , , "70012345678"], [, , "NA", "NA"], "DE", 49, "00", "0", , , "0", , , , [[, "(1\\d{2})(\\d{7,8})", "$1 $2", ["1[67]"],
"0$1", "", 0], [, "(15\\d{3})(\\d{6})", "$1 $2", ["15[0568]"], "0$1", "", 0], [, "(1\\d{3})(\\d{7})", "$1 $2", ["15"], "0$1", "", 0], [, "(\\d{2})(\\d{3,11})", "$1 $2", ["3[02]|40|[68]9"], "0$1", "", 0], [, "(\\d{3})(\\d{3,11})", "$1 $2", ["2(?:\\d1|0[2389]|1[24]|28|34)|3(?:[3-9][15]|40)|[4-8][1-9]1|9(?:06|[1-9]1)"], "0$1", "", 0], [, "(\\d{4})(\\d{2,11})", "$1 $2", ["[24-6]|[7-9](?:\\d[1-9]|[1-9]\\d)|3(?:[3569][02-46-9]|4[2-4679]|7[2-467]|8[2-46-8])", "[24-6]|[7-9](?:\\d[1-9]|[1-9]\\d)|3(?:3(?:0[1-467]|2[127-9]|3[124578]|[46][1246]|7[1257-9]|8[1256]|9[145])|4(?:2[135]|3[1357]|4[13578]|6[1246]|7[1356]|9[1346])|5(?:0[14]|2[1-3589]|3[1357]|4[1246]|6[1-4]|7[1346]|8[13568]|9[1246])|6(?:0[356]|2[1-489]|3[124-6]|4[1347]|6[13]|7[12579]|8[1-356]|9[135])|7(?:2[1-7]|3[1357]|4[145]|6[1-5]|7[1-4])|8(?:21|3[1468]|4[1347]|6[0135-9]|7[1467]|8[136])|9(?:0[12479]|2[1358]|3[1357]|4[134679]|6[1-9]|7[136]|8[147]|9[1468]))"],
"0$1", "", 0], [, "(3\\d{4})(\\d{1,10})", "$1 $2", ["3"], "0$1", "", 0], [, "(800)(\\d{7,12})", "$1 $2", ["800"], "0$1", "", 0], [, "(177)(99)(\\d{7,8})", "$1 $2 $3", ["177", "1779", "17799"], "0$1", "", 0], [, "(\\d{3})(\\d)(\\d{4,10})", "$1 $2 $3", ["(?:18|90)0|137", "1(?:37|80)|900[1359]"], "0$1", "", 0], [, "(1\\d{2})(\\d{5,11})", "$1 $2", ["181"], "0$1", "", 0], [, "(18\\d{3})(\\d{6})", "$1 $2", ["185", "1850", "18500"], "0$1", "", 0], [, "(18\\d{2})(\\d{7})", "$1 $2", ["18[68]"], "0$1", "",
0], [, "(18\\d)(\\d{8})", "$1 $2", ["18[2-579]"], "0$1", "", 0], [, "(700)(\\d{4})(\\d{4})", "$1 $2 $3", ["700"], "0$1", "", 0], [, "(138)(\\d{4})", "$1 $2", ["138"], "0$1", "", 0]], , [, , "16(?:4\\d{1,10}|[89]\\d{1,11})", "\\d{4,14}", , , "16412345"], , , [, , "NA", "NA"], [, , "18(?:1\\d{5,11}|[2-9]\\d{8})", "\\d{8,14}", , , "18500123456"], , , [, , "17799\\d{7,8}", "\\d{12,13}", , , "177991234567"]], DJ:[, [, , "[27]\\d{7}", "\\d{8}"], [, , "2(?:1[2-5]|7[45])\\d{5}", "\\d{8}", , , "21360003"],
[, , "77[6-8]\\d{5}", "\\d{8}", , , "77831001"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "DJ", 253, "00", , , , , , , , [[, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], DK:[, [, , "[2-9]\\d{7}", "\\d{8}"], [, , "(?:[2-7]\\d|8[126-9]|9[1-36-9])\\d{6}", "\\d{8}", , , "32123456"], [, , "(?:[2-7]\\d|8[126-9]|9[1-36-9])\\d{6}", "\\d{8}", , , "20123456"],
[, , "80\\d{6}", "\\d{8}", , , "80123456"], [, , "90\\d{6}", "\\d{8}", , , "90123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "DK", 45, "00", , , , , , , 1, [[, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], DM:[, [, , "[57-9]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "767(?:2(?:55|66)|4(?:2[01]|4[0-25-9])|50[0-4]|70[1-3])\\d{4}", "\\d{7}(?:\\d{3})?", , , "7674201234"], [, , "767(?:2(?:[234689]5|7[5-7])|31[5-7]|61[2-7])\\d{4}",
"\\d{10}", , , "7672251234"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002123456"], [, , "900[2-9]\\d{6}", "\\d{10}", , , "9002123456"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "NA", "NA"], "DM", 1, "011", "1", , , "1", , , , , , [, , "NA", "NA"], , "767", [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], DO:[, [, , "[589]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "8(?:[04]9[2-9]\\d{6}|29(?:2(?:[0-59]\\d|6[04-9]|7[0-27]|8[0237-9])|3(?:[0-35-9]\\d|4[7-9])|[45]\\d{2}|6(?:[0-27-9]\\d|[3-5][1-9]|6[0135-8])|7(?:0[013-9]|[1-37]\\d|4[1-35689]|5[1-4689]|6[1-57-9]|8[1-79]|9[1-8])|8(?:0[146-9]|1[0-48]|[248]\\d|3[1-79]|5[01589]|6[013-68]|7[124-8]|9[0-8])|9(?:[0-24]\\d|3[02-46-9]|5[0-79]|60|7[0169]|8[57-9]|9[02-9]))\\d{4})",
"\\d{7}(?:\\d{3})?", , , "8092345678"], [, , "8[024]9[2-9]\\d{6}", "\\d{7}(?:\\d{3})?", , , "8092345678"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002123456"], [, , "900[2-9]\\d{6}", "\\d{10}", , , "9002123456"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "NA", "NA"], "DO", 1, "011", "1", , , "1", , , , , , [, , "NA", "NA"], , "8[024]9", [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], DZ:[, [, , "(?:[1-4]|[5-9]\\d)\\d{7}",
"\\d{8,9}"], [, , "(?:1\\d|2[013-79]|3[0-8]|4[0135689])\\d{6}|9619\\d{5}", "\\d{8,9}", , , "12345678"], [, , "(?:5[4-6]|7[7-9])\\d{7}|6(?:[569]\\d|7[0-6])\\d{6}", "\\d{9}", , , "551234567"], [, , "800\\d{6}", "\\d{9}", , , "800123456"], [, , "80[3-689]1\\d{5}", "\\d{9}", , , "808123456"], [, , "80[12]1\\d{5}", "\\d{9}", , , "801123456"], [, , "NA", "NA"], [, , "98[23]\\d{6}", "\\d{9}", , , "983123456"], "DZ", 213, "00", "0", , , "0", , , , [[, "([1-4]\\d)(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4",
["[1-4]"], "0$1", "", 0], [, "([5-8]\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["[5-8]"], "0$1", "", 0], [, "(9\\d)(\\d{3})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["9"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], EC:[, [, , "1\\d{9,10}|[2-8]\\d{7}|9\\d{8}", "\\d{7,11}"], [, , "[2-7][2-7]\\d{6}", "\\d{7,8}", , , "22123456"], [, , "9(?:39|[45][89]|[67][7-9]|[89]\\d)\\d{6}", "\\d{9}", , , "991234567"], [, , "1800\\d{6,7}", "\\d{10,11}", , , "18001234567"],
[, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "[2-7]890\\d{4}", "\\d{8}", , , "28901234"], "EC", 593, "00", "0", , , "0", , , , [[, "(\\d)(\\d{3})(\\d{4})", "$1 $2-$3", ["[247]|[356][2-8]"], "(0$1)", "", 0], [, "(\\d{2})(\\d{3})(\\d{4})", "$1 $2 $3", ["9"], "0$1", "", 0], [, "(1800)(\\d{3})(\\d{3,4})", "$1 $2 $3", ["1"], "$1", "", 0]], [[, "(\\d)(\\d{3})(\\d{4})", "$1-$2-$3", ["[247]|[356][2-8]"]], [, "(\\d{2})(\\d{3})(\\d{4})", "$1 $2 $3", ["9"], "0$1", "", 0], [, "(1800)(\\d{3})(\\d{3,4})",
"$1 $2 $3", ["1"], "$1", "", 0]], [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], EE:[, [, , "1\\d{3,4}|[3-9]\\d{6,7}|800\\d{6,7}", "\\d{4,10}"], [, , "(?:3[23589]|4[3-8]|6\\d|7[1-9]|88)\\d{5}", "\\d{7}", , , "3212345"], [, , "(?:5\\d|8[1-5])\\d{6}|5(?:[02]\\d{2}|1(?:[0-8]\\d|95)|5[0-478]\\d|64[0-4]|65[1-589])\\d{3}", "\\d{7,8}", , , "51234567"], [, , "800(?:0\\d{3}|1\\d|[2-9])\\d{3}", "\\d{7,10}", , , "80012345"], [, , "(?:40\\d{2}|900)\\d{4}", "\\d{7,8}", , , "9001234"],
[, , "NA", "NA"], [, , "70[0-2]\\d{5}", "\\d{8}", , , "70012345"], [, , "NA", "NA"], "EE", 372, "00", , , , , , , , [[, "([3-79]\\d{2})(\\d{4})", "$1 $2", ["[369]|4[3-8]|5(?:[0-2]|5[0-478]|6[45])|7[1-9]", "[369]|4[3-8]|5(?:[02]|1(?:[0-8]|95)|5[0-478]|6(?:4[0-4]|5[1-589]))|7[1-9]"], "", "", 0], [, "(70)(\\d{2})(\\d{4})", "$1 $2 $3", ["70"], "", "", 0], [, "(8000)(\\d{3})(\\d{3})", "$1 $2 $3", ["800", "8000"], "", "", 0], [, "([458]\\d{3})(\\d{3,4})", "$1 $2", ["40|5|8(?:00|[1-5])", "40|5|8(?:00[1-9]|[1-5])"],
"", "", 0]], , [, , "NA", "NA"], , , [, , "1\\d{3,4}|800[2-9]\\d{3}", "\\d{4,7}", , , "8002123"], [, , "1(?:2[01245]|3[0-6]|4[1-489]|5[0-59]|6[1-46-9]|7[0-27-9]|8[189]|9[012])\\d{1,2}", "\\d{4,5}", , , "12123"], , , [, , "NA", "NA"]], EG:[, [, , "1\\d{4,9}|[2456]\\d{8}|3\\d{7}|[89]\\d{8,9}", "\\d{5,10}"], [, , "(?:1(?:3[23]\\d|5(?:[23]|9\\d))|2[2-4]\\d{2}|3\\d{2}|4(?:0[2-5]|[578][23]|64)\\d|5(?:0[2-7]|[57][23])\\d|6[24-689]3\\d|8(?:2[2-57]|4[26]|6[237]|8[2-4])\\d|9(?:2[27]|3[24]|52|6[2356]|7[2-4])\\d)\\d{5}|1[69]\\d{3}",
"\\d{5,9}", , , "234567890"], [, , "1(?:0[0-269]|1[0-245]|2[0-278])\\d{7}", "\\d{10}", , , "1001234567"], [, , "800\\d{7}", "\\d{10}", , , "8001234567"], [, , "900\\d{7}", "\\d{10}", , , "9001234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "EG", 20, "00", "0", , , "0", , , , [[, "(\\d)(\\d{7,8})", "$1 $2", ["[23]"], "0$1", "", 0], [, "(\\d{3})(\\d{3})(\\d{4})", "$1 $2 $3", ["1[012]|[89]00"], "0$1", "", 0], [, "(\\d{2})(\\d{6,7})", "$1 $2", ["1[35]|[4-6]|[89][2-9]"], "0$1", "", 0]],
, [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], EH:[, [, , "[5689]\\d{8}", "\\d{9}"], [, , "528[89]\\d{5}", "\\d{9}", , , "528812345"], [, , "6(?:0[0-8]|[12-79]\\d|8[017])\\d{6}", "\\d{9}", , , "650123456"], [, , "80\\d{7}", "\\d{9}", , , "801234567"], [, , "89\\d{7}", "\\d{9}", , , "891234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "EH", 212, "00", "0", , , "0", , , , , , [, , "NA", "NA"], , "528[89]", [, , "NA", "NA"], [, , "NA", "NA"], , , [,
, "NA", "NA"]], ER:[, [, , "[178]\\d{6}", "\\d{6,7}"], [, , "1(?:1[12568]|20|40|55|6[146])\\d{4}|8\\d{6}", "\\d{6,7}", , , "8370362"], [, , "17[1-3]\\d{4}|7\\d{6}", "\\d{7}", , , "7123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "ER", 291, "00", "0", , , "0", , , , [[, "(\\d)(\\d{3})(\\d{3})", "$1 $2 $3", , "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], ES:[, [, , "[5-9]\\d{8}", "\\d{9}"], [, ,
"8(?:[13]0|[28][0-8]|[47][1-9]|5[01346-9]|6[0457-9])\\d{6}|9(?:[1238][0-8]\\d{6}|4[1-9]\\d{6}|5\\d{7}|6(?:[0-8]\\d{6}|9(?:0(?:[0-57-9]\\d{4}|6(?:0[0-8]|1[1-9]|[2-9]\\d)\\d{2})|[1-9]\\d{5}))|7(?:[124-9]\\d{2}|3(?:[0-8]\\d|9[1-9]))\\d{4})", "\\d{9}", , , "810123456"], [, , "(?:6\\d{6}|7[1-4]\\d{5}|9(?:6906(?:09|10)|7390\\d{2}))\\d{2}", "\\d{9}", , , "612345678"], [, , "[89]00\\d{6}", "\\d{9}", , , "800123456"], [, , "80[367]\\d{6}", "\\d{9}", , , "803123456"], [, , "90[12]\\d{6}", "\\d{9}", , , "901123456"],
[, , "70\\d{7}", "\\d{9}", , , "701234567"], [, , "NA", "NA"], "ES", 34, "00", , , , , , , , [[, "([89]00)(\\d{3})(\\d{3})", "$1 $2 $3", ["[89]00"], "", "", 0], [, "([5-9]\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["[568]|[79][0-8]"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "51\\d{7}", "\\d{9}", , , "511234567"], , , [, , "NA", "NA"]], ET:[, [, , "[1-59]\\d{8}", "\\d{7,9}"], [, , "(?:11(?:1(?:1[124]|2[2-57]|3[1-5]|5[5-8]|8[6-8])|2(?:13|3[6-8]|5[89]|7[05-9]|8[2-6])|3(?:2[01]|3[0-289]|4[1289]|7[1-4]|87)|4(?:1[69]|3[2-49]|4[0-3]|6[5-8])|5(?:1[57]|44|5[0-4])|6(?:18|2[69]|4[5-7]|5[1-5]|6[0-59]|8[015-8]))|2(?:2(?:11[1-9]|22[0-7]|33\\d|44[1467]|66[1-68])|5(?:11[124-6]|33[2-8]|44[1467]|55[14]|66[1-3679]|77[124-79]|880))|3(?:3(?:11[0-46-8]|22[0-6]|33[0134689]|44[04]|55[0-6]|66[01467])|4(?:44[0-8]|55[0-69]|66[0-3]|77[1-5]))|4(?:6(?:22[0-24-7]|33[1-5]|44[13-69]|55[14-689]|660|88[1-4])|7(?:11[1-9]|22[1-9]|33[13-7]|44[13-6]|55[1-689]))|5(?:7(?:227|55[05]|(?:66|77)[14-8])|8(?:11[149]|22[013-79]|33[0-68]|44[013-8]|550|66[1-5]|77\\d)))\\d{4}",
"\\d{7,9}", , , "111112345"], [, , "9(?:[1-3]\\d|5[89])\\d{6}", "\\d{9}", , , "911234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "ET", 251, "00", "0", , , "0", , , , [[, "([1-59]\\d)(\\d{3})(\\d{4})", "$1 $2 $3", , "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], FI:[, [, , "1\\d{4,11}|[2-9]\\d{4,10}", "\\d{5,12}"], [, , "1(?:[3569][1-8]\\d{3,9}|[47]\\d{5,10})|2[1-8]\\d{3,9}|3(?:[1-8]\\d{3,9}|9\\d{4,8})|[5689][1-8]\\d{3,9}",
"\\d{5,12}", , , "1312345678"], [, , "4\\d{5,10}|50\\d{4,8}", "\\d{6,11}", , , "412345678"], [, , "800\\d{4,7}", "\\d{7,10}", , , "8001234567"], [, , "[67]00\\d{5,6}", "\\d{8,9}", , , "600123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "FI", 358, "00|99[049]", "0", , , "0", , , , [[, "(\\d{3})(\\d{3,7})", "$1 $2", ["(?:[1-3]00|[6-8]0)"], "0$1", "", 0], [, "(\\d{2})(\\d{4,10})", "$1 $2", ["[14]|2[09]|50|7[135]"], "0$1", "", 0], [, "(\\d)(\\d{4,11})", "$1 $2", ["[25689][1-8]|3"], "0$1",
"", 0]], , [, , "NA", "NA"], 1, , [, , "[13]00\\d{3,7}|2(?:0(?:0\\d{3,7}|2[023]\\d{1,6}|9[89]\\d{1,6}))|60(?:[12]\\d{5,6}|6\\d{7})|7(?:1\\d{7}|3\\d{8}|5[03-9]\\d{2,7})", "\\d{5,10}", , , "100123"], [, , "[13]0\\d{4,8}|2(?:0(?:[016-8]\\d{3,7}|[2-59]\\d{2,7})|9\\d{4,8})|60(?:[12]\\d{5,6}|6\\d{7})|7(?:1\\d{7}|3\\d{8}|5[03-9]\\d{2,7})", "\\d{5,10}", , , "10112345"], , , [, , "NA", "NA"]], FJ:[, [, , "[36-9]\\d{6}|0\\d{10}", "\\d{7}(?:\\d{4})?"], [, , "(?:3[0-5]|6[25-7]|8[58])\\d{5}", "\\d{7}", , , "3212345"],
[, , "(?:7[0-8]|8[034679]|9\\d)\\d{5}", "\\d{7}", , , "7012345"], [, , "0800\\d{7}", "\\d{11}", , , "08001234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "FJ", 679, "0(?:0|52)", , , , , , "00", , [[, "(\\d{3})(\\d{4})", "$1 $2", ["[36-9]"], "", "", 0], [, "(\\d{4})(\\d{3})(\\d{4})", "$1 $2 $3", ["0"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], 1, , [, , "NA", "NA"]], FK:[, [, , "[2-7]\\d{4}", "\\d{5}"], [, , "[2-47]\\d{4}", "\\d{5}",
, , "31234"], [, , "[56]\\d{4}", "\\d{5}", , , "51234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "FK", 500, "00", , , , , , , , , , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], FM:[, [, , "[39]\\d{6}", "\\d{7}"], [, , "3[2357]0[1-9]\\d{3}|9[2-6]\\d{5}", "\\d{7}", , , "3201234"], [, , "3[2357]0[1-9]\\d{3}|9[2-7]\\d{5}", "\\d{7}", , , "3501234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"],
[, , "NA", "NA"], "FM", 691, "00", , , , , , , , [[, "(\\d{3})(\\d{4})", "$1 $2", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], FO:[, [, , "[2-9]\\d{5}", "\\d{6}"], [, , "(?:20|[3-4]\\d|8[19])\\d{4}", "\\d{6}", , , "201234"], [, , "(?:2[1-9]|5\\d|7[1-79])\\d{4}", "\\d{6}", , , "211234"], [, , "80[257-9]\\d{3}", "\\d{6}", , , "802123"], [, , "90(?:[1345][15-7]|2[125-7]|99)\\d{2}", "\\d{6}", , , "901123"], [, , "NA", "NA"], [, , "NA", "NA"], [, ,
"(?:6[0-36]|88)\\d{4}", "\\d{6}", , , "601234"], "FO", 298, "00", , , , "(10(?:01|[12]0|88))", , , , [[, "(\\d{6})", "$1", , "", "$CC $1", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], FR:[, [, , "[1-9]\\d{8}", "\\d{9}"], [, , "[1-5]\\d{8}", "\\d{9}", , , "123456789"], [, , "6\\d{8}|7(?:00\\d{6}|[3-9]\\d{7})", "\\d{9}", , , "612345678"], [, , "80\\d{7}", "\\d{9}", , , "801234567"], [, , "89[1-37-9]\\d{6}", "\\d{9}", , , "891123456"], [, , "8(?:1[019]|2[0156]|84|90)\\d{6}",
"\\d{9}", , , "810123456"], [, , "NA", "NA"], [, , "9\\d{8}", "\\d{9}", , , "912345678"], "FR", 33, "00", "0", , , "0", , , , [[, "([1-79])(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4 $5", ["[1-79]"], "0$1", "", 0], [, "(1\\d{2})(\\d{3})", "$1 $2", ["11"], "$1", "", 0], [, "(8\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["8"], "0 $1", "", 0]], [[, "([1-79])(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4 $5", ["[1-79]"], "0$1", "", 0], [, "(8\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4",
["8"], "0 $1", "", 0]], [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], GA:[, [, , "0?\\d{7}", "\\d{7,8}"], [, , "01\\d{6}", "\\d{8}", , , "01441234"], [, , "0?[2-7]\\d{6}", "\\d{7,8}", , , "06031234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "GA", 241, "00", , , , , , , , [[, "(\\d)(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["[2-7]"], "0$1", "", 0], [, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["0"], "", "",
0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], 1, , [, , "NA", "NA"]], GB:[, [, , "\\d{7,10}", "\\d{4,10}"], [, , "2(?:0[01378]|3[0189]|4[017]|8[0-46-9]|9[012])\\d{7}|1(?:(?:1(?:3[0-48]|[46][0-4]|5[012789]|7[0-49]|8[01349])|21[0-7]|31[0-8]|[459]1\\d|61[0-46-9]))\\d{6}|1(?:2(?:0[024-9]|2[3-9]|3[3-79]|4[1-689]|[58][02-9]|6[0-4789]|7[013-9]|9\\d)|3(?:0\\d|[25][02-9]|3[02-579]|[468][0-46-9]|7[1235679]|9[24578])|4(?:0[03-9]|[28][02-5789]|[37]\\d|4[02-69]|5[0-8]|[69][0-79])|5(?:0[1235-9]|2[024-9]|3[015689]|4[02-9]|5[03-9]|6\\d|7[0-35-9]|8[0-468]|9[0-5789])|6(?:0[034689]|2[0-35689]|[38][013-9]|4[1-467]|5[0-69]|6[13-9]|7[0-8]|9[0124578])|7(?:0[0246-9]|2\\d|3[023678]|4[03-9]|5[0-46-9]|6[013-9]|7[0-35-9]|8[024-9]|9[02-9])|8(?:0[35-9]|2[1-5789]|3[02-578]|4[0-578]|5[124-9]|6[2-69]|7\\d|8[02-9]|9[02569])|9(?:0[02-589]|2[02-689]|3[1-5789]|4[2-9]|5[0-579]|6[234789]|7[0124578]|8\\d|9[2-57]))\\d{6}|1(?:2(?:0(?:46[1-4]|87[2-9])|545[1-79]|76(?:2\\d|3[1-8]|6[1-6])|9(?:7(?:2[0-4]|3[2-5])|8(?:2[2-8]|7[0-4789]|8[345])))|3(?:638[2-5]|647[23]|8(?:47[04-9]|64[015789]))|4(?:044[1-7]|20(?:2[23]|8\\d)|6(?:0(?:30|5[2-57]|6[1-8]|7[2-8])|140)|8(?:052|87[123]))|5(?:24(?:3[2-79]|6\\d)|276\\d|6(?:26[06-9]|686))|6(?:06(?:4\\d|7[4-79])|295[567]|35[34]\\d|47(?:24|61)|59(?:5[08]|6[67]|74)|955[0-4])|7(?:26(?:6[13-9]|7[0-7])|442\\d|50(?:2[0-3]|[3-68]2|76))|8(?:27[56]\\d|37(?:5[2-5]|8[239])|84(?:3[2-58]))|9(?:0(?:0(?:6[1-8]|85)|52\\d)|3583|4(?:66[1-8]|9(?:2[01]|81))|63(?:23|3[1-4])|9561))\\d{3}|176888[234678]\\d{2}|16977[23]\\d{3}",
"\\d{4,10}", , , "1212345678"], [, , "7(?:[1-4]\\d\\d|5(?:0[0-8]|[13-9]\\d|2[0-35-9])|7(?:0[1-9]|[1-7]\\d|8[02-9]|9[0-689])|8(?:[014-9]\\d|[23][0-8])|9(?:[04-9]\\d|1[02-9]|2[0-35-9]|3[0-689]))\\d{6}", "\\d{10}", , , "7400123456"], [, , "80(?:0(?:1111|\\d{6,7})|8\\d{7})|500\\d{6}", "\\d{7}(?:\\d{2,3})?", , , "8001234567"], [, , "(?:87[123]|9(?:[01]\\d|8[2349]))\\d{7}", "\\d{10}", , , "9012345678"], [, , "8(?:4(?:5464\\d|[2-5]\\d{7})|70\\d{7})", "\\d{7}(?:\\d{3})?", , , "8431234567"], [, , "70\\d{8}",
"\\d{10}", , , "7012345678"], [, , "56\\d{8}", "\\d{10}", , , "5612345678"], "GB", 44, "00", "0", " x", , "0", , , , [[, "(\\d{2})(\\d{4})(\\d{4})", "$1 $2 $3", ["2|5[56]|7(?:0|6[013-9])", "2|5[56]|7(?:0|6(?:[013-9]|2[0-35-9]))"], "0$1", "", 0], [, "(\\d{3})(\\d{3})(\\d{4})", "$1 $2 $3", ["1(?:1|\\d1)|3|9[018]"], "0$1", "", 0], [, "(\\d{5})(\\d{4,5})", "$1 $2", ["1(?:38|5[23]|69|76|94)", "1(?:387|5(?:24|39)|697|768|946)", "1(?:3873|5(?:242|39[456])|697[347]|768[347]|9467)"], "0$1", "", 0], [, "(1\\d{3})(\\d{5,6})",
"$1 $2", ["1"], "0$1", "", 0], [, "(7\\d{3})(\\d{6})", "$1 $2", ["7(?:[1-5789]|62)", "7(?:[1-5789]|624)"], "0$1", "", 0], [, "(800)(\\d{4})", "$1 $2", ["800", "8001", "80011", "800111", "8001111"], "0$1", "", 0], [, "(845)(46)(4\\d)", "$1 $2 $3", ["845", "8454", "84546", "845464"], "0$1", "", 0], [, "(8\\d{2})(\\d{3})(\\d{4})", "$1 $2 $3", ["8(?:4[2-5]|7[0-3])"], "0$1", "", 0], [, "(80\\d)(\\d{3})(\\d{4})", "$1 $2 $3", ["80"], "0$1", "", 0], [, "([58]00)(\\d{6})", "$1 $2", ["[58]00"], "0$1", "",
0]], , [, , "76(?:0[012]|2[356]|4[0134]|5[49]|6[0-369]|77|81|9[39])\\d{6}", "\\d{10}", , , "7640123456"], 1, , [, , "NA", "NA"], [, , "(?:3[0347]|55)\\d{8}", "\\d{10}", , , "5512345678"], , , [, , "NA", "NA"]], GD:[, [, , "[4589]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "473(?:2(?:3[0-2]|69)|3(?:2[89]|86)|4(?:[06]8|3[5-9]|4[0-49]|5[5-79]|68|73|90)|63[68]|7(?:58|84)|800|938)\\d{4}", "\\d{7}(?:\\d{3})?", , , "4732691234"], [, , "473(?:4(?:0[2-79]|1[04-9]|20|58)|5(?:2[01]|3[3-8])|901)\\d{4}", "\\d{10}", ,
, "4734031234"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002123456"], [, , "900[2-9]\\d{6}", "\\d{10}", , , "9002123456"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "NA", "NA"], "GD", 1, "011", "1", , , "1", , , , , , [, , "NA", "NA"], , "473", [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], GE:[, [, , "[34578]\\d{8}", "\\d{6,9}"], [, , "(?:3(?:[256]\\d|4[124-9]|7[0-4])|4(?:1\\d|2[2-7]|3[1-79]|4[2-8]|7[239]|9[1-7]))\\d{6}",
"\\d{6,9}", , , "322123456"], [, , "5(?:14|5[01578]|68|7[0147-9]|9[0-35-9])\\d{6}", "\\d{9}", , , "555123456"], [, , "800\\d{6}", "\\d{9}", , , "800123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "706\\d{6}", "\\d{9}", , , "706123456"], "GE", 995, "00", "0", , , "0", , , , [[, "(\\d{3})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["[348]"], "0$1", "", 0], [, "(\\d{3})(\\d{3})(\\d{3})", "$1 $2 $3", ["7"], "0$1", "", 0], [, "(\\d{3})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["5"],
"$1", "", 0]], , [, , "NA", "NA"], , , [, , "706\\d{6}", "\\d{9}", , , "706123456"], [, , "NA", "NA"], , , [, , "NA", "NA"]], GF:[, [, , "[56]\\d{8}", "\\d{9}"], [, , "594(?:10|2[012457-9]|3[0-57-9]|4[3-9]|5[7-9]|6[0-3]|9[014])\\d{4}", "\\d{9}", , , "594101234"], [, , "694(?:[04][0-7]|1[0-5]|3[018]|[29]\\d)\\d{4}", "\\d{9}", , , "694201234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "GF", 594, "00", "0", , , "0", , , , [[, "(\\d{3})(\\d{2})(\\d{2})(\\d{2})",
"$1 $2 $3 $4", , "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], GG:[, [, , "[135789]\\d{6,9}", "\\d{6,10}"], [, , "1481\\d{6}", "\\d{6,10}", , , "1481456789"], [, , "7(?:781|839|911)\\d{6}", "\\d{10}", , , "7781123456"], [, , "80(?:0(?:1111|\\d{6,7})|8\\d{7})|500\\d{6}", "\\d{7}(?:\\d{2,3})?", , , "8001234567"], [, , "(?:87[123]|9(?:[01]\\d|8[0-3]))\\d{7}", "\\d{10}", , , "9012345678"], [, , "8(?:4(?:5464\\d|[2-5]\\d{7})|70\\d{7})", "\\d{7}(?:\\d{3})?",
, , "8431234567"], [, , "70\\d{8}", "\\d{10}", , , "7012345678"], [, , "56\\d{8}", "\\d{10}", , , "5612345678"], "GG", 44, "00", "0", " x", , "0", , , , , , [, , "76(?:0[012]|2[356]|4[0134]|5[49]|6[0-369]|77|81|9[39])\\d{6}", "\\d{10}", , , "7640123456"], , , [, , "NA", "NA"], [, , "(?:3[0347]|55)\\d{8}", "\\d{10}", , , "5512345678"], , , [, , "NA", "NA"]], GH:[, [, , "[235]\\d{8}|8\\d{7}", "\\d{7,9}"], [, , "3(?:0[237]\\d|[167](?:2[0-6]|7\\d)|2(?:2[0-5]|7\\d)|3(?:2[0-3]|7\\d)|4(?:2[013-9]|3[01]|7\\d)|5(?:2[0-7]|7\\d)|8(?:2[0-2]|7\\d)|9(?:20|7\\d))\\d{5}",
"\\d{7,9}", , , "302345678"], [, , "(?:2[034678]\\d|5(?:[047]\\d|5[3-6]|6[01]))\\d{6}", "\\d{9}", , , "231234567"], [, , "800\\d{5}", "\\d{8}", , , "80012345"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "GH", 233, "00", "0", , , "0", , , , [[, "(\\d{2})(\\d{3})(\\d{4})", "$1 $2 $3", ["[235]"], "0$1", "", 0], [, "(\\d{3})(\\d{5})", "$1 $2", ["8"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "800\\d{5}", "\\d{8}", , , "80012345"], [, , "NA", "NA"], , , [, , "NA", "NA"]],
GI:[, [, , "[2568]\\d{7}", "\\d{8}"], [, , "2(?:00\\d|1(?:6[24-7]|9\\d)|2(?:00|2[2457]))\\d{4}", "\\d{8}", , , "20012345"], [, , "(?:5[46-8]|62)\\d{6}", "\\d{8}", , , "57123456"], [, , "80\\d{6}", "\\d{8}", , , "80123456"], [, , "8[1-689]\\d{6}", "\\d{8}", , , "88123456"], [, , "87\\d{6}", "\\d{8}", , , "87123456"], [, , "NA", "NA"], [, , "NA", "NA"], "GI", 350, "00", , , , , , , , [[, "(\\d{3})(\\d{5})", "$1 $2", ["2"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , ,
[, , "NA", "NA"]], GL:[, [, , "[1-689]\\d{5}", "\\d{6}"], [, , "(?:19|3[1-6]|6[14689]|8[14-79]|9\\d)\\d{4}", "\\d{6}", , , "321000"], [, , "[245][2-9]\\d{4}", "\\d{6}", , , "221234"], [, , "80\\d{4}", "\\d{6}", , , "801234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "3[89]\\d{4}", "\\d{6}", , , "381234"], "GL", 299, "00", , , , , , , , [[, "(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], GM:[,
[, , "[2-9]\\d{6}", "\\d{7}"], [, , "(?:4(?:[23]\\d{2}|4(?:1[024679]|[6-9]\\d))|5(?:54[0-7]|6(?:[67]\\d)|7(?:1[04]|2[035]|3[58]|48))|8\\d{3})\\d{3}", "\\d{7}", , , "5661234"], [, , "(?:2[0-6]|[3679]\\d)\\d{5}", "\\d{7}", , , "3012345"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "GM", 220, "00", , , , , , , , [[, "(\\d{3})(\\d{4})", "$1 $2", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], GN:[, [, , "[367]\\d{7,8}",
"\\d{8,9}"], [, , "30(?:24|3[12]|4[1-35-7]|5[13]|6[189]|[78]1|9[1478])\\d{4}", "\\d{8}", , , "30241234"], [, , "6[02356]\\d{7}", "\\d{9}", , , "601123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "722\\d{6}", "\\d{9}", , , "722123456"], "GN", 224, "00", , , , , , , , [[, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["3"], "", "", 0], [, "(\\d{3})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["[67]"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [,
, "NA", "NA"], , , [, , "NA", "NA"]], GP:[, [, , "[56]\\d{8}", "\\d{9}"], [, , "590(?:0[13468]|1[012]|2[0-68]|3[28]|4[0-8]|5[579]|6[0189]|70|8[0-689]|9\\d)\\d{4}", "\\d{9}", , , "590201234"], [, , "690(?:0[0-7]|[1-9]\\d)\\d{4}", "\\d{9}", , , "690301234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "GP", 590, "00", "0", , , "0", , , , [[, "([56]90)(\\d{2})(\\d{4})", "$1 $2-$3", , "0$1", "", 0]], , [, , "NA", "NA"], 1, , [, , "NA", "NA"], [, , "NA", "NA"],
, , [, , "NA", "NA"]], GQ:[, [, , "[23589]\\d{8}", "\\d{9}"], [, , "3(?:3(?:3\\d[7-9]|[0-24-9]\\d[46])|5\\d{2}[7-9])\\d{4}", "\\d{9}", , , "333091234"], [, , "(?:222|551)\\d{6}", "\\d{9}", , , "222123456"], [, , "80\\d[1-9]\\d{5}", "\\d{9}", , , "800123456"], [, , "90\\d[1-9]\\d{5}", "\\d{9}", , , "900123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "GQ", 240, "00", , , , , , , , [[, "(\\d{3})(\\d{3})(\\d{3})", "$1 $2 $3", ["[235]"], "", "", 0], [, "(\\d{3})(\\d{6})", "$1 $2", ["[89]"],
"", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], GR:[, [, , "[26-9]\\d{9}", "\\d{10}"], [, , "2(?:1\\d{2}|2(?:2[1-46-9]|3[1-8]|4[1-7]|5[1-4]|6[1-8]|7[1-5]|[89][1-9])|3(?:1\\d|2[1-57]|[35][1-3]|4[13]|7[1-7]|8[124-6]|9[1-79])|4(?:1\\d|2[1-8]|3[1-4]|4[13-5]|6[1-578]|9[1-5])|5(?:1\\d|[29][1-4]|3[1-5]|4[124]|5[1-6])|6(?:1\\d|3[1245]|4[1-7]|5[13-9]|[269][1-6]|7[14]|8[1-5])|7(?:1\\d|2[1-5]|3[1-6]|4[1-7]|5[1-57]|6[135]|9[125-7])|8(?:1\\d|2[1-5]|[34][1-4]|9[1-57]))\\d{6}",
"\\d{10}", , , "2123456789"], [, , "69\\d{8}", "\\d{10}", , , "6912345678"], [, , "800\\d{7}", "\\d{10}", , , "8001234567"], [, , "90[19]\\d{7}", "\\d{10}", , , "9091234567"], [, , "8(?:0[16]|12|25)\\d{7}", "\\d{10}", , , "8011234567"], [, , "70\\d{8}", "\\d{10}", , , "7012345678"], [, , "NA", "NA"], "GR", 30, "00", , , , , , , , [[, "([27]\\d)(\\d{4})(\\d{4})", "$1 $2 $3", ["21|7"], "", "", 0], [, "(\\d{3})(\\d{3})(\\d{4})", "$1 $2 $3", ["2[2-9]1|[689]"], "", "", 0], [, "(2\\d{3})(\\d{6})", "$1 $2",
["2[2-9][02-9]"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], GT:[, [, , "[2-7]\\d{7}|1[89]\\d{9}", "\\d{8}(?:\\d{3})?"], [, , "[267][2-9]\\d{6}", "\\d{8}", , , "22456789"], [, , "[345]\\d{7}", "\\d{8}", , , "51234567"], [, , "18[01]\\d{8}", "\\d{11}", , , "18001112222"], [, , "19\\d{9}", "\\d{11}", , , "19001112222"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "GT", 502, "00", , , , , , , , [[, "(\\d{4})(\\d{4})", "$1 $2", ["[2-7]"],
"", "", 0], [, "(\\d{4})(\\d{3})(\\d{4})", "$1 $2 $3", ["1"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], GU:[, [, , "[5689]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "671(?:3(?:00|3[39]|4[349]|55|6[26])|4(?:56|7[1-9]|8[236-9])|5(?:55|6[2-5]|88)|6(?:3[2-578]|4[24-9]|5[34]|78|8[5-9])|7(?:[079]7|2[0167]|3[45]|8[789])|8(?:[2-5789]8|6[48])|9(?:2[29]|6[79]|7[179]|8[789]|9[78]))\\d{4}", "\\d{7}(?:\\d{3})?", , , "6713001234"], [, , "671(?:3(?:00|3[39]|4[349]|55|6[26])|4(?:56|7[1-9]|8[236-9])|5(?:55|6[2-5]|88)|6(?:3[2-578]|4[24-9]|5[34]|78|8[5-9])|7(?:[079]7|2[0167]|3[45]|8[789])|8(?:[2-5789]8|6[48])|9(?:2[29]|6[79]|7[179]|8[789]|9[78]))\\d{4}",
"\\d{7}(?:\\d{3})?", , , "6713001234"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002123456"], [, , "900[2-9]\\d{6}", "\\d{10}", , , "9002123456"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "NA", "NA"], "GU", 1, "011", "1", , , "1", , , 1, , , [, , "NA", "NA"], , "671", [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], GW:[, [, , "[3-79]\\d{6}", "\\d{7}"], [, , "3(?:2[0125]|3[1245]|4[12]|5[1-4]|70|9[1-467])\\d{4}", "\\d{7}",
, , "3201234"], [, , "(?:[5-7]\\d|9[012])\\d{5}", "\\d{7}", , , "5012345"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "40\\d{5}", "\\d{7}", , , "4012345"], "GW", 245, "00", , , , , , , , [[, "(\\d{3})(\\d{4})", "$1 $2", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], GY:[, [, , "[2-4679]\\d{6}", "\\d{7}"], [, , "(?:2(?:1[6-9]|2[0-35-9]|3[1-4]|5[3-9]|6\\d|7[0-24-79])|3(?:2[25-9]|3\\d)|4(?:4[0-24]|5[56])|77[1-57])\\d{4}",
"\\d{7}", , , "2201234"], [, , "6\\d{6}", "\\d{7}", , , "6091234"], [, , "(?:289|862)\\d{4}", "\\d{7}", , , "2891234"], [, , "9008\\d{3}", "\\d{7}", , , "9008123"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "GY", 592, "001", , , , , , , , [[, "(\\d{3})(\\d{4})", "$1 $2", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], HK:[, [, , "[235-7]\\d{7}|8\\d{7,8}|9\\d{4,10}", "\\d{5,11}"], [, , "(?:[23]\\d|58)\\d{6}", "\\d{8}", , , "21234567"],
[, , "(?:5[1-79]\\d|6\\d{2}|8[4-79]\\d|9(?:0[1-9]|[1-8]\\d))\\d{5}", "\\d{8}", , , "51234567"], [, , "800\\d{6}", "\\d{9}", , , "800123456"], [, , "900(?:[0-24-9]\\d{7}|3\\d{1,4})", "\\d{5,11}", , , "90012345678"], [, , "NA", "NA"], [, , "8[1-3]\\d{6}", "\\d{8}", , , "81123456"], [, , "NA", "NA"], "HK", 852, "00", , , , , , , , [[, "(\\d{4})(\\d{4})", "$1 $2", ["[235-7]|[89](?:0[1-9]|[1-9])"], "", "", 0], [, "(800)(\\d{3})(\\d{3})", "$1 $2 $3", ["800"], "", "", 0], [, "(900)(\\d{2})(\\d{3})(\\d{3})",
"$1 $2 $3 $4", ["900"], "", "", 0], [, "(900)(\\d{2,5})", "$1 $2", ["900"], "", "", 0]], , [, , "7\\d{7}", "\\d{8}", , , "71234567"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], HN:[, [, , "[237-9]\\d{7}", "\\d{8}"], [, , "2(?:2(?:0[019]|1[1-36]|[23]\\d|4[056]|5[57]|7[01389]|8[0146-9]|9[012])|4(?:2[3-59]|3[13-689]|4[0-68]|5[1-35])|5(?:4[3-5]|5\\d|6[56]|74)|6(?:[056]\\d|34|4[0-378]|[78][0-8]|9[01])|7(?:6[46-9]|7[02-9]|8[34])|8(?:79|8[0-35789]|9[1-57-9]))\\d{4}", "\\d{8}", , , "22123456"],
[, , "[37-9]\\d{7}", "\\d{8}", , , "91234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "HN", 504, "00", , , , , , , , [[, "(\\d{4})(\\d{4})", "$1-$2", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], HR:[, [, , "[1-7]\\d{5,8}|[89]\\d{6,11}", "\\d{6,12}"], [, , "1\\d{7}|(?:2[0-3]|3[1-5]|4[02-47-9]|5[1-3])\\d{6,7}", "\\d{6,9}", , , "12345678"], [, , "9(?:[1-9]\\d{6,10}|01\\d{6,9})", "\\d{8,12}", , ,
"912345678"], [, , "80[01]\\d{4,7}", "\\d{7,10}", , , "8001234567"], [, , "6(?:[01459]\\d{4,7})", "\\d{6,9}", , , "611234"], [, , "NA", "NA"], [, , "7[45]\\d{4,7}", "\\d{6,9}", , , "741234567"], [, , "NA", "NA"], "HR", 385, "00", "0", , , "0", , , , [[, "(1)(\\d{4})(\\d{3})", "$1 $2 $3", ["1"], "0$1", "", 0], [, "(6[09])(\\d{4})(\\d{3})", "$1 $2 $3", ["6[09]"], "0$1", "", 0], [, "([67]2)(\\d{3})(\\d{3,4})", "$1 $2 $3", ["[67]2"], "0$1", "", 0], [, "([2-5]\\d)(\\d{3})(\\d{3,4})", "$1 $2 $3", ["[2-5]"],
"0$1", "", 0], [, "(9\\d)(\\d{3})(\\d{3,4})", "$1 $2 $3", ["9"], "0$1", "", 0], [, "(9\\d)(\\d{4})(\\d{4})", "$1 $2 $3", ["9"], "0$1", "", 0], [, "(9\\d)(\\d{3,4})(\\d{3})(\\d{3})", "$1 $2 $3 $4", ["9"], "0$1", "", 0], [, "(\\d{2})(\\d{2})(\\d{2,3})", "$1 $2 $3", ["6[0145]|7"], "0$1", "", 0], [, "(\\d{2})(\\d{3,4})(\\d{3})", "$1 $2 $3", ["6[0145]|7"], "0$1", "", 0], [, "(80[01])(\\d{2})(\\d{2,3})", "$1 $2 $3", ["8"], "0$1", "", 0], [, "(80[01])(\\d{3,4})(\\d{3})", "$1 $2 $3", ["8"], "0$1", "", 0]],
, [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "[76]2\\d{6,7}", "\\d{8,9}", , , "62123456"], , , [, , "NA", "NA"]], HT:[, [, , "[2-489]\\d{7}", "\\d{8}"], [, , "2(?:[248]\\d|5[1-5]|94)\\d{5}", "\\d{8}", , , "22453300"], [, , "(?:3[1-9]\\d|4\\d{2}|9(?:8[0-35]|9[5-9]))\\d{5}", "\\d{8}", , , "34101234"], [, , "8\\d{7}", "\\d{8}", , , "80012345"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "98[89]\\d{5}", "\\d{8}", , , "98901234"], "HT", 509, "00", , , , , , , , [[, "(\\d{2})(\\d{2})(\\d{4})",
"$1 $2 $3", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], HU:[, [, , "[1-9]\\d{7,8}", "\\d{6,9}"], [, , "(?:1\\d|2(?:1\\d|[2-9])|3(?:[2-7]|8\\d)|4[24-9]|5[2-79]|6[23689]|7(?:1\\d|[2-9])|8[2-57-9]|9[2-69])\\d{6}", "\\d{6,9}", , , "12345678"], [, , "(?:[257]0|3[01])\\d{7}", "\\d{9}", , , "201234567"], [, , "80\\d{6}", "\\d{8}", , , "80123456"], [, , "9[01]\\d{6}", "\\d{8}", , , "90123456"], [, , "40\\d{6}", "\\d{8}", , , "40123456"], [, , "NA", "NA"],
[, , "NA", "NA"], "HU", 36, "00", "06", , , "06", , , , [[, "(1)(\\d{3})(\\d{4})", "$1 $2 $3", ["1"], "($1)", "", 0], [, "(\\d{2})(\\d{3})(\\d{3,4})", "$1 $2 $3", ["[2-9]"], "($1)", "", 0]], , [, , "NA", "NA"], , , [, , "[48]0\\d{6}", "\\d{8}", , , "80123456"], [, , "NA", "NA"], , , [, , "NA", "NA"]], ID:[, [, , "[1-9]\\d{6,10}", "\\d{5,11}"], [, , "2(?:1(?:14\\d{3}|[0-8]\\d{6,7}|500\\d{3}|9\\d{6})|2\\d{6,8}|4\\d{7,8})|(?:2(?:[35][1-4]|6[0-8]|7[1-6]|8\\d|9[1-8])|3(?:1|[25][1-8]|3[1-68]|4[1-3]|6[1-3568]|7[0-469]|8\\d)|4(?:0[1-589]|1[01347-9]|2[0-36-8]|3[0-24-68]|43|5[1-378]|6[1-5]|7[134]|8[1245])|5(?:1[1-35-9]|2[25-8]|3[124-9]|4[1-3589]|5[1-46]|6[1-8])|6(?:19?|[25]\\d|3[1-69]|4[1-6])|7(?:02|[125][1-9]|[36]\\d|4[1-8]|7[0-36-9])|9(?:0[12]|1[013-8]|2[0-479]|5[125-8]|6[23679]|7[159]|8[01346]))\\d{5,8}",
"\\d{5,11}", , , "612345678"], [, , "(?:2(?:1(?:3[145]|4[01]|5[1-469]|60|8[0359]|9\\d)|2(?:88|9[1256])|3[1-4]9|4(?:36|91)|5(?:1[349]|[2-4]9)|6[0-7]9|7(?:[1-36]9|4[39])|8[1-5]9|9[1-48]9)|3(?:19[1-3]|2[12]9|3[13]9|4(?:1[69]|39)|5[14]9|6(?:1[69]|2[89])|709)|4[13]19|5(?:1(?:19|8[39])|4[129]9|6[12]9)|6(?:19[12]|2(?:[23]9|77))|7(?:1[13]9|2[15]9|419|5(?:1[89]|29)|6[15]9|7[178]9))\\d{5,6}|8[1-35-9]\\d{7,9}", "\\d{9,11}", , , "812345678"], [, , "177\\d{6,8}|800\\d{5,7}", "\\d{8,11}", , , "8001234567"], [,
, "809\\d{7}", "\\d{10}", , , "8091234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "ID", 62, "0(?:0[1789]|10(?:00|1[67]))", "0", , , "0", , , , [[, "(\\d{2})(\\d{5,8})", "$1 $2", ["2[124]|[36]1"], "(0$1)", "", 0], [, "(\\d{3})(\\d{5,8})", "$1 $2", ["[4579]|2[035-9]|[36][02-9]"], "(0$1)", "", 0], [, "(8\\d{2})(\\d{3,4})(\\d{3,4})", "$1-$2-$3", ["8[1-35-9]"], "0$1", "", 0], [, "(177)(\\d{6,8})", "$1 $2", ["1"], "0$1", "", 0], [, "(800)(\\d{5,7})", "$1 $2", ["800"], "0$1", "", 0], [,
"(80\\d)(\\d)(\\d{3})(\\d{3})", "$1 $2 $3 $4", ["80[79]"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "8071\\d{6}", "\\d{10}", , , "8071123456"], [, , "8071\\d{6}", "\\d{10}", , , "8071123456"], , , [, , "NA", "NA"]], IE:[, [, , "[124-9]\\d{6,9}", "\\d{5,10}"], [, , "1\\d{7,8}|2(?:1\\d{6,7}|3\\d{7}|[24-9]\\d{5})|4(?:0[24]\\d{5}|[1-469]\\d{7}|5\\d{6}|7\\d{5}|8[0-46-9]\\d{7})|5(?:0[45]\\d{5}|1\\d{6}|[23679]\\d{7}|8\\d{5})|6(?:1\\d{6}|[237-9]\\d{5}|[4-6]\\d{7})|7[14]\\d{7}|9(?:1\\d{6}|[04]\\d{7}|[35-9]\\d{5})",
"\\d{5,10}", , , "2212345"], [, , "8(?:22\\d{6}|[35-9]\\d{7})", "\\d{9}", , , "850123456"], [, , "1800\\d{6}", "\\d{10}", , , "1800123456"], [, , "15(?:1[2-8]|[2-8]0|9[089])\\d{6}", "\\d{10}", , , "1520123456"], [, , "18[59]0\\d{6}", "\\d{10}", , , "1850123456"], [, , "700\\d{6}", "\\d{9}", , , "700123456"], [, , "76\\d{7}", "\\d{9}", , , "761234567"], "IE", 353, "00", "0", , , "0", , , , [[, "(1)(\\d{3,4})(\\d{4})", "$1 $2 $3", ["1"], "(0$1)", "", 0], [, "(\\d{2})(\\d{5})", "$1 $2", ["2[24-9]|47|58|6[237-9]|9[35-9]"],
"(0$1)", "", 0], [, "(\\d{3})(\\d{5})", "$1 $2", ["40[24]|50[45]"], "(0$1)", "", 0], [, "(48)(\\d{4})(\\d{4})", "$1 $2 $3", ["48"], "(0$1)", "", 0], [, "(818)(\\d{3})(\\d{3})", "$1 $2 $3", ["81"], "(0$1)", "", 0], [, "(\\d{2})(\\d{3})(\\d{3,4})", "$1 $2 $3", ["[24-69]|7[14]"], "(0$1)", "", 0], [, "([78]\\d)(\\d{3,4})(\\d{4})", "$1 $2 $3", ["76|8[35-9]"], "0$1", "", 0], [, "(700)(\\d{3})(\\d{3})", "$1 $2 $3", ["70"], "0$1", "", 0], [, "(\\d{4})(\\d{3})(\\d{3})", "$1 $2 $3", ["1(?:8[059]|5)", "1(?:8[059]0|5)"],
"$1", "", 0]], , [, , "NA", "NA"], , , [, , "18[59]0\\d{6}", "\\d{10}", , , "1850123456"], [, , "818\\d{6}", "\\d{9}", , , "818123456"], , , [, , "8[35-9]\\d{8}", "\\d{10}", , , "8501234567"]], IL:[, [, , "[17]\\d{6,9}|[2-589]\\d{3}(?:\\d{3,6})?|6\\d{3}", "\\d{4,10}"], [, , "[2-489]\\d{7}", "\\d{7,8}", , , "21234567"], [, , "5(?:[02-47-9]\\d{2}|5(?:01|2[23]|3[34]|4[45]|5[5689]|6[67]|7[0178]|[89][6-9])|6[2-9]\\d)\\d{5}", "\\d{9}", , , "501234567"], [, , "1(?:80[019]\\d{3}|255)\\d{3}", "\\d{7,10}",
, , "1800123456"], [, , "1(?:212|(?:9(?:0[01]|19)|200)\\d{2})\\d{4}", "\\d{8,10}", , , "1919123456"], [, , "1700\\d{6}", "\\d{10}", , , "1700123456"], [, , "NA", "NA"], [, , "7(?:18\\d|2[23]\\d|3[237]\\d|47\\d|6(?:5\\d|8[0168])|7\\d{2}|8(?:2\\d|33|55|77|81)|99\\d)\\d{5}", "\\d{9}", , , "771234567"], "IL", 972, "0(?:0|1[2-9])", "0", , , "0", , , , [[, "([2-489])(\\d{3})(\\d{4})", "$1-$2-$3", ["[2-489]"], "0$1", "", 0], [, "([57]\\d)(\\d{3})(\\d{4})", "$1-$2-$3", ["[57]"], "0$1", "", 0], [, "(1)([7-9]\\d{2})(\\d{3})(\\d{3})",
"$1-$2-$3-$4", ["1[7-9]"], "$1", "", 0], [, "(1255)(\\d{3})", "$1-$2", ["125"], "$1", "", 0], [, "(1200)(\\d{3})(\\d{3})", "$1-$2-$3", ["120"], "$1", "", 0], [, "(1212)(\\d{2})(\\d{2})", "$1-$2-$3", ["121"], "$1", "", 0], [, "(1599)(\\d{6})", "$1-$2", ["15"], "$1", "", 0], [, "(\\d{4})", "*$1", ["[2-689]"], "$1", "", 0]], , [, , "NA", "NA"], , , [, , "1700\\d{6}|[2-689]\\d{3}", "\\d{4,10}", , , "1700123456"], [, , "[2-689]\\d{3}|1599\\d{6}", "\\d{4}(?:\\d{6})?", , , "1599123456"], , , [, , "NA",
"NA"]], IM:[, [, , "[135789]\\d{6,9}", "\\d{6,10}"], [, , "1624\\d{6}", "\\d{6,10}", , , "1624456789"], [, , "7[569]24\\d{6}", "\\d{10}", , , "7924123456"], [, , "808162\\d{4}", "\\d{10}", , , "8081624567"], [, , "(?:872299|90[0167]624)\\d{4}", "\\d{10}", , , "9016247890"], [, , "8(?:4(?:40[49]06|5624\\d)|70624\\d)\\d{3}", "\\d{10}", , , "8456247890"], [, , "70\\d{8}", "\\d{10}", , , "7012345678"], [, , "56\\d{8}", "\\d{10}", , , "5612345678"], "IM", 44, "00", "0", " x", , "0", , , , , , [, , "NA",
"NA"], , , [, , "NA", "NA"], [, , "3(?:08162\\d|3\\d{5}|4(?:40[49]06|5624\\d)|7(?:0624\\d|2299\\d))\\d{3}|55\\d{8}", "\\d{10}", , , "5512345678"], , , [, , "NA", "NA"]], IN:[, [, , "1\\d{7,12}|[2-9]\\d{9,10}", "\\d{6,13}"], [, , "(?:11|2[02]|33|4[04]|79)[2-7]\\d{7}|80[2-467]\\d{7}|(?:1(?:2[0-249]|3[0-25]|4[145]|[59][14]|6[014]|7[1257]|8[01346])|2(?:1[257]|3[013]|4[01]|5[0137]|6[0158]|78|8[1568]|9[14])|3(?:26|4[1-3]|5[34]|6[01489]|7[02-46]|8[159])|4(?:1[36]|2[1-47]|3[15]|5[12]|6[0-26-9]|7[0-24-9]|8[013-57]|9[014-7])|5(?:1[025]|[36][25]|22|4[28]|5[12]|[78]1|9[15])|6(?:12|[2345]1|57|6[13]|7[14]|80)|7(?:12|2[14]|3[134]|4[47]|5[15]|[67]1|88)|8(?:16|2[014]|3[126]|6[136]|7[078]|8[34]|91))[2-7]\\d{6}|(?:(?:1(?:2[35-8]|3[346-9]|4[236-9]|[59][0235-9]|6[235-9]|7[34689]|8[257-9])|2(?:1[134689]|3[24-8]|4[2-8]|5[25689]|6[2-4679]|7[13-79]|8[2-479]|9[235-9])|3(?:01|1[79]|2[1-5]|4[25-8]|5[125689]|6[235-7]|7[157-9]|8[2-467])|4(?:1[14578]|2[5689]|3[2-467]|5[4-7]|6[35]|73|8[2689]|9[2389])|5(?:[16][146-9]|2[14-8]|3[1346]|4[14-69]|5[46]|7[2-4]|8[2-8]|9[246])|6(?:1[1358]|2[2457]|3[2-4]|4[235-7]|[57][2-689]|6[24-578]|8[1-6])|8(?:1[1357-9]|2[235-8]|3[03-57-9]|4[0-24-9]|5\\d|6[2457-9]|7[1-6]|8[1256]|9[2-4]))\\d|7(?:(?:1[013-9]|2[0235-9]|3[2679]|4[1-35689]|5[2-46-9]|[67][02-9]|9\\d)\\d|8(?:2[0-6]|[013-8]\\d)))[2-7]\\d{5}",
"\\d{6,10}", , , "1123456789"], [, , "(?:7(?:0\\d{2}|2(?:[0235679]\\d|[14][017-9]|8[0-59]|9[389])|3(?:[058]\\d|10|7[3679]|9[689])|4(?:0[1-9]|1[015-9]|[29][89]|39|8[389])|5(?:[034678]\\d|2[03-9]|5[017-9]|9[7-9])|6(?:0[0-47]|1[0-257-9]|2[0-4]|3[19]|5[4589]|[6-9]\\d)|7(?:0[2-9]|[1-79]\\d|8[1-9])|8[0-79]\\d)|8(?:0(?:[01589]\\d|6[67])|1(?:[02-57-9]\\d|1[0135-9])|2(?:[236-9]\\d|5[1-9])|3(?:[0357-9]\\d|4[1-9])|[45]\\d{2}|6[02457-9]\\d|7(?:07|[1-69]\\d)|8(?:[0-26-9]\\d|44|5[2-9])|9(?:[035-9]\\d|2[2-9]|4[0-8]))|9\\d{3})\\d{6}",
"\\d{10}", , , "9123456789"], [, , "1(?:600\\d{6}|80(?:0\\d{4,9}|3\\d{9}))", "\\d{8,13}", , , "1800123456"], [, , "186[12]\\d{9}", "\\d{13}", , , "1861123456789"], [, , "1860\\d{7}", "\\d{11}", , , "18603451234"], [, , "NA", "NA"], [, , "NA", "NA"], "IN", 91, "00", "0", , , "0", , , , [[, "(\\d{5})(\\d{5})", "$1 $2", ["7(?:[0257]|3[0157-9]|4[0-389]|6[0-35-9]|8[0-79])|8(?:0[015689]|1[0-57-9]|2[2356-9]|3[0-57-9]|[45]|6[02457-9]|7[01-69]|8[0-24-9]|9[02-9])|9", "7(?:0|2(?:[0235679]|[14][017-9]|8[0-59]|9[389])|3(?:[058]|10|7[3679]|9[689])|4(?:0[1-9]|1[015-9]|[29][89]|39|8[389])|5(?:[034678]|2[03-9]|5[017-9]|9[7-9])|6(?:0[0-47]|1[0-257-9]|2[0-4]|3[19]|5[4589]|[6-9])|7(?:0[2-9]|[1-79]|8[1-9])|8[0-79])|8(?:0(?:[01589]|6[67])|1(?:[02-57-9]|1[0135-9])|2(?:[236-9]|5[1-9])|3(?:[0357-9]|4[1-9])|[45]|6[02457-9]|7(?:07|[1-69])|8(?:[0-26-9]|44|5[2-9])|9(?:[035-9]|2[2-9]|4[0-8]))|9"],
"0$1", "", 1], [, "(\\d{2})(\\d{4})(\\d{4})", "$1 $2 $3", ["11|2[02]|33|4[04]|79|80[2-46]"], "0$1", "", 1], [, "(\\d{3})(\\d{3})(\\d{4})", "$1 $2 $3", ["1(?:2[0-249]|3[0-25]|4[145]|[569][14]|7[1257]|8[1346]|[68][1-9])|2(?:1[257]|3[013]|4[01]|5[0137]|6[0158]|78|8[1568]|9[14])|3(?:26|4[1-3]|5[34]|6[01489]|7[02-46]|8[159])|4(?:1[36]|2[1-47]|3[15]|5[12]|6[0-26-9]|7[0-24-9]|8[013-57]|9[014-7])|5(?:1[025]|[36][25]|22|4[28]|5[12]|[78]1|9[15])|6(?:12|[2345]1|57|6[13]|7[14]|80)"], "0$1", "", 1], [, "(\\d{3})(\\d{3})(\\d{4})",
"$1 $2 $3", ["7(?:12|2[14]|3[134]|4[47]|5[15]|[67]1|88)", "7(?:12|2[14]|3[134]|4[47]|5(?:1|5[2-6])|[67]1|88)"], "0$1", "", 1], [, "(\\d{3})(\\d{3})(\\d{4})", "$1 $2 $3", ["8(?:16|2[014]|3[126]|6[136]|7[078]|8[34]|91)"], "0$1", "", 1], [, "(\\d{4})(\\d{3})(\\d{3})", "$1 $2 $3", ["1(?:[23579]|[468][1-9])|[2-8]"], "0$1", "", 1], [, "(1600)(\\d{2})(\\d{4})", "$1 $2 $3", ["160", "1600"], "$1", "", 1], [, "(1800)(\\d{4,5})", "$1 $2", ["180", "1800"], "$1", "", 1], [, "(18[06]0)(\\d{2,4})(\\d{4})", "$1 $2 $3",
["18[06]", "18[06]0"], "$1", "", 1], [, "(140)(\\d{3})(\\d{4})", "$1 $2 $3", ["140"], "$1", "", 1], [, "(\\d{4})(\\d{3})(\\d{3})(\\d{3})", "$1 $2 $3 $4", ["18[06]", "18(?:0[03]|6[12])"], "$1", "", 1]], , [, , "NA", "NA"], , , [, , "1(?:600\\d{6}|8(?:0(?:0\\d{4,9}|3\\d{9})|6(?:0\\d{7}|[12]\\d{9})))", "\\d{8,13}", , , "1800123456"], [, , "140\\d{7}", "\\d{10}", , , "1409305260"], , , [, , "NA", "NA"]], IO:[, [, , "3\\d{6}", "\\d{7}"], [, , "37\\d{5}", "\\d{7}", , , "3709100"], [, , "38\\d{5}", "\\d{7}",
, , "3801234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "IO", 246, "00", , , , , , , , [[, "(\\d{3})(\\d{4})", "$1 $2", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], IQ:[, [, , "[1-7]\\d{7,9}", "\\d{6,10}"], [, , "1\\d{7}|(?:2[13-5]|3[02367]|4[023]|5[03]|6[026])\\d{6,7}", "\\d{6,9}", , , "12345678"], [, , "7[3-9]\\d{8}", "\\d{10}", , , "7912345678"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA",
"NA"], [, , "NA", "NA"], [, , "NA", "NA"], "IQ", 964, "00", "0", , , "0", , , , [[, "(1)(\\d{3})(\\d{4})", "$1 $2 $3", ["1"], "0$1", "", 0], [, "([2-6]\\d)(\\d{3})(\\d{3,4})", "$1 $2 $3", ["[2-6]"], "0$1", "", 0], [, "(7\\d{2})(\\d{3})(\\d{4})", "$1 $2 $3", ["7"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], IR:[, [, , "[1-8]\\d{9}|9(?:[0-4]\\d{8}|9\\d{2,8})", "\\d{4,10}"], [, , "(?:1[137]|2[13-68]|3[1458]|4[145]|5[146-8]|6[146]|7[1467]|8[13467])\\d{8}",
"\\d{10}", , , "2123456789"], [, , "9(?:0[1-3]|[13]\\d|2[0-2]|90)\\d{7}", "\\d{10}", , , "9123456789"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "(?:[2-6]0\\d|993)\\d{7}", "\\d{10}", , , "9932123456"], "IR", 98, "00", "0", , , "0", , , , [[, "(21)(\\d{3,5})", "$1 $2", ["21"], "0$1", "", 0], [, "(\\d{2})(\\d{4})(\\d{4})", "$1 $2 $3", ["[1-8]"], "0$1", "", 0], [, "(\\d{3})(\\d{3})(\\d{3,4})", "$1 $2 $3", ["9"], "0$1", "", 0], [, "(\\d{3})(\\d{2})(\\d{2,3})", "$1 $2 $3",
["9"], "0$1", "", 0], [, "(\\d{3})(\\d{3})", "$1 $2", ["9"], "0$1", "", 0]], , [, , "943\\d{7}", "\\d{10}", , , "9432123456"], , , [, , "NA", "NA"], [, , "9990\\d{0,6}", "\\d{4,10}", , , "9990123456"], , , [, , "NA", "NA"]], IS:[, [, , "[4-9]\\d{6}|38\\d{7}", "\\d{7,9}"], [, , "(?:4(?:1[0-24-6]|2[0-7]|[37][0-8]|4[0-245]|5[0-3568]|6\\d|8[0-36-8])|5(?:05|[156]\\d|2[02578]|3[013-7]|4[03-7]|7[0-2578]|8[0-35-9]|9[013-689])|87[23])\\d{4}", "\\d{7}", , , "4101234"], [, , "38[589]\\d{6}|(?:6(?:1[1-8]|3[089]|4[0167]|5[019]|[67][0-69]|9\\d)|7(?:5[057]|7\\d|8[0-36-8])|8(?:2[0-5]|3[0-4]|[469]\\d|5[1-9]))\\d{4}",
"\\d{7,9}", , , "6111234"], [, , "800\\d{4}", "\\d{7}", , , "8001234"], [, , "90\\d{5}", "\\d{7}", , , "9011234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "49\\d{5}", "\\d{7}", , , "4921234"], "IS", 354, "00", , , , , , , , [[, "(\\d{3})(\\d{4})", "$1 $2", ["[4-9]"], "", "", 0], [, "(3\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["3"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "(?:6(?:2[0-8]|49|8\\d)|87[0189]|95[48])\\d{4}", "\\d{7}", , , "6201234"]], IT:[, [, ,
"[01589]\\d{5,10}|3(?:[12457-9]\\d{8}|[36]\\d{7,9})", "\\d{6,11}"], [, , "0(?:[26]\\d{4,9}|(?:1(?:[0159]\\d|[27][1-5]|31|4[1-4]|6[1356]|8[2-57])|3(?:[0159]\\d|2[1-4]|3[12]|[48][1-6]|6[2-59]|7[1-7])|4(?:[0159]\\d|[23][1-9]|4[245]|6[1-5]|7[1-4]|81)|5(?:[0159]\\d|2[1-5]|3[2-6]|4[1-79]|6[4-6]|7[1-578]|8[3-8])|7(?:[0159]\\d|2[12]|3[1-7]|4[2346]|6[13569]|7[13-6]|8[1-59])|8(?:[0159]\\d|2[34578]|3[1-356]|[6-8][1-5])|9(?:[0159]\\d|[238][1-5]|4[12]|6[1-8]|7[1-6]))\\d{2,7})", "\\d{6,11}", , , "0212345678"],
[, , "3(?:[12457-9]\\d{8}|6\\d{7,8}|3\\d{7,9})", "\\d{9,11}", , , "3123456789"], [, , "80(?:0\\d{6}|3\\d{3})", "\\d{6,9}", , , "800123456"], [, , "0878\\d{5}|1(?:44|6[346])\\d{6}|89(?:2\\d{3}|4(?:[0-4]\\d{2}|[5-9]\\d{4})|5(?:[0-4]\\d{2}|[5-9]\\d{6})|9\\d{6})", "\\d{6,10}", , , "899123456"], [, , "84(?:[08]\\d{6}|[17]\\d{3})", "\\d{6,9}", , , "848123456"], [, , "1(?:78\\d|99)\\d{6}", "\\d{9,10}", , , "1781234567"], [, , "55\\d{8}", "\\d{10}", , , "5512345678"], "IT", 39, "00", , , , , , , , [[, "(\\d{2})(\\d{3,4})(\\d{4})",
"$1 $2 $3", ["0[26]|55"], "", "", 0], [, "(0[26])(\\d{4})(\\d{5})", "$1 $2 $3", ["0[26]"], "", "", 0], [, "(0[26])(\\d{4,6})", "$1 $2", ["0[26]"], "", "", 0], [, "(0\\d{2})(\\d{3,4})(\\d{4})", "$1 $2 $3", ["0[13-57-9][0159]"], "", "", 0], [, "(\\d{3})(\\d{3,6})", "$1 $2", ["0[13-57-9][0159]|8(?:03|4[17]|9[245])", "0[13-57-9][0159]|8(?:03|4[17]|9(?:2|[45][0-4]))"], "", "", 0], [, "(0\\d{3})(\\d{3})(\\d{4})", "$1 $2 $3", ["0[13-57-9][2-46-8]"], "", "", 0], [, "(0\\d{3})(\\d{2,6})", "$1 $2", ["0[13-57-9][2-46-8]"],
"", "", 0], [, "(\\d{3})(\\d{3})(\\d{3,4})", "$1 $2 $3", ["[13]|8(?:00|4[08]|9[59])", "[13]|8(?:00|4[08]|9(?:5[5-9]|9))"], "", "", 0], [, "(\\d{4})(\\d{4})", "$1 $2", ["894", "894[5-9]"], "", "", 0], [, "(\\d{3})(\\d{4})(\\d{4})", "$1 $2 $3", ["3"], "", "", 0]], , [, , "NA", "NA"], 1, , [, , "848\\d{6}", "\\d{9}", , , "848123456"], [, , "NA", "NA"], 1, , [, , "NA", "NA"]], JE:[, [, , "[135789]\\d{6,9}", "\\d{6,10}"], [, , "1534\\d{6}", "\\d{6,10}", , , "1534456789"], [, , "7(?:509|7(?:00|97)|829|937)\\d{6}",
"\\d{10}", , , "7797123456"], [, , "80(?:07(?:35|81)|8901)\\d{4}", "\\d{10}", , , "8007354567"], [, , "(?:871206|90(?:066[59]|1810|71(?:07|55)))\\d{4}", "\\d{10}", , , "9018105678"], [, , "8(?:4(?:4(?:4(?:05|42|69)|703)|5(?:041|800))|70002)\\d{4}", "\\d{10}", , , "8447034567"], [, , "701511\\d{4}", "\\d{10}", , , "7015115678"], [, , "56\\d{8}", "\\d{10}", , , "5612345678"], "JE", 44, "00", "0", " x", , "0", , , , , , [, , "76(?:0[012]|2[356]|4[0134]|5[49]|6[0-369]|77|81|9[39])\\d{6}", "\\d{10}",
, , "7640123456"], , , [, , "NA", "NA"], [, , "3(?:0(?:07(?:35|81)|8901)|3\\d{4}|4(?:4(?:4(?:05|42|69)|703)|5(?:041|800))|7(?:0002|1206))\\d{4}|55\\d{8}", "\\d{10}", , , "5512345678"], , , [, , "NA", "NA"]], JM:[, [, , "[589]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "876(?:5(?:0[12]|1[0-468]|2[35]|63)|6(?:0[1-3579]|1[027-9]|[23]\\d|40|5[06]|6[2-589]|7[05]|8[04]|9[4-9])|7(?:0[2-689]|[1-6]\\d|8[056]|9[45])|9(?:0[1-8]|1[02378]|[2-8]\\d|9[2-468]))\\d{4}", "\\d{7}(?:\\d{3})?", , , "8765123456"], [, , "876(?:2[16-9]\\d|[348]\\d{2}|5(?:0[3-9]|27|6[0-24-9]|[3-578]\\d)|7(?:0[07]|7\\d|8[1-47-9]|9[0-36-9])|9(?:[01]9|9[0579]))\\d{4}",
"\\d{10}", , , "8762101234"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002123456"], [, , "900[2-9]\\d{6}", "\\d{10}", , , "9002123456"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "NA", "NA"], "JM", 1, "011", "1", , , "1", , , , , , [, , "NA", "NA"], , "876", [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], JO:[, [, , "[235-9]\\d{7,8}", "\\d{8,9}"], [, , "(?:2(?:6(?:2[0-35-9]|3[0-57-8]|4[24-7]|5[0-24-8]|[6-8][023]|9[0-3])|7(?:0[1-79]|10|2[014-7]|3[0-689]|4[019]|5[0-3578]))|32(?:0[1-69]|1[1-35-7]|2[024-7]|3\\d|4[0-3]|[57][023]|6[03])|53(?:0[0-3]|[13][023]|2[0-59]|49|5[0-35-9]|6[15]|7[45]|8[1-6]|9[0-36-9])|6(?:2[50]0|3(?:00|33)|4(?:0[0125]|1[2-7]|2[0569]|[38][07-9]|4[025689]|6[0-589]|7\\d|9[0-2])|5(?:[01][056]|2[034]|3[0-57-9]|4[17-8]|5[0-69]|6[0-35-9]|7[1-379]|8[0-68]|9[02-39]))|87(?:[02]0|7[08]|90))\\d{4}",
"\\d{8}", , , "62001234"], [, , "7(?:55|7[025-9]|8[015-9]|9[0-25-9])\\d{6}", "\\d{9}", , , "790123456"], [, , "80\\d{6}", "\\d{8}", , , "80012345"], [, , "900\\d{5}", "\\d{8}", , , "90012345"], [, , "85\\d{6}", "\\d{8}", , , "85012345"], [, , "70\\d{7}", "\\d{9}", , , "700123456"], [, , "NA", "NA"], "JO", 962, "00", "0", , , "0", , , , [[, "(\\d)(\\d{3})(\\d{4})", "$1 $2 $3", ["[2356]|87"], "(0$1)", "", 0], [, "(7)(\\d{4})(\\d{4})", "$1 $2 $3", ["7[457-9]"], "0$1", "", 0], [, "(\\d{3})(\\d{5,6})",
"$1 $2", ["70|8[0158]|9"], "0$1", "", 0]], , [, , "74(?:66|77)\\d{5}", "\\d{9}", , , "746612345"], , , [, , "NA", "NA"], [, , "8(?:10|8\\d)\\d{5}", "\\d{8}", , , "88101234"], , , [, , "NA", "NA"]], JP:[, [, , "[1-9]\\d{8,9}|00(?:[36]\\d{7,14}|7\\d{5,7}|8\\d{7})", "\\d{8,17}"], [, , "(?:1(?:1[235-8]|2[3-6]|3[3-9]|4[2-6]|[58][2-8]|6[2-7]|7[2-9]|9[1-9])|2[2-9]\\d|[36][1-9]\\d|4(?:6[02-8]|[2-578]\\d|9[2-59])|5(?:6[1-9]|7[2-8]|[2-589]\\d)|7(?:3[4-9]|4[02-9]|[25-9]\\d)|8(?:3[2-9]|4[5-9]|5[1-9]|8[03-9]|[2679]\\d)|9(?:[679][1-9]|[2-58]\\d))\\d{6}",
"\\d{9}", , , "312345678"], [, , "[7-9]0[1-9]\\d{7}", "\\d{10}", , , "9012345678"], [, , "120\\d{6}|800\\d{7}|00(?:37\\d{6,13}|66\\d{6,13}|777(?:[01]\\d{2}|5\\d{3}|8\\d{4})|882[1245]\\d{4})", "\\d{8,17}", , , "120123456"], [, , "990\\d{6}", "\\d{9}", , , "990123456"], [, , "NA", "NA"], [, , "60\\d{7}", "\\d{9}", , , "601234567"], [, , "50[1-9]\\d{7}", "\\d{10}", , , "5012345678"], "JP", 81, "010", "0", , , "0", , , , [[, "(\\d{3})(\\d{3})(\\d{3})", "$1-$2-$3", ["(?:12|57|99)0"], "0$1", "", 0], [,
"(\\d{3})(\\d{3})(\\d{4})", "$1-$2-$3", ["800"], "0$1", "", 0], [, "(\\d{4})(\\d{4})", "$1-$2", ["0077"], "$1", "", 0], [, "(\\d{4})(\\d{2})(\\d{3,4})", "$1-$2-$3", ["0077"], "$1", "", 0], [, "(\\d{4})(\\d{2})(\\d{4})", "$1-$2-$3", ["0088"], "$1", "", 0], [, "(\\d{4})(\\d{3})(\\d{3,4})", "$1-$2-$3", ["00(?:37|66)"], "$1", "", 0], [, "(\\d{4})(\\d{4})(\\d{4,5})", "$1-$2-$3", ["00(?:37|66)"], "$1", "", 0], [, "(\\d{4})(\\d{5})(\\d{5,6})", "$1-$2-$3", ["00(?:37|66)"], "$1", "", 0], [, "(\\d{4})(\\d{6})(\\d{6,7})",
"$1-$2-$3", ["00(?:37|66)"], "$1", "", 0], [, "(\\d{2})(\\d{4})(\\d{4})", "$1-$2-$3", ["[2579]0|80[1-9]"], "0$1", "", 0], [, "(\\d{4})(\\d)(\\d{4})", "$1-$2-$3", ["1(?:26|3[79]|4[56]|5[4-68]|6[3-5])|5(?:76|97)|499|746|8(?:3[89]|63|47|51)|9(?:49|80|9[16])", "1(?:267|3(?:7[247]|9[278])|4(?:5[67]|66)|5(?:47|58|64|8[67])|6(?:3[245]|48|5[4-68]))|5(?:76|97)9|499[2468]|7468|8(?:3(?:8[78]|96)|636|477|51[24])|9(?:496|802|9(?:1[23]|69))", "1(?:267|3(?:7[247]|9[278])|4(?:5[67]|66)|5(?:47|58|64|8[67])|6(?:3[245]|48|5[4-68]))|5(?:769|979[2-69])|499[2468]|7468|8(?:3(?:8[78]|96[2457-9])|636[2-57-9]|477|51[24])|9(?:496|802|9(?:1[23]|69))"],
"0$1", "", 0], [, "(\\d{3})(\\d{2})(\\d{4})", "$1-$2-$3", ["1(?:2[3-6]|3[3-9]|4[2-6]|5[2-8]|[68][2-7]|7[2-689]|9[1-578])|2(?:2[03-689]|3[3-58]|4[0-468]|5[04-8]|6[013-8]|7[06-9]|8[02-57-9]|9[13])|4(?:2[28]|3[689]|6[035-7]|7[05689]|80|9[3-5])|5(?:3[1-36-9]|4[4578]|5[013-8]|6[1-9]|7[2-8]|8[14-7]|9[4-9])|7(?:2[15]|3[5-9]|4[02-9]|6[135-8]|7[0-4689]|9[014-9])|8(?:2[49]|3[3-8]|4[5-8]|5[2-9]|6[35-9]|7[579]|8[03-579]|9[2-8])|9(?:[23]0|4[02-46-9]|5[024-79]|6[4-9]|7[2-47-9]|8[02-7]|9[3-7])", "1(?:2[3-6]|3[3-9]|4[2-6]|5(?:[236-8]|[45][2-69])|[68][2-7]|7[2-689]|9[1-578])|2(?:2(?:[04-689]|3[23])|3[3-58]|4[0-468]|5(?:5[78]|7[2-4]|[0468][2-9])|6(?:[0135-8]|4[2-5])|7(?:[0679]|8[2-7])|8(?:[024578]|3[25-9]|9[6-9])|9(?:11|3[2-4]))|4(?:2(?:2[2-9]|8[237-9])|3[689]|6[035-7]|7(?:[059][2-8]|[68])|80|9[3-5])|5(?:3[1-36-9]|4[4578]|5[013-8]|6[1-9]|7[2-8]|8[14-7]|9(?:[89][2-8]|[4-7]))|7(?:2[15]|3[5-9]|4[02-9]|6[135-8]|7[0-4689]|9(?:[017-9]|4[6-8]|5[2-478]|6[2-589]))|8(?:2(?:4[4-8]|9[2-8])|3(?:7[2-6]|[3-6][2-9]|8[2-5])|4[5-8]|5[2-9]|6(?:[37]|5[4-7]|6[2-9]|8[2-8]|9[236-9])|7[579]|8[03-579]|9[2-8])|9(?:[23]0|4[02-46-9]|5[024-79]|6[4-9]|7[2-47-9]|8[02-7]|9(?:3[34]|[4-7]))",
"1(?:2[3-6]|3[3-9]|4[2-6]|5(?:[236-8]|[45][2-69])|[68][2-7]|7[2-689]|9[1-578])|2(?:2(?:[04-689]|3[23])|3[3-58]|4[0-468]|5(?:5[78]|7[2-4]|[0468][2-9])|6(?:[0135-8]|4[2-5])|7(?:[0679]|8[2-7])|8(?:[024578]|3[25-9]|9[6-9])|9(?:11|3[2-4]))|4(?:2(?:2[2-9]|8[237-9])|3[689]|6[035-7]|7(?:[059][2-8]|[68])|80|9[3-5])|5(?:3[1-36-9]|4[4578]|5[013-8]|6[1-9]|7[2-8]|8[14-7]|9(?:[89][2-8]|[4-7]))|7(?:2[15]|3[5-9]|4[02-9]|6[135-8]|7[0-4689]|9(?:[017-9]|4[6-8]|5[2-478]|6[2-589]))|8(?:2(?:4[4-8]|9(?:[3578]|20|4[04-9]|6[56]))|3(?:7(?:[2-5]|6[0-59])|[3-6][2-9]|8[2-5])|4[5-8]|5[2-9]|6(?:[37]|5(?:[467]|5[014-9])|6(?:[2-8]|9[02-69])|8[2-8]|9(?:[236-8]|9[23]))|7[579]|8[03-579]|9[2-8])|9(?:[23]0|4[02-46-9]|5[024-79]|6[4-9]|7[2-47-9]|8[02-7]|9(?:3(?:3[02-9]|4[0-24689])|4[2-69]|[5-7]))",
"1(?:2[3-6]|3[3-9]|4[2-6]|5(?:[236-8]|[45][2-69])|[68][2-7]|7[2-689]|9[1-578])|2(?:2(?:[04-689]|3[23])|3[3-58]|4[0-468]|5(?:5[78]|7[2-4]|[0468][2-9])|6(?:[0135-8]|4[2-5])|7(?:[0679]|8[2-7])|8(?:[024578]|3[25-9]|9[6-9])|9(?:11|3[2-4]))|4(?:2(?:2[2-9]|8[237-9])|3[689]|6[035-7]|7(?:[059][2-8]|[68])|80|9[3-5])|5(?:3[1-36-9]|4[4578]|5[013-8]|6[1-9]|7[2-8]|8[14-7]|9(?:[89][2-8]|[4-7]))|7(?:2[15]|3[5-9]|4[02-9]|6[135-8]|7[0-4689]|9(?:[017-9]|4[6-8]|5[2-478]|6[2-589]))|8(?:2(?:4[4-8]|9(?:[3578]|20|4[04-9]|6(?:5[25]|60)))|3(?:7(?:[2-5]|6[0-59])|[3-6][2-9]|8[2-5])|4[5-8]|5[2-9]|6(?:[37]|5(?:[467]|5[014-9])|6(?:[2-8]|9[02-69])|8[2-8]|9(?:[236-8]|9[23]))|7[579]|8[03-579]|9[2-8])|9(?:[23]0|4[02-46-9]|5[024-79]|6[4-9]|7[2-47-9]|8[02-7]|9(?:3(?:3[02-9]|4[0-24689])|4[2-69]|[5-7]))"],
"0$1", "", 0], [, "(\\d{2})(\\d{3})(\\d{4})", "$1-$2-$3", ["1|2(?:2[37]|5[5-9]|64|78|8[39]|91)|4(?:2[2689]|64|7[347])|5(?:[2-589]|39)|60|8(?:[46-9]|3[279]|2[124589])|9(?:[235-8]|93)", "1|2(?:2[37]|5(?:[57]|[68]0|9[19])|64|78|8[39]|917)|4(?:2(?:[68]|20|9[178])|64|7[347])|5(?:[2-589]|39[67])|60|8(?:[46-9]|3[279]|2[124589])|9(?:[235-8]|93[34])", "1|2(?:2[37]|5(?:[57]|[68]0|9(?:17|99))|64|78|8[39]|917)|4(?:2(?:[68]|20|9[178])|64|7[347])|5(?:[2-589]|39[67])|60|8(?:[46-9]|3[279]|2[124589])|9(?:[235-8]|93(?:31|4))"],
"0$1", "", 0], [, "(\\d{3})(\\d{2})(\\d{4})", "$1-$2-$3", ["2(?:9[14-79]|74|[34]7|[56]9)|82|993"], "0$1", "", 0], [, "(\\d)(\\d{4})(\\d{4})", "$1-$2-$3", ["3|4(?:2[09]|7[01])|6[1-9]"], "0$1", "", 0], [, "(\\d{2})(\\d{3})(\\d{4})", "$1-$2-$3", ["[2479][1-9]"], "0$1", "", 0]], [[, "(\\d{3})(\\d{3})(\\d{3})", "$1-$2-$3", ["(?:12|57|99)0"], "0$1", "", 0], [, "(\\d{3})(\\d{3})(\\d{4})", "$1-$2-$3", ["800"], "0$1", "", 0], [, "(\\d{2})(\\d{4})(\\d{4})", "$1-$2-$3", ["[2579]0|80[1-9]"], "0$1", "", 0], [,
"(\\d{4})(\\d)(\\d{4})", "$1-$2-$3", ["1(?:26|3[79]|4[56]|5[4-68]|6[3-5])|5(?:76|97)|499|746|8(?:3[89]|63|47|51)|9(?:49|80|9[16])", "1(?:267|3(?:7[247]|9[278])|4(?:5[67]|66)|5(?:47|58|64|8[67])|6(?:3[245]|48|5[4-68]))|5(?:76|97)9|499[2468]|7468|8(?:3(?:8[78]|96)|636|477|51[24])|9(?:496|802|9(?:1[23]|69))", "1(?:267|3(?:7[247]|9[278])|4(?:5[67]|66)|5(?:47|58|64|8[67])|6(?:3[245]|48|5[4-68]))|5(?:769|979[2-69])|499[2468]|7468|8(?:3(?:8[78]|96[2457-9])|636[2-57-9]|477|51[24])|9(?:496|802|9(?:1[23]|69))"],
"0$1", "", 0], [, "(\\d{3})(\\d{2})(\\d{4})", "$1-$2-$3", ["1(?:2[3-6]|3[3-9]|4[2-6]|5[2-8]|[68][2-7]|7[2-689]|9[1-578])|2(?:2[03-689]|3[3-58]|4[0-468]|5[04-8]|6[013-8]|7[06-9]|8[02-57-9]|9[13])|4(?:2[28]|3[689]|6[035-7]|7[05689]|80|9[3-5])|5(?:3[1-36-9]|4[4578]|5[013-8]|6[1-9]|7[2-8]|8[14-7]|9[4-9])|7(?:2[15]|3[5-9]|4[02-9]|6[135-8]|7[0-4689]|9[014-9])|8(?:2[49]|3[3-8]|4[5-8]|5[2-9]|6[35-9]|7[579]|8[03-579]|9[2-8])|9(?:[23]0|4[02-46-9]|5[024-79]|6[4-9]|7[2-47-9]|8[02-7]|9[3-7])", "1(?:2[3-6]|3[3-9]|4[2-6]|5(?:[236-8]|[45][2-69])|[68][2-7]|7[2-689]|9[1-578])|2(?:2(?:[04-689]|3[23])|3[3-58]|4[0-468]|5(?:5[78]|7[2-4]|[0468][2-9])|6(?:[0135-8]|4[2-5])|7(?:[0679]|8[2-7])|8(?:[024578]|3[25-9]|9[6-9])|9(?:11|3[2-4]))|4(?:2(?:2[2-9]|8[237-9])|3[689]|6[035-7]|7(?:[059][2-8]|[68])|80|9[3-5])|5(?:3[1-36-9]|4[4578]|5[013-8]|6[1-9]|7[2-8]|8[14-7]|9(?:[89][2-8]|[4-7]))|7(?:2[15]|3[5-9]|4[02-9]|6[135-8]|7[0-4689]|9(?:[017-9]|4[6-8]|5[2-478]|6[2-589]))|8(?:2(?:4[4-8]|9[2-8])|3(?:7[2-6]|[3-6][2-9]|8[2-5])|4[5-8]|5[2-9]|6(?:[37]|5[4-7]|6[2-9]|8[2-8]|9[236-9])|7[579]|8[03-579]|9[2-8])|9(?:[23]0|4[02-46-9]|5[024-79]|6[4-9]|7[2-47-9]|8[02-7]|9(?:3[34]|[4-7]))",
"1(?:2[3-6]|3[3-9]|4[2-6]|5(?:[236-8]|[45][2-69])|[68][2-7]|7[2-689]|9[1-578])|2(?:2(?:[04-689]|3[23])|3[3-58]|4[0-468]|5(?:5[78]|7[2-4]|[0468][2-9])|6(?:[0135-8]|4[2-5])|7(?:[0679]|8[2-7])|8(?:[024578]|3[25-9]|9[6-9])|9(?:11|3[2-4]))|4(?:2(?:2[2-9]|8[237-9])|3[689]|6[035-7]|7(?:[059][2-8]|[68])|80|9[3-5])|5(?:3[1-36-9]|4[4578]|5[013-8]|6[1-9]|7[2-8]|8[14-7]|9(?:[89][2-8]|[4-7]))|7(?:2[15]|3[5-9]|4[02-9]|6[135-8]|7[0-4689]|9(?:[017-9]|4[6-8]|5[2-478]|6[2-589]))|8(?:2(?:4[4-8]|9(?:[3578]|20|4[04-9]|6[56]))|3(?:7(?:[2-5]|6[0-59])|[3-6][2-9]|8[2-5])|4[5-8]|5[2-9]|6(?:[37]|5(?:[467]|5[014-9])|6(?:[2-8]|9[02-69])|8[2-8]|9(?:[236-8]|9[23]))|7[579]|8[03-579]|9[2-8])|9(?:[23]0|4[02-46-9]|5[024-79]|6[4-9]|7[2-47-9]|8[02-7]|9(?:3(?:3[02-9]|4[0-24689])|4[2-69]|[5-7]))",
"1(?:2[3-6]|3[3-9]|4[2-6]|5(?:[236-8]|[45][2-69])|[68][2-7]|7[2-689]|9[1-578])|2(?:2(?:[04-689]|3[23])|3[3-58]|4[0-468]|5(?:5[78]|7[2-4]|[0468][2-9])|6(?:[0135-8]|4[2-5])|7(?:[0679]|8[2-7])|8(?:[024578]|3[25-9]|9[6-9])|9(?:11|3[2-4]))|4(?:2(?:2[2-9]|8[237-9])|3[689]|6[035-7]|7(?:[059][2-8]|[68])|80|9[3-5])|5(?:3[1-36-9]|4[4578]|5[013-8]|6[1-9]|7[2-8]|8[14-7]|9(?:[89][2-8]|[4-7]))|7(?:2[15]|3[5-9]|4[02-9]|6[135-8]|7[0-4689]|9(?:[017-9]|4[6-8]|5[2-478]|6[2-589]))|8(?:2(?:4[4-8]|9(?:[3578]|20|4[04-9]|6(?:5[25]|60)))|3(?:7(?:[2-5]|6[0-59])|[3-6][2-9]|8[2-5])|4[5-8]|5[2-9]|6(?:[37]|5(?:[467]|5[014-9])|6(?:[2-8]|9[02-69])|8[2-8]|9(?:[236-8]|9[23]))|7[579]|8[03-579]|9[2-8])|9(?:[23]0|4[02-46-9]|5[024-79]|6[4-9]|7[2-47-9]|8[02-7]|9(?:3(?:3[02-9]|4[0-24689])|4[2-69]|[5-7]))"],
"0$1", "", 0], [, "(\\d{2})(\\d{3})(\\d{4})", "$1-$2-$3", ["1|2(?:2[37]|5[5-9]|64|78|8[39]|91)|4(?:2[2689]|64|7[347])|5(?:[2-589]|39)|60|8(?:[46-9]|3[279]|2[124589])|9(?:[235-8]|93)", "1|2(?:2[37]|5(?:[57]|[68]0|9[19])|64|78|8[39]|917)|4(?:2(?:[68]|20|9[178])|64|7[347])|5(?:[2-589]|39[67])|60|8(?:[46-9]|3[279]|2[124589])|9(?:[235-8]|93[34])", "1|2(?:2[37]|5(?:[57]|[68]0|9(?:17|99))|64|78|8[39]|917)|4(?:2(?:[68]|20|9[178])|64|7[347])|5(?:[2-589]|39[67])|60|8(?:[46-9]|3[279]|2[124589])|9(?:[235-8]|93(?:31|4))"],
"0$1", "", 0], [, "(\\d{3})(\\d{2})(\\d{4})", "$1-$2-$3", ["2(?:9[14-79]|74|[34]7|[56]9)|82|993"], "0$1", "", 0], [, "(\\d)(\\d{4})(\\d{4})", "$1-$2-$3", ["3|4(?:2[09]|7[01])|6[1-9]"], "0$1", "", 0], [, "(\\d{2})(\\d{3})(\\d{4})", "$1-$2-$3", ["[2479][1-9]"], "0$1", "", 0]], [, , "20\\d{8}", "\\d{10}", , , "2012345678"], , , [, , "00(?:37\\d{6,13}|66\\d{6,13}|777(?:[01]\\d{2}|5\\d{3}|8\\d{4})|882[1245]\\d{4})", "\\d{8,17}", , , "00777012"], [, , "570\\d{6}", "\\d{9}", , , "570123456"], 1, , [, ,
"NA", "NA"]], KE:[, [, , "20\\d{6,7}|[4-9]\\d{6,9}", "\\d{7,10}"], [, , "20\\d{6,7}|4(?:[0136]\\d{7}|[245]\\d{5,7})|5(?:[08]\\d{7}|[1-79]\\d{5,7})|6(?:[01457-9]\\d{5,7}|[26]\\d{7})", "\\d{7,9}", , , "202012345"], [, , "7(?:[0-36]\\d|5[0-6]|7[0-5]|8[0-25-9]|9[0-4])\\d{6}", "\\d{9}", , , "712123456"], [, , "800[24-8]\\d{5,6}", "\\d{9,10}", , , "800223456"], [, , "900[02-9]\\d{5}", "\\d{9}", , , "900223456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "KE", 254, "000", "0", , , "0", , , ,
[[, "(\\d{2})(\\d{5,7})", "$1 $2", ["[24-6]"], "0$1", "", 0], [, "(\\d{3})(\\d{6})", "$1 $2", ["7"], "0$1", "", 0], [, "(\\d{3})(\\d{3})(\\d{3,4})", "$1 $2 $3", ["[89]"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], KG:[, [, , "[235-8]\\d{8,9}", "\\d{5,10}"], [, , "(?:3(?:1(?:[256]\\d|3[1-9]|47)|2(?:22|3[0-479]|6[0-7])|4(?:22|5[6-9]|6\\d)|5(?:22|3[4-7]|59|6\\d)|6(?:22|5[35-7]|6\\d)|7(?:22|3[468]|4[1-9]|59|[67]\\d)|9(?:22|4[1-8]|6\\d))|6(?:09|12|2[2-4])\\d)\\d{5}",
"\\d{5,10}", , , "312123456"], [, , "(?:20[0-35]|5[124-7]\\d|7[07]\\d)\\d{6}", "\\d{9}", , , "700123456"], [, , "800\\d{6,7}", "\\d{9,10}", , , "800123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "KG", 996, "00", "0", , , "0", , , , [[, "(\\d{3})(\\d{3})(\\d{3})", "$1 $2 $3", ["[25-7]|31[25]"], "0$1", "", 0], [, "(\\d{4})(\\d{5})", "$1 $2", ["3(?:1[36]|[2-9])"], "0$1", "", 0], [, "(\\d{3})(\\d{3})(\\d)(\\d{3})", "$1 $2 $3 $4", ["8"], "0$1", "", 0]], , [, , "NA",
"NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], KH:[, [, , "[1-9]\\d{7,9}", "\\d{6,10}"], [, , "(?:2[3-6]|3[2-6]|4[2-4]|[5-7][2-5])(?:[237-9]|4[56]|5\\d|6\\d?)\\d{5}|23(?:4[234]|8\\d{2})\\d{4}", "\\d{6,9}", , , "23756789"], [, , "(?:1(?:[013-9]|2\\d?)|3[18]\\d|6[016-9]|7(?:[07-9]|[16]\\d)|8(?:[013-79]|8\\d)|9(?:6\\d|7\\d?|[0-589]))\\d{6}", "\\d{8,9}", , , "91234567"], [, , "1800(?:1\\d|2[019])\\d{4}", "\\d{10}", , , "1800123456"], [, , "1900(?:1\\d|2[09])\\d{4}", "\\d{10}",
, , "1900123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "KH", 855, "00[14-9]", "0", , , "0", , , , [[, "(\\d{2})(\\d{3})(\\d{3,4})", "$1 $2 $3", ["1\\d[1-9]|[2-9]"], "0$1", "", 0], [, "(1[89]00)(\\d{3})(\\d{3})", "$1 $2 $3", ["1[89]0"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], KI:[, [, , "[2458]\\d{4}|3\\d{4,7}|7\\d{7}", "\\d{5,8}"], [, , "(?:[24]\\d|3[1-9]|50|8[0-5])\\d{3}", "\\d{5}", , , "31234"], [, , "7(?:[24]\\d|3[1-9]|8[0-5])\\d{5}",
"\\d{8}", , , "72012345"], [, , "NA", "NA"], [, , "3001\\d{4}", "\\d{5,8}", , , "30010000"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "KI", 686, "00", , , , "0", , , , , , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], KM:[, [, , "[379]\\d{6}", "\\d{7}"], [, , "7(?:6[0-37-9]|7[0-57-9])\\d{4}", "\\d{7}", , , "7712345"], [, , "3[234]\\d{5}", "\\d{7}", , , "3212345"], [, , "NA", "NA"], [, , "(?:39[01]|9[01]0)\\d{4}", "\\d{7}", , , "9001234"], [, , "NA",
"NA"], [, , "NA", "NA"], [, , "NA", "NA"], "KM", 269, "00", , , , , , , , [[, "(\\d{3})(\\d{2})(\\d{2})", "$1 $2 $3", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], KN:[, [, , "[589]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "869(?:2(?:29|36)|302|4(?:6[015-9]|70))\\d{4}", "\\d{7}(?:\\d{3})?", , , "8692361234"], [, , "869(?:5(?:5[6-8]|6[5-7])|66\\d|76[02-6])\\d{4}", "\\d{10}", , , "8697652917"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002123456"],
[, , "900[2-9]\\d{6}", "\\d{10}", , , "9002123456"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "NA", "NA"], "KN", 1, "011", "1", , , "1", , , , , , [, , "NA", "NA"], , "869", [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], KP:[, [, , "1\\d{9}|[28]\\d{7}", "\\d{6,8}|\\d{10}"], [, , "2\\d{7}|85\\d{6}", "\\d{6,8}", , , "21234567"], [, , "19[123]\\d{7}", "\\d{10}", , , "1921234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [,
, "NA", "NA"], [, , "NA", "NA"], "KP", 850, "00|99", "0", , , "0", , , , [[, "(\\d{3})(\\d{3})(\\d{4})", "$1 $2 $3", ["1"], "0$1", "", 0], [, "(\\d)(\\d{3})(\\d{4})", "$1 $2 $3", ["2"], "0$1", "", 0], [, "(\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["8"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "2(?:[0-24-9]\\d{2}|3(?:[0-79]\\d|8[02-9]))\\d{4}", "\\d{8}", , , "23821234"], [, , "NA", "NA"], , , [, , "NA", "NA"]], KR:[, [, , "[1-7]\\d{3,9}|8\\d{8}", "\\d{4,10}"], [, , "(?:2|3[1-3]|[46][1-4]|5[1-5])(?:1\\d{2,3}|[1-9]\\d{6,7})",
"\\d{4,10}", , , "22123456"], [, , "1[0-26-9]\\d{7,8}", "\\d{9,10}", , , "1000000000"], [, , "80\\d{7}", "\\d{9}", , , "801234567"], [, , "60[2-9]\\d{6}", "\\d{9}", , , "602345678"], [, , "NA", "NA"], [, , "50\\d{8}", "\\d{10}", , , "5012345678"], [, , "70\\d{8}", "\\d{10}", , , "7012345678"], "KR", 82, "00(?:[124-68]|[37]\\d{2})", "0", , , "0(8[1-46-8]|85\\d{2})?", , , , [[, "(\\d{2})(\\d{4})(\\d{4})", "$1-$2-$3", ["1(?:0|1[19]|[69]9|5[458])|[57]0", "1(?:0|1[19]|[69]9|5(?:44|59|8))|[57]0"], "0$1",
"0$CC-$1", 0], [, "(\\d{2})(\\d{3,4})(\\d{4})", "$1-$2-$3", ["1(?:[169][2-8]|[78]|5[1-4])|[68]0|[3-6][1-9][1-9]", "1(?:[169][2-8]|[78]|5(?:[1-3]|4[56]))|[68]0|[3-6][1-9][1-9]"], "0$1", "0$CC-$1", 0], [, "(\\d{3})(\\d)(\\d{4})", "$1-$2-$3", ["131", "1312"], "0$1", "0$CC-$1", 0], [, "(\\d{3})(\\d{2})(\\d{4})", "$1-$2-$3", ["131", "131[13-9]"], "0$1", "0$CC-$1", 0], [, "(\\d{3})(\\d{3})(\\d{4})", "$1-$2-$3", ["13[2-9]"], "0$1", "0$CC-$1", 0], [, "(\\d{2})(\\d{2})(\\d{3})(\\d{4})", "$1-$2-$3-$4", ["30"],
"0$1", "0$CC-$1", 0], [, "(\\d)(\\d{3,4})(\\d{4})", "$1-$2-$3", ["2[1-9]"], "0$1", "0$CC-$1", 0], [, "(\\d)(\\d{3,4})", "$1-$2", ["21[0-46-9]"], "0$1", "0$CC-$1", 0], [, "(\\d{2})(\\d{3,4})", "$1-$2", ["[3-6][1-9]1", "[3-6][1-9]1(?:[0-46-9])"], "0$1", "0$CC-$1", 0], [, "(\\d{4})(\\d{4})", "$1-$2", ["1(?:5[46-9]|6[04678]|8[0579])", "1(?:5(?:44|66|77|88|99)|6(?:00|44|6[16]|70|88)|8(?:00|55|77|99))"], "$1", "0$CC-$1", 0]], , [, , "15\\d{7,8}", "\\d{9,10}", , , "1523456789"], , , [, , "NA", "NA"], [,
, "1(?:5(?:44|66|77|88|99)|6(?:00|44|6[16]|70|88)|8(?:00|55|77|99))\\d{4}", "\\d{8}", , , "15441234"], , , [, , "NA", "NA"]], KW:[, [, , "[12569]\\d{6,7}", "\\d{7,8}"], [, , "(?:18\\d|2(?:[23]\\d{2}|4(?:[1-35-9]\\d|44)|5(?:0[034]|[2-46]\\d|5[1-3]|7[1-7])))\\d{4}", "\\d{7,8}", , , "22345678"], [, , "(?:5(?:[05]\\d{2}|1[0-7]\\d|2(?:22|55))|6(?:0[034679]\\d|5[015-9]\\d|6\\d{2}|7[067]\\d|9[0369]\\d)|9(?:0[09]\\d|22\\d|4[01479]\\d|55\\d|6[0679]\\d|[79]\\d{2}|8[057-9]\\d))\\d{4}", "\\d{8}", , , "50012345"],
[, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "KW", 965, "00", , , , , , , , [[, "(\\d{4})(\\d{3,4})", "$1 $2", ["[126]|9[04-9]|52[25]"], "", "", 0], [, "(\\d{3})(\\d{5})", "$1 $2", ["5[015]|92"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], KY:[, [, , "[3589]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "345(?:2(?:22|44)|444|6(?:23|38|40)|7(?:4[35-79]|6[6-9]|77)|8(?:00|1[45]|25|[48]8)|9(?:14|4[035-9]))\\d{4}", "\\d{7}(?:\\d{3})?",
, , "3452221234"], [, , "345(?:32[1-9]|5(?:1[67]|2[5-7]|4[6-8]|76)|9(?:1[67]|2[2-9]|3[689]))\\d{4}", "\\d{10}", , , "3453231234"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002345678"], [, , "900[2-9]\\d{6}|345976\\d{4}", "\\d{10}", , , "9002345678"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "NA", "NA"], "KY", 1, "011", "1", , , "1", , , , , , [, , "345849\\d{4}", "\\d{10}", , , "3458491234"], , "345", [, , "NA", "NA"], [, , "NA",
"NA"], , , [, , "NA", "NA"]], KZ:[, [, , "(?:33\\d|7\\d{2}|80[09])\\d{7}", "\\d{10}"], [, , "33622\\d{5}|7(?:1(?:0(?:[23]\\d|4[023]|59|63)|1(?:[23]\\d|4[0-79]|59)|2(?:[23]\\d|59)|3(?:2\\d|3[1-79]|4[0-35-9]|59)|4(?:2\\d|3[013-79]|4[0-8]|5[1-79])|5(?:2\\d|3[1-8]|4[1-7]|59)|6(?:[234]\\d|5[19]|61)|72\\d|8(?:[27]\\d|3[1-46-9]|4[0-5]))|2(?:1(?:[23]\\d|4[46-9]|5[3469])|2(?:2\\d|3[0679]|46|5[12679])|3(?:[234]\\d|5[139])|4(?:2\\d|3[1235-9]|59)|5(?:[23]\\d|4[01246-8]|59|61)|6(?:2\\d|3[1-9]|4[0-4]|59)|7(?:[237]\\d|40|5[279])|8(?:[23]\\d|4[0-3]|59)|9(?:2\\d|3[124578]|59)))\\d{5}",
"\\d{10}", , , "7123456789"], [, , "7(?:0[012578]|47|6[02-4]|7[15-8]|85)\\d{7}", "\\d{10}", , , "7710009998"], [, , "800\\d{7}", "\\d{10}", , , "8001234567"], [, , "809\\d{7}", "\\d{10}", , , "8091234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "751\\d{7}", "\\d{10}", , , "7511234567"], "KZ", 7, "810", "8", , , "8", , "8~10", , , , [, , "NA", "NA"], , , [, , "751\\d{7}", "\\d{10}", , , "7511234567"], [, , "NA", "NA"], , , [, , "NA", "NA"]], LA:[, [, , "[2-8]\\d{7,9}", "\\d{6,10}"], [, , "(?:2[13]|3(?:0\\d|[14])|[5-7][14]|41|8[1468])\\d{6}",
"\\d{6,9}", , , "21212862"], [, , "20(?:2[2389]|5[4-689]|7[6-8]|9[15-9])\\d{6}", "\\d{10}", , , "2023123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "LA", 856, "00", "0", , , "0", , , , [[, "(20)(\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3 $4", ["20"], "0$1", "", 0], [, "([2-8]\\d)(\\d{3})(\\d{3})", "$1 $2 $3", ["2[13]|3[14]|[4-8]"], "0$1", "", 0], [, "(30)(\\d{2})(\\d{2})(\\d{3})", "$1 $2 $3 $4", ["30"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA",
"NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], LB:[, [, , "[13-9]\\d{6,7}", "\\d{7,8}"], [, , "(?:[14-6]\\d{2}|7(?:[2-57]\\d|62|8[0-7]|9[04-9])|8[02-9]\\d|9\\d{2})\\d{4}", "\\d{7}", , , "1123456"], [, , "(?:3\\d|7(?:[01]\\d|6[013-9]|8[89]|9[1-3])|81\\d)\\d{5}", "\\d{7,8}", , , "71123456"], [, , "NA", "NA"], [, , "9[01]\\d{6}", "\\d{8}", , , "90123456"], [, , "80\\d{6}", "\\d{8}", , , "80123456"], [, , "NA", "NA"], [, , "NA", "NA"], "LB", 961, "00", "0", , , "0", , , , [[, "(\\d)(\\d{3})(\\d{3})",
"$1 $2 $3", ["[13-6]|7(?:[2-57]|62|8[0-7]|9[04-9])|8[02-9]|9"], "0$1", "", 0], [, "([7-9]\\d)(\\d{3})(\\d{3})", "$1 $2 $3", ["[89][01]|7(?:[01]|6[013-9]|8[89]|9[1-3])"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], LC:[, [, , "[5789]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "758(?:4(?:30|5[0-9]|6[2-9]|8[0-2])|57[0-2]|638)\\d{4}", "\\d{7}(?:\\d{3})?", , , "7584305678"], [, , "758(?:28[4-7]|384|4(?:6[01]|8[4-9])|5(?:1[89]|20|84)|7(?:1[2-9]|2[0-8]))\\d{4}",
"\\d{10}", , , "7582845678"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002123456"], [, , "900[2-9]\\d{6}", "\\d{10}", , , "9002123456"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "NA", "NA"], "LC", 1, "011", "1", , , "1", , , , , , [, , "NA", "NA"], , "758", [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], LI:[, [, , "6\\d{8}|[23789]\\d{6}", "\\d{7,9}"], [, , "(?:2(?:01|1[27]|3\\d|6[02-578]|96)|3(?:7[0135-7]|8[048]|9[0269]))\\d{4}",
"\\d{7}", , , "2345678"], [, , "6(?:51[01]|6(?:0[0-6]|2[016-9]|39))\\d{5}|7(?:[37-9]\\d|42|56)\\d{4}", "\\d{7,9}", , , "660234567"], [, , "80(?:02[28]|9\\d{2})\\d{2}", "\\d{7}", , , "8002222"], [, , "90(?:02[258]|1(?:23|3[14])|66[136])\\d{2}", "\\d{7}", , , "9002222"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "LI", 423, "00", "0", , , "0", , , , [[, "(\\d{3})(\\d{2})(\\d{2})", "$1 $2 $3", ["[23789]"], "", "", 0], [, "(\\d{3})(\\d{3})(\\d{3})", "$1 $2 $3", ["6[56]"], "", "", 0], [, "(69)(7\\d{2})(\\d{4})",
"$1 $2 $3", ["697"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "870(?:28|87)\\d{2}", "\\d{7}", , , "8702812"], , , [, , "697(?:42|56|[7-9]\\d)\\d{4}", "\\d{9}", , , "697861234"]], LK:[, [, , "[1-9]\\d{8}", "\\d{7,9}"], [, , "(?:[189]1|2[13-7]|3[1-8]|4[157]|5[12457]|6[35-7])[2-57]\\d{6}", "\\d{7,9}", , , "112345678"], [, , "7[0125-8]\\d{7}", "\\d{9}", , , "712345678"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "LK", 94, "00", "0", ,
, "0", , , , [[, "(\\d{2})(\\d{1})(\\d{6})", "$1 $2 $3", ["[1-689]"], "0$1", "", 0], [, "(\\d{2})(\\d{3})(\\d{4})", "$1 $2 $3", ["7"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], LR:[, [, , "2\\d{7,8}|[37-9]\\d{8}|4\\d{6}|5\\d{6,8}", "\\d{7,9}"], [, , "2\\d{7}", "\\d{8}", , , "21234567"], [, , "(?:330\\d|4[67]|5\\d|77\\d{2}|88\\d{2}|994\\d)\\d{5}|(?:20\\d{3}|33(?:0\\d{2}|2(?:02|5\\d))|555\\d{2}|77[0567]\\d{2}|88[068]\\d{2}|994\\d{2})\\d{4}",
"\\d{7,9}", , , "770123456"], [, , "NA", "NA"], [, , "90[03]\\d{6}", "\\d{9}", , , "900123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "332(?:0[02]|5\\d)\\d{4}", "\\d{9}", , , "332001234"], "LR", 231, "00", "0", , , "0", , , , [[, "(2\\d)(\\d{3})(\\d{3})", "$1 $2 $3", ["2"], "0$1", "", 0], [, "(\\d{3})(\\d{3})(\\d{3})", "$1 $2 $3", ["[2579]"], "0$1", "", 0], [, "([4-6])(\\d{3})(\\d{3})", "$1 $2 $3", ["[4-6]"], "0$1", "", 0], [, "(\\d{2})(\\d{3})(\\d{4})", "$1 $2 $3", ["[38]"], "0$1", "", 0]],
, [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], LS:[, [, , "[2568]\\d{7}", "\\d{8}"], [, , "2\\d{7}", "\\d{8}", , , "22123456"], [, , "[56]\\d{7}", "\\d{8}", , , "50123456"], [, , "800[256]\\d{4}", "\\d{8}", , , "80021234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "LS", 266, "00", , , , , , , , [[, "(\\d{4})(\\d{4})", "$1 $2", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], LT:[, [,
, "[3-9]\\d{7}", "\\d{8}"], [, , "(?:3[1478]|4[124-6]|52)\\d{6}", "\\d{8}", , , "31234567"], [, , "6\\d{7}", "\\d{8}", , , "61234567"], [, , "800\\d{5}", "\\d{8}", , , "80012345"], [, , "9(?:0[0239]|10)\\d{5}", "\\d{8}", , , "90012345"], [, , "808\\d{5}", "\\d{8}", , , "80812345"], [, , "700\\d{5}", "\\d{8}", , , "70012345"], [, , "NA", "NA"], "LT", 370, "00", "8", , , "[08]", , , , [[, "([34]\\d)(\\d{6})", "$1 $2", ["37|4(?:1|5[45]|6[2-4])"], "(8-$1)", "", 1], [, "([3-6]\\d{2})(\\d{5})", "$1 $2",
["3[148]|4(?:[24]|6[09])|528|6"], "(8-$1)", "", 1], [, "([7-9]\\d{2})(\\d{2})(\\d{3})", "$1 $2 $3", ["[7-9]"], "8 $1", "", 1], [, "(5)(2\\d{2})(\\d{4})", "$1 $2 $3", ["52[0-79]"], "(8-$1)", "", 1]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "70[67]\\d{5}", "\\d{8}", , , "70712345"], , , [, , "NA", "NA"]], LU:[, [, , "[24-9]\\d{3,10}|3(?:[0-46-9]\\d{2,9}|5[013-9]\\d{1,8})", "\\d{4,11}"], [, , "(?:2[2-9]\\d{2,9}|(?:[3457]\\d{2}|8(?:0[2-9]|[13-9]\\d)|9(?:0[89]|[2-579]\\d))\\d{1,8})", "\\d{4,11}",
, , "27123456"], [, , "6[2679][18]\\d{6}", "\\d{9}", , , "628123456"], [, , "800\\d{5}", "\\d{8}", , , "80012345"], [, , "90[015]\\d{5}", "\\d{8}", , , "90012345"], [, , "801\\d{5}", "\\d{8}", , , "80112345"], [, , "70\\d{6}", "\\d{8}", , , "70123456"], [, , "20(?:1\\d{5}|[2-689]\\d{1,7})", "\\d{4,10}", , , "20201234"], "LU", 352, "00", , , , "(15(?:0[06]|1[12]|35|4[04]|55|6[26]|77|88|99)\\d)", , , , [[, "(\\d{2})(\\d{3})", "$1 $2", ["[2-5]|7[1-9]|[89](?:[1-9]|0[2-9])"], "", "$CC $1", 0], [, "(\\d{2})(\\d{2})(\\d{2})",
"$1 $2 $3", ["[2-5]|7[1-9]|[89](?:[1-9]|0[2-9])"], "", "$CC $1", 0], [, "(\\d{2})(\\d{2})(\\d{3})", "$1 $2 $3", ["20"], "", "$CC $1", 0], [, "(\\d{2})(\\d{2})(\\d{2})(\\d{1,2})", "$1 $2 $3 $4", ["2(?:[0367]|4[3-8])"], "", "$CC $1", 0], [, "(\\d{2})(\\d{2})(\\d{2})(\\d{3})", "$1 $2 $3 $4", ["20"], "", "$CC $1", 0], [, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})(\\d{1,2})", "$1 $2 $3 $4 $5", ["2(?:[0367]|4[3-8])"], "", "$CC $1", 0], [, "(\\d{2})(\\d{2})(\\d{2})(\\d{1,4})", "$1 $2 $3 $4", ["2(?:[12589]|4[12])|[3-5]|7[1-9]|8(?:[1-9]|0[2-9])|9(?:[1-9]|0[2-46-9])"],
"", "$CC $1", 0], [, "(\\d{3})(\\d{2})(\\d{3})", "$1 $2 $3", ["70|80[01]|90[015]"], "", "$CC $1", 0], [, "(\\d{3})(\\d{3})(\\d{3})", "$1 $2 $3", ["6"], "", "$CC $1", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], LV:[, [, , "[2689]\\d{7}", "\\d{8}"], [, , "6[3-8]\\d{6}", "\\d{8}", , , "63123456"], [, , "2\\d{7}", "\\d{8}", , , "21234567"], [, , "80\\d{6}", "\\d{8}", , , "80123456"], [, , "90\\d{6}", "\\d{8}", , , "90123456"], [, , "81\\d{6}", "\\d{8}", , ,
"81123456"], [, , "NA", "NA"], [, , "NA", "NA"], "LV", 371, "00", , , , , , , , [[, "([2689]\\d)(\\d{3})(\\d{3})", "$1 $2 $3", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], LY:[, [, , "[25679]\\d{8}", "\\d{7,9}"], [, , "(?:2[1345]|5[1347]|6[123479]|71)\\d{7}", "\\d{7,9}", , , "212345678"], [, , "9[1-6]\\d{7}", "\\d{9}", , , "912345678"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "LY", 218, "00", "0",
, , "0", , , , [[, "([25679]\\d)(\\d{7})", "$1-$2", , "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], MA:[, [, , "[5689]\\d{8}", "\\d{9}"], [, , "5(?:2(?:(?:[015-7]\\d|2[2-9]|3[2-57]|4[2-8]|8[235-7])\\d|9(?:0\\d|[89]0))|3(?:(?:[0-4]\\d|[57][2-9]|6[235-8]|9[3-9])\\d|8(?:0\\d|[89]0)))\\d{4}", "\\d{9}", , , "520123456"], [, , "6(?:0[0-8]|[12-79]\\d|8[017])\\d{6}", "\\d{9}", , , "650123456"], [, , "80\\d{7}", "\\d{9}", , , "801234567"], [, , "89\\d{7}",
"\\d{9}", , , "891234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "MA", 212, "00", "0", , , "0", , , , [[, "([56]\\d{2})(\\d{6})", "$1-$2", ["5(?:2[015-7]|3[0-4])|6"], "0$1", "", 0], [, "([58]\\d{3})(\\d{5})", "$1-$2", ["5(?:2[2-489]|3[5-9])|892", "5(?:2(?:[2-48]|90)|3(?:[5-79]|80))|892"], "0$1", "", 0], [, "(5\\d{4})(\\d{4})", "$1-$2", ["5(?:29|38)", "5(?:29|38)[89]"], "0$1", "", 0], [, "(8[09])(\\d{7})", "$1-$2", ["8(?:0|9[013-9])"], "0$1", "", 0]], , [, , "NA", "NA"], 1, , [, ,
"NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], MC:[, [, , "[4689]\\d{7,8}", "\\d{8,9}"], [, , "870\\d{5}|9[2-47-9]\\d{6}", "\\d{8}", , , "99123456"], [, , "6\\d{8}|4(?:4\\d|5[1-9])\\d{5}", "\\d{8,9}", , , "612345678"], [, , "90\\d{6}", "\\d{8}", , , "90123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "MC", 377, "00", "0", , , "0", , , , [[, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["9"], "$1", "", 0], [, "(\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["4"],
"0$1", "", 0], [, "(6)(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4 $5", ["6"], "0$1", "", 0], [, "(\\d{3})(\\d{3})(\\d{2})", "$1 $2 $3", ["8"], "$1", "", 0]], , [, , "NA", "NA"], , , [, , "8\\d{7}", "\\d{8}"], [, , "NA", "NA"], , , [, , "NA", "NA"]], MD:[, [, , "[235-9]\\d{7}", "\\d{8}"], [, , "(?:2(?:1[0569]|2\\d|3[015-7]|4[1-46-9]|5[0-24689]|6[2-589]|7[1-37]|9[1347-9])|5(?:33|5[257]))\\d{5}", "\\d{8}", , , "22212345"], [, , "(?:562\\d|6(?:[089]\\d{2}|1[01]\\d|21\\d|7(?:[1-6]\\d|7[0-4]))|7(?:6[07]|7[457-9]|[89]\\d)\\d)\\d{4}",
"\\d{8}", , , "62112345"], [, , "800\\d{5}", "\\d{8}", , , "80012345"], [, , "90[056]\\d{5}", "\\d{8}", , , "90012345"], [, , "808\\d{5}", "\\d{8}", , , "80812345"], [, , "NA", "NA"], [, , "3[08]\\d{6}", "\\d{8}", , , "30123456"], "MD", 373, "00", "0", , , "0", , , , [[, "(\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["22|3"], "0$1", "", 0], [, "([25-7]\\d{2})(\\d{2})(\\d{3})", "$1 $2 $3", ["2[13-79]|[5-7]"], "0$1", "", 0], [, "([89]\\d{2})(\\d{5})", "$1 $2", ["[89]"], "0$1", "", 0]], , [, , "NA", "NA"],
, , [, , "NA", "NA"], [, , "8(?:03|14)\\d{5}", "\\d{8}", , , "80312345"], , , [, , "NA", "NA"]], ME:[, [, , "[2-9]\\d{7,8}", "\\d{6,9}"], [, , "(?:20[2-8]|3(?:0[2-7]|[12][35-7]|3[4-7])|4(?:0[2367]|1[267])|5(?:0[467]|1[267]|2[367]))\\d{5}", "\\d{6,8}", , , "30234567"], [, , "6(?:00\\d|32\\d|[89]\\d{2}|61\\d|7(?:[0-8]\\d|9(?:[3-9]|[0-2]\\d)))\\d{4}", "\\d{8,9}", , , "67622901"], [, , "80\\d{6}", "\\d{8}", , , "80080002"], [, , "(?:9(?:4[1568]|5[178]))\\d{5}", "\\d{8}", , , "94515151"], [, , "NA", "NA"],
[, , "NA", "NA"], [, , "78[1-9]\\d{5}", "\\d{8}", , , "78108780"], "ME", 382, "00", "0", , , "0", , , , [[, "(\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["[2-57-9]|6[036-9]", "[2-57-9]|6(?:[03689]|7(?:[0-8]|9[3-9]))"], "0$1", "", 0], [, "(67)(9)(\\d{3})(\\d{3})", "$1 $2 $3 $4", ["679", "679[0-2]"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "77\\d{6}", "\\d{8}", , , "77273012"], , , [, , "NA", "NA"]], MF:[, [, , "[56]\\d{8}", "\\d{9}"], [, , "590(?:[02][79]|13|5[0-268]|[78]7)\\d{4}",
"\\d{9}", , , "590271234"], [, , "690(?:0[0-7]|[1-9]\\d)\\d{4}", "\\d{9}", , , "690301234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "MF", 590, "00", "0", , , "0", , , , , , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], MG:[, [, , "[23]\\d{8}", "\\d{7,9}"], [, , "20(?:2\\d{2}|4[47]\\d|5[3467]\\d|6[279]\\d|7(?:2[29]|[35]\\d)|8[268]\\d|9[245]\\d)\\d{4}", "\\d{7,9}", , , "202123456"], [, , "3[2-49]\\d{7}", "\\d{9}",
, , "321234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "22\\d{7}", "\\d{9}", , , "221234567"], "MG", 261, "00", "0", , , "0", , , , [[, "([23]\\d)(\\d{2})(\\d{3})(\\d{2})", "$1 $2 $3 $4", , "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], MH:[, [, , "[2-6]\\d{6}", "\\d{7}"], [, , "(?:247|528|625)\\d{4}", "\\d{7}", , , "2471234"], [, , "(?:235|329|45[56]|545)\\d{4}", "\\d{7}", , , "2351234"], [, , "NA", "NA"],
[, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "635\\d{4}", "\\d{7}", , , "6351234"], "MH", 692, "011", "1", , , "1", , , , [[, "(\\d{3})(\\d{4})", "$1-$2", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], MK:[, [, , "[2-578]\\d{7}", "\\d{8}"], [, , "(?:2(?:[23]\\d|5[124578]|6[01])|3(?:1[3-6]|[23][2-6]|4[2356])|4(?:[23][2-6]|4[3-6]|5[256]|6[25-8]|7[24-6]|8[4-6]))\\d{5}", "\\d{6,8}", , , "22212345"], [, , "7(?:[0-25-8]\\d{2}|32\\d|421)\\d{4}",
"\\d{8}", , , "72345678"], [, , "800\\d{5}", "\\d{8}", , , "80012345"], [, , "5[02-9]\\d{6}", "\\d{8}", , , "50012345"], [, , "8(?:0[1-9]|[1-9]\\d)\\d{5}", "\\d{8}", , , "80123456"], [, , "NA", "NA"], [, , "NA", "NA"], "MK", 389, "00", "0", , , "0", , , , [[, "(2)(\\d{3})(\\d{4})", "$1 $2 $3", ["2"], "0$1", "", 0], [, "([347]\\d)(\\d{3})(\\d{3})", "$1 $2 $3", ["[347]"], "0$1", "", 0], [, "([58]\\d{2})(\\d)(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["[58]"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA",
"NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], ML:[, [, , "[246-9]\\d{7}", "\\d{8}"], [, , "(?:2(?:0(?:2[0-589]|7\\d)|1(?:2[5-7]|[3-689]\\d|7[2-4689]))|44[239]\\d)\\d{4}", "\\d{8}", , , "20212345"], [, , "[67]\\d{7}|9[0-25-9]\\d{6}", "\\d{8}", , , "65012345"], [, , "800\\d{5}", "\\d{8}", , , "80012345"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "ML", 223, "00", , , , , , , , [[, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["[246-9]"], "", "", 0], [, "(\\d{4})",
"$1", ["67|74"], "", "", 0]], [[, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["[246-9]"], "", "", 0]], [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], MM:[, [, , "[14578]\\d{5,7}|[26]\\d{5,8}|9(?:2\\d{0,2}|[58]|3\\d|4\\d{1,2}|6\\d?|[79]\\d{0,2})\\d{6}", "\\d{5,10}"], [, , "1(?:2\\d{1,2}|[3-5]\\d|6\\d?|[89][0-6]\\d)\\d{4}|2(?:[236-9]\\d{4}|4(?:0\\d{5}|\\d{4})|5(?:1\\d{3,6}|[02-9]\\d{3,5}))|4(?:2[245-8]|[346][2-6]|5[3-5])\\d{4}|5(?:2(?:20?|[3-8])|3[2-68]|4(?:21?|[4-8])|5[23]|6[2-4]|7[2-8]|8[24-7]|9[2-7])\\d{4}|6(?:0[23]|1[2356]|[24][2-6]|3[24-6]|5[2-4]|6[2-8]|7(?:[2367]|4\\d|5\\d?|8[145]\\d)|8[245]|9[24])\\d{4}|7(?:[04][24-8]|[15][2-7]|22|3[2-4])\\d{4}|8(?:1(?:2\\d?|[3-689])|2[2-8]|3[24]|4[24-7]|5[245]|6[23])\\d{4}",
"\\d{5,9}", , , "1234567"], [, , "17[01]\\d{4}|9(?:2(?:[0-4]|5\\d{2}|6[0-5]\\d)|3[0-36]\\d|4(?:0[0-4]\\d|[1379]\\d|2\\d{2}|4[0-589]\\d|5\\d{2}|88)|5[0-6]|61?\\d|7(?:3\\d|[789]\\d{2})|8\\d|9(?:1\\d|[67]\\d{2}|[089]))\\d{5}", "\\d{7,10}", , , "92123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "1333\\d{4}", "\\d{8}", , , "13331234"], "MM", 95, "00", "0", , , "0", , , , [[, "(\\d)(\\d{3})(\\d{3,4})", "$1 $2 $3", ["1|2[45]"], "0$1", "", 0], [, "(2)(\\d{4})(\\d{4})",
"$1 $2 $3", ["251"], "0$1", "", 0], [, "(\\d)(\\d{2})(\\d{3})", "$1 $2 $3", ["16|2"], "0$1", "", 0], [, "(\\d{2})(\\d{3})(\\d{3,4})", "$1 $2 $3", ["67|81"], "0$1", "", 0], [, "(\\d{2})(\\d{2})(\\d{3,4})", "$1 $2 $3", ["[4-8]"], "0$1", "", 0], [, "(9)(\\d{3})(\\d{4,6})", "$1 $2 $3", ["9(?:2[0-4]|[35-9]|4[137-9])"], "0$1", "", 0], [, "(9)([34]\\d{4})(\\d{4})", "$1 $2 $3", ["9(?:3[0-36]|4[0-57-9])"], "0$1", "", 0], [, "(9)(\\d{3})(\\d{3})(\\d{3})", "$1 $2 $3 $4", ["92[56]"], "0$1", "", 0], [, "(9)(\\d{3})(\\d{3})(\\d{2})",
"$1 $2 $3 $4", ["93"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], MN:[, [, , "[12]\\d{7,9}|[57-9]\\d{7}", "\\d{6,10}"], [, , "[12](?:1\\d|2(?:[1-3]\\d?|7\\d)|3[2-8]\\d{1,2}|4[2-68]\\d{1,2}|5[1-4689]\\d{1,2})\\d{5}|5[0568]\\d{6}", "\\d{6,10}", , , "50123456"], [, , "(?:8[0689]|9[013-9])\\d{6}", "\\d{8}", , , "88123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "7[05-8]\\d{6}", "\\d{8}", , , "75123456"], "MN",
976, "001", "0", , , "0", , , , [[, "([12]\\d)(\\d{2})(\\d{4})", "$1 $2 $3", ["[12]1"], "0$1", "", 0], [, "([12]2\\d)(\\d{5,6})", "$1 $2", ["[12]2[1-3]"], "0$1", "", 0], [, "([12]\\d{3})(\\d{5})", "$1 $2", ["[12](?:27|[3-5])", "[12](?:27|[3-5]\\d)2"], "0$1", "", 0], [, "(\\d{4})(\\d{4})", "$1 $2", ["[57-9]"], "$1", "", 0], [, "([12]\\d{4})(\\d{4,5})", "$1 $2", ["[12](?:27|[3-5])", "[12](?:27|[3-5]\\d)[4-9]"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA",
"NA"]], MO:[, [, , "[268]\\d{7}", "\\d{8}"], [, , "(?:28[2-57-9]|8[2-57-9]\\d)\\d{5}", "\\d{8}", , , "28212345"], [, , "6[236]\\d{6}", "\\d{8}", , , "66123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "MO", 853, "00", , , , , , , , [[, "([268]\\d{3})(\\d{4})", "$1 $2", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], MP:[, [, , "[5689]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "670(?:2(?:3[3-7]|56|8[5-8])|32[1238]|4(?:33|8[348])|5(?:32|55|88)|6(?:64|70|82)|78[589]|8[3-9]8|989)\\d{4}",
"\\d{7}(?:\\d{3})?", , , "6702345678"], [, , "670(?:2(?:3[3-7]|56|8[5-8])|32[1238]|4(?:33|8[348])|5(?:32|55|88)|6(?:64|70|82)|78[589]|8[3-9]8|989)\\d{4}", "\\d{7}(?:\\d{3})?", , , "6702345678"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002123456"], [, , "900[2-9]\\d{6}", "\\d{10}", , , "9002123456"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "NA", "NA"], "MP", 1, "011", "1", , , "1", , , 1, , , [, , "NA", "NA"], , "670", [, , "NA",
"NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], MQ:[, [, , "[56]\\d{8}", "\\d{9}"], [, , "596(?:0[2-5]|[12]0|3[05-9]|4[024-8]|[5-7]\\d|89|9[4-8])\\d{4}", "\\d{9}", , , "596301234"], [, , "696(?:[0-479]\\d|5[01]|8[0-689])\\d{4}", "\\d{9}", , , "696201234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "MQ", 596, "00", "0", , , "0", , , , [[, "(\\d{3})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", , "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [,
, "NA", "NA"], , , [, , "NA", "NA"]], MR:[, [, , "[2-48]\\d{7}", "\\d{8}"], [, , "25[08]\\d{5}|35\\d{6}|45[1-7]\\d{5}", "\\d{8}", , , "35123456"], [, , "[234][0-46-9]\\d{6}", "\\d{8}", , , "22123456"], [, , "800\\d{5}", "\\d{8}", , , "80012345"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "MR", 222, "00", , , , , , , , [[, "([2-48]\\d)(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]],
MS:[, [, , "[5689]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "664491\\d{4}", "\\d{7}(?:\\d{3})?", , , "6644912345"], [, , "66449[2-6]\\d{4}", "\\d{10}", , , "6644923456"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002123456"], [, , "900[2-9]\\d{6}", "\\d{10}", , , "9002123456"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "NA", "NA"], "MS", 1, "011", "1", , , "1", , , , , , [, , "NA", "NA"], , "664", [, , "NA", "NA"], [, , "NA", "NA"], , ,
[, , "NA", "NA"]], MT:[, [, , "[2357-9]\\d{7}", "\\d{8}"], [, , "2(?:0(?:1[0-6]|3[1-4]|[69]\\d)|[1-357]\\d{2})\\d{4}", "\\d{8}", , , "21001234"], [, , "(?:7(?:210|[79]\\d{2})|9(?:2(?:1[01]|31)|696|8(?:1[1-3]|89|97)|9\\d{2}))\\d{4}", "\\d{8}", , , "96961234"], [, , "800[3467]\\d{4}", "\\d{8}", , , "80071234"], [, , "5(?:0(?:0(?:37|43)|6\\d{2}|70\\d|9[0168])|[12]\\d0[1-5])\\d{3}", "\\d{8}", , , "50037123"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "3550\\d{4}", "\\d{8}", , , "35501234"], "MT", 356,
"00", , , , , , , , [[, "(\\d{4})(\\d{4})", "$1 $2", , "", "", 0]], , [, , "7117\\d{4}", "\\d{8}", , , "71171234"], , , [, , "NA", "NA"], [, , "501\\d{5}", "\\d{8}", , , "50112345"], , , [, , "NA", "NA"]], MU:[, [, , "[2-9]\\d{6,7}", "\\d{7,8}"], [, , "(?:2(?:[03478]\\d|1[0-7]|6[1-69])|4(?:[013568]\\d|2[4-7])|5(?:44\\d|471)|6\\d{2}|8(?:14|3[129]))\\d{4}", "\\d{7,8}", , , "2012345"], [, , "5(?:2[59]\\d|4(?:2[1-389]|4\\d|7[1-9]|9\\d)|7\\d{2}|8(?:[0-2568]\\d|7[15-8])|9[0-8]\\d)\\d{4}", "\\d{8}", , ,
"52512345"], [, , "80[012]\\d{4}", "\\d{7}", , , "8001234"], [, , "30\\d{5}", "\\d{7}", , , "3012345"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "3(?:20|9\\d)\\d{4}", "\\d{7}", , , "3201234"], "MU", 230, "0(?:0|[2-7]0|33)", , , , , , "020", , [[, "([2-46-9]\\d{2})(\\d{4})", "$1 $2", ["[2-46-9]"], "", "", 0], [, "(5\\d{3})(\\d{4})", "$1 $2", ["5"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], MV:[, [, , "[3467]\\d{6}|9(?:00\\d{7}|\\d{6})", "\\d{7,10}"],
[, , "(?:3(?:0[01]|3[0-59])|6(?:[567][02468]|8[024689]|90))\\d{4}", "\\d{7}", , , "6701234"], [, , "(?:46[46]|7[3-9]\\d|9[15-9]\\d)\\d{4}", "\\d{7}", , , "7712345"], [, , "NA", "NA"], [, , "900\\d{7}", "\\d{10}", , , "9001234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "MV", 960, "0(?:0|19)", , , , , , "00", , [[, "(\\d{3})(\\d{4})", "$1-$2", ["[3467]|9(?:[1-9]|0[1-9])"], "", "", 0], [, "(\\d{3})(\\d{3})(\\d{4})", "$1 $2 $3", ["900"], "", "", 0]], , [, , "781\\d{4}", "\\d{7}", , ,
"7812345"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], MW:[, [, , "(?:1(?:\\d{2})?|[2789]\\d{2})\\d{6}", "\\d{7,9}"], [, , "(?:1[2-9]|21\\d{2})\\d{5}", "\\d{7,9}", , , "1234567"], [, , "(?:111|77\\d|88\\d|99\\d)\\d{6}", "\\d{9}", , , "991234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "MW", 265, "00", "0", , , "0", , , , [[, "(\\d)(\\d{3})(\\d{3})", "$1 $2 $3", ["1"], "0$1", "", 0], [, "(2\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3",
["2"], "0$1", "", 0], [, "(\\d{3})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["[1789]"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], MX:[, [, , "[1-9]\\d{9,10}", "\\d{7,11}"], [, , "(?:33|55|81)\\d{8}|(?:2(?:0[01]|2[2-9]|3[1-35-8]|4[13-9]|7[1-689]|8[1-578]|9[467])|3(?:1[1-79]|[2458][1-9]|7[1-8]|9[1-5])|4(?:1[1-57-9]|[24-6][1-9]|[37][1-8]|8[1-35-9]|9[2-689])|5(?:88|9[1-79])|6(?:1[2-68]|[234][1-9]|5[1-3689]|6[12457-9]|7[1-7]|8[67]|9[4-8])|7(?:[13467][1-9]|2[1-8]|5[13-9]|8[1-69]|9[17])|8(?:2[13-689]|3[1-6]|4[124-6]|6[1246-9]|7[1-378]|9[12479])|9(?:1[346-9]|2[1-4]|3[2-46-8]|5[1348]|[69][1-9]|7[12]|8[1-8]))\\d{7}",
"\\d{7,10}", , , "2221234567"], [, , "1(?:(?:33|55|81)\\d{8}|(?:2(?:2[2-9]|3[1-35-8]|4[13-9]|7[1-689]|8[1-578]|9[467])|3(?:1[1-79]|[2458][1-9]|7[1-8]|9[1-5])|4(?:1[1-57-9]|[24-6][1-9]|[37][1-8]|8[1-35-9]|9[2-689])|5(?:88|9[1-79])|6(?:1[2-68]|[2-4][1-9]|5[1-3689]|6[12457-9]|7[1-7]|8[67]|9[4-8])|7(?:[13467][1-9]|2[1-8]|5[13-9]|8[1-69]|9[17])|8(?:2[13-689]|3[1-6]|4[124-6]|6[1246-9]|7[1-378]|9[12479])|9(?:1[346-9]|2[1-4]|3[2-46-8]|5[1348]|[69][1-9]|7[12]|8[1-8]))\\d{7})", "\\d{11}", , , "12221234567"],
[, , "8(?:00|88)\\d{7}", "\\d{10}", , , "8001234567"], [, , "900\\d{7}", "\\d{10}", , , "9001234567"], [, , "300\\d{7}", "\\d{10}", , , "3001234567"], [, , "500\\d{7}", "\\d{10}", , , "5001234567"], [, , "NA", "NA"], "MX", 52, "0[09]", "01", , , "0[12]|04[45](\\d{10})", "1$1", , , [[, "([358]\\d)(\\d{4})(\\d{4})", "$1 $2 $3", ["33|55|81"], "01 $1", "", 1], [, "(\\d{3})(\\d{3})(\\d{4})", "$1 $2 $3", ["[2467]|3[0-2457-9]|5[089]|8[02-9]|9[0-35-9]"], "01 $1", "", 1], [, "(1)([358]\\d)(\\d{4})(\\d{4})",
"044 $2 $3 $4", ["1(?:33|55|81)"], "$1", "", 1], [, "(1)(\\d{3})(\\d{3})(\\d{4})", "044 $2 $3 $4", ["1(?:[2467]|3[0-2457-9]|5[089]|8[2-9]|9[1-35-9])"], "$1", "", 1]], [[, "([358]\\d)(\\d{4})(\\d{4})", "$1 $2 $3", ["33|55|81"], "01 $1", "", 1], [, "(\\d{3})(\\d{3})(\\d{4})", "$1 $2 $3", ["[2467]|3[0-2457-9]|5[089]|8[02-9]|9[0-35-9]"], "01 $1", "", 1], [, "(1)([358]\\d)(\\d{4})(\\d{4})", "$1 $2 $3 $4", ["1(?:33|55|81)"]], [, "(1)(\\d{3})(\\d{3})(\\d{4})", "$1 $2 $3 $4", ["1(?:[2467]|3[0-2457-9]|5[089]|8[2-9]|9[1-35-9])"]]],
[, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], 1, , [, , "NA", "NA"]], MY:[, [, , "[13-9]\\d{7,9}", "\\d{6,10}"], [, , "(?:3[2-9]\\d|[4-9][2-9])\\d{6}", "\\d{6,9}", , , "323456789"], [, , "1(?:1[1-5]\\d{2}|[02-4679][2-9]\\d|59\\d{2}|8(?:1[23]|[2-9]\\d))\\d{5}", "\\d{9,10}", , , "123456789"], [, , "1[378]00\\d{6}", "\\d{10}", , , "1300123456"], [, , "1600\\d{6}", "\\d{10}", , , "1600123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "154\\d{7}", "\\d{10}", , , "1541234567"], "MY", 60, "00",
"0", , , "0", , , , [[, "([4-79])(\\d{3})(\\d{4})", "$1-$2 $3", ["[4-79]"], "0$1", "", 0], [, "(3)(\\d{4})(\\d{4})", "$1-$2 $3", ["3"], "0$1", "", 0], [, "([18]\\d)(\\d{3})(\\d{3,4})", "$1-$2 $3", ["1[02-46-9][1-9]|8"], "0$1", "", 0], [, "(1)([36-8]00)(\\d{2})(\\d{4})", "$1-$2-$3-$4", ["1[36-8]0"], "", "", 0], [, "(11)(\\d{4})(\\d{4})", "$1-$2 $3", ["11"], "0$1", "", 0], [, "(15[49])(\\d{3})(\\d{4})", "$1-$2 $3", ["15"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"],
, , [, , "NA", "NA"]], MZ:[, [, , "[28]\\d{7,8}", "\\d{8,9}"], [, , "2(?:[1346]\\d|5[0-2]|[78][12]|93)\\d{5}", "\\d{8}", , , "21123456"], [, , "8[23467]\\d{7}", "\\d{9}", , , "821234567"], [, , "800\\d{6}", "\\d{9}", , , "800123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "MZ", 258, "00", , , , , , , , [[, "([28]\\d)(\\d{3})(\\d{3,4})", "$1 $2 $3", ["2|8[2-7]"], "", "", 0], [, "(80\\d)(\\d{3})(\\d{3})", "$1 $2 $3", ["80"], "", "", 0]], , [, , "NA", "NA"], , , [,
, "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], NA:[, [, , "[68]\\d{7,8}", "\\d{8,9}"], [, , "6(?:1(?:17|2(?:[0189]\\d|[2-6]|7\\d?)|3(?:[01378]|2\\d)|4[01]|69|7[014])|2(?:17|5(?:[0-36-8]|4\\d?)|69|70)|3(?:17|2(?:[0237]\\d?|[14-689])|34|6[289]|7[01]|81)|4(?:17|2(?:[012]|7?)|4(?:[06]|1\\d)|5(?:[01357]|[25]\\d?)|69|7[01])|5(?:17|2(?:[0459]|[23678]\\d?)|69|7[01])|6(?:17|2(?:5|6\\d?)|38|42|69|7[01])|7(?:17|2(?:[569]|[234]\\d?)|3(?:0\\d?|[13])|69|7[01]))\\d{4}", "\\d{8,9}", , , "61221234"], [,
, "(?:60|8[125])\\d{7}", "\\d{9}", , , "811234567"], [, , "NA", "NA"], [, , "8701\\d{5}", "\\d{9}", , , "870123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "8(?:3\\d{2}|86)\\d{5}", "\\d{8,9}", , , "88612345"], "NA", 264, "00", "0", , , "0", , , , [[, "(8\\d)(\\d{3})(\\d{4})", "$1 $2 $3", ["8[1235]"], "0$1", "", 0], [, "(6\\d)(\\d{3})(\\d{3,4})", "$1 $2 $3", ["6"], "0$1", "", 0], [, "(88)(\\d{3})(\\d{3})", "$1 $2 $3", ["88"], "0$1", "", 0], [, "(870)(\\d{3})(\\d{3})", "$1 $2 $3", ["870"], "0$1",
"", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], NC:[, [, , "[2-57-9]\\d{5}", "\\d{6}"], [, , "(?:2[03-9]|3[0-5]|4[1-7]|88)\\d{4}", "\\d{6}", , , "201234"], [, , "(?:5[0-4]|[79]\\d|8[0-79])\\d{4}", "\\d{6}", , , "751234"], [, , "NA", "NA"], [, , "36\\d{4}", "\\d{6}", , , "366711"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "NC", 687, "00", , , , , , , , [[, "(\\d{2})(\\d{2})(\\d{2})", "$1.$2.$3", ["[2-46-9]|5[0-4]"], "", "", 0]], , [, , "NA",
"NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], NE:[, [, , "[0289]\\d{7}", "\\d{8}"], [, , "2(?:0(?:20|3[1-7]|4[134]|5[14]|6[14578]|7[1-578])|1(?:4[145]|5[14]|6[14-68]|7[169]|88))\\d{4}", "\\d{8}", , , "20201234"], [, , "(?:8[089]|9\\d)\\d{6}", "\\d{8}", , , "93123456"], [, , "08\\d{6}", "\\d{8}", , , "08123456"], [, , "09\\d{6}", "\\d{8}", , , "09123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "NE", 227, "00", , , , , , , , [[, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})",
"$1 $2 $3 $4", ["[289]|09"], "", "", 0], [, "(08)(\\d{3})(\\d{3})", "$1 $2 $3", ["08"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], 1, , [, , "NA", "NA"]], NF:[, [, , "[13]\\d{5}", "\\d{5,6}"], [, , "(?:1(?:06|17|28|39)|3[012]\\d)\\d{3}", "\\d{5,6}", , , "106609"], [, , "3[58]\\d{4}", "\\d{5,6}", , , "381234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "NF", 672, "00", , , , , , , , [[, "(\\d{2})(\\d{4})", "$1 $2", ["1"],
"", "", 0], [, "(\\d)(\\d{5})", "$1 $2", ["3"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], NG:[, [, , "[1-6]\\d{5,8}|9\\d{5,9}|[78]\\d{5,13}", "\\d{5,14}"], [, , "[12]\\d{6,7}|9(?:0[3-9]|[1-9]\\d)\\d{5}|(?:3\\d|4[023568]|5[02368]|6[02-469]|7[4-69]|8[2-9])\\d{6}|(?:4[47]|5[14579]|6[1578]|7[0-357])\\d{5,6}|(?:78|41)\\d{5}", "\\d{5,9}", , , "12345678"], [, , "(?:1(?:7[34]\\d|8(?:04|[124579]\\d|8[0-3])|95\\d)|287[0-7]|3(?:18[1-8]|88[0-7]|9(?:8[5-9]|6[1-5]))|4(?:28[0-2]|6(?:7[1-9]|8[02-47])|88[0-2])|5(?:2(?:7[7-9]|8\\d)|38[1-79]|48[0-7]|68[4-7])|6(?:2(?:7[7-9]|8\\d)|4(?:3[7-9]|[68][129]|7[04-69]|9[1-8])|58[0-2]|98[7-9])|7(?:38[0-7]|69[1-8]|78[2-4])|8(?:28[3-9]|38[0-2]|4(?:2[12]|3[147-9]|5[346]|7[4-9]|8[014-689]|90)|58[1-8]|78[2-9]|88[5-7])|98[07]\\d)\\d{4}|(?:70(?:[13-9]\\d|2[1-9])|8(?:0[2-9]|1\\d)\\d|90[2359]\\d)\\d{6}",
"\\d{8,10}", , , "8021234567"], [, , "800\\d{7,11}", "\\d{10,14}", , , "80017591759"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "NG", 234, "009", "0", , , "0", , , , [[, "([129])(\\d{3})(\\d{3,4})", "$1 $2 $3", ["[129]"], "0$1", "", 0], [, "(\\d{2})(\\d{3})(\\d{2,3})", "$1 $2 $3", ["[3-6]|7(?:[1-79]|0[1-9])|8[2-9]"], "0$1", "", 0], [, "(\\d{3})(\\d{3})(\\d{3,4})", "$1 $2 $3", ["70|8[01]|90[2359]"], "0$1", "", 0], [, "([78]00)(\\d{4})(\\d{4,5})", "$1 $2 $3", ["[78]00"],
"0$1", "", 0], [, "([78]00)(\\d{5})(\\d{5,6})", "$1 $2 $3", ["[78]00"], "0$1", "", 0], [, "(78)(\\d{2})(\\d{3})", "$1 $2 $3", ["78"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "700\\d{7,11}", "\\d{10,14}", , , "7001234567"], , , [, , "NA", "NA"]], NI:[, [, , "[12578]\\d{7}", "\\d{8}"], [, , "2\\d{7}", "\\d{8}", , , "21234567"], [, , "5(?:5[0-7]\\d{5}|[78]\\d{6})|7[5-8]\\d{6}|8\\d{7}", "\\d{8}", , , "81234567"], [, , "1800\\d{4}", "\\d{8}", , , "18001234"], [, , "NA", "NA"], [,
, "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "NI", 505, "00", , , , , , , , [[, "(\\d{4})(\\d{4})", "$1 $2", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], NL:[, [, , "1\\d{4,8}|[2-7]\\d{8}|[89]\\d{6,9}", "\\d{5,10}"], [, , "(?:1[0135-8]|2[02-69]|3[0-68]|4[0135-9]|[57]\\d|8[478])\\d{7}", "\\d{9}", , , "101234567"], [, , "6[1-58]\\d{7}", "\\d{9}", , , "612345678"], [, , "800\\d{4,7}", "\\d{7,10}", , , "8001234"], [, , "90[069]\\d{4,7}", "\\d{7,10}",
, , "9061234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "85\\d{7}", "\\d{9}", , , "851234567"], "NL", 31, "00", "0", , , "0", , , , [[, "([1-578]\\d)(\\d{3})(\\d{4})", "$1 $2 $3", ["1[035]|2[0346]|3[03568]|4[0356]|5[0358]|7|8[4578]"], "0$1", "", 0], [, "([1-5]\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["1[16-8]|2[259]|3[124]|4[17-9]|5[124679]"], "0$1", "", 0], [, "(6)(\\d{8})", "$1 $2", ["6[0-57-9]"], "0$1", "", 0], [, "(66)(\\d{7})", "$1 $2", ["66"], "0$1", "", 0], [, "(14)(\\d{3,4})", "$1 $2", ["14"],
"$1", "", 0], [, "([89]0\\d)(\\d{4,7})", "$1 $2", ["80|9"], "0$1", "", 0]], , [, , "66\\d{7}", "\\d{9}", , , "662345678"], , , [, , "14\\d{3,4}", "\\d{5,6}"], [, , "140(?:1(?:[035]|[16-8]\\d)|2(?:[0346]|[259]\\d)|3(?:[03568]|[124]\\d)|4(?:[0356]|[17-9]\\d)|5(?:[0358]|[124679]\\d)|7\\d|8[458])", "\\d{5,6}", , , "14020"], , , [, , "NA", "NA"]], NO:[, [, , "0\\d{4}|[2-9]\\d{7}", "\\d{5}(?:\\d{3})?"], [, , "(?:2[1-4]|3[1-3578]|5[1-35-7]|6[1-4679]|7[0-8])\\d{6}", "\\d{8}", , , "21234567"], [, , "(?:4[015-8]|5[89]|9\\d)\\d{6}",
"\\d{8}", , , "40612345"], [, , "80[01]\\d{5}", "\\d{8}", , , "80012345"], [, , "82[09]\\d{5}", "\\d{8}", , , "82012345"], [, , "810(?:0[0-6]|[2-8]\\d)\\d{3}", "\\d{8}", , , "81021234"], [, , "880\\d{5}", "\\d{8}", , , "88012345"], [, , "85[0-5]\\d{5}", "\\d{8}", , , "85012345"], "NO", 47, "00", , , , , , , , [[, "([489]\\d{2})(\\d{2})(\\d{3})", "$1 $2 $3", ["[489]"], "", "", 0], [, "([235-7]\\d)(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["[235-7]"], "", "", 0]], , [, , "NA", "NA"], 1, , [, , "NA",
"NA"], [, , "0\\d{4}|81(?:0(?:0[7-9]|1\\d)|5\\d{2})\\d{3}", "\\d{5}(?:\\d{3})?", , , "01234"], 1, , [, , "81[23]\\d{5}", "\\d{8}", , , "81212345"]], NP:[, [, , "[1-8]\\d{7}|9(?:[1-69]\\d{6,8}|7[2-6]\\d{5,7}|8\\d{8})", "\\d{6,10}"], [, , "(?:1[0-6]\\d|2[13-79][2-6]|3[135-8][2-6]|4[146-9][2-6]|5[135-7][2-6]|6[13-9][2-6]|7[15-9][2-6]|8[1-46-9][2-6]|9[1-79][2-6])\\d{5}", "\\d{6,8}", , , "14567890"], [, , "9(?:6[013]|7[245]|8[0-24-6])\\d{7}", "\\d{10}", , , "9841234567"], [, , "NA", "NA"], [, , "NA",
"NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "NP", 977, "00", "0", , , "0", , , , [[, "(1)(\\d{7})", "$1-$2", ["1[2-6]"], "0$1", "", 0], [, "(\\d{2})(\\d{6})", "$1-$2", ["1[01]|[2-8]|9(?:[1-69]|7[15-9])"], "0$1", "", 0], [, "(9\\d{2})(\\d{7})", "$1-$2", ["9(?:6[013]|7[245]|8)"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], NR:[, [, , "[458]\\d{6}", "\\d{7}"], [, , "(?:444|888)\\d{4}", "\\d{7}", , , "4441234"], [, , "55[5-9]\\d{4}",
"\\d{7}", , , "5551234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "NR", 674, "00", , , , , , , , [[, "(\\d{3})(\\d{4})", "$1 $2", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], NU:[, [, , "[1-5]\\d{3}", "\\d{4}"], [, , "[34]\\d{3}", "\\d{4}", , , "4002"], [, , "[125]\\d{3}", "\\d{4}", , , "1234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "NU", 683,
"00", , , , , , , , , , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], NZ:[, [, , "6[235-9]\\d{6}|[2-57-9]\\d{7,10}", "\\d{7,11}"], [, , "(?:3[2-79]|[49][2-9]|6[235-9]|7[2-57-9])\\d{6}|24099\\d{3}", "\\d{7,8}", , , "32345678"], [, , "2(?:[028]\\d{7,8}|1(?:[03]\\d{5,7}|[12457]\\d{5,6}|[689]\\d{5})|[79]\\d{7})", "\\d{8,10}", , , "211234567"], [, , "508\\d{6,7}|80\\d{6,8}", "\\d{8,10}", , , "800123456"], [, , "90\\d{7,9}", "\\d{9,11}", , , "900123456"], [, , "NA", "NA"],
[, , "70\\d{7}", "\\d{9}", , , "701234567"], [, , "NA", "NA"], "NZ", 64, "0(?:0|161)", "0", , , "0", , "00", , [[, "([34679])(\\d{3})(\\d{4})", "$1-$2 $3", ["[346]|7[2-57-9]|9[1-9]"], "0$1", "", 0], [, "(24099)(\\d{3})", "$1 $2", ["240", "2409", "24099"], "0$1", "", 0], [, "(\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["21"], "0$1", "", 0], [, "(\\d{2})(\\d{3})(\\d{3,5})", "$1 $2 $3", ["2(?:1[1-9]|[69]|7[0-35-9])|70|86"], "0$1", "", 0], [, "(2\\d)(\\d{3,4})(\\d{4})", "$1 $2 $3", ["2[028]"], "0$1", "",
0], [, "(\\d{3})(\\d{3})(\\d{3,4})", "$1 $2 $3", ["2(?:10|74)|5|[89]0"], "0$1", "", 0]], , [, , "[28]6\\d{6,7}", "\\d{8,9}", , , "26123456"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], OM:[, [, , "(?:2[2-6]|5|9[1-9])\\d{6}|800\\d{5,6}", "\\d{7,9}"], [, , "2[2-6]\\d{6}", "\\d{8}", , , "23123456"], [, , "9[1-9]\\d{6}", "\\d{8}", , , "92123456"], [, , "8007\\d{4,5}|500\\d{4}", "\\d{7,9}", , , "80071234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "OM",
968, "00", , , , , , , , [[, "(2\\d)(\\d{6})", "$1 $2", ["2"], "", "", 0], [, "(9\\d{3})(\\d{4})", "$1 $2", ["9"], "", "", 0], [, "([58]00)(\\d{4,6})", "$1 $2", ["[58]"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], PA:[, [, , "[1-9]\\d{6,7}", "\\d{7,8}"], [, , "(?:1(?:0[0-8]|1[49]|2[37]|3[0137]|4[147]|5[05]|6[58]|7[0167]|8[58]|9[139])|2(?:[0235679]\\d|1[0-7]|4[04-9]|8[028])|3(?:[09]\\d|1[014-7]|2[0-3]|3[03]|4[03-57]|55|6[068]|7[06-8]|8[06-9])|4(?:3[013-69]|4\\d|7[0-589])|5(?:[01]\\d|2[0-7]|[56]0|79)|7(?:0[09]|2[0-267]|3[06]|[469]0|5[06-9]|7[0-24-79]|8[7-9])|8(?:09|[34]\\d|5[0134]|8[02])|9(?:0[6-9]|1[016-8]|2[036-8]|3[3679]|40|5[0489]|6[06-9]|7[046-9]|8[36-8]|9[1-9]))\\d{4}",
"\\d{7}", , , "2001234"], [, , "(?:1[16]1|21[89]|8(?:1[01]|7[23]))\\d{4}|6(?:[024-9]\\d|1[0-5]|3[0-24-9])\\d{5}", "\\d{7,8}", , , "60012345"], [, , "80[09]\\d{4}", "\\d{7}", , , "8001234"], [, , "(?:779|8(?:55|60|7[78])|9(?:00|81))\\d{4}", "\\d{7}", , , "8601234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "PA", 507, "00", , , , , , , , [[, "(\\d{3})(\\d{4})", "$1-$2", ["[1-57-9]"], "", "", 0], [, "(\\d{4})(\\d{4})", "$1-$2", ["6"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"],
[, , "NA", "NA"], , , [, , "NA", "NA"]], PE:[, [, , "[14-9]\\d{7,8}", "\\d{6,9}"], [, , "(?:1\\d|4[1-4]|5[1-46]|6[1-7]|7[2-46]|8[2-4])\\d{6}", "\\d{6,8}", , , "11234567"], [, , "9\\d{8}", "\\d{9}", , , "912345678"], [, , "800\\d{5}", "\\d{8}", , , "80012345"], [, , "805\\d{5}", "\\d{8}", , , "80512345"], [, , "801\\d{5}", "\\d{8}", , , "80112345"], [, , "80[24]\\d{5}", "\\d{8}", , , "80212345"], [, , "NA", "NA"], "PE", 51, "19(?:1[124]|77|90)00", "0", " Anexo ", , "0", , , , [[, "(1)(\\d{7})", "$1 $2",
["1"], "(0$1)", "", 0], [, "([4-8]\\d)(\\d{6})", "$1 $2", ["[4-7]|8[2-4]"], "(0$1)", "", 0], [, "(\\d{3})(\\d{5})", "$1 $2", ["80"], "(0$1)", "", 0], [, "(9\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["9"], "$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], PF:[, [, , "4\\d{5,7}|8\\d{7}", "\\d{6}(?:\\d{2})?"], [, , "4(?:[09][45689]\\d|4)\\d{4}", "\\d{6}(?:\\d{2})?", , , "40412345"], [, , "8[79]\\d{6}", "\\d{8}", , , "87123456"], [, , "NA", "NA"], [, , "NA",
"NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "PF", 689, "00", , , , , , , , [[, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["4[09]|8[79]"], "", "", 0], [, "(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3", ["44"], "", "", 0]], , [, , "NA", "NA"], , , [, , "44\\d{4}", "\\d{6}", , , "441234"], [, , "NA", "NA"], , , [, , "NA", "NA"]], PG:[, [, , "[1-9]\\d{6,7}", "\\d{7,8}"], [, , "(?:3[0-2]\\d|4[25]\\d|5[34]\\d|64[1-9]|77(?:[0-24]\\d|30)|85[02-46-9]|9[78]\\d)\\d{4}", "\\d{7}", , , "3123456"],
[, , "(?:20150|68\\d{2}|7(?:[0-369]\\d|75)\\d{2})\\d{3}", "\\d{7,8}", , , "6812345"], [, , "180\\d{4}", "\\d{7}", , , "1801234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "275\\d{4}", "\\d{7}", , , "2751234"], "PG", 675, "00", , , , , , , , [[, "(\\d{3})(\\d{4})", "$1 $2", ["[13-689]|27"], "", "", 0], [, "(\\d{4})(\\d{4})", "$1 $2", ["20|7"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], PH:[, [, , "2\\d{5,7}|[3-9]\\d{7,9}|1800\\d{7,9}",
"\\d{5,13}"], [, , "2\\d{5}(?:\\d{2})?|(?:3[2-68]|4[2-9]|5[2-6]|6[2-58]|7[24578]|8[2-8])\\d{7}|88(?:22\\d{6}|42\\d{4})", "\\d{5,10}", , , "21234567"], [, , "(?:81[37]|9(?:0[5-9]|1[024-9]|2[0-35-9]|3[02-9]|4[236-9]|50|7[34-79]|89|9[4-9]))\\d{7}", "\\d{10}", , , "9051234567"], [, , "1800\\d{7,9}", "\\d{11,13}", , , "180012345678"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "PH", 63, "00", "0", , , "0", , , , [[, "(2)(\\d{3})(\\d{4})", "$1 $2 $3", ["2"], "(0$1)", "", 0],
[, "(2)(\\d{5})", "$1 $2", ["2"], "(0$1)", "", 0], [, "(\\d{4})(\\d{4,6})", "$1 $2", ["3(?:23|39|46)|4(?:2[3-6]|[35]9|4[26]|76)|5(?:22|44)|642|8(?:62|8[245])", "3(?:230|397|461)|4(?:2(?:35|[46]4|51)|396|4(?:22|63)|59[347]|76[15])|5(?:221|446)|642[23]|8(?:622|8(?:[24]2|5[13]))"], "(0$1)", "", 0], [, "(\\d{5})(\\d{4})", "$1 $2", ["346|4(?:27|9[35])|883", "3469|4(?:279|9(?:30|56))|8834"], "(0$1)", "", 0], [, "([3-8]\\d)(\\d{3})(\\d{4})", "$1 $2 $3", ["[3-8]"], "(0$1)", "", 0], [, "(\\d{3})(\\d{3})(\\d{4})",
"$1 $2 $3", ["81|9"], "0$1", "", 0], [, "(1800)(\\d{3})(\\d{4})", "$1 $2 $3", ["1"], "", "", 0], [, "(1800)(\\d{1,2})(\\d{3})(\\d{4})", "$1 $2 $3 $4", ["1"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], PK:[, [, , "1\\d{8}|[2-8]\\d{5,11}|9(?:[013-9]\\d{4,9}|2\\d(?:111\\d{6}|\\d{3,7}))", "\\d{6,12}"], [, , "(?:21|42)[2-9]\\d{7}|(?:2[25]|4[0146-9]|5[1-35-7]|6[1-8]|7[14]|8[16]|91)[2-9]\\d{6}|(?:2(?:3[2358]|4[2-4]|9[2-8])|45[3479]|54[2-467]|60[468]|72[236]|8(?:2[2-689]|3[23578]|4[3478]|5[2356])|9(?:1|2[2-8]|3[27-9]|4[2-6]|6[3569]|9[25-8]))[2-9]\\d{5,6}|58[126]\\d{7}",
"\\d{6,10}", , , "2123456789"], [, , "3(?:0\\d|1[0-6]|2[0-5]|3[0-7]|4[0-8]|55|64)\\d{7}", "\\d{10}", , , "3012345678"], [, , "800\\d{5}", "\\d{8}", , , "80012345"], [, , "900\\d{5}", "\\d{8}", , , "90012345"], [, , "NA", "NA"], [, , "122\\d{6}", "\\d{9}", , , "122044444"], [, , "NA", "NA"], "PK", 92, "00", "0", , , "0", , , , [[, "(\\d{2})(111)(\\d{3})(\\d{3})", "$1 $2 $3 $4", ["(?:2[125]|4[0-246-9]|5[1-35-7]|6[1-8]|7[14]|8[16]|91)1", "(?:2[125]|4[0-246-9]|5[1-35-7]|6[1-8]|7[14]|8[16]|91)11", "(?:2[125]|4[0-246-9]|5[1-35-7]|6[1-8]|7[14]|8[16]|91)111"],
"(0$1)", "", 0], [, "(\\d{3})(111)(\\d{3})(\\d{3})", "$1 $2 $3 $4", ["2[349]|45|54|60|72|8[2-5]|9[2-9]", "(?:2[349]|45|54|60|72|8[2-5]|9[2-9])\\d1", "(?:2[349]|45|54|60|72|8[2-5]|9[2-9])\\d11", "(?:2[349]|45|54|60|72|8[2-5]|9[2-9])\\d111"], "(0$1)", "", 0], [, "(\\d{2})(\\d{7,8})", "$1 $2", ["(?:2[125]|4[0-246-9]|5[1-35-7]|6[1-8]|7[14]|8[16]|91)[2-9]"], "(0$1)", "", 0], [, "(\\d{3})(\\d{6,7})", "$1 $2", ["2[349]|45|54|60|72|8[2-5]|9[2-9]", "(?:2[349]|45|54|60|72|8[2-5]|9[2-9])\\d[2-9]"], "(0$1)",
"", 0], [, "(3\\d{2})(\\d{7})", "$1 $2", ["3"], "0$1", "", 0], [, "([15]\\d{3})(\\d{5,6})", "$1 $2", ["58[12]|1"], "(0$1)", "", 0], [, "(586\\d{2})(\\d{5})", "$1 $2", ["586"], "(0$1)", "", 0], [, "([89]00)(\\d{3})(\\d{2})", "$1 $2 $3", ["[89]00"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "(?:2(?:[125]|3[2358]|4[2-4]|9[2-8])|4(?:[0-246-9]|5[3479])|5(?:[1-35-7]|4[2-467])|6(?:[1-8]|0[468])|7(?:[14]|2[236])|8(?:[16]|2[2-689]|3[23578]|4[3478]|5[2356])|9(?:1|22|3[27-9]|4[2-6]|6[3569]|9[2-7]))111\\d{6}",
"\\d{11,12}", , , "21111825888"], , , [, , "NA", "NA"]], PL:[, [, , "[12]\\d{6,8}|[3-57-9]\\d{8}|6\\d{5,8}", "\\d{6,9}"], [, , "(?:1[2-8]|2[2-69]|3[2-4]|4[1-468]|5[24-689]|6[1-3578]|7[14-7]|8[1-79]|9[145])\\d{7}|[12]2\\d{5}", "\\d{6,9}", , , "123456789"], [, , "(?:5[0137]|6[069]|7[2389]|88)\\d{7}", "\\d{9}", , , "512345678"], [, , "800\\d{6}", "\\d{9}", , , "800123456"], [, , "70\\d{7}", "\\d{9}", , , "701234567"], [, , "801\\d{6}", "\\d{9}", , , "801234567"], [, , "NA", "NA"], [, , "39\\d{7}", "\\d{9}",
, , "391234567"], "PL", 48, "00", , , , , , , , [[, "(\\d{2})(\\d{3})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["[14]|2[0-57-9]|3[2-4]|5[24-689]|6[1-3578]|7[14-7]|8[1-79]|9[145]"], "", "", 0], [, "(\\d{2})(\\d{1})(\\d{4})", "$1 $2 $3", ["[12]2"], "", "", 0], [, "(\\d{3})(\\d{3})(\\d{3})", "$1 $2 $3", ["26|39|5[0137]|6[0469]|7[02389]|8[08]"], "", "", 0], [, "(\\d{3})(\\d{2})(\\d{2,3})", "$1 $2 $3", ["64"], "", "", 0], [, "(\\d{3})(\\d{3})", "$1 $2", ["64"], "", "", 0]], , [, , "64\\d{4,7}", "\\d{6,9}", ,
, "641234567"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], PM:[, [, , "[45]\\d{5}", "\\d{6}"], [, , "41\\d{4}", "\\d{6}", , , "411234"], [, , "55\\d{4}", "\\d{6}", , , "551234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "PM", 508, "00", "0", , , "0", , , , [[, "([45]\\d)(\\d{2})(\\d{2})", "$1 $2 $3", , "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], PR:[, [, , "[5789]\\d{9}", "\\d{7}(?:\\d{3})?"],
[, , "(?:787|939)[2-9]\\d{6}", "\\d{7}(?:\\d{3})?", , , "7872345678"], [, , "(?:787|939)[2-9]\\d{6}", "\\d{7}(?:\\d{3})?", , , "7872345678"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002345678"], [, , "900[2-9]\\d{6}", "\\d{10}", , , "9002345678"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "NA", "NA"], "PR", 1, "011", "1", , , "1", , , 1, , , [, , "NA", "NA"], , "787|939", [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]],
PS:[, [, , "[24589]\\d{7,8}|1(?:[78]\\d{8}|[49]\\d{2,3})", "\\d{4,10}"], [, , "(?:22[234789]|42[45]|82[01458]|92[369])\\d{5}", "\\d{7,8}", , , "22234567"], [, , "5[69]\\d{7}", "\\d{9}", , , "599123456"], [, , "1800\\d{6}", "\\d{10}", , , "1800123456"], [, , "1(?:4|9\\d)\\d{2}", "\\d{4,5}", , , "19123"], [, , "1700\\d{6}", "\\d{10}", , , "1700123456"], [, , "NA", "NA"], [, , "NA", "NA"], "PS", 970, "00", "0", , , "0", , , , [[, "([2489])(2\\d{2})(\\d{4})", "$1 $2 $3", ["[2489]"], "0$1", "", 0], [,
"(5[69]\\d)(\\d{3})(\\d{3})", "$1 $2 $3", ["5"], "0$1", "", 0], [, "(1[78]00)(\\d{3})(\\d{3})", "$1 $2 $3", ["1[78]"], "$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], PT:[, [, , "[2-46-9]\\d{8}", "\\d{9}"], [, , "2(?:[12]\\d|[35][1-689]|4[1-59]|6[1-35689]|7[1-9]|8[1-69]|9[1256])\\d{6}", "\\d{9}", , , "212345678"], [, , "9(?:[1236]\\d{2}|480)\\d{5}", "\\d{9}", , , "912345678"], [, , "80[02]\\d{6}", "\\d{9}", , , "800123456"], [, , "6(?:0[178]|4[68])\\d{6}|76(?:0[1-57]|1[2-47]|2[237])\\d{5}",
"\\d{9}", , , "760123456"], [, , "80(?:8\\d|9[1579])\\d{5}", "\\d{9}", , , "808123456"], [, , "884[0-4689]\\d{5}", "\\d{9}", , , "884123456"], [, , "30\\d{7}", "\\d{9}", , , "301234567"], "PT", 351, "00", , , , , , , , [[, "(2\\d)(\\d{3})(\\d{4})", "$1 $2 $3", ["2[12]"], "", "", 0], [, "([2-46-9]\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["2[3-9]|[346-9]"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "7(?:0(?:7\\d|8[17]))\\d{5}", "\\d{9}", , , "707123456"], , , [, , "600\\d{6}", "\\d{9}",
, , "600110000"]], PW:[, [, , "[2-8]\\d{6}", "\\d{7}"], [, , "2552255|(?:277|345|488|5(?:35|44|87)|6(?:22|54|79)|7(?:33|47)|8(?:24|55|76))\\d{4}", "\\d{7}", , , "2771234"], [, , "(?:6[234689]0|77[45789])\\d{4}", "\\d{7}", , , "6201234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "PW", 680, "01[12]", , , , , , , , [[, "(\\d{3})(\\d{4})", "$1 $2", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], PY:[, [,
, "5[0-5]\\d{4,7}|[2-46-9]\\d{5,8}", "\\d{5,9}"], [, , "(?:[26]1|3[289]|4[124678]|7[123]|8[1236])\\d{5,7}|(?:2(?:2[4568]|7[15]|9[1-5])|3(?:18|3[167]|4[2357]|51)|4(?:18|2[45]|3[12]|5[13]|64|71|9[1-47])|5(?:[1-4]\\d|5[0234])|6(?:3[1-3]|44|7[1-4678])|7(?:17|4[0-4]|6[1-578]|75|8[0-8])|858)\\d{5,6}", "\\d{5,9}", , , "212345678"], [, , "9(?:6[12]|[78][1-6]|9[1-5])\\d{6}", "\\d{9}", , , "961456789"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "8700[0-4]\\d{4}", "\\d{9}",
, , "870012345"], "PY", 595, "00", "0", , , "0", , , , [[, "(\\d{2})(\\d{5,7})", "$1 $2", ["(?:[26]1|3[289]|4[124678]|7[123]|8[1236])"], "($1)", "", 0], [, "(\\d{3})(\\d{3,6})", "$1 $2", ["[2-9]0"], "0$1", "", 0], [, "(\\d{3})(\\d{6})", "$1 $2", ["9[1-9]"], "0$1", "", 0], [, "(\\d{2})(\\d{3})(\\d{4})", "$1 $2 $3", ["8700"], "", "", 0], [, "(\\d{3})(\\d{4,6})", "$1 $2", ["[2-8][1-9]"], "($1)", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "[2-9]0\\d{4,7}", "\\d{6,9}", , , "201234567"], ,
, [, , "NA", "NA"]], QA:[, [, , "[2-8]\\d{6,7}", "\\d{7,8}"], [, , "4[04]\\d{6}", "\\d{7,8}", , , "44123456"], [, , "[3567]\\d{7}", "\\d{7,8}", , , "33123456"], [, , "800\\d{4}", "\\d{7,8}", , , "8001234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "QA", 974, "00", , , , , , , , [[, "([28]\\d{2})(\\d{4})", "$1 $2", ["[28]"], "", "", 0], [, "([3-7]\\d{3})(\\d{4})", "$1 $2", ["[3-7]"], "", "", 0]], , [, , "2(?:[12]\\d|61)\\d{4}", "\\d{7}", , , "2123456"], , , [, , "NA",
"NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], RE:[, [, , "[268]\\d{8}", "\\d{9}"], [, , "262\\d{6}", "\\d{9}", , , "262161234"], [, , "6(?:9[23]|47)\\d{6}", "\\d{9}", , , "692123456"], [, , "80\\d{7}", "\\d{9}", , , "801234567"], [, , "89[1-37-9]\\d{6}", "\\d{9}", , , "891123456"], [, , "8(?:1[019]|2[0156]|84|90)\\d{6}", "\\d{9}", , , "810123456"], [, , "NA", "NA"], [, , "NA", "NA"], "RE", 262, "00", "0", , , "0", , , , [[, "([268]\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", , "0$1", "", 0]],
, [, , "NA", "NA"], 1, "262|6[49]|8", [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], RO:[, [, , "2\\d{5,8}|[37-9]\\d{8}", "\\d{6,9}"], [, , "2(?:1(?:\\d{7}|9\\d{3})|[3-6](?:\\d{7}|\\d9\\d{2}))|3[13-6]\\d{7}", "\\d{6,9}", , , "211234567"], [, , "7(?:[0-8]\\d{2}|99\\d)\\d{5}", "\\d{9}", , , "712345678"], [, , "800\\d{6}", "\\d{9}", , , "800123456"], [, , "90[036]\\d{6}", "\\d{9}", , , "900123456"], [, , "801\\d{6}", "\\d{9}", , , "801123456"], [, , "802\\d{6}", "\\d{9}", , , "802123456"],
[, , "NA", "NA"], "RO", 40, "00", "0", " int ", , "0", , , , [[, "(\\d{2})(\\d{3})(\\d{4})", "$1 $2 $3", ["[23]1"], "0$1", "", 0], [, "(21)(\\d{4})", "$1 $2", ["21"], "0$1", "", 0], [, "(\\d{3})(\\d{3})(\\d{3})", "$1 $2 $3", ["[23][3-7]|[7-9]"], "0$1", "", 0], [, "(2\\d{2})(\\d{3})", "$1 $2", ["2[3-6]"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "37\\d{7}", "\\d{9}", , , "372123456"], , , [, , "NA", "NA"]], RS:[, [, , "[126-9]\\d{4,11}|3(?:[0-79]\\d{3,10}|8[2-9]\\d{2,9})", "\\d{5,12}"],
[, , "(?:1(?:[02-9][2-9]|1[1-9])\\d|2(?:[0-24-7][2-9]\\d|[389](?:0[2-9]|[2-9]\\d))|3(?:[0-8][2-9]\\d|9(?:[2-9]\\d|0[2-9])))\\d{3,8}", "\\d{5,12}", , , "10234567"], [, , "6(?:[0-689]|7\\d)\\d{6,7}", "\\d{8,10}", , , "601234567"], [, , "800\\d{3,9}", "\\d{6,12}", , , "80012345"], [, , "(?:90[0169]|78\\d)\\d{3,7}", "\\d{6,12}", , , "90012345"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "RS", 381, "00", "0", , , "0", , , , [[, "([23]\\d{2})(\\d{4,9})", "$1 $2", ["(?:2[389]|39)0"], "0$1",
"", 0], [, "([1-3]\\d)(\\d{5,10})", "$1 $2", ["1|2(?:[0-24-7]|[389][1-9])|3(?:[0-8]|9[1-9])"], "0$1", "", 0], [, "(6\\d)(\\d{6,8})", "$1 $2", ["6"], "0$1", "", 0], [, "([89]\\d{2})(\\d{3,9})", "$1 $2", ["[89]"], "0$1", "", 0], [, "(7[26])(\\d{4,9})", "$1 $2", ["7[26]"], "0$1", "", 0], [, "(7[08]\\d)(\\d{4,9})", "$1 $2", ["7[08]"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "7[06]\\d{4,10}", "\\d{6,12}", , , "700123456"], , , [, , "NA", "NA"]], RU:[, [, , "[3489]\\d{9}", "\\d{10}"],
[, , "(?:3(?:0[12]|4[1-35-79]|5[1-3]|8[1-58]|9[0145])|4(?:01|1[1356]|2[13467]|7[1-5]|8[1-7]|9[1-689])|8(?:1[1-8]|2[01]|3[13-6]|4[0-8]|5[15]|6[1-35-7]|7[1-37-9]))\\d{7}", "\\d{10}", , , "3011234567"], [, , "9\\d{9}", "\\d{10}", , , "9123456789"], [, , "80[04]\\d{7}", "\\d{10}", , , "8001234567"], [, , "80[39]\\d{7}", "\\d{10}", , , "8091234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "RU", 7, "810", "8", , , "8", , "8~10", , [[, "(\\d{3})(\\d{2})(\\d{2})", "$1-$2-$3", ["[1-79]"], "$1",
"", 1], [, "([3489]\\d{2})(\\d{3})(\\d{2})(\\d{2})", "$1 $2-$3-$4", ["[34689]"], "8 ($1)", "", 1], [, "(7\\d{2})(\\d{3})(\\d{4})", "$1 $2 $3", ["7"], "8 ($1)", "", 1]], [[, "([3489]\\d{2})(\\d{3})(\\d{2})(\\d{2})", "$1 $2-$3-$4", ["[34689]"], "8 ($1)", "", 1], [, "(7\\d{2})(\\d{3})(\\d{4})", "$1 $2 $3", ["7"], "8 ($1)", "", 1]], [, , "NA", "NA"], 1, , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], RW:[, [, , "[027-9]\\d{7,8}", "\\d{8,9}"], [, , "2[258]\\d{7}|06\\d{6}", "\\d{8,9}", , ,
"250123456"], [, , "7[238]\\d{7}", "\\d{9}", , , "720123456"], [, , "800\\d{6}", "\\d{9}", , , "800123456"], [, , "900\\d{6}", "\\d{9}", , , "900123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "RW", 250, "00", "0", , , "0", , , , [[, "(2\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["2"], "$1", "", 0], [, "([7-9]\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["[7-9]"], "0$1", "", 0], [, "(0\\d)(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["0"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [,
, "NA", "NA"], 1, , [, , "NA", "NA"]], SA:[, [, , "1\\d{7,8}|(?:[2-467]|92)\\d{7}|5\\d{8}|8\\d{9}", "\\d{7,10}"], [, , "11\\d{7}|1?(?:2[24-8]|3[35-8]|4[3-68]|6[2-5]|7[235-7])\\d{6}", "\\d{7,9}", , , "112345678"], [, , "(?:5(?:[013-689]\\d|7[0-26-8])|811\\d)\\d{6}", "\\d{9,10}", , , "512345678"], [, , "800\\d{7}", "\\d{10}", , , "8001234567"], [, , "NA", "NA"], [, , "92[05]\\d{6}", "\\d{9}", , , "920012345"], [, , "NA", "NA"], [, , "NA", "NA"], "SA", 966, "00", "0", , , "0", , , , [[, "([1-467])(\\d{3})(\\d{4})",
"$1 $2 $3", ["[1-467]"], "0$1", "", 0], [, "(1\\d)(\\d{3})(\\d{4})", "$1 $2 $3", ["1[1-467]"], "0$1", "", 0], [, "(5\\d)(\\d{3})(\\d{4})", "$1 $2 $3", ["5"], "0$1", "", 0], [, "(92\\d{2})(\\d{5})", "$1 $2", ["92"], "$1", "", 0], [, "(800)(\\d{3})(\\d{4})", "$1 $2 $3", ["80"], "$1", "", 0], [, "(811)(\\d{3})(\\d{3,4})", "$1 $2 $3", ["81"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], SB:[, [, , "[1-9]\\d{4,6}", "\\d{5,7}"], [, , "(?:1[4-79]|[23]\\d|4[0-2]|5[03]|6[0-37])\\d{3}",
"\\d{5}", , , "40123"], [, , "48\\d{3}|7(?:30|[46-8]\\d|5[025-9]|9[0-5])\\d{4}|8[4-8]\\d{5}|9(?:1[2-9]|2[013-9]|3[0-2]|[46]\\d|5[0-46-9]|7[0-689]|8[0-79]|9[0-8])\\d{4}", "\\d{5,7}", , , "7421234"], [, , "1[38]\\d{3}", "\\d{5}", , , "18123"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "5[12]\\d{3}", "\\d{5}", , , "51123"], "SB", 677, "0[01]", , , , , , , , [[, "(\\d{2})(\\d{5})", "$1 $2", ["[7-9]"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA",
"NA"]], SC:[, [, , "[2468]\\d{5,6}", "\\d{6,7}"], [, , "4[2-46]\\d{5}", "\\d{7}", , , "4217123"], [, , "2[5-8]\\d{5}", "\\d{7}", , , "2510123"], [, , "8000\\d{2}", "\\d{6}", , , "800000"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "64\\d{5}", "\\d{7}", , , "6412345"], "SC", 248, "0[0-2]", , , , , , "00", , [[, "(\\d{3})(\\d{3})", "$1 $2", ["8"], "", "", 0], [, "(\\d)(\\d{3})(\\d{3})", "$1 $2 $3", ["[246]"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"],
, , [, , "NA", "NA"]], SD:[, [, , "[19]\\d{8}", "\\d{9}"], [, , "1(?:[125]\\d|8[3567])\\d{6}", "\\d{9}", , , "121231234"], [, , "9[0-3569]\\d{7}", "\\d{9}", , , "911231234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "SD", 249, "00", "0", , , "0", , , , [[, "(\\d{2})(\\d{3})(\\d{4})", "$1 $2 $3", , "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], SE:[, [, , "[1-9]\\d{5,9}", "\\d{5,10}"], [, , "1(?:0[1-8]\\d{6}|[136]\\d{5,7}|(?:2[0-35]|4[0-4]|5[0-25-9]|7[13-6]|[89]\\d)\\d{5,6})|2(?:[136]\\d{5,7}|(?:2[0-7]|4[0136-8]|5[0138]|7[018]|8[01]|9[0-57])\\d{5,6})|3(?:[356]\\d{5,7}|(?:0[0-4]|1\\d|2[0-25]|4[056]|7[0-2]|8[0-3]|9[023])\\d{5,6})|4(?:0[1-9]\\d{4,6}|[246]\\d{5,7}|(?:1[013-8]|3[0135]|5[14-79]|7[0-246-9]|8[0156]|9[0-689])\\d{5,6})|5(?:0[0-6]|[15][0-5]|2[0-68]|3[0-4]|4\\d|6[03-5]|7[013]|8[0-79]|9[01])\\d{5,6}|6(?:0[1-9]\\d{4,6}|3\\d{5,7}|(?:1[1-3]|2[0-4]|4[02-57]|5[0-37]|6[0-3]|7[0-2]|8[0247]|9[0-356])\\d{5,6})|8[1-9]\\d{5,7}|9(?:0[1-9]\\d{4,6}|(?:1[0-68]|2\\d|3[02-5]|4[0-3]|5[0-4]|[68][01]|7[0135-8])\\d{5,6})",
"\\d{5,9}", , , "8123456"], [, , "7[02369]\\d{7}", "\\d{9}", , , "701234567"], [, , "20(?:0(?:0\\d{2}|[1-9](?:0\\d{1,4}|[1-9]\\d{4}))|1(?:0\\d{4}|[1-9]\\d{4,5})|[2-9]\\d{5})", "\\d{6,9}", , , "20123456"], [, , "9(?:00|39|44)(?:1(?:[0-26]\\d{5}|[3-57-9]\\d{2})|2(?:[0-2]\\d{5}|[3-9]\\d{2})|3(?:[0139]\\d{5}|[24-8]\\d{2})|4(?:[045]\\d{5}|[1-36-9]\\d{2})|5(?:5\\d{5}|[0-46-9]\\d{2})|6(?:[679]\\d{5}|[0-58]\\d{2})|7(?:[078]\\d{5}|[1-69]\\d{2})|8(?:[578]\\d{5}|[0-469]\\d{2}))", "\\d{7}(?:\\d{3})?", , , "9001234567"],
[, , "77(?:0(?:0\\d{2}|[1-9](?:0\\d|[1-9]\\d{4}))|[1-6][1-9]\\d{5})", "\\d{6}(?:\\d{3})?", , , "771234567"], [, , "75[1-8]\\d{6}", "\\d{9}", , , "751234567"], [, , "NA", "NA"], "SE", 46, "00", "0", , , "0", , , , [[, "(8)(\\d{2,3})(\\d{2,3})(\\d{2})", "$1-$2 $3 $4", ["8"], "0$1", "", 0], [, "([1-69]\\d)(\\d{2,3})(\\d{2})(\\d{2})", "$1-$2 $3 $4", ["1[013689]|2[0136]|3[1356]|4[0246]|54|6[03]|90"], "0$1", "", 0], [, "([1-69]\\d)(\\d{3})(\\d{2})", "$1-$2 $3", ["1[13689]|2[136]|3[1356]|4[0246]|54|6[03]|90"],
"0$1", "", 0], [, "(\\d{3})(\\d{2})(\\d{2})(\\d{2})", "$1-$2 $3 $4", ["1[2457]|2[2457-9]|3[0247-9]|4[1357-9]|5[0-35-9]|6[124-9]|9(?:[125-8]|3[0-5]|4[0-3])"], "0$1", "", 0], [, "(\\d{3})(\\d{2,3})(\\d{2})", "$1-$2 $3", ["1[2457]|2[2457-9]|3[0247-9]|4[1357-9]|5[0-35-9]|6[124-9]|9(?:[125-8]|3[0-5]|4[0-3])"], "0$1", "", 0], [, "(7\\d)(\\d{3})(\\d{2})(\\d{2})", "$1-$2 $3 $4", ["7"], "0$1", "", 0], [, "(77)(\\d{2})(\\d{2})", "$1-$2$3", ["7"], "0$1", "", 0], [, "(20)(\\d{2,3})(\\d{2})", "$1-$2 $3", ["20"],
"0$1", "", 0], [, "(9[034]\\d)(\\d{2})(\\d{2})(\\d{3})", "$1-$2 $3 $4", ["9[034]"], "0$1", "", 0], [, "(9[034]\\d)(\\d{4})", "$1-$2", ["9[034]"], "0$1", "", 0]], [[, "(8)(\\d{2,3})(\\d{2,3})(\\d{2})", "$1 $2 $3 $4", ["8"]], [, "([1-69]\\d)(\\d{2,3})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["1[013689]|2[0136]|3[1356]|4[0246]|54|6[03]|90"]], [, "([1-69]\\d)(\\d{3})(\\d{2})", "$1 $2 $3", ["1[13689]|2[136]|3[1356]|4[0246]|54|6[03]|90"]], [, "(\\d{3})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["1[2457]|2[2457-9]|3[0247-9]|4[1357-9]|5[0-35-9]|6[124-9]|9(?:[125-8]|3[0-5]|4[0-3])"]],
[, "(\\d{3})(\\d{2,3})(\\d{2})", "$1 $2 $3", ["1[2457]|2[2457-9]|3[0247-9]|4[1357-9]|5[0-35-9]|6[124-9]|9(?:[125-8]|3[0-5]|4[0-3])"]], [, "(7\\d)(\\d{3})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["7"]], [, "(77)(\\d{2})(\\d{2})", "$1 $2 $3", ["7"]], [, "(20)(\\d{2,3})(\\d{2})", "$1 $2 $3", ["20"]], [, "(9[034]\\d)(\\d{2})(\\d{2})(\\d{3})", "$1 $2 $3 $4", ["9[034]"]], [, "(9[034]\\d)(\\d{4})", "$1 $2", ["9[034]"]]], [, , "74[02-9]\\d{6}", "\\d{9}", , , "740123456"], , , [, , "NA", "NA"], [, , "NA", "NA"],
, , [, , "NA", "NA"]], SG:[, [, , "[36]\\d{7}|[17-9]\\d{7,10}", "\\d{8,11}"], [, , "6[1-9]\\d{6}", "\\d{8}", , , "61234567"], [, , "(?:8[1-8]|9[0-8])\\d{6}", "\\d{8}", , , "81234567"], [, , "1?800\\d{7}", "\\d{10,11}", , , "18001234567"], [, , "1900\\d{7}", "\\d{11}", , , "19001234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "3[12]\\d{6}", "\\d{8}", , , "31234567"], "SG", 65, "0[0-3]\\d", , , , , , , , [[, "([3689]\\d{3})(\\d{4})", "$1 $2", ["[369]|8[1-9]"], "", "", 0], [, "(1[89]00)(\\d{3})(\\d{4})",
"$1 $2 $3", ["1[89]"], "", "", 0], [, "(7000)(\\d{4})(\\d{3})", "$1 $2 $3", ["70"], "", "", 0], [, "(800)(\\d{3})(\\d{4})", "$1 $2 $3", ["80"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "7000\\d{7}", "\\d{11}", , , "70001234567"], , , [, , "NA", "NA"]], SH:[, [, , "[256]\\d{4}", "\\d{4,5}"], [, , "2(?:[0-57-9]\\d|6[4-9])\\d{2}", "\\d{5}", , , "22158"], [, , "[56]\\d{4}", "\\d{5}"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "262\\d{2}", "\\d{5}"],
"SH", 290, "00", , , , , , , , , , [, , "NA", "NA"], 1, , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], SI:[, [, , "[1-7]\\d{6,7}|[89]\\d{4,7}", "\\d{5,8}"], [, , "(?:1\\d|[25][2-8]|3[4-8]|4[24-8]|7[3-8])\\d{6}", "\\d{7,8}", , , "11234567"], [, , "(?:[37][01]|4[0139]|51|6[48])\\d{6}", "\\d{8}", , , "31234567"], [, , "80\\d{4,6}", "\\d{6,8}", , , "80123456"], [, , "90\\d{4,6}|89[1-3]\\d{2,5}", "\\d{5,8}", , , "90123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "(?:59|8[1-3])\\d{6}",
"\\d{8}", , , "59012345"], "SI", 386, "00", "0", , , "0", , , , [[, "(\\d)(\\d{3})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["[12]|3[4-8]|4[24-8]|5[2-8]|7[3-8]"], "(0$1)", "", 0], [, "([3-7]\\d)(\\d{3})(\\d{3})", "$1 $2 $3", ["[37][01]|4[0139]|51|6"], "0$1", "", 0], [, "([89][09])(\\d{3,6})", "$1 $2", ["[89][09]"], "0$1", "", 0], [, "([58]\\d{2})(\\d{5})", "$1 $2", ["59|8[1-3]"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], SJ:[, [, , "0\\d{4}|[4789]\\d{7}",
"\\d{5}(?:\\d{3})?"], [, , "79\\d{6}", "\\d{8}", , , "79123456"], [, , "(?:4[015-8]|5[89]|9\\d)\\d{6}", "\\d{8}", , , "41234567"], [, , "80[01]\\d{5}", "\\d{8}", , , "80012345"], [, , "82[09]\\d{5}", "\\d{8}", , , "82012345"], [, , "810(?:0[0-6]|[2-8]\\d)\\d{3}", "\\d{8}", , , "81021234"], [, , "880\\d{5}", "\\d{8}", , , "88012345"], [, , "85[0-5]\\d{5}", "\\d{8}", , , "85012345"], "SJ", 47, "00", , , , , , , , , , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "0\\d{4}|81(?:0(?:0[7-9]|1\\d)|5\\d{2})\\d{3}",
"\\d{5}(?:\\d{3})?", , , "01234"], 1, , [, , "81[23]\\d{5}", "\\d{8}", , , "81212345"]], SK:[, [, , "[2-689]\\d{8}", "\\d{9}"], [, , "[2-5]\\d{8}", "\\d{9}", , , "212345678"], [, , "9(?:0[1-8]|1[0-24-9]|4[0489])\\d{6}", "\\d{9}", , , "912123456"], [, , "800\\d{6}", "\\d{9}", , , "800123456"], [, , "9(?:[78]\\d{7}|00\\d{6})", "\\d{9}", , , "900123456"], [, , "8[5-9]\\d{7}", "\\d{9}", , , "850123456"], [, , "NA", "NA"], [, , "6(?:5[0-4]|9[0-6])\\d{6}", "\\d{9}", , , "690123456"], "SK", 421, "00", "0",
, , "0", , , , [[, "(2)(\\d{3})(\\d{3})(\\d{2})", "$1/$2 $3 $4", ["2"], "0$1", "", 0], [, "([3-5]\\d)(\\d{3})(\\d{2})(\\d{2})", "$1/$2 $3 $4", ["[3-5]"], "0$1", "", 0], [, "([689]\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["[689]"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "(?:8(?:00|[5-9]\\d)|9(?:00|[78]\\d))\\d{6}", "\\d{9}", , , "800123456"], [, , "96\\d{7}", "\\d{9}", , , "961234567"], , , [, , "NA", "NA"]], SL:[, [, , "[2-9]\\d{7}", "\\d{6,8}"], [, , "[235]2[2-4][2-9]\\d{4}", "\\d{6,8}", , ,
"22221234"], [, , "(?:2[15]|3[03-5]|4[04]|5[05]|66|7[6-9]|88|99)\\d{6}", "\\d{6,8}", , , "25123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "SL", 232, "00", "0", , , "0", , , , [[, "(\\d{2})(\\d{6})", "$1 $2", , "(0$1)", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], SM:[, [, , "[05-7]\\d{7,9}", "\\d{6,10}"], [, , "0549(?:8[0157-9]|9\\d)\\d{4}", "\\d{6,10}", , , "0549886377"], [, , "6[16]\\d{6}", "\\d{8}",
, , "66661212"], [, , "NA", "NA"], [, , "7[178]\\d{6}", "\\d{8}", , , "71123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "5[158]\\d{6}", "\\d{8}", , , "58001110"], "SM", 378, "00", , , , "(?:0549)?([89]\\d{5})", "0549$1", , , [[, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["[5-7]"], "", "", 0], [, "(0549)(\\d{6})", "$1 $2", ["0"], "", "", 0], [, "(\\d{6})", "0549 $1", ["[89]"], "", "", 0]], [[, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["[5-7]"], "", "", 0], [, "(0549)(\\d{6})",
"($1) $2", ["0"]], [, "(\\d{6})", "(0549) $1", ["[89]"]]], [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], 1, , [, , "NA", "NA"]], SN:[, [, , "[3789]\\d{8}", "\\d{9}"], [, , "3(?:0(?:1[0-2]|80)|282|3(?:8[1-9]|9[3-9])|611|90[1-5])\\d{5}", "\\d{9}", , , "301012345"], [, , "7(?:[067]\\d|21|8[0-26]|90)\\d{6}", "\\d{9}", , , "701234567"], [, , "800\\d{6}", "\\d{9}", , , "800123456"], [, , "88[4689]\\d{6}", "\\d{9}", , , "884123456"], [, , "81[02468]\\d{6}", "\\d{9}", , , "810123456"], [, , "NA",
"NA"], [, , "3392\\d{5}|93330\\d{4}", "\\d{9}", , , "933301234"], "SN", 221, "00", , , , , , , , [[, "(\\d{2})(\\d{3})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["[379]"], "", "", 0], [, "(\\d{3})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["8"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], SO:[, [, , "[1-79]\\d{6,8}", "\\d{7,9}"], [, , "(?:1\\d|2[0-79]|3[0-46-8]|4[0-7]|59)\\d{5}", "\\d{7}", , , "4012345"], [, , "(?:15\\d|2(?:4\\d|8)|6[1-35-9]?\\d{2}|7(?:[1-8]\\d|99?\\d)|907\\d)\\d{5}",
"\\d{7,9}", , , "71123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "SO", 252, "00", "0", , , "0", , , , [[, "(\\d)(\\d{6})", "$1 $2", ["2[0-79]|[13-5]"], "", "", 0], [, "(\\d)(\\d{7})", "$1 $2", ["24|[67]"], "", "", 0], [, "(\\d{2})(\\d{5,7})", "$1 $2", ["15|28|6[1-35-9]|799"], "", "", 0], [, "(90\\d)(\\d{3})(\\d{3})", "$1 $2 $3", ["90"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], SR:[, [, , "[2-8]\\d{5,6}",
"\\d{6,7}"], [, , "(?:2[1-3]|3[0-7]|4\\d|5[2-58]|68\\d)\\d{4}", "\\d{6,7}", , , "211234"], [, , "(?:7[124-7]|8[1-9])\\d{5}", "\\d{7}", , , "7412345"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "5(?:6\\d{4}|90[0-4]\\d{3})", "\\d{6,7}", , , "561234"], "SR", 597, "00", , , , , , , , [[, "(\\d{3})(\\d{3})", "$1-$2", ["[2-4]|5[2-58]"], "", "", 0], [, "(\\d{2})(\\d{2})(\\d{2})", "$1-$2-$3", ["56"], "", "", 0], [, "(\\d{3})(\\d{4})", "$1-$2", ["59|[6-8]"], "", "", 0]],
, [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], SS:[, [, , "[19]\\d{8}", "\\d{9}"], [, , "18\\d{7}", "\\d{9}", , , "181234567"], [, , "(?:12|9[1257])\\d{7}", "\\d{9}", , , "977123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "SS", 211, "00", "0", , , "0", , , , [[, "(\\d{3})(\\d{3})(\\d{3})", "$1 $2 $3", , "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], ST:[, [,
, "[29]\\d{6}", "\\d{7}"], [, , "22\\d{5}", "\\d{7}", , , "2221234"], [, , "9(?:0(?:0[5-9]|[1-9]\\d)|[89]\\d{2})\\d{3}", "\\d{7}", , , "9812345"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "ST", 239, "00", , , , , , , , [[, "(\\d{3})(\\d{4})", "$1 $2", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], SV:[, [, , "[267]\\d{7}|[89]\\d{6}(?:\\d{4})?", "\\d{7,8}|\\d{11}"], [, , "2[1-6]\\d{6}", "\\d{8}", ,
, "21234567"], [, , "[67]\\d{7}", "\\d{8}", , , "70123456"], [, , "800\\d{4}(?:\\d{4})?", "\\d{7}(?:\\d{4})?", , , "8001234"], [, , "900\\d{4}(?:\\d{4})?", "\\d{7}(?:\\d{4})?", , , "9001234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "SV", 503, "00", , , , , , , , [[, "(\\d{4})(\\d{4})", "$1 $2", ["[267]"], "", "", 0], [, "(\\d{3})(\\d{4})", "$1 $2", ["[89]"], "", "", 0], [, "(\\d{3})(\\d{4})(\\d{4})", "$1 $2 $3", ["[89]"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, ,
"NA", "NA"], , , [, , "NA", "NA"]], SX:[, [, , "[5789]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "7215(?:4[2-8]|8[239]|9[056])\\d{4}", "\\d{7}(?:\\d{3})?", , , "7215425678"], [, , "7215(?:1[02]|2\\d|5[034679]|8[014-8])\\d{4}", "\\d{10}", , , "7215205678"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002123456"], [, , "900[2-9]\\d{6}", "\\d{10}", , , "9002123456"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "NA", "NA"], "SX", 1, "011", "1",
, , "1", , , , , , [, , "NA", "NA"], , "721", [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], SY:[, [, , "[1-59]\\d{7,8}", "\\d{6,9}"], [, , "(?:1(?:1\\d?|4\\d|[2356])|2(?:1\\d?|[235])|3(?:[13]\\d|4)|4[13]|5[1-3])\\d{6}", "\\d{6,9}", , , "112345678"], [, , "9(?:22|[35][0-8]|4\\d|6[024-9]|88|9[0-489])\\d{6}", "\\d{9}", , , "944567890"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "SY", 963, "00", "0", , , "0", , , , [[, "(\\d{2})(\\d{3})(\\d{3,4})",
"$1 $2 $3", ["[1-5]"], "0$1", "", 1], [, "(9\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["9"], "0$1", "", 1]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], SZ:[, [, , "[027]\\d{7}", "\\d{8}"], [, , "2[2-5]\\d{6}", "\\d{8}", , , "22171234"], [, , "7[6-8]\\d{6}", "\\d{8}", , , "76123456"], [, , "0800\\d{4}", "\\d{8}", , , "08001234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "SZ", 268, "00", , , , , , , , [[, "(\\d{4})(\\d{4})", "$1 $2",
["[027]"], "", "", 0]], , [, , "NA", "NA"], , , [, , "0800\\d{4}", "\\d{8}", , , "08001234"], [, , "NA", "NA"], 1, , [, , "NA", "NA"]], TA:[, [, , "8\\d{3}", "\\d{4}"], [, , "8\\d{3}", "\\d{4}", , , "8999"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "TA", 290, "00", , , , , , , , , , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], TC:[, [, , "[5689]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "649(?:712|9(?:4\\d|50))\\d{4}",
"\\d{7}(?:\\d{3})?", , , "6497121234"], [, , "649(?:2(?:3[129]|4[1-7])|3(?:3[1-389]|4[1-7])|4[34][1-3])\\d{4}", "\\d{10}", , , "6492311234"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002345678"], [, , "900[2-9]\\d{6}", "\\d{10}", , , "9002345678"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "64971[01]\\d{4}", "\\d{10}", , , "6497101234"], "TC", 1, "011", "1", , , "1", , , , , , [, , "NA", "NA"], , "649", [, , "NA", "NA"], [, , "NA",
"NA"], , , [, , "NA", "NA"]], TD:[, [, , "[2679]\\d{7}", "\\d{8}"], [, , "22(?:[3789]0|5[0-5]|6[89])\\d{4}", "\\d{8}", , , "22501234"], [, , "(?:6[02368]\\d|77\\d|9\\d{2})\\d{5}", "\\d{8}", , , "63012345"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "TD", 235, "00|16", , , , , , "00", , [[, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], TG:[, [, , "[29]\\d{7}",
"\\d{8}"], [, , "2(?:2[2-7]|3[23]|44|55|66|77)\\d{5}", "\\d{8}", , , "22212345"], [, , "9[0-389]\\d{6}", "\\d{8}", , , "90112345"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "TG", 228, "00", , , , , , , , [[, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3 $4", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], TH:[, [, , "[2-9]\\d{7,8}|1\\d{3}(?:\\d{5,6})?", "\\d{4}|\\d{8,10}"], [, , "(?:2\\d|3[2-9]|4[2-5]|5[2-6]|7[3-7])\\d{6}",
"\\d{8}", , , "21234567"], [, , "(?:14|6[1-3]|[89]\\d)\\d{7}", "\\d{9}", , , "812345678"], [, , "1800\\d{6}", "\\d{10}", , , "1800123456"], [, , "1900\\d{6}", "\\d{10}", , , "1900123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "6[08]\\d{7}", "\\d{9}", , , "601234567"], "TH", 66, "00", "0", , , "0", , , , [[, "(2)(\\d{3})(\\d{4})", "$1 $2 $3", ["2"], "0$1", "", 0], [, "([13-9]\\d)(\\d{3})(\\d{3,4})", "$1 $2 $3", ["14|[3-9]"], "0$1", "", 0], [, "(1[89]00)(\\d{3})(\\d{3})", "$1 $2 $3", ["1"], "$1",
"", 0]], , [, , "NA", "NA"], , , [, , "1\\d{3}", "\\d{4}", , , "1100"], [, , "1\\d{3}", "\\d{4}", , , "1100"], , , [, , "NA", "NA"]], TJ:[, [, , "[3-59]\\d{8}", "\\d{3,9}"], [, , "(?:3(?:1[3-5]|2[245]|3[12]|4[24-7]|5[25]|72)|4(?:46|74|87))\\d{6}", "\\d{3,9}", , , "372123456"], [, , "(?:50[125]|9[0-35-9]\\d)\\d{6}", "\\d{9}", , , "917123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "TJ", 992, "810", "8", , , "8", , "8~10", , [[, "([349]\\d{2})(\\d{2})(\\d{4})",
"$1 $2 $3", ["[34]7|91[78]"], "(8) $1", "", 1], [, "([459]\\d)(\\d{3})(\\d{4})", "$1 $2 $3", ["4[48]|5|9(?:1[59]|[0235-9])"], "(8) $1", "", 1], [, "(331700)(\\d)(\\d{2})", "$1 $2 $3", ["331", "3317", "33170", "331700"], "(8) $1", "", 1], [, "(\\d{4})(\\d)(\\d{4})", "$1 $2 $3", ["3[1-5]", "3(?:[1245]|3(?:[02-9]|1[0-589]))"], "(8) $1", "", 1]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], TK:[, [, , "[2-9]\\d{3}", "\\d{4}"], [, , "[2-4]\\d{3}", "\\d{4}", , , "3010"],
[, , "[5-9]\\d{3}", "\\d{4}", , , "5190"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "TK", 690, "00", , , , , , , , , , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], TL:[, [, , "[2-489]\\d{6}|7\\d{6,7}", "\\d{7,8}"], [, , "(?:2[1-5]|3[1-9]|4[1-4])\\d{5}", "\\d{7}", , , "2112345"], [, , "7[3-8]\\d{6}", "\\d{8}", , , "77212345"], [, , "80\\d{5}", "\\d{7}", , , "8012345"], [, , "90\\d{5}", "\\d{7}", , , "9012345"], [,
, "NA", "NA"], [, , "70\\d{5}", "\\d{7}", , , "7012345"], [, , "NA", "NA"], "TL", 670, "00", , , , , , , , [[, "(\\d{3})(\\d{4})", "$1 $2", ["[2-489]"], "", "", 0], [, "(\\d{4})(\\d{4})", "$1 $2", ["7"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], TM:[, [, , "[1-6]\\d{7}", "\\d{8}"], [, , "(?:1(?:2\\d|3[1-9])|2(?:22|4[0-35-8])|3(?:22|4[03-9])|4(?:22|3[128]|4\\d|6[15])|5(?:22|5[7-9]|6[014-689]))\\d{5}", "\\d{8}", , , "12345678"], [, , "6[2-9]\\d{6}",
"\\d{8}", , , "66123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "TM", 993, "810", "8", , , "8", , "8~10", , [[, "(\\d{2})(\\d{2})(\\d{2})(\\d{2})", "$1 $2-$3-$4", ["12"], "(8 $1)", "", 0], [, "(\\d{2})(\\d{6})", "$1 $2", ["6"], "8 $1", "", 0], [, "(\\d{3})(\\d)(\\d{2})(\\d{2})", "$1 $2-$3-$4", ["13|[2-5]"], "(8 $1)", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], TN:[, [, , "[2-57-9]\\d{7}", "\\d{8}"],
[, , "3[012]\\d{6}|7\\d{7}|81200\\d{3}", "\\d{8}", , , "71234567"], [, , "(?:[259]\\d|4[0-24])\\d{6}", "\\d{8}", , , "20123456"], [, , "8010\\d{4}", "\\d{8}", , , "80101234"], [, , "88\\d{6}", "\\d{8}", , , "88123456"], [, , "8[12]10\\d{4}", "\\d{8}", , , "81101234"], [, , "NA", "NA"], [, , "NA", "NA"], "TN", 216, "00", , , , , , , , [[, "(\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], TO:[, [, , "[02-8]\\d{4,6}",
"\\d{5,7}"], [, , "(?:2\\d|3[1-8]|4[1-4]|[56]0|7[0149]|8[05])\\d{3}", "\\d{5}", , , "20123"], [, , "(?:7[578]|8[47-9])\\d{5}", "\\d{7}", , , "7715123"], [, , "0800\\d{3}", "\\d{7}", , , "0800222"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "TO", 676, "00", , , , , , , , [[, "(\\d{2})(\\d{3})", "$1-$2", ["[1-6]|7[0-4]|8[05]"], "", "", 0], [, "(\\d{3})(\\d{4})", "$1 $2", ["7[5-9]|8[47-9]"], "", "", 0], [, "(\\d{4})(\\d{3})", "$1 $2", ["0"], "", "", 0]], , [, , "NA", "NA"],
, , [, , "NA", "NA"], [, , "NA", "NA"], 1, , [, , "NA", "NA"]], TR:[, [, , "[2-589]\\d{9}|444\\d{4}", "\\d{7,10}"], [, , "(?:2(?:[13][26]|[28][2468]|[45][268]|[67][246])|3(?:[13][28]|[24-6][2468]|[78][02468]|92)|4(?:[16][246]|[23578][2468]|4[26]))\\d{7}", "\\d{10}", , , "2123456789"], [, , "5(?:0[1-7]|22|[34]\\d|5[1-59]|9[246])\\d{7}", "\\d{10}", , , "5012345678"], [, , "800\\d{7}", "\\d{10}", , , "8001234567"], [, , "900\\d{7}", "\\d{10}", , , "9001234567"], [, , "NA", "NA"], [, , "NA", "NA"], [,
, "NA", "NA"], "TR", 90, "00", "0", , , "0", , , , [[, "(\\d{3})(\\d{3})(\\d{4})", "$1 $2 $3", ["[23]|4(?:[0-35-9]|4[0-35-9])"], "(0$1)", "", 1], [, "(\\d{3})(\\d{3})(\\d{4})", "$1 $2 $3", ["[589]"], "0$1", "", 1], [, "(444)(\\d{1})(\\d{3})", "$1 $2 $3", ["444"], "", "", 0]], , [, , "512\\d{7}", "\\d{10}", , , "5123456789"], , , [, , "444\\d{4}", "\\d{7}", , , "4441444"], [, , "444\\d{4}|850\\d{7}", "\\d{7,10}", , , "4441444"], , , [, , "NA", "NA"]], TT:[, [, , "[589]\\d{9}", "\\d{7}(?:\\d{3})?"],
[, , "868(?:2(?:01|2[1-5]|3[1-5])|6(?:0[79]|1[02-8]|2[1-9]|[3-69]\\d|7[0-79])|82[124])\\d{4}", "\\d{7}(?:\\d{3})?", , , "8682211234"], [, , "868(?:2(?:[789]\\d)|3(?:0[1-9]|1[02-9]|[2-9]\\d)|4[6-9]\\d|6(?:20|78|8\\d)|7(?:0[1-9]|1[02-9]|[2-9]\\d))\\d{4}", "\\d{10}", , , "8682911234"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002345678"], [, , "900[2-9]\\d{6}", "\\d{10}", , , "9002345678"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, ,
"NA", "NA"], "TT", 1, "011", "1", , , "1", , , , , , [, , "NA", "NA"], , "868", [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "868619\\d{4}", "\\d{10}"]], TV:[, [, , "[29]\\d{4,5}", "\\d{5,6}"], [, , "2[02-9]\\d{3}", "\\d{5}", , , "20123"], [, , "90\\d{4}", "\\d{6}", , , "901234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "TV", 688, "00", , , , , , , , , , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], TW:[, [, , "[2-689]\\d{7,8}|7\\d{7,9}",
"\\d{8,10}"], [, , "[2-8]\\d{7,8}", "\\d{8,9}", , , "21234567"], [, , "9\\d{8}", "\\d{9}", , , "912345678"], [, , "800\\d{6}", "\\d{9}", , , "800123456"], [, , "900\\d{6}", "\\d{9}", , , "900123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "70\\d{8}", "\\d{10}", , , "7012345678"], "TW", 886, "0(?:0[25679]|19)", "0", "#", , "0", , , , [[, "([2-8])(\\d{3,4})(\\d{4})", "$1 $2 $3", ["[2-6]|[78][1-9]"], "0$1", "", 0], [, "([89]\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["80|9"], "0$1", "", 0], [, "(70)(\\d{4})(\\d{4})",
"$1 $2 $3", ["70"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], TZ:[, [, , "\\d{9}", "\\d{7,9}"], [, , "2[2-8]\\d{7}", "\\d{7,9}", , , "222345678"], [, , "(?:6[25-8]|7[13-9])\\d{7}", "\\d{9}", , , "621234567"], [, , "80[08]\\d{6}", "\\d{9}", , , "800123456"], [, , "90\\d{7}", "\\d{9}", , , "900123456"], [, , "8(?:40|6[01])\\d{6}", "\\d{9}", , , "840123456"], [, , "NA", "NA"], [, , "41\\d{7}", "\\d{9}", , , "412345678"], "TZ", 255, "00[056]",
"0", , , "0", , , , [[, "([24]\\d)(\\d{3})(\\d{4})", "$1 $2 $3", ["[24]"], "0$1", "", 0], [, "([67]\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["[67]"], "0$1", "", 0], [, "([89]\\d{2})(\\d{2})(\\d{4})", "$1 $2 $3", ["[89]"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], UA:[, [, , "[3-9]\\d{8}", "\\d{5,9}"], [, , "(?:3[1-8]|4[13-8]|5[1-7]|6[12459])\\d{7}", "\\d{5,9}", , , "311234567"], [, , "(?:39|50|6[36-8]|73|9[1-9])\\d{7}", "\\d{9}", , , "391234567"],
[, , "800\\d{6}", "\\d{9}", , , "800123456"], [, , "900\\d{6}", "\\d{9}", , , "900123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "89\\d{7}", "\\d{9}", , , "891234567"], "UA", 380, "00", "0", , , "0", , "0~0", , [[, "([3-9]\\d)(\\d{3})(\\d{4})", "$1 $2 $3", ["[38]9|4(?:[45][0-5]|87)|5(?:0|6[37]|7[37])|6[36-8]|73|9[1-9]", "[38]9|4(?:[45][0-5]|87)|5(?:0|6(?:3[14-7]|7)|7[37])|6[36-8]|73|9[1-9]"], "0$1", "", 0], [, "([3-689]\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["3[1-8]2|4[13678]2|5(?:[12457]2|6[24])|6(?:[49]2|[12][29]|5[24])|8[0-8]|90",
"3(?:[1-46-8]2[013-9]|52)|4(?:[1378]2|62[013-9])|5(?:[12457]2|6[24])|6(?:[49]2|[12][29]|5[24])|8[0-8]|90"], "0$1", "", 0], [, "([3-6]\\d{3})(\\d{5})", "$1 $2", ["3(?:5[013-9]|[1-46-8])|4(?:[137][013-9]|6|[45][6-9]|8[4-6])|5(?:[1245][013-9]|6[0135-9]|3|7[4-6])|6(?:[49][013-9]|5[0135-9]|[12][13-8])", "3(?:5[013-9]|[1-46-8](?:22|[013-9]))|4(?:[137][013-9]|6(?:[013-9]|22)|[45][6-9]|8[4-6])|5(?:[1245][013-9]|6(?:3[02389]|[015689])|3|7[4-6])|6(?:[49][013-9]|5[0135-9]|[12][13-8])"], "0$1", "", 0]], , [,
, "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], UG:[, [, , "\\d{9}", "\\d{5,9}"], [, , "20(?:[0147]\\d{2}|2(?:40|[5-9]\\d)|3[23]\\d|5[0-4]\\d|6[03]\\d|8[0-2]\\d)\\d{4}|[34]\\d{8}", "\\d{5,9}", , , "312345678"], [, , "2030\\d{5}|7(?:0[0-7]|[15789]\\d|2[03]|30|[46][0-4])\\d{6}", "\\d{9}", , , "712345678"], [, , "800[123]\\d{5}", "\\d{9}", , , "800123456"], [, , "90[123]\\d{6}", "\\d{9}", , , "901123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "UG", 256,
"00[057]", "0", , , "0", , , , [[, "(\\d{3})(\\d{6})", "$1 $2", ["[7-9]|20(?:[013-8]|2[5-9])|4(?:6[45]|[7-9])"], "0$1", "", 0], [, "(\\d{2})(\\d{7})", "$1 $2", ["3|4(?:[1-5]|6[0-36-9])"], "0$1", "", 0], [, "(2024)(\\d{5})", "$1 $2", ["2024"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], US:[, [, , "[2-9]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "(?:2(?:0[1-35-9]|1[02-9]|2[04589]|3[149]|4[08]|5[1-46]|6[0279]|7[026]|8[13])|3(?:0[1-57-9]|1[02-9]|2[0135]|3[014679]|4[67]|5[12]|6[014]|8[56])|4(?:0[124-9]|1[02-579]|2[3-5]|3[0245]|4[0235]|58|69|7[0589]|8[04])|5(?:0[1-57-9]|1[0235-8]|20|3[0149]|4[01]|5[19]|6[1-37]|7[013-5]|8[056])|6(?:0[1-35-9]|1[024-9]|2[03689]|3[016]|4[16]|5[017]|6[0-279]|78|8[12])|7(?:0[1-46-8]|1[02-9]|2[0457]|3[1247]|4[07]|5[47]|6[02359]|7[02-59]|8[156])|8(?:0[1-68]|1[02-8]|28|3[0-25]|4[3578]|5[046-9]|6[02-5]|7[028])|9(?:0[1346-9]|1[02-9]|2[0589]|3[01678]|4[0179]|5[12469]|7[0-3589]|8[0459]))[2-9]\\d{6}",
"\\d{7}(?:\\d{3})?", , , "2015555555"], [, , "(?:2(?:0[1-35-9]|1[02-9]|2[04589]|3[149]|4[08]|5[1-46]|6[0279]|7[026]|8[13])|3(?:0[1-57-9]|1[02-9]|2[0135]|3[014679]|4[67]|5[12]|6[014]|8[56])|4(?:0[124-9]|1[02-579]|2[3-5]|3[0245]|4[0235]|58|69|7[0589]|8[04])|5(?:0[1-57-9]|1[0235-8]|20|3[0149]|4[01]|5[19]|6[1-37]|7[013-5]|8[056])|6(?:0[1-35-9]|1[024-9]|2[03689]|3[016]|4[16]|5[017]|6[0-279]|78|8[12])|7(?:0[1-46-8]|1[02-9]|2[0457]|3[1247]|4[07]|5[47]|6[02359]|7[02-59]|8[156])|8(?:0[1-68]|1[02-8]|28|3[0-25]|4[3578]|5[046-9]|6[02-5]|7[028])|9(?:0[1346-9]|1[02-9]|2[0589]|3[01678]|4[0179]|5[12469]|7[0-3589]|8[0459]))[2-9]\\d{6}",
"\\d{7}(?:\\d{3})?", , , "2015555555"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002345678"], [, , "900[2-9]\\d{6}", "\\d{10}", , , "9002345678"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "NA", "NA"], "US", 1, "011", "1", , , "1", , , 1, [[, "(\\d{3})(\\d{4})", "$1-$2", , "", "", 1], [, "(\\d{3})(\\d{3})(\\d{4})", "($1) $2-$3", , "", "", 1]], [[, "(\\d{3})(\\d{3})(\\d{4})", "$1-$2-$3"]], [, , "NA", "NA"], 1, , [, , "NA", "NA"],
[, , "NA", "NA"], , , [, , "NA", "NA"]], UY:[, [, , "[2489]\\d{6,7}", "\\d{7,8}"], [, , "2\\d{7}|4[2-7]\\d{6}", "\\d{7,8}", , , "21231234"], [, , "9[1-9]\\d{6}", "\\d{8}", , , "94231234"], [, , "80[05]\\d{4}", "\\d{7}", , , "8001234"], [, , "90[0-8]\\d{4}", "\\d{7}", , , "9001234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "UY", 598, "0(?:1[3-9]\\d|0)", "0", " int. ", , "0", , "00", , [[, "(\\d{4})(\\d{4})", "$1 $2", ["[24]"], "", "", 0], [, "(\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["9[1-9]"],
"0$1", "", 0], [, "(\\d{3})(\\d{4})", "$1 $2", ["[89]0"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], UZ:[, [, , "[679]\\d{8}", "\\d{7,9}"], [, , "(?:6(?:1(?:22|3[124]|4[1-4]|5[123578]|64)|2(?:22|3[0-57-9]|41)|5(?:22|3[3-7]|5[024-8])|6\\d{2}|7(?:[23]\\d|7[69])|9(?:22|4[1-8]|6[135]))|7(?:0(?:5[4-9]|6[0146]|7[12456]|9[135-8])|1[12]\\d|2(?:22|3[1345789]|4[123579]|5[14])|3(?:2\\d|3[1578]|4[1-35-7]|5[1-57]|61)|4(?:2\\d|3[1-579]|7[1-79])|5(?:22|5[1-9]|6[1457])|6(?:22|3[12457]|4[13-8])|9(?:22|5[1-9])))\\d{5}",
"\\d{7,9}", , , "662345678"], [, , "6(?:1(?:2(?:98|2[01])|35[0-4]|50\\d|61[23]|7(?:[01][017]|4\\d|55|9[5-9]))|2(?:11\\d|2(?:[12]1|9[01379])|5(?:[126]\\d|3[0-4])|7\\d{2})|5(?:19[01]|2(?:27|9[26])|30\\d|59\\d|7\\d{2})|6(?:2(?:1[5-9]|2[0367]|38|41|52|60)|3[79]\\d|4(?:56|83)|7(?:[07]\\d|1[017]|3[07]|4[047]|5[057]|67|8[0178]|9[79])|9[0-3]\\d)|7(?:2(?:24|3[237]|4[5-9]|7[15-8])|5(?:7[12]|8[0589])|7(?:0\\d|[39][07])|9(?:0\\d|7[079]))|9(?:2(?:1[1267]|5\\d|3[01]|7[0-4])|5[67]\\d|6(?:2[0-26]|8\\d)|7\\d{2}))\\d{4}|7(?:0\\d{3}|1(?:13[01]|6(?:0[47]|1[67]|66)|71[3-69]|98\\d)|2(?:2(?:2[79]|95)|3(?:2[5-9]|6[0-6])|57\\d|7(?:0\\d|1[17]|2[27]|3[37]|44|5[057]|66|88))|3(?:2(?:1[0-6]|21|3[469]|7[159])|33\\d|5(?:0[0-4]|5[579]|9\\d)|7(?:[0-3579]\\d|4[0467]|6[67]|8[078])|9[4-6]\\d)|4(?:2(?:29|5[0257]|6[0-7]|7[1-57])|5(?:1[0-4]|8\\d|9[5-9])|7(?:0\\d|1[024589]|2[0127]|3[0137]|[46][07]|5[01]|7[5-9]|9[079])|9(?:7[015-9]|[89]\\d))|5(?:112|2(?:0\\d|2[29]|[49]4)|3[1568]\\d|52[6-9]|7(?:0[01578]|1[017]|[23]7|4[047]|[5-7]\\d|8[78]|9[079]))|6(?:2(?:2[1245]|4[2-4])|39\\d|41[179]|5(?:[349]\\d|5[0-2])|7(?:0[017]|[13]\\d|22|44|55|67|88))|9(?:22[128]|3(?:2[0-4]|7\\d)|57[05629]|7(?:2[05-9]|3[37]|4\\d|60|7[2579]|87|9[07])))\\d{4}|9[0-57-9]\\d{7}",
"\\d{7,9}", , , "912345678"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "UZ", 998, "810", "8", , , "8", , "8~10", , [[, "([679]\\d)(\\d{3})(\\d{2})(\\d{2})", "$1 $2 $3 $4", , "8 $1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], VA:[, [, , "(?:0(?:878\\d{5}|6698\\d{5})|[1589]\\d{5,10}|3(?:[12457-9]\\d{8}|[36]\\d{7,9}))", "\\d{6,11}"], [, , "06698\\d{5}", "\\d{10}", , , "0669812345"], [, , "3(?:[12457-9]\\d{8}|6\\d{7,8}|3\\d{7,9})",
"\\d{9,11}", , , "3123456789"], [, , "80(?:0\\d{6}|3\\d{3})", "\\d{6,9}", , , "800123456"], [, , "0878\\d{5}|1(?:44|6[346])\\d{6}|89(?:2\\d{3}|4(?:[0-4]\\d{2}|[5-9]\\d{4})|5(?:[0-4]\\d{2}|[5-9]\\d{6})|9\\d{6})", "\\d{6,10}", , , "899123456"], [, , "84(?:[08]\\d{6}|[17]\\d{3})", "\\d{6,9}", , , "848123456"], [, , "1(?:78\\d|99)\\d{6}", "\\d{9,10}", , , "1781234567"], [, , "55\\d{8}", "\\d{10}", , , "5512345678"], "VA", 39, "00", , , , , , , , , , [, , "NA", "NA"], , , [, , "848\\d{6}", "\\d{9}", ,
, "848123456"], [, , "NA", "NA"], 1, , [, , "NA", "NA"]], VC:[, [, , "[5789]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "784(?:266|3(?:6[6-9]|7\\d|8[0-24-6])|4(?:38|5[0-36-8]|8[0-8])|5(?:55|7[0-2]|93)|638|784)\\d{4}", "\\d{7}(?:\\d{3})?", , , "7842661234"], [, , "784(?:4(?:3[0-4]|5[45]|89|9[0-5])|5(?:2[6-9]|3[0-4]))\\d{4}", "\\d{10}", , , "7844301234"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002345678"], [, , "900[2-9]\\d{6}", "\\d{10}", , , "9002345678"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}",
"\\d{10}", , , "5002345678"], [, , "NA", "NA"], "VC", 1, "011", "1", , , "1", , , , , , [, , "NA", "NA"], , "784", [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], VE:[, [, , "[24589]\\d{9}", "\\d{7,10}"], [, , "(?:2(?:12|3[457-9]|[58][1-9]|[467]\\d|9[1-6])|50[01])\\d{7}", "\\d{7,10}", , , "2121234567"], [, , "4(?:1[24-8]|2[46])\\d{7}", "\\d{10}", , , "4121234567"], [, , "800\\d{7}", "\\d{10}", , , "8001234567"], [, , "900\\d{7}", "\\d{10}", , , "9001234567"], [, , "NA", "NA"], [, , "NA",
"NA"], [, , "NA", "NA"], "VE", 58, "00", "0", , , "0", , , , [[, "(\\d{3})(\\d{7})", "$1-$2", , "0$1", "$CC $1", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], VG:[, [, , "[2589]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "284(?:(?:229|4(?:22|9[45])|774|8(?:52|6[459]))\\d{4}|496[0-5]\\d{3})", "\\d{7}(?:\\d{3})?", , , "2842291234"], [, , "284(?:(?:3(?:0[0-3]|4[0-367])|4(?:4[0-6]|68|99)|54[0-57])\\d{4}|496[6-9]\\d{3})", "\\d{10}", , , "2843001234"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}",
"\\d{10}", , , "8002345678"], [, , "900[2-9]\\d{6}", "\\d{10}", , , "9002345678"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "NA", "NA"], "VG", 1, "011", "1", , , "1", , , , , , [, , "NA", "NA"], , "284", [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], VI:[, [, , "[3589]\\d{9}", "\\d{7}(?:\\d{3})?"], [, , "340(?:2(?:01|2[0678]|44|77)|3(?:32|44)|4(?:22|7[34])|5(?:1[34]|55)|6(?:26|4[23]|77|9[023])|7(?:1[2-589]|27|7\\d)|884|998)\\d{4}", "\\d{7}(?:\\d{3})?",
, , "3406421234"], [, , "340(?:2(?:01|2[0678]|44|77)|3(?:32|44)|4(?:22|7[34])|5(?:1[34]|55)|6(?:26|4[23]|77|9[023])|7(?:1[2-589]|27|7\\d)|884|998)\\d{4}", "\\d{7}(?:\\d{3})?", , , "3406421234"], [, , "8(?:00|44|55|66|77|88)[2-9]\\d{6}", "\\d{10}", , , "8002345678"], [, , "900[2-9]\\d{6}", "\\d{10}", , , "9002345678"], [, , "NA", "NA"], [, , "5(?:00|33|44|66|77)[2-9]\\d{6}", "\\d{10}", , , "5002345678"], [, , "NA", "NA"], "VI", 1, "011", "1", , , "1", , , 1, , , [, , "NA", "NA"], , "340", [, , "NA",
"NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], VN:[, [, , "[17]\\d{6,9}|[2-69]\\d{7,9}|8\\d{6,8}", "\\d{7,10}"], [, , "(?:2(?:[025-79]|1[0189]|[348][01])|3(?:[0136-9]|[25][01])|4\\d|5(?:[01][01]|[2-9])|6(?:[0-46-8]|5[01])|7(?:[02-79]|[18][01])|8[1-9])\\d{7}", "\\d{9,10}", , , "2101234567"], [, , "(?:9\\d|1(?:2\\d|6[2-9]|8[68]|99))\\d{7}", "\\d{9,10}", , , "912345678"], [, , "1800\\d{4,6}", "\\d{8,10}", , , "1800123456"], [, , "1900\\d{4,6}", "\\d{8,10}", , , "1900123456"], [, , "NA", "NA"], [, ,
"NA", "NA"], [, , "NA", "NA"], "VN", 84, "00", "0", , , "0", , , , [[, "([17]99)(\\d{4})", "$1 $2", ["[17]99"], "0$1", "", 1], [, "([48])(\\d{4})(\\d{4})", "$1 $2 $3", ["[48]"], "0$1", "", 1], [, "([235-7]\\d)(\\d{4})(\\d{3})", "$1 $2 $3", ["2[025-79]|3[0136-9]|5[2-9]|6[0-46-8]|7[02-79]"], "0$1", "", 1], [, "(80)(\\d{5})", "$1 $2", ["80"], "0$1", "", 1], [, "(69\\d)(\\d{4,5})", "$1 $2", ["69"], "0$1", "", 1], [, "([235-7]\\d{2})(\\d{4})(\\d{3})", "$1 $2 $3", ["2[1348]|3[25]|5[01]|65|7[18]"], "0$1",
"", 1], [, "(9\\d)(\\d{3})(\\d{2})(\\d{2})", "$1 $2 $3 $4", ["9"], "0$1", "", 1], [, "(1[2689]\\d)(\\d{3})(\\d{4})", "$1 $2 $3", ["1(?:[26]|8[68]|99)"], "0$1", "", 1], [, "(1[89]00)(\\d{4,6})", "$1 $2", ["1[89]0"], "$1", "", 1]], , [, , "NA", "NA"], , , [, , "[17]99\\d{4}|69\\d{5,6}", "\\d{7,8}", , , "1992000"], [, , "[17]99\\d{4}|69\\d{5,6}|80\\d{5}", "\\d{7,8}", , , "1992000"], , , [, , "NA", "NA"]], VU:[, [, , "[2-57-9]\\d{4,6}", "\\d{5,7}"], [, , "(?:2[02-9]\\d|3(?:[5-7]\\d|8[0-8])|48[4-9]|88\\d)\\d{2}",
"\\d{5}", , , "22123"], [, , "(?:5(?:7[2-5]|[0-689]\\d)|7[013-7]\\d)\\d{4}", "\\d{7}", , , "5912345"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "VU", 678, "00", , , , , , , , [[, "(\\d{3})(\\d{4})", "$1 $2", ["[579]"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "3[03]\\d{3}|900\\d{4}", "\\d{5,7}", , , "30123"], , , [, , "NA", "NA"]], WF:[, [, , "[5-7]\\d{5}", "\\d{6}"], [, , "(?:50|68|72)\\d{4}", "\\d{6}", , , "501234"], [, , "(?:50|68|72)\\d{4}",
"\\d{6}", , , "501234"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "WF", 681, "00", , , , , , , 1, [[, "(\\d{2})(\\d{2})(\\d{2})", "$1 $2 $3", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], WS:[, [, , "[2-8]\\d{4,6}", "\\d{5,7}"], [, , "(?:[2-5]\\d|6[1-9]|84\\d{2})\\d{3}", "\\d{5,7}", , , "22123"], [, , "(?:60|7[25-7]\\d)\\d{4}", "\\d{6,7}", , , "601234"], [, , "800\\d{3}", "\\d{6}", , , "800123"],
[, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "WS", 685, "0", , , , , , , , [[, "(8\\d{2})(\\d{3,4})", "$1 $2", ["8"], "", "", 0], [, "(7\\d)(\\d{5})", "$1 $2", ["7"], "", "", 0], [, "(\\d{5})", "$1", ["[2-6]"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], YE:[, [, , "[1-7]\\d{6,8}", "\\d{6,9}"], [, , "(?:1(?:7\\d|[2-68])|2[2-68]|3[2358]|4[2-58]|5[2-6]|6[3-58]|7[24-68])\\d{5}", "\\d{6,8}", , , "1234567"], [, , "7[0137]\\d{7}",
"\\d{9}", , , "712345678"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "YE", 967, "00", "0", , , "0", , , , [[, "([1-7])(\\d{3})(\\d{3,4})", "$1 $2 $3", ["[1-6]|7[24-68]"], "0$1", "", 0], [, "(7\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["7[0137]"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], YT:[, [, , "[268]\\d{8}", "\\d{9}"], [, , "269(?:6[0-4]|50)\\d{4}", "\\d{9}", , , "269601234"], [, , "639\\d{6}",
"\\d{9}", , , "639123456"], [, , "80\\d{7}", "\\d{9}", , , "801234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "YT", 262, "00", "0", , , "0", , , , , , [, , "NA", "NA"], , "269|63", [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], ZA:[, [, , "[1-79]\\d{8}|8(?:[067]\\d{7}|[1-4]\\d{3,7})", "\\d{5,9}"], [, , "(?:1[0-8]|2[0-378]|3[1-69]|4\\d|5[1346-8])\\d{7}", "\\d{9}", , , "101234567"], [, , "(?:6[0-5]|7[0-46-9])\\d{7}|8[1-4]\\d{3,7}", "\\d{5,9}", , , "711234567"],
[, , "80\\d{7}", "\\d{9}", , , "801234567"], [, , "86[2-9]\\d{6}|90\\d{7}", "\\d{9}", , , "862345678"], [, , "860\\d{6}", "\\d{9}", , , "860123456"], [, , "NA", "NA"], [, , "87\\d{7}", "\\d{9}", , , "871234567"], "ZA", 27, "00", "0", , , "0", , , , [[, "(860)(\\d{3})(\\d{3})", "$1 $2 $3", ["860"], "0$1", "", 0], [, "(\\d{2})(\\d{3})(\\d{4})", "$1 $2 $3", ["[1-79]|8(?:[0-47]|6[1-9])"], "0$1", "", 0], [, "(\\d{2})(\\d{3,4})", "$1 $2", ["8[1-4]"], "0$1", "", 0], [, "(\\d{2})(\\d{3})(\\d{2,3})", "$1 $2 $3",
["8[1-4]"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "861\\d{6}", "\\d{9}", , , "861123456"], , , [, , "NA", "NA"]], ZM:[, [, , "[289]\\d{8}", "\\d{9}"], [, , "21[1-8]\\d{6}", "\\d{9}", , , "211234567"], [, , "9(?:5[05]|6\\d|7[1-9])\\d{6}", "\\d{9}", , , "955123456"], [, , "800\\d{6}", "\\d{9}", , , "800123456"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "ZM", 260, "00", "0", , , "0", , , , [[, "([29]\\d)(\\d{7})", "$1 $2", ["[29]"], "0$1", "",
0], [, "(800)(\\d{3})(\\d{3})", "$1 $2 $3", ["8"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], ZW:[, [, , "2(?:[012457-9]\\d{3,8}|6(?:[14]\\d{7}|\\d{4}))|[13-79]\\d{4,9}|8[06]\\d{8}", "\\d{3,10}"], [, , "(?:2(?:0(?:4\\d|5\\d{2})|2[278]\\d|48\\d|7(?:[1-7]\\d|[089]\\d{2})|8(?:[2-57-9]|[146]\\d{2})|98)|3(?:08|17|3[78]|7(?:[19]|[56]\\d)|8[37]|98)|5[15][78]|6(?:28\\d{2}|[36]7|75\\d|[69]8|8(?:7\\d|8)))\\d{3}|(?:2(?:1[39]|2[0157]|6[14]|7[35]|84)|329)\\d{7}|(?:1(?:3\\d{2}|9\\d|[4-8])|2(?:0\\d{2}|[569]\\d)|3(?:[26]|[013459]\\d)|5(?:0|5\\d{2}|[689]\\d)|6(?:[39]|[01246]\\d|[78]\\d{2}))\\d{3}|(?:29\\d|39|54)\\d{6}|(?:(?:25|54)83|2582\\d)\\d{3}|(?:4\\d{6,7}|9[2-9]\\d{4,5})",
"\\d{3,10}", , , "1312345"], [, , "7[1378]\\d{7}", "\\d{9}", , , "711234567"], [, , "800\\d{7}", "\\d{10}", , , "8001234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "86(?:1[12]|30|44|55|77|8[367]|99)\\d{6}", "\\d{10}", , , "8686123456"], "ZW", 263, "00", "0", , , "0", , , , [[, "([49])(\\d{3})(\\d{2,4})", "$1 $2 $3", ["4|9[2-9]"], "0$1", "", 0], [, "(7\\d)(\\d{3})(\\d{3,4})", "$1 $2 $3", ["7"], "0$1", "", 0], [, "(86\\d{2})(\\d{3})(\\d{3})", "$1 $2 $3", ["86[24]"], "0$1", "",
0], [, "([2356]\\d{2})(\\d{3,5})", "$1 $2", ["2(?:0[45]|2[278]|[49]8|[78])|3(?:08|17|3[78]|7[1569]|8[37]|98)|5[15][78]|6(?:[29]8|[38]7|6[78]|75|[89]8)"], "0$1", "", 0], [, "(\\d{3})(\\d{3})(\\d{3,4})", "$1 $2 $3", ["2(?:1[39]|2[0157]|6[14]|7[35]|84)|329"], "0$1", "", 0], [, "([1-356]\\d)(\\d{3,5})", "$1 $2", ["1[3-9]|2[0569]|3[0-69]|5[05689]|6[0-46-9]"], "0$1", "", 0], [, "([235]\\d)(\\d{3})(\\d{3,4})", "$1 $2 $3", ["[23]9|54"], "0$1", "", 0], [, "([25]\\d{3})(\\d{3,5})", "$1 $2", ["(?:25|54)8",
"258[23]|5483"], "0$1", "", 0], [, "(8\\d{3})(\\d{6})", "$1 $2", ["86"], "0$1", "", 0], [, "(80\\d)(\\d{3})(\\d{4})", "$1 $2 $3", ["80"], "0$1", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], 800:[, [, , "\\d{8}", "\\d{8}", , , "12345678"], [, , "NA", "NA", , , "12345678"], [, , "NA", "NA", , , "12345678"], [, , "\\d{8}", "\\d{8}", , , "12345678"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "001", 800, "", , , , , , , 1, [[,
"(\\d{4})(\\d{4})", "$1 $2", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], 1, , [, , "NA", "NA"]], 808:[, [, , "\\d{8}", "\\d{8}", , , "12345678"], [, , "NA", "NA", , , "12345678"], [, , "NA", "NA", , , "12345678"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "\\d{8}", "\\d{8}", , , "12345678"], [, , "NA", "NA"], [, , "NA", "NA"], "001", 808, "", , , , , , , 1, [[, "(\\d{4})(\\d{4})", "$1 $2", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], 1,
, [, , "NA", "NA"]], 870:[, [, , "[35-7]\\d{8}", "\\d{9}", , , "301234567"], [, , "NA", "NA", , , "301234567"], [, , "(?:[356]\\d|7[6-8])\\d{7}", "\\d{9}", , , "301234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "001", 870, "", , , , , , , , [[, "(\\d{3})(\\d{3})(\\d{3})", "$1 $2 $3", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], 878:[, [, , "1\\d{11}", "\\d{12}", , , "101234567890"], [, , "NA",
"NA", , , "101234567890"], [, , "NA", "NA", , , "101234567890"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "10\\d{10}", "\\d{12}", , , "101234567890"], "001", 878, "", , , , , , , 1, [[, "(\\d{2})(\\d{5})(\\d{5})", "$1 $2 $3", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], 881:[, [, , "[67]\\d{8}", "\\d{9}", , , "612345678"], [, , "NA", "NA", , , "612345678"], [, , "[67]\\d{8}", "\\d{9}", , , "612345678"], [, ,
"NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "001", 881, "", , , , , , , , [[, "(\\d)(\\d{3})(\\d{5})", "$1 $2 $3", ["[67]"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], 882:[, [, , "[13]\\d{6,11}", "\\d{7,12}", , , "3451234567"], [, , "NA", "NA", , , "3451234567"], [, , "3(?:2\\d{3}|37\\d{2}|4(?:2|7\\d{3}))\\d{4}", "\\d{7,10}", , , "3451234567"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, ,
"NA", "NA"], [, , "1(?:3(?:0[0347]|[13][0139]|2[035]|4[013568]|6[0459]|7[06]|8[15678]|9[0689])\\d{4}|6\\d{5,10})|345\\d{7}", "\\d{7,12}", , , "3451234567"], "001", 882, "", , , , , , , , [[, "(\\d{2})(\\d{4})(\\d{3})", "$1 $2 $3", ["3[23]"], "", "", 0], [, "(\\d{2})(\\d{5})", "$1 $2", ["16|342"], "", "", 0], [, "(\\d{2})(\\d{4})(\\d{4})", "$1 $2 $3", ["34[57]"], "", "", 0], [, "(\\d{3})(\\d{4})(\\d{4})", "$1 $2 $3", ["348"], "", "", 0], [, "(\\d{2})(\\d{2})(\\d{4})", "$1 $2 $3", ["1"], "", "", 0],
[, "(\\d{2})(\\d{3,4})(\\d{4})", "$1 $2 $3", ["16"], "", "", 0], [, "(\\d{2})(\\d{4,5})(\\d{5})", "$1 $2 $3", ["16"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "348[57]\\d{7}", "\\d{11}", , , "3451234567"]], 883:[, [, , "51\\d{7}(?:\\d{3})?", "\\d{9}(?:\\d{3})?", , , "510012345"], [, , "NA", "NA", , , "510012345"], [, , "NA", "NA", , , "510012345"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "51(?:00\\d{5}(?:\\d{3})?|[13]0\\d{8})",
"\\d{9}(?:\\d{3})?", , , "510012345"], "001", 883, "", , , , , , , 1, [[, "(\\d{3})(\\d{3})(\\d{3})", "$1 $2 $3", ["510"], "", "", 0], [, "(\\d{3})(\\d{3})(\\d{3})(\\d{3})", "$1 $2 $3 $4", ["510"], "", "", 0], [, "(\\d{4})(\\d{4})(\\d{4})", "$1 $2 $3", ["51[13]"], "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], , , [, , "NA", "NA"]], 888:[, [, , "\\d{11}", "\\d{11}", , , "12345678901"], [, , "NA", "NA", , , "12345678901"], [, , "NA", "NA", , , "12345678901"], [, , "NA", "NA"],
[, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA", "NA"], "001", 888, "", , , , , , , 1, [[, "(\\d{3})(\\d{3})(\\d{5})", "$1 $2 $3", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "\\d{11}", "\\d{11}", , , "12345678901"], 1, , [, , "NA", "NA"]], 979:[, [, , "\\d{9}", "\\d{9}", , , "123456789"], [, , "NA", "NA", , , "123456789"], [, , "NA", "NA", , , "123456789"], [, , "NA", "NA"], [, , "\\d{9}", "\\d{9}", , , "123456789"], [, , "NA", "NA"], [, , "NA", "NA"], [, , "NA",
"NA"], "001", 979, "", , , , , , , 1, [[, "(\\d)(\\d{4})(\\d{4})", "$1 $2 $3", , "", "", 0]], , [, , "NA", "NA"], , , [, , "NA", "NA"], [, , "NA", "NA"], 1, , [, , "NA", "NA"]]};
i18n.phonenumbers.PhoneNumber = function() {
  goog.proto2.Message.call(this);
};
goog.inherits(i18n.phonenumbers.PhoneNumber, goog.proto2.Message);
i18n.phonenumbers.PhoneNumber.prototype.getCountryCode = function() {
  return this.get$Value(1);
};
i18n.phonenumbers.PhoneNumber.prototype.getCountryCodeOrDefault = function() {
  return this.get$ValueOrDefault(1);
};
i18n.phonenumbers.PhoneNumber.prototype.setCountryCode = function(a) {
  this.set$Value(1, a);
};
i18n.phonenumbers.PhoneNumber.prototype.hasCountryCode = function() {
  return this.has$Value(1);
};
i18n.phonenumbers.PhoneNumber.prototype.countryCodeCount = function() {
  return this.count$Values(1);
};
i18n.phonenumbers.PhoneNumber.prototype.clearCountryCode = function() {
  this.clear$Field(1);
};
i18n.phonenumbers.PhoneNumber.prototype.getNationalNumber = function() {
  return this.get$Value(2);
};
i18n.phonenumbers.PhoneNumber.prototype.getNationalNumberOrDefault = function() {
  return this.get$ValueOrDefault(2);
};
i18n.phonenumbers.PhoneNumber.prototype.setNationalNumber = function(a) {
  this.set$Value(2, a);
};
i18n.phonenumbers.PhoneNumber.prototype.hasNationalNumber = function() {
  return this.has$Value(2);
};
i18n.phonenumbers.PhoneNumber.prototype.nationalNumberCount = function() {
  return this.count$Values(2);
};
i18n.phonenumbers.PhoneNumber.prototype.clearNationalNumber = function() {
  this.clear$Field(2);
};
i18n.phonenumbers.PhoneNumber.prototype.getExtension = function() {
  return this.get$Value(3);
};
i18n.phonenumbers.PhoneNumber.prototype.getExtensionOrDefault = function() {
  return this.get$ValueOrDefault(3);
};
i18n.phonenumbers.PhoneNumber.prototype.setExtension = function(a) {
  this.set$Value(3, a);
};
i18n.phonenumbers.PhoneNumber.prototype.hasExtension = function() {
  return this.has$Value(3);
};
i18n.phonenumbers.PhoneNumber.prototype.extensionCount = function() {
  return this.count$Values(3);
};
i18n.phonenumbers.PhoneNumber.prototype.clearExtension = function() {
  this.clear$Field(3);
};
i18n.phonenumbers.PhoneNumber.prototype.getItalianLeadingZero = function() {
  return this.get$Value(4);
};
i18n.phonenumbers.PhoneNumber.prototype.getItalianLeadingZeroOrDefault = function() {
  return this.get$ValueOrDefault(4);
};
i18n.phonenumbers.PhoneNumber.prototype.setItalianLeadingZero = function(a) {
  this.set$Value(4, a);
};
i18n.phonenumbers.PhoneNumber.prototype.hasItalianLeadingZero = function() {
  return this.has$Value(4);
};
i18n.phonenumbers.PhoneNumber.prototype.italianLeadingZeroCount = function() {
  return this.count$Values(4);
};
i18n.phonenumbers.PhoneNumber.prototype.clearItalianLeadingZero = function() {
  this.clear$Field(4);
};
i18n.phonenumbers.PhoneNumber.prototype.getNumberOfLeadingZeros = function() {
  return this.get$Value(8);
};
i18n.phonenumbers.PhoneNumber.prototype.getNumberOfLeadingZerosOrDefault = function() {
  return this.get$ValueOrDefault(8);
};
i18n.phonenumbers.PhoneNumber.prototype.setNumberOfLeadingZeros = function(a) {
  this.set$Value(8, a);
};
i18n.phonenumbers.PhoneNumber.prototype.hasNumberOfLeadingZeros = function() {
  return this.has$Value(8);
};
i18n.phonenumbers.PhoneNumber.prototype.numberOfLeadingZerosCount = function() {
  return this.count$Values(8);
};
i18n.phonenumbers.PhoneNumber.prototype.clearNumberOfLeadingZeros = function() {
  this.clear$Field(8);
};
i18n.phonenumbers.PhoneNumber.prototype.getRawInput = function() {
  return this.get$Value(5);
};
i18n.phonenumbers.PhoneNumber.prototype.getRawInputOrDefault = function() {
  return this.get$ValueOrDefault(5);
};
i18n.phonenumbers.PhoneNumber.prototype.setRawInput = function(a) {
  this.set$Value(5, a);
};
i18n.phonenumbers.PhoneNumber.prototype.hasRawInput = function() {
  return this.has$Value(5);
};
i18n.phonenumbers.PhoneNumber.prototype.rawInputCount = function() {
  return this.count$Values(5);
};
i18n.phonenumbers.PhoneNumber.prototype.clearRawInput = function() {
  this.clear$Field(5);
};
i18n.phonenumbers.PhoneNumber.prototype.getCountryCodeSource = function() {
  return this.get$Value(6);
};
i18n.phonenumbers.PhoneNumber.prototype.getCountryCodeSourceOrDefault = function() {
  return this.get$ValueOrDefault(6);
};
i18n.phonenumbers.PhoneNumber.prototype.setCountryCodeSource = function(a) {
  this.set$Value(6, a);
};
i18n.phonenumbers.PhoneNumber.prototype.hasCountryCodeSource = function() {
  return this.has$Value(6);
};
i18n.phonenumbers.PhoneNumber.prototype.countryCodeSourceCount = function() {
  return this.count$Values(6);
};
i18n.phonenumbers.PhoneNumber.prototype.clearCountryCodeSource = function() {
  this.clear$Field(6);
};
i18n.phonenumbers.PhoneNumber.prototype.getPreferredDomesticCarrierCode = function() {
  return this.get$Value(7);
};
i18n.phonenumbers.PhoneNumber.prototype.getPreferredDomesticCarrierCodeOrDefault = function() {
  return this.get$ValueOrDefault(7);
};
i18n.phonenumbers.PhoneNumber.prototype.setPreferredDomesticCarrierCode = function(a) {
  this.set$Value(7, a);
};
i18n.phonenumbers.PhoneNumber.prototype.hasPreferredDomesticCarrierCode = function() {
  return this.has$Value(7);
};
i18n.phonenumbers.PhoneNumber.prototype.preferredDomesticCarrierCodeCount = function() {
  return this.count$Values(7);
};
i18n.phonenumbers.PhoneNumber.prototype.clearPreferredDomesticCarrierCode = function() {
  this.clear$Field(7);
};
i18n.phonenumbers.PhoneNumber.CountryCodeSource = {FROM_NUMBER_WITH_PLUS_SIGN:1, FROM_NUMBER_WITH_IDD:5, FROM_NUMBER_WITHOUT_PLUS_SIGN:10, FROM_DEFAULT_COUNTRY:20};
i18n.phonenumbers.PhoneNumber.prototype.getDescriptor = function() {
  i18n.phonenumbers.PhoneNumber.descriptor_ || (i18n.phonenumbers.PhoneNumber.descriptor_ = goog.proto2.Message.createDescriptor(i18n.phonenumbers.PhoneNumber, {0:{name:"PhoneNumber", fullName:"i18n.phonenumbers.PhoneNumber"}, 1:{name:"country_code", required:!0, fieldType:goog.proto2.Message.FieldType.INT32, type:Number}, 2:{name:"national_number", required:!0, fieldType:goog.proto2.Message.FieldType.UINT64, type:Number}, 3:{name:"extension", fieldType:goog.proto2.Message.FieldType.STRING, type:String},
  4:{name:"italian_leading_zero", fieldType:goog.proto2.Message.FieldType.BOOL, type:Boolean}, 8:{name:"number_of_leading_zeros", fieldType:goog.proto2.Message.FieldType.INT32, defaultValue:1, type:Number}, 5:{name:"raw_input", fieldType:goog.proto2.Message.FieldType.STRING, type:String}, 6:{name:"country_code_source", fieldType:goog.proto2.Message.FieldType.ENUM, defaultValue:i18n.phonenumbers.PhoneNumber.CountryCodeSource.FROM_NUMBER_WITH_PLUS_SIGN, type:i18n.phonenumbers.PhoneNumber.CountryCodeSource},
  7:{name:"preferred_domestic_carrier_code", fieldType:goog.proto2.Message.FieldType.STRING, type:String}}));
  return i18n.phonenumbers.PhoneNumber.descriptor_;
};
i18n.phonenumbers.PhoneNumber.ctor = i18n.phonenumbers.PhoneNumber;
i18n.phonenumbers.PhoneNumber.ctor.getDescriptor = i18n.phonenumbers.PhoneNumber.prototype.getDescriptor;
/*

 Copyright (C) 2010 The Libphonenumber Authors.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/
i18n.phonenumbers.PhoneNumberUtil = function() {
  this.regionToMetadataMap = {};
};
goog.addSingletonGetter(i18n.phonenumbers.PhoneNumberUtil);
i18n.phonenumbers.Error = {INVALID_COUNTRY_CODE:"Invalid country calling code", NOT_A_NUMBER:"The string supplied did not seem to be a phone number", TOO_SHORT_AFTER_IDD:"Phone number too short after IDD", TOO_SHORT_NSN:"The string supplied is too short to be a phone number", TOO_LONG:"The string supplied is too long to be a phone number"};
i18n.phonenumbers.PhoneNumberUtil.NANPA_COUNTRY_CODE_ = 1;
i18n.phonenumbers.PhoneNumberUtil.MIN_LENGTH_FOR_NSN_ = 2;
i18n.phonenumbers.PhoneNumberUtil.MAX_LENGTH_FOR_NSN_ = 17;
i18n.phonenumbers.PhoneNumberUtil.MAX_LENGTH_COUNTRY_CODE_ = 3;
i18n.phonenumbers.PhoneNumberUtil.MAX_INPUT_STRING_LENGTH_ = 250;
i18n.phonenumbers.PhoneNumberUtil.UNKNOWN_REGION_ = "ZZ";
i18n.phonenumbers.PhoneNumberUtil.COLOMBIA_MOBILE_TO_FIXED_LINE_PREFIX_ = "3";
i18n.phonenumbers.PhoneNumberUtil.MOBILE_TOKEN_MAPPINGS_ = {52:"1", 54:"9"};
i18n.phonenumbers.PhoneNumberUtil.PLUS_SIGN = "+";
i18n.phonenumbers.PhoneNumberUtil.STAR_SIGN_ = "*";
i18n.phonenumbers.PhoneNumberUtil.RFC3966_EXTN_PREFIX_ = ";ext=";
i18n.phonenumbers.PhoneNumberUtil.RFC3966_PREFIX_ = "tel:";
i18n.phonenumbers.PhoneNumberUtil.RFC3966_PHONE_CONTEXT_ = ";phone-context=";
i18n.phonenumbers.PhoneNumberUtil.RFC3966_ISDN_SUBADDRESS_ = ";isub=";
i18n.phonenumbers.PhoneNumberUtil.DIGIT_MAPPINGS = {0:"0", 1:"1", 2:"2", 3:"3", 4:"4", 5:"5", 6:"6", 7:"7", 8:"8", 9:"9", "\uff10":"0", "\uff11":"1", "\uff12":"2", "\uff13":"3", "\uff14":"4", "\uff15":"5", "\uff16":"6", "\uff17":"7", "\uff18":"8", "\uff19":"9", "\u0660":"0", "\u0661":"1", "\u0662":"2", "\u0663":"3", "\u0664":"4", "\u0665":"5", "\u0666":"6", "\u0667":"7", "\u0668":"8", "\u0669":"9", "\u06f0":"0", "\u06f1":"1", "\u06f2":"2", "\u06f3":"3", "\u06f4":"4", "\u06f5":"5", "\u06f6":"6", "\u06f7":"7",
"\u06f8":"8", "\u06f9":"9"};
i18n.phonenumbers.PhoneNumberUtil.DIALLABLE_CHAR_MAPPINGS_ = {0:"0", 1:"1", 2:"2", 3:"3", 4:"4", 5:"5", 6:"6", 7:"7", 8:"8", 9:"9", "+":i18n.phonenumbers.PhoneNumberUtil.PLUS_SIGN, "*":"*"};
i18n.phonenumbers.PhoneNumberUtil.ALPHA_MAPPINGS_ = {A:"2", B:"2", C:"2", D:"3", E:"3", F:"3", G:"4", H:"4", I:"4", J:"5", K:"5", L:"5", M:"6", N:"6", O:"6", P:"7", Q:"7", R:"7", S:"7", T:"8", U:"8", V:"8", W:"9", X:"9", Y:"9", Z:"9"};
i18n.phonenumbers.PhoneNumberUtil.ALL_NORMALIZATION_MAPPINGS_ = {0:"0", 1:"1", 2:"2", 3:"3", 4:"4", 5:"5", 6:"6", 7:"7", 8:"8", 9:"9", "\uff10":"0", "\uff11":"1", "\uff12":"2", "\uff13":"3", "\uff14":"4", "\uff15":"5", "\uff16":"6", "\uff17":"7", "\uff18":"8", "\uff19":"9", "\u0660":"0", "\u0661":"1", "\u0662":"2", "\u0663":"3", "\u0664":"4", "\u0665":"5", "\u0666":"6", "\u0667":"7", "\u0668":"8", "\u0669":"9", "\u06f0":"0", "\u06f1":"1", "\u06f2":"2", "\u06f3":"3", "\u06f4":"4", "\u06f5":"5", "\u06f6":"6",
"\u06f7":"7", "\u06f8":"8", "\u06f9":"9", A:"2", B:"2", C:"2", D:"3", E:"3", F:"3", G:"4", H:"4", I:"4", J:"5", K:"5", L:"5", M:"6", N:"6", O:"6", P:"7", Q:"7", R:"7", S:"7", T:"8", U:"8", V:"8", W:"9", X:"9", Y:"9", Z:"9"};
i18n.phonenumbers.PhoneNumberUtil.ALL_PLUS_NUMBER_GROUPING_SYMBOLS_ = {0:"0", 1:"1", 2:"2", 3:"3", 4:"4", 5:"5", 6:"6", 7:"7", 8:"8", 9:"9", A:"A", B:"B", C:"C", D:"D", E:"E", F:"F", G:"G", H:"H", I:"I", J:"J", K:"K", L:"L", M:"M", N:"N", O:"O", P:"P", Q:"Q", R:"R", S:"S", T:"T", U:"U", V:"V", W:"W", X:"X", Y:"Y", Z:"Z", a:"A", b:"B", c:"C", d:"D", e:"E", f:"F", g:"G", h:"H", i:"I", j:"J", k:"K", l:"L", m:"M", n:"N", o:"O", p:"P", q:"Q", r:"R", s:"S", t:"T", u:"U", v:"V", w:"W", x:"X", y:"Y", z:"Z",
"-":"-", "\uff0d":"-", "\u2010":"-", "\u2011":"-", "\u2012":"-", "\u2013":"-", "\u2014":"-", "\u2015":"-", "\u2212":"-", "/":"/", "\uff0f":"/", " ":" ", "\u3000":" ", "\u2060":" ", ".":".", "\uff0e":"."};
i18n.phonenumbers.PhoneNumberUtil.UNIQUE_INTERNATIONAL_PREFIX_ = /[\d]+(?:[~\u2053\u223C\uFF5E][\d]+)?/;
i18n.phonenumbers.PhoneNumberUtil.VALID_PUNCTUATION = "-x\u2010-\u2015\u2212\u30fc\uff0d-\uff0f \u00a0\u00ad\u200b\u2060\u3000()\uff08\uff09\uff3b\uff3d.\\[\\]/~\u2053\u223c\uff5e";
i18n.phonenumbers.PhoneNumberUtil.VALID_DIGITS_ = "0-9\uff10-\uff19\u0660-\u0669\u06f0-\u06f9";
i18n.phonenumbers.PhoneNumberUtil.VALID_ALPHA_ = "A-Za-z";
i18n.phonenumbers.PhoneNumberUtil.PLUS_CHARS_ = "+\uff0b";
i18n.phonenumbers.PhoneNumberUtil.PLUS_CHARS_PATTERN = new RegExp("[" + i18n.phonenumbers.PhoneNumberUtil.PLUS_CHARS_ + "]+");
i18n.phonenumbers.PhoneNumberUtil.LEADING_PLUS_CHARS_PATTERN_ = new RegExp("^[" + i18n.phonenumbers.PhoneNumberUtil.PLUS_CHARS_ + "]+");
i18n.phonenumbers.PhoneNumberUtil.SEPARATOR_PATTERN_ = "[" + i18n.phonenumbers.PhoneNumberUtil.VALID_PUNCTUATION + "]+";
i18n.phonenumbers.PhoneNumberUtil.CAPTURING_DIGIT_PATTERN = new RegExp("([" + i18n.phonenumbers.PhoneNumberUtil.VALID_DIGITS_ + "])");
i18n.phonenumbers.PhoneNumberUtil.VALID_START_CHAR_PATTERN_ = new RegExp("[" + i18n.phonenumbers.PhoneNumberUtil.PLUS_CHARS_ + i18n.phonenumbers.PhoneNumberUtil.VALID_DIGITS_ + "]");
i18n.phonenumbers.PhoneNumberUtil.SECOND_NUMBER_START_PATTERN_ = /[\\\/] *x/;
i18n.phonenumbers.PhoneNumberUtil.UNWANTED_END_CHAR_PATTERN_ = new RegExp("[^" + i18n.phonenumbers.PhoneNumberUtil.VALID_DIGITS_ + i18n.phonenumbers.PhoneNumberUtil.VALID_ALPHA_ + "#]+$");
i18n.phonenumbers.PhoneNumberUtil.VALID_ALPHA_PHONE_PATTERN_ = /(?:.*?[A-Za-z]){3}.*/;
i18n.phonenumbers.PhoneNumberUtil.MIN_LENGTH_PHONE_NUMBER_PATTERN_ = "[" + i18n.phonenumbers.PhoneNumberUtil.VALID_DIGITS_ + "]{" + i18n.phonenumbers.PhoneNumberUtil.MIN_LENGTH_FOR_NSN_ + "}";
i18n.phonenumbers.PhoneNumberUtil.VALID_PHONE_NUMBER_ = "[" + i18n.phonenumbers.PhoneNumberUtil.PLUS_CHARS_ + "]*(?:[" + i18n.phonenumbers.PhoneNumberUtil.VALID_PUNCTUATION + i18n.phonenumbers.PhoneNumberUtil.STAR_SIGN_ + "]*[" + i18n.phonenumbers.PhoneNumberUtil.VALID_DIGITS_ + "]){3,}[" + i18n.phonenumbers.PhoneNumberUtil.VALID_PUNCTUATION + i18n.phonenumbers.PhoneNumberUtil.STAR_SIGN_ + i18n.phonenumbers.PhoneNumberUtil.VALID_ALPHA_ + i18n.phonenumbers.PhoneNumberUtil.VALID_DIGITS_ + "]*";
i18n.phonenumbers.PhoneNumberUtil.DEFAULT_EXTN_PREFIX_ = " ext. ";
i18n.phonenumbers.PhoneNumberUtil.CAPTURING_EXTN_DIGITS_ = "([" + i18n.phonenumbers.PhoneNumberUtil.VALID_DIGITS_ + "]{1,7})";
i18n.phonenumbers.PhoneNumberUtil.EXTN_PATTERNS_FOR_PARSING_ = i18n.phonenumbers.PhoneNumberUtil.RFC3966_EXTN_PREFIX_ + i18n.phonenumbers.PhoneNumberUtil.CAPTURING_EXTN_DIGITS_ + "|[ \u00a0\\t,]*(?:e?xt(?:ensi(?:o\u0301?|\u00f3))?n?|\uff45?\uff58\uff54\uff4e?|[,x\uff58#\uff03~\uff5e]|int|anexo|\uff49\uff4e\uff54)[:\\.\uff0e]?[ \u00a0\\t,-]*" + i18n.phonenumbers.PhoneNumberUtil.CAPTURING_EXTN_DIGITS_ + "#?|[- ]+([" + i18n.phonenumbers.PhoneNumberUtil.VALID_DIGITS_ + "]{1,5})#";
i18n.phonenumbers.PhoneNumberUtil.EXTN_PATTERN_ = new RegExp("(?:" + i18n.phonenumbers.PhoneNumberUtil.EXTN_PATTERNS_FOR_PARSING_ + ")$", "i");
i18n.phonenumbers.PhoneNumberUtil.VALID_PHONE_NUMBER_PATTERN_ = new RegExp("^" + i18n.phonenumbers.PhoneNumberUtil.MIN_LENGTH_PHONE_NUMBER_PATTERN_ + "$|^" + i18n.phonenumbers.PhoneNumberUtil.VALID_PHONE_NUMBER_ + "(?:" + i18n.phonenumbers.PhoneNumberUtil.EXTN_PATTERNS_FOR_PARSING_ + ")?$", "i");
i18n.phonenumbers.PhoneNumberUtil.NON_DIGITS_PATTERN_ = /\D+/;
i18n.phonenumbers.PhoneNumberUtil.FIRST_GROUP_PATTERN_ = /(\$\d)/;
i18n.phonenumbers.PhoneNumberUtil.NP_PATTERN_ = /\$NP/;
i18n.phonenumbers.PhoneNumberUtil.FG_PATTERN_ = /\$FG/;
i18n.phonenumbers.PhoneNumberUtil.CC_PATTERN_ = /\$CC/;
i18n.phonenumbers.PhoneNumberUtil.FIRST_GROUP_ONLY_PREFIX_PATTERN_ = /^\(?\$1\)?$/;
i18n.phonenumbers.PhoneNumberUtil.REGION_CODE_FOR_NON_GEO_ENTITY = "001";
i18n.phonenumbers.PhoneNumberFormat = {E164:0, INTERNATIONAL:1, NATIONAL:2, RFC3966:3};
i18n.phonenumbers.PhoneNumberType = {FIXED_LINE:0, MOBILE:1, FIXED_LINE_OR_MOBILE:2, TOLL_FREE:3, PREMIUM_RATE:4, SHARED_COST:5, VOIP:6, PERSONAL_NUMBER:7, PAGER:8, UAN:9, VOICEMAIL:10, UNKNOWN:-1};
i18n.phonenumbers.PhoneNumberUtil.MatchType = {NOT_A_NUMBER:0, NO_MATCH:1, SHORT_NSN_MATCH:2, NSN_MATCH:3, EXACT_MATCH:4};
i18n.phonenumbers.PhoneNumberUtil.ValidationResult = {IS_POSSIBLE:0, INVALID_COUNTRY_CODE:1, TOO_SHORT:2, TOO_LONG:3};
i18n.phonenumbers.PhoneNumberUtil.extractPossibleNumber = function(a) {
  var b = a.search(i18n.phonenumbers.PhoneNumberUtil.VALID_START_CHAR_PATTERN_);
  0 <= b ? (a = a.substring(b), a = a.replace(i18n.phonenumbers.PhoneNumberUtil.UNWANTED_END_CHAR_PATTERN_, ""), b = a.search(i18n.phonenumbers.PhoneNumberUtil.SECOND_NUMBER_START_PATTERN_), 0 <= b && (a = a.substring(0, b))) : a = "";
  return a;
};
i18n.phonenumbers.PhoneNumberUtil.isViablePhoneNumber = function(a) {
  return a.length < i18n.phonenumbers.PhoneNumberUtil.MIN_LENGTH_FOR_NSN_ ? !1 : i18n.phonenumbers.PhoneNumberUtil.matchesEntirely_(i18n.phonenumbers.PhoneNumberUtil.VALID_PHONE_NUMBER_PATTERN_, a);
};
i18n.phonenumbers.PhoneNumberUtil.normalize = function(a) {
  return i18n.phonenumbers.PhoneNumberUtil.matchesEntirely_(i18n.phonenumbers.PhoneNumberUtil.VALID_ALPHA_PHONE_PATTERN_, a) ? i18n.phonenumbers.PhoneNumberUtil.normalizeHelper_(a, i18n.phonenumbers.PhoneNumberUtil.ALL_NORMALIZATION_MAPPINGS_, !0) : i18n.phonenumbers.PhoneNumberUtil.normalizeDigitsOnly(a);
};
i18n.phonenumbers.PhoneNumberUtil.normalizeSB_ = function(a) {
  var b = i18n.phonenumbers.PhoneNumberUtil.normalize(a.toString());
  a.clear();
  a.append(b);
};
i18n.phonenumbers.PhoneNumberUtil.normalizeDigitsOnly = function(a) {
  return i18n.phonenumbers.PhoneNumberUtil.normalizeHelper_(a, i18n.phonenumbers.PhoneNumberUtil.DIGIT_MAPPINGS, !0);
};
i18n.phonenumbers.PhoneNumberUtil.convertAlphaCharactersInNumber = function(a) {
  return i18n.phonenumbers.PhoneNumberUtil.normalizeHelper_(a, i18n.phonenumbers.PhoneNumberUtil.ALL_NORMALIZATION_MAPPINGS_, !1);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.getLengthOfGeographicalAreaCode = function(a) {
  var b = this.getMetadataForRegion(this.getRegionCodeForNumber(a));
  return null != b && (b.hasNationalPrefix() || a.hasItalianLeadingZero()) && this.isNumberGeographical(a) ? this.getLengthOfNationalDestinationCode(a) : 0;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.getLengthOfNationalDestinationCode = function(a) {
  var b;
  a.hasExtension() ? (b = a.clone(), b.clearExtension()) : b = a;
  b = this.format(b, i18n.phonenumbers.PhoneNumberFormat.INTERNATIONAL).split(i18n.phonenumbers.PhoneNumberUtil.NON_DIGITS_PATTERN_);
  0 == b[0].length && b.shift();
  return 2 >= b.length ? 0 : this.getNumberType(a) == i18n.phonenumbers.PhoneNumberType.MOBILE && (a = i18n.phonenumbers.PhoneNumberUtil.getCountryMobileToken(a.getCountryCodeOrDefault()), "" != a) ? b[2].length + a.length : b[1].length;
};
i18n.phonenumbers.PhoneNumberUtil.getCountryMobileToken = function(a) {
  return i18n.phonenumbers.PhoneNumberUtil.MOBILE_TOKEN_MAPPINGS_[a] || "";
};
i18n.phonenumbers.PhoneNumberUtil.prototype.getSupportedRegions = function() {
  return goog.array.filter(Object.keys(i18n.phonenumbers.metadata.countryToMetadata), function(a) {
    return isNaN(a);
  });
};
i18n.phonenumbers.PhoneNumberUtil.prototype.getSupportedGlobalNetworkCallingCodes = function() {
  var a = goog.array.filter(Object.keys(i18n.phonenumbers.metadata.countryToMetadata), function(a) {
    return !isNaN(a);
  });
  return goog.array.map(a, function(a) {
    return parseInt(a, 10);
  });
};
i18n.phonenumbers.PhoneNumberUtil.normalizeHelper_ = function(a, b, c) {
  for (var d = new goog.string.StringBuffer, e, f, g = a.length, h = 0;h < g;++h) {
    e = a.charAt(h), f = b[e.toUpperCase()], null != f ? d.append(f) : c || d.append(e);
  }
  return d.toString();
};
i18n.phonenumbers.PhoneNumberUtil.prototype.formattingRuleHasFirstGroupOnly = function(a) {
  return 0 == a.length || i18n.phonenumbers.PhoneNumberUtil.FIRST_GROUP_ONLY_PREFIX_PATTERN_.test(a);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.isNumberGeographical = function(a) {
  a = this.getNumberType(a);
  return a == i18n.phonenumbers.PhoneNumberType.FIXED_LINE || a == i18n.phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.isValidRegionCode_ = function(a) {
  return null != a && isNaN(a) && a.toUpperCase() in i18n.phonenumbers.metadata.countryToMetadata;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.hasValidCountryCallingCode_ = function(a) {
  return a in i18n.phonenumbers.metadata.countryCodeToRegionCodeMap;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.format = function(a, b) {
  if (0 == a.getNationalNumber() && a.hasRawInput()) {
    var c = a.getRawInputOrDefault();
    if (0 < c.length) {
      return c;
    }
  }
  var c = a.getCountryCodeOrDefault(), d = this.getNationalSignificantNumber(a);
  if (b == i18n.phonenumbers.PhoneNumberFormat.E164) {
    return this.prefixNumberWithCountryCallingCode_(c, i18n.phonenumbers.PhoneNumberFormat.E164, d, "");
  }
  if (!this.hasValidCountryCallingCode_(c)) {
    return d;
  }
  var e = this.getRegionCodeForCountryCode(c), f = this.getMetadataForRegionOrCallingCode_(c, e), e = this.maybeGetFormattedExtension_(a, f, b), d = this.formatNsn_(d, f, b);
  return this.prefixNumberWithCountryCallingCode_(c, b, d, e);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.formatByPattern = function(a, b, c) {
  var d = a.getCountryCodeOrDefault(), e = this.getNationalSignificantNumber(a);
  if (!this.hasValidCountryCallingCode_(d)) {
    return e;
  }
  var f = this.getRegionCodeForCountryCode(d), f = this.getMetadataForRegionOrCallingCode_(d, f), g = "", g = this.chooseFormattingPatternForNumber_(c, e);
  if (null == g) {
    g = e;
  } else {
    c = g.clone();
    g = g.getNationalPrefixFormattingRuleOrDefault();
    if (0 < g.length) {
      var h = f.getNationalPrefixOrDefault();
      0 < h.length ? (g = g.replace(i18n.phonenumbers.PhoneNumberUtil.NP_PATTERN_, h).replace(i18n.phonenumbers.PhoneNumberUtil.FG_PATTERN_, "$1"), c.setNationalPrefixFormattingRule(g)) : c.clearNationalPrefixFormattingRule();
    }
    g = this.formatNsnUsingPattern_(e, c, b);
  }
  a = this.maybeGetFormattedExtension_(a, f, b);
  return this.prefixNumberWithCountryCallingCode_(d, b, g, a);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.formatNationalNumberWithCarrierCode = function(a, b) {
  var c = a.getCountryCodeOrDefault(), d = this.getNationalSignificantNumber(a);
  if (!this.hasValidCountryCallingCode_(c)) {
    return d;
  }
  var e = this.getRegionCodeForCountryCode(c), f = this.getMetadataForRegionOrCallingCode_(c, e), e = this.maybeGetFormattedExtension_(a, f, i18n.phonenumbers.PhoneNumberFormat.NATIONAL), d = this.formatNsn_(d, f, i18n.phonenumbers.PhoneNumberFormat.NATIONAL, b);
  return this.prefixNumberWithCountryCallingCode_(c, i18n.phonenumbers.PhoneNumberFormat.NATIONAL, d, e);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.getMetadataForRegionOrCallingCode_ = function(a, b) {
  return i18n.phonenumbers.PhoneNumberUtil.REGION_CODE_FOR_NON_GEO_ENTITY == b ? this.getMetadataForNonGeographicalRegion(a) : this.getMetadataForRegion(b);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.formatNationalNumberWithPreferredCarrierCode = function(a, b) {
  return this.formatNationalNumberWithCarrierCode(a, a.hasPreferredDomesticCarrierCode() ? a.getPreferredDomesticCarrierCodeOrDefault() : b);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.formatNumberForMobileDialing = function(a, b, c) {
  var d = a.getCountryCodeOrDefault();
  if (!this.hasValidCountryCallingCode_(d)) {
    return a.hasRawInput() ? a.getRawInputOrDefault() : "";
  }
  var e = "";
  a = a.clone();
  a.clearExtension();
  var f = this.getRegionCodeForCountryCode(d), g = this.getNumberType(a), h = g != i18n.phonenumbers.PhoneNumberType.UNKNOWN;
  if (b == f) {
    e = g == i18n.phonenumbers.PhoneNumberType.FIXED_LINE || g == i18n.phonenumbers.PhoneNumberType.MOBILE || g == i18n.phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE, "CO" == f && g == i18n.phonenumbers.PhoneNumberType.FIXED_LINE ? e = this.formatNationalNumberWithCarrierCode(a, i18n.phonenumbers.PhoneNumberUtil.COLOMBIA_MOBILE_TO_FIXED_LINE_PREFIX_) : "BR" == f && e ? e = a.hasPreferredDomesticCarrierCode() ? this.formatNationalNumberWithPreferredCarrierCode(a, "") : "" : h && "HU" == f ? e =
    this.getNddPrefixForRegion(f, !0) + " " + this.format(a, i18n.phonenumbers.PhoneNumberFormat.NATIONAL) : d == i18n.phonenumbers.PhoneNumberUtil.NANPA_COUNTRY_CODE_ ? (b = this.getMetadataForRegion(b), e = this.canBeInternationallyDialled(a) && !this.isShorterThanPossibleNormalNumber_(b, this.getNationalSignificantNumber(a)) ? this.format(a, i18n.phonenumbers.PhoneNumberFormat.INTERNATIONAL) : this.format(a, i18n.phonenumbers.PhoneNumberFormat.NATIONAL)) : e = (f == i18n.phonenumbers.PhoneNumberUtil.REGION_CODE_FOR_NON_GEO_ENTITY ||
    ("MX" == f || "CL" == f) && e) && this.canBeInternationallyDialled(a) ? this.format(a, i18n.phonenumbers.PhoneNumberFormat.INTERNATIONAL) : this.format(a, i18n.phonenumbers.PhoneNumberFormat.NATIONAL);
  } else {
    if (h && this.canBeInternationallyDialled(a)) {
      return c ? this.format(a, i18n.phonenumbers.PhoneNumberFormat.INTERNATIONAL) : this.format(a, i18n.phonenumbers.PhoneNumberFormat.E164);
    }
  }
  return c ? e : i18n.phonenumbers.PhoneNumberUtil.normalizeHelper_(e, i18n.phonenumbers.PhoneNumberUtil.DIALLABLE_CHAR_MAPPINGS_, !0);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.formatOutOfCountryCallingNumber = function(a, b) {
  if (!this.isValidRegionCode_(b)) {
    return this.format(a, i18n.phonenumbers.PhoneNumberFormat.INTERNATIONAL);
  }
  var c = a.getCountryCodeOrDefault(), d = this.getNationalSignificantNumber(a);
  if (!this.hasValidCountryCallingCode_(c)) {
    return d;
  }
  if (c == i18n.phonenumbers.PhoneNumberUtil.NANPA_COUNTRY_CODE_) {
    if (this.isNANPACountry(b)) {
      return c + " " + this.format(a, i18n.phonenumbers.PhoneNumberFormat.NATIONAL);
    }
  } else {
    if (c == this.getCountryCodeForValidRegion_(b)) {
      return this.format(a, i18n.phonenumbers.PhoneNumberFormat.NATIONAL);
    }
  }
  var e = this.getMetadataForRegion(b), f = e.getInternationalPrefixOrDefault(), g = "";
  i18n.phonenumbers.PhoneNumberUtil.matchesEntirely_(i18n.phonenumbers.PhoneNumberUtil.UNIQUE_INTERNATIONAL_PREFIX_, f) ? g = f : e.hasPreferredInternationalPrefix() && (g = e.getPreferredInternationalPrefixOrDefault());
  e = this.getRegionCodeForCountryCode(c);
  e = this.getMetadataForRegionOrCallingCode_(c, e);
  d = this.formatNsn_(d, e, i18n.phonenumbers.PhoneNumberFormat.INTERNATIONAL);
  e = this.maybeGetFormattedExtension_(a, e, i18n.phonenumbers.PhoneNumberFormat.INTERNATIONAL);
  return 0 < g.length ? g + " " + c + " " + d + e : this.prefixNumberWithCountryCallingCode_(c, i18n.phonenumbers.PhoneNumberFormat.INTERNATIONAL, d, e);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.formatInOriginalFormat = function(a, b) {
  if (a.hasRawInput() && (this.hasUnexpectedItalianLeadingZero_(a) || !this.hasFormattingPatternForNumber_(a))) {
    return a.getRawInputOrDefault();
  }
  if (!a.hasCountryCodeSource()) {
    return this.format(a, i18n.phonenumbers.PhoneNumberFormat.NATIONAL);
  }
  var c;
  switch(a.getCountryCodeSource()) {
    case i18n.phonenumbers.PhoneNumber.CountryCodeSource.FROM_NUMBER_WITH_PLUS_SIGN:
      c = this.format(a, i18n.phonenumbers.PhoneNumberFormat.INTERNATIONAL);
      break;
    case i18n.phonenumbers.PhoneNumber.CountryCodeSource.FROM_NUMBER_WITH_IDD:
      c = this.formatOutOfCountryCallingNumber(a, b);
      break;
    case i18n.phonenumbers.PhoneNumber.CountryCodeSource.FROM_NUMBER_WITHOUT_PLUS_SIGN:
      c = this.format(a, i18n.phonenumbers.PhoneNumberFormat.INTERNATIONAL).substring(1);
      break;
    default:
      var d = this.getRegionCodeForCountryCode(a.getCountryCodeOrDefault()), e = this.getNddPrefixForRegion(d, !0);
      c = this.format(a, i18n.phonenumbers.PhoneNumberFormat.NATIONAL);
      if (null == e || 0 == e.length) {
        break;
      }
      if (this.rawInputContainsNationalPrefix_(a.getRawInputOrDefault(), e, d)) {
        break;
      }
      d = this.getMetadataForRegion(d);
      e = this.getNationalSignificantNumber(a);
      d = this.chooseFormattingPatternForNumber_(d.numberFormatArray(), e);
      if (null == d) {
        break;
      }
      var e = d.getNationalPrefixFormattingRuleOrDefault(), f = e.indexOf("$1");
      if (0 >= f) {
        break;
      }
      e = e.substring(0, f);
      e = i18n.phonenumbers.PhoneNumberUtil.normalizeDigitsOnly(e);
      if (0 == e.length) {
        break;
      }
      c = d.clone();
      c.clearNationalPrefixFormattingRule();
      c = this.formatByPattern(a, i18n.phonenumbers.PhoneNumberFormat.NATIONAL, [c]);
  }
  d = a.getRawInputOrDefault();
  null != c && 0 < d.length && (e = i18n.phonenumbers.PhoneNumberUtil.normalizeHelper_(c, i18n.phonenumbers.PhoneNumberUtil.DIALLABLE_CHAR_MAPPINGS_, !0), f = i18n.phonenumbers.PhoneNumberUtil.normalizeHelper_(d, i18n.phonenumbers.PhoneNumberUtil.DIALLABLE_CHAR_MAPPINGS_, !0), e != f && (c = d));
  return c;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.rawInputContainsNationalPrefix_ = function(a, b, c) {
  a = i18n.phonenumbers.PhoneNumberUtil.normalizeDigitsOnly(a);
  if (goog.string.startsWith(a, b)) {
    try {
      return this.isValidNumber(this.parse(a.substring(b.length), c));
    } catch (d) {
    }
  }
  return !1;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.hasUnexpectedItalianLeadingZero_ = function(a) {
  return a.hasItalianLeadingZero() && !this.isLeadingZeroPossible(a.getCountryCodeOrDefault());
};
i18n.phonenumbers.PhoneNumberUtil.prototype.hasFormattingPatternForNumber_ = function(a) {
  var b = a.getCountryCodeOrDefault(), c = this.getRegionCodeForCountryCode(b), b = this.getMetadataForRegionOrCallingCode_(b, c);
  if (null == b) {
    return !1;
  }
  a = this.getNationalSignificantNumber(a);
  return null != this.chooseFormattingPatternForNumber_(b.numberFormatArray(), a);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.formatOutOfCountryKeepingAlphaChars = function(a, b) {
  var c = a.getRawInputOrDefault();
  if (0 == c.length) {
    return this.formatOutOfCountryCallingNumber(a, b);
  }
  var d = a.getCountryCodeOrDefault();
  if (!this.hasValidCountryCallingCode_(d)) {
    return c;
  }
  var c = i18n.phonenumbers.PhoneNumberUtil.normalizeHelper_(c, i18n.phonenumbers.PhoneNumberUtil.ALL_PLUS_NUMBER_GROUPING_SYMBOLS_, !0), e = this.getNationalSignificantNumber(a);
  if (3 < e.length) {
    var f = c.indexOf(e.substring(0, 3));
    -1 != f && (c = c.substring(f));
  }
  f = this.getMetadataForRegion(b);
  if (d == i18n.phonenumbers.PhoneNumberUtil.NANPA_COUNTRY_CODE_) {
    if (this.isNANPACountry(b)) {
      return d + " " + c;
    }
  } else {
    if (null != f && d == this.getCountryCodeForValidRegion_(b)) {
      d = this.chooseFormattingPatternForNumber_(f.numberFormatArray(), e);
      if (null == d) {
        return c;
      }
      d = d.clone();
      d.setPattern("(\\d+)(.*)");
      d.setFormat("$1$2");
      return this.formatNsnUsingPattern_(c, d, i18n.phonenumbers.PhoneNumberFormat.NATIONAL);
    }
  }
  e = "";
  null != f && (e = f.getInternationalPrefixOrDefault(), e = i18n.phonenumbers.PhoneNumberUtil.matchesEntirely_(i18n.phonenumbers.PhoneNumberUtil.UNIQUE_INTERNATIONAL_PREFIX_, e) ? e : f.getPreferredInternationalPrefixOrDefault());
  f = this.getRegionCodeForCountryCode(d);
  f = this.getMetadataForRegionOrCallingCode_(d, f);
  f = this.maybeGetFormattedExtension_(a, f, i18n.phonenumbers.PhoneNumberFormat.INTERNATIONAL);
  return 0 < e.length ? e + " " + d + " " + c + f : this.prefixNumberWithCountryCallingCode_(d, i18n.phonenumbers.PhoneNumberFormat.INTERNATIONAL, c, f);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.getNationalSignificantNumber = function(a) {
  var b = "" + a.getNationalNumber();
  return a.hasItalianLeadingZero() && a.getItalianLeadingZero() ? Array(a.getNumberOfLeadingZerosOrDefault() + 1).join("0") + b : b;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.prefixNumberWithCountryCallingCode_ = function(a, b, c, d) {
  switch(b) {
    case i18n.phonenumbers.PhoneNumberFormat.E164:
      return i18n.phonenumbers.PhoneNumberUtil.PLUS_SIGN + a + c + d;
    case i18n.phonenumbers.PhoneNumberFormat.INTERNATIONAL:
      return i18n.phonenumbers.PhoneNumberUtil.PLUS_SIGN + a + " " + c + d;
    case i18n.phonenumbers.PhoneNumberFormat.RFC3966:
      return i18n.phonenumbers.PhoneNumberUtil.RFC3966_PREFIX_ + i18n.phonenumbers.PhoneNumberUtil.PLUS_SIGN + a + "-" + c + d;
    default:
      return c + d;
  }
};
i18n.phonenumbers.PhoneNumberUtil.prototype.formatNsn_ = function(a, b, c, d) {
  b = 0 == b.intlNumberFormatArray().length || c == i18n.phonenumbers.PhoneNumberFormat.NATIONAL ? b.numberFormatArray() : b.intlNumberFormatArray();
  b = this.chooseFormattingPatternForNumber_(b, a);
  return null == b ? a : this.formatNsnUsingPattern_(a, b, c, d);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.chooseFormattingPatternForNumber_ = function(a, b) {
  for (var c, d = a.length, e = 0;e < d;++e) {
    c = a[e];
    var f = c.leadingDigitsPatternCount();
    if (0 == f || 0 == b.search(c.getLeadingDigitsPattern(f - 1))) {
      if (f = new RegExp(c.getPattern()), i18n.phonenumbers.PhoneNumberUtil.matchesEntirely_(f, b)) {
        return c;
      }
    }
  }
  return null;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.formatNsnUsingPattern_ = function(a, b, c, d) {
  var e = b.getFormatOrDefault(), f = new RegExp(b.getPattern()), g = b.getDomesticCarrierCodeFormattingRuleOrDefault(), h = "";
  c == i18n.phonenumbers.PhoneNumberFormat.NATIONAL && null != d && 0 < d.length && 0 < g.length ? (b = g.replace(i18n.phonenumbers.PhoneNumberUtil.CC_PATTERN_, d), e = e.replace(i18n.phonenumbers.PhoneNumberUtil.FIRST_GROUP_PATTERN_, b), h = a.replace(f, e)) : (b = b.getNationalPrefixFormattingRuleOrDefault(), h = c == i18n.phonenumbers.PhoneNumberFormat.NATIONAL && null != b && 0 < b.length ? a.replace(f, e.replace(i18n.phonenumbers.PhoneNumberUtil.FIRST_GROUP_PATTERN_, b)) : a.replace(f, e));
  c == i18n.phonenumbers.PhoneNumberFormat.RFC3966 && (h = h.replace(new RegExp("^" + i18n.phonenumbers.PhoneNumberUtil.SEPARATOR_PATTERN_), ""), h = h.replace(new RegExp(i18n.phonenumbers.PhoneNumberUtil.SEPARATOR_PATTERN_, "g"), "-"));
  return h;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.getExampleNumber = function(a) {
  return this.getExampleNumberForType(a, i18n.phonenumbers.PhoneNumberType.FIXED_LINE);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.getExampleNumberForType = function(a, b) {
  if (!this.isValidRegionCode_(a)) {
    return null;
  }
  var c = this.getNumberDescByType_(this.getMetadataForRegion(a), b);
  try {
    if (c.hasExampleNumber()) {
      return this.parse(c.getExampleNumberOrDefault(), a);
    }
  } catch (d) {
  }
  return null;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.getExampleNumberForNonGeoEntity = function(a) {
  var b = this.getMetadataForNonGeographicalRegion(a);
  if (null != b) {
    b = b.getGeneralDesc();
    try {
      if (b.hasExampleNumber()) {
        return this.parse("+" + a + b.getExampleNumber(), "ZZ");
      }
    } catch (c) {
    }
  }
  return null;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.maybeGetFormattedExtension_ = function(a, b, c) {
  return a.hasExtension() && 0 != a.getExtension().length ? c == i18n.phonenumbers.PhoneNumberFormat.RFC3966 ? i18n.phonenumbers.PhoneNumberUtil.RFC3966_EXTN_PREFIX_ + a.getExtension() : b.hasPreferredExtnPrefix() ? b.getPreferredExtnPrefix() + a.getExtensionOrDefault() : i18n.phonenumbers.PhoneNumberUtil.DEFAULT_EXTN_PREFIX_ + a.getExtensionOrDefault() : "";
};
i18n.phonenumbers.PhoneNumberUtil.prototype.getNumberDescByType_ = function(a, b) {
  switch(b) {
    case i18n.phonenumbers.PhoneNumberType.PREMIUM_RATE:
      return a.getPremiumRate();
    case i18n.phonenumbers.PhoneNumberType.TOLL_FREE:
      return a.getTollFree();
    case i18n.phonenumbers.PhoneNumberType.MOBILE:
      return a.getMobile();
    case i18n.phonenumbers.PhoneNumberType.FIXED_LINE:
    ;
    case i18n.phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE:
      return a.getFixedLine();
    case i18n.phonenumbers.PhoneNumberType.SHARED_COST:
      return a.getSharedCost();
    case i18n.phonenumbers.PhoneNumberType.VOIP:
      return a.getVoip();
    case i18n.phonenumbers.PhoneNumberType.PERSONAL_NUMBER:
      return a.getPersonalNumber();
    case i18n.phonenumbers.PhoneNumberType.PAGER:
      return a.getPager();
    case i18n.phonenumbers.PhoneNumberType.UAN:
      return a.getUan();
    case i18n.phonenumbers.PhoneNumberType.VOICEMAIL:
      return a.getVoicemail();
    default:
      return a.getGeneralDesc();
  }
};
i18n.phonenumbers.PhoneNumberUtil.prototype.getNumberType = function(a) {
  var b = this.getRegionCodeForNumber(a), b = this.getMetadataForRegionOrCallingCode_(a.getCountryCodeOrDefault(), b);
  if (null == b) {
    return i18n.phonenumbers.PhoneNumberType.UNKNOWN;
  }
  a = this.getNationalSignificantNumber(a);
  return this.getNumberTypeHelper_(a, b);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.getNumberTypeHelper_ = function(a, b) {
  return this.isNumberMatchingDesc_(a, b.getGeneralDesc()) ? this.isNumberMatchingDesc_(a, b.getPremiumRate()) ? i18n.phonenumbers.PhoneNumberType.PREMIUM_RATE : this.isNumberMatchingDesc_(a, b.getTollFree()) ? i18n.phonenumbers.PhoneNumberType.TOLL_FREE : this.isNumberMatchingDesc_(a, b.getSharedCost()) ? i18n.phonenumbers.PhoneNumberType.SHARED_COST : this.isNumberMatchingDesc_(a, b.getVoip()) ? i18n.phonenumbers.PhoneNumberType.VOIP : this.isNumberMatchingDesc_(a, b.getPersonalNumber()) ? i18n.phonenumbers.PhoneNumberType.PERSONAL_NUMBER :
  this.isNumberMatchingDesc_(a, b.getPager()) ? i18n.phonenumbers.PhoneNumberType.PAGER : this.isNumberMatchingDesc_(a, b.getUan()) ? i18n.phonenumbers.PhoneNumberType.UAN : this.isNumberMatchingDesc_(a, b.getVoicemail()) ? i18n.phonenumbers.PhoneNumberType.VOICEMAIL : this.isNumberMatchingDesc_(a, b.getFixedLine()) ? b.getSameMobileAndFixedLinePattern() || this.isNumberMatchingDesc_(a, b.getMobile()) ? i18n.phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE : i18n.phonenumbers.PhoneNumberType.FIXED_LINE :
  !b.getSameMobileAndFixedLinePattern() && this.isNumberMatchingDesc_(a, b.getMobile()) ? i18n.phonenumbers.PhoneNumberType.MOBILE : i18n.phonenumbers.PhoneNumberType.UNKNOWN : i18n.phonenumbers.PhoneNumberType.UNKNOWN;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.getMetadataForRegion = function(a) {
  if (null == a) {
    return null;
  }
  a = a.toUpperCase();
  var b = this.regionToMetadataMap[a];
  if (null == b) {
    var b = new goog.proto2.PbLiteSerializer, c = i18n.phonenumbers.metadata.countryToMetadata[a];
    if (null == c) {
      return null;
    }
    b = b.deserialize(i18n.phonenumbers.PhoneMetadata.getDescriptor(), c);
    this.regionToMetadataMap[a] = b;
  }
  return b;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.getMetadataForNonGeographicalRegion = function(a) {
  return this.getMetadataForRegion("" + a);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.isNumberMatchingDesc_ = function(a, b) {
  return i18n.phonenumbers.PhoneNumberUtil.matchesEntirely_(b.getPossibleNumberPatternOrDefault(), a) && i18n.phonenumbers.PhoneNumberUtil.matchesEntirely_(b.getNationalNumberPatternOrDefault(), a);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.isValidNumber = function(a) {
  var b = this.getRegionCodeForNumber(a);
  return this.isValidNumberForRegion(a, b);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.isValidNumberForRegion = function(a, b) {
  var c = a.getCountryCodeOrDefault(), d = this.getMetadataForRegionOrCallingCode_(c, b);
  if (null == d || i18n.phonenumbers.PhoneNumberUtil.REGION_CODE_FOR_NON_GEO_ENTITY != b && c != this.getCountryCodeForValidRegion_(b)) {
    return !1;
  }
  c = this.getNationalSignificantNumber(a);
  return this.getNumberTypeHelper_(c, d) != i18n.phonenumbers.PhoneNumberType.UNKNOWN;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.getRegionCodeForNumber = function(a) {
  if (null == a) {
    return null;
  }
  var b = a.getCountryCodeOrDefault(), b = i18n.phonenumbers.metadata.countryCodeToRegionCodeMap[b];
  return null == b ? null : 1 == b.length ? b[0] : this.getRegionCodeForNumberFromRegionList_(a, b);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.getRegionCodeForNumberFromRegionList_ = function(a, b) {
  for (var c = this.getNationalSignificantNumber(a), d, e = b.length, f = 0;f < e;f++) {
    d = b[f];
    var g = this.getMetadataForRegion(d);
    if (g.hasLeadingDigits()) {
      if (0 == c.search(g.getLeadingDigits())) {
        return d;
      }
    } else {
      if (this.getNumberTypeHelper_(c, g) != i18n.phonenumbers.PhoneNumberType.UNKNOWN) {
        return d;
      }
    }
  }
  return null;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.getRegionCodeForCountryCode = function(a) {
  a = i18n.phonenumbers.metadata.countryCodeToRegionCodeMap[a];
  return null == a ? i18n.phonenumbers.PhoneNumberUtil.UNKNOWN_REGION_ : a[0];
};
i18n.phonenumbers.PhoneNumberUtil.prototype.getRegionCodesForCountryCode = function(a) {
  a = i18n.phonenumbers.metadata.countryCodeToRegionCodeMap[a];
  return null == a ? [] : a;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.getCountryCodeForRegion = function(a) {
  return this.isValidRegionCode_(a) ? this.getCountryCodeForValidRegion_(a) : 0;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.getCountryCodeForValidRegion_ = function(a) {
  var b = this.getMetadataForRegion(a);
  if (null == b) {
    throw "Invalid region code: " + a;
  }
  return b.getCountryCodeOrDefault();
};
i18n.phonenumbers.PhoneNumberUtil.prototype.getNddPrefixForRegion = function(a, b) {
  var c = this.getMetadataForRegion(a);
  if (null == c) {
    return null;
  }
  c = c.getNationalPrefixOrDefault();
  if (0 == c.length) {
    return null;
  }
  b && (c = c.replace("~", ""));
  return c;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.isNANPACountry = function(a) {
  return null != a && goog.array.contains(i18n.phonenumbers.metadata.countryCodeToRegionCodeMap[i18n.phonenumbers.PhoneNumberUtil.NANPA_COUNTRY_CODE_], a.toUpperCase());
};
i18n.phonenumbers.PhoneNumberUtil.prototype.isLeadingZeroPossible = function(a) {
  a = this.getMetadataForRegionOrCallingCode_(a, this.getRegionCodeForCountryCode(a));
  return null != a && a.getLeadingZeroPossibleOrDefault();
};
i18n.phonenumbers.PhoneNumberUtil.prototype.isAlphaNumber = function(a) {
  if (!i18n.phonenumbers.PhoneNumberUtil.isViablePhoneNumber(a)) {
    return !1;
  }
  a = new goog.string.StringBuffer(a);
  this.maybeStripExtension(a);
  return i18n.phonenumbers.PhoneNumberUtil.matchesEntirely_(i18n.phonenumbers.PhoneNumberUtil.VALID_ALPHA_PHONE_PATTERN_, a.toString());
};
i18n.phonenumbers.PhoneNumberUtil.prototype.isPossibleNumber = function(a) {
  return this.isPossibleNumberWithReason(a) == i18n.phonenumbers.PhoneNumberUtil.ValidationResult.IS_POSSIBLE;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.testNumberLengthAgainstPattern_ = function(a, b) {
  return i18n.phonenumbers.PhoneNumberUtil.matchesEntirely_(a, b) ? i18n.phonenumbers.PhoneNumberUtil.ValidationResult.IS_POSSIBLE : 0 == b.search(a) ? i18n.phonenumbers.PhoneNumberUtil.ValidationResult.TOO_LONG : i18n.phonenumbers.PhoneNumberUtil.ValidationResult.TOO_SHORT;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.isShorterThanPossibleNormalNumber_ = function(a, b) {
  var c = a.getGeneralDesc().getPossibleNumberPatternOrDefault();
  return this.testNumberLengthAgainstPattern_(c, b) == i18n.phonenumbers.PhoneNumberUtil.ValidationResult.TOO_SHORT;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.isPossibleNumberWithReason = function(a) {
  var b = this.getNationalSignificantNumber(a);
  a = a.getCountryCodeOrDefault();
  if (!this.hasValidCountryCallingCode_(a)) {
    return i18n.phonenumbers.PhoneNumberUtil.ValidationResult.INVALID_COUNTRY_CODE;
  }
  var c = this.getRegionCodeForCountryCode(a);
  a = this.getMetadataForRegionOrCallingCode_(a, c).getGeneralDesc().getPossibleNumberPatternOrDefault();
  return this.testNumberLengthAgainstPattern_(a, b);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.isPossibleNumberString = function(a, b) {
  try {
    return this.isPossibleNumber(this.parse(a, b));
  } catch (c) {
    return !1;
  }
};
i18n.phonenumbers.PhoneNumberUtil.prototype.truncateTooLongNumber = function(a) {
  if (this.isValidNumber(a)) {
    return !0;
  }
  var b = a.clone(), c = a.getNationalNumberOrDefault();
  do {
    if (c = Math.floor(c / 10), b.setNationalNumber(c), 0 == c || this.isPossibleNumberWithReason(b) == i18n.phonenumbers.PhoneNumberUtil.ValidationResult.TOO_SHORT) {
      return !1;
    }
  } while (!this.isValidNumber(b));
  a.setNationalNumber(c);
  return !0;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.extractCountryCode = function(a, b) {
  var c = a.toString();
  if (0 == c.length || "0" == c.charAt(0)) {
    return 0;
  }
  for (var d, e = c.length, f = 1;f <= i18n.phonenumbers.PhoneNumberUtil.MAX_LENGTH_COUNTRY_CODE_ && f <= e;++f) {
    if (d = parseInt(c.substring(0, f), 10), d in i18n.phonenumbers.metadata.countryCodeToRegionCodeMap) {
      return b.append(c.substring(f)), d;
    }
  }
  return 0;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.maybeExtractCountryCode = function(a, b, c, d, e) {
  if (0 == a.length) {
    return 0;
  }
  a = new goog.string.StringBuffer(a);
  var f;
  null != b && (f = b.getInternationalPrefix());
  null == f && (f = "NonMatch");
  f = this.maybeStripInternationalPrefixAndNormalize(a, f);
  d && e.setCountryCodeSource(f);
  if (f != i18n.phonenumbers.PhoneNumber.CountryCodeSource.FROM_DEFAULT_COUNTRY) {
    if (a.getLength() <= i18n.phonenumbers.PhoneNumberUtil.MIN_LENGTH_FOR_NSN_) {
      throw i18n.phonenumbers.Error.TOO_SHORT_AFTER_IDD;
    }
    c = this.extractCountryCode(a, c);
    if (0 != c) {
      return e.setCountryCode(c), c;
    }
    throw i18n.phonenumbers.Error.INVALID_COUNTRY_CODE;
  }
  if (null != b) {
    f = b.getCountryCodeOrDefault();
    var g = "" + f, h = a.toString();
    if (goog.string.startsWith(h, g)) {
      var k = new goog.string.StringBuffer(h.substring(g.length)), h = b.getGeneralDesc(), g = new RegExp(h.getNationalNumberPatternOrDefault());
      this.maybeStripNationalPrefixAndCarrierCode(k, b, null);
      b = k.toString();
      h = h.getPossibleNumberPatternOrDefault();
      if (!i18n.phonenumbers.PhoneNumberUtil.matchesEntirely_(g, a.toString()) && i18n.phonenumbers.PhoneNumberUtil.matchesEntirely_(g, b) || this.testNumberLengthAgainstPattern_(h, a.toString()) == i18n.phonenumbers.PhoneNumberUtil.ValidationResult.TOO_LONG) {
        return c.append(b), d && e.setCountryCodeSource(i18n.phonenumbers.PhoneNumber.CountryCodeSource.FROM_NUMBER_WITHOUT_PLUS_SIGN), e.setCountryCode(f), f;
      }
    }
  }
  e.setCountryCode(0);
  return 0;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.parsePrefixAsIdd_ = function(a, b) {
  var c = b.toString();
  if (0 == c.search(a)) {
    var d = c.match(a)[0].length, e = c.substring(d).match(i18n.phonenumbers.PhoneNumberUtil.CAPTURING_DIGIT_PATTERN);
    if (e && null != e[1] && 0 < e[1].length && "0" == i18n.phonenumbers.PhoneNumberUtil.normalizeDigitsOnly(e[1])) {
      return !1;
    }
    b.clear();
    b.append(c.substring(d));
    return !0;
  }
  return !1;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.maybeStripInternationalPrefixAndNormalize = function(a, b) {
  var c = a.toString();
  if (0 == c.length) {
    return i18n.phonenumbers.PhoneNumber.CountryCodeSource.FROM_DEFAULT_COUNTRY;
  }
  if (i18n.phonenumbers.PhoneNumberUtil.LEADING_PLUS_CHARS_PATTERN_.test(c)) {
    return c = c.replace(i18n.phonenumbers.PhoneNumberUtil.LEADING_PLUS_CHARS_PATTERN_, ""), a.clear(), a.append(i18n.phonenumbers.PhoneNumberUtil.normalize(c)), i18n.phonenumbers.PhoneNumber.CountryCodeSource.FROM_NUMBER_WITH_PLUS_SIGN;
  }
  c = new RegExp(b);
  i18n.phonenumbers.PhoneNumberUtil.normalizeSB_(a);
  return this.parsePrefixAsIdd_(c, a) ? i18n.phonenumbers.PhoneNumber.CountryCodeSource.FROM_NUMBER_WITH_IDD : i18n.phonenumbers.PhoneNumber.CountryCodeSource.FROM_DEFAULT_COUNTRY;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.maybeStripNationalPrefixAndCarrierCode = function(a, b, c) {
  var d = a.toString(), e = d.length, f = b.getNationalPrefixForParsing();
  if (0 == e || null == f || 0 == f.length) {
    return !1;
  }
  var g = new RegExp("^(?:" + f + ")");
  if (e = g.exec(d)) {
    var f = new RegExp(b.getGeneralDesc().getNationalNumberPatternOrDefault()), h = i18n.phonenumbers.PhoneNumberUtil.matchesEntirely_(f, d), k = e.length - 1;
    b = b.getNationalPrefixTransformRule();
    if (null == b || 0 == b.length || null == e[k] || 0 == e[k].length) {
      if (h && !i18n.phonenumbers.PhoneNumberUtil.matchesEntirely_(f, d.substring(e[0].length))) {
        return !1;
      }
      null != c && 0 < k && null != e[k] && c.append(e[1]);
      a.set(d.substring(e[0].length));
    } else {
      d = d.replace(g, b);
      if (h && !i18n.phonenumbers.PhoneNumberUtil.matchesEntirely_(f, d)) {
        return !1;
      }
      null != c && 0 < k && c.append(e[1]);
      a.set(d);
    }
    return !0;
  }
  return !1;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.maybeStripExtension = function(a) {
  var b = a.toString(), c = b.search(i18n.phonenumbers.PhoneNumberUtil.EXTN_PATTERN_);
  if (0 <= c && i18n.phonenumbers.PhoneNumberUtil.isViablePhoneNumber(b.substring(0, c))) {
    for (var d = b.match(i18n.phonenumbers.PhoneNumberUtil.EXTN_PATTERN_), e = d.length, f = 1;f < e;++f) {
      if (null != d[f] && 0 < d[f].length) {
        return a.clear(), a.append(b.substring(0, c)), d[f];
      }
    }
  }
  return "";
};
i18n.phonenumbers.PhoneNumberUtil.prototype.checkRegionForParsing_ = function(a, b) {
  return this.isValidRegionCode_(b) || null != a && 0 < a.length && i18n.phonenumbers.PhoneNumberUtil.LEADING_PLUS_CHARS_PATTERN_.test(a);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.parse = function(a, b) {
  return this.parseHelper_(a, b, !1, !0);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.parseAndKeepRawInput = function(a, b) {
  if (!this.isValidRegionCode_(b) && 0 < a.length && a.charAt(0) != i18n.phonenumbers.PhoneNumberUtil.PLUS_SIGN) {
    throw i18n.phonenumbers.Error.INVALID_COUNTRY_CODE;
  }
  return this.parseHelper_(a, b, !0, !0);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.setItalianLeadingZerosForPhoneNumber_ = function(a, b) {
  if (1 < a.length && "0" == a.charAt(0)) {
    b.setItalianLeadingZero(!0);
    for (var c = 1;c < a.length - 1 && "0" == a.charAt(c);) {
      c++;
    }
    1 != c && b.setNumberOfLeadingZeros(c);
  }
};
i18n.phonenumbers.PhoneNumberUtil.prototype.parseHelper_ = function(a, b, c, d) {
  if (null == a) {
    throw i18n.phonenumbers.Error.NOT_A_NUMBER;
  }
  if (a.length > i18n.phonenumbers.PhoneNumberUtil.MAX_INPUT_STRING_LENGTH_) {
    throw i18n.phonenumbers.Error.TOO_LONG;
  }
  var e = new goog.string.StringBuffer;
  this.buildNationalNumberForParsing_(a, e);
  if (!i18n.phonenumbers.PhoneNumberUtil.isViablePhoneNumber(e.toString())) {
    throw i18n.phonenumbers.Error.NOT_A_NUMBER;
  }
  if (d && !this.checkRegionForParsing_(e.toString(), b)) {
    throw i18n.phonenumbers.Error.INVALID_COUNTRY_CODE;
  }
  d = new i18n.phonenumbers.PhoneNumber;
  c && d.setRawInput(a);
  a = this.maybeStripExtension(e);
  0 < a.length && d.setExtension(a);
  a = this.getMetadataForRegion(b);
  var f = new goog.string.StringBuffer, g = 0, h = e.toString();
  try {
    g = this.maybeExtractCountryCode(h, a, f, c, d);
  } catch (k) {
    if (k == i18n.phonenumbers.Error.INVALID_COUNTRY_CODE && i18n.phonenumbers.PhoneNumberUtil.LEADING_PLUS_CHARS_PATTERN_.test(h)) {
      if (h = h.replace(i18n.phonenumbers.PhoneNumberUtil.LEADING_PLUS_CHARS_PATTERN_, ""), g = this.maybeExtractCountryCode(h, a, f, c, d), 0 == g) {
        throw k;
      }
    } else {
      throw k;
    }
  }
  0 != g ? (e = this.getRegionCodeForCountryCode(g), e != b && (a = this.getMetadataForRegionOrCallingCode_(g, e))) : (i18n.phonenumbers.PhoneNumberUtil.normalizeSB_(e), f.append(e.toString()), null != b ? (g = a.getCountryCodeOrDefault(), d.setCountryCode(g)) : c && d.clearCountryCodeSource());
  if (f.getLength() < i18n.phonenumbers.PhoneNumberUtil.MIN_LENGTH_FOR_NSN_) {
    throw i18n.phonenumbers.Error.TOO_SHORT_NSN;
  }
  null != a && (b = new goog.string.StringBuffer, e = new goog.string.StringBuffer(f.toString()), this.maybeStripNationalPrefixAndCarrierCode(e, a, b), this.isShorterThanPossibleNormalNumber_(a, e.toString()) || (f = e, c && d.setPreferredDomesticCarrierCode(b.toString())));
  c = f.toString();
  b = c.length;
  if (b < i18n.phonenumbers.PhoneNumberUtil.MIN_LENGTH_FOR_NSN_) {
    throw i18n.phonenumbers.Error.TOO_SHORT_NSN;
  }
  if (b > i18n.phonenumbers.PhoneNumberUtil.MAX_LENGTH_FOR_NSN_) {
    throw i18n.phonenumbers.Error.TOO_LONG;
  }
  this.setItalianLeadingZerosForPhoneNumber_(c, d);
  d.setNationalNumber(parseInt(c, 10));
  return d;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.buildNationalNumberForParsing_ = function(a, b) {
  var c = a.indexOf(i18n.phonenumbers.PhoneNumberUtil.RFC3966_PHONE_CONTEXT_);
  if (0 < c) {
    var d = c + i18n.phonenumbers.PhoneNumberUtil.RFC3966_PHONE_CONTEXT_.length;
    if (a.charAt(d) == i18n.phonenumbers.PhoneNumberUtil.PLUS_SIGN) {
      var e = a.indexOf(";", d);
      0 < e ? b.append(a.substring(d, e)) : b.append(a.substring(d));
    }
    d = a.indexOf(i18n.phonenumbers.PhoneNumberUtil.RFC3966_PREFIX_);
    b.append(a.substring(0 <= d ? d + i18n.phonenumbers.PhoneNumberUtil.RFC3966_PREFIX_.length : 0, c));
  } else {
    b.append(i18n.phonenumbers.PhoneNumberUtil.extractPossibleNumber(a));
  }
  c = b.toString();
  d = c.indexOf(i18n.phonenumbers.PhoneNumberUtil.RFC3966_ISDN_SUBADDRESS_);
  0 < d && (b.clear(), b.append(c.substring(0, d)));
};
i18n.phonenumbers.PhoneNumberUtil.prototype.isNumberMatch = function(a, b) {
  var c, d;
  if ("string" == typeof a) {
    try {
      c = this.parse(a, i18n.phonenumbers.PhoneNumberUtil.UNKNOWN_REGION_);
    } catch (g) {
      if (g != i18n.phonenumbers.Error.INVALID_COUNTRY_CODE) {
        return i18n.phonenumbers.PhoneNumberUtil.MatchType.NOT_A_NUMBER;
      }
      if ("string" != typeof b) {
        var e = this.getRegionCodeForCountryCode(b.getCountryCodeOrDefault());
        if (e != i18n.phonenumbers.PhoneNumberUtil.UNKNOWN_REGION_) {
          try {
            c = this.parse(a, e);
          } catch (h) {
            return i18n.phonenumbers.PhoneNumberUtil.MatchType.NOT_A_NUMBER;
          }
          c = this.isNumberMatch(c, b);
          return c == i18n.phonenumbers.PhoneNumberUtil.MatchType.EXACT_MATCH ? i18n.phonenumbers.PhoneNumberUtil.MatchType.NSN_MATCH : c;
        }
      }
      try {
        c = this.parseHelper_(a, null, !1, !1);
      } catch (h) {
        return i18n.phonenumbers.PhoneNumberUtil.MatchType.NOT_A_NUMBER;
      }
    }
  } else {
    c = a.clone();
  }
  if ("string" == typeof b) {
    try {
      return d = this.parse(b, i18n.phonenumbers.PhoneNumberUtil.UNKNOWN_REGION_), this.isNumberMatch(a, d);
    } catch (g) {
      return g != i18n.phonenumbers.Error.INVALID_COUNTRY_CODE ? i18n.phonenumbers.PhoneNumberUtil.MatchType.NOT_A_NUMBER : this.isNumberMatch(b, c);
    }
  } else {
    d = b.clone();
  }
  c.clearRawInput();
  c.clearCountryCodeSource();
  c.clearPreferredDomesticCarrierCode();
  d.clearRawInput();
  d.clearCountryCodeSource();
  d.clearPreferredDomesticCarrierCode();
  c.hasExtension() && 0 == c.getExtension().length && c.clearExtension();
  d.hasExtension() && 0 == d.getExtension().length && d.clearExtension();
  if (c.hasExtension() && d.hasExtension() && c.getExtension() != d.getExtension()) {
    return i18n.phonenumbers.PhoneNumberUtil.MatchType.NO_MATCH;
  }
  var e = c.getCountryCodeOrDefault(), f = d.getCountryCodeOrDefault();
  if (0 != e && 0 != f) {
    return c.equals(d) ? i18n.phonenumbers.PhoneNumberUtil.MatchType.EXACT_MATCH : e == f && this.isNationalNumberSuffixOfTheOther_(c, d) ? i18n.phonenumbers.PhoneNumberUtil.MatchType.SHORT_NSN_MATCH : i18n.phonenumbers.PhoneNumberUtil.MatchType.NO_MATCH;
  }
  c.setCountryCode(0);
  d.setCountryCode(0);
  return c.equals(d) ? i18n.phonenumbers.PhoneNumberUtil.MatchType.NSN_MATCH : this.isNationalNumberSuffixOfTheOther_(c, d) ? i18n.phonenumbers.PhoneNumberUtil.MatchType.SHORT_NSN_MATCH : i18n.phonenumbers.PhoneNumberUtil.MatchType.NO_MATCH;
};
i18n.phonenumbers.PhoneNumberUtil.prototype.isNationalNumberSuffixOfTheOther_ = function(a, b) {
  var c = "" + a.getNationalNumber(), d = "" + b.getNationalNumber();
  return goog.string.endsWith(c, d) || goog.string.endsWith(d, c);
};
i18n.phonenumbers.PhoneNumberUtil.prototype.canBeInternationallyDialled = function(a) {
  var b = this.getMetadataForRegion(this.getRegionCodeForNumber(a));
  if (null == b) {
    return !0;
  }
  a = this.getNationalSignificantNumber(a);
  return !this.isNumberMatchingDesc_(a, b.getNoInternationalDialling());
};
i18n.phonenumbers.PhoneNumberUtil.matchesEntirely_ = function(a, b) {
  var c = "string" == typeof a ? b.match("^(?:" + a + ")$") : b.match(a);
  return c && c[0].length == b.length ? !0 : !1;
};
i18n.phonenumbers.AsYouTypeFormatter = function(a) {
  this.DIGIT_PLACEHOLDER_ = "\u2008";
  this.DIGIT_PATTERN_ = new RegExp(this.DIGIT_PLACEHOLDER_);
  this.currentOutput_ = "";
  this.formattingTemplate_ = new goog.string.StringBuffer;
  this.currentFormattingPattern_ = "";
  this.accruedInput_ = new goog.string.StringBuffer;
  this.accruedInputWithoutFormatting_ = new goog.string.StringBuffer;
  this.ableToFormat_ = !0;
  this.isExpectingCountryCallingCode_ = this.isCompleteNumber_ = this.inputHasFormatting_ = !1;
  this.phoneUtil_ = i18n.phonenumbers.PhoneNumberUtil.getInstance();
  this.positionToRemember_ = this.originalPosition_ = this.lastMatchPosition_ = 0;
  this.prefixBeforeNationalNumber_ = new goog.string.StringBuffer;
  this.shouldAddSpaceAfterNationalPrefix_ = !1;
  this.extractedNationalPrefix_ = "";
  this.nationalNumber_ = new goog.string.StringBuffer;
  this.possibleFormats_ = [];
  this.defaultCountry_ = a;
  this.defaultMetadata_ = this.currentMetadata_ = this.getMetadataForRegion_(this.defaultCountry_);
};
i18n.phonenumbers.AsYouTypeFormatter.SEPARATOR_BEFORE_NATIONAL_NUMBER_ = " ";
i18n.phonenumbers.AsYouTypeFormatter.EMPTY_METADATA_ = new i18n.phonenumbers.PhoneMetadata;
i18n.phonenumbers.AsYouTypeFormatter.EMPTY_METADATA_.setInternationalPrefix("NA");
i18n.phonenumbers.AsYouTypeFormatter.CHARACTER_CLASS_PATTERN_ = /\[([^\[\]])*\]/g;
i18n.phonenumbers.AsYouTypeFormatter.STANDALONE_DIGIT_PATTERN_ = /\d(?=[^,}][^,}])/g;
i18n.phonenumbers.AsYouTypeFormatter.ELIGIBLE_FORMAT_PATTERN_ = new RegExp("^[" + i18n.phonenumbers.PhoneNumberUtil.VALID_PUNCTUATION + "]*(\\$\\d[" + i18n.phonenumbers.PhoneNumberUtil.VALID_PUNCTUATION + "]*)+$");
i18n.phonenumbers.AsYouTypeFormatter.NATIONAL_PREFIX_SEPARATORS_PATTERN_ = /[- ]/;
i18n.phonenumbers.AsYouTypeFormatter.MIN_LEADING_DIGITS_LENGTH_ = 3;
i18n.phonenumbers.AsYouTypeFormatter.prototype.getMetadataForRegion_ = function(a) {
  a = this.phoneUtil_.getCountryCodeForRegion(a);
  a = this.phoneUtil_.getRegionCodeForCountryCode(a);
  a = this.phoneUtil_.getMetadataForRegion(a);
  return null != a ? a : i18n.phonenumbers.AsYouTypeFormatter.EMPTY_METADATA_;
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.maybeCreateNewTemplate_ = function() {
  for (var a = this.possibleFormats_.length, b = 0;b < a;++b) {
    var c = this.possibleFormats_[b], d = c.getPatternOrDefault();
    if (this.currentFormattingPattern_ == d) {
      return !1;
    }
    if (this.createFormattingTemplate_(c)) {
      return this.currentFormattingPattern_ = d, this.shouldAddSpaceAfterNationalPrefix_ = i18n.phonenumbers.AsYouTypeFormatter.NATIONAL_PREFIX_SEPARATORS_PATTERN_.test(c.getNationalPrefixFormattingRule()), this.lastMatchPosition_ = 0, !0;
    }
  }
  return this.ableToFormat_ = !1;
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.getAvailableFormats_ = function(a) {
  for (var b = this.isCompleteNumber_ && 0 < this.currentMetadata_.intlNumberFormatCount() ? this.currentMetadata_.intlNumberFormatArray() : this.currentMetadata_.numberFormatArray(), c = b.length, d = 0;d < c;++d) {
    var e = b[d];
    (!this.currentMetadata_.hasNationalPrefix() || this.isCompleteNumber_ || e.getNationalPrefixOptionalWhenFormatting() || this.phoneUtil_.formattingRuleHasFirstGroupOnly(e.getNationalPrefixFormattingRuleOrDefault())) && this.isFormatEligible_(e.getFormatOrDefault()) && this.possibleFormats_.push(e);
  }
  this.narrowDownPossibleFormats_(a);
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.isFormatEligible_ = function(a) {
  return i18n.phonenumbers.AsYouTypeFormatter.ELIGIBLE_FORMAT_PATTERN_.test(a);
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.narrowDownPossibleFormats_ = function(a) {
  for (var b = [], c = a.length - i18n.phonenumbers.AsYouTypeFormatter.MIN_LEADING_DIGITS_LENGTH_, d = this.possibleFormats_.length, e = 0;e < d;++e) {
    var f = this.possibleFormats_[e];
    if (0 == f.leadingDigitsPatternCount()) {
      b.push(this.possibleFormats_[e]);
    } else {
      var g = Math.min(c, f.leadingDigitsPatternCount() - 1), f = f.getLeadingDigitsPattern(g);
      0 == a.search(f) && b.push(this.possibleFormats_[e]);
    }
  }
  this.possibleFormats_ = b;
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.createFormattingTemplate_ = function(a) {
  var b = a.getPatternOrDefault();
  if (-1 != b.indexOf("|")) {
    return !1;
  }
  b = b.replace(i18n.phonenumbers.AsYouTypeFormatter.CHARACTER_CLASS_PATTERN_, "\\d");
  b = b.replace(i18n.phonenumbers.AsYouTypeFormatter.STANDALONE_DIGIT_PATTERN_, "\\d");
  this.formattingTemplate_.clear();
  a = this.getFormattingTemplate_(b, a.getFormatOrDefault());
  return 0 < a.length ? (this.formattingTemplate_.append(a), !0) : !1;
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.getFormattingTemplate_ = function(a, b) {
  var c = "999999999999999".match(a)[0];
  if (c.length < this.nationalNumber_.getLength()) {
    return "";
  }
  c = c.replace(new RegExp(a, "g"), b);
  return c = c.replace(RegExp("9", "g"), this.DIGIT_PLACEHOLDER_);
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.clear = function() {
  this.currentOutput_ = "";
  this.accruedInput_.clear();
  this.accruedInputWithoutFormatting_.clear();
  this.formattingTemplate_.clear();
  this.lastMatchPosition_ = 0;
  this.currentFormattingPattern_ = "";
  this.prefixBeforeNationalNumber_.clear();
  this.extractedNationalPrefix_ = "";
  this.nationalNumber_.clear();
  this.ableToFormat_ = !0;
  this.inputHasFormatting_ = !1;
  this.originalPosition_ = this.positionToRemember_ = 0;
  this.isExpectingCountryCallingCode_ = this.isCompleteNumber_ = !1;
  this.possibleFormats_ = [];
  this.shouldAddSpaceAfterNationalPrefix_ = !1;
  this.currentMetadata_ != this.defaultMetadata_ && (this.currentMetadata_ = this.getMetadataForRegion_(this.defaultCountry_));
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.inputDigit = function(a) {
  return this.currentOutput_ = this.inputDigitWithOptionToRememberPosition_(a, !1);
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.inputDigitAndRememberPosition = function(a) {
  return this.currentOutput_ = this.inputDigitWithOptionToRememberPosition_(a, !0);
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.inputDigitWithOptionToRememberPosition_ = function(a, b) {
  this.accruedInput_.append(a);
  b && (this.originalPosition_ = this.accruedInput_.getLength());
  this.isDigitOrLeadingPlusSign_(a) ? a = this.normalizeAndAccrueDigitsAndPlusSign_(a, b) : (this.ableToFormat_ = !1, this.inputHasFormatting_ = !0);
  if (!this.ableToFormat_) {
    if (!this.inputHasFormatting_) {
      if (this.attemptToExtractIdd_()) {
        if (this.attemptToExtractCountryCallingCode_()) {
          return this.attemptToChoosePatternWithPrefixExtracted_();
        }
      } else {
        if (this.ableToExtractLongerNdd_()) {
          return this.prefixBeforeNationalNumber_.append(i18n.phonenumbers.AsYouTypeFormatter.SEPARATOR_BEFORE_NATIONAL_NUMBER_), this.attemptToChoosePatternWithPrefixExtracted_();
        }
      }
    }
    return this.accruedInput_.toString();
  }
  switch(this.accruedInputWithoutFormatting_.getLength()) {
    case 0:
    ;
    case 1:
    ;
    case 2:
      return this.accruedInput_.toString();
    case 3:
      if (this.attemptToExtractIdd_()) {
        this.isExpectingCountryCallingCode_ = !0;
      } else {
        return this.extractedNationalPrefix_ = this.removeNationalPrefixFromNationalNumber_(), this.attemptToChooseFormattingPattern_();
      }
    ;
    default:
      if (this.isExpectingCountryCallingCode_) {
        return this.attemptToExtractCountryCallingCode_() && (this.isExpectingCountryCallingCode_ = !1), this.prefixBeforeNationalNumber_.toString() + this.nationalNumber_.toString();
      }
      if (0 < this.possibleFormats_.length) {
        var c = this.inputDigitHelper_(a), d = this.attemptToFormatAccruedDigits_();
        if (0 < d.length) {
          return d;
        }
        this.narrowDownPossibleFormats_(this.nationalNumber_.toString());
        return this.maybeCreateNewTemplate_() ? this.inputAccruedNationalNumber_() : this.ableToFormat_ ? this.appendNationalNumber_(c) : this.accruedInput_.toString();
      }
      return this.attemptToChooseFormattingPattern_();
  }
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.attemptToChoosePatternWithPrefixExtracted_ = function() {
  this.ableToFormat_ = !0;
  this.isExpectingCountryCallingCode_ = !1;
  this.possibleFormats_ = [];
  this.lastMatchPosition_ = 0;
  this.formattingTemplate_.clear();
  this.currentFormattingPattern_ = "";
  return this.attemptToChooseFormattingPattern_();
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.getExtractedNationalPrefix_ = function() {
  return this.extractedNationalPrefix_;
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.ableToExtractLongerNdd_ = function() {
  if (0 < this.extractedNationalPrefix_.length) {
    var a = this.nationalNumber_.toString();
    this.nationalNumber_.clear();
    this.nationalNumber_.append(this.extractedNationalPrefix_);
    this.nationalNumber_.append(a);
    var a = this.prefixBeforeNationalNumber_.toString(), b = a.lastIndexOf(this.extractedNationalPrefix_);
    this.prefixBeforeNationalNumber_.clear();
    this.prefixBeforeNationalNumber_.append(a.substring(0, b));
  }
  return this.extractedNationalPrefix_ != this.removeNationalPrefixFromNationalNumber_();
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.isDigitOrLeadingPlusSign_ = function(a) {
  return i18n.phonenumbers.PhoneNumberUtil.CAPTURING_DIGIT_PATTERN.test(a) || 1 == this.accruedInput_.getLength() && i18n.phonenumbers.PhoneNumberUtil.PLUS_CHARS_PATTERN.test(a);
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.attemptToFormatAccruedDigits_ = function() {
  for (var a = this.nationalNumber_.toString(), b = this.possibleFormats_.length, c = 0;c < b;++c) {
    var d = this.possibleFormats_[c], e = d.getPatternOrDefault();
    if ((new RegExp("^(?:" + e + ")$")).test(a)) {
      return this.shouldAddSpaceAfterNationalPrefix_ = i18n.phonenumbers.AsYouTypeFormatter.NATIONAL_PREFIX_SEPARATORS_PATTERN_.test(d.getNationalPrefixFormattingRule()), a = a.replace(new RegExp(e, "g"), d.getFormat()), this.appendNationalNumber_(a);
    }
  }
  return "";
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.appendNationalNumber_ = function(a) {
  var b = this.prefixBeforeNationalNumber_.getLength();
  return this.shouldAddSpaceAfterNationalPrefix_ && 0 < b && this.prefixBeforeNationalNumber_.toString().charAt(b - 1) != i18n.phonenumbers.AsYouTypeFormatter.SEPARATOR_BEFORE_NATIONAL_NUMBER_ ? this.prefixBeforeNationalNumber_ + i18n.phonenumbers.AsYouTypeFormatter.SEPARATOR_BEFORE_NATIONAL_NUMBER_ + a : this.prefixBeforeNationalNumber_ + a;
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.getRememberedPosition = function() {
  if (!this.ableToFormat_) {
    return this.originalPosition_;
  }
  for (var a = 0, b = 0, c = this.accruedInputWithoutFormatting_.toString(), d = this.currentOutput_.toString();a < this.positionToRemember_ && b < d.length;) {
    c.charAt(a) == d.charAt(b) && a++, b++;
  }
  return b;
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.attemptToChooseFormattingPattern_ = function() {
  var a = this.nationalNumber_.toString();
  return a.length >= i18n.phonenumbers.AsYouTypeFormatter.MIN_LEADING_DIGITS_LENGTH_ ? (this.getAvailableFormats_(a), a = this.attemptToFormatAccruedDigits_(), 0 < a.length ? a : this.maybeCreateNewTemplate_() ? this.inputAccruedNationalNumber_() : this.accruedInput_.toString()) : this.appendNationalNumber_(a);
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.inputAccruedNationalNumber_ = function() {
  var a = this.nationalNumber_.toString(), b = a.length;
  if (0 < b) {
    for (var c = "", d = 0;d < b;d++) {
      c = this.inputDigitHelper_(a.charAt(d));
    }
    return this.ableToFormat_ ? this.appendNationalNumber_(c) : this.accruedInput_.toString();
  }
  return this.prefixBeforeNationalNumber_.toString();
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.isNanpaNumberWithNationalPrefix_ = function() {
  if (1 != this.currentMetadata_.getCountryCode()) {
    return !1;
  }
  var a = this.nationalNumber_.toString();
  return "1" == a.charAt(0) && "0" != a.charAt(1) && "1" != a.charAt(1);
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.removeNationalPrefixFromNationalNumber_ = function() {
  var a = this.nationalNumber_.toString(), b = 0;
  if (this.isNanpaNumberWithNationalPrefix_()) {
    b = 1, this.prefixBeforeNationalNumber_.append("1").append(i18n.phonenumbers.AsYouTypeFormatter.SEPARATOR_BEFORE_NATIONAL_NUMBER_), this.isCompleteNumber_ = !0;
  } else {
    if (this.currentMetadata_.hasNationalPrefixForParsing()) {
      var c = new RegExp("^(?:" + this.currentMetadata_.getNationalPrefixForParsing() + ")"), c = a.match(c);
      null != c && null != c[0] && 0 < c[0].length && (this.isCompleteNumber_ = !0, b = c[0].length, this.prefixBeforeNationalNumber_.append(a.substring(0, b)));
    }
  }
  this.nationalNumber_.clear();
  this.nationalNumber_.append(a.substring(b));
  return a.substring(0, b);
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.attemptToExtractIdd_ = function() {
  var a = this.accruedInputWithoutFormatting_.toString(), b = new RegExp("^(?:\\" + i18n.phonenumbers.PhoneNumberUtil.PLUS_SIGN + "|" + this.currentMetadata_.getInternationalPrefix() + ")"), b = a.match(b);
  return null != b && null != b[0] && 0 < b[0].length ? (this.isCompleteNumber_ = !0, b = b[0].length, this.nationalNumber_.clear(), this.nationalNumber_.append(a.substring(b)), this.prefixBeforeNationalNumber_.clear(), this.prefixBeforeNationalNumber_.append(a.substring(0, b)), a.charAt(0) != i18n.phonenumbers.PhoneNumberUtil.PLUS_SIGN && this.prefixBeforeNationalNumber_.append(i18n.phonenumbers.AsYouTypeFormatter.SEPARATOR_BEFORE_NATIONAL_NUMBER_), !0) : !1;
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.attemptToExtractCountryCallingCode_ = function() {
  if (0 == this.nationalNumber_.getLength()) {
    return !1;
  }
  var a = new goog.string.StringBuffer, b = this.phoneUtil_.extractCountryCode(this.nationalNumber_, a);
  if (0 == b) {
    return !1;
  }
  this.nationalNumber_.clear();
  this.nationalNumber_.append(a.toString());
  a = this.phoneUtil_.getRegionCodeForCountryCode(b);
  i18n.phonenumbers.PhoneNumberUtil.REGION_CODE_FOR_NON_GEO_ENTITY == a ? this.currentMetadata_ = this.phoneUtil_.getMetadataForNonGeographicalRegion(b) : a != this.defaultCountry_ && (this.currentMetadata_ = this.getMetadataForRegion_(a));
  this.prefixBeforeNationalNumber_.append("" + b).append(i18n.phonenumbers.AsYouTypeFormatter.SEPARATOR_BEFORE_NATIONAL_NUMBER_);
  this.extractedNationalPrefix_ = "";
  return !0;
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.normalizeAndAccrueDigitsAndPlusSign_ = function(a, b) {
  var c;
  a == i18n.phonenumbers.PhoneNumberUtil.PLUS_SIGN ? (c = a, this.accruedInputWithoutFormatting_.append(a)) : (c = i18n.phonenumbers.PhoneNumberUtil.DIGIT_MAPPINGS[a], this.accruedInputWithoutFormatting_.append(c), this.nationalNumber_.append(c));
  b && (this.positionToRemember_ = this.accruedInputWithoutFormatting_.getLength());
  return c;
};
i18n.phonenumbers.AsYouTypeFormatter.prototype.inputDigitHelper_ = function(a) {
  var b = this.formattingTemplate_.toString();
  if (0 <= b.substring(this.lastMatchPosition_).search(this.DIGIT_PATTERN_)) {
    var c = b.search(this.DIGIT_PATTERN_);
    a = b.replace(this.DIGIT_PATTERN_, a);
    this.formattingTemplate_.clear();
    this.formattingTemplate_.append(a);
    this.lastMatchPosition_ = c;
    return a.substring(0, this.lastMatchPosition_ + 1);
  }
  1 == this.possibleFormats_.length && (this.ableToFormat_ = !1);
  this.currentFormattingPattern_ = "";
  return this.accruedInput_.toString();
};

/*

Compiled Wednesday July 30, 2014 at 2:15pm America/New_York

Version: libphonenumber r680

------------------------------------------------------------------------


 Copyright (C) Alan Beebe (alan.beebe@gmail.com).

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.



Usage...

This is the same type of code used by cell phones when you enter
a phone number into your dialer app.  Your phone already knows
what country you are a subscriber in, so it assumes you are entering
a local number, unless of course you prefix the number with a +, or
in the USA you could also prefix the number with 011 to indicate you
wish to dial internationally.  This code functions the same way.

Lets assume your in the United States and you enter the following
phone number: 8646978257

formatE164("US", "8646978257");
 Returns: +18646978257

countryForE164Number("US", "+18646978257");
 Returns: US

formatInternational("US", "8646978257");
 Returns: (864) 697-8257
 Info: This is the format you use if you are displaying this number to users outside the US

formatLocal("US", "8646978257");
 Returns: (864) 697-8257
 Info: This is the format you use if you are displaying this number to users inside the US
       (In certain countries, this format will be different then the international format)

countryCodeToName("US");
 Returns: United States



*/


// -------------------------------------------------------------------------
function countryForE164Number(phone) {
    /*

    Return the country code for an e164 formatted number

    phone (String) phone number in e164 format to return the country code for

    */
    try {
        var phone = cleanPhone(phone);
        var phoneUtil = i18n.phonenumbers.PhoneNumberUtil.getInstance();
        var number = phoneUtil.parseAndKeepRawInput(phone);
        var output = new goog.string.StringBuffer();
        output = phoneUtil.getRegionCodeForNumber(number);
        return output.toString();
    } catch (e) {
        return "";
    }
}

// -------------------------------------------------------------------------
function formatNumberForMobileDialing(country, phone) {
    /*

    Returns a number formatted in such a way that it can be dialed from a mobile
    phone in a specific region. If the number cannot be reached from the region
    (e.g. some countries block toll-free numbers from being called outside of the
    country), the method returns an empty string.

    */

    try {
        var phone = cleanPhone(phone);
        var phoneUtil = i18n.phonenumbers.PhoneNumberUtil.getInstance();
        var number = phoneUtil.parseAndKeepRawInput(phone, country);
        var output = new goog.string.StringBuffer();
        output = phoneUtil.formatNumberForMobileDialing(number, country, true);
        return output.toString();
    } catch (e) {
        return "";
    }
}

// -------------------------------------------------------------------------
function isValidNumber(phone, country) {
    /*

    Tests whether a phone number matches a valid pattern. Note this doesn't
    verify the number is actually in use, which is impossible to tell by just
    looking at a number itself.

    */

    try {
        var phone = cleanPhone(phone);
        var phoneUtil = i18n.phonenumbers.PhoneNumberUtil.getInstance();
        var number = phoneUtil.parseAndKeepRawInput(phone, country);
        return phoneUtil.isValidNumber(number);
    } catch (e) {
        return false;
    }
}

// -------------------------------------------------------------------------
function formatE164(country, phone) {
    /*

    Return the phone number in e164 format

    country (String) 2 digit country code
    phone (String) phone number to format

    */

    try {
        var phone = cleanPhone(phone);
        var phoneUtil = i18n.phonenumbers.PhoneNumberUtil.getInstance();
        var number = phoneUtil.parseAndKeepRawInput(phone, country);
        var PNF = i18n.phonenumbers.PhoneNumberFormat;
        var output = new goog.string.StringBuffer();
        output = phoneUtil.format(number, PNF.E164);
        return output.toString();
    } catch (e) {
        return phone
    }
}


// -------------------------------------------------------------------------
function formatInternational(country, phone) {
    /*

    Return the phone number in international format

    country (String) 2 digit country code
    phone (String) phone number to format

    */

    try {
        var phone = cleanPhone(phone);
        var formatter = new i18n.phonenumbers.AsYouTypeFormatter(country);
        var output = new goog.string.StringBuffer();
        for (var i = 0; i < phone.length; ++i) {
            var inputChar = phone.charAt(i);
            output = (formatter.inputDigit(inputChar));
        }
        return output.toString();
    } catch (e) {
        return phone;
    }
}

// -------------------------------------------------------------------------
function formatLocal(country, phone) {
    /*

    Return the phone number in the format local to the user

    country (String) 2 digit country code
    phone (String) phone number to format

    */

    try {
        var phone = cleanPhone(phone);
        var phoneUtil = i18n.phonenumbers.PhoneNumberUtil.getInstance();
        var number = phoneUtil.parseAndKeepRawInput(phone, country);
        if (phoneUtil.isValidNumberForRegion(number, country)) {
            var PNF = i18n.phonenumbers.PhoneNumberFormat;
            var output = new goog.string.StringBuffer();
            output = phoneUtil.format(number, PNF.NATIONAL);
            return output.toString();
        } else {
            return formatInternational(country, phone);
        }
    } catch (e) {
        return formatInternational(country, phone);
    }
}

// -------------------------------------------------------------------------
function exampleLandlineNumber(country) {
    /*

    Returns an example land line phone number for the specified country

    country (String) 2 digit country code

    */

    try {
        var phoneUtil = i18n.phonenumbers.PhoneNumberUtil.getInstance();
        var output = phoneUtil.getExampleNumber(country);
        return ""+output.getNationalNumber();
    } catch (e) {
        return "";
    }
}

// -------------------------------------------------------------------------
function exampleMobileNumber(country) {
    /*

    Returns an example mobile phone number for the specified country

    country (String) 2 digit country code

    */

    try {
        var phoneUtil = i18n.phonenumbers.PhoneNumberUtil.getInstance();
        var output = phoneUtil.getExampleNumberForType(country, i18n.phonenumbers.PhoneNumberType.MOBILE);
        return ""+output.getNationalNumber();
    } catch (e) {
        return "";
    }
}

// -------------------------------------------------------------------------
function cleanPhone(phone) {
    /*

    Remove any non numeric characters from the phone number but leave any plus sign at the beginning

    phone (String) phone number to clean

    */

    phone = phone.replace(/[^\d\+]/g,'');
    if (phone.substr(0, 1) == "+") {
        phone = "+" + phone.replace(/[^\d]/g,'');
    } else {
        phone = phone.replace(/[^\d]/g,'');
    }
    return phone;
}

// -------------------------------------------------------------------------
function countryCodeToName(countryCode) {
    /*

    Convert the country code to a name

    country (String) 2 digit country code

    */

    var arrCountry = new Array();
    arrCountry['AF'] = "Afghanistan";
    arrCountry['AL'] = "Albania";
    arrCountry['DZ'] = "Algeria";
    arrCountry['AS'] = "American Samoa";
    arrCountry['AD'] = "Andorra";
    arrCountry['AO'] = "Angola";
    arrCountry['AI'] = "Anguilla";
    arrCountry['AQ'] = "Antarctica";
    arrCountry['AG'] = "Antigua And Barbuda";
    arrCountry['AR'] = "Argentina";
    arrCountry['AM'] = "Armenia";
    arrCountry['AW'] = "Aruba";
    arrCountry['AC'] = "Ascension Island";
    arrCountry['AU'] = "Australia";
    arrCountry['AT'] = "Austria";
    arrCountry['AZ'] = "Azerbaijan";
    arrCountry['BS'] = "Bahamas";
    arrCountry['BH'] = "Bahrain";
    arrCountry['BD'] = "Bangladesh";
    arrCountry['BB'] = "Barbados";
    arrCountry['BY'] = "Belarus";
    arrCountry['BE'] = "Belgium";
    arrCountry['BZ'] = "Belize";
    arrCountry['BJ'] = "Benin";
    arrCountry['BM'] = "Bermuda";
    arrCountry['BT'] = "Bhutan";
    arrCountry['BO'] = "Bolivia";
    arrCountry['BA'] = "Bosnia And Herzegovina";
    arrCountry['BW'] = "Botswana";
    arrCountry['BV'] = "Bouvet Island";
    arrCountry['BR'] = "Brazil";
    arrCountry['IO'] = "British Indian Ocean Territory";
    arrCountry['BN'] = "Brunei";
    arrCountry['BG'] = "Bulgaria";
    arrCountry['BF'] = "Burkina Faso";
    arrCountry['BI'] = "Burundi";
    arrCountry['KH'] = "Cambodia";
    arrCountry['CM'] = "Cameroon";
    arrCountry['CA'] = "Canada";
    arrCountry['CV'] = "Cape Verde";
    arrCountry['KY'] = "Cayman Islands";
    arrCountry['CF'] = "Central African Republic";
    arrCountry['TD'] = "Chad";
    arrCountry['CL'] = "Chile";
    arrCountry['CN'] = "China";
    arrCountry['CX'] = "Christmas Island";
    arrCountry['CC'] = "Cocos (Keeling) Islands";
    arrCountry['CO'] = "Columbia";
    arrCountry['KM'] = "Comoros";
    arrCountry['CG'] = "Congo";
    arrCountry['CK'] = "Cook Islands";
    arrCountry['CR'] = "Costa Rica";
    arrCountry['CI'] = "Cote D'Ivorie (Ivory Coast)";
    arrCountry['HR'] = "Croatia (Hrvatska)";
    arrCountry['CU'] = "Cuba";
    arrCountry['CY'] = "Cyprus";
    arrCountry['CZ'] = "Czech Republic";
    arrCountry['CD'] = "Democratic Republic Of Congo (Zaire)";
    arrCountry['DK'] = "Denmark";
    arrCountry['DJ'] = "Djibouti";
    arrCountry['DM'] = "Dominica";
    arrCountry['DO'] = "Dominican Republic";
    arrCountry['TL'] = "East Timor";
    arrCountry['EC'] = "Ecuador";
    arrCountry['EG'] = "Egypt";
    arrCountry['SV'] = "El Salvador";
    arrCountry['GQ'] = "Equatorial Guinea";
    arrCountry['ER'] = "Eritrea";
    arrCountry['EE'] = "Estonia";
    arrCountry['ET'] = "Ethiopia";
    arrCountry['FK'] = "Falkland Islands (Malvinas)";
    arrCountry['FO'] = "Faroe Islands";
    arrCountry['FJ'] = "Fiji";
    arrCountry['FI'] = "Finland";
    arrCountry['FR'] = "France";
    arrCountry['FX'] = "France, Metropolitan";
    arrCountry['GF'] = "French Guinea";
    arrCountry['PF'] = "French Polynesia";
    arrCountry['TF'] = "French Southern Territories";
    arrCountry['GA'] = "Gabon";
    arrCountry['GM'] = "Gambia";
    arrCountry['GE'] = "Georgia";
    arrCountry['DE'] = "Germany";
    arrCountry['GH'] = "Ghana";
    arrCountry['GI'] = "Gibraltar";
    arrCountry['GR'] = "Greece";
    arrCountry['GL'] = "Greenland";
    arrCountry['GD'] = "Grenada";
    arrCountry['GP'] = "Guadeloupe";
    arrCountry['GU'] = "Guam";
    arrCountry['GT'] = "Guatemala";
    arrCountry['GN'] = "Guinea";
    arrCountry['GW'] = "Guinea-Bissau";
    arrCountry['GY'] = "Guyana";
    arrCountry['HT'] = "Haiti";
    arrCountry['HM'] = "Heard And McDonald Islands";
    arrCountry['HN'] = "Honduras";
    arrCountry['HK'] = "Hong Kong";
    arrCountry['HU'] = "Hungary";
    arrCountry['IS'] = "Iceland";
    arrCountry['IN'] = "India";
    arrCountry['ID'] = "Indonesia";
    arrCountry['IR'] = "Iran";
    arrCountry['IQ'] = "Iraq";
    arrCountry['IE'] = "Ireland";
    arrCountry['IM'] = "Isle of Man";
    arrCountry['IL'] = "Israel";
    arrCountry['IT'] = "Italy";
    arrCountry['JM'] = "Jamaica";
    arrCountry['JP'] = "Japan";
    arrCountry['JO'] = "Jordan";
    arrCountry['KZ'] = "Kazakhstan";
    arrCountry['KE'] = "Kenya";
    arrCountry['KI'] = "Kiribati";
    arrCountry['KW'] = "Kuwait";
    arrCountry['KG'] = "Kyrgyzstan";
    arrCountry['LA'] = "Laos";
    arrCountry['LV'] = "Latvia";
    arrCountry['LB'] = "Lebanon";
    arrCountry['LS'] = "Lesotho";
    arrCountry['LR'] = "Liberia";
    arrCountry['LY'] = "Libya";
    arrCountry['LI'] = "Liechtenstein";
    arrCountry['LT'] = "Lithuania";
    arrCountry['LU'] = "Luxembourg";
    arrCountry['MO'] = "Macau";
    arrCountry['MK'] = "Macedonia";
    arrCountry['MG'] = "Madagascar";
    arrCountry['MW'] = "Malawi";
    arrCountry['MY'] = "Malaysia";
    arrCountry['MV'] = "Maldives";
    arrCountry['ML'] = "Mali";
    arrCountry['MT'] = "Malta";
    arrCountry['MH'] = "Marshall Islands";
    arrCountry['MQ'] = "Martinique";
    arrCountry['MR'] = "Mauritania";
    arrCountry['MU'] = "Mauritius";
    arrCountry['YT'] = "Mayotte";
    arrCountry['MX'] = "Mexico";
    arrCountry['FM'] = "Micronesia";
    arrCountry['MD'] = "Moldova";
    arrCountry['MC'] = "Monaco";
    arrCountry['MN'] = "Mongolia";
    arrCountry['ME'] = "Montenegro";
    arrCountry['MS'] = "Montserrat";
    arrCountry['MA'] = "Morocco";
    arrCountry['MZ'] = "Mozambique";
    arrCountry['MM'] = "Myanmar (Burma)";
    arrCountry['NA'] = "Namibia";
    arrCountry['NR'] = "Nauru";
    arrCountry['NP'] = "Nepal";
    arrCountry['NL'] = "Netherlands";
    arrCountry['AN'] = "Netherlands Antilles";
    arrCountry['NC'] = "New Caledonia";
    arrCountry['NZ'] = "New Zealand";
    arrCountry['NI'] = "Nicaragua";
    arrCountry['NE'] = "Niger";
    arrCountry['NG'] = "Nigeria";
    arrCountry['NU'] = "Niue";
    arrCountry['NF'] = "Norfolk Island";
    arrCountry['KP'] = "North Korea";
    arrCountry['MP'] = "Northern Mariana Islands";
    arrCountry['NO'] = "Norway";
    arrCountry['OM'] = "Oman";
    arrCountry['PK'] = "Pakistan";
    arrCountry['PW'] = "Palau";
    arrCountry['PS'] = "Palestine";
    arrCountry['PA'] = "Panama";
    arrCountry['PG'] = "Papua New Guinea";
    arrCountry['PY'] = "Paraguay";
    arrCountry['PE'] = "Peru";
    arrCountry['PH'] = "Philippines";
    arrCountry['PN'] = "Pitcairn";
    arrCountry['PL'] = "Poland";
    arrCountry['PT'] = "Portugal";
    arrCountry['PR'] = "Puerto Rico";
    arrCountry['QA'] = "Qatar";
    arrCountry['RE'] = "Reunion";
    arrCountry['RO'] = "Romania";
    arrCountry['RU'] = "Russia";
    arrCountry['RW'] = "Rwanda";
    arrCountry['SH'] = "Saint Helena";
    arrCountry['KN'] = "Saint Kitts And Nevis";
    arrCountry['LC'] = "Saint Lucia";
    arrCountry['PM'] = "Saint Pierre And Miquelon";
    arrCountry['VC'] = "Saint Vincent And The Grenadines";
    arrCountry['SM'] = "San Marino";
    arrCountry['ST'] = "Sao Tome And Principe";
    arrCountry['SA'] = "Saudi Arabia";
    arrCountry['SN'] = "Senegal";
    arrCountry['RS'] = "Serbia";
    arrCountry['SC'] = "Seychelles";
    arrCountry['SL'] = "Sierra Leone";
    arrCountry['SG'] = "Singapore";
    arrCountry['SK'] = "Slovak Republic";
    arrCountry['SI'] = "Slovenia";
    arrCountry['SB'] = "Solomon Islands";
    arrCountry['SO'] = "Somalia";
    arrCountry['ZA'] = "South Africa";
    arrCountry['GS'] = "South Georgia And South Sandwich Islands";
    arrCountry['KR'] = "South Korea";
    arrCountry['ES'] = "Spain";
    arrCountry['LK'] = "Sri Lanka";
    arrCountry['SD'] = "Sudan";
    arrCountry['SR'] = "Suriname";
    arrCountry['SJ'] = "Svalbard And Jan Mayen";
    arrCountry['SZ'] = "Swaziland";
    arrCountry['SE'] = "Sweden";
    arrCountry['CH'] = "Switzerland";
    arrCountry['SY'] = "Syria";
    arrCountry['TW'] = "Taiwan";
    arrCountry['TJ'] = "Tajikistan";
    arrCountry['TZ'] = "Tanzania";
    arrCountry['TH'] = "Thailand";
    arrCountry['TG'] = "Togo";
    arrCountry['TK'] = "Tokelau";
    arrCountry['TO'] = "Tonga";
    arrCountry['TT'] = "Trinidad And Tobago";
    arrCountry['TN'] = "Tunisia";
    arrCountry['TR'] = "Turkey";
    arrCountry['TM'] = "Turkmenistan";
    arrCountry['TC'] = "Turks And Caicos Islands";
    arrCountry['TV'] = "Tuvalu";
    arrCountry['UG'] = "Uganda";
    arrCountry['UA'] = "Ukraine";
    arrCountry['AE'] = "United Arab Emirates";
    arrCountry['GB'] = "United Kingdom";
    arrCountry['US'] = "United States";
    arrCountry['UM'] = "United States Minor Outlying Islands";
    arrCountry['UY'] = "Uruguay";
    arrCountry['UZ'] = "Uzbekistan";
    arrCountry['VU'] = "Vanuatu";
    arrCountry['VA'] = "Vatican City (Holy See)";
    arrCountry['VE'] = "Venezuela";
    arrCountry['VN'] = "Vietnam";
    arrCountry['VG'] = "Virgin Islands (British)";
    arrCountry['VI'] = "Virgin Islands (US)";
    arrCountry['WF'] = "Wallis And Futuna Islands";
    arrCountry['EH'] = "Western Sahara";
    arrCountry['WS'] = "Western Samoa";
    arrCountry['YE'] = "Yemen";
    arrCountry['YU'] = "Yugoslavia";
    arrCountry['ZM'] = "Zambia";
    arrCountry['ZW'] = "Zimbabwe";

    var name = arrCountry[countryCode.toUpperCase()];
    if (name === undefined) {
        return "";
    }
    return name;
}
(function () {
    var pca = window.pca = window.pca || {};

    /**
    * Details of a country.
    * @typedef {Object} pca.Country
    * @property {string} iso2 - The ISO 2-char code, e.g. GB.
    * @property {string} iso3 - The ISO 3-char code, e.g. GBR.
    * @property {string} name - The full country name.
    * @property {number} flag - Flag index.
    * @property {Array.<string>} [alternates] - Any alternate names for the country.
    */

    /** The list of countries.
    * @memberof pca 
    * @type {Array.<pca.Country>} */
    pca.countries = [
        { iso2: "AF", iso3: "AFG", name: "Afghanistan", name_fr: "Afghanistan", flag: 1 },
        { iso2: "AX", iso3: "ALA", name: "Åland Islands", name_fr: "Åland(les Îles)", flag: 220 },
        { iso2: "AL", iso3: "ALB", name: "Albania", name_fr: "Albanie", alternates: [ "Shqipëria" ], flag: 2 },
        { iso2: "DZ", iso3: "DZA", name: "Algeria", name_fr: "Algérie", flag: 3 },
        { iso2: "AS", iso3: "ASM", name: "American Samoa", name_fr: "Samoa américaines", flag: 4 },
        { iso2: "AD", iso3: "AND", name: "Andorra", name_fr: "Andorre", flag: 5 },
        { iso2: "AO", iso3: "AGO", name: "Angola", name_fr: "Angola", flag: 6 },
        { iso2: "AI", iso3: "AIA", name: "Anguilla", name_fr: "Anguilla", flag: 7 },
        { iso2: "AQ", iso3: "ATA", name: "Antarctica", name_fr: "Antarctique", flag: 0 },
        { iso2: "AG", iso3: "ATG", name: "Antigua and Barbuda", name_fr: "Antigua-et-Barbuda", flag: 8 },
        { iso2: "AR", iso3: "ARG", name: "Argentina", name_fr: "Argentine", flag: 9 },
        { iso2: "AM", iso3: "ARM", name: "Armenia", name_fr: "Arménie", flag: 10 },
        { iso2: "AW", iso3: "ABW", name: "Aruba", name_fr: "Aruba", flag: 11 },
        { iso2: "AU", iso3: "AUS", name: "Australia", name_fr: "Australie", flag: 12 },
        { iso2: "AT", iso3: "AUT", name: "Austria", name_fr: "Autriche", alternates: [ "Österreich" ], flag: 13 },
        { iso2: "AZ", iso3: "AZE", name: "Azerbaijan", name_fr: "Azerbaïdjan", flag: 14 },
        { iso2: "BS", iso3: "BHS", name: "Bahamas", name_fr: "Bahamas", flag: 15 },
        { iso2: "BH", iso3: "BHR", name: "Bahrain", name_fr: "Bahreïn", flag: 16 },
        { iso2: "BD", iso3: "BGD", name: "Bangladesh", name_fr: "Bangladesh", flag: 17 },
        { iso2: "BB", iso3: "BRB", name: "Barbados", name_fr: "Barbade", flag: 18 },
        { iso2: "BY", iso3: "BLR", name: "Belarus", name_fr: "Bélarus", flag: 19 },
        { iso2: "BE", iso3: "BEL", name: "Belgium", name_fr: "Belgique", alternates: [ "België" ], flag: 20 },
        { iso2: "BZ", iso3: "BLZ", name: "Belize", name_fr: "Belize", flag: 21 },
        { iso2: "BJ", iso3: "BEN", name: "Benin", name_fr: "Bénin", flag: 22 },
        { iso2: "BM", iso3: "BMU", name: "Bermuda", name_fr: "Bermudes", flag: 23 },
        { iso2: "BT", iso3: "BTN", name: "Bhutan", name_fr: "Bhoutan", flag: 24 },
        { iso2: "BO", iso3: "BOL", name: "Bolivia, Plurinational State of", name_fr: "Bolivie, l'État plurinational de la", flag: 25 },
        { iso2: "BQ", iso3: "BES", name: "Bonaire, Sint Eustatius and Saba", name_fr: "Bonaire, Saint-Eustache et Saba", flag: 0 },
        { iso2: "BA", iso3: "BIH", name: "Bosnia and Herzegovina", name_fr: "Bosnie-Herzégovine", alternates: [ "Bosna i Hercegovina" ], flag: 26 },
        { iso2: "BW", iso3: "BWA", name: "Botswana", name_fr: "Botswana", flag: 27 },
        { iso2: "BV", iso3: "BVT", name: "Bouvet Island", name_fr: "Bouvet (l'Île)", flag: 0 },
        { iso2: "BR", iso3: "BRA", name: "Brazil", name_fr: "Brésil", alternates: [ "Brasil" ], flag: 28 },
        { iso2: "IO", iso3: "IOT", name: "British Indian Ocean Territory", name_fr: "Indien (le Territoire britannique de l'océan)", flag: 29 },
        { iso2: "BN", iso3: "BRN", name: "Brunei Darussalam", name_fr: "Brunei", flag: 0 },
        { iso2: "BG", iso3: "BGR", name: "Bulgaria", name_fr: "Bulgarie", flag: 31 },
        { iso2: "BF", iso3: "BFA", name: "Burkina Faso", name_fr: "Burkina Faso", flag: 32 },
        { iso2: "BI", iso3: "BDI", name: "Burundi", name_fr: "Burundi", flag: 34 },
        { iso2: "CV", iso3: "CPV", name: "Cabo Verde", name_fr: "Cabo Verde", flag: 38 },
        { iso2: "KH", iso3: "KHM", name: "Cambodia", name_fr: "Cambodge", flag: 35 },
        { iso2: "CM", iso3: "CMR", name: "Cameroon", name_fr: "Cameroun", flag: 36 },
        { iso2: "CA", iso3: "CAN", name: "Canada", name_fr: "Canada", flag: 37 },
        { iso2: "KY", iso3: "CYM", name: "Cayman Islands", name_fr: "Caïmans (les Îles)", flag: 39 },
        { iso2: "CF", iso3: "CAF", name: "Central African Republic", name_fr: "République centrafricaine", flag: 40 },
        { iso2: "TD", iso3: "TCD", name: "Chad", name_fr: "Tchad", flag: 41 },
        { iso2: "CL", iso3: "CHL", name: "Chile", name_fr: "Chili", flag: 42 },
        { iso2: "CN", iso3: "CHN", name: "China", name_fr: "Chine", flag: 43 },
        { iso2: "CX", iso3: "CXR", name: "Christmas Island", name_fr: "Christmas (l'Île)", flag: 0 },
        { iso2: "CC", iso3: "CCK", name: "Cocos (Keeling) Islands", name_fr: "Cocos (les Îles)/ Keeling (les Îles)", flag: 0 },
        { iso2: "CO", iso3: "COL", name: "Colombia", name_fr: "Colombie", flag: 44 },
        { iso2: "KM", iso3: "COM", name: "Comoros", name_fr: "Comores", flag: 45 },
        { iso2: "CG", iso3: "COG", name: "Congo", name_fr: "Congo", flag: 0 },
        { iso2: "CD", iso3: "COD", name: "Congo (the Democratic Republic of the)", name_fr: "Congo (la République démocratique du)", flag: 46 },
        { iso2: "CK", iso3: "COK", name: "Cook Islands", name_fr: "Cook (les Îles)", flag: 47 },
        { iso2: "CR", iso3: "CRI", name: "Costa Rica", name_fr: "Costa Rica", flag: 48 },
        { iso2: "CI", iso3: "CIV", name: "Côte d'Ivoire", name_fr: "Côte d'Ivoire", flag: 49 },
        { iso2: "HR", iso3: "HRV", name: "Croatia", name_fr: "Croatie", alternates: [ "Hrvatska" ], flag: 50 },
        { iso2: "CU", iso3: "CUB", name: "Cuba", name_fr: "Cuba", flag: 51 },
        { iso2: "CW", iso3: "CUW", name: "Curaçao", name_fr: "Curaçao", flag: 0 },
        { iso2: "CY", iso3: "CYP", name: "Cyprus", name_fr: "Chypre", flag: 52 },
        { iso2: "CZ", iso3: "CZE", name: "Czech Republic", name_fr: "tchèque (la République)", alternates: [ "Ceská republika" ], flag: 53 },
        { iso2: "DK", iso3: "DNK", name: "Denmark", name_fr: "Danemark", flag: 54 },
        { iso2: "DJ", iso3: "DJI", name: "Djibouti", name_fr: "Djibouti", flag: 55 },
        { iso2: "DM", iso3: "DMA", name: "Dominica", name_fr: "Dominique", flag: 56 },
        { iso2: "DO", iso3: "DOM", name: "Dominican Republic", name_fr: "dominicaine (la République)", flag: 57 },
        { iso2: "EC", iso3: "ECU", name: "Ecuador", name_fr: "Équateur", flag: 61 },
        { iso2: "EG", iso3: "EGY", name: "Egypt", name_fr: "Égypte", flag: 58 },
        { iso2: "SV", iso3: "SLV", name: "El Salvador", name_fr: "Salvador", flag: 59 },
        { iso2: "GQ", iso3: "GNQ", name: "Equatorial Guinea", name_fr: "Guinée équatoriale", flag: 62 },
        { iso2: "ER", iso3: "ERI", name: "Eritrea", name_fr: "Érythrée", flag: 63 },
        { iso2: "EE", iso3: "EST", name: "Estonia", name_fr: "Estonie", alternates: [ "Eesti" ], flag: 64 },
        { iso2: "ET", iso3: "ETH", name: "Ethiopia", name_fr: "Éthiopie", flag: 65 },
        { iso2: "FK", iso3: "FLK", name: "Falkland Islands [Malvinas]", name_fr: "Falkland (les Îles)/Malouines (les Îles)", flag: 66 },
        { iso2: "FO", iso3: "FRO", name: "Faroe Islands", name_fr: "Féroé (les Îles)", flag: 67 },
        { iso2: "FJ", iso3: "FJI", name: "Fiji", name_fr: "Fidji", flag: 68 },
        { iso2: "FI", iso3: "FIN", name: "Finland", name_fr: "Finlande", alternates: [ "Suomi" ], flag: 69 },
        { iso2: "FR", iso3: "FRA", name: "France", name_fr: "France", flag: 70 },
        { iso2: "GF", iso3: "GUF", name: "French Guiana", name_fr: "Guyane française ", flag: 0 },
        { iso2: "PF", iso3: "PYF", name: "French Polynesia", name_fr: "Polynésie française", flag: 71 },
        { iso2: "TF", iso3: "ATF", name: "French Southern Territories", name_fr: "Terres australes françaises", flag: 0 },
        { iso2: "GA", iso3: "GAB", name: "Gabon", name_fr: "Gabon", flag: 72 },
        { iso2: "GM", iso3: "GMB", name: "Gambia", name_fr: "Gambie", flag: 73 },
        { iso2: "GE", iso3: "GEO", name: "Georgia", name_fr: "Géorgie", flag: 74 },
        { iso2: "DE", iso3: "DEU", name: "Germany", name_fr: "Allemagne", alternates: [ "Deutschland" ], flag: 75 },
        { iso2: "GH", iso3: "GHA", name: "Ghana", name_fr: "Ghana", flag: 76 },
        { iso2: "GI", iso3: "GIB", name: "Gibraltar", name_fr: "Gibraltar", flag: 77 },
        { iso2: "GR", iso3: "GRC", name: "Greece", name_fr: "Grèce", alternates: [ "Hellas" ], flag: 79 },
        { iso2: "GL", iso3: "GRL", name: "Greenland", name_fr: "Groenland", flag: 80 },
        { iso2: "GD", iso3: "GRD", name: "Grenada", name_fr: "Grenade", flag: 81 },
        { iso2: "GP", iso3: "GLP", name: "Guadeloupe", name_fr: "Guadeloupe", flag: 0 },
        { iso2: "GU", iso3: "GUM", name: "Guam", name_fr: "Guam", flag: 82 },
        { iso2: "GT", iso3: "GTM", name: "Guatemala", name_fr: "Guatemala", flag: 83 },
        { iso2: "GG", iso3: "GGY", name: "Guernsey", name_fr: "Guernesey", flag: 84 },
        { iso2: "GN", iso3: "GIN", name: "Guinea", name_fr: "Guinée", flag: 85 },
        { iso2: "GW", iso3: "GNB", name: "Guinea-Bissau", name_fr: "Guinée-Bissau", flag: 86 },
        { iso2: "GY", iso3: "GUY", name: "Guyana", name_fr: "Guyana", flag: 87 },
        { iso2: "HT", iso3: "HTI", name: "Haiti", name_fr: "Haïti", flag: 88 },
        { iso2: "HM", iso3: "HMD", name: "Heard Island and McDonald Islands", name_fr: "Heard-et-Îles MacDonald (l'Île)", flag: 0 },
        { iso2: "VA", iso3: "VAT", name: "Holy See [Vatican City State]", name_fr: "Saint-Siège [État de la Cité du Vatican]", flag: 0 },
        { iso2: "HN", iso3: "HND", name: "Honduras", name_fr: "Honduras", flag: 89 },
        { iso2: "HK", iso3: "HKG", name: "Hong Kong", name_fr: "Hong Kong", flag: 90 },
        { iso2: "HU", iso3: "HUN", name: "Hungary", name_fr: "Hongrie", alternates: [ "Magyarország" ], flag: 91 },
        { iso2: "IS", iso3: "ISL", name: "Iceland", name_fr: "Islande", alternates: [ "Ísland" ], flag: 92 },
        { iso2: "IN", iso3: "IND", name: "India", name_fr: "Inde", flag: 93 },
        { iso2: "ID", iso3: "IDN", name: "Indonesia", name_fr: "Indonésie", flag: 94 },
        { iso2: "IR", iso3: "IRN", name: "Iran (the Islamic Republic of)", name_fr: "Iran (République Islamique d')", flag: 95 },
        { iso2: "IQ", iso3: "IRQ", name: "Iraq", name_fr: "Iraq", flag: 96 },
        { iso2: "IE", iso3: "IRL", name: "Ireland", name_fr: "Irlande", flag: 97 },
        { iso2: "IM", iso3: "IMN", name: "Isle of Man", name_fr: "Île de Man", flag: 98 },
        { iso2: "IL", iso3: "ISR", name: "Israel", name_fr: "Israël", flag: 99 },
        { iso2: "IT", iso3: "ITA", name: "Italy", name_fr: "Italie", alternates: [ "Italia" ], flag: 100 },
        { iso2: "JM", iso3: "JAM", name: "Jamaica", name_fr: "Jamaïque", flag: 101 },
        { iso2: "JP", iso3: "JPN", name: "Japan", name_fr: "Japon", flag: 102 },
        { iso2: "JE", iso3: "JEY", name: "Jersey", name_fr: "Jersey", flag: 103 },
        { iso2: "JO", iso3: "JOR", name: "Jordan", name_fr: "Jordanie", flag: 104 },
        { iso2: "KZ", iso3: "KAZ", name: "Kazakhstan", name_fr: "Kazakhstan", flag: 105 },
        { iso2: "KE", iso3: "KEN", name: "Kenya", name_fr: "Kenya", flag: 106 },
        { iso2: "KI", iso3: "KIR", name: "Kiribati", name_fr: "Kiribati", flag: 107 },
        { iso2: "KP", iso3: "PRK", name: "Korea (the Democratic People's Republic of)", name_fr: "Corée (la République populaire démocratique de )", flag: 149 },
        { iso2: "KR", iso3: "KOR", name: "Korea (the Republic of)", name_fr: "Corée (la République de)", flag: 185 },
        { iso2: "KW", iso3: "KWT", name: "Kuwait", name_fr: "Koweït", flag: 108 },
        { iso2: "KG", iso3: "KGZ", name: "Kyrgyzstan", name_fr: "Kirghizistan", flag: 109 },
        { iso2: "LA", iso3: "LAO", name: "Lao People's Democratic Republic", name_fr: "Lao, République démocratique populaire", flag: 0 },
        { iso2: "LV", iso3: "LVA", name: "Latvia", name_fr: "Lettonie", flag: 110 },
        { iso2: "LB", iso3: "LBN", name: "Lebanon", name_fr: "Liban", flag: 111 },
        { iso2: "LS", iso3: "LSO", name: "Lesotho", name_fr: "Lesotho", flag: 112 },
        { iso2: "LR", iso3: "LBR", name: "Liberia", name_fr: "Libéria", flag: 113 },
        { iso2: "LY", iso3: "LBY", name: "Libya", name_fr: "Libye", flag: 114 },
        { iso2: "LI", iso3: "LIE", name: "Liechtenstein", name_fr: "Liechtenstein", flag: 115 },
        { iso2: "LT", iso3: "LTU", name: "Lithuania", name_fr: "Lituanie", alternates: [ "Lietuva" ], flag: 116 },
        { iso2: "LU", iso3: "LUX", name: "Luxembourg", name_fr: "Luxembourg", flag: 117 },
        { iso2: "MO", iso3: "MAC", name: "Macao", name_fr: "Macao", flag: 118 },
        { iso2: "MK", iso3: "MKD", name: "Macedonia (the former Yugoslav Republic of)", name_fr: "Macédoine (l'ex-République yougoslave de)", alternates: [ "Poraneshna Jugoslovenska Republika Makedonija" ], flag: 119 },
        { iso2: "MG", iso3: "MDG", name: "Madagascar", name_fr: "Madagascar", flag: 120 },
        { iso2: "MW", iso3: "MWI", name: "Malawi", name_fr: "Malawi", flag: 121 },
        { iso2: "MY", iso3: "MYS", name: "Malaysia", name_fr: "Malaisie", flag: 122 },
        { iso2: "MV", iso3: "MDV", name: "Maldives", name_fr: "Maldives", flag: 123 },
        { iso2: "ML", iso3: "MLI", name: "Mali", name_fr: "Mali", flag: 124 },
        { iso2: "MT", iso3: "MLT", name: "Malta", name_fr: "Malte", flag: 125 },
        { iso2: "MH", iso3: "MHL", name: "Marshall Islands", name_fr: "Marshall (Îles)", flag: 126 },
        { iso2: "MQ", iso3: "MTQ", name: "Martinique", name_fr: "Martinique", flag: 127 },
        { iso2: "MR", iso3: "MRT", name: "Mauritania", name_fr: "Mauritanie", flag: 128 },
        { iso2: "MU", iso3: "MUS", name: "Mauritius", name_fr: "Maurice", flag: 129 },
        { iso2: "YT", iso3: "MYT", name: "Mayotte", name_fr: "Mayotte", flag: 0 },
        { iso2: "MX", iso3: "MEX", name: "Mexico", name_fr: "Mexique", flag: 130 },
        { iso2: "FM", iso3: "FSM", name: "Micronesia (the Federated States of)", name_fr: "Micronésie, États fédérés de", flag: 131 },
        { iso2: "MD", iso3: "MDA", name: "Moldova (the Republic of)", name_fr: "Moldova , République de", flag: 132 },
        { iso2: "MC", iso3: "MCO", name: "Monaco", name_fr: "Monaco", flag: 133 },
        { iso2: "MN", iso3: "MNG", name: "Mongolia", name_fr: "Mongolie", flag: 134 },
        { iso2: "ME", iso3: "MNE", name: "Montenegro", name_fr: "Monténégro", alternates: [ "Crna Gora" ], flag: 0 },
        { iso2: "MS", iso3: "MSR", name: "Montserrat", name_fr: "Montserrat", flag: 135 },
        { iso2: "MA", iso3: "MAR", name: "Morocco", name_fr: "Maroc", flag: 136 },
        { iso2: "MZ", iso3: "MOZ", name: "Mozambique", name_fr: "Mozambique", flag: 137 },
        { iso2: "MM", iso3: "MMR", name: "Myanmar", name_fr: "Myanmar", flag: 33 },
        { iso2: "NA", iso3: "NAM", name: "Namibia", name_fr: "Namibie", flag: 138 },
        { iso2: "NR", iso3: "NRU", name: "Nauru", name_fr: "Nauru", flag: 139 },
        { iso2: "NP", iso3: "NPL", name: "Nepal", name_fr: "Népal", flag: 140 },
        { iso2: "NL", iso3: "NLD", name: "Netherlands", name_fr: "Pays-Bas", alternates: [ "Holland" ], flag: 141 },
        { iso2: "NC", iso3: "NCL", name: "New Caledonia", name_fr: "Nouvelle-Calédonie", flag: 0 },
        { iso2: "NZ", iso3: "NZL", name: "New Zealand", name_fr: "Nouvelle-Zélande", flag: 142 },
        { iso2: "NI", iso3: "NIC", name: "Nicaragua", name_fr: "Nicaragua", flag: 143 },
        { iso2: "NE", iso3: "NER", name: "Niger", name_fr: "Niger", flag: 144 },
        { iso2: "NG", iso3: "NGA", name: "Nigeria", name_fr: "Nigéria", flag: 145 },
        { iso2: "NU", iso3: "NIU", name: "Niue", name_fr: "Niue", flag: 146 },
        { iso2: "NF", iso3: "NFK", name: "Norfolk Island", name_fr: "Norfolk (l'Île)", flag: 147 },
        { iso2: "MP", iso3: "MNP", name: "Northern Mariana Islands", name_fr: "Mariannes du Nord (les Îles)", flag: 148 },
        { iso2: "NO", iso3: "NOR", name: "Norway", name_fr: "Norvège", flag: 150 },
        { iso2: "OM", iso3: "OMN", name: "Oman", name_fr: "Oman", flag: 151 },
        { iso2: "PK", iso3: "PAK", name: "Pakistan", name_fr: "Pakistan", flag: 152 },
        { iso2: "PW", iso3: "PLW", name: "Palau", name_fr: "Palaos", flag: 153 },
        { iso2: "PS", iso3: "PSE", name: "Palestine, State of", name_fr: "Palestine, État de", flag: 0 },
        { iso2: "PA", iso3: "PAN", name: "Panama", name_fr: "Panama", flag: 154 },
        { iso2: "PG", iso3: "PNG", name: "Papua New Guinea", name_fr: "Papouasie-Nouvelle-Guinée", flag: 155 },
        { iso2: "PY", iso3: "PRY", name: "Paraguay", name_fr: "Paraguay", flag: 156 },
        { iso2: "PE", iso3: "PER", name: "Peru", name_fr: "Pérou", flag: 157 },
        { iso2: "PH", iso3: "PHL", name: "Philippines", name_fr: "Philippines", flag: 158 },
        { iso2: "PN", iso3: "PCN", name: "Pitcairn", name_fr: "Pitcairn", flag: 0 },
        { iso2: "PL", iso3: "POL", name: "Poland", name_fr: "Pologne", alternates: [ "Polska" ], flag: 159 },
        { iso2: "PT", iso3: "PRT", name: "Portugal", name_fr: "Portugal", flag: 160 },
        { iso2: "PR", iso3: "PRI", name: "Puerto Rico", name_fr: "Porto Rico", flag: 161 },
        { iso2: "QA", iso3: "QAT", name: "Qatar", name_fr: "Qatar", flag: 162 },
        { iso2: "RE", iso3: "REU", name: "Réunion", name_fr: "Réunion", flag: 0 },
        { iso2: "RO", iso3: "ROU", name: "Romania", name_fr: "Roumanie", alternates: [ "România" ], flag: 163 },
        { iso2: "RU", iso3: "RUS", name: "Russian Federation", name_fr: "Russie (la Fédération de)", alternates: [ "Rossiya" ], flag: 164 },
        { iso2: "RW", iso3: "RWA", name: "Rwanda", name_fr: "Rwanda", flag: 165 },
        { iso2: "BL", iso3: "BLM", name: "Saint Barthélemy", name_fr: "Saint-Barthélemy", flag: 0 },
        { iso2: "SH", iso3: "SHN", name: "Saint Helena, Ascension and Tristan da Cunha", name_fr: "Sainte-Hélène, Ascension et Tristan da Cunha", flag: 166 },
        { iso2: "KN", iso3: "KNA", name: "Saint Kitts and Nevis", name_fr: "Saint-Kitts-et-Nevis", flag: 167 },
        { iso2: "LC", iso3: "LCA", name: "Saint Lucia", name_fr: "Sainte-Lucie", flag: 168 },
        { iso2: "MF", iso3: "MAF", name: "Saint Martin (French part)", name_fr: "Saint-Martin (partie française)", flag: 0 },
        { iso2: "PM", iso3: "SPM", name: "Saint Pierre and Miquelon", name_fr: "Saint-Pierre-et-Miquelon", flag: 169 },
        { iso2: "VC", iso3: "VCT", name: "Saint Vincent and the Grenadines", name_fr: "Saint-Vincent-et-les-Grenadines", flag: 170 },
        { iso2: "WS", iso3: "WSM", name: "Samoa", name_fr: "Samoa", flag: 171 },
        { iso2: "SM", iso3: "SMR", name: "San Marino", name_fr: "Saint-Marin", flag: 172 },
        { iso2: "ST", iso3: "STP", name: "Sao Tome and Principe", name_fr: "Sao Tomé-et-Principe", flag: 173 },
        { iso2: "SA", iso3: "SAU", name: "Saudi Arabia", name_fr: "Arabie saoudite", flag: 174 },
        { iso2: "SN", iso3: "SEN", name: "Senegal", name_fr: "Sénégal", flag: 175 },
        { iso2: "RS", iso3: "SRB", name: "Serbia", name_fr: "Serbie", alternates: [ "Srbija" ], flag: 0 },
        { iso2: "SC", iso3: "SYC", name: "Seychelles", name_fr: "Seychelles", flag: 176 },
        { iso2: "SL", iso3: "SLE", name: "Sierra Leone", name_fr: "Sierra Leone", flag: 177 },
        { iso2: "SG", iso3: "SGP", name: "Singapore", name_fr: "Singapour", flag: 178 },
        { iso2: "SX", iso3: "SXM", name: "Sint Maarten (Dutch part)", name_fr: "Saint-Martin (partie néerlandaise)", flag: 0 },
        { iso2: "SK", iso3: "SVK", name: "Slovakia", name_fr: "Slovaquie", alternates: [ "Slovenská republika" ], flag: 179 },
        { iso2: "SI", iso3: "SVN", name: "Slovenia", name_fr: "Slovénie", alternates: [ "Slovenija" ], flag: 180 },
        { iso2: "SB", iso3: "SLB", name: "Solomon Islands", name_fr: "Salomon (Îles)", flag: 181 },
        { iso2: "SO", iso3: "SOM", name: "Somalia", name_fr: "Somalie", flag: 182 },
        { iso2: "ZA", iso3: "ZAF", name: "South Africa", name_fr: "Afrique du Sud", flag: 183 },
        { iso2: "GS", iso3: "SGS", name: "South Georgia and the South Sandwich Islands", name_fr: "Géorgie du Sud-et-les Îles Sandwich du Sud", flag: 184 },
        { iso2: "SS", iso3: "SSD", name: "South Sudan ", name_fr: "Soudan du Sud", flag: 0 },
        { iso2: "ES", iso3: "ESP", name: "Spain", name_fr: "Espagne", alternates: [ "España" ], flag: 186 },
        { iso2: "LK", iso3: "LKA", name: "Sri Lanka", name_fr: "Sri Lanka", flag: 187 },
        { iso2: "SD", iso3: "SDN", name: "Sudan", name_fr: "Soudan", flag: 188 },
        { iso2: "SR", iso3: "SUR", name: "Suriname", name_fr: "Suriname", flag: 189 },
        { iso2: "SJ", iso3: "SJM", name: "Svalbard and Jan Mayen", name_fr: "Svalbard et l'Île Jan Mayen", flag: 190 },
        { iso2: "SZ", iso3: "SWZ", name: "Swaziland", name_fr: "Swaziland", flag: 191 },
        { iso2: "SE", iso3: "SWE", name: "Sweden", name_fr: "Suède", alternates: [ "Sverige" ], flag: 192 },
        { iso2: "CH", iso3: "CHE", name: "Switzerland", name_fr: "Suisse", alternates: [ "Schweiz" ], flag: 193 },
        { iso2: "SY", iso3: "SYR", name: "Syrian Arab Republic", name_fr: "République arabe syrienne", flag: 0 },
        { iso2: "TW", iso3: "TWN", name: "Taiwan (Province of China)", name_fr: "Taïwan (Province de Chine)", flag: 194 },
        { iso2: "TJ", iso3: "TJK", name: "Tajikistan", name_fr: "Tadjikistan", flag: 195 },
        { iso2: "TZ", iso3: "TZA", name: "Tanzania, United Republic of", name_fr: "Tanzanie, République-Unie de", flag: 196 },
        { iso2: "TH", iso3: "THA", name: "Thailand", name_fr: "Thaïlande", flag: 197 },
        { iso2: "TL", iso3: "TLS", name: "Timor-Leste", name_fr: "Timor-Leste", flag: 0 },
        { iso2: "TG", iso3: "TGO", name: "Togo", name_fr: "Togo", flag: 198 },
        { iso2: "TK", iso3: "TKL", name: "Tokelau", name_fr: "Tokelau", flag: 0 },
        { iso2: "TO", iso3: "TON", name: "Tonga", name_fr: "Tonga", flag: 199 },
        { iso2: "TT", iso3: "TTO", name: "Trinidad and Tobago", name_fr: "Trinité-et-Tobago", flag: 200 },
        { iso2: "TN", iso3: "TUN", name: "Tunisia", name_fr: "Tunisie", flag: 201 },
        { iso2: "TR", iso3: "TUR", name: "Turkey", name_fr: "Turquie", alternates: [ "Türkiye" ], flag: 202 },
        { iso2: "TM", iso3: "TKM", name: "Turkmenistan", name_fr: "Turkménistan", flag: 203 },
        { iso2: "TC", iso3: "TCA", name: "Turks and Caicos Islands", name_fr: "Turks-et-Caïcos (les Îles)", flag: 204 },
        { iso2: "TV", iso3: "TUV", name: "Tuvalu", name_fr: "Tuvalu", flag: 205 },
        { iso2: "UG", iso3: "UGA", name: "Uganda", name_fr: "Ouganda", flag: 206 },
        { iso2: "UA", iso3: "UKR", name: "Ukraine", name_fr: "Ukraine", alternates: [ "Ukraina" ], flag: 207 },
        { iso2: "AE", iso3: "ARE", name: "United Arab Emirates", name_fr: "Émirats arabes unis", alternates: [ "UAE" ], flag: 208 },
        { iso2: "GB", iso3: "GBR", name: "United Kingdom", name_fr: "Royaume-Uni", alternates: [ "Britain", "England", "Great Britain", "Northern Ireland", "Scotland", "UK", "Wales" ], flag: 78 },
        { iso2: "US", iso3: "USA", name: "United States", name_fr: "États-Unis", alternates: [ "America", "United States of America" ], flag: 210 },
        { iso2: "UM", iso3: "UMI", name: "United States Minor Outlying Islands", name_fr: "Îles mineures éloignées des États-Unis", flag: 0 },
        { iso2: "UY", iso3: "URY", name: "Uruguay", name_fr: "Uruguay", flag: 209 },
        { iso2: "UZ", iso3: "UZB", name: "Uzbekistan", name_fr: "Ouzbékistan", flag: 211 },
        { iso2: "VU", iso3: "VUT", name: "Vanuatu", name_fr: "Vanuatu", flag: 212 },
        { iso2: "VE", iso3: "VEN", name: "Venezuela, Bolivarian Republic of ", name_fr: "Venezuela, République bolivarienne du ", flag: 213 },
        { iso2: "VN", iso3: "VNM", name: "Viet Nam", name_fr: "Viet Nam", flag: 214 },
        { iso2: "VG", iso3: "VGB", name: "Virgin Islands (British)", name_fr: "Vierges britanniques (les Îles)", flag: 30 },
        { iso2: "VI", iso3: "VIR", name: "Virgin Islands (U.S.)", name_fr: "Vierges des États-Unis (les Îles)", flag: 215 },
        { iso2: "WF", iso3: "WLF", name: "Wallis and Futuna", name_fr: "Wallis-et-Futuna ", flag: 216 },
        { iso2: "EH", iso3: "ESH", name: "Western Sahara", name_fr: "Sahara occidental", flag: 0 },
        { iso2: "YE", iso3: "YEM", name: "Yemen", name_fr: "Yémen", flag: 217 },
        { iso2: "ZM", iso3: "ZMB", name: "Zambia", name_fr: "Zambie", flag: 218 },
        { iso2: "ZW", iso3: "ZWE", name: "Zimbabwe", name_fr: "Zimbabwe", flag: 219 }
    ];

    /** Input field modes. 
    * @memberof pca  
    * @readonly
    * @enum {number} */
    pca.countryNameType = {
        /** The full country name */
        NAME: 0,
        /** The ISO 2-char code, e.g. GB */
        ISO2: 1,
        /** The ISO 3-char code, e.g. GBR */
        ISO3: 2
    };

    /**
    * Country List options.
    * @typedef {Object} pca.CountryList.Options
    * @property {string} [defaultCode] - The default country as an ISO 3-char code.
    * @property {string} [fallbackCode] - The default country as an ISO 3-char code in the case that the defaultCode is not present in the list.
    * @property {string} [value] - The initial value.
    * @property {string} [codesList] - A comma separated list of ISO 2-char or 3-char country codes for the basis of the list.
    * @property {boolean} [fillOthers=true] - If a codesList is provided, any remaining countries will be appended to the bottom of the list.
    * @property {prepopulate} [fillOthers=true] - When the country is changed, any fields will be populated.
    * @property {string} [nameLanguage=en] - The language for country names, only en and fr are supported.
    * @property {pca.countryNameType} [nameType=NAME] - The text format of the country name for populating an input field.
    * @property {pca.countryNameType} [valueType=ISO3] - The value format of a country option for populating a select list.
    */

    /** Creates an autocomplete list with country options. 
    * @memberof pca 
    * @constructor 
    * @mixes Eventable
    * @param {Array.<HTMLElement>} fields - A list of input elements to bind to. 
    * @param {pca.CountryList.Options} [options] - Additional options to apply to the list. 
    */
    pca.CountryList = function (fields, options) {
        /** @lends pca.CountryList.prototype */
        var countrylist = new pca.Eventable(this);

        /** The current country fields
        * @type {Array.<HTMLElement>} */
        countrylist.fields = fields || [];
        /** The current country fields
        * @type {Array.<Object>} */
        countrylist.options = options || {};

        //parse the options
        countrylist.options.defaultCode = countrylist.options.defaultCode || "";
        countrylist.options.value = countrylist.options.value || "";
        countrylist.options.codesList = countrylist.options.codesList || "";
        countrylist.options.fillOthers = countrylist.options.fillOthers || false;
        countrylist.options.list = countrylist.options.list || {};
        countrylist.options.populate = typeof countrylist.options.populate == 'boolean' ? countrylist.options.populate : true;
        countrylist.options.prepopulate = typeof countrylist.options.prepopulate == 'boolean' ? countrylist.options.prepopulate : true;
        countrylist.options.language = countrylist.options.language || "en";
        countrylist.options.nameType = countrylist.options.nameType || pca.countryNameType.NAME;
        countrylist.options.valueType = countrylist.options.valueType || pca.countryNameType.NAME;
        countrylist.options.fallbackCode = countrylist.options.fallbackCode || "GBR";

        /** The list
        * @type {pca.AutoComplete} */
        countrylist.autocomplete = new pca.AutoComplete(countrylist.fields, countrylist.options.list);
        /** The current country
        * @type {pca.Country} */
        countrylist.country = null;
        countrylist.textChanged = false;
        countrylist.nameProperty = countrylist.options.language == "fr" ? "name_fr" : "name";
        countrylist.template = "<div class='pcaflag'></div><div class='pcaflaglabel'>{" + countrylist.nameProperty + "}</div>";

        countrylist.load = function () {
            pca.addClass(countrylist.autocomplete.element, "pcacountrylist");
            
            //country has been selected
            function selectCountry(country) {
                countrylist.change(country);
                countrylist.fire("select", country);
            }

            //add countries to the list
            if (countrylist.options.codesList) {
                var codesSplit =  countrylist.options.codesList.replace(/\s/g, "").split(","),
                    filteredList = [];

                countrylist.autocomplete.clear();

                for (var i = 0; i < codesSplit.length; i++) {
                    var code = codesSplit[i].toString().toUpperCase();

                    for (var c = 0; c < pca.countries.length; c++) {
                        if  (pca.countries[c].iso2 == code || pca.countries[c].iso3 == code) {
                            filteredList.push(pca.countries[c]);
                            break;
                        } 
                    }
                }
                
                if (countrylist.options.fillOthers) {
                    for (var o = 0; o < pca.countries.length; o++) {
                        var contains = false;

                        for (var f = 0; f < filteredList.length; f++) {
                            if (pca.countries[o].iso3 == filteredList[f].iso3)
                                contains = true;
                        }
                        
                        if (!contains) filteredList.push(pca.countries[o]);
                    }
                }

                countrylist.autocomplete.clear().add(filteredList, countrylist.template, selectCountry);
            }
            else countrylist.autocomplete.clear().add(pca.countries, countrylist.template, selectCountry);

            //set flags and add alternate filter tags to each country
            countrylist.autocomplete.list.collection.all(function (item) {
                countrylist.setFlagPosition(item.element.firstChild, item.data.flag);
                item.tag += " " + pca.formatTag(item.data.iso3 + (item.data.alternates ? " " + item.data.alternates.join(" ") : ""));
            });

            //always show the full list to begin with
            countrylist.autocomplete.listen("focus", function () {
                countrylist.autocomplete.showAll();
            });


            //user has changed country on the form
            function textChanged(field) {
                //for a select list we should try the value and label
                if (pca.selectList(field)) {
                    var selected = pca.getSelectedItem(field);
                    countrylist.change(countrylist.find(selected.value) || countrylist.find(selected.text));
                }
                else
                    countrylist.setCountry(pca.getValue(field));

                countrylist.textChanged = false;
            }

            //automatically set the country when the field value is changed
            countrylist.autocomplete.listen("change", function (field) {
                countrylist.autocomplete.visible ? countrylist.textChanged = true : textChanged(field);
            });

            countrylist.autocomplete.listen("hide", function () {
                if (countrylist.textChanged) textChanged(countrylist.autocomplete.field);
            });

            //set the initial value
            if (countrylist.options.value) countrylist.country = countrylist.find(countrylist.options.value);
            if (!countrylist.country && countrylist.options.defaultCode) countrylist.country = countrylist.find(countrylist.options.defaultCode);
            
            //use the fallback or first in the list
            countrylist.country = countrylist.country || (countrylist.options.codesList ? countrylist.first() : countrylist.find(countrylist.options.fallbackCode)) || countrylist.first() || countrylist.find(countrylist.options.fallbackCode);

            countrylist.fire("load");
        }

        /** Returns the name of the country with the current nameType option. 
        * @param {pca.Country} [country] - The country object to get the desired name of. */
        countrylist.getName = function(country) {
            switch (countrylist.options.nameType) {
                case pca.countryNameType.NAME:
                    return (country || countrylist.country)[countrylist.nameProperty];
                case pca.countryNameType.ISO2:
                    return (country || countrylist.country).iso2;
                case pca.countryNameType.ISO3:
                    return (country || countrylist.country).iso3;
            }

            return (country || countrylist.country)[countrylist.nameProperty];
        }
        
        /** Returns the value of the country with the current valueType option. 
        * @param {pca.Country} [country] - The country object to get the desired value of. */
        countrylist.getValue = function(country) {
            switch (countrylist.options.valueType) {
                case pca.countryNameType.NAME:
                    return (country || countrylist.country)[countrylist.nameProperty];
                case pca.countryNameType.ISO2:
                    return (country || countrylist.country).iso2;
                case pca.countryNameType.ISO3:
                    return (country || countrylist.country).iso3;
            }

            return (country || countrylist.country).iso3;
        }

        /** Populates all bound country fields. 
        * @fires populate */
        countrylist.populate = function() {
            if (!countrylist.options.populate) return;

            var name = countrylist.getName(),
                value = countrylist.getValue();

            for (var i = 0; i < countrylist.fields.length; i++) {
                var countryField = pca.getElement(countrylist.fields[i]),
                    currentValue = pca.getValue(countryField);
                
                pca.setValue(countryField, (pca.selectList(countryField) ? value : name));

                if (countrylist.options.prepopulate && currentValue != pca.getValue(countryField))
                    pca.fire(countryField, "change");
            }
                
            countrylist.fire("populate");
        }

        /** Finds a matching country from a name or code.
        * @param {string} country - The country name or code to find.
        * @returns {pca.Country} The country object. */
        countrylist.find = function (country) {
            country = country.toString().toUpperCase();

            function isAlternate(item) {
                if (item.data.alternates) {
                    for (var a = 0; a < item.data.alternates.length; a++) {
                        if (item.data.alternates[a].toUpperCase() == country) 
                            return true;
                    }
                }
            
                return false;
            }

            return (countrylist.autocomplete.list.collection.first(function (item) {
                return item.data.iso2.toUpperCase() == country || item.data.iso3.toUpperCase() == country || item.data.name.toUpperCase() == country || item.data.name_fr.toUpperCase() == country || isAlternate(item);
            }) || {}).data;
        }

        /** Returns the first country in the list.
        * @returns {pca.Country} The first country object. */
        countrylist.first = function () {
            return countrylist.autocomplete.list.collection.first().data;
        }

        /** Country has been selected. 
        * @param {pca.Country} country - The country to change to. 
        * @fires change */
        countrylist.change = function (country) {
            if (country) {
                countrylist.country = country;
                countrylist.populate();
                countrylist.textChanged = false;
                countrylist.fire("change", countrylist.country);
            }
        }

        /** Sets the index of a flag icon element.
        * @param {HTMLElement} element - The flag icon element to change. 
        * @param {number} index - The country flag icon index. */
        countrylist.setFlagPosition = function (element, index) {
            element.style.backgroundPosition = "-1px -" + (index * 16 + 2) + "px";
        }

        /** Creates a dynamic flag icon. 
        * @returns {HTMLDivElement} A dynamic HTML DIV showing the flag as an icon. */
        countrylist.flag = function () {
            var flag = pca.create("div", { className: "pcaflag" });

            function updateFlag(country) {
                countrylist.setFlagPosition(flag, country.flag);
            }

            updateFlag(countrylist.country);
            countrylist.listen("change", updateFlag);

            return flag;
        }
        
        /** Sets the country
        * @param {string} country - The country name or code to change to. */
        countrylist.setCountry = function (country) {
            countrylist.change(countrylist.find(country));
            return countrylist;
        }

        /** Sets the country based on the current client IP.
        * @param {string} key - A license key for the request. */
        countrylist.setCountryByIP = function (key) {
            function success(response) {
                if (response.length && response[0].Iso3)
                    countrylist.setCountry(response[0].Iso3);
            }

            if (key) pca.fetch("Extras/Web/Ip2Country/v1.10", { Key: key }, success);
        }

        countrylist.load();
    }
})();
/*
 * v1.00
 * 
 * Adds setCssClassValid, setCssClassInvalid, callFunction
 * 
 * Changes to layout of icon
 * 
 */

(function (window, undefined) {
    var pca = window.pca = window.pca || {},
        document = window.document;

    pca.getCountry = function (iso2Code) {
        for (var i = 0; i < pca.countries.length; i++) {
            var country = pca.countries[i];
            if (country.iso2 === iso2Code) {
                country.index = i;
                return country;
            }
        }
        return null;
    }

    pca.getIso2FromIso3 = function (iso3Code) {
        for (var i = 0; i < pca.countries.length; i++) {
            var country = pca.countries[i];
            if (country.iso3 === iso3Code) {
                return country.iso2;
            }
        }
        return '';
    }

    pca.getIso2FromString = function (text) {
        if (text.length === 2 && pca.getCountry(text)) {
            return text;
        }
        if (text.length === 3) {
            var iso2 = pca.getIso2FromIso3(text);
            if (pca.getCountry(iso2)) {
                return iso2;
            }
        }
        for (var i = 0; i < pca.countries.length; i++) {
            var country = pca.countries[i];
            if (country.name === text || country.name_fr === text) {
                return country.iso2;
            }
        }
        return null;
    }

    pca.getIso3FromIso2 = function (iso2Code) {
        return pca.getCountry(iso2Code).iso3;
    }

    pca.getIsoNumberFromIso2 = function (iso2Code) {
        return pca.getCountry(iso2Code).isoNo;
    }

    pca.getAllCountries = function () {
        return pca.countries;
    }

    pca.getCountryIndex = function (iso2Code) {
        return pca.getCountry(iso2Code).index;
    }

})(window);


(function () {
    var pca = window.pca = window.pca || {};

    pca.Mobile = function(fields, options) {
        var mobile = pca.Eventable(this);
        mobile.fields = fields || [];
        mobile.width = 0;
        mobile.isValid = false;
        mobile.height = 0;
        mobile.fontSize = "11px";
        mobile.phoneElement = null;
        mobile.countrySource = null;
        mobile.phoneNumber = "";
        mobile.options = pca.extend({}, {
            key: "",
            provider: "PhoneNumberValidation",
            countryCodeDefaultValue: null,
            minimal: false,
            setCssClassValid: "",
            setCssClassInvalid: "",
            phoneDisplayMode: "inline"
        }, options || {});

        mobile.key = mobile.options.key;
        var noSource = false;
        //cast booleans
        if (typeof mobile.options.minimal == "string") {
            mobile.options.minimal = mobile.options.minimal.toLowerCase() === "true";
        }

        var isIe8OrLower = document.all && !document.addEventListener;

        var constants = {
            PHONE_VALIDATION_API_VERSION: "v2.00",
            VALIDATION_MINIMUM_PHONENUMBER_LENGTH: 1,
            VALIDATION_KEYPRESS_TIMEOUT: 1000,
            VALIDATION_PHONE_REGEX: /([0-9\s\-]{7,})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?$/
        };

        mobile.load = function() {

            for (var f = 0; f < mobile.fields.length; f++) {
                var field = mobile.fields[f];
                if (field.field === "{Phone}") {
                    mobile.phoneElement = pca.getElement(field.element);
                }
                if (field.field === "{CountrySource}") {
                    if (field.element === "") {
                        noSource = true;
                    } else {
                        mobile.countrySource = pca.getElement(field.element);
                    }
                }
            }


            if (mobile.phoneElement) {
                if (!mobile.options.minimal || !mobile.countrySource)
                    scaffoldValidation();


                pca.listen(mobile.phoneElement, "keyup", pca.debounce(validate, constants.VALIDATION_KEYPRESS_TIMEOUT));
                pca.listen(mobile.phoneElement, "blur", validate);
                pca.listen(mobile.phoneElement, "keydown", clearElementStatus);
            }
        };

        mobile.destroy = function () {
            //if (mobile.options.minimal) {
            //    return mobile;
            //}
            deScaffoldValidation();
            return mobile;
        };

        function scaffoldValidation() {
            var el = mobile.phoneElement;
            var parent = el.parentNode;
            el.existingCssText = el.style.cssText;
            if (!el.pca_wrapped) {
                var elBbox = el.getBoundingClientRect();
                mobile.width = elBbox.width;
                mobile.height = elBbox.height;
                mobile.fontSize = pca.getStyle(el, "font-size");
                var wrapper = pca.create("div", { className: "validator validator-phone validation-none" });
                
                parent.insertBefore(wrapper, el);
                
                if (!mobile.countrySource && !noSource) {
                    var defaultCountryCode = mobile.options.countryCodeDefaultValue;
                    var cce = pca.create("select", { className: "pca-auto-country", name: "countrycode", id: "countrycode" });
                    var countries = pca.getAllCountries();
                    for (var c = 0; c < countries.length; c++) {
                        var countryModel = countries[c];
                        var option = pca.create("option", { value: countryModel.iso2, text: countryModel.name, selected: (defaultCountryCode && (countryModel.iso2.toUpperCase() === defaultCountryCode.toUpperCase())) });
                        cce.appendChild(option);
                    }
                    if (mobile.options.phoneDisplayMode === "inline") {
                        wrapper.appendChild(cce);
                        cce.style.width = ((mobile.width * 0.33333) - 5) + "px";
                        el.style.width = (mobile.width * 0.66666) + "px";
                        pca.addClass(wrapper, "validator-inline");
                    } else if (mobile.options.phoneDisplayMode === "vertical") {
                        pca.addClass(wrapper, "validator-vertical");
                        wrapper.appendChild(cce);
                    }
                    mobile.countrySource = cce;
                }

                wrapper.appendChild(el);
                if (!mobile.options.minimal) {
                    var feedbackElement = pca.create("div", { className: "feedback feedback-phone" });
                    //feedbackElement.style.fontSize = mobile.fontSize;
                    feedbackElement.style.height = (mobile.height + 10) + "px";
                    feedbackElement.style.width = (mobile.height + 10) + "px";
                    feedbackElement.style.backgroundSize = ((mobile.height - 10) > 40 ? 40 : (mobile.height - 10)) + "px";
                    feedbackElement.style.top = "-5px";
                    wrapper.appendChild(feedbackElement);
                }
                el.wrapper = wrapper;
                wrapper.style.height = mobile.height + "px";
                wrapper.style.width = mobile.width + "px";
                el.pca_wrapped = true;
            }
        }

        function deScaffoldValidation() {
            var el = mobile.phoneElement;
            if (el && el.pca_wrapped) {
                var wrapper = el.wrapper;
                var parent = wrapper.parentNode;
                parent.insertBefore(el, wrapper);
                parent.removeChild(wrapper);
                el.pca_wrapped = false;
                
                el.style.cssText = el.existingCssText;
            }
        }

        function validate() {
            var element = mobile.phoneElement;
            if (element.value !== mobile.phoneNumber) {
                if (!doClientSideCheck(element.value)) {
                    mobile.fire("validate", false);
                    clearElementStatus(element);
                    mobile.isValid = false;
                    if (element.value.length > 0) {
                        setElementStatus(element, false);
                    }
                    return;
                }
                startLoading(element);
                doServerSideCheck(element, handleServerResponse, handleServerError);
                mobile.phoneNumber = element.value;
            }
        }

        function doClientSideCheck(phone) {
            return constants.VALIDATION_PHONE_REGEX.test(phone);
        }

        function getCountryCode() {
            if (noSource)
                return mobile.options.countryCodeDefaultValue;
            var cc = "";
            if (typeof mobile.countrySource == "function") {
                cc = mobile.countrySource;
            } else if (typeof mobile.countrySource == "object" && mobile.countrySource.tagName) {
                //html element
                if (mobile.countrySource.tagName == "INPUT" || mobile.countrySource.tagName == "TEXTAREA" || mobile.countrySource.tagName == "SELECT") {
                    cc = mobile.countrySource.value;
                }
            }else if (typeof mobile.countrySource == "string") {
                cc = mobile.countrySource;
            }

            cc = pca.getIso2FromString(cc);

            if (!cc)
                return mobile.options.countryCodeDefaultValue;

            return cc;
        }

        function formatNumber(phoneNumber) {

            var countryCode = getCountryCode();

            return formatE164(countryCode, phoneNumber);
        }

        function doServerSideCheck(element, success, error) {
            pca.fetch(mobile.options.provider + "/Interactive/Validate/" + constants.PHONE_VALIDATION_API_VERSION, {
                key: mobile.options.key,
                phone: formatNumber(element.value),
                $cache: true,
                $block: true
            }, success, error);
        }

        function handleServerError() {
            stopLoading(mobile.phoneElement);
        }

        function handleServerResponse(items, response) {
            var element = mobile.phoneElement;
            if (items && items.length > 0) {
                var item = items[0];
                if (item.ValidationSucceeded && item.IsValid == 'Yes') {
                    mobile.isValid = true;
                }
                else if (item.IsValid == 'Maybe') {
                    mobile.isValid = true;
                }
                else {
                    mobile.isValid = false;
                }
                mobile.fire("validate", mobile.isValid, item);
                setElementStatus(element, mobile.isValid);
                stopLoading(element);
            } else {
                stopLoading(element);
            }
        }

        function clearElementStatus() {
            var element = mobile.phoneElement;
            if (!mobile.options.minimal) {
                element = element.wrapper;
            }
            pca.removeClass(element, 'validation-no');
            pca.removeClass(element, 'validation-yes');
            if (mobile.options.setCssClassValid.trim() !== "")
                pca.removeClass(element, mobile.options.setCssClassValid);
            if (mobile.options.setCssClassInvalid.trim() !== "")
                pca.removeClass(element, mobile.options.setCssClassInvalid);
            pca.addClass(element, "validation-none");
        }

        function setElementStatus(element, isValid) {
            if (!mobile.options.minimal) {
                element = element.wrapper;
            }
            var feedbackClass = "validation-" + (isValid ? "yes" : "no");
            if (isIe8OrLower)
                feedbackClass += "-fallback";
            pca.addClass(element, feedbackClass);
            pca.removeClass(element, "validation-none");
            pca.addClass(element, isValid ? mobile.options.setCssClassValid : mobile.options.setCssClassInvalid);
        }

        function startLoading() {
            clearElementStatus();
            if (!mobile.options.minimal) {
                pca.removeClass(mobile.phoneElement.wrapper, 'validation-none');

                if (!isIe8OrLower) {
                    pca.addClass(mobile.phoneElement.wrapper, 'pca-loading');
                } else {
                    pca.addClass(mobile.phoneElement.wrapper, 'pca-loading-fallback');
                }

            }
        };

        function stopLoading() {
            if (!mobile.options.minimal) {
                if (!isIe8OrLower) {
                    pca.removeClass(mobile.phoneElement.wrapper, 'pca-loading');
                } else {
                    pca.removeClass(mobile.phoneElement.wrapper, 'pca-loading-fallback');
                }
            }
        };

        pca.ready(mobile.load);
    };
})();
(function() {
    pca.MobileValidation = function () {

        var mobileValidation = new pca.Eventable(this);
        
        mobileValidation.controls = [];
        mobileValidation.bindings = pca && pca.platform && pca.platform.getBindingsForService ? pca.platform.getBindingsForService("PLATFORM_MOBILEVALIDATION") : [];

        mobileValidation.each = function (delegate) {
            for (var i = 0; i < mobileValidation.controls.length; i++) {
                delegate(mobileValidation.controls[i]);
            }
        };


        mobileValidation.load = function () {
            mobileValidation.destroy();

            for (var b = 0; b < mobileValidation.bindings.length; b++) {
                if (mobileValidation.bindings[b].fields.length) {
                    var key = "";
                    try { key = mobileValidation.bindings[b].options.key; } catch (ex){}
                    pca.platform.fire("fields", ["mobilevalidation", key, mobileValidation.bindings[b].fields]);
                    pca.platform.fire("options", ["mobilevalidation", key, mobileValidation.bindings[b].options]);
                    var control = new pca.Mobile(mobileValidation.bindings[b].fields, mobileValidation.bindings[b].options);

                    control.listen("validate", function (isValid, serverResponse) {
                        pca.platform.fire("data", ["mobilevalidation", control.key, isValid, serverResponse || null]);
                    });

                    mobileValidation.controls.push(control);
                    pca.platform.fire("load", ["mobilevalidation", control.key, control]);
                }
            }
            pca.platform.fire("ready", ["mobilevalidation", mobileValidation]);
        }


        mobileValidation.destroy = function () {
            mobileValidation.each(function (e) { e.destroy(); });
            mobileValidation.controls = [];
        }

        pca.ready(mobileValidation.load);
    };
    window.mobileValidation = pca.mobileValidation = new pca.MobileValidation();
})();
