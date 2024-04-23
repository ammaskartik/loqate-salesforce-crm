/*! Copyright © 2009-2016 Postcode Anywhere (Holdings) Ltd. (http://www.postcodeanywhere.co.uk)
 *
 * PlatformEmailValidation v1.10
 * Capture Plus for the web.
 *
 * WEB-1-3 05/05/2016 10:19:33
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
            xhr.setRequestHeader('pca-source', PCA_REQUEST_HEADER);
            xhr.open("GET", request.url, true);
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
/*
 * v1.00
 * 
 * Adds setCssClassValid, setCssClassInvalid, callFunction
 * 
 * Changes to layout of icon
 * 
 */
(function () {
    var pca = window.pca = window.pca || {};

    pca.Email = function(fields, options) {
        var email = new pca.Eventable(this);
        email.fields = fields || [];
        email.emailElement = null;
        email.isValid = false;
        email.width = 0;
        email.height = 0;
        email.fontSize = "11px";
        email.options = pca.extend({}, {
            provider: "EmailValidation",
            key: "",
            timeout: 5000,
            minimal: false,
            setCssClassValid: "",
            setCssClassInvalid: ""
        }, options || {});

        email.key = email.options.key;

        //cast booleans
        if (typeof email.options.minimal == "string") {
            email.options.minimal = email.options.minimal.toLowerCase() === "true";
        }

        var constants = {
            EMAIL_SUCCESS_INTERNAL_STATUS: "Valid",
            EMAIL_SUCCESS_EXTERNAL_STATUS: "Valid_CatchAll",
            EMAIL_VALIDATION_API_VERSION: "v2.00",
            VALIDATION_KEYPRESS_TIMEOUT: 1000,
            VALIDATION_EMAIL_REGEX: /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        }
        var isIe8OrLower = document.all && !document.addEventListener;

        email.load = function() {


            for (var f = 0; f < email.fields.length; f++) {
                var field = email.fields[f];
                if (field.field == "{Email}") {
                    email.emailElement = pca.getElement(field.element);
                }
            }

            if (!email.options.minimal && email.emailElement != null)
                scaffoldValidation();

            if (email.emailElement != null) {
                pca.listen(email.emailElement, "keyup", pca.debounce(validate, constants.VALIDATION_KEYPRESS_TIMEOUT));
                pca.listen(email.emailElement, "blur", validate);
                pca.listen(email.emailElement, "keydown", clearElementStatus);
            }
        };

        email.destroy = function() {
            if (email.options.minimal) {
                return email;
            }
            if (email.emailElement != null) {
                deScaffoldValidation();
            }
            return email;
        };

        function scaffoldValidation() {
            var el = email.emailElement;
            var parent = el.parentNode;
            if (!el.pca_wrapped) {
                var elBbox = el.getBoundingClientRect();
                email.width = elBbox.width;
                email.height = elBbox.height;
                email.fontSize = pca.getStyle(el, "font-size");
                var wrapper = pca.create("div", { className: "validator validator-email validation-none" });
                var feedbackElement = pca.create("div", { className: "feedback feedback-email" });
                feedbackElement.style.height = (email.height + 10) + "px";
                feedbackElement.style.width = (email.height + 10) + "px";
                feedbackElement.style.backgroundSize = ((email.height - 10) > 40 ? 40 : (email.height - 10)) + "px";
                feedbackElement.style.top = "-5px";
                parent.insertBefore(wrapper, el);
                wrapper.appendChild(el);
                wrapper.appendChild(feedbackElement);
                el.wrapper = wrapper;
                wrapper.style.height = email.height + "px";
                wrapper.style.width = email.width + "px";
                el.pca_wrapped = true;
            }
        }

        function deScaffoldValidation() {
            var el = email.emailElement;
            if (el.pca_wrapped) {
                var wrapper = el.wrapper;
                var parent = wrapper.parentNode;
                parent.insertBefore(el, wrapper);
                parent.removeChild(wrapper);
                el.pca_wrapped = false;
            }
        }

        function validate() {
            var element = email.emailElement;
            if (!doClientSideCheck(element.value)) {
                email.fire("validate", false);
                clearElementStatus(element);
                email.isValid = false;
                if (element.value.length > 0) {
                    setElementStatus(element, false);
                }
                return;
            }
            startLoading(element);
            doServerSideCheck(element, handleServerResponse, handleServerError);

        }

        function doClientSideCheck(email) {
            return constants.VALIDATION_EMAIL_REGEX.test(email);
        }

        function doServerSideCheck(element, success, error) {
            pca.fetch(email.options.provider + "/Interactive/Validate/" + constants.EMAIL_VALIDATION_API_VERSION, {
                key: email.options.key,
                email: element.value,
                timeout: email.options.timeout,
                $cache: true,
                $block: true
            }, success, error);
        }

        function handleServerError() {
            stopLoading(email.emailElement);
        }

        function handleServerResponse(items, response) {
            var element = email.emailElement;
            if (items && items.length > 0) {
                var item = items[0];
                email.isValid = item.ResponseCode === constants.EMAIL_SUCCESS_INTERNAL_STATUS || item.ResponseCode === constants.EMAIL_SUCCESS_EXTERNAL_STATUS;
                email.fire("validate", email.isValid, item);
                setElementStatus(element, email.isValid);
                stopLoading(element);
            } else {
                stopLoading(element);
            }
        }

        function clearElementStatus() {
            var element = email.emailElement;
            if (!email.options.minimal) {
                element = element.wrapper;
            }
            pca.removeClass(element, 'validation-no');
            pca.removeClass(element, 'validation-yes');
            if (email.options.setCssClassValid.trim() !== "")
                pca.removeClass(element, email.options.setCssClassValid);
            if (email.options.setCssClassInvalid.trim() !== "")
                pca.removeClass(element, email.options.setCssClassInvalid);
            pca.addClass(element, "validation-none");
        }

        function setElementStatus(element, isValid) {
            if (!email.options.minimal) {
                element = element.wrapper;
            }
            var feedbackClass = "validation-" + (isValid ? "yes" : "no");
            if (isIe8OrLower)
                feedbackClass += "-fallback";
            pca.addClass(element, feedbackClass);
            pca.removeClass(element, "validation-none");
            pca.addClass(element, isValid ? email.options.setCssClassValid : email.options.setCssClassInvalid);

        }

       

        function startLoading() {
            clearElementStatus();
            if (!email.options.minimal) {
                pca.removeClass(email.emailElement.wrapper, 'validation-none');

                if (!isIe8OrLower) {
                    pca.addClass(email.emailElement.wrapper, 'pca-loading');
                } else {
                    pca.addClass(email.emailElement.wrapper, 'pca-loading-fallback');
                }

            }
        };

        function stopLoading() {
            if (!email.options.minimal) {
                if (!isIe8OrLower) {
                    pca.removeClass(email.emailElement.wrapper, 'pca-loading');
                } else {
                    pca.removeClass(email.emailElement.wrapper, 'pca-loading-fallback');
                }
            }
        };

        pca.ready(email.load);
    };
})();
(function() {
    pca.EmailValidation = function () {

        var emailValidation = new pca.Eventable(this);
        
        emailValidation.controls = [];
        emailValidation.bindings = pca && pca.platform && pca.platform.getBindingsForService ? pca.platform.getBindingsForService("PLATFORM_EMAILVALIDATION") : [];

        emailValidation.each = function(delegate) {
            for (var i = 0; i < emailValidation.controls.length; i++) {
                delegate(emailValidation.controls[i]);
            }
        };


        emailValidation.load = function () {
            emailValidation.destroy();

            for (var b = 0; b < emailValidation.bindings.length; b++) {
                var key = "";
                try { key = emailValidation.bindings[b].options.key; } catch (ex) { }
                pca.platform.fire("fields", ["emailvalidation", key, emailValidation.bindings[b].fields]);
                pca.platform.fire("options", ["emailvalidation", key, emailValidation.bindings[b].options]);
                var control = new pca.Email(emailValidation.bindings[b].fields, emailValidation.bindings[b].options);

                control.listen("validate", function (isValid, serverResponse) {
                    pca.platform.fire("data", ["emailvalidation", control.key, isValid, serverResponse || null]);
                });

                emailValidation.controls.push(control);
                pca.platform.fire("load", ["emailvalidation", control.key, control]);
            }
            pca.platform.fire("ready", ["emailvalidation", emailValidation]);
        }


        emailValidation.destroy = function() {
            emailValidation.each(function (e) { e.destroy(); });
            emailValidation.controls = [];
        }

        pca.ready(emailValidation.load);
    };
    window.emailValidation = pca.emailValidation = new pca.EmailValidation();
})();
